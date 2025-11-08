import { supabaseAdmin } from '../supabase';
import { IProductRepository, SupabaseProductRepository } from '../repositories/product-repository';
import { ISupplierRepository, SupabaseSupplierRepository } from '../repositories/supplier-repository';

export interface AdminKPIs {
  totalProducts: number;
  completenessPercentage: number;
  suppliers: {
    active: number;
    successful: number;
    error: number;
  };
  lastPixiSync: string;
  aiTextsToday: number;
}

export class AdminService {
  constructor(
    private productRepository: IProductRepository = new SupabaseProductRepository(),
    private supplierRepository: ISupplierRepository = new SupabaseSupplierRepository()
  ) {}

  async getKPIs(tenantId?: string): Promise<AdminKPIs> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    // Get total products
    let productsQuery = supabaseAdmin
      .from('products_in_projects')
      .select('id, name, article_number, extracted_data', { count: 'exact', head: false });

    if (tenantId) {
      productsQuery = productsQuery.eq('tenant_id', tenantId);
    }

    const { data: products, count: totalProducts, error: productsError } = await productsQuery;

    if (productsError) {
      throw new Error(`Failed to get products: ${productsError.message}`);
    }

    // Calculate completeness
    const completeProducts = (products || []).filter(
      (p: any) => p.name && p.article_number && p.extracted_data
    ).length;

    const completenessPercentage = (totalProducts || 0) > 0
      ? Math.round((completeProducts / (totalProducts || 0)) * 100)
      : 0;

    // Get supplier stats
    let suppliersQuery = supabaseAdmin
      .from('suppliers')
      .select('id, name, last_verified_at');

    if (tenantId) {
      suppliersQuery = suppliersQuery.eq('tenant_id', tenantId);
    }

    const { data: suppliers, error: suppliersError } = await suppliersQuery;

    if (suppliersError) {
      throw new Error(`Failed to get suppliers: ${suppliersError.message}`);
    }

    const activeSuppliers = (suppliers || []).length;
    const successfulSuppliers = (suppliers || []).filter((s: any) => s.last_verified_at).length;
    const errorSuppliers = activeSuppliers - successfulSuppliers;

    // Get AI texts generated today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let scrapeSessionQuery = supabaseAdmin
      .from('scrape_sessions')
      .select('id', { count: 'exact', head: false })
      .not('generated_description', 'is', null)
      .gte('created_at', today.toISOString());

    if (tenantId) {
      scrapeSessionQuery = scrapeSessionQuery.eq('tenant_id', tenantId);
    }

    const { count: aiTextsToday, error: aiTextsError } = await scrapeSessionQuery;

    if (aiTextsError) {
      console.error('Error getting AI texts:', aiTextsError);
    }

    return {
      totalProducts: totalProducts || 0,
      completenessPercentage,
      suppliers: {
        active: activeSuppliers,
        successful: successfulSuppliers,
        error: errorSuppliers,
      },
      lastPixiSync: new Date().toISOString(), // Placeholder
      aiTextsToday: aiTextsToday || 0,
    };
  }
}

