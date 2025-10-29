import { useState } from "react";
import { Upload, Download, FileText, CheckCircle2, XCircle, Loader2, AlertTriangle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Product } from "@shared/schema";
import { ProductTable } from "@/components/product-table";
import { parseCSV, enrichProducts, exportToCSV, type ExportColumn } from "@/lib/csv-processor";
import type Papa from "papaparse";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [enrichedData, setEnrichedData] = useState<Product[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [parseWarnings, setParseWarnings] = useState<Papa.ParseError[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>([
    { key: 'sku', label: 'Artikelnummer', enabled: true },
    { key: 'titel', label: 'Produktname_Brickfox', enabled: true },
    { key: 'titel_marktplatz', label: 'Produktname_MediaMarkt_V1', enabled: true },
    { key: 'titel_marktplatz_v2', label: 'Produktname_MediaMarkt_V2', enabled: true },
    { key: 'energiegehalt', label: 'Energiegehalt_W', enabled: true },
    { key: 'spannung', label: 'Spannung_V', enabled: true },
    { key: 'kapazitaet', label: 'Kapazitaet_mAh', enabled: true },
    { key: 'leistung', label: 'Leistung_Wh', enabled: true },
    { key: 'verpackungseinheit', label: 'Verpackungseinheit', enabled: true },
    { key: 'lieferumfang', label: 'Lieferumfang', enabled: true },
  ]);

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setError("");
    setSuccessMessage("");

    const fileName = selectedFile.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
      setError('Nur CSV-Dateien werden unterstützt. Bitte exportieren Sie Ihre Excel-Datei als CSV und laden Sie diese hoch.');
      return;
    }

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

    try {
      const parseResult = await parseCSV(fileToProcess);
      
      if (parseResult.data.length === 0) {
        setError('Die CSV-Datei enthält keine gültigen Daten.');
        setProcessing(false);
        return;
      }

      // Store warnings
      setParseWarnings(parseResult.warnings);

      const enriched = enrichProducts(parseResult.data);
      setEnrichedData(enriched);
      setSuccessMessage(`${enriched.length} Produkte erfolgreich verarbeitet`);
    } catch (err) {
      console.error('Verarbeitungsfehler:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Verarbeiten der Datei');
    } finally {
      setProcessing(false);
    }
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
      exportToCSV(enrichedData, selectedColumns);
      setSuccessMessage('CSV-Datei erfolgreich heruntergeladen');
      setTimeout(() => setSuccessMessage(''), 3000);
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

  const handleReset = () => {
    setFile(null);
    setEnrichedData([]);
    setError("");
    setSuccessMessage("");
    setParseWarnings([]);
    setShowWarnings(false);
  };

  const updateProduct = (id: number, field: keyof Product, value: string) => {
    setEnrichedData(prev =>
      prev.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-card-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            PIMPilot - CSV Produktdaten-Anreicherung
          </h1>
          <p className="text-sm text-muted-foreground">
            MediaMarkt-konforme Titel-Generierung (TTL/TTB) • Technische Daten-Extraktion • Inline-Bearbeitung • Flexibler CSV-Export
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Messages */}
        {error && (
          <Alert className="mb-6 bg-destructive/10 border-destructive text-destructive" data-testid="alert-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-6 bg-chart-2/10 border-chart-2 text-chart-2" data-testid="alert-success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="ml-2">{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Parse Warnings */}
        {parseWarnings.length > 0 && (
          <Card className="mb-6 p-4 border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-orange-900 dark:text-orange-100">
                    CSV-Parse-Warnungen: {parseWarnings.length} Probleme gefunden
                  </h3>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    Diese Warnungen betreffen problematische Zeilen in der CSV-Datei (z.B. zu viele oder zu wenige Spalten).
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWarnings(!showWarnings)}
                className="flex-shrink-0"
                data-testid="button-toggle-warnings"
              >
                {showWarnings ? 'Ausblenden' : 'Anzeigen'}
              </Button>
            </div>

            {showWarnings && (
              <div className="mt-4 max-h-96 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-orange-100 dark:bg-orange-900/40">
                    <tr className="border-b border-orange-300 dark:border-orange-700">
                      <th className="text-left p-2 font-semibold">Zeile</th>
                      <th className="text-left p-2 font-semibold">Typ</th>
                      <th className="text-left p-2 font-semibold">Nachricht</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseWarnings.map((warning, index) => (
                      <tr key={index} className="border-b border-orange-200 dark:border-orange-800">
                        <td className="p-2 font-mono">{warning.row !== undefined ? warning.row + 1 : 'N/A'}</td>
                        <td className="p-2">{warning.type}</td>
                        <td className="p-2 text-orange-800 dark:text-orange-200">{warning.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Upload Zone - Show when no data */}
        {enrichedData.length === 0 && !processing && (
          <Card className="p-6">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                min-h-64 border-2 border-dashed rounded-md transition-colors
                flex flex-col items-center justify-center gap-4
                ${isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-accent/30'
                }
              `}
              data-testid="dropzone-upload"
            >
              <Upload className="w-16 h-16 text-muted-foreground" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  CSV-Datei hochladen
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Ziehen Sie Ihre CSV-Datei hierher oder klicken Sie auf den Button unten
                </p>
              </div>

              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
                data-testid="input-file"
              />
              <label htmlFor="file-upload">
                <Button asChild size="lg" data-testid="button-upload">
                  <span className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Datei auswählen
                  </span>
                </Button>
              </label>

              <p className="text-xs text-muted-foreground">
                Nur CSV-Dateien (.csv) • Maximale Dateigröße: 10MB
              </p>
            </div>

            {/* Sample Format Info */}
            <div className="mt-6 p-4 bg-muted/50 rounded-md border border-border">
              <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-chart-2" />
                Unterstützte CSV-Formate:
              </h3>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Brickfox:</span> <span className="font-mono">p_item_number, p_name[de], p_description[de]</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Channel Engine:</span> <span className="font-mono">Shop SKU, Titel (DE), Produktbeschreibung (DE), Brand</span>
                </p>
                <p className="text-xs text-chart-2 font-medium mt-3">
                  ✓ Automatische Spaltenerkennung • Header-Zeilen werden gefiltert
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Processing State */}
        {processing && (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <h2 className="text-xl font-semibold text-foreground">
                Verarbeite Produktdaten...
              </h2>
              <p className="text-sm text-muted-foreground">
                Dies kann einige Sekunden dauern
              </p>
            </div>
          </Card>
        )}

        {/* Data Table View */}
        {enrichedData.length > 0 && !processing && (
          <div className="space-y-6">
            {/* Action Bar */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <p className="text-sm text-muted-foreground">Verarbeitete Produkte</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-product-count">
                      {enrichedData.length}
                    </p>
                  </div>

                  {file && (
                    <div>
                      <p className="text-sm text-muted-foreground">Dateiname</p>
                      <p className="text-sm font-mono text-foreground" data-testid="text-filename">
                        {file.name}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    size="lg"
                    className="gap-2"
                    data-testid="button-column-selector"
                  >
                    <Settings2 className="w-4 h-4" />
                    Spalten auswählen
                  </Button>
                  <Button 
                    onClick={handleDownload}
                    size="lg"
                    className="gap-2"
                    data-testid="button-download"
                  >
                    <Download className="w-4 h-4" />
                    CSV Exportieren
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                    className="gap-2"
                    data-testid="button-reset"
                  >
                    <XCircle className="w-4 h-4" />
                    Zurücksetzen
                  </Button>
                </div>
              </div>

              {/* Column Selector */}
              {showColumnSelector && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    Wählen Sie die Spalten für den Export:
                  </h3>
                  <div className="flex items-center gap-4 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllColumns(true)}
                      data-testid="button-select-all"
                    >
                      Alle auswählen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllColumns(false)}
                      data-testid="button-deselect-all"
                    >
                      Alle abwählen
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {exportColumns.filter(col => col.enabled).length} von {exportColumns.length} ausgewählt
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {exportColumns.map((column) => (
                      <div key={column.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`col-${column.key}`}
                          checked={column.enabled}
                          onCheckedChange={() => toggleColumn(column.key)}
                          data-testid={`checkbox-${column.key}`}
                        />
                        <Label
                          htmlFor={`col-${column.key}`}
                          className="text-sm cursor-pointer"
                        >
                          {column.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Product Data Table */}
            <ProductTable 
              products={enrichedData}
              onUpdateProduct={updateProduct}
            />
          </div>
        )}
      </main>
    </div>
  );
}
