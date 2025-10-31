/**
 * Brickfox CSV Export Schema
 * Defines all Brickfox fields, their types, scopes, and default values
 */

export type BrickfoxFieldScope = 'product' | 'variant';
export type BrickfoxFieldType = 'string' | 'number' | 'boolean' | 'price';
export type BrickfoxSourceType = 'scraped' | 'constant' | 'calculated' | 'ai_generated';

export interface BrickfoxFieldMeta {
  key: string;
  label: string;
  scope: BrickfoxFieldScope;
  type: BrickfoxFieldType;
  locale?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  sourceType: BrickfoxSourceType;
  description?: string;
  calculation?: string; // Formula description
}

export const BRICKFOX_FIELDS: BrickfoxFieldMeta[] = [
  // Product-level fields
  {
    key: 'p_item_number',
    label: 'Artikelnummer',
    scope: 'product',
    type: 'string',
    required: true,
    sourceType: 'scraped',
    description: 'Eindeutige Artikelnummer des Produkts'
  },
  {
    key: 'p_group_path[de]',
    label: 'Kategoriepfad',
    scope: 'product',
    type: 'string',
    locale: 'de',
    sourceType: 'scraped',
    description: 'Kategoriepfad (z.B. "Akkus > Werkzeugakkus > Makita")'
  },
  {
    key: 'p_brand',
    label: 'Marke / Hersteller',
    scope: 'product',
    type: 'string',
    sourceType: 'scraped',
    description: 'Marke oder Hersteller des Produkts'
  },
  {
    key: 'p_status',
    label: 'Produktstatus',
    scope: 'product',
    type: 'string',
    defaultValue: 'Aktiv',
    sourceType: 'constant',
    description: 'Status des Produkts (Aktiv/Inaktiv)'
  },
  {
    key: 'p_name[de]',
    label: 'Produktname (deutsch)',
    scope: 'product',
    type: 'string',
    locale: 'de',
    required: true,
    sourceType: 'scraped',
    description: 'Produktname in deutscher Sprache'
  },
  {
    key: 'p_tax_class',
    label: 'Steuerklasse',
    scope: 'product',
    type: 'string',
    defaultValue: 'Regelsteuersatz (19%)',
    sourceType: 'constant',
    description: 'Steuerklasse für das Produkt'
  },
  {
    key: 'p_never_out_of_stock',
    label: 'Immer lieferbar',
    scope: 'product',
    type: 'boolean',
    defaultValue: false,
    sourceType: 'constant',
    description: 'Ob das Produkt immer lieferbar ist'
  },
  {
    key: 'p_condition',
    label: 'Zustand',
    scope: 'product',
    type: 'string',
    defaultValue: 'Neu',
    sourceType: 'constant',
    description: 'Zustand des Produkts (Neu/Gebraucht)'
  },
  {
    key: 'p_country',
    label: 'Herkunftsland',
    scope: 'product',
    type: 'string',
    defaultValue: 'China',
    sourceType: 'constant',
    description: 'Herkunftsland des Produkts'
  },
  {
    key: 'p_description[de]',
    label: 'Produktbeschreibung (deutsch)',
    scope: 'product',
    type: 'string',
    locale: 'de',
    sourceType: 'ai_generated',
    description: 'KI-optimierte Produktbeschreibung basierend auf Lieferantenbeschreibung'
  },
  {
    key: 'p_attributes[OTTOMARKET_GEFAHRGUT][de]',
    label: 'Gefahrgut-Attribut (OTTO)',
    scope: 'product',
    type: 'string',
    locale: 'de',
    sourceType: 'ai_generated',
    description: 'KI-generiertes Gefahrgut-Attribut für OTTO Market'
  },
  {
    key: 'p_keywords[de]',
    label: 'SEO Keywords (deutsch)',
    scope: 'product',
    type: 'string',
    locale: 'de',
    sourceType: 'ai_generated',
    description: '6 KI-generierte SEO Keywords (komma-separiert)'
  },
  {
    key: 'p_seo_description[de]',
    label: 'SEO Produktbeschreibung (deutsch)',
    scope: 'product',
    type: 'string',
    locale: 'de',
    sourceType: 'ai_generated',
    description: 'KI-optimierte SEO Produktbeschreibung'
  },

  // Variant-level fields
  {
    key: 'v_item_number',
    label: 'Varianten-Artikelnummer',
    scope: 'variant',
    type: 'string',
    sourceType: 'scraped',
    description: 'Artikelnummer der Variante (kann gleich p_item_number sein)'
  },
  {
    key: 'v_ean',
    label: 'EAN / GTIN',
    scope: 'variant',
    type: 'string',
    sourceType: 'scraped',
    description: 'EAN-Code der Variante'
  },
  {
    key: 'v_manufacturers_item_number',
    label: 'Herstellerartikelnummer',
    scope: 'variant',
    type: 'string',
    sourceType: 'scraped',
    description: 'Artikelnummer beim Hersteller'
  },
  {
    key: 'v_status',
    label: 'Variantenstatus',
    scope: 'variant',
    type: 'string',
    defaultValue: 'aktiv',
    sourceType: 'constant',
    description: 'Status der Variante'
  },
  {
    key: 'v_classification',
    label: 'Variantenklassifizierung',
    scope: 'variant',
    type: 'string',
    defaultValue: 'X',
    sourceType: 'constant',
    description: 'Klassifizierung der Variante (z.B. Größe, Farbe, Kapazität)'
  },
  {
    key: 'v_price[Eur]',
    label: 'Verkaufspreis (EUR)',
    scope: 'variant',
    type: 'price',
    locale: 'Eur',
    sourceType: 'calculated',
    calculation: 'EK * 2 + 19%',
    description: 'Berechneter Verkaufspreis: (Einkaufspreis * 2) + 19% MwSt'
  },
  {
    key: 'v_delivery_time[de]',
    label: 'Lieferzeit (deutsch)',
    scope: 'variant',
    type: 'string',
    locale: 'de',
    defaultValue: '3-5 Tage',
    sourceType: 'constant',
    description: 'Lieferzeit für die Variante'
  },
  {
    key: 'v_supplier[Eur]',
    label: 'Lieferant',
    scope: 'variant',
    type: 'string',
    locale: 'Eur',
    sourceType: 'constant',
    description: 'Name des Lieferanten (automatisch vom Supplier-Namen)'
  },
  {
    key: 'v_supplier_item_number',
    label: 'Artikelnummer beim Lieferanten',
    scope: 'variant',
    type: 'string',
    sourceType: 'scraped',
    description: 'Artikelnummer wie beim Lieferanten gelistet'
  },
  {
    key: 'v_purchase_price',
    label: 'Einkaufspreis',
    scope: 'variant',
    type: 'price',
    sourceType: 'scraped',
    description: 'Einkaufspreis vom Lieferanten'
  },
  {
    key: 'v_never_out_of_stock[standard]',
    label: 'Immer verfügbar (Variante)',
    scope: 'variant',
    type: 'boolean',
    defaultValue: false,
    sourceType: 'constant',
    description: 'Ob die Variante immer verfügbar ist'
  },
  {
    key: 'v_weight',
    label: 'Gewicht (g)',
    scope: 'variant',
    type: 'number',
    sourceType: 'scraped',
    description: 'Gewicht der Variante in Gramm'
  },
  {
    key: 'v_customs_tariff_number',
    label: 'Zolltarifnummer',
    scope: 'variant',
    type: 'string',
    sourceType: 'ai_generated',
    description: 'KI-generierte Zolltarifnummer (falls nicht gescraped)'
  },
  {
    key: 'v_customs_tariff_text',
    label: 'Beschreibung des Zolltarifs',
    scope: 'variant',
    type: 'string',
    sourceType: 'scraped',
    description: 'Beschreibung des Zolltarifs'
  },
  {
    key: 'v_attributes[OTTOMARKET_GEFAHRGUT][de]',
    label: 'Gefahrgut-Attribut Variante (OTTO)',
    scope: 'variant',
    type: 'string',
    locale: 'de',
    sourceType: 'ai_generated',
    description: 'KI-generiertes Gefahrgut-Attribut für OTTO Market'
  },
];

