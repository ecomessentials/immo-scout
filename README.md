# Immo Scout – Automatisches Immobilien-Monitoring

Vollautomatisches System zum Monitoring von 4 Immobilienportalen. Sendet neue Eigentumswohnungen sofort per Telegram.

## Portale
- ImmoScout24
- eBay Kleinanzeigen
- Immowelt
- Immonet

## Standard-Suchkriterien
- Typ: Eigentumswohnung, renovierungsbedürftig
- Größe: 60–130 m²
- Max. Preis: 195.000 €
- Städte: Paderborn, Gütersloh, Bielefeld, Herford, Rheda-Wiedenbrück, Bad Oeynhausen
- Scan-Interval: alle 15 Minuten

---

## Setup-Anleitung

### Schritt 1: Supabase

1. Projekt erstellen auf [supabase.com](https://supabase.com)
2. Im SQL-Editor `supabase/schema.sql` ausführen
3. Folgende Werte aus den Projekteinstellungen kopieren:
   - `SUPABASE_URL` → Settings → API → Project URL
   - `SUPABASE_SERVICE_KEY` → Settings → API → service_role (nicht anon!)

### Schritt 2: Telegram Bot

1. Bei [@BotFather](https://t.me/BotFather) `/newbot` eingeben, Token kopieren → `TELEGRAM_BOT_TOKEN`
2. Bot in Gruppe/Kanal hinzufügen und Admin-Rechte geben
3. Eine Nachricht in den Chat schreiben, dann aufrufen:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
4. `chat.id` aus der Antwort kopieren → `TELEGRAM_CHAT_ID`

### Schritt 3: Backend auf Railway

1. GitHub-Repository erstellen, diesen Code pushen
2. Railway → "New Project" → "Deploy from GitHub"
3. Root Directory: `backend/`
4. Umgebungsvariablen in Railway setzen:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...
   TELEGRAM_BOT_TOKEN=123456789:AAF...
   TELEGRAM_CHAT_ID=-100123456789
   ```
5. Railway deployed automatisch via `Dockerfile`

### Schritt 4: Frontend auf Vercel

1. Vercel → "New Project" → GitHub-Repo importieren
2. Root Directory: `frontend/`
3. Umgebungsvariable setzen:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://dein-projekt.railway.app
   ```
4. Deploy

---

## Lokale Entwicklung

### Backend
```bash
cd backend
pip install -r requirements.txt
playwright install chromium

# .env Datei erstellen:
cp .env.example .env
# SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID eintragen

uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install

# .env.local erstellen:
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:8000" > .env.local

npm run dev
```

---

## API-Endpunkte (Backend)

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/health` | Health-Check |
| GET | `/api/listings` | Alle Inserate (mit Filtern) |
| GET | `/api/listings/{id}` | Einzelnes Inserat |
| GET | `/api/stats` | Statistiken |
| GET | `/api/scan-logs` | Letzte 10 Scan-Logs |
| POST | `/api/trigger-scan` | Sofort-Scan starten |
| GET | `/api/config` | Aktuelle Konfiguration |
| PUT | `/api/config` | Konfiguration aktualisieren |
| GET | `/api/telegram/test` | Test-Nachricht senden |

## Projektstruktur

```
immo-scout/
├── backend/         # Python FastAPI + Scraper
├── frontend/        # Next.js 14 Dashboard
├── supabase/        # DB-Schema
└── README.md
```
