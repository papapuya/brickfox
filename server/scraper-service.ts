import * as cheerio from 'cheerio';

export interface LoginConfig {
  loginUrl: string;
  usernameField: string;
  passwordField: string;
  username: string;
  password: string;
  userAgent?: string;
}

export interface ScraperSelectors {
  articleNumber?: string;
  productName?: string;
  ean?: string;
  manufacturer?: string;
  price?: string;
  description?: string;
  images?: string;
  weight?: string;
  category?: string;
  length?: string;
  bodyDiameter?: string;
  headDiameter?: string;
  weightWithoutBattery?: string;
  totalWeight?: string;
  powerSupply?: string;
  led1?: string;
  led2?: string;
  spotIntensity?: string;
  maxLuminosity?: string;
  maxBeamDistance?: string;
}

export interface ScrapedProduct {
  articleNumber: string;  // Brickfox Article Number (ANS + manufacturer number)
  manufacturerArticleNumber?: string;  // Original manufacturer article number
  productName: string;
  ean?: string;
  manufacturer?: string;
  price?: string;
  ekPrice?: string;  // Einkaufspreis (Purchase Price)
  vkPrice?: string;  // Verkaufspreis (Sales Price) - calculated as EK * 2 * 1.19
  description?: string;
  images: string[];
  weight?: string;
  category?: string;
  length?: string;
  bodyDiameter?: string;
  headDiameter?: string;
  weightWithoutBattery?: string;
  totalWeight?: string;
  powerSupply?: string;
  led1?: string;
  led2?: string;
  spotIntensity?: string;
  maxLuminosity?: string;
  maxBeamDistance?: string;
  pdfManualUrl?: string;
  safetyWarnings?: string;
  rawHtml?: string;
  technicalDataTable?: string;
  autoExtractedDescription?: string;
}

export interface ScrapeOptions {
  url: string;
  selectors: ScraperSelectors;
  userAgent?: string;
  cookies?: string;
  timeout?: number;
}

/**
 * Login to a website and retrieve session cookies
 * Sends login form data and captures cookies from response
 */
export async function performLogin(config: LoginConfig): Promise<string> {
  const {
    loginUrl,
    usernameField,
    passwordField,
    username,
    password,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  } = config;

  console.log(`[Login] Attempting login to ${loginUrl}`);

  try {
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append(usernameField, username);
    formData.append(passwordField, password);

    // Send POST request with credentials
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de,en-US;q=0.7,en;q=0.3'
      },
      body: formData.toString(),
      redirect: 'manual' // Don't follow redirects automatically
    });

    // Extract cookies from Set-Cookie headers
    const setCookieHeaders = response.headers.getSetCookie();
    
    if (!setCookieHeaders || setCookieHeaders.length === 0) {
      console.log('[Login] No cookies received from login response');
      return '';
    }

    // Parse cookies and build cookie string
    const cookies = setCookieHeaders.map(cookie => {
      // Extract cookie name and value (before first semicolon)
      const match = cookie.match(/^([^=]+)=([^;]+)/);
      return match ? `${match[1]}=${match[2]}` : '';
    }).filter(c => c).join('; ');

    console.log(`[Login] Successfully obtained ${setCookieHeaders.length} cookies`);
    return cookies;
  } catch (error) {
    console.error('[Login] Login failed:', error);
    throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper function: Convert measurement to German format (comma, no units)
 * Automatically converts to millimeters (mm) for length measurements
 * Examples: 
 *   "250g" → "250", "1.5kg" → "1,5"
 *   "120mm" → "120", "12cm" → "120", "1.5m" → "1500"
 */
function formatMeasurement(text: string): string {
  if (!text) return '';
  
  // Extract numeric portion and detect unit
  const match = text.match(/([\d,.]+)\s*([a-zA-Z]+)?/);
  if (!match) return '';
  
  let value = match[1];
  const unit = match[2]?.toLowerCase() || '';
  
  // Normalize to internal format (dot as decimal separator)
  const hasComma = value.includes(',');
  const hasDot = value.includes('.');
  
  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(',');
    const lastDot = value.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // German format: 1.234,56 → 1234.56
      value = value.replace(/\./g, '').replace(',', '.');
    } else {
      // English format: 1,234.56 → 1234.56
      value = value.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    // Only comma: convert to dot (e.g., 0,25 → 0.25)
    value = value.replace(',', '.');
  }
  // If only dot or neither: keep as is
  
  // Convert to number for unit conversion
  let numValue = parseFloat(value);
  
  // Convert length units to millimeters (mm)
  if (unit === 'cm' || unit === 'zentimeter') {
    numValue = numValue * 10; // cm → mm
  } else if (unit === 'm' || unit === 'meter') {
    numValue = numValue * 1000; // m → mm
  } else if (unit === 'km' || unit === 'kilometer') {
    numValue = numValue * 1000000; // km → mm
  }
  
  // Convert weight units to grams (g)
  else if (unit === 'kg' || unit === 'kilogramm') {
    numValue = numValue * 1000; // kg → g
  } else if (unit === 't' || unit === 'tonne') {
    numValue = numValue * 1000000; // t → g
  }
  // mm and g stay as is
  
  // Convert back to string with German format (comma as decimal separator)
  const formattedValue = numValue.toString().replace('.', ',');
  
  return formattedValue;
}

/**
 * Scrape product data from a URL using custom CSS selectors
 * Similar to PHP DomCrawler approach
 */
