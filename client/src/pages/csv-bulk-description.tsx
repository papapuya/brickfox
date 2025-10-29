import { useState } from "react";
import { Upload, Download, FileText, CheckCircle2, Loader2, AlertTriangle, Play, DollarSign, Eye, Code, Copy, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseCSV } from "@/lib/csv-processor";
import type Papa from "papaparse";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface ColumnMapping {
  field: string;
  label: string;
  required: boolean;
  csvColumn: string;
  preview: string;
}

interface RawCSVRow {
  [key: string]: string;
}

interface ProcessedProduct {
  originalData: RawCSVRow;
  descriptionText?: string;
  descriptionHtml?: string;
  seoName?: string;
  seoDescription?: string;
  mediamarktNameV1?: string;
  mediamarktNameV2?: string;
  shortDescription?: string;
  usps?: string[];
}

export default function CSVBulkDescription() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<RawCSVRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedProduct[]>([]);
  const [processing, setProcessing] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<'upload' | 'configure' | 'processing' | 'results'>('upload');
  const [progress, setProgress] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  
  // PIM-Attribute Selection
  const [selectedPimFields, setSelectedPimFields] = useState({
    seoName: true,
    seoDescription: true,
    shortDescription: true,
    mediamarktNameV1: true,
    mediamarktNameV2: true,
    productDescription: true,
  });

  const productFields: { field: string; label: string; required: boolean }[] = [
    { field: 'productName', label: 'Produktname', required: true },
    { field: 'model', label: 'Modell / Artikelnummer', required: false },
    { field: 'capacity_mah', label: 'Kapazität (mAh)', required: true },
    { field: 'capacity_wh', label: 'Kapazität (Wh)', required: false },
    { field: 'voltage', label: 'Spannung (V)', required: true },
    { field: 'type', label: 'Typ', required: false },
    { field: 'chemistry', label: 'Zusammensetzung (Chemie)', required: false },
    { field: 'protection', label: 'Schutzschaltung', required: false },
    { field: 'diameter', label: 'Durchmesser (mm)', required: false },
    { field: 'length', label: 'Länge (mm)', required: false },
    { field: 'width', label: 'Breite (mm)', required: false },
    { field: 'height', label: 'Höhe (mm)', required: false },
    { field: 'weight', label: 'Gewicht (g)', required: false },
    { field: 'rechargeable', label: 'Wiederaufladbar', required: false },
    { field: 'connection_type', label: 'Anschlussart', required: false },
    { field: 'plus_pole', label: 'Plus Pol', required: false },
  ];

  const autoMapColumn = (field: string, columns: string[]): string => {
    const mappings: { [key: string]: string[] } = {
      productName: ['produktname', 'product name', 'name', 'titel', 'title', 'p_name', 'seo name'],
      model: ['modell', 'model', 'artikelnummer', 'sku', 'item number', 'p_item_number'],
      capacity_mah: ['kapazität mah', 'capacity mah', 'kapazitaet', 'mah', 'kapazität', 'capacity'],
      capacity_wh: ['kapazität wh', 'capacity wh', 'wh'],
      voltage: ['spannung', 'voltage', 'volt', 'spannung v', 'v'],
      type: ['typ', 'type', 'produkttyp'],
      chemistry: ['chemie', 'chemistry', 'zusammensetzung', 'technologie', 'composition'],
      protection: ['schutzschaltung', 'protection', 'bms', 'pcb', 'schutzelektronik'],
      diameter: ['durchmesser', 'diameter', 'ø', 'durchmesser mm'],
      length: ['länge', 'length', 'laenge', 'länge mm'],
      width: ['breite', 'width', 'breite mm'],
      height: ['höhe', 'height', 'hoehe', 'höhe mm'],
      weight: ['gewicht', 'weight', 'masse'],
      rechargeable: ['wiederaufladbar', 'rechargeable', 'aufladbar'],
      connection_type: ['anschlussart', 'connection'],
      plus_pole: ['plus pol', 'pole', 'plus'],
    };

    const possibleNames = mappings[field] || [];
    
    for (const name of possibleNames) {
      const match = columns.find(col => 
        col.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(col.toLowerCase())
      );
      if (match) return match;
    }
    
    return '';
  };

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setError("");
    setSuccessMessage("");

    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      setError('Bitte wählen Sie eine gültige CSV-Datei aus.');
      return;
    }

    try {
      setProcessing(true);
      const parseResult = await parseCSV(selectedFile);
      
      if (parseResult.data.length === 0) {
        setError('Die CSV-Datei enthält keine gültigen Daten.');
        setProcessing(false);
        return;
      }

      const columns = Object.keys(parseResult.data[0]);
      setCsvColumns(columns);
      setRawData(parseResult.data);

      const mappings: ColumnMapping[] = productFields.map(field => {
        const csvColumn = autoMapColumn(field.field, columns);
        const preview = csvColumn && parseResult.data[0] 
          ? parseResult.data[0][csvColumn] || '' 
          : '';
        
        return {
          field: field.field,
          label: field.label,
          required: field.required,
          csvColumn,
          preview: preview.substring(0, 50),
        };
      });

      setColumnMappings(mappings);
      setEstimatedCost(parseResult.data.length * 0.013);
      setCurrentStep('configure');
      setSuccessMessage(`${parseResult.data.length} Produkte gefunden. Bitte Spalten-Zuordnung prüfen.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Verarbeiten der Datei');
    } finally {
      setProcessing(false);
    }
  };

  const updateMapping = (field: string, csvColumn: string) => {
    setColumnMappings(prev => 
      prev.map(m => {
        if (m.field === field) {
          const preview = csvColumn && rawData[0] ? rawData[0][csvColumn] || '' : '';
          return { ...m, csvColumn, preview: preview.substring(0, 50) };
        }
        return m;
      })
    );
  };

  const validateMappings = (): boolean => {
    const requiredMappings = columnMappings.filter(m => m.required);
    const missingRequired = requiredMappings.filter(m => !m.csvColumn);
    
    if (missingRequired.length > 0) {
      setError(`Pflichtfelder fehlen: ${missingRequired.map(m => m.label).join(', ')}`);
      return false;
    }
    
    return true;
  };

  const startGeneration = async () => {
    if (!validateMappings()) return;

    setCurrentStep('processing');
    setProcessing(true);
    setProgress(0);

    const results: ProcessedProduct[] = [];
    
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      const productData: any = {};
      columnMappings.forEach(mapping => {
        if (mapping.csvColumn) {
          productData[mapping.field] = row[mapping.csvColumn];
        }
      });

      try {
        // Sende als strukturiertes Objekt für modulares Subprompt-System
        const response = await fetch('/api/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extractedData: [productData], // Als Objekt, nicht als String
            customAttributes: {
              exactProductName: productData.productName || '',
            },
          }),
        });

        const result = await response.json();
        
        // Generiere SEO-Beschreibung und Kurzbeschreibung aus dem Text
        const plainText = stripHtml(result.description || '');
        const sentences = plainText.split('.').filter(s => s.trim().length > 10);
        const seoDesc = sentences[0] ? sentences[0].substring(0, 150) + (sentences[0].length > 150 ? '...' : '') : '';
        const shortDesc = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');
        
        // Generiere MediaMarkt-Namen
        const capacity = productData.capacity_mah || productData.capacity || '';
        const voltage = productData.voltage || '';
        const model = productData.model || '';
        
        const mmNameV1 = `Akku ${model} ${capacity ? capacity + ' mAh' : ''} ${voltage ? voltage + 'V' : ''}`.trim();
        const mmNameV2 = `${model} ${capacity ? capacity + 'mAh' : ''}`.trim();
        
        results.push({
          originalData: row,
          descriptionHtml: result.description || '',
          descriptionText: plainText,
          seoName: productData.productName || '',
          seoDescription: seoDesc,
          shortDescription: shortDesc.substring(0, 300),
          mediamarktNameV1: mmNameV1.substring(0, 60),
          mediamarktNameV2: mmNameV2.substring(0, 40),
        });
      } catch (err) {
        results.push({
          originalData: row,
          descriptionHtml: '',
          descriptionText: 'Fehler bei Generierung',
        });
      }

      setProgress(Math.round(((i + 1) / rawData.length) * 100));
    }

    setProcessedData(results);
    setProcessing(false);
    setCurrentStep('results');
    setSuccessMessage(`${results.length} Produktbeschreibungen erfolgreich generiert!`);
  };

  const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const exportToCSV = () => {
    // Dynamische Headers basierend auf Auswahl
    const pimHeaders: string[] = [];
    if (selectedPimFields.seoName) pimHeaders.push('SEO_Name');
    if (selectedPimFields.seoDescription) pimHeaders.push('SEO_Beschreibung');
    if (selectedPimFields.shortDescription) pimHeaders.push('Kurzbeschreibung');
    if (selectedPimFields.mediamarktNameV1) pimHeaders.push('Mediamarktname_V1');
    if (selectedPimFields.mediamarktNameV2) pimHeaders.push('Mediamarktname_V2');
    if (selectedPimFields.productDescription) pimHeaders.push('Produktbeschreibung_HTML');
    
    const headers = [
      ...csvColumns,
      ...pimHeaders
    ];
    
    const rows = processedData.map(product => {
      const originalValues = csvColumns.map(col => product.originalData[col] || '');
      const pimValues: string[] = [];
      if (selectedPimFields.seoName) pimValues.push(product.seoName || '');
      if (selectedPimFields.seoDescription) pimValues.push(product.seoDescription || '');
      if (selectedPimFields.shortDescription) pimValues.push(product.shortDescription || '');
      if (selectedPimFields.mediamarktNameV1) pimValues.push(product.mediamarktNameV1 || '');
      if (selectedPimFields.mediamarktNameV2) pimValues.push(product.mediamarktNameV2 || '');
      if (selectedPimFields.productDescription) pimValues.push(product.descriptionHtml || '');
      
      return [
        ...originalValues,
        ...pimValues
      ];
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
  };

  const reset = () => {
    setFile(null);
    setRawData([]);
    setCsvColumns([]);
    setColumnMappings([]);
    setProcessedData([]);
    setError("");
    setSuccessMessage("");
    setCurrentStep('upload');
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-card-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            CSV Bulk Description Generator
          </h1>
          <p className="text-sm text-muted-foreground">
            Massenverarbeitung von Produktbeschreibungen • AI-generiert • CSV-basiert
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
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

        {currentStep === 'upload' && (
          <Card className="p-6">
            <div className="min-h-64 border-2 border-dashed rounded-md border-border hover:border-primary/50 hover:bg-accent/30 flex flex-col items-center justify-center gap-4">
              <Upload className="w-16 h-16 text-muted-foreground" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">CSV-Datei hochladen</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Laden Sie Ihre CSV-Datei mit Produktdaten hoch (max. 10.000 Zeilen)
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

        {currentStep === 'configure' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">Spalten-Konfiguration</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {rawData.length} Produkte • Geschätzte Kosten: ${estimatedCost.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset}>
                    Abbrechen
                  </Button>
                  <Button onClick={startGeneration} className="gap-2">
                    <Play className="w-4 h-4" />
                    Generierung starten
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">
                    1. CSV-Vorschau
                  </h3>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-4">
                      Hochgeladene Datei: <strong>{file?.name}</strong> • {rawData.length} Produkte
                    </p>
                    <div className="overflow-x-auto border rounded-md bg-background">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            {csvColumns.slice(0, 6).map((col, idx) => (
                              <th key={idx} className="px-3 py-2 text-left font-medium text-muted-foreground">
                                {col}
                              </th>
                            ))}
                            {csvColumns.length > 6 && (
                              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                +{csvColumns.length - 6} weitere
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {rawData.slice(0, 3).map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b last:border-0 hover:bg-muted/20">
                              {csvColumns.slice(0, 6).map((col, colIdx) => (
                                <td key={colIdx} className="px-3 py-2 max-w-[200px] truncate">
                                  {row[col] || '-'}
                                </td>
                              ))}
                              {csvColumns.length > 6 && (
                                <td className="px-3 py-2 text-muted-foreground">...</td>
                              )}
                            </tr>
                          ))}
                          {rawData.length > 3 && (
                            <tr>
                              <td colSpan={Math.min(csvColumns.length, 7)} className="px-3 py-2 text-center text-muted-foreground text-xs">
                                ... und {rawData.length - 3} weitere Produkte
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      2. Grunddaten (Custom Attributes)
                    </h3>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-6">
                      {processedData.length > 0 
                        ? `Vorschau des ersten generierten Produkts (${processedData[0].seoName}):` 
                        : 'Konfigurieren Sie die Attribute, die automatisch generiert werden sollen'
                      }
                    </p>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="pim-seoName"
                            checked={selectedPimFields.seoName}
                            onChange={(e) => setSelectedPimFields({...selectedPimFields, seoName: e.target.checked})}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <Label htmlFor="pim-seoName" className="text-sm font-medium cursor-pointer">
                            Produktname
                          </Label>
                        </div>
                        <input
                          type="text"
                          value={processedData.length > 0 ? processedData[0].seoName || '' : ''}
                          placeholder="Wird automatisch aus CSV übernommen"
                          className="w-full px-3 py-2 border rounded-md bg-muted/50 text-sm"
                          readOnly
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="pim-mmv1"
                            checked={selectedPimFields.mediamarktNameV1}
                            onChange={(e) => setSelectedPimFields({...selectedPimFields, mediamarktNameV1: e.target.checked})}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <Label htmlFor="pim-mmv1" className="text-sm font-medium cursor-pointer">
                            Mediamarktname V1
                          </Label>
                        </div>
                        <input
                          type="text"
                          value={processedData.length > 0 ? processedData[0].mediamarktNameV1 || '' : ''}
                          placeholder="Wird automatisch generiert (z.B. Akku 16340 950 mAh 3.7V)"
                          className="w-full px-3 py-2 border rounded-md bg-muted/50 text-sm"
                          readOnly
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="pim-mmv2"
                            checked={selectedPimFields.mediamarktNameV2}
                            onChange={(e) => setSelectedPimFields({...selectedPimFields, mediamarktNameV2: e.target.checked})}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <Label htmlFor="pim-mmv2" className="text-sm font-medium cursor-pointer">
                            Mediamarktname V2
                          </Label>
                        </div>
                        <input
                          type="text"
                          value={processedData.length > 0 ? processedData[0].mediamarktNameV2 || '' : ''}
                          placeholder="Wird automatisch generiert (z.B. 16340 950mAh)"
                          className="w-full px-3 py-2 border rounded-md bg-muted/50 text-sm"
                          readOnly
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="pim-seoDescription"
                            checked={selectedPimFields.seoDescription}
                            onChange={(e) => setSelectedPimFields({...selectedPimFields, seoDescription: e.target.checked})}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <Label htmlFor="pim-seoDescription" className="text-sm font-medium cursor-pointer">
                            SEO Beschreibung
                          </Label>
                        </div>
                        <textarea
                          value={processedData.length > 0 ? processedData[0].seoDescription || '' : ''}
                          placeholder="Wird automatisch generiert (erste 150 Zeichen der Produktbeschreibung)"
                          className="w-full px-3 py-2 border rounded-md bg-muted/50 text-sm resize-none"
                          rows={2}
                          readOnly
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="pim-shortDescription"
                            checked={selectedPimFields.shortDescription}
                            onChange={(e) => setSelectedPimFields({...selectedPimFields, shortDescription: e.target.checked})}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <Label htmlFor="pim-shortDescription" className="text-sm font-medium cursor-pointer">
                            Kurzbeschreibung
                          </Label>
                        </div>
                        <textarea
                          value={processedData.length > 0 ? processedData[0].shortDescription || '' : ''}
                          placeholder="Wird automatisch generiert (erste 300 Zeichen für Produktlisten)"
                          className="w-full px-3 py-2 border rounded-md bg-muted/50 text-sm resize-none"
                          rows={3}
                          readOnly
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="pim-productDescription"
                            checked={selectedPimFields.productDescription}
                            onChange={(e) => setSelectedPimFields({...selectedPimFields, productDescription: e.target.checked})}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <Label htmlFor="pim-productDescription" className="text-sm font-medium cursor-pointer">
                            Produktbeschreibung
                          </Label>
                        </div>
                        <textarea
                          value={processedData.length > 0 ? processedData[0].descriptionHtml || '' : ''}
                          placeholder="Wird automatisch generiert (vollständige HTML-Produktbeschreibung im MediaMarkt-Format)"
                          className="w-full px-3 py-2 border rounded-md bg-muted/50 text-sm resize-none font-mono"
                          rows={5}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {currentStep === 'processing' && (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center gap-6">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Generiere Produktbeschreibungen...
                </h2>
                <p className="text-sm text-muted-foreground">
                  {progress}% abgeschlossen ({Math.round((progress / 100) * rawData.length)} von {rawData.length})
                </p>
              </div>
              <div className="w-full max-w-md">
                <Progress value={progress} className="h-3" />
              </div>
              <p className="text-xs text-muted-foreground">
                Geschätzte Zeit: {Math.round((rawData.length - (progress / 100) * rawData.length) * 3 / 60)} Minuten
              </p>
            </div>
          </Card>
        )}

        {currentStep === 'results' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Ergebnisse</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {processedData.length} Produktbeschreibungen generiert
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep('configure')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Zurück zu Spalten
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Neue Datei
                  </Button>
                  <Button onClick={exportToCSV} className="gap-2">
                    <Download className="w-4 h-4" />
                    CSV Exportieren
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              {processedData.map((product, index) => {
                const isExpanded = expandedProducts.has(index);
                
                return (
                  <Card key={index} className="overflow-hidden">
                    <div className="p-4 border-b bg-muted/30">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold">
                          {product.seoName || `Produkt ${index + 1}`}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newExpanded = new Set(expandedProducts);
                            if (isExpanded) {
                              newExpanded.delete(index);
                            } else {
                              newExpanded.add(index);
                            }
                            setExpandedProducts(newExpanded);
                          }}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4 mr-2" />
                              Einklappen
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4 mr-2" />
                              Details anzeigen
                            </>
                          )}
                        </Button>
                      </div>
                      {!isExpanded && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {product.descriptionText}
                        </p>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="p-6">
                        <Tabs defaultValue="preview" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="preview">
                              <Eye className="w-4 h-4 mr-2" />
                              Vorschau
                            </TabsTrigger>
                            <TabsTrigger value="html">
                              <Code className="w-4 h-4 mr-2" />
                              HTML-Code
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="preview" className="mt-4">
                            <div className="border rounded-md p-6 min-h-96 max-h-96 overflow-y-auto bg-background prose prose-sm max-w-none">
                              {product.descriptionHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
                              ) : (
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {product.descriptionText}
                                </div>
                              )}
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="html" className="mt-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">HTML-Code</Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(product.descriptionHtml || '');
                                    toast({
                                      title: "Kopiert!",
                                      description: "HTML-Code wurde in die Zwischenablage kopiert",
                                    });
                                  }}
                                  disabled={!product.descriptionHtml}
                                  className="h-8 px-3"
                                >
                                  <Copy className="w-4 h-4 mr-1" />
                                  Kopieren
                                </Button>
                              </div>
                              <textarea
                                value={product.descriptionHtml || 'Kein HTML-Code verfügbar'}
                                readOnly
                                className="w-full h-96 p-4 border rounded-md font-mono text-xs resize-none bg-muted/30"
                              />
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
