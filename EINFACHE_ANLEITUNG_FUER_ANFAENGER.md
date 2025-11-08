# 🚀 PimPilot - Einfache Anleitung für Nicht-Entwickler

**Keine Sorge!** Diese Anleitung ist speziell für Menschen geschrieben, die **keine Programmierer** sind. Wir gehen Schritt für Schritt vor.

---

## 📋 Was Sie brauchen

1. **Einen Computer** (Windows, Mac oder Linux)
2. **Einen Browser** (Chrome, Firefox, Edge)
3. **Ein E-Mail-Konto** (für die Registrierung)
4. **Etwa 30 Minuten Zeit**

**Das war's!** Sie müssen **NICHTS** programmieren oder installieren.

---

## 🎯 Ziel: Ihre App online bringen

Wir verwenden **Render.com** - das ist wie ein "Parkplatz" für Ihre App im Internet. Es ist:
- ✅ **Kostenlos** (für den Anfang)
- ✅ **Einfach** (keine Installation nötig)
- ✅ **Automatisch** (alles läuft von selbst)

---

## 📝 Schritt 1: Render.com Account erstellen

### Was ist Render?
Render ist eine Website, die Ihre App für Sie online stellt. Sie müssen nichts installieren.

### So geht's:

1. **Öffnen Sie Ihren Browser**
2. **Gehen Sie zu:** https://render.com
3. **Klicken Sie auf "Get Started"** (oben rechts)
4. **Wählen Sie "Sign up with GitHub"**
   - Falls Sie kein GitHub-Konto haben:
     - Klicken Sie auf "Sign up" auf github.com
     - Erstellen Sie ein kostenloses Konto
     - Keine Sorge, das ist kostenlos und sicher
5. **Folgen Sie den Anweisungen** auf dem Bildschirm

**✅ Fertig!** Sie haben jetzt einen Render-Account.

---

## 📝 Schritt 2: Code auf GitHub hochladen

### Was ist GitHub?
GitHub ist wie ein "Google Drive" für Programmierer. Wir brauchen es, damit Render Ihre App finden kann.

### So geht's:

**Option A: Wenn Ihr Code bereits auf GitHub ist**
- ✅ Perfekt! Weiter zu Schritt 3

**Option B: Wenn Ihr Code noch nicht auf GitHub ist**

1. **Gehen Sie zu:** https://github.com
2. **Melden Sie sich an** (oder erstellen Sie ein Konto)
3. **Klicken Sie auf das "+" Symbol** (oben rechts)
4. **Wählen Sie "New repository"**
5. **Füllen Sie aus:**
   - **Name:** `pimpilot` (oder ein anderer Name)
   - **Beschreibung:** (optional)
   - **Öffentlich oder Privat:** Wählen Sie "Privat" (empfohlen)
6. **Klicken Sie auf "Create repository"**
7. **Laden Sie Ihren Code hoch:**
   - Falls Sie Git installiert haben: Folgen Sie den Anweisungen auf GitHub
   - Falls nicht: Kontaktieren Sie einen Entwickler oder verwenden Sie GitHub Desktop (einfache App)

**⚠️ Wichtig:** Falls Sie Hilfe beim Hochladen brauchen, können Sie auch einen Entwickler fragen oder mir schreiben!

---

## 📝 Schritt 3: App auf Render deployen

### Was bedeutet "deployen"?
Das bedeutet einfach: "App online stellen" oder "App starten".

### So geht's:

1. **Gehen Sie zu:** https://dashboard.render.com
2. **Klicken Sie auf "New +"** (oben rechts)
3. **Wählen Sie "Web Service"**
4. **Verbinden Sie Ihr GitHub-Konto:**
   - Klicken Sie auf "Connect GitHub"
   - Wählen Sie Ihr Repository (`pimpilot`)
   - Klicken Sie auf "Connect"
5. **Füllen Sie das Formular aus:**

   **Name:**
   ```
   pimpilot
   ```
   (oder ein anderer Name Ihrer Wahl)

   **Region:**
   ```
   Frankfurt (EU)
   ```
   (wichtig für Deutschland!)

   **Branch:**
   ```
   main
   ```
   (oder `master`, je nachdem was Sie haben)

   **Root Directory:**
   ```
   (leer lassen)
   ```

   **Build Command:**
   ```
   npm install && npm run build
   ```

   **Start Command:**
   ```
   npm start
   ```

6. **Klicken Sie auf "Advanced"** (falls sichtbar)
7. **Klicken Sie auf "Create Web Service"**

**⏳ Warten Sie 5-10 Minuten** - Render baut Ihre App jetzt auf.

---

## 📝 Schritt 4: Einstellungen konfigurieren

