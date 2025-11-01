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
- **Database**: PostgreSQL (Helium Dev / Supabase Production) with Drizzle ORM
- **AI/ML**: OpenAI API (GPT-4o-mini)
- **Web Scraping**: Cheerio (Custom scraper service)
- **Authentication**: Supabase Auth (JWT-based)

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

### Multi-Tenant Database Migration + Supabase Auth (30. Okt → 01. Nov 2025) ✅ COMPLETED
- **Database Architecture**: 
  - **Development**: Helium PostgreSQL (local) - fast, no network latency
  - **Production**: Supabase PostgreSQL via Port 6543 (Pooler) - scalable, managed
  - **Switch**: Single `DATABASE_URL` environment variable
- **Schema Changes**: 
  - Renamed `organizations` → `tenants` table
  - Renamed all `organization_id` → `tenant_id` columns across 7 tables
  - Migrated from SQLite to PostgreSQL (UUID primary keys, JSONB, timestamps)
- **Row-Level Security (RLS)**: 
  - Enabled RLS on all 7 tables (tenants, users, projects, products_in_projects, suppliers, templates, scrape_session)
  - Created 10 RLS policies with `get_tenant_id()` helper function
  - Middleware sets `tenant_id` via PostgreSQL `set_config()` for RLS context
  - Service role bypass for admin operations
- **Authentication Migration** (Passport.js → Supabase Auth):
  - ✅ Backend: Supabase Auth API (routes-supabase.ts)
  - ✅ Frontend: Supabase Client + AuthContext with session listeners
  - ✅ JWT: Access tokens from Supabase Auth stored in localStorage
  - ✅ Cleanup: Removed Passport.js, bcryptjs, express-session, memorystore
- **Database Logging**: Auto-detects Helium vs Supabase, logs DNS/SSL/timeout errors
- **User Setup**: Admin user (saranzerrer@icloud.com) assigned to AkkuShop tenant as admin
- **Status**: Full tenant isolation + Production-ready Supabase Auth

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

### Pixi Supplier Number Auto-Fill (31. Okt 2025) ✅ COMPLETED
- **Feature**: Automatic population of Pixi supplier number in comparison dialog
- **Database**: Uses existing `supplNr` field in `suppliers` table (column: `suppl_nr`)
- **UI Changes**:
  - Added "Pixi-Lieferantennummer" input field to supplier profile dialog
  - Auto-fills supplier number when opening Pixi comparison dialog
- **Logic**: 
  - When user clicks "Mit Pixi vergleichen", system fetches all suppliers
  - If supplier(s) have `supplNr` configured, first one is auto-filled
  - Falls back to empty string if no suppliers or no `supplNr` configured
- **User Experience**: Eliminates manual entry of supplier number for repeat comparisons
- **Error Handling**: Toast notification if suppliers cannot be loaded

### CSS Selector Verification System (31. Okt 2025) ✅ COMPLETED
- **Feature**: Comprehensive selector testing and verification workflow for supplier-specific CSS selectors
- **Critical Issue**: Each supplier requires individualized CSS selectors due to different website structures
- **Database Schema**: 2 new columns in `suppliers` table:
  - `verified_fields` (TEXT) - JSON array of verified field names
  - `last_verified_at` (TIMESTAMP) - Timestamp of last verification update
- **Backend**:
  - `POST /api/scraper/test-selector` - Real-time testing of individual CSS selectors with preview results
  - Returns extracted text, HTML, and attribute values for validation
  - Supports login-aware scraping with session cookies
  - Integrated with encryption and automatic login flow
- **Frontend UX**:
  - **Test-URL Input**: Required input field for testing selectors
  - **Per-Field Test Buttons**: "Testen" button next to each selector field
  - **Visual Verification Status**: Green checkmark (✓) for verified fields, amber warning (⚠️) for unverified
  - **Toast Previews**: Shows first 100 chars of extracted value for instant validation
  - **Starter Template**: Button renamed to "Starter-Template laden (anpassen erforderlich)" with warning banner
  - **Draft Mode**: Template loads selectors but marks them as unverified, requiring manual testing
- **Verification Flow**:
  1. User enters Test-URL for supplier's product page
  2. Clicks test button for each selector
  3. System fetches page (with login if configured), applies selector, shows extracted value
  4. Visual feedback: Green checkmark appears, field added to verifiedFields Set
  5. If selector value changes: Verification status resets (must re-test)
  6. On save: verifiedFields array + lastVerifiedAt timestamp sent to backend
  7. Backend stores in Supabase (JSON string for verified_fields)
  8. On reload: Verification state persists and restores from database
- **State Management**: verifiedFields Set tracks verification, automatically resets when selector value changes
- **Persistence**: Verification metadata survives page reload, session restart, and dialog reopening
- **Security**: Test endpoint respects multi-tenant isolation and uses encrypted login credentials