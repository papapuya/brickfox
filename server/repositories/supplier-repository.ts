import { supabaseAdmin } from '../supabase';
import { encryptionService } from '../services/encryption-service';
import type { Supplier, CreateSupplier, UpdateSupplier } from '@shared/schema';
import { NotFoundError } from '../utils/errors';

export interface ISupplierRepository {
  findById(id: string, userId?: string, tenantId?: string): Promise<Supplier | null>;
  findByUserId(userId: string, tenantId?: string): Promise<Supplier[]>;
  findAll(tenantId?: string): Promise<Supplier[]>;
  create(data: CreateSupplier, userId: string, tenantId?: string): Promise<Supplier>;
  update(id: string, data: UpdateSupplier, userId?: string, tenantId?: string): Promise<Supplier>;
  delete(id: string, userId?: string, tenantId?: string): Promise<boolean>;
  findWithCredentials(id: string, userId?: string, tenantId?: string): Promise<Supplier | null>;
}

export class SupabaseSupplierRepository implements ISupplierRepository {
  async findById(id: string, userId?: string, tenantId?: string): Promise<Supplier | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return null;
    }

    return this.mapToSupplier(data, false);
  }

  async findByUserId(userId: string, tenantId?: string): Promise<Supplier[]> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('suppliers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToSupplier(item, false));
  }

  async findAll(tenantId?: string): Promise<Supplier[]> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToSupplier(item, false));
  }

  async create(data: CreateSupplier, userId: string, tenantId?: string): Promise<Supplier> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const insertData: any = {
      user_id: userId,
      name: data.name,
      suppl_nr: data.supplNr || null,
      url_pattern: data.urlPattern || null,
      description: data.description || null,
      selectors: data.selectors || {},
      product_link_selector: data.productLinkSelector || null,
      session_cookies: data.sessionCookies || null,
      user_agent: data.userAgent || null,
      login_url: data.loginUrl || null,
      login_username_field: data.loginUsernameField || null,
      login_password_field: data.loginPasswordField || null,
      login_username: data.loginUsername || null,
      login_password: data.loginPassword ? encryptionService.encrypt(data.loginPassword) : null,
      verified_fields: data.verifiedFields || null,
    };

    if (tenantId) {
      insertData.tenant_id = tenantId;
    }

    const { data: supplier, error } = await supabaseAdmin
      .from('suppliers')
      .insert(insertData)
      .select()
      .single();

    if (error || !supplier) {
      throw new Error(`Failed to create supplier: ${error?.message || 'Unknown error'}`);
    }

    return this.mapToSupplier(supplier, false);
  }

  async update(id: string, data: UpdateSupplier, userId?: string, tenantId?: string): Promise<Supplier> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.supplNr !== undefined) updateData.suppl_nr = data.supplNr;
    if (data.urlPattern !== undefined) updateData.url_pattern = data.urlPattern;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.selectors !== undefined) updateData.selectors = data.selectors;
    if (data.productLinkSelector !== undefined) updateData.product_link_selector = data.productLinkSelector;
    if (data.sessionCookies !== undefined) updateData.session_cookies = data.sessionCookies;
    if (data.userAgent !== undefined) updateData.user_agent = data.userAgent;
    if (data.loginUrl !== undefined) updateData.login_url = data.loginUrl;
    if (data.loginUsernameField !== undefined) updateData.login_username_field = data.loginUsernameField;
    if (data.loginPasswordField !== undefined) updateData.login_password_field = data.loginPasswordField;
    if (data.loginUsername !== undefined) updateData.login_username = data.loginUsername;
    if (data.loginPassword !== undefined) updateData.login_password = encryptionService.encrypt(data.loginPassword);
    if (data.verifiedFields !== undefined) updateData.verified_fields = data.verifiedFields;
    if (data.lastVerifiedAt !== undefined) updateData.last_verified_at = data.lastVerifiedAt;

    let query = supabaseAdmin
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: supplier, error } = await query;

    if (error || !supplier) {
      throw new NotFoundError('Supplier');
    }

    return this.mapToSupplier(supplier, false);
  }

  async delete(id: string, userId?: string, tenantId?: string): Promise<boolean> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;

    return !error;
  }

  async findWithCredentials(id: string, userId?: string, tenantId?: string): Promise<Supplier | null> {
    const supplier = await this.findById(id, userId, tenantId);
    if (!supplier) return null;

    // Decrypt password if present
    if (supplier.loginPassword) {
      try {
        supplier.loginPassword = encryptionService.decrypt(supplier.loginPassword);
      } catch (error) {
        console.error('[SupplierRepository] Failed to decrypt password:', error);
        supplier.loginPassword = undefined;
      }
    }

    return supplier;
  }

  private mapToSupplier(data: any, includePassword: boolean = false): Supplier {
    return {
      id: data.id,
      userId: data.user_id,
      tenantId: data.tenant_id || undefined,
      name: data.name,
      supplNr: data.suppl_nr || undefined,
      urlPattern: data.url_pattern || undefined,
      description: data.description || undefined,
      selectors: data.selectors || {},
      productLinkSelector: data.product_link_selector || undefined,
      sessionCookies: data.session_cookies || undefined,
      userAgent: data.user_agent || undefined,
      loginUrl: data.login_url || undefined,
      loginUsernameField: data.login_username_field || undefined,
      loginPasswordField: data.login_password_field || undefined,
      loginUsername: data.login_username || undefined,
      loginPassword: includePassword ? data.login_password || undefined : undefined,
      verifiedFields: data.verified_fields || undefined,
      lastVerifiedAt: data.last_verified_at || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

