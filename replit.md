# MediaMarkt Tools - Produktmanagement

## Overview
This full-stack web application automates the generation of AI-powered product descriptions from supplier data. It leverages OpenAI for intelligent text generation and Firecrawl for website analysis, aiming to streamline content creation for MediaMarkt. The system is designed for efficient mass processing of product data, primarily through CSV uploads, offering significant cost and speed advantages over image analysis. It supports dynamic, product-specific AI prompts and a modular architecture for scalability and maintainability.

## User Preferences
Keine spezifischen Präferenzen dokumentiert.

## System Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Express.js, TypeScript
- **Database**: SQLite (Development), PostgreSQL (Production via Neon)
- **ORM**: Drizzle ORM
- **UI Libraries**: shadcn/ui, Radix UI, Tailwind CSS
- **AI/ML**: OpenAI API, Firecrawl API, Tesseract.js (OCR)

### System Design
The application features a **modular subprompt architecture** (implemented in `server/prompts/`) allowing for specialized AI prompts (e.g., USP generation, technical data extraction, narrative description, safety warnings, package contents) orchestrated by a central component. This design enhances testability, reusability, and cost-efficiency.

A **category-based template system** (in `server/templates/`) ensures flexible and structured product description generation. It uses a 3-layer approach:
1.  **Category Configuration**: Defines technical fields, USPs, and safety notices per product category.
2.  **AI Generator**: Returns structured JSON (not raw HTML), with prompts adapting to the specific category.
3.  **Template Renderer**: Constructs HTML from the AI-generated JSON, category configuration, and fallbacks.

This system supports automatic category recognition via keyword matching and dynamically adapts AI prompts to available product data, making it flexible for various suppliers.

**UI/UX**: Utilizes shadcn/ui, Radix UI, and Tailwind CSS for a modern and consistent user interface. The MediaMarkt-specific HTML template includes `h2/h4` structures, advantages (✅), technical tables, and package contents.

**Core Features**:
-   **CSV Enrichment**: Upload and process product data via CSV.
-   **URL Analysis**: Direct scraping of supplier websites using Firecrawl.
-   **AI Generation**: Automated product descriptions in the MediaMarkt format.
-   **Template System**: Customizable HTML templates for descriptions.
-   **Multi-URL Scraping**: Supports analyzing multiple URLs concurrently.
-   **Product-Specific AI Prompts**: Dynamic generation of USPs and descriptions based on actual product data, moving beyond generic templates.
-   **Product Categories**: Supports `battery`, `charger`, `tool`, `accessory`, and `testing_equipment` with improved category recognition.

### Project Structure
-   `client/`: React Frontend (components, hooks, lib, pages)
-   `server/`: Express Backend
    -   `prompts/`: Modular Subprompt Architecture (base-system, usp-generation, tech-extraction, narrative, safety-warnings, package-contents, orchestrator)
    -   `templates/`: Category-based Template System (category-config, ai-generator, renderer)
    -   `ai-service.ts`: OpenAI Integration
    -   `firecrawl-service.ts`: Firecrawl Integration
    -   `db.ts`: Database Setup
    -   `routes.ts`: API Routes
-   `shared/`: Shared Type Schemas
-   `dist/`: Build Output

## External Dependencies
-   **OpenAI API**: For AI-driven text generation.
-   **Firecrawl API**: For website scraping and content analysis.
-   **Tesseract.js**: For Optical Character Recognition (OCR) on product images.
-   **Neon (PostgreSQL)**: Production database hosting.

## 💰 Kosten & Skalierbarkeit für Massenverarbeitung

### CSV-Verarbeitung für 2000+ Produkte (Empfohlen)

| Verarbeitungsmethode | Kosten pro Produkt | 2000 Produkte | Geschwindigkeit |
|---------------------|-------------------|---------------|-----------------|
| **CSV + GPT-4o** (empfohlen) | ~$0.013 | ~$26 | Mittel (1-2h) |
| **CSV + GPT-4o-mini** | ~$0.0008 | ~$1.60 | Schnell (30-60min) |
| **CSV + Caching** (50% identisch) | ~$0.01 | ~$20 | Sehr schnell |
| **Bild + GPT-4o Vision** | ~$0.15 | ~$300 | Langsam (2-3h) |
| **PDF + Firecrawl + GPT-4o** | ~$0.025 | ~$50 | Mittel (1-2h) |
| **URL Scraping + Firecrawl + GPT-4o** | ~$0.016 | ~$32 | Mittel-Schnell |

**Best Practice**: CSV als Hauptquelle, Vision API nur für fehlende Daten

### Firecrawl API Kosten (2025)

**Credit-System:**
- Base Scraping (normale Website): **1 Credit pro Seite**
- PDF Parsing: **+1 Credit pro Seite** (total 2 Credits/Seite)
- Structured Extraction (JSON): **+5 Credits pro Request**
- Stealth Proxy Mode: **+4 Credits**

**Pricing:**
- **Free Tier**: Verfügbar zum Testen
- **Starter**: Ab **$16/Monat** für 1.000 Credits
- **Pro**: Höhere Volumina verfügbar

**Beispiel-Rechnung (2000 Produkte):**
```
Szenario 1: URLs scrapen
- 2000 URLs × 1 Credit = 2.000 Credits (~$32)
- Mit Structured Extraction: 2000 × 6 Credits = 12.000 Credits (~$192)

Szenario 2: PDF-Kataloge (5 Seiten pro Produkt)
- 2000 PDFs × 5 Seiten × 2 Credits = 20.000 Credits (~$320)
```

