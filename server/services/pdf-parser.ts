import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

interface PDFProduct {
  productName: string;
  url: string | null;
  articleNumber: string | null;
  eanCode: string | null;
  ekPrice: string | null;
  description: string | null;
  marke: string | null;
  ve: string | null;
  uevp: string | null;
}

export class PDFParserService {
  /**
   * Extract hyperlinks and product data from supplier PDF using position-based row detection
   * This method uses Y-coordinate matching to associate prices and metadata with specific product links
   */
  async extractProductsFromPDFAdvanced(buffer: Buffer): Promise<PDFProduct[]> {
    try {
      // Convert Buffer to Uint8Array (pdfjs-dist requirement)
      const uint8Array = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdfDoc = await loadingTask.promise;
      
      const products: PDFProduct[] = [];
      const numPages = pdfDoc.numPages;

      console.log(`📄 PDF Parser (Advanced): Processing ${numPages} pages...`);

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        
        const textContent = await page.getTextContent();
        const annotations = await page.getAnnotations();
        const textItems = textContent.items as TextItem[];

        // Extract links with their bounding boxes
        const links = annotations
          .filter((anno: any) => anno.subtype === 'Link' && anno.url)
          .map((anno: any) => ({
            url: anno.url,
            rect: anno.rect, // [x1, y1, x2, y2]
            y: anno.rect[1], // Bottom Y coordinate
            x: anno.rect[0], // Left X coordinate
          }));

        if (DEBUG_MODE) {
          console.log(`Page ${pageNum}: Found ${links.length} links`);
        }

        // For each link, find text items in the same row (within Y range)
        links.forEach((link) => {
          // Define row bounds: within ±8 units of link Y position for tight row matching
          // Typical PDF line height is ~12 units, so ±8 ensures we stay within one row
          // while accounting for slight vertical alignment variations
          const rowYMin = link.y - 8;
          const rowYMax = link.y + 8;

          // Find all text items in this row
          // We use Y-coordinate for row matching only - X-coordinates are used for ordering
          const rowTextItems = textItems.filter((item) => {
            const itemY = item.transform[5];
            return itemY >= rowYMin && itemY <= rowYMax;
          });

          // Sort by X position (left to right)
          rowTextItems.sort((a, b) => a.transform[4] - b.transform[4]);

          // Build row text
          const rowText = rowTextItems.map(item => item.str).join(' ');

          if (DEBUG_MODE) {
            console.log(`Link URL: ${link.url}`);
            console.log(`Row text: ${rowText.substring(0, 100)}...`);
          }

          // Parse this specific row
          const product = this.parseProductRow(rowText, link.url);
          if (product && this.isValidProduct(product)) {
            products.push(product);
          }
        });
      }

      // Remove duplicates based on URL (same product might appear on multiple pages)
      const uniqueProducts = products.reduce((acc, product) => {
        if (!product.url) return acc;
        
        // Check if this URL already exists
        const exists = acc.find(p => p.url === product.url);
        if (!exists) {
          acc.push(product);
        }
        
        return acc;
      }, [] as PDFProduct[]);

      console.log(`✅ PDF Parser (Advanced): Extracted ${products.length} products (${uniqueProducts.length} unique)`);
      return uniqueProducts;
    } catch (error) {
      console.error('❌ PDF Parser Advanced Error:', error);
      throw error;
    }
  }

  /**
   * Parse a single table row into a product
   */
  private parseProductRow(rowText: string, url: string): PDFProduct | null {
    try {
      // Pattern for table: Marke | Bezeichnung | Artikel-Nr. | Beschreibung | EAN | VE | EK | UEVP
      const parts = rowText.split(/\s{2,}/); // Split by 2+ spaces

      const product: PDFProduct = {
        productName: '',
        url,
        articleNumber: null,
        eanCode: null,
        ekPrice: null,
        description: null,
        marke: null,
        ve: null,
        uevp: null,
      };

      // Extract structured data using IMPROVED regex patterns
      // Article Number Patterns:
      // - XXXX-XXXX-XX (10 digits with dashes)
      // - XXXX-XXXX (8 digits with dashes)
      // - XXXXXXXX (8 digits without dashes)
      // - XXXXXXXXXX (10 digits without dashes)
      const articleMatch = rowText.match(/\b\d{4}-\d{4}(?:-\d{2})?\b/) || 
                          rowText.match(/\b\d{8,10}\b/);
      
      // EAN Patterns:
      // - 13 digits (standard EAN-13)
      // - Can be anywhere in the text
      const eanMatch = rowText.match(/\b\d{13}\b/);
      
      // Price Patterns (FLEXIBLE):
      // - XX,XX € or XX.XX €
      // - XX,XX or XX.XX (without € symbol)
      // - With or without spaces
      const priceMatches = rowText.match(/(\d+[,\.]\d{2})\s*€?/g);

      // Debug: Log what we found (always log if nothing found)
      if (DEBUG_MODE || !articleMatch || !eanMatch || !priceMatches) {
        console.log(`\n🔍 Row parsing:`);
        console.log(`  Row text: ${rowText.substring(0, 200)}...`);
        console.log(`  Article match: ${articleMatch ? articleMatch[0] : 'NONE'}`);
        console.log(`  EAN match: ${eanMatch ? eanMatch[0] : 'NONE'}`);
        console.log(`  Price matches: ${priceMatches ? priceMatches.join(', ') : 'NONE'}`);
      }

      // Process Article Number: Remove hyphens and spaces (2447-0121 → 24470121)
      if (articleMatch) {
        product.articleNumber = articleMatch[0].replace(/[-\s]/g, '');
        console.log(`  ✅ Article: ${product.articleNumber}`);
      }
      
      // Process EAN Code
      if (eanMatch) {
        product.eanCode = eanMatch[0];
        console.log(`  ✅ EAN: ${product.eanCode}`);
      }
      
      // Process Prices (EK and UEVP)
      if (priceMatches && priceMatches.length >= 1) {
        // Clean prices: remove € and whitespace
        const cleanedPrices = priceMatches.map(p => p.replace(/€/g, '').trim());
        
        if (cleanedPrices.length >= 2) {
          // If 2+ prices found: last 2 are likely EK and UEVP
          product.ekPrice = cleanedPrices[cleanedPrices.length - 2];
          product.uevp = cleanedPrices[cleanedPrices.length - 1];
        } else if (cleanedPrices.length === 1) {
          // If only 1 price found: assume it's EK
          product.ekPrice = cleanedPrices[0];
        }
        
        console.log(`  ✅ EK: ${product.ekPrice || 'N/A'}, UEVP: ${product.uevp || 'N/A'}`);
      }

      // Extract product name from URL
      const urlParts = url.split('/').filter((p: string) => p);
      const lastPart = urlParts[urlParts.length - 1];
      product.productName = lastPart
        .replace(/-/g, ' ')
        .replace(/\/$/, '')
        .trim();

      // Extract Marke (first word is often the brand)
      const firstWord = rowText.split(/\s+/)[0];
      if (firstWord && firstWord.length > 2) {
        product.marke = firstWord;
      }

      return product;
    } catch (error) {
      console.error('Error parsing product row:', error);
      return null;
    }
  }

  /**
   * Filter out non-product links (AGB, Datenschutz, Impressum, etc.)
   */
  private isValidProduct(product: PDFProduct): boolean {
    const name = product.productName.toLowerCase();
    
    // Filter out common non-product pages
    const invalidKeywords = [
      'agb',
      'geschaeftskunden',
      'datenschutz',
      'impressum',
      'kontakt',
      'cookie',
      'nutzungsbedingungen',
      'widerruf',
      'versand',
      'zahlung'
    ];
    
    // If product name contains any invalid keyword, reject it
    if (invalidKeywords.some(keyword => name.includes(keyword))) {
      if (DEBUG_MODE) {
        console.log(`⚠️ Filtered out non-product: ${product.productName}`);
      }
      return false;
    }
    
    return true;
  }
}

export const pdfParserService = new PDFParserService();