Während Render Ihre App baut, müssen wir einige Einstellungen hinzufügen.

### So geht's:

1. **In Render, klicken Sie auf "Environment"** (im Menü links)
2. **Klicken Sie auf "Add Environment Variable"**
3. **Fügen Sie diese Einstellungen hinzu:**

   **Einstellung 1:**
   - **Key:** `NODE_ENV`
   - **Value:** `production`
   - Klicken Sie auf "Save"

   **Einstellung 2:**
   - **Key:** `PORT`
   - **Value:** `5000`
   - Klicken Sie auf "Save"

   **Einstellung 3:**
   - **Key:** `SUPABASE_URL`
   - **Value:** `https://ihr-projekt.supabase.co`
   - ⚠️ **Wichtig:** Ersetzen Sie `ihr-projekt` mit Ihrer echten Supabase-URL
   - Klicken Sie auf "Save"

   **Einstellung 4:**
   - **Key:** `SUPABASE_ANON_KEY`
   - **Value:** `ihr-anon-key`
   - ⚠️ **Wichtig:** Ersetzen Sie `ihr-anon-key` mit Ihrem echten Supabase Anon Key
   - Klicken Sie auf "Save"

   **Einstellung 5:**
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** `ihr-service-role-key`
   - ⚠️ **Wichtig:** Ersetzen Sie `ihr-service-role-key` mit Ihrem echten Service Role Key
   - Klicken Sie auf "Save"

   **Einstellung 6:**
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** `https://ihr-projekt.supabase.co`
   - (Gleiche URL wie bei Einstellung 3)
   - Klicken Sie auf "Save"

   **Einstellung 7:**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** `ihr-anon-key`
   - (Gleicher Key wie bei Einstellung 4)
   - Klicken Sie auf "Save"

   **Einstellung 8:**
   - **Key:** `OPENAI_API_KEY`
   - **Value:** `sk-ihr-openai-key`
   - ⚠️ **Wichtig:** Ersetzen Sie `sk-ihr-openai-key` mit Ihrem echten OpenAI API Key
   - Klicken Sie auf "Save"

   **Einstellung 9 (Optional - nur wenn Sie Pixi ERP haben):**
   - **Key:** `PIXI_API_URL`
   - **Value:** `https://akkutools.laptopakku.eu/api/pixi/pixiItemSearch`
   - Klicken Sie auf "Save"

   **Einstellung 10 (Optional - nur wenn Sie Pixi ERP haben):**
   - **Key:** `PIXI_AUTH_TOKEN`
   - **Value:** `ihr-pixi-token`
   - Klicken Sie auf "Save"

### Wo finde ich diese Werte?

**Supabase URL und Keys:**
1. Gehen Sie zu https://supabase.com
2. Melden Sie sich an
3. Wählen Sie Ihr Projekt
4. Gehen Sie zu "Settings" → "API"
5. Dort finden Sie:
   - **Project URL** = `SUPABASE_URL` und `VITE_SUPABASE_URL`
   - **anon public** = `SUPABASE_ANON_KEY` und `VITE_SUPABASE_ANON_KEY`
   - **service_role** = `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Geheim halten!**

**OpenAI API Key:**
1. Gehen Sie zu https://platform.openai.com
2. Melden Sie sich an
3. Gehen Sie zu "API Keys"
4. Klicken Sie auf "Create new secret key"
5. Kopieren Sie den Key (wird nur einmal angezeigt!)

**Pixi Token:**
- Fragen Sie Ihren IT-Administrator oder den Pixi ERP Anbieter

---

## 📝 Schritt 5: Warten und prüfen

1. **Gehen Sie zurück zu "Logs"** (im Menü links)
2. **Warten Sie, bis Sie sehen:**
   ```
   ✅ Server is now serving on port 5000
   ```
3. **Das kann 5-10 Minuten dauern** - keine Sorge!

---

## 📝 Schritt 6: Ihre App öffnen

1. **Oben auf der Seite sehen Sie eine URL**, z.B.:
   ```
   https://pimpilot.onrender.com
   ```
2. **Klicken Sie darauf** oder kopieren Sie sie in Ihren Browser
3. **Ihre App sollte jetzt öffnen!** 🎉

---

## 📝 Schritt 7: Ersten Admin für AkkuShop erstellen

1. **Gehen Sie zu Ihrer App-URL** (z.B. `https://pimpilot.onrender.com`)
2. **Sie sehen eine Anmeldeseite**
3. **Klicken Sie auf "Registrieren"** (oder "Sign Up")
4. **Füllen Sie das Formular aus:**
   - **E-Mail:** `admin@akkushop.de` (oder Ihre E-Mail)
   - **Passwort:** (wählen Sie ein sicheres Passwort)
   - **Benutzername:** `Admin` (optional)
   - **Firmenname:** `AkkuShop` ⚠️ **WICHTIG: Genau so schreiben!**
