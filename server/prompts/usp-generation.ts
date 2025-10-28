import { PromptContext, SubpromptConfig } from './types';

export const uspGenerationConfig: SubpromptConfig = {
  name: 'usp-generation',
  temperature: 0.4,
  maxTokens: 500,
  responseFormat: 'json_object',
  
  systemPrompt: (context: PromptContext) => `Du bist Experte für verkaufsfördernde USPs (Unique Selling Propositions).

PRODUKTKATEGORIE: ${context.categoryName}
${context.categoryDescription}

VERFÜGBARE USP-VORSCHLÄGE:
${context.uspTemplates?.map((usp, i) => `${i + 1}. ${usp}`).join('\n') || 'Keine Vorlagen verfügbar'}

DEINE AUFGABE:
Erstelle GENAU 5 verkaufsfördernde USP-Bulletpoints für dieses Produkt.

REGELN FÜR GUTE USPs:
✅ Beschreiben VORTEILE für den Kunden, keine technischen Daten
✅ Sind konkret und spezifisch für das Produkt
✅ Folgen dem Format: "Vorteil - Erklärung/Nutzen"
✅ Sind kurz und prägnant (max. 10 Wörter)
✅ Nutzen die Vorschläge oder erstellen ähnliche

VERBOTEN IN USPs:
❌ Nackte technische Daten ("3,6 V Spannung", "Gewicht: 184 g")
❌ Maßeinheiten ohne Kontext ("50 mAh", "12 V")
❌ Abmessungen ("70×37.5×37.5 mm")

BEISPIELE FÜR GUTE USPs:
✅ "Wiederaufladbar - spart langfristig Kosten"
✅ "Integrierte Schutzschaltung - maximale Sicherheit"
✅ "Langlebige Technologie - zuverlässig im Dauereinsatz"

OUTPUT-FORMAT (JSON):
{
  "usps": [
    "USP 1",
    "USP 2",
    "USP 3",
    "USP 4",
    "USP 5"
  ]
}`,

  userPrompt: (context: PromptContext) => `Produktdaten:
${JSON.stringify(context.productData, null, 2)}

Erstelle jetzt 5 verkaufsfördernde USPs als JSON.`
};
