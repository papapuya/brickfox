# Server Directory Structure

## 📁 Ordnerstruktur

```
server/
├── config/              # Konfigurationsdateien
│   ├── credentials.ts   # Credentials Management
│   └── encryption.ts    # Encryption Utilities
│
├── middleware/          # Express Middleware
│   ├── error-handler.ts    # Zentrale Error-Behandlung
│   ├── permissions.ts      # Permission Checks
│   ├── subscription.ts     # Subscription Middleware
│   └── validation.ts       # Zod Validation
│
├── prompts/             # AI Prompt Templates
│   ├── base-system.ts
│   ├── narrative.ts
│   ├── orchestrator.ts
│   └── ...
│
├── repositories/        # Data Access Layer
│   ├── base-repository.ts
│   ├── product-repository.ts
│   ├── project-repository.ts
│   └── supplier-repository.ts
│
├── routes/              # API Routes (wird erstellt)
│   ├── routes-supabase.ts  # Haupt-Routes
│   └── routes-mapping.ts   # Mapping Routes
│
├── scrapers/            # Web Scraping
│   └── php/             # PHP Scraper Scripts
│
├── scripts/             # Utility Scripts
│   ├── create-admin.ts
│   ├── reset-scraper-selectors.ts
│   ├── setup-ansmann-selectors.ts
│   └── ...
│
├── services/            # Business Logic Layer
│   ├── admin-service.ts
│   ├── cache-service.ts
│   ├── product-service.ts
│   ├── project-service.ts
│   └── supplier-service.ts
│
├── templates/           # Template Engine
│   ├── ai-generator.ts
│   ├── renderer.ts
│   └── ...
│
├── tests/               # Tests
│   └── legacy/          # Legacy Test Files
│
├── utils/               # Utilities
│   ├── errors.ts        # Custom Error Classes
│   └── logger.ts        # Winston Logger
│
├── index.ts             # Server Entry Point
├── db.ts                # Database Connection (Legacy)
├── supabase.ts          # Supabase Client
├── supabase-auth.ts     # Auth Utilities
├── supabase-storage.ts  # Storage Layer (Legacy - wird durch Repositories ersetzt)
├── scraper-service.ts   # Scraping Service
├── ai-service.ts        # AI Service
└── stripe-service.ts    # Stripe Integration
```

## 🏗️ Architektur-Pattern

### Clean Architecture
```
Routes → Services → Repositories → Supabase API
```

### Beispiel Flow:
```
GET /api/products/:id
  ↓
ProductService.getProductById()
  ↓
ProductRepository.findById()
  ↓
Supabase API
```

## 📝 Wichtige Dateien

### Entry Point
- `index.ts` - Server Start, Middleware Setup

### Core Services
- `services/product-service.ts` - Product Business Logic
- `services/project-service.ts` - Project Business Logic
- `services/supplier-service.ts` - Supplier Business Logic
- `services/cache-service.ts` - Caching Layer

### Repositories
- `repositories/*-repository.ts` - Data Access Layer

### Middleware
- `middleware/error-handler.ts` - Zentrale Error-Behandlung
- `middleware/validation.ts` - Request Validation

## 🔧 Scripts

Alle Utility-Scripts befinden sich in `server/scripts/`:

```bash
# Admin erstellen
npm run create-admin

# ANSMANN Selectors setup
npm run setup-ansmann

# Selectors zurücksetzen
npm run reset-selectors
```

## 🧪 Tests

Legacy Test-Dateien befinden sich in `server/tests/legacy/`.

## 📦 Dependencies

- **Express** - Web Framework
- **Supabase** - Database & Auth
- **Winston** - Logging
- **Zod** - Validation
- **NodeCache** - Caching

## 🚀 Development

```bash
# Development Server
npm run dev

# Build
npm run build

# Production
npm start
```

