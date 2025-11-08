# 🔍 Debugging: Weiße Seite auf Render.com

## ✅ Was bereits gemacht wurde:
- ✅ ConfigError-Komponente in App.tsx integriert
- ✅ Dockerfile akzeptiert VITE_ Build-Argumente
- ✅ Verbesserte Fehlerbehandlung

---

## 🔍 Schritt-für-Schritt Debugging

### 1. Browser-Konsole prüfen (WICHTIG!)

**Öffnen Sie die Browser-Konsole (F12) und prüfen Sie:**

#### A) Fehler in der Konsole?
- **Rote Fehlermeldungen?** → Notieren Sie die genaue Fehlermeldung
- **"Failed to fetch" oder "Network Error"?** → Supabase-Verbindungsproblem
- **"Cannot read property..." oder "undefined"?** → JavaScript-Fehler

#### B) Supabase-Konfiguration prüfen:
```javascript
// In der Browser-Konsole ausführen:
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
```

**Erwartetes Ergebnis:**
- `VITE_SUPABASE_URL`: Sollte Ihre Supabase-URL sein (z.B. `https://xxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Sollte "SET" sein (nicht "MISSING")

**Wenn beide "undefined" oder leer sind:**
→ Die VITE_ Variablen wurden nicht während des Builds eingebettet!

---

### 2. Render.com Build-Logs prüfen

**In Render.com:**
1. Gehen Sie zu Ihrem Service
2. Klicken Sie auf **"Logs"**
3. Prüfen Sie die **Build-Logs** (nicht Runtime-Logs)

**Suchen Sie nach:**
- ✅ `✅ Serving static files from: /app/dist/public`
- ✅ `✅ Server is now serving on port...`
- ❌ `❌ Build directory not found`
- ❌ `Error: Cannot find module`
- ❌ `VITE_SUPABASE_URL` oder `VITE_SUPABASE_ANON_KEY` Fehler

---

### 3. Render.com Environment-Variablen prüfen

**In Render.com:**
1. Gehen Sie zu **"Environment"**
2. Prüfen Sie, ob folgende Variablen gesetzt sind:

```env
VITE_SUPABASE_URL=https://ihr-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=ihr-anon-key
```

**WICHTIG:**
- Diese müssen **vor dem Build** gesetzt sein
- Nach dem Setzen: **Manuellen Deploy auslösen**

---

### 4. Network-Tab prüfen (F12 → Network)

**Prüfen Sie:**
1. Wird `index.html` geladen? (Status 200?)
2. Werden JavaScript-Dateien geladen? (z.B. `assets/index-xxx.js`)
3. Werden CSS-Dateien geladen? (z.B. `assets/index-xxx.css`)
4. Gibt es 404-Fehler?

**Wenn `index.html` nicht geladen wird:**
→ Problem mit statischer Datei-Servierung

**Wenn JS/CSS-Dateien 404-Fehler haben:**
→ Problem mit Asset-Pfaden (möglicherweise `base`-Problem)

---

### 5. Render.com Runtime-Logs prüfen

**In Render.com:**
1. Gehen Sie zu **"Logs"**
2. Prüfen Sie die **Runtime-Logs** (nach dem Build)

**Suchen Sie nach:**
- ✅ `✅ Server is now serving on port 5000`
- ✅ `✅ Serving static files from: /app/dist/public`
- ❌ `Error: EACCES: permission denied`
- ❌ `Error: Cannot find module`
- ❌ `Error: ENOENT: no such file or directory`

---

## 🛠️ Häufige Probleme & Lösungen

### Problem 1: VITE_ Variablen fehlen

**Symptom:**
- Browser-Konsole zeigt: `VITE_SUPABASE_URL: undefined`
- ConfigError-Seite wird angezeigt

**Lösung:**
1. In Render.com: Environment-Variablen setzen
2. **Manuellen Deploy auslösen** (nicht automatisch)
3. Build-Logs prüfen, ob Variablen verwendet werden

---

### Problem 2: Statische Dateien werden nicht gefunden

**Symptom:**
- Browser-Konsole: 404-Fehler für JS/CSS-Dateien
- Runtime-Logs: `❌ Build directory not found`

**Lösung:**
1. Prüfen Sie die Build-Logs - wurde `npm run build` erfolgreich ausgeführt?
2. Prüfen Sie, ob `dist/public` existiert
3. Prüfen Sie die Dockerfile-Konfiguration

---

### Problem 3: JavaScript-Fehler

**Symptom:**
- Browser-Konsole: Rote Fehlermeldungen
- App startet nicht

**Lösung:**
1. Notieren Sie die genaue Fehlermeldung
2. Prüfen Sie, ob alle Dependencies installiert sind
3. Prüfen Sie die Build-Logs auf Warnings

---

### Problem 4: Supabase-Verbindungsfehler

**Symptom:**
- Browser-Konsole: "Failed to fetch" oder CORS-Fehler
- Network-Tab: Rote Requests zu Supabase

**Lösung:**
1. Prüfen Sie, ob die Supabase-URL korrekt ist
2. Prüfen Sie, ob der Anon-Key korrekt ist
3. Prüfen Sie die Supabase-Dashboard-Einstellungen (CORS, etc.)

---

## 📋 Checkliste

- [ ] Browser-Konsole geöffnet (F12)
- [ ] Keine roten Fehler in der Konsole?
- [ ] VITE_ Variablen in der Konsole geprüft?
- [ ] Render.com Build-Logs geprüft?
- [ ] Render.com Runtime-Logs geprüft?
- [ ] Environment-Variablen in Render.com gesetzt?
- [ ] Network-Tab geprüft (F12 → Network)?
- [ ] Manueller Deploy nach Setzen der Variablen ausgelöst?

---

## 🚀 Nächste Schritte

**Bitte teilen Sie mir mit:**
1. **Was sehen Sie in der Browser-Konsole?** (Screenshot oder Text)
2. **Was zeigen die Render.com Build-Logs?** (letzte 20-30 Zeilen)
3. **Was zeigen die Render.com Runtime-Logs?** (letzte 20-30 Zeilen)
4. **Sind die VITE_ Variablen in Render.com gesetzt?**
5. **Wird die ConfigError-Seite angezeigt oder nur eine weiße Seite?**

Mit diesen Informationen kann ich das Problem gezielt beheben!

