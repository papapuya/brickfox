import { pgTable, uuid, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { suppliers } from './schema';

/**
 * Field Mappings Table
 * Stores visual mapping configurations for Scraper → Brickfox CSV conversion
 * 
 * Example:
 * - source_field: "product.title" (from scraper)
 * - target_field: "Produktname" (Brickfox CSV column)
 * - transformation: { type: "uppercase", params: {} }
 */
export const fieldMappings = pgTable("field_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Link to supplier (each supplier can have custom mappings)
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "cascade" }),
  
  // Source field from scraper (JSON path notation)
  // Examples: "product.title", "product.price", "customAttributes.brand"
  sourceField: text("source_field").notNull(),
  
  // Target field in Brickfox CSV
  // Examples: "Produktname", "EAN", "Verkaufspreis", "Beschreibung"
  targetField: text("target_field").notNull(),
  
  // Optional transformation to apply
  // Examples: 
  // - { type: "uppercase" }
  // - { type: "regex", pattern: "\\d+", replacement: "" }
  // - { type: "concat", separator: " - ", fields: ["brand", "model"] }
  transformation: jsonb("transformation"),
  
  // Display order in UI (for sorting)
  displayOrder: text("display_order").default('0'),
  
  // Is this mapping active?
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Mapping Presets Table
 * Pre-configured mapping templates for common scenarios
 */
export const mappingPresets = pgTable("mapping_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Preset name (e.g., "Brickfox Standard", "MediaMarkt Format")
  name: text("name").notNull(),
  
  // Description
  description: text("description"),
  
  // Complete mapping configuration (JSON array of field mappings)
  mappingConfig: jsonb("mapping_config").notNull(),
  
  // Is this a system preset (not deletable by users)?
  isSystem: boolean("is_system").default(false),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Available Brickfox CSV Fields
 * Reference data for target fields
 */
export const brickfoxFields = [
  { key: 'Artikelnummer', label: 'Artikelnummer', required: true, type: 'string' },
  { key: 'EAN', label: 'EAN', required: false, type: 'string' },
  { key: 'Produktname', label: 'Produktname', required: true, type: 'string' },
  { key: 'Beschreibung', label: 'Beschreibung', required: false, type: 'html' },
  { key: 'Verkaufspreis', label: 'Verkaufspreis', required: false, type: 'number' },
  { key: 'Einkaufspreis', label: 'Einkaufspreis', required: false, type: 'number' },
  { key: 'Hersteller', label: 'Hersteller', required: false, type: 'string' },
  { key: 'Marke', label: 'Marke', required: false, type: 'string' },
  { key: 'Kategorie', label: 'Kategorie', required: false, type: 'string' },
  { key: 'Gewicht', label: 'Gewicht (kg)', required: false, type: 'number' },
  { key: 'Lagerbestand', label: 'Lagerbestand', required: false, type: 'number' },
  { key: 'Bild-URL', label: 'Bild-URL', required: false, type: 'url' },
  { key: 'SEO-Titel', label: 'SEO-Titel', required: false, type: 'string' },
  { key: 'SEO-Beschreibung', label: 'SEO-Beschreibung', required: false, type: 'string' },
  { key: 'Versandklasse', label: 'Versandklasse', required: false, type: 'string' },
  { key: 'Status', label: 'Status', required: false, type: 'string' },
] as const;

/**
 * Transformation Types
 */
export type TransformationType = 
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'regex'
  | 'concat'
  | 'prefix'
  | 'suffix'
  | 'custom';

export interface FieldTransformation {
  type: TransformationType;
  params?: Record<string, any>;
}
