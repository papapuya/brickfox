import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Sparkles, Settings2, Code, Eye, Save, ArrowLeft, Plus, Trash2, ExternalLink, Copy, Loader2, FileText, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ExtractedProductData, ProductInProject, Template } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import CustomAttributesPreview from "@/components/custom-attributes-preview";

interface FileMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
}

// Helper function to clean HTML responses from markdown code blocks
function cleanHTMLResponse(content: string): string {
  // Remove markdown code blocks (```html, ```, etc.) - more comprehensive cleaning
  let cleaned = content.replace(/^```(?:html|HTML)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  
  // Remove any remaining ```html at the beginning
  cleaned = cleaned.replace(/^```html\s*\n?/gm, '');
  cleaned = cleaned.replace(/^```\s*\n?/gm, '');
  
  // Remove any remaining markdown formatting
  cleaned = cleaned.trim();
  
  return cleaned;
}

// Helper functions to convert units
function convertWeightToGrams(weightStr: string): string {
  // Convert kg to g
  const kgMatch = weightStr.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kgMatch) {
    const kgValue = parseFloat(kgMatch[1].replace(',', '.'));
    const grams = Math.round(kgValue * 1000);
    return weightStr.replace(kgMatch[0], `${grams} g`);
  }
  
  // If already in grams, return as is
  return weightStr;
}

