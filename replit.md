# PIMPilot - Produktmanagement SaaS

## Overview
PIMPilot is a **multi-tenant SaaS platform** that automates the generation of AI-powered product descriptions and PIM metadata from supplier data. It leverages OpenAI GPT-4o-mini for intelligent text generation and a custom Cheerio-based web scraper for website analysis, streamlining content creation for MediaMarkt. 

**Key Features:**
- 🔐 **User Authentication:** Secure login/register with Passport.js + bcrypt
- 💳 **Stripe Subscription:** Tier-based pricing (Starter €29, Pro €79, Enterprise €199)
- 🎁 **Trial Mode:** 100 free AI-generations for new users (no credit card required)
- 📊 **Usage Tracking:** Real-time API call monitoring with tier-based limits
- 🛡️ **Protected Routes:** AuthProvider with subscription-based access control
- 🔄 **Graceful Fallback:** Works without Stripe (trial mode) for immediate testing

The system is designed for efficient mass processing of product data (2000+ products), primarily through CSV uploads, with dynamic AI prompts and modular architecture.

## User Preferences
Keine spezifischen Präferenzen dokumentiert.

## 🚀 Quick Start (Ohne Stripe)

### 1. App starten
```bash
npm run dev
```

### 2. Registrieren
- Öffnen Sie `/register`
- Erstellen Sie einen Account
- **Automatisch:** 100 kostenlose AI-Generierungen (Trial)

### 3. Sofort loslegen
- CSV hochladen → Bulk-Generierung
- URL scrapen → Einzelprodukt-Analyse
- Alle Features testen

### 4. Später: Stripe aktivieren (Optional)
- Folgen Sie `STRIPE_SETUP.md`
- Fügen Sie API-Keys hinzu
- Bezahl-Funktion aktiviert sich automatisch

## System Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Express.js, TypeScript
- **Database**: SQLite (Development), PostgreSQL (Production via Neon)
- **ORM**: Drizzle ORM
- **UI Libraries**: shadcn/ui, Radix UI, Tailwind CSS
- **AI/ML**: OpenAI API (GPT-4o)
- **Web Scraping**: Cheerio (Custom scraper service)

### System Design
The application features a **modular subprompt architecture** (implemented in `server/prompts/`) allowing for specialized AI prompts (e.g., USP generation, technical data extraction, narrative description, safety warnings, package contents) orchestrated by a central component. This design enhances testability, reusability, and cost-efficiency.

A **category-based template system** (in `server/templates/`) ensures flexible and structured product description generation. It uses a 3-layer approach:
1.  **Category Configuration**: Defines technical fields, USPs, and safety notices per product category.
2.  **AI Generator**: Returns structured JSON (not raw HTML), with prompts adapting to the specific category.
3.  **Template Renderer**: Constructs HTML from the AI-generated JSON, category configuration, and fallbacks.

This system supports automatic category recognition via keyword matching and dynamically adapts AI prompts to available product data, making it flexible for various suppliers.

**UI/UX**: Utilizes shadcn/ui, Radix UI, and Tailwind CSS for a modern and consistent user interface. The MediaMarkt-specific HTML template includes `h2/h4` structures, advantages (✅), technical tables, and package contents.

**Core Features**:
-   **🔐 User Authentication**: Passport.js Local Strategy + bcrypt password hashing
-   **💳 Subscription Management**: Stripe integration (3 tiers: Starter, Pro, Enterprise)
-   **🎁 Trial Mode**: 100 free AI-generations for new users without payment
-   **📊 Usage Tracking**: Real-time API call monitoring with automatic limit enforcement
-   **🛡️ Protected Routes**: AuthContext + ProtectedRoute components for access control
-   **CSV Bulk Processing**: Upload and process product data via CSV for mass generation (2000+ products)
-   **URL Web Scraper**: Direct scraping of supplier websites using custom Cheerio-based scraper with configurable CSS selectors
-   **AI Generation**: Automated product descriptions in the MediaMarkt format using OpenAI GPT-4o-mini
-   **Template System**: Customizable HTML templates for descriptions
-   **Multi-URL Scraping**: Supports analyzing multiple URLs concurrently with timeout protection
-   **Product-Specific AI Prompts**: Dynamic generation of USPs and descriptions based on actual product data
-   **Product Categories**: Supports `battery`, `charger`, `tool`, `accessory`, and `testing_equipment` with improved category recognition
-   **Project Management**: Save and organize generated products into projects
-   **Supplier Profiles**: Manage multiple suppliers with saved selectors and auto-population

### Project Structure
-   `client/`: React Frontend (components, hooks, lib, pages)
-   `server/`: Express Backend
    -   `prompts/`: Modular Subprompt Architecture (base-system, usp-generation, tech-extraction, narrative, safety-warnings, package-contents, orchestrator)
    -   `templates/`: Category-based Template System (category-config, ai-generator, renderer)
    -   `ai-service.ts`: OpenAI Integration
    -   `scraper-service.ts`: Custom Cheerio-based Web Scraper
    -   `storage.ts`: Project and Product Management
    -   `db.ts`: Database Setup
    -   `routes.ts`: API Routes
-   `shared/`: Shared Type Schemas
-   `dist/`: Build Output

## External Dependencies
-   **OpenAI API**: For AI-driven text generation (GPT-4o).
-   **Neon (PostgreSQL)**: Production database hosting (optional, uses SQLite in development).

## 💰 Kosten & Skalierbarkeit für Massenverarbeitung

### CSV-Verarbeitung für 2000+ Produkte (Empfohlen)

