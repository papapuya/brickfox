# MediaMarkt Tools - Produktmanagement

## Übersicht
Eine moderne Full-Stack Web-Anwendung zur automatischen Generierung von KI-gestützten Produktbeschreibungen aus Lieferantendaten. Die App nutzt OpenAI für intelligente Textgenerierung und Firecrawl für Website-Analyse.

## Letzte Änderungen
- **28.10.2025**: Projekt erfolgreich in Replit importiert
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

## Support & Dokumentation
Weitere technische Details finden Sie in:
- `API-SETUP.md` - API-Konfiguration
- `TECHNICAL-OVERVIEW.md` - Detaillierte technische Übersicht
- `TECHNICAL-FAQ.md` - Häufige Fragen
- `DEPLOYMENT.md` - Deployment-Anweisungen