export async function scrapeProduct(options: ScrapeOptions): Promise<ScrapedProduct> {
  const {
    url,
    selectors,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    cookies,
    timeout = 10000
  } = options;

  console.log(`Scraping URL: ${url}`);

  // Fetch HTML with custom headers (like PHP stream_context_create)
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de,en-US;q=0.7,en;q=0.3'
  };

  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let html: string;
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    html = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  console.log(`HTML fetched, length: ${html.length} characters`);

  // Parse with Cheerio (equivalent to Symfony DomCrawler)
  const $ = cheerio.load(html);

  // Extract data using CSS selectors
  const product: ScrapedProduct = {
    articleNumber: '',
    productName: '',
    images: []
  };

  // Article Number / SKU (support both 'articleNumber' and 'productCode')
  const articleSelector = (selectors as any).productCode || selectors.articleNumber;
  if (articleSelector) {
    const element = $(articleSelector).first();
    let manufacturerNumber = element.text().trim() || element.attr('content')?.trim() || '';
    
    // Remove all hyphens/dashes from manufacturer number
    if (manufacturerNumber) {
      manufacturerNumber = manufacturerNumber.replace(/-/g, '');
    }
    
    // Store manufacturer article number (without hyphens)
    product.manufacturerArticleNumber = manufacturerNumber;
    
    // Generate Brickfox article number: ANS + manufacturer number (no hyphens)
    if (manufacturerNumber) {
      product.articleNumber = 'ANS' + manufacturerNumber;
      console.log(`📦 Generated Brickfox Article Number: ${product.articleNumber} (from ${manufacturerNumber})`);
    } else {
      product.articleNumber = '';
    }
  }

  // Product Name
  if (selectors.productName) {
    const element = $(selectors.productName).first();
    product.productName = element.text().trim() || element.attr('content')?.trim() || '';
  }

  // EAN / Barcode
  if (selectors.ean) {
    const element = $(selectors.ean).first();
    product.ean = element.text().trim() || element.attr('content')?.trim() || '';
    
    // Fallback: Search for 13-digit number in HTML (like PHP regex)
    if (!product.ean) {
      const eanMatch = html.match(/"\d{13}"/);
      if (eanMatch) {
        product.ean = eanMatch[0].replace(/"/g, '');
      }
    }
  }

  // Manufacturer / Brand
  if (selectors.manufacturer) {
    const element = $(selectors.manufacturer).first();
    // Try text first, then common attributes (content, alt, title, data-brand)
    product.manufacturer = element.text().trim() 
      || element.attr('content')?.trim() 
      || element.attr('alt')?.trim() 
      || element.attr('title')?.trim() 
      || element.attr('data-brand')?.trim() 
      || '';
  }
  
  // Auto-detect manufacturer from URL for ANSMANN
  if (!product.manufacturer && url.includes('pim.ansmann.de')) {
    product.manufacturer = 'ANSMANN';
  }

  // Price - Format for Brickfox: English decimal format (19.99)
  if (selectors.price) {
    const element = $(selectors.price).first();
    let priceText = element.text().trim() || element.attr('content')?.trim() || '';
    
    if (priceText) {
      // Step 1: Extract only the numeric portion with separators
      const numericMatch = priceText.match(/[\d,.]+/);
      if (numericMatch) {
        priceText = numericMatch[0];
      } else {
        priceText = '';
      }
      
      if (priceText) {
        // Step 2: Normalize to English format (dot as decimal separator)
        const hasComma = priceText.includes(',');
        const hasDot = priceText.includes('.');
        
        if (hasComma && hasDot) {
          // Both present: last one is decimal separator
          const lastComma = priceText.lastIndexOf(',');
          const lastDot = priceText.lastIndexOf('.');
          
          if (lastComma > lastDot) {
            // German format: 1.234,56 -> convert to English
            priceText = priceText.replace(/\./g, ''); // Remove thousands separators (dots)
            priceText = priceText.replace(',', '.'); // Convert decimal comma to dot
          } else {
            // English format: 1,234.56 -> keep dot, remove comma
            priceText = priceText.replace(/,/g, ''); // Remove thousands separators (commas)
          }
        } else if (hasDot && !hasComma) {
          // Only dot: check if it's thousands separator or decimal
          const dotParts = priceText.split('.');
          if (dotParts.length === 2 && dotParts[1].length <= 2) {
            // Likely decimal: 89.90 -> keep as is
          } else {
            // Likely thousands separator: 1.234 -> 1234
            priceText = priceText.replace(/\./g, '');
          }
        } else if (hasComma && !hasDot) {
          // Only comma: check if it's thousands separator or decimal
          const commaParts = priceText.split(',');
          if (commaParts.length === 2 && commaParts[1].length <= 2) {
            // Likely decimal: 89,90 -> convert to 89.90
            priceText = priceText.replace(',', '.');
          } else {
            // Likely thousands separator: 1,234 -> 1234
            priceText = priceText.replace(/,/g, '');
          }
        }
        
        // Step 3: Ensure exactly 2 decimal places
        if (!priceText.includes('.')) {
          // No decimals: add .00
          priceText = priceText + '.00';
        } else {
          const parts = priceText.split('.');
          if (parts[1]) {
            // Pad or truncate to exactly 2 decimals
            parts[1] = parts[1].padEnd(2, '0').substring(0, 2);
          } else {
            parts[1] = '00';
          }
          priceText = parts.join('.');
        }
        
        // Step 4: Convert to German format (comma instead of dot)
        priceText = priceText.replace('.', ',');
      }
    }
    
    product.price = priceText;
  }

  // Description (can be HTML)
  if (selectors.description) {
    const element = $(selectors.description).first();
    product.description = element.html()?.trim() || element.text().trim() || '';
  }

  // Images (support both 'images' and 'image')
  const imageSelector = (selectors as any).image || selectors.images;
  if (imageSelector) {
    const imageElements = $(imageSelector);
    product.images = imageElements.map((_, el) => {
      const $el = $(el);
      // Try src, data-src, href
      const src = $el.attr('src') || $el.attr('data-src') || $el.attr('href') || '';
      return src.trim();
    }).get().filter(Boolean);
  }

  // Weight - Format for Brickfox: German format with comma, NO units (e.g., 250 or 1,5)
  if (selectors.weight) {
    const element = $(selectors.weight).first();
    let weightText = element.text().trim() || '';
    
    // Fallback: Search for "gewicht: XXXg" in HTML
    if (!weightText) {
      const weightMatch = html.match(/gewicht:\s*([\d,\.]+)\s*[gk]/i);
      if (weightMatch) {
        weightText = weightMatch[1];
      }
    }
    
    if (weightText) {
      product.weight = formatMeasurement(weightText);
    }
  }

  // Category (use .last() to get the most specific category from breadcrumb)
  if (selectors.category) {
    const elements = $(selectors.category);
    // Take the last element (most specific category) and skip "Home" / "Startseite"
    let categoryText = '';
    
    if (elements.length > 0) {
      // Try from last to first, skip common navigation items
      for (let i = elements.length - 1; i >= 0; i--) {
        const text = $(elements[i]).text().trim();
        const lowerText = text.toLowerCase();
        
        // Skip common navigation items
        if (lowerText && 
            lowerText !== 'home' && 
            lowerText !== 'startseite' &&
            lowerText !== 'sie sind hier' &&
            !lowerText.includes('›') &&
            !lowerText.includes('>')) {
          categoryText = text;
          break;
        }
      }
    }
    
    product.category = categoryText;
  }

  // Nitecore Technical Fields - extract and format measurements (German format, no units)
  if (selectors.length) {
    const element = $(selectors.length).first();
    product.length = formatMeasurement(element.text().trim());
  }

  if (selectors.bodyDiameter) {
    const element = $(selectors.bodyDiameter).first();
    product.bodyDiameter = formatMeasurement(element.text().trim());
  }

  if (selectors.headDiameter) {
    const element = $(selectors.headDiameter).first();
    product.headDiameter = formatMeasurement(element.text().trim());
  }

  if (selectors.weightWithoutBattery) {
    const element = $(selectors.weightWithoutBattery).first();
    product.weightWithoutBattery = formatMeasurement(element.text().trim());
  }

  if (selectors.totalWeight) {
    const element = $(selectors.totalWeight).first();
    product.totalWeight = formatMeasurement(element.text().trim());
  }

  if (selectors.powerSupply) {
    const element = $(selectors.powerSupply).first();
    product.powerSupply = element.text().trim() || '';
  }

  if (selectors.led1) {
    const element = $(selectors.led1).first();
    product.led1 = element.text().trim() || '';
  }

  if (selectors.led2) {
    const element = $(selectors.led2).first();
    product.led2 = element.text().trim() || '';
  }

  if (selectors.spotIntensity) {
    const element = $(selectors.spotIntensity).first();
    product.spotIntensity = formatMeasurement(element.text().trim());
  }

  if (selectors.maxLuminosity) {
    const element = $(selectors.maxLuminosity).first();
    product.maxLuminosity = formatMeasurement(element.text().trim());
  }

  if (selectors.maxBeamDistance) {
    const element = $(selectors.maxBeamDistance).first();
    product.maxBeamDistance = formatMeasurement(element.text().trim());
  }

  // ANSMANN Technical Fields - extract and format measurements (German format, no units)
  if ((selectors as any).nominalspannung) {
    const element = $((selectors as any).nominalspannung).first();
    (product as any).nominalspannung = formatMeasurement(element.text().trim());
  }

  if ((selectors as any).nominalkapazitaet) {
    const element = $((selectors as any).nominalkapazitaet).first();
    (product as any).nominalkapazitaet = formatMeasurement(element.text().trim());
  }

  if ((selectors as any).maxEntladestrom) {
    const element = $((selectors as any).maxEntladestrom).first();
    (product as any).maxEntladestrom = formatMeasurement(element.text().trim());
  }
  
  // Fallback: Extract max. Entladestrom from description if not found via selector
  if (!(product as any).maxEntladestrom || (product as any).maxEntladestrom === '') {
    const entladestromMatch = html.match(/max\.\s*entladestrom[:\s]+([\d.,]+)\s*a/i);
    if (entladestromMatch) {
      (product as any).maxEntladestrom = formatMeasurement(entladestromMatch[1]);
      console.log(`📊 Extracted max. Entladestrom from description: ${(product as any).maxEntladestrom}`);
    }
  }

  if ((selectors as any).laenge) {
    const element = $((selectors as any).laenge).first();
    (product as any).laenge = formatMeasurement(element.text().trim());
  }

  if ((selectors as any).breite) {
    const element = $((selectors as any).breite).first();
    (product as any).breite = formatMeasurement(element.text().trim());
  }

  if ((selectors as any).hoehe) {
    const element = $((selectors as any).hoehe).first();
    (product as any).hoehe = formatMeasurement(element.text().trim());
  }

  if ((selectors as any).gewicht) {
    const element = $((selectors as any).gewicht).first();
    (product as any).gewicht = formatMeasurement(element.text().trim());
  }

  if ((selectors as any).zellenchemie) {
    const element = $((selectors as any).zellenchemie).first();
    (product as any).zellenchemie = element.text().trim() || '';
  }

  if ((selectors as any).energie) {
    const element = $((selectors as any).energie).first();
    (product as any).energie = formatMeasurement(element.text().trim());
  }

  if ((selectors as any).farbe) {
    const element = $((selectors as any).farbe).first();
    (product as any).farbe = element.text().trim() || '';
  }

  // ANSMANN: Extract Abmessungen (Dimensions) and split into Länge, Breite, Höhe
  // Format: "Abmessungen: 70×37.5×37.5 mm" or "7 × 18 × 18 cm" or "70×37,5×37,5 mm"
  if (!(product as any).laenge || !(product as any).breite || !(product as any).hoehe) {
    const abmessungenMatch = html.match(/abmessungen[:\s]+([\d.,]+)\s*[×x]\s*([\d.,]+)\s*[×x]\s*([\d.,]+)\s*(mm|cm)/i);
    if (abmessungenMatch) {
      // Normalize numbers: handle both German (,) and English (.) decimal separators
      const normalizeNumber = (num: string): string => {
        // If both comma and dot present, assume German format (1.234,5)
        if (num.includes(',') && num.includes('.')) {
          return num.replace(/\./g, '').replace(',', '.');
        }
        // If only comma, assume decimal separator (37,5)
        if (num.includes(',')) {
          return num.replace(',', '.');
        }
        // Otherwise already English format
        return num;
      };
      
      let laenge = normalizeNumber(abmessungenMatch[1]);
      let breite = normalizeNumber(abmessungenMatch[2]);
      let hoehe = normalizeNumber(abmessungenMatch[3]);
      const unit = abmessungenMatch[4].toLowerCase();
      
      // Convert cm to mm if needed
      if (unit === 'cm') {
        laenge = (parseFloat(laenge) * 10).toString();
        breite = (parseFloat(breite) * 10).toString();
        hoehe = (parseFloat(hoehe) * 10).toString();
      }
      
      // Format with German comma and no units
      (product as any).laenge = formatMeasurement(laenge);
      (product as any).breite = formatMeasurement(breite);
      (product as any).hoehe = formatMeasurement(hoehe);
      
      console.log(`📏 Extracted Abmessungen: ${(product as any).laenge} × ${(product as any).breite} × ${(product as any).hoehe} mm`);
    }
  }

  // Store raw HTML for debugging
  product.rawHtml = html.substring(0, 1000); // First 1000 chars

  // SMART AUTO-EXTRACTION: Description + Technical Data Table + PDF + Safety Warnings
  const smartExtraction = autoExtractProductDetails($, html, url);
  if (smartExtraction.description) {
    product.autoExtractedDescription = smartExtraction.description;
  }
  if (smartExtraction.technicalDataTable) {
    product.technicalDataTable = smartExtraction.technicalDataTable;
  }
  if (smartExtraction.pdfManualUrl) {
    product.pdfManualUrl = smartExtraction.pdfManualUrl;
  }
  if (smartExtraction.safetyWarnings) {
    product.safetyWarnings = smartExtraction.safetyWarnings;
  }

  // INTELLIGENT TABLE PARSER: Extract structured technical data from properties tables
  parsePropertiesTable($, product);

  // BUILD COMPLETE HTML TABLE from parsed data (if no complete HTML table was found)
  if (product.technicalDataTable && !product.technicalDataTable.includes('148,2')) {
    // The extracted table is incomplete, rebuild from parsed data
    const fullTableRows: string[] = [];
    
    if (product.length) fullTableRows.push(`<tr><td>Länge (mm)</td><td>${product.length}</td></tr>`);
    if (product.bodyDiameter) fullTableRows.push(`<tr><td>Gehäusedurchmesser (mm)</td><td>${product.bodyDiameter}</td></tr>`);
    if (product.headDiameter) fullTableRows.push(`<tr><td>Kopfdurchmesser</td><td>${product.headDiameter}</td></tr>`);
    if (product.weightWithoutBattery) fullTableRows.push(`<tr><td>Gewicht (ohne Batterien/Akku) (g)</td><td>${product.weightWithoutBattery}</td></tr>`);
    if (product.powerSupply) fullTableRows.push(`<tr><td>Stromversorgung</td><td>${product.powerSupply}</td></tr>`);
    if (product.led1) fullTableRows.push(`<tr><td>Leuchtmittel 1</td><td>${product.led1}</td></tr>`);
    if (product.led2) fullTableRows.push(`<tr><td>Leuchtmittel 2</td><td>${product.led2}</td></tr>`);
    if (product.spotIntensity) fullTableRows.push(`<tr><td>Spotintensität (cd)</td><td>${product.spotIntensity}</td></tr>`);
    if (product.maxLuminosity) fullTableRows.push(`<tr><td>Leuchtleistung max.</td><td>${product.maxLuminosity}</td></tr>`);
    if (product.maxBeamDistance) fullTableRows.push(`<tr><td>Leuchtweite max. (m)</td><td>${product.maxBeamDistance}</td></tr>`);
    
    if (fullTableRows.length > 0) {
      product.technicalDataTable = `<table border="0" summary="">\n<tbody>\n${fullTableRows.join('\n')}\n</tbody>\n</table>`;
      console.log(`✅ Rebuilt COMPLETE HTML table from parsed data (${fullTableRows.length} rows)`);
    }
  }

  // Calculate VK Price from EK Price (VK = EK × 2 × 1.19, always ending in ,95)
  // Format: German format with comma (e.g., 91,95)
  if (product.ekPrice) {
    const ekValue = parseFloat(product.ekPrice.replace(',', '.'));
    if (!isNaN(ekValue)) {
      const vkCalculated = ekValue * 2 * 1.19;
      // Round to ,95 ending (e.g., 91.76 → 91,95)
      const vkRounded = Math.floor(vkCalculated) + 0.95;
      product.vkPrice = vkRounded.toFixed(2).replace('.', ',');  // German format
      console.log(`💰 Calculated VK Price: EK ${product.ekPrice}€ → VK ${product.vkPrice}€ (calculated: ${vkCalculated.toFixed(2).replace('.', ',')})`);
    }
  } else if (product.price) {
    // If price field exists, treat it as EK and calculate VK
    const priceValue = parseFloat(product.price.replace(',', '.'));
    if (!isNaN(priceValue)) {
      product.ekPrice = product.price;
      const vkCalculated = priceValue * 2 * 1.19;
      // Round to ,95 ending (e.g., 91.76 → 91,95)
      const vkRounded = Math.floor(vkCalculated) + 0.95;
      product.vkPrice = vkRounded.toFixed(2).replace('.', ',');  // German format
      console.log(`💰 Calculated VK Price from price field: EK ${product.ekPrice}€ → VK ${product.vkPrice}€ (calculated: ${vkCalculated.toFixed(2).replace('.', ',')})`);
    }
  }

  console.log('Scraped product:', {
    articleNumber: product.articleNumber,
    productName: product.productName,
    ean: product.ean,
    imagesCount: product.images.length,
    autoExtractedDescription: !!product.autoExtractedDescription,
    technicalDataTable: !!product.technicalDataTable,
    pdfManualUrl: !!product.pdfManualUrl,
    safetyWarnings: !!product.safetyWarnings
  });

  return product;
}

