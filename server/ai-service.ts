import OpenAI from 'openai';

// Debug logging helper - only logs when DEBUG_MODE=true
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
function debugLog(...args: any[]) {
  if (DEBUG_MODE) {
    console.log('[AI Service DEBUG]', ...args);
  }
}

/**
 * Analyzes a product image using OpenAI Vision API to detect the dominant color
 * @param imageUrl - URL of the product image to analyze
 * @returns Detected color in German (schwarz, gelb, rot, blau, grün, weiß, grau, etc.)
 */
export async function analyzeProductImageColor(imageUrl: string): Promise<string> {
  try {
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      console.warn('[Image Color Analysis] OpenAI API key nicht konfiguriert - überspringe Farbanalyse');
      return '';
    }
    
    const openai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    console.log(`[Image Color Analysis] Analysiere Produktbild: ${imageUrl}`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für visuelle Produktanalyse. 
          
Analysiere das Produktbild und erkenne die HAUPTFARBE des Akkupacks/der Batterie.

WICHTIG:
- Ignoriere den Hintergrund
- Fokussiere auf das Gehäuse/die Ummantelung des Akkupacks
- Gib NUR die Farbe auf Deutsch zurück (ein Wort)
- Erlaubte Farben: schwarz, gelb, rot, blau, grün, weiß, grau, orange, silber

Beispiele:
- Schwarzes Akkupack → "schwarz"
- Gelbes Schrumpfschlauch → "gelb"
- Rote Ummantelung → "rot"
- Blaue Batterie → "blau"`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Welche Farbe hat dieser Akkupack/diese Batterie?'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'low' // Low detail für schnellere/günstigere Analyse
              }
            }
          ]
        }
      ],
      max_tokens: 10,
      temperature: 0.3 // Niedrige Temperature für konsistente Ergebnisse
    });
    
    const detectedColor = response.choices[0]?.message?.content?.trim().toLowerCase() || '';
    console.log(`[Image Color Analysis] Erkannte Farbe: ${detectedColor}`);
    
    // Validierung: Nur erlaubte Farben zurückgeben
    const validColors = ['schwarz', 'gelb', 'rot', 'blau', 'grün', 'weiß', 'grau', 'orange', 'silber'];
    if (validColors.includes(detectedColor)) {
      return detectedColor;
    } else {
      console.warn(`[Image Color Analysis] Unbekannte Farbe erkannt: ${detectedColor}`);
      return '';
    }
    
  } catch (error) {
    console.error('[Image Color Analysis] Fehler bei Bildanalyse:', error);
    return '';
  }
}

// Helper function to clean HTML responses from markdown code blocks
function cleanHTMLResponse(content: string): string {
  // Remove markdown code blocks (```html, ```, etc.)
  let cleaned = content.replace(/^```(?:html|HTML)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  cleaned = cleaned.replace(/^```html\s*\n?/gm, '');
  cleaned = cleaned.replace(/^```\s*\n?/gm, '');
  
  // KRITISCH: Entferne ✅ Icons aus Überschriften (MediaMarkt: nur in <li>)
  cleaned = cleaned.replace(/<h[1-6]>✅\s*([^<]+)<\/h[1-6]>/g, '<h3>$1</h3>');
  cleaned = cleaned.replace(/<h[1-6]>\s*✅\s*([^<]+)<\/h[1-6]>/g, '<h3>$1</h3>');
  
  // MediaMarkt: Fix wrong h4 to h3
  cleaned = cleaned.replace(/<h4>/g, '<h3>');
  cleaned = cleaned.replace(/<\/h4>/g, '</h3>');
  
  // Remove unwanted accessibility USPs (in <li> or <p>)
  const unwantedPatterns = [
    /<li>✅\s*Drücken Sie die Eingabetaste.*?<\/li>/gi,
    /<li>✅\s*Barrierefreiheit.*?<\/li>/gi,
    /<li>✅\s*Screenreader.*?<\/li>/gi,
    /<li>✅\s*Menü.*?<\/li>/gi,
    /<li>✅\s*Eingabetaste.*?<\/li>/gi,
    /<li>✅\s*Blinde.*?<\/li>/gi,
    /<p>✅\s*Drücken Sie die Eingabetaste.*?<\/p>/gi,
    /<p>✅\s*Barrierefreiheit.*?<\/p>/gi,
  ];
  
  unwantedPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // MediaMarkt: Count <li> items in Vorteile section (should be 5)
  const uspMatches = cleaned.match(/<li>✅.*?<\/li>/g);
  const uspCount = uspMatches ? uspMatches.length : 0;
  
  if (uspCount < 5) {
    const fallbackUSPs = [
      '<li>✅ Hochwertige Verarbeitung für lange Lebensdauer</li>',
      '<li>✅ Zuverlässige Leistung im Dauereinsatz</li>',
      '<li>✅ Einfache Handhabung und Bedienung</li>',
      '<li>✅ Optimales Preis-Leistungs-Verhältnis</li>',
      '<li>✅ Vielseitig einsetzbar</li>'
    ];
    
    // Find Vorteile section and ensure it has <ul>
    const vorteileSection = cleaned.match(/<h3>Vorteile & Eigenschaften<\/h3>[\s\S]*?(?=<h3>|$)/);
    if (vorteileSection) {
      const newVorteileSection = `<h3>Vorteile & Eigenschaften</h3>\n<ul>\n${fallbackUSPs.join('\n')}\n</ul>`;
      cleaned = cleaned.replace(vorteileSection[0], newVorteileSection);
    }
  }
  
  cleaned = cleaned.trim();
  return cleaned;
}

// Helper functions to convert units
function convertWeightToGrams(weightStr: string): string {
  // Convert kg to g
  const kgMatch = weightStr.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kgMatch) {
    const kgValue = parseFloat(kgMatch[1].replace(',', '.'));
    const grams = Math.round(kgValue * 1000);
    return weightStr.replace(kgMatch[0], `${grams} g`);
  }
  
  // If already in grams, return as is
  return weightStr;
}

