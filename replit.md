# MediaMarkt Tools - Produktmanagement

## Übersicht
Eine moderne Full-Stack Web-Anwendung zur automatischen Generierung von KI-gestützten Produktbeschreibungen aus Lieferantendaten. Die App nutzt OpenAI für intelligente Textgenerierung und Firecrawl für Website-Analyse.

## Letzte Änderungen
- **28.10.2025 (Nacht)**: Multi-Prompt-Architektur & neue Produktkategorien
  - **🔧 MODULAR SUBPROMPT-ARCHITEKTUR implementiert**:
    - System unterstützt nun zwei Modi: Modular (Standard) & Monolithisch (Legacy)
    - Neue Prompt-Struktur in `server/prompts/`:
      - `base-system.ts` - Grundprinzipien & Qualitätsregeln
      - `usp-generation.ts` - Verkaufsfördernde USPs (5 Stück)
      - `tech-extraction.ts` - Technische Datenextraktion
      - `narrative.ts` - Produktbeschreibung (4-5 Sätze)
      - `safety-warnings.ts` - Sicherheitshinweise
      - `package-contents.ts` - Lieferumfang
      - `orchestrator.ts` - Kombiniert Subprompts intelligent
    - **Vorteile**: Einzeln testbar in Make/n8n, günstiger, wiederverwendbar, agenten-fähig
  - **✅ 2 NEUE PRODUKTKATEGORIEN**:
    - **Zubehör** (accessory) - Kabel, Adapter, Klemmen, Krokodilklemmen, Halterungen
    - **Messgerät** (testing_equipment) - Innenwiderstandstester, Multimeter, Prüfgeräte
  - **🎯 Verbesserte Kategorie-Erkennung**:
    - Wählt jetzt BESTE Match (meiste Keyword-Treffer) statt ersten Match
    - Behebt Problem mit Krokodilklemmen (wurde fälschlich als Ladegerät erkannt)
    - Logging für besseres Debugging
  - **🔨 Alle TypeScript-Fehler behoben** (44 → 0 Fehler)
  
- **28.10.2025 (Abend)**: Kategorie-basiertes Template-System implementiert
  - **Neue 3-Schicht-Architektur** für flexible Produktbeschreibungen:
    1. Kategorie-Konfiguration (category-config.ts) - definiert technische Felder, USPs und Sicherheitshinweise pro Produktkategorie
    2. AI-Generator (ai-generator.ts) - AI gibt strukturiertes JSON zurück statt HTML
    3. Template Renderer (renderer.ts) - baut HTML aus JSON + Kategorie-Config
  - **5 Produktkategorien** jetzt verfügbar: Akku/Batterie, Ladegerät, Werkzeug, Zubehör, Messgerät
  - **Automatische Kategorie-Erkennung** via Keyword-Matching (wählt beste Match)
  - **Dynamischer AI-Prompt** - passt sich an verfügbare Produktdaten an
  - **Flexibel für verschiedene Lieferanten** - funktioniert mit unterschiedlichen Datenmengen
  - System behebt "oh jee"-Problem: AI gibt keine Template-Anweisungen mehr aus
  
- **28.10.2025 (Nachmittag)**: MediaMarkt-Template und Type-System erweitert
  - ProductImage, CreatorProduct und HtmlTemplate Typen in shared/schema.ts definiert
  - MediaMarkt-Template mit h2/h4-Struktur, Vorteilen (✅), technischer Tabelle und Lieferumfang erstellt
  - TypeScript Type-Annotations für alle Template-Funktionen hinzugefügt
  - MediaMarkt-Template als Standardtemplate (erstes in der Liste) konfiguriert
  
- **28.10.2025 (Vormittag)**: Projekt erfolgreich in Replit importiert
  - Vite-Konfiguration für Replit-Umgebung angepasst (Host: 0.0.0.0, Port: 5000)
  - SQLite-Datenbank initialisiert
  - Workflow konfiguriert und getestet
  - .gitignore erstellt

## Benutzer-Präferenzen
Keine spezifischen Präferenzen dokumentiert.

## Projekt-Architektur

### Technologie-Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Datenbank**: SQLite (Development) / PostgreSQL (Production via Neon)
- **ORM**: Drizzle ORM
- **UI-Bibliothek**: shadcn/ui + Radix UI + Tailwind CSS
- **AI/ML**: OpenAI API, Firecrawl API, Tesseract.js (OCR)