/**
 * SMART AUTO-EXTRACTION: Automatically find and extract description + technical data table + PDF + safety warnings
 * Searches for common tab patterns like "Beschreibung", "Technische Daten", "Bedienungsanleitungen", "Produktsicherheit"
 */
function autoExtractProductDetails($: cheerio.CheerioAPI, html: string, url: string): {
  description?: string;
  technicalDataTable?: string;
  pdfManualUrl?: string;
  safetyWarnings?: string;
} {
  const result: { description?: string; technicalDataTable?: string; pdfManualUrl?: string; safetyWarnings?: string } = {};

  // 1. AUTO-EXTRACT DESCRIPTION (look for "Beschreibung" tab or section)
  const descriptionSelectors = [
    '#description-tab-516d15ca626445a38719925615405a64-pane', // Nitecore specific
    '[id*="description"]',
    '[class*="description"]',
    '[id*="produktbeschreibung"]',
    '.product-description',
    '.tab-content [id*="beschreibung"]',
    '.tab-pane:contains("Die")', // Generic German product descriptions start with "Die"
  ];

  for (const selector of descriptionSelectors) {
    try {
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 50) { // Minimum length to be valid description
          result.description = text;
          console.log(`Auto-extracted description using: ${selector}`);
          break;
        }
      }
    } catch (error) {
      continue;
    }
  }

  // 2. AUTO-EXTRACT TECHNICAL DATA TABLE - FULL HTML (look for "Technische Daten" tab content)
  // STRATEGY: Extract the entire tab pane content, not just a single table
  const technicalDataPaneSelectors = [
    '#technical-data-516d15ca626445a38719925615405a64-pane', // Nitecore specific tab pane (FULL CONTENT)
    '#additional', // ANSMANN: Magento "Zusatzinformation" tab containing technical data table
    '.additional-attributes-wrapper', // ANSMANN: Wrapper for technical attributes
    '[id$="-pane"][id*="technical"]', // Match IDs ending with -pane (NOT tab buttons)
    '.tab-pane[id*="technical"]', // Tab pane with class
    '.tab-pane[id*="technische-daten"]', // German technical data pane
  ];

  // Try to get the COMPLETE tab pane first (all DIVs and tables)
  for (const selector of technicalDataPaneSelectors) {
    try {
      const pane = $(selector).first();
      if (pane.length > 0) {
        const content = pane.html();
        // Make sure we got actual content, not just a tab button (should have table or multiple divs)
        if (content && content.length > 200 && (content.includes('<table') || content.includes('properties-row'))) {
          result.technicalDataTable = content; // Use raw HTML without wrapper div
          console.log(`Auto-extracted FULL technical data pane using: ${selector} (${content.length} chars)`);
          break;
        }
      }
    } catch (error) {
      continue;
    }
  }

  // Fallback: Try individual table selectors
  if (!result.technicalDataTable) {
    const tableSelectors = [
      '.tab-content table',
      'table.product-detail-properties-table',
      'table.table-striped',
      'table[border="0"]',
      'table.data.table.additional-attributes', // ANSMANN: Technical data table class
      '.additional-attributes', // ANSMANN: Additional attributes wrapper
    ];

    for (const selector of tableSelectors) {
      try {
        const table = $(selector).first();
        if (table.length > 0) {
          const rows = table.find('tr');
          if (rows.length >= 3) {
            result.technicalDataTable = table.toString();
            console.log(`Auto-extracted technical data table using: ${selector} (${rows.length} rows)`);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }
  }

  // Fallback: Search entire HTML for table with technical keywords
  if (!result.technicalDataTable) {
    $('table').each((_, el) => {
      const tableHtml = $(el).html() || '';
      const tableText = $(el).text().toLowerCase();
      
      // Check for technical keywords in German (including ANSMANN-specific fields)
      const technicalKeywords = [
        'länge', 'gewicht', 'durchmesser', 'stromversorgung', 'leuchtmittel', 'lumen', 'leuchtweite',
        'nominal-spannung', 'nominal-kapazität', 'entladestrom', 'zellenchemie', 'energie', 'breite', 'höhe',
        'spannung', 'kapazität', 'farbe', 'produktgewicht', 'ean-code', 'artikelnummer'
      ];
      const matchCount = technicalKeywords.filter(keyword => tableText.includes(keyword)).length;
      
      // ANSMANN tables typically have ≥5 rows with attribute-value pairs
      const rowCount = $(el).find('tr').length;
      const hasAttributeValueStructure = tableText.includes('ean-code') || tableText.includes('artikelnummer');
      
      if (matchCount >= 2 || (rowCount >= 5 && hasAttributeValueStructure)) { // Lowered threshold for ANSMANN
        result.technicalDataTable = $(el).toString();
        console.log(`Auto-extracted technical data table by keyword matching (${matchCount} keywords)`);
        return false; // Break loop
      }
    });
  }

  // 3. AUTO-EXTRACT PDF MANUAL URL (look for "Bedienungsanleitungen" download button)
  // Nitecore uses: <button onclick="download('https://www.nitecore.de/media/.../MANUAL.PDF')">
  const pdfButtons = $('button.downloadimg, button[onclick*="download"]');
  pdfButtons.each((_, btn) => {
    const onclick = $(btn).attr('onclick');
    if (onclick) {
      // Extract URL from onclick="download('URL')"
      const match = onclick.match(/download\(['"]([^'"]+)['"]\)/);
      if (match && match[1] && (match[1].toLowerCase().includes('.pdf') || match[1].toLowerCase().includes('bedienungsanleitung'))) {
        result.pdfManualUrl = match[1];
        console.log(`Auto-extracted PDF manual URL: ${result.pdfManualUrl}`);
        return false; // Found first PDF, break loop
      }
    }
  });

  // Fallback: Look for direct PDF links
  if (!result.pdfManualUrl) {
    const pdfLinks = $('a[href$=".pdf"], a[href*=".PDF"], a[href*="bedienungsanleitung"]');
    if (pdfLinks.length > 0) {
      const href = pdfLinks.first().attr('href');
      if (href) {
        try {
          result.pdfManualUrl = href.startsWith('http') ? href : `https://${new URL(url).hostname}${href}`;
          console.log(`Auto-extracted PDF manual URL (fallback): ${result.pdfManualUrl}`);
        } catch (error) {
          console.error(`Failed to parse PDF URL: ${href}`, error);
        }
      }
    }
  }

  // 4. AUTO-EXTRACT SAFETY WARNINGS (look for "Produktsicherheit" / "PRODUKT HINWEIS")
  const safetyWarnings: string[] = [];
  
  // Nitecore uses: <div class="custom-hint-text">Warning text here</div>
  $('.custom-hint-text, .safety-warning, .product-safety, [class*="warning"], [class*="hinweis"]').each((_, el) => {
    const text = $(el).text().trim();
    // Filter out short texts and navigation items
    if (text.length > 20 && !text.toLowerCase().includes('navigation') && !text.toLowerCase().includes('menu')) {
      safetyWarnings.push(text);
    }
  });

  // Also check for explicit safety icons/symbols
  $('img[src*="warning"], img[src*="hinweis"], img[src*="heat"], img[src*="strahlung"]').each((_, img) => {
    const parent = $(img).parent();
    const siblingText = parent.find('.custom-hint-text, p, span').text().trim();
    if (siblingText.length > 20 && !safetyWarnings.includes(siblingText)) {
      safetyWarnings.push(siblingText);
    }
  });

  // LIMIT: Nur die 4 wichtigsten Sicherheitshinweise
  if (safetyWarnings.length > 0) {
    const topWarnings = safetyWarnings.slice(0, 4);
    result.safetyWarnings = topWarnings.join('\n\n');
    console.log(`Auto-extracted ${topWarnings.length} safety warning(s) (top 4 from ${safetyWarnings.length} total)`);
  }

  return result;
}

/**
 * INTELLIGENT TABLE PARSER: Extract structured technical data from generic property tables
 * Supports two formats:
 * 1. Table: <th class="properties-label">Länge:</th><td class="properties-value">156 mm</td>
 * 2. DIVs: <div class="product-detail-technical-data-label">Länge (mm)</div><div class="product-detail-technical-data-value">148,2</div>
 */
function parsePropertiesTable($: cheerio.CheerioAPI, product: any): void {
  let foundData = false;

  // METHOD 1: Parse DIV-based technical data (Nitecore "Technische Daten" tab)
  const technicalDataContainer = $('.product-detail-technical-data, #lds-technical-data-tab-pane');
  if (technicalDataContainer.length > 0) {
    console.log('Found DIV-based technical data structure, parsing...');
    
    technicalDataContainer.find('.product-detail-technical-data-label').each((_, labelEl) => {
      const $label = $(labelEl);
      const label = $label.text().trim().toLowerCase();
      const $value = $label.next('.product-detail-technical-data-value');
      const value = $value.text().trim();

      if (!label || !value) return;
      foundData = true;

      // Map labels to product fields using keywords
      if (label.includes('länge') && !label.includes('leucht')) {
        product.length = value;
      } else if (label.includes('gehäusedurchmesser') || label.includes('body diameter') || label.includes('bodydurchmesser')) {
        product.bodyDiameter = value;
      } else if (label.includes('kopfdurchmesser') || label.includes('head diameter')) {
        product.headDiameter = value;
      } else if (label.includes('gewicht') && (label.includes('ohne') || label.includes('without'))) {
        product.weightWithoutBattery = value;
      } else if (label.includes('gesamt gewicht') || label.includes('total weight')) {
        product.totalWeight = value;
      } else if (label.includes('stromversorgung') || label.includes('power supply')) {
        product.powerSupply = value;
      } else if (label.includes('leuchtmittel 1') || label === 'leuchtmittel 1') {
        product.led1 = value;
      } else if (label.includes('leuchtmittel 2') || label === 'leuchtmittel 2') {
        product.led2 = value;
      } else if (label.includes('spotintensität') || label.includes('spot intensity')) {
        product.spotIntensity = value;
      } else if (label.includes('leuchtleistung')) {
        product.maxLuminosity = value;
      } else if (label.includes('leuchtweite')) {
        product.maxBeamDistance = value;
      }
    });
  }

  // METHOD 2: Parse TABLE-based properties (fallback)
  if (!foundData) {
    const table = $('.product-detail-properties-table, table.table-striped, .properties-table').first();
    
    if (table.length > 0) {
      console.log('Found TABLE-based properties, parsing...');
      
      table.find('tr').each((_, row) => {
        const $row = $(row);
        const label = $row.find('th, .properties-label').first().text().trim().toLowerCase();
        const value = $row.find('td, .properties-value').first().text().trim();

        if (!label || !value) return;

        // Map labels to product fields using keywords
        if (label.includes('länge') && !label.includes('leucht')) {
          product.length = value;
        } else if (label.includes('gehäusedurchmesser') || label.includes('body diameter')) {
          product.bodyDiameter = value;
        } else if (label.includes('kopfdurchmesser') || label.includes('head diameter')) {
          product.headDiameter = value;
        } else if (label.includes('gewicht ohne akku') || label.includes('weight without battery')) {
          product.weightWithoutBattery = value;
        } else if (label.includes('gesamt gewicht') || label.includes('total weight')) {
          product.totalWeight = value;
        } else if (label.includes('stromversorgung') || label.includes('power supply')) {
          product.powerSupply = value;
        } else if (label.includes('leuchtmittel 1') || label.includes('led 1')) {
          product.led1 = value;
        } else if (label.includes('leuchtmittel 2') || label.includes('led 2')) {
          product.led2 = value;
        } else if (label.includes('spotintensität') || label.includes('spot intensity')) {
          product.spotIntensity = value;
        } else if (label.includes('leuchtleistung') || label.includes('max output')) {
          product.maxLuminosity = value;
        } else if (label.includes('leuchtweite') || label.includes('beam distance')) {
          product.maxBeamDistance = value;
        }
      });
    }
  }

  console.log('Parsed technical data:', {
    length: product.length,
    bodyDiameter: product.bodyDiameter,
    headDiameter: product.headDiameter,
    weightWithoutBattery: product.weightWithoutBattery,
    totalWeight: product.totalWeight,
    powerSupply: product.powerSupply,
    led1: product.led1,
    led2: product.led2,
    spotIntensity: product.spotIntensity,
    maxLuminosity: product.maxLuminosity,
    maxBeamDistance: product.maxBeamDistance
  });
}

/**
 * Common product link selector patterns to try automatically
 */
const AUTO_DETECT_SELECTORS = [
  'a.product-link',
  'a.product-item-link',
  'a[href*="/product/"]',
  'a[href*="/products/"]',
  'a[href*="/p/"]',
  'a[href*="/item/"]',
  'a[href*="/artikel/"]',
  '.product-item a',
  '.product-card a',
  '.product a',
  'article a',
  'a[itemprop="url"]',
  'a.productTitle',
  'a.product-name',
  'h3 a',
  'h2 a'
];

/**
 * Auto-detect product link selector by trying common patterns
 */
function autoDetectProductLinks($: cheerio.CheerioAPI, url: string): string[] {
  const productUrls: string[] = [];
  
  for (const selector of AUTO_DETECT_SELECTORS) {
    try {
      const links: string[] = [];
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          const absoluteUrl = href.startsWith('http') ? href : new URL(href, url).toString();
          links.push(absoluteUrl);
        }
      });
      
      // If we found at least 3 links with this selector, consider it successful
      if (links.length >= 3) {
        console.log(`Auto-detected product links using selector: ${selector} (${links.length} found)`);
        return links;
      }
    } catch (error) {
      // Skip invalid selectors
      continue;
    }
  }
  
  console.log('Auto-detection found no suitable product links');
  return productUrls;
}

