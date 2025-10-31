/**
 * Brickfox Mapper Service
 * Transforms scraped product data into Brickfox CSV format
 */

import { 
  BRICKFOX_FIELDS, 
  BrickfoxExportMapping, 
  DEFAULT_BRICKFOX_MAPPING,
  getBrickfoxField 
} from '../../shared/brickfox-schema';
import type { ProductInProject } from '../../shared/schema';

export interface BrickfoxRow {
  [key: string]: string | number | boolean | null;
}

export interface BrickfoxMapperOptions {
  supplierName?: string;
  customMapping?: BrickfoxExportMapping;
  enableAI?: boolean;
}

/**
 * Calculate sales price from purchase price
 * Formula: (EK * 2) + 19% MwSt
 */
function calculateSalesPrice(purchasePrice: number): number {
  const margin = purchasePrice * 2;
  const withTax = margin * 1.19;
  return Math.round(withTax * 100) / 100; // Round to 2 decimals
}

/**
 * Parse weight from string (e.g., "150g" → 150, "1.5 kg" → 1500)
 */
function parseWeight(weight: string | number | null): number | null {
  if (weight === null || weight === undefined) return null;
  if (typeof weight === 'number') return weight;
  
  const str = weight.toString().toLowerCase().trim();
  
  // German decimal format handling:
  // - Comma = decimal separator
  // - Dot = thousand separator
  // Examples: "1.234,5 kg", "2.500 g", "1,5 kg", "101 g"
  let normalized = str;
  if (str.includes(',')) {
    // Has comma → German format with decimal
    // Remove all dots (thousand separators), replace comma with dot
    // "1.234,5 kg" → "1234.5", "39,75" → "39.75"
    normalized = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    // Has dot but no comma → Could be German thousand separator OR English decimal
    // Most data has commas, but some numbers use dots as thousand separators
    
    // Extract just the number part
    const numPart = str.match(/[\d.]+/)?.[0] || str;
    
    // Heuristic: Dot followed by exactly 3 digits → German thousand separator
    // "2.500 g" → 2500g (thousand)
    // "2.5 kg" → 2.5kg (decimal)
    // "1.234 €" → 1234€ (thousand)
    const dotMatch = numPart.match(/\.(\d+)$/);
    if (dotMatch && dotMatch[1].length === 3) {
      // Exactly 3 digits after last dot → German thousand separator
      normalized = str.replace(/\./g, '');
    }
    // Otherwise keep dot as decimal: "1.5 kg", "0.75 kg", "10.99 €"
  }
  // No dot or comma: "101 g" → "101", "250 g" → "250"
  
  const match = normalized.match(/(\d+\.?\d*)\s*(g|kg|gram|kilogram)?/);
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  if (unit && (unit.startsWith('kg') || unit.startsWith('kilogram'))) {
    return value * 1000; // Convert kg to g
  }
  
  return value;
}

/**
 * Parse price from string (e.g., "12,50 €" → 12.50, "$15.99" → 15.99)
 */
function parsePrice(price: string | number | null): number | null {
  if (price === null || price === undefined) return null;
  if (typeof price === 'number') return price;
  
  // Remove currency symbols and whitespace
  let str = price.toString().replace(/[^\d,.-]/g, '').trim();
  
  // German decimal format handling (same logic as parseWeight):
  // - Comma = decimal separator
  // - Dot = thousand separator
  // Examples: "1.234,56 €" → 1234.56, "39,75 €" → 39.75, "9,92 €" → 9.92
  let normalized = str;
  if (str.includes(',')) {
    // Has comma → German format with decimal
    // Remove all dots (thousand separators), replace comma with dot
    // "1.234,56" → "1234.56", "39,75" → "39.75"
    normalized = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    // Has dot but no comma → Could be German thousand separator OR English decimal
    // Most data has commas, but some numbers use dots as thousand separators
    
    // Heuristic: Dot followed by exactly 3 digits → German thousand separator
    // "1.234 €" → 1234€ (thousand)
    // "2.500 €" → 2500€ (thousand)
    // "15.99 €" → 15.99€ (decimal, only 2 digits)
    const dotMatch = str.match(/\.(\d+)$/);
    if (dotMatch && dotMatch[1].length === 3) {
      // Exactly 3 digits after last dot → German thousand separator
      normalized = str.replace(/\./g, '');
    }
    // Otherwise keep dot as decimal: "15.99", "9.95"
  }
  
  const value = parseFloat(normalized);
  return isNaN(value) ? null : value;
}

/**
 * Get value from product data using field mapping
 */