5. **Klicken Sie auf "Registrieren"**
6. **Fertig!** ✅

**Sie sind jetzt automatisch Admin!**

---

## 📝 Schritt 8: Mitarbeiter einladen

### So laden Sie Mitarbeiter ein:

1. **Teilen Sie die App-URL** mit Ihren Mitarbeitern:
   ```
   https://pimpilot.onrender.com
   ```

2. **Sagen Sie ihnen:**
   - Gehen Sie zu dieser URL
   - Klicken Sie auf "Registrieren"
   - Verwenden Sie **genau** den Firmennamen: `AkkuShop`
   - (Groß-/Kleinschreibung beachten!)

3. **Nach der Registrierung:**
   - Sie (als Admin) können die Rollen anpassen
   - Gehen Sie zu `/admin` (fügen Sie das an die URL an)
   - Klicken Sie auf "Benutzer verwalten"
   - Wählen Sie einen Benutzer
   - Ändern Sie die Rolle (z.B. zu "Controller" oder "Editor")

---

## ❓ Häufige Fragen

### Q: Was kostet das?
**A:** Render hat einen kostenlosen Plan. Für den Anfang reicht das völlig aus!

### Q: Muss ich etwas installieren?
**A:** Nein! Alles läuft im Browser und auf Render. Sie müssen nichts installieren.

### Q: Was ist, wenn etwas nicht funktioniert?
**A:** 
1. Prüfen Sie die "Logs" in Render (im Menü links)
2. Prüfen Sie, ob alle Einstellungen korrekt sind
3. Fragen Sie einen Entwickler oder kontaktieren Sie den Support

### Q: Kann ich die App später ändern?
**A:** Ja! Wenn Sie Code auf GitHub aktualisieren, wird Render automatisch neu bauen.

### Q: Ist meine App sicher?
**A:** Ja! Render verwendet SSL-Verschlüsselung. Ihre Daten sind sicher.

### Q: Was ist, wenn ich Hilfe brauche?
**A:** 
- Lesen Sie die Logs in Render
- Fragen Sie einen Entwickler
- Schauen Sie in die anderen Dokumentationen (z.B. `DEPLOYMENT_GUIDE.md`)

---

## 🆘 Hilfe bei Problemen

### Problem: App startet nicht

**Lösung:**
1. Gehen Sie zu Render → "Logs"
2. Schauen Sie nach Fehlermeldungen (rot)
3. Prüfen Sie, ob alle Einstellungen korrekt sind
4. Prüfen Sie, ob Supabase und OpenAI Keys korrekt sind

### Problem: Ich kann mich nicht registrieren

**Lösung:**
1. Prüfen Sie, ob Supabase richtig konfiguriert ist
2. Prüfen Sie die Logs in Render
3. Prüfen Sie Supabase Dashboard → Authentication → Settings

### Problem: Mitarbeiter werden nicht dem richtigen Tenant zugeordnet

**Lösung:**
- Stellen Sie sicher, dass alle **exakt** `AkkuShop` als Firmenname verwenden
- Groß-/Kleinschreibung beachten!

---

## 📋 Checkliste

- [ ] Render.com Account erstellt
- [ ] Code auf GitHub hochgeladen
- [ ] Web Service auf Render erstellt
- [ ] Alle Einstellungen hinzugefügt (Supabase, OpenAI, etc.)
- [ ] App erfolgreich gebaut (keine Fehler in Logs)
- [ ] App-URL funktioniert
- [ ] Erster Admin registriert (Firmenname: "AkkuShop")
- [ ] Admin-Rechte verifiziert (Zugriff auf `/admin`)
- [ ] Mitarbeiter informiert

---

## 🎉 Fertig!

**Herzlichen Glückwunsch!** 🎊

Ihre App ist jetzt online und Sie sind Admin. Sie können jetzt:
- ✅ Projekte erstellen
- ✅ Produkte importieren
- ✅ Mitarbeiter verwalten
- ✅ Alles nutzen, was PimPilot bietet!

---

## 📞 Nächste Schritte

1. **Testen Sie die App** - probieren Sie alle Features aus
2. **Laden Sie Mitarbeiter ein** - teilen Sie die URL
3. **Erstellen Sie erste Projekte** - beginnen Sie mit der Arbeit
4. **Genießen Sie PimPilot!** 🚀

---

**Viel Erfolg!** 💪

Bei Fragen: Schauen Sie in die anderen Dokumentationen oder fragen Sie einen Entwickler.