/**
 * Find the next page URL from pagination
 */
function findNextPageUrl($: cheerio.CheerioAPI, currentUrl: string, paginationSelector?: string): string | null {
  // Method 1: Use provided pagination selector (e.g., '.pagination .next', 'a[rel="next"]')
  if (paginationSelector) {
    const nextLink = $(paginationSelector).first();
    const href = nextLink.attr('href');
    if (href && !nextLink.hasClass('disabled') && nextLink.attr('aria-disabled') !== 'true') {
      return href.startsWith('http') ? href : new URL(href, currentUrl).toString();
    }
  }

  // Method 2: Check for input-based pagination (Nitecore-style)
  // <li class="page-item page-next"><input type="radio" name="p" id="p-next" value="2">
  const nextInput = $('.page-next:not(.disabled) input[name="p"], input#p-next').first();
  if (nextInput.length > 0) {
    const nextPageValue = nextInput.attr('value');
    if (nextPageValue) {
      const urlObj = new URL(currentUrl);
      urlObj.searchParams.set('p', nextPageValue);
      console.log(`Found next page using input pagination: p=${nextPageValue}`);
      return urlObj.toString();
    }
  }

  // Method 3: Auto-detect common link-based pagination patterns
  const commonSelectors = [
    'a[rel="next"]',
    '.pagination .next:not(.disabled) a',
    '.pagination li.next:not(.disabled) a',
    'a.next:not(.disabled)',
    '.pager .next a',
    '[aria-label="Next"]',
    'a:contains("Weiter"):not(.disabled)',
    'a:contains("Next"):not(.disabled)',
    'a:contains("›"):not(.disabled)',
    'a:contains("»"):not(.disabled)'
  ];

  for (const selector of commonSelectors) {
    try {
      const nextLink = $(selector).first();
      if (nextLink.length > 0) {
        const href = nextLink.attr('href');
        if (href && !nextLink.hasClass('disabled')) {
          const absoluteUrl = href.startsWith('http') ? href : new URL(href, currentUrl).toString();
          console.log(`Found next page using selector: ${selector}`);
          return absoluteUrl;
        }
      }
    } catch (error) {
      continue;
    }
  }

  // Method 4: Try URL pattern increment (e.g., ?page=1 → ?page=2)
  const urlObj = new URL(currentUrl);
  const pageParam = urlObj.searchParams.get('page') || urlObj.searchParams.get('p');
  
  if (pageParam) {
    const currentPage = parseInt(pageParam, 10);
    if (!isNaN(currentPage)) {
      const nextPage = currentPage + 1;
      const paramName = urlObj.searchParams.has('page') ? 'page' : 'p';
      urlObj.searchParams.set(paramName, nextPage.toString());
      console.log(`Incremented URL parameter ${paramName} to ${nextPage}`);
      return urlObj.toString();
    }
  }

  return null;
}

