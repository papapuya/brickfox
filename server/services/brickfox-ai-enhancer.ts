/**
 * Brickfox AI Enhancement Service
 * Uses OpenAI to generate missing Brickfox fields
 */

import OpenAI from 'openai';
import type { ProductInProject } from '../../shared/schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface AIEnhancementResult {
  customs_tariff_number?: string;
  customs_tariff_text?: string;
  hazard_classification_product?: string;
  hazard_classification_variant?: string;
  optimized_description?: string;
  keywords?: string; // 6 comma-separated SEO keywords
}

/**
 * Generate customs tariff number (Zolltarifnummer) using AI
 */
async function generateCustomsTariffNumber(product: ProductInProject): Promise<{ number: string; text: string } | null> {
  try {
    const extractedData = product.extractedData?.[0];
    const customAttrs = product.customAttributes || [];
    
    const productInfo = `
      Produktname: ${product.name || product.exactProductName || 'Unbekannt'}
      Artikelnummer: ${product.articleNumber || 'Unbekannt'}
      Kategorie: ${customAttrs.find(a => a.key === 'kategorie')?.value || extractedData?.fileName || 'Unbekannt'}
      Hersteller: ${customAttrs.find(a => a.key === 'hersteller')?.value || 'Unbekannt'}
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für Zolltarifnummern (HS-Codes). Generiere die korrekte 8-stellige Zolltarifnummer für das beschriebene Produkt. Antworte NUR mit der Nummer und einer kurzen Beschreibung im Format: "12345678|Beschreibung".'
        },
        {
          role: 'user',
          content: `Bestimme die Zolltarifnummer für folgendes Produkt:\n\n${productInfo}`
        }
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const result = response.choices[0]?.message?.content?.trim();
    if (!result) return null;

    const [number, ...textParts] = result.split('|');
    const text = textParts.join('|').trim();

    return {
      number: number.trim(),
      text: text || number.trim()
    };
  } catch (error) {
    console.error('[AI Enhancer] Failed to generate customs tariff:', error);
    return null;
  }
}

/**
 * Classify hazardous goods (Gefahrgut) for OTTO Market
 */
async function classifyHazardousGoods(product: ProductInProject): Promise<string | null> {
  try {
    const extractedData = product.extractedData?.[0];
    const description = product.previewText || extractedData?.extractedText || extractedData?.description || '';
    
    const productInfo = `
      Produktname: ${product.name || product.exactProductName || 'Unbekannt'}
      Kategorie: ${product.customAttributes?.find(a => a.key === 'kategorie')?.value || 'Unbekannt'}
      Beschreibung: ${description.substring(0, 500)}
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für Gefahrgutklassifizierung. Bestimme, ob das Produkt Gefahrgut ist. Antworte NUR mit: "GEFAHRGUT" (wenn es gefährlich ist), "KEIN_GEFAHRGUT" (wenn sicher), oder "UNKLAR" (wenn unsicher). Typische Gefahrgüter: Lithium-Akkus, Spraydosen, entflammbare Flüssigkeiten, Chemikalien, Druckgasbehälter.'
        },
        {
          role: 'user',
          content: `Ist folgendes Produkt Gefahrgut?\n\n${productInfo}`
        }
      ],
      temperature: 0.2,
      max_tokens: 50,
    });

    const result = response.choices[0]?.message?.content?.trim().toUpperCase();
    if (!result) return null;

    if (result.includes('GEFAHRGUT') && !result.includes('KEIN')) {
      return 'Ja';
    } else if (result.includes('KEIN_GEFAHRGUT')) {
      return 'Nein';
    }

    return 'Unbekannt';
  } catch (error) {
    console.error('[AI Enhancer] Failed to classify hazardous goods:', error);
    return null;
  }
}

/**
 * Optimize product description for Brickfox/OTTO Market
 */
