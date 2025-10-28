import { nanoid } from 'nanoid';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { 
  projects, 
  productsInProjects, 
  templates,
  type Project, 
  type CreateProject, 
  type ProductInProject, 
  type CreateProductInProject, 
  type UpdateProductInProject,
  type Template
} from '@shared/schema';

export interface IStorage {
  // Project operations
  createProject(data: CreateProject): Promise<Project>;
  getProjects(): Promise<Project[]>;
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
}

export class DatabaseStorage implements IStorage {
  // Project operations
  async createProject(data: CreateProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({
        id: nanoid(),
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
    
    return result.map(p => ({
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
    
    return result.map(p => this.mapProductFromDb(p));
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
    
    return result.map(t => ({
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

}

export const storage = new DatabaseStorage();
