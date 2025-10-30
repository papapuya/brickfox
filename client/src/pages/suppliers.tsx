import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

interface Supplier {
  id: string;
  name: string;
  urlPattern?: string;
  description?: string;
  selectors: Record<string, string>;
  productLinkSelector?: string;
  sessionCookies?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    urlPattern: "",
    description: "",
    productLinkSelector: "",
    sessionCookies: "",
    userAgent: "",
    selectors: {
      articleNumber: ".product-code",
      productName: "h1.product-title",
      ean: ".ean",
      manufacturer: ".brand",
      price: ".price",
      description: ".product-description",
      images: ".product-image img",
      weight: ".weight",
      category: ".breadcrumb"
    }
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await apiGet<{ success: boolean; suppliers: Supplier[] }>('/api/suppliers');
      if (data.success) {
        setSuppliers(data.suppliers);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast({
        title: "Fehler",
        description: "Lieferanten konnten nicht geladen werden",
        variant: "destructive",
      });
    }
  };

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        urlPattern: supplier.urlPattern || "",
        description: supplier.description || "",
        productLinkSelector: supplier.productLinkSelector || "",
        sessionCookies: supplier.sessionCookies || "",
        userAgent: supplier.userAgent || "",
        selectors: { ...formData.selectors, ...supplier.selectors }
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: "",
        urlPattern: "",
        description: "",
        productLinkSelector: "",
        sessionCookies: "",
        userAgent: "",
        selectors: {
          articleNumber: ".product-code",
          productName: "h1.product-title",
          ean: ".ean",
          manufacturer: ".brand",
          price: ".price",
          description: ".product-description",
          images: ".product-image img",
          weight: ".weight",
          category: ".breadcrumb"
        }
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Namen ein",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const activeSelectors: Record<string, string> = {};
      Object.entries(formData.selectors).forEach(([key, value]) => {
        if (value.trim()) {
          activeSelectors[key] = value.trim();
        }
      });

      const payload = {
        name: formData.name,
        urlPattern: formData.urlPattern || undefined,
        description: formData.description || undefined,
        productLinkSelector: formData.productLinkSelector || undefined,
        sessionCookies: formData.sessionCookies || undefined,
        userAgent: formData.userAgent || undefined,
        selectors: activeSelectors
      };

      const data = editingSupplier 
        ? await apiPut<{ success: boolean; error?: string }>(`/api/suppliers/${editingSupplier.id}`, payload)
        : await apiPost<{ success: boolean; error?: string }>('/api/suppliers', payload);

      if (data.success) {
        toast({
          title: "Erfolg",
          description: editingSupplier 
            ? "Lieferant aktualisiert" 
            : "Lieferant erstellt",
        });
        setIsDialogOpen(false);
        loadSuppliers();
      } else {
        throw new Error(data.error || 'Failed to save supplier');
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({
        title: "Fehler",
        description: "Lieferant konnte nicht gespeichert werden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) {
      return;
    }

    try {
      const data = await apiDelete<{ success: boolean; error?: string }>(`/api/suppliers/${id}`);

      if (data.success) {
        toast({
          title: "Erfolg",
          description: "Lieferant gelöscht",
        });
        loadSuppliers();
      } else {
        throw new Error(data.error || 'Failed to delete supplier');
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: "Fehler",
        description: "Lieferant konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Lieferanten-Profile</h1>
          <p className="text-muted-foreground mt-2">
            Verwalten Sie CSS-Selektoren für häufig verwendete Lieferanten
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Neuer Lieferant
        </Button>
      </div>

      <Card className="p-6">
        {suppliers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Noch keine Lieferanten-Profile vorhanden
            </p>
            <Button onClick={() => handleOpenDialog()} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Ersten Lieferanten anlegen
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL-Muster</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Selektoren</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {supplier.urlPattern || '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {supplier.description || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-1 bg-muted rounded">
                      {Object.keys(supplier.selectors).length} Selektoren
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(supplier)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(supplier.id, supplier.name)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Lieferant bearbeiten" : "Neuer Lieferant"}
            </DialogTitle>
            <DialogDescription>
              Konfigurieren Sie CSS-Selektoren für einen Lieferanten
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Conrad Electronic"
              />
            </div>

            <div>
              <Label htmlFor="urlPattern">URL-Muster (optional)</Label>
              <Input
                id="urlPattern"
                value={formData.urlPattern}
                onChange={(e) => setFormData({ ...formData, urlPattern: e.target.value })}
                placeholder="z.B. conrad.de, reichelt.de"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wird verwendet, um den Lieferanten automatisch zu erkennen
              </p>
            </div>

            <div>
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notizen zu diesem Lieferanten..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="productLinkSelector">Produktlink CSS-Selektor (optional)</Label>
              <Input
                id="productLinkSelector"
                value={formData.productLinkSelector}
                onChange={(e) => setFormData({ ...formData, productLinkSelector: e.target.value })}
                placeholder="a.product-link"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Für Produktlisten-Scraping
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">🔐 Authentifizierung (optional)</h3>
              
              <div className="mb-4">
                <Label htmlFor="sessionCookies">Session Cookies</Label>
                <Textarea
                  id="sessionCookies"
                  value={formData.sessionCookies}
                  onChange={(e) => setFormData({ ...formData, sessionCookies: e.target.value })}
                  placeholder="sessionid=abc123; csrftoken=xyz789"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 <strong>So kopieren Sie Cookies:</strong><br/>
                  1. Loggen Sie sich auf der Lieferanten-Webseite ein<br/>
                  2. Öffnen Sie DevTools (F12) → Tab "Application" → "Cookies"<br/>
                  3. Kopieren Sie relevante Cookies (z.B. sessionid, auth_token)<br/>
                  4. Format: <code>cookie1=value1; cookie2=value2</code>
                </p>
              </div>

              <div>
                <Label htmlFor="userAgent">Custom User-Agent (optional)</Label>
                <Input
                  id="userAgent"
                  value={formData.userAgent}
                  onChange={(e) => setFormData({ ...formData, userAgent: e.target.value })}
                  placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Falls die Webseite bestimmte Browser erfordert
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Produkt-Selektoren (optional)</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {Object.keys(formData.selectors).length} Selektoren konfiguriert
              </p>
              <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                {Object.entries(formData.selectors).map(([key, value]) => {
                  // Generate friendly label names
                  const labelMap: Record<string, string> = {
                    articleNumber: "Artikelnummer",
                    productName: "Produktname",
                    ean: "EAN",
                    manufacturer: "Hersteller",
                    price: "Preis",
                    weight: "Gewicht",
                    description: "Beschreibung",
                    images: "Bilder",
                    category: "Kategorie",
                    technicalTable: "Technische Tabelle",
                    length: "Länge (mm)",
                    bodyDiameter: "Gehäusedurchmesser (mm)",
                    headDiameter: "Kopfdurchmesser (mm)",
                    weightWithoutBattery: "Gewicht ohne Akku (g)",
                    totalWeight: "Gesamt Gewicht (g)",
                    powerSupply: "Stromversorgung",
                    led1: "Leuchtmittel 1",
                    led2: "Leuchtmittel 2",
                    spotIntensity: "Spotintensität (cd)",
                    maxLuminosity: "Leuchtleistung max.",
                    maxBeamDistance: "Leuchtweite max. (m)"
                  };

                  const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);

                  return (
                    <div key={key}>
                      <Label htmlFor={`selector-${key}`} className="text-sm">
                        {label}
                      </Label>
                      <Input
                        id={`selector-${key}`}
                        value={value || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          selectors: { ...formData.selectors, [key]: e.target.value }
                        })}
                        placeholder={`CSS-Selektor für ${label}`}
                        className="text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
