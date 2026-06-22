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
    "max_price": 650,
    "min_sqm": 25,
    "max_sqm": 140,
    "min_rooms": 1,
    "max_rooms": 5,
    "cities": TARGET_CITIES,
    # 0 km keeps the scan focused on the selected cities only.
    "default_radius": 0,
    "city_radius": {},
    "keywords": [],
    "active": True,
    "scan_interval": 180,
}

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
_raw_chat_ids = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_CHAT_IDS: list[str] = [cid.strip() for cid in _raw_chat_ids.split(",") if cid.strip()]
TELEGRAM_CHAT_ID = TELEGRAM_CHAT_IDS[0] if TELEGRAM_CHAT_IDS else ""

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