function convertDimensionsToMm(dimensionsStr: string): string {
  // Convert cm to mm
  const cmMatch = dimensionsStr.match(/(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  if (cmMatch) {
    const dim1 = Math.round(parseFloat(cmMatch[1].replace(',', '.')) * 10);
    const dim2 = Math.round(parseFloat(cmMatch[2].replace(',', '.')) * 10);
    const dim3 = Math.round(parseFloat(cmMatch[3].replace(',', '.')) * 10);
    return dimensionsStr.replace(cmMatch[0], `${dim1} × ${dim2} × ${dim3} mm`);
  }
  
  // If already in mm, return as is
  return dimensionsStr;
}

// Helper function to clean extracted text from markdown formatting
function cleanExtractedText(content: string): string {
  // Remove markdown code blocks (```plaintext, ```, etc.)
  let cleaned = content.replace(/^```(?:plaintext|html|HTML)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  
  // Remove ALL occurrences of markdown bold indicators (**)
  cleaned = cleaned.replace(/\*\*/g, '');
  
  // Remove ALL occurrences of markdown italic indicators (*)
  cleaned = cleaned.replace(/\*/g, '');
  
  // Remove any remaining markdown formatting
  cleaned = cleaned.trim();
  
  return cleaned;
}

// Helper function to clean measurement values (remove units)
function cleanMeasurementValue(value: string): string {
  // Remove common measurement units
  let cleaned = value
    .replace(/\s*(mm|cm|m|km|inch|in|ft|feet)\s*/gi, '') // Length units
    .replace(/\s*(g|kg|mg|lb|pound|oz|ounce)\s*/gi, '') // Weight units
    .replace(/\s*(ml|l|dl|cl|gal|gallon)\s*/gi, '') // Volume units
    .replace(/\s*(V|mV|kV|volt)\s*/gi, '') // Voltage units
    .replace(/\s*(A|mA|kA|amp|ampere)\s*/gi, '') // Current units
    .replace(/\s*(W|mW|kW|watt)\s*/gi, '') // Power units
    .replace(/\s*(mAh|Ah|Wh|kWh)\s*/gi, '') // Energy/Capacity units
    .replace(/\s*(Hz|kHz|MHz|GHz)\s*/gi, '') // Frequency units
    .replace(/\s*(°C|°F|K|celsius|fahrenheit|kelvin)\s*/gi, '') // Temperature units
    .replace(/\s*(bar|psi|pa|pascal|atm)\s*/gi, '') // Pressure units
    .replace(/\s*(rpm|U\/min|UPM)\s*/gi, '') // Rotation units
    .replace(/\s*(dB|db)\s*/gi, '') // Decibel units
    .replace(/\s*(lux|lx)\s*/gi, '') // Light units
    .replace(/\s*(dpi|ppi)\s*/gi, '') // Resolution units
    .replace(/\s*(bit|byte|kb|mb|gb|tb)\s*/gi, '') // Data units
    .replace(/\s*(h|min|sec|s|ms|μs|ns)\s*/gi, '') // Time units
    .replace(/\s*(typisch|typical|ca\.|approx\.|~|±)\s*/gi, '') // Common qualifiers
    .trim();
  
  return cleaned;
}

const defaultTemplate = `<h2>AAA 1,5V 1620mWh (ca. 1000mAh) (Micro, LR03) Li-Ionen-Akku (Wiederaufladbar) mit Indikator</h2>
<p>Wiederaufladbarer AAA Li-Ionen-Akku mit konstanter 1,5V Spannung und integriertem Ladestandsanzeiger. Im Gegensatz zu herkömmlichen NiMH-Akkus liefert dieser Akku durchgehend 1,5V und verfügt über einen integrierten USB-C Ladeanschluss.</p>

<h4>Vorteile & Eigenschaften:</h4>
<p>✅ Konstante 1,5V Spannung</p>
<p>✅ Integrierter LED-Indikator zur Ladestandsanzeige</p>
<p>✅ USB-C Ladeanschluss</p>
<p>✅ 1620mWh Energieinhalt (ca. 1000mAh)</p>
<p>✅ Kein Memory-Effekt</p>

<h4>Technische Daten</h4>
<table border="0" summary="">
<tbody>
<tr>
<td>Verfügbare Energie:</td>
<td>1620 mWh</td>
</tr>
<tr>
<td>Kapazität in mAh:</td>
<td>ca. 1000mAh</td>
</tr>
</tbody>
</table>`;

export default function ProductDescriptionCreator() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Parse URL search params from window.location.search (wouter's location doesn't include query params)
  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get('project');
  const productId = searchParams.get('product');

  const [productName, setProductName] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<FileMetadata[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedProductData[]>([]);
  // Template-System entfernt für bessere Stabilität
  const [htmlCode, setHtmlCode] = useState<string>("");
  const [previewText, setPreviewText] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [editorMode, setEditorMode] = useState<"code" | "preview">("code");
  const [refinementPrompt, setRefinementPrompt] = useState<string>("");
  
  // Custom Attributes for Product Descriptions
  const [customAttributes, setCustomAttributes] = useState<Array<{key: string, value: string, type: string}>>([]);
  const [manualAttributes, setManualAttributes] = useState<Array<{key: string, value: string, type: string}>>([]);
  const [allCustomAttributes, setAllCustomAttributes] = useState<Array<{key: string, value: string, type: string}>>([]);
  const [newAttributeKey, setNewAttributeKey] = useState<string>("");
  const [newAttributeValue, setNewAttributeValue] = useState<string>("");
  const [exactProductName, setExactProductName] = useState<string>("");
  const [articleNumber, setArticleNumber] = useState<string>("");
  const [articleNumberPrefix, setArticleNumberPrefix] = useState<string>("AT");
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [selectedFilesForGeneration, setSelectedFilesForGeneration] = useState<Set<number>>(new Set());
  const [productUrl, setProductUrl] = useState<string>("");

  // Load existing product if product ID is provided
  const { data: productData } = useQuery<{ success: boolean; product: ProductInProject }>({
    queryKey: ['/api/products', productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) {
        throw new Error('Failed to load product');
      }
      return res.json();
    },
    enabled: !!productId,
  });

  // Set initial state when product loads
  useEffect(() => {
    if (productData?.product) {
      const product = productData.product;
      setProductName(product.name || "");
      setHtmlCode(product.htmlCode || "");
      setPreviewText(product.previewText || "");
      // Template removed
      setExtractedData(product.extractedData || []);
      setCustomAttributes(product.customAttributes || []);
      setExactProductName(product.exactProductName || "");
      setArticleNumber(product.articleNumber || "");
      // Rehydrate file metadata
      if (product.files && product.files.length > 0) {
        const filesWithUrls = product.files.map(file => ({
          ...file,
          fileUrl: (file as any).fileUrl || ''
        }));
        setUploadedFiles(filesWithUrls);
      }
    }
  }, [productData]);

  // URL Scraping mutation
  const urlScrapingMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest('POST', '/api/scrape-url', {
        url,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      const result = data.result;
      
      // Add to extracted data
      const newExtractedDataItem: ExtractedProductData = {
        id: result.id,
        fileName: result.fileName,
        fileType: result.fileType,
        extractedText: result.extractedText,
        productName: result.productName,
        description: result.description,
        dimensions: result.dimensions,
        weight: result.weight,
        voltage: result.voltage,
        capacity: result.capacity,
        power: result.power,
        technicalSpecs: result.technicalSpecs,
        confidence: result.confidence,
        createdAt: result.createdAt,
        url: result.url,
        supplierTableHtml: result.supplierTableHtml,
        bullets: result.bullets,
      };

      // Ersetze alte Daten komplett mit neuen Daten (keine Mischung!)
      const newExtractedData = [newExtractedDataItem];
      setExtractedData(newExtractedData);
      console.log('Replaced all extracted data with new data:', newExtractedData);
      
      // Set product name if not already set
      if (!productName && result.productName) {
        setProductName(result.productName);
      }

      // Auto-generate structured description after URL analysis
      if (newExtractedData.length > 0) {
        console.log('Starting auto-generation with data:', newExtractedData);
        console.log('Latest extracted data:', newExtractedData[newExtractedData.length - 1]);
        try {
          // Prepare custom attributes data
          const customAttributesData = {
            exactProductName: exactProductName.trim() || undefined,
            articleNumber: articleNumber.trim() || undefined,
            customAttributes: customAttributes.filter(attr => attr.key.trim() && attr.value.trim()),
          };

          console.log('Sending request to /api/generate-description');
          // Verwende nur die neuesten Daten (da wir nur ein Element haben)
          const latestData = newExtractedData[0];
          console.log('Using latest data for generation:', latestData);
          
          const res = await fetch('/api/generate-description', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              extractedData: [latestData].map(d => ({
                extractedText: d.extractedText,
                productName: d.productName,
                description: '',
                bullets: d.bullets || [],
                supplierTableHtml: d.supplierTableHtml || '',
                technicalSpecs: d.technicalSpecs || {},
                fileName: d.fileName,
                fileType: d.fileType,
                confidence: d.confidence,
                createdAt: d.createdAt,
                url: d.url,
              })),
              customAttributes: customAttributesData,
            }),
          });

          if (res.ok) {
            const response: { success: boolean; description: string } = await res.json();
            console.log('API Response:', response);
            if (response.success && response.description) {
              const cleanedDescription = cleanHTMLResponse(response.description);
              console.log('Setting HTML code:', cleanedDescription.substring(0, 200) + '...');
              setHtmlCode(cleanedDescription);
              setEditorMode("code");
              toast({
                title: "Strukturierte Beschreibung generiert",
                description: "Die Beschreibung wurde automatisch erstellt",
              });
            } else {
              console.error('API response not successful or missing description:', response);
            }
          } else {
            console.error('API request failed with status:', res.status);
          }
        } catch (autoGenError) {
          console.error('Auto description generation failed:', autoGenError);
          toast({
            title: "Automatische Generierung fehlgeschlagen",
            description: "Beschreibung konnte nicht automatisch erstellt werden",
            variant: "destructive"
          });
        }
      }

      toast({
        title: "URL erfolgreich analysiert",
        description: `Produkt "${result.productName}" wurde von der Website extrahiert`,
      });
    },
    onError: (error) => {
      console.error('URL scraping error:', error);
      
      let errorMessage = error.message || "Die URL konnte nicht analysiert werden";
      if (error.message.includes('timeout') || error.message.includes('408')) {
        errorMessage = 'Die Website antwortet zu langsam. Versuche es mit einer anderen URL oder lade eine Datei hoch.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Produkt nicht gefunden. Bitte prüfe die URL.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Verbindung zum Server fehlgeschlagen. Bitte versuche es erneut.';
      }
      
      toast({
        title: "Fehler beim URL-Scraping",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Save/Create product mutation
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error('Projekt-ID fehlt');
      }

      // Combine Grunddaten (Custom Attributes) with Manuelle Attribute
      // Manuelle Attribute override Grunddaten values
      const combinedAttributes = [...allCustomAttributes];
      
      // Add manuelle attributes, overriding any existing ones with the same key
      manualAttributes.forEach(manualAttr => {
        const existingIndex = combinedAttributes.findIndex(attr => attr.key === manualAttr.key);
        if (existingIndex >= 0) {
          // Override existing attribute with manual value
          combinedAttributes[existingIndex] = manualAttr;
        } else {
          // Add new manual attribute
          combinedAttributes.push(manualAttr);
        }
      });

      const productPayload = {
        projectId,
        name: productName.trim() || undefined,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        htmlCode: htmlCode || undefined,
        previewText: previewText || undefined,
        extractedData: extractedData.length > 0 ? extractedData : undefined,
        template: '',
        customAttributes: combinedAttributes.length > 0 ? combinedAttributes : undefined,
        exactProductName: exactProductName.trim() || undefined,
        articleNumber: articleNumber.trim() || undefined,
      };

      if (productId) {
        // Update existing product
        return apiRequest('PATCH', `/api/products/${productId}`, productPayload);
      } else {
        // Create new product
        return apiRequest('POST', `/api/projects/${projectId}/products`, productPayload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'products'] });
      toast({
        title: productId ? "Produkt aktualisiert" : "Produkt erstellt",
        description: productId ? "Änderungen wurden gespeichert" : "Produkt wurde zum Projekt hinzugefügt",
      });
      // Navigate back to project detail
      setLocation(`/project/${projectId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Produkt konnte nicht gespeichert werden",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    console.log('Starting file upload:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));

    setIsAnalyzing(true);
    const formData = new FormData();
    files.forEach(file => {
      console.log('Adding file to FormData:', file.name);
      formData.append('files', file);
    });

    try {
      console.log('Sending request to /api/analyze-files');
      const res = await fetch('/api/analyze-files', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Upload failed:', res.status, errorText);
        throw new Error(`${res.status}: ${errorText}`);
      }

      const response: { success: boolean; results: ExtractedProductData[] } = await res.json();
      console.log('Upload response:', response);

      if (response.success) {
        const newExtractedData = [...extractedData, ...response.results];
        setExtractedData(newExtractedData);
        // Store file metadata
        const fileMetadata: FileMetadata[] = files.map(f => ({
          fileName: f.name,
          fileType: f.type,
          fileSize: f.size,
          fileUrl: URL.createObjectURL(f),
        }));
        setUploadedFiles(prev => [...prev, ...fileMetadata]);
        toast({
          title: "Dateien analysiert",
          description: `${files.length} Datei(en) erfolgreich analysiert`,
        });

        // Auto-generate product name if not already set
        if (!productName.trim() && newExtractedData.length > 0) {
          try {
            const nameRes = await fetch('/api/generate-product-name', {
              method: 'POST',
              body: JSON.stringify({
                extractedData: newExtractedData.map(d => d.extractedText),
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (nameRes.ok) {
              const nameResponse: { success: boolean; productName: string } = await nameRes.json();
              if (nameResponse.success && nameResponse.productName) {
                setProductName(nameResponse.productName);
                toast({
                  title: "Produktname generiert",
                  description: "Name wurde automatisch aus den Dateien erstellt",
                });
              }
            }
          } catch (nameError) {
            // Silent fail - product name generation is optional
            console.warn('Auto product name generation failed:', nameError);
          }
        }

        // Auto-generate structured description after analysis
        if (newExtractedData.length > 0) {
          try {
            console.log('Auto-generating structured description...');
            
            // Use the same logic as handleGenerate but automatically
            const filesToUse = newExtractedData;
            let parsedData: any = {};
            
            // Parse data from extracted files
            if (filesToUse.length > 0 && typeof filesToUse[0].extractedText === 'string' && filesToUse[0].extractedText.includes('{')) {
              parsedData = JSON.parse(filesToUse[0].extractedText);
            } else {
              // Falls nur Strings, müssen wir die Daten anders strukturieren
              const firstFileData = filesToUse[0];
              const technicalSpecs = firstFileData?.technicalSpecs;
              
              parsedData = {
                titel: firstFileData?.productName || firstFileData?.extractedText || 'Produkttitel',
                beschreibung: (() => {
                  // Prüfe verschiedene Quellen
                  const sources = [
                    firstFileData.description
                  ].filter(Boolean);
                  
                  // Nutze die erste gute Beschreibung
                  for (const desc of sources) {
                    if (desc && 
                        desc !== firstFileData.productName &&
                        desc.length > 30 &&
                        desc.length < 500) {
                      return desc;
                    }
                  }
                  
                  // Fallback: Erstelle eine einfache Beschreibung
                  return firstFileData?.extractedText?.substring(0, 200) || 'Produktbeschreibung wird generiert...';
                })(),
                vorteile: firstFileData?.bullets || [],
                technischeDaten: (() => {
                  const specs = technicalSpecs || {};
                  const result: any = {};
                  if (specs.ladestrom) result.spannung = specs.ladestrom;
                  if (specs.standards) result.kapazität = specs.standards;
                  if (specs.outputs) result.entladestrom = specs.outputs;
                  if (specs.weight) result.gewicht = specs.weight;
                  if (specs.size) result.abmessungen = specs.size;
                  return result;
                })()
              };
            }
            
            // Bereinige die Daten
            parsedData = bereinigeGescrappteDaten(parsedData);
            
            // Prepare custom attributes data
            const customAttributesData = {
              exactProductName: exactProductName.trim() || undefined,
              articleNumber: articleNumber.trim() || undefined,
              customAttributes: customAttributes.length > 0 ? customAttributes : undefined,
            };
            
            // Generate structured description
            const res = await fetch('/api/generate-description', {
              method: 'POST',
              body: JSON.stringify({
                extractedData: filesToUse.map(d => ({
                  extractedText: d.extractedText,
                  productName: d.productName,
                  description: '',
                  bullets: parsedData.vorteile || [],
                  supplierTableHtml: d.supplierTableHtml || '',
                  technicalSpecs: (() => {
                    const specs = d.technicalSpecs || {};
                    const filteredSpecs: any = {};
                    if (specs.ladestrom) filteredSpecs.ladestrom = specs.ladestrom;
                    if (specs.standards) filteredSpecs.standards = specs.standards;
                    if (specs.outputs) filteredSpecs.outputs = specs.outputs;
                    if (specs.weight) filteredSpecs.weight = specs.weight;
                    if (specs.size) filteredSpecs.size = specs.size;
                    return filteredSpecs;
                  })(),
                  url: d.url || '',
                  fileName: d.fileName
                })),
                template: '',
                customAttributes: customAttributesData,
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (res.ok) {
              const response: { success: boolean; description: string } = await res.json();
              if (response.success && response.description) {
                const cleanedDescription = cleanHTMLResponse(response.description);
                setHtmlCode(cleanedDescription);
                setEditorMode("code");
                toast({
                  title: "Strukturierte Beschreibung generiert",
                  description: "Die Beschreibung wurde automatisch erstellt",
                });
              }
            }
          } catch (autoGenError) {
            // Silent fail - auto generation is optional
            console.warn('Auto description generation failed:', autoGenError);
          }
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        variant: "destructive",
        title: "Analyse fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUrlScrape = async () => {
    if (!productUrl.trim()) {
      toast({
        variant: "destructive",
        title: "Keine URL",
        description: "Bitte geben Sie eine URL ein",
      });
      return;
    }

    // Zeige längere Ladezeit an
    toast({
      title: "URL wird analysiert...",
      description: "Dies kann bis zu 90 Sekunden dauern. Bitte warten Sie.",
    });

    urlScrapingMutation.mutate(productUrl);
  };

  // Template-System entfernt für bessere Stabilität

  // Diese Funktion bereinigt die gescrapten Daten
  const bereinigeGescrappteDaten = (rohdaten: any) => {
    console.log('Rohdaten vor Bereinigung:', rohdaten);
    
    // Filter für Vorteile - entferne Navigation/Menü-Items
    const invalidVorteile = [
      'schnellauswahl',
      'akkus',
      'kamera-akkus',
      'lithium akkupacks',
      'externe akkus',
      'powerbanks',
      'powerstations',
      'jump starter',
      'akkusakkus'
    ];
    
    const bereinigteDaten = {
      ...rohdaten,
      // ✅ USPs generieren - 5 grüne Bulletpoints mit echten Kundenvorteilen
      vorteile: (() => {
        const usps: string[] = [];
        
        // Aus der Beschreibung intelligente USPs ableiten
        const beschreibung = (rohdaten.beschreibung || rohdaten.extractedText || '').toLowerCase();
        
        // Lithium-Ionen Technologie - VORTEIL für Kunde
        if (beschreibung.includes('lithium') || beschreibung.includes('li-ion')) {
          usps.push('Moderne Lithium-Ionen Technologie - höchste Energiedichte und längste Lebensdauer');
        }
        
        // BMS Schutzschaltung - SICHERHEIT für Kunde
        if (beschreibung.includes('bms') || beschreibung.includes('schutz') || beschreibung.includes('elektronisch')) {
          usps.push('Integrierte Schutzschaltung - maximale Sicherheit vor Überladung und Tiefentladung');
        }
        
        // Wiederaufladbar - KOSTENSPAREND für Kunde
        if (beschreibung.includes('wiederauflad') || beschreibung.includes('auflad')) {
          usps.push('Wiederaufladbar - spart Geld und schont die Umwelt durch Wiederverwendung');
        }
        
        // Hohe Kapazität - LANGFRISTIGE NUTZUNG für Kunde
        if (beschreibung.includes('mah') || beschreibung.includes('kapazität') || beschreibung.includes('wh')) {
          const kapazitaetMatch = (rohdaten.beschreibung || rohdaten.extractedText || '').match(/(\d+[\.,]?\d*)\s*(mAh|Wh)/i);
          if (kapazitaetMatch) {
            usps.push(`Hohe Kapazität von ${kapazitaetMatch[1]} ${kapazitaetMatch[2]} - langanhaltende Leistung ohne häufiges Nachladen`);
          } else {
            usps.push('Hohe Kapazität - langanhaltende Leistung ohne häufiges Nachladen');
          }
        }
        
        // Vielseitige Anwendung - FLEXIBILITÄT für Kunde
        if (beschreibung.includes('mobil') || beschreibung.includes('anwendung') || beschreibung.includes('gerät')) {
          usps.push('Vielseitig einsetzbar - perfekt für mobile Geräte und professionelle Anwendungen');
        }
        
        // Aus technischen Daten intelligente USPs ableiten
        const techData = rohdaten.technischeDaten || [];
        
        // Spannung - ZUVERLÄSSIGKEIT für Kunde
        const spannung = techData.find((item: any) => 
          item.label?.toLowerCase().includes('spannung') || 
          item.label?.toLowerCase().includes('voltage')
        );
        if (spannung && !usps.some(usp => usp.includes('Spannung'))) {
          usps.push(`Konstante Spannung von ${spannung.wert} - zuverlässige und stabile Leistung`);
        }
        
        // Kapazität - LANGFRISTIGE NUTZUNG für Kunde
        const kapazitaet = techData.find((item: any) => 
          item.label?.toLowerCase().includes('kapazität') || 
          item.label?.toLowerCase().includes('capacity') ||
          item.label?.toLowerCase().includes('mah')
        );
        if (kapazitaet && !usps.some(usp => usp.includes('Kapazität'))) {
          usps.push(`Hohe Kapazität von ${kapazitaet.wert} - langanhaltende Leistung ohne häufiges Nachladen`);
        }
        
        // Entladestrom - LEISTUNG für Kunde
        const entladestrom = techData.find((item: any) => 
          item.label?.toLowerCase().includes('entladestrom') || 
          item.label?.toLowerCase().includes('entlade') ||
          item.label?.toLowerCase().includes('strom')
        );
        if (entladestrom && !usps.some(usp => usp.includes('Strom'))) {
          usps.push(`Hoher Entladestrom von ${entladestrom.wert} - starke Leistung für anspruchsvolle Geräte`);
        }
        
        // Abmessungen - KOMPAKTHEIT für Kunde
        const abmessungen = techData.find((item: any) => 
          item.label?.toLowerCase().includes('abmessung') || 
          item.label?.toLowerCase().includes('dimension') ||
          item.label?.toLowerCase().includes('größe')
        );
        if (abmessungen && !usps.some(usp => usp.includes('kompakt'))) {
          usps.push(`Kompakte Abmessungen ${abmessungen.wert} - platzsparende Installation`);
        }
        
        // Gewicht - LEICHTIGKEIT für Kunde
        const gewicht = techData.find((item: any) => 
          item.label?.toLowerCase().includes('gewicht') || 
          item.label?.toLowerCase().includes('weight')
        );
        if (gewicht && !usps.some(usp => usp.includes('leicht'))) {
          usps.push(`Leichtes Gewicht von ${gewicht.wert} - einfache Handhabung und Transport`);
        }
        
        // Zulassungen - QUALITÄT für Kunde
        const zulassungen = techData.find((item: any) => 
          item.label?.toLowerCase().includes('zulassung') || 
          item.label?.toLowerCase().includes('zertifikat') ||
          item.label?.toLowerCase().includes('norm')
        );
        if (zulassungen && !usps.some(usp => usp.includes('Qualität'))) {
          usps.push(`Internationale Zulassungen - geprüfte Qualität und Sicherheit`);
        }
        
        // Fallback USPs mit echten Kundenvorteilen wenn nicht genug gefunden
        if (usps.length < 5) {
          const fallbackUSPs = [
            'Hochwertige Verarbeitung - lange Lebensdauer und Zuverlässigkeit',
            'Professionelle Qualität - ideal für gewerbliche und private Nutzung',
            'Einfache Installation - sofort einsatzbereit ohne komplizierte Einrichtung',
            'Umweltschonend - nachhaltige Technologie für verantwortungsvolle Nutzung',
            'Kosteneffizient - optimale Preis-Leistung für langfristige Nutzung'
          ];
          
          // Ergänze bis 5 USPs
          while (usps.length < 5) {
            const fallback = fallbackUSPs[usps.length];
            if (fallback && !usps.includes(fallback)) {
              usps.push(fallback);
            } else {
              break;
            }
          }
        }
        
        // Begrenze auf 5 USPs
        return usps.slice(0, 5);
      })(),
      
      // Technische Daten aus der Tabelle extrahieren (1:1)
      technischeDaten: (() => {
        const specs: Array<{label: string, wert: string}> = [];
        
        // NUR aus extractedText - Technische Details Tabelle 1:1 übertragen
        const extractedText = rohdaten.extractedText || '';
        
        // Suche nach "Technische Details" Sektion
        const techDetailsMatch = extractedText.match(/Technische Details(.*?)(?:Weitere Informationen|Lieferumfang|Downloads|$)/);
        if (techDetailsMatch) {
          const techSection = techDetailsMatch[1];
          console.log('Gefundene Technische Details Sektion:', techSection.substring(0, 500));
          
          // Parse Zeilen - jede Zeile ist ein technisches Detail
          const lines = techSection.split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line && line.length > 0);
          
          console.log('Technische Details Zeilen:', lines);
          
          // Jede Zeile als "Label: Wert" oder "Label Wert" parsen
          lines.forEach((line: string) => {
            // Format 1: "Label: Wert"
            let match = line.match(/^([^:]+):\s*(.+)$/);
            if (match) {
              specs.push({
                label: match[1].trim(),
                wert: match[2].trim()
              });
              return;
            }
            
            // Format 2: "Label Wert" (z.B. "Nominal-Spannung 7,2 V")
            match = line.match(/^([A-Za-zäöüÄÖÜß\s\-]+?)\s+([0-9,.\s\w\/°C%]+)$/);
            if (match) {
              specs.push({
                label: match[1].trim(),
                wert: match[2].trim()
              });
              return;
            }
            
            // Format 3: Einfach als Label behandeln wenn kein Wert erkennbar
            if (line.length > 3 && line.length < 50) {
              specs.push({
                label: line,
                wert: ''
              });
            }
          });
        }
        
        console.log('Extrahierte technische Daten (1:1 aus Tabelle):', specs);
        return specs;
      })()
    };
    
    console.log('Bereinigte Daten:', bereinigteDaten);
    return bereinigteDaten;
  };

  const handleGenerate = async () => {
    if (extractedData.length === 0) {
      toast({
        variant: "destructive",
        title: "Keine Daten",
        description: "Bitte laden Sie zuerst Dateien hoch",
      });
      return;
    }

    // Use selected files for generation, or all files if none selected
    let filesToUse: ExtractedProductData[] = [];
    
    if (selectedFilesForGeneration.size > 0) {
      // Use only selected files for generation
      filesToUse = Array.from(selectedFilesForGeneration)
        .map(index => extractedData[index])
        .filter(Boolean);
      
      console.log('Selected files for generation:', Array.from(selectedFilesForGeneration));
      console.log('Files to use:', filesToUse.map(f => f.fileName));
    } else {
      // Use only the latest file if none selected (avoid mixing old data)
      filesToUse = extractedData.slice(-1); // Nur das neueste Element
      console.log('Using only latest file:', filesToUse.map(f => f.fileName));
    }

    if (filesToUse.length === 0) {
      toast({
        variant: "destructive",
        title: "Keine Dateien ausgewählt",
        description: "Bitte wählen Sie Dateien für die Generierung aus",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Prepare custom attributes data
      const customAttributesData = {
        exactProductName: exactProductName.trim() || undefined,
        articleNumber: articleNumber.trim() || undefined,
        customAttributes: customAttributes.filter(attr => attr.key.trim() && attr.value.trim()),
      };

      console.log('Sending to generate-description API:');
      console.log('Extracted data:', filesToUse.map(d => d.extractedText));
      console.log('Template: removed');
      console.log('Custom attributes:', customAttributesData);

      // SCHRITT 1: Gescrapte Daten parsen
      console.log('Raw extracted data:', filesToUse);
      console.log('First file data:', filesToUse[0]);
      
      // Falls extractedData ein Array von Strings ist, müssen wir es erst parsen
      let parsedData;
      try {
        // Versuche, ob die Daten JSON sind
        if (filesToUse.length > 0 && typeof filesToUse[0].extractedText === 'string' && filesToUse[0].extractedText.includes('{')) {
          parsedData = JSON.parse(filesToUse[0].extractedText);
        } else {
          // Falls nur Strings, müssen wir die Daten anders strukturieren
          const firstFileData = filesToUse[0];
          const technicalSpecs = firstFileData?.technicalSpecs;
          
          parsedData = {
            titel: firstFileData?.productName || firstFileData?.extractedText || 'Produkttitel',
            beschreibung: (() => {
              // Prüfe verschiedene Quellen
              const sources = [
                firstFileData.description
              ].filter(Boolean);
              
              // Nutze die erste gute Beschreibung
              for (const desc of sources) {
                if (desc && 
                    desc !== firstFileData.productName &&
                    desc.length > 30 &&
                    desc.length < 500) {
                  return desc;
                }
              }
              
              // Fallback: Generiere aus Tech-Specs
              const specs = (firstFileData.bullets || [])
                .filter((v: string) => v.includes(':'))
                .slice(0, 3)
                .map((v: string) => v.toLowerCase());
              
              if (specs.length > 0) {
                return `${firstFileData.productName}. Technische Details: ${specs.join(', ')}.`;
              }
              
              return `${firstFileData.productName}. Hochwertiges Produkt für professionelle Anwendungen.`;
            })(),
            vorteile: firstFileData?.bullets || [],
            technischeDaten: (() => {
              const specs: Array<{label: string, wert: string}> = [];
              
              // NUR aus extractedText - Technische Details Tabelle 1:1 übertragen
              const extractedText = firstFileData.extractedText || '';
              
              // Suche nach "Technische Details" Sektion
              const techDetailsMatch = extractedText.match(/Technische Details(.*?)(?:Weitere Informationen|Lieferumfang|Downloads|$)/);
              if (techDetailsMatch) {
                const techSection = techDetailsMatch[1];
                console.log('Gefundene Technische Details Sektion:', techSection.substring(0, 500));
                
                // Parse Zeilen - jede Zeile ist ein technisches Detail
                const lines = techSection.split('\n')
                  .map(line => line.trim())
                  .filter(line => line && line.length > 0);
                
                console.log('Technische Details Zeilen:', lines);
                
                // Jede Zeile als "Label: Wert" oder "Label Wert" parsen
                lines.forEach(line => {
                  // Format 1: "Label: Wert"
                  let match = line.match(/^([^:]+):\s*(.+)$/);
                  if (match) {
                    specs.push({
                      label: match[1].trim(),
                      wert: match[2].trim()
                    });
                    return;
                  }
                  
                  // Format 2: "Label Wert" (z.B. "Nominal-Spannung 7,2 V")
                  match = line.match(/^([A-Za-zäöüÄÖÜß\s\-]+?)\s+([0-9,.\s\w\/°C%]+)$/);
                  if (match) {
                    specs.push({
                      label: match[1].trim(),
                      wert: match[2].trim()
                    });
                    return;
                  }
                  
                  // Format 3: Einfach als Label behandeln wenn kein Wert erkennbar
                  if (line.length > 3 && line.length < 50) {
                    specs.push({
                      label: line,
                      wert: ''
                    });
                  }
                });
              }
              
              console.log('Extrahierte technische Daten (1:1 aus Tabelle):', specs);
              return specs;
            })(),
            weitereEigenschaften: [],
            geeignetFuer: '',
            sicherheitshinweise: '',
            lieferumfang: '',
            url: firstFileData?.url || '',
            fileName: firstFileData?.fileName || ''
          };
        }
      } catch (e) {
        console.error('Fehler beim Parsen der Daten:', e);
        parsedData = {
          titel: filesToUse[0]?.productName || 'Produkttitel',
          beschreibung: filesToUse[0]?.extractedText || '',
          vorteile: [],
          technischeDaten: [],
          weitereEigenschaften: [],
          geeignetFuer: '',
          sicherheitshinweise: '',
          lieferumfang: '',
          url: filesToUse[0]?.url || '',
          fileName: filesToUse[0]?.fileName || ''
        };
      }
      
      console.log('Parsed data:', parsedData);
      console.log('Technical specs from backend:', filesToUse[0]?.technicalSpecs);
      
      // ✅ HIER BEREINIGEN:
      parsedData = bereinigeGescrappteDaten(parsedData);
      console.log('Parsed data nach Bereinigung:', parsedData);
      console.log('Template: removed');
      
      // Vereinfachte KI-Generierung ohne Template-System
      console.log('Verwende vereinfachte KI-Generierung');
      
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        body: JSON.stringify({
          extractedData: filesToUse.map(d => ({
            extractedText: d.extractedText,
            productName: d.productName,
            description: '',
            bullets: parsedData.vorteile || [], // Verwende die bereinigten USPs
            supplierTableHtml: d.supplierTableHtml || '',
            technicalSpecs: (() => {
              const specs = d.technicalSpecs || {};
              // Nur die gewünschten 5 Felder weitergeben
              const filteredSpecs: any = {};
              if (specs.ladestrom) filteredSpecs.ladestrom = specs.ladestrom;
              if (specs.standards) filteredSpecs.standards = specs.standards;
              if (specs.outputs) filteredSpecs.outputs = specs.outputs;
              if (specs.weight) filteredSpecs.weight = specs.weight;
              if (specs.size) filteredSpecs.size = specs.size;
              return filteredSpecs;
            })(),
            url: d.url || '',
            fileName: d.fileName
          })),
          template: '', // Kein Template mehr
          customAttributes: customAttributesData,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }

      const response: { success: boolean; description: string } = await res.json();
      console.log('Generate-description response:', response);

      if (response.success) {
        const cleanedDescription = cleanHTMLResponse(response.description);
        console.log('Cleaned description:', cleanedDescription);
        setHtmlCode(cleanedDescription);
        setPreviewText(cleanedDescription); // Also update preview text
        setEditorMode("code");
        
        // HTML description will be automatically inserted via CustomAttributesPreview component
        
        toast({
          title: "Beschreibung generiert",
          description: "KI-Produktbeschreibung wurde erfolgreich erstellt und in das Produktbeschreibung-Feld eingefügt",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Custom Attributes Functions
  const addCustomAttribute = () => {
    if (newAttributeKey.trim() && newAttributeValue.trim()) {
      const newAttr = {
        key: newAttributeKey.trim(),
        value: newAttributeValue.trim(),
        type: 'text'
      };
      setManualAttributes([...manualAttributes, newAttr]);
      setNewAttributeKey("");
      setNewAttributeValue("");
    }
  };

  const removeCustomAttribute = (index: number) => {
    setManualAttributes(manualAttributes.filter((_, i) => i !== index));
  };

  const handleFilePreview = (file: FileMetadata) => {
    setPreviewFile(file);
  };

  const copyHtmlCode = async () => {
    if (!htmlCode.trim()) {
      toast({
        variant: "destructive",
        title: "Kein Code",
        description: "Es ist kein HTML-Code zum Kopieren vorhanden",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(htmlCode);
      toast({
        title: "Code kopiert",
        description: "HTML-Code wurde in die Zwischenablage kopiert",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Kopieren fehlgeschlagen",
        description: "Der Code konnte nicht kopiert werden",
      });
    }
  };

  const toggleFileSelection = (index: number) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFiles(newSelected);
  };

  const deleteSelectedFiles = () => {
    const filesToKeep = uploadedFiles.filter((_, index) => !selectedFiles.has(index));
    const extractedDataToKeep = extractedData.filter((_, index) => !selectedFiles.has(index));
    
    setUploadedFiles(filesToKeep);
    setExtractedData(extractedDataToKeep);
    
    // Clear both selection sets since indices have changed
    setSelectedFiles(new Set());
    setSelectedFilesForGeneration(new Set());
    
    toast({
      title: "Dateien gelöscht",
      description: `${selectedFiles.size} Datei(en) wurden entfernt`,
    });
  };

  const toggleFileSelectionForGeneration = (index: number) => {
    const newSelected = new Set(selectedFilesForGeneration);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFilesForGeneration(newSelected);
  };

  // Extract exact product name from extracted data
  const extractExactProductName = (extractedText: string): string => {
    // Look for patterns like "Produktname:", "Name:", "Artikel:", etc.
    const patterns = [
      /Produktname:\s*([^\n\r]+)/i,
      /Name:\s*([^\n\r]+)/i,
      /Artikel:\s*([^\n\r]+)/i,
      /Produkt:\s*([^\n\r]+)/i,
      /Modell:\s*([^\n\r]+)/i,
      /Bezeichnung:\s*([^\n\r]+)/i
    ];

    for (const pattern of patterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        return cleanExtractedText(match[1].trim());
      }
    }

    // Fallback: look for the first line that looks like a product name
    const lines = extractedText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 5 && trimmed.length < 100 && 
          !trimmed.includes(':') && 
          !trimmed.match(/^\d+/) &&
          !trimmed.includes('EUR') &&
          !trimmed.includes('€')) {
        return cleanExtractedText(trimmed);
      }
    }

    return '';
  };

  // Extract article number from extracted data
  const extractArticleNumber = (extractedText: string): string => {
    console.log('Extracting article number from:', extractedText);
    
    // Look for patterns like "Artikelnummer:", "Art.-Nr.:", "SKU:", etc.
    const patterns = [
      /Artikelnummer:\s*([^\n\r]+)/i,
      /Art\.-Nr\.:\s*([^\n\r]+)/i,
      /SKU:\s*([^\n\r]+)/i,
      /Artikel-Nr\.:\s*([^\n\r]+)/i,
      /Part\s*Number:\s*([^\n\r]+)/i,
      /Model:\s*([^\n\r]+)/i,
      /Artikel:\s*([^\n\r]+)/i,
      /Art\.\s*Nr\.:\s*([^\n\r]+)/i
    ];

    for (const pattern of patterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        const result = match[1].trim();
        console.log('Found article number with pattern:', result);
        return cleanExtractedText(result);
      }
    }

    // Special handling for the "Artikelnummer:" pattern that appears in AI output
    const artikelnummerMatch = extractedText.match(/Artikelnummer:\s*\n([^\n\r]+)/i);
    if (artikelnummerMatch && artikelnummerMatch[1]) {
      const result = artikelnummerMatch[1].trim();
      console.log('Found article number after Artikelnummer: label:', result);
      return cleanExtractedText(result);
    }

    // Fallback: look for lines that look like article numbers
    const lines = extractedText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for numeric codes that could be article numbers (like "1285")
      if (trimmed.match(/^\d{3,10}$/) && 
          !trimmed.includes('EUR') && 
          !trimmed.includes('€') &&
          !trimmed.includes('V') &&
          !trimmed.includes('A') &&
          !trimmed.includes('mAh') &&
          !trimmed.includes('mm') &&
          !trimmed.includes('g')) {
        console.log('Found numeric article number:', trimmed);
        return cleanExtractedText(trimmed);
      }
      
      // Look for alphanumeric codes that could be article numbers
      if (trimmed.match(/^[A-Z0-9\-_]{3,20}$/i) && 
          !trimmed.includes('EUR') && 
          !trimmed.includes('€') &&
          !trimmed.includes('V') &&
          !trimmed.includes('A') &&
          !trimmed.includes('mAh') &&
          !trimmed.includes('mm') &&
          !trimmed.includes('g') &&
          !trimmed.includes('PCB') &&
          !trimmed.includes('BMS')) {
        console.log('Found alphanumeric article number:', trimmed);
        return cleanExtractedText(trimmed);
      }
    }

    console.log('No article number found');
    return '';
  };

  // Generate final article number with prefix
  const generateArticleNumber = (supplierArticleNumber: string): string => {
    if (!supplierArticleNumber.trim()) return '';
    const cleanedNumber = cleanExtractedText(supplierArticleNumber);
    return `${articleNumberPrefix}${cleanedNumber}`;
  };

  // Extract dimensions (height, diameter, width) from extracted data
  const extractDimensions = (extractedText: string): { height?: string, diameter?: string, width?: string } => {
    const dimensions: { height?: string, diameter?: string, width?: string } = {};
    
    // Height patterns
    const heightPatterns = [
      /Höhe:\s*([^\n\r]+)/i,
      /Height:\s*([^\n\r]+)/i,
      /Länge:\s*([^\n\r]+)/i,
      /Length:\s*([^\n\r]+)/i,
      /- Höhe:\s*([^\n\r]+)/i,
      /- Länge:\s*([^\n\r]+)/i
    ];
    
    for (const pattern of heightPatterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        const rawValue = cleanExtractedText(match[1].trim());
        dimensions.height = cleanMeasurementValue(rawValue);
        break;
      }
    }
    
    // Diameter patterns
    const diameterPatterns = [
      /Durchmesser:\s*([^\n\r]+)/i,
      /Diameter:\s*([^\n\r]+)/i,
      /Ø:\s*([^\n\r]+)/i,
      /- Durchmesser:\s*([^\n\r]+)/i
    ];
    
    for (const pattern of diameterPatterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        const rawValue = cleanExtractedText(match[1].trim());
        dimensions.diameter = cleanMeasurementValue(rawValue);
        break;
      }
    }
    
    // Width patterns
    const widthPatterns = [
      /Breite:\s*([^\n\r]+)/i,
      /Width:\s*([^\n\r]+)/i,
      /- Breite:\s*([^\n\r]+)/i
    ];
    
    for (const pattern of widthPatterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        const rawValue = cleanExtractedText(match[1].trim());
        dimensions.width = cleanMeasurementValue(rawValue);
        break;
      }
    }
    
    return dimensions;
  };

  // Extract delivery scope from extracted data
  const extractDeliveryScope = (extractedText: string): string => {
    const patterns = [
      /Lieferumfang:\s*([^\n\r]+)/i,
      /Scope of delivery:\s*([^\n\r]+)/i,
      /Inhalt:\s*([^\n\r]+)/i,
      /Content:\s*([^\n\r]+)/i,
      /- Lieferumfang:\s*([^\n\r]+)/i,
      /- Inhalt:\s*([^\n\r]+)/i
    ];

    for (const pattern of patterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        return cleanExtractedText(match[1].trim());
      }
    }

    return '';
  };

  // Extract technical attributes (voltage, capacity, weight, etc.)
  const extractTechnicalAttributes = (extractedText: string): Record<string, string> => {
    const attributes: Record<string, string> = {};
    
    // Voltage patterns
    const voltagePatterns = [
      /Spannung:\s*([^\n\r]+)/i,
      /Voltage:\s*([^\n\r]+)/i,
      /- Spannung:\s*([^\n\r]+)/i
    ];
    
    for (const pattern of voltagePatterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        const rawValue = cleanExtractedText(match[1].trim());
        attributes.spannung = cleanMeasurementValue(rawValue);
        break;
      }
    }
    
    // Capacity patterns
    const capacityPatterns = [
      /Kapazität:\s*([^\n\r]+)/i,
      /Capacity:\s*([^\n\r]+)/i,
      /- Kapazität:\s*([^\n\r]+)/i
    ];
    
    for (const pattern of capacityPatterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        const rawValue = cleanExtractedText(match[1].trim());
        attributes.kapazität = cleanMeasurementValue(rawValue);
        break;
      }
    }
    
    // Weight patterns
    const weightPatterns = [
      /Gewicht:\s*([^\n\r]+)/i,
      /Weight:\s*([^\n\r]+)/i,
      /- Gewicht:\s*([^\n\r]+)/i
    ];
    
    for (const pattern of weightPatterns) {
      const match = extractedText.match(pattern);
      if (match && match[1]) {
        const rawValue = cleanExtractedText(match[1].trim());
        const convertedWeight = convertWeightToGrams(rawValue);
        attributes.gewicht = cleanMeasurementValue(convertedWeight);
        break;
      }
    }
    
    return attributes;
  };

  // Auto-fill all custom attributes from extracted data
  const autoFillAllAttributes = () => {
    if (extractedData.length === 0) {
      toast({
        variant: "destructive",
        title: "Keine Daten",
        description: "Bitte laden Sie zuerst Dateien hoch",
      });
      return;
    }

    const extractedText = extractedData[0].extractedText;
    const dimensions = extractDimensions(extractedText);
    const deliveryScope = extractDeliveryScope(extractedText);
    const technicalAttributes = extractTechnicalAttributes(extractedText);

    // Update existing attributes or create new ones
    const updatedAttributes = [...customAttributes];
    
    // Update or add height
    const heightIndex = updatedAttributes.findIndex(attr => attr.key.toLowerCase().includes('höhe') || attr.key.toLowerCase().includes('height'));
    if (heightIndex >= 0) {
      updatedAttributes[heightIndex].value = dimensions.height || '';
    } else if (dimensions.height) {
      updatedAttributes.push({ key: 'Höhe', value: dimensions.height, type: 'text' });
    }

    // Update or add diameter
    const diameterIndex = updatedAttributes.findIndex(attr => attr.key.toLowerCase().includes('durchmesser') || attr.key.toLowerCase().includes('diameter'));
    if (diameterIndex >= 0) {
      updatedAttributes[diameterIndex].value = dimensions.diameter || '';
    } else if (dimensions.diameter) {
      updatedAttributes.push({ key: 'Durchmesser', value: dimensions.diameter, type: 'text' });
    }

    // Update or add width
    const widthIndex = updatedAttributes.findIndex(attr => attr.key.toLowerCase().includes('breite') || attr.key.toLowerCase().includes('width'));
    if (widthIndex >= 0) {
      updatedAttributes[widthIndex].value = dimensions.width || '';
    } else if (dimensions.width) {
      updatedAttributes.push({ key: 'Breite', value: dimensions.width, type: 'text' });
    }

    // Update or add delivery scope
    const deliveryIndex = updatedAttributes.findIndex(attr => attr.key.toLowerCase().includes('lieferumfang') || attr.key.toLowerCase().includes('scope'));
    if (deliveryIndex >= 0) {
      updatedAttributes[deliveryIndex].value = deliveryScope || '';
    } else if (deliveryScope) {
      updatedAttributes.push({ key: 'Lieferumfang', value: deliveryScope, type: 'text' });
    }

    // Update or add technical attributes
    if (technicalAttributes.spannung) {
      const voltageIndex = updatedAttributes.findIndex(attr => attr.key.toLowerCase().includes('spannung') || attr.key.toLowerCase().includes('voltage'));
      if (voltageIndex >= 0) {
        updatedAttributes[voltageIndex].value = technicalAttributes.spannung;
      } else {
        updatedAttributes.push({ key: 'Spannung', value: technicalAttributes.spannung, type: 'text' });
      }
    }

    if (technicalAttributes.kapazität) {
      const capacityIndex = updatedAttributes.findIndex(attr => attr.key.toLowerCase().includes('kapazität') || attr.key.toLowerCase().includes('capacity'));
      if (capacityIndex >= 0) {
        updatedAttributes[capacityIndex].value = technicalAttributes.kapazität;
      } else {
        updatedAttributes.push({ key: 'Kapazität', value: technicalAttributes.kapazität, type: 'text' });
      }
    }

    if (technicalAttributes.gewicht) {
      const weightIndex = updatedAttributes.findIndex(attr => attr.key.toLowerCase().includes('gewicht') || attr.key.toLowerCase().includes('weight'));
      if (weightIndex >= 0) {
        updatedAttributes[weightIndex].value = technicalAttributes.gewicht;
      } else {
        updatedAttributes.push({ key: 'Gewicht', value: technicalAttributes.gewicht, type: 'text' });
      }
    }

    setCustomAttributes(updatedAttributes);
    
    const foundValues = [
      dimensions.height, 
      dimensions.diameter, 
      dimensions.width, 
      deliveryScope,
      technicalAttributes.spannung,
      technicalAttributes.kapazität,
      technicalAttributes.gewicht
    ].filter(Boolean).length;
    
    toast({
      title: "Attribute automatisch gefüllt",
      description: `${foundValues} Werte wurden aus den extrahierten Daten übernommen`,
    });
  };

  const handleTextToCode = async () => {
    if (!previewText.trim()) {
      toast({
        variant: "destructive",
        title: "Kein Text",
        description: "Bitte geben Sie zuerst Text ein",
      });
      return;
    }

    setIsConverting(true);

    try {
      const res = await fetch('/api/text-to-html', {
        method: 'POST',
        body: JSON.stringify({
          plainText: previewText,
          extractedData: extractedData.length > 0 ? extractedData.map(d => d.extractedText) : undefined,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }

      const response: { success: boolean; html: string } = await res.json();

      if (response.success) {
        const cleanedHtml = cleanHTMLResponse(response.html);
        setHtmlCode(cleanedHtml);
        setEditorMode("code");
        toast({
          title: "HTML generiert",
          description: "Fließtext wurde in HTML-Code umgewandelt",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Konvertierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleRefine = async () => {
    if (!htmlCode.trim()) {
      toast({
        variant: "destructive",
        title: "Keine Beschreibung",
        description: "Bitte generieren Sie zuerst eine Produktbeschreibung",
      });
      return;
    }

    if (!refinementPrompt.trim()) {
      toast({
        variant: "destructive",
        title: "Keine Anweisungen",
        description: "Bitte geben Sie Verbesserungsvorschläge ein",
      });
      return;
    }

    setIsRefining(true);

    try {
      const res = await fetch('/api/refine-description', {
        method: 'POST',
        body: JSON.stringify({
          currentDescription: htmlCode,
          userPrompt: refinementPrompt,
          extractedData: extractedData.map(d => d.extractedText),
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }

      const response: { success: boolean; description: string } = await res.json();

      if (response.success) {
        const cleanedDescription = cleanHTMLResponse(response.description);
        setHtmlCode(cleanedDescription);
        setRefinementPrompt("");
        
        // HTML description will be automatically inserted via CustomAttributesPreview component
        
        toast({
          title: "Beschreibung verfeinert",
          description: "KI hat die Produktbeschreibung angepasst und in das Produktbeschreibung-Feld eingefügt",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Verfeinerung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    } finally {
      setIsRefining(false);
    }
  };

  const handleReset = () => {
    setProductName("");
    setUploadedFiles([]);
    setExtractedData([]);
    // Template removed
    setHtmlCode("");
    setPreviewText("");
    setRefinementPrompt("");
    setEditorMode("code");
  };

  const handleSaveProduct = () => {
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Kein Projekt",
        description: "Dieses Produkt ist keinem Projekt zugeordnet",
      });
      return;
    }

    if (!htmlCode.trim()) {
      toast({
        variant: "destructive",
        title: "Keine Beschreibung",
        description: "Bitte generieren Sie zuerst eine Produktbeschreibung",
      });
      return;
    }

    saveProductMutation.mutate();
  };

  const isStandalone = !projectId;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            {projectId && (
              <Button
                variant="ghost"
                onClick={() => setLocation(`/project/${projectId}`)}
                className="mb-2"
                data-testid="button-back-to-project"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zum Projekt
              </Button>
            )}
            <h1 className="text-3xl font-bold tracking-tight">
              {productId ? "Produktbeschreibung bearbeiten" : "Produktbeschreibung erstellen"}
            </h1>
            <p className="text-muted-foreground mt-1">
              KI-gestützte Produktbeschreibungen aus Lieferantendaten
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              Zurücksetzen
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: File Upload & Extracted Data */}
          <div className="space-y-6">
            {/* Product Name - only show after files are uploaded or when editing existing product */}
            {projectId && (productName || productId) && (
              <Card>
                <CardHeader>
                  <CardTitle>Produktname</CardTitle>
                  <CardDescription>
                    {productName ? "Automatisch generiert - kann angepasst werden" : "Vergeben Sie einen Namen für bessere Übersicht"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="z.B. AAA Li-Ionen Akku 1620mWh"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    data-testid="input-product-name"
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Dateien hochladen
                </CardTitle>
                <CardDescription>
                  PDF, CSV oder Screenshots mit Produktinformationen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover-elevate transition-colors">
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.csv,image/*"
                    onChange={handleFileUpload}
                    disabled={isAnalyzing}
                    className="hidden"
                    id="file-upload"
                    data-testid="input-files"
                  />
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Analysiere Dateien...</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                          <Plus className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Dateien hier ablegen oder klicken</p>
                        <p className="text-xs text-muted-foreground">
                          PDF, CSV oder Bilder (PNG, JPG) - Mehrere Dateien möglich
                        </p>
                      </>
                    )}
                  </Label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Hochgeladene Dateien ({uploadedFiles.length})
                    </Label>
                        {selectedFilesForGeneration.size > 0 && (
                          <Label className="text-xs text-blue-600">
                            {selectedFilesForGeneration.size} für KI-Generierung ausgewählt
                          </Label>
                        )}
                      </div>
                      {selectedFiles.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={deleteSelectedFiles}
                          className="h-6 px-2 text-xs"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {selectedFiles.size} löschen
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted"
                        >
                          {/* Checkbox for deletion */}
                          <Checkbox
                            checked={selectedFiles.has(index)}
                            onCheckedChange={() => toggleFileSelection(index)}
                            className="h-4 w-4"
                            title="Zum Löschen auswählen"
                          />
                          {/* Checkbox for generation */}
                          <Checkbox
                            checked={selectedFilesForGeneration.has(index)}
                            onCheckedChange={() => toggleFileSelectionForGeneration(index)}
                            className="h-4 w-4"
                            title="Für KI-Generierung auswählen"
                          />
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{file.fileName}</span>
                          <span className="text-xs text-muted-foreground">
                            {(file.fileSize / 1024).toFixed(1)} KB
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFilePreview(file)}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* AI Generate Button */}
                {uploadedFiles.length > 0 && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating || selectedFilesForGeneration.size === 0}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          KI generiert...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          KI generieren
                        </>
                      )}
                    </Button>
                    {selectedFilesForGeneration.size === 0 && uploadedFiles.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Wählen Sie Dateien für die KI-Generierung aus
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* URL Scraping */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  URL analysieren
                  </CardTitle>
                  <CardDescription>
                  Produktseite direkt von Lieferanten-Website analysieren
                  </CardDescription>
                </CardHeader>
              <CardContent className="space-y-4">
                        <div className="space-y-2">
                  <Label htmlFor="product-url">Produkt-URL</Label>
                            <Input
                    id="product-url"
                    type="url"
                    placeholder="https://lieferant.de/produkt/..."
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                            />
                          </div>
                            <Button
                  onClick={handleUrlScrape}
                  disabled={!productUrl || urlScrapingMutation.isPending}
                  className="w-full"
                >
                  {urlScrapingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analysiere URL...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      URL analysieren
                    </>
                  )}
                            </Button>
                {urlScrapingMutation.error && (
                  <div className="text-sm text-destructive">
                    Fehler: {urlScrapingMutation.error.message}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Right Column: Description Editor */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Produktbeschreibung
                    </CardTitle>
                    <CardDescription>
                      Bearbeiten Sie den Code oder die Vorschau
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={editorMode === "code" ? "default" : "outline"}
                      onClick={() => setEditorMode("code")}
                      data-testid="button-mode-code"
                    >
                      <Code className="w-4 h-4 mr-1" />
                      Quelltext
                    </Button>
                    <Button
                      size="sm"
                      variant={editorMode === "preview" ? "default" : "outline"}
                      onClick={() => setEditorMode("preview")}
                      data-testid="button-mode-preview"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Vorschau
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editorMode === "code" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                    <Label className="text-sm">HTML-Code</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyHtmlCode}
                        disabled={!htmlCode.trim()}
                        className="h-8 px-2"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Kopieren
                      </Button>
                    </div>
                    <Textarea
                      value={htmlCode}
                      onChange={(e) => setHtmlCode(e.target.value)}
                      placeholder="Generierte HTML-Beschreibung erscheint hier..."
                      className="font-mono text-xs h-96 resize-none"
                      data-testid="textarea-code"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm">Fließtext / Vorschau</Label>
                    {htmlCode ? (
                      <div
                        className="border rounded-md p-4 min-h-96 max-h-96 overflow-y-auto bg-card prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: htmlCode }}
                        data-testid="preview-rendered"
                      />
                    ) : (
                      <Textarea
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                        placeholder="Geben Sie hier Ihren Fließtext ein, z.B.:

AAA 1,5V Akku mit 1620mWh

Wiederaufladbarer AAA Li-Ionen-Akku mit konstanter Spannung.

Vorteile:
- Konstante 1,5V Spannung
- Integrierter LED-Indikator
- USB-C Ladeanschluss
- 1620mWh Energieinhalt

Technische Daten:
Verfügbare Energie: 1620 mWh
Kapazität: ca. 1000mAh"
                        className="h-96 resize-none"
                        data-testid="textarea-preview"
                      />
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {/* Mit KI generieren Button entfernt - wird jetzt automatisch nach dem Analysieren gemacht */}
                  {htmlCode && (
                    <div className="flex-1 text-center text-sm text-muted-foreground py-2">
                      ✅ Strukturierte Beschreibung wurde automatisch generiert
                    </div>
                  )}

                  {editorMode === "preview" && (
                    <Button
                      onClick={handleTextToCode}
                      disabled={isConverting || !previewText.trim() || !!htmlCode}
                      variant="outline"
                      data-testid="button-text-to-code"
                    >
                      {isConverting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Konvertiere...
                        </>
                      ) : (
                        <>
                          <Code className="w-4 h-4 mr-2" />
                          Code generieren
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Refinement Section */}
            {htmlCode && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5" />
                    Beschreibung verfeinern
                  </CardTitle>
                  <CardDescription>
                    KI-Verbesserungen mit eigenen Anweisungen
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Ihre Anweisungen</Label>
                    <Textarea
                      value={refinementPrompt}
                      onChange={(e) => setRefinementPrompt(e.target.value)}
                      placeholder="z.B. 'Füge mehr technische Details hinzu' oder 'Mache die Vorteile deutlicher'"
                      className="h-24 resize-none"
                      data-testid="textarea-refine-prompt"
                    />
                  </div>
                  <Button
                    onClick={handleRefine}
                    disabled={isRefining || !refinementPrompt.trim()}
                    className="w-full"
                    data-testid="button-refine"
                  >
                    {isRefining ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verfeinere...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Beschreibung anpassen
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Custom Attributes Section */}
              {/* Custom Attributes Preview */}
              <CustomAttributesPreview
                extractedData={extractedData}
                articleNumber={articleNumber}
                onAttributesChange={(attributes) => {
                  setCustomAttributes(attributes);
                  setAllCustomAttributes(attributes);
                }}
                onExactProductNameChange={setExactProductName}
                onArticleNumberChange={setArticleNumber}
                generatedHtmlDescription={htmlCode}
              />

              {/* Manual Custom Attributes Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    Manuelle Attribute
                  </CardTitle>
                  <CardDescription>
                    Zusätzliche Attribute manuell hinzufügen oder bearbeiten
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Custom Attributes List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Zusätzliche Attribute</Label>
                      <Button
                        onClick={autoFillAllAttributes}
                        variant="outline"
                        size="sm"
                        disabled={extractedData.length === 0}
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        Alle Auto-füllen
                      </Button>
                    </div>
                    {manualAttributes.map((attr, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          value={attr.key}
                          onChange={(e) => {
                            const newAttrs = [...manualAttributes];
                            newAttrs[index].key = e.target.value;
                            setManualAttributes(newAttrs);
                          }}
                          placeholder="Attribut-Name"
                          className="flex-1"
                        />
                        <Input
                          value={attr.value}
                          onChange={(e) => {
                            const newAttrs = [...manualAttributes];
                            newAttrs[index].value = e.target.value;
                            setManualAttributes(newAttrs);
                          }}
                          placeholder="Wert"
                          className="flex-1"
                        />
                        <Button
                          onClick={() => {
                            if (extractedData.length > 0) {
                              const extractedText = extractedData[0].extractedText;
                              const dimensions = extractDimensions(extractedText);
                              const deliveryScope = extractDeliveryScope(extractedText);
                              
                              let autoValue = '';
                              const key = attr.key.toLowerCase();
                              
                              if (key.includes('höhe') || key.includes('height')) {
                                autoValue = dimensions.height || '';
                              } else if (key.includes('durchmesser') || key.includes('diameter')) {
                                autoValue = dimensions.diameter || '';
                              } else if (key.includes('breite') || key.includes('width')) {
                                autoValue = dimensions.width || '';
                              } else if (key.includes('lieferumfang') || key.includes('scope')) {
                                autoValue = deliveryScope || '';
                              }
                              
                              if (autoValue) {
                                const newAttrs = [...customAttributes];
                                newAttrs[index].value = autoValue;
                                setCustomAttributes(newAttrs);
                              }
                            }
                          }}
                          variant="outline"
                          size="sm"
                          disabled={extractedData.length === 0}
                          title="Wert aus extrahierten Daten übernehmen"
                        >
                          <Sparkles className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => removeCustomAttribute(index)}
                          variant="outline"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Attribute */}
                  <div className="flex gap-2">
                    <Input
                      value={newAttributeKey}
                      onChange={(e) => setNewAttributeKey(e.target.value)}
                      placeholder="Neues Attribut"
                      className="flex-1"
                    />
                    <Input
                      value={newAttributeValue}
                      onChange={(e) => setNewAttributeValue(e.target.value)}
                      placeholder="Wert"
                      className="flex-1"
                    />
                    <Button
                      onClick={addCustomAttribute}
                      disabled={!newAttributeKey.trim() || !newAttributeValue.trim()}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Hinzufügen
                    </Button>
                  </div>
                </CardContent>
              </Card>

            {/* Save/Export Section */}
            {projectId ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Save className="w-5 h-5" />
                    {productId ? "Produkt speichern" : "Zu Projekt hinzufügen"}
                  </CardTitle>
                  <CardDescription>
                    {productId ? "Änderungen speichern" : "Produkt im Projekt speichern"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleSaveProduct}
                    disabled={!htmlCode.trim() || saveProductMutation.isPending}
                    className="w-full"
                    data-testid="button-save-product"
                  >
                    {saveProductMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {productId ? "Speichere..." : "Füge hinzu..."}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {productId ? "Speichern" : "Zu Projekt hinzufügen"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Standalone-Modus</CardTitle>
                  <CardDescription>
                  Dieser Produktbeschreibungs-Editor ist nicht mit einem Projekt verbunden
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Um Produkte zu speichern und zu exportieren, erstellen Sie zuerst ein Projekt unter "Meine Projekte".
                  </p>
                  <Button
                    onClick={() => setLocation('/projects')}
                    variant="outline"
                    className="w-full"
                    data-testid="button-go-to-projects"
                  >
                    Zu Meine Projekte
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Dateivorschau: {previewFile?.fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewFile && (
              <div className="space-y-4">
                {previewFile.fileType.startsWith('image/') ? (
                  <div className="flex justify-center">
                    <img
                      src={previewFile.fileUrl}
                      alt={previewFile.fileName}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg border"
                      style={{ cursor: 'zoom-in' }}
                      onClick={() => {
                        const newWindow = window.open();
                        if (newWindow) {
                          newWindow.document.write(`
                            <html>
                              <head><title>${previewFile.fileName}</title></head>
                              <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                <img src="${previewFile.fileUrl}" alt="${previewFile.fileName}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                              </body>
                            </html>
                          `);
                        }
                      }}
                    />
                  </div>
                ) : previewFile.fileType === 'application/pdf' ? (
                  <div className="flex justify-center">
                    <iframe
                      src={previewFile.fileUrl}
                      className="w-full h-[60vh] border rounded-lg"
                      title={previewFile.fileName}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Vorschau für diesen Dateityp nicht verfügbar
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.open(previewFile.fileUrl, '_blank')}
                      className="mt-4"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Datei öffnen
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
