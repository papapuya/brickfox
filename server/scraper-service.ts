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
    // Clean price: first convert comma to dot, then remove currency symbols/whitespace
    priceText = priceText.replace(',', '.').replace(/[€$£\s]/g, '');
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
 * Scrape multiple products from a listing page
 */
export async function scrapeProductList(
  url: string,
  productLinkSelector: string,
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

  // Extract product URLs
  const productUrls: string[] = [];
  $(productLinkSelector).each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      // Make absolute URL if relative
      const absoluteUrl = href.startsWith('http') ? href : new URL(href, url).toString();
      productUrls.push(absoluteUrl);
    }
  });

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
