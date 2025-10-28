export interface TechnicalField {
  key: string;
  label: string;
  unit?: string;
  required: boolean;
  fallback?: string;
}

export interface ProductCategoryConfig {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  technicalFields: TechnicalField[];
  uspTemplates: string[];
  safetyNotice: string;
  productHighlights: string[];
}

export const PRODUCT_CATEGORIES: Record<string, ProductCategoryConfig> = {
  battery: {
    id: 'battery',
    name: 'Akku/Batterie',
    description: 'Wiederaufladbare Akkus und Einwegbatterien',
    keywords: ['akku', 'batterie', 'battery', 'li-ion', 'lithium', 'nimh', 'nicd', 'mah', 'wh'],
    technicalFields: [
      { key: 'capacity', label: 'Kapazität', unit: 'mAh', required: true, fallback: 'Nicht angegeben' },
      { key: 'voltage', label: 'Spannung', unit: 'V', required: true, fallback: 'Nicht angegeben' },
      { key: 'chemistry', label: 'Technologie', required: false, fallback: 'Lithium-Ionen' },
      { key: 'protection', label: 'Schutzschaltung', required: false, fallback: 'Ja' },
      { key: 'weight', label: 'Gewicht', unit: 'g', required: false, fallback: 'Nicht angegeben' },
      { key: 'dimensions', label: 'Abmessungen', unit: 'mm', required: false, fallback: 'Nicht angegeben' },
    ],
    uspTemplates: [
      'Wiederaufladbar - spart Kosten und schont die Umwelt',
      'Integrierte Schutzschaltung - maximale Sicherheit vor Überladung und Tiefentladung',
      'Langlebige Lithium-Ionen Technologie - lange Lebensdauer und hohe Zyklenfestigkeit',
      'Professionelle Qualität - zuverlässig für den täglichen Einsatz',
      'Kein Memory-Effekt - jederzeit nachladbar ohne Kapazitätsverlust',
      'Umweltfreundlich - nachhaltige Energieversorgung',
      'Hohe Energiedichte - langanhaltende Leistung bei kompakter Bauweise',
    ],
    safetyNotice: '⚠️ Nicht ins Feuer werfen oder erhitzen. Vor Kurzschluss schützen. Nur mit geeigneten Ladegeräten laden. Von Kindern fernhalten. Bei Beschädigung nicht mehr verwenden.',
    productHighlights: [
      'Robustes Gehäuse und langlebige Verarbeitung',
      'Zuverlässige Energieversorgung für professionelle Anwendungen',
      'Hohe Leistung bei geringem Gewicht',
      'Optimales Preis-Leistungs-Verhältnis',
      'Kompatibel mit vielen Geräten',
    ],
  },

  charger: {
    id: 'charger',
    name: 'Ladegerät',
    description: 'Ladegeräte für Akkus und Batterien',
    keywords: ['ladegerät', 'charger', 'lader', 'charging', 'laden', 'netzteil'],
    technicalFields: [
      { key: 'input', label: 'Eingang', unit: 'V/A', required: true, fallback: '230V AC' },
      { key: 'output', label: 'Ausgang', unit: 'V/A', required: true, fallback: 'Nicht angegeben' },
      { key: 'chargingTime', label: 'Ladezeit', unit: 'h', required: false, fallback: 'Abhängig von Akkukapazität' },
      { key: 'compatibility', label: 'Kompatibilität', required: false, fallback: 'Siehe Beschreibung' },
      { key: 'features', label: 'Funktionen', required: false, fallback: 'Standard-Ladefunktion' },
      { key: 'weight', label: 'Gewicht', unit: 'g', required: false, fallback: 'Nicht angegeben' },
    ],
    uspTemplates: [
      'Intelligente Ladesteuerung - optimale Ladung für maximale Akkulebensdauer',
      'Mehrfachschutz - gegen Überladung, Überhitzung und Kurzschluss',
      'Schnellladefunktion - spart wertvolle Zeit',
      'Universal einsetzbar - kompatibel mit verschiedenen Akkutypen',
      'LED-Anzeige - zeigt den aktuellen Ladestatus',
      'Kompaktes Design - ideal für unterwegs',
      'Energieeffizient - niedriger Standby-Verbrauch',
    ],
    safetyNotice: '⚠️ Nur in trockenen Räumen verwenden. Nicht abdecken während des Ladevorgangs. Bei Überhitzung sofort vom Netz trennen. Kinder beaufsichtigen. Nur mit kompatiblen Akkus verwenden.',
    productHighlights: [
      'Hochwertige Elektronik für sichere Ladung',
      'Langlebige Konstruktion für jahrelangen Einsatz',
      'Einfache Bedienung und klare Anzeigen',
      'Zuverlässige Leistung bei kompakter Bauweise',
      'Optimales Preis-Leistungs-Verhältnis',
    ],
  },

  tool: {
    id: 'tool',
    name: 'Werkzeug',
    description: 'Elektrowerkzeuge und Handwerkzeuge',
    keywords: ['werkzeug', 'tool', 'bohrmaschine', 'säge', 'schleifer', 'schrauber', 'akkuschrauber'],
    technicalFields: [
      { key: 'power', label: 'Leistung', unit: 'W', required: true, fallback: 'Nicht angegeben' },
      { key: 'torque', label: 'Drehmoment', unit: 'Nm', required: false, fallback: 'Nicht angegeben' },
      { key: 'speed', label: 'Drehzahl', unit: 'min⁻¹', required: false, fallback: 'Nicht angegeben' },
      { key: 'voltage', label: 'Spannung', unit: 'V', required: false, fallback: 'Nicht angegeben' },
      { key: 'weight', label: 'Gewicht', unit: 'kg', required: false, fallback: 'Nicht angegeben' },
      { key: 'dimensions', label: 'Abmessungen', unit: 'mm', required: false, fallback: 'Nicht angegeben' },
    ],
    uspTemplates: [
      'Kraftvolle Leistung - für anspruchsvolle Arbeiten',
      'Ergonomisches Design - ermüdungsfreies Arbeiten auch bei langen Einsätzen',
      'Robuste Konstruktion - langlebig und zuverlässig',
      'Vielseitig einsetzbar - für professionelle und private Anwendungen',
      'Präzise Arbeitsweise - exakte Ergebnisse',
      'Einfache Handhabung - intuitive Bedienung',
      'Sicheres Arbeiten - integrierte Sicherheitsfunktionen',
    ],
    safetyNotice: '⚠️ Bedienungsanleitung vor Gebrauch lesen. Schutzkleidung (Brille, Handschuhe, Gehörschutz) tragen. Werkstück sicher fixieren. Von Kindern fernhalten. Regelmäßige Wartung durchführen.',
    productHighlights: [
      'Professionelle Qualität für anspruchsvolle Aufgaben',
      'Langlebige Verarbeitung und hochwertige Materialien',
      'Optimal ausbalanciert für präzise Kontrolle',
      'Vielseitig einsetzbar in Werkstatt und auf der Baustelle',
      'Hervorragendes Preis-Leistungs-Verhältnis',
    ],
  },
};

export function detectCategory(productData: any): string {
  const searchText = [
    productData.product_name || '',
    productData.short_intro || '',
    productData.description || '',
    JSON.stringify(productData.bullets || []),
  ].join(' ').toLowerCase();

  for (const [categoryId, config] of Object.entries(PRODUCT_CATEGORIES)) {
    const matches = config.keywords.filter(keyword => 
      searchText.includes(keyword.toLowerCase())
    ).length;

    if (matches > 0) {
      return categoryId;
    }
  }

  return 'battery';
}

export function getCategoryConfig(categoryId: string): ProductCategoryConfig {
  return PRODUCT_CATEGORIES[categoryId] || PRODUCT_CATEGORIES.battery;
}

export function getAllCategories(): ProductCategoryConfig[] {
  return Object.values(PRODUCT_CATEGORIES);
}
