import os
from dotenv import load_dotenv

load_dotenv()

DEFAULT_FILTER = {
    "max_price": 195000,
    "min_sqm": 30,
    "max_sqm": 250,
    "min_rooms": 3,
    "max_rooms": 4,
    "cities": [
        "Paderborn", "Gütersloh", "Bielefeld", "Herford", "Rheda-Wiedenbrück", "Bad Oeynhausen",
        "Detmold", "Lippstadt", "Soest", "Hamm",
        "Minden", "Bünde", "Löhne", "Bad Salzuflen", "Lemgo",
        "Osnabrück", "Münster", "Dortmund", "Gelsenkirchen", "Hagen", "Iserlohn",
        "Delbrück", "Salzkotten", "Warburg", "Höxter",
        "Büren", "Lichtenau", "Borchen", "Bad Wünnenberg",
    ],
    # Jede Stadt wird mit default_radius km Umkreis gesucht.
    # Städte in city_radius überschreiben den Default.
    "default_radius": 15,
    "city_radius": {
        "Dortmund": 50,
        "Gelsenkirchen": 50,
    },
    "keywords": [],
    "active": True,
    "scan_interval": 180,
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
