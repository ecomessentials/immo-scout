import os
from dotenv import load_dotenv

load_dotenv()

TARGET_CITIES = [
    "Winterberg",
    "Münster",
    "Bad Salzuflen",
    "Paderborn",
    "Detmold",
    "Hameln",
]

DEFAULT_FILTER = {
    "max_price": 700,
    "min_sqm": None,
    "max_sqm": None,
    "min_rooms": None,
    "max_rooms": None,
    "cities": TARGET_CITIES,
    # 10 km keeps the scan focused but includes nearby villages around each city.
    "default_radius": 10,
    "city_radius": {},
    "keywords": [],
    "active": True,
    "scan_interval": 60,
}

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
_raw_chat_ids = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_CHAT_IDS: list[str] = [cid.strip() for cid in _raw_chat_ids.split(",") if cid.strip()]
TELEGRAM_CHAT_ID = TELEGRAM_CHAT_IDS[0] if TELEGRAM_CHAT_IDS else ""
_railway_public_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")
BACKEND_PUBLIC_URL = os.getenv(
    "BACKEND_PUBLIC_URL",
    f"https://{_railway_public_domain}" if _railway_public_domain else "",
)

IMMO_SCOUT24_CONSUMER_KEY = os.getenv("IMMO_SCOUT24_CONSUMER_KEY", "")
IMMO_SCOUT24_CONSUMER_SECRET = os.getenv("IMMO_SCOUT24_CONSUMER_SECRET", "")
IMMO_SCOUT24_BASE_URL = os.getenv("IMMO_SCOUT24_BASE_URL", "https://rest.immobilienscout24.de")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
