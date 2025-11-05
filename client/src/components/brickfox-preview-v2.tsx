import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import type { ProductInProject } from "@shared/schema";
import { apiDownload, apiPost } from "@/lib/api";
import { UnifiedDataPreview, type ColumnConfig } from "./unified-data-preview";
import { useToast } from "@/hooks/use-toast";

interface BrickfoxRow {
  [key: string]: string | number | boolean | null;
}

interface BrickfoxPreviewV2Props {
  products: ProductInProject[];
  projectName?: string;
  projectId: string;
  supplierId?: string;
}

export default function BrickfoxPreviewV2({ 
  products, 
  projectName, 
  projectId, 
  supplierId 
}: BrickfoxPreviewV2Props) {
  const [brickfoxData, setBrickfoxData] = useState<BrickfoxRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load Brickfox preview data from API
  const loadPreviewData = async () => {
    if (!projectId) {
      setError('No project ID provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiPost<{ success: boolean; rows: any[]; error?: string }>(
        '/api/brickfox/preview',
        { projectId, supplierId }
      );
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate Brickfox preview');
      }

      setBrickfoxData(data.rows || []);
      toast({
        title: "Vorschau geladen",
        description: `${data.rows?.length || 0} Produkte erfolgreich verarbeitet`,
      });
    } catch (err: any) {
      console.error('[Brickfox Preview] Error:', err);
      setError(err.message || 'Failed to load Brickfox preview');
      toast({
        title: "Fehler",
        description: err.message || 'Vorschau konnte nicht geladen werden',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadPreviewData();
  }, [projectId, supplierId]);

  // Generate columns from data
  const columns: ColumnConfig[] = useMemo(() => {
    if (brickfoxData.length === 0) return [];
    
    const allKeys = Object.keys(brickfoxData[0]);
    
    // Important columns that should be visible by default
    const importantColumns = [
      'p_item_number',
      'p_name[de]',
      'v_manufacturers_item_number',
      'v_supplier_item_number',
      'v_ean',
      'v_purchase_price',
      'v_price[Eur]',
      'v_brand',
    ];
    
    return allKeys.map(key => ({
      key,
      label: key,
      visible: importantColumns.includes(key),
      required: key === 'p_item_number', // Item number is required
    }));
  }, [brickfoxData]);

  // Export to CSV via Backend API
  const handleExport = async () => {
    if (!projectId) {
      toast({
        title: "Fehler",
        description: "Projekt-ID fehlt - Export nicht möglich",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiDownload(
        '/api/brickfox/export',
        { projectId, supplierId },
        `${projectName || 'brickfox'}_export.csv`
      );
      
      toast({
        title: "Export erfolgreich",
        description: "CSV-Datei wurde heruntergeladen",
      });
    } catch (err: any) {
      console.error('[Brickfox Export] Error:', err);
      toast({
        title: "Export fehlgeschlagen",
        description: err.message || 'CSV-Export konnte nicht erstellt werden',
        variant: "destructive",
      });
    }
  };

  if (error && !isLoading && brickfoxData.length === 0) {
    return (
      <div className="text-center py-12 text-destructive">
        <p className="font-medium">Fehler beim Laden der Vorschau</p>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={loadPreviewData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (isLoading && brickfoxData.length === 0) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-4">
          Brickfox-Vorschau wird generiert...
        </p>
      </div>
    );
  }

  return (
    <UnifiedDataPreview
      data={brickfoxData}
      columns={columns}
      title="Brickfox CSV Vorschau"
      description={`${brickfoxData.length} Produkte • ${columns.length} Felder • ${projectName || 'Projekt'}`}
      emptyMessage="Keine Produkte zum Exportieren gefunden"
      enableColumnSelection={true}
      enableExport={true}
      enablePagination={true}
      enableSearch={true}
      enableRowNumbers={true}
      itemsPerPage={10}
      exportFileName={`${projectName || 'brickfox'}_export`}
      onExport={handleExport}
      stickyHeader={true}
      showOnlyFilledFields={true}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadPreviewData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Neu laden
        </Button>
      }
    />
  );
}
