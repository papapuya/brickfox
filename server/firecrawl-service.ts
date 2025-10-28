import * as cheerio from 'cheerio';
import handlebars from 'handlebars';
import { getSecureFirecrawlKey } from './api-key-manager';

const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev/v1/scrape';

export interface ExtractedData {
  title: string | null;
  bullets: string[];
  supplierTableHtml: string;
  tech: {
    geeignet: string | null;
    slots: string | null;
    ladestrom: string | null;
    standards: string | null;
    outputs: string | null;
    inputs: string | null;
    qi: string | null;
    weight: string | null;
    size: string | null;
    gefahrgut: string | null;
    un: string | null;
    zoll: string | null;
  };
}

export async function fetchWithFirecrawl(url: string): Promise<string> {
  const apiKey = getSecureFirecrawlKey();
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY ist nicht gesetzt oder nicht entschlüsselt');
  }

  console.log(`Fetching URL with Firecrawl: ${url}`);
  console.log(`Using API key: ${apiKey ? '***' + apiKey.slice(-4) : 'none'}`);
  
  // Erhöhtes Timeout für langsame Websites
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 Sekunden
  
  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({ 
        url,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
        waitFor: 8000,  // Warte 8 Sekunden auf JavaScript
        excludeTags: ['nav', 'header', 'footer']  // Entferne Navigation
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

  console.log(`Firecrawl response status: ${response.status}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log(`Firecrawl error response: ${errorText}`);
    throw new Error(`Firecrawl API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`Firecrawl response received:`, {
    success: data.success,
    htmlLength: data.html?.length || 0,
    markdownLength: data.markdown?.length || 0,
    metadata: data.metadata,
    dataKeys: Object.keys(data),
    fullResponse: JSON.stringify(data, null, 2)
  });
  
  // Prüfe verschiedene Response-Formate (Firecrawl v1 API Struktur)
  if (data.data && data.data.html) {
    console.log('Found HTML in data.data.html');
    return data.data.html;
  } else if (data.html && data.html.length > 0) {
    console.log('Found HTML in data.html');
    return data.html;
  } else if (data.data && data.data.markdown) {
    console.log('Found markdown in data.data.markdown, converting...');
    return `<div>${data.data.markdown.replace(/\n/g, '<br>')}</div>`;
  } else if (data.markdown && data.markdown.length > 0) {
    console.log('Found markdown in data.markdown, converting...');
    return `<div>${data.markdown.replace(/\n/g, '<br>')}</div>`;
  } else {
    console.log('No content found in Firecrawl response. Full response:', JSON.stringify(data, null, 2));
    throw new Error(`Kein Inhalt von Firecrawl erhalten. Response: ${JSON.stringify(data)}`);
  }
  
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('408')) {
      console.log('Firecrawl timeout - trying fallback scraper...');
      return await fallbackScraper(url);
    }
    
    console.log('Firecrawl failed, trying fallback scraper...', error.message);
    return await fallbackScraper(url);
  }
}

