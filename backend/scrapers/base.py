import re
import logging
from abc import ABC, abstractmethod
from models import Listing, SearchFilter

logger = logging.getLogger(__name__)

BROWSER_ARGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


class BaseScraper(ABC):
    name: str = "base"

    @abstractmethod
    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        ...

    def parse_price(self, text: str) -> int | None:
        if not text:
            return None
        digits = re.sub(r"[^\d]", "", text)
        return int(digits) if digits else None

    def parse_sqm(self, text: str) -> float | None:
        if not text:
            return None
        match = re.search(r"(\d+[,.]?\d*)\s*m[²2]", text, re.IGNORECASE)
        if match:
            return float(match.group(1).replace(",", "."))
        return None

    def parse_rooms(self, text: str) -> float | None:
        if not text:
            return None
        match = re.search(r"(\d+[.,]?\d*)\s*Zi", text, re.IGNORECASE)
        if match:
            return float(match.group(1).replace(",", "."))
        return None

    def matches_keywords(self, text: str, keywords: list[str]) -> bool:
        text_lower = text.lower()
        return any(kw.lower() in text_lower for kw in keywords)

    def build_external_id(self, prefix: str, raw_id: str) -> str:
        return f"{prefix}_{raw_id}"

    def city_slug(self, city: str) -> str:
        slug = city.lower()
        slug = slug.replace("ü", "ue").replace("ö", "oe").replace("ä", "ae").replace("ß", "ss")
        slug = re.sub(r"[^a-z0-9-]", "-", slug)
        slug = re.sub(r"-+", "-", slug).strip("-")
        return slug