// Helper: Get all fields by scope
export function getBrickfoxFieldsByScope(scope: BrickfoxFieldScope): BrickfoxFieldMeta[] {
  return BRICKFOX_FIELDS.filter(f => f.scope === scope);
}

// Helper: Get field by key
export function getBrickfoxField(key: string): BrickfoxFieldMeta | undefined {
  return BRICKFOX_FIELDS.find(f => f.key === key);
}

// Helper: Get all scraped fields (for UI mapping dropdown)
export function getScrapedFields(): BrickfoxFieldMeta[] {
  return BRICKFOX_FIELDS.filter(f => f.sourceType === 'scraped');
}

// Helper: Get all constant fields
export function getConstantFields(): BrickfoxFieldMeta[] {
  return BRICKFOX_FIELDS.filter(f => f.sourceType === 'constant');
}

// Helper: Get all AI-generated fields
export function getAIGeneratedFields(): BrickfoxFieldMeta[] {
  return BRICKFOX_FIELDS.filter(f => f.sourceType === 'ai_generated');
}

// Mapping configuration type for suppliers
export interface BrickfoxExportMapping {
  [brickfoxField: string]: {
    source: 'scraped' | 'constant' | 'calculated' | 'ai';
    field?: string; // Scraped field name (e.g., 'articleNumber', 'productName')
    value?: string | number | boolean; // Constant value
  };
}