**Firecrawl PDF-Capabilities:**
- ✅ Direkte PDF-Extraktion von URLs (keine File-Uploads)
- ✅ Multi-Spalten-Layouts und Tabellen
- ✅ Markdown oder HTML Output
- ✅ Strukturierte JSON-Extraktion mit AI
- ✅ Batch-Processing mehrerer PDFs
- ⚠️ Password-geschützte PDFs benötigen Spezialbehandlung

**CSV-Anforderungen (Akku-Kategorie):**

Minimale Spalten:
- Produktname, Modell, Kapazität, Spannung

Optionale Spalten (verbessern Qualität):
- Typ, Technologie, Maße, Gewicht, Schutzschaltung, Max. Ladestrom, Max. Entladestrom, Besonderheiten

**Workflow:**
```
CSV hochladen → Spalten-Mapping → AI-Generierung → Export mit Produktbeschreibungen
```

## 💳 Laufende Kosten bei der App-Entwicklung auf Replit

### Replit Abonnement-Kosten

| Plan | Monatspreis | Inkl. Guthaben | Verwendung |
|------|-------------|----------------|------------|
| **Core** | ~$20/Monat | $25 Guthaben | Einzelentwickler |
| **Teams** | ~$40/User | $40 Guthaben pro User | Team-Projekte |

**Wichtig**: Die inkludierten Guthaben decken normalerweise **alle** Entwicklungskosten ab (AI Agent, Datenbank, Deployment). Nicht genutztes Guthaben verfällt am Monatsende.

### Entwicklungskosten (innerhalb der Guthaben)

**Während der Entwicklung:**
- ✅ **AI Agent** (dieser Assistent): ~$0.25 pro Checkpoint (Code-Änderung)
  - Einfache Fixes: <$0.25
  - Komplexe Features: >$0.25
  - Planung ist kostenlos - nur Implementierung kostet
- ✅ **Datenbank (PostgreSQL)**:
  - Compute Time: Nur wenn aktiv (5 Min nach letzter Anfrage)
  - Storage: ~33 MB Minimum, max 10 GiB
- ✅ **Code-Speicherung**: Kostenlos im Abonnement

**Typische Entwicklung dieser App:**
- Agent-Nutzung: ~$5-15/Monat (je nach Änderungsumfang)
- Datenbank (SQLite Dev): $0 (lokal)
- **Total Development**: Meist unter $25 Guthaben

### Deployment/Publishing Kosten (Production)

**Nach Veröffentlichung fallen zusätzlich an:**

1. **Outbound Data Transfer** (ausgehender Traffic):
   - Core: 100 GiB/Monat **kostenlos**
   - Danach: ~$0.10 pro GiB
   - Beispiel bei 2000 Akkus: ~5-10 GiB/Monat = $0

2. **Autoscale Deployment** (empfohlen für diese App):
   - Compute Units: CPU + RAM Nutzung
   - Requests: Pro Anfrage
   - **Statische Deployments**: $0 Compute Units

3. **PostgreSQL Production Database**:
   - Compute Time: Nur bei aktiven Queries
   - Storage: Erste 10 GiB meist unter $5/Monat
   - Für 2000 Akkus: ~$2-5/Monat

**Geschätzte Production-Kosten (nach Launch):**
- Traffic: $0-2/Monat (innerhalb Free Tier)
- Datenbank: $2-5/Monat
- Compute: $5-10/Monat (bei moderater Nutzung)
- **Total Production**: ~$7-17/Monat

### External API-Kosten (zusätzlich zu Replit)

**Diese Kosten fallen außerhalb von Replit an:**

| Service | Verwendung | Kosten |
|---------|-----------|--------|
| **OpenAI API** | GPT-4o für Produktbeschreibungen | $0.013/Produkt |
| **Firecrawl API** | URL/PDF Scraping (optional) | Ab $16/Monat für 1.000 Credits |

**Einmalige Bulk-Verarbeitung (2000 Akkus):**
- OpenAI: ~$26 (CSV) bis ~$300 (Bilder)
- Firecrawl: ~$32 (URLs) bis ~$320 (PDFs)

**Laufende Nutzung (z.B. 100 neue Produkte/Monat):**
- OpenAI: ~$1.30/Monat (CSV)
- Firecrawl: Optional, nur bei Bedarf

### Gesamtkosten-Übersicht

**Monatliche Kosten während Entwicklung:**
```
Replit Core Abo:        $20/Monat (inkl. $25 Guthaben)
AI Agent Nutzung:       $0-5 (innerhalb Guthaben)
Externe APIs:           $0 (nur bei Bulk-Verarbeitung)
─────────────────────────────────────────────────
Total Development:      ~$20/Monat
```

**Monatliche Kosten nach Launch (Production):**
```
Replit Core Abo:        $20/Monat
Production Deployment:  $7-17/Monat (über Guthaben hinaus)
Datenbank:             (im Deployment enthalten)
Laufende Nutzung:      $1-5/Monat (100 neue Produkte)
─────────────────────────────────────────────────
Total Production:       ~$28-42/Monat
```

### Kosten-Spar-Tipps

1. **CSV bevorzugen** statt Bildanalyse (90% günstiger)
2. **Statisches Deployment** wenn möglich (keine Compute Units)
3. **Caching nutzen** für identische Produkte
4. **Guthaben ausschöpfen** innerhalb des Monats (verfällt sonst)
5. **Budgetlimits setzen** in Replit-Einstellungen