function convertDimensionsToMm(dimensionsStr: string): string {
  // Convert cm to mm
  const cmMatch = dimensionsStr.match(/(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  if (cmMatch) {
    const dim1 = Math.round(parseFloat(cmMatch[1].replace(',', '.')) * 10);
    const dim2 = Math.round(parseFloat(cmMatch[2].replace(',', '.')) * 10);
    const dim3 = Math.round(parseFloat(cmMatch[3].replace(',', '.')) * 10);
    return dimensionsStr.replace(cmMatch[0], `${dim1} × ${dim2} × ${dim3} mm`);
  }
  
  // If already in mm, return as is
  return dimensionsStr;
}

// Helper function to convert units in extracted text
function convertUnitsInText(text: string): string {
  let convertedText = text;
  
  // Convert weight from kg to g
  convertedText = convertedText.replace(/(\d+(?:[.,]\d+)?)\s*kg/gi, (match, value) => {
    const kgValue = parseFloat(value.replace(',', '.'));
    const grams = Math.round(kgValue * 1000);
    return `${grams} g`;
  });
  
  // Convert dimensions from cm to mm
  convertedText = convertedText.replace(/(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*cm/gi, (match, dim1, dim2, dim3) => {
    const d1 = Math.round(parseFloat(dim1.replace(',', '.')) * 10);
    const d2 = Math.round(parseFloat(dim2.replace(',', '.')) * 10);
    const d3 = Math.round(parseFloat(dim3.replace(',', '.')) * 10);
    return `${d1} × ${d2} × ${d3} mm`;
  });
  
  return convertedText;
}

// Helper function to clean extracted text from markdown formatting
function cleanExtractedText(content: string): string {
  // Remove markdown code blocks (```plaintext, ```, etc.)
  let cleaned = content.replace(/^```(?:plaintext|html|HTML)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  
  // Remove ALL occurrences of markdown bold indicators (**)
  cleaned = cleaned.replace(/\*\*/g, '');
  
  // Remove ALL occurrences of markdown italic indicators (*)
  cleaned = cleaned.replace(/\*/g, '');
  
  // Remove any remaining markdown formatting
  cleaned = cleaned.trim();
  
  // Convert units in the cleaned text
  cleaned = convertUnitsInText(cleaned);
  
  return cleaned;
}

// Initialize OpenAI with API key from config or environment
let openai: OpenAI | null = null;

import { getSecureOpenAIKey } from './api-key-manager';

// Function to get current API key from secure manager
function getOpenAIKey(): string | null {
  return getSecureOpenAIKey();
}

function getOpenAIBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
}

// Initialize OpenAI with current API key
const apiKey = getOpenAIKey();
const baseUrl = getOpenAIBaseUrl();

if (apiKey && apiKey !== 'dein-api-schlüssel-hier') {
  openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });
}

export interface FileAnalysisResult {
  fileName: string;
  fileType: 'csv';
  extractedText: string;
  structuredData?: Record<string, any>;
  confidence?: number;
}

export async function analyzeCSV(text: string, fileName: string): Promise<FileAnalysisResult> {
  const lines = text.split('\n').filter(line => line.trim());
  const headers = lines[0]?.split(/[,;\t]/).map(h => h.trim()) || [];
  const rows = lines.slice(1).map(line => {
    const values = line.split(/[,;\t]/).map(v => v.trim());
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index] || '';
      return obj;
    }, {} as Record<string, string>);
  });

  return {
    fileName,
    fileType: 'csv',
    extractedText: cleanExtractedText(text),
    structuredData: { headers, rows },
    confidence: 1.0,
  };
}

export async function generateProductDescription(
  extractedData: any[],
  template?: string,
  customAttributes?: {
    exactProductName?: string;
    articleNumber?: string;
    customAttributes?: Array<{key: string, value: string, type: string}>;
    structuredData?: Record<string, any>; // WICHTIG: Strukturierte Daten (length, led1, led2, etc.)
    technicalDataTable?: string; // Original HTML table from supplier
    safetyWarnings?: string; // 1:1 safety warnings from supplier
    pdfManualUrl?: string; // PDF manual URL
  },
  model: string = 'gpt-4o-mini', // COST OPTIMIZATION: 30× günstiger!
  onProgress?: (step: number, message: string) => void
): Promise<string> {
  console.log(`=== USING CATEGORY-BASED GENERATION with ${model} ===`);
  
  const { detectCategory, getCategoryConfig } = await import('./templates/category-config.js');
  const { generateProductCopy } = await import('./templates/ai-generator.js');
  const { renderProductHtml } = await import('./templates/renderer.js');
  
  const currentApiKey = getOpenAIKey();
  const currentBaseUrl = getOpenAIBaseUrl();
  
  if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
    throw new Error('OpenAI API key nicht konfiguriert');
  }

  const firstData = extractedData[0] || {};
  const productName = customAttributes?.exactProductName || firstData.productName || firstData.product_name || '';
  
  // WICHTIG: Strukturierte Daten (length, led1, led2, maxLuminosity, etc.) mit productData zusammenführen
  const enrichedProductData = {
    ...firstData,
    ...(customAttributes?.structuredData || {})  // Technische Felder hinzufügen
  };
  
  console.log('📦 [AI-SERVICE] Enriched product data fields:', Object.keys(enrichedProductData));
  console.log('📦 [AI-SERVICE] Nitecore fields:', {
    length: enrichedProductData.length,
    led1: enrichedProductData.led1,
    led2: enrichedProductData.led2,
    maxLuminosity: enrichedProductData.maxLuminosity
  });
  
  const categoryId = detectCategory(enrichedProductData);
  const categoryConfig = getCategoryConfig(categoryId);
  
  console.log(`Detected category: ${categoryId} (${categoryConfig.name})`);

  const copy = await generateProductCopy(
    enrichedProductData,  // WICHTIG: Angereicherte Daten übergeben!
    categoryConfig,
    currentApiKey,
    currentBaseUrl,
    model  // Pass model to AI generator
  );

  const html = renderProductHtml({
    productName,
    categoryConfig,
    copy,
    layoutStyle: 'mediamarkt',
    technicalDataTable: customAttributes?.technicalDataTable, // Pass original HTML table
    safetyWarnings: customAttributes?.safetyWarnings, // Pass 1:1 safety warnings
    pdfManualUrl: customAttributes?.pdfManualUrl // Pass PDF URL
  });

  return html;
}

export async function convertTextToHTML(
  plainText: string,
  extractedData?: string[]
): Promise<string> {
  try {
    // Get current API key
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      console.log('OpenAI API key not configured. Returning fallback description.');
      return 'OpenAI API key nicht konfiguriert. Bitte konfigurieren Sie den API-Schlüssel.';
    }
    
    // Create OpenAI instance with current key
    const currentOpenai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const dataContext = extractedData?.length 
      ? `\n\nZusätzliche Produktdaten:\n${extractedData.join('\n\n---\n\n')}`
      : '';

    const response = await currentOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für MediaMarkt-Produktbeschreibungen. Erstelle eine HTML-Produktbeschreibung nach MediaMarkt-Standard.

MEDIAMARKT HTML-STRUKTUR (EXAKT SO):

<h2>Produktname</h2>
<p>Einleitungstext (1-2 Sätze über das Produkt)</p>

<h3>Vorteile & Eigenschaften</h3>
<ul>
<li>✅ Vorteil 1 - verkaufsfördernde Beschreibung</li>
<li>✅ Vorteil 2 - verkaufsfördernde Beschreibung</li>
<li>✅ Vorteil 3 - verkaufsfördernde Beschreibung</li>
<li>✅ Vorteil 4 - verkaufsfördernde Beschreibung</li>
<li>✅ Vorteil 5 - verkaufsfördernde Beschreibung</li>
</ul>

<h3>Technische Daten</h3>
<table border="0" cellspacing="0" cellpadding="4">
<tbody>
<tr><td><strong>Feldname:</strong></td><td>Wert</td></tr>
...
</tbody>
</table>

<h3>Sicherheit & Technologie</h3>
<p>Beschreibung (NUR wenn relevante Daten vorhanden)</p>

<h3>Lieferumfang</h3>
<p>1 × Produktname</p>

KRITISCHE REGELN:
- IMMER <h2> für Produktname, IMMER <h3> für Überschriften
- Vorteile IMMER als <ul><li>✅ Text</li></ul> (NICHT als <p>)
- ✅ Icons NUR in <li>, NIEMALS in Überschriften
- Technische Daten IMMER in <table> (1:1 vom Lieferanten kopiert)
- "Sicherheit & Technologie" NUR wenn relevante Daten vorhanden
- Lieferumfang immer am Ende

❌ VERBOTEN in Vorteilen: Technische Specs (Volt, mAh, Gramm, mm, etc.)
✅ ERLAUBT in Vorteilen: Verkaufsargumente ("Lange Laufzeit", "Sicher durch Schutzschaltung", etc.)

Gib NUR den reinen HTML-Code zurück, OHNE \`\`\`html oder \`\`\`.`,
        },
        {
          role: 'user',
          content: `Erstelle MediaMarkt-Produktbeschreibung aus:\n\n${plainText}${dataContext}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.5,
    });

    const generatedContent = response.choices[0]?.message?.content || '';
    
    // Clean up the response to remove markdown code blocks
    return cleanHTMLResponse(generatedContent);
  } catch (error) {
    throw new Error(`Text to HTML conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function refineDescription(
  currentDescription: string,
  userPrompt: string,
  extractedData?: string[]
): Promise<string> {
  try {
    // Get current API key
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      console.log('OpenAI API key not configured. Returning fallback description.');
      return 'OpenAI API key nicht konfiguriert. Bitte konfigurieren Sie den API-Schlüssel.';
    }
    
    // Create OpenAI instance with current key
    const currentOpenai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const dataContext = extractedData?.length 
      ? `\n\nVerfügbare Produktdaten:\n${extractedData.join('\n\n---\n\n')}`
      : '';

    const response = await currentOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für E-Commerce-Produktbeschreibungen. 
Verfeinere die bestehende HTML-Produktbeschreibung basierend auf den Anweisungen des Users.

WICHTIG: Erstelle KEINE feste Struktur! Passe die Struktur an die verfügbaren Daten an.

Wichtig:
- Behalte die HTML-Struktur bei
- Setze die Änderungen präzise um
- Gib NUR den reinen HTML-Code zurück, OHNE \`\`\`html am Anfang oder \`\`\` am Ende
- Verwende KEINE Markdown-Codeblöcke oder zusätzliche Erklärungen
- Für technische Daten in Tabellen: Abmessungen in mm, Gewicht in g
- KEINE festen Sektionen - nur das was Daten hat
- Passe die Struktur an die verfügbaren Daten an`,
        },
        {
          role: 'user',
          content: `Aktuelle Produktbeschreibung:\n\n${currentDescription}\n\nÄnderungswunsch: ${userPrompt}${dataContext}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const generatedContent = response.choices[0]?.message?.content || '';
    
    // Clean up the response to remove markdown code blocks
    return cleanHTMLResponse(generatedContent);
  } catch (error) {
    throw new Error(`Description refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateProductName(
  extractedData: string[]
): Promise<string> {
  try {
    // Get current API key
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      console.log('OpenAI API key not configured. Returning fallback description.');
      return 'OpenAI API key nicht konfiguriert. Bitte konfigurieren Sie den API-Schlüssel.';
    }
    
    // Create OpenAI instance with current key
    const currentOpenai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const combinedData = extractedData.join('\n\n---\n\n');

    const response = await currentOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für E-Commerce-Produktnamen. 
Generiere einen kurzen, prägnanten Produktnamen basierend auf den extrahierten Produktdaten.

Der Produktname sollte:
- Maximal 60 Zeichen lang sein
- Den wichtigsten Produkttyp und die Marke enthalten
- Klar und professionell formuliert sein
- Ohne Anführungszeichen oder Sonderformatierung sein
- Im Format: "Marke Produkttyp Modell/Variante" (z.B. "Varta Wiederaufladbare AA-Batterie USB")

Gib NUR den Produktnamen zurück, ohne zusätzliche Erklärungen oder Formatierung.`,
        },
        {
          role: 'user',
          content: `Extrahierte Produktdaten:\n\n${combinedData}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.5,
    });

    let productName = response.choices[0]?.message?.content || '';
    
    // Clean up the product name
    productName = productName.replace(/^["']|["']$/g, '').trim();
    
    return productName;
  } catch (error) {
    throw new Error(`Product name generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ===== NEUER 3-STUFEN WORKFLOW =====

// ===== SCHRITT 1: DATENEXTRAKTION =====
export async function extractProductData(htmlOrText: string): Promise<any> {
  try {
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      throw new Error('OpenAI API key nicht konfiguriert');
    }
    
    const openai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const systemPrompt = `Du bist ein Datenextraktions-Agent für Produktseiten.

⚙️ Wichtige Regeln:
1. Ignoriere jegliche vorherige Inhalte, Zwischenspeicher oder temporäre Variablen.  
   Erstelle die Ausgabe **ausschließlich basierend auf der aktuellen Eingabe (input)**.  
   Verwende keine Daten aus Cache, Memory, Session oder Response-Historie.
2. Verarbeite jede Anfrage als **vollständig neuen Kontext**.
3. Deine Ausgabe muss **ausschließlich valides JSON** sein — keine Markdown-Zeichen, keine Code-Blöcke.
4. Der JSON-Code beginnt immer mit { und endet mit }.
5. Wenn du alten oder fehlerhaften Inhalt erkennst, **überschreibe den gesamten Inhalt neu**.

Analysiere den folgenden HTML- oder Textinhalt einer Lieferantenseite und extrahiere nur die relevanten Produktinformationen.

Liefere das Ergebnis ausschließlich als gültiges JSON im folgenden Format:

{
  "product_name": "",
  "short_intro": "",
  "features": [],
  "performance": {
    "flutlicht": {},
    "spotlicht": {},
    "mix": {}
  },
  "technical_data": {},
  "use_cases": [],
  "safety_notes": "",
  "package_contents": ""
}

Regeln:
- Extrahiere nur das Hauptprodukt (keine Zubehörartikel oder Alternativen).
- Falls ein Wert fehlt, lasse das Feld leer ("").
- Werte aus Tabellen oder Stichpunkten korrekt übernehmen.
- Leistungsdaten (Lumen, Stunden, Modi etc.) sollen als Key-Value-Paare übernommen werden.
- Entferne HTML-Tags, behalte nur reinen Text.
- Achte auf Sonderzeichen (ä, ö, ü) in Unicode (nicht als Entities).

Beispielausgabe:
{
  "product_name": "Nitecore P40 - LEP-Laser Lampe, 2000 Lumen",
  "short_intro": "Leistungsstarke LEP-Taschenlampe mit 2000 Lumen und 2900 m Reichweite.",
  "features": [
    "Bis zu 2000 Lumen Lichtleistung",
    "Drei Lichtmodi: Spot-, Flut- und Mixbetrieb",
    "HAIII eloxiertes Aluminiumgehäuse, IP68",
    "USB-C Schnellladefunktion"
  ],
  "performance": {
    "flutlicht": {
      "high": "800 Lumen – 2h30min",
      "mid": "400 Lumen – 4h",
      "low": "100 Lumen – 20h"
    },
    "spotlicht": {
      "turbo": "2000 Lumen – 1h",
      "high": "400 Lumen – 2h30min",
      "mid": "200 Lumen – 3h45min",
      "low": "50 Lumen – 20h"
    }
  },
  "technical_data": {
    "Leuchtweite": "2900 m",
    "Gewicht": "186 g",
    "Akku": "21700 Li-Ion 5500 mAh",
    "Wasserschutz": "IP68"
  },
  "use_cases": ["Outdoor", "Polizei", "Jagd"],
  "safety_notes": "Nur mit geeigneten Akkus betreiben, nicht in Augen leuchten.",
  "package_contents": "Lampe, Akku, Holster, USB-C-Kabel, Ersatzringe"
}

Die Ausgabe ist valides JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: htmlOrText }
      ],
      temperature: 0.1,
    });

    const jsonString = response.choices[0]?.message?.content?.trim() || '{}';
    
    // Parse JSON und validieren
    try {
      // Clean JSON response - remove markdown code blocks
      let cleanedContent = jsonString;
      cleanedContent = cleanedContent.replace(/^```json\s*\n?/gm, '');
      cleanedContent = cleanedContent.replace(/\n?```\s*$/gm, '');
      cleanedContent = cleanedContent.replace(/^```\s*\n?/gm, '');
      cleanedContent = cleanedContent.trim();
      
      console.log('Cleaned JSON:', cleanedContent);
      
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response:', jsonString);
      throw new Error('KI konnte keine gültigen JSON-Daten extrahieren');
    }
    
  } catch (error) {
    console.error('ExtractProductData error:', error);
    throw error;
  }
}

// ===== SCHRITT 2: VALIDIERUNG & NORMALISIERUNG =====
export function normalizeProductData(input: any): any {
  const data = typeof input === "string" ? JSON.parse(input) : input;

  // Konvertiere Gewicht zu Gramm
  const convertWeightToGrams = (weightStr: string): string => {
    if (!weightStr || weightStr === 'Nicht angegeben') return 'Nicht angegeben';
    
    const weight = parseFloat(weightStr.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(weight)) return weightStr;
    
    if (weightStr.toLowerCase().includes('kg')) {
      return `${Math.round(weight * 1000)} g`;
    } else if (weightStr.toLowerCase().includes('g')) {
      return `${Math.round(weight)} g`;
    } else {
      return `${Math.round(weight)} g`;
    }
  };
  
  // Konvertiere Abmessungen zu mm
  const convertDimensionsToMm = (dimStr: string): string => {
    if (!dimStr || dimStr === 'Nicht angegeben') return 'Nicht angegeben';
    
    // Wenn bereits mm enthalten, zurückgeben
    if (dimStr.toLowerCase().includes('mm')) return dimStr;
    
    // Wenn cm enthalten, zu mm konvertieren
    if (dimStr.toLowerCase().includes('cm')) {
      const numbers = dimStr.match(/[\d.,]+/g);
      if (numbers) {
        const converted = numbers.map(num => {
          const val = parseFloat(num.replace(',', '.'));
          return isNaN(val) ? num : String(Math.round(val * 10));
        });
        // Ersetze Zahlen und entferne "cm", füge "mm" hinzu
        let idx = 0;
        return dimStr.replace(/[\d.,]+/g, () => converted[idx++]).replace(/cm/gi, '') + ' mm';
      }
    }
    
    return dimStr;
  };

  // Konvertiere Gewicht und Abmessungen
  if (data.weight) {
    data.weight = convertWeightToGrams(data.weight);
  }
  if (data.size) {
    data.size = convertDimensionsToMm(data.size);
  }
  if (data.abmessungen) {
    data.abmessungen = convertDimensionsToMm(data.abmessungen);
  }
  if (data.gewicht) {
    data.gewicht = convertWeightToGrams(data.gewicht);
  }

  // Standardwerte ergänzen
  if (!data.safety_notes) {
    data.safety_notes = "Bitte beachten Sie die Sicherheitsanweisungen des Herstellers zur sicheren Verwendung des Produkts.";
  }

  if (!data.package_contents) {
    data.package_contents = "Lieferumfang: Produkt wie beschrieben.";
  }

  if (!data.use_cases || data.use_cases.length === 0) {
    data.use_cases = ["Haushalt", "Werkstatt", "Outdoor"];
  }

  // Einheitliche Reihenfolge erzwingen
  const ordered = {
    product_name: data.product_name || "",
    short_intro: data.short_intro || "",
    features: data.features || [],
    performance: data.performance || {},
    technical_data: data.technical_data || {},
    use_cases: data.use_cases || [],
    safety_notes: data.safety_notes || "",
    package_contents: data.package_contents || "",
    // Füge konvertierte Werte hinzu
    leistung: data.leistung || data.power || 'Nicht angegeben',
    spannung: data.spannung || data.voltage || 'Nicht angegeben',
    gewicht: data.gewicht || data.weight || 'Nicht angegeben',
    abmessungen: data.abmessungen || data.size || 'Nicht angegeben',
    material: data.material || 'Nicht angegeben',
    feature_1: data.feature_1 || 'Hochwertige Verarbeitung',
    feature_2: data.feature_2 || 'Zuverlässige Leistung',
    feature_3: data.feature_3 || 'Benutzerfreundliches Design',
    feature_4: data.feature_4 || 'Langlebige Qualität',
    feature_5: data.feature_5 || 'Optimales Preis-Leistungs-Verhältnis'
  };

  return ordered;
}

// ===== SCHRITT 3: HTML-GENERIERUNG =====
export async function generateAkkushopDescription(normalizedData: any): Promise<string> {
  try {
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      throw new Error('OpenAI API key nicht konfiguriert');
    }
    
    const openai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const systemPrompt = `Du bist ein spezialisierter Produkttext-Agent für den Onlineshop Akkushop.de.

ERSTELLE IMMER DIESE EXAKTE STRUKTUR:

<ul>
<li>
<h2>PRODUKTNAME</h2>
<p>✓USP 1 (produktspezifisch basierend auf technischen Specs, z.B. "Hohe Energiedichte")<br />
✓USP 2 (produktspezifisch, z.B. "Thermisch stabil")<br />
✓USP 3 (produktspezifisch, z.B. "Schutzschaltung integriert")<br />
✓Versandkostenfrei ab 39,95€ ✓Kundenservice <span style="color: green;">☎</span>071517071010</p>

KRITISCH: KEINE langen Produktbeschreibungen! Nur kurze USP-Bulletpoints!
Die ersten 3 Bulletpoints (✓) müssen PRODUKTSPEZIFISCHE USPs sein (kurz und prägnant)!
Die letzten 2 USPs sind IMMER zusammen in einer Zeile: "✓Versandkostenfrei ab 39,95€ ✓Kundenservice <span style="color: green;">☎</span>071517071010"

FORMATIERUNG:
- Verwende ✓ (nicht ✅)
- KEIN Leerzeichen zwischen ✓ und Text
- Telefonnummer mit grünem ☎ Symbol: <span style="color: green;">☎</span>071517071010

PRODUKTSPEZIFISCHE USPs (wähle aus technischen Specs):
✓ Akkupack mit mehreren Zellen → "Hohe Energiedichte - langanhaltende Leistung"
✓ Hohe Kapazität (>2000 mAh) → "Lange Laufzeit - für intensive Anwendungen"
✓ Lithium-Ionen Zellenchemie → "Moderne Li-Ion Technologie - keine Memory-Effekte"
✓ Integrierte Schutzschaltung → "Schutzschaltung integriert - Sicherheit vor Überladung"
✓ Thermisch stabil → "Thermisch stabil - sicher bei hohen Temperaturen"
✓ Hoher Entladestrom → "Hoher Entladestrom - für leistungsstarke Geräte"
✓ Wiederaufladbar → "Wiederaufladbar - nachhaltig und kostensparend"

VERBOTEN in den Bulletpoints:
❌ Reine Zahlenwerte (z.B. "7,2 V", "5200 mAh", "184 g", "70×37.5×37.5 mm")
❌ Technische Rohdaten ohne Kundennutzen
❌ Generische USPs wenn produktspezifische Daten verfügbar sind

PRODUKTTYP-ERKENNUNG:
- Wenn Spannung + Kapazität vorhanden → "Akkupack" (nicht "Batterie")
- Wenn nur Spannung → "Batterie"</p>

<h3>Produkteigenschaften & Highlights</h3>
<ul>
<li>Robustes Gehäuse und langlebige Verarbeitung</li>
<li>Ergonomisches Design für komfortables Arbeiten</li>
<li>Hohe Leistung bei geringem Energieverbrauch</li>
<li>Vielseitig einsetzbar in Werkstatt und Haushalt</li>
<li>Optimales Preis-Leistungs-Verhältnis</li>
</ul>

<h4>Technische Daten:</h4>
<table border="0" summary="">
<tbody>
<tr><td>Leistung:</td><td>VERWENDE technicalSpecs.standards ODER technicalSpecs.kapazität</td></tr>
<tr><td>Spannung:</td><td>VERWENDE technicalSpecs.ladestrom ODER technicalSpecs.spannung</td></tr>
<tr><td>Gewicht:</td><td>VERWENDE technicalSpecs.weight</td></tr>
<tr><td>Abmessungen:</td><td>VERWENDE technicalSpecs.size (Format: L×B×H mm)</td></tr>
<tr><td>Material:</td><td>VERWENDE technicalSpecs.material ODER "Lithium-Ionen" für Akkus</td></tr>
</tbody>
</table>

<p>PRODUKTNAME steht für Qualität, Zuverlässigkeit und Langlebigkeit – ideal für den täglichen Einsatz.</p>

<h3>Sicherheitshinweise</h3>
<p>⚠️ Nicht ins Feuer werfen oder erhitzen. Vor Kurzschluss schützen. Nur mit geeigneten Ladegeräten laden. Von Kindern fernhalten. Bei Beschädigung nicht mehr verwenden.</p>

<h3>Lieferumfang</h3>
<p>LIEFERUMFANG AUS DATEN</p>
</li>
</ul>

WICHTIGE REGELN:
1. Verwende NUR die Daten aus den Produktdaten
2. Ersetze PRODUKTNAME durch den echten Produktnamen
3. Ersetze Feature 1-5 durch echte Produktfeatures
4. Ersetze WERT AUS DATEN durch echte technische Werte
5. Ersetze LIEFERUMFANG AUS DATEN durch echte Lieferumfang-Angaben
6. Überschriften OHNE Icons (nur Text)
7. Verwende ✓ (nicht ✅) für USPs in <p> Elementen
8. KEIN Leerzeichen zwischen ✓ und Text
9. Letzte Zeile IMMER: "✓Versandkostenfrei ab 39,95€ ✓Kundenservice <span style="color: green;">☎</span>071517071010"
10. Abmessungen Format: "L×B×H mm" (z.B. "57×20×69 mm") - NICHT "572069 mm"
9. Gewicht immer in Gramm (g)
10. Verwende IMMER die Werte aus technicalSpecs.size für Abmessungen, NICHT aus bullets
11. Gib NUR den HTML-Code zurück, ohne \`\`\`html`;

    // Bereinige Bulletpoints - entferne technische Daten, die bereits in technicalSpecs stehen
    if (normalizedData.bullets) {
      normalizedData.bullets = normalizedData.bullets.filter((bullet: string) => {
        const bulletLower = bullet.toLowerCase();
        // Entferne Bulletpoints mit technischen Daten, die bereits in technicalSpecs stehen
        return !bulletLower.includes('abmessungen:') && 
               !bulletLower.includes('gewicht:') && 
               !bulletLower.includes('spannung:') && 
               !bulletLower.includes('kapazität:') &&
               !bulletLower.includes('entladestrom:') &&
               !bulletLower.includes('nominalspannung:') &&
               !bulletLower.includes('nominalkapazität:') &&
               !bulletLower.includes('max. entladestrom:') &&
               !bulletLower.includes('zulassungen:');
      });
      console.log('Bereinigte Bulletpoints:', normalizedData.bullets);
    }

    // Formatiere Abmessungen korrekt vor der AI-Verarbeitung
    if (normalizedData.size && normalizedData.size.includes('×')) {
      // Abmessungen sind bereits korrekt formatiert
      console.log('Abmessungen bereits korrekt formatiert:', normalizedData.size);
    } else if (normalizedData.size && normalizedData.size.match(/^\d+mm$/)) {
      // Konvertiere "572069mm" zu "57×20×69 mm"
      const numbers = normalizedData.size.match(/\d+/g);
      if (numbers && numbers[0].length >= 6) {
        const numStr = numbers[0];
        const dim1 = numStr.substring(0, 2);
        const dim2 = numStr.substring(2, 4);
        const dim3 = numStr.substring(4, 6);
        normalizedData.size = `${dim1}×${dim2}×${dim3} mm`;
        console.log('Abmessungen korrigiert:', normalizedData.size);
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(normalizedData, null, 2) }
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || '';
    
  } catch (error) {
    console.error('GenerateAkkushopDescription error:', error);
    throw error;
  }
}

// ===== KOMPLETTER WORKFLOW MIT FORTSCHRITT =====
export async function processProductWithNewWorkflow(htmlOrText: string, onProgress?: (step: number, message: string) => void): Promise<string> {
  try {
    console.log('=== NEUER WORKFLOW GESTARTET ===');
    
    // Schritt 1: Daten extrahieren
    console.log('Schritt 1: ExtractProductData...');
    onProgress?.(33, 'Daten werden extrahiert...');
    const extractedData = await extractProductData(htmlOrText);
    debugLog('Extrahierte Daten:', extractedData);
    
    // Schritt 2: Daten normalisieren
    console.log('Schritt 2: NormalizeProductData...');
    onProgress?.(66, 'Daten werden strukturiert...');
    const normalizedData = normalizeProductData(extractedData);
    debugLog('Normalisierte Daten:', normalizedData);
    
    // Schritt 3: HTML generieren mit einfacher Template-Funktion
    console.log('Schritt 3: GenerateAkkushopDescription...');
    onProgress?.(90, 'Produktbeschreibung wird generiert...');
    
    // Verwende die einfache Template-Funktion statt der komplexen AI-Funktion
    const productName = normalizedData.product_name || 'Unbekanntes Produkt';
    const description = normalizedData.short_intro || 'Hochwertiges Produkt für professionelle Anwendungen.';
    
    // Extrahiere Features
    const features = [
      normalizedData.feature_1 || 'Hochwertige Verarbeitung',
      normalizedData.feature_2 || 'Zuverlässige Leistung', 
      normalizedData.feature_3 || 'Benutzerfreundliches Design',
      normalizedData.feature_4 || 'Langlebige Qualität',
      normalizedData.feature_5 || 'Optimales Preis-Leistungs-Verhältnis'
    ];
    
    // Konvertiere Gewicht zu Gramm
    const convertWeightToGrams = (weightStr: string): string => {
      if (!weightStr || weightStr === 'Nicht angegeben') return 'Nicht angegeben';
      
      const weight = parseFloat(weightStr.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (isNaN(weight)) return weightStr;
      
      if (weightStr.toLowerCase().includes('kg')) {
        return `${Math.round(weight * 1000)} g`;
      } else if (weightStr.toLowerCase().includes('g')) {
        return `${Math.round(weight)} g`;
      } else {
        // Annahme: wenn keine Einheit, dann Gramm
        return `${Math.round(weight)} g`;
      }
    };
    
    // Konvertiere Abmessungen zu mm
    const convertDimensionsToMm = (dimStr: string): string => {
      if (!dimStr || dimStr === 'Nicht angegeben') return 'Nicht angegeben';
      
      // Wenn bereits mm enthalten, zurückgeben
      if (dimStr.toLowerCase().includes('mm')) return dimStr;
      
      // Wenn cm enthalten, zu mm konvertieren
      if (dimStr.toLowerCase().includes('cm')) {
        const numbers = dimStr.match(/[\d.,]+/g);
        if (numbers) {
          const converted = numbers.map(num => {
            const val = parseFloat(num.replace(',', '.'));
            return isNaN(val) ? num : String(Math.round(val * 10));
          });
          // Ersetze Zahlen und entferne "cm", füge "mm" hinzu
          let idx = 0;
          return dimStr.replace(/[\d.,]+/g, () => converted[idx++]).replace(/cm/gi, '') + ' mm';
        }
      }
      
      return dimStr;
    };
    
    // Technische Daten mit Konvertierung - prüfe alle möglichen Feldnamen
    const rawWeight = normalizedData.gewicht || normalizedData.weight || normalizedData.produktgewicht || 'Nicht angegeben';
    const rawDimensions = normalizedData.abmessungen || normalizedData.size || normalizedData.dimensions || 'Nicht angegeben';
    
    const power = normalizedData.leistung || normalizedData.power || 'Nicht angegeben';
    const voltage = normalizedData.spannung || normalizedData.voltage || 'Nicht angegeben';
    const weight = convertWeightToGrams(rawWeight);
    const dimensions = convertDimensionsToMm(rawDimensions);
    const material = normalizedData.material || 'Nicht angegeben';
    const packageContents = normalizedData.package_contents || 'Produkt wie beschrieben';
    const safetyNotes = normalizedData.safety_notes || '⚠️ Nicht ins Feuer werfen oder erhitzen. Vor Kurzschluss schützen. Nur mit geeigneten Ladegeräten laden. Von Kindern fernhalten. Bei Beschädigung nicht mehr verwenden.';
    
    const htmlDescription = `<ul>
<li>
<h2>${productName}</h2>
<p>${description}<br /><br />
✅ ${features[0]}<br />
✅ ${features[1]}<br />
✅ ${features[2]}<br />
✅ ${features[3]}<br />
✅ ${features[4]}</p>

<h3>Produkteigenschaften & Highlights</h3>
<ul>
<li>Robustes Gehäuse und langlebige Verarbeitung</li>
<li>Ergonomisches Design für komfortables Arbeiten</li>
<li>Hohe Leistung bei geringem Energieverbrauch</li>
<li>Vielseitig einsetzbar in Werkstatt und Haushalt</li>
<li>Optimales Preis-Leistungs-Verhältnis</li>
</ul>

<h4>Technische Daten:</h4>
<table border="0" summary="">
<tbody>
<tr><td>Leistung:</td><td>${power}</td></tr>
<tr><td>Spannung:</td><td>${voltage}</td></tr>
<tr><td>Gewicht:</td><td>${weight}</td></tr>
<tr><td>Abmessungen:</td><td>${dimensions}</td></tr>
<tr><td>Material:</td><td>${material}</td></tr>
</tbody>
</table>

<p>${productName} steht für Qualität, Zuverlässigkeit und Langlebigkeit – ideal für den täglichen Einsatz.</p>

<h3>Sicherheitshinweise</h3>
<p>${safetyNotes}</p>

<h3>Lieferumfang</h3>
<p>${packageContents}</p>
</li>
</ul>`;
    
    console.log('Generierte HTML-Länge:', htmlDescription.length);
    
    onProgress?.(100, 'Fertig!');
    console.log('=== WORKFLOW ABGESCHLOSSEN ===');
    return htmlDescription;
    
  } catch (error) {
    console.error('Workflow-Fehler:', error);
    onProgress?.(0, 'Fehler aufgetreten');
    throw error;
  }
}

/**
 * Generate SEO-optimized Keywords in structured categories
 * @param productTitle - Product title
 * @param productDescription - Product description
 * @param maxKeywords - Maximum keywords per category (default: 12)
 * @param model - AI model to use (default: gpt-4o-mini)
 * @returns Structured keywords object
 */
export async function generateSEOKeywords(
  productTitle: string,
  productDescription: string,
  maxKeywords: number = 12,
  model: string = 'gpt-4o-mini'
): Promise<{
  hauptkeywords: string[];
  longtail_keywords: string[];
  brand_keywords: string[];
  intent_keywords: string[];
}> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `Du bist ein professioneller SEO-Keyword-Agent für Produktdaten. 
Deine Aufgabe ist es, aus Produktinformationen gezielte Keywords für Suchmaschinen zu generieren. 
Die Keywords sollen thematisch relevant, deutschsprachig, markenbezogen und suchintention-orientiert sein.

Eingabeparameter:
- product_title: {Produktname}
- product_description: {Produktbeschreibung}
- max_keywords: {Zahl der gewünschten Keywords, Standard = 12}

Ausgabeformat (immer in JSON):
{
  "hauptkeywords": ["..."],
  "longtail_keywords": ["..."],
  "brand_keywords": ["..."],
  "intent_keywords": ["..."]
}

Regeln:
- Gib nie mehr als {max_keywords} pro Kategorie aus.
- Verwende keine doppelten oder bedeutungsgleichen Begriffe.
- Longtail-Keywords müssen reale Suchphrasen enthalten (z. B. „kaufen", „Test", „Erfahrungen", „beste", „akku 21700").
- Brand-Keywords sollen den Markennamen enthalten (z. B. „Nitecore", „Nitecore Akku").
- Intent-Keywords zielen auf Kaufabsicht oder Informationssuche.
- Antworte nur im JSON-Format, ohne Erklärtext.`;

  const prompt = systemPrompt
    .replace('{Produktname}', productTitle)
    .replace('{Produktbeschreibung}', productDescription)
    .replace('{Zahl der gewünschten Keywords, Standard = 12}', maxKeywords.toString())
    .replace('{max_keywords}', maxKeywords.toString());

  const userMessage = `product_title: "${productTitle}"
product_description: "${productDescription}"
max_keywords: ${maxKeywords}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    
    return {
      hauptkeywords: parsed.hauptkeywords || [],
      longtail_keywords: parsed.longtail_keywords || [],
      brand_keywords: parsed.brand_keywords || [],
      intent_keywords: parsed.intent_keywords || []
    };
    
  } catch (error) {
    console.error('[SEO Keywords Generation Error]:', error);
    // Fallback to empty arrays
    return {
      hauptkeywords: [],
      longtail_keywords: [],
      brand_keywords: [],
      intent_keywords: []
    };
  }
}

/**
 * Generate SEO-optimized Meta Title and Meta Description
 * @param productData - Product information (name, manufacturer, specs, etc.)
 * @param model - AI model to use (default: gpt-4o-mini)
 * @returns Object with seoTitle and seoDescription
 */
export async function generateSEOMetadata(
  productData: {
    productName: string;
    manufacturer?: string;
    category?: string;
    articleNumber?: string;
    description?: string;
    technicalSpecs?: string[];
    nominalkapazitaet?: string;
    zellenchemie?: string;
  },
  model: string = 'gpt-4o-mini'
): Promise<{ seoTitle: string; seoDescription: string }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const { productName, manufacturer, category, articleNumber, description, technicalSpecs, nominalkapazitaet, zellenchemie } = productData;
  
  // Build context from available data
  const productTitle = productName;
  const productDescription = description || '';

  // Bestimme Produkttyp basierend auf Kategorie und technischen Daten
  let productType = 'Akkupack'; // Default
  let productTypeAdjective = 'Hochwertiger'; // Default für Akkupack
  
  if (category === 'flashlight') {
    productType = 'Taschenlampe';
    productTypeAdjective = 'Leistungsstarke';
  } else if (category === 'charger') {
    productType = 'Ladegerät';
    productTypeAdjective = 'Professionelles';
  } else if (category === 'testing_equipment') {
    productType = 'Messgerät';
    productTypeAdjective = 'Präzises';
  } else if (category === 'accessory') {
    productType = 'Zubehör';
    productTypeAdjective = 'Hochwertiges';
  } else if (category === 'battery') {
    // Unterscheide zwischen Akkupack (wiederaufladbar) und Batterie (Einweg)
    const zellenchemieStr = (zellenchemie || '').toLowerCase();
    const hasCapacity = !!nominalkapazitaet;
    
    if (hasCapacity || zellenchemieStr.includes('nimh') || zellenchemieStr.includes('nickel') || zellenchemieStr.includes('li-ion') || zellenchemieStr.includes('lithium-ion')) {
      productType = 'Akkupack';
      productTypeAdjective = 'Hochwertiger';
    } else if (zellenchemieStr.includes('alkaline') || zellenchemieStr.includes('lithium')) {
      productType = 'Batterie';
      productTypeAdjective = 'Hochwertige';
    }
  }

  console.log(`[SEO] Produkttyp erkannt: ${productType} (Kategorie: ${category}, Zellenchemie: ${zellenchemie})`);

  // SEO Title Prompt (akkushop.de Format) - KATEGORIE-ABHÄNGIG
  const titlePrompt = `Du bist ein professioneller SEO-Experte für Akkushop-Produkttitel.

Eingabeparameter:
- product_title: ${productTitle}
- product_description: ${productDescription}
- product_type: ${productType}

Ziel:
Erstelle einen prägnanten Meta-Titel mit **EXAKT 45-55 Zeichen** im akkushop.de-Stil.

Struktur:
${productType} [SPEZIFIKATION] kaufen | Akkushop

Regeln:
1. **KRITISCH: Zielbereich 45-55 Zeichen** (optimal: 380-480 Pixel)
2. **Produkttyp:** "${productType}" (EXAKT verwenden!)
3. **Spezifikation:** Hauptmerkmale aus Produktnamen extrahieren (z.B. "Mignon AA", "2500 Lumen", "2s2p 5200mah")
4. **ENDE mit "kaufen | Akkushop"** (Branding + Conversion-Keyword)
5. **Keine Marke:** Fokus auf Produkttyp und Specs
6. **Deutsche Sprache:** Ausschließlich Deutsch
7. **Nur Titel ausgeben** – keine Erklärungen

Beispiele:
- ${productType === 'Batterie' ? 'Batterie Mignon AA kaufen | Akkushop' : ''}
- ${productType === 'Akkupack' ? 'Akkupack 2s2p 5200mah kaufen | Akkushop' : ''}
- ${productType === 'Taschenlampe' ? 'Taschenlampe 2500 Lumen kaufen | Akkushop' : ''}

WICHTIG: Gib NUR den Text aus, OHNE Anführungszeichen am Anfang/Ende!`;

  // SEO Description Prompt (akkushop.de Format) - KATEGORIE-ABHÄNGIG
  const descriptionPrompt = `Du bist ein professioneller SEO-Experte für Akkushop-Produktbeschreibungen.

Eingabeparameter:
- product_title: ${productTitle}
- product_description: ${productDescription}
- product_type: ${productType}

Ziel:
Erstelle eine prägnante Meta-Description mit **EXAKT 120-140 Zeichen** im akkushop.de-Stil.

Struktur:
${productTypeAdjective} ${productType} [SPEZIFIKATION] ✓Qualitätsprodukte ✓Versandkostenfrei ab 39,95€ ✓Kundenservice ✆071517071010

Regeln:
1. **KRITISCH: Zielbereich 120-140 Zeichen** (optimal: 750-880 Pixel)
2. **Start:** "${productTypeAdjective} ${productType}" + Spezifikation (z.B. "Mignon AA", "2500 Lumen")
3. **FESTE USPs (IMMER verwenden):**
   - ✓Qualitätsprodukte
   - ✓Versandkostenfrei ab 39,95€
   - ✓Kundenservice ✆071517071010
4. **Keine variablen USPs:** Nur die 3 festen Service-USPs
5. **Deutsche Sprache:** Ausschließlich Deutsch
6. **Kein Punkt am Ende** (akkushop.de-Stil)
7. **Nur Text ausgeben** – keine Erklärungen

Beispiele:
- ${productType === 'Batterie' ? 'Hochwertige Batterie Mignon AA ✓Qualitätsprodukte ✓Versandkostenfrei ab 39,95€ ✓Kundenservice ✆071517071010' : ''}
- ${productType === 'Akkupack' ? 'Hochwertiger Akkupack 2s2p 5200mah ✓Qualitätsprodukte ✓Versandkostenfrei ab 39,95€ ✓Kundenservice ✆071517071010' : ''}
- ${productType === 'Taschenlampe' ? 'Leistungsstarke Taschenlampe 2500 Lumen ✓Qualitätsprodukte ✓Versandkostenfrei ab 39,95€ ✓Kundenservice ✆071517071010' : ''}

WICHTIG: Gib NUR den Text aus, OHNE Anführungszeichen am Anfang/Ende!`;

  try {
    // Generate SEO Title
    const titleResponse = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Du bist ein professioneller SEO-Experte für Produktdaten.'
        },
        {
          role: 'user',
          content: titlePrompt
        }
      ],
      temperature: 0.7
    });

    let seoTitle = titleResponse.choices[0]?.message?.content?.trim() || productName.substring(0, 65);
    
    // Remove surrounding quotes if AI added them
    seoTitle = seoTitle.replace(/^["']|["']$/g, '').trim();

    // Generate SEO Description
    const descriptionResponse = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Du bist ein professioneller SEO- und Produkttext-Experte für Akkus und Elektronikprodukte.'
        },
        {
          role: 'user',
          content: descriptionPrompt
        }
      ],
      temperature: 0.7
    });

    let seoDescription = descriptionResponse.choices[0]?.message?.content?.trim() || description?.substring(0, 150) || '';
    
    // Remove surrounding quotes if AI added them
    seoDescription = seoDescription.replace(/^["']|["']$/g, '').trim();
    
    // Remove trailing "..." if AI added it (we want complete sentences)
    seoDescription = seoDescription.replace(/\.\.\.+$/, '').trim();
    
    // Only truncate if AI ignored the limit (emergency fallback)
    if (seoDescription.length > 160) {
      // Find last complete sentence before 160 chars
      const truncated = seoDescription.substring(0, 157);
      const lastPeriod = truncated.lastIndexOf('.');
      seoDescription = lastPeriod > 100 ? truncated.substring(0, lastPeriod + 1) : truncated + '...';
    }
    
    return {
      seoTitle: seoTitle, // AI respects 70 char limit - no forced truncation
      seoDescription
    };
    
  } catch (error) {
    console.error('[SEO Generation Error]:', error);
    // Fallback to simple truncation
    return {
      seoTitle: productName.length > 65 ? productName.substring(0, 62) + '...' : productName,
      seoDescription: description ? (description.length > 400 ? description.substring(0, 397) + '...' : description) : ''
    };
  }
}