### Projektstruktur
```
├── client/              # React Frontend
│   ├── src/
│   │   ├── components/  # UI-Komponenten (shadcn/ui)
│   │   ├── hooks/       # React Hooks
│   │   ├── lib/         # Utilities & Services
│   │   └── pages/       # App-Seiten
│   └── index.html
├── server/              # Express Backend
│   ├── prompts/         # 🆕 MODULARE SUBPROMPT-ARCHITEKTUR
│   │   ├── types.ts            # Subprompt Type-Definitionen
│   │   ├── base-system.ts      # Grund-Systemprompt (Qualitätsregeln)
│   │   ├── usp-generation.ts   # USP-Generierung (5 verkaufsfördernde Bullets)
│   │   ├── tech-extraction.ts  # Technische Daten-Extraktion
│   │   ├── narrative.ts        # Produktbeschreibung (4-5 Sätze)
│   │   ├── safety-warnings.ts  # Sicherheitshinweise
│   │   ├── package-contents.ts # Lieferumfang
│   │   ├── orchestrator.ts     # Orchestrator für kombinierte Calls
│   │   └── index.ts            # Exports
│   ├── templates/       # Kategorie-basiertes Template-System
│   │   ├── category-config.ts  # Produktkategorien-Definitionen (5 Kategorien)
│   │   ├── ai-generator.ts     # Dual-Mode: Modular (neu) + Monolithisch (legacy)
│   │   ├── renderer.ts         # HTML-Template-Rendering
│   │   └── types.ts            # Template-spezifische Typen
│   ├── ai-service.ts    # OpenAI Integration
│   ├── firecrawl-service.ts  # Firecrawl Integration
│   ├── db.ts            # Datenbank-Setup
│   ├── routes.ts        # API Routes
│   └── index.ts         # Server Entry Point
├── shared/              # Gemeinsame Typen
│   └── schema.ts        # Drizzle Schema
└── dist/                # Build Output
```

### Hauptfunktionen
1. **CSV-Anreicherung**: Upload und Verarbeitung von Produktdaten-CSVs
2. **URL-Analyse**: Direkte Analyse von Lieferanten-Websites mit Firecrawl
3. **Bildanalyse**: KI-gestützte Analyse von Produktbildern (OCR + Vision)
4. **KI-Generierung**: Automatische Produktbeschreibungen im MediaMarkt-Format
5. **Projektmanagement**: Verwaltung mehrerer Produktdaten-Projekte
6. **Template-System**: Anpassbare HTML-Templates für Beschreibungen
7. **API-Verwaltung**: Sichere Verwaltung von OpenAI und Firecrawl API-Keys

### Konfiguration

#### Entwicklung (Development)
- **Server**: Läuft auf `localhost:5000` mit Vite Dev-Server integriert
- **Datenbank**: SQLite (local.db)
- **Host**: Frontend auf 0.0.0.0 (für Replit-Proxy)

#### Produktion (Production)
- **Server**: Express mit statischem Build-Output
- **Datenbank**: PostgreSQL über Neon
- **Build**: `npm run build` erstellt optimierte Builds

### Umgebungsvariablen
Die App benötigt folgende API-Keys (optional für lokale Entwicklung):
- `OPENAI_API_KEY`: Für KI-Textgenerierung
- `FIRECRAWL_API_KEY`: Für Website-Scraping
- `DATABASE_URL`: PostgreSQL-URL (nur Production)
- `PORT`: Server-Port (Standard: 5000)
- `NODE_ENV`: development/production

### Verfügbare Scripts
- `npm run dev`: Startet Development-Server
- `npm run build`: Erstellt Production-Build
- `npm run start`: Startet Production-Server
- `tsx server/migrate.ts`: Initialisiert SQLite-Datenbank

### Architektur-Entscheidungen

**28.10.2025 (Nacht) - Multi-Prompt-Architektur**
- **Problem**: Monolithische Prompts sind schwer testbar, teuer, nicht wiederverwendbar
- **Lösung**: Modulare Subprompt-Architektur in `server/prompts/`
  - 6 spezialisierte Subprompts (USPs, Tech, Narrative, Safety, Package)
  - Orchestrator kombiniert Subprompts intelligent
  - Dual-Mode: Wahl zwischen Modular (Standard) oder Monolithisch (Legacy)
  - Jeder Subprompt einzeln testbar in Make/n8n
- **Vorteile**: 
  - ✅ A/B-Testing pro Modul möglich
  - ✅ Caching & Wiederverwendung von Ergebnissen
  - ✅ Günstiger (kleinere Context-Fenster)
  - ✅ Agenten-fähig (GPT kann Subprompts selbst wählen)
- **Neue Kategorien**: Zubehör (Kabel, Klemmen) & Messgerät (Tester, Multimeter)
- **Verbesserte Erkennung**: Beste Match statt erster Match (behebt Krokodilklemmen-Problem)

