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
  priceGross?: string;  // Händler-EK-Preis (Brutto)
  rrp?: string;  // UVP / Empfohlener VK-Preis
  description?: string;
  longDescription?: string;  // Ausführliche Beschreibung
  images?: string;
  weight?: string;
  dimensions?: string;  // Abmessungen (L×B×H)
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
  priceGross?: string;  // Händler-EK-Preis (Brutto)
  rrp?: string;  // UVP / Empfohlener VK-Preis
  ekPrice?: string;  // Einkaufspreis (Purchase Price)
  vkPrice?: string;  // Verkaufspreis (Sales Price) - calculated as EK * 2.38, rounded to .95
  description?: string;
  longDescription?: string;  // Ausführliche Beschreibung
  images: string[];
  weight?: string;
  dimensions?: string;  // Abmessungen (L×B×H)
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
  usePhpScraper?: boolean; // Option to use PHP scraper instead of TypeScript
  phpScraperPath?: string; // Path to PHP scraper script
  supplierId?: string; // Supplier ID for auto-detecting PHP scraper
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
 * Extract dealer price from analytics JSON embedded in HTML
 * Searches <script> tags for Google Analytics/Tag Manager data with price information
 * Returns price in German format (e.g., "87,50") or undefined if not found
 */
function extractDealerPriceFromAnalytics(html: string, articleNumber?: string): string | undefined {
  try {
    const $ = cheerio.load(html);
    
    // Search all script tags for analytics data
    const scriptTags = $('script');
    
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html();
      if (!scriptContent) continue;
      
      // Look for JSON patterns containing "price" field
      // Common patterns: dataLayer.push(...), gtag(...), window.dataLayer = [...]
      const jsonPatterns = [
        /"price":\s*([0-9.]+)/g,  // Simple: "price":87.5
        /\{"price":([0-9.]+),"index":/g,  // GA4 ecommerce items
      ];
      
      for (const pattern of jsonPatterns) {
        const matches = Array.from(scriptContent.matchAll(pattern));
        
        for (const match of matches) {
          const priceValue = parseFloat(match[1]);
          if (!isNaN(priceValue) && priceValue > 0) {
            // Additional validation: if articleNumber provided, check if it's nearby in the JSON
            if (articleNumber) {
              const contextStart = Math.max(0, match.index! - 200);
              const contextEnd = Math.min(scriptContent.length, match.index! + 200);
              const context = scriptContent.substring(contextStart, contextEnd);
              
              // Check if article number appears in the same JSON object
              if (context.includes(`"item_id":"${articleNumber}"`)) {
                const germanPrice = priceValue.toFixed(2).replace('.', ',');
                console.log(`[Analytics Price] Found dealer price for ${articleNumber}: ${germanPrice}€`);
                return germanPrice;
              }
            } else {
              // No article number validation, return first valid price found
              const germanPrice = priceValue.toFixed(2).replace('.', ',');
              console.log(`[Analytics Price] Found dealer price: ${germanPrice}€`);
              return germanPrice;
            }
          }
        }
      }
    }
    
    console.log('[Analytics Price] No dealer price found in analytics data');
    return undefined;
  } catch (error) {
    console.log('[Analytics Price] Error extracting price:', error);
    return undefined;
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
 * Get PHP scraper path based on supplier ID
 * @param supplierId - Supplier ID
 * @param type - 'single' for single URL scraping, 'category' for category/list scraping
 */
function getPhpScraperPath(supplierId?: string, type: 'single' | 'category' = 'single'): string | null {
  if (!supplierId) return null;
  
  const supplierMap: Record<string, { single: string; category: string }> = {
    'mediacom': {
      single: 'server/scrapers/php/scrape-mediacom.php',
      category: 'server/scrapers/php/scrape-category-mediacom.php'
    },
    'wentronic': {
      single: 'server/scrapers/php/scrape-wentronic.php',
      category: 'server/scrapers/php/scrape-category-wentronic.php' // TODO: Create this
    },
    'media': {
      single: 'server/scrapers/php/scrape-mediacom.php',
      category: 'server/scrapers/php/scrape-category-mediacom.php'
    },
    'went': {
      single: 'server/scrapers/php/scrape-wentronic.php',
      category: 'server/scrapers/php/scrape-category-wentronic.php' // TODO: Create this
    },
  };
  
  const normalizedId = supplierId.toLowerCase();
  return supplierMap[normalizedId]?.[type] || null;
}

/**
 * Call PHP scraper script and parse JSON response
 */
async function callPhpScraper(
  phpScriptPath: string,
  url: string,
  selectors: ScraperSelectors,
  cookies?: string,
  userAgent?: string
): Promise<ScrapedProduct> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const path = await import('path');
  const fs = await import('fs');

  // Resolve PHP script path
  const scriptPath = path.resolve(phpScriptPath);
  
  // Check if PHP script exists
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`PHP scraper script not found: ${scriptPath}`);
  }

  // Prepare arguments - escape properly for Windows PowerShell
  const selectorsJson = JSON.stringify(selectors);
  const args = [
    url,
    selectorsJson,
    cookies || '',
    userAgent || ''
  ];

  // Build command with proper escaping
  const escapedArgs = args.map(arg => {
    // Escape quotes and wrap in quotes
    return `"${arg.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
  }).join(' ');

  const command = `php "${scriptPath}" ${escapedArgs}`;
  console.log(`[PHP-SCRAPER] Calling: ${command.substring(0, 200)}...`);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    if (stderr && !stderr.includes('Warning') && !stderr.includes('Notice')) {
      console.warn(`[PHP-SCRAPER] PHP stderr: ${stderr}`);
    }

    // Debug: Log raw PHP output
    console.log(`[PHP-SCRAPER] Raw stdout length: ${stdout.length} chars`);
    console.log(`[PHP-SCRAPER] Raw stdout (first 500 chars):`, stdout.substring(0, 500));
    
    // Parse JSON response
    let result;
    try {
      result = JSON.parse(stdout.trim());
      console.log(`[PHP-SCRAPER] Parsed JSON successfully, keys:`, Object.keys(result));
    } catch (parseError: any) {
      console.error(`[PHP-SCRAPER] JSON parse error:`, parseError.message);
      console.error(`[PHP-SCRAPER] Full stdout:`, stdout);
      throw new Error(`PHP scraper returned invalid JSON: ${parseError.message}`);
    }
    
    // Check for error in result
    if (result.error) {
      console.error(`[PHP-SCRAPER] PHP script returned error:`, result.error);
      throw new Error(`PHP scraper error: ${result.error}`);
    }
    
    // Convert PHP response to ScrapedProduct format
    const product: ScrapedProduct = {
      articleNumber: result.articleNumber || result.article_number || '',
      productName: result.productName || result.product_name || '',
      images: result.images || [],
      ean: result.ean,
      manufacturer: result.manufacturer,
      price: result.price,
      priceGross: result.priceGross || result.price_gross,
      rrp: result.rrp,
      ekPrice: result.ekPrice || result.ek_price,
      vkPrice: result.vkPrice || result.vk_price,
      description: result.description,
      longDescription: result.longDescription || result.long_description,
      weight: result.weight,
      dimensions: result.dimensions,
      category: result.category,
      length: result.length,
      bodyDiameter: result.bodyDiameter || result.body_diameter,
      headDiameter: result.headDiameter || result.head_diameter,
      weightWithoutBattery: result.weightWithoutBattery || result.weight_without_battery,
      totalWeight: result.totalWeight || result.total_weight,
      powerSupply: result.powerSupply || result.power_supply,
      led1: result.led1,
      led2: result.led2,
      spotIntensity: result.spotIntensity || result.spot_intensity,
      maxLuminosity: result.maxLuminosity || result.max_luminosity,
      maxBeamDistance: result.maxBeamDistance || result.max_beam_distance,
      pdfManualUrl: result.pdfManualUrl || result.pdf_manual_url,
      safetyWarnings: result.safetyWarnings || result.safety_warnings,
      rawHtml: result.rawHtml || result.raw_html,
      technicalDataTable: result.technicalDataTable || result.technical_data_table,
      autoExtractedDescription: result.autoExtractedDescription || result.auto_extracted_description,
      manufacturerArticleNumber: result.manufacturerArticleNumber || result.manufacturer_article_number
    };

    console.log(`[PHP-SCRAPER] Successfully scraped: ${product.productName || product.articleNumber}`);
    return product;
  } catch (error: any) {
    console.error(`[PHP-SCRAPER] Error executing PHP script:`, error);
    throw new Error(`PHP scraper failed: ${error.message}`);
  }
}

/**
 * Scrape product data from a SINGLE URL (Bulk URL Scraping)
 * 
 * Used for:
 * - PDF-extracted URLs: Each URL from PDF is scraped individually
 * - Manual bulk URL input: User pastes multiple URLs, each is scraped
 * 
 * Similar to PHP DomCrawler approach
 * Can optionally use PHP scraper if usePhpScraper is true
 */
export async function scrapeProduct(options: ScrapeOptions): Promise<ScrapedProduct> {
  const startTime = Date.now();
  const {
    url,
    selectors,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    cookies,
    timeout = 10000,
    usePhpScraper = false,
    phpScraperPath
  } = options;

  // Auto-detect PHP scraper if supplierId is provided (for single URL scraping)
  const autoPhpScraperPath = options.supplierId ? getPhpScraperPath(options.supplierId, 'single') : null;
  
  // Use PHP scraper if requested or auto-detected
  const finalPhpScraperPath = phpScraperPath || (usePhpScraper ? autoPhpScraperPath : null);
  
  if (finalPhpScraperPath) {
    console.log(`[SCRAPER] Using PHP scraper: ${finalPhpScraperPath}`);
    try {
      const result = await callPhpScraper(finalPhpScraperPath, url, selectors, cookies, userAgent);
      console.log(`[SCRAPER] PHP scraper succeeded, returning product data`);
      return result;
    } catch (error: any) {
      console.error(`[SCRAPER] PHP scraper failed:`, error.message || error);
      console.error(`[SCRAPER] Error details:`, error);
      console.error(`[SCRAPER] Falling back to TypeScript scraper...`);
      // Fall through to TypeScript scraper
    }
  } else {
    console.log(`[SCRAPER] No PHP scraper found for supplierId: ${options.supplierId || 'none'}, using TypeScript scraper`);
  }

  console.log(`[SCRAPER] Scraping URL: ${url} | timeout: ${timeout}ms | cookies: ${cookies ? 'yes' : 'no'}`);

  // Enhanced headers to mimic real browser (reduces bot detection)
  const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const headers: Record<string, string> = {
    'User-Agent': userAgent || defaultUserAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'DNT': '1'
  };

  // Add Referer if we can determine it from the URL
  try {
    const urlObj = new URL(url);
    headers['Referer'] = `${urlObj.protocol}//${urlObj.host}/`;
  } catch (e) {
    // Ignore if URL parsing fails
  }

  if (cookies) {
    headers['Cookie'] = cookies;
    console.log(`[SCRAPER] Using cookies: ${cookies.substring(0, 50)}...`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let html: string;
  let finalUrl = url; // Track redirects
  try {
    const fetchStart = Date.now();
    console.log(`[SCRAPER] Fetching ${url}...`);
    
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'follow', // Follow redirects automatically
      // @ts-ignore - Node.js fetch may support these
      compress: true,
    });

    finalUrl = response.url; // Get final URL after redirects
    if (finalUrl !== url) {
      console.log(`[SCRAPER] Redirected: ${url} → ${finalUrl}`);
    }

    if (!response.ok) {
      const fetchDuration = Date.now() - fetchStart;
      const responseText = await response.text().catch(() => '');
      console.error(`[SCRAPER] HTTP Error ${response.status} for ${url} (${fetchDuration}ms)`);
      console.error(`[SCRAPER] Response headers:`, Object.fromEntries(response.headers.entries()));
      console.error(`[SCRAPER] Response body (first 500 chars):`, responseText.substring(0, 500));
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    html = await response.text();
    const fetchDuration = Date.now() - fetchStart;
    console.log(`[SCRAPER] HTML fetched: ${html.length} chars in ${fetchDuration}ms from ${finalUrl}`);
    
    // Debug: Check if HTML looks valid
    if (html.length < 100) {
      console.warn(`[SCRAPER] ⚠️ Very short HTML response (${html.length} chars) - might be an error page`);
      console.warn(`[SCRAPER] HTML preview:`, html.substring(0, 200));
    }
    
    // Check for common bot detection patterns
    if (html.includes('Access Denied') || html.includes('blocked') || html.includes('Cloudflare')) {
      console.error(`[SCRAPER] ⚠️ Possible bot detection/blocking detected in response`);
    }
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const fetchDuration = Date.now() - startTime;
      console.error(`[SCRAPER] Timeout after ${timeout}ms (${fetchDuration}ms total) for ${url}`);
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    const fetchDuration = Date.now() - startTime;
    console.error(`[SCRAPER] Fetch error for ${url} (${fetchDuration}ms):`, error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(`[SCRAPER] Error stack:`, error.stack);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  // Parse with Cheerio (equivalent to Symfony DomCrawler)
  const $ = cheerio.load(html, {
    decodeEntities: true,
    normalizeWhitespace: false
  });

  // Debug: Log page title to verify we got the right page
  const pageTitle = $('title').text().trim();
  console.log(`[SCRAPER] Page title: "${pageTitle}"`);
  
  // Debug: Check if selectors exist
  if (selectors.articleNumber || (selectors as any).productCode) {
    const selector = (selectors as any).productCode || selectors.articleNumber;
    const count = $(selector).length;
    console.log(`[SCRAPER] Selector "${selector}" found ${count} element(s)`);
  }

  // Extract data using CSS selectors
  const product: ScrapedProduct = {
    articleNumber: '',
    productName: '',
    images: []
  };

  // Detect supplier from URL
  const isANSMANN = url.includes('pim.ansmann.de');
  const isNitecore = url.includes('nitecore.de');
  
  // Article Number / SKU (support both 'articleNumber' and 'productCode')
  const articleSelector = (selectors as any).productCode || selectors.articleNumber;
  if (articleSelector) {
    const element = $(articleSelector).first();
    let manufacturerNumber = element.text().trim() || element.attr('content')?.trim() || '';
    
    // Keep original format with hyphens (e.g., "2447-3049-60")
    // DO NOT remove hyphens - required for Pixi ERP matching!
    
    // Store manufacturer article number (keep original format)
    product.manufacturerArticleNumber = manufacturerNumber;
    
    // Generate Brickfox article number based on supplier
    if (manufacturerNumber) {
      if (isANSMANN) {
        // ANSMANN: ANS + manufacturer number (remove hyphens for articleNumber)
        const cleanNumber = manufacturerNumber.replace(/-/g, '');
        product.articleNumber = 'ANS' + cleanNumber;
        console.log(`📦 [ANSMANN] Generated Article Number: ${product.articleNumber} (from ${manufacturerNumber})`);
      } else if (isNitecore) {
        // Nitecore: Use manufacturer number as-is (no prefix)
        product.articleNumber = manufacturerNumber;
        console.log(`📦 [Nitecore] Using Article Number: ${product.articleNumber}`);
      } else {
        // Generic: Use manufacturer number as-is
        product.articleNumber = manufacturerNumber;
        console.log(`📦 [Generic] Using Article Number: ${product.articleNumber}`);
      }
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

  // Price - Try analytics JSON extraction first (for dealer prices when logged in)
  let priceFound = false;
  if (cookies) {
    // When logged in, try to extract dealer price from analytics JSON first
    const analyticsPrice = extractDealerPriceFromAnalytics(html, product.articleNumber);
    if (analyticsPrice) {
      product.price = analyticsPrice;
      priceFound = true;
      console.log(`✅ Using dealer price from analytics: ${analyticsPrice}€`);
    }
  }

  // Fallback to CSS selector if analytics extraction didn't find a price
  if (!priceFound && selectors.price) {
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

  // Long Description (ausführliche Beschreibung)
  if (selectors.longDescription) {
    const element = $(selectors.longDescription).first();
    product.longDescription = element.html()?.trim() || element.text().trim() || '';
  }

  // Price Gross (Händler-EK-Preis Brutto)
  if (selectors.priceGross) {
    const element = $(selectors.priceGross).first();
    let priceText = element.text().trim() || element.attr('content')?.trim() || '';
    if (priceText) {
      const numericMatch = priceText.match(/[\d,.]+/);
      if (numericMatch) {
        priceText = numericMatch[0];
        // Convert to German format with comma
        if (priceText.includes('.') && !priceText.includes(',')) {
          priceText = priceText.replace('.', ',');
        }
      }
    }
    product.priceGross = priceText;
  }

  // RRP / UVP (Empfohlener Verkaufspreis)
  if (selectors.rrp) {
    const element = $(selectors.rrp).first();
    let priceText = element.text().trim() || element.attr('content')?.trim() || '';
    if (priceText) {
      const numericMatch = priceText.match(/[\d,.]+/);
      if (numericMatch) {
        priceText = numericMatch[0];
        // Convert to German format with comma
        if (priceText.includes('.') && !priceText.includes(',')) {
          priceText = priceText.replace('.', ',');
        }
      }
    }
    product.rrp = priceText;
  }

  // Dimensions (Abmessungen)
  if (selectors.dimensions) {
    const element = $(selectors.dimensions).first();
    product.dimensions = element.text().trim() || '';
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

  // ANSMANN/Magento: ALWAYS try to extract gallery images from JSON (Magento stores all images in JSON)
  // CRITICAL FIX: Don't skip this even if we found 1 image - Magento always has multiple images in JSON
  try {
    // Find Magento gallery init script
    const scripts = $('script[type="text/x-magento-init"]');
    let foundMagentoGallery = false;
    
    scripts.each((_, scriptEl) => {
      const scriptContent = $(scriptEl).html();
      if (scriptContent && scriptContent.includes('mage/gallery/gallery')) {
        try {
          const json = JSON.parse(scriptContent);
          // Find the gallery config
          for (const key of Object.keys(json)) {
            if (json[key]['mage/gallery/gallery']) {
              const gallery = json[key]['mage/gallery/gallery'];
              if (gallery.data && Array.isArray(gallery.data)) {
                const galleryImages = gallery.data
                  .map((img: any) => img.full || img.img || img.thumb)
                  .filter(Boolean);
                
                if (galleryImages.length > 0) {
                  product.images = galleryImages;
                  console.log(`[Magento Gallery] ✅ Extracted ${galleryImages.length} images from JSON`);
                  foundMagentoGallery = true;
                  return false; // Break the loop
                }
              }
            }
          }
        } catch (parseError) {
          // Silent fail - continue with other scripts
        }
      }
    });
    
    if (!foundMagentoGallery && product.images && product.images.length > 0) {
      console.log(`[Magento Gallery] ⚠️  No Magento gallery found, using ${product.images.length} images from CSS selectors`);
    }
  } catch (error) {
    console.error('[Magento Gallery] Error parsing gallery JSON:', error);
  }

  // ANSMANN: Extract high-resolution images AND PDFs from Downloads tab
  // The Downloads tab contains JPG files and PDF manuals (MSDS, PIB, Bedienungsanleitung)
  try {
    const downloadImages: string[] = [];
    const downloadPdfs: string[] = [];
    
    // Find all links in the Downloads tab that point to image files
    $('#product-info-downloads a[href$=".jpg"], #product-info-downloads a[href$=".JPG"], #product-info-downloads a[href$=".png"], #product-info-downloads a[href$=".PNG"]').each((_, link) => {
      const href = $(link).attr('href');
      if (href && href.startsWith('http')) {
        downloadImages.push(href);
      }
    });
    
    // Find all links in the Downloads tab that point to PDF files
    $('#product-info-downloads a[href$=".pdf"], #product-info-downloads a[href$=".PDF"]').each((_, link) => {
      const href = $(link).attr('href');
      const text = $(link).text().trim().toLowerCase();
      if (href && href.startsWith('http')) {
        downloadPdfs.push(href);
      }
    });
    
    // If we found download images, prefer them over gallery images (higher quality!)
    if (downloadImages.length > 0) {
      console.log(`[ANSMANN Downloads] ✅ Extracted ${downloadImages.length} high-res images from Downloads tab`);
      // Merge with existing gallery images, prioritizing download images (remove duplicates)
      const allImages = [...downloadImages, ...(product.images || [])];
      product.images = Array.from(new Set(allImages)); // Remove duplicates
      console.log(`[ANSMANN Downloads] 🖼️  Total unique images: ${product.images.length}`);
    }
    
    // Store PDFs for Brickfox export (MSDS, Manuals, etc.)
    if (downloadPdfs.length > 0) {
      (product as any).pdfFiles = downloadPdfs;
      console.log(`[ANSMANN Downloads] 📄 Extracted ${downloadPdfs.length} PDF files from Downloads tab`);
    }
  } catch (error) {
    console.error('[ANSMANN Downloads] Error extracting download files:', error);
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
    const rawValue = element.text().trim();
    (product as any).nominalspannung = formatMeasurement(rawValue);
    if (rawValue) console.log(`⚡ Extracted Nominalspannung: ${rawValue} → ${(product as any).nominalspannung}`);
  }

  if ((selectors as any).nominalkapazitaet) {
    const element = $((selectors as any).nominalkapazitaet).first();
    const rawValue = element.text().trim();
    (product as any).nominalkapazitaet = formatMeasurement(rawValue);
    if (rawValue) console.log(`🔋 Extracted Nominalkapazität: ${rawValue} → ${(product as any).nominalkapazitaet}`);
  }

  if ((selectors as any).maxEntladestrom) {
    const element = $((selectors as any).maxEntladestrom).first();
    const rawValue = element.text().trim();
    (product as any).maxEntladestrom = formatMeasurement(rawValue);
    if (rawValue) console.log(`⚡ Extracted max. Entladestrom: ${rawValue} → ${(product as any).maxEntladestrom}`);
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
  // Format: "1.5 × 1.5 × 5.1 cm" or "70×37.5×37.5 mm" or "70×37,5×37,5 mm je Zelle"
  if (!(product as any).laenge || !(product as any).breite || !(product as any).hoehe) {
    let abmessungenText = '';
    
    // First try: Use abmessungen selector if available
    if ((selectors as any).abmessungen) {
      const element = $((selectors as any).abmessungen).first();
      abmessungenText = element.text().trim();
      console.log(`🔍 Extracted Abmessungen via selector: "${abmessungenText}"`);
    }
    
    // Fallback: Search in HTML if selector didn't work
    if (!abmessungenText) {
      const abmessungenHtmlMatch = html.match(/abmessungen[:\s]+([\d.,]+)\s*[×x]\s*([\d.,]+)\s*[×x]\s*([\d.,]+)\s*(mm|cm)/i);
      if (abmessungenHtmlMatch) {
        abmessungenText = abmessungenHtmlMatch[0];
        console.log(`🔍 Extracted Abmessungen from HTML: "${abmessungenText}"`);
      }
    }
    
    // Parse the extracted text (from selector or HTML)
    const abmessungenMatch = abmessungenText.match(/([\d.,]+)\s*[×x]\s*([\d.,]+)\s*[×x]\s*([\d.,]+)\s*(mm|cm)/i);
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

  // Store raw HTML for debugging (keep full HTML for text extraction, but limit stored version)
  product.rawHtml = html.length > 50000 ? html.substring(0, 50000) : html; // Keep up to 50KB for extraction

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

  // CLEAN APPROACH: Extract raw HTML text from technical data sections, then use GPT for semantic parsing
  // Step 1: Extract raw text from technical data sections (no CSS selectors, just get the text)
  let technicalDataText = '';
  
  // PRIORITY 1: If technicalDataTable exists, extract text from it FIRST (most reliable source)
  console.log(`🔍 [Clean Approach] Checking technicalDataTable: ${product.technicalDataTable ? `EXISTS (${product.technicalDataTable.length} chars)` : 'NOT FOUND'}`);
  if (product.technicalDataTable && product.technicalDataTable.trim().length > 0) {
    try {
      const $techTable = cheerio.load(product.technicalDataTable);
      technicalDataText = $techTable.text().trim();
      console.log(`✅ [Clean Extraction] Extracted text from technicalDataTable (${technicalDataText.length} chars)`);
      console.log(`📄 [Clean Extraction] Text preview: ${technicalDataText.substring(0, 300)}...`);
    } catch (error) {
      console.error(`❌ [Clean Extraction] Error parsing technicalDataTable HTML:`, error);
      // Fallback: simple HTML tag removal
      technicalDataText = product.technicalDataTable.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`✅ [Clean Extraction] Extracted text from technicalDataTable (fallback, ${technicalDataText.length} chars)`);
    }
  } else {
    console.log(`⚠️ [Clean Approach] technicalDataTable is empty or missing, will try other sources...`);
  }
  
  // PRIORITY 2: If no text yet, try to find technical data sections by common IDs/classes
  if (!technicalDataText || technicalDataText.length < 50) {
    const technicalSections = [
      '#additional',
      '.additional',
      '.product-additional',
      '.product-data',
      '[id*="technische"]',
      '[class*="technische"]',
      '[id*="technical"]',
      '[class*="technical"]',
      'section:contains("Technische")',
      'div:contains("Technische")',
    ];
    
    for (const selector of technicalSections) {
      try {
        const section = $(selector).first();
        if (section.length > 0) {
          const text = section.text().trim();
          if (text && text.length > 50) { // Minimum length to be valid
            technicalDataText = text;
            console.log(`📄 [Clean Extraction] Found technical data text (${text.length} chars) using: ${selector}`);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  // PRIORITY 3: If still no text, try other sources
  if (!technicalDataText || technicalDataText.length < 50) {
    // Also try to extract from autoExtractedDescription if it contains technical data
    if (product.autoExtractedDescription) {
      const descText = product.autoExtractedDescription.trim();
      // Check if description contains technical keywords
      const hasTechnicalKeywords = /(spannung|kapazität|voltage|capacity|zellchemie|chemie|mah|v\s|wh\s)/i.test(descText);
      if (hasTechnicalKeywords && descText.length > 50) {
        technicalDataText = descText;
        console.log(`📄 [Clean Extraction] Using autoExtractedDescription with technical keywords (${technicalDataText.length} chars)`);
      }
    }
    
    // Last resort: extract from full HTML if nothing else found
    if (!technicalDataText || technicalDataText.length < 50) {
      // Try to find any section with technical data keywords
      const technicalKeywords = ['spannung', 'kapazität', 'zellchemie', 'nominal', 'voltage', 'capacity', 'chemistry'];
      for (const keyword of technicalKeywords) {
        try {
          const $section = $(`*:contains("${keyword}")`).first();
          if ($section.length > 0) {
            const sectionText = $section.text().trim();
            if (sectionText.length > 50) {
              technicalDataText = sectionText;
              console.log(`📄 [Clean Extraction] Found section with keyword "${keyword}" (${technicalDataText.length} chars)`);
              break;
            }
          }
        } catch (error) {
          continue;
        }
      }
    }
  }
  
  // Step 2: Use GPT to parse the raw text into structured JSON
  if (technicalDataText && technicalDataText.length > 0) {
    console.log(`🤖 [Clean Approach] Using GPT to parse technical data from raw text (${technicalDataText.length} chars)...`);
    console.log(`📄 [Clean Approach] Text preview: ${technicalDataText.substring(0, 200)}...`);
    try {
      const { parseTechnicalData } = await import('./services/parseTechnicalData');
      const structuredData = await parseTechnicalData({
        technicalDataTable: product.technicalDataTable || '', // Include HTML table if available
        autoExtractedDescription: technicalDataText,
        rawHtml: html.substring(0, 10000), // First 10KB for context
      });
      
      console.log(`📊 [GPT] Received structured data:`, structuredData);
      
      // Map GPT results to product fields
      if (structuredData.Spannung) {
        (product as any).nominalspannung = structuredData.Spannung.replace(/\s*V$/, '').trim();
        console.log(`⚡ [GPT] Extracted Spannung: ${structuredData.Spannung}`);
      }
      if (structuredData.Kapazität) {
        (product as any).nominalkapazitaet = structuredData.Kapazität.replace(/\s*mAh$/, '').trim();
        console.log(`🔋 [GPT] Extracted Kapazität: ${structuredData.Kapazität}`);
      }
      if (structuredData.Zellchemie) {
        (product as any).zellenchemie = structuredData.Zellchemie;
        console.log(`🧪 [GPT] Extracted Zellchemie: ${structuredData.Zellchemie}`);
      }
      if (structuredData.Zellengröße) {
        (product as any).zellengroesse = structuredData.Zellengröße;
        console.log(`📐 [GPT] Extracted Zellengröße: ${structuredData.Zellengröße}`);
      }
      if (structuredData.Maße) {
        // Try to parse dimensions from "Maße" field
        const dimsMatch = structuredData.Maße.match(/(\d+[,\.]?\d*)\s*[×x]\s*(\d+[,\.]?\d*)\s*[×x]\s*(\d+[,\.]?\d*)/i);
        if (dimsMatch) {
          (product as any).laenge = dimsMatch[1].replace(',', '.');
          (product as any).breite = dimsMatch[2].replace(',', '.');
          (product as any).hoehe = dimsMatch[3].replace(',', '.');
          console.log(`📏 [GPT] Extracted Maße: ${structuredData.Maße}`);
        }
      }
      if (structuredData.Gewicht) {
        (product as any).gewicht = structuredData.Gewicht.replace(/\s*g$/, '').trim();
        console.log(`⚖️ [GPT] Extracted Gewicht: ${structuredData.Gewicht}`);
      }
      if (structuredData.Artikelnummer) {
        // Keep original article number format
        product.manufacturerArticleNumber = structuredData.Artikelnummer;
        console.log(`📦 [GPT] Extracted Artikelnummer: ${structuredData.Artikelnummer}`);
      }
      if (structuredData.EAN) {
        product.ean = structuredData.EAN;
        console.log(`📦 [GPT] Extracted EAN: ${structuredData.EAN}`);
      }
      if (structuredData.Verpackungseinheit) {
        (product as any).verpackungseinheit = structuredData.Verpackungseinheit;
        console.log(`📦 [GPT] Extracted Verpackungseinheit: ${structuredData.Verpackungseinheit}`);
      }
      
      // Also check for alternative field names that GPT might return
      if (!structuredData.Spannung && (structuredData as any)['Nominal-Spannung']) {
        (product as any).nominalspannung = (structuredData as any)['Nominal-Spannung'].replace(/\s*V$/, '').trim();
        console.log(`⚡ [GPT] Extracted Nominal-Spannung: ${(structuredData as any)['Nominal-Spannung']}`);
      }
      if (!structuredData.Kapazität && (structuredData as any)['Nominal-Kapazität']) {
        (product as any).nominalkapazitaet = (structuredData as any)['Nominal-Kapazität'].replace(/\s*mAh$/, '').trim();
        console.log(`🔋 [GPT] Extracted Nominal-Kapazität: ${(structuredData as any)['Nominal-Kapazität']}`);
      }
      if (!structuredData.Zellchemie && (structuredData as any)['Zellenchemie']) {
        (product as any).zellenchemie = (structuredData as any)['Zellenchemie'];
        console.log(`🧪 [GPT] Extracted Zellenchemie: ${(structuredData as any)['Zellenchemie']}`);
      }
    } catch (error) {
      console.error('❌ [GPT] Error parsing technical data:', error);
      console.log('⚠️ [GPT] Falling back to CSS selectors for technical data...');
      // Continue without GPT parsing if it fails - CSS selectors will be used as fallback
    }
  } else {
    console.log('⚠️ [Clean Approach] No technical data text found to parse, using CSS selectors...');
  }
  
  // FALLBACK: Use CSS selectors if GPT didn't extract data or if GPT is not available
  // This ensures we still get technical data even if GPT fails
  if (!(product as any).nominalspannung && (selectors as any).nominalspannung) {
    const element = $((selectors as any).nominalspannung).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).nominalspannung = formatMeasurement(rawValue);
      console.log(`⚡ [CSS Fallback] Extracted Nominalspannung: ${rawValue} → ${(product as any).nominalspannung}`);
    }
  }
  
  if (!(product as any).nominalkapazitaet && (selectors as any).nominalkapazitaet) {
    const element = $((selectors as any).nominalkapazitaet).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).nominalkapazitaet = formatMeasurement(rawValue);
      console.log(`🔋 [CSS Fallback] Extracted Nominalkapazität: ${rawValue} → ${(product as any).nominalkapazitaet}`);
    }
  }
  
  if (!(product as any).zellenchemie && (selectors as any).zellenchemie) {
    const element = $((selectors as any).zellenchemie).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).zellenchemie = rawValue;
      console.log(`🧪 [CSS Fallback] Extracted Zellenchemie: ${rawValue}`);
    }
  }
  
  if (!(product as any).laenge && (selectors as any).laenge) {
    const element = $((selectors as any).laenge).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).laenge = formatMeasurement(rawValue);
      console.log(`📏 [CSS Fallback] Extracted Länge: ${rawValue} → ${(product as any).laenge}`);
    }
  }
  
  if (!(product as any).breite && (selectors as any).breite) {
    const element = $((selectors as any).breite).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).breite = formatMeasurement(rawValue);
      console.log(`📏 [CSS Fallback] Extracted Breite: ${rawValue} → ${(product as any).breite}`);
    }
  }
  
  if (!(product as any).hoehe && (selectors as any).hoehe) {
    const element = $((selectors as any).hoehe).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).hoehe = formatMeasurement(rawValue);
      console.log(`📏 [CSS Fallback] Extracted Höhe: ${rawValue} → ${(product as any).hoehe}`);
    }
  }
  
  if (!(product as any).gewicht && (selectors as any).gewicht) {
    const element = $((selectors as any).gewicht).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).gewicht = formatMeasurement(rawValue);
      console.log(`⚖️ [CSS Fallback] Extracted Gewicht: ${rawValue} → ${(product as any).gewicht}`);
    }
  }
  
  if (!(product as any).energie && (selectors as any).energie) {
    const element = $((selectors as any).energie).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).energie = formatMeasurement(rawValue);
      console.log(`⚡ [CSS Fallback] Extracted Energie: ${rawValue} → ${(product as any).energie}`);
    }
  }
  
  if (!(product as any).farbe && (selectors as any).farbe) {
    const element = $((selectors as any).farbe).first();
    const rawValue = element.text().trim();
    if (rawValue) {
      (product as any).farbe = rawValue;
      console.log(`🎨 [CSS Fallback] Extracted Farbe: ${rawValue}`);
    }
  }
  
  // DEBUG: Log final technical data fields
  console.log('📊 [Final Product] Technical data fields:', {
    nominalspannung: (product as any).nominalspannung || 'EMPTY',
    nominalkapazitaet: (product as any).nominalkapazitaet || 'EMPTY',
    zellenchemie: (product as any).zellenchemie || 'EMPTY',
    zellengroesse: (product as any).zellengroesse || 'EMPTY',
    laenge: (product as any).laenge || 'EMPTY',
    breite: (product as any).breite || 'EMPTY',
    hoehe: (product as any).hoehe || 'EMPTY',
    gewicht: (product as any).gewicht || 'EMPTY',
    energie: (product as any).energie || 'EMPTY',
  });

  // BUILD COMPLETE HTML TABLE from parsed data (if we have parsed data but no complete table)
  // Check if we have parsed technical data that should be in a table
  const hasParsedData = product.length || product.bodyDiameter || (product as any).nominalspannung || (product as any).nominalkapazitaet;
  const hasTable = product.technicalDataTable && product.technicalDataTable.trim().length > 0;
  
  if (hasParsedData && (!hasTable || product.technicalDataTable.length < 200)) {
    // The extracted table is incomplete or missing, rebuild from parsed data
    const fullTableRows: string[] = [];
    
    // ANSMANN Technical Specifications
    if ((product as any).nominalspannung) fullTableRows.push(`<tr><td>Nominalspannung</td><td>${(product as any).nominalspannung}</td></tr>`);
    if ((product as any).nominalkapazitaet) fullTableRows.push(`<tr><td>Nominalkapazität</td><td>${(product as any).nominalkapazitaet}</td></tr>`);
    if ((product as any).maxEntladestrom) fullTableRows.push(`<tr><td>max. Entladestrom</td><td>${(product as any).maxEntladestrom}</td></tr>`);
    if ((product as any).zellenchemie) fullTableRows.push(`<tr><td>Zellchemie</td><td>${(product as any).zellenchemie}</td></tr>`);
    if ((product as any).energie) fullTableRows.push(`<tr><td>Energie</td><td>${(product as any).energie}</td></tr>`);
    if ((product as any).laenge) fullTableRows.push(`<tr><td>Länge (mm)</td><td>${(product as any).laenge}</td></tr>`);
    if ((product as any).breite) fullTableRows.push(`<tr><td>Breite (mm)</td><td>${(product as any).breite}</td></tr>`);
    if ((product as any).hoehe) fullTableRows.push(`<tr><td>Höhe (mm)</td><td>${(product as any).hoehe}</td></tr>`);
    if ((product as any).gewicht) fullTableRows.push(`<tr><td>Gewicht (g)</td><td>${(product as any).gewicht}</td></tr>`);
    if ((product as any).farbe) fullTableRows.push(`<tr><td>Farbe</td><td>${(product as any).farbe}</td></tr>`);
    
    // Nitecore Technical Fields (for compatibility)
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

  // Calculate VK Price from EK Price: (EK × 2) + 19% = EK × 2.38, always ending in ,95
  // Format: German format with comma (e.g., 11,95)
  if (product.ekPrice) {
    const ekValue = parseFloat(product.ekPrice.replace(',', '.'));
    if (!isNaN(ekValue)) {
      const vkCalculated = ekValue * 2 * 1.19;
      // Round to ,95 ending (e.g., 11.90 → 11,95)
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
      // Round to ,95 ending (e.g., 11.90 → 11,95)
      const vkRounded = Math.floor(vkCalculated) + 0.95;
      product.vkPrice = vkRounded.toFixed(2).replace('.', ',');  // German format
      console.log(`💰 Calculated VK Price from price field: EK ${product.ekPrice}€ → VK ${product.vkPrice}€ (calculated: ${vkCalculated.toFixed(2).replace('.', ',')})`);
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`[SCRAPER] Scraping complete for ${url} (${totalDuration}ms):`, {
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
    '#additional', // ANSMANN: Magento "Zusatzinformation" tab containing technical data table (PRIORITY 1)
    '.additional-attributes-wrapper', // ANSMANN: Wrapper for technical attributes (PRIORITY 2)
    'table.data.table.additional-attributes', // ANSMANN: Technical data table directly
    '#product-attribute-specs-table', // ANSMANN: Product attribute specs table ID
    '.data.table.additional-attributes', // ANSMANN: Alternative class combination
    '#technical-data-516d15ca626445a38719925615405a64-pane', // Nitecore specific tab pane (FULL CONTENT)
    '[id$="-pane"][id*="technical"]', // Match IDs ending with -pane (NOT tab buttons)
    '.tab-pane[id*="technical"]', // Tab pane with class
    '.tab-pane[id*="technische-daten"]', // German technical data pane
    '[id*="technische-details"]', // "Technische Details" section
    '[class*="technische-details"]', // "Technische Details" section by class
    'section:contains("Technische Details")', // Section containing "Technische Details"
    'div:contains("Technische Details")', // Div containing "Technische Details"
    '[id*="additional"]', // Any ID containing "additional"
    '[class*="additional"]', // Any class containing "additional"
  ];

  // Try to get the COMPLETE tab pane first (all DIVs and tables)
  for (const selector of technicalDataPaneSelectors) {
    try {
      const pane = $(selector).first();
      if (pane.length > 0) {
        const content = pane.html();
        console.log(`🔍 [AutoExtract] Checking selector: ${selector} - Found: ${pane.length}, Content length: ${content?.length || 0}`);
        // Make sure we got actual content, not just a tab button (should have table or multiple divs)
        if (content && content.length > 200 && (content.includes('<table') || content.includes('properties-row') || content.includes('additional-attributes'))) {
          result.technicalDataTable = content; // Use raw HTML without wrapper div
          console.log(`✅ [AutoExtract] Auto-extracted FULL technical data pane using: ${selector} (${content.length} chars)`);
          break;
        } else if (content && content.length > 200) {
          console.log(`⚠️ [AutoExtract] Found content but no table/properties-row (${content.length} chars), checking for table inside...`);
          // Check if there's a table inside this element
          const innerTable = pane.find('table').first();
          if (innerTable.length > 0) {
            result.technicalDataTable = innerTable.toString();
            console.log(`✅ [AutoExtract] Found table inside ${selector} (${innerTable.find('tr').length} rows)`);
            break;
          }
          // Also check for div-based structures (ANSMANN uses divs with data-th attributes)
          const divsWithDataTh = pane.find('[data-th]');
          if (divsWithDataTh.length >= 3) {
            result.technicalDataTable = pane.html() || '';
            console.log(`✅ [AutoExtract] Found div-based structure with ${divsWithDataTh.length} data-th attributes`);
            break;
          }
        }
      }
    } catch (error) {
      console.error(`❌ [AutoExtract] Error checking selector ${selector}:`, error);
      continue;
    }
  }

  // Fallback: Try individual table selectors
  if (!result.technicalDataTable) {
    const tableSelectors = [
      '#product-attribute-specs-table', // ANSMANN: Product attribute specs table ID (PRIORITY)
      'table.data.table.additional-attributes', // ANSMANN: Technical data table class
      'table.additional-attributes', // ANSMANN: Simplified table class
      '.additional-attributes table', // ANSMANN: Table inside additional attributes wrapper
      '#additional table', // ANSMANN: Table inside #additional
      '.tab-content table',
      'table.product-detail-properties-table',
      'table.table-striped',
      'table[border="0"]',
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
function parsePropertiesTable($: cheerio.CheerioAPI, product: any): boolean {
  let foundData = false;

  // METHOD 1: Parse DIV-based technical data (Nitecore "Technische Daten" tab, ANSMANN, etc.)
  // Try multiple container selectors for different website structures
  // ANSMANN uses #additional for technical data
  const technicalDataContainer = $('.product-detail-technical-data, #lds-technical-data-tab-pane, #additional, .technical-data, .product-specifications, .specifications, [class*="technical"], [class*="specification"], [id*="additional"], [id*="technische-details"], [class*="technische-details"], section:contains("Technische Details"), div:contains("Technische Details")');
  if (technicalDataContainer.length > 0) {
    console.log(`Found DIV-based technical data structure (${technicalDataContainer.length} containers), parsing...`);
    
    // Try multiple label/value selector patterns
    const labelSelectors = [
      '.product-detail-technical-data-label',
      '.technical-data-label',
      '.spec-label',
      '.specification-label',
      '.properties-row .label', // ANSMANN: properties-row structure
      '.data-table .label', // ANSMANN: data-table structure
      '[class*="label"]',
      'dt', // Definition term
      'th', // Table header
      'strong', // Bold text (often used as labels)
    ];
    
    const valueSelectors = [
      '.product-detail-technical-data-value',
      '.technical-data-value',
      '.spec-value',
      '.specification-value',
      '.properties-row .data', // ANSMANN: properties-row structure
      '.data-table .data', // ANSMANN: data-table structure
      '[class*="value"]',
      '[class*="data"]', // ANSMANN might use .data class
      'dd', // Definition description
      'td', // Table data
    ];
    
    // Try each label selector pattern
    for (const labelSelector of labelSelectors) {
      technicalDataContainer.find(labelSelector).each((_, labelEl) => {
        const $label = $(labelEl);
        const label = $label.text().trim().toLowerCase();
        
        // Try to find value using different methods
        let value = '';
        
        // ANSMANN: Check if label is inside a .properties-row structure
        const $parentRow = $label.closest('.properties-row, .data-table');
        if ($parentRow.length > 0) {
          // Try to find value in the same row
          const $valueInRow = $parentRow.find('.data, .value, td').not($label);
          if ($valueInRow.length > 0) {
            value = $valueInRow.first().text().trim();
          }
        }
        
        // If not found in row, try next sibling
        if (!value) {
          for (const valueSelector of valueSelectors) {
            const $value = $label.next(valueSelector);
            if ($value.length > 0) {
              value = $value.text().trim();
              break;
            }
          }
        }
        
        // Fallback: try next sibling if no value found
        if (!value) {
          const $next = $label.next();
          if ($next.length > 0 && !$next.is(labelSelector)) {
            value = $next.text().trim();
          }
        }
        
        // ANSMANN: Also try parent's next sibling (for nested structures)
        if (!value) {
          const $parent = $label.parent();
          if ($parent.length > 0) {
            const $parentNext = $parent.next();
            if ($parentNext.length > 0) {
              value = $parentNext.text().trim();
          }
        }
        }

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
        // ANSMANN Technical Specifications
        // Handle both "Nominalspannung" and "Nominal-Spannung" (with hyphen)
        else if (label.includes('nominalspannung') || label.includes('nominal-spannung') || label.includes('nominal spannung') || label.includes('spannung') || (label.includes('voltage') && !label.includes('input'))) {
          (product as any).nominalspannung = formatMeasurement(value);
          console.log(`⚡ Extracted Nominalspannung from DIV table: ${value} → ${(product as any).nominalspannung}`);
        } else if (label.includes('nominalkapazität') || label.includes('nominal-kapazität') || label.includes('nominal kapazität') || label.includes('kapazität') || label.includes('capacity') || (label.includes('mah') && !label.includes('max'))) {
          (product as any).nominalkapazitaet = formatMeasurement(value);
          console.log(`🔋 Extracted Nominalkapazität from DIV table: ${value} → ${(product as any).nominalkapazitaet}`);
        } else if (label.includes('entladestrom') || label.includes('discharge current') || label.includes('max. entladestrom') || label.includes('max entladestrom')) {
          (product as any).maxEntladestrom = formatMeasurement(value);
          console.log(`⚡ Extracted max. Entladestrom from DIV table: ${value} → ${(product as any).maxEntladestrom}`);
        } else if (label.includes('zellenchemie') || label.includes('cell chemistry') || label.includes('chemie')) {
          (product as any).zellenchemie = value;
        } else if (label.includes('energie') && (label.includes('wh') || label.includes('wattstunden'))) {
          (product as any).energie = formatMeasurement(value);
        } else if (label.includes('farbe') || label.includes('color') || label.includes('colour')) {
          (product as any).farbe = value;
        } else if (label.includes('länge') && !label.includes('leucht') && !product.length) {
          (product as any).laenge = formatMeasurement(value);
        } else if ((label.includes('breite') || label.includes('width')) && !(product as any).breite) {
          (product as any).breite = formatMeasurement(value);
        } else if ((label.includes('höhe') || label.includes('height')) && !(product as any).hoehe) {
          (product as any).hoehe = formatMeasurement(value);
        } else if (label.includes('gewicht') && !label.includes('ohne') && !label.includes('without') && !(product as any).gewicht) {
          (product as any).gewicht = formatMeasurement(value);
        }
        // EAN extraction from table
        else if ((label.includes('ean') || label.includes('barcode') || label.includes('gtin')) && !product.ean) {
          // Extract 13-digit number from value
          const eanMatch = value.match(/\d{13}/);
          if (eanMatch) {
            product.ean = eanMatch[0];
            console.log(`📦 Extracted EAN from DIV table: ${product.ean}`);
          } else if (value.trim().length === 13 && /^\d+$/.test(value.trim())) {
            product.ean = value.trim();
            console.log(`📦 Extracted EAN from DIV table (direct): ${product.ean}`);
          }
        }
      });
    }
  }

  // METHOD 2: Parse TABLE-based properties (fallback)
  // Also check inside #additional for ANSMANN
  if (!foundData) {
    // Try multiple table selectors, including ANSMANN's structure
    const tableSelectors = [
      '.product-detail-properties-table',
      'table.table-striped',
      '.properties-table',
      '#additional table',
      'table.data.table.additional-attributes', // ANSMANN specific
      '.additional-attributes table',
      'table[class*="data"]',
      'table[class*="attributes"]',
      'table', // Last resort: any table
    ];
    
    let table = $();
    for (const selector of tableSelectors) {
      table = $(selector).first();
      if (table.length > 0) {
        console.log(`Found TABLE-based properties using selector: ${selector}`);
        break;
      }
    }
    
    if (table.length > 0) {
      console.log('Found TABLE-based properties, parsing...');
      
      table.find('tr').each((_, row) => {
        const $row = $(row);
        // Try multiple label/value patterns for ANSMANN
        let label = $row.find('th, .properties-label, .label, strong').first().text().trim().toLowerCase();
        let value = $row.find('td, .properties-value, .value').first().text().trim();
        
        // ANSMANN might use different structures - try alternative patterns
        if (!label || !value) {
          // Try: <td>Label</td><td>Value</td> structure
          const cells = $row.find('td');
          if (cells.length >= 2) {
            label = cells.eq(0).text().trim().toLowerCase();
            value = cells.eq(1).text().trim();
          }
        }
        
        // Try: <th>Label</th><td>Value</td> structure
        if (!label || !value) {
          const th = $row.find('th').first();
          const td = $row.find('td').first();
          if (th.length > 0 && td.length > 0) {
            label = th.text().trim().toLowerCase();
            value = td.text().trim();
          }
        }
        
        // Try: Extract from entire row text if no structured cells found
        if (!label || !value) {
          const rowText = $row.text().trim();
          const colonIndex = rowText.indexOf(':');
          if (colonIndex > 0) {
            label = rowText.substring(0, colonIndex).trim().toLowerCase();
            value = rowText.substring(colonIndex + 1).trim();
          } else {
            // Try splitting by whitespace if no colon
            const parts = rowText.split(/\s{2,}/).filter(p => p.trim().length > 0);
            if (parts.length >= 2) {
              label = parts[0].trim().toLowerCase();
              value = parts.slice(1).join(' ').trim();
            }
          }
        }

        if (!label || !value) return;
        
        foundData = true;

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
        // ANSMANN Technical Specifications
        // Handle both "Nominalspannung" and "Nominal-Spannung" (with hyphen)
        else if (label.includes('nominalspannung') || label.includes('nominal-spannung') || label.includes('nominal spannung') || label.includes('spannung') || (label.includes('voltage') && !label.includes('input'))) {
          (product as any).nominalspannung = formatMeasurement(value);
          console.log(`⚡ Extracted Nominalspannung from TABLE: ${value} → ${(product as any).nominalspannung}`);
        } else if (label.includes('nominalkapazität') || label.includes('nominal-kapazität') || label.includes('nominal kapazität') || label.includes('kapazität') || label.includes('capacity') || (label.includes('mah') && !label.includes('max'))) {
          (product as any).nominalkapazitaet = formatMeasurement(value);
          console.log(`🔋 Extracted Nominalkapazität from TABLE: ${value} → ${(product as any).nominalkapazitaet}`);
        } else if (label.includes('entladestrom') || label.includes('discharge current') || label.includes('max. entladestrom') || label.includes('max entladestrom')) {
          (product as any).maxEntladestrom = formatMeasurement(value);
          console.log(`⚡ Extracted max. Entladestrom from TABLE: ${value} → ${(product as any).maxEntladestrom}`);
        } else if (label.includes('zellenchemie') || label.includes('cell chemistry') || label.includes('chemie')) {
          (product as any).zellenchemie = value;
        } else if (label.includes('energie') && (label.includes('wh') || label.includes('wattstunden'))) {
          (product as any).energie = formatMeasurement(value);
        } else if (label.includes('farbe') || label.includes('color') || label.includes('colour')) {
          (product as any).farbe = value;
        } else if (label.includes('länge') && !label.includes('leucht') && !product.length && !(product as any).laenge) {
          (product as any).laenge = formatMeasurement(value);
        } else if ((label.includes('breite') || label.includes('width')) && !(product as any).breite) {
          (product as any).breite = formatMeasurement(value);
        } else if ((label.includes('höhe') || label.includes('height')) && !(product as any).hoehe) {
          (product as any).hoehe = formatMeasurement(value);
        } else if (label.includes('gewicht') && !label.includes('ohne') && !label.includes('without') && !(product as any).gewicht) {
          (product as any).gewicht = formatMeasurement(value);
        }
        // EAN extraction from table
        else if ((label.includes('ean') || label.includes('barcode') || label.includes('gtin')) && !product.ean) {
          // Extract 13-digit number from value
          const eanMatch = value.match(/\d{13}/);
          if (eanMatch) {
            product.ean = eanMatch[0];
            console.log(`📦 Extracted EAN from TABLE: ${product.ean}`);
          } else if (value.trim().length === 13 && /^\d+$/.test(value.trim())) {
            product.ean = value.trim();
            console.log(`📦 Extracted EAN from TABLE (direct): ${product.ean}`);
          }
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
    maxBeamDistance: product.maxBeamDistance,
    // ANSMANN fields
    nominalspannung: (product as any).nominalspannung,
    nominalkapazitaet: (product as any).nominalkapazitaet,
    maxEntladestrom: (product as any).maxEntladestrom,
    laenge: (product as any).laenge,
    breite: (product as any).breite,
    hoehe: (product as any).hoehe,
    gewicht: (product as any).gewicht,
    zellenchemie: (product as any).zellenchemie,
    energie: (product as any).energie,
    farbe: (product as any).farbe
  });
  
  return foundData;
}

/**
 * AGGRESSIVE PARSER: Parse technical data from any table structure
 * This is a fallback when normal parsing fails
 */
function parseTechnicalDataAggressively($: cheerio.CheerioAPI, product: any): void {
  console.log('🔍 [Aggressive Parser] Starting aggressive parsing of technical data...');
  
  // Try to find ALL table rows in the HTML
  const allRows = $('tr, .properties-row, .data-table tr, [class*="row"]');
  console.log(`🔍 [Aggressive Parser] Found ${allRows.length} potential rows to parse`);
  
  allRows.each((_, row) => {
    const $row = $(row);
    const rowText = $row.text().trim();
    
    // Skip empty rows
    if (!rowText || rowText.length < 3) return;
    
    // Try to extract label and value from row text
    // Pattern: "Label: Value" or "Label Value" or just text that might contain keywords
    const parts = rowText.split(/[:\n]/).map(p => p.trim()).filter(p => p.length > 0);
    
    if (parts.length >= 2) {
      const label = parts[0].toLowerCase();
      const value = parts.slice(1).join(' ').trim();
      
      // Map labels to product fields
      if (label.includes('nominalspannung') || label.includes('spannung') || (label.includes('voltage') && !label.includes('input'))) {
        if (!(product as any).nominalspannung) {
          (product as any).nominalspannung = formatMeasurement(value);
          console.log(`⚡ [Aggressive] Extracted Nominalspannung: ${value} → ${(product as any).nominalspannung}`);
        }
      } else if (label.includes('nominalkapazität') || label.includes('kapazität') || label.includes('capacity') || (label.includes('mah') && !label.includes('max'))) {
        if (!(product as any).nominalkapazitaet) {
          (product as any).nominalkapazitaet = formatMeasurement(value);
          console.log(`🔋 [Aggressive] Extracted Nominalkapazität: ${value} → ${(product as any).nominalkapazitaet}`);
        }
      } else if (label.includes('entladestrom') || label.includes('discharge current') || label.includes('max. entladestrom') || label.includes('max entladestrom')) {
        if (!(product as any).maxEntladestrom) {
          (product as any).maxEntladestrom = formatMeasurement(value);
          console.log(`⚡ [Aggressive] Extracted max. Entladestrom: ${value} → ${(product as any).maxEntladestrom}`);
        }
      } else if (label.includes('zellenchemie') || label.includes('cell chemistry') || label.includes('chemie')) {
        if (!(product as any).zellenchemie) {
          (product as any).zellenchemie = value;
          console.log(`🧪 [Aggressive] Extracted Zellenchemie: ${value}`);
        }
      } else if (label.includes('energie') && (label.includes('wh') || label.includes('wattstunden'))) {
        if (!(product as any).energie) {
          (product as any).energie = formatMeasurement(value);
          console.log(`⚡ [Aggressive] Extracted Energie: ${value} → ${(product as any).energie}`);
        }
      } else if (label.includes('farbe') || label.includes('color') || label.includes('colour')) {
        if (!(product as any).farbe) {
          (product as any).farbe = value;
          console.log(`🎨 [Aggressive] Extracted Farbe: ${value}`);
        }
      } else if (label.includes('länge') && !label.includes('leucht')) {
        if (!(product as any).laenge && !product.length) {
          (product as any).laenge = formatMeasurement(value);
          console.log(`📏 [Aggressive] Extracted Länge: ${value} → ${(product as any).laenge}`);
        }
      } else if (label.includes('breite') || label.includes('width')) {
        if (!(product as any).breite) {
          (product as any).breite = formatMeasurement(value);
          console.log(`📏 [Aggressive] Extracted Breite: ${value} → ${(product as any).breite}`);
        }
      } else if (label.includes('höhe') || label.includes('height')) {
        if (!(product as any).hoehe) {
          (product as any).hoehe = formatMeasurement(value);
          console.log(`📏 [Aggressive] Extracted Höhe: ${value} → ${(product as any).hoehe}`);
        }
      } else if (label.includes('gewicht') && !label.includes('ohne') && !label.includes('without')) {
        if (!(product as any).gewicht && !product.weight) {
          (product as any).gewicht = formatMeasurement(value);
          console.log(`⚖️ [Aggressive] Extracted Gewicht: ${value} → ${(product as any).gewicht}`);
        }
      }
    } else {
      // Try to find keywords in the entire row text
      const lowerText = rowText.toLowerCase();
      
      // Look for patterns like "3.7V" or "1100mAh" directly in the text
      if (lowerText.includes('nominalspannung') || lowerText.includes('spannung')) {
        const voltageMatch = rowText.match(/(\d+[,\.]\d+)\s*v/i) || rowText.match(/(\d+)\s*v/i);
        if (voltageMatch && !(product as any).nominalspannung) {
          (product as any).nominalspannung = formatMeasurement(voltageMatch[1]);
          console.log(`⚡ [Aggressive] Extracted Nominalspannung from text: ${voltageMatch[1]} → ${(product as any).nominalspannung}`);
        }
      }
      
      if (lowerText.includes('nominalkapazität') || lowerText.includes('kapazität') || lowerText.includes('capacity') || lowerText.includes('mah')) {
        const capacityMatch = rowText.match(/(\d+)\s*mah/i) || rowText.match(/(\d+)\s*m\s*ah/i);
        if (capacityMatch && !(product as any).nominalkapazitaet) {
          (product as any).nominalkapazitaet = formatMeasurement(capacityMatch[1]);
          console.log(`🔋 [Aggressive] Extracted Nominalkapazität from text: ${capacityMatch[1]} → ${(product as any).nominalkapazitaet}`);
        }
      }
    }
  });
  
  console.log('🔍 [Aggressive Parser] Finished aggressive parsing');
}

/**
 * Extrahiert technische Daten aus Text-Quellen (autoExtractedDescription, rawHtml, description, fullHtml)
 * und erstellt eine HTML-Tabelle daraus
 */
function extractTechnicalDataFromText(product: any, fullHtml?: string, description?: string): string | null {
  const textSources: string[] = [];
  
  // Sammle alle verfügbaren Text-Quellen (Priorität: fullHtml > rawHtml > description > autoExtractedDescription)
  
  // 1. Use full HTML if provided (most complete source)
  if (fullHtml) {
    try {
      const $ = cheerio.load(fullHtml);
      const text = $.text();
      if (text && text.trim().length > 0) {
        textSources.push(text);
        console.log(`📄 [Text Extraction] Using full HTML (${text.length} chars)`);
      }
    } catch (error) {
      // Fallback: Einfache HTML-Tag-Entfernung
      const text = fullHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        textSources.push(text);
        console.log(`📄 [Text Extraction] Using full HTML (fallback, ${text.length} chars)`);
      }
    }
  }
  
  // 2. Use stored rawHtml if fullHtml not available
  if (textSources.length === 0 && product.rawHtml) {
    try {
      const $ = cheerio.load(product.rawHtml);
      const text = $.text();
      if (text && text.trim().length > 0) {
        textSources.push(text);
        console.log(`📄 [Text Extraction] Using rawHtml (${text.length} chars)`);
      }
    } catch (error) {
      // Fallback: Einfache HTML-Tag-Entfernung
      const text = product.rawHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        textSources.push(text);
        console.log(`📄 [Text Extraction] Using rawHtml (fallback, ${text.length} chars)`);
      }
    }
  }
  
  // 3. Add description if available
  if (description && description.trim().length > 0) {
    textSources.push(description);
    console.log(`📄 [Text Extraction] Added description (${description.length} chars)`);
  }
  
  // 4. Add autoExtractedDescription if available
  if (product.autoExtractedDescription && product.autoExtractedDescription.trim().length > 0) {
    textSources.push(product.autoExtractedDescription);
    console.log(`📄 [Text Extraction] Added autoExtractedDescription (${product.autoExtractedDescription.length} chars)`);
  }
  
  if (textSources.length === 0) {
    return null;
  }
  
  const combinedText = textSources.join(' ');
  const extractedData: Array<{ label: string; value: string }> = [];
  
  // Muster für technische Daten erkennen
  const patterns = [
    // Kapazität: "Kapazität: 2850 mAh" oder "2850 mAh" oder "Capacity: 2850 mAh"
    {
      regex: /(?:kapazität|capacity|nominalkapazität)[:\s]*(\d+)\s*mah/gi,
      label: 'Kapazität',
      format: (match: string) => `${match} mAh`
    },
    // Spannung: "Spannung: 1.2 V" oder "1.2 V" oder "Voltage: 1.2 V"
    {
      regex: /(?:spannung|voltage|nominalspannung)[:\s]*(\d+[,\.]?\d*)\s*v/gi,
      label: 'Spannung',
      format: (match: string) => `${match.replace(',', '.')} V`
    },
    // Zellchemie: "Chemie: NiMH" oder "Zellchemie: NiMH" oder "Chemistry: NiMH"
    {
      regex: /(?:zellenchemie|chemie|chemistry|cell\s+chemistry)[:\s]*([a-z-]+)/gi,
      label: 'Zellchemie',
      format: (match: string) => {
        const normalized = match.toUpperCase();
        const mapping: Record<string, string> = {
          'NIMH': 'NiMH',
          'LI-ION': 'Li-Ion',
          'LIFEPO4': 'LiFePO4',
          'LI-POLY': 'Li-Poly',
          'NICD': 'NiCd',
        };
        return mapping[normalized] || normalized;
      }
    },
    // Entladestrom: "Entladestrom: 5 A" oder "Discharge current: 5 A"
    {
      regex: /(?:entladestrom|discharge\s+current|max\.?\s*entladestrom)[:\s]*(\d+[,\.]?\d*)\s*a/gi,
      label: 'max. Entladestrom',
      format: (match: string) => `${match.replace(',', '.')} A`
    },
    // Energie: "Energie: 10.5 Wh" oder "Energy: 10.5 Wh"
    {
      regex: /(?:energie|energy)[:\s]*(\d+[,\.]?\d*)\s*wh/gi,
      label: 'Energie',
      format: (match: string) => `${match.replace(',', '.')} Wh`
    },
    // Länge: "Länge: 50 mm" oder "Length: 50 mm"
    {
      regex: /(?:länge|length)[:\s]*(\d+[,\.]?\d*)\s*mm/gi,
      label: 'Länge',
      format: (match: string) => `${match.replace(',', '.')} mm`
    },
    // Breite: "Breite: 30 mm" oder "Width: 30 mm"
    {
      regex: /(?:breite|width)[:\s]*(\d+[,\.]?\d*)\s*mm/gi,
      label: 'Breite',
      format: (match: string) => `${match.replace(',', '.')} mm`
    },
    // Höhe: "Höhe: 20 mm" oder "Height: 20 mm"
    {
      regex: /(?:höhe|height)[:\s]*(\d+[,\.]?\d*)\s*mm/gi,
      label: 'Höhe',
      format: (match: string) => `${match.replace(',', '.')} mm`
    },
    // Gewicht: "Gewicht: 25 g" oder "Weight: 25 g"
    {
      regex: /(?:gewicht|weight)[:\s]*(\d+[,\.]?\d*)\s*g/gi,
      label: 'Gewicht',
      format: (match: string) => `${match.replace(',', '.')} g`
    },
  ];
  
  // Extrahiere Daten mit allen Mustern
  for (const pattern of patterns) {
    const matches = combinedText.match(pattern.regex);
    if (matches && matches.length > 0) {
      // Nimm den ersten Match und extrahiere den Wert
      const match = matches[0];
      const valueMatch = match.match(/(\d+[,\.]?\d*|[a-z-]+)/i);
      if (valueMatch) {
        const value = pattern.format(valueMatch[1]);
        extractedData.push({ label: pattern.label, value });
        console.log(`📋 [Text Extraction] Gefunden: ${pattern.label} = ${value}`);
      }
    }
  }
  
  // Wenn Daten gefunden wurden, erstelle HTML-Tabelle
  if (extractedData.length > 0) {
    const tableRows = extractedData.map(item => 
      `<tr><td>${item.label}</td><td>${item.value}</td></tr>`
    ).join('\n');
    
    const htmlTable = `<table border="0" summary="">\n<tbody>\n${tableRows}\n</tbody>\n</table>`;
    
    // Schreibe auch in die Produktfelder
    for (const item of extractedData) {
      const fieldMap: Record<string, string> = {
        'Kapazität': 'nominalkapazitaet',
        'Spannung': 'nominalspannung',
        'Zellchemie': 'zellenchemie',
        'max. Entladestrom': 'maxEntladestrom',
        'Energie': 'energie',
        'Länge': 'laenge',
        'Breite': 'breite',
        'Höhe': 'hoehe',
        'Gewicht': 'gewicht',
      };
      
      const fieldName = fieldMap[item.label];
      if (fieldName && !(product as any)[fieldName]) {
        // Entferne Einheiten für interne Speicherung
        const valueWithoutUnit = item.value.replace(/\s*(mAh|V|A|Wh|mm|g)$/i, '').trim();
        (product as any)[fieldName] = valueWithoutUnit;
        console.log(`📝 [Text Extraction] Geschrieben in ${fieldName}: ${valueWithoutUnit}`);
      }
    }
    
    return htmlTable;
  }
  
  return null;
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
 * Call PHP scraper for category/list scraping
 */
async function callPhpCategoryScraper(
  phpScriptPath: string,
  categoryUrl: string,
  startPage: number,
  maxPages: number,
  cookies?: string,
  userAgent?: string
): Promise<string[]> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const path = await import('path');
  const fs = await import('fs');

  const scriptPath = path.resolve(phpScriptPath);
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`PHP category scraper script not found: ${scriptPath}`);
  }

  const args = [
    categoryUrl,
    startPage.toString(),
    maxPages.toString(),
    cookies || '',
    userAgent || ''
  ];

  const escapedArgs = args.map(arg => {
    return `"${arg.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
  }).join(' ');

  const command = `php "${scriptPath}" ${escapedArgs}`;
  console.log(`[PHP-CATEGORY-SCRAPER] Calling: ${command.substring(0, 200)}...`);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5 minutes timeout for category scraping
      maxBuffer: 10 * 1024 * 1024
    });

    if (stderr && !stderr.includes('Warning') && !stderr.includes('Notice')) {
      console.warn(`[PHP-CATEGORY-SCRAPER] PHP stderr: ${stderr}`);
    }

    const result = JSON.parse(stdout.trim());
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    console.log(`[PHP-CATEGORY-SCRAPER] Found ${result.count || result.productUrls?.length || 0} product URLs`);
    return result.productUrls || [];
  } catch (error: any) {
    console.error(`[PHP-CATEGORY-SCRAPER] Error executing PHP script:`, error);
    throw new Error(`PHP category scraper failed: ${error.message}`);
  }
}

/**
 * Scrape multiple products from a listing page (single page only)
 * Returns: Array of product URLs
 * 
 * Used for:
 * - Single category/list page scraping
 * - Getting product URLs from one page
 * 
 * Can use PHP scraper if supplierId is provided and PHP scraper exists
 */
export async function scrapeProductList(
  url: string,
  productLinkSelector: string | null,
  maxProducts: number = 50,
  options?: Partial<ScrapeOptions>
): Promise<string[]> {
  console.log(`[SCRAPE-LIST] Scraping product list from: ${url}`);
  
  // Check if PHP category scraper should be used
  const usePhpScraper = options?.usePhpScraper !== false; // Default to true
  const phpCategoryScraperPath = options?.supplierId ? getPhpScraperPath(options.supplierId, 'category') : null;
  
  if (usePhpScraper && phpCategoryScraperPath) {
    console.log(`[SCRAPE-LIST] Using PHP category scraper: ${phpCategoryScraperPath}`);
    try {
      // For category scraping, we scrape multiple pages (max 10 pages by default)
      const maxPages = Math.ceil(maxProducts / 20); // Assume ~20 products per page
      const productUrls = await callPhpCategoryScraper(
        phpCategoryScraperPath,
        url,
        1,
        maxPages,
        options?.cookies,
        options?.userAgent
      );
      
      // Limit to maxProducts
      return productUrls.slice(0, maxProducts);
    } catch (error) {
      console.error(`[SCRAPE-LIST] PHP category scraper failed, falling back to TypeScript scraper:`, error);
      // Fall through to TypeScript scraper
    }
  }

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
 * Returns: Array of product URLs from multiple pages
 * 
 * Used for:
 * - Complete category scraping: Goes through multiple pages
 * - Extracts all product URLs as array
 * - These URLs can then be scraped individually if needed
 * 
 * Can use PHP scraper if supplierId is provided and PHP scraper exists
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
  console.log(`[SCRAPE-ALL-PAGES] Starting multi-page scraping from: ${startUrl}`);
  console.log(`[SCRAPE-ALL-PAGES] Max pages: ${maxPages}, Max products: ${maxProductsTotal}`);
  
  // Check if PHP category scraper should be used
  const usePhpScraper = options?.usePhpScraper !== false; // Default to true
  const phpCategoryScraperPath = options?.supplierId ? getPhpScraperPath(options.supplierId, 'category') : null;
  
  if (usePhpScraper && phpCategoryScraperPath) {
    console.log(`[SCRAPE-ALL-PAGES] Using PHP category scraper: ${phpCategoryScraperPath}`);
    try {
      const productUrls = await callPhpCategoryScraper(
        phpCategoryScraperPath,
        startUrl,
        1,
        maxPages,
        options?.cookies,
        options?.userAgent
      );
      
      // Report progress
      if (progressCallback) {
        progressCallback(maxPages, productUrls.length);
      }
      
      // Limit to maxProductsTotal
      return productUrls.slice(0, maxProductsTotal);
    } catch (error) {
      console.error(`[SCRAPE-ALL-PAGES] PHP category scraper failed, falling back to TypeScript scraper:`, error);
      // Fall through to TypeScript scraper
    }
  }

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
