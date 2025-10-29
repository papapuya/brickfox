import OpenAI from 'openai';
import { ProductCopyPayload } from './types';
import { ProductCategoryConfig } from './category-config';
import { createOrchestrator } from '../prompts/orchestrator';
import type { PromptContext } from '../prompts/types';
import { processProductCopy } from './post-processor';
import { extractTechSpecs1to1 } from './tech-spec-parser';

export async function generateProductCopy(
  productData: any,
  categoryConfig: ProductCategoryConfig,
  openaiKey: string,
  openaiBaseUrl?: string,
  model: string = 'gpt-4o-mini', // COST OPTIMIZATION: 30× günstiger!
  useModularPrompts: boolean = true
): Promise<ProductCopyPayload> {
  if (useModularPrompts || categoryConfig.subpromptPreferences?.useModularPrompts) {
    return await generateProductCopyModular(productData, categoryConfig, openaiKey, openaiBaseUrl, model);
  } else {
    return await generateProductCopyMonolithic(productData, categoryConfig, openaiKey, openaiBaseUrl, model);
  }
}

async function generateProductCopyModular(
  productData: any,
  categoryConfig: ProductCategoryConfig,
  openaiKey: string,
  openaiBaseUrl?: string,
  model: string = 'gpt-4o-mini'
): Promise<ProductCopyPayload> {
  console.log(`🔧 Using MODULAR subprompt architecture with ${model}`);

  const orchestrator = createOrchestrator({
    openaiKey,
    openaiBaseUrl,
    model, // Pass model to orchestrator
  });

  const context: PromptContext = {
    categoryName: categoryConfig.name,
    categoryDescription: categoryConfig.description,
    productData,
    availableFields: categoryConfig.technicalFields.map(f => 
      `${f.label}${f.unit ? ` (${f.unit})` : ''}`
    ),
    uspTemplates: categoryConfig.uspTemplates,
  };

  try {
    const result = await orchestrator.generateFullProductCopy(context);

    // POST-PROCESSING: Validiere und bereinige AI-Output
    const processed = processProductCopy({
      narrative: result.narrative,
      uspBullets: result.uspBullets,
    });

    if (processed.validationIssues.length > 0) {
      console.log('⚠️ Post-processing applied:', processed.validationIssues);
    }

    // 1:1 TECH SPECS EXTRAKTION: Aus Vision-Text oder strukturierten Daten
    const directTechSpecs = extractTechSpecs1to1(
      productData.extractedText || '',
      productData.structuredData || productData,
      categoryConfig
    );
    
    // Wenn direkte Extraktion erfolgreich war, nutze diese (überschreibt AI)
    const mergedTechSpecs = {
      ...result.technicalSpecs,      // AI-generierte Specs (Fallback)
      ...directTechSpecs,             // 1:1 extrahierte Specs (überschreiben AI)
    };

    console.log(`📊 Tech Specs: ${Object.keys(mergedTechSpecs).length} total (${Object.keys(directTechSpecs).length} direct 1:1, ${Object.keys(result.technicalSpecs).length} AI fallback)`);

    return {
      narrative: processed.narrative,
      uspBullets: processed.uspBullets.length >= 5 
        ? processed.uspBullets.slice(0, 5)
        : [...processed.uspBullets, ...categoryConfig.uspTemplates].slice(0, 5),
      technicalSpecs: mergedTechSpecs,
      safetyNotice: result.safetyNotice || categoryConfig.safetyNotice,
      packageContents: result.packageContents,
      productHighlights: categoryConfig.productHighlights.slice(0, 5),
    };
  } catch (error) {
    console.error('Modular generation failed, using fallback:', error);
    return getFallbackCopy(categoryConfig);
  }
}

function extractSupplierTechnicalData(
  productData: any,
  categoryConfig: ProductCategoryConfig
): Record<string, string> {
  const extracted: Record<string, string> = {};
  
  // Prüfe auf strukturierte CSV/Excel-Daten
  if (productData.technicalData || productData.technicalSpecs || productData.specs) {
    const source = productData.technicalData || productData.technicalSpecs || productData.specs;
    
    for (const field of categoryConfig.technicalFields) {
      const value = source[field.label] || source[field.key];
      if (value && value !== 'Nicht angegeben' && value !== 'Nicht sichtbar') {
        extracted[field.label] = value;
        console.log(`✅ 1:1 Übernahme: ${field.label} = ${value}`);
      }
    }
  }
  
  // Prüfe auf direkte Felder im productData (z.B. von CSV-Import)
  for (const field of categoryConfig.technicalFields) {
    if (!extracted[field.label]) {
      const value = productData[field.label] || productData[field.key];
      if (value && value !== 'Nicht angegeben' && value !== 'Nicht sichtbar') {
        extracted[field.label] = value;
        console.log(`✅ 1:1 Übernahme: ${field.label} = ${value}`);
      }
    }
  }
  
  return extracted;
}

