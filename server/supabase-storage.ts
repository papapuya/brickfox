import { supabase, supabaseAdmin } from './supabase';
import { encrypt, decrypt } from './encryption';

// Use admin client for backend operations to bypass RLS
const db = supabaseAdmin || supabase;
import type {
  Project,
  CreateProject,
  ProductInProject,
  CreateProductInProject,
  UpdateProductInProject,
  Template,
  Supplier,
  CreateSupplier,
  UpdateSupplier,
  User,
  RegisterUser
} from '@shared/schema';

export interface IStorage {
  createUser(data: RegisterUser): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User & { passwordHash: string } | null>;
  getUserByUsername(username: string): Promise<User & { passwordHash: string } | null>;
  getAllUsers(): Promise<User[]>;
  updateUserSubscription(userId: string, data: {
    stripeCustomerId?: string;
    subscriptionStatus?: string;
    subscriptionId?: string;
    planId?: string;
    currentPeriodEnd?: string;
    apiCallsLimit?: number;
  }): Promise<User | null>;
  incrementApiCalls(userId: string): Promise<void>;
  resetApiCalls(userId: string): Promise<void>;
  
  createProject(userId: string, data: CreateProject): Promise<Project>;
  getProjects(): Promise<Project[]>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  getProject(id: string, userId?: string): Promise<Project | null>;
  deleteProject(id: string, userId?: string): Promise<boolean>;
  
  createProduct(projectId: string, data: CreateProductInProject, userId?: string): Promise<ProductInProject>;
  getProducts(projectId: string, userId?: string): Promise<ProductInProject[]>;
  getProduct(id: string, userId?: string): Promise<ProductInProject | null>;
  updateProduct(id: string, data: UpdateProductInProject, userId?: string): Promise<ProductInProject | null>;
  deleteProduct(id: string, userId?: string): Promise<boolean>;
  
  createTemplate(name: string, content: string, isDefault?: boolean): Promise<Template>;
  getTemplates(userId?: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | null>;
  deleteTemplate(id: string): Promise<boolean>;
  
  createSupplier(userId: string, data: CreateSupplier): Promise<Supplier>;
  getSuppliers(userId: string): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | null>;
  updateSupplier(id: string, data: UpdateSupplier): Promise<Supplier | null>;
  deleteSupplier(id: string): Promise<boolean>;
  
  updateProductPixiStatus(productId: string, pixiData: {
    pixi_status: 'NEU' | 'VORHANDEN';
    pixi_ean: string | null;
    pixi_checked_at: string;
  }): Promise<boolean>;
  batchUpdateProductsPixiStatus(updates: Array<{
    id: string;
    pixi_status: 'NEU' | 'VORHANDEN';
    pixi_ean: string | null;
    pixi_checked_at: string;
  }>): Promise<boolean>;
}

export class SupabaseStorage implements IStorage {
  async createUser(data: RegisterUser): Promise<User> {
    throw new Error('Use Supabase Auth signUp instead');
  }

  async getUserById(id: string): Promise<User | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.is_admin || false,
      organizationId: user.organization_id || undefined,
      role: user.role || 'member',
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 3000, // GPT-4o-mini adjustment
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async getUserByEmail(email: string): Promise<User & { passwordHash: string } | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.is_admin || false,
      organizationId: user.organization_id || undefined,
      role: user.role || 'member',
      passwordHash: '', // Not used with Supabase Auth
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 3000, // GPT-4o-mini adjustment
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async getUserByUsername(username: string): Promise<User & { passwordHash: string } | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.is_admin || false,
      organizationId: user.organization_id || undefined,
      role: user.role || 'member',
      passwordHash: '', // Not used with Supabase Auth
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 3000, // GPT-4o-mini adjustment
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async getAllUsers(): Promise<User[]> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at');

    if (error || !users) return [];

