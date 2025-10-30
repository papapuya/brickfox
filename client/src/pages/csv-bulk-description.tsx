import { useState, useEffect } from "react";
import { Upload, Download, FileText, CheckCircle2, Loader2, AlertTriangle, Settings2, FolderPlus, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseCSV } from "@/lib/csv-processor";
import type Papa from "papaparse";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BulkDescriptionTable } from "@/components/bulk-description-table";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@shared/schema";

interface RawCSVRow {
  [key: string]: string;
}

interface BulkProduct {
  id: number;
  artikelnummer: string;
  produktname: string;
  produktbeschreibung: string;
  mediamarktname_v1: string;
  mediamarktname_v2: string;
  seo_beschreibung: string;
  kurzbeschreibung: string;
}

interface ExportColumn {
  key: string;
  label: string;
  enabled: boolean;
}

export default function CSVBulkDescription() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [bulkProducts, setBulkProducts] = useState<BulkProduct[]>([]);
  const [rawData, setRawData] = useState<RawCSVRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [parseWarnings, setParseWarnings] = useState<Papa.ParseError[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("new");
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [htmlPreviewContent, setHtmlPreviewContent] = useState("");

  // Lade bestehende Projekte
  const { data: projectsData } = useQuery<{ success: boolean; projects: Project[] }>({
    queryKey: ['/api/projects'],
    enabled: showSaveDialog,
  });

  const existingProjects = projectsData?.projects || [];
  
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>([
    { key: 'artikelnummer', label: 'Artikelnummer', enabled: true },
    { key: 'produktname', label: 'Produktname', enabled: true },
    { key: 'produktbeschreibung', label: 'Produktbeschreibung_HTML', enabled: true },
    { key: 'mediamarktname_v1', label: 'Mediamarktname_V1', enabled: true },
    { key: 'mediamarktname_v2', label: 'Mediamarktname_V2', enabled: true },
    { key: 'seo_beschreibung', label: 'SEO_Beschreibung', enabled: true },
    { key: 'kurzbeschreibung', label: 'Kurzbeschreibung', enabled: true },
  ]);

  // SessionStorage Keys
  const SESSION_KEY_PRODUCTS = 'csv-bulk-products';
  const SESSION_KEY_RAW_DATA = 'csv-bulk-raw-data';
  const SESSION_KEY_FILE_NAME = 'csv-bulk-file-name';

  // Beim Laden der Komponente: Daten aus sessionStorage wiederherstellen
  useEffect(() => {
    const savedProducts = sessionStorage.getItem(SESSION_KEY_PRODUCTS);
    const savedRawData = sessionStorage.getItem(SESSION_KEY_RAW_DATA);
    const savedFileName = sessionStorage.getItem(SESSION_KEY_FILE_NAME);

    if (savedProducts && savedRawData) {
      try {
        const products = JSON.parse(savedProducts);
        const rawData = JSON.parse(savedRawData);
        
        setBulkProducts(products);
        setRawData(rawData);
        
        if (savedFileName) {
          setSuccessMessage(`${products.length} gespeicherte Produkte wiederhergestellt (${savedFileName})`);
        }
      } catch (error) {
        console.error('Failed to restore session data:', error);
        sessionStorage.removeItem(SESSION_KEY_PRODUCTS);
        sessionStorage.removeItem(SESSION_KEY_RAW_DATA);
        sessionStorage.removeItem(SESSION_KEY_FILE_NAME);
      }
    }
  }, []);

  // Bei Änderungen: Daten in sessionStorage speichern
  useEffect(() => {
    if (bulkProducts.length > 0) {
      sessionStorage.setItem(SESSION_KEY_PRODUCTS, JSON.stringify(bulkProducts));
      sessionStorage.setItem(SESSION_KEY_RAW_DATA, JSON.stringify(rawData));
      if (file) {
        sessionStorage.setItem(SESSION_KEY_FILE_NAME, file.name);
      }
    }
  }, [bulkProducts, rawData, file]);

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setError("");
    setSuccessMessage("");

    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      setError('Bitte wählen Sie eine gültige CSV-Datei aus.');
      return;
    }

    processFile(selectedFile);
  };

  const processFile = async (fileToProcess: File) => {
    setProcessing(true);
    setError("");
    setParseWarnings([]);
    setBulkProducts([]);
    setProgress(0);

    try {
      const parseResult = await parseCSV(fileToProcess);
      
      if (parseResult.data.length === 0) {
        setError('Die CSV-Datei enthält keine gültigen Daten.');
        setProcessing(false);
        return;
      }

      setRawData(parseResult.data);
      setParseWarnings(parseResult.warnings);
      setSuccessMessage(`${parseResult.data.length} Zeilen erfolgreich eingelesen`);
      setProcessing(false);

      // AI-Generierung wird NICHT automatisch gestartet - User muss Button klicken
      
    } catch (err) {
      console.error('Verarbeitungsfehler:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Verarbeiten der Datei');
      setProcessing(false);
    }
  };

  const startAIGeneration = async () => {
    if (rawData.length === 0) {
      setError('Keine Daten zum Verarbeiten vorhanden');
      return;
    }

    setProcessing(true);
    setError("");
    setProgress(0);
    
    try {
      await generateDescriptions(rawData);
    } catch (err) {
      console.error('Generierungsfehler:', err);
      setError(err instanceof Error ? err.message : 'Fehler bei der AI-Generierung');
      setProcessing(false);
    }
  };

  const generateDescriptions = async (data: RawCSVRow[]) => {
    const BATCH_SIZE = 5;
    const total = data.length;
    const results: (BulkProduct | undefined)[] = new Array(total);
    let processedCount = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = data.slice(i, Math.min(i + BATCH_SIZE, total));

      const settled = await Promise.allSettled(
        batch.map(async (row, batchIndex) => {
          const globalIndex = i + batchIndex;
          const productData: Record<string, string> = {};

          Object.keys(row).forEach((key) => {
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
            productData[normalizedKey] = row[key];
          });

          // Produktname aus verschiedenen möglichen Spalten lesen
          const produktname =
            productData.produktname ||
            productData.bezeichnung ||
            productData.name ||
            row['Produktname'] ||
            row['Bezeichnung'] ||
            row['Name'] ||
            row['produktname'] ||
            row['bezeichnung'] ||
            'Unbekanntes Produkt';

          productData.productName = produktname;

          const token = localStorage.getItem('supabase_token');
          const response = await fetch('/api/generate-description', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              extractedData: [{ extractedText: JSON.stringify(productData) }],
              customAttributes: { exactProductName: produktname },
            }),
          });

          if (!response.ok) {
            throw new Error(`API request failed (${response.status})`);
          }

          const payload = await response.json();
          const plainText = stripHtml(payload.description || '');
          const sentences = plainText
            .split('.')
            .filter((sentence) => sentence.trim().length > 10);
          const seoDesc = sentences[0]
            ? `${sentences[0].substring(0, 150)}${
                sentences[0].length > 150 ? '...' : ''
              }`
            : '';
          const shortDesc =
            sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');

          // MediaMarkt V1: Kategorie + Modell (z.B. "Werkzeugakku 2607336705")
          const kategorie = productData.kategorie || row['Kategorie'] || '';
          const artikelnummer = productData.artikelnummer || row['Artikelnummer'] || '';
          const mmNameV1 = `${kategorie} ${artikelnummer}`.trim();

          // MediaMarkt V2: Nur Artikelnummer/Modell
          const mmNameV2 = artikelnummer;

          return {
            id: globalIndex + 1,
            artikelnummer:
              productData.modell ||
              productData.artikelnummer ||
              productData.sku ||
              '-',
            produktname: produktname,
            produktbeschreibung: payload.description || '',
            mediamarktname_v1: mmNameV1.substring(0, 60),
            mediamarktname_v2: mmNameV2.substring(0, 40),
            seo_beschreibung: seoDesc,
            kurzbeschreibung: shortDesc.substring(0, 300),
          } satisfies BulkProduct;
        })
      );

      settled.forEach((outcome, batchIndex) => {
        const globalIndex = i + batchIndex;
        processedCount += 1;
        setProgress(Math.round((processedCount / total) * 100));

        if (outcome.status === 'fulfilled') {
          results[globalIndex] = outcome.value;
        } else {
          console.error(`Error processing row ${globalIndex}:`, outcome.reason);
          results[globalIndex] = {
            id: globalIndex + 1,
            artikelnummer: '-',
            produktname: 'Fehler',
            produktbeschreibung: '',
            mediamarktname_v1: '',
            mediamarktname_v2: '',
            seo_beschreibung: '',
            kurzbeschreibung: '',
          } satisfies BulkProduct;
        }
      });
    }

    const completedResults = results.filter(Boolean) as BulkProduct[];
    setBulkProducts(completedResults);
    setSuccessMessage(`${completedResults.length} Produkte erfolgreich verarbeitet`);
    setProgress(100);
    setProcessing(false);
  };

  const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    try {
      const selectedColumns = exportColumns.filter(col => col.enabled);
      
      const headers = selectedColumns.map(col => col.label);
      const rows = bulkProducts.map(product => {
        return selectedColumns.map(col => {
          const value = product[col.key as keyof BulkProduct];
          return typeof value === 'string' ? value : String(value);
        });
      });

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `produktbeschreibungen_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export erfolgreich",
        description: "CSV-Datei wurde heruntergeladen",
      });
    } catch (err) {
      setError('Fehler beim Herunterladen der CSV-Datei');
    }
  };

  const toggleColumn = (key: string) => {
    setExportColumns(prev => 
      prev.map(col => col.key === key ? { ...col, enabled: !col.enabled } : col)
    );
  };

  const toggleAllColumns = (enabled: boolean) => {
    setExportColumns(prev => prev.map(col => ({ ...col, enabled })));
  };

  const handleUpdateProduct = (id: number, field: keyof BulkProduct, value: string) => {
    setBulkProducts(prev =>
      prev.map(product =>
        product.id === id ? { ...product, [field]: value } : product
      )
    );
  };

  const reset = () => {
    setFile(null);
    setRawData([]);
    setBulkProducts([]);
    setError("");
    setSuccessMessage("");
    setProgress(0);
    
    // SessionStorage leeren
    sessionStorage.removeItem(SESSION_KEY_PRODUCTS);
    sessionStorage.removeItem(SESSION_KEY_RAW_DATA);
    sessionStorage.removeItem(SESSION_KEY_FILE_NAME);
  };

  const handleSaveToProject = async () => {
    // Wenn neues Projekt: Projektname erforderlich
    if (selectedProjectId === "new" && !projectName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Projektnamen ein",
        variant: "destructive",
      });
      return;
    }

    // Wenn bestehendes Projekt: Projekt muss ausgewählt sein
    if (selectedProjectId !== "new" && !selectedProjectId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Projekt aus",
        variant: "destructive",
      });
      return;
    }

    setSavingProject(true);
    try {
      if (selectedProjectId === "new") {
        // Neues Projekt erstellen
        const response = await fetch('/api/bulk-save-to-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            projectName: projectName.trim(),
            products: bulkProducts,
          }),
        });

        if (!response.ok) {
          throw new Error('Fehler beim Speichern des Projekts');
        }

        const data = await response.json();
        
        toast({
          title: "Projekt gespeichert",
          description: `${data.productCount} Produkte wurden erfolgreich in "${projectName}" gespeichert`,
        });
      } else {
        // Zu bestehendem Projekt hinzufügen
        const savedCount = await addProductsToExistingProject(selectedProjectId, bulkProducts);
        const project = existingProjects.find(p => p.id === selectedProjectId);
        
        toast({
          title: "Produkte hinzugefügt",
          description: `${savedCount} Produkte wurden erfolgreich zu "${project?.name}" hinzugefügt`,
        });
      }

      setShowSaveDialog(false);
      setProjectName("");
      setSelectedProjectId("new");
      
      // Weiterleitung zu Projekten nach 1 Sekunde
      setTimeout(() => {
        setLocation('/projects');
      }, 1000);
      
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : 'Projekt konnte nicht gespeichert werden',
        variant: "destructive",
      });
    } finally {
      setSavingProject(false);
    }
  };

  const addProductsToExistingProject = async (projectId: string, products: BulkProduct[]): Promise<number> => {
    let savedCount = 0;
    for (const product of products) {
      const productData = {
        name: product.produktname || 'Unbekanntes Produkt',
        articleNumber: product.artikelnummer || '',
        htmlCode: product.produktbeschreibung || '',
        previewText: product.seo_beschreibung || product.kurzbeschreibung || '',
        exactProductName: product.mediamarktname_v1 || product.mediamarktname_v2 || product.produktname || '',
        customAttributes: [
          { key: 'mediamarktname_v1', value: product.mediamarktname_v1 || '', type: 'text' },
          { key: 'mediamarktname_v2', value: product.mediamarktname_v2 || '', type: 'text' },
          { key: 'seo_beschreibung', value: product.seo_beschreibung || '', type: 'text' },
          { key: 'kurzbeschreibung', value: product.kurzbeschreibung || '', type: 'text' },
        ],
      };

      const response = await fetch(`/api/projects/${projectId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(productData),
      });

      if (response.ok) {
        savedCount++;
      } else {
        const errorText = await response.text();
        console.error('Failed to save product:', errorText);
      }
    }
    return savedCount;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-card-border shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            PIMPilot
          </h1>
          <p className="text-sm text-muted-foreground">
            Automatische PIM-Daten Generierung • AI-gestützte Produktbeschreibungen • MediaMarkt-konforme Titel • CSV Massenverarbeitung
          </p>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {error && (
          <Alert className="mb-6 bg-destructive/10 border-destructive text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-6 bg-chart-2/10 border-chart-2 text-chart-2">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="ml-2">{successMessage}</AlertDescription>
          </Alert>
        )}

        {!file && !processing && bulkProducts.length === 0 && (
          <Card
            className={`p-8 transition-colors ${
              isDragging ? 'border-primary bg-accent/50' : ''
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex flex-col items-center justify-center gap-6 min-h-[400px]">
              <div className="p-6 rounded-full bg-primary/10">
                <Upload className="w-12 h-12 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  CSV-Datei hochladen
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Laden Sie Ihre Produktdaten-CSV hoch und generieren Sie automatisch vollständige PIM-Attribute mit AI
                </p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button asChild size="lg">
                  <span className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Datei auswählen
                  </span>
                </Button>
              </label>
            </div>
          </Card>
        )}

        {/* Schritt 1 & 2: CSV eingelesen - zeige Rohdaten + Live-Updates während AI-Generierung */}
        {rawData.length > 0 && bulkProducts.length < rawData.length && (
          <div className="space-y-6">
            {/* Button Card (nur wenn noch nicht gestartet) */}
            {!processing && bulkProducts.length === 0 && (
              <Card className="p-8">
                <div className="flex flex-col items-center justify-center gap-6">
                  <CheckCircle2 className="w-16 h-16 text-chart-2" />
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">
                      CSV erfolgreich eingelesen
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      {rawData.length} Produkte bereit zur Verarbeitung
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={startAIGeneration}
                    className="px-8 py-6 text-lg"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    AI Beschreibungen generieren ({rawData.length} Produkte)
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Die AI-Generierung benötigt ca. {Math.round(rawData.length * 8 / 60)} Minuten
                  </p>
                </div>
              </Card>
            )}

            {/* Progress Bar während Generierung */}
            {processing && (
              <Card className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          PIM-Daten werden generiert...
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {bulkProducts.length} von {rawData.length} Produkten fertig ({progress}%)
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* CSV Rohdaten Vorschau mit Live KI-Updates */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                CSV Vorschau ({rawData.length} Zeilen) + KI-Felder {processing && '🔄'}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted">
                      {/* CSV Spalten */}
                      {Object.keys(rawData[0] || {}).map((header) => (
                        <th
                          key={header}
                          className="px-4 py-3 text-left text-xs font-semibold text-foreground border-b border-border whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                      {/* KI-generierte Spalten */}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-primary border-b border-border whitespace-nowrap bg-primary/10">
                        🤖 MediaMarkt V1
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-primary border-b border-border whitespace-nowrap bg-primary/10">
                        🤖 MediaMarkt V2
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-primary border-b border-border whitespace-nowrap bg-primary/10">
                        🤖 SEO Titel
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-primary border-b border-border whitespace-nowrap bg-primary/10">
                        🤖 SEO Produktbeschreibung
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-primary border-b border-border whitespace-nowrap bg-primary/10">
                        🤖 SEO Keywords
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.slice(0, 10).map((row, index) => {
                      // Finde entsprechendes generiertes Produkt (falls bereits generiert)
                      const generatedProduct = bulkProducts.find(p => p.id === index + 1);
                      
                      return (
                        <tr
                          key={index}
                          className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                        >
                          {/* CSV Daten */}
                          {Object.values(row).map((value, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-4 py-3 text-xs text-foreground border-b border-border"
                            >
                              {value || '-'}
                            </td>
                          ))}
                          {/* KI-Spalten (live update wenn generiert) */}
                          <td className="px-4 py-3 text-xs border-b border-border bg-primary/5">
                            {generatedProduct ? (
                              <span className="text-foreground font-medium">{generatedProduct.mediamarktname_v1}</span>
                            ) : (
                              <span className="text-muted-foreground italic">wird generiert...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs border-b border-border bg-primary/5">
                            {generatedProduct ? (
                              <span className="text-foreground font-medium">{generatedProduct.mediamarktname_v2}</span>
                            ) : (
                              <span className="text-muted-foreground italic">wird generiert...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs border-b border-border bg-primary/5">
                            {generatedProduct ? (
                              <span className="text-foreground font-medium line-clamp-1">{generatedProduct.produktname}</span>
                            ) : (
                              <span className="text-muted-foreground italic">wird generiert...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs border-b border-border bg-primary/5">
                            {generatedProduct ? (
                              <span className="text-foreground line-clamp-2">{generatedProduct.seo_beschreibung}</span>
                            ) : (
                              <span className="text-muted-foreground italic">wird generiert...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs border-b border-border bg-primary/5">
                            {generatedProduct ? (
                              <span className="text-foreground line-clamp-1">{generatedProduct.kurzbeschreibung}</span>
                            ) : (
                              <span className="text-muted-foreground italic">wird generiert...</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rawData.length > 10 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Zeige erste 10 von {rawData.length} Zeilen
                </p>
              )}
              <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <strong>KI-Felder (blau markiert)</strong> werden {processing ? 'live befüllt' : 'nach Klick auf "AI Beschreibungen generieren" automatisch befüllt'}
                </p>
              </div>
            </Card>
          </div>
        )}

        {bulkProducts.length > 0 && !processing && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Verarbeitete Produkte</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{bulkProducts.length}</span> • 
                    Dateiname: <span className="font-mono text-xs">{file?.name}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                  >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Spalten auswählen
                  </Button>
                  <Button
                    onClick={() => setShowSaveDialog(true)}
                    disabled={bulkProducts.length === 0}
                    size="sm"
                    variant="default"
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Als Projekt speichern
                  </Button>
                  <Button
                    onClick={handleDownload}
                    disabled={bulkProducts.length === 0}
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV Exportieren
                  </Button>
                  <Button
                    variant="outline"
                    onClick={reset}
                    size="sm"
                  >
                    Zurücksetzen
                  </Button>
                </div>
              </div>

              {showColumnSelector && (
                <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Spalten für Export auswählen</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAllColumns(true)}
                      >
                        Alle auswählen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAllColumns(false)}
                      >
                        Alle abwählen
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {exportColumns.map(col => (
                      <div key={col.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`col-${col.key}`}
                          checked={col.enabled}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        <Label
                          htmlFor={`col-${col.key}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {col.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <BulkDescriptionTable
              products={bulkProducts}
              onUpdateProduct={handleUpdateProduct}
              onPreviewHtml={(html) => {
                setHtmlPreviewContent(html);
                setShowHtmlPreview(true);
              }}
            />
          </div>
        )}
      </main>

      {/* Dialog zum Projekt speichern */}
      <Dialog open={showSaveDialog} onOpenChange={(open) => {
        setShowSaveDialog(open);
        if (!open) {
          setProjectName("");
          setSelectedProjectId("new");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Als Projekt speichern</DialogTitle>
            <DialogDescription>
              Speichern Sie alle {bulkProducts.length} Produkte in "Meine Projekte" für spätere Bearbeitung
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
                disabled={savingProject}
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
                  {existingProjects.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Bestehende Projekte
                      </div>
                      {existingProjects.map(project => (
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
                  placeholder="z.B. Akku-Import November 2024"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !savingProject) {
                      handleSaveToProject();
                    }
                  }}
                  disabled={savingProject}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveDialog(false);
                setProjectName("");
                setSelectedProjectId("new");
              }}
              disabled={savingProject}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveToProject}
              disabled={savingProject || (selectedProjectId === "new" && !projectName.trim())}
            >
              {savingProject ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichere...
                </>
              ) : selectedProjectId === "new" ? (
                <>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Projekt erstellen
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Zu Projekt hinzufügen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog für HTML-Vorschau */}
      <Dialog open={showHtmlPreview} onOpenChange={setShowHtmlPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>HTML Produktbeschreibung Vorschau</DialogTitle>
            <DialogDescription>
              So wird die Produktbeschreibung im MediaMarkt-System dargestellt
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] border rounded-lg p-6 bg-white">
            <div dangerouslySetInnerHTML={{ __html: htmlPreviewContent }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
