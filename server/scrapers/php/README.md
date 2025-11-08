# PHP Scraper Integration

Dieser Ordner enthält PHP-Scraper-Dateien, die von Node.js aufgerufen werden können.

## Zwei Arten von Scrapern

### 1. **Einzel-URL-Scraper** (Bulk URLs - PDF → URLs → Scrape)
Für das Scrapen einzelner Produkt-URLs, die z.B. aus einem PDF extrahiert wurden:

**Workflow:**
1. PDF wird hochgeladen → URLs werden extrahiert
2. URLs werden in `sessionStorage` gespeichert
3. Navigation zum URL-Scraper
4. **Jede URL wird einzeln gescraped** (Bulk-Processing)

**PHP-Scripts:**
- `scrape-mediacom.php` - Scraper für einzelne Mediacom-URLs
- `scrape-wentronic.php` - Scraper für einzelne Wentronic-URLs

**API-Endpunkt:** `/api/scrape-product`
```json
{
  "url": "https://mediacom-it.de/product/123",
  "supplierId": "mediacom"
}
```
→ Wird für **jede einzelne URL** aufgerufen (Bulk-Processing)

### 2. **Kategorie-Scraper** (Komplette Kategorien mit Array)
Für das Scrapen kompletter Kategorien über mehrere Seiten:

**Workflow:**
1. Kategorie-URL wird eingegeben (z.B. `https://mediacom-it.de/energy/`)
2. Scraper geht durch mehrere Seiten der Kategorie
3. **Extrahiert alle Produkt-URLs als Array**
4. Diese URLs können dann optional auch gescraped werden

**PHP-Scripts:**
- `scrape-category-mediacom.php` - Scraper für Mediacom-Kategorien
- `scrape-category-wentronic.php` - TODO: Noch zu erstellen

**API-Endpunkte:**
- `/api/scrape-product-list` - Einzelne Listen-Seite
- `/api/scrape-all-pages` - Mehrere Seiten mit Pagination

```json
{
  "url": "https://mediacom-it.de/energy/",
  "supplierId": "mediacom",
  "maxPages": 10
}
```
→ Gibt **Array von Produkt-URLs** zurück

## Automatische Integration

Die PHP-Scraper werden automatisch verwendet, wenn:
1. `supplierId` im Request übergeben wird
2. Ein passender PHP-Scraper für diesen Supplier existiert
3. `usePhpScraper: true` ist (Standard)

### Supplier-Mapping

**Einzel-URL-Scraper (Bulk):**
- `mediacom` oder `media` → `scrape-mediacom.php`
- `wentronic` oder `went` → `scrape-wentronic.php`

**Kategorie-Scraper (Array):**
- `mediacom` oder `media` → `scrape-category-mediacom.php`
- `wentronic` oder `went` → `scrape-category-wentronic.php` (TODO)

## Workflow-Details

### Workflow 1: PDF → URLs → Bulk Scrape

```
PDF Upload
  ↓
URLs extrahieren (aus PDF)
  ↓
URLs in sessionStorage speichern
  ↓
Navigation zu /url-scraper
  ↓
Für jede URL: POST /api/scrape-product
  ↓
Produktdaten sammeln
```

**Verwendet:** `scrape-mediacom.php` oder `scrape-wentronic.php` für jede einzelne URL

### Workflow 2: Kategorie → Array → Optional Scrape

```
Kategorie-URL eingeben
  ↓
POST /api/scrape-all-pages
  ↓
PHP-Scraper geht durch mehrere Seiten
  ↓
Gibt Array von Produkt-URLs zurück
  ↓
Optional: Diese URLs können auch gescraped werden
```

**Verwendet:** `scrape-category-mediacom.php` für komplette Kategorie

## PHP-Scraper CLI-Format

### Einzel-URL-Scraper (Bulk)
```bash
php scrape-mediacom.php <url> [selectors_json] [cookies] [userAgent]
```

**Parameter:**
- `$argv[1]` = URL (erforderlich)
- `$argv[2]` = Selectors (JSON, optional)
- `$argv[3]` = Cookies (optional)
- `$argv[4]` = User-Agent (optional)

**Output:** JSON mit Produktdaten
```json
{
  "articleNumber": "MCIT-12345",
  "productName": "Produktname",
  "price": "12,50",
  "images": ["url1", "url2"],
  ...
}
```

### Kategorie-Scraper (Array)
```bash
php scrape-category-mediacom.php <categoryUrl> [startPage] [maxPages] [cookies] [userAgent]
```

**Parameter:**
- `$argv[1]` = Kategorie-URL (erforderlich)
- `$argv[2]` = Start-Seite (Standard: 1)
- `$argv[3]` = Max Seiten (Standard: 10)
- `$argv[4]` = Cookies (optional)
- `$argv[5]` = User-Agent (optional)

**Output:** JSON mit Array von Produkt-URLs
```json
{
  "productUrls": [
    "https://mediacom-it.de/product/1",
    "https://mediacom-it.de/product/2",
    ...
  ],
  "count": 50,
  "pagesScraped": 3
}
```

## Fallback-Verhalten

Bei Fehlern fällt das System automatisch auf den TypeScript-Scraper zurück:
- Einzel-URLs → TypeScript `scrapeProduct()`
- Listen/Kategorien → TypeScript `scrapeProductList()` oder `scrapeAllPages()`

## Cache

Die Scraper verwenden einen Cache-Ordner (`cache/`) um HTML-Responses zu speichern und die Performance zu verbessern.

## Abhängigkeiten

Die PHP-Scraper benötigen:
- PHP 7.4+
- Composer mit `symfony/dom-crawler`
- `vendor/autoload.php` im Projekt-Root oder `server/` Ordner

## Status

✅ **Fertig:**
- Einzel-URL-Scraper für Mediacom und Wentronic (Bulk-Processing)
- Kategorie-Scraper für Mediacom (Array-Output)

⏳ **TODO:**
- Kategorie-Scraper für Wentronic (`scrape-category-wentronic.php`)

## Original-Scripts

Die originalen Batch-Scraper bleiben erhalten:
- `mediacom.php` - Original für Batch-Processing
- `wentronic.php` - Original für Batch-Processing

Diese können für manuelle Batch-Jobs verwendet werden.
