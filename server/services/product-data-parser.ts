import * as cheerio from 'cheerio';

/**
 * Strukturierter Produktdaten-Parser
 * Extrahiert technische Angaben aus Web-Scraper-Rohdaten
 */
export interface StructuredProductData {
  Spannung?: string;
  Kapazität?: string;
  Zellchemie?: string;
  Artikelnummer?: string;
  Gewicht?: string;
  Länge?: string;
  Breite?: string;
  Höhe?: string;
  Energie?: string;
  Entladestrom?: string;
  Verpackungseinheit?: string;
  EAN?: string;
  [key: string]: string | undefined; // Für weitere Felder
}

/**
 * Übersetzungsmapping: Englisch -> Deutsch
 */
const TRANSLATION_MAP: Record<string, string> = {
  'voltage': 'Spannung',
  'capacity': 'Kapazität',
  'cell chemistry': 'Zellchemie',
  'chemistry': 'Zellchemie',
  'article number': 'Artikelnummer',
  'weight': 'Gewicht',
  'length': 'Länge',
  'width': 'Breite',
  'height': 'Höhe',
  'energy': 'Energie',
  'discharge current': 'Entladestrom',
  'packaging unit': 'Verpackungseinheit',
  'ean': 'EAN',
  'gtin': 'EAN',
  'barcode': 'EAN',
};

/**
 * Erkennungsmuster für technische Werte
 */
const PATTERNS = {
  // Spannung: 1.2V, 3.7V, 12V, etc.
  voltage: /(\d+[,\.]?\d*)\s*v(?:olt)?/gi,
  // Kapazität: 2850mAh, 1100 mAh, etc.
  capacity: /(\d+)\s*m(?:illi)?ah/gi,
  // Zellchemie: NiMH, Li-Ion, LiFePO4, etc.
  chemistry: /\b(nimh|li-ion|lifepo4|li-poly|alkaline|nicd|lead-acid)\b/gi,
  // Energie: 10.5Wh, 4.07 Wh, etc.
  energy: /(\d+[,\.]?\d*)\s*wh/gi,
  // Entladestrom: 5A, 10 A, etc.
  dischargeCurrent: /(\d+[,\.]?\d*)\s*a(?:mp(?:ere)?)?/gi,
  // Maße: 50x30x20mm, 50 × 30 × 20 mm, etc.
  dimensions: /(\d+[,\.]?\d*)\s*[×x]\s*(\d+[,\.]?\d*)\s*[×x]\s*(\d+[,\.]?\d*)\s*(?:mm|cm)/gi,
  // Gewicht: 25g, 100 g, etc.
  weight: /(\d+[,\.]?\d*)\s*g(?:ram)?/gi,
  // Artikelnummer: Zahlenfolgen, oft mit Bindestrichen
  articleNumber: /\b(\d{4,}[-]?\d{0,})\b/g,
  // EAN: 13-stellige Zahlen
  ean: /\b(\d{13})\b/g,
};

/**
 * Extrahiert strukturierte Produktdaten aus Scraper-Rohdaten
 */
export function parseStructuredProductData(data: {
  technicalDataTable?: string;
  autoExtractedDescription?: string;
  rawHtml?: string;
  [key: string]: any;
}): StructuredProductData {
  const result: StructuredProductData = {};

  // Bestimme die zu analysierende Quelle
  let sourceText = '';
  let sourceHtml = '';

  if (data.technicalDataTable) {
    sourceHtml = data.technicalDataTable;
    sourceText = extractTextFromHtml(data.technicalDataTable);
  } else if (data.rawHtml) {
    sourceHtml = data.rawHtml;
    sourceText = extractTextFromHtml(data.rawHtml);
  } else if (data.autoExtractedDescription) {
    sourceText = data.autoExtractedDescription;
  }

  if (!sourceText && !sourceHtml) {
    return {};
  }

  // Parse HTML-Struktur falls vorhanden
  if (sourceHtml) {
    parseHtmlStructure(sourceHtml, result);
  }

  // Parse Text-Inhalte
  parseTextContent(sourceText, result);

  return result;
}

