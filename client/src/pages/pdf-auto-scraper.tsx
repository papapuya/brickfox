import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PDFProduct {
  productName: string;
  url: string | null;
  articleNumber: string | null;
  eanCode: string | null;
  ekPrice: string | null;
  description: string | null;
  marke: string | null;
  ve: string | null;
  uevp: string | null;
}

interface ScrapeResult {
  success: boolean;
  totalExtracted: number;
  totalScraped: number;
  products: any[];
  errors?: Array<{ product: string; url?: string; error: string }>;
}

export default function PDFAutoScraper() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const { data: projectsData } = useQuery<{ success: boolean; projects: any[] }>({
    queryKey: ['/api/projects'],
  });

  const { data: suppliersData } = useQuery<{ success: boolean; suppliers: any[] }>({
    queryKey: ['/api/suppliers'],
  });

  const projects = projectsData?.projects || [];
  const suppliers = suppliersData?.suppliers || [];

  const uploadWithProgress = async (file: File) => {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('projectId', selectedProject);
    if (selectedSupplier) {
      formData.append('supplierId', selectedSupplier);
    }

    const response = await fetch('/api/pdf/upload-and-scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token')}`,
      },
      body: formData,
      credentials: 'include',
    });

    if (!response.ok || !response.body) {
      throw new Error('Upload fehlgeschlagen');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.stage === 'extracting') {
            setProgressMessage(data.message);
            setProgress(10);
          } else if (data.stage === 'extracted') {
            setProgressMessage(data.message);
            setProgress(20);
          } else if (data.stage === 'scraping') {
            setProgressMessage(`${data.message} - ${data.currentProduct}`);
            setProgress(20 + (data.progress * 0.75)); // 20-95%
          } else if (data.stage === 'complete') {
            setProgress(100);
            setProgressMessage(data.message);
            setScrapeResult(data);
            
            toast({
              title: 'PDF verarbeitet!',
              description: `${data.totalScraped} von ${data.totalExtracted} Produkten erfolgreich gescraped`,
            });
            
            setTimeout(() => {
              setIsProcessing(false);
              setProgress(0);
              setProgressMessage('');
            }, 1500);
          } else if (data.stage === 'error') {
            throw new Error(data.error || 'Fehler beim Verarbeiten');
          }
        }
      }
    }
  };

  const uploadMutation = useMutation({
    mutationFn: uploadWithProgress,
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage('');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Ungültiger Dateityp',
          description: 'Bitte wählen Sie eine PDF-Datei',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      setScrapeResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'Keine Datei ausgewählt',
        description: 'Bitte wählen Sie eine PDF-Datei',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedProject) {
      toast({
        title: 'Kein Projekt ausgewählt',
        description: 'Bitte wählen Sie ein Projekt',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    uploadMutation.mutate(selectedFile);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">PDF Auto-Scraper</h1>
        <p className="text-muted-foreground">
          Laden Sie eine Lieferanten-PDF hoch, um automatisch Produktdaten zu extrahieren und URLs zu scrapen
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>PDF hochladen</CardTitle>
            <CardDescription>
              Lieferanten-PDF mit anklickbaren Produkt-URLs und EK-Preisen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="project">Projekt auswählen *</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Projekt auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">Lieferant (optional)</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Lieferant auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Wenn ein Lieferant ausgewählt ist, werden dessen gespeicherte CSS-Selektoren verwendet
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf">PDF-Datei</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pdf"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                  />
                  {selectedFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      {selectedFile.name}
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedProject || isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verarbeite PDF...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    PDF hochladen & scrapen
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isProcessing && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{progressMessage || 'Verarbeite PDF...'}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {scrapeResult && (
          <Card>
            <CardHeader>
              <CardTitle>Ergebnisse</CardTitle>
              <CardDescription>
                {scrapeResult.totalScraped} von {scrapeResult.totalExtracted} Produkten erfolgreich gescraped
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{scrapeResult.totalExtracted}</div>
                  <div className="text-sm text-muted-foreground">Extrahiert</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-green-50">
                  <div className="text-2xl font-bold text-green-600">{scrapeResult.totalScraped}</div>
                  <div className="text-sm text-muted-foreground">Erfolgreich</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-red-50">
                  <div className="text-2xl font-bold text-red-600">
                    {scrapeResult.errors?.length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Fehler</div>
                </div>
              </div>

              {scrapeResult.errors && scrapeResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">Fehler beim Scrapen:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {scrapeResult.errors.slice(0, 5).map((error, idx) => (
                        <li key={idx} className="text-sm">
                          {error.product}: {error.error}
                        </li>
                      ))}
                      {scrapeResult.errors.length > 5 && (
                        <li className="text-sm">
                          ... und {scrapeResult.errors.length - 5} weitere Fehler
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <h3 className="font-semibold">Gescrapte Produkte:</h3>
                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Produktname</th>
                        <th className="p-2 text-left">Artikel-Nr.</th>
                        <th className="p-2 text-left">EAN</th>
                        <th className="p-2 text-left">EK-Preis</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scrapeResult.products.map((product, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{product.productName || '-'}</td>
                          <td className="p-2">{product.pdfArticleNumber || product.articleNumber || '-'}</td>
                          <td className="p-2">{product.pdfEanCode || product.ean || '-'}</td>
                          <td className="p-2">{product.ekPrice || '-'}</td>
                          <td className="p-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  Die Produkte wurden erfolgreich in Ihr Projekt "{selectedProject}" importiert.
                  Sie können diese nun im Projekt bearbeiten und weiterverarbeiten.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
