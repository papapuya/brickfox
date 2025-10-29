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
 * DYNAMISCH: Extrahiert ALLE "Feld: Wert" Paare, nicht nur vordefinierte
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
    const match = trimmed.match(/^-?\s*\*?\*?\s*([^:]+):\s*(.+)$/);
    if (!match) continue;
    
    let fieldName = match[1].trim();
    const value = match[2].trim();
    
    // Skip invalide Werte
    if (!isValidValue(value)) continue;
    
    // Bereinige Feldnamen (entferne **, etc.)
    fieldName = fieldName.replace(/\*\*/g, '').trim();
    
    // Mappe auf bekannte Kategorie-Felder (für konsistente Labels)
    let mappedFieldName = fieldName;
    for (const field of categoryConfig.technicalFields) {
      const normalizedFieldName = normalizeFieldName(fieldName);
      const normalizedLabel = normalizeFieldName(field.label);
      const normalizedKey = normalizeFieldName(field.key);
      
      if (normalizedFieldName === normalizedLabel || normalizedFieldName === normalizedKey) {
        mappedFieldName = field.label; // Nutze konsistenten Label
        break;
      }
    }
    
    // SPEZIAL: Vereinfache Schutzschaltung (entferne redundante "Schutz"-Wörter)
    let cleanedValue = value;
    if (mappedFieldName === 'Schutzschaltung' || normalizeFieldName(fieldName).includes('schutz')) {
      // "PCB/BMS Schutz, Überlade- und Entladeschutz, Kurzschlussschutz" → "PCB/BMS"
      cleanedValue = value.split(',')[0].replace(/schutz$/i, '').trim();
    }
    
    // Speichere ALLE Specs (auch unbekannte)
    specs[mappedFieldName] = cleanedValue;
    console.log(`✅ 1:1 Text-Parse: ${mappedFieldName} = ${cleanedValue}`);
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
    structuredData, // WICHTIG: Auch direkt im Hauptobjekt suchen (für CSV-Daten)
  ].filter(Boolean);
  
  for (const source of sources) {
    for (const field of categoryConfig.technicalFields) {
      // Suche nach verschiedenen Varianten des Feldnamens
      const possibleKeys = [
        field.key,
        field.label,
        field.key.toLowerCase(),
        field.label.toLowerCase(),
        // CSV-spezifische Varianten
        field.key.replace(/_/g, ''),
        field.key.replace(/_/g, ' '),
      ];
      
      let value = null;
      for (const key of possibleKeys) {
        if (source[key] && isValidValue(source[key])) {
          value = source[key];
          break;
        }
      }
      
      if (value) {
        // SPEZIAL: Vereinfache Schutzschaltung
        let cleanedValue = value;
        if (field.key === 'protection' || field.label === 'Schutzschaltung') {
          cleanedValue = value.split(',')[0].replace(/schutz$/i, '').trim();
        }
        
        specs[field.label] = cleanedValue;
        console.log(`✅ 1:1 Strukturierte Daten: ${field.label} = ${cleanedValue}`);
      }
    }
  }
  
  // DYNAMISCH: Extrahiere ALLE übrigen Felder (auch wenn nicht in categoryConfig)
  // Dies ermöglicht dynamische Tabellen mit 18+ Specs
  const processedKeys = new Set(Object.keys(specs).map(k => normalizeFieldName(k)));
  
  for (const key of Object.keys(structuredData)) {
    const value = structuredData[key];
    
    // Skip bereits verarbeitete Felder
    if (processedKeys.has(normalizeFieldName(key))) continue;
    
    // Skip Meta-Felder
    if (['productName', 'product_name', 'seoName', 'description'].includes(key)) continue;
    
    // Nur gültige Werte
    if (!isValidValue(value)) continue;
    
    // Formatiere Feldnamen (z.B. "capacity_mah" → "Kapazität mAh")
    const formattedKey = formatFieldName(key);
    specs[formattedKey] = value;
    console.log(`✅ 1:1 Dynamisches Feld: ${formattedKey} = ${value}`);
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

function formatFieldName(key: string): string {
  // Entferne Unterstriche und formatiere
  let formatted = key.replace(/_/g, ' ');
  
  // Großschreibe ersten Buchstaben jedes Wortes
  formatted = formatted.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return formatted;
}
