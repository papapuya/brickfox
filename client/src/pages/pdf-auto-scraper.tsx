import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2, ExternalLink, ArrowRight, Mail } from 'lucide-react';
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
  liefermenge: string | null;
}

interface PDFPreviewResult {
  success: boolean;
  totalProducts: number;
  products: PDFProduct[]; // Legacy: products with URL
  withURL: PDFProduct[];
  withoutURL: PDFProduct[];
}

export default function PDFAutoScraper() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedProducts, setExtractedProducts] = useState<PDFProduct[]>([]);
  const [productsWithoutURL, setProductsWithoutURL] = useState<PDFProduct[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("__none__");
  const [activeTab, setActiveTab] = useState<'withURL' | 'withoutURL'>('withURL');
  
  // Email Dialog State
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('Anfrage: Produkt-URLs für EAN-Codes');
  const [emailMessage, setEmailMessage] = useState(`Sehr geehrte Damen und Herren,

wir benötigen für folgende Produkte (EAN-Codes) die entsprechenden Produkt-URLs:

[Die EAN-Codes werden automatisch unten angefügt]

Bitte senden Sie uns die URLs zu den aufgelisteten EAN-Codes.

Vielen Dank im Voraus!`);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 6;

  // Load extracted products from sessionStorage on mount (when returning from URL-Scraper)
  useEffect(() => {
    const savedProducts = sessionStorage.getItem('pdf_auto_scraper_extracted_products');
    const savedProductsWithoutURL = sessionStorage.getItem('pdf_auto_scraper_products_without_url');
    const savedSupplierId = sessionStorage.getItem('pdf_auto_scraper_selected_supplier');
    
    if (savedProducts) {
      try {
        const products = JSON.parse(savedProducts);
        setExtractedProducts(products);
      } catch (error) {
        console.error('Failed to parse saved products:', error);
      }
    }
    
    if (savedProductsWithoutURL) {
      try {
        const products = JSON.parse(savedProductsWithoutURL);
        setProductsWithoutURL(products);
      } catch (error) {
        console.error('Failed to parse saved products without URL:', error);
      }
    }
    
    if (savedSupplierId) {
      setSelectedSupplierId(savedSupplierId);
    }
  }, []);

  // Load suppliers
  const { data: suppliersData } = useQuery<{ success: boolean; suppliers: any[] }>({
    queryKey: ['/api/suppliers'],
    queryFn: async () => {
      const token = localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token');
      const response = await fetch('/api/suppliers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      return response.json();
    },
  });

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
      setExtractedProducts(data.withURL);
      setProductsWithoutURL(data.withoutURL);
      setCurrentPage(1); // Reset to first page
      
      // Set default active tab based on what's available
      if (data.withURL.length > 0) {
        setActiveTab('withURL');
      } else if (data.withoutURL.length > 0) {
        setActiveTab('withoutURL');
      }
      
      // Save to sessionStorage so it persists when returning from URL-Scraper
      sessionStorage.setItem('pdf_auto_scraper_extracted_products', JSON.stringify(data.withURL));
      sessionStorage.setItem('pdf_auto_scraper_products_without_url', JSON.stringify(data.withoutURL));
      
      toast({
        title: 'PDF analysiert',
        description: `${data.totalProducts} Produkte gefunden (${data.withURL.length} mit URL, ${data.withoutURL.length} ohne URL)`,
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

  // Email Mutation - Send URL request to supplier
  const emailMutation = useMutation({
    mutationFn: async (params: { to: string; subject: string; message: string; eanCodes: string[] }) => {
      const response = await fetch('/api/email/request-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token')}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'E-Mail konnte nicht gesendet werden');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'E-Mail gesendet',
        description: 'Die Anfrage wurde erfolgreich an den Lieferanten gesendet',
      });
      setIsEmailDialogOpen(false);
      setEmailTo('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Senden',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSendEmail = () => {
    if (!emailTo || !emailSubject || !emailMessage) {
      toast({
        title: 'Fehlende Eingaben',
        description: 'Bitte füllen Sie alle Felder aus',
        variant: 'destructive',
      });
      return;
    }

    // Extract EAN codes from products without URL
    const eanCodes = productsWithoutURL
      .map(p => p.eanCode)
      .filter(Boolean) as string[];

    if (eanCodes.length === 0) {
      toast({
        title: 'Keine EAN-Codes',
        description: 'Keine EAN-Codes zum Senden verfügbar',
        variant: 'destructive',
      });
      return;
    }

    emailMutation.mutate({
      to: emailTo,
      subject: emailSubject,
      message: emailMessage,
      eanCodes,
    });
  };

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

    // Filter products with URLs and create URL→metadata map
    const productsWithUrls = extractedProducts.filter(p => p.url);
    
    if (productsWithUrls.length === 0) {
      toast({
        title: 'Keine URLs gefunden',
        description: 'Keine Produkte mit URLs im PDF gefunden',
        variant: 'destructive',
      });
      return;
    }

    // Create map: URL → Product metadata (for correct merging in URL-Scraper)
    const urlToMetadata: Record<string, any> = {};
    productsWithUrls.forEach(product => {
      if (product.url) {
        urlToMetadata[product.url] = {
          ekPrice: product.ekPrice,
          articleNumber: product.articleNumber,
          eanCode: product.eanCode,
          productName: product.productName,
        };
      }
    });
    
    // Store URLs and metadata map in sessionStorage
    const urls = productsWithUrls.map(p => p.url).join('\n');
    sessionStorage.setItem('pdf_extracted_urls', urls);
    sessionStorage.setItem('pdf_url_metadata_map', JSON.stringify(urlToMetadata));
    
    // Store selected supplier ID for URL-Scraper
    if (selectedSupplierId && selectedSupplierId !== "__none__") {
      sessionStorage.setItem('pdf_selected_supplier_id', selectedSupplierId);
    }
    
    // Store selected supplier ID for PDF-Auto-Scraper (to restore when returning)
    sessionStorage.setItem('pdf_auto_scraper_selected_supplier', selectedSupplierId);
    
    setLocation('/url-scraper?from=pdf-auto-scraper');
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

            <div className="space-y-2">
              <Label htmlFor="supplier-select">Lieferant auswählen (optional)</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger id="supplier-select">
                  <SelectValue placeholder="Keine Vorlage (Auto-Erkennung)" />
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
              <p className="text-xs text-muted-foreground">
                💡 Gespeicherte CSS-Selektoren für diesen Lieferanten laden
              </p>
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

        {(extractedProducts.length > 0 || productsWithoutURL.length > 0) && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>2. Extrahierte Produkte</CardTitle>
                <CardDescription>
                  Produkte aufgeteilt nach Verfügbarkeit von URLs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'withURL' | 'withoutURL')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="withURL" className="flex items-center gap-2">
                      Mit URL ({extractedProducts.length})
                      <Badge variant="secondary">{extractedProducts.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="withoutURL" className="flex items-center gap-2">
                      Ohne URL ({productsWithoutURL.length})
                      <Badge variant="secondary">{productsWithoutURL.length}</Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="withURL" className="mt-4">
                <div className="rounded-md border overflow-hidden">
                  <div className="max-h-96 overflow-y-auto overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[250px]">Produktname (Bezeichnung)</TableHead>
                          <TableHead className="min-w-[120px]">Artikel-Nr.</TableHead>
                          <TableHead className="min-w-[130px]">EAN</TableHead>
                          <TableHead className="min-w-[100px]">Netto-EK</TableHead>
                          <TableHead className="min-w-[100px]">Liefermenge</TableHead>
                          <TableHead className="min-w-[400px]">URL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extractedProducts
                          .filter(p => p.url)
                          .slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage)
                          .map((product, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{product.productName || '-'}</TableCell>
                            <TableCell>{product.articleNumber || '-'}</TableCell>
                            <TableCell>{product.eanCode || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap">{product.ekPrice ? `${product.ekPrice} €` : '-'}</TableCell>
                            <TableCell className="whitespace-nowrap">{product.liefermenge || '1 Stück'}</TableCell>
                            <TableCell>
                              <a 
                                href={product.url!} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                <span className="break-all">{product.url}</span>
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {extractedProducts.filter(p => p.url).length > productsPerPage && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                      <div className="text-sm text-muted-foreground">
                        Zeige {((currentPage - 1) * productsPerPage) + 1} bis {Math.min(currentPage * productsPerPage, extractedProducts.filter(p => p.url).length)} von {extractedProducts.filter(p => p.url).length} Produkten
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
                          {Array.from({ length: Math.ceil(extractedProducts.filter(p => p.url).length / productsPerPage) }, (_, i) => i + 1).map((page) => (
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
                          onClick={() => setCurrentPage(Math.min(Math.ceil(extractedProducts.filter(p => p.url).length / productsPerPage), currentPage + 1))}
                          disabled={currentPage === Math.ceil(extractedProducts.filter(p => p.url).length / productsPerPage)}
                        >
                          Weiter
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                  </TabsContent>

                  <TabsContent value="withoutURL" className="mt-4">
                    {productsWithoutURL.length > 0 ? (
                      <div className="space-y-4">
                        <div className="rounded-md border overflow-hidden">
                          <div className="max-h-96 overflow-y-auto overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="min-w-[120px]">Artikel-Nr.</TableHead>
                                  <TableHead className="min-w-[130px]">EAN</TableHead>
                                  <TableHead className="min-w-[100px]">Netto-EK</TableHead>
                                  <TableHead className="min-w-[100px]">Liefermenge</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {productsWithoutURL.map((product, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{product.articleNumber || '-'}</TableCell>
                                    <TableCell>{product.eanCode || '-'}</TableCell>
                                    <TableCell className="whitespace-nowrap">{product.ekPrice ? `${product.ekPrice} €` : '-'}</TableCell>
                                    <TableCell className="whitespace-nowrap">{product.liefermenge || '1 Stück'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-4 bg-orange-50 border border-orange-200 rounded-md">
                          <Mail className="h-5 w-5 text-orange-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-orange-900">URLs erforderlich</p>
                            <p className="text-xs text-orange-700">Kontaktieren Sie den Lieferanten, um Produkt-URLs zu erhalten</p>
                          </div>
                          <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="border-orange-300">
                                <Mail className="h-4 w-4 mr-2" />
                                URLs anfragen
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>E-Mail an Lieferanten senden</DialogTitle>
                                <DialogDescription>
                                  Senden Sie eine Anfrage mit den EAN-Codes an Ihren Lieferanten
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="email-to">Empfänger-E-Mail *</Label>
                                  <Input
                                    id="email-to"
                                    type="email"
                                    placeholder="lieferant@beispiel.de"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="email-subject">Betreff *</Label>
                                  <Input
                                    id="email-subject"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="email-message">Nachricht *</Label>
                                  <Textarea
                                    id="email-message"
                                    rows={8}
                                    value={emailMessage}
                                    onChange={(e) => setEmailMessage(e.target.value)}
                                    className="font-mono text-sm"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    💡 Die EAN-Codes ({productsWithoutURL.filter(p => p.eanCode).length} Stück) werden automatisch am Ende der E-Mail angefügt
                                  </p>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setIsEmailDialogOpen(false)}
                                  disabled={emailMutation.isPending}
                                >
                                  Abbrechen
                                </Button>
                                <Button
                                  onClick={handleSendEmail}
                                  disabled={emailMutation.isPending}
                                >
                                  {emailMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Wird gesendet...
                                    </>
                                  ) : (
                                    <>
                                      <Mail className="mr-2 h-4 w-4" />
                                      E-Mail senden
                                    </>
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Keine Produkte ohne URL gefunden</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
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
