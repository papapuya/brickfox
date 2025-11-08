# 🚀 PimPilot Deployment Guide

Vollständige Anleitung zum Deployment Ihrer PimPilot SaaS-Anwendung.

---

## 📋 Übersicht der Deployment-Optionen

Sie haben **4 Optionen** zum Deployment:

1. **☁️ Render (Cloud)** - Empfohlen für schnelles Setup
2. **☁️ Railway (Cloud)** - Alternative zu Render
3. **🐳 Docker (On-Premise)** - Für lokalen Server
4. **💻 Direkt (On-Premise)** - Node.js direkt auf Server

---

## Option 1: ☁️ Render (Cloud) - Empfohlen

### Vorteile:
- ✅ Kostenloser Plan verfügbar
- ✅ Automatisches Deployment bei Git Push
- ✅ SSL-Zertifikat inklusive
- ✅ Einfaches Setup
- ✅ Keine Server-Verwaltung nötig

### Schritt-für-Schritt:

#### 1. Repository vorbereiten
```bash
# Stellen Sie sicher, dass Ihr Code auf GitHub ist
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. Render Account erstellen
1. Gehen Sie zu [render.com](https://render.com)
2. Erstellen Sie einen kostenlosen Account
3. Verbinden Sie Ihr GitHub-Konto

#### 3. Web Service erstellen
1. Klicken Sie auf **"New +"** → **"Web Service"**
2. Wählen Sie Ihr Repository aus
3. Konfigurieren Sie den Service:

   **Basis-Konfiguration:**
   - **Name**: `pimpilot` (oder Ihr gewünschter Name)
   - **Environment**: `Node`
   - **Region**: `Frankfurt (EU)` (für GDPR-Compliance)
   - **Branch**: `main`
   - **Plan**: `Free` (oder `Starter` für bessere Performance)

   **Build-Konfiguration:**
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `.` (leer lassen)

#### 4. Environment Variables setzen

Klicken Sie auf **"Environment"** und fügen Sie folgende Variablen hinzu:

```env
# Server
NODE_ENV=production
PORT=5000

# Supabase (Backend)
SUPABASE_URL=https://ihr-projekt.supabase.co
SUPABASE_ANON_KEY=ihr-anon-key
SUPABASE_SERVICE_ROLE_KEY=ihr-service-role-key

# Supabase (Frontend - werden ins Bundle kompiliert)
VITE_SUPABASE_URL=https://ihr-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=ihr-anon-key

# OpenAI
OPENAI_API_KEY=sk-ihr-openai-key

# Pixi ERP (optional)
PIXI_API_URL=https://akkutools.laptopakku.eu/api/pixi/pixiItemSearch
PIXI_AUTH_TOKEN=ihr-pixi-token

# Storage (optional - Standard: local)
STORAGE_TYPE=local
# Oder für S3:
# STORAGE_TYPE=s3
# S3_BUCKET=ihr-bucket-name
# S3_REGION=eu-central-1
# S3_ACCESS_KEY_ID=ihr-access-key
# S3_SECRET_ACCESS_KEY=ihr-secret-key

# Scheduler (optional)
ENABLE_SCHEDULED_BACKUPS=true

# Logging (optional)
LOG_LEVEL=info
```

#### 5. Deploy
1. Klicken Sie auf **"Create Web Service"**
2. Warten Sie, bis der Build abgeschlossen ist (~5-10 Minuten)
3. Ihre App ist unter `https://pimpilot.onrender.com` erreichbar

#### 6. Custom Domain (optional)
1. Gehen Sie zu **"Settings"** → **"Custom Domain"**
2. Fügen Sie Ihre Domain hinzu (z.B. `pimpilot.akkushop.de`)
3. Folgen Sie den DNS-Anweisungen

---

## Option 2: ☁️ Railway (Cloud) - Alternative

### Vorteile:
- ✅ Sehr einfaches Setup
- ✅ Automatisches Deployment
- ✅ Gute Performance
- ✅ Einfache Skalierung

### Schritt-für-Schritt:

