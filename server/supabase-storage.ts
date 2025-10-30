import { supabase, supabaseAdmin } from './supabase';
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
  getProject(id: string): Promise<Project | null>;
  deleteProject(id: string): Promise<boolean>;
  
  createProduct(projectId: string, data: CreateProductInProject): Promise<ProductInProject>;
  getProducts(projectId: string): Promise<ProductInProject[]>;
  getProduct(id: string): Promise<ProductInProject | null>;
  updateProduct(id: string, data: UpdateProductInProject): Promise<ProductInProject | null>;
  deleteProduct(id: string): Promise<boolean>;
  
  createTemplate(name: string, content: string, isDefault?: boolean): Promise<Template>;
  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | null>;
  deleteTemplate(id: string): Promise<boolean>;
  
  createSupplier(userId: string, data: CreateSupplier): Promise<Supplier>;
  getSuppliers(userId: string): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | null>;
  updateSupplier(id: string, data: UpdateSupplier): Promise<Supplier | null>;
  deleteSupplier(id: string): Promise<boolean>;
}

export class SupabaseStorage implements IStorage {
  async createUser(data: RegisterUser): Promise<User> {
    throw new Error('Use Supabase Auth signUp instead');
  }

  async getUserById(id: string): Promise<User | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const { data: user, error } = await supabaseAdmin
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
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 100,
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
      passwordHash: '', // Not used with Supabase Auth
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 100,
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
      passwordHash: '', // Not used with Supabase Auth
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 100,
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
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 100,
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
      stripeCustomerId: user.stripe_customer_id || undefined,
      subscriptionStatus: user.subscription_status || undefined,
      subscriptionId: user.subscription_id || undefined,
      planId: user.plan_id || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
      apiCallsUsed: user.api_calls_used || 0,
      apiCallsLimit: user.api_calls_limit || 100,
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
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: data.name,
      })
      .select()
      .single();

    if (error || !project) throw new Error('Failed to create project');

    return {
      id: project.id,
      name: project.name,
      createdAt: project.created_at,
    };
  }

  async getProjects(): Promise<Project[]> {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at');

    if (error || !projects) return [];

    return projects.map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
    }));
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (error || !projects) return [];

    return projects.map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
    }));
  }

  async getProject(id: string): Promise<Project | null> {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !project) return null;

    return {
      id: project.id,
      name: project.name,
      createdAt: project.created_at,
    };
  }

  async deleteProject(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    return !error;
  }

  async createProduct(projectId: string, data: CreateProductInProject): Promise<ProductInProject> {
    const { data: product, error } = await supabase
      .from('products_in_projects')
      .insert({
        project_id: projectId,
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

  async getProducts(projectId: string): Promise<ProductInProject[]> {
    const { data: products, error } = await supabase
      .from('products_in_projects')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');

    if (error || !products) return [];

    return products.map(p => this.mapProduct(p));
  }

  async getProduct(id: string): Promise<ProductInProject | null> {
    const { data: product, error } = await supabase
      .from('products_in_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) return null;

    return this.mapProduct(product);
  }

  async updateProduct(id: string, data: UpdateProductInProject): Promise<ProductInProject | null> {
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

    const { data: product, error } = await supabase
      .from('products_in_projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !product) return null;

    return this.mapProduct(product);
  }

  async deleteProduct(id: string): Promise<boolean> {
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

  async getTemplates(): Promise<Template[]> {
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at');

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
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .insert({
        user_id: userId,
        name: data.name,
        url_pattern: data.urlPattern,
        description: data.description,
        selectors: data.selectors || {},
        product_link_selector: data.productLinkSelector,
        session_cookies: data.sessionCookies,
        user_agent: data.userAgent,
      })
      .select()
      .single();

    if (error || !supplier) throw new Error('Failed to create supplier');

    return this.mapSupplier(supplier);
  }

  async getSuppliers(userId: string): Promise<Supplier[]> {
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (error || !suppliers) return [];

    return suppliers.map(s => this.mapSupplier(s));
  }

  async getSupplier(id: string): Promise<Supplier | null> {
    const { data: supplier, error } = await supabase
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
    if (data.urlPattern !== undefined) updateData.url_pattern = data.urlPattern;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.selectors !== undefined) updateData.selectors = data.selectors;
    if (data.productLinkSelector !== undefined) updateData.product_link_selector = data.productLinkSelector;
    if (data.sessionCookies !== undefined) updateData.session_cookies = data.sessionCookies;
    if (data.userAgent !== undefined) updateData.user_agent = data.userAgent;

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !supplier) return null;

    return this.mapSupplier(supplier);
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    return !error;
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
      createdAt: product.created_at,
    };
  }

  private mapSupplier(supplier: any): Supplier {
    return {
      id: supplier.id,
      name: supplier.name,
      urlPattern: supplier.url_pattern || undefined,
      description: supplier.description || undefined,
      selectors: supplier.selectors || {},
      productLinkSelector: supplier.product_link_selector || undefined,
      sessionCookies: supplier.session_cookies || undefined,
      userAgent: supplier.user_agent || undefined,
      createdAt: supplier.created_at,
      updatedAt: supplier.updated_at,
    };
  }
}

export const supabaseStorage = new SupabaseStorage();
