import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || false; // Set to true for detailed logging

/**
 * Validate EAN-13 or EAN-8 checksum using GS1 Modulo-10 algorithm
 * Returns true if valid, false otherwise
 * 
 * GS1 Modulo-10 Algorithm:
 * - EAN-13: Multiply positions 1,3,5,7,9,11 by 1, positions 2,4,6,8,10,12 by 3 (from left to right)
 * - EAN-8: Multiply positions 1,3,5,7 by 3, positions 2,4,6 by 1 (from left to right)
 * - Sum all products, calculate (10 - (sum % 10)) % 10, compare with check digit (last digit)
 */
function validateEANChecksum(ean: string): boolean {
  // Remove all non-digit characters
  const digits = ean.replace(/\D/g, '');
  
  // Must be EAN-13 (13 digits) or EAN-8 (8 digits)
  if (digits.length !== 13 && digits.length !== 8) {
    return false;
  }
  
  // Calculate checksum using GS1 Modulo-10 algorithm
  let sum = 0;
  const isEAN13 = digits.length === 13;
  
  // Process all digits except the last one (check digit)
  for (let i = 0; i < digits.length - 1; i++) {
    const digit = parseInt(digits[i], 10);
    const position = i + 1; // 1-indexed position from left
    
    // Determine multiplier based on position
    let multiplier: number;
    if (isEAN13) {
      // EAN-13: odd positions (1,3,5,7,9,11) multiply by 1, even positions (2,4,6,8,10,12) multiply by 3
      multiplier = position % 2 === 1 ? 1 : 3;
    } else {
      // EAN-8: odd positions (1,3,5,7) multiply by 3, even positions (2,4,6) multiply by 1
      multiplier = position % 2 === 1 ? 3 : 1;
    }
    
    sum += digit * multiplier;
  }
  
  const checkDigit = parseInt(digits[digits.length - 1], 10);
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  
  return checkDigit === calculatedCheckDigit;
}

interface PDFProduct {
  productName: string;
  url: string | null;
  articleNumber: string | null;
  manufacturerArticleNumber?: string | null;  // Hersteller-Artikelnummer (ohne Präfix)
  eanCode: string | null;
  ekPrice: string | null;
  description: string | null;
  marke: string | null;
  ve: string | null;
  liefermenge: string | null;
  kategorie?: string | null;
  bezeichnung?: string | null;
}

export interface PDFParseResult {
  withURL: PDFProduct[];
  withoutURL: PDFProduct[];
  totalProducts: number;
}