/**
 * Scrape multiple products from a listing page (single page only)
 */
export async function scrapeProductList(
  url: string,
  productLinkSelector: string | null,
  maxProducts: number = 50,
  options?: Partial<ScrapeOptions>
): Promise<string[]> {
  console.log(`Scraping product list from: ${url}`);

  const headers: Record<string, string> = {
    'User-Agent': options?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de,en-US;q=0.7,en;q=0.3'
  };

  if (options?.cookies) {
    headers['Cookie'] = options.cookies;
  }

  const timeout = options?.timeout || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let html: string;
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    html = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  const $ = cheerio.load(html);

  let productUrls: string[] = [];

  // Use auto-detection if no selector provided
  if (!productLinkSelector || productLinkSelector.trim() === '') {
    console.log('No selector provided, using auto-detection...');
    productUrls = autoDetectProductLinks($, url);
  } else {
    // Extract product URLs using provided selector
    $(productLinkSelector).each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        // Make absolute URL if relative
        const absoluteUrl = href.startsWith('http') ? href : new URL(href, url).toString();
        productUrls.push(absoluteUrl);
      }
    });
  }

  // Remove duplicates
  productUrls = Array.from(new Set(productUrls));

  // Limit results
  const limitedUrls = productUrls.slice(0, maxProducts);
  console.log(`Found ${productUrls.length} products, returning ${limitedUrls.length}`);

  return limitedUrls;
}

