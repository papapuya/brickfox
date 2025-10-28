/**
 * Parst technische Daten 1:1 aus extrahiertem Text
 * KEINE AI-Interpretation - nur direktes Mapping
 */

import { ProductCategoryConfig } from './category-config';

export interface ParsedTechSpecs {
  specs: Record<string, string>;
  source: 'vision_text' | 'structured_data' | 'none';
}

/**
 * Extrahiert Tech Specs 1:1 aus Vision-extrahiertem Text
 */
export function parseTechSpecsFromText(
  extractedText: string,
  categoryConfig: ProductCategoryConfig
): ParsedTechSpecs {
  const specs: Record<string, string> = {};
  
  // Pattern für Tech Spec Zeilen: "- Feldname: Wert" oder "Feldname: Wert"
  const lines = extractedText.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Pattern: "- Kapazität: 3800mAh" oder "Kapazität: 3800mAh"
    const match = trimmed.match(/^-?\s*([^:]+):\s*(.+)$/);
    if (!match) continue;
    
    const fieldName = match[1].trim();
    const value = match[2].trim();
    
    // Mappe auf Kategorie-Felder
    for (const field of categoryConfig.technicalFields) {
      // Exakte Match oder ähnliche Varianten
      const normalizedFieldName = normalizeFieldName(fieldName);
      const normalizedLabel = normalizeFieldName(field.label);
      const normalizedKey = normalizeFieldName(field.key);
      
      if (normalizedFieldName === normalizedLabel || normalizedFieldName === normalizedKey) {
        // Skip "Nicht spezifiziert", "Nicht angegeben", etc.
        if (isValidValue(value)) {
          specs[field.label] = value;
          console.log(`✅ 1:1 Text-Parse: ${field.label} = ${value}`);
        }
        break;
      }
    }
  }
  
  return {
    specs,
    source: Object.keys(specs).length > 0 ? 'vision_text' : 'none',
  };
}

/**
 * Extrahiert Tech Specs aus strukturierten Daten (falls vorhanden)
 */
export function extractTechSpecsFromStructured(
  structuredData: any,
  categoryConfig: ProductCategoryConfig
): ParsedTechSpecs {
  if (!structuredData) {
    return { specs: {}, source: 'none' };
  }
  
  const specs: Record<string, string> = {};
  
  // Prüfe auf verschiedene mögliche Strukturen
  const sources = [
    structuredData.technicalData,
    structuredData.technicalSpecs,
    structuredData.specs,
    structuredData.technischeDaten,
  ].filter(Boolean);
  
  for (const source of sources) {
    for (const field of categoryConfig.technicalFields) {
      const value = source[field.label] || source[field.key];
      if (value && isValidValue(value)) {
        specs[field.label] = value;
        console.log(`✅ 1:1 Strukturierte Daten: ${field.label} = ${value}`);
      }
    }
  }
  
  return {
    specs,
    source: Object.keys(specs).length > 0 ? 'structured_data' : 'none',
  };
}

/**
 * Kombinierte Extraktion: Strukturierte Daten > Text-Parsing
 */
export function extractTechSpecs1to1(
  extractedText: string,
  structuredData: any,
  categoryConfig: ProductCategoryConfig
): Record<string, string> {
  // Priorität 1: Strukturierte Daten (wenn vorhanden)
  const structuredResult = extractTechSpecsFromStructured(structuredData, categoryConfig);
  if (structuredResult.source !== 'none') {
    console.log(`📊 Using ${Object.keys(structuredResult.specs).length} specs from structured data`);
    return structuredResult.specs;
  }
  
  // Priorität 2: Text-Parsing
  const textResult = parseTechSpecsFromText(extractedText, categoryConfig);
  if (textResult.source !== 'none') {
    console.log(`📊 Using ${Object.keys(textResult.specs).length} specs from text parsing`);
    return textResult.specs;
  }
  
  console.log('⚠️ No tech specs found in data');
  return {};
}

/**
 * Normalisiert Feldnamen für besseres Matching
 */
function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[äöüß]/g, match => {
      const map: Record<string, string> = { 'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss' };
      return map[match] || match;
    })
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Prüft, ob ein Wert gültig ist (nicht "Nicht angegeben" etc.)
 */
function isValidValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  const invalid = [
    'nicht angegeben',
    'nicht spezifiziert',
    'nicht sichtbar',
    'unbekannt',
    'n/a',
    'na',
    'keine angabe',
  ];
  
  const normalized = value.toLowerCase().trim();
  return !invalid.includes(normalized) && normalized.length > 0;
}
