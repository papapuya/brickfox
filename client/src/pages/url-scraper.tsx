import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Globe, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedProduct, setScrapedProduct] = useState<ScrapedProduct | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Custom selectors
  const [selectors, setSelectors] = useState({
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
          selectors: Object.keys(activeSelectors).length > 0 ? activeSelectors : undefined
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">URL Webscraper</h1>
          <p className="text-muted-foreground mt-2">
            Extrahieren Sie Produktdaten direkt von Lieferanten-Websites
          </p>
        </div>

        {/* URL Input */}
        <Card className="p-6">
          <div className="space-y-4">
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

            {/* Advanced Selectors */}
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
              <Button>
                AI-Beschreibung generieren
              </Button>
              <Button variant="outline">
                Zu Projekt hinzufügen
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