| Verarbeitungsmethode | Kosten pro Produkt | 2000 Produkte | Geschwindigkeit |
|---------------------|-------------------|---------------|-----------------|
| **CSV + GPT-4o-mini** (NEU, STANDARD) | ~$0.0004 | ~$0.80 | Schnell (30-60min) |
| **URL Scraping + GPT-4o-mini** | ~$0.0004 | ~$0.80 | Mittel-Schnell |
| **CSV + GPT-4o** (alt) | ~$0.013 | ~$26 | Mittel (1-2h) |

**Best Practice**: GPT-4o-mini ist jetzt Standard (97% Ersparnis!), CSV für Massenverarbeitung, URL Scraper für einzelne Produkte

### Custom Web Scraper (Cheerio)

**Features:**
- ✅ Kostenlos (keine externen API-Kosten)
- ✅ Konfigurierbare CSS-Selektoren für flexible Datenextraktion
- ✅ **Intelligente Auto-Erkennung**: Findet automatisch Produktlinks ohne manuelle Selektoren (16 gängige Muster)
- ✅ **Intelligenter Tabellen-Parser**: Extrahiert automatisch technische Daten aus generischen Property-Tabellen (Nitecore-Stil)
- ✅ **Keyword-basiertes Mapping**: Erkennt Felder wie "Länge", "Gewicht", "Leuchtmittel" automatisch
- ✅ Timeout-Schutz (20 Sekunden pro Produkt) mit AbortController für robuste Verarbeitung
- ✅ User-Agent Headers für bessere Kompatibilität
- ✅ Preis-Parsing mit korrekter Dezimalkomma-Konvertierung (19,99 € → 19.99)
- ✅ **Produktlisten-Scraping**: Batch-Verarbeitung mehrerer Produkte mit Fortschrittsanzeige
- ✅ **CSV-Export**: UTF-8 BOM-kodiert für Excel, mit allen Feldern (inkl. Bild-URLs)
- ✅ **Tabellenvorschau**: Vollständige Ansicht aller gescrapten Daten mit Thumbnails
- ✅ Direkte Integration mit OpenAI für AI-Beschreibungen

**Limitationen:**
- ⚠️ Funktioniert nicht mit JavaScript-heavy Websites (z.B. Single Page Apps)
- ⚠️ Kann durch Bot-Schutz blockiert werden
- ⚠️ Kein PDF-Parsing (nur HTML-Seiten)

**Workflow (Einzelnes Produkt):**
```
URL eingeben → CSS-Selektoren konfigurieren → Scraping → AI-Generierung (GPT-4o-mini) → Speichern im Projekt
```

**Workflow (Produktliste):**
```
Listen-URL eingeben → Produktlink-Selektor konfigurieren → Batch-Scraping → CSV-Vorschau → Download
```

**NEUE Features (Okt 2025):**
- ✅ **Request Queue + Retry Logic**: Automatische Wiederholung bei Rate Limit Errors (5 Retries mit Exponential Backoff: 1s→2s→4s→8s→16s)
- ✅ **GPT-4o-mini als Standard**: 30× günstiger ($0.00015 vs $0.0025 per 1K Tokens) - fest im Code für alle Generierungen
- ✅ **Kostenoptimierung**: Statt $0.013 pro Produkt jetzt nur noch $0.0004 - **97% Ersparnis!**

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
| **Core** | $25/Monat | $25 Guthaben | Einzelentwickler |
| **Teams** | ~$40/User | $40 Guthaben pro User | Team-Projekte |

**Wichtig**: Die inkludierten Guthaben decken **Basis-Nutzung** ab (AI Agent, Datenbank, Deployment). Wenn Sie mehr nutzen als das Guthaben, fallen **zusätzliche Kosten** an.

**Typische monatliche Gesamtkosten:**
- Minimale Nutzung: $25/Monat (nur Abo)
- Normale Entwicklung: $40-60/Monat (Abo + zusätzliche Nutzung)
- Intensive Nutzung: $60-100/Monat (viel AI Agent, Production Deployment)

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
- Agent-Nutzung: ~$15-35/Monat (je nach Änderungsumfang)
  - Einfache Wartung: ~$10-15
  - Aktive Entwicklung: ~$25-35
- Datenbank (SQLite Dev): $0 (lokal)
- **Total Development**: $40-60/Monat (realistisch bei aktiver Entwicklung)

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

**Einmalige Bulk-Verarbeitung (2000 Akkus):**
- OpenAI: ~$26 (CSV)

**Laufende Nutzung (z.B. 100 neue Produkte/Monat):**
- OpenAI: ~$1.30/Monat (CSV)

### Gesamtkosten-Übersicht

**Monatliche Kosten während Entwicklung:**
```
Replit Core Abo:        $25/Monat (Basis)
AI Agent Nutzung:       $15-35/Monat (zusätzlich)
Externe APIs:           $0 (nur bei Bulk-Verarbeitung)
─────────────────────────────────────────────────
Total Development:      ~$40-60/Monat
```

**Monatliche Kosten nach Launch (Production):**
```
Replit Core Abo:        $25/Monat
AI Agent (Wartung):     $10-20/Monat
Production Deployment:  $10-25/Monat
Laufende Nutzung:       $1-5/Monat (100 neue Produkte)
─────────────────────────────────────────────────
Total Production:       ~$45-75/Monat
```

### Kosten-Spar-Tipps

1. **CSV bevorzugen** für Massenverarbeitung (schnell und günstig)
2. **URL Scraper** nur für einzelne Produkte nutzen (kostenlos außer OpenAI)
3. **Statisches Deployment** wenn möglich (keine Compute Units)
4. **Caching nutzen** für identische Produkte
5. **Guthaben ausschöpfen** innerhalb des Monats (verfällt sonst)
6. **Budgetlimits setzen** in Replit-Einstellungen