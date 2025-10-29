import { useState } from "react";
import { Upload, Download, FileText, CheckCircle2, Loader2, AlertTriangle, Play, DollarSign } from "lucide-react";
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
  usps?: string[];
}

export default function CSVBulkDescription() {
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<RawCSVRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedProduct[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<'upload' | 'configure' | 'processing' | 'results'>('upload');
  const [progress, setProgress] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

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
      capacity_mah: ['kapazität mah', 'capacity mah', 'kapazitaet', 'mah'],
      capacity_wh: ['kapazität wh', 'capacity wh', 'wh'],
      voltage: ['spannung', 'voltage', 'volt', 'spannung v'],
      type: ['typ', 'type', 'produkttyp'],
      chemistry: ['chemie', 'chemistry', 'zusammensetzung', 'technologie'],
      protection: ['schutzschaltung', 'protection', 'bms', 'pcb'],
      diameter: ['durchmesser', 'diameter', 'ø'],
      length: ['länge', 'length', 'laenge'],
      width: ['breite', 'width'],
      height: ['höhe', 'height', 'hoehe'],
      weight: ['gewicht', 'weight'],
      rechargeable: ['wiederaufladbar', 'rechargeable'],
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
        const response = await fetch('/api/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extractedData: [JSON.stringify(productData)],
          }),
        });

        const result = await response.json();
        
        results.push({
          originalData: row,
          descriptionHtml: result.description || '',
          descriptionText: stripHtml(result.description || ''),
          seoName: productData.productName,
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
    const headers = [...csvColumns, 'Beschreibung_Text', 'Beschreibung_HTML'];
    const rows = processedData.map(product => {
      const originalValues = csvColumns.map(col => product.originalData[col] || '');
      return [...originalValues, product.descriptionText || '', product.descriptionHtml || ''];
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

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      So funktioniert die Spalten-Zuordnung
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Links:</strong> Das Feld, das die App benötigt (z.B. "Produktname")
                      <br />
                      <strong>Dropdown:</strong> Wählen Sie die passende Spalte aus Ihrer CSV-Datei aus
                      <br />
                      <strong>Rechts:</strong> Vorschau des Wertes aus der ersten Zeile
                      <br />
                      <span className="text-red-600 dark:text-red-400 font-medium">*</span> = Pflichtfeld (muss zugeordnet werden)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 items-center pb-2 border-b">
                  <div className="col-span-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Benötigtes Feld</p>
                  </div>
                  <div className="col-span-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Ihre CSV-Spalte</p>
                  </div>
                  <div className="col-span-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Vorschau</p>
                  </div>
                </div>
                {columnMappings.map(mapping => (
                  <div key={mapping.field} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <Label className="text-sm font-medium">
                        {mapping.label}
                        {mapping.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                    </div>
                    <div className="col-span-4">
                      <Select value={mapping.csvColumn || "__NONE__"} onValueChange={(value) => updateMapping(mapping.field, value === "__NONE__" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Nicht zugeordnet" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Nicht zugeordnet</SelectItem>
                          {csvColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5">
                      {mapping.preview && (
                        <p className="text-xs text-muted-foreground truncate">
                          Vorschau: "{mapping.preview}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
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

            <Card className="p-6">
              <div className="space-y-6 max-h-[600px] overflow-y-auto">
                {processedData.map((product, index) => (
                  <div key={index} className="border-b pb-6 last:border-0">
                    <h3 className="text-base font-semibold mb-3">
                      {product.seoName || `Produkt ${index + 1}`}
                    </h3>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {product.descriptionText}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