/**
 * Extrahiert Text aus HTML
 */
function extractTextFromHtml(html: string): string {
  try {
    const $ = cheerio.load(html);
    return $.text();
  } catch (error) {
    // Fallback: Einfache HTML-Tag-Entfernung
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Parst HTML-Struktur (Tabellen, DIVs, etc.)
 */
function parseHtmlStructure(html: string, result: StructuredProductData): void {
  try {
    const $ = cheerio.load(html);

    // Parse Tabellen
    $('table tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      
      if (cells.length >= 2) {
        const label = cells.eq(0).text().trim().toLowerCase();
        const value = cells.eq(1).text().trim();
        
        mapFieldToResult(label, value, result);
      }
    });

    // Parse DIV-basierte Strukturen (Label-Value-Paare)
    $('[class*="label"], [class*="property"], dt, strong').each((_, el) => {
      const $el = $(el);
      const label = $el.text().trim().toLowerCase();
      
      // Versuche Wert im nächsten Element zu finden
      const $value = $el.next('[class*="value"], [class*="data"], dd');
      if ($value.length > 0) {
        const value = $value.text().trim();
        mapFieldToResult(label, value, result);
      }
    });

    // Parse Definition Lists (dl > dt > dd)
    $('dl dt').each((_, dt) => {
      const $dt = $(dt);
      const label = $dt.text().trim().toLowerCase();
      const $dd = $dt.next('dd');
      if ($dd.length > 0) {
        const value = $dd.text().trim();
        mapFieldToResult(label, value, result);
      }
    });
  } catch (error) {
    console.error('[ProductDataParser] Error parsing HTML structure:', error);
  }
}

/**
 * Parst Text-Inhalte mit Regex-Mustern
 */
function parseTextContent(text: string, result: StructuredProductData): void {
  // Spannung
  const voltageMatch = text.match(PATTERNS.voltage);
  if (voltageMatch && !result.Spannung) {
    const voltage = voltageMatch[0].replace(/[^\d,.]/g, '').replace(',', '.');
    result.Spannung = `${voltage} V`;
  }

  // Kapazität
  const capacityMatch = text.match(PATTERNS.capacity);
  if (capacityMatch && !result.Kapazität) {
    const capacity = capacityMatch[0].replace(/[^\d]/g, '');
    result.Kapazität = `${capacity} mAh`;
  }

  // Zellchemie
  const chemistryMatch = text.match(PATTERNS.chemistry);
  if (chemistryMatch && !result.Zellchemie) {
    const chemistry = chemistryMatch[0].toUpperCase();
    result.Zellchemie = formatChemistry(chemistry);
  }

  // Energie
  const energyMatch = text.match(PATTERNS.energy);
  if (energyMatch && !result.Energie) {
    const energy = energyMatch[0].replace(/[^\d,.]/g, '').replace(',', '.');
    result.Energie = `${energy} Wh`;
  }

  // Entladestrom
  const dischargeMatch = text.match(PATTERNS.dischargeCurrent);
  if (dischargeMatch && !result.Entladestrom) {
    const current = dischargeMatch[0].replace(/[^\d,.]/g, '').replace(',', '.');
    result.Entladestrom = `${current} A`;
  }

  // Maße
  const dimensionsMatch = text.match(PATTERNS.dimensions);
  if (dimensionsMatch && !result.Länge) {
    const dims = dimensionsMatch[0].match(/(\d+[,\.]?\d*)/g);
    if (dims && dims.length >= 3) {
      result.Länge = `${dims[0].replace(',', '.')} mm`;
      result.Breite = `${dims[1].replace(',', '.')} mm`;
      result.Höhe = `${dims[2].replace(',', '.')} mm`;
    }
  }

  // Gewicht
  const weightMatch = text.match(PATTERNS.weight);
  if (weightMatch && !result.Gewicht) {
    const weight = weightMatch[0].replace(/[^\d,.]/g, '').replace(',', '.');
    result.Gewicht = `${weight} g`;
  }

  // Artikelnummer (nur wenn noch nicht gefunden)
  if (!result.Artikelnummer) {
    const articleMatch = text.match(PATTERNS.articleNumber);
    if (articleMatch) {
      result.Artikelnummer = articleMatch[0];
    }
  }

  // EAN
  const eanMatch = text.match(PATTERNS.ean);
  if (eanMatch && !result.EAN) {
    result.EAN = eanMatch[0];
  }
}

/**
 * Mappt Label-Value-Paare zu strukturierten Feldern
 */
function mapFieldToResult(label: string, value: string, result: StructuredProductData): void {
  const lowerLabel = label.toLowerCase();

  // Spannung
  if ((lowerLabel.includes('spannung') || lowerLabel.includes('voltage')) && !lowerLabel.includes('input')) {
    const voltage = extractNumber(value);
    if (voltage) result.Spannung = `${voltage} V`;
  }
  // Kapazität
  else if (lowerLabel.includes('kapazität') || lowerLabel.includes('capacity') || (lowerLabel.includes('mah') && !lowerLabel.includes('max'))) {
    const capacity = extractNumber(value);
    if (capacity) result.Kapazität = `${capacity} mAh`;
  }
  // Zellchemie
  else if (lowerLabel.includes('zellenchemie') || lowerLabel.includes('cell chemistry') || lowerLabel.includes('chemie')) {
    result.Zellchemie = formatChemistry(value);
  }
  // Artikelnummer
  else if (lowerLabel.includes('artikelnummer') || lowerLabel.includes('article number') || lowerLabel.includes('art-nr')) {
    result.Artikelnummer = value.trim();
  }
  // Gewicht
  else if (lowerLabel.includes('gewicht') || lowerLabel.includes('weight')) {
    const weight = extractNumber(value);
    if (weight) result.Gewicht = `${weight} g`;
  }
  // Länge
  else if (lowerLabel.includes('länge') || lowerLabel.includes('length')) {
    const length = extractNumber(value);
    if (length) result.Länge = `${length} mm`;
  }
  // Breite
  else if (lowerLabel.includes('breite') || lowerLabel.includes('width')) {
    const width = extractNumber(value);
    if (width) result.Breite = `${width} mm`;
  }
  // Höhe
  else if (lowerLabel.includes('höhe') || lowerLabel.includes('height')) {
    const height = extractNumber(value);
    if (height) result.Höhe = `${height} mm`;
  }
  // Energie
  else if (lowerLabel.includes('energie') || lowerLabel.includes('energy')) {
    const energy = extractNumber(value);
    if (energy) result.Energie = `${energy} Wh`;
  }
  // Entladestrom
  else if (lowerLabel.includes('entladestrom') || lowerLabel.includes('discharge current') || lowerLabel.includes('max entladestrom')) {
    const current = extractNumber(value);
    if (current) result.Entladestrom = `${current} A`;
  }
  // EAN
  else if (lowerLabel.includes('ean') || lowerLabel.includes('gtin') || lowerLabel.includes('barcode')) {
    const ean = value.match(/\d{13}/);
    if (ean) result.EAN = ean[0];
  }
  // Verpackungseinheit
  else if (lowerLabel.includes('verpackungseinheit') || lowerLabel.includes('packaging unit') || lowerLabel.includes('pack')) {
    result.Verpackungseinheit = value.trim();
  }
}

/**
 * Extrahiert Zahl aus Text (unterstützt deutsche und englische Dezimaltrennzeichen)
 */
function extractNumber(text: string): string | null {
  // Entferne Einheiten und extrahiere Zahl
  const match = text.match(/(\d+[,\.]?\d*)/);
  if (match) {
    return match[1].replace(',', '.');
  }
  return null;
}

/**
 * Formatiert Zellchemie-Bezeichnungen
 */
function formatChemistry(chemistry: string): string {
  const normalized = chemistry.toUpperCase().trim();
  const mapping: Record<string, string> = {
    'NIMH': 'NiMH',
    'LI-ION': 'Li-Ion',
    'LIFEPO4': 'LiFePO4',
    'LI-POLY': 'Li-Poly',
    'NICD': 'NiCd',
    'LEAD-ACID': 'Blei-Säure',
  };
  return mapping[normalized] || normalized;
}