/**
 * Scrape multiple pages of a product listing with pagination
 */
export async function scrapeAllPages(
  startUrl: string,
  productLinkSelector: string | null,
  paginationSelector: string | null,
  maxPages: number = 10,
  maxProductsTotal: number = 500,
  options?: Partial<ScrapeOptions>,
  progressCallback?: (currentPage: number, totalProducts: number) => void
): Promise<string[]> {
  console.log(`Starting multi-page scraping from: ${startUrl}`);
  console.log(`Max pages: ${maxPages}, Max products: ${maxProductsTotal}`);

  const allProductUrls: string[] = [];
  let currentUrl: string | null = startUrl;
  let pageNumber = 1;
  let consecutiveEmptyPages = 0;
  const MAX_CONSECUTIVE_EMPTY_PAGES = 3; // Stop after 3 empty pages

  while (currentUrl && pageNumber <= maxPages && allProductUrls.length < maxProductsTotal) {
    console.log(`\n📄 Scraping Seite ${pageNumber}/${maxPages}: ${currentUrl}`);

    try {
      // Scrape current page
      const pageProducts = await scrapeProductList(
        currentUrl,
        productLinkSelector,
        maxProductsTotal - allProductUrls.length, // Remaining quota
        options
      );

      console.log(`✓ Found ${pageProducts.length} products on page ${pageNumber}`);
      
      // Track consecutive empty pages
      if (pageProducts.length === 0) {
        consecutiveEmptyPages++;
        console.log(`⚠️ Empty page detected (${consecutiveEmptyPages}/${MAX_CONSECUTIVE_EMPTY_PAGES})`);
        
        if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY_PAGES) {
          console.log(`🛑 Stopping: ${MAX_CONSECUTIVE_EMPTY_PAGES} consecutive empty pages found`);
          break;
        }
      } else {
        consecutiveEmptyPages = 0; // Reset counter when products are found
      }
      
      allProductUrls.push(...pageProducts);

      // Report progress
      if (progressCallback) {
        progressCallback(pageNumber, allProductUrls.length);
      }

      // Check if we've reached the limit
      if (allProductUrls.length >= maxProductsTotal) {
        console.log(`Reached maximum product limit (${maxProductsTotal})`);
        break;
      }

      // Fetch page HTML to find next page
      const headers: Record<string, string> = {
        'User-Agent': options?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de,en-US;q=0.7,en;q=0.3'
      };

      if (options?.cookies) {
        headers['Cookie'] = options.cookies;
      }

      const response = await fetch(currentUrl, { headers });
      const html = await response.text();
      const $ = cheerio.load(html);

      // Find next page
      const nextUrl = findNextPageUrl($, currentUrl, paginationSelector || undefined);
      
      if (!nextUrl) {
        console.log('No next page found, pagination complete');
        break;
      }

      if (nextUrl === currentUrl) {
        console.log('Next page URL is same as current, stopping to prevent infinite loop');
        break;
      }

      currentUrl = nextUrl;
      pageNumber++;

      // Polite delay between pages (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`Error scraping page ${pageNumber}:`, error);
      break;
    }
  }

  // Remove duplicates (in case products appear on multiple pages)
  const uniqueProducts = Array.from(new Set(allProductUrls));
  
  console.log(`\n=== PAGINATION COMPLETE ===`);
  console.log(`Pages scraped: ${pageNumber}`);
  console.log(`Total products found: ${uniqueProducts.length}`);

  return uniqueProducts;
}

