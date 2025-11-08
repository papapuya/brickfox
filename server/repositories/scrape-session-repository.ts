import { supabaseAdmin } from '../supabase';
import { NotFoundError } from '../utils/errors';

export interface ScrapeSession {
  id: string;
  userId: string;
  tenantId?: string;
  scrapedProducts?: {
    urlScraper?: any;
    pdfScraper?: any;
  };
  scrapedProduct?: any;
  generatedDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScrapeSession {
  userId: string;
  tenantId?: string;
  scrapedProducts?: {
    urlScraper?: any;
    pdfScraper?: any;
  };
  generatedDescription?: string;
}

export interface UpdateScrapeSession {
  scrapedProducts?: {
    urlScraper?: any;
    pdfScraper?: any;
  };
  generatedDescription?: string;
}

export interface IScrapeSessionRepository {
  findByUserId(userId: string, tenantId?: string): Promise<ScrapeSession | null>;
  create(data: CreateScrapeSession): Promise<ScrapeSession>;
  update(id: string, data: UpdateScrapeSession): Promise<ScrapeSession>;
  delete(userId: string, tenantId?: string): Promise<boolean>;
}

export class SupabaseScrapeSessionRepository implements IScrapeSessionRepository {
  async findByUserId(userId: string, tenantId?: string): Promise<ScrapeSession | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('scrape_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return null;
    }

    return this.mapToSession(data[0]);
  }

  async create(data: CreateScrapeSession): Promise<ScrapeSession> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const insertData: any = {
      user_id: data.userId,
      scraped_products: data.scrapedProducts || null,
      generated_description: data.generatedDescription || null,
    };

    if (data.tenantId) {
      insertData.tenant_id = data.tenantId;
    }

    const { data: session, error } = await supabaseAdmin
      .from('scrape_sessions')
      .insert(insertData)
      .select()
      .single();

    if (error || !session) {
      throw new Error(`Failed to create scrape session: ${error?.message || 'Unknown error'}`);
    }

    return this.mapToSession(session);
  }

  async update(id: string, data: UpdateScrapeSession): Promise<ScrapeSession> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const updateData: any = {};

    if (data.scrapedProducts !== undefined) {
      updateData.scraped_products = data.scrapedProducts;
    }
    if (data.generatedDescription !== undefined) {
      updateData.generated_description = data.generatedDescription;
    }

    const { data: session, error } = await supabaseAdmin
      .from('scrape_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !session) {
      throw new NotFoundError('ScrapeSession');
    }

    return this.mapToSession(session);
  }

  async delete(userId: string, tenantId?: string): Promise<boolean> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('scrape_sessions')
      .delete()
      .eq('user_id', userId);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;

    return !error;
  }

  private mapToSession(data: any): ScrapeSession {
    return {
      id: data.id,
      userId: data.user_id,
      tenantId: data.tenant_id || undefined,
      scrapedProducts: data.scraped_products || undefined,
      scrapedProduct: data.scraped_product || undefined,
      generatedDescription: data.generated_description || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

