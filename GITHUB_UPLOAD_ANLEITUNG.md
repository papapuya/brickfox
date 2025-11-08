# 📤 Code auf GitHub hochladen - Einfache Anleitung

## ✅ Gute Nachricht!

Ihr Projekt ist **bereits mit GitHub verbunden**: `https://github.com/papapuya/brickfox`

Das ist das Repository, das Sie in Render gesehen haben!

---

## 🚀 Was wir jetzt tun müssen

Wir müssen nur noch Ihre **lokalen Änderungen** auf GitHub hochladen.

### Schritt 1: Alle Änderungen hinzufügen

```bash
git add .
```

**Was macht das?**
- Fügt alle geänderten und neuen Dateien hinzu
- Bereitet sie zum Hochladen vor

### Schritt 2: Änderungen speichern (Commit)

```bash
git commit -m "Update PimPilot für Deployment"
```

**Was macht das?**
- Speichert alle Änderungen lokal
- Erstellt einen "Schnappschuss" Ihres Codes

### Schritt 3: Auf GitHub hochladen (Push)

```bash
git push origin main
```

**Was macht das?**
- Lädt alle Änderungen auf GitHub hoch
- Macht sie für Render sichtbar

---

## ⚠️ Wichtig: Passwort/Token

Beim `git push` wird GitHub nach Ihrem **Personal Access Token** fragen (nicht mehr nach Passwort).

### Falls Sie noch kein Token haben:

1. **Gehen Sie zu:** https://github.com/settings/tokens
2. **Klicken Sie auf:** "Generate new token" → "Generate new token (classic)"
3. **Geben Sie einen Namen ein:** z.B. "Render Deployment"
4. **Wählen Sie Ablaufzeit:** "No expiration" (oder 90 Tage)
5. **Wählen Sie Berechtigungen:**
   - ✅ `repo` (alle Unterpunkte)
6. **Klicken Sie auf:** "Generate token"
7. **Kopieren Sie den Token** (wird nur einmal angezeigt!)
8. **Verwenden Sie diesen Token** als Passwort beim `git push`

---

## 🎯 Nach dem Hochladen

1. **Gehen Sie zurück zu Render**
2. **Aktualisieren Sie die Repository-Liste** (F5 drücken)
3. **Suchen Sie nach:** `brickfox`
4. **Wählen Sie:** `papapuya/brickfox`
5. **Weiter zur Konfiguration!**

---

## 🆘 Falls etwas nicht funktioniert

### Problem: "Permission denied"
- **Lösung:** Prüfen Sie, ob Sie Zugriff auf das Repository haben
- Prüfen Sie Ihr GitHub-Token

### Problem: "Repository not found"
- **Lösung:** Stellen Sie sicher, dass das Repository auf GitHub existiert
- Prüfen Sie die URL: https://github.com/papapuya/brickfox

### Problem: "Nothing to commit"
- **Lösung:** Das ist OK! Ihre Änderungen sind bereits gespeichert
- Versuchen Sie direkt `git push origin main`

---

**Viel Erfolg! 🚀**