/**
 * Test a single CSS selector on a URL
 * Returns the extracted value for verification
 */
export async function testSelector(options: {
  url: string;
  selector: string;
  userAgent?: string;
  cookies?: string;
  timeout?: number;
}): Promise<{
  success: boolean;
  value?: string;
  html?: string;
  count?: number;
  error?: string;
}> {
  const { url, selector, userAgent, cookies, timeout = 30000 } = options;

  try {
    console.log(`[Test Selector] Testing selector "${selector}" on ${url}`);

    // Fetch the HTML
    const headers: Record<string, string> = {
      'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    };

    if (cookies) {
      headers['Cookie'] = cookies;
    }

    let html = '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      html = await response.text();
    } finally {
      clearTimeout(timeoutId);
    }

    // Parse with Cheerio
    const $ = cheerio.load(html);

    // Test the selector
    const elements = $(selector);
    const count = elements.length;

    if (count === 0) {
      return {
        success: false,
        count: 0,
        error: 'Kein Element gefunden - Selektor matched nichts auf der Seite'
      };
    }

    // Get the first element's value
    const firstElement = elements.first();
    const textValue = firstElement.text().trim();
    const contentAttr = firstElement.attr('content')?.trim();
    const htmlValue = firstElement.html()?.trim();

    const value = textValue || contentAttr || htmlValue || '';

    return {
      success: true,
      value: value.substring(0, 500), // Limit to 500 chars for preview
      html: htmlValue?.substring(0, 500),
      count
    };

  } catch (error: any) {
    console.error('[Test Selector] Error:', error);
    return {
      success: false,
      error: error.message || 'Unbekannter Fehler beim Testen des Selektors'
    };
  }
}

