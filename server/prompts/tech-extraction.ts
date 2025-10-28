import { PromptContext, SubpromptConfig } from './types';

export const techExtractionConfig: SubpromptConfig = {
  name: 'tech-extraction',
  temperature: 0.1,
  maxTokens: 400,
  responseFormat: 'json_object',
  
  systemPrompt: (context: PromptContext) => `Du extrahierst technische Produktdaten.

PRODUKTKATEGORIE: ${context.categoryName}

WICHTIGE TECHNISCHE FELDER:
${context.availableFields?.map(field => `- ${field}`).join('\n') || 'Keine Felder definiert'}

DEINE AUFGABE:
Extrahiere NUR die technischen Daten, die tatsächlich in den Produktdaten vorhanden sind.

REGELN:
1. Verwende NUR Daten aus dem Input
2. Verwende die Feld-Labels von oben
3. Wenn ein Wert fehlt → lass das Feld komplett weg
4. Keine Annahmen oder Schätzungen
5. Einheiten korrekt übernehmen (V, mAh, mm, g, etc.)

OUTPUT-FORMAT (JSON):
{
  "technicalSpecs": {
    "Feldname1": "Wert1",
    "Feldname2": "Wert2"
  }
}

WICHTIG: Nur Felder mit echten Werten zurückgeben!`,

  userPrompt: (context: PromptContext) => `Produktdaten:
${JSON.stringify(context.productData, null, 2)}

Extrahiere die technischen Daten als JSON.`
};
