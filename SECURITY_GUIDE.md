# 🔒 Sicherheits-Guide - Credentials & Sensible Daten

## 🎯 Übersicht

Dieser Guide erklärt, wie Sie Ihre Credentials und sensiblen Daten sicher verwalten, damit sie nicht für andere sichtbar sind.

---

## ✅ Was bereits sicher ist

### 1. `.gitignore` Konfiguration
- ✅ `.env` Dateien werden ignoriert
- ✅ `credentials.json` wird ignoriert
- ✅ Alle Log-Dateien werden ignoriert

### 2. Environment Variables
- ✅ Alle API Keys werden aus `process.env` gelesen
- ✅ Keine hardcoded Supabase Keys
- ✅ Keine hardcoded Stripe Keys

---

## 🚨 KRITISCH: Was Sie sofort tun müssen

### 1. `.env` Datei erstellen

```bash
# Kopieren Sie die Template-Datei
cp .env.example .env

# Bearbeiten Sie .env und fügen Sie Ihre echten Credentials ein
# NIEMALS .env ins Git Repository committen!
```

### 2. Hardcoded Credentials entfernen

**❌ FALSCH:**
```typescript
const password = 'Admin2024Secure!'; // NIEMALS!
const apiKey = 'sk-proj-...'; // NIEMALS!
```

**✅ RICHTIG:**
```typescript
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error('ADMIN_PASSWORD not set');
```

### 3. Git Repository prüfen

**WICHTIG:** Wenn Sie bereits Credentials ins Repository committed haben:

```bash
# 1. Prüfen Sie, ob sensible Dateien im Git sind
git ls-files | grep -E '\.(env|key|pem|json)$'

# 2. Wenn .env bereits committed wurde, entfernen Sie es:
git rm --cached .env
git commit -m "Remove .env from repository"

# 3. Rotieren Sie alle betroffenen Credentials:
# - Erstellen Sie neue API Keys
# - Ändern Sie Passwörter
# - Aktualisieren Sie Secrets
```

---

## 📋 Best Practices

### 1. Environment Variables verwenden

**Für alle Credentials:**
```typescript
// ✅ RICHTIG
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured');
}
```

### 2. `.env.example` als Template

- ✅ Erstellen Sie `.env.example` mit Platzhaltern
- ✅ Committen Sie `.env.example` ins Repository
- ❌ Committen Sie NIEMALS `.env` ins Repository

### 3. Verschiedene Environments

```bash
# Development
.env.development

# Production
.env.production

# Test
.env.test
```

### 4. Secrets Management (Production)

**Für Production verwenden Sie:**
- ✅ **Vercel/Netlify:** Environment Variables in Dashboard
- ✅ **Docker:** Docker Secrets
- ✅ **Kubernetes:** Kubernetes Secrets
- ✅ **AWS:** AWS Secrets Manager
- ✅ **Azure:** Azure Key Vault

---

## 🔐 Aktuelle Credentials im Code

### ⚠️ Noch zu beheben:

1. **Admin Passwörter** in Scripts:
   - `server/create-admin-now.ts`
   - `server/reset-admin-password.ts`
   - → Sollten `process.env.ADMIN_PASSWORD` verwenden

2. **PHP Scraper Passwords**:
   - `server/scrapers/php/mediacom.php`
   - `server/scrapers/php/wentronic.php`
   - → Sollten Environment Variables verwenden

### ✅ Bereits sicher:

- ✅ Supabase Keys → Environment Variables
- ✅ Stripe Keys → Environment Variables
- ✅ OpenAI Keys → Environment Variables (nach Fix)
- ✅ `api-key-manager.ts` → Verschlüsselung

---

## 🛡️ Sicherheits-Checkliste

### Vor jedem Commit:

- [ ] Keine Passwörter im Code
- [ ] Keine API Keys im Code
- [ ] Keine Secrets in Kommentaren
- [ ] `.env` nicht committed
- [ ] `credentials.json` nicht committed
- [ ] Alle Credentials in `.env.example` dokumentiert (mit Platzhaltern)

### Vor jedem Push:

- [ ] `git status` prüfen - keine `.env` Dateien
- [ ] `git diff` prüfen - keine Credentials sichtbar
- [ ] Sensible Dateien in `.gitignore`

### Regelmäßig:

- [ ] Credentials rotieren (alle 90 Tage)
- [ ] API Keys überprüfen (ungültige entfernen)
- [ ] Zugriffsrechte prüfen
- [ ] Logs auf sensible Daten prüfen

---

## 🔍 Credentials finden

### Im Code suchen:

```bash
# Nach Passwörtern suchen
grep -r "password.*=" server/ --exclude-dir=node_modules

# Nach API Keys suchen
grep -r "api.*key.*=" server/ --exclude-dir=node_modules

# Nach Secrets suchen
grep -r "secret.*=" server/ --exclude-dir=node_modules
```

### Im Git History prüfen:

```bash
# Prüfen, ob Credentials im Git History sind
git log -p --all -S "Admin2024Secure" -- server/

# Wenn gefunden:
# 1. Credentials rotieren
# 2. Git History bereinigen (git filter-branch) oder
# 3. Repository neu erstellen
```

---

## 📚 Weitere Ressourcen

### Tools:

- **git-secrets:** Verhindert versehentliches Committen von Secrets
- **truffleHog:** Scannt Git History nach Secrets
- **detect-secrets:** Findet Secrets im Code

### Dokumentation:

- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

---

## 🆘 Was tun, wenn Credentials geleakt wurden?

### Sofort:

1. **Credentials rotieren:**
   - Alle betroffenen API Keys neu erstellen
   - Alle Passwörter ändern
   - Alle Secrets aktualisieren

2. **Git History bereinigen:**
   ```bash
   # Warnung: Dies ändert die Git History!
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Repository neu erstellen** (wenn möglich)

4. **Betroffene Services benachrichtigen:**
   - OpenAI: API Key deaktivieren
   - Stripe: API Key rotieren
   - Supabase: Keys neu generieren

---

**Letzte Aktualisierung:** 2025-01-XX
**Status:** ✅ `.gitignore` konfiguriert, `.env.example` erstellt

