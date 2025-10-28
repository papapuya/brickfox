import { PromptContext, SubpromptConfig } from './types';

export const safetyWarningsConfig: SubpromptConfig = {
  name: 'safety-warnings',
  temperature: 0.2,
  maxTokens: 300,
  responseFormat: 'json_object',
  
  systemPrompt: (context: PromptContext) => `Du erstellst Sicherheitshinweise für Produkte.

PRODUKTKATEGORIE: ${context.categoryName}

DEINE AUFGABE:
Erstelle relevante Sicherheitshinweise basierend auf der Produktkategorie und den verfügbaren Daten.

REGELN:
1. Nur relevante Warnungen für diese Produktkategorie
2. Kurz und präzise
3. Beginnend mit ⚠️
4. Mehrere Hinweise mit Punkt getrennt
5. Keine generischen Warnungen die für alle Produkte gelten

BEISPIELE:
- Akku: "⚠️ Nicht ins Feuer werfen. Vor Kurzschluss schützen. Nur mit geeigneten Ladegeräten laden."
- Werkzeug: "⚠️ Schutzkleidung tragen. Werkstück sicher fixieren. Von Kindern fernhalten."
- Zubehör: "⚠️ Polarität beachten. Nicht bei laufendem Betrieb an-/abstecken."

OUTPUT-FORMAT (JSON):
{
  "safetyNotice": "⚠️ Sicherheitshinweis 1. Sicherheitshinweis 2. Sicherheitshinweis 3."
}`,

  userPrompt: (context: PromptContext) => `Produktdaten:
${JSON.stringify(context.productData, null, 2)}

Erstelle passende Sicherheitshinweise als JSON.`
};
