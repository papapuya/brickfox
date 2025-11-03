import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { apiDownload, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, Trash2, Upload, Download, Calendar, FolderOpen, Table, TrendingUp, CheckCircle, XCircle, FileSpreadsheet, Settings2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { Project, ProductInProject, ExportColumn } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { FieldMappingEditor } from "@/components/field-mapping-editor";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "pixi">("products");
  const [selectedProduct, setSelectedProduct] = useState<ProductInProject | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  
  // Pixi comparison state
  const [isPixiDialogOpen, setIsPixiDialogOpen] = useState(false);
  const [pixiSupplNr, setPixiSupplNr] = useState('');
  const [pixiLoading, setPixiLoading] = useState(false);
  const [pixiResults, setPixiResults] = useState<any>(null);

  // Brickfox preview state
  const [isBrickfoxPreviewOpen, setIsBrickfoxPreviewOpen] = useState(false);
  const [brickfoxPreviewData, setBrickfoxPreviewData] = useState<any[]>([]);
  const [brickfoxLoading, setBrickfoxLoading] = useState(false);
  
  // Field Mapping state
  const [isFieldMappingOpen, setIsFieldMappingOpen] = useState(false);
  
  // Pagination for product table
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 6;

  const defaultColumns: ExportColumn[] = [
    // Basis-Informationen
    { id: 'articleNumber', label: 'Artikelnummer', field: 'articleNumber', enabled: true },
    { id: 'name', label: 'Produktname', field: 'name', enabled: true },
    { id: 'exactProductName', label: 'Exakter Produktname', field: 'exactProductName', enabled: false },
    
    // Beschreibungen
    { id: 'htmlCode', label: 'HTML-Beschreibung', field: 'htmlCode', enabled: true },
    { id: 'previewText', label: 'Fließtext', field: 'previewText', enabled: false },
    { id: 'seoBeschreibung', label: 'SEO Beschreibung', field: 'seoBeschreibung', enabled: false },
    { id: 'kurzbeschreibung', label: 'Kurzbeschreibung', field: 'kurzbeschreibung', enabled: false },
    
    // Produktdaten
    { id: 'ean', label: 'EAN', field: 'ean', enabled: false },
    { id: 'manufacturer', label: 'Hersteller', field: 'manufacturer', enabled: false },
    { id: 'category', label: 'Kategorie', field: 'category', enabled: false },
    
    // Preise
    { id: 'vk', label: 'VK (Verkaufspreis)', field: 'vk', enabled: false },
    { id: 'ek', label: 'EK (Einkaufspreis)', field: 'ek', enabled: false },
    { id: 'uvp', label: 'UVP', field: 'uvp', enabled: false },
    
    // Bilder & Medien
    { id: 'files', label: 'Produktbilder (URLs)', field: 'files', enabled: true },
    
    // Maße & Gewicht
    { id: 'weight', label: 'Gewicht', field: 'weight', enabled: false },
    { id: 'height', label: 'Höhe', field: 'height', enabled: false },
    { id: 'width', label: 'Breite', field: 'width', enabled: false },
    { id: 'length', label: 'Länge', field: 'length', enabled: false },
    
    // Meta-Daten
    { id: 'createdAt', label: 'Erstellt am', field: 'createdAt', enabled: false },
    { id: 'status', label: 'Status', field: 'status', enabled: false },
  ];

  const [selectedColumns, setSelectedColumns] = useState<ExportColumn[]>(defaultColumns);

  // Generate dynamic columns based on products' custom attributes
  const generateDynamicColumns = (products: ProductInProject[]): ExportColumn[] => {
    const baseColumns = [...defaultColumns];
    const customAttributeColumns = new Map<string, ExportColumn>();

    // Extract all unique custom attributes from all products
    products.forEach(product => {
      if (product.customAttributes && product.customAttributes.length > 0) {
        product.customAttributes.forEach(attr => {
          if (!customAttributeColumns.has(attr.key)) {
            customAttributeColumns.set(attr.key, {
              id: `custom_${attr.key}`,
              label: attr.key,
              field: `custom_${attr.key}`,
              enabled: false, // Custom attributes are disabled by default
            });
          }
        });
      }
    });

    // Add custom attribute columns
    customAttributeColumns.forEach((column, key) => {
      if (!baseColumns.find(col => col.id === column.id)) {
        baseColumns.push(column);
      }
    });

    console.log('Generated dynamic columns:', baseColumns.length, 'total columns');
    console.log('Custom attribute columns:', customAttributeColumns.size);
    
    return baseColumns;
  };

  // Fetch project
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: [`/api/projects/${id}`],
    enabled: !!id,
  });

  // Fetch products
  const { data: productsData, isLoading: isLoadingProducts } = useQuery<{ success: boolean; products: ProductInProject[] }>({
    queryKey: [`/api/projects/${id}/products`],
    enabled: !!id,
  });

  const products = productsData?.products || [];

  // Update columns when products change
  const dynamicColumns = generateDynamicColumns(products);

  // Update selectedColumns when dynamic columns change
  useEffect(() => {
    // Always sync selectedColumns with dynamicColumns to ensure all columns are available
    setSelectedColumns(prev => {
      const updatedColumns = [...prev];
      
      // Add new columns that don't exist yet
      dynamicColumns.forEach(dynCol => {
        if (!updatedColumns.find(col => col.id === dynCol.id)) {
          updatedColumns.push(dynCol);
        }
      });
      
      // Remove columns that no longer exist
      return updatedColumns.filter(col => 
        dynamicColumns.find(dynCol => dynCol.id === col.id)
      );
    });
  }, [dynamicColumns]);

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest('DELETE', `/api/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/products`] });
      // Invalidate all product-counts queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === '/api/projects/product-counts'
      });
      setIsProductDialogOpen(false);
      setSelectedProduct(null);
      toast({
        title: "Produkt gelöscht",
        description: "Das Produkt wurde erfolgreich gelöscht.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Produkt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteProduct = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    if (confirm("Möchten Sie dieses Produkt wirklich löschen?")) {
      deleteProductMutation.mutate(productId);
    }
  };

  const handleProductClick = (product: ProductInProject) => {
    setSelectedProduct(product);
    setIsProductDialogOpen(true);
  };

  const handleOpenPixiDialog = async () => {
    try {
      const response = await apiRequest('GET', '/api/suppliers');
      const data = await response.json() as { suppliers: Array<{ id: string; name: string; supplNr?: string }> };
      
      if (data.suppliers && data.suppliers.length > 0) {
        const suppliersWithNr = data.suppliers.filter((s: { id: string; name: string; supplNr?: string }) => s.supplNr);
        
        if (suppliersWithNr.length >= 1) {
          setPixiSupplNr(suppliersWithNr[0].supplNr || '');
        } else {
          setPixiSupplNr('');
        }
      } else {
        setPixiSupplNr('');
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast({
        title: "Hinweis",
        description: "Lieferanten konnten nicht geladen werden",
        variant: "default",
      });
    }
    
    setIsPixiDialogOpen(true);
  };

  const handleBrickfoxPreview = async () => {
    try {
      setBrickfoxLoading(true);
      
      const data = await apiPost<{ success: boolean; rows: any[]; error?: string }>(
        '/api/brickfox/preview',
        { projectId: id }
      );

      if (data.success && data.rows) {
        setBrickfoxPreviewData(data.rows);
        setIsBrickfoxPreviewOpen(true);
      } else {
        throw new Error(data.error || 'Vorschau konnte nicht geladen werden');
      }
    } catch (error: any) {
      console.error('[Brickfox Preview] Error:', error);
      toast({
        title: "Vorschau fehlgeschlagen",
        description: error.message || "Fehler beim Laden der Brickfox-Vorschau",
        variant: "destructive",
      });
    } finally {
      setBrickfoxLoading(false);
    }
  };

  const handleBrickfoxExport = async () => {
    try {
      toast({
        title: "Export gestartet",
        description: "Brickfox CSV wird generiert...",
      });

      await apiDownload(
        '/api/brickfox/export',
        { projectId: id },
        `brickfox-export-${id}.csv`
      );

      toast({
        title: "Export erfolgreich",
        description: "Brickfox CSV wurde heruntergeladen",
      });
      
      setIsBrickfoxPreviewOpen(false);
    } catch (error) {
      console.error('[Brickfox Export] Error:', error);
      toast({
        title: "Export fehlgeschlagen",
        description: "Fehler beim Exportieren der Brickfox CSV",
        variant: "destructive",
      });
    }
  };

  const handlePixiCompare = async () => {
    if (!pixiSupplNr) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine Lieferantennummer ein",
        variant: "destructive",
      });
      return;
    }

    setPixiLoading(true);
    setPixiResults(null);

    try {
      // Convert project products to CSV format expected by Pixi API
      const csvProducts = products.map(p => ({
        Artikelnummer: p.customAttributes?.find(a => a.key === 'artikelnummer')?.value || p.articleNumber || '',
        Produktname: p.name || '',
        EAN: p.customAttributes?.find(a => a.key === 'ean')?.value || '',
        Hersteller: p.customAttributes?.find(a => a.key === 'hersteller')?.value || '',
      }));

      const token = localStorage.getItem('supabase_token');
      const response = await fetch('/api/pixi/compare-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          products: csvProducts,
          supplNr: pixiSupplNr,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Vergleich fehlgeschlagen');
      }

      setPixiResults(data);
      setIsPixiDialogOpen(false);
      setActiveTab('pixi');
      
      toast({
        title: "Pixi-Vergleich abgeschlossen",
        description: `${data.summary.neu} neue, ${data.summary.vorhanden} vorhandene Produkte`,
      });
    } catch (err: any) {
      toast({
        title: "Fehler",
        description: err.message || 'Pixi-Vergleich fehlgeschlagen',
        variant: "destructive",
      });
    } finally {
      setPixiLoading(false);
    }
  };

  const downloadPixiResults = () => {
    if (!pixiResults) return;

    const csvContent = [
      ['Artikelnummer', 'Produktname', 'EAN', 'Hersteller', 'Pixi Status', 'Pixi EAN'].join(';'),
      ...pixiResults.products.map((p: any) => 
        [
          p.artikelnummer,
          `"${p.produktname}"`,
          p.ean,
          p.hersteller,
          p.pixi_status,
          p.pixi_ean || ''
        ].join(';')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project?.name || 'projekt'}_pixi-vergleich.csv`;
    link.click();
  };

  const handleExportProject = () => {
    if (products.length === 0) {
      toast({
        title: "Keine Produkte",
        description: "Es gibt keine Produkte zum Exportieren.",
        variant: "destructive",
      });
      return;
    }

    const enabledColumns = selectedColumns.filter(col => col.enabled);
    
    // Get the base URL for images
    const baseUrl = window.location.origin;
    
    const csvData = products.map(product => {
      const row: Record<string, string> = {};
      enabledColumns.forEach(col => {
        if (col.field.startsWith('custom_')) {
          // Handle custom attributes
          const attrKey = col.field.replace('custom_', '');
          const customAttr = product.customAttributes?.find(attr => attr.key === attrKey);
          row[col.label] = customAttr?.value || '';
        } else {
          const value = product[col.field as keyof ProductInProject];
          
          // Special handling for specific fields
          if (col.field === 'createdAt' && value) {
            row[col.label] = format(new Date(value as string), "dd.MM.yyyy HH:mm");
          } else if (col.field === 'files' && Array.isArray(value)) {
            // Convert all image filenames to full URLs
            row[col.label] = value.map((f: any) => {
              const filename = f.fileName || f.filename || '';
              if (filename) {
                return `${baseUrl}/product-images/${filename}`;
              }
              return '';
            }).filter(url => url).join(', ');
          } else if (col.field === 'ean' || col.field === 'manufacturer' || col.field === 'category' || 
                     col.field === 'vk' || col.field === 'ek' || col.field === 'uvp' ||
                     col.field === 'weight' || col.field === 'height' || col.field === 'width' || col.field === 'length') {
            // Try to extract from extractedData first
            if (product.extractedData && product.extractedData.length > 0) {
              try {
                const extracted = JSON.parse(product.extractedData[0].extractedText || '{}');
                row[col.label] = extracted[col.field] || '';
              } catch {
                row[col.label] = '';
              }
            } else {
              row[col.label] = '';
            }
          } else {
            row[col.label] = String(value || '');
          }
        }
      });
      return row;
    });

    const csv = Papa.unparse(csvData, {
      delimiter: ";",
      header: true,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${project?.name || 'projekt'}_export.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsExportDialogOpen(false);
    toast({
      title: "Export erfolgreich",
      description: `${products.length} Produkt${products.length !== 1 ? 'e' : ''} wurden exportiert.`,
    });
  };

  if (!project && !isLoadingProject && !isLoadingProducts) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Projekt nicht gefunden</h2>
          <Button onClick={() => setLocation('/projects')} data-testid="button-back-to-projects">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zu Projekten
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/projects')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zu Projekten
          </Button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{project?.name}</h1>
              {project && (
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Erstellt am {format(new Date(project.createdAt), "dd. MMMM yyyy", { locale: de })}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleOpenPixiDialog}
                disabled={products.length === 0}
                data-testid="button-pixi-compare"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Mit Pixi vergleichen
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsFieldMappingOpen(true)}
                disabled={products.length === 0}
                data-testid="button-field-mapping"
                className="border-purple-600 text-purple-600 hover:bg-purple-50"
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Field Mapping
              </Button>
              <Button
                variant="default"
                onClick={handleBrickfoxPreview}
                disabled={products.length === 0 || brickfoxLoading}
                data-testid="button-brickfox-preview"
                className="bg-green-600 hover:bg-green-700"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {brickfoxLoading ? "Lade Vorschau..." : "Brickfox CSV Vorschau"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(true)}
                disabled={products.length === 0}
                data-testid="button-export-project"
              >
                <Download className="w-4 h-4 mr-2" />
                Projekt exportieren
              </Button>
              <Button
                onClick={() => setLocation('/url-scraper')}
                data-testid="button-add-product"
              >
                <Plus className="w-4 h-4 mr-2" />
                Neues Produkt
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs für verschiedene Ansichten */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "products" | "pixi")} className="mb-6">
          <TabsList>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Produkte ({products.length})
            </TabsTrigger>
            <TabsTrigger value="pixi" className="flex items-center gap-2" disabled={!pixiResults}>
              <TrendingUp className="w-4 h-4" />
              Pixi Vergleich {pixiResults && `(${pixiResults.summary.total})`}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="products" className="mt-6">
            {/* Products Table */}
            {isLoadingProducts ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-muted rounded"></div>
                    <div className="h-10 bg-muted rounded"></div>
                    <div className="h-10 bg-muted rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ) : products.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Noch keine Produkte</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Fügen Sie Ihr erstes Produkt hinzu, um mit der Beschreibung zu beginnen
                  </p>
                  <Button
                    onClick={() => setLocation('/url-scraper')}
                    data-testid="button-add-first-product"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Produkt erstellen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Gescrapte Produktdaten</CardTitle>
                  <CardDescription>{products.length} Produkte</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0 z-10">
                        <tr>
                          <th className="text-left p-3 font-medium sticky left-0 bg-muted z-20">Produktname</th>
                          <th className="text-left p-3 font-medium">Artikelnr.</th>
                          {/* Dynamic columns from extractedData */}
                          {(() => {
                            const allKeys = new Set<string>();
                            products.forEach(product => {
                              const extractedData = product.extractedData || [];
                              console.log('Product extracted data:', product.id, extractedData);
                              if (Array.isArray(extractedData)) {
                                extractedData.forEach((item: any) => allKeys.add(item.key));
                              } else if (typeof extractedData === 'object') {
                                Object.keys(extractedData).forEach(key => allKeys.add(key));
                              }
                              // Also check customAttributes
                              const customAttrs = product.customAttributes || [];
                              console.log('Product custom attributes:', product.id, customAttrs);
                              if (Array.isArray(customAttrs)) {
                                customAttrs.forEach((item: any) => allKeys.add(item.key));
                              } else if (typeof customAttrs === 'object') {
                                Object.keys(customAttrs).forEach(key => allKeys.add(key));
                              }
                            });
                            console.log('All unique keys found:', Array.from(allKeys));
                            return Array.from(allKeys).map(key => (
                              <th key={key} className="text-left p-3 font-medium whitespace-nowrap">
                                {key.charAt(0).toUpperCase() + key.slice(1)}
                              </th>
                            ));
                          })()}
                          <th className="text-left p-3 font-medium">Erstellt</th>
                          <th className="text-right p-3 font-medium sticky right-0 bg-muted z-20">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {products
                          .slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage)
                          .map((product) => {
                          const extractedData = product.extractedData || [];
                          const customAttrs = product.customAttributes || [];
                          
                          const getExtractedValue = (key: string) => {
                            // Try extractedData first
                            if (Array.isArray(extractedData)) {
                              const item = extractedData.find((d: any) => d.key === key) as any;
                              if (item?.value) return item.value;
                            } else if (typeof extractedData === 'object') {
                              const value = (extractedData as any)[key];
                              if (value) return value;
                            }
                            
                            // Then try customAttributes
                            if (Array.isArray(customAttrs)) {
                              const item = customAttrs.find((d: any) => d.key === key) as any;
                              if (item?.value) return item.value;
                            } else if (typeof customAttrs === 'object') {
                              const value = (customAttrs as any)[key];
                              if (value) return value;
                            }
                            
                            return '-';
                          };

                          // Get all unique keys from all products (including customAttributes)
                          const allKeys = new Set<string>();
                          products.forEach(p => {
                            const data = p.extractedData || [];
                            if (Array.isArray(data)) {
                              data.forEach((item: any) => allKeys.add(item.key));
                            } else if (typeof data === 'object') {
                              Object.keys(data).forEach(key => allKeys.add(key));
                            }
                            
                            const attrs = p.customAttributes || [];
                            if (Array.isArray(attrs)) {
                              attrs.forEach((item: any) => allKeys.add(item.key));
                            } else if (typeof attrs === 'object') {
                              Object.keys(attrs).forEach(key => allKeys.add(key));
                            }
                          });
                          
                          return (
                            <tr key={product.id} className="hover:bg-muted/50">
                              <td className="p-3 max-w-[250px] truncate sticky left-0 bg-background z-10">
                                {product.name || product.exactProductName || '-'}
                              </td>
                              <td className="p-3">{product.articleNumber || '-'}</td>
                              {/* Dynamic columns */}
                              {Array.from(allKeys).map(key => (
                                <td key={key} className="p-3 max-w-[200px] truncate">
                                  {getExtractedValue(key)}
                                </td>
                              ))}
                              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(product.createdAt), "dd.MM.yyyy", { locale: de })}
                              </td>
                              <td className="p-3 text-right sticky right-0 bg-background z-10">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleProductClick(product)}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteProduct(e, product.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {products.length > productsPerPage && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                      <div className="text-sm text-muted-foreground">
                        Zeige {((currentPage - 1) * productsPerPage) + 1} bis {Math.min(currentPage * productsPerPage, products.length)} von {products.length} Produkten
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
                          {Array.from({ length: Math.ceil(products.length / productsPerPage) }, (_, i) => i + 1).map((page) => (
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
                          onClick={() => setCurrentPage(Math.min(Math.ceil(products.length / productsPerPage), currentPage + 1))}
                          disabled={currentPage === Math.ceil(products.length / productsPerPage)}
                        >
                          Weiter
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pixi" className="mt-6">
            {pixiResults && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Pixi ERP Vergleich
                      </CardTitle>
                      <CardDescription>
                        {pixiResults.summary.total} Produkte verglichen
                      </CardDescription>
                    </div>
                    <Button onClick={downloadPixiResults} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      CSV Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Statistiken */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{pixiResults.summary.total}</div>
                          <div className="text-xs text-muted-foreground">Gesamt</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">{pixiResults.summary.neu}</div>
                          <div className="text-xs text-green-700">Neu</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-700">{pixiResults.summary.vorhanden}</div>
                          <div className="text-xs text-blue-700">Vorhanden</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tabelle */}
                  <div className="border rounded-md">
                    <div className="max-h-[500px] overflow-auto">
                      <table className="w-full">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">Status</th>
                            <th className="text-left p-3 text-sm font-medium">Artikelnummer</th>
                            <th className="text-left p-3 text-sm font-medium">Produktname</th>
                            <th className="text-left p-3 text-sm font-medium">EAN</th>
                            <th className="text-left p-3 text-sm font-medium">Hersteller</th>
                            <th className="text-left p-3 text-sm font-medium">Pixi EAN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pixiResults.products.map((product: any, idx: number) => (
                            <tr key={idx} className="border-t hover:bg-muted/50">
                              <td className="p-3">
                                {product.pixi_status === 'NEU' ? (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    NEU
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    VORHANDEN
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-sm">{product.artikelnummer}</td>
                              <td className="p-3 text-sm">{product.produktname}</td>
                              <td className="p-3 text-sm font-mono text-xs">{product.ean}</td>
                              <td className="p-3 text-sm">{product.hersteller}</td>
                              <td className="p-3 text-sm font-mono text-xs">{product.pixi_ean || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Pixi Comparison Dialog */}
        <Dialog open={isPixiDialogOpen} onOpenChange={setIsPixiDialogOpen}>
          <DialogContent data-testid="dialog-pixi-compare">
            <DialogHeader>
              <DialogTitle>Mit Pixi ERP vergleichen</DialogTitle>
              <DialogDescription>
                Vergleichen Sie die Produkte dieses Projekts mit Ihrem Pixi ERP-System
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pixi-supplnr">Lieferantennummer</Label>
                <Input
                  id="pixi-supplnr"
                  placeholder="z.B. 7077"
                  value={pixiSupplNr}
                  onChange={(e) => setPixiSupplNr(e.target.value)}
                  disabled={pixiLoading}
                />
                <p className="text-xs text-muted-foreground">
                  {products.length} Produkt{products.length !== 1 ? 'e' : ''} werden verglichen
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsPixiDialogOpen(false)}
                disabled={pixiLoading}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handlePixiCompare}
                disabled={pixiLoading || !pixiSupplNr}
              >
                {pixiLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Vergleichen...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Vergleichen
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Detail Dialog */}
        <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-product-detail">
            <DialogHeader>
              <DialogTitle>{selectedProduct?.name || 'Produktdetails'}</DialogTitle>
              <DialogDescription>
                {selectedProduct && format(new Date(selectedProduct.createdAt), "dd. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
              </DialogDescription>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-6 mt-4">
                {/* Custom Attributes */}
                {selectedProduct.customAttributes && selectedProduct.customAttributes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Produktattribute
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedProduct.customAttributes.map((attr, idx) => (
                        <div key={idx} className="rounded-md border p-3">
                          <div className="text-xs text-muted-foreground mb-1">{attr.key}</div>
                          <div className="text-sm">{attr.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HTML Description */}
                {selectedProduct.htmlCode && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      HTML-Beschreibung
                    </h3>
                    <div 
                      className="prose prose-sm max-w-none border rounded-md p-4 bg-muted/30"
                      dangerouslySetInnerHTML={{ __html: selectedProduct.htmlCode }}
                    />
                  </div>
                )}

                {/* Preview Text */}
                {selectedProduct.previewText && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Fließtext
                    </h3>
                    <div className="border rounded-md p-4 bg-muted/30 text-sm whitespace-pre-wrap">
                      {selectedProduct.previewText}
                    </div>
                  </div>
                )}

                {/* Files */}
                {selectedProduct.files && selectedProduct.files.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Dateien ({selectedProduct.files.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedProduct.files.map((file: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm border rounded-md p-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>{file.fileName || file.filename || `Datei ${idx + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="destructive"
                    onClick={(e) => {
                      if (confirm("Möchten Sie dieses Produkt wirklich löschen?")) {
                        deleteProductMutation.mutate(selectedProduct.id);
                      }
                    }}
                    disabled={deleteProductMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteProductMutation.isPending ? "Wird gelöscht..." : "Produkt löschen"}
                  </Button>
                  <Button onClick={() => setIsProductDialogOpen(false)}>
                    Schließen
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent data-testid="dialog-export-project">
            <DialogHeader>
              <DialogTitle>Projekt exportieren</DialogTitle>
              <DialogDescription>
                Wählen Sie die Spalten für den CSV-Export
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Select All Controls */}
              <div className="flex items-center gap-4 pb-3 border-b">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedColumns(prev => {
                      const updated = [...prev];
                      dynamicColumns.forEach(dynCol => {
                        const existingIndex = updated.findIndex(col => col.id === dynCol.id);
                        if (existingIndex >= 0) {
                          updated[existingIndex] = { ...updated[existingIndex], enabled: true };
                        } else {
                          updated.push({ ...dynCol, enabled: true });
                        }
                      });
                      return updated;
                    });
                  }}
                >
                  Alle auswählen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedColumns(prev => {
                      const updated = [...prev];
                      dynamicColumns.forEach(dynCol => {
                        const existingIndex = updated.findIndex(col => col.id === dynCol.id);
                        if (existingIndex >= 0) {
                          updated[existingIndex] = { ...updated[existingIndex], enabled: false };
                        } else {
                          updated.push({ ...dynCol, enabled: false });
                        }
                      });
                      return updated;
                    });
                  }}
                >
                  Alle abwählen
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selectedColumns.filter(col => col.enabled).length} von {dynamicColumns.length} ausgewählt
                </span>
              </div>

              {/* Column List */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {dynamicColumns.map((col) => {
                  const selectedCol = selectedColumns.find(sc => sc.id === col.id);
                  const isChecked = selectedCol ? selectedCol.enabled : col.enabled;
                  
                  return (
                    <div key={col.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={col.id}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          setSelectedColumns(prev =>
                            prev.map(c => c.id === col.id ? { ...c, enabled: !!checked } : c)
                          );
                        }}
                        data-testid={`checkbox-export-${col.id}`}
                      />
                      <Label htmlFor={col.id} className="text-sm font-normal cursor-pointer">
                        {col.label}
                        {col.field.startsWith('custom_') && (
                          <span className="ml-2 text-xs text-muted-foreground">(Custom)</span>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
                data-testid="button-cancel-export"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleExportProject}
                disabled={!selectedColumns.some(col => col.enabled)}
                data-testid="button-confirm-export"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportieren
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Brickfox Preview Dialog */}
        <Dialog open={isBrickfoxPreviewOpen} onOpenChange={setIsBrickfoxPreviewOpen}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Brickfox CSV Vorschau</DialogTitle>
              <DialogDescription>
                Überprüfen Sie die Brickfox-Daten vor dem Export ({brickfoxPreviewData.length} Produkte)
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-md">
              {brickfoxPreviewData.length > 0 && brickfoxPreviewData[0] ? (
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {Object.keys(brickfoxPreviewData[0]).map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-medium border-b whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {brickfoxPreviewData.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        {Object.values(row).map((value: any, cellIdx) => (
                          <td key={cellIdx} className="px-3 py-2 max-w-xs truncate" title={String(value || '')}>
                            {String(value || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : brickfoxPreviewData.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Keine Daten vorhanden
                </div>
              ) : null}
              {brickfoxPreviewData.length > 50 && (
                <div className="p-3 text-sm text-muted-foreground border-t bg-muted/30">
                  Zeige 50 von {brickfoxPreviewData.length} Produkten. Alle Daten werden beim Export eingeschlossen.
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                <strong>{brickfoxPreviewData.length}</strong> Produkte werden exportiert
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsBrickfoxPreviewOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleBrickfoxExport}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Jetzt exportieren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Field Mapping Dialog */}
        <Dialog open={isFieldMappingOpen} onOpenChange={setIsFieldMappingOpen}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Field Mapping - Brickfox CSV</DialogTitle>
              <DialogDescription>
                Mappen Sie die Produktfelder zu Brickfox-Feldern für den CSV-Export
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <FieldMappingEditor
                projectId={id}
                sourceType="csv"
                onSave={(mappings) => {
                  toast({
                    title: "Mapping gespeichert",
                    description: `${mappings.length} Feld-Mappings wurden gespeichert`,
                  });
                  setIsFieldMappingOpen(false);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
