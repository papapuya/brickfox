import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { htmlTemplates, generateHtmlDescription } from "@/lib/html-templates";
import { CreatorProduct } from "@shared/schema";
import { Copy, Download, FileText } from "lucide-react";

export default function ProductCreator() {
  const { toast } = useToast();
  const [product, setProduct] = useState<Partial<CreatorProduct>>({
    id: crypto.randomUUID(),
    sku: "",
    name: "",
    description: "",
    brand: "",
    features: [],
    advantages: [],
    technicalSpecs: {},
    safetyInfo: "",
    packageContents: "",
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("mediamarkt");
  const [generatedHtml, setGeneratedHtml] = useState<string>("");
  const [featureInput, setFeatureInput] = useState<string>("");
  const [specKey, setSpecKey] = useState<string>("");
  const [specValue, setSpecValue] = useState<string>("");

  const handleGenerate = () => {
    if (!product.name || !product.description) {
      toast({
        title: "Fehlende Informationen",
        description: "Bitte füllen Sie mindestens Name und Beschreibung aus.",
        variant: "destructive",
      });
      return;
    }

    try {
      const fullProduct: CreatorProduct = {
        id: product.id || crypto.randomUUID(),
        sku: product.sku || "N/A",
        name: product.name,
        description: product.description,
        brand: product.brand,
        features: product.features || [],
        advantages: product.advantages || product.features || [],
        technicalSpecs: product.technicalSpecs || {},
        safetyInfo: product.safetyInfo || "Produkt entspricht den geltenden Sicherheitsstandards.",
        packageContents: product.packageContents || `1 × ${product.name}`,
        images: product.images || [],
      };

      const html = generateHtmlDescription(fullProduct, selectedTemplate);
      setGeneratedHtml(html);
      toast({
        title: "Beschreibung generiert",
        description: "Die HTML-Beschreibung wurde erfolgreich erstellt.",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Generieren der Beschreibung.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedHtml);
    toast({
      title: "Kopiert",
      description: "Die HTML-Beschreibung wurde in die Zwischenablage kopiert.",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${product.sku || "product"}-description.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Heruntergeladen",
      description: "Die HTML-Datei wurde heruntergeladen.",
    });
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setProduct({
        ...product,
        features: [...(product.features || []), featureInput.trim()],
        advantages: [...(product.advantages || []), featureInput.trim()],
      });
      setFeatureInput("");
    }
  };

  const removeFeature = (index: number) => {
    const newFeatures = [...(product.features || [])];
    newFeatures.splice(index, 1);
    setProduct({
      ...product,
      features: newFeatures,
      advantages: newFeatures,
    });
  };

  const addTechnicalSpec = () => {
    if (specKey.trim() && specValue.trim()) {
      setProduct({
        ...product,
        technicalSpecs: {
          ...(product.technicalSpecs || {}),
          [specKey.trim()]: specValue.trim(),
        },
      });
      setSpecKey("");
      setSpecValue("");
    }
  };

  const removeTechnicalSpec = (key: string) => {
    const newSpecs = { ...(product.technicalSpecs || {}) };
    delete newSpecs[key];
    setProduct({
      ...product,
      technicalSpecs: newSpecs,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produktbeschreibung erstellen</h1>
          <p className="text-muted-foreground mt-2">
            Erstellen Sie professionelle HTML-Produktbeschreibungen mit verschiedenen Templates
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Produktinformationen</CardTitle>
            <CardDescription>Geben Sie die Produktdaten ein</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sku">Artikelnummer (SKU) *</Label>
              <Input
                id="sku"
                value={product.sku || ""}
                onChange={(e) => setProduct({ ...product, sku: e.target.value })}
                placeholder="z.B. ABC-12345"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Produktname *</Label>
              <Input
                id="name"
                value={product.name || ""}
                onChange={(e) => setProduct({ ...product, name: e.target.value })}
                placeholder="z.B. Akku-Pack 5000mAh"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marke</Label>
              <Input
                id="brand"
                value={product.brand || ""}
                onChange={(e) => setProduct({ ...product, brand: e.target.value })}
                placeholder="z.B. Ansmann"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung *</Label>
              <Textarea
                id="description"
                value={product.description || ""}
                onChange={(e) => setProduct({ ...product, description: e.target.value })}
                placeholder="Detaillierte Produktbeschreibung..."
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Features / Vorteile</Label>
              <div className="flex gap-2">
                <Input
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  placeholder="Feature hinzufügen..."
                  onKeyPress={(e) => e.key === "Enter" && addFeature()}
                />
                <Button onClick={addFeature} size="sm">Hinzufügen</Button>
              </div>
              {product.features && product.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {product.features.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm"
                    >
                      <span>{feature}</span>
                      <button
                        onClick={() => removeFeature(index)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Technische Spezifikationen</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={specKey}
                  onChange={(e) => setSpecKey(e.target.value)}
                  placeholder="z.B. Kapazität"
                />
                <div className="flex gap-2">
                  <Input
                    value={specValue}
                    onChange={(e) => setSpecValue(e.target.value)}
                    placeholder="z.B. 5000mAh"
                    onKeyPress={(e) => e.key === "Enter" && addTechnicalSpec()}
                  />
                  <Button onClick={addTechnicalSpec} size="sm">+</Button>
                </div>
              </div>
              {product.technicalSpecs && Object.keys(product.technicalSpecs).length > 0 && (
                <div className="mt-2 space-y-1">
                  {Object.entries(product.technicalSpecs).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-secondary px-2 py-1 rounded text-sm"
                    >
                      <span><strong>{key}:</strong> {value}</span>
                      <button
                        onClick={() => removeTechnicalSpec(key)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="safety">Sicherheitsinformationen</Label>
              <Textarea
                id="safety"
                value={product.safetyInfo || ""}
                onChange={(e) => setProduct({ ...product, safetyInfo: e.target.value })}
                placeholder="Sicherheitshinweise..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="package">Lieferumfang</Label>
              <Input
                id="package"
                value={product.packageContents || ""}
                onChange={(e) => setProduct({ ...product, packageContents: e.target.value })}
                placeholder="z.B. 1 × Produkt, 1 × Ladekabel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Template auswählen</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {htmlTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} - {template.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGenerate} className="w-full" size="lg">
              <FileText className="mr-2 h-4 w-4" />
              Beschreibung generieren
            </Button>
          </CardContent>
        </Card>

        {/* Output Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Vorschau & Export</CardTitle>
            <CardDescription>Generierte HTML-Beschreibung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedHtml ? (
              <>
                <div className="flex gap-2">
                  <Button onClick={handleCopy} variant="outline" className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Kopieren
                  </Button>
                  <Button onClick={handleDownload} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>

                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview">Vorschau</TabsTrigger>
                    <TabsTrigger value="html">HTML-Code</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview" className="mt-4">
                    <div
                      className="border rounded-lg p-4 bg-background max-h-[600px] overflow-auto"
                      dangerouslySetInnerHTML={{ __html: generatedHtml }}
                    />
                  </TabsContent>
                  <TabsContent value="html" className="mt-4">
                    <pre className="border rounded-lg p-4 bg-muted max-h-[600px] overflow-auto text-xs">
                      <code>{generatedHtml}</code>
                    </pre>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>Geben Sie Produktinformationen ein und klicken Sie auf "Beschreibung generieren"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

