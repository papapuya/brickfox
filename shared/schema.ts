import { z } from "zod";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Product data model for CSV enrichment
export const productSchema = z.object({
  id: z.number(),
  sku: z.string(),
  titel: z.string(),
  produktbeschreibung: z.string(),
  marke: z.string(),
  titel_marktplatz: z.string(),
  titel_marktplatz_v2: z.string(),
  spannung: z.string(),
  kapazitaet: z.string(),
  energiegehalt: z.string(),
  leistung: z.string(),
  verpackungseinheit: z.string(),
  lieferumfang: z.string(),
  isDuplicate: z.boolean().optional(),
});

export type Product = z.infer<typeof productSchema>;

// File upload state
export interface FileUploadState {
  file: File | null;
  fileName: string;
  fileSize: number;
  encoding: string;
}

// Processing state
export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  totalRows: number;
  currentRow: number;
}

// Product Creator schemas - AI-powered PIM description generation
export const extractedProductDataSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileType: z.enum(['pdf', 'csv', 'image', 'url']),
  extractedText: z.string(),
  productName: z.string().optional(),
  description: z.string().optional(),
  dimensions: z.string().optional(),
  weight: z.string().optional(),
  voltage: z.string().optional(),
  capacity: z.string().optional(),
  power: z.string().optional(),
  technicalSpecs: z.record(z.string(), z.any()).optional(),
  confidence: z.number().optional(),
  createdAt: z.string().optional(),
  url: z.string().optional(),
  supplierTableHtml: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  structuredData: z.record(z.string(), z.any()).optional(),
});

export type ExtractedProductData = z.infer<typeof extractedProductDataSchema>;

export const pimProductSchema = z.object({
  id: z.string(),
  sku: z.string().optional(),
  name: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  technicalSpecs: z.record(z.string(), z.string()).optional(),
  features: z.array(z.string()).optional(),
  extractedData: z.array(extractedProductDataSchema).optional(),
  generatedDescription: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export type PIMProduct = z.infer<typeof pimProductSchema>;


export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  isDefault: z.boolean().optional(),
});

export type Template = z.infer<typeof templateSchema>;

export const exportColumnSchema = z.object({
  id: z.string(),
  label: z.string(),
  field: z.string(),
  enabled: z.boolean(),
});

export type ExportColumn = z.infer<typeof exportColumnSchema>;

// Project management schemas
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;

export const createProjectSchema = projectSchema.omit({ id: true, createdAt: true });
export type CreateProject = z.infer<typeof createProjectSchema>;

export const productInProjectSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().optional(),
  files: z.array(z.object({
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
  })).optional(),
  htmlCode: z.string().optional(),
  previewText: z.string().optional(),
  extractedData: z.array(extractedProductDataSchema).optional(),
  template: z.string().optional(),
  customAttributes: z.array(z.object({
    key: z.string(),
    value: z.string(),
    type: z.string(),
  })).optional(),
  exactProductName: z.string().optional(),
  articleNumber: z.string().optional(),
  createdAt: z.string(),
});

export type ProductInProject = z.infer<typeof productInProjectSchema>;

export const createProductInProjectSchema = productInProjectSchema.omit({ id: true, createdAt: true });
export type CreateProductInProject = z.infer<typeof createProductInProjectSchema>;

export const updateProductInProjectSchema = productInProjectSchema.partial().omit({ id: true, projectId: true, createdAt: true });
export type UpdateProductInProject = z.infer<typeof updateProductInProjectSchema>;

// Drizzle database tables for SQLite
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const productsInProjects = sqliteTable("products_in_projects", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name"),
  files: text("files"),
  htmlCode: text("html_code"),
  previewText: text("preview_text"),
  extractedData: text("extracted_data"),
  template: text("template"),
  customAttributes: text("custom_attributes"),
  exactProductName: text("exact_product_name"),
  articleNumber: text("article_number"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isDefault: text("is_default"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Supplier profiles for web scraping
export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  urlPattern: text("url_pattern"),
  description: text("description"),
  selectors: text("selectors").notNull(), // JSON string of ScraperSelectors
  productLinkSelector: text("product_link_selector"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  products: many(productsInProjects),
}));

export const productsInProjectsRelations = relations(productsInProjects, ({ one }) => ({
  project: one(projects, {
    fields: [productsInProjects.projectId],
    references: [projects.id],
  }),
}));

// HTML Template types for product descriptions
export interface ProductImage {
  dataUrl: string;
  fileName: string;
  fileSize: number;
}

export interface CreatorProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  brand?: string;
  images?: ProductImage[];
  technicalSpecs?: Record<string, string>;
  features?: string[];
  advantages?: string[];
  safetyInfo?: string;
  packageContents?: string;
}

export interface HtmlTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  templateFunction: (product: CreatorProduct) => string;
}

// Supplier profile schemas
export const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  urlPattern: z.string().optional(),
  description: z.string().optional(),
  selectors: z.record(z.string(), z.string()),
  productLinkSelector: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Supplier = z.infer<typeof supplierSchema>;

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  urlPattern: z.string().optional(),
  description: z.string().optional(),
  selectors: z.record(z.string(), z.string()).default({}),
  productLinkSelector: z.string().optional(),
});

export type CreateSupplier = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;

// Drizzle insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertProductInProjectSchema = createInsertSchema(productsInProjects).omit({ id: true, createdAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