function getFieldValue(
  product: ProductInProject,
  mapping: BrickfoxExportMapping,
  brickfoxField: string,
  supplierName?: string
): string | number | boolean | null {
  const config = mapping[brickfoxField];
  if (!config) return null;
  
  const fieldMeta = getBrickfoxField(brickfoxField);
  if (!fieldMeta) return null;
  
  // Constant value
  if (config.source === 'constant') {
    return config.value ?? fieldMeta.defaultValue ?? null;
  }
  
  // Scraped value
  if (config.source === 'scraped' && config.field) {
    // Try direct product fields first
    let value: any = (product as any)[config.field];
    
    // If not found, try extractedData array (new format: [{key, value, type}])
    if (!value && product.extractedData && product.extractedData.length > 0) {
      const extracted = product.extractedData.find((item: any) => item.key === config.field);
      if (extracted) {
        value = (extracted as any).value;
      }
    }
    
    // DEBUG: Log what we found
    if (config.field === 'hersteller' || config.field === 'preis' || config.field === 'gewicht' || config.field === 'kategorie' || config.field === 'ean') {
      console.log(`[Brickfox Mapper] Field: ${config.field}, Found value:`, value);
      console.log(`[Brickfox Mapper] Product extractedData:`, product.extractedData);
      console.log(`[Brickfox Mapper] Product customAttributes:`, product.customAttributes);
    }
    
    // Parse based on field type
    if (fieldMeta.type === 'number' || fieldMeta.key === 'v_weight') {
      value = parseWeight(value);
    } else if (fieldMeta.type === 'price') {
      value = parsePrice(value);
    }
    
    return value ?? null;
  }
  
  // Calculated value
  if (config.source === 'calculated') {
    if (brickfoxField === 'v_price[Eur]') {
      const purchasePrice = getFieldValue(product, mapping, 'v_purchase_price', supplierName);
      if (typeof purchasePrice === 'number') {
        return calculateSalesPrice(purchasePrice);
      }
    }
    return null;
  }
  
  // Supplier-specific values
  if (brickfoxField === 'v_supplier[Eur]' && supplierName) {
    return supplierName;
  }
  
  // AI-generated values from customAttributes
  if (config.source === 'ai') {
    const customAttrs = product.customAttributes || [];
    
    // Map Brickfox field to AI custom attribute key
    const aiFieldMap: Record<string, string> = {
      'p_description[de]': 'ai_description',
      'v_customs_tariff_number': 'ai_customs_tariff_number',
      'v_customs_tariff_text': 'ai_customs_tariff_text',
      'p_attributes[OTTOMARKET_GEFAHRGUT][de]': 'ai_hazard_product',
      'v_attributes[OTTOMARKET_GEFAHRGUT][de]': 'ai_hazard_variant',
    };
    
    const aiKey = aiFieldMap[brickfoxField];
    if (aiKey) {
      const aiAttr = customAttrs.find(a => a.key === aiKey);
      return aiAttr?.value || null;
    }
    
    return null;
  }
  
  return null;
}

/**
 * Transform a single product into Brickfox row(s)
 * Note: Most products have single variant, so we create one row per product
 */
export function mapProductToBrickfox(
  product: ProductInProject,
  options: BrickfoxMapperOptions = {}
): BrickfoxRow {
  const mapping = options.customMapping || DEFAULT_BRICKFOX_MAPPING;
  const row: BrickfoxRow = {};
  
  // Map all Brickfox fields
  for (const field of BRICKFOX_FIELDS) {
    const value = getFieldValue(product, mapping, field.key, options.supplierName);
    row[field.key] = value;
  }
  
  return row;
}

/**
 * Transform multiple products into Brickfox rows
 */
export function mapProductsToBrickfox(
  products: ProductInProject[],
  options: BrickfoxMapperOptions = {}
): BrickfoxRow[] {
  return products.map(product => mapProductToBrickfox(product, options));
}

/**
 * Get column headers in correct Brickfox order
 */
export function getBrickfoxColumns(): string[] {
  return BRICKFOX_FIELDS.map(f => f.key);
}

/**
 * Convert Brickfox rows to CSV string
 */
export function brickfoxRowsToCSV(rows: BrickfoxRow[]): string {
  if (rows.length === 0) return '';
  
  const columns = getBrickfoxColumns();
  const header = columns.join(',');
  
  const dataRows = rows.map(row => {
    return columns.map(col => {
      const value = row[col];
      
      if (value === null || value === undefined) return '';
      
      // Handle booleans
      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }
      
      // Handle numbers - convert to German decimal format (comma instead of dot)
      if (typeof value === 'number') {
        // Convert to German format: 68.95 → "68,95"
        return value.toString().replace('.', ',');
      }
      
      // Handle strings - escape quotes and wrap if contains comma/quotes/newline
      const str = value.toString();
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      
      return str;
    }).join(',');
  });
  
  return [header, ...dataRows].join('\n');
}
