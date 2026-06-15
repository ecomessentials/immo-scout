import os
from dotenv import load_dotenv

load_dotenv()

DEFAULT_FILTER = {
    "max_price": 195000,
    "min_sqm": 30,
    "max_sqm": 250,
    "cities": [
        "Paderborn", "Gütersloh", "Bielefeld", "Herford", "Rheda-Wiedenbrück", "Bad Oeynhausen",
        "Detmold", "Lippstadt", "Soest", "Hamm",
        "Minden", "Bünde", "Löhne", "Bad Salzuflen", "Lemgo",
        "Osnabrück", "Münster", "Dortmund", "Hagen", "Iserlohn",
        "Delbrück", "Salzkotten", "Warburg", "Höxter",
        "Büren", "Lichtenau", "Borchen", "Bad Wünnenberg",
    ],
    "keywords": [],
    "active": True,
    "scan_interval": 300,
}

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
