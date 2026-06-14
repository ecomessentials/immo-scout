import logging
import re
import xml.etree.ElementTree as ET
import httpx
from models import Listing, SearchFilter
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.kleinanzeigen.de"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "de-DE,de;q=0.9",
}


class EbayScraper(BaseScraper):
    name = "ebay"

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        slug = self.city_slug(city)
        url = f"{BASE_URL}/s-wohnung-kaufen/{slug}/preis::{f.max_price}/k0c196.rss"
        logger.info(f"[eBay] [{city}] Fetching RSS: {url}")

        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                response = await client.get(url, headers=HEADERS)
                response.raise_for_status()
        except Exception as e:
            logger.error(f"[eBay] [{city}] HTTP error: {e}")
            return listings

        try:
            # Use bytes so ElementTree respects the XML-declared encoding.
            root = ET.fromstring(response.content)
        except ET.ParseError as e:
            logger.error(f"[eBay] [{city}] XML parse error: {e}")
            return listings

        channel = root.find("channel")
        if channel is None:
            logger.warning(f"[eBay] [{city}] Kein <channel> im RSS-Feed")
            return listings

        items = channel.findall("item")
        logger.info(f"[eBay] [{city}] {len(items)} Items im RSS-Feed (vor Filtern)")

        for item in items:
            try:
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                description_html = (item.findtext("description") or "").strip()
                guid = (item.findtext("guid") or link).strip()

                if not link or not title:
                    continue

                # ID aus Link oder GUID extrahieren
                id_match = re.search(r"/(\d+)-[^/]*$", link) or re.search(r"(\d+)", guid)
                raw_id = id_match.group(1) if id_match else re.sub(r"\W", "", link)[-12:]
                external_id = self.build_external_id("ebay", raw_id)

                # Preis aus HTML-Description: "120.000 €" oder "120000 €"
                price_match = re.search(r"([\d.,]+)\s*€", description_html)
                price = self.parse_price(price_match.group(1)) if price_match else None

                # HTML-Tags entfernen für Textanalyse
                description_text = re.sub(r"<[^>]+>", " ", description_html)
                description_text = re.sub(r"\s+", " ", description_text).strip()

                sqm = self.parse_sqm(title + " " + description_text)

                # Filter
                combined = f"{title} {description_text}"
                if not self.matches_keywords(combined, f.keywords):
                    continue
                if price and price > f.max_price:
                    continue
                if sqm and (sqm < f.min_sqm or sqm > f.max_sqm):
                    continue

                listings.append(
                    Listing(
                        external_id=external_id,
                        source=self.name,
                        title=title,
                        price=price,
                        sqm=sqm,
                        city=city,
                        description=description_text[:500] if description_text else None,
                        listing_url=link,
                        condition="renovierungsbedürftig",
                    )
                )
            except Exception as e:
                logger.warning(f"[eBay] [{city}] Item parse error: {e}")

        logger.info(f"[eBay] [{city}] {len(listings)} listings nach Filtern")
        return listings
