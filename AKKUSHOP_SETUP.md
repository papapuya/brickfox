# 🏢 AkkuShop als ersten Kunden einrichten

## ✅ Bestätigung: Erster Benutzer wird automatisch Admin

**Ja, das ist korrekt!** Wenn Sie sich als **ERSTER Benutzer** mit dem Firmennamen **"AkkuShop"** registrieren, werden Sie automatisch:

1. ✅ **Admin des Tenants "AkkuShop"**
2. ✅ **Vollzugriff** auf alle Features
3. ✅ **Berechtigung**, weitere Benutzer zu verwalten

---

## 🚀 Schnellstart: AkkuShop einrichten

### Schritt 1: App deployen
Folgen Sie der Anleitung in `DEPLOYMENT_GUIDE.md`:
- **Empfohlen**: Render (kostenlos, einfach)
- **Alternative**: Railway, Docker, oder On-Premise

### Schritt 2: Ersten Admin registrieren

1. **Gehen Sie zu Ihrer App-URL** (z.B. `https://pimpilot.onrender.com`)

2. **Klicken Sie auf "Registrieren"**

3. **Füllen Sie das Formular aus:**
   ```
   E-Mail: admin@akkushop.de (oder Ihre E-Mail)
   Passwort: [Ihr sicheres Passwort]
   Benutzername: Admin (optional)
   Firmenname: AkkuShop ⚠️ WICHTIG: Genau so schreiben!
   ```

4. **Klicken Sie auf "Registrieren"**

### Schritt 3: Was passiert automatisch?

✅ **Tenant wird erstellt:**
- Name: `AkkuShop`
- Slug: `akkushop` (automatisch generiert)
- Einstellungen: Standard-Features aktiviert

✅ **Sie werden Admin:**
- `is_admin`: `true`
- `role`: `admin`
- `tenant_id`: ID des AkkuShop Tenants

✅ **Sie können sofort loslegen:**
- Projekte erstellen
- Produkte importieren
- Lieferanten verwalten
- Weitere Benutzer einladen

---

## 👥 Weitere Mitarbeiter hinzufügen

### Option A: Selbst-Registrierung (Empfohlen)

1. **Mitarbeiter gehen zur App-URL**
2. **Registrieren sich mit:**
   - E-Mail: `ihre-email@akkushop.de`
   - Firmenname: **`AkkuShop`** (muss genau übereinstimmen!)
3. **Werden automatisch dem AkkuShop Tenant zugeordnet**
4. **Sie (als Admin) können dann die Rolle anpassen:**
   - Gehen Sie zu `/admin` → Benutzerverwaltung
   - Wählen Sie den Benutzer
   - Ändern Sie die Rolle (z.B. `controller`, `editor`, `viewer`)

### Option B: Admin erstellt Benutzer

1. **Sie melden sich als Admin an**
2. **Gehen Sie zu `/admin`**
3. **Klicken Sie auf "Benutzer verwalten"**
4. **Erstellen Sie neue Benutzer manuell**

---

## 🔍 Verifizierung: Bin ich Admin?

Nach der Registrierung können Sie prüfen:

1. **In der App:**
   - Sie sollten Zugriff auf `/admin` haben
   - Sie sehen "Admin Dashboard" im Menü
   - Sie können Tenants und Benutzer verwalten

2. **In Supabase Dashboard:**
   - Gehen Sie zu `users` Tabelle
   - Suchen Sie Ihre E-Mail
   - Prüfen Sie:
     - `is_admin`: sollte `true` sein
     - `role`: sollte `admin` sein
     - `tenant_id`: sollte die ID des AkkuShop Tenants sein

---

## ⚠️ Wichtige Hinweise

### Firmenname muss genau übereinstimmen

Wenn Mitarbeiter sich registrieren, müssen sie **genau** den gleichen Firmennamen verwenden:
- ✅ `AkkuShop` (korrekt)
- ❌ `akkushop` (falsch - wird zu anderem Tenant)
- ❌ `Akku Shop` (falsch - wird zu anderem Tenant)
- ❌ `AkkuShop.de` (falsch - wird zu anderem Tenant)

**Tipp:** Teilen Sie Ihren Mitarbeitern den exakten Firmennamen mit!

### Erster Benutzer = Admin

- Der **erste Benutzer** eines Tenants wird **automatisch Admin**
- Alle weiteren Benutzer werden als `member` erstellt
- Sie können die Rollen später im Admin-Dashboard anpassen

### Tenant-Slug wird automatisch generiert

Der Slug wird aus dem Firmennamen generiert:
- `AkkuShop` → `akkushop`
- `Akku Shop` → `akku-shop` (wäre ein anderer Tenant!)
- `AkkuShop.de` → `akkushop-de` (wäre ein anderer Tenant!)

**Wichtig:** Verwenden Sie immer den **exakt gleichen Firmennamen**!

---

## 🛠️ Troubleshooting

### Problem: Ich bin nicht Admin nach der Registrierung

**Lösung 1: Prüfen Sie Supabase**
1. Gehen Sie zu Supabase Dashboard → `users` Tabelle
2. Suchen Sie Ihre E-Mail
3. Prüfen Sie `is_admin` und `role`
4. Falls `false` oder `member`: Manuell auf `admin` ändern

**Lösung 2: Script ausführen**
```bash
# Erstellen Sie einen Admin-Benutzer
npm run create-admin

# Environment Variables in .env:
ADMIN_EMAIL=admin@akkushop.de
ADMIN_PASSWORD=ihr-passwort
ADMIN_USERNAME=Admin
```

**Lösung 3: Über API**
```bash
# POST /api/admin/initial-setup
curl -X POST https://ihre-app-url/api/admin/initial-setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@akkushop.de",
    "password": "ihr-passwort",
    "username": "Admin"
  }'
```

### Problem: Mitarbeiter werden nicht dem richtigen Tenant zugeordnet

**Ursache:** Firmenname stimmt nicht überein

**Lösung:**
1. Prüfen Sie, welchen Firmennamen der Mitarbeiter verwendet hat
2. Stellen Sie sicher, dass alle **exakt** `AkkuShop` verwenden
3. Oder: Sie als Admin können Benutzer manuell dem Tenant zuordnen

---

## 📋 Checkliste

- [ ] App deployed (Render/Railway/Docker)
- [ ] Erster Admin registriert mit Firmenname "AkkuShop"
- [ ] Admin-Rechte verifiziert (Zugriff auf `/admin`)
- [ ] Tenant "AkkuShop" erstellt (in Supabase prüfen)
- [ ] Mitarbeiter informiert über exakten Firmennamen
- [ ] Erste Mitarbeiter registriert
- [ ] Rollen für Mitarbeiter angepasst (falls nötig)

---

## 🎯 Nächste Schritte

Nach dem Setup können Sie:

1. **Projekte erstellen** für verschiedene Produktkategorien
2. **Lieferanten hinzufügen** (z.B. ANSMANN)
3. **Produkte importieren** (CSV oder URL-Scraping)
4. **Pixi ERP Integration** einrichten (falls benötigt)
5. **Backups konfigurieren** (automatisch oder manuell)

---

**Viel Erfolg! 🚀**

Bei Fragen oder Problemen:
- Prüfen Sie die Logs in Render/Railway
- Prüfen Sie Supabase Dashboard
- Prüfen Sie die Health Check Endpoints (`/health`, `/ready`)