#### 1. Railway Account erstellen
1. Gehen Sie zu [railway.app](https://railway.app)
2. Erstellen Sie einen Account (mit GitHub)
3. Klicken Sie auf **"New Project"**

#### 2. Repository verbinden
1. Wählen Sie **"Deploy from GitHub repo"**
2. Wählen Sie Ihr Repository aus
3. Railway erkennt automatisch Node.js

#### 3. Environment Variables setzen
1. Gehen Sie zu **"Variables"**
2. Fügen Sie die gleichen Environment Variables wie bei Render hinzu (siehe oben)

#### 4. Deploy
- Railway deployt automatisch
- Ihre App ist unter `https://ihr-projekt.up.railway.app` erreichbar

---

## Option 3: 🐳 Docker (On-Premise)

### Vorteile:
- ✅ Läuft auf jedem Server
- ✅ Einfache Updates
- ✅ Isolierte Umgebung
- ✅ Einfache Skalierung

### Voraussetzungen:
- Docker & Docker Compose installiert
- Server mit Linux/Windows Server

### Schritt-für-Schritt:

#### 1. Repository auf Server klonen
```bash
git clone https://github.com/ihr-username/pimpilot.git
cd pimpilot
```

#### 2. `.env` Datei erstellen
```bash
# Erstellen Sie eine .env Datei
nano .env
```

Fügen Sie alle Environment Variables hinzu (siehe Option 1, Schritt 4).

#### 3. Docker Container starten
```bash
# Build und Start
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Container stoppen
docker-compose down
```

#### 4. Reverse Proxy einrichten (Nginx)

Erstellen Sie `/etc/nginx/sites-available/pimpilot`:

```nginx
server {
    listen 80;
    server_name pimpilot.ihre-domain.de;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktivieren Sie die Site:
```bash
sudo ln -s /etc/nginx/sites-available/pimpilot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. SSL-Zertifikat (Let's Encrypt)
```bash
sudo certbot --nginx -d pimpilot.ihre-domain.de
```

---

## Option 4: 💻 Direkt (On-Premise)

### Vorteile:
- ✅ Volle Kontrolle
- ✅ Keine Container-Overhead
- ✅ Direkter Zugriff auf Server

### Voraussetzungen:
- Node.js 20+ installiert
- npm installiert
- Server mit Linux/Windows

### Schritt-für-Schritt:

#### 1. Repository klonen
```bash
git clone https://github.com/ihr-username/pimpilot.git
cd pimpilot
```

#### 2. Dependencies installieren
```bash
npm install
```

#### 3. `.env` Datei erstellen
```bash
nano .env
```

Fügen Sie alle Environment Variables hinzu.

#### 4. Build erstellen
```bash
npm run build
```

#### 5. PM2 installieren (für Production)
```bash
npm install -g pm2
```

#### 6. App mit PM2 starten
```bash
pm2 start dist/index.js --name pimpilot
pm2 save
pm2 startup  # Folgen Sie den Anweisungen
```

#### 7. Reverse Proxy einrichten
Siehe Option 3, Schritt 4.

---

## 👥 Mitarbeiter-Zugriff einrichten

Nach dem Deployment können Mitarbeiter auf zwei Arten zugreifen:

### Option A: Registrierung (Selbst-Service)

1. **Mitarbeiter gehen zu Ihrer App-URL** (z.B. `https://pimpilot.akkushop.de`)
2. **Klicken auf "Registrieren"**
3. **Füllen das Formular aus:**
   - E-Mail
   - Passwort
   - Benutzername
   - **Firmenname**: `AkkuShop` (wichtig!)
4. **Erster Benutzer wird automatisch Admin** des Tenants
5. **Weitere Mitarbeiter können sich registrieren** und werden dem gleichen Tenant zugeordnet

### Option B: Admin erstellt Benutzer

1. **Admin meldet sich an**
2. **Geht zu Admin-Dashboard** (`/admin`)
3. **Erstellt neuen Tenant** (falls noch nicht vorhanden):
   - Klickt auf "Neuen Kunden anlegen"
   - Name: `AkkuShop`
4. **Erstellt Benutzer manuell** (über API oder direkt in Supabase)

### Option C: Script-basiert (für Bulk-Erstellung)

```bash
# Admin-Benutzer erstellen
npm run create-admin

# Environment Variables für Script:
# ADMIN_EMAIL=admin@akkushop.de
# ADMIN_PASSWORD=sicheres-passwort
# ADMIN_USERNAME=Admin
```

---

## 🔐 Erster Admin-Benutzer für AkkuShop

### Schritt 1: Tenant "AkkuShop" erstellen

**Option A: Über Admin-Dashboard (wenn bereits Admin vorhanden)**
1. Melden Sie sich als Super-Admin an
2. Gehen Sie zu `/admin`
3. Klicken Sie auf "Neuen Kunden anlegen"
4. Name: `AkkuShop`
5. Tenant wird automatisch mit Slug `akkushop` erstellt

**Option B: Über API (wenn kein Admin vorhanden)**
```bash
# Erstellen Sie zuerst einen Super-Admin
npm run create-admin

# Dann können Sie über das Admin-Dashboard den Tenant erstellen
```

**Option C: Direkt in Supabase**
1. Gehen Sie zu Supabase Dashboard
2. Öffnen Sie die `tenants` Tabelle
3. Erstellen Sie einen neuen Eintrag:
   - `name`: `AkkuShop`
   - `slug`: `akkushop`
   - `settings`: `{}`

### Schritt 2: Ersten Benutzer für AkkuShop erstellen

**Option A: Registrierung (empfohlen)**
1. Gehen Sie zu Ihrer App-URL
2. Registrieren Sie sich mit:
   - E-Mail: `admin@akkushop.de`
   - Firmenname: `AkkuShop`
3. Der erste Benutzer wird automatisch Admin des Tenants

**Option B: Script**
```bash
# .env Datei anpassen:
ADMIN_EMAIL=admin@akkushop.de
ADMIN_PASSWORD=sicheres-passwort
ADMIN_USERNAME=Admin

# Script ausführen
npm run create-admin
```

**Option C: Supabase Auth**
1. Gehen Sie zu Supabase Dashboard → Authentication
2. Klicken Sie auf "Add user" → "Create new user"
3. E-Mail: `admin@akkushop.de`
4. Passwort: `sicheres-passwort`
5. E-Mail bestätigen: ✅
6. Gehen Sie zu `users` Tabelle
7. Aktualisieren Sie den Benutzer:
   - `tenant_id`: ID des AkkuShop Tenants
   - `role`: `admin`
   - `is_admin`: `true`

---

## 🌐 Zugriff für Mitarbeiter

### URLs:
- **App-URL**: `https://pimpilot.akkushop.de` (oder Ihre Render/Railway URL)
- **Admin-Dashboard**: `https://pimpilot.akkushop.de/admin`
- **API-Dokumentation**: `https://pimpilot.akkushop.de/api/docs`

### Rollen & Berechtigungen:

| Rolle | Beschreibung | Zugriff |
|-------|-------------|---------|
| **admin** | Vollzugriff | Alle Features, kann Benutzer verwalten |
| **controller** | Controller | Produkte, Projekte, Lieferanten verwalten |
| **editor** | Editor | Produkte bearbeiten, Projekte verwalten |
| **viewer** | Viewer | Nur Lesen |
| **project_manager** | Projektmanager | Projekte verwalten |
| **member** | Mitglied | Basis-Zugriff |
| **practicant** | Praktikant | Eingeschränkter Zugriff |

### Erste Schritte für Mitarbeiter:

1. **Registrierung**: Mitarbeiter registrieren sich selbst
2. **Admin weist Rolle zu**: Admin geht zu `/admin` → Benutzerverwaltung
3. **Berechtigungen anpassen**: Admin kann granulare Berechtigungen setzen

---

## 🔄 Updates & Wartung

### Render/Railway:
- **Automatisch**: Bei Git Push wird automatisch neu deployed
- **Manuell**: In Dashboard auf "Manual Deploy" klicken

### Docker:
```bash
# Updates holen
git pull origin main

# Container neu bauen
docker-compose build

# Container neu starten
docker-compose up -d
```

### Direkt (PM2):
```bash
# Updates holen
git pull origin main

# Dependencies aktualisieren
npm install

# Neu bauen
npm run build

# PM2 neu starten
pm2 restart pimpilot
```

---

## 📊 Monitoring & Health Checks

Ihre App hat bereits Health Check Endpoints:

- **`/health`** - Basis Health Check
- **`/ready`** - Readiness Check (prüft Dependencies)
- **`/live`** - Liveness Check (für Kubernetes)

Diese können für Load Balancer und Monitoring verwendet werden.

---

## 🆘 Troubleshooting

### Problem: App startet nicht
- ✅ Prüfen Sie die Logs: `docker-compose logs` oder Render Logs
- ✅ Prüfen Sie Environment Variables
- ✅ Prüfen Sie Supabase-Verbindung

### Problem: Mitarbeiter können sich nicht registrieren
- ✅ Prüfen Sie Supabase Auth-Einstellungen
- ✅ Prüfen Sie, ob E-Mail-Bestätigung deaktiviert ist (für interne Apps)
- ✅ Prüfen Sie die Logs auf Fehler

### Problem: Tenant wird nicht erstellt
- ✅ Prüfen Sie Supabase RLS (Row Level Security) Policies
- ✅ Prüfen Sie, ob Service Role Key korrekt ist

---

## 📝 Checkliste vor Deployment

- [ ] Repository auf GitHub/ GitLab
- [ ] `.env` Datei mit allen Variablen erstellt
- [ ] Supabase-Projekt erstellt und konfiguriert
- [ ] OpenAI API Key vorhanden
- [ ] Pixi ERP Credentials (falls benötigt)
- [ ] Domain vorbereitet (optional)
- [ ] SSL-Zertifikat eingerichtet (optional)
- [ ] Erster Admin-Benutzer erstellt
- [ ] Tenant "AkkuShop" erstellt
- [ ] Mitarbeiter informiert über Zugriff

---

## 🎯 Empfehlung

**Für schnelles Setup:** ☁️ **Render** (Option 1)
- Einfachste Option
- Kostenloser Plan verfügbar
- Automatisches Deployment

**Für Produktion:** 🐳 **Docker** (Option 3)
- Volle Kontrolle
- On-Premise möglich
- Einfache Skalierung

---

## 📞 Support

Bei Problemen:
1. Prüfen Sie die Logs
2. Prüfen Sie die Health Check Endpoints
3. Prüfen Sie Supabase Dashboard
4. Prüfen Sie Environment Variables

---

**Viel Erfolg beim Deployment! 🚀**

