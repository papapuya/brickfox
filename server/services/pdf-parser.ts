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
   * Extract hyperlinks and product data from supplier PDF
   */
  async extractProductsFromPDF(buffer: Buffer): Promise<PDFProduct[]> {
    try {
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdfDoc = await loadingTask.promise;
      
      const products: PDFProduct[] = [];
      const numPages = pdfDoc.numPages;

      console.log(`📄 PDF Parser: Processing ${numPages} pages...`);

      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        
        // Extract text content
        const textContent = await page.getTextContent();
        const annotations = await page.getAnnotations();

        if (DEBUG_MODE) {
          console.log(`Page ${pageNum}: Found ${annotations.length} annotations`);
        }

        // Extract hyperlinks from annotations
        const links = annotations
          .filter((anno: any) => anno.subtype === 'Link' && anno.url)
          .map((anno: any) => ({
            url: anno.url,
            rect: anno.rect, // Position of the link
          }));

        if (DEBUG_MODE) {
          console.log(`Page ${pageNum}: Found ${links.length} hyperlinks`);
          links.forEach(link => console.log(`  URL: ${link.url}`));
        }

        // Extract text items with positions
        const textItems = textContent.items as TextItem[];
        const pageProducts = this.extractProductsFromPage(textItems, links);
        
        products.push(...pageProducts);
      }

      console.log(`✅ PDF Parser: Extracted ${products.length} products with URLs`);
      return products;
    } catch (error) {
      console.error('❌ PDF Parser Error:', error);
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract product data from a single page
   */
  private extractProductsFromPage(textItems: TextItem[], links: any[]): PDFProduct[] {
    const products: PDFProduct[] = [];
    const text = textItems.map(item => item.str).join(' ');

    // Try to find table structure
    // Pattern: Marke | Bezeichnung | Artikel-Nr. | Beschreibung | EAN-Code | VE | EK | UEVP
    
    // Extract all text lines
    const lines: string[] = [];
    let currentLine = '';
    let lastY = 0;

    textItems.forEach((item) => {
      const y = item.transform[5];
      
      // New line detected (Y position changed)
      if (lastY !== 0 && Math.abs(y - lastY) > 2) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = item.str;
      } else {
        currentLine += ' ' + item.str;
      }
      
      lastY = y;
    });
    
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    if (DEBUG_MODE) {
      console.log(`Extracted ${lines.length} lines from page`);
    }

    // Try to parse table rows
    // Look for patterns like: ANSMANN | Product Name | Article# | Description | EAN | VE | Price€ | Price€
    const priceRegex = /(\d+[,\.]\d{2})\s*€/g;
    const eanRegex = /\b\d{13}\b/g;
    const articleRegex = /\b\d{4}-\d{4}-\d{2}\b/g;

    // Match each link with nearby text
    links.forEach((link) => {
      // Find text near this link (simplified approach)
      // In a real implementation, we'd use rect coordinates to match precisely
      
      const product: PDFProduct = {
        productName: '',
        url: link.url,
        articleNumber: null,
        eanCode: null,
        ekPrice: null,
        description: null,
        marke: null,
        ve: null,
        uevp: null,
      };

      // Try to extract data from surrounding text
      // This is a simplified version - you may need to adjust based on actual PDF structure
      const contextText = text;

      // Extract article number
      const articleMatch = contextText.match(articleRegex);
      if (articleMatch) {
        product.articleNumber = articleMatch[0];
      }

      // Extract EAN code
      const eanMatch = contextText.match(eanRegex);
      if (eanMatch) {
        product.eanCode = eanMatch[0];
      }

      // Extract prices (EK and UEVP)
      const priceMatches = contextText.match(priceRegex);
      if (priceMatches && priceMatches.length >= 2) {
        product.ekPrice = priceMatches[priceMatches.length - 2]; // Second-to-last is often EK
        product.uevp = priceMatches[priceMatches.length - 1]; // Last is often UEVP
      }

      // Extract product name from URL
      const urlParts = link.url.split('/').filter((p: string) => p);
      const lastPart = urlParts[urlParts.length - 1];
      product.productName = lastPart.replace(/-/g, ' ').replace(/\//g, '');

      products.push(product);
    });

    return products;
  }

  /**
   * Parse PDF more intelligently by analyzing table structure
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
          // Define row bounds: within ±30 units of link Y position (accounting for multi-line rows)
          const rowYMin = link.y - 30;
          const rowYMax = link.y + 50; // Links are usually in the top section of multi-line rows

          // Find all text items in this row
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
          if (product) {
            products.push(product);
          }
        });
      }

      console.log(`✅ PDF Parser (Advanced): Extracted ${products.length} products`);
      return products;
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

      // Extract structured data using regex
      const articleMatch = rowText.match(/\b\d{4}-\d{4}-\d{2}\b/);
      const eanMatch = rowText.match(/\b\d{13}\b/);
      const priceMatches = rowText.match(/(\d+[,\.]\d{2})\s*€/g);

      if (articleMatch) product.articleNumber = articleMatch[0];
      if (eanMatch) product.eanCode = eanMatch[0];
      
      if (priceMatches && priceMatches.length >= 2) {
        product.ekPrice = priceMatches[priceMatches.length - 2].replace('€', '').trim();
        product.uevp = priceMatches[priceMatches.length - 1].replace('€', '').trim();
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
}

export const pdfParserService = new PDFParserService();