// Fallback-Scraper für wenn Firecrawl fehlschlägt
async function fallbackScraper(url: string): Promise<string> {
  console.log(`Using fallback scraper for: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`Fallback scraper got ${html.length} characters`);
    
    // Prüfe ob wir echten Inhalt haben
    if (html.length < 1000) {
      throw new Error('Fallback scraper got too little content');
    }
    
    return html;
    
  } catch (error) {
    console.error('Fallback scraper also failed:', error);
    throw new Error(`All scraping methods failed: ${error.message}`);
  }
}

export function extractFromHtml(html: string): ExtractedData {
  const $ = cheerio.load(html);

  // 1) Tabelle 1:1 übernehmen (Passthrough)
  const supplierTableHtml = $('table').first().length ? $.html($('table').first()) : '';

  // 2) Titel extrahieren
  const title = $('h1').first().text().trim() || 
                $('h2').first().text().trim() || 
                $('title').text().trim() || 
                null;

  // 3) Bullet Points extrahieren - nur echte Produktvorteile, keine Navigation
  const bullets: string[] = [];
  
  // Entferne Barrierefreiheits-Bereiche komplett aus dem DOM
  $('[class*="accessibility"], [class*="barrierefreiheit"], [id*="accessibility"], [id*="barrierefreiheit"]').remove();
  $('li:contains("Drücken Sie die Eingabetaste")').remove();
  $('li:contains("Barrierefreiheit")').remove();
  $('li:contains("Screenreader")').remove();
  
  // Suche nach echten Produktvorteilen in verschiedenen Bereichen
  const vorteileSelektoren = [
    '.product-features li',
    '.benefits li', 
    '.features li',
    '.product-benefits li',
    '.specifications li',
    '.product-specs li',
    '[class*="feature"] li',
    '[class*="benefit"] li',
    '.description li',
    '.product-description li'
  ];
  
  vorteileSelektoren.forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10 && text.length < 200) {
        // Filtere Navigation-Links und Barrierefreiheits-Texte heraus
        const lower = text.toLowerCase();
        const unwantedTerms = [
          'schnellauswahl', 'akkusakkus', 'kamera-akkus', 'lithium akkupacks', 
          'externe akkus', 'powerbanks', 'powerstations', 'jump starter',
          'navigation', 'menu', 'batterien', 'knopfzellen', 'spezialzellen',
          'hörgeräte-batterien', 'batterietester', 'ladegeräte', 'akku-ladegeräte',
          'usb-ladegeräte', 'kfz-ladegeräte', 'akkupack-ladegeräte', 'kabellose ladegeräte',
          'netzteile', 'energiespar-steckdosen', 'reisestecker', 'licht', 'taschenlampen',
          'handscheinwerfer', 'arbeitsleuchten', 'baustrahler', 'flutlichter', 'stirnlampen',
          'nachtlichter', 'spezial-lichter', 'campinglampen', 'fahrrad-lampen',
          'kindernachtlichter', 'ansmann originals', 'maus & elefant', 'zubehör',
          'usb-kabel', 'autoladekabel', 'halterungen', 'kategorien', 'produktkategorien',
          'shop', 'warenkorb', 'anmelden', 'registrieren', 'suche', 'filter',
          'sortierung', 'preis', 'verfügbarkeit', 'marke', 'hersteller',
          // Barrierefreiheits-Texte
          'drücken sie die eingabetaste', 'barrierefreiheit', 'screenreader', 'menü',
          'eingabetaste', 'blinde', 'sehbehinderte', 'bildschirmleser', 'tastaturnavigation'
        ];
        
        const isUnwanted = unwantedTerms.some(term => lower.includes(term));
        
        if (!isUnwanted && 
            !text.includes('AkkusAkkus') && // Spezifisch für dein Beispiel
            text.length > 10 && 
            text.length < 200 &&
            !text.match(/^[A-Za-z\s\-]+$/) && // Keine reinen Kategorienamen
            !text.includes('→') && // Keine Pfeile
            !text.includes('>') && // Keine HTML-ähnlichen Zeichen
            !text.match(/^\w+\s*$/) && // Keine einzelnen Wörter
            text.includes(' ') // Muss mehrere Wörter haben
        ) {
          bullets.push(text);
        }
      }
    });
  });
  
  // Fallback: Alle li-Elemente, aber gefiltert
  if (bullets.length === 0) {
    // Entferne nochmal alle Barrierefreiheits-Elemente vor dem Fallback
    $('li:contains("Drücken Sie die Eingabetaste")').remove();
    $('li:contains("Barrierefreiheit")').remove();
    $('li:contains("Screenreader")').remove();
    
    $('li').slice(0, 20).each((_, li) => {
      const text = $(li).text().trim();
      if (text && text.length > 10 && text.length < 200) {
        const lower = text.toLowerCase();
        const unwantedTerms = [
          'schnellauswahl', 'akkusakkus', 'kamera-akkus', 'lithium akkupacks', 
          'externe akkus', 'powerbanks', 'powerstations', 'jump starter',
          'navigation', 'menu', 'batterien', 'knopfzellen', 'spezialzellen',
          'hörgeräte-batterien', 'batterietester', 'ladegeräte', 'akku-ladegeräte',
          'usb-ladegeräte', 'kfz-ladegeräte', 'akkupack-ladegeräte', 'kabellose ladegeräte',
          'netzteile', 'energiespar-steckdosen', 'reisestecker', 'licht', 'taschenlampen',
          'handscheinwerfer', 'arbeitsleuchten', 'baustrahler', 'flutlichter', 'stirnlampen',
          'nachtlichter', 'spezial-lichter', 'campinglampen', 'fahrrad-lampen',
          'kindernachtlichter', 'ansmann originals', 'maus & elefant', 'zubehör',
          'usb-kabel', 'autoladekabel', 'halterungen', 'kategorien', 'produktkategorien',
          'shop', 'warenkorb', 'anmelden', 'registrieren', 'suche', 'filter',
          'sortierung', 'preis', 'verfügbarkeit', 'marke', 'hersteller',
          // Barrierefreiheits-Texte
          'drücken sie die eingabetaste', 'barrierefreiheit', 'screenreader', 'menü',
          'eingabetaste', 'blinde', 'sehbehinderte', 'bildschirmleser', 'tastaturnavigation'
        ];
        
        const isUnwanted = unwantedTerms.some(term => lower.includes(term));
        
        if (!isUnwanted && 
            !text.includes('AkkusAkkus') && // Spezifisch für dein Beispiel
            text.length > 10 && 
            text.length < 200 &&
            !text.match(/^[A-Za-z\s\-]+$/) && // Keine reinen Kategorienamen
            !text.includes('→') && // Keine Pfeile
            !text.includes('>') && // Keine HTML-ähnlichen Zeichen
            !text.match(/^\w+\s*$/) && // Keine einzelnen Wörter
            text.includes(' ') // Muss mehrere Wörter haben
        ) {
          bullets.push(text);
        }
      }
    });
  }

  // 4) Technische Daten extrahieren - 1:1 aus "Technische Details" Tabelle
  const tech = {
    geeignet: null,
    slots: null,
    ladestrom: null,
    standards: null,
    outputs: null,
    inputs: null,
    qi: null,
    weight: null,
    size: null,
    gefahrgut: null,
    un: null,
    zoll: null
  };

  // Spezielle Extraktion für Ansmann-Produktseiten
  const fullText = $.text();
  
  console.log('Full text sample:', fullText.substring(0, 500));
  
  // Extrahiere technische Daten aus der HTML-Tabelle (falls vorhanden)
  if (supplierTableHtml && supplierTableHtml.length > 0) {
    console.log('Extrahiere technische Daten aus HTML-Tabelle...');
    
    // Parse die HTML-Tabelle mit Cheerio
    const tableHtml = supplierTableHtml;
    const tableCheerio = cheerio.load(tableHtml);
    
    // Gehe durch alle Tabellenzeilen
    tableCheerio('tr').each((i, row) => {
      const labelCell = tableCheerio(row).find('th');
      const valueCell = tableCheerio(row).find('td');
      
      if (labelCell.length > 0 && valueCell.length > 0) {
        const label = labelCell.text().trim().toLowerCase();
        const value = valueCell.text().trim();
        
        console.log(`HTML-Tabelle: "${label}" = "${value}"`);
        
        // Mappe zu den entsprechenden Feldern - GENAUERE MATCHING
        if (label.includes('nominalspannung') || label.includes('spannung') || label.includes('voltage')) {
          tech.ladestrom = value;
        } else if (label.includes('nominalkapazität') || label.includes('kapazität') || label.includes('capacity')) {
          tech.standards = value;
        } else if (label.includes('max. entladestrom') || label.includes('entladestrom') || label.includes('discharge')) {
          tech.outputs = value;
        } else if (label.includes('gewicht') || label.includes('weight')) {
          tech.weight = value;
        } else if (label.includes('abmessung') || label.includes('dimension') || label.includes('größe') || label.includes('size')) {
          tech.size = value;
        } else if (label.includes('material')) {
          tech.material = value;
        } else if (label.includes('zulassung') || label.includes('approval') || label.includes('un') || label.includes('zertifikat') || label.includes('norm')) {
          tech.gefahrgut = value;
        } else if (label.includes('energie') || label.includes('energy')) {
          tech.outputs = value; // Energie als Output verwenden
        } else if (label.includes('zellenchemie') || label.includes('chemie')) {
          tech.inputs = value; // Zellenchemie als Input verwenden
        } else if (label.includes('farbe') || label.includes('color')) {
          tech.qi = value; // Farbe als zusätzliche Info verwenden
        } else if (label.includes('temperatur') || label.includes('temperature')) {
          tech.slots = value; // Temperatur als zusätzliche Info verwenden
        } else if (label.includes('artikelnummer') || label.includes('ean')) {
          // Artikelnummer und EAN als zusätzliche Info
          if (label.includes('artikelnummer')) {
            tech.geeignet = value; // Artikelnummer als "geeignet" verwenden
          }
        } else if (label.includes('lieferumfang')) {
          tech.un = value; // Lieferumfang als zusätzliche Info verwenden
        } else if (label.includes('menge')) {
          tech.zoll = value; // Menge als zusätzliche Info verwenden
        }
      }
    });
    
    console.log('Technische Daten nach Tabellen-Extraktion:', tech);
  }
  
  // Extrahiere zusätzliche technische Details aus dem Plain-Text
  console.log('Extrahiere zusätzliche technische Details aus Plain-Text...');
  
  // Max. Entladestrom extrahieren
  const dischargeMatch = fullText.match(/max\.?\s*entladestrom[:\s]*(\d+(?:,\d+)?)\s*a/i);
  if (dischargeMatch && !tech.outputs) {
    tech.outputs = dischargeMatch[1] + ' A';
    console.log(`Max. Entladestrom gefunden: ${tech.outputs}`);
  }
  
  // Zulassungen extrahieren
  const approvalMatch = fullText.match(/(UN\d+|IEC\s+\d+(?:-\d+)*(?::\d+)*)/gi);
  if (approvalMatch && !tech.gefahrgut) {
    tech.gefahrgut = approvalMatch.join(', ');
    console.log(`Zulassungen gefunden: ${tech.gefahrgut}`);
  }
  
  // Abmessungen extrahieren (verschiedene Formate)
  if (!tech.size) {
    // Format 1: Vollständige Abmessungen "55×37.5×70 mm" (mit Punkten UND Kommas)
    let dimensionMatch = fullText.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*mm/i);
    if (dimensionMatch) {
      tech.size = `${dimensionMatch[1]}×${dimensionMatch[2]}×${dimensionMatch[3]} mm`;
      console.log(`Abmessungen in mm gefunden: ${tech.size}`);
    } else {
      // Format 2: Abmessungen in cm "5,5 × 2 × 6,9 cm" (mit Punkten UND Kommas)
      dimensionMatch = fullText.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*cm/i);
      if (dimensionMatch) {
        const dim1 = Math.round(parseFloat(dimensionMatch[1].replace(',', '.')) * 10);
        const dim2 = Math.round(parseFloat(dimensionMatch[2].replace(',', '.')) * 10);
        const dim3 = Math.round(parseFloat(dimensionMatch[3].replace(',', '.')) * 10);
        tech.size = `${dim1}×${dim2}×${dim3} mm`;
        console.log(`Abmessungen in cm gefunden und konvertiert: ${tech.size}`);
      } else {
        // Format 3: Einzelne Abmessungen "Abmessungen: 55×37.5×70" (mit Punkten UND Kommas)
        dimensionMatch = fullText.match(/abmessungen[:\s]*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
        if (dimensionMatch) {
          tech.size = `${dimensionMatch[1]}×${dimensionMatch[2]}×${dimensionMatch[3]} mm`;
          console.log(`Abmessungen ohne Einheit gefunden: ${tech.size}`);
        }
      }
    }
  }
  
  // Gewicht in g extrahieren (falls nicht bereits vorhanden)
  if (!tech.weight) {
    const weightMatch = fullText.match(/(\d+(?:,\d+)?)\s*g(?:ram)?/i);
    if (weightMatch) {
      tech.weight = weightMatch[1] + ' g';
      console.log(`Gewicht in g gefunden: ${tech.weight}`);
    }
  }
  
  // Fallback: Extrahiere technische Daten aus dem Plain-Text
  const weitereInfoMatch = fullText.match(/Weitere Informationen(.*?)(?:Lieferumfang|Downloads|$)/s);
  if (weitereInfoMatch) {
    const techSection = weitereInfoMatch[1];
    console.log('Gefundene Weitere Informationen Sektion:', techSection.substring(0, 500));
    
    // Parse Zeilen - jede Zeile ist ein technisches Detail mit Tabs
    const lines = techSection.split('\n')
      .map(line => line.trim())
      .filter(line => line && line.length > 0 && !line.includes('Nominal-Spannung') && !line.includes('Nominal-Kapazität'));
    
    console.log('Weitere Informationen Zeilen:', lines);
    
    // Jede Zeile als "Label\tWert" parsen (Tab-getrennt)
    lines.forEach(line => {
      // Format: "Label\tWert" (Tab-getrennt)
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const label = parts[0].trim().toLowerCase();
        const value = parts[1].trim();
        
        console.log(`Plain-Text Parsing: "${label}" = "${value}"`);
        
        // Mappe zu den entsprechenden Feldern (nur wenn noch nicht gesetzt)
        if (!tech.ladestrom && (label.includes('spannung') || label.includes('voltage'))) {
          tech.ladestrom = value;
        } else if (!tech.standards && (label.includes('kapazität') || label.includes('capacity'))) {
          tech.standards = value;
        } else if (!tech.weight && (label.includes('gewicht') || label.includes('weight'))) {
          tech.weight = value;
        } else if (!tech.size && (label.includes('abmessung') || label.includes('dimension') || label.includes('größe'))) {
          tech.size = value;
        } else if (!tech.gefahrgut && (label.includes('zulassung') || label.includes('zertifikat') || label.includes('norm'))) {
          tech.gefahrgut = value;
        }
        return;
      }
    });
  }
  
  // Extrahiere technische Daten aus dem Produktnamen (falls noch nicht gefunden)
  if (!tech.ladestrom || !tech.standards) {
    console.log('Extrahiere technische Daten aus Produktnamen...');
    
    // Spannung aus Produktnamen extrahieren (z.B. "7,2 V")
    if (title) {
      const voltageMatch = title.match(/(\d+(?:,\d+)?)\s*v/i);
      if (voltageMatch && !tech.ladestrom) {
        tech.ladestrom = voltageMatch[1] + ' V';
        console.log(`Spannung aus Produktnamen: ${tech.ladestrom}`);
      }
      
      // Kapazität aus Produktnamen extrahieren (z.B. "5200 mAh")
      const capacityMatch = title.match(/(\d+(?:,\d+)?)\s*mah/i);
      if (capacityMatch && !tech.standards) {
        tech.standards = capacityMatch[1] + ' mAh';
        console.log(`Kapazität aus Produktnamen: ${tech.standards}`);
      }
    }
  }
  
  // Debug: Zeige alle extrahierten technischen Daten
  console.log('Extrahierte technische Daten:', tech);

  console.log(`Extracted data: title="${title}", bullets=${bullets.length}, table=${supplierTableHtml.length > 0 ? 'yes' : 'no'}`);
  console.log(`Technical data extracted:`, tech);
  console.log(`Full text sample for debugging:`, fullText.substring(0, 1000));

  return { title, bullets, supplierTableHtml, tech };
}

// Alte renderTemplate Funktion entfernt - wird durch generateDynamicDescription ersetzt

// Dynamische Beschreibungsgenerierung ohne Vorlage
export async function generateDynamicDescription(data: ExtractedData): Promise<string> {
  // Filtere unerwünschte Bulletpoints heraus
  const filteredBullets = (data.bullets || []).filter(bullet => {
    const lower = bullet.toLowerCase();
    const unwantedTerms = [
      'drücken sie die eingabetaste', 'barrierefreiheit', 'screenreader', 'menü',
      'eingabetaste', 'blinde', 'sehbehinderte', 'bildschirmleser', 'tastaturnavigation'
    ];
    return !unwantedTerms.some(term => lower.includes(term));
  });

  // Generiere 5 USPs dynamisch
  const usps = [];
  
  // Verwende gefilterte Bulletpoints oder generiere basierend auf technischen Daten
  if (filteredBullets.length >= 5) {
    usps.push(...filteredBullets.slice(0, 5));
  } else {
    // Generiere USPs basierend auf technischen Daten
    if (data.tech.ladestrom) {
      usps.push(`Helle Beleuchtung bis ${data.tech.ladestrom}`);
    }
    if (data.tech.standards) {
      usps.push(`Weite Leuchtweite ${data.tech.standards}`);
    }
    if (data.tech.weight) {
      usps.push(`Leichtes Gewicht von ${data.tech.weight}`);
    }
    if (data.tech.inputs) {
      usps.push(`Moderne ${data.tech.inputs} Technologie`);
    }
    
    // Fallback-USPs falls nicht genug generiert werden konnten
    const fallbackUSPs = [
      'Hochwertige Verarbeitung',
      'Langlebige Konstruktion',
      'Einfache Bedienung',
      'Zuverlässige Leistung',
      'Gutes Preis-Leistungs-Verhältnis'
    ];
    
    while (usps.length < 5) {
      const fallback = fallbackUSPs[usps.length] || fallbackUSPs[0];
      if (!usps.includes(fallback)) {
        usps.push(fallback);
      } else {
        usps.push(`Professionelle Qualität`);
        break;
      }
    }
  }

  // Generiere technische Daten dynamisch
  const techData = [];
  if (data.tech.geeignet) techData.push(['Lampentyp', data.tech.geeignet]);
  if (data.tech.ladestrom) techData.push(['Leuchtleistung', data.tech.ladestrom]);
  if (data.tech.standards) techData.push(['Leuchtweite', data.tech.standards]);
  if (data.tech.outputs) techData.push(['Lichtfarbe', data.tech.outputs]);
  if (data.tech.inputs) techData.push(['Stromversorgung', data.tech.inputs]);
  if (data.tech.weight) techData.push(['Gewicht', data.tech.weight]);
  if (data.tech.size) techData.push(['Abmessungen', data.tech.size]);

  // Generiere HTML dynamisch
  let html = `<h2>${data.title || 'Produkt'}</h2>\n`;
  
  // Einleitung
  const intro = filteredBullets.length > 0 ? filteredBullets[0] : 'Professionelle Taschenlampe mit modernster Technologie';
  html += `<p>${intro}</p>\n\n`;
  
  // USPs
  html += `<h4>Vorteile & Eigenschaften:</h4>\n`;
  usps.forEach(usp => {
    html += `<p>✅ ${usp}</p>\n`;
  });
  
  // Technische Daten
  if (techData.length > 0) {
    html += `\n<h4>Technische Daten</h4>\n`;
    html += `<table>\n`;
    techData.forEach(([key, value]) => {
      html += `<tr><td>${key}:</td><td>${value}</td></tr>\n`;
    });
    html += `</table>\n`;
  }
  
  // Lieferumfang
  html += `\n<h4>Lieferumfang</h4>\n`;
  html += `<p>1 × ${data.title || 'Produkt'}</p>`;

  return html;
}
