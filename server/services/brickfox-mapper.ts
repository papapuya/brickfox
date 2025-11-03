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

// Debug logging helper - only logs when DEBUG_MODE=true
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
function debugLog(...args: any[]) {
  if (DEBUG_MODE) {
    console.log('[Brickfox Mapper DEBUG]', ...args);
  }
}

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
 * Formula: floor((EK * 2) * 1.19) + 0.95 (ANSMANN formula)
 */
function calculateSalesPrice(purchasePrice: number): number {
  const margin = purchasePrice * 2;
  const withTax = margin * 1.19;
  return Math.floor(withTax) + 0.95; // Floor + 0.95 (ANSMANN standard)
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
 * Intelligentes Auto-Mapping: Erkennt automatisch Felder aus den Produktdaten
 * basierend auf Label-Namen (z.B. "Produktbeschreibung", "VK (Verkaufspreis)", "Länge")
 */
function autoMapFieldByLabel(
  product: ProductInProject,
  brickfoxField: string
): string | number | boolean | null {
  if (!product.extractedData || product.extractedData.length === 0) {
    return null;
  }

  // Mapping von Brickfox-Feldern zu möglichen Label-Namen (case-insensitive)
  const labelMappings: Record<string, string[]> = {
    'p_item_number': ['artikelnummer', 'art.-nr', 'art.nr', 'artnr', 'item number', 'sku'],
    'p_name[de]': ['produktname', 'name', 'bezeichnung', 'product name', 'title'],
    'p_description[de]': ['produktbeschreibung', 'beschreibung', 'description', 'langtext', 'long text'],
    'v_ean': ['ean', 'ean-code', 'ean code', 'barcode', 'gtin'],
    'v_price[Eur]': ['vk (verkaufspreis)', 'vk', 'verkaufspreis', 'uvp', 'preis', 'price', 'rrp'],
    'v_purchase_price': ['ek-preis', 'ek', 'einkaufspreis', 'purchase price', 'cost'],
    'v_weight': ['gewicht', 'weight', 'netto-gewicht', 'bruttogewicht'],
    'v_width': ['breite', 'width', 'b'],
    'v_height': ['höhe', 'hoehe', 'height', 'h'],
    'v_depth': ['länge', 'laenge', 'tiefe', 'length', 'depth', 'l'],
    'v_brand': ['hersteller', 'marke', 'brand', 'manufacturer'],
  };

  const possibleLabels = labelMappings[brickfoxField];
  if (!possibleLabels) return null;

  // Suche nach passendem Label in extractedData
  for (const item of product.extractedData) {
    if (!item.label) continue;
    
    const labelLower = item.label.toLowerCase().trim();
    
    // Exakte Übereinstimmung oder enthält das Schlüsselwort
    for (const keyword of possibleLabels) {
      if (labelLower === keyword || labelLower.includes(keyword)) {
        return item.value;
      }
    }
  }

  return null;
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
  const fieldMeta = getBrickfoxField(brickfoxField);
  if (!fieldMeta) return null;
  
  // SPECIAL CASE: p_description[de] soll IMMER Beschreibung verwenden (nicht Auto-Mapping!)
  if (brickfoxField === 'p_description[de]') {
    // Priority 1: htmlCode Feld (AI-generierter HTML-Code)
    const htmlCode = (product as any).htmlCode;
    if (htmlCode && htmlCode.trim()) {
      debugLog(`[SPECIAL] p_description[de] → htmlCode (${htmlCode.length} chars)`);
      return htmlCode;
    }
    
    // Priority 2: autoExtractedDescription aus extractedData
    if (product.extractedData && product.extractedData.length > 0) {
      const autoExtracted = product.extractedData.find((item: any) => 
        item.key === 'autoExtractedDescription'
      );
      if (autoExtracted && autoExtracted.value) {
        debugLog(`[SPECIAL] p_description[de] → autoExtractedDescription (${autoExtracted.value.length} chars)`);
        return autoExtracted.value;
      }
      
      // Priority 3: Fallback auf "Produktbeschreibung" Label
      const descItem = product.extractedData.find((item: any) => 
        item.label && item.label.toLowerCase().includes('produktbeschreibung')
      );
      if (descItem && descItem.value) {
        debugLog(`[SPECIAL] p_description[de] → Produktbeschreibung label (${descItem.value.length} chars)`);
        return descItem.value;
      }
    }
  }
  
  // SPECIAL CASE: p_image[1] bis p_image[10] - Extrahiere Bilder aus localImagePaths oder extractedData
  if (brickfoxField.startsWith('p_image[')) {
    const imageIndex = parseInt(brickfoxField.match(/\[(\d+)\]/)?.[1] || '0') - 1; // p_image[1] → Index 0
    
    // Priority 1: localImagePaths aus extractedData (heruntergeladene Bilder)
    if (product.extractedData && product.extractedData.length > 0) {
      const localImagesItem = product.extractedData.find((item: any) => 
        item.key === 'localImagePaths'
      );
      if (localImagesItem && localImagesItem.value) {
        // localImagePaths kann ein String "/path/to/image.jpg" oder ein Array sein
        let imagePaths: string[] = [];
        if (typeof localImagesItem.value === 'string') {
          // Einzelner Pfad oder komma-separierte Liste
          imagePaths = localImagesItem.value.split(',').map((p: string) => p.trim()).filter(Boolean);
        } else if (Array.isArray(localImagesItem.value)) {
          imagePaths = localImagesItem.value.filter(Boolean);
        }
        
        if (imagePaths[imageIndex]) {
          debugLog(`[SPECIAL] ${brickfoxField} → localImagePaths[${imageIndex}]: ${imagePaths[imageIndex]}`);
          return imagePaths[imageIndex];
        }
      }
    }
    
    // Priority 2: Direkt aus product.extractedData nach "images" oder ähnlichen Feldern suchen
    if (product.extractedData && product.extractedData.length > 0) {
      const imagesItem = product.extractedData.find((item: any) => 
        item.key === 'images' || item.key === 'productImages' || item.key === 'downloadedImages'
      );
      if (imagesItem && imagesItem.value) {
        let images: string[] = [];
        if (typeof imagesItem.value === 'string') {
          images = imagesItem.value.split(',').map((p: string) => p.trim()).filter(Boolean);
        } else if (Array.isArray(imagesItem.value)) {
          images = imagesItem.value.filter(Boolean);
        }
        
        if (images[imageIndex]) {
          debugLog(`[SPECIAL] ${brickfoxField} → images[${imageIndex}]: ${images[imageIndex]}`);
          return images[imageIndex];
        }
      }
    }
    
    // Kein Bild für diesen Index gefunden
    return null;
  }
  
  // STEP 1: Versuche intelligentes Auto-Mapping für andere Felder
  const autoMappedValue = autoMapFieldByLabel(product, brickfoxField);
  if (autoMappedValue !== null && autoMappedValue !== undefined && autoMappedValue !== '') {
    let value: any = autoMappedValue;
    
    // Parse based on field type
    if (fieldMeta.type === 'number' || fieldMeta.key === 'v_weight') {
      value = parseWeight(value);
    } else if (fieldMeta.type === 'price') {
      value = parsePrice(value);
    }
    
    debugLog(`[AUTO-MAPPED] ${brickfoxField} → ${value}`);
    return value;
  }
  
  // STEP 2: Falls kein Config vorhanden, Default-Wert verwenden
  if (!config) {
    return fieldMeta.defaultValue || null;
  }
  
  // Special handling for v_supplier[Eur] - always use supplierName if available
  if (brickfoxField === 'v_supplier[Eur]') {
    return supplierName || config.value || fieldMeta.defaultValue || 'Unbekannt';
  }
  
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
    
    // Debug logging - only when DEBUG_MODE=true
    debugLog(`Field: ${config.field}, Found value:`, value);
    
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
  
  // AI-generated values from customAttributes
  if (config.source === 'ai') {
    const customAttrs = product.customAttributes || [];
    
    // Map Brickfox field to AI custom attribute key
    const aiFieldMap: Record<string, string> = {
      'p_description[de]': 'ai_description',
      'v_customs_tariff_number': 'ai_customs_tariff_number',
      'v_customs_tariff_text': 'ai_customs_tariff_text',
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
