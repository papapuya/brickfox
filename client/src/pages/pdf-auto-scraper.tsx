import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2, ExternalLink, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

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

interface PDFPreviewResult {
  success: boolean;
  totalProducts: number;
  products: PDFProduct[];
}

export default function PDFAutoScraper() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedProducts, setExtractedProducts] = useState<PDFProduct[]>([]);

  const extractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/pdf/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token')}`,
        },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('PDF-Verarbeitung fehlgeschlagen');
      }

      return response.json() as Promise<PDFPreviewResult>;
    },
    onSuccess: (data) => {
      setExtractedProducts(data.products);
      toast({
        title: 'PDF analysiert',
        description: `${data.totalProducts} Produkt-URLs erfolgreich extrahiert`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
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
      setExtractedProducts([]);
    }
  };

  const handleExtract = () => {
    if (!selectedFile) {
      toast({
        title: 'Keine Datei ausgewählt',
        description: 'Bitte wählen Sie eine PDF-Datei',
        variant: 'destructive',
      });
      return;
    }

    extractMutation.mutate(selectedFile);
  };

  const handleScrapeWithURLScraper = () => {
    if (extractedProducts.length === 0) {
      toast({
        title: 'Keine Produkte',
        description: 'Bitte extrahieren Sie zuerst Produkte aus dem PDF',
        variant: 'destructive',
      });
      return;
    }

    // Navigate to URL Scraper with product URLs
    const urls = extractedProducts
      .filter(p => p.url)
      .map(p => p.url)
      .join('\n');
    
    // Store URLs in sessionStorage for URL Scraper to pick up
    sessionStorage.setItem('pdf_extracted_urls', urls);
    sessionStorage.setItem('pdf_extracted_products', JSON.stringify(extractedProducts));
    
    setLocation('/url-scraper');
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">PDF Auto-Scraper</h1>
        <p className="text-muted-foreground">
          Extrahieren Sie Produkt-URLs und EK-Preise aus Lieferanten-PDFs und verarbeiten Sie diese mit dem URL-Scraper
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1. PDF hochladen</CardTitle>
            <CardDescription>
              Lieferanten-PDF mit anklickbaren Produkt-URLs und EK-Preisen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf">PDF-Datei</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pdf"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={extractMutation.isPending}
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
              onClick={handleExtract}
              disabled={!selectedFile || extractMutation.isPending}
              className="w-full"
            >
              {extractMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  PDF wird analysiert...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  URLs & Preise extrahieren
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {extractedProducts.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>2. Extrahierte Produkte ({extractedProducts.length})</CardTitle>
                <CardDescription>
                  Produkt-URLs und EK-Preise aus dem PDF
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produktname</TableHead>
                        <TableHead>Artikel-Nr.</TableHead>
                        <TableHead>EAN</TableHead>
                        <TableHead>EK-Preis</TableHead>
                        <TableHead>URL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractedProducts.map((product, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{product.productName || '-'}</TableCell>
                          <TableCell>{product.articleNumber || '-'}</TableCell>
                          <TableCell>{product.eanCode || '-'}</TableCell>
                          <TableCell>{product.ekPrice ? `${product.ekPrice} €` : '-'}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {product.url ? (
                              <a 
                                href={product.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {product.url}
                              </a>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-blue-600" />
                  3. Mit URL-Scraper weiterverarbeiten
                </CardTitle>
                <CardDescription>
                  Nutzen Sie den URL-Scraper, um vollständige Produktdaten von den extrahierten URLs zu laden
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleScrapeWithURLScraper}
                  className="w-full"
                  size="lg"
                >
                  Zum URL-Scraper wechseln
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Die extrahierten URLs und EK-Preise werden automatisch übernommen
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
