# Architektur-Migrations-Guide

## ✅ Was wurde implementiert

### 1. **Error Handling & Validation** ✅
- ✅ `server/utils/errors.ts` - Custom Error Classes
- ✅ `server/middleware/error-handler.ts` - Zentrale Error-Behandlung
- ✅ `server/middleware/validation.ts` - Zod Validation Middleware

### 2. **Repository Pattern** ✅
- ✅ `server/repositories/base-repository.ts` - Base Interface
- ✅ `server/repositories/product-repository.ts` - Product Repository
- ✅ `server/repositories/project-repository.ts` - Project Repository
- ✅ `server/repositories/supplier-repository.ts` - Supplier Repository

### 3. **Service Layer** ✅
- ✅ `server/services/product-service.ts` - Product Business Logic
- ✅ `server/services/project-service.ts` - Project Business Logic
- ✅ `server/services/supplier-service.ts` - Supplier Business Logic

### 4. **Caching** ✅
- ✅ `server/services/cache-service.ts` - In-Memory Caching mit NodeCache

### 5. **Logging** ✅
- ✅ `server/utils/logger.ts` - Winston Logger mit strukturiertem Logging
- ✅ `server/index.ts` - Integration von Logger und Error Handler

### 6. **Helium DB Entfernung** 🔄
- ✅ `server/db.ts` - Vereinfacht (nur Legacy-Exports)
- ⚠️ **TODO**: Helium DB Referenzen aus anderen Dateien entfernen

---

## 📝 Verwendung der neuen Architektur

### Beispiel: Product Endpoint mit neuer Architektur

**Vorher (Alte Architektur):**
```typescript
app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const product = await supabaseStorage.createProduct(...);
    // Business-Logik direkt hier
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Nachher (Neue Architektur):**
```typescript
import { ProductService } from './services/product-service';
import { validate } from './middleware/validation';
import { createProductInProjectSchema } from '@shared/schema';

const productService = new ProductService();

app.post(
  '/api/products',
  requireAuth,
  validate({ body: createProductInProjectSchema }),
  async (req, res, next) => {
    try {
      const product = await productService.createProduct(req.body, req.user);
      res.json(product);
    } catch (error) {
      next(error); // Error Handler kümmert sich darum
    }
  }
);
```

### Beispiel: Mit Caching

```typescript
import { cacheService } from './services/cache-service';
import { ProductService } from './services/product-service';

const productService = new ProductService();

app.get('/api/products/:id', requireAuth, async (req, res, next) => {
  try {
    const cacheKey = cacheService.key('product', req.params.id, req.user.tenantId);
    
    const product = await cacheService.get(
      cacheKey,
      () => productService.getProductById(req.params.id, req.user),
      600 // 10 Minuten TTL
    );
    
    res.json(product);
  } catch (error) {
    next(error);
  }
});
```

---

## 🔄 Migration von bestehenden Routes

### Schritt 1: Import Services
```typescript
import { ProductService } from './services/product-service';
import { ProjectService } from './services/project-service';
import { SupplierService } from './services/supplier-service';

const productService = new ProductService();
const projectService = new ProjectService();
const supplierService = new SupplierService();
```

### Schritt 2: Ersetze supabaseStorage Calls
```typescript
// ❌ ALT:
const product = await supabaseStorage.createProduct(projectId, data, userId);

// ✅ NEU:
const product = await productService.createProduct(data, req.user);
```

### Schritt 3: Füge Validation hinzu
```typescript
import { validate } from './middleware/validation';
import { createProductInProjectSchema } from '@shared/schema';

app.post(
  '/api/products',
  requireAuth,
  validate({ body: createProductInProjectSchema }), // ✅ Validation
  async (req, res, next) => {
    // ...
  }
);
```

### Schritt 4: Verwende Error Handler
```typescript
// ❌ ALT:
try {
  // ...
} catch (error) {
  res.status(500).json({ error: error.message });
}

// ✅ NEU:
try {
  // ...
} catch (error) {
  next(error); // Error Handler kümmert sich automatisch
}
```

---

## 🗑️ Helium DB Entfernung

### Dateien die noch Helium DB verwenden:
1. `server/routes-supabase.ts` - Viele Helium DB Referenzen
2. `server/supabase-storage.ts` - Fallback-Logik für Helium DB
3. `server/routes-mapping.ts` - Helium DB Import
4. `server/webhooks-supabase.ts` - Helium DB Import

### Migration-Strategie:
1. **Ersetze alle `heliumDb` Calls** durch Repository-Calls
2. **Entferne Fallback-Logik** (nur noch Supabase)
3. **Entferne Helium DB Imports**

**Beispiel:**
```typescript
// ❌ ALT:
import { db as heliumDb } from './db';
const users = await heliumDb.select().from(usersTable).where(...);

// ✅ NEU:
import { SupabaseUserRepository } from './repositories/user-repository';
const userRepo = new SupabaseUserRepository();
const user = await userRepo.findById(id);
```

---

## 📊 Nächste Schritte

### Priorität 1: Routes migrieren
- [ ] `/api/products` Routes auf Services umstellen
- [ ] `/api/projects` Routes auf Services umstellen
- [ ] `/api/suppliers` Routes auf Services umstellen

### Priorität 2: Helium DB komplett entfernen
- [ ] Alle `heliumDb` Referenzen entfernen
- [ ] Fallback-Logik entfernen
- [ ] Tests aktualisieren

### Priorität 3: Caching optimieren
- [ ] Häufige Queries cachen
- [ ] Cache-Invalidation implementieren
- [ ] Cache-Strategien für verschiedene Endpoints

### Priorität 4: Monitoring
- [ ] Metriken hinzufügen (Prometheus)
- [ ] Error Tracking (Sentry)
- [ ] Performance Monitoring

---

## 🎯 Vorteile der neuen Architektur

1. **Saubere Trennung**: Routes → Services → Repositories
2. **Testbarkeit**: Services können einfach gemockt werden
3. **Wiederverwendbarkeit**: Services können von verschiedenen Routes verwendet werden
4. **Type Safety**: Vollständige TypeScript-Unterstützung
5. **Error Handling**: Zentrale, konsistente Fehlerbehandlung
6. **Validation**: Automatische Request-Validierung
7. **Performance**: Caching für bessere Performance
8. **Observability**: Strukturiertes Logging

---

## 📚 Weitere Verbesserungen

### Async Processing (Optional)
```typescript
import Bull from 'bull';

const aiQueue = new Bull('ai-processing', {
  redis: process.env.REDIS_URL,
});

// Background Job
app.post('/api/products/:id/enhance', async (req, res) => {
  const job = await aiQueue.add('enhance-product', {
    productId: req.params.id,
    userId: req.user.id,
  });
  
  res.json({ jobId: job.id, status: 'processing' });
});
```

### Rate Limiting (Optional)
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use('/api/', apiLimiter);
```

---

**Status:** Grundlegende Architektur implementiert ✅
**Nächster Schritt:** Routes migrieren und Helium DB entfernen

