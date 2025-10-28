import OpenAI from 'openai';
import { ProductCopyPayload } from './types';
import { ProductCategoryConfig } from './category-config';
import { createOrchestrator } from '../prompts/orchestrator';
import type { PromptContext } from '../prompts/types';

export async function generateProductCopy(
  productData: any,
  categoryConfig: ProductCategoryConfig,
  openaiKey: string,
  openaiBaseUrl?: string,
  useModularPrompts: boolean = true
): Promise<ProductCopyPayload> {
  if (useModularPrompts || categoryConfig.subpromptPreferences?.useModularPrompts) {
    return await generateProductCopyModular(productData, categoryConfig, openaiKey, openaiBaseUrl);
  } else {
    return await generateProductCopyMonolithic(productData, categoryConfig, openaiKey, openaiBaseUrl);
  }
}

async function generateProductCopyModular(
  productData: any,
  categoryConfig: ProductCategoryConfig,
  openaiKey: string,
  openaiBaseUrl?: string
): Promise<ProductCopyPayload> {
  console.log('🔧 Using MODULAR subprompt architecture');

  const orchestrator = createOrchestrator({
    openaiKey,
    openaiBaseUrl,
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

    return {
      narrative: result.narrative,
      uspBullets: result.uspBullets.length >= 5 
        ? result.uspBullets.slice(0, 5)
        : [...result.uspBullets, ...categoryConfig.uspTemplates].slice(0, 5),
      technicalSpecs: result.technicalSpecs,
      safetyNotice: result.safetyNotice || categoryConfig.safetyNotice,
      packageContents: result.packageContents,
      productHighlights: categoryConfig.productHighlights.slice(0, 5),
    };
  } catch (error) {
    console.error('Modular generation failed, using fallback:', error);
    return getFallbackCopy(categoryConfig);
  }
}

async function generateProductCopyMonolithic(
  productData: any,
  categoryConfig: ProductCategoryConfig,
  openaiKey: string,
  openaiBaseUrl?: string
): Promise<ProductCopyPayload> {
  console.log('📦 Using MONOLITHIC prompt (legacy)');

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
    "3-5 allgemeine Produkteigenschaften",
    "z.B. 'Robuste Verarbeitung', 'Langlebig', etc."
  ]
}

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
      model: 'gpt-4o',
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
