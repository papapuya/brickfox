/**
 * Pixi ERP API Integration Service
 * 
 * Provides methods to interact with the Pixi ERP system for product comparison
 * and inventory management.
 */

import type { ProductInProject, Supplier } from '@shared/schema';
import type { IStorage } from '../supabase-storage';

interface PixiItemSearchRequest {
  SupplNr: string;
}

interface PixiItemSearchResponse {
  data: Array<{
    ItemNrSuppl: string;
    EANUPC: string;
  }>;
}

interface PixiComparisonResult {
  artikelnummer: string;
  produktname: string;
  ean: string;
  hersteller: string;
  pixi_status: 'NEU' | 'VORHANDEN';
  pixi_ean: string | null;
}

interface PixiComparisonSummary {
  success: boolean;
  summary: {
    total: number;
    neu: number;
    vorhanden: number;
  };
  products: PixiComparisonResult[];
}

interface PixiSupabaseComparisonResult extends PixiComparisonResult {
  id: string;
  pixi_checked_at: string;
}

interface PixiSupabaseComparisonSummary {
  success: boolean;
  projectId: string;
  supplierId?: string;
  summary: {
    total: number;
    neu: number;
    vorhanden: number;
  };
  products: PixiSupabaseComparisonResult[];
}

interface CSVProduct {
  Artikelnummer?: string;
  Produktname?: string;
  EAN?: string;
  Hersteller?: string;
  [key: string]: any;
}

/**
 * Pixi ERP API Service
 */
