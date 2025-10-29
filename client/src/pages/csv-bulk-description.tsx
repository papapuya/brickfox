import { useState, useEffect } from "react";
import { Upload, Download, FileText, CheckCircle2, Loader2, AlertTriangle, Settings2, FolderPlus } from "lucide-react";
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

      // Generiere Produktbeschreibungen
      await generateDescriptions(parseResult.data);
      
    } catch (err) {
      console.error('Verarbeitungsfehler:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Verarbeiten der Datei');
      setProcessing(false);
    }
  };

  const generateDescriptions = async (data: RawCSVRow[]) => {
    const results: BulkProduct[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      setProgress(Math.round(((i + 1) / data.length) * 100));

      try {
        // Erstelle Produktdaten-Objekt
        const productData: any = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
          productData[normalizedKey] = row[key];
        });

        // Produktname extrahieren
        const produktname = productData.produktname || row['Produktname'] || row['produktname'] || 'Unbekanntes Produkt';
        productData.productName = produktname;

        // API-Aufruf für Beschreibungsgenerierung
        const response = await fetch('/api/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extractedData: [{ extractedText: JSON.stringify(productData) }],
            customAttributes: {
              exactProductName: produktname,
            },
          }),
        });

        const result = await response.json();
        
        // Generiere SEO-Beschreibung und Kurzbeschreibung aus dem Text
        const plainText = stripHtml(result.description || '');
        const sentences = plainText.split('.').filter((s: string) => s.trim().length > 10);
        const seoDesc = sentences[0] ? sentences[0].substring(0, 150) + (sentences[0].length > 150 ? '...' : '') : '';
        const shortDesc = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');
        
        // Generiere MediaMarkt-Namen
        const capacity = productData.capacity_mah || productData['kapazität_mah'] || productData.capacity || '';
        const voltage = productData.voltage || productData.spannung || '';
        const model = productData.model || productData.modell || '';
        
        const mmNameV1 = `Akku ${model} ${capacity ? capacity + ' mAh' : ''} ${voltage ? voltage + 'V' : ''}`.trim();
        const mmNameV2 = `${model} ${capacity ? capacity + 'mAh' : ''}`.trim();
        
        results.push({
          id: i + 1,
          artikelnummer: productData.modell || productData.artikelnummer || productData.sku || '-',
          produktname: produktname,
          produktbeschreibung: result.description || '',
          mediamarktname_v1: mmNameV1.substring(0, 60),
          mediamarktname_v2: mmNameV2.substring(0, 40),
          seo_beschreibung: seoDesc,
          kurzbeschreibung: shortDesc.substring(0, 300),
        });
      } catch (err) {
        console.error(`Error processing row ${i}:`, err);
        results.push({
          id: i + 1,
          artikelnummer: '-',
          produktname: 'Fehler',
          produktbeschreibung: '',
          mediamarktname_v1: '',
          mediamarktname_v2: '',
          seo_beschreibung: '',
          kurzbeschreibung: '',
        });
      }
    }

    setBulkProducts(results);
    setSuccessMessage(`${results.length} Produkte erfolgreich verarbeitet`);
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
        body: JSON.stringify(productData),
      });

      if (response.ok) {
        savedCount++;
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

        {processing && (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center gap-6">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  PIM-Daten werden generiert...
                </h2>
                <p className="text-sm text-muted-foreground">
                  {progress}% abgeschlossen - AI generiert Produktbeschreibungen, SEO-Daten und MediaMarkt-Titel
                </p>
              </div>
              <div className="w-full max-w-md">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
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
    </div>
  );
}
