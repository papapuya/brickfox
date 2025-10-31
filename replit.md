# PIMPilot - Produktmanagement SaaS

## Overview
PIMPilot is a production-ready multi-tenant B2B SaaS platform designed to automate the generation of AI-powered product descriptions and PIM metadata from supplier data. It targets efficient mass processing of product data, primarily via CSV uploads, for multiple business customers using a single application instance with complete data isolation. The platform leverages OpenAI GPT-4o-mini for intelligent text generation and a custom Cheerio-based web scraper.

**Key Capabilities:**
- Multi-Tenant Architecture with organization-based data isolation.
- Secure user authentication and Stripe-based subscription management with a trial mode offering 100 free AI generations.
- Real-time API call monitoring and usage tracking with tier-based limits.
- Dynamic AI prompting and a modular subprompt architecture for flexible content generation.
- Category-based template system for structured product description output.

## User Preferences
Keine spezifischen Präferenzen dokumentiert.

## System Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Radix UI, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Supabase) with Drizzle ORM
- **AI/ML**: OpenAI API (GPT-4o-mini)
- **Web Scraping**: Cheerio (Custom scraper service)
- **Authentication**: Passport.js + bcrypt

### System Design
The application employs a **modular subprompt architecture** (`server/prompts/`) for specialized AI tasks (e.g., USP generation, technical data extraction, safety warnings) orchestrated by a central component. A **category-based template system** (`server/templates/`) uses a 3-layer approach: Category Configuration, AI Generator (returning structured JSON), and Template Renderer (constructing HTML). This system supports automatic category recognition and dynamic AI prompt adaptation.

**Multi-Tenancy**: Achieved through server-side enforcement using `organization_id` foreign keys across all relevant tables, ensuring complete data isolation and preventing cross-tenant access. Security measures include NULL organization_id blocking and security logging.

**Core Features**:
- **Multi-Tenant Architecture**: Data isolation via `organization_id` foreign keys.
- **User Authentication**: Passport.js Local Strategy with bcrypt and Supabase.
- **Subscription Management**: Stripe integration for tiered access (Starter, Pro, Enterprise) and a trial mode.
- **Usage Tracking**: Real-time API call monitoring with limit enforcement.
- **Protected Routes**: Server-side organization filtering and client-side protection.
- **CSV Bulk Processing**: Upload and process product data via CSV for mass AI generation.
- **URL Web Scraper**: Custom Cheerio-based scraper with configurable CSS selectors, intelligent auto-recognition, and a tables parser. Supports multi-URL scraping with timeout protection. **Automatic Login**: Suppliers can be configured with login credentials (encrypted at rest with AES-256) to access protected websites - system automatically performs login and captures session cookies for scraping requests.
- **AI Generation**: Automated product descriptions in a MediaMarkt-like format using OpenAI GPT-4o-mini, with dynamic, product-specific prompts.
- **Project Management**: Save and organize generated products into projects.
- **Supplier Profiles**: Manage multiple suppliers with saved selectors.
- **Pixi ERP Integration**: Automated product comparison with Pixi ERP system to identify new vs. existing products, with CSV upload, intelligent matching (article number + EAN validation), 5-minute caching, and CSV export functionality.

## External Dependencies
-   **OpenAI API**: Used for AI-driven text generation (GPT-4o-mini).
-   **Supabase (PostgreSQL)**: The production database, leveraged for its PostgreSQL capabilities, UUID primary keys, and organization-based multi-tenancy support.
-   **Stripe**: Integrated for subscription management and payment processing.
-   **Pixi ERP API**: External integration for product inventory comparison and duplicate detection.

## Recent Changes (Okt 2025)

### Multi-Tenant Database Migration (30. Okt 2025) ✅ COMPLETED
- **Database**: Successfully migrated Supabase Remote database to multi-tenant architecture
- **Schema Changes**: Added `organizations` table and `organization_id` + `role` columns to all relevant tables
- **User Setup**: Admin user (saranzerrer@icloud.com) assigned to AkkuShop organization as admin
- **Status**: Project creation now working with full organization isolation
- **Database**: Exclusively uses Supabase Remote (lxemqwvdaxzeldpjmxoc.supabase.co) - local Helium DB deprecated

### Pixi ERP Integration
- **New Service**: `server/services/pixi-service.ts` - Pixi API integration with 5-min caching
- **API Endpoints**: 
  - `POST /api/pixi/compare` - CSV upload & comparison
  - `POST /api/pixi/compare-json` - JSON-based comparison
  - `DELETE /api/pixi/cache` - Manual cache clearing
- **Frontend**: 
  - Standalone page `/pixi-compare` with CSV upload UI
  - **Integrated project comparison** - Direct Pixi comparison from project detail page (30. Okt 2025)
    - Button "Mit Pixi vergleichen" in project header
    - Supplier number dialog
    - Dedicated Pixi tab with statistics (NEU/VORHANDEN counts)
    - Results table with status badges
    - CSV export functionality
- **Matching Logic**: Article number (primary) + EAN validation (secondary)
- **Security**: Full multi-tenant isolation with requireAuth middleware
- **Documentation**: See `PIXI_INTEGRATION.md` for details

### Automatic Supplier Login (31. Okt 2025) ✅ COMPLETED
- **Feature**: Automatic authentication for protected supplier websites
- **Database Schema**: 5 new columns in `suppliers` table:
  - `login_url` - URL to POST credentials to
  - `login_username_field` - Form field name for username
  - `login_password_field` - Form field name for password
  - `login_username` - Stored username
  - `login_password` - **Encrypted with AES-256-CBC** (at rest)
- **Security Implementation**:
  - Passwords encrypted before storage using `server/encryption.ts` (AES-256-CBC)
  - API responses NEVER return decrypted passwords (`loginPassword` always `undefined`)
  - Internal-only `getSupplierWithCredentials()` method for login automation
  - Session cookies captured and stored for future requests
- **Login Flow** (`server/scraper-service.ts`):
  1. POST form-encoded credentials to `login_url`
  2. Capture `Set-Cookie` headers from response
  3. Store cookies in `session_cookies` field
  4. Attach cookies to all subsequent scraping requests
- **UI**: Supplier dialog includes expandable "Login-Konfiguration" section
- **Automatic Integration**: Scraping endpoints detect login config and perform authentication automatically
- **Security Requirements**: `ENCRYPTION_KEY` environment variable must be configured in all environments