/**
 * Default selectors for common e-commerce platforms
 */
export const defaultSelectors: Record<string, ScraperSelectors> = {
  generic: {
    articleNumber: '[itemprop="sku"], .product-code, .article-number',
    productName: 'h1, [itemprop="name"], .product-title',
    ean: '[itemprop="gtin13"], .ean, .barcode',
    manufacturer: '[itemprop="brand"], .manufacturer, .brand',
    price: '[itemprop="price"], .price, .product-price',
    description: '[itemprop="description"], .product-description, .description',
    images: '[itemprop="image"], .product-image img, .gallery img',
    weight: '.weight, [itemprop="weight"]',
    category: '.breadcrumb, [itemprop="category"]'
  },
  shopware: {
    articleNumber: '.product-detail-ordernumber',
    productName: '.product-detail-name',
    ean: '.product-detail-ordernumber-container .product-detail-ordernumber',
    price: '.product-detail-price',
    description: '.product-detail-description',
    images: '.gallery-slider-image',
    category: '.breadcrumb-item'
  }
};

/**
 * Brickfox-optimized selectors
 * Only the 9 essential fields needed for Brickfox CSV export
 * This minimizes scraping overhead and database storage
 */
export const brickfoxSelectors: ScraperSelectors = {
  articleNumber: '[itemprop="sku"], .product-code, .article-number',
  productName: 'h1, [itemprop="name"], .product-title',
  ean: '[itemprop="gtin13"], .ean, .barcode',
  manufacturer: '[itemprop="brand"], .manufacturer, .brand',
  category: '.breadcrumb, [itemprop="category"]',
  price: '[itemprop="price"], .price, .product-price',
  weight: '.weight, [itemprop="weight"]',
  description: '[itemprop="description"], .product-description, .description',
  images: '[itemprop="image"], .product-image img, .gallery img'
};
