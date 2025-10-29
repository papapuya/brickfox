import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Globe, Settings2, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
