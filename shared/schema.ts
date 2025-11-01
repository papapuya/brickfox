import { z } from "zod";
import { pgTable, text, integer, uuid, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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
  pixi_status: z.enum(['NEU', 'VORHANDEN']).optional(),
  pixi_ean: z.string().optional(),
  pixi_checked_at: z.string().optional(),
  createdAt: z.string(),
});

export type ProductInProject = z.infer<typeof productInProjectSchema>;

export const createProductInProjectSchema = productInProjectSchema.omit({ id: true, createdAt: true, projectId: true });
export type CreateProductInProject = z.infer<typeof createProductInProjectSchema>;

export const updateProductInProjectSchema = productInProjectSchema.partial().omit({ id: true, projectId: true, createdAt: true });
export type UpdateProductInProject = z.infer<typeof updateProductInProjectSchema>;

// Drizzle database tables for PostgreSQL (Supabase)

// Tenants table for multi-tenant B2B SaaS (akkushop.de, kunde2, etc.)
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Users table for authentication and subscription management
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  username: text("username"),
  isAdmin: boolean("is_admin").default(false),
  
  // Multi-tenant fields
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  role: text("role").default('member'),
  
  // Stripe subscription fields
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionStatus: text("subscription_status"), // active, canceled, past_due, trialing, incomplete
  subscriptionId: text("subscription_id"),
  planId: text("plan_id"), // starter, pro, enterprise
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  
  // Usage tracking for API limits
  apiCallsUsed: integer("api_calls_used").default(0),
  apiCallsLimit: integer("api_calls_limit").default(500), // Default: Starter plan
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const productsInProjects = pgTable("products_in_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name"),
  files: jsonb("files"),
  htmlCode: text("html_code"),
  previewText: text("preview_text"),
  extractedData: jsonb("extracted_data"),
  template: text("template"),
  customAttributes: jsonb("custom_attributes"),
  exactProductName: text("exact_product_name"),
  articleNumber: text("article_number"),
  pixiStatus: text("pixi_status"),
  pixiEan: text("pixi_ean"),
  pixiCheckedAt: timestamp("pixi_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isDefault: boolean("is_default"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Supplier profiles for web scraping
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  supplNr: text("suppl_nr"),
  urlPattern: text("url_pattern"),
  description: text("description"),
  selectors: jsonb("selectors").notNull(), // JSON object of ScraperSelectors
  productLinkSelector: text("product_link_selector"),
  sessionCookies: text("session_cookies"), // Session cookies for authenticated access
  userAgent: text("user_agent"), // Custom user agent string
  loginUrl: text("login_url"), // URL to POST credentials to
  loginUsernameField: text("login_username_field"), // Form field name for username
  loginPasswordField: text("login_password_field"), // Form field name for password
  loginUsername: text("login_username"), // Stored username
  loginPassword: text("login_password"), // Encrypted password
  verifiedFields: jsonb("verified_fields"), // JSON array of verified field names
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Temporary scrape session - stores scraped products until new scrape or manual clear
export const scrapeSession = pgTable("scrape_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  scrapedProducts: jsonb("scraped_products").notNull(), // JSON array of ScrapedProduct[]
  scrapedProduct: jsonb("scraped_product"), // JSON object of single ScrapedProduct
  generatedDescription: text("generated_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  projects: many(projects),
  products: many(productsInProjects),
  suppliers: many(suppliers),
  templates: many(templates),
  scrapeSessions: many(scrapeSession),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  projects: many(projects),
  suppliers: many(suppliers),
  scrapeSessions: many(scrapeSession),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [projects.tenantId],
    references: [tenants.id],
  }),
  products: many(productsInProjects),
}));

export const productsInProjectsRelations = relations(productsInProjects, ({ one }) => ({
  project: one(projects, {
    fields: [productsInProjects.projectId],
    references: [projects.id],
  }),
  tenant: one(tenants, {
    fields: [productsInProjects.tenantId],
    references: [tenants.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ one }) => ({
  user: one(users, {
    fields: [suppliers.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [suppliers.tenantId],
    references: [tenants.id],
  }),
}));

export const scrapeSessionRelations = relations(scrapeSession, ({ one }) => ({
  user: one(users, {
    fields: [scrapeSession.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [scrapeSession.tenantId],
    references: [tenants.id],
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
  supplNr: z.string().optional(),
  urlPattern: z.string().optional(),
  description: z.string().optional(),
  selectors: z.record(z.string(), z.string()),
  productLinkSelector: z.string().optional(),
  sessionCookies: z.string().optional(),
  userAgent: z.string().optional(),
  loginUrl: z.string().optional(),
  loginUsernameField: z.string().optional(),
  loginPasswordField: z.string().optional(),
  loginUsername: z.string().optional(),
  loginPassword: z.string().optional(),
  verifiedFields: z.array(z.string()).optional(),
  lastVerifiedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Supplier = z.infer<typeof supplierSchema>;

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  supplNr: z.string().optional(),
  urlPattern: z.string().optional(),
  description: z.string().optional(),
  selectors: z.record(z.string(), z.string()).default({}),
  productLinkSelector: z.string().optional(),
  sessionCookies: z.string().optional(),
  userAgent: z.string().optional(),
  loginUrl: z.string().optional(),
  loginUsernameField: z.string().optional(),
  loginPasswordField: z.string().optional(),
  loginUsername: z.string().optional(),
  loginPassword: z.string().optional(),
  verifiedFields: z.array(z.string()).optional(),
  lastVerifiedAt: z.string().optional(),
});

export type CreateSupplier = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;

// Tenant schemas for multi-tenant B2B SaaS
export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  settings: z.record(z.string(), z.any()).optional().default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Tenant = z.infer<typeof tenantSchema>;

export const createTenantSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  slug: z.string().min(1, "Slug ist erforderlich"),
  settings: z.record(z.string(), z.any()).optional(),
});

export type CreateTenant = z.infer<typeof createTenantSchema>;

// User schemas for authentication
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().optional(),
  isAdmin: z.boolean().optional().default(false),
  tenantId: z.string().optional(),
  role: z.enum(['admin', 'member']).optional().default('member'),
  stripeCustomerId: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  subscriptionId: z.string().optional(),
  planId: z.string().optional(),
  currentPeriodEnd: z.string().optional(),
  apiCallsUsed: z.number().default(0),
  apiCallsLimit: z.number().default(500),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const registerUserSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
  username: z.string().optional(),
});

export type RegisterUser = z.infer<typeof registerUserSchema>;

export const loginUserSchema = z.object({
  email: z.string().min(1, "Benutzername oder E-Mail erforderlich"), // Accepts username OR email
  password: z.string().min(1, "Passwort erforderlich"),
});

export type LoginUser = z.infer<typeof loginUserSchema>;

// Drizzle insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertProductInProjectSchema = createInsertSchema(productsInProjects).omit({ id: true, createdAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
