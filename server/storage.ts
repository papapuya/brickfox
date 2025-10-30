import { nanoid } from 'nanoid';
import { db } from './db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { 
  projects, 
  productsInProjects, 
  templates,
  suppliers,
  users,
  type Project, 
  type CreateProject, 
  type ProductInProject, 
  type CreateProductInProject, 
  type UpdateProductInProject,
  type Template,
  type Supplier,
  type CreateSupplier,
  type UpdateSupplier,
  type User,
  type RegisterUser
} from '@shared/schema';

export interface IStorage {
  // User operations
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
  
  // Project operations
  createProject(userId: string, data: CreateProject): Promise<Project>;
  getProjects(): Promise<Project[]>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  deleteProject(id: string): Promise<boolean>;
  
  // Product operations
  createProduct(projectId: string, data: CreateProductInProject): Promise<ProductInProject>;
  getProducts(projectId: string): Promise<ProductInProject[]>;
  getProduct(id: string): Promise<ProductInProject | null>;
  updateProduct(id: string, data: UpdateProductInProject): Promise<ProductInProject | null>;
  deleteProduct(id: string): Promise<boolean>;
  
  // Template operations
  createTemplate(name: string, content: string, isDefault?: boolean): Promise<Template>;
  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | null>;
  deleteTemplate(id: string): Promise<boolean>;
  
