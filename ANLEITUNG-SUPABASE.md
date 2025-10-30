# 🚀 Supabase Datenbank Setup - Schritt für Schritt

## Problem
Die App kann keine Projekte erstellen, weil die `organization_id` Spalte in der Supabase-Datenbank fehlt.

## Lösung (3 Minuten)

### Schritt 1: Supabase Dashboard öffnen
1. Gehen Sie zu: **https://supabase.com/dashboard**
2. Loggen Sie sich ein
3. Wählen Sie Ihr Projekt: **lxemqwvdaxzeldpjmxoc**

### Schritt 2: SQL Editor öffnen
1. In der linken Sidebar auf **"SQL Editor"** klicken
2. Dann auf **"New query"** oder **"+"** klicken

### Schritt 3: SQL ausführen
1. Öffnen Sie die Datei `SETUP-SUPABASE.sql` (in diesem Projekt)
2. **Kopieren Sie den GESAMTEN Inhalt** (Strg+A, dann Strg+C)
3. **Fügen Sie ihn in den SQL Editor ein** (Strg+V)
4. Klicken Sie unten rechts auf **"RUN"** (grüner Button)

### Schritt 4: Erfolg prüfen
Nach dem Ausführen sollten Sie sehen:
- "Success. No rows returned" (das ist OK!)
- Oder eine Tabelle mit Ihrem User und `organization_id` gefüllt

### Schritt 5: In der App testen
1. In PIMPilot: **Abmelden**
2. **Wieder anmelden**
3. **Projekt erstellen** → sollte jetzt funktionieren! ✅

## Danach
Sagen Sie mir "done" oder "funktioniert", dann räume ich die Helium-Datenbank auf.

## Hilfe
Falls es nicht klappt, machen Sie einen Screenshot vom SQL Editor und zeigen Sie mir den Fehler.
