import * as cheerio from 'cheerio';

/**
 * Automatisch CSS-Selektoren für Produktdaten aus einer URL finden
 */
export async function autoDetectSelectors(url: string, userAgent?: string, cookies?: string): Promise<Record<string, string>> {
  console.log(`[AutoDetect] Analyzing URL: ${url}`);
  
  const headers: Record<string, string> = {
    'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  };
  
  if (cookies) {
    headers['Cookie'] = cookies;
  }
  
  let html: string;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    html = await response.text();
    console.log(`[AutoDetect] Fetched ${html.length} chars`);
  } catch (error: any) {
    console.error(`[AutoDetect] Error fetching URL:`, error);
    throw new Error(`Failed to fetch URL: ${error.message}`);
  }
  
  const $ = cheerio.load(html);
  const detectedSelectors: Record<string, string> = {};
  
  // 1. Produktname - suche nach h1, .product-name, .product-title, etc.
  const productNameSelectors = [
    'h1.page-title',
    'h1.product-title',
    'h1.product-name',
    '.product-name',
    '.product-title',
    'h1',
    '[itemprop="name"]',
    '.product-info h1',
  ];
  for (const selector of productNameSelectors) {
    const element = $(selector).first();
    if (element.length > 0 && element.text().trim().length > 5) {
      detectedSelectors.productName = selector;
      console.log(`[AutoDetect] Found productName: ${selector} → "${element.text().trim().substring(0, 50)}"`);
      break;
    }
  }
  
  // 2. Artikelnummer - suche nach .sku, .product-code, [itemprop="sku"]
  const articleNumberSelectors = [
    '.product-code',
    '.sku',
    '[itemprop="sku"]',
    '.artikelnummer',
    '.article-number',
    '[data-sku]',
    '.product-sku',
  ];
  for (const selector of articleNumberSelectors) {
    const element = $(selector).first();
    if (element.length > 0 && element.text().trim().length > 0) {
      detectedSelectors.articleNumber = selector;
      console.log(`[AutoDetect] Found articleNumber: ${selector} → "${element.text().trim()}"`);
      break;
    }
  }
  
  // 3. EAN - suche nach .ean, [itemprop="gtin13"], etc.
  const eanSelectors = [
    '.ean',
    '.ean-code',
    '[itemprop="gtin13"]',
    '[data-ean]',
    '.gtin',
    '[data-gtin]',
  ];
  for (const selector of eanSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      // EAN sollte 13-stellig sein
      if (/^\d{13}$/.test(text.replace(/\s/g, ''))) {
        detectedSelectors.ean = selector;
        console.log(`[AutoDetect] Found ean: ${selector} → "${text}"`);
        break;
      }
    }
  }
  
  // 4. Hersteller/Marke - suche nach .brand, .manufacturer, [itemprop="brand"]
  const manufacturerSelectors = [
    '.brand',
    '.manufacturer',
    '[itemprop="brand"]',
    '.hersteller',
    '.marke',
  ];
  for (const selector of manufacturerSelectors) {
    const element = $(selector).first();
    if (element.length > 0 && element.text().trim().length > 0) {
      detectedSelectors.manufacturer = selector;
      console.log(`[AutoDetect] Found manufacturer: ${selector} → "${element.text().trim()}"`);
      break;
    }
  }
  
  // 5. Preis - suche nach .price, .dealer-price, etc.
  const priceSelectors = [
    '.dealer-price',
    '.wholesale-price',
    '.net-price',
    '.price',
    '[itemprop="price"]',
    '.product-price',
    '[data-price]',
  ];
  for (const selector of priceSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      // Preis sollte Zahlen enthalten
      if (/\d+[,\.]\d+/.test(text)) {
        detectedSelectors.price = selector;
        console.log(`[AutoDetect] Found price: ${selector} → "${text}"`);
        break;
      }
    }
  }
  
  // 6. Bilder - suche nach .product-image img, .gallery img, etc.
  const imageSelectors = [
    '.product-image img',
    '.gallery-image img',
    '.product-gallery img',
    '.fotorama__img',
    '.product-photo img',
    '[itemprop="image"]',
    '.product-images img',
  ];
  for (const selector of imageSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      detectedSelectors.images = selector;
      console.log(`[AutoDetect] Found images: ${selector} → ${elements.length} images`);
      break;
    }
  }
  
  // 7. Beschreibung - suche nach .description, .product-description, etc.
  const descriptionSelectors = [
    '.product-description',
    '.short-description',
    '.product-intro',
    '[itemprop="description"]',
    '.description',
  ];
  for (const selector of descriptionSelectors) {
    const element = $(selector).first();
    if (element.length > 0 && element.text().trim().length > 50) {
      detectedSelectors.description = selector;
      console.log(`[AutoDetect] Found description: ${selector} → ${element.text().trim().length} chars`);
      break;
    }
  }
  
  // 8. Technische Daten - ANSMANN spezifisch
  // Suche nach Tabellen mit technischen Daten
  const technicalTable = $('#additional table, .additional-attributes-wrapper table, #product-attribute-specs-table').first();
  if (technicalTable.length > 0) {
    console.log(`[AutoDetect] Found technical data table with ${technicalTable.find('tr').length} rows`);
    
    // Durchsuche die Tabelle nach spezifischen Feldern
    technicalTable.find('tr').each((_, row) => {
      const $row = $(row);
      const $th = $row.find('th');
      const $td = $row.find('td');
      const label = $th.text().trim().toLowerCase();
      const value = $td.text().trim();
      const dataTh = $td.attr('data-th') || '';
      
      if (!value) return;
      
      // Verwende data-th Attribut wenn verfügbar (genauer als :contains)
      // ANSMANN verwendet: td.col.data[data-th="Höhe"]
      const useDataTh = dataTh ? `td.col.data[data-th="${dataTh}"]` : null;
      // Fallback: Verwende auch einfachere Varianten
      const useSimpleDataTh = dataTh ? `td[data-th="${dataTh}"]` : null;
      const useContains = `#additional th:contains("${$th.text().trim()}") + td, #additional th:contains("${$th.text().trim().split(' ')[0]}") + td`;
      // Priorität: data-th mit Klassen > data-th ohne Klassen > :contains
      const selector = useDataTh || useSimpleDataTh || useContains;
      
      // Spannung
      if ((label.includes('spannung') || label.includes('voltage') || dataTh.toLowerCase().includes('spannung')) && !detectedSelectors.nominalspannung) {
        detectedSelectors.nominalspannung = selector;
        console.log(`[AutoDetect] Found nominalspannung: "${label}" → "${value}" (selector: ${selector})`);
      }
      
      // Kapazität
      if ((label.includes('kapazität') || label.includes('capacity') || dataTh.toLowerCase().includes('kapazität')) && !detectedSelectors.nominalkapazitaet) {
        detectedSelectors.nominalkapazitaet = selector;
        console.log(`[AutoDetect] Found nominalkapazitaet: "${label}" → "${value}" (selector: ${selector})`);
      }
      
      // Zellchemie
      if ((label.includes('zellchemie') || label.includes('chemie') || label.includes('chemistry') || dataTh.toLowerCase().includes('zellchemie')) && !detectedSelectors.zellenchemie) {
        detectedSelectors.zellenchemie = selector;
        console.log(`[AutoDetect] Found zellenchemie: "${label}" → "${value}" (selector: ${selector})`);
      }
      
      // Gewicht
      if ((label.includes('gewicht') || label.includes('weight') || dataTh.toLowerCase().includes('gewicht')) && !detectedSelectors.gewicht) {
        detectedSelectors.gewicht = selector;
        console.log(`[AutoDetect] Found gewicht: "${label}" → "${value}" (selector: ${selector})`);
      }
      
      // Energie
      if ((label.includes('energie') || label.includes('energy') || dataTh.toLowerCase().includes('energie')) && !detectedSelectors.energie) {
        detectedSelectors.energie = selector;
        console.log(`[AutoDetect] Found energie: "${label}" → "${value}" (selector: ${selector})`);
      }
      
      // Farbe
      if ((label.includes('farbe') || label.includes('color') || dataTh.toLowerCase().includes('farbe')) && !detectedSelectors.farbe) {
        detectedSelectors.farbe = selector;
        console.log(`[AutoDetect] Found farbe: "${label}" → "${value}" (selector: ${selector})`);
      }
      
      // Länge
      if ((label.includes('länge') || label.includes('length') || dataTh.toLowerCase().includes('länge')) && !detectedSelectors.laenge) {
        detectedSelectors.laenge = selector;
        console.log(`[AutoDetect] Found laenge: "${label}" → "${value}" (selector: ${selector})`);
      }
      
      // Breite
      if ((label.includes('breite') || label.includes('width') || dataTh.toLowerCase().includes('breite')) && !detectedSelectors.breite) {
        detectedSelectors.breite = selector;
        console.log(`[AutoDetect] Found breite: "${label}" → "${value}" (selector: ${selector})`);
      }
      
      // Höhe
      if ((label.includes('höhe') || label.includes('height') || dataTh.toLowerCase().includes('höhe')) && !detectedSelectors.hoehe) {
        detectedSelectors.hoehe = selector;
        console.log(`[AutoDetect] Found hoehe: "${label}" → "${value}" (selector: ${selector})`);
      }
    });
  }
  
  console.log(`[AutoDetect] Detected ${Object.keys(detectedSelectors).length} selectors`);
  return detectedSelectors;
}

