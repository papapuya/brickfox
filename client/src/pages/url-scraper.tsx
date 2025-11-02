import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Globe, Settings2, FolderPlus, List, Download, Table as TableIcon, Eye, Sparkles, FileText, Save, Copy, Check, Maximize2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Project } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface ScrapedProduct {
  articleNumber: string;
  productName: string;
  ean?: string;
  manufacturer?: string;
  price?: string;
  description?: string;
  images: string[];
  weight?: string;
  category?: string;
  // ANSMANN technical specifications
  nominalspannung?: string;
  nominalkapazitaet?: string;
  maxEntladestrom?: string;
  laenge?: string;
  breite?: string;
  hoehe?: string;
  gewicht?: string;
  zellenchemie?: string;
  energie?: string;
  farbe?: string;
  // Nitecore technical specifications
  length?: string;
  bodyDiameter?: string;
  headDiameter?: string;
  weightWithoutBattery?: string;
  totalWeight?: string;
  powerSupply?: string;
  led1?: string;
  led2?: string;
  spotIntensity?: string;
  maxLuminosity?: string;
  maxBeamDistance?: string;
  manufacturerArticleNumber?: string;
  // Pricing
  ekPrice?: string;
  vkPrice?: string;
  // Auto-extracted data
  autoExtractedDescription?: string;
  technicalDataTable?: string;
  pdfManualUrl?: string;
  safetyWarnings?: string;
  rawHtml?: string;
  // Special
  [key: string]: any; // Allow dynamic fields
}

interface GeneratedContent {
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords?: string;
}