// Default mapping template (can be overridden per supplier)
export const DEFAULT_BRICKFOX_MAPPING: BrickfoxExportMapping = {
  // Product fields - scraped
  'p_item_number': { source: 'scraped', field: 'articleNumber' },
  'p_group_path[de]': { source: 'scraped', field: 'kategorie' },  // German field name
  'p_brand': { source: 'scraped', field: 'hersteller' },  // German field name
  'p_name[de]': { source: 'scraped', field: 'productName' },
  
  // Product fields - constants
  'p_status': { source: 'constant', value: 'Aktiv' },
  'p_tax_class': { source: 'constant', value: 'Regelsteuersatz (19%)' },
  'p_never_out_of_stock': { source: 'constant', value: false },
  'p_condition': { source: 'constant', value: 'Neu' },
  'p_country': { source: 'constant', value: 'China' },
  
  // Product fields - AI
  'p_description[de]': { source: 'scraped', field: 'htmlCode' },  // Use scraped HTML description
  'p_attributes[OTTOMARKET_GEFAHRGUT][de]': { source: 'ai' },
  'p_keywords[de]': { source: 'ai' },
  'p_seo_description[de]': { source: 'ai' },
  
  // Variant fields - scraped
  'v_item_number': { source: 'scraped', field: 'articleNumber' },
  'v_ean': { source: 'scraped', field: 'ean' },
  'v_manufacturers_item_number': { source: 'scraped', field: 'articleNumber' },
  'v_supplier_item_number': { source: 'scraped', field: 'articleNumber' },
  'v_purchase_price': { source: 'scraped', field: 'preis' },  // German field name
  'v_weight': { source: 'scraped', field: 'gewicht' },  // German field name
  'v_customs_tariff_text': { source: 'scraped', field: 'customsTariff' },
  
  // Variant fields - constants
  'v_status': { source: 'constant', value: 'aktiv' },
  'v_classification': { source: 'constant', value: 'X' },
  'v_delivery_time[de]': { source: 'constant', value: '3-5 Tage' },
  'v_supplier[Eur]': { source: 'constant', value: 'Unbekannt' },  // Will be replaced with actual supplier name
  'v_never_out_of_stock[standard]': { source: 'constant', value: true },  // Always available
  
  // Variant fields - calculated
  'v_price[Eur]': { source: 'calculated' }, // Will be calculated from v_purchase_price
  
  // Variant fields - AI
  'v_customs_tariff_number': { source: 'ai' },
  'v_attributes[OTTOMARKET_GEFAHRGUT][de]': { source: 'ai' },
};
