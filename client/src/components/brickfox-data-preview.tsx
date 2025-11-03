import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, Settings, Filter, Search, Sparkles } from "lucide-react";
import type { ProductInProject } from "@shared/schema";
import Papa from "papaparse";

interface BrickfoxColumn {
  id: string;
  label: string;
  category: 'product' | 'variant' | 'attributes' | 'variations';
  enabled: boolean;
  required?: boolean;
}

interface BrickfoxDataPreviewProps {
  products: ProductInProject[];
  projectName?: string;
}

export default function BrickfoxDataPreview({ products, projectName }: BrickfoxDataPreviewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<BrickfoxColumn[]>([]);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Brickfox PIM Spalten definieren
  const brickfoxColumns: BrickfoxColumn[] = [
    // Produkt-Informationen
    { id: 'product_id_external', label: 'Produkt-ID (extern)', category: 'product', enabled: true, required: true },
    { id: 'min_shipping_method', label: 'Mindestversandart', category: 'product', enabled: false },
    { id: 'warengruppen_id_external', label: 'Warengruppen-ID (Extern)', category: 'product', enabled: false },
    { id: 'manufacturer_external_id', label: 'Hersteller (Externe Hersteller ID)', category: 'product', enabled: true },
    { id: 'brand_name', label: 'Markenname', category: 'product', enabled: true },
    { id: 'processing_status', label: 'Bearbeitungsstatus', category: 'product', enabled: false },
    { id: 'product_name', label: 'Produktname', category: 'product', enabled: true, required: true },
    { id: 'product_description', label: 'Produktbeschreibung', category: 'product', enabled: true },
    { id: 'product_bulletpoints', label: 'Produkt-Bulletpoints', category: 'product', enabled: false },
    { id: 'product_image_translation', label: 'Produktbild Übersetzung', category: 'product', enabled: false },
    { id: 'product_media', label: 'Produktmedien', category: 'product', enabled: false },
    { id: 'tax_class', label: 'Steuerklasse', category: 'product', enabled: false },
    { id: 'text_block_groups', label: 'Textblockgruppen', category: 'product', enabled: false },
    { id: 'product_seo_description', label: 'Produkt-SEO (Beschreibung)', category: 'product', enabled: false },
    { id: 'product_seo_content', label: 'Produkt-SEO (Content)', category: 'product', enabled: false },
    { id: 'accessory_group', label: 'Zubehörgruppe (für Produktbeziehungen Zubehör)', category: 'product', enabled: false },
    { id: 'article_number', label: 'Artikelnummer', category: 'product', enabled: true, required: true },
    { id: 'warengruppen_id_brickfox', label: 'Warengruppen-ID (brickfox)', category: 'product', enabled: false },
    { id: 'warengruppen_path', label: 'Warengruppen Pfad', category: 'product', enabled: false },
    { id: 'secondary_warengruppen_path', label: 'Sekundärer Warengruppen Pfad', category: 'product', enabled: false },
    { id: 'product_status', label: 'Produkt-Status', category: 'product', enabled: false },
    { id: 'status_comment', label: 'Statuskommentar', category: 'product', enabled: false },
    { id: 'product_name_short', label: 'Produktname-Kurz', category: 'product', enabled: false },
    { id: 'product_short_description', label: 'Produkt-Kurzbeschreibung', category: 'product', enabled: false },
    { id: 'product_image', label: 'Produktbild', category: 'product', enabled: false },
    { id: 'product_image_attributes', label: 'Produktbild-Attribute', category: 'product', enabled: false },
    { id: 'product_media_names', label: 'Produktmediennamen', category: 'product', enabled: false },
    { id: 'country_of_manufacture', label: 'Herstellungsland', category: 'product', enabled: false },
    { id: 'product_seo_title', label: 'Produkt-SEO (Titel)', category: 'product', enabled: false },
    { id: 'product_seo_keywords', label: 'Produkt-SEO (Keywords)', category: 'product', enabled: false },
    { id: 'product_relationships', label: 'Produktbeziehungen (Zubehör, Crossselling, Upselling)', category: 'product', enabled: false },
    { id: 'bundle_ean', label: 'Bundle (EAN)', category: 'product', enabled: false },

    // Varianten-Informationen
    { id: 'variant_info', label: 'Produktvarianten Informationen', category: 'variant', enabled: false },
    { id: 'variant_id_external', label: 'Varianten-ID (extern)', category: 'variant', enabled: false },
    { id: 'ean', label: 'EAN', category: 'variant', enabled: true },
    { id: 'manufacturer_article_number', label: 'Hersteller-Artikelnummer', category: 'variant', enabled: true },
    { id: 'variant_name', label: 'Variantenname', category: 'variant', enabled: false },
    { id: 'variant_short_description', label: 'Varianten-Kurzbeschreibung', category: 'variant', enabled: false },
    { id: 'variant_bulletpoints', label: 'Varianten-Bulletpoints', category: 'variant', enabled: false },
    { id: 'price', label: 'Preis', category: 'variant', enabled: true, required: true },
    { id: 'special_price', label: 'Sonderpreis', category: 'variant', enabled: false },
    { id: 'special_price_end_date', label: 'Sonderpreis End Datum', category: 'variant', enabled: false },
    { id: 'tier_price', label: 'Staffelpreis', category: 'variant', enabled: false },
    { id: 'timed_variant_price_next', label: 'Zeitgesteuerter Variantenpreis (nächstes)', category: 'variant', enabled: false },
    { id: 'timed_dealer_price_next', label: 'Zeitgesteuerter Händlerpreis (nächstes)', category: 'variant', enabled: false },
    { id: 'supplier_article_number', label: 'Lieferanten-Artikelnummer', category: 'variant', enabled: false },
    { id: 'min_order_quantity_supplier', label: 'Mindestbestellmenge (Lieferant)', category: 'variant', enabled: false },
    { id: 'variant_image', label: 'Variantenbild', category: 'variant', enabled: false },
    { id: 'variant_media', label: 'Variantenmedien', category: 'variant', enabled: false },
    { id: 'quantity', label: 'Menge', category: 'variant', enabled: false },
    { id: 'base_price', label: 'Grundpreis', category: 'variant', enabled: false },
    { id: 'base_price_unit', label: 'Grundpreis-Einheit', category: 'variant', enabled: false },
    { id: 'order_unit_quantity', label: 'Bestelleinheit-Menge', category: 'variant', enabled: false },
    { id: 'content_per_order_unit_quantity', label: 'Inhalt pro Bestelleinheit-Menge', category: 'variant', enabled: false },
    { id: 'customs_tariff_number', label: 'Zolltarifnummer', category: 'variant', enabled: false },
    { id: 'package_width', label: 'Paket-Breite', category: 'variant', enabled: false },
    { id: 'package_length', label: 'Paket-Länge', category: 'variant', enabled: false },
    { id: 'packaging_unit', label: 'Verpackungseinheit', category: 'variant', enabled: false },
    { id: 'height', label: 'Höhe', category: 'variant', enabled: true },
    { id: 'length', label: 'Länge', category: 'variant', enabled: true },
    { id: 'cost_markup_percentage', label: 'Prozentualer EK-Aufschlag', category: 'variant', enabled: false },
    { id: 'stock', label: 'Lagerbestand', category: 'variant', enabled: false },
    { id: 'third_party_stock', label: 'Drittlagerbestand', category: 'variant', enabled: false },
    { id: 'max_order_quantity', label: 'Max. Bestellmenge', category: 'variant', enabled: false },
    { id: 'variant_article_number', label: 'Varianten-Artikelnummer', category: 'variant', enabled: false },
    { id: 'isbn', label: 'ISBN', category: 'variant', enabled: false },
    { id: 'variant_status', label: 'Variantenstatus', category: 'variant', enabled: false },
    { id: 'variant_name_short', label: 'Variantenname-Kurz', category: 'variant', enabled: false },
    { id: 'variant_description', label: 'Variantenbeschreibung', category: 'variant', enabled: false },
    { id: 'classification', label: 'Klassifizierung', category: 'variant', enabled: false },
    { id: 'msrp', label: 'UVP', category: 'variant', enabled: false },
    { id: 'special_price_start_date', label: 'Sonderpreis Start Datum', category: 'variant', enabled: false },
    { id: 'special_price_stock_limit', label: 'Sonderpreis bestands Grenze', category: 'variant', enabled: false },
    { id: 'timed_variant_price_current', label: 'Zeitgesteuerter Variantenpreis (aktuell)', category: 'variant', enabled: false },
    { id: 'timed_dealer_price_current', label: 'Zeitgesteuerter Händlerpreis (aktuell)', category: 'variant', enabled: false },
    { id: 'suppliers', label: 'Lieferanten', category: 'variant', enabled: false },
    { id: 'cost_price_supplier', label: 'EK (Lieferant)', category: 'variant', enabled: false },
    { id: 'min_stock', label: 'Minimaler Lagerbestand', category: 'variant', enabled: false },
    { id: 'variant_image_attributes', label: 'Variantenbild-Attribute', category: 'variant', enabled: false },
    { id: 'variant_media_names', label: 'Variantenmediennamen', category: 'variant', enabled: false },
    { id: 'unit', label: 'Einheit', category: 'variant', enabled: false },
    { id: 'base_price_quantity', label: 'Grundpreis-Menge', category: 'variant', enabled: false },
    { id: 'order_price', label: 'Bestell-Preis', category: 'variant', enabled: false },
    { id: 'order_unit_unit', label: 'Bestelleinheit-Einheit', category: 'variant', enabled: false },
    { id: 'content_per_order_unit_unit', label: 'Inhalt pro Bestelleinheit-Einheit', category: 'variant', enabled: false },
    { id: 'goods_description', label: 'Warenbeschreibung', category: 'variant', enabled: false },
    { id: 'package_height', label: 'Paket-Höhe', category: 'variant', enabled: false },
    { id: 'weight_with_packaging', label: 'Gewicht inkl. Verpackung', category: 'variant', enabled: false },
    { id: 'weight', label: 'Gewicht', category: 'variant', enabled: true },
    { id: 'width', label: 'Breite', category: 'variant', enabled: true },
    { id: 'delivery_time', label: 'Lieferzeit', category: 'variant', enabled: false },
    { id: 'variant_characteristics', label: 'Variantenmerkmale', category: 'variant', enabled: false },
    { id: 'available_stock', label: 'Verfügbarer Lagerbestand', category: 'variant', enabled: false },
    { id: 'min_order_quantity', label: 'Min. Bestellmenge', category: 'variant', enabled: false },
    { id: 'never_out_of_stock', label: 'Never out of stock', category: 'variant', enabled: false },
    { id: 'other', label: 'Sonstiges', category: 'variant', enabled: false },

    // Technische Attribute (Auswahl der wichtigsten)
    { id: 'battery_type', label: 'Akkutyp', category: 'attributes', enabled: false },
    { id: 'connection', label: 'Anschluss', category: 'attributes', enabled: false },
    { id: 'input_voltage', label: 'Eingangsspannung (Volt)', category: 'attributes', enabled: false },
    { id: 'power_w', label: 'Leistung W', category: 'attributes', enabled: false },
    { id: 'color', label: 'Farbe', category: 'attributes', enabled: false },
    { id: 'capacity_mah', label: 'Kapazität mAh', category: 'attributes', enabled: false },
    { id: 'diameter_mm', label: 'Durchmesser mm', category: 'attributes', enabled: false },
    { id: 'height_mm', label: 'Höhe in mm', category: 'attributes', enabled: false },
    { id: 'width_mm', label: 'Breite in mm', category: 'attributes', enabled: false },
    { id: 'length_mm', label: 'Länge mm', category: 'attributes', enabled: false },
    { id: 'weight_g', label: 'Gewicht ohne Zubehör g', category: 'attributes', enabled: false },
    { id: 'voltage_v', label: 'Spannung V', category: 'attributes', enabled: false },
    { id: 'delivery_scope', label: 'Lieferumfang', category: 'attributes', enabled: false },
    { id: 'protection_circuit', label: 'Schutzschaltung', category: 'attributes', enabled: false },
    { id: 'rechargeable', label: 'Wiederaufladbar', category: 'attributes', enabled: false },
    { id: 'chemistry_composition', label: 'Zusammensetzung (Chemie)', category: 'attributes', enabled: false },
  ];

  // Initialisiere Spalten-Auswahl
  useState(() => {
    if (selectedColumns.length === 0) {
      setSelectedColumns(brickfoxColumns);
    }
  });

  // Filtere Produkte basierend auf Suchbegriff
  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.articleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.exactProductName?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  // Helper: Extrahiere Wert aus extractedData
  const getExtractedValue = (product: ProductInProject, field: string): string => {
    if (!product.extractedData || product.extractedData.length === 0) return '';
    
    const extractedText = product.extractedData[0]?.extractedText;
    if (!extractedText) return '';
    
    try {
      const parsed = JSON.parse(extractedText);
      return parsed[field] || '';
    } catch {
      return '';
    }
  };

  // Helper: Finde Attribut nach Schlüsselwort
  const findAttribute = (product: ProductInProject, keywords: string[]): string => {
    if (!product.customAttributes) return '';
    const attr = product.customAttributes.find(a => 
      keywords.some(keyword => a.key.toLowerCase().includes(keyword.toLowerCase()))
    );
    return attr?.value || '';
  };

  // Generiere Daten für die Tabelle
  const generateTableData = () => {
    return filteredProducts.map(product => {
      const row: Record<string, string> = {};
      
      selectedColumns.forEach(column => {
        if (column.enabled) {
          switch (column.id) {
            case 'product_id_external':
              row[column.label] = product.articleNumber || product.id || '';
              break;
            case 'product_name':
              row[column.label] = product.name || '';
              break;
            case 'product_description':
              row[column.label] = product.previewText || '';
              break;
            case 'article_number':
              row[column.label] = product.articleNumber || '';
              break;
            case 'manufacturer_external_id':
              row[column.label] = getExtractedValue(product, 'manufacturer') || findAttribute(product, ['hersteller', 'manufacturer']) || '';
              break;
            case 'brand_name':
              row[column.label] = getExtractedValue(product, 'manufacturer') || findAttribute(product, ['marke', 'brand', 'hersteller']) || '';
              break;
            case 'ean':
              row[column.label] = getExtractedValue(product, 'ean') || findAttribute(product, ['ean', 'gtin']) || '';
              break;
            case 'manufacturer_article_number':
              row[column.label] = product.articleNumber?.replace(/^[A-Z]{2}/, '') || '';
              break;
            case 'price':
              row[column.label] = getExtractedValue(product, 'price') || findAttribute(product, ['preis', 'price']) || '';
              break;
            case 'height':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('höhe') || attr.key.toLowerCase().includes('height')
              )?.value || '';
              break;
            case 'width':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('breite') || attr.key.toLowerCase().includes('width')
              )?.value || '';
              break;
            case 'length':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('länge') || attr.key.toLowerCase().includes('length')
              )?.value || '';
              break;
            case 'weight':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('gewicht') || attr.key.toLowerCase().includes('weight')
              )?.value || '';
              break;
            case 'diameter_mm':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('durchmesser') || attr.key.toLowerCase().includes('diameter')
              )?.value || '';
              break;
            case 'voltage_v':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('spannung') || attr.key.toLowerCase().includes('voltage')
              )?.value || '';
              break;
            case 'capacity_mah':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('kapazität') || attr.key.toLowerCase().includes('capacity')
              )?.value || '';
              break;
            case 'power_w':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('leistung') || attr.key.toLowerCase().includes('power')
              )?.value || '';
              break;
            case 'delivery_scope':
              row[column.label] = product.customAttributes?.find(attr => 
                attr.key.toLowerCase().includes('lieferumfang') || attr.key.toLowerCase().includes('scope')
              )?.value || '';
              break;
            case 'product_image':
            case 'product_media':
            case 'variant_image':
            case 'variant_media':
              // Convert all image filenames to full URLs
              const baseUrl = window.location.origin;
              if (product.files && Array.isArray(product.files)) {
                row[column.label] = product.files.map((f: any) => {
                  const filename = f.fileName || f.filename || '';
                  if (filename) {
                    return `${baseUrl}/product-images/${filename}`;
                  }
                  return '';
                }).filter(url => url).join(', ');
              } else {
                row[column.label] = '';
              }
              break;
            default:
              row[column.label] = 'TBD';
          }
        }
      });
      
      return row;
    });
  };

  const tableData = generateTableData();
  const enabledColumns = selectedColumns.filter(col => col.enabled);

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.map(col => 
        col.id === columnId ? { ...col, enabled: !col.enabled } : col
      )
    );
  };

  const handleExport = () => {
    const csvData = tableData;
    const csv = Papa.unparse(csvData, {
      delimiter: ";",
      header: true,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${projectName || 'brickfox'}_export.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsExportDialogOpen(false);
  };

  const getCategoryColumns = (category: string) => {
    return selectedColumns.filter(col => col.category === category);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Brickfox PIM Datenvorschau
            </CardTitle>
            <CardDescription>
              Tabellarische Übersicht aller Produktdaten für Brickfox PIM Export
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Spalten
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Spalten konfigurieren</DialogTitle>
                  <DialogDescription>
                    Wählen Sie die Spalten aus, die in der Datenvorschau angezeigt werden sollen.
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="product" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="product">Produkt</TabsTrigger>
                    <TabsTrigger value="variant">Varianten</TabsTrigger>
                    <TabsTrigger value="attributes">Attribute</TabsTrigger>
                    <TabsTrigger value="variations">Variationen</TabsTrigger>
                  </TabsList>
                  
                  {['product', 'variant', 'attributes', 'variations'].map(category => (
                    <TabsContent key={category} value={category} className="space-y-2">
                      <div className="grid gap-2 max-h-60 overflow-y-auto">
                        {getCategoryColumns(category).map(column => (
                          <div key={column.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={column.id}
                              checked={column.enabled}
                              onCheckedChange={() => handleColumnToggle(column.id)}
                            />
                            <Label htmlFor={column.id} className="flex-1 text-sm">
                              {column.label}
                              {column.required && <Badge variant="secondary" className="ml-2">Erforderlich</Badge>}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Brickfox PIM Export</DialogTitle>
                  <DialogDescription>
                    Exportieren Sie die Produktdaten im Brickfox PIM Format.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>Es werden {enabledColumns.length} Spalten exportiert:</p>
                    <ul className="mt-2 space-y-1">
                      {enabledColumns.slice(0, 5).map(col => (
                        <li key={col.id}>• {col.label}</li>
                      ))}
                      {enabledColumns.length > 5 && (
                        <li>• ... und {enabledColumns.length - 5} weitere</li>
                      )}
                    </ul>
                  </div>
                  <Button onClick={handleExport} className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Als CSV exportieren
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Suchfeld */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Produkte durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="outline">
              {filteredProducts.length} Produkt{filteredProducts.length !== 1 ? 'e' : ''}
            </Badge>
          </div>

          {/* Tabelle */}
          <div className="border rounded-md">
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    {enabledColumns.map(column => (
                      <TableHead key={column.id} className="min-w-[150px]">
                        <div className="flex items-center gap-2">
                          {column.label}
                          {column.required && (
                            <Badge variant="destructive" className="text-xs">*</Badge>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, index) => (
                    <TableRow key={index}>
                      {enabledColumns.map(column => (
                        <TableCell key={column.id} className="max-w-[200px]">
                          <div className="truncate" title={row[column.label]}>
                            {row[column.label] || '-'}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Hinweise */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Hinweise:</strong></p>
            <p>• "TBD" = To Be Determined (noch zu bestimmen)</p>
            <p>• Custom Attributes werden automatisch in entsprechende Brickfox-Felder gemappt</p>
            <p>• Erforderliche Felder (*) sollten vor dem Export ausgefüllt werden</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

