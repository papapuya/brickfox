import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Globe, Settings2, FolderPlus, List, Package, Download, Table as TableIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Project } from "@shared/schema";

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
}

export default function URLScraper() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scrapedProduct, setScrapedProduct] = useState<ScrapedProduct | null>(null);
  const [generatedDescription, setGeneratedDescription] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("new");
  const [projectName, setProjectName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Multi-Product Scraping
  const [scrapingMode, setScrapingMode] = useState<"single" | "list">("single");
  const [productLinkSelector, setProductLinkSelector] = useState("a.product-link");
  const [maxProducts, setMaxProducts] = useState(50);
  const [scrapedProducts, setScrapedProducts] = useState<ScrapedProduct[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, status: "" });
  
  // Session cookies and userAgent for authenticated scraping
  const [sessionCookies, setSessionCookies] = useState("");
  const [userAgent, setUserAgent] = useState("");

  // Load existing projects
  const { data: projectsData } = useQuery<{ success: boolean; projects: Project[] }>({
    queryKey: ['/api/projects'],
    enabled: showSaveDialog,
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      return response.json();
    },
  });

  // Load suppliers
  const { data: suppliersData } = useQuery<{ success: boolean; suppliers: any[] }>({
    queryKey: ['/api/suppliers'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers');
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      return response.json();
    },
  });

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("__none__");

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
        category: ""
      });
      setProductLinkSelector("");
      setSessionCookies("");
      setUserAgent("");
      return;
    }

    const supplier = suppliersData?.suppliers?.find(s => s.id === supplierId);
    if (supplier) {
      setSelectors({ ...selectors, ...supplier.selectors });
      setProductLinkSelector(supplier.productLinkSelector || "");
      setSessionCookies(supplier.sessionCookies || "");
      setUserAgent(supplier.userAgent || "");
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
    category: ".breadcrumb"
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
    setBatchProgress({ current: 0, total: 0, status: "Suche nach Produkten..." });

    try {
      // Step 1: Get all product URLs from listing page
      const listResponse = await fetch('/api/scrape-product-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          productLinkSelector: productLinkSelector.trim(),
          maxProducts,
          userAgent: userAgent || undefined,
          cookies: sessionCookies || undefined
        }),
      });

      if (!listResponse.ok) {
        const error = await listResponse.json();
        throw new Error(error.error || 'Fehler beim Abrufen der Produktliste');
      }

      const { productUrls } = await listResponse.json();

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
        const productUrl = productUrls[i];
        setBatchProgress({ 
          current: i + 1, 
          total: productUrls.length, 
          status: `Scrape Produkt ${i + 1}/${productUrls.length}...` 
        });

        try {
          // Add timeout protection (20 seconds per product)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const response = await fetch('/api/scrape-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: productUrl,
              selectors: Object.keys(activeSelectors).length > 0 ? activeSelectors : undefined,
              userAgent: userAgent || undefined,
              cookies: sessionCookies || undefined
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            products.push(data.product);
          } else {
            console.error(`Fehler beim Scrapen von ${productUrl}`);
            failedCount++;
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            console.error(`Timeout beim Scrapen von ${productUrl}`);
          } else {
            console.error(`Fehler beim Scrapen von ${productUrl}:`, err);
          }
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
      setBatchProgress({ current: products.length, total: productUrls.length, status: "Fertig!" });

      toast({
        title: "Scraping abgeschlossen",
        description: `${products.length} von ${productUrls.length} Produkten erfolgreich gescraped`,
      });

    } catch (error) {
      console.error('Product list scraping error:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : 'Scraping fehlgeschlagen',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrape = async () => {
    if (!url.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine URL ein",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedDescription("");
    try {
      // Build selectors object (only include non-empty selectors)
      const activeSelectors: any = {};
      Object.entries(selectors).forEach(([key, value]) => {
        if (value.trim()) {
          activeSelectors[key] = value;
        }
      });

      const response = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          selectors: Object.keys(activeSelectors).length > 0 ? activeSelectors : undefined,
          userAgent: userAgent || undefined,
          cookies: sessionCookies || undefined
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Scraping fehlgeschlagen');
      }

      const data = await response.json();
      setScrapedProduct(data.product);
      
      toast({
        title: "Erfolgreich",
        description: `Produktdaten von ${new URL(url).hostname} extrahiert`,
      });

    } catch (error) {
      console.error('Scraping error:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : 'Scraping fehlgeschlagen',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!scrapedProduct) return;

    setIsGenerating(true);
    try {
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

      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedData: [{ extractedText: JSON.stringify(productData) }],
          customAttributes: {
            exactProductName: scrapedProduct.productName,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI-Generierung fehlgeschlagen');
      }

      const data = await response.json();
      setGeneratedDescription(data.htmlCode || '');
      
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

  const convertToCSV = (products: ScrapedProduct[]): string => {
    if (products.length === 0) return '';

    // CSV Headers
    const headers = [
      'Artikelnummer',
      'Produktname',
      'EAN',
      'Hersteller',
      'Preis',
      'Gewicht',
      'Kategorie',
      'Beschreibung',
      'Anzahl_Bilder',
      'Bild_URLs'
    ];

    // CSV Rows
    const rows = products.map(product => [
      product.articleNumber || '',
      product.productName || '',
      product.ean || '',
      product.manufacturer || '',
      product.price || '',
      product.weight || '',
      product.category || '',
      (product.description || '').replace(/"/g, '""').replace(/<[^>]*>/g, ''), // Remove HTML tags and escape quotes
      product.images?.length || '0',
      product.images?.join(' | ') || '' // Join multiple URLs with pipe separator
    ]);

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
    if (!scrapedProduct || !generatedDescription) return;

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
        const response = await fetch('/api/bulk-save-to-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: projectName.trim(),
            products: [{
              produktname: scrapedProduct.productName,
              artikelnummer: scrapedProduct.articleNumber || '',
              produktbeschreibung: generatedDescription,
              ean: scrapedProduct.ean || '',
              hersteller: scrapedProduct.manufacturer || '',
              preis: scrapedProduct.price || '',
              gewicht: scrapedProduct.weight || '',
              kategorie: scrapedProduct.category || '',
              mediamarktname_v1: scrapedProduct.productName,
              seo_beschreibung: scrapedProduct.description?.substring(0, 200) || '',
              source_url: url,
            }],
          }),
        });

        if (!response.ok) {
          throw new Error('Fehler beim Erstellen des Projekts');
        }

        toast({
          title: "Projekt erstellt",
          description: `Produkt wurde erfolgreich in "${projectName.trim()}" gespeichert`,
        });
      } else {
        // Add to existing project
        const response = await fetch(`/api/projects/${selectedProjectId}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: scrapedProduct.productName,
            articleNumber: scrapedProduct.articleNumber || '',
            htmlCode: generatedDescription,
            previewText: scrapedProduct.description?.substring(0, 200) || '',
            exactProductName: scrapedProduct.productName,
            customAttributes: [
              { key: 'ean', value: scrapedProduct.ean || '', type: 'text' },
              { key: 'hersteller', value: scrapedProduct.manufacturer || '', type: 'text' },
              { key: 'preis', value: scrapedProduct.price || '', type: 'text' },
              { key: 'gewicht', value: scrapedProduct.weight || '', type: 'text' },
              { key: 'kategorie', value: scrapedProduct.category || '', type: 'text' },
              { key: 'source_url', value: url, type: 'text' },
            ].filter(attr => attr.value),
          }),
        });

        if (!response.ok) {
          throw new Error('Fehler beim Hinzufügen zum Projekt');
        }

        const project = projectsData?.projects.find(p => p.id === selectedProjectId);
        toast({
          title: "Produkt hinzugefügt",
          description: `Produkt wurde erfolgreich zu "${project?.name}" hinzugefügt`,
        });
      }

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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">URL Webscraper</h1>
          <p className="text-muted-foreground mt-2">
            Extrahieren Sie Produktdaten direkt von Lieferanten-Websites
          </p>
        </div>

        {/* URL Input with Tabs */}
        <Card className="p-6">
          <Tabs value={scrapingMode} onValueChange={(value) => setScrapingMode(value as "single" | "list")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="single">
                <Package className="w-4 h-4 mr-2" />
                Einzelnes Produkt
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="w-4 h-4 mr-2" />
                Produktliste
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4">
              <div>
                <Label htmlFor="url">Produkt-URL</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://www.beispiel.de/produkt/akku-123"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isLoading) {
                        handleScrape();
                      }
                    }}
                  />
                  <Button onClick={handleScrape} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4 mr-2" />
                        Scrapen
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="list" className="space-y-4">
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
                  max="200"
                  value={maxProducts}
                  onChange={(e) => setMaxProducts(parseInt(e.target.value) || 50)}
                  className="mt-2"
                />
              </div>

              <Button onClick={handleScrapeProductList} disabled={isLoading} className="w-full">
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
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{batchProgress.status}</span>
                    <span>{batchProgress.current} / {batchProgress.total}</span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} />
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Advanced Selectors */}
          <div className="mt-4 space-y-4">
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
                <div>
                  <Label className="text-xs">Kategorie Selector</Label>
                  <Input
                    placeholder='.breadcrumb'
                    value={selectors.category}
                    onChange={(e) => setSelectors({...selectors, category: e.target.value})}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Scraped Data Display */}
        {scrapedProduct && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Extrahierte Produktdaten</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Artikelnummer</Label>
                  <p className="font-mono text-sm">{scrapedProduct.articleNumber || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Produktname</Label>
                  <p className="font-semibold">{scrapedProduct.productName || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">EAN</Label>
                  <p className="font-mono text-sm">{scrapedProduct.ean || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hersteller</Label>
                  <p>{scrapedProduct.manufacturer || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Preis</Label>
                  <p className="font-semibold">{scrapedProduct.price || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Gewicht</Label>
                  <p>{scrapedProduct.weight || '-'}</p>
                </div>
              </div>
              
              {scrapedProduct.description && (
                <div className="mt-4">
                  <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                  <div className="mt-2 p-3 bg-muted rounded-lg text-sm max-h-60 overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: scrapedProduct.description }} />
                  </div>
                </div>
              )}

              {scrapedProduct.images && scrapedProduct.images.length > 0 && (
                <div className="mt-4">
                  <Label className="text-xs text-muted-foreground">Bilder ({scrapedProduct.images.length})</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {scrapedProduct.images.slice(0, 8).map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        alt={`Produkt ${idx + 1}`}
                        className="w-full h-24 object-cover rounded border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

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
                disabled={!generatedDescription}
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
              <Button onClick={downloadCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Als CSV herunterladen
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Bild</TableHead>
                      <TableHead>Artikelnummer</TableHead>
                      <TableHead>Produktname</TableHead>
                      <TableHead>EAN</TableHead>
                      <TableHead>Hersteller</TableHead>
                      <TableHead>Preis</TableHead>
                      <TableHead>Gewicht</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Beschreibung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scrapedProducts.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                        <TableCell>
                          {product.images && product.images.length > 0 ? (
                            <img 
                              src={product.images[0]} 
                              alt={product.productName}
                              className="w-12 h-12 object-cover rounded border"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%23e5e7eb"/><text x="24" y="24" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="12">-</text></svg>';
                              }}
                              title={`${product.images.length} Bild(er)`}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center text-muted-foreground text-xs">
                              -
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.articleNumber || '-'}</TableCell>
                        <TableCell className="font-medium">{product.productName || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{product.ean || '-'}</TableCell>
                        <TableCell>{product.manufacturer || '-'}</TableCell>
                        <TableCell className="font-semibold">{product.price || '-'}</TableCell>
                        <TableCell>{product.weight || '-'}</TableCell>
                        <TableCell className="text-xs">{product.category || '-'}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={product.description || ''}>
                          {product.description ? product.description.substring(0, 100) + '...' : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
              <p className="font-semibold mb-1">CSV-Export beinhaltet:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Artikelnummer, Produktname, EAN, Hersteller</li>
                <li>Preis, Gewicht, Kategorie, Beschreibung</li>
                <li>Anzahl Bilder + Bild-URLs (pipe-getrennt)</li>
                <li>UTF-8 kodiert - kompatibel mit Excel, Google Sheets und CSV-Tools</li>
              </ul>
            </div>
          </Card>
        )}

        {/* Generated Description */}
        {generatedDescription && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Generierte Produktbeschreibung</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">HTML-Vorschau</Label>
                <div className="p-4 bg-muted rounded-lg max-h-96 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: generatedDescription }} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">HTML-Code</Label>
                <Textarea
                  value={generatedDescription}
                  onChange={(e) => setGeneratedDescription(e.target.value)}
                  className="font-mono text-sm"
                  rows={10}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  navigator.clipboard.writeText(generatedDescription);
                  toast({ title: "Kopiert", description: "HTML wurde in die Zwischenablage kopiert" });
                }}>
                  HTML kopieren
                </Button>
                <Button onClick={() => setShowSaveDialog(true)}>
                  Zu Projekt hinzufügen
                </Button>
              </div>
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
      </div>
    </div>
  );
}
