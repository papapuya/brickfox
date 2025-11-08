import { supabaseAdmin } from '../supabase';
import { eq, and, desc } from 'drizzle-orm';
import { productsInProjects as productsTable } from '@shared/schema';
import type { ProductInProject, CreateProductInProject, UpdateProductInProject } from '@shared/schema';
import { NotFoundError } from '../utils/errors';

export interface IProductRepository {
  findById(id: string, tenantId?: string): Promise<ProductInProject | null>;
  findByProjectId(projectId: string, tenantId?: string): Promise<ProductInProject[]>;
  create(data: CreateProductInProject, tenantId?: string): Promise<ProductInProject>;
  update(id: string, data: UpdateProductInProject, tenantId?: string): Promise<ProductInProject>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}

export class SupabaseProductRepository implements IProductRepository {
  async findById(id: string, tenantId?: string): Promise<ProductInProject | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('products_in_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return null;
    }

    return this.mapToProduct(data);
  }

  async findByProjectId(projectId: string, tenantId?: string): Promise<ProductInProject[]> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('products_in_projects')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToProduct(item));
  }

  async create(data: CreateProductInProject, tenantId?: string): Promise<ProductInProject> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const insertData: any = {
      project_id: data.projectId,
      name: data.name,
      files: data.files || null,
      html_code: data.htmlCode || null,
      preview_text: data.previewText || null,
      extracted_data: data.extractedData || null,
      template: data.template || null,
      custom_attributes: data.customAttributes || null,
      exact_product_name: data.exactProductName || null,
      article_number: data.articleNumber || null,
      manufacturer_article_number: data.manufacturerArticleNumber || null,
    };

    if (tenantId) {
      insertData.tenant_id = tenantId;
    }

    const { data: product, error } = await supabaseAdmin
      .from('products_in_projects')
      .insert(insertData)
      .select()
      .single();

    if (error || !product) {
      throw new Error(`Failed to create product: ${error?.message || 'Unknown error'}`);
    }

    return this.mapToProduct(product);
  }

  async update(id: string, data: UpdateProductInProject, tenantId?: string): Promise<ProductInProject> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.files !== undefined) updateData.files = data.files;
    if (data.htmlCode !== undefined) updateData.html_code = data.htmlCode;
    if (data.previewText !== undefined) updateData.preview_text = data.previewText;
    if (data.extractedData !== undefined) updateData.extracted_data = data.extractedData;
    if (data.template !== undefined) updateData.template = data.template;
    if (data.customAttributes !== undefined) updateData.custom_attributes = data.customAttributes;
    if (data.exactProductName !== undefined) updateData.exact_product_name = data.exactProductName;
    if (data.articleNumber !== undefined) updateData.article_number = data.articleNumber;
    if (data.manufacturerArticleNumber !== undefined) updateData.manufacturer_article_number = data.manufacturerArticleNumber;

    let query = supabaseAdmin
      .from('products_in_projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: product, error } = await query;

    if (error || !product) {
      throw new NotFoundError('Product');
    }

    return this.mapToProduct(product);
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('products_in_projects')
      .delete()
      .eq('id', id);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;

    return !error;
  }

  private mapToProduct(data: any): ProductInProject {
    return {
      id: data.id,
      projectId: data.project_id,
      tenantId: data.tenant_id || undefined,
      name: data.name || undefined,
      files: data.files || undefined,
      htmlCode: data.html_code || undefined,
      previewText: data.preview_text || undefined,
      extractedData: data.extracted_data || undefined,
      template: data.template || undefined,
      customAttributes: data.custom_attributes || undefined,
      exactProductName: data.exact_product_name || undefined,
      articleNumber: data.article_number || undefined,
      manufacturerArticleNumber: data.manufacturer_article_number || undefined,
      pixiStatus: data.pixi_status || undefined,
      pixiEan: data.pixi_ean || undefined,
      pixiCheckedAt: data.pixi_checked_at || undefined,
      createdAt: data.created_at,
    };
  }
}

