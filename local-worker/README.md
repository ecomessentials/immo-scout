# Immo Scout Local Worker

Dieser Worker läuft lokal auf deinem Mac. Er holt Sendeaufträge aus dem Live-Backend ab und verschickt die Nachricht im sichtbaren Browser per Playwright.

## Start

```bash
cd /Users/fabiokrieger/Fix/immo-scout/local-worker
npm install
npx playwright install chromium
cp .env.example .env
npm start
```

Beim ersten geöffneten Browserfenster musst du dich bei eBay Kleinanzeigen und Immowelt einloggen. Das Login bleibt im Ordner `.browser-profile` gespeichert.

## Ablauf

1. Neuer Scan findet eine Wohnung.
2. Telegram zeigt die Wohnung und den Entwurf.
3. Du drückst `🚀 Automatisch senden`.
4. Backend setzt den Status auf `Sendeauftrag`.
5. Der lokale Worker öffnet das Inserat, füllt die Nachricht ein und klickt Senden.
6. Bei Erfolg wird der Status `Angeschrieben`.
7. Bei Fehler wird der Status `Fehler`.

Der Worker wartet vor jedem Senden zufällig 3 bis 8 Minuten.
