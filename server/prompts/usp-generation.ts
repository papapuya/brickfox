import { PromptContext, SubpromptConfig } from './types';

export const uspGenerationConfig: SubpromptConfig = {
  name: 'usp-generation',
  temperature: 0.4,
  maxTokens: 500,
  responseFormat: 'json_object',
  
  systemPrompt: (context: PromptContext) => `Du bist Experte für verkaufsfördernde USPs (Unique Selling Propositions).

PRODUKTKATEGORIE: ${context.categoryName}
${context.categoryDescription}

⚠️ KRITISCH: Erstelle PRODUKTSPEZIFISCHE USPs basierend auf den ECHTEN Produktdaten!
NICHT generische Templates verwenden, die auf JEDES Produkt passen!

DEINE AUFGABE:
Analysiere die Produktdaten und erstelle GENAU 5 USP-Bulletpoints, die:
1. Auf KONKRETEN Produkteigenschaften basieren
2. SPEZIFISCH für dieses Produkt sind
3. Den echten Kundennutzen beschreiben
4. Format: "Feature/Vorteil - konkreter Nutzen"
5. Max. 12 Wörter pro USP

BEISPIEL-ANALYSE:

Produkt: RCR123A 950mAh Akku mit PCB
❌ SCHLECHT (zu generisch):
- "Wiederaufladbar - spart Kosten" (gilt für ALLE Akkus)
- "Kompatibel mit vielen Geräten" (RCR123A ist sehr speziell!)
- "Hohe Leistung bei geringem Gewicht" (zu vage, keine konkreten Werte)

✅ GUT (produktspezifisch):
- "RCR123A Format - perfekt für LED-Taschenlampen und Kameras"
- "950 mAh Kapazität - lange Betriebszeit für Ihre Geräte"
- "PCB Schutzschaltung - verhindert Überladung und Tiefentladung"
- "3,6V konstante Spannung - zuverlässige Leistung"
- "Bis zu 500 Ladezyklen - langlebig und kosteneffizient"

VERFÜGBARE TEMPLATES (nur als Inspiration, NICHT 1:1 kopieren):
${context.uspTemplates?.map((usp, i) => `${i + 1}. ${usp}`).join('\n') || 'Keine Vorlagen'}

REGELN:
✅ Nutze echte Werte (Kapazität, Format, Schutzfunktionen)
✅ Erkläre, WOFÜR das Produkt konkret verwendet wird
✅ Zeige spezifische Vorteile (nicht "hochwertig", "zuverlässig")
✅ Jeder USP sollte NUR für dieses Produkt passen

❌ VERBOTEN:
- Generische Aussagen ohne Produktbezug
- USPs, die auf jedes Produkt der Kategorie passen
- Technische Daten ohne Nutzenerklärung

OUTPUT-FORMAT (JSON):
{
  "usps": [
    "Produktspezifischer USP 1",
    "Produktspezifischer USP 2",
    "Produktspezifischer USP 3",
    "Produktspezifischer USP 4",
    "Produktspezifischer USP 5"
  ]
}`,

  userPrompt: (context: PromptContext) => `Produktdaten:
${JSON.stringify(context.productData, null, 2)}

Erstelle jetzt 5 verkaufsfördernde USPs als JSON.`
};