export class PixiService {
  private apiUrl: string;
  private authToken: string;
  private cache: Map<string, { data: PixiItemSearchResponse; timestamp: number }>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.apiUrl = process.env.PIXI_API_URL || 'https://akkutools.laptopakku.eu/api/pixi/pixiItemSearch';
    this.authToken = process.env.PIXI_AUTH_TOKEN || '';
    this.cache = new Map();
  }

  /**
   * Search for items in Pixi ERP by supplier number
   * @param supplNr Supplier number (e.g., "7077")
   * @returns Pixi item search response
   */
  async searchItems(supplNr: string): Promise<PixiItemSearchResponse> {
    // Check cache first
    const cached = this.cache.get(supplNr);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[Pixi Service] Cache hit for supplier ${supplNr}`);
      return cached.data;
    }

    try {
      console.log(`[Pixi Service] Fetching items for supplier ${supplNr}`);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'X-AUTH-TOKEN': this.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ SupplNr: supplNr }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`Pixi API error: ${response.status} ${response.statusText}`);
      }

      const data: PixiItemSearchResponse = await response.json();
      
      // Cache the result
      this.cache.set(supplNr, { data, timestamp: Date.now() });
      
      console.log(`[Pixi Service] Found ${data.data?.length || 0} items for supplier ${supplNr}`);
      
      return data;
    } catch (error: any) {
      console.error(`[Pixi Service] Error fetching items:`, error.message);
      throw new Error(`Failed to fetch items from Pixi API: ${error.message}`);
    }
  }

  /**
   * Helper function to extract column value with flexible column name matching
   */
  private getColumnValue(product: any, possibleNames: string[]): string {
    for (const name of possibleNames) {
      const value = product[name];
      if (value !== undefined && value !== null && value !== '') {
        return typeof value === 'string' ? value.trim() : value.toString().trim();
      }
    }
    return '';
  }

  /**
   * Compare CSV products with Pixi inventory
   * @param products Array of products from CSV
   * @param supplNr Supplier number
   * @returns Comparison results with status (NEU/VORHANDEN)
   */
  async compareProducts(products: CSVProduct[], supplNr: string): Promise<PixiComparisonSummary> {
    try {
      // Log the column names from the first product to help debug
      if (products.length > 0) {
        const columnNames = Object.keys(products[0]);
        console.log(`[Pixi Service] CSV columns detected:`, columnNames);
      }

      // Fetch all items from Pixi for this supplier
      const pixiResponse = await this.searchItems(supplNr);
      const pixiItems = pixiResponse.data || [];

      // Create lookup maps for fast comparison
      const pixiByItemNr = new Map<string, { ItemNrSuppl: string; EANUPC: string }>();
      const pixiByEan = new Map<string, { ItemNrSuppl: string; EANUPC: string }>();

      pixiItems.forEach(item => {
        if (item.ItemNrSuppl) {
          pixiByItemNr.set(item.ItemNrSuppl.toUpperCase(), item);
        }
        if (item.EANUPC) {
          pixiByEan.set(item.EANUPC, item);
        }
      });

      // Compare each product
      const results: PixiComparisonResult[] = [];
      let neuCount = 0;
      let vorhandenCount = 0;

      for (const product of products) {
        // Flexible column name matching (supports German, English, various casings)
        const artikelnummer = this.getColumnValue(product, [
          'Artikelnummer', 'artikelnummer', 'ARTIKELNUMMER',
          'Article Number', 'ArticleNumber', 'article_number',
          'Item Number', 'ItemNumber', 'item_number',
          'SKU', 'sku', 'Art.-Nr.', 'Art.Nr.',
          'p_item_number', 'v_manufacturers_item_number'  // Export system columns
        ]);
        
        const produktname = this.getColumnValue(product, [
          'Produktname', 'produktname', 'PRODUKTNAME',
          'Product Name', 'ProductName', 'product_name',
          'Name', 'name', 'Bezeichnung', 'bezeichnung',
          'Description', 'description',
          'p_name[de]', 'p_name[en]', 'p_name'  // Export system columns
        ]);
        
        const ean = this.getColumnValue(product, [
          'EAN', 'ean', 'EAN-Code', 'EAN Code',
          'GTIN', 'gtin', 'Barcode', 'barcode',
          'UPC', 'upc', 'EAN/UPC',
          'v_ean', 'p_ean'  // Export system columns
        ]);
        
        const hersteller = this.getColumnValue(product, [
          'Hersteller', 'hersteller', 'HERSTELLER',
          'Manufacturer', 'manufacturer', 'Brand', 'brand',
          'Marke', 'marke', 'Supplier', 'supplier',
          'p_brand', 'v_brand'  // Export system columns
        ]);

        // Check if product exists in Pixi by article number
        const pixiItem = pixiByItemNr.get(artikelnummer.toUpperCase());
        
        // Optionally validate with EAN if both exist
        let isMatch = false;
        let matchedEan: string | null = null;

        if (pixiItem) {
          isMatch = true;
          matchedEan = pixiItem.EANUPC || null;
          
          // If EAN is provided in both systems, verify they match
          if (ean && pixiItem.EANUPC && ean !== pixiItem.EANUPC) {
            console.warn(
              `[Pixi Service] EAN mismatch for ${artikelnummer}: ` +
              `CSV=${ean}, Pixi=${pixiItem.EANUPC}`
            );
          }
        }

        const status: 'NEU' | 'VORHANDEN' = isMatch ? 'VORHANDEN' : 'NEU';
        
        if (status === 'NEU') {
          neuCount++;
        } else {
          vorhandenCount++;
        }

        results.push({
          artikelnummer,
          produktname,
          ean,
          hersteller,
          pixi_status: status,
          pixi_ean: matchedEan,
        });
      }

      return {
        success: true,
        summary: {
          total: products.length,
          neu: neuCount,
          vorhanden: vorhandenCount,
        },
        products: results,
      };
    } catch (error: any) {
      console.error('[Pixi Service] Comparison failed:', error.message);
      throw error;
    }
  }

  /**
   * Compare products from Supabase with Pixi inventory and update database
   * @param projectId Project ID to load products from
   * @param storage Supabase storage instance
   * @param supplierIdOrSupplNr Supplier ID or direct SupplNr
   * @returns Comparison results with updated database records
   */
  async compareProductsFromSupabase(
    projectId: string,
    storage: IStorage,
    supplierIdOrSupplNr: string
  ): Promise<PixiSupabaseComparisonSummary> {
    try {
      console.log(`[Pixi Service] Starting Supabase comparison for project ${projectId}`);

      // Load products from Supabase
      const products = await storage.getProducts(projectId);
      if (!products || products.length === 0) {
        throw new Error('No products found in project');
      }

      console.log(`[Pixi Service] Loaded ${products.length} products from Supabase`);

      // Determine SupplNr - either direct value or lookup from supplier
      let supplNr: string;
      let supplierId: string | undefined;

      if (supplierIdOrSupplNr.match(/^\d+$/)) {
        // Looks like a SupplNr (numeric)
        supplNr = supplierIdOrSupplNr;
      } else {
        // Assume it's a supplier ID
        supplierId = supplierIdOrSupplNr;
        const supplier = await storage.getSupplier(supplierId);
        
        if (!supplier) {
          throw new Error(`Supplier ${supplierId} not found`);
        }
        
        if (!supplier.supplNr) {
          throw new Error(`Supplier ${supplier.name} has no SupplNr configured`);
        }
        
        supplNr = supplier.supplNr;
        console.log(`[Pixi Service] Using SupplNr ${supplNr} from supplier ${supplier.name}`);
      }

      // Fetch Pixi inventory
      const pixiResponse = await this.searchItems(supplNr);
      const pixiItems = pixiResponse.data || [];

      // Create lookup maps
      const pixiByItemNr = new Map<string, { ItemNrSuppl: string; EANUPC: string }>();
      pixiItems.forEach(item => {
        if (item.ItemNrSuppl) {
          pixiByItemNr.set(item.ItemNrSuppl.toUpperCase(), item);
        }
      });

      console.log(`[Pixi Service] Loaded ${pixiItems.length} items from Pixi API`);

      // Compare and prepare updates
      const results: PixiSupabaseComparisonResult[] = [];
      const updates: Array<{
        id: string;
        pixi_status: 'NEU' | 'VORHANDEN';
        pixi_ean: string | null;
        pixi_checked_at: string;
      }> = [];
      
      let neuCount = 0;
      let vorhandenCount = 0;
      const timestamp = new Date().toISOString();

      for (const product of products) {
        const artikelnummer = product.articleNumber?.trim() || product.name?.trim() || '';
        const produktname = product.name?.trim() || '';
        
        // Try to get EAN from custom attributes or extractedData
        let ean = '';
        if (product.customAttributes) {
          const eanAttr = product.customAttributes.find((attr: any) => 
            attr.key?.toLowerCase() === 'ean' || attr.key?.toLowerCase() === 'ean-nummer'
          );
          if (eanAttr) {
            ean = eanAttr.value?.toString().trim() || '';
          }
        }

        // Check if product exists in Pixi
        const pixiItem = pixiByItemNr.get(artikelnummer.toUpperCase());
        const isMatch = !!pixiItem;
        const matchedEan = pixiItem?.EANUPC || null;
        const status: 'NEU' | 'VORHANDEN' = isMatch ? 'VORHANDEN' : 'NEU';

        if (status === 'NEU') {
          neuCount++;
        } else {
          vorhandenCount++;
        }

        results.push({
          id: product.id,
          artikelnummer,
          produktname,
          ean,
          hersteller: '', // Could be extracted from customAttributes if needed
          pixi_status: status,
          pixi_ean: matchedEan,
          pixi_checked_at: timestamp,
        });

        updates.push({
          id: product.id,
          pixi_status: status,
          pixi_ean: matchedEan,
          pixi_checked_at: timestamp,
        });
      }

      // Batch update in Supabase
      console.log(`[Pixi Service] Updating ${updates.length} products in Supabase`);
      const updateSuccess = await storage.batchUpdateProductsPixiStatus(updates);
      
      if (!updateSuccess) {
        console.warn('[Pixi Service] Some database updates may have failed');
      }

      return {
        success: true,
        projectId,
        supplierId,
        summary: {
          total: products.length,
          neu: neuCount,
          vorhanden: vorhandenCount,
        },
        products: results,
      };
    } catch (error: any) {
      console.error('[Pixi Service] Supabase comparison failed:', error.message);
      throw error;
    }
  }

  /**
   * Clear the cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Pixi Service] Cache cleared');
  }
}

// Export singleton instance
export const pixiService = new PixiService();
