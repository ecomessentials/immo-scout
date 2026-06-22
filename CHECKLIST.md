# ImmobilienKrieger – Deployment Checklist

## Infrastruktur
- [ ] Backend auf Railway deployed (`backend/` als Root, Dockerfile)
- [ ] Frontend auf Vercel deployed (`frontend/` als Root)
- [ ] Supabase Tabellen erstellt (SQL aus `supabase/schema.sql` ausführen)
- [ ] Telegram Bot konfiguriert (@BotFather → Token kopieren)

## Environment Variables

### Railway (Backend)
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=123456789:AAF...
TELEGRAM_CHAT_ID=-100123456789
```

### Vercel (Frontend)
```
NEXT_PUBLIC_BACKEND_URL=https://dein-projekt.railway.app
```

## System Status
- ✅ Scan läuft alle 3 Stunden (APScheduler hours=3)
- ✅ eBay Kleinanzeigen Scraper aktiv (httpx + BeautifulSoup)
- ✅ Zimmerfilter: 1–5 Zimmer (rooms=None → immer behalten)
- ✅ Mietfilter: max 650 € Kaltmiete
- ✅ Zielorte: 6 Städte (Winterberg, Münster, Bad Salzuflen, Paderborn, Detmold, Hameln)
- ✅ Gesuch-Inserate werden gefiltert (18 AUSSCHLUSS_KEYWORDS)
- ✅ Dark Mode verfügbar (next-themes, System-Präferenz als Standard)
- ✅ Mobile-responsive (Tailwind mobile-first)
- ✅ Login-Schutz (localStorage, kein externer Auth-Service)
- ✅ Telegram-Benachrichtigung bei neuen Wohnungen
- ✅ Live Scan-Progress via SSE (/api/scan/stream)
- ✅ Vercel public access (vercel.json: "public": true)

## Portale
| Portal | Methode | Status |
|--------|---------|--------|
| eBay Kleinanzeigen | httpx + BeautifulSoup | ✅ Aktiv |
| Immowelt | Playwright + Anti-Bot | ✅ Aktiv |
| ImmoScout24 | Offizielle OAuth-API | ✅ Optional, benötigt API-Berechtigung |
| Immonet | – | ❌ Entfernt (leitet auf Immowelt weiter) |

## Supabase nach Deployment prüfen
```sql
-- Alle Listings löschen für sauberen Start:
DELETE FROM listings;
DELETE FROM scan_logs;

-- Scan-Interval auf 180 setzen:
UPDATE search_config SET scan_interval = 180;

-- Config prüfen:
SELECT * FROM search_config;
```