export default function URLScraper() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scrapedProduct, setScrapedProduct] = useState<ScrapedProduct | null>(null);
  const [generatedDescription, setGeneratedDescription] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showBulkSaveDialog, setShowBulkSaveDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("new");
  const [projectName, setProjectName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Multi-Product Scraping
  const [productLinkSelector, setProductLinkSelector] = useState("");
  const [maxProducts, setMaxProducts] = useState(50);
  const [scrapedProducts, setScrapedProducts] = useState<ScrapedProduct[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, status: "" });
  
  // Pagination for preview table
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 6;
  
  // Batch AI Generation
  const [generatedDescriptions, setGeneratedDescriptions] = useState<Map<string, GeneratedContent>>(new Map());
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [aiGenerationProgress, setAiGenerationProgress] = useState({ current: 0, total: 0 });
  
  // Abort scraping control
  const abortScrapingRef = useRef(false);
  
  // Pagination options for multi-page scraping
  const [enablePagination, setEnablePagination] = useState(false);
  const [paginationSelector, setPaginationSelector] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  
  // Session cookies and userAgent for authenticated scraping
  const [sessionCookies, setSessionCookies] = useState("");
  const [userAgent, setUserAgent] = useState("");

  
  // HTML Preview Dialog
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [htmlPreviewContent, setHtmlPreviewContent] = useState("");
  
  // SEO Title Preview Dialog
  const [showSeoTitlePreview, setShowSeoTitlePreview] = useState(false);
  const [seoTitlePreviewContent, setSeoTitlePreviewContent] = useState("");
  
  // SEO Description Preview Dialog
  const [showSeoPreview, setShowSeoPreview] = useState(false);
  const [seoPreviewContent, setSeoPreviewContent] = useState("");
  
  // SEO Keywords Preview Dialog
  const [showKeywordsPreview, setShowKeywordsPreview] = useState(false);
  const [keywordsPreviewContent, setKeywordsPreviewContent] = useState("");
  
  // HTML Copy State
  const [copiedArticleNumber, setCopiedArticleNumber] = useState<string | null>(null);
  
  // Full View Dialog
  const [showFullView, setShowFullView] = useState(false);
  const [fullViewContent, setFullViewContent] = useState<{ title: string; seoDescription: string; keywords: string; html: string }>({ title: '', seoDescription: '', keywords: '', html: '' });
  
  // SERP Snippet Preview Dialog
  const [showSerpPreview, setShowSerpPreview] = useState(false);
  const [serpPreviewData, setSerpPreviewData] = useState<{ title: string; description: string; url: string; productName: string }>({ title: '', description: '', url: '', productName: '' });

  // Load existing projects
  const { data: projectsData } = useQuery<{ success: boolean; projects: Project[] }>({
    queryKey: ['/api/projects'],
    enabled: showSaveDialog,
    queryFn: async () => {
      const token = localStorage.getItem('supabase_token');
      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      return response.json();
    },
  });

  // Load suppliers
  const { data: suppliersData, isLoading: isSuppliersLoading } = useQuery<{ success: boolean; suppliers: any[] }>({
    queryKey: ['/api/suppliers'],
    queryFn: async () => {
      const token = localStorage.getItem('supabase_token');
      const response = await fetch('/api/suppliers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      const data = await response.json();
      console.log('Loaded suppliers:', data.suppliers?.length, 'items:', data.suppliers?.map((s: any) => s.name));
      return data;
    },
  });

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("__none__");

  // Auto-detect supplier based on URL domain
  const autoDetectSupplier = (url: string, suppliers: any[]) => {
    if (!suppliers || suppliers.length === 0) return null;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Match supplier by url_pattern or name
      for (const supplier of suppliers) {
        const pattern = supplier.url_pattern?.toLowerCase() || '';
        const name = supplier.name?.toLowerCase() || '';
        
        if (domain.includes(pattern) || domain.includes(name)) {
          console.log(`🔍 Auto-detected supplier: ${supplier.name} (${domain} matches ${pattern})`);
          return supplier.id;
        }
      }
    } catch (err) {
      console.warn('Failed to auto-detect supplier:', err);
    }
    
    return null;
  };

  // Check for PDF-extracted URLs on component mount (only when authenticated)
  useEffect(() => {
    // Wait until user is authenticated
    if (!isAuthenticated) {
      return;
    }

    const pdfUrls = sessionStorage.getItem('pdf_extracted_urls');
    const pdfMetadataMap = sessionStorage.getItem('pdf_url_metadata_map');
    const pdfSupplierId = sessionStorage.getItem('pdf_selected_supplier_id');
    
    if (pdfUrls && pdfMetadataMap) {
      try {
        const urls = pdfUrls.split('\n').filter(url => url.trim());
        const metadataMap = JSON.parse(pdfMetadataMap);
        
        // Determine supplier ID
        let supplierIdToUse: string | undefined = undefined;
        
        // Use supplier from PDF-Auto-Scraper if set
        if (pdfSupplierId && pdfSupplierId !== "__none__" && suppliersData?.suppliers) {
          supplierIdToUse = pdfSupplierId;
          setSelectedSupplierId(pdfSupplierId);
          const supplier = suppliersData.suppliers.find((s: any) => s.id === pdfSupplierId);
          if (supplier) {
            // Load supplier selectors automatically
            handleSupplierSelect(pdfSupplierId);
            toast({
              title: "✅ Lieferant geladen",
              description: `${supplier.name} aus PDF-Upload übernommen`,
            });
          }
          // Clear from sessionStorage
          sessionStorage.removeItem('pdf_selected_supplier_id');
        }
        // Fallback: Auto-detect supplier from URL if no supplier was selected in PDF-Auto-Scraper
        else if (urls.length > 0 && suppliersData?.suppliers) {
          const detectedSupplierId = autoDetectSupplier(urls[0], suppliersData.suppliers);
          if (detectedSupplierId) {
            supplierIdToUse = detectedSupplierId;
            setSelectedSupplierId(detectedSupplierId);
            toast({
              title: "✅ Lieferant erkannt",
              description: `${suppliersData.suppliers.find((s: any) => s.id === detectedSupplierId)?.name} wurde automatisch ausgewählt`,
            });
          }
        }
        
        // Clear session storage
        sessionStorage.removeItem('pdf_extracted_urls');
        sessionStorage.removeItem('pdf_url_metadata_map');
        
        // Show notification
        toast({
          title: "PDF-Daten geladen",
          description: `${urls.length} Produkt-URLs aus PDF übernommen. Scraping wird gestartet...`,
        });
        
        // Start scraping automatically with detected supplier ID
        handleScrapeFromPDF(urls, metadataMap, supplierIdToUse);
      } catch (error) {
        console.error('Error loading PDF data:', error);
        toast({
          title: "Fehler beim Laden der PDF-Daten",
          description: "Bitte versuchen Sie es erneut",
          variant: "destructive",
        });
      }
    }
  }, [isAuthenticated, suppliersData]);

  const handleSupplierSelect = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    
    if (supplierId === "__none__") {
      // Clear selectors
      setSelectors({
        articleNumber: "",
        productName: "",
        ean: "",
        manufacturer: "",
        price: "",
        description: "",
        images: "",
        weight: "",
        category: "",
        nominalspannung: "",
        nominalkapazitaet: "",
        maxEntladestrom: "",
        laenge: "",
        breite: "",
        hoehe: "",
        gewicht: "",
        zellenchemie: "",
        energie: "",
        farbe: ""
      });
      setProductLinkSelector("");
      setSessionCookies("");
      setUserAgent("");
      return;
    }

    const supplier = suppliersData?.suppliers?.find(s => s.id === supplierId);
    if (supplier) {
      setSelectors({ ...selectors, ...supplier.selectors });
      // For Nitecore, ALWAYS force .product-image-link (not optional)
      if (supplier.name === 'Nitecore') {
        setProductLinkSelector('.product-image-link');
      } else {
        setProductLinkSelector(supplier.productLinkSelector || "");
      }
      setSessionCookies(supplier.sessionCookies || "");
      setUserAgent(supplier.userAgent || "");
      setShowAdvanced(true); // Automatically show selectors when a supplier is selected
      toast({
        title: "Lieferant geladen",
        description: `Selektoren und Authentifizierung für "${supplier.name}" wurden geladen`,
      });
    }
  };

  // Custom selectors
  const [selectors, setSelectors] = useState({
    articleNumber: ".product-code",
    productName: "h1.product-title",
    ean: ".ean",
    manufacturer: ".brand",
    price: ".price",
    description: ".product-description",
    images: ".product-image img",
    weight: ".weight",
    category: ".breadcrumb",
    // ANSMANN technical specifications
    nominalspannung: "",
    nominalkapazitaet: "",
    maxEntladestrom: "",
    laenge: "",
    breite: "",
    hoehe: "",
    gewicht: "",
    zellenchemie: "",
    energie: "",
    farbe: ""
  });

  const handleScrapeProductList = async () => {
    if (!url.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine URL ein",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setScrapedProducts([]);
    setBatchProgress({ current: 0, total: 0, status: enablePagination ? "Scrape alle Seiten..." : "Suche nach Produkten..." });

    try {
      let productUrls: string[] = [];

      // Step 1: Get all product URLs from listing page
      if (enablePagination) {
        // Use SSE for multi-page scraping with live progress
        productUrls = await new Promise((resolve, reject) => {
          const requestBody = {
            url: url.trim(),
            productLinkSelector: productLinkSelector.trim() || null,
            paginationSelector: paginationSelector.trim() || null,
            maxPages,
            maxProducts,
            userAgent: userAgent || undefined,
            cookies: sessionCookies || undefined
          };

          // Create URL with query parameters for SSE
          const params = new URLSearchParams();
          Object.entries(requestBody).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.append(key, String(value));
            }
          });

          const token = localStorage.getItem('supabase_token');
          fetch('/api/scrape-all-pages', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
          }).then(response => {
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
              reject(new Error('No response body'));
              return;
            }

            const readStream = async () => {
              let buffer = ''; // Buffer for incomplete lines
              
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  // Decode chunk (do NOT flush decoder - keep state for multi-byte UTF-8)
                  buffer += decoder.decode(value, { stream: true });

                  // Split on newlines
                  const lines = buffer.split('\n');
                  
                  // Keep the last incomplete line in the buffer
                  buffer = lines.pop() || '';

                  // Process complete lines
                  for (const line of lines) {
                    if (line.trim() && line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.substring(6));
                        
                        if (data.type === 'progress') {
                          setBatchProgress({
                            current: data.currentPage,
                            total: maxPages,
                            status: data.message
                          });
                        } else if (data.type === 'complete') {
                          resolve(data.productUrls);
                          return;
                        } else if (data.type === 'error') {
                          reject(new Error(data.error));
                          return;
                        }
                      } catch (parseErr) {
                        console.error('Failed to parse SSE line:', line, parseErr);
                      }
                    }
                  }
                }

                // Process any remaining buffered data
                if (buffer.trim() && buffer.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(buffer.substring(6));
                    if (data.type === 'complete') {
                      resolve(data.productUrls);
                    } else if (data.type === 'error') {
                      reject(new Error(data.error));
                    }
                  } catch (parseErr) {
                    console.error('Failed to parse final SSE buffer:', buffer, parseErr);
                  }
                }
              } catch (err) {
                reject(err);
              }
            };

            readStream();
          }).catch(reject);
        });
      } else {
        // Single page scraping (no SSE needed)
        const requestBody = {
          url: url.trim(),
          productLinkSelector: productLinkSelector.trim() || null,
          maxProducts,
          userAgent: userAgent || undefined,
          cookies: sessionCookies || undefined,
          supplierId: selectedSupplierId !== "__none__" ? selectedSupplierId : undefined
        };

        const token = localStorage.getItem('supabase_token');
        const listResponse = await fetch('/api/scrape-product-list', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody),
        });

        if (!listResponse.ok) {
          const error = await listResponse.json();
          throw new Error(error.error || 'Fehler beim Abrufen der Produktliste');
        }

        const data = await listResponse.json();
        productUrls = data.productUrls;
      }

      if (!productUrls || productUrls.length === 0) {
        toast({
          title: "Keine Produkte gefunden",
          description: "Überprüfen Sie den CSS-Selektor für Produktlinks",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Produktliste gefunden",
        description: `${productUrls.length} Produkte gefunden. Starte Scraping...`,
      });

      setBatchProgress({ current: 0, total: productUrls.length, status: "Scraping gestartet..." });

      // Step 2: Scrape each product
      const products: ScrapedProduct[] = [];
      const activeSelectors: any = {};
      Object.entries(selectors).forEach(([key, value]) => {
        if (value.trim()) activeSelectors[key] = value;
      });

      let failedCount = 0;
      for (let i = 0; i < productUrls.length; i++) {
        // Check if user aborted
        if (abortScrapingRef.current) {
          console.log('Scraping aborted by user');
          break;
        }

        const productUrl = productUrls[i];
        setBatchProgress({ 
          current: i + 1, 
          total: productUrls.length, 
          status: `Scrape Produkt ${i + 1}/${productUrls.length}...` 
        });

        try {
          const data = await apiPost('/api/scrape-product', {
            url: productUrl,
            selectors: Object.keys(activeSelectors).length > 0 ? activeSelectors : undefined,
            userAgent: userAgent || undefined,
            cookies: sessionCookies || undefined,
            supplierId: selectedSupplierId !== "__none__" ? selectedSupplierId : undefined
          }) as any;

          if (data && data.product) {
            console.log('🔍 [FRONTEND] Received product from backend:', Object.keys(data.product));
            console.log('🔍 [FRONTEND] Nitecore fields in response:', {
              length: data.product.length,
              led1: data.product.led1,
              led2: data.product.led2,
              maxLuminosity: data.product.maxLuminosity
            });
            products.push(data.product);
          } else {
            console.error(`Fehler beim Scrapen von ${productUrl}`);
            failedCount++;
          }
        } catch (err) {
          console.error(`Fehler beim Scrapen von ${productUrl}:`, err);
          failedCount++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (failedCount > 0) {
        toast({
          title: "Teilweise erfolgreich",
          description: `${products.length} erfolgreich, ${failedCount} fehlgeschlagen`,
          variant: "destructive",
        });
      }

      setScrapedProducts(products);
      
      if (abortScrapingRef.current) {
        setBatchProgress({ current: products.length, total: productUrls.length, status: "Abgebrochen" });
        toast({
          title: "Scraping abgebrochen",
          description: `${products.length} von ${productUrls.length} Produkten gescraped`,
          variant: "destructive",
        });
      } else {
        setBatchProgress({ current: products.length, total: productUrls.length, status: "Fertig!" });
        toast({
          title: "Scraping abgeschlossen",
          description: `${products.length} von ${productUrls.length} Produkten erfolgreich gescraped`,
        });
      }

    } catch (error) {
      console.error('Product list scraping error:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : 'Scraping fehlgeschlagen',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      abortScrapingRef.current = false; // Reset abort flag
    }
  };

  // Handle scraping from PDF-extracted URLs
  const handleScrapeFromPDF = async (urls: string[], metadataMap: Record<string, any>, overrideSupplierId?: string) => {
    setIsLoading(true);
    setScrapedProducts([]);
    setBatchProgress({ current: 0, total: urls.length, status: "Erkenne Lieferanten..." });

    // Use override supplier ID if provided, otherwise use current state
    let detectedSupplierId = overrideSupplierId || selectedSupplierId;
    
    // Only auto-detect if no supplier ID was provided and current selection is "__none__"
    if (!overrideSupplierId && urls.length > 0 && suppliersData?.suppliers && detectedSupplierId === "__none__") {
      const detected = autoDetectSupplier(urls[0], suppliersData.suppliers);
      if (detected) {
        detectedSupplierId = detected;
        setSelectedSupplierId(detected);
        
        // Load supplier selectors (only if we just auto-detected)
        const supplier = suppliersData.suppliers.find((s: any) => s.id === detected);
        if (supplier) {
          setSelectors({ ...selectors, ...supplier.selectors });
          setProductLinkSelector(supplier.productLinkSelector || "");
          setSessionCookies(supplier.sessionCookies || "");
          setUserAgent(supplier.userAgent || "");
          
          console.log(`✅ Auto-detected and loaded supplier: ${supplier.name}`);
          toast({
            title: "✅ Lieferant erkannt",
            description: `${supplier.name} wurde automatisch ausgewählt`,
          });
        }
      }
    }
    // If supplier was provided via override, load selectors to ensure they're available
    else if (overrideSupplierId && suppliersData?.suppliers) {
      const supplier = suppliersData.suppliers.find((s: any) => s.id === overrideSupplierId);
      if (supplier) {
        // Load selectors explicitly to ensure they're available for scraping
        setSelectors({ ...selectors, ...supplier.selectors });
        setProductLinkSelector(supplier.productLinkSelector || "");
        setSessionCookies(supplier.sessionCookies || "");
        setUserAgent(supplier.userAgent || "");
        
        console.log(`✅ Using pre-selected supplier: ${supplier.name}`);
        console.log(`Loaded selectors:`, supplier.selectors);
      }
    }
    
    setBatchProgress({ current: 0, total: urls.length, status: "Scraping aus PDF gestartet..." });

    try {
      const products: ScrapedProduct[] = [];
      
      // Build active selectors - use supplier selectors if available
      let activeSelectors: any = {};
      if (detectedSupplierId !== "__none__" && suppliersData?.suppliers) {
        const supplier = suppliersData.suppliers.find((s: any) => s.id === detectedSupplierId);
        if (supplier && supplier.selectors) {
          // Use supplier selectors directly (not from state which might not be updated yet)
          activeSelectors = { ...supplier.selectors };
          console.log(`Using supplier selectors directly:`, activeSelectors);
        }
      }
      
      // Fallback: use selectors from state if no supplier selectors
      if (Object.keys(activeSelectors).length === 0) {
        Object.entries(selectors).forEach(([key, value]) => {
          if (value.trim()) activeSelectors[key] = value;
        });
      }

      let failedCount = 0;
      for (let i = 0; i < urls.length; i++) {
        if (abortScrapingRef.current) {
          console.log('Scraping aborted by user');
          break;
        }

        const productUrl = urls[i];
        const pdfMetadata = metadataMap[productUrl]; // Use URL as key for correct mapping
        
        setBatchProgress({ 
          current: i + 1, 
          total: urls.length, 
          status: `Scrape Produkt ${i + 1}/${urls.length}...` 
        });

        try {
          const data = await apiPost('/api/scrape-product', {
            url: productUrl,
            selectors: Object.keys(activeSelectors).length > 0 ? activeSelectors : undefined,
            userAgent: userAgent || undefined,
            cookies: sessionCookies || undefined,
            supplierId: detectedSupplierId !== "__none__" ? detectedSupplierId : undefined
          }) as any;

          if (data && data.product) {
            // Merge PDF data with scraped data (only if metadata exists for this URL)
            let mergedProduct = pdfMetadata ? {
              ...data.product,
              // Add EK price from PDF
              ekPrice: pdfMetadata.ekPrice,
              // Add additional PDF metadata
              pdfArticleNumber: pdfMetadata.articleNumber,
              pdfEanCode: pdfMetadata.eanCode,
              pdfProductName: pdfMetadata.productName,
            } : data.product;
            
            // Calculate VK if EK exists
            if (mergedProduct.ekPrice) {
              const ekValue = parseFloat(mergedProduct.ekPrice.replace(',', '.'));
              if (!isNaN(ekValue)) {
                const vkValue = Math.floor(ekValue * 2 * 1.19) + 0.95;
                mergedProduct.vkPrice = vkValue.toFixed(2).replace('.', ',');
              }
            }
            
            products.push(mergedProduct);
          } else {
            console.error(`Fehler beim Scrapen von ${productUrl}`);
            failedCount++;
          }
        } catch (err) {
          console.error(`Fehler beim Scrapen von ${productUrl}:`, err);
          failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (failedCount > 0) {
        toast({
          title: "Teilweise erfolgreich",
          description: `${products.length} erfolgreich, ${failedCount} fehlgeschlagen`,
          variant: "destructive",
        });
      }

      setScrapedProducts(products);
      
      if (abortScrapingRef.current) {
        setBatchProgress({ current: products.length, total: urls.length, status: "Abgebrochen" });
        toast({
          title: "Scraping abgebrochen",
          description: `${products.length} von ${urls.length} Produkten gescraped`,
          variant: "destructive",
        });
      } else {
        setBatchProgress({ current: products.length, total: urls.length, status: "Fertig!" });
        toast({
          title: "PDF-Scraping abgeschlossen",
          description: `${products.length} von ${urls.length} Produkten erfolgreich gescraped (inkl. EK-Preise aus PDF)`,
        });
      }
    } catch (error) {
      console.error('PDF scraping error:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : 'Scraping fehlgeschlagen',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      abortScrapingRef.current = false;
    }
  };

  // Copy HTML to clipboard
  const handleCopyHtml = async (articleNumber: string) => {
    const htmlContent = generatedDescriptions.get(articleNumber)?.description;
    if (!htmlContent) return;

    try {
      await navigator.clipboard.writeText(htmlContent);
      setCopiedArticleNumber(articleNumber);
      
      toast({
        title: "Erfolgreich kopiert",
        description: "HTML-Code wurde in die Zwischenablage kopiert",
      });

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedArticleNumber(null);
      }, 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        title: "Fehler",
        description: "HTML konnte nicht kopiert werden",
        variant: "destructive",
      });
    }
  };

  const handleGenerateDescription = async () => {
    if (!scrapedProduct) return;

    setIsGenerating(true);
    try {
      // Refresh token before generation
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        localStorage.setItem('supabase_token', session.access_token);
      }

      const productData = {
        productName: scrapedProduct.productName,
        articleNumber: scrapedProduct.articleNumber,
        ean: scrapedProduct.ean,
        manufacturer: scrapedProduct.manufacturer,
        price: scrapedProduct.price,
        weight: scrapedProduct.weight,
        category: scrapedProduct.category,
        description: scrapedProduct.description,
      };

      const token = localStorage.getItem('supabase_token');
      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          extractedData: [productData],
          customAttributes: {
            exactProductName: scrapedProduct.productName,
          },
          // SMART AUTO-EXTRACTION: Pass auto-extracted data to AI
          autoExtractedDescription: (scrapedProduct as any).autoExtractedDescription,
          technicalDataTable: (scrapedProduct as any).technicalDataTable,
          safetyWarnings: (scrapedProduct as any).safetyWarnings, // 1:1 safety warnings
          pdfManualUrl: (scrapedProduct as any).pdfManualUrl, // PDF manual URL
          // COST OPTIMIZATION: GPT-4o-mini ist 30× günstiger!
          model: 'gpt-4o-mini',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI-Generierung fehlgeschlagen');
      }

      const data = await response.json();
      setGeneratedDescription(data.description || '');
      
      // Update scrapedProduct with generated description
      if (scrapedProduct) {
        setScrapedProduct({
          ...scrapedProduct,
          description: data.description || ''
        });
      }
      
      toast({
        title: "Erfolgreich",
        description: "AI-Beschreibung wurde generiert",
      });

    } catch (error) {
      console.error('AI generation error:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : 'AI-Generierung fehlgeschlagen',
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // BATCH AI GENERATION: Generate descriptions for all scraped products (PARALLEL VERSION - 10× faster!)
  const handleGenerateAllDescriptions = async () => {
    if (scrapedProducts.length === 0) return;

    setIsGeneratingBatch(true);
    setAiGenerationProgress({ current: 0, total: scrapedProducts.length });

    const newDescriptions = new Map<string, GeneratedContent>();
    let successCount = 0;
    let errorCount = 0;

    try {
      // Refresh token before batch generation
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        localStorage.setItem('supabase_token', session.access_token);
      } else {
        throw new Error('Keine gültige Session. Bitte neu anmelden.');
      }

      const BATCH_SIZE = 5; // Process 5 products simultaneously
      const TIMEOUT_MS = 30000; // 30 seconds timeout per product

      // Helper function to generate description with timeout
      const generateWithTimeout = async (product: any, index: number) => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 30s')), TIMEOUT_MS)
        );

        const generatePromise = (async () => {
          const productData = {
            productName: product.productName,
            articleNumber: product.articleNumber,
            ean: product.ean,
            manufacturer: product.manufacturer,
            price: product.price,
            weight: product.weight,
            category: product.category,
            description: product.description,
          };

          // WICHTIG: Alle gescrapten technischen Felder übertragen (length, bodyDiameter, led1, etc.)
          console.log('🔍 [AI-GEN] All product fields:', Object.keys(product));
          console.log('🔍 [AI-GEN] Nitecore fields in product object:', {
            length: product.length,
            led1: product.led1,
            led2: product.led2,
            maxLuminosity: product.maxLuminosity
          });
          
          const structuredData: any = {};
          Object.keys(product).forEach((key) => {
            // Überspringe Basis-Felder (die bereits in productData sind)
            const skipFields = ['productName', 'articleNumber', 'ean', 'manufacturer', 'price', 'weight', 'category', 'description', 'images', 'autoExtractedDescription', 'technicalDataTable', 'safetyWarnings', 'pdfManualUrl'];
            if (!skipFields.includes(key) && product[key] !== undefined && product[key] !== null && product[key] !== '') {
              structuredData[key] = product[key];
            }
          });
          
          console.log(`📦 Strukturierte Daten für ${product.productName}:`, structuredData);

          const token = localStorage.getItem('supabase_token');
          const response = await fetch('/api/generate-description', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              extractedData: [productData],
              structuredData: Object.keys(structuredData).length > 0 ? structuredData : undefined,
              customAttributes: {
                exactProductName: product.productName,
              },
              autoExtractedDescription: (product as any).autoExtractedDescription,
              technicalDataTable: (product as any).technicalDataTable,
              safetyWarnings: (product as any).safetyWarnings,
              pdfManualUrl: (product as any).pdfManualUrl,
              model: 'gpt-4o-mini',
            }),
          });

          if (!response.ok) {
            throw new Error('AI-Generierung fehlgeschlagen');
          }

          return await response.json();
        })();

        return Promise.race([generatePromise, timeoutPromise]);
      };

      // Process products in batches of 5
      for (let i = 0; i < scrapedProducts.length; i += BATCH_SIZE) {
        const batch = scrapedProducts.slice(i, Math.min(i + BATCH_SIZE, scrapedProducts.length));
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map((product, batchIndex) => generateWithTimeout(product, i + batchIndex))
        );

        // Process results
        results.forEach((result, batchIndex) => {
          const product = batch[batchIndex];
          if (result.status === 'fulfilled') {
            const data = result.value as any;
            // Store complete response with description, seoTitle, seoDescription, seoKeywords
            newDescriptions.set(product.articleNumber, {
              description: data.description || '',
              seoTitle: data.seoTitle || '',
              seoDescription: data.seoDescription || '',
              seoKeywords: data.seoKeywords || ''
            });
            successCount++;
          } else {
            console.error(`Error generating description for ${product.productName}:`, result.reason);
            errorCount++;
          }
        });

        // Update progress
        setAiGenerationProgress({ 
          current: Math.min(i + BATCH_SIZE, scrapedProducts.length), 
          total: scrapedProducts.length 
        });
      }

      setGeneratedDescriptions(newDescriptions);

      toast({
        title: "Batch-Generierung abgeschlossen",
        description: `${successCount} Beschreibungen erfolgreich generiert${errorCount > 0 ? `, ${errorCount} Fehler` : ''}`,
      });

    } catch (error) {
      console.error('Batch AI generation error:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : 'Batch-Generierung fehlgeschlagen',
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBatch(false);
      setAiGenerationProgress({ current: 0, total: 0 });
    }
  };

  const convertToCSV = (products: ScrapedProduct[]): string => {
    if (products.length === 0) return '';

    // Fixed list of ALL expected fields (base fields + AI description + ANSMANN technical fields)
    // This ensures ALL columns appear in CSV, even if fields are missing
    const orderedKeys = [
      'articleNumber',
      'productName',
      'ean',
      'manufacturer',
      'ekPrice',
      'vkPrice',
      'nominalspannung',
      'nominalkapazitaet',
      'maxEntladestrom',
      'laenge',
      'breite',
      'hoehe',
      'gewicht',
      'zellenchemie',
      'energie',
      'farbe',
      'category',
      'seoTitle',
      'seoDescription',
      'seoKeywords',
      'description',
      'pdfManualUrl',
      'images'
    ];

    // Create friendly header names (ANSMANN fields)
    const headerMap: Record<string, string> = {
      articleNumber: 'Artikelnummer',
      productName: 'Produktname',
      ean: 'EAN',
      manufacturer: 'Hersteller',
      ekPrice: 'EK_Preis',
      vkPrice: 'VK_Preis',
      nominalspannung: 'Nominalspannung_V',
      nominalkapazitaet: 'Nominalkapazität_mAh',
      maxEntladestrom: 'Max_Entladestrom_A',
      laenge: 'Länge_mm',
      breite: 'Breite_mm',
      hoehe: 'Höhe_mm',
      gewicht: 'Gewicht_g',
      zellenchemie: 'Zellenchemie',
      energie: 'Energie_Wh',
      farbe: 'Farbe',
      category: 'Kategorie',
      seoTitle: 'SEO_Titel',
      seoDescription: 'SEO_Beschreibung',
      seoKeywords: 'SEO_Keywords',
      description: 'AI_Produktbeschreibung_HTML',
      pdfManualUrl: 'PDF_Bedienungsanleitung_URL',
      images: 'Bild_URLs'
    };

    const headers = orderedKeys.map(key => headerMap[key] || key);

    // CSV Rows - keep HTML in description, escape quotes properly
    // Fill missing fields with empty strings
    const rows = products.map(product => 
      orderedKeys.map(key => {
        // Special handling for AI-generated fields
        if (key === 'seoTitle') {
          const aiData = generatedDescriptions.get(product.articleNumber);
          return (aiData?.seoTitle || '').replace(/"/g, '""');
        }
        if (key === 'seoDescription') {
          const aiData = generatedDescriptions.get(product.articleNumber);
          return (aiData?.seoDescription || '').replace(/"/g, '""');
        }
        if (key === 'seoKeywords') {
          const aiData = generatedDescriptions.get(product.articleNumber);
          return (aiData?.seoKeywords || '').replace(/"/g, '""');
        }
        if (key === 'description') {
          const aiData = generatedDescriptions.get(product.articleNumber);
          const aiDesc = aiData?.description || '';
          return aiDesc.replace(/"/g, '""');
        }
        
        const value = product[key as keyof ScrapedProduct];
        
        if (key === 'images' && Array.isArray(value)) {
          return value.join(' | ');
        }
        
        // Return empty string if field is missing
        return (value as string || '').replace(/"/g, '""');
      })
    );

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const downloadCSV = () => {
    const csv = convertToCSV(scrapedProducts);
    // Add UTF-8 BOM for Excel compatibility
    const csvWithBOM = '\ufeff' + csv;
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `produktliste_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV heruntergeladen",
      description: `${scrapedProducts.length} Produkte exportiert`,
    });
  };

  const handleSaveToProject = async () => {
    if (!scrapedProduct) return;

    if (selectedProjectId === "new" && !projectName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Projektnamen ein",
        variant: "destructive",
      });
      return;
    }

    if (selectedProjectId !== "new" && !selectedProjectId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Projekt aus",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (selectedProjectId === "new") {
        // Create new project with single product
        // MediaMarkt V1: Produkt + Modell (Produktname)
        const mmV1 = scrapedProduct.productName;
        
        // MediaMarkt V2: Nur Modellcodes (ohne ANS- Präfix)
        const mmV2 = (scrapedProduct.articleNumber || '').replace(/^[A-Z]+-/, '').trim();

        await apiPost('/api/bulk-save-to-project', {
          projectName: projectName.trim(),
          products: [{
            produktname: scrapedProduct.productName,
            artikelnummer: scrapedProduct.articleNumber || '',
            produktbeschreibung: generatedDescription || '',
            ean: scrapedProduct.ean || '',
            hersteller: scrapedProduct.manufacturer || '',
            preis: scrapedProduct.price || '',
            gewicht: scrapedProduct.weight || '',
            kategorie: scrapedProduct.category || '',
            mediamarktname_v1: mmV1,
            mediamarktname_v2: mmV2,
            seo_beschreibung: scrapedProduct.description?.substring(0, 200) || '',
            source_url: url,
          }],
        });

        toast({
          title: "Projekt erstellt",
          description: `Produkt wurde erfolgreich in "${projectName.trim()}" gespeichert`,
        });
      } else {
        // Add to existing project
        const extractedDataArray = [
          scrapedProduct.ean ? { key: 'ean', value: scrapedProduct.ean, type: 'text' as const } : null,
          scrapedProduct.manufacturer ? { key: 'hersteller', value: scrapedProduct.manufacturer, type: 'text' as const } : null,
          scrapedProduct.price ? { key: 'preis', value: scrapedProduct.price, type: 'text' as const } : null,
          scrapedProduct.weight ? { key: 'gewicht', value: scrapedProduct.weight, type: 'text' as const } : null,
          scrapedProduct.category ? { key: 'kategorie', value: scrapedProduct.category, type: 'text' as const } : null,
        ].filter((item): item is { key: string; value: string; type: 'text' } => item !== null);

        await apiPost(`/api/projects/${selectedProjectId}/products`, {
          name: scrapedProduct.productName,
          articleNumber: scrapedProduct.articleNumber || '',
          htmlCode: generatedDescription || '',
          previewText: scrapedProduct.description?.substring(0, 200) || '',
          exactProductName: scrapedProduct.productName,
          extractedData: extractedDataArray.length > 0 ? extractedDataArray : undefined,
          customAttributes: [
            { key: 'source_url', value: url, type: 'text' },
          ].filter(attr => attr.value),
        });

        const project = projectsData?.projects.find(p => p.id === selectedProjectId);
        toast({
          title: "Produkt hinzugefügt",
          description: `Produkt wurde erfolgreich zu "${project?.name}" hinzugefügt`,
        });
      }

      // Invalidate queries to refresh product counts
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      // Invalidate all product-counts queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === '/api/projects/product-counts'
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/products`] });

      setShowSaveDialog(false);
      setProjectName("");
      setSelectedProjectId("new");

      // Redirect to projects page
      setTimeout(() => {
        setLocation('/projects');
      }, 1000);

    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : 'Speichern fehlgeschlagen',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk save all scraped products to project
  const handleBulkSaveToProject = async () => {
    if (scrapedProducts.length === 0) return;

    if (selectedProjectId === "new" && !projectName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Projektnamen ein",
        variant: "destructive",
      });
      return;
    }

    if (selectedProjectId !== "new" && !selectedProjectId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Projekt aus",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Convert all scraped products to the format expected by the API
      const products = scrapedProducts.map((product) => {
        const generatedContent = generatedDescriptions.get(product.articleNumber);
        
        // Extract ALL fields dynamically (exclude metadata fields)
        const excludeFields = ['articleNumber', 'productName', 'description', 'images'];
        const extractedDataArray: any[] = [];
        
        Object.entries(product).forEach(([key, value]) => {
          if (!excludeFields.includes(key) && value !== undefined && value !== null && value !== '') {
            // Convert camelCase to lowercase (e.g., manufacturer -> hersteller)
            const fieldMap: { [key: string]: string } = {
              'manufacturer': 'hersteller',
              'price': 'preis',
              'weight': 'gewicht'
            };
            const mappedKey = fieldMap[key] || key;
            extractedDataArray.push({ key: mappedKey, value: String(value), type: 'text' as const });
          }
        });
        
        // MediaMarkt V1: Produkt + Modell (Produktname)
        const mmV1 = product.productName;
        
        // MediaMarkt V2: Nur Modellcodes (ohne ANS- Präfix)
        const mmV2 = (product.articleNumber || '').replace(/^[A-Z]+-/, '').trim();
        
        return {
          produktname: product.productName,
          artikelnummer: product.articleNumber || '',
          produktbeschreibung: generatedContent?.description || '',
          extractedData: extractedDataArray, // ALL scraped fields as array
          mediamarktname_v1: mmV1,
          mediamarktname_v2: mmV2,
          seo_beschreibung: generatedContent?.seoDescription || product.description?.substring(0, 200) || '',
          source_url: url,
        };
      });

      if (selectedProjectId === "new") {
        // Create new project with all products
        await apiPost('/api/bulk-save-to-project', {
          projectName: projectName.trim(),
          products,
        });

        toast({
          title: "Projekt erstellt",
          description: `${scrapedProducts.length} Produkte wurden erfolgreich in "${projectName.trim()}" gespeichert`,
        });
      } else {
        // Add all products to existing project
        for (const product of scrapedProducts) {
          const generatedContent = generatedDescriptions.get(product.articleNumber);
          const extractedDataArray = [
            product.ean ? { key: 'ean', value: product.ean, type: 'text' as const } : null,
            product.manufacturer ? { key: 'hersteller', value: product.manufacturer, type: 'text' as const } : null,
            product.price ? { key: 'preis', value: product.price, type: 'text' as const } : null,
            product.weight ? { key: 'gewicht', value: product.weight, type: 'text' as const } : null,
          ].filter((item): item is { key: string; value: string; type: 'text' } => item !== null);

          await apiPost(`/api/projects/${selectedProjectId}/products`, {
            name: product.productName,
            articleNumber: product.articleNumber || '',
            htmlCode: generatedContent?.description || '',
            previewText: generatedContent?.seoDescription || product.description?.substring(0, 200) || '',
            exactProductName: product.productName,
            extractedData: extractedDataArray.length > 0 ? extractedDataArray : undefined,
            customAttributes: [
              { key: 'source_url', value: url, type: 'text' },
            ].filter(attr => attr.value),
          });
        }

        const project = projectsData?.projects.find(p => p.id === selectedProjectId);
        toast({
          title: "Produkte hinzugefügt",
          description: `${scrapedProducts.length} Produkte wurden erfolgreich zu "${project?.name}" hinzugefügt`,
        });
      }

      // Invalidate queries to refresh product counts
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === '/api/projects/product-counts'
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/products`] });

      setShowBulkSaveDialog(false);
      setProjectName("");
      setSelectedProjectId("new");

      // Redirect to projects page
      setTimeout(() => {
        setLocation('/projects');
      }, 1000);

    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern der Produkte",
        variant: "destructive",
      });
      console.error('Error saving products:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if coming from PDF Auto-Scraper
  const isFromPdfAutoScraper = window.location.search.includes('from=pdf-auto-scraper');

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">URL Webscraper</h1>
            <p className="text-muted-foreground mt-2">
              Extrahieren Sie Produktdaten direkt von Lieferanten-Websites
            </p>
          </div>
          
          {/* Back to PDF Auto-Scraper button (only shown when coming from PDF-Auto-Scraper) */}
          {isFromPdfAutoScraper && (
            <Button
              variant="outline"
              onClick={() => setLocation('/pdf-auto-scraper')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück zum PDF-Auto-Scraper
            </Button>
          )}
        </div>

        {/* Lieferanten-Shop Scraper */}
        <Card className="p-6">
          <div className="space-y-4">
              <div>
                <Label htmlFor="list-url">Kategorieseiten-URL</Label>
                <Input
                  id="list-url"
                  type="url"
                  placeholder="https://www.beispiel.de/kategorie/akkus"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL der Seite mit der Produktliste (z.B. Kategorie- oder Suchseite)
                </p>
              </div>

              <div>
                <Label htmlFor="supplier-select">Lieferant auswählen (optional)</Label>
                <Select value={selectedSupplierId} onValueChange={handleSupplierSelect}>
                  <SelectTrigger id="supplier-select" className="mt-2">
                    <SelectValue placeholder="Lieferant wählen oder manuell konfigurieren" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Keine Vorlage (Auto-Erkennung)</SelectItem>
                    {suppliersData?.suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Gespeicherte CSS-Selektoren für diesen Lieferanten laden
                </p>
              </div>

              <div>
                <Label htmlFor="product-link-selector">Produktlink CSS-Selektor (optional)</Label>
                <Input
                  id="product-link-selector"
                  placeholder="a.product-link (leer lassen für automatische Erkennung)"
                  value={productLinkSelector}
                  onChange={(e) => setProductLinkSelector(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Leer lassen für intelligente Auto-Erkennung. Nur ausfüllen, wenn die automatische Erkennung fehlschlägt.
                </p>
              </div>

              <div>
                <Label htmlFor="max-products">Maximale Anzahl Produkte</Label>
                <Input
                  id="max-products"
                  type="number"
                  min="1"
                  value={maxProducts}
                  onChange={(e) => setMaxProducts(parseInt(e.target.value) || 50)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Sie können beliebig viele Produkte scrapen
                </p>
              </div>

              {/* Pagination Options */}
              <div className="p-4 border rounded-lg bg-muted/20 space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enable-pagination"
                    checked={enablePagination}
                    onCheckedChange={(checked) => setEnablePagination(!!checked)}
                  />
                  <Label htmlFor="enable-pagination" className="cursor-pointer font-medium">
                    🔄 Alle Seiten scrapen (Paginierung)
                  </Label>
                </div>
                
                {enablePagination && (
                  <>
                    <div>
                      <Label htmlFor="pagination-selector" className="text-sm">Pagination CSS-Selektor (optional)</Label>
                      <Input
                        id="pagination-selector"
                        placeholder="a[rel='next'], .pagination .next (leer für Auto-Erkennung)"
                        value={paginationSelector}
                        onChange={(e) => setPaginationSelector(e.target.value)}
                        className="mt-2 text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 Selektor für den "Nächste Seite"-Button. Leer lassen für automatische Erkennung.
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="max-pages" className="text-sm">Maximale Seitenanzahl</Label>
                      <Input
                        id="max-pages"
                        type="number"
                        min="1"
                        value={maxPages}
                        onChange={(e) => setMaxPages(parseInt(e.target.value) || 10)}
                        className="mt-2 text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 Sie können beliebig viele Seiten scrapen
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleScrapeProductList} disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {batchProgress.status}
                    </>
                  ) : (
                    <>
                      <List className="w-4 h-4 mr-2" />
                      Produktliste scrapen
                    </>
                  )}
                </Button>

                {isLoading && batchProgress.total > 0 && (
                  <Button
                    onClick={() => {
                      abortScrapingRef.current = true;
                      toast({
                        title: "Wird abgebrochen...",
                        description: "Das Scraping wird nach dem aktuellen Produkt gestoppt",
                      });
                    }}
                    variant="destructive"
                  >
                    Abbrechen
                  </Button>
                )}
              </div>

              {isLoading && batchProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{batchProgress.status}</span>
                    <span className="font-semibold">
                      {batchProgress.current} / {batchProgress.total}
                      <span className="text-muted-foreground ml-2">
                        ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} />
                </div>
              )}
          </div>

          {/* Advanced Selectors */}
          <div className="mt-4 space-y-4">
            {selectedSupplierId !== "__none__" ? (
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                  ✅ Lieferanten-Selektoren geladen
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {suppliersData?.suppliers?.find(s => s.id === selectedSupplierId)?.name} Selektoren werden automatisch beim Scraping verwendet
                </p>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="advanced"
                      checked={showAdvanced}
                      onCheckedChange={(checked) => setShowAdvanced(!!checked)}
                    />
                    <Label htmlFor="advanced" className="cursor-pointer">
                      <Settings2 className="w-4 h-4 inline mr-1" />
                      Erweiterte CSS-Selektoren
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Standard-Selektoren funktionieren für die meisten Websites. Nur bei Bedarf anpassen.
                  </p>
                </div>

                {showAdvanced && (
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <Label className="text-xs">Artikelnummer Selector</Label>
                  <Input
                    placeholder='.product-code'
                    value={selectors.articleNumber}
                    onChange={(e) => setSelectors({...selectors, articleNumber: e.target.value})}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Produktname Selector</Label>
                  <Input
                    placeholder='h1.product-title'
                    value={selectors.productName}
                    onChange={(e) => setSelectors({...selectors, productName: e.target.value})}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">EAN Selector</Label>
                  <Input
                    placeholder='.ean'
                    value={selectors.ean}
                    onChange={(e) => setSelectors({...selectors, ean: e.target.value})}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Hersteller Selector</Label>
                  <Input
                    placeholder='.brand'
                    value={selectors.manufacturer}
                    onChange={(e) => setSelectors({...selectors, manufacturer: e.target.value})}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Preis Selector</Label>
                  <Input
                    placeholder='.price'
                    value={selectors.price}
                    onChange={(e) => setSelectors({...selectors, price: e.target.value})}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Beschreibung Selector</Label>
                  <Input
                    placeholder='.product-description'
                    value={selectors.description}
                    onChange={(e) => setSelectors({...selectors, description: e.target.value})}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bilder Selector</Label>
                  <Input
                    placeholder='.product-image img'
                    value={selectors.images}
                    onChange={(e) => setSelectors({...selectors, images: e.target.value})}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Gewicht Selector</Label>
                  <Input
                    placeholder='.weight'
                    value={selectors.weight}
                    onChange={(e) => setSelectors({...selectors, weight: e.target.value})}
                    className="text-sm"
                  />
                </div>
              </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Scraped Data Display */}
        {scrapedProduct && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Extrahierte Produktdaten</h3>
            
            {/* Tabelle mit allen Feldern */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Feldname</TableHead>
                    <TableHead>Extrahierter Wert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(scrapedProduct).map(([key, value]) => {
                    // Skip images array, we'll show it separately
                    if (key === 'images') return null;
                    
                    // Skip empty values
                    if (!value) return null;
                    
                    // Skip description if it's an HTML object or auto-extracted flag
                    if (key === 'autoExtractedDescription' || key === 'technicalDataTable' || key === 'pdfManualUrl' || key === 'safetyWarnings' || key === 'rawHtml') return null;
                    
                    // German field name mapping (Nitecore selector names)
                    const fieldNameMap: Record<string, string> = {
                      articleNumber: 'Artikelnummer',
                      productName: 'Produktname',
                      ean: 'EAN',
                      manufacturer: 'Hersteller',
                      price: 'Preis',
                      weight: 'Gewicht (g)',
                      description: 'Beschreibung',
                      length: 'Länge (mm)',
                      bodyDiameter: 'Gehäusedurchmesser (mm)',
                      headDiameter: 'Kopfdurchmesser (mm)',
                      weightWithoutBattery: 'Gewicht ohne Batterie (g)',
                      totalWeight: 'Gesamt Gewicht (g)',
                      powerSupply: 'Stromversorgung',
                      led1: 'Leuchtmittel 1',
                      led2: 'Leuchtmittel 2',
                      spotIntensity: 'Spotintensität (cd)',
                      maxLuminosity: 'Leuchtleistung max. (Lumen)',
                      maxBeamDistance: 'Max. Leuchtweite (m)',
                    };
                    
                    const fieldName = fieldNameMap[key] || key;
                    
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium text-muted-foreground">{fieldName}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 break-words">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                            {key === 'description' && value && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 h-8 px-2"
                                onClick={() => {
                                  navigator.clipboard.writeText(String(value));
                                  toast({
                                    title: "Kopiert!",
                                    description: "Beschreibung wurde in die Zwischenablage kopiert",
                                  });
                                }}
                              >
                                📋
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  
                </TableBody>
              </Table>
            </div>

            {/* Image Gallery */}
            {scrapedProduct.images && scrapedProduct.images.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <h4 className="text-md font-semibold mb-3">
                  Produktbilder ({scrapedProduct.images.length} gefunden)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {scrapedProduct.images.map((imgUrl, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={imgUrl} 
                        alt={`Produktbild ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer"
                        onClick={() => window.open(imgUrl, '_blank')}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EFehler%3C/text%3E%3C/svg%3E';
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all pointer-events-none" />
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        #{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <Button onClick={handleGenerateDescription} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI generiert...
                  </>
                ) : (
                  'AI-Beschreibung generieren'
                )}
              </Button>
              <Button 
                variant="outline" 
                disabled={!scrapedProduct}
                onClick={() => setShowSaveDialog(true)}
              >
                Zu Projekt hinzufügen
              </Button>
            </div>
          </Card>
        )}

        {/* Product List Preview */}
        {scrapedProducts.length > 0 && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Gescrapte Produkte ({scrapedProducts.length})</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={handleGenerateAllDescriptions} 
                  variant="default"
                  disabled={isGeneratingBatch}
                >
                  {isGeneratingBatch ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {aiGenerationProgress.current}/{aiGenerationProgress.total} generiert...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Alle AI-Beschreibungen generieren
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => setShowBulkSaveDialog(true)} 
                  variant="default"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Als Projekt speichern
                </Button>
                <Button onClick={downloadCSV} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Als CSV herunterladen
                </Button>
              </div>
            </div>
            
            {/* AI Generation Progress Bar */}
            {isGeneratingBatch && (
              <div className="mb-4">
                <Progress value={(aiGenerationProgress.current / aiGenerationProgress.total) * 100} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  Generiere MediaMarkt-Beschreibungen: {aiGenerationProgress.current} von {aiGenerationProgress.total}
                </p>
              </div>
            )}
            
            {/* Info Banner */}
            <div className="mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <strong>KI-Felder (blau markiert)</strong> werden nach Klick auf "Alle AI-Beschreibungen generieren" automatisch befüllt
              </p>
            </div>
            
            <div className="border rounded-lg overflow-x-auto">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted sticky top-0 z-20">
                    <TableRow>
                      {/* Scraped Data Columns (weiß) */}
                      <TableHead className="w-12 sticky left-0 bg-muted z-20">#</TableHead>
                      <TableHead className="sticky left-12 bg-muted z-20">Bild (Anzahl)</TableHead>
                      <TableHead className="min-w-[120px]">Artikelnummer</TableHead>
                      <TableHead className="min-w-[200px]">Produktname</TableHead>
                      <TableHead className="min-w-[120px]">EAN</TableHead>
                      <TableHead className="min-w-[120px]">Hersteller</TableHead>
                      <TableHead className="min-w-[100px]">EK (netto) €</TableHead>
                      <TableHead className="min-w-[100px]">VK (brutto) €</TableHead>
                      {/* ANSMANN Technical Specifications */}
                      <TableHead className="min-w-[120px]">Nominalspannung (V)</TableHead>
                      <TableHead className="min-w-[140px]">Nominalkapazität (mAh)</TableHead>
                      <TableHead className="min-w-[140px]">max. Entladestrom (A)</TableHead>
                      <TableHead className="min-w-[100px]">Länge (mm)</TableHead>
                      <TableHead className="min-w-[100px]">Breite (mm)</TableHead>
                      <TableHead className="min-w-[100px]">Höhe (mm)</TableHead>
                      <TableHead className="min-w-[100px]">Gewicht (g)</TableHead>
                      <TableHead className="min-w-[120px]">Zellenchemie</TableHead>
                      <TableHead className="min-w-[100px]">Energie (Wh)</TableHead>
                      <TableHead className="min-w-[100px]">Farbe</TableHead>
                      
                      {/* KI-generierte Spalten (blau markiert) */}
                      <TableHead className="min-w-[180px] bg-primary/10 text-primary font-semibold">
                        🤖 MediaMarkt V1
                      </TableHead>
                      <TableHead className="min-w-[150px] bg-primary/10 text-primary font-semibold">
                        🤖 MediaMarkt V2
                      </TableHead>
                      <TableHead className="min-w-[200px] bg-primary/10 text-primary font-semibold">
                        🤖 SEO Titel
                      </TableHead>
                      <TableHead className="min-w-[250px] bg-primary/10 text-primary font-semibold">
                        🤖 SEO Produktbeschreibung
                      </TableHead>
                      <TableHead className="min-w-[200px] bg-primary/10 text-primary font-semibold">
                        🤖 SEO Keywords
                      </TableHead>
                      <TableHead className="min-w-[250px] bg-primary/10 text-primary font-semibold">
                        🤖 Produktbeschreibung (HTML)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scrapedProducts
                      .slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage)
                      .map((product, index) => {
                        const absoluteIndex = (currentPage - 1) * productsPerPage + index;
                        return (
                          <TableRow key={absoluteIndex}>
                        <TableCell className="font-mono text-sm sticky left-0 bg-white z-10">{absoluteIndex + 1}</TableCell>
                        <TableCell className="sticky left-12 bg-white z-10">
                          {product.images && product.images.length > 0 ? (
                            <img 
                              src={product.images[0]} 
                              alt={product.productName}
                              className="w-16 h-16 object-cover rounded border"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%23e5e7eb"/><text x="32" y="32" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="12">-</text></svg>';
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center text-muted-foreground text-xs">
                              -
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm whitespace-nowrap">{product.articleNumber || '-'}</TableCell>
                        <TableCell className="font-medium whitespace-normal break-words">{product.productName || '-'}</TableCell>
                        <TableCell className="font-mono text-sm whitespace-nowrap">{product.ean || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{product.manufacturer || '-'}</TableCell>
                        <TableCell className="font-semibold whitespace-nowrap text-green-700">{(product as any).ekPrice || '-'}</TableCell>
                        <TableCell className="font-semibold whitespace-nowrap text-blue-700">{(product as any).vkPrice || '-'}</TableCell>
                        {/* ANSMANN Technical Specifications */}
                        <TableCell className="text-sm">{product.nominalspannung || '-'}</TableCell>
                        <TableCell className="text-sm">{product.nominalkapazitaet || '-'}</TableCell>
                        <TableCell className="text-sm">{product.maxEntladestrom || '-'}</TableCell>
                        <TableCell className="text-sm">{product.laenge || '-'}</TableCell>
                        <TableCell className="text-sm">{product.breite || '-'}</TableCell>
                        <TableCell className="text-sm">{product.hoehe || '-'}</TableCell>
                        <TableCell className="text-sm">{product.gewicht || '-'}</TableCell>
                        <TableCell className="text-sm">{product.zellenchemie || '-'}</TableCell>
                        <TableCell className="text-sm">{product.energie || '-'}</TableCell>
                        <TableCell className="text-sm">{product.farbe || '-'}</TableCell>
                        
                        {/* KI-generierte Spalten (blau markiert) */}
                        <TableCell className="bg-primary/5 text-xs italic text-muted-foreground">
                          {generatedDescriptions.has(product.articleNumber) ? (
                            `${product.category || 'Produkt'} ${product.articleNumber}`
                          ) : (
                            'wird generiert...'
                          )}
                        </TableCell>
                        <TableCell className="bg-primary/5 text-xs italic text-muted-foreground">
                          {generatedDescriptions.has(product.articleNumber) ? (
                            product.articleNumber || '-'
                          ) : (
                            'wird generiert...'
                          )}
                        </TableCell>
                        <TableCell className="bg-primary/5 text-xs">
                          {generatedDescriptions.has(product.articleNumber) ? (
                            <div className="flex items-center gap-2">
                              <div className="max-w-md whitespace-normal">
                                {generatedDescriptions.get(product.articleNumber)?.seoTitle || product.productName || '-'}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSeoTitlePreviewContent(generatedDescriptions.get(product.articleNumber)?.seoTitle || '');
                                  setShowSeoTitlePreview(true);
                                }}
                                title="Vollständigen SEO-Titel anzeigen"
                                className="shrink-0"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground">wird generiert...</span>
                          )}
                        </TableCell>
                        <TableCell className="bg-primary/5 text-xs">
                          {generatedDescriptions.has(product.articleNumber) ? (
                            <div className="flex items-center gap-2">
                              <div className="max-w-md whitespace-normal line-clamp-3">
                                {generatedDescriptions.get(product.articleNumber)?.seoDescription || '-'}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSeoPreviewContent(generatedDescriptions.get(product.articleNumber)?.seoDescription || '');
                                  setShowSeoPreview(true);
                                }}
                                title="Vollständige SEO-Beschreibung anzeigen"
                                className="shrink-0"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground">wird generiert...</span>
                          )}
                        </TableCell>
                        <TableCell className="bg-primary/5 text-xs italic text-muted-foreground">
                          {generatedDescriptions.has(product.articleNumber) ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="line-clamp-1">{generatedDescriptions.get(product.articleNumber)?.seoKeywords || `${product.manufacturer}, ${product.category}, ${product.articleNumber}`}</span>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setKeywordsPreviewContent(generatedDescriptions.get(product.articleNumber)?.seoKeywords || '');
                                    setShowKeywordsPreview(true);
                                  }}
                                  title="Vollständige Keywords anzeigen"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const genContent = generatedDescriptions.get(product.articleNumber);
                                    setSerpPreviewData({
                                      title: genContent?.seoTitle || product.productName || '',
                                      description: genContent?.seoDescription || '',
                                      url: product.articleNumber || '',
                                      productName: product.productName || ''
                                    });
                                    setShowSerpPreview(true);
                                  }}
                                  title="SERP Snippet Vorschau (Google-Ansicht)"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                                  </svg>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const genContent = generatedDescriptions.get(product.articleNumber);
                                    setFullViewContent({
                                      title: genContent?.seoTitle || product.productName || '',
                                      seoDescription: genContent?.seoDescription || '',
                                      keywords: genContent?.seoKeywords || `${product.manufacturer}, ${product.category}, ${product.articleNumber}`,
                                      html: genContent?.description || ''
                                    });
                                    setShowFullView(true);
                                  }}
                                  title="Vollansicht öffnen"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            'wird generiert...'
                          )}
                        </TableCell>
                        <TableCell className="bg-primary/5 text-xs font-mono">
                          {generatedDescriptions.has(product.articleNumber) ? (
                            <div className="flex items-center gap-2">
                              <span className="max-w-xs truncate text-muted-foreground" title={generatedDescriptions.get(product.articleNumber)?.description}>
                                {(generatedDescriptions.get(product.articleNumber)?.description || '').substring(0, 60) + '...'}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setHtmlPreviewContent(generatedDescriptions.get(product.articleNumber)?.description || '');
                                  setShowHtmlPreview(true);
                                }}
                                title="HTML Vorschau anzeigen"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyHtml(product.articleNumber)}
                                title="HTML kopieren"
                                className={copiedArticleNumber === product.articleNumber ? "text-green-600" : ""}
                              >
                                {copiedArticleNumber === product.articleNumber ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">wird generiert...</span>
                          )}
                        </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              {scrapedProducts.length > productsPerPage && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                  <div className="text-sm text-muted-foreground">
                    Zeige {((currentPage - 1) * productsPerPage) + 1} bis {Math.min(currentPage * productsPerPage, scrapedProducts.length)} von {scrapedProducts.length} Produkten
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Zurück
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.ceil(scrapedProducts.length / productsPerPage) }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(Math.ceil(scrapedProducts.length / productsPerPage), currentPage + 1))}
                      disabled={currentPage === Math.ceil(scrapedProducts.length / productsPerPage)}
                    >
                      Weiter
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* HTML Preview (Fließtext) */}
        {generatedDescription && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">HTML-Vorschau (Fließtext)</h3>
            <div className="p-6 bg-white dark:bg-gray-900 border rounded-lg max-h-96 overflow-y-auto">
              <style dangerouslySetInnerHTML={{ __html: `
                .product-preview h2 { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; }
                .product-preview h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
                .product-preview h4 { font-size: 1.1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; }
                .product-preview p { margin: 0.75rem 0; line-height: 1.6; }
                .product-preview table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                .product-preview table th,
                .product-preview table td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
                .product-preview table th { background-color: #f3f4f6; font-weight: 600; }
                .product-preview table tr:nth-child(even) { background-color: #f9fafb; }
                .product-preview .properties-label { font-weight: 600; width: 40%; }
                .product-preview .properties-value { width: 60%; }
                .dark .product-preview table th,
                .dark .product-preview table td { border-color: #374151; }
                .dark .product-preview table th { background-color: #1f2937; }
                .dark .product-preview table tr:nth-child(even) { background-color: #111827; }
              ` }} />
              <div 
                className="product-preview"
                dangerouslySetInnerHTML={{ __html: generatedDescription }} 
              />
            </div>
          </Card>
        )}

        {/* Save to Project Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={(open) => {
          setShowSaveDialog(open);
          if (!open) {
            setProjectName("");
            setSelectedProjectId("new");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zu Projekt hinzufügen</DialogTitle>
              <DialogDescription>
                Speichern Sie das gescrapte Produkt in "Meine Projekte"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="project-select" className="mb-2 block">
                  Projekt wählen
                </Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={isSaving}
                >
                  <SelectTrigger id="project-select">
                    <SelectValue placeholder="Projekt auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      <div className="flex items-center">
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Neues Projekt erstellen
                      </div>
                    </SelectItem>
                    {projectsData?.projects && projectsData.projects.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Bestehende Projekte
                        </div>
                        {projectsData.projects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedProjectId === "new" && (
                <div>
                  <Label htmlFor="project-name" className="mb-2 block">
                    Name für neues Projekt
                  </Label>
                  <Input
                    id="project-name"
                    placeholder="z.B. Webscraping Dezember 2024"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSaving) {
                        handleSaveToProject();
                      }
                    }}
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                disabled={isSaving}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveToProject}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* HTML Preview Dialog */}
        <Dialog open={showHtmlPreview} onOpenChange={setShowHtmlPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Produktbeschreibung Vorschau</DialogTitle>
              <DialogDescription>
                So würde die Beschreibung im MediaMarkt-Shop aussehen
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-6 bg-white border rounded-lg overflow-y-auto" style={{ maxHeight: '70vh' }}>
                <div dangerouslySetInnerHTML={{ __html: htmlPreviewContent }} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(htmlPreviewContent);
                    toast({ title: "Kopiert", description: "HTML wurde in die Zwischenablage kopiert" });
                  }}
                >
                  HTML kopieren
                </Button>
                <Button onClick={() => setShowHtmlPreview(false)}>
                  Schließen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* SEO Title Preview Dialog */}
        <Dialog open={showSeoTitlePreview} onOpenChange={setShowSeoTitlePreview}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>SEO Produkttitel</DialogTitle>
              <DialogDescription>
                Vollständiger SEO-optimierter Titel für Suchmaschinen (max. 70 Zeichen)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-6 bg-muted/50 border rounded-lg">
                <p className="text-lg font-semibold leading-relaxed" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                  {seoTitlePreviewContent}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(seoTitlePreviewContent);
                    toast({ title: "Kopiert", description: "SEO-Titel wurde in die Zwischenablage kopiert" });
                  }}
                >
                  Text kopieren
                </Button>
                <Button onClick={() => setShowSeoTitlePreview(false)}>
                  Schließen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* SEO Description Preview Dialog */}
        <Dialog open={showSeoPreview} onOpenChange={setShowSeoPreview}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>SEO Produktbeschreibung</DialogTitle>
              <DialogDescription>
                Vollständige SEO-optimierte Beschreibung für Suchmaschinen
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-6 bg-muted/50 border rounded-lg">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{seoPreviewContent}</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(seoPreviewContent);
                    toast({ title: "Kopiert", description: "SEO-Beschreibung wurde in die Zwischenablage kopiert" });
                  }}
                >
                  Text kopieren
                </Button>
                <Button onClick={() => setShowSeoPreview(false)}>
                  Schließen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* SEO Keywords Preview Dialog */}
        <Dialog open={showKeywordsPreview} onOpenChange={setShowKeywordsPreview}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>SEO Keywords</DialogTitle>
              <DialogDescription>
                AI-generierte Keywords für optimale Suchmaschinenoptimierung
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-6 bg-muted/50 border rounded-lg overflow-y-auto" style={{ maxHeight: '60vh' }}>
                <p className="text-sm leading-relaxed">{keywordsPreviewContent}</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(keywordsPreviewContent);
                    toast({ title: "Kopiert", description: "Keywords wurden in die Zwischenablage kopiert" });
                  }}
                >
                  Text kopieren
                </Button>
                <Button onClick={() => setShowKeywordsPreview(false)}>
                  Schließen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Full View Dialog */}
        <Dialog open={showFullView} onOpenChange={setShowFullView}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vollständige Produktinformationen</DialogTitle>
              <DialogDescription>
                Alle AI-generierten Inhalte im Detail
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* SEO Title */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">SEO-Titel</Label>
                <div className="p-4 bg-muted rounded-lg border">
                  <p className="text-sm">{fullViewContent.title}</p>
                </div>
              </div>

              {/* SEO Description */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">SEO-Beschreibung</Label>
                <div className="p-4 bg-muted rounded-lg border">
                  <p className="text-sm">{fullViewContent.seoDescription}</p>
                </div>
              </div>

              {/* Keywords */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Keywords</Label>
                <div className="p-4 bg-muted rounded-lg border">
                  <p className="text-sm">{fullViewContent.keywords}</p>
                </div>
              </div>

              {/* HTML Description */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">HTML-Beschreibung</Label>
                <div className="p-4 bg-muted rounded-lg border max-h-96 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap break-words font-mono">{fullViewContent.html}</pre>
                </div>
              </div>

              {/* Preview */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">HTML-Vorschau</Label>
                <div className="p-6 bg-white border rounded-lg max-h-96 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: fullViewContent.html }} />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(fullViewContent.html);
                    toast({ title: "Kopiert", description: "HTML wurde in die Zwischenablage kopiert" });
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  HTML kopieren
                </Button>
                <Button onClick={() => setShowFullView(false)}>
                  Schließen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* SERP Snippet Preview Dialog */}
        <Dialog open={showSerpPreview} onOpenChange={setShowSerpPreview}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>SERP Snippet Vorschau</DialogTitle>
              <DialogDescription>
                So würde Ihr Produkt in Google-Suchergebnissen erscheinen
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              
              {/* Google SERP Preview */}
              <div className="p-6 bg-white border rounded-lg">
                <div className="space-y-2">
                  {/* URL Breadcrumb */}
                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    <span className="font-normal">www.ihr-shop.de</span>
                    <span>›</span>
                    <span className="truncate max-w-md">{serpPreviewData.productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}</span>
                  </div>
                  
                  {/* Meta Title */}
                  <div>
                    <h3 className="text-xl text-blue-600 hover:underline cursor-pointer font-normal leading-snug">
                      {serpPreviewData.title || 'SEO Titel wird hier angezeigt...'}
                    </h3>
                  </div>
                  
                  {/* Meta Description */}
                  <div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {serpPreviewData.description || 'SEO Beschreibung wird hier angezeigt...'}
                    </p>
                  </div>
                </div>
              </div>

              {/* SEO Quality Metrics */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">SEO-Qualitätsanalyse</h4>
                
                {/* Meta Title Metrics */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Meta Title</span>
                    <span className={`font-semibold ${
                      (serpPreviewData.title.length * 8.5) >= 300 && (serpPreviewData.title.length * 8.5) <= 580 ? 'text-green-600' :
                      (serpPreviewData.title.length * 8.5) >= 200 && (serpPreviewData.title.length * 8.5) < 300 ? 'text-yellow-600' :
                      (serpPreviewData.title.length * 8.5) > 580 && (serpPreviewData.title.length * 8.5) <= 620 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {Math.round(serpPreviewData.title.length * 8.5)} / 580 pixels
                    </span>
                  </div>
                  <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        (serpPreviewData.title.length * 8.5) >= 300 && (serpPreviewData.title.length * 8.5) <= 580 ? 'bg-green-500' :
                        (serpPreviewData.title.length * 8.5) >= 200 && (serpPreviewData.title.length * 8.5) < 300 ? 'bg-yellow-500' :
                        (serpPreviewData.title.length * 8.5) > 580 && (serpPreviewData.title.length * 8.5) <= 620 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min((serpPreviewData.title.length * 8.5 / 580) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(serpPreviewData.title.length * 8.5) >= 300 && (serpPreviewData.title.length * 8.5) <= 580 ? 
                      '✓ Perfekte Länge - wird vollständig in Google angezeigt' :
                     (serpPreviewData.title.length * 8.5) < 300 ? 
                      '⚠ Etwas kurz - nutzen Sie mehr Platz für Keywords' :
                      '✗ Zu lang - wird in Google abgeschnitten'}
                  </p>
                </div>

                {/* Meta Description Metrics */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Meta Description</span>
                    <span className={`font-semibold ${
                      (serpPreviewData.description.length * 6.3) >= 600 && (serpPreviewData.description.length * 6.3) <= 1000 ? 'text-green-600' :
                      (serpPreviewData.description.length * 6.3) >= 450 && (serpPreviewData.description.length * 6.3) < 600 ? 'text-yellow-600' :
                      (serpPreviewData.description.length * 6.3) > 1000 && (serpPreviewData.description.length * 6.3) <= 1100 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {Math.round(serpPreviewData.description.length * 6.3)} / 1000 pixels
                    </span>
                  </div>
                  <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        (serpPreviewData.description.length * 6.3) >= 600 && (serpPreviewData.description.length * 6.3) <= 1000 ? 'bg-green-500' :
                        (serpPreviewData.description.length * 6.3) >= 450 && (serpPreviewData.description.length * 6.3) < 600 ? 'bg-yellow-500' :
                        (serpPreviewData.description.length * 6.3) > 1000 && (serpPreviewData.description.length * 6.3) <= 1100 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min((serpPreviewData.description.length * 6.3 / 1000) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(serpPreviewData.description.length * 6.3) >= 600 && (serpPreviewData.description.length * 6.3) <= 1000 ? 
                      '✓ Perfekte Länge - wird vollständig in Google angezeigt' :
                     (serpPreviewData.description.length * 6.3) < 600 ? 
                      '⚠ Etwas kurz - fügen Sie mehr Details hinzu' :
                      '✗ Zu lang - wird in Google gekürzt'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => {
                    const copyText = `Meta Title: ${serpPreviewData.title}\n\nMeta Description: ${serpPreviewData.description}`;
                    navigator.clipboard.writeText(copyText);
                    toast({ title: "Kopiert", description: "SERP-Daten wurden in die Zwischenablage kopiert" });
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  SERP-Daten kopieren
                </Button>
                <Button onClick={() => setShowSerpPreview(false)}>
                  Schließen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Save Dialog */}
        <Dialog open={showBulkSaveDialog} onOpenChange={(open) => {
          setShowBulkSaveDialog(open);
          if (!open) {
            setProjectName("");
            setSelectedProjectId("new");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alle Produkte als Projekt speichern</DialogTitle>
              <DialogDescription>
                Speichern Sie {scrapedProducts.length} gescrapte Produkte in "Meine Projekte"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="bulk-project-select" className="mb-2 block">
                  Projekt wählen
                </Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={isSaving}
                >
                  <SelectTrigger id="bulk-project-select">
                    <SelectValue placeholder="Projekt auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      <div className="flex items-center">
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Neues Projekt erstellen
                      </div>
                    </SelectItem>
                    {projectsData?.projects && projectsData.projects.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Bestehende Projekte
                        </div>
                        {projectsData.projects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedProjectId === "new" && (
                <div>
                  <Label htmlFor="bulk-project-name" className="mb-2 block">
                    Name für neues Projekt
                  </Label>
                  <Input
                    id="bulk-project-name"
                    placeholder="z.B. Webscraping Dezember 2024"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSaving) {
                        handleBulkSaveToProject();
                      }
                    }}
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBulkSaveDialog(false)}
                disabled={isSaving}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleBulkSaveToProject}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Speichere...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {scrapedProducts.length} Produkte speichern
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
