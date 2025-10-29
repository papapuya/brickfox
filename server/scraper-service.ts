import * as cheerio from 'cheerio';

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
}

export interface ScrapedProduct {
  articleNumber: string;
  productName: string;
  ean?: string;
  manufacturer?: string;
  price?: string;
  description?: string;
  images: string[];
  weight?: string;
  category?: string;
  rawHtml?: string;
}

export interface ScrapeOptions {
  url: string;
  selectors: ScraperSelectors;
  userAgent?: string;
  cookies?: string;
  timeout?: number;
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

  // Article Number / SKU
  if (selectors.articleNumber) {
    const element = $(selectors.articleNumber).first();
    product.articleNumber = element.text().trim() || element.attr('content')?.trim() || '';
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
    product.manufacturer = element.text().trim() || element.attr('content')?.trim() || '';
  }

  // Price
  if (selectors.price) {
    const element = $(selectors.price).first();
    let priceText = element.text().trim() || element.attr('content')?.trim() || '';
    
    if (priceText) {
      // Step 1: Extract only the numeric portion with separators
      // Match pattern: optional digits, separator, digits (supports various formats)
      const numericMatch = priceText.match(/[\d,.]+/);
      if (numericMatch) {
        priceText = numericMatch[0];
      } else {
        priceText = '';
      }
      
      if (priceText) {
        // Step 2: Normalize to German format (comma as decimal separator)
        const hasComma = priceText.includes(',');
        const hasDot = priceText.includes('.');
        
        if (hasComma && hasDot) {
          // Both present: last one is decimal separator
          const lastComma = priceText.lastIndexOf(',');
          const lastDot = priceText.lastIndexOf('.');
          
          if (lastComma > lastDot) {
            // German format: 1.234,56 -> comma is decimal
            priceText = priceText.replace(/\./g, ''); // Remove thousands separators (dots)
          } else {
            // English format: 1,234.56 -> dot is decimal
            priceText = priceText.replace(/,/g, ''); // Remove thousands separators (commas)
            priceText = priceText.replace('.', ','); // Convert decimal dot to comma
          }
        } else if (hasDot && !hasComma) {
          // Only dot: check if it's thousands separator or decimal
          const dotParts = priceText.split('.');
          if (dotParts.length === 2 && dotParts[1].length <= 2) {
            // Likely decimal: 89.90 -> 89,90
            priceText = priceText.replace('.', ',');
          } else {
            // Likely thousands separator: 1.234 -> 1234
            priceText = priceText.replace(/\./g, '');
          }
        } else if (hasComma && !hasDot) {
          // Only comma: check if it's thousands separator or decimal
          const commaParts = priceText.split(',');
          if (commaParts.length === 2 && commaParts[1].length <= 2) {
            // Likely decimal: 89,90 -> keep as is
          } else {
            // Likely thousands separator: 1,234 -> 1234
            priceText = priceText.replace(/,/g, '');
          }
        }
        
        // Step 3: Ensure exactly 2 decimal places
        if (!priceText.includes(',')) {
          // No decimals: add ,00
          priceText = priceText + ',00';
        } else {
          const parts = priceText.split(',');
          if (parts[1]) {
            // Pad or truncate to exactly 2 decimals
            parts[1] = parts[1].padEnd(2, '0').substring(0, 2);
          } else {
            parts[1] = '00';
          }
          priceText = parts.join(',');
        }
      }
    }
    
    product.price = priceText;
  }

  // Description (can be HTML)
  if (selectors.description) {
    const element = $(selectors.description).first();
    product.description = element.html()?.trim() || element.text().trim() || '';
  }

  // Images
  if (selectors.images) {
    const imageElements = $(selectors.images);
    product.images = imageElements.map((_, el) => {
      const $el = $(el);
      // Try src, data-src, href
      const src = $el.attr('src') || $el.attr('data-src') || $el.attr('href') || '';
      return src.trim();
    }).get().filter(Boolean);
  }

  // Weight (with regex fallback like PHP)
  if (selectors.weight) {
    const element = $(selectors.weight).first();
    product.weight = element.text().trim() || '';
    
    // Fallback: Search for "gewicht: XXXg" in HTML
    if (!product.weight) {
      const weightMatch = html.match(/gewicht:\s*(\d+)\s*g/i);
      if (weightMatch) {
        product.weight = weightMatch[1];
      }
    }
  }

  // Category
  if (selectors.category) {
    const element = $(selectors.category).first();
    product.category = element.text().trim() || '';
  }

  // Store raw HTML for debugging
  product.rawHtml = html.substring(0, 1000); // First 1000 chars

  console.log('Scraped product:', {
    articleNumber: product.articleNumber,
    productName: product.productName,
    ean: product.ean,
    imagesCount: product.images.length
  });

  return product;
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
 * Scrape multiple products from a listing page
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
