import { PromptContext, SubpromptConfig } from './types';

export const narrativeConfig: SubpromptConfig = {
  name: 'narrative',
  temperature: 0.5,
  maxTokens: 400,
  responseFormat: 'json_object',
  
  systemPrompt: (context: PromptContext) => `Du schreibst professionelle Produktbeschreibungen.

PRODUKTKATEGORIE: ${context.categoryName}
${context.categoryDescription}

DEINE AUFGABE:
Schreibe eine professionelle Produktbeschreibung in 4-5 Sätzen.

INHALT DER BESCHREIBUNG:
1. Was ist das Produkt? (1 Satz)
2. Hauptvorteile und Einsatzmöglichkeiten (2-3 Sätze)
3. Für wen ist es geeignet? (1 Satz)

STIL:
- Professionell und sachlich
- Kundennutzen im Vordergrund
- Keine Superlative ohne Begründung
- Fließtext, keine Stichpunkte
- Der Produktname wird separat behandelt - nicht wiederholen

OUTPUT-FORMAT (JSON):
{
  "narrative": "Die professionelle Produktbeschreibung in 4-5 Sätzen."
}`,

  userPrompt: (context: PromptContext) => `Produktdaten:
${JSON.stringify(context.productData, null, 2)}

Schreibe die Produktbeschreibung als JSON.`
};