export class PDFParserService {
  /**
   * Extract ALL products from PDF: WITH URL and WITHOUT URL
   * Returns separated lists for different workflows
   */
  async extractProductsWithSeparation(buffer: Buffer): Promise<PDFParseResult> {
    try {
      const uint8Array = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdfDoc = await loadingTask.promise;
      
      const productsWithURL: PDFProduct[] = [];
      const productsWithoutURL: PDFProduct[] = [];
      const numPages = pdfDoc.numPages;

      console.log(`📄 PDF Parser (Separation Mode): Processing ${numPages} pages...`);

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
            rect: anno.rect,
            y: anno.rect[1],
            x: anno.rect[0],
          }));

        console.log(`📄 Page ${pageNum}: Found ${links.length} products with URLs`);

        // Track processed Y position ranges to avoid duplicate parsing
        // Store as JSON strings to track min/max ranges
        const processedYPositions = new Set<string>();

        // 1. PRODUCTS WITH URL
        links.forEach((link) => {
          // Increase Y-tolerance to capture multi-line data (article number, EAN, price might be on different Y positions)
          const rowYMin = link.y - 15;  // Increased from 8 to 15
          const rowYMax = link.y + 15;  // Increased from 8 to 15

          const rowTextItems = textItems.filter((item) => {
            const itemY = item.transform[5];
            return itemY >= rowYMin && itemY <= rowYMax;
          });

          rowTextItems.sort((a, b) => a.transform[4] - b.transform[4]);
          const rowText = rowTextItems.map(item => item.str).join(' ');

          // STRICT: First check if row looks like a product (artikel_nr AND bezeichnung AND netto_ek)
          if (!this.looksLikeProductRow(rowText)) {
            console.log(`⚠️ [With URL] Row does not look like product: ${rowText.substring(0, 100)}...`);
            return; // Skip this row
          }

          const product = this.parseProductRow(rowText, link.url);
          // parseProductRow now returns null if criteria not met, so if product exists, it's valid
          if (product && this.isValidProduct(product)) {
            productsWithURL.push(product);
            // Store the exact Y position range that was processed (not just the link Y)
            // This helps avoid marking nearby unrelated rows as processed
            const processedYRange = {
              min: rowYMin,
              max: rowYMax,
              center: Math.round(link.y)
            };
            processedYPositions.add(JSON.stringify(processedYRange));
          } else {
            console.log(`⚠️ [With URL] Skipped product (validation failed): ${link.url}`);
          }
        });

        // 2. PRODUCTS WITHOUT URL (pure table rows)
        // Group text items by Y position range to capture multi-line data
        // Use a larger grouping window to capture multi-line product data
        const textByRow = new Map<number, TextItem[]>();
        
        textItems.forEach((item) => {
          // Round to nearest 3 to group nearby Y positions (smaller step = better grouping)
          const y = Math.round(item.transform[5] / 3) * 3;
          if (!textByRow.has(y)) {
            textByRow.set(y, []);
          }
          textByRow.get(y)!.push(item);
        });

        // Process rows that weren't already processed (no URL)
        textByRow.forEach((items, y) => {
          // Check if this Y position is within any processed range
          // Only skip if Y is within the actual processed range (not just close to it)
          const isProcessed = Array.from(processedYPositions).some(processedYStr => {
            try {
              const processedYRange = JSON.parse(processedYStr);
              // Check if Y is within the processed range (with small buffer)
              return y >= processedYRange.min - 5 && y <= processedYRange.max + 5;
            } catch {
              // Fallback for old format (single number)
              const processedY = parseFloat(processedYStr);
              if (!isNaN(processedY)) {
                return Math.abs(y - processedY) < 12; // Smaller tolerance for old format
              }
              return false;
            }
          });
          
          if (!isProcessed) {
            items.sort((a, b) => a.transform[4] - b.transform[4]);
            const rowText = items.map(item => item.str).join(' ');

            // Only parse rows that look like product data
            if (this.looksLikeProductRow(rowText)) {
              const product = this.parseProductRow(rowText, null);
              // parseProductRow now returns null if criteria not met (artikel_nr, bezeichnung, netto_ek)
              // So if product exists, it's already validated
              if (product) {
                productsWithoutURL.push(product);
                console.log(`📦 [Without URL] Added product: ${product.manufacturerArticleNumber || 'N/A'} / ${product.productName.substring(0, 50)}`);
              } else {
                // Log rows that look like products but couldn't be parsed
                console.log(`⚠️ [Without URL] parseProductRow returned null (validation failed): ${rowText.substring(0, 100)}`);
              }
            }
          } else {
            // Debug: Log when a row is skipped because it's in a processed range
            if (DEBUG_MODE) {
              console.log(`⏭️ [Without URL] Skipped row at Y=${y} (within processed range)`);
            }
          }
        });
      }

      // Remove duplicates
      const uniqueWithURL = this.removeDuplicates(productsWithURL, true);
      let uniqueWithoutURL = this.removeDuplicates(productsWithoutURL, false);

      // CRITICAL: Remove products from "withoutURL" that already exist in "withURL"
      // (same article number or EAN)
      uniqueWithoutURL = uniqueWithoutURL.filter(productWithoutURL => {
        const existsInWithURL = uniqueWithURL.some(productWithURL => 
          // Match by article number (if both have it)
          (productWithURL.articleNumber && productWithoutURL.articleNumber && 
           productWithURL.articleNumber === productWithoutURL.articleNumber) ||
          // Match by EAN (if both have it)
          (productWithURL.eanCode && productWithoutURL.eanCode && 
           productWithURL.eanCode === productWithoutURL.eanCode)
        );
        
        if (existsInWithURL) {
          console.log(`⚠️ Removing duplicate from "withoutURL" (already in "withURL"): ${productWithoutURL.articleNumber || productWithoutURL.eanCode || 'unknown'}`);
        }
        
        return !existsInWithURL;
      });

      console.log(`✅ Products WITH URL: ${uniqueWithURL.length}`);
      console.log(`✅ Products WITHOUT URL: ${uniqueWithoutURL.length}`);
      console.log(`✅ Total unique products: ${uniqueWithURL.length + uniqueWithoutURL.length}`);

      return {
        withURL: uniqueWithURL,
        withoutURL: uniqueWithoutURL,
        totalProducts: uniqueWithURL.length + uniqueWithoutURL.length
      };
    } catch (error) {
      console.error('❌ PDF Parser Separation Error:', error);
      throw error;
    }
  }

  /**
   * Check if a text row looks like product data
   * STRICT RULES:
   * 1. Must have artikel_nr AND bezeichnung AND netto_ek (not empty, not "-")
   * 2. Exclude contact info (Tel, Telefon, Mobil, +, @, http) BEFORE EAN search
   * 3. Only rows with formatted Euro amount (e.g., "12,85 €")
   */
  private looksLikeProductRow(rowText: string): boolean {
    // 1. Check for table boundaries - stop at "AGB", "Zahlungsziel", "Ansprechpartner", etc.
    const stopKeywords = /\b(agb|allgemeine geschäftsbedingungen|zahlungsziel|ansprechpartner|impressum|datenschutz|widerruf|versand|zahlung|lieferbedingungen)\b/i;
    if (stopKeywords.test(rowText)) {
      return false; // Stop parsing at table boundaries
    }
    
    // 2. Exclude rows with contact info patterns (BEFORE EAN search)
    // Telefon, Tel, Mobil, +, @, http (but allow product URLs like pim.ansmann.de)
    const hasContactInfo = 
      /\b(tel|telefon|mobil|handy|fax)\b/i.test(rowText) || // Tel, Telefon, Mobil
      /\+\d/.test(rowText) || // Phone number with +
      /[^\s]+@[^\s]+/.test(rowText) || // Email
      (/\bhttp[s]?:\/\//i.test(rowText) && !/pim\./i.test(rowText)); // URLs (but allow product URLs)
    
    if (hasContactInfo) {
      return false;
    }
    
    // 3. Must have article number pattern (XXXX-XXXX-XX or 8-10 digits)
    const hasArticle = /\b\d{4}-\d{4}(?:-\d{2})?\b/.test(rowText) || /\b\d{8,10}\b/.test(rowText);
    
    // 4. Must have bezeichnung (product name) - at least 3 characters of meaningful text
    // More lenient: allow shorter product names (like in Replit)
    const hasBezeichnung = rowText.length > 15 && // Minimum length (reduced from 20)
                           /[a-zA-Z]{3,}/.test(rowText); // At least 3 consecutive letters (reduced from 5)
    
    // 5. Must have formatted Euro amount (netto_ek) - e.g., "12,85 €" or "12.85 €"
    // Must NOT be empty or just "-"
    // Must have at least one price that looks valid (not just "-")
    const pricePattern = /\d+[,\.]\d{2}\s*€?/; // More flexible: € is optional
    const priceMatches = rowText.match(/(\d+[,\.]\d{2})\s*€?/g);
    const hasNettoEK = pricePattern.test(rowText) && 
                      priceMatches && 
                      priceMatches.length > 0 &&
                      priceMatches.some(p => {
                        const cleaned = p.replace(/€/g, '').trim();
                        return cleaned && cleaned !== '-' && cleaned.length > 0;
                      });
    
    // STRICT: Must have ALL THREE: artikel_nr AND bezeichnung AND netto_ek
    const isValid = hasArticle && hasBezeichnung && hasNettoEK;
    
    // Log only rejections to reduce noise (temporarily for debugging)
    if (!isValid && DEBUG_MODE) {
      console.log(`[looksLikeProductRow] ❌ REJECTED: hasArticle=${hasArticle}, hasBezeichnung=${hasBezeichnung}, hasNettoEK=${hasNettoEK}`);
      console.log(`[looksLikeProductRow] Row text: ${rowText.substring(0, 200)}...`);
    }
    
    return isValid;
  }

  /**
   * Remove duplicate products
   */
  private removeDuplicates(products: PDFProduct[], byURL: boolean): PDFProduct[] {
    return products.reduce((acc, product) => {
      // Skip products without manufacturer article number (invalid products)
      if (!product.manufacturerArticleNumber || product.manufacturerArticleNumber.trim().length === 0) {
        console.log(`⚠️ Skipping product without manufacturer article number: ${product.productName?.substring(0, 50)}`);
        return acc;
      }
      
      // Skip if article number looks like a phone number
      const looksLikePhoneNumber = 
        /^\d{8}$/.test(product.manufacturerArticleNumber) && /^[67]\d{7}$/.test(product.manufacturerArticleNumber) ||
        /^\d{10,13}$/.test(product.manufacturerArticleNumber) && /^[67]/.test(product.manufacturerArticleNumber);
      
      if (looksLikePhoneNumber) {
        console.log(`⚠️ Skipping product (article number looks like phone number): ${product.manufacturerArticleNumber}`);
        return acc;
      }
      
      // Skip products without valid product name
      if (!product.productName || product.productName === 'Unknown Product' || product.productName.trim().length <= 3) {
        console.log(`⚠️ Skipping product without valid name: ${product.manufacturerArticleNumber || 'unknown'}`);
        return acc;
      }
      
      // Skip products without price
      if (!product.ekPrice || product.ekPrice.trim().length === 0) {
        console.log(`⚠️ Skipping product without price: ${product.manufacturerArticleNumber || 'unknown'}`);
        return acc;
      }
      
      const exists = byURL
        ? acc.find(p => p.url === product.url && p.url !== null)
        : acc.find(p => 
            // Match by manufacturer article number (primary key for duplicates)
            (p.manufacturerArticleNumber && product.manufacturerArticleNumber && 
             p.manufacturerArticleNumber === product.manufacturerArticleNumber) ||
            // Fallback: Match by article number (if both have it)
            (p.articleNumber && product.articleNumber && p.articleNumber === product.articleNumber)
          );
      
      if (!exists) {
        acc.push(product);
      } else {
        // Duplicate found: prefer the one with valid EAN
        const existingIndex = acc.findIndex(p => 
          (p.manufacturerArticleNumber && product.manufacturerArticleNumber && 
           p.manufacturerArticleNumber === product.manufacturerArticleNumber) ||
          (p.articleNumber && product.articleNumber && p.articleNumber === product.articleNumber)
        );
        
        if (existingIndex >= 0) {
          const existing = acc[existingIndex];
          // If new product has valid EAN and existing doesn't, replace it
          if (product.eanCode && !existing.eanCode) {
            console.log(`⚠️ Replacing duplicate (new has EAN): ${product.manufacturerArticleNumber || product.articleNumber || 'unknown'}`);
            acc[existingIndex] = product;
          } else {
            console.log(`⚠️ Skipping duplicate product: ${product.manufacturerArticleNumber || product.articleNumber || 'unknown'}`);
          }
        }
      }
      
      return acc;
    }, [] as PDFProduct[]);
  }

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
  private parseProductRow(rowText: string, url: string | null): PDFProduct | null {
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
        liefermenge: null,
      };

      // Extract structured data using IMPROVED regex patterns
      // Article Number Patterns:
      // - XXXX-XXXX-XX (10 digits with dashes)
      // - XXXX-XXXX (8 digits with dashes)
      // - XXXXXXXX (8 digits without dashes)
      // - XXXXXXXXXX (10 digits without dashes)
      const articleMatch = rowText.match(/\b\d{4}-\d{4}(?:-\d{2})?\b/) || 
                          rowText.match(/\b\d{8,10}\b/);
      
      // EAN Patterns: Only pure numeric EAN-8 or EAN-13
      // Regex equivalent: (?<!\+)(?<!\d)(\d{8}|\d{13})(?!\d)
      // JavaScript doesn't support lookbehind in all environments, so we check manually
      const eanMatch = (() => {
        // Find all potential EAN-8 or EAN-13 numbers
        const eanPattern = /\b(\d{8}|\d{13})\b/g;
        const allMatches = rowText.matchAll(eanPattern);
        if (!allMatches) return null;
        
        // Validate each match with checksum and context
        for (const match of allMatches) {
          const eanValue = match[0];
          const matchIndex = match.index!;
          
          // Check context: NOT preceded by + or digit, NOT followed by digit
          const charBefore = matchIndex > 0 ? rowText[matchIndex - 1] : '';
          const charAfter = matchIndex + eanValue.length < rowText.length ? rowText[matchIndex + eanValue.length] : '';
          
          // Skip if preceded by + or digit
          if (charBefore === '+' || /\d/.test(charBefore)) {
            continue;
          }
          
          // Skip if followed by digit
          if (/\d/.test(charAfter)) {
            continue;
          }
          
          // Validate checksum - if invalid, try next match
          if (validateEANChecksum(eanValue)) {
            return eanValue; // Return first valid EAN
          } else {
            console.log(`  ⚠️ EAN failed checksum: ${eanValue}`);
          }
        }
        
        // No valid EAN found
        return null;
      })();
      
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

      // Process Article Number: Keep original format with hyphens (2447-3049-60)
      // STRICT: Must have artikel_nr
      if (articleMatch) {
        const originalNumber = articleMatch[0].trim();  // Keep hyphens intact!
        
        // FILTER: Skip if it looks like a phone number
        // Phone numbers: 8-14 digits starting with 6, 7, or country codes (49, 0049, +49)
        const looksLikePhoneNumber = 
          /^\d{8}$/.test(originalNumber) && /^[67]\d{7}$/.test(originalNumber) || // 8 digits starting with 6 or 7
          /^\d{10,14}$/.test(originalNumber) && /^[67]/.test(originalNumber) || // 10-14 digits starting with 6 or 7
          /^49\d{10,11}$/.test(originalNumber) || // German country code
          /^0049\d{10,11}$/.test(originalNumber); // German country code with 00
        
        if (looksLikePhoneNumber) {
          console.log(`  ⚠️ Skipping article number (looks like phone number): ${originalNumber}`);
          return null; // Don't create product if article number is a phone number
        }
        
        product.articleNumber = originalNumber;  // Will be prefixed later in the route
        product.manufacturerArticleNumber = originalNumber;  // Keep original format for Pixi matching
        console.log(`  ✅ Article: ${product.articleNumber} (Manufacturer: ${product.manufacturerArticleNumber})`);
      } else {
        console.log(`  ⚠️ No article number found - rejecting product`);
        return null; // Reject product without article number
      }
      
      // Process EAN Code with strict validation (GS1 Modulo-10 checksum)
      // EAN is optional, but if present must be valid
      if (eanMatch) {
        const rawEAN = eanMatch.replace(/\D/g, ''); // Remove all non-digits (should already be clean)
        // Validate EAN checksum (EAN-13 or EAN-8)
        if (validateEANChecksum(rawEAN)) {
          product.eanCode = rawEAN;
          console.log(`  ✅ EAN (valid checksum): ${product.eanCode}`);
        } else {
          console.log(`  ⚠️ EAN failed checksum validation: ${rawEAN}`);
          product.eanCode = null; // Set to null if checksum invalid
        }
      } else {
        product.eanCode = null; // No EAN found
      }
      
      // Process Prices (Netto-EK)
      // STRICT: netto_ek must NOT be empty or "-"
      // PDF has 2 prices: Netto-EK (second-to-last) and UE/VP (last)
      // We need Netto-EK, NOT UE/VP!
      if (priceMatches && priceMatches.length >= 1) {
        // Clean prices: remove € and whitespace, filter out "-" and empty values
        const cleanedPrices = priceMatches
          .map(p => p.replace(/€/g, '').trim())
          .filter(p => p && p !== '-' && p.trim().length > 0);
        
        if (cleanedPrices.length === 0) {
          console.log(`  ⚠️ No valid prices found - rejecting product`);
          return null; // Reject product without valid price
        }
        
        // If there are 2+ prices, take the second-to-last (Netto-EK)
        // If there's only 1 price, take it as fallback
        const nettoEK = cleanedPrices.length >= 2 
          ? cleanedPrices[cleanedPrices.length - 2]  // Netto-EK (not UE/VP!)
          : cleanedPrices[cleanedPrices.length - 1]; // Fallback for single price
        
        // Validate: netto_ek must NOT be empty or "-"
        if (!nettoEK || nettoEK === '-' || nettoEK.trim().length === 0) {
          console.log(`  ⚠️ Invalid netto_ek: "${nettoEK}" - rejecting product`);
          return null; // Reject product with invalid price
        }
        
        product.ekPrice = nettoEK;
        console.log(`  ✅ Netto-EK: ${product.ekPrice} (aus ${cleanedPrices.length} Preisen)`);
      } else {
        console.log(`  ⚠️ No price found - rejecting product`);
        return null; // Reject product without price
      }

      // Extract Marke (first word is often the brand)
      const firstWord = rowText.split(/\s+/)[0];
      if (firstWord && firstWord.length > 2) {
        product.marke = firstWord;
      }

      // Extract BEZEICHNUNG as productName (between Marke and Artikel-Nr.)
      // Strategy: Remove all recognized patterns and extract the remaining text
      let cleanedText = rowText;
      
      // Remove Marke (first word)
      if (product.marke) {
        cleanedText = cleanedText.replace(product.marke, '').trim();
      }
      
      // Remove Artikel-Nr.
      if (articleMatch) {
        cleanedText = cleanedText.replace(articleMatch[0], '').trim();
      }
      
      // Remove EAN
      if (eanMatch) {
        cleanedText = cleanedText.replace(eanMatch[0], '').trim();
      }
      
      // Remove all prices
      if (priceMatches) {
        priceMatches.forEach(price => {
          cleanedText = cleanedText.replace(price, '').trim();
        });
      }
      
      // Remove common column headers/noise
      cleanedText = cleanedText
        .replace(/\bVE\b/g, '')
        .replace(/\bEK\b/g, '')
        .replace(/\bUEVP\b/g, '')
        .replace(/\bNetto-EK\b/g, '')
        .replace(/\s{2,}/g, ' ') // Normalize multiple spaces
        .trim();
      
      // Extract the first meaningful text block as Bezeichnung (product name)
      // STRICT: Must have bezeichnung (product name)
      // This should be the product description after removing all structured data
      const bezeichnungMatch = cleanedText.match(/^([^€\d]{5,}?)(?:\s{2,}|$)/);
      if (bezeichnungMatch) {
        product.productName = bezeichnungMatch[1].trim();
      } else if (cleanedText.length > 3) {
        // Fallback: Use cleaned text if it's meaningful
        product.productName = cleanedText.substring(0, 100).trim();
      } else {
        // No valid bezeichnung found
        console.log(`  ⚠️ No valid bezeichnung found - rejecting product`);
        return null; // Reject product without bezeichnung
      }
      
      // Validate: bezeichnung must be meaningful (at least 3 characters, not just numbers/symbols)
      // More lenient: allow shorter product names (like in Replit)
      if (!product.productName || product.productName.length < 3 || !/[a-zA-Z]{2,}/.test(product.productName)) {
        console.log(`  ⚠️ Invalid bezeichnung: "${product.productName}" - rejecting product`);
        return null; // Reject product with invalid bezeichnung
      }
      
      console.log(`  ✅ Bezeichnung (Produktname): ${product.productName}`);

      // Extract Liefermenge with multiple patterns:
      // - "4er" → 4 Stück
      // - "4 Stück" → 4 Stück
      // - "100 Karton" → 100 Stück
      // - "10er Pack" → 10 Stück
      const liefermengePatterns = [
        /(\d+)\s*er\b/i,                              // "4er", "10er"
        /(\d+)\s*-\s*er\b/i,                          // "4-er"
        /(\d+)\s*(Stück|St\.|STK)/i,                  // "4 Stück", "4 St.", "4 STK"
        /(\d+)\s*(Karton|Box)/i,                      // "100 Karton", "50 Box"
        /(\d+)\s*(Pack|pack)/i,                       // "10 Pack"
      ];
      
      let liefermengeFound = false;
      for (const pattern of liefermengePatterns) {
        const match = rowText.match(pattern);
        if (match) {
          product.liefermenge = `${match[1]} Stück`;
          console.log(`  ✅ Liefermenge: ${product.liefermenge} (Pattern: ${pattern})`);
          liefermengeFound = true;
          break;
        }
      }
      
      if (!liefermengeFound) {
        // Default: 1 Stück if not specified
        product.liefermenge = '1 Stück';
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
    const url = product.url?.toLowerCase() || '';
    
    // Filter out common non-product pages by name
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
      'zahlung',
      'gmbh',          // Company names
      'co. kg',
      ' ag ',
      'akkushop',
      'ansmann ag'
    ];
    
    // Filter out invalid URLs
    const invalidUrlPatterns = [
      'agb',
      'geschaeftskund',
      'datenschutz',
      'impressum',
      'kontakt',
      'cookie'
    ];
    
    // Check product name for invalid keywords
    if (invalidKeywords.some(keyword => name.includes(keyword))) {
      if (DEBUG_MODE) {
        console.log(`⚠️ Filtered out non-product (name): ${product.productName}`);
      }
      return false;
    }
    
    // Check URL for invalid patterns
    if (url && invalidUrlPatterns.some(pattern => url.includes(pattern))) {
      if (DEBUG_MODE) {
        console.log(`⚠️ Filtered out non-product (URL): ${product.url}`);
      }
      return false;
    }
    
    return true;
  }
}

export const pdfParserService = new PDFParserService();
