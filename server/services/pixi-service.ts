/**
 * Pixi ERP API Integration Service
 * 
 * Provides methods to interact with the Pixi ERP system for product comparison
 * and inventory management.
 */

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
   * Compare CSV products with Pixi inventory
   * @param products Array of products from CSV
   * @param supplNr Supplier number
   * @returns Comparison results with status (NEU/VORHANDEN)
   */
  async compareProducts(products: CSVProduct[], supplNr: string): Promise<PixiComparisonSummary> {
    try {
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
        const artikelnummer = product.Artikelnummer?.trim() || '';
        const produktname = product.Produktname?.trim() || '';
        const ean = product.EAN?.toString().trim() || '';
        const hersteller = product.Hersteller?.trim() || '';

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
   * Clear the cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Pixi Service] Cache cleared');
  }
}

// Export singleton instance
export const pixiService = new PixiService();