**28.10.2025 (Abend) - Kategorie-basiertes Template-System**
- **Problem**: Alte AI-Prompts waren zu komplex → AI gab Template-Anweisungen direkt aus ("VERWENDE technicalSpecs.standards")
- **Lösung**: 3-Schicht-Architektur
  1. **Kategorie-Config**: Definiert was für Akku/Ladegerät/Werkzeug/Zubehör/Messgerät wichtig ist
  2. **AI → JSON**: AI gibt strukturiertes JSON zurück (kein HTML!), Prompt passt sich an Kategorie an
  3. **Code → HTML**: Server baut HTML aus JSON + Kategorie-Config + Fallbacks
- **Flexibilität**: System funktioniert mit unterschiedlichen Lieferantendaten (viele oder wenige Infos)
- **Erweiterbarkeit**: Neue Kategorien einfach in `server/templates/category-config.ts` hinzufügen
- **Automatik**: Kategorie wird automatisch via Keywords erkannt (beste Match-Logik)

**28.10.2025 - Replit-Anpassungen**
- Vite-Server muss auf 0.0.0.0 binden, damit Replit-Proxy funktioniert
- HMR-Client-Port auf 443 gesetzt für sichere WebSocket-Verbindungen
- Backend läuft auf localhost (127.0.0.1) in Development
- Frontend und Backend teilen sich Port 5000 (Vite integriert in Express)

**Original-Design**
- Dual-Database-Strategie: SQLite für schnelle lokale Entwicklung, PostgreSQL für Production
- Monorepo-Struktur mit shared schema für Type-Safety zwischen Frontend/Backend
- AI-Service-Abstraktion für flexible Integration verschiedener LLM-Provider
- Template-basierte Generierung für konsistente Ausgaben

## Deployment
Für Production-Deployment auf Replit verwenden Sie den "Deploy"-Button. Die App ist bereits für Autoscale-Deployment konfiguriert.

## Kategorie-System: Neue Produktkategorien hinzufügen

Das neue kategorie-basierte Template-System macht es einfach, neue Produkttypen hinzuzufügen. Folgen Sie diesen Schritten:

### 1. Kategorie-Konfiguration erstellen

Öffnen Sie `server/templates/category-config.ts` und fügen Sie eine neue Kategorie zum `PRODUCT_CATEGORIES` Objekt hinzu:

```typescript
electronics: {
  id: 'electronics',
  name: 'Elektronik',
  description: 'Elektronische Geräte und Zubehör',
  keywords: ['elektronik', 'device', 'gadget', 'usb', 'kabel'],
  technicalFields: [
    { key: 'connectivity', label: 'Anschlüsse', required: true, fallback: 'USB' },
    { key: 'power', label: 'Leistung', unit: 'W', required: false },
    { key: 'weight', label: 'Gewicht', unit: 'g', required: false },
  ],
  uspTemplates: [
    'Einfache Bedienung - intuitive Steuerung',
    'Vielseitig einsetzbar - für viele Anwendungen',
    'Kompaktes Design - platzsparend',
  ],
  safetyNotice: '⚠️ Bedienungsanleitung beachten. Nicht in feuchten Umgebungen verwenden.',
  productHighlights: [
    'Moderne Technologie für zuverlässigen Betrieb',
    'Hochwertige Verarbeitung und Materialien',
    'Optimales Preis-Leistungs-Verhältnis',
  ],
}
```

### 2. Kategorie-Erkennung testen

Die Kategorie wird automatisch erkannt basierend auf den `keywords`. Testen Sie mit Beispieldaten:
- Keywords sollten typische Begriffe enthalten, die in Produktnamen/Beschreibungen vorkommen
- System wählt erste Kategorie mit Match (Reihenfolge in PRODUCT_CATEGORIES wichtig!)

### 3. Template anpassen (optional)

Falls nötig, können Sie in `server/templates/renderer.ts` spezielle Rendering-Logik für die neue Kategorie hinzufügen.

### 4. System testen

Laden Sie ein Testprodukt hoch und prüfen Sie:
- ✅ Wird die richtige Kategorie erkannt? (Log: "Detected category: ...")
- ✅ Sind die technischen Felder korrekt?
- ✅ Passen die USPs zur Kategorie?

### Verfügbare Kategorien (Stand 28.10.2025)

1. **Akku/Batterie** (`battery`) - Wiederaufladbare Akkus und Batterien
2. **Ladegerät** (`charger`) - Ladegeräte für Akkus
3. **Werkzeug** (`tool`) - Elektrowerkzeuge und Handwerkzeuge
4. **Zubehör** (`accessory`) - Kabel, Adapter, Klemmen, Taschen, Halterungen
5. **Messgerät** (`testing_equipment`) - Innenwiderstandstester, Multimeter, Prüfgeräte

## Support & Dokumentation
Weitere technische Details finden Sie in:
- `API-SETUP.md` - API-Konfiguration
- `TECHNICAL-OVERVIEW.md` - Detaillierte technische Übersicht
- `TECHNICAL-FAQ.md` - Häufige Fragen
- `DEPLOYMENT.md` - Deployment-Anweisungen