  // Supplier operations
  createSupplier(data: CreateSupplier): Promise<Supplier>;
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | null>;
  updateSupplier(id: string, data: UpdateSupplier): Promise<Supplier | null>;
  deleteSupplier(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async createUser(data: RegisterUser): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    const [user] = await db
      .insert(users)
      .values({
        id: nanoid(),
        email: data.email,
        passwordHash,
        username: data.username || data.email.split('@')[0],
        apiCallsUsed: 0,
        apiCallsLimit: 500, // Starter plan default
      })
      .returning();
    
    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.isAdmin || false,
      stripeCustomerId: user.stripeCustomerId || undefined,
      subscriptionStatus: user.subscriptionStatus || undefined,
      subscriptionId: user.subscriptionId || undefined,
      planId: user.planId || undefined,
      currentPeriodEnd: user.currentPeriodEnd || undefined,
      apiCallsUsed: user.apiCallsUsed || 0,
      apiCallsLimit: user.apiCallsLimit || 500,
      createdAt: typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
      updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : user.updatedAt.toISOString(),
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.isAdmin || false,
      stripeCustomerId: user.stripeCustomerId || undefined,
      subscriptionStatus: user.subscriptionStatus || undefined,
      subscriptionId: user.subscriptionId || undefined,
      planId: user.planId || undefined,
      currentPeriodEnd: user.currentPeriodEnd || undefined,
      apiCallsUsed: user.apiCallsUsed || 0,
      apiCallsLimit: user.apiCallsLimit || 500,
      createdAt: typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
      updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : user.updatedAt.toISOString(),
    };
  }

  async getUserByEmail(email: string): Promise<User & { passwordHash: string } | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.isAdmin || false,
      passwordHash: (user as any).password_hash || user.passwordHash, // Handle both snake_case and camelCase
      stripeCustomerId: user.stripeCustomerId || undefined,
      subscriptionStatus: user.subscriptionStatus || undefined,
      subscriptionId: user.subscriptionId || undefined,
      planId: user.planId || undefined,
      currentPeriodEnd: user.currentPeriodEnd || undefined,
      apiCallsUsed: user.apiCallsUsed || 0,
      apiCallsLimit: user.apiCallsLimit || 500,
      createdAt: typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
      updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : user.updatedAt.toISOString(),
    };
  }

  async getUserByUsername(username: string): Promise<User & { passwordHash: string } | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.isAdmin || false,
      passwordHash: (user as any).password_hash || user.passwordHash, // Handle both snake_case and camelCase
      stripeCustomerId: user.stripeCustomerId || undefined,
      subscriptionStatus: user.subscriptionStatus || undefined,
      subscriptionId: user.subscriptionId || undefined,
      planId: user.planId || undefined,
      currentPeriodEnd: user.currentPeriodEnd || undefined,
      apiCallsUsed: user.apiCallsUsed || 0,
      apiCallsLimit: user.apiCallsLimit || 500,
      createdAt: typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
      updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : user.updatedAt.toISOString(),
    };
  }

  async updateUserSubscription(userId: string, data: {
    stripeCustomerId?: string;
    subscriptionStatus?: string;
    subscriptionId?: string;
    planId?: string;
    currentPeriodEnd?: string;
    apiCallsLimit?: number;
  }): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.isAdmin || false,
      stripeCustomerId: user.stripeCustomerId || undefined,
      subscriptionStatus: user.subscriptionStatus || undefined,
      subscriptionId: user.subscriptionId || undefined,
      planId: user.planId || undefined,
      currentPeriodEnd: user.currentPeriodEnd || undefined,
      apiCallsUsed: user.apiCallsUsed || 0,
      apiCallsLimit: user.apiCallsLimit || 500,
      createdAt: typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
      updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : user.updatedAt.toISOString(),
    };
  }

  async incrementApiCalls(userId: string): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (user) {
      await db
        .update(users)
        .set({
          apiCallsUsed: (user.apiCallsUsed || 0) + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId));
    }
  }

  async resetApiCalls(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        apiCallsUsed: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    const result = await db
      .select()
      .from(users)
      .orderBy(users.createdAt);
    
    return result.map((user: any) => ({
      id: user.id,
      email: user.email,
      username: user.username || undefined,
      isAdmin: user.isAdmin || false,
      stripeCustomerId: user.stripeCustomerId || undefined,
      subscriptionStatus: user.subscriptionStatus || undefined,
      subscriptionId: user.subscriptionId || undefined,
      planId: user.planId || undefined,
      currentPeriodEnd: user.currentPeriodEnd || undefined,
      apiCallsUsed: user.apiCallsUsed || 0,
      apiCallsLimit: user.apiCallsLimit || 500,
      createdAt: typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
      updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : user.updatedAt.toISOString(),
    }));
  }
  
  // Project operations
  async createProject(userId: string, data: CreateProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({
        id: nanoid(),
        userId,
        name: data.name,
      })
      .returning();
    
    return {
      id: project.id,
      name: project.name,
      createdAt: typeof project.createdAt === 'string' ? project.createdAt : project.createdAt.toISOString(),
    };
  }

  async getProjects(): Promise<Project[]> {
    const result = await db
      .select()
      .from(projects)
      .orderBy(projects.createdAt);
    
    return result.map((p: any) => ({
      id: p.id,
      name: p.name,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : p.createdAt.toISOString(),
    }));
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(projects.createdAt);
    
    return result.map((p: any) => ({
      id: p.id,
      name: p.name,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : p.createdAt.toISOString(),
    }));
  }

  async getProject(id: string): Promise<Project | null> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    
    if (!project) return null;
    
    return {
      id: project.id,
      name: project.name,
      createdAt: typeof project.createdAt === 'string' ? project.createdAt : project.createdAt.toISOString(),
    };
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();
    
    return result.length > 0;
  }

  // Product operations
  async createProduct(projectId: string, data: CreateProductInProject): Promise<ProductInProject> {
    const [product] = await db
      .insert(productsInProjects)
      .values({
        id: nanoid(),
        projectId,
        name: data.name,
        files: data.files ? JSON.stringify(data.files) : null,
        htmlCode: data.htmlCode,
        previewText: data.previewText,
        extractedData: data.extractedData ? JSON.stringify(data.extractedData) : null,
        template: data.template,
        customAttributes: data.customAttributes ? JSON.stringify(data.customAttributes) : null,
        exactProductName: data.exactProductName,
        articleNumber: data.articleNumber,
      })
      .returning();
    
    return this.mapProductFromDb(product);
  }

  async getProducts(projectId: string): Promise<ProductInProject[]> {
    const result = await db
      .select()
      .from(productsInProjects)
      .where(eq(productsInProjects.projectId, projectId))
      .orderBy(productsInProjects.createdAt);
    
    return result.map((p: any) => this.mapProductFromDb(p));
  }

  async getProduct(id: string): Promise<ProductInProject | null> {
    const [product] = await db
      .select()
      .from(productsInProjects)
      .where(eq(productsInProjects.id, id));
    
    if (!product) return null;
    
    return this.mapProductFromDb(product);
  }

  async updateProduct(id: string, data: UpdateProductInProject): Promise<ProductInProject | null> {
    const updateData: any = { ...data };
    
    if (data.files !== undefined) {
      updateData.files = data.files ? JSON.stringify(data.files) : null;
    }
    
    if (data.extractedData !== undefined) {
      updateData.extractedData = data.extractedData ? JSON.stringify(data.extractedData) : null;
    }
    
    if (data.customAttributes !== undefined) {
      updateData.customAttributes = data.customAttributes ? JSON.stringify(data.customAttributes) : null;
    }
    
    const [product] = await db
      .update(productsInProjects)
      .set(updateData)
      .where(eq(productsInProjects.id, id))
      .returning();
    
    if (!product) return null;
    
    return this.mapProductFromDb(product);
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db
      .delete(productsInProjects)
      .where(eq(productsInProjects.id, id))
      .returning();
    
    return result.length > 0;
  }

  // Template operations
  async createTemplate(name: string, content: string, isDefault?: boolean): Promise<Template> {
    const [template] = await db
      .insert(templates)
      .values({
        id: nanoid(),
        name,
        content,
        isDefault: isDefault ? 'true' : null,
      })
      .returning();
    
    return {
      id: template.id,
      name: template.name,
      content: template.content,
      isDefault: template.isDefault === 'true',
    };
  }

  async getTemplates(): Promise<Template[]> {
    const result = await db
      .select()
      .from(templates)
      .orderBy(templates.createdAt);
    
    return result.map((t: any) => ({
      id: t.id,
      name: t.name,
      content: t.content,
      isDefault: t.isDefault === 'true',
    }));
  }

  async getTemplate(id: string): Promise<Template | null> {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id));
    
    if (!template) return null;
    
    return {
      id: template.id,
      name: template.name,
      content: template.content,
      isDefault: template.isDefault === 'true',
    };
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await db
      .delete(templates)
      .where(eq(templates.id, id))
      .returning();
    
    return result.length > 0;
  }

  // Supplier operations
  async createSupplier(data: CreateSupplier): Promise<Supplier> {
    const [supplier] = await db
      .insert(suppliers)
      .values({
        id: nanoid(),
        name: data.name,
        urlPattern: data.urlPattern || null,
        description: data.description || null,
        selectors: JSON.stringify(data.selectors || {}),
        productLinkSelector: data.productLinkSelector || null,
        sessionCookies: data.sessionCookies || null,
        userAgent: data.userAgent || null,
      })
      .returning();
    
    return this.mapSupplierFromDb(supplier);
  }

  async getSuppliers(): Promise<Supplier[]> {
    const result = await db
      .select()
      .from(suppliers)
      .orderBy(suppliers.name);
    
    return result.map((s: any) => this.mapSupplierFromDb(s));
  }

  async getSupplier(id: string): Promise<Supplier | null> {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id));
    
    if (!supplier) return null;
    
    return this.mapSupplierFromDb(supplier);
  }

  async updateSupplier(id: string, data: UpdateSupplier): Promise<Supplier | null> {
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.urlPattern !== undefined) updateData.urlPattern = data.urlPattern;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.selectors !== undefined) updateData.selectors = JSON.stringify(data.selectors);
    if (data.productLinkSelector !== undefined) updateData.productLinkSelector = data.productLinkSelector;
    if (data.sessionCookies !== undefined) updateData.sessionCookies = data.sessionCookies;
    if (data.userAgent !== undefined) updateData.userAgent = data.userAgent;
    
    const [supplier] = await db
      .update(suppliers)
      .set(updateData)
      .where(eq(suppliers.id, id))
      .returning();
    
    if (!supplier) return null;
    
    return this.mapSupplierFromDb(supplier);
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const result = await db
      .delete(suppliers)
      .where(eq(suppliers.id, id))
      .returning();
    
    return result.length > 0;
  }

  // Helper method to map database product to app format
  private mapProductFromDb(product: any): ProductInProject {
    return {
      id: product.id,
      projectId: product.projectId,
      name: product.name || undefined,
      files: product.files ? JSON.parse(product.files) : undefined,
      htmlCode: product.htmlCode || undefined,
      previewText: product.previewText || undefined,
      extractedData: product.extractedData ? JSON.parse(product.extractedData) : undefined,
      template: product.template || undefined,
      customAttributes: product.customAttributes ? JSON.parse(product.customAttributes) : undefined,
      exactProductName: product.exactProductName || undefined,
      articleNumber: product.articleNumber || undefined,
      createdAt: typeof product.createdAt === 'string' ? product.createdAt : product.createdAt.toISOString(),
    };
  }

  // Helper method to map database supplier to app format
  private mapSupplierFromDb(supplier: any): Supplier {
    return {
      id: supplier.id,
      name: supplier.name,
      urlPattern: supplier.urlPattern || undefined,
      description: supplier.description || undefined,
      selectors: supplier.selectors ? JSON.parse(supplier.selectors) : {},
      productLinkSelector: supplier.productLinkSelector || undefined,
      sessionCookies: supplier.sessionCookies || undefined,
      userAgent: supplier.userAgent || undefined,
      createdAt: typeof supplier.createdAt === 'string' ? supplier.createdAt : supplier.createdAt.toISOString(),
      updatedAt: typeof supplier.updatedAt === 'string' ? supplier.updatedAt : supplier.updatedAt.toISOString(),
    };
  }

}

export const storage = new DatabaseStorage();
