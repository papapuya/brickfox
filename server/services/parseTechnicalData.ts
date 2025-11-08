import OpenAI from "openai";

/**
 * Holt den OpenAI API Key (unterstützt verschiedene Quellen)
 */
function getOpenAIKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

/**
 * Erstellt einen OpenAI Client mit korrektem API Key
 */
function createOpenAIClient(): OpenAI | null {
  const apiKey = getOpenAIKey();
  if (!apiKey || apiKey === 'dein-api-schlüssel-hier') {
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * System-Prompt für strukturierten Produktdaten-Parser
 * Zielstruktur: Immer gleich für Akkushop.de
 */
const PARSER_SYSTEM_PROMPT = `Du bist ein strukturierter Produktdaten-Parser für Akkushop.de.

Du erhältst Rohdaten aus einem Web-Scraper im JSON-Format.

Analysiere die Felder "technicalDataTable", "autoExtractedDescription" und "rawHtml". 

Wenn "technicalDataTable" leer ist, nutze stattdessen "rawHtml" oder "autoExtractedDescription".

Erkenne alle technischen Angaben aus dem Text und extrahiere sie semantisch.

WICHTIG: Verwende IMMER diese exakte Zielstruktur (immer gleich für Akkushop.de):

{
  "Spannung": "",
  "Kapazität": "",
  "Zellchemie": "",
  "Zellengröße": "",
  "Maße": "",
  "Gewicht": "",
  "Artikelnummer": "",
  "EAN": "",
  "Verpackungseinheit": ""
}

Regeln:
- Wenn ein Wert nicht gefunden wird, lasse das Feld leer ("").
- Spannung: Suche nach "Spannung", "Nominal-Spannung", "Nominal Spannung", "Voltage", "V" - Format wie "1.2 V", "1,2 V", "3.7 V"
- Kapazität: Suche nach "Kapazität", "Nominal-Kapazität", "Nominal Kapazität", "Capacity", "mAh" - Format wie "2850 mAh", "1100 mAh"
- Zellchemie: Suche nach "Zellchemie", "Zellenchemie", "Chemistry", "Chemie" - z.B. "NiMH", "Nickel-Metallhydrid", "Li-Ion", "LiFePO4", "Alkaline", "Lithium"
- Zellengröße: Suche nach "Zellengröße", "Zellgröße", "Cell Size", "Size" - z.B. "Mignon AA", "Micro AAA", "CR2", "CR15270", "LR6", "LR03"
- Maße: Format wie "50 × 30 × 20 mm" oder "50x30x20mm" oder "Länge × Breite × Höhe"
- Gewicht: Format wie "25 g" oder "100 g"
- Artikelnummer: Original-Format beibehalten (z.B. "1520-0010")
- EAN: 13-stellige Zahl
- Verpackungseinheit: z.B. "4", "1", "Blister", "Karton"

WICHTIG: Erkenne auch Varianten der Feldnamen:
- "Nominal-Spannung" → mappe zu "Spannung"
- "Nominal-Kapazität" → mappe zu "Kapazität"
- "Zellenchemie" → mappe zu "Zellchemie"

Übersetze englische Begriffe ins Deutsche.
Ignoriere Marketingtexte und Beschreibungen.
Fokussiere nur auf technische Daten.`;

/**
 * Parst technische Daten aus Scraper-Rohdaten mit GPT-4o-mini
 */
export async function parseTechnicalData(scrapedData: any): Promise<Record<string, string>> {
  const client = createOpenAIClient();
  
  if (!client) {
    console.warn('[parseTechnicalData] OPENAI_API_KEY nicht gesetzt, verwende Fallback-Parser');
    return {};
  }

  try {
    // Debug: Zeige ersten Teil des rawHtml
    if (scrapedData.rawHtml) {
      console.log('[parseTechnicalData] rawHtml preview:', scrapedData.rawHtml.slice(0, 500));
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: PARSER_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: JSON.stringify(scrapedData, null, 2)
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.warn('[parseTechnicalData] Keine Antwort von GPT erhalten');
      return {};
    }

    const parsed = JSON.parse(content);
    console.log('[parseTechnicalData] GPT-Parser Ergebnis:', parsed);
    return parsed;
  } catch (error: any) {
    console.error('[parseTechnicalData] Fehler beim Parsen:', error.message);
    // Bei Fehler leeres Objekt zurückgeben
    return {};
  }
}