async function optimizeDescription(product: ProductInProject): Promise<string | null> {
  try {
    const extractedData = product.extractedData?.[0];
    const customAttrs = product.customAttributes || [];
    
    // Use description from customAttributes (scraped from supplier)
    const scrapedDesc = customAttrs.find(a => a.key === 'description')?.value;
    const originalDescription = scrapedDesc || product.previewText || extractedData?.extractedText || extractedData?.description || '';
    
    if (!originalDescription) return null;

    const productInfo = `
      Produktname: ${product.name || product.exactProductName}
      Hersteller: ${customAttrs.find(a => a.key === 'manufacturer')?.value || ''}
      Kategorie: ${customAttrs.find(a => a.key === 'category')?.value || ''}
      Original-Beschreibung: ${originalDescription}
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für E-Commerce Produktbeschreibungen. Optimiere die Produktbeschreibung für bessere Verkaufschancen: kurz, prägnant, verkaufsfördernd, SEO-optimiert. Verwende Bullet-Points für Features. Max. 500 Zeichen.'
        },
        {
          role: 'user',
          content: `Optimiere folgende Produktbeschreibung:\n\n${productInfo}`
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('[AI Enhancer] Failed to optimize description:', error);
    return null;
  }
}

/**
 * Generate 6 SEO keywords for the product
 */
async function generateKeywords(product: ProductInProject): Promise<string | null> {
  try {
    const extractedData = product.extractedData?.[0];
    const customAttrs = product.customAttributes || [];
    
    // Get product details
    const scrapedDesc = customAttrs.find(a => a.key === 'description')?.value;
    const originalDescription = scrapedDesc || product.previewText || extractedData?.extractedText || extractedData?.description || '';
    
    const productInfo = `
      Produktname: ${product.name || product.exactProductName}
      Hersteller: ${customAttrs.find(a => a.key === 'manufacturer')?.value || ''}
      Kategorie: ${customAttrs.find(a => a.key === 'category')?.value || ''}
      Beschreibung: ${originalDescription}
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein SEO-Experte. Generiere GENAU 6 relevante SEO-Keywords für das Produkt. Die Keywords sollen die wichtigsten Suchbegriffe abdecken, die Kunden verwenden würden. Antworte NUR mit den 6 Keywords, durch Komma getrennt, ohne Nummerierung.'
        },
        {
          role: 'user',
          content: `Generiere 6 SEO-Keywords für folgendes Produkt:\n\n${productInfo}`
        }
      ],
      temperature: 0.5,
      max_tokens: 100,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('[AI Enhancer] Failed to generate keywords:', error);
    return null;
  }
}

/**
 * Enhance product data with AI-generated fields
 */
export async function enhanceProductWithAI(product: ProductInProject): Promise<AIEnhancementResult> {
  const result: AIEnhancementResult = {};

  try {
    // Generate all AI fields in parallel for speed
    const [tariff, hazard, description, keywords] = await Promise.all([
      generateCustomsTariffNumber(product),
      classifyHazardousGoods(product),
      optimizeDescription(product),
      generateKeywords(product),
    ]);

    if (tariff) {
      result.customs_tariff_number = tariff.number;
      result.customs_tariff_text = tariff.text;
    }

    if (hazard) {
      result.hazard_classification_product = hazard;
      result.hazard_classification_variant = hazard;
    }

    if (description) {
      result.optimized_description = description;
    }

    if (keywords) {
      result.keywords = keywords;
    }

    return result;
  } catch (error) {
    console.error('[AI Enhancer] Error enhancing product:', error);
    return result;
  }
}

/**
 * Batch enhance multiple products
 */
export async function enhanceProductsWithAI(products: ProductInProject[]): Promise<Map<string, AIEnhancementResult>> {
  const results = new Map<string, AIEnhancementResult>();

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (product) => {
        const enhancement = await enhanceProductWithAI(product);
        return { id: product.id, enhancement };
      })
    );

    batchResults.forEach(({ id, enhancement }) => {
      results.set(id, enhancement);
    });

    // Small delay between batches
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
