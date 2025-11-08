# 🔧 Render.com Environment Variables - Anleitung

## ✅ Environment-Variablen speichern

### Automatisches Speichern
In Render.com werden Environment-Variablen **automatisch gespeichert**, sobald Sie:
- Eine neue Variable hinzufügen (mit "+ Add" Button)
- Eine bestehende Variable bearbeiten (mit dem Stift-Icon)
- Eine Variable löschen (mit dem Mülleimer-Icon)

**Sie müssen keinen "Save"-Button klicken!**

### Prüfen, ob Variablen gespeichert wurden
1. **Seite neu laden** (F5 oder Strg+R)
2. Prüfen Sie, ob alle Variablen noch vorhanden sind
3. Wenn ja → ✅ **Variablen sind gespeichert!**

### Wo finde ich den "Save Changes" Button?
- **Normalerweise nicht nötig** - Variablen werden automatisch gespeichert
- Falls vorhanden: Am **Ende der Environment-Variablen-Liste** (nach unten scrollen)
- Oder: Nach dem Hinzufügen/Bearbeiten kurz warten (1-2 Sekunden)

---

## 📋 Wichtige Environment-Variablen für PimPilot

### ✅ Müssen gesetzt sein:

```env
# Server
NODE_ENV=production
PORT=5000

# Supabase (Backend)
SUPABASE_URL=https://ihr-projekt.supabase.co
SUPABASE_ANON_KEY=ihr-anon-key
SUPABASE_SERVICE_ROLE_KEY=ihr-service-role-key

# Supabase (Frontend - WICHTIG für Build!)
VITE_SUPABASE_URL=https://ihr-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=ihr-anon-key

# OpenAI
OPENAI_API_KEY=sk-ihr-openai-key
```

### ⚠️ WICHTIG: VITE_ Variablen während des Builds

Die `VITE_*` Variablen müssen **während des Builds** verfügbar sein, da Vite sie zur Build-Zeit in den Code einbettet.

**Render.com macht das automatisch**, aber prüfen Sie:
1. Gehen Sie zu **Settings** → **Environment**
2. Stellen Sie sicher, dass `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` gesetzt sind
3. Diese werden automatisch während des Builds verfügbar gemacht

---

## 🔍 Troubleshooting

### Problem: Variablen werden nicht gespeichert
1. **Browser-Cache leeren** (Strg+Shift+R)
2. **Anderen Browser versuchen**
3. **Seite neu laden** und erneut versuchen

### Problem: VITE_ Variablen funktionieren nicht
1. Prüfen Sie, ob die Variablen in Render.com gesetzt sind
2. Prüfen Sie die **Build-Logs** - sollten keine Fehler zeigen
3. Falls nötig: **Manueller Deploy** auslösen (nach dem Setzen der Variablen)

### Problem: "Save Changes" Button nicht sichtbar
- **Das ist normal!** Variablen werden automatisch gespeichert
- Nach dem Hinzufügen/Bearbeiten kurz warten
- Seite neu laden, um zu prüfen, ob gespeichert wurde

---

## 📝 Schritt-für-Schritt: Variablen hinzufügen

1. Gehen Sie zu Ihrem **Render Service**
2. Klicken Sie auf **"Environment"** (linke Sidebar)
3. Klicken Sie auf **"+ Add Environment Variable"**
4. Geben Sie **Key** und **Value** ein
5. Klicken Sie auf **"Add"** (oder Enter drücken)
6. ✅ **Fertig!** - Variable wird automatisch gespeichert

**Kein "Save"-Button nötig!**

---

## 🚀 Nach dem Setzen der Variablen

1. **Deploy auslösen** (falls nicht automatisch):
   - Gehen Sie zu **"Manual Deploy"** → **"Deploy latest commit"**
2. **Build-Logs prüfen**:
   - Gehen Sie zu **"Logs"**
   - Prüfen Sie, ob der Build erfolgreich war
3. **App testen**:
   - Öffnen Sie Ihre App-URL
   - Prüfen Sie, ob alles funktioniert

---

## 💡 Tipp

**Render.com speichert automatisch** - Sie müssen sich keine Sorgen machen! 

Falls Sie unsicher sind, ob Variablen gespeichert wurden:
- **Seite neu laden** (F5)
- Prüfen Sie, ob alle Variablen noch da sind
- Wenn ja → ✅ Alles gespeichert!

