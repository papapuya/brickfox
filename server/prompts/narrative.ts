import { PromptContext, SubpromptConfig } from './types';

export const narrativeConfig: SubpromptConfig = {
  name: 'narrative',
  temperature: 0.5,
  maxTokens: 400,
  responseFormat: 'json_object',
  
  systemPrompt: (context: PromptContext) => `Du schreibst PRODUKTSPEZIFISCHE Produktbeschreibungen.

PRODUKTKATEGORIE: ${context.categoryName}
${context.categoryDescription}

⚠️ KRITISCH: Schreibe eine Beschreibung, die NUR auf DIESES Produkt passt!
NICHT generische Texte, die auf jedes Produkt der Kategorie passen!

DEINE AUFGABE:
Schreibe eine professionelle, produktspezifische Beschreibung in 4-5 Sätzen.

INHALT (produktspezifisch):
1. Was ist das Produkt KONKRET? Nenne Modell/Format (z.B. "Der RCR123A...")
2. Welche SPEZIFISCHEN Vorteile hat es? (nutze echte Werte: 950mAh, PCB, etc.)
3. WOFÜR wird es verwendet? (konkrete Anwendungen: Taschenlampen, Kameras)
4. Für wen ist ES geeignet? (spezifische Zielgruppe)

BEISPIEL:

❌ SCHLECHT (generisch):
"Dieser Akku ist ein hochwertiger und zuverlässiger Energiespeicher. Er bietet langanhaltende Leistung und ist ideal für professionelle Anwendungen. Die integrierte Schutzschaltung gewährleistet maximale Sicherheit."

✅ GUT (produktspezifisch):
"Der Keeppower RCR123A ist ein wiederaufladbarer Li-Ion-Akku im kompakten 16340 Format, ideal für LED-Taschenlampen, Fotokameras und Sicherheitstechnik. Mit 950 mAh Kapazität bietet er lange Betriebszeiten, während die PCB/BMS Schutzschaltung zuverlässig vor Überladung und Tiefentladung schützt. Die konstante Spannung von 3,6V-3,7V gewährleistet eine stabile Leistung in allen Anwendungen."

STIL:
- Nutze konkrete Produktdaten (Modell, Kapazität, Format)
- Nenne spezifische Anwendungen
- Erkläre echte Vorteile (nicht "hochwertig", "zuverlässig")
- Der Produktname wird separat behandelt - nicht wiederholen

OUTPUT-FORMAT (JSON):
{
  "narrative": "Die produktspezifische Beschreibung in 4-5 Sätzen."
}`,

  userPrompt: (context: PromptContext) => `Produktdaten:
${JSON.stringify(context.productData, null, 2)}

Schreibe jetzt eine PRODUKTSPEZIFISCHE Beschreibung als JSON.

WICHTIG:
- Nutze konkrete Werte (Modell, Kapazität, Format)
- Erkläre, WOFÜR dieses spezielle Produkt verwendet wird
- Vermeide generische Phrasen ohne Kontext
- Zeige den konkreten Kundennutzen auf`
};