async function generateProductCopyMonolithic(
  productData: any,
  categoryConfig: ProductCategoryConfig,
  openaiKey: string,
  openaiBaseUrl?: string,
  model: string = 'gpt-4o-mini'
): Promise<ProductCopyPayload> {
  console.log(`📦 Using MONOLITHIC prompt (legacy) with ${model}`);

  const openai = new OpenAI({
    apiKey: openaiKey,
    baseURL: openaiBaseUrl,
  });

  const systemPrompt = `Du bist ein Produkttext-Experte für Online-Shops.

PRODUKTKATEGORIE: ${categoryConfig.name}
${categoryConfig.description}

WICHTIGE TECHNISCHE FELDER FÜR DIESE KATEGORIE:
${categoryConfig.technicalFields.map(field => 
  `- ${field.label}${field.unit ? ` (${field.unit})` : ''} ${field.required ? '[wichtig]' : '[optional]'}`
).join('\n')}

VERFÜGBARE USP-VORSCHLÄGE (wähle passende aus oder erstelle ähnliche):
${categoryConfig.uspTemplates.map((usp, i) => `${i + 1}. ${usp}`).join('\n')}

DEINE AUFGABE:
Analysiere die gegebenen Produktdaten und erstelle ein JSON-Objekt mit folgender Struktur:

{
  "narrative": "Eine professionelle Produktbeschreibung in 4-5 Sätzen, die die Hauptvorteile und Einsatzmöglichkeiten beschreibt",
  "uspBullets": [
    "5 verkaufsfördernde USP-Bulletpoints",
    "Verwende die Vorschläge oder erstelle ähnliche",
    "KEINE technischen Daten wie Spannung, Gewicht, Maße!",
    "Fokus auf Vorteile für den Kunden",
    "..."
  ],
  "technicalSpecs": {
    "Feldname": "Wert (nur Felder, die tatsächlich in den Daten vorhanden sind)"
  },
  "packageContents": "Was ist im Lieferumfang enthalten",
  "productHighlights": [
    "Produktspezifisches Highlight 1 (max. 8-10 Wörter)",
    "Produktspezifisches Highlight 2",
    "Produktspezifisches Highlight 3",
    "Produktspezifisches Highlight 4"
  ]
}

PRODUKTHIGHLIGHTS erstellen (ähnlich wie USPs, aber kürzer):
STIL-BEISPIELE für Akku-Highlights:
- "Hochwertige Lithium-Ionen-Zelle für konstante Leistung"
- "Mehrfachschutz vor Überladung, Kurzschluss und Tiefentladung"
- "Geringe Selbstentladung – ideal für Langzeitlagerung"

WICHTIG: Basierend auf echten Produktdaten, nicht generisch!

KRITISCHE REGELN:
1. Verwende NUR Informationen, die in den Produktdaten tatsächlich vorhanden sind
2. Wenn ein Feld nicht vorhanden ist → lass es komplett weg (kein "Nicht angegeben")
3. USP-Bulletpoints MÜSSEN verkaufsfördernd sein (KEINE nackten technischen Daten!)
4. Technische Daten gehören in "technicalSpecs", NICHT in "uspBullets"
5. Verwende die Feld-Labels aus der Liste oben für technicalSpecs
6. Gib NUR valides JSON zurück, ohne Markdown-Formatierung
7. Der Produktname wird separat behandelt - schreibe ihn NICHT in die narrative

BEISPIEL FÜR GUTE USPs:
✅ "Wiederaufladbar - spart langfristig Kosten"
✅ "Integrierte Schutzschaltung - maximale Sicherheit"
✅ "Langlebige Technologie - zuverlässig im Dauereinsatz"

BEISPIEL FÜR SCHLECHTE USPs:
❌ "3,6 V Spannung" (technisches Datum)
❌ "Gewicht: 184 g" (technisches Datum)
❌ "Abmessungen: 70×37.5×37.5 mm" (technisches Datum)`;

  const userPrompt = `Produktdaten:
${JSON.stringify(productData, null, 2)}

Erstelle jetzt das JSON-Objekt mit Produkttexten basierend auf diesen Daten.`;

  try {
    const response = await openai.chat.completions.create({
      model, // COST OPTIMIZATION: Use GPT-4o-mini by default (30× günstiger!)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    let parsedContent: ProductCopyPayload;

    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('AI returned invalid JSON');
    }

    return {
      narrative: parsedContent.narrative || '',
      uspBullets: parsedContent.uspBullets || [],
      technicalSpecs: parsedContent.technicalSpecs || {},
      safetyNotice: parsedContent.safetyNotice,
      packageContents: parsedContent.packageContents,
      productHighlights: parsedContent.productHighlights,
    };

  } catch (error) {
    console.error('AI generation error:', error);
    return getFallbackCopy(categoryConfig);
  }
}

function getFallbackCopy(categoryConfig: ProductCategoryConfig): ProductCopyPayload {
  return {
    narrative: 'Hochwertiges Produkt für professionelle Anwendungen. Zeichnet sich durch zuverlässige Leistung und langlebige Qualität aus.',
    uspBullets: categoryConfig.uspTemplates.slice(0, 5),
    technicalSpecs: {},
    packageContents: 'Produkt wie beschrieben',
    productHighlights: categoryConfig.productHighlights.slice(0, 5),
  };
}