    return users.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.is_admin || false,
      organizationId: user.organization_id || undefined,
      role: user.role || 'member',
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 3000, // GPT-4o-mini adjustment
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));
  }

  async updateUserSubscription(userId: string, data: {
    stripeCustomerId?: string;
    subscriptionStatus?: string;
    subscriptionId?: string;
    planId?: string;
    currentPeriodEnd?: string;
    apiCallsLimit?: number;
  }): Promise<User | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const updateData: any = {};
    if (data.stripeCustomerId) updateData.stripe_customer_id = data.stripeCustomerId;
    if (data.subscriptionStatus) updateData.subscription_status = data.subscriptionStatus;
    if (data.subscriptionId) updateData.subscription_id = data.subscriptionId;
    if (data.planId) updateData.plan_id = data.planId;
    if (data.currentPeriodEnd) updateData.current_period_end = data.currentPeriodEnd;
    if (data.apiCallsLimit !== undefined) updateData.api_calls_limit = data.apiCallsLimit;

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.is_admin || false,
      role: user.role || 'member',
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 3000, // GPT-4o-mini adjustment
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async incrementApiCalls(userId: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('api_calls_used')
      .eq('id', userId)
      .single();

    if (user) {
      await supabaseAdmin
        .from('users')
        .update({ api_calls_used: (user.api_calls_used || 0) + 1 })
        .eq('id', userId);
    }
  }

  async resetApiCalls(userId: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    await supabaseAdmin
      .from('users')
      .update({ api_calls_used: 0 })
      .eq('id', userId);
  }

  async createProject(userId: string, data: CreateProject): Promise<Project> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');
    
    if (!user.organizationId) {
      console.error(`[SECURITY CRITICAL] User ${userId} has NO organization_id - cannot create project`);
      throw new Error('User must belong to an organization to create projects');
    }

    console.log('[createProject] Attempting to insert:', {
      user_id: userId,
      organization_id: user.organizationId,
      name: data.name,
    });

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: userId,
        organization_id: user.organizationId,
        name: data.name,
      })
      .select()
      .single();

    if (error) {
      console.error('[createProject] Supabase error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to create project: ${error.message}`);
    }
    
    if (!project) {
      console.error('[createProject] No project returned but no error');
      throw new Error('Failed to create project: No data returned');
    }

    return {
      id: project.id,
      name: project.name,
      createdAt: project.created_at,
    };
  }

  async getProjects(): Promise<Project[]> {
    throw new Error('Use getProjectsByUserId instead - organization filtering required');
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const user = await this.getUserById(userId);
    if (!user) return [];

    const query = supabaseAdmin
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (user.organizationId) {
      query.eq('organization_id', user.organizationId);
    }

    const { data: projects, error } = await query;

    if (error || !projects) return [];

    return projects.map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
    }));
  }

  async getProject(id: string, userId?: string): Promise<Project | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !project) return null;

    if (userId) {
      const user = await this.getUserById(userId);
      if (!user) {
        console.warn(`[SECURITY] Invalid user ${userId} tried to access project ${id}`);
        return null;
      }
      
      if (!user.organizationId) {
        console.warn(`[SECURITY CRITICAL] User ${userId} has NO organization_id - blocking ALL access`);
        return null;
      }
      
      if (!project.organization_id) {
        console.warn(`[SECURITY CRITICAL] Project ${id} has NO organization_id - blocking access (needs backfill)`);
        return null;
      }
      
      if (user.organizationId !== project.organization_id) {
        console.warn(`[SECURITY] User ${userId} (org: ${user.organizationId}) tried to access project ${id} (org: ${project.organization_id})`);
        return null;
      }
    }

    return {
      id: project.id,
      name: project.name,
      createdAt: project.created_at,
    };
  }

  async deleteProject(id: string, userId?: string): Promise<boolean> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    if (userId) {
      const project = await this.getProject(id, userId);
      if (!project) {
        console.warn(`[SECURITY] User ${userId} tried to delete project ${id} from different org`);
        return false;
      }
    }

    const { error } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', id);

    return !error;
  }

  async createProduct(projectId: string, data: CreateProductInProject, userId?: string): Promise<ProductInProject> {
    const project = await this.getProject(projectId, userId);
    if (!project) {
      if (userId) console.warn(`[SECURITY] User ${userId} tried to create product in non-existent/unauthorized project ${projectId}`);
      throw new Error('Project not found or access denied');
    }

    const projectData = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single();

    const { data: product, error} = await supabase
      .from('products_in_projects')
      .insert({
        project_id: projectId,
        organization_id: projectData.data?.organization_id || null,
        name: data.name,
        files: data.files || null,
        html_code: data.htmlCode,
        preview_text: data.previewText,
        extracted_data: data.extractedData || null,
        template: data.template,
        custom_attributes: data.customAttributes || null,
        exact_product_name: data.exactProductName,
        article_number: data.articleNumber,
      })
      .select()
      .single();

    if (error || !product) throw new Error('Failed to create product');

    return this.mapProduct(product);
  }

  async getProducts(projectId: string, userId?: string): Promise<ProductInProject[]> {
    const project = await this.getProject(projectId, userId);
    if (!project) return [];

    const { data: products, error } = await supabase
      .from('products_in_projects')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');

    if (error || !products) return [];

    return products.map(p => this.mapProduct(p));
  }

  async getProduct(id: string, userId?: string): Promise<ProductInProject | null> {
    const { data: product, error } = await supabase
      .from('products_in_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) return null;

    if (userId) {
      const user = await this.getUserById(userId);
      if (!user) {
        console.warn(`[SECURITY] Invalid user ${userId} tried to access product ${id}`);
        return null;
      }
      
      if (!user.organizationId) {
        console.warn(`[SECURITY CRITICAL] User ${userId} has NO organization_id - blocking ALL access`);
        return null;
      }
      
      if (!product.organization_id) {
        console.warn(`[SECURITY CRITICAL] Product ${id} has NO organization_id - blocking access (needs backfill)`);
        return null;
      }
      
      if (user.organizationId !== product.organization_id) {
        console.warn(`[SECURITY] User ${userId} (org: ${user.organizationId}) tried to access product ${id} (org: ${product.organization_id})`);
        return null;
      }
    }

    return this.mapProduct(product);
  }

  async updateProduct(id: string, data: UpdateProductInProject, userId?: string): Promise<ProductInProject | null> {
    if (userId) {
      const existingProduct = await this.getProduct(id, userId);
      if (!existingProduct) {
        console.warn(`[SECURITY] User ${userId} tried to update product ${id} from different org`);
        return null;
      }
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
    if (data.pixi_status !== undefined) updateData.pixi_status = data.pixi_status;
    if (data.pixi_ean !== undefined) updateData.pixi_ean = data.pixi_ean;
    if (data.pixi_checked_at !== undefined) updateData.pixi_checked_at = data.pixi_checked_at;

    const { data: product, error } = await supabase
      .from('products_in_projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !product) return null;

    return this.mapProduct(product);
  }

  async deleteProduct(id: string, userId?: string): Promise<boolean> {
    if (userId) {
      const product = await this.getProduct(id, userId);
      if (!product) {
        console.warn(`[SECURITY] User ${userId} tried to delete product ${id} from different org`);
        return false;
      }
    }

    const { error } = await supabase
      .from('products_in_projects')
      .delete()
      .eq('id', id);

    return !error;
  }

  async createTemplate(name: string, content: string, isDefault?: boolean): Promise<Template> {
    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        name,
        content,
        is_default: isDefault || false,
      })
      .select()
      .single();

    if (error || !template) throw new Error('Failed to create template');

    return {
      id: template.id,
      name: template.name,
      content: template.content,
      isDefault: template.is_default || false,
    };
  }

  async getTemplates(userId?: string): Promise<Template[]> {
    let organizationId: string | null = null;
    
    if (userId) {
      const user = await this.getUserById(userId);
      organizationId = user?.organizationId || null;
    }

    const query = supabase
      .from('templates')
      .select('*')
      .order('created_at');

    if (organizationId) {
      query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      query.is('organization_id', null);
    }

    const { data: templates, error } = await query;

    if (error || !templates) return [];

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      content: t.content,
      isDefault: t.is_default || false,
    }));
  }

  async getTemplate(id: string): Promise<Template | null> {
    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !template) return null;

    return {
      id: template.id,
      name: template.name,
      content: template.content,
      isDefault: template.is_default || false,
    };
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    return !error;
  }

  async createSupplier(userId: string, data: CreateSupplier): Promise<Supplier> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const insertData: any = {
      user_id: userId,
      organization_id: user.organizationId || null,
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
      verified_fields: data.verifiedFields ? JSON.stringify(data.verifiedFields) : null,
      last_verified_at: data.lastVerifiedAt || null,
    };

    // SECURITY: Encrypt password before storing
    if (data.loginPassword) {
      insertData.login_password = encrypt(data.loginPassword);
    }

    const { data: supplier, error } = await db
      .from('suppliers')
      .insert(insertData)
      .select()
      .single();

    if (error || !supplier) throw new Error('Failed to create supplier');

    return this.mapSupplier(supplier);
  }

  async getSuppliers(userId: string): Promise<Supplier[]> {
    const user = await this.getUserById(userId);
    if (!user) {
      console.log('[getSuppliers] User not found:', userId);
      return [];
    }

    // DEBUG: First try without filter to see if ANY suppliers exist
    const { data: allSuppliers, error: allError } = await db
      .from('suppliers')
      .select('*');
    
    console.log('[getSuppliers DEBUG] Total suppliers in DB:', allSuppliers?.length, 'Error:', allError?.message);
    if (allSuppliers && allSuppliers.length > 0) {
      console.log('[getSuppliers DEBUG] Sample supplier:', JSON.stringify(allSuppliers[0], null, 2));
    }

    let query = db
      .from('suppliers')
      .select('*');

    // Multi-tenant filtering: use organization_id if available, otherwise user_id
    if (user.organizationId) {
      console.log('[getSuppliers] Filtering by organization_id:', user.organizationId);
      query = query.eq('organization_id', user.organizationId);
    } else {
      console.log('[getSuppliers] Filtering by user_id:', userId);
      query = query.eq('user_id', userId);
    }

    query = query.order('name');

    const { data: suppliers, error } = await query;

    console.log('[getSuppliers] Query result:', { 
      error: error?.message, 
      count: suppliers?.length,
      suppliers: suppliers?.map(s => ({ id: s.id, name: s.name }))
    });

    if (error) {
      console.error('[getSuppliers] Error:', error);
      return [];
    }
    
    if (!suppliers) {
      console.log('[getSuppliers] No suppliers returned');
      return [];
    }

    const mapped = suppliers.map(s => this.mapSupplier(s));
    console.log('[getSuppliers] Mapped suppliers:', mapped.length);
    return mapped;
  }

  async getSupplier(id: string): Promise<Supplier | null> {
    const { data: supplier, error } = await db
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !supplier) return null;

    return this.mapSupplier(supplier);
  }

  async updateSupplier(id: string, data: UpdateSupplier): Promise<Supplier | null> {
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
    if (data.verifiedFields !== undefined) updateData.verified_fields = data.verifiedFields ? JSON.stringify(data.verifiedFields) : null;
    if (data.lastVerifiedAt !== undefined) updateData.last_verified_at = data.lastVerifiedAt;
    
    // SECURITY: Encrypt password before storing
    if (data.loginPassword !== undefined) {
      updateData.login_password = data.loginPassword ? encrypt(data.loginPassword) : null;
    }

    const { data: supplier, error } = await db
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !supplier) return null;

    return this.mapSupplier(supplier);
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const { error } = await db
      .from('suppliers')
      .delete()
      .eq('id', id);

    return !error;
  }

  async updateProductPixiStatus(productId: string, pixiData: {
    pixi_status: 'NEU' | 'VORHANDEN';
    pixi_ean: string | null;
    pixi_checked_at: string;
  }): Promise<boolean> {
    const { error } = await supabase
      .from('products_in_projects')
      .update({
        pixi_status: pixiData.pixi_status,
        pixi_ean: pixiData.pixi_ean,
        pixi_checked_at: pixiData.pixi_checked_at,
      })
      .eq('id', productId);

    return !error;
  }

  async batchUpdateProductsPixiStatus(updates: Array<{
    id: string;
    pixi_status: 'NEU' | 'VORHANDEN';
    pixi_ean: string | null;
    pixi_checked_at: string;
  }>): Promise<boolean> {
    try {
      const timestamp = new Date().toISOString();
      
      for (const update of updates) {
        const { error } = await supabase
          .from('products_in_projects')
          .update({
            pixi_status: update.pixi_status,
            pixi_ean: update.pixi_ean,
            pixi_checked_at: update.pixi_checked_at || timestamp,
          })
          .eq('id', update.id);

        if (error) {
          console.error(`[Supabase] Failed to update product ${update.id}:`, error);
          return false;
        }
      }

      console.log(`[Supabase] Successfully updated ${updates.length} products with Pixi status`);
      return true;
    } catch (error) {
      console.error('[Supabase] Batch update failed:', error);
      return false;
    }
  }

  private mapProduct(product: any): ProductInProject {
    return {
      id: product.id,
      projectId: product.project_id,
      name: product.name || undefined,
      files: product.files || undefined,
      htmlCode: product.html_code || undefined,
      previewText: product.preview_text || undefined,
      extractedData: product.extracted_data || undefined,
      template: product.template || undefined,
      customAttributes: product.custom_attributes || undefined,
      exactProductName: product.exact_product_name || undefined,
      articleNumber: product.article_number || undefined,
      pixi_status: product.pixi_status || undefined,
      pixi_ean: product.pixi_ean || undefined,
      pixi_checked_at: product.pixi_checked_at || undefined,
      createdAt: product.created_at,
    };
  }

  private mapSupplier(supplier: any): Supplier {
    // SECURITY: DO NOT return decrypted password in API responses
    // Password is only decrypted internally when needed for login
    return {
      id: supplier.id,
      name: supplier.name,
      supplNr: supplier.suppl_nr || undefined,
      urlPattern: supplier.url_pattern || undefined,
      description: supplier.description || undefined,
      selectors: supplier.selectors || {},
      productLinkSelector: supplier.product_link_selector || undefined,
      sessionCookies: supplier.session_cookies || undefined,
      userAgent: supplier.user_agent || undefined,
      loginUrl: supplier.login_url || undefined,
      loginUsernameField: supplier.login_username_field || undefined,
      loginPasswordField: supplier.login_password_field || undefined,
      loginUsername: supplier.login_username || undefined,
      loginPassword: undefined, // SECURITY: Never expose password to clients
      verifiedFields: supplier.verified_fields ? JSON.parse(supplier.verified_fields) : undefined,
      lastVerifiedAt: supplier.last_verified_at || undefined,
      createdAt: supplier.created_at,
      updatedAt: supplier.updated_at,
    };
  }

  /**
   * Internal method to get supplier with decrypted password for login purposes
   * SECURITY: Only use this internally, never expose to API responses
   */
  async getSupplierWithCredentials(id: string): Promise<Supplier | null> {
    const { data: supplier, error } = await db
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !supplier) return null;

    // Decrypt password for internal use
    let decryptedPassword: string | undefined = undefined;
    if (supplier.login_password) {
      try {
        decryptedPassword = decrypt(supplier.login_password);
      } catch (error) {
        console.error('[getSupplierWithCredentials] Failed to decrypt login password:', error);
      }
    }

    return {
      ...this.mapSupplier(supplier),
      loginPassword: decryptedPassword
    };
  }
}

export const supabaseStorage = new SupabaseStorage();
