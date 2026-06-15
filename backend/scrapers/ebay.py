import asyncio
import logging
import re
import httpx
from bs4 import BeautifulSoup
from models import Listing, SearchFilter
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.kleinanzeigen.de"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Cache-Control": "max-age=0",
}


class EbayScraper(BaseScraper):
    name = "ebay"

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        await asyncio.sleep(2)  # polite rate limit between cities

        slug = self.city_slug(city)
        url = f"{BASE_URL}/s-wohnung-kaufen/{slug}/preis::{f.max_price}/k0c196"
        logger.info(f"[eBay] [{city}] Fetching: {url}")

        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                response = await client.get(url, headers=HEADERS)
            logger.info(f"[eBay] [{city}] HTTP {response.status_code}")
            if response.status_code != 200:
                logger.warning(f"[eBay] [{city}] Non-200: {response.text[:500]}")
                return listings
        except Exception as e:
            logger.error(f"[eBay] [{city}] HTTP error: {e}")
            return listings

        soup = BeautifulSoup(response.text, "lxml")

        # Selector cascade
        items = soup.select("article.aditem")
        if not items:
            items = soup.select("div[data-adid]")

        if not items:
            # Fallback: unique ad links
            ad_links = soup.select("a[href*='/s-anzeige/']")
            seen_fallback: set[str] = set()
            for link in ad_links:
                href = link.get("href", "")
                id_match = re.search(r"/(\d+)-", href)
                if not id_match:
                    continue
                raw_id = id_match.group(1)
                external_id = self.build_external_id("ebay", raw_id)
                if external_id in seen_fallback:
                    continue
                seen_fallback.add(external_id)
                listing_url = href if href.startswith("http") else BASE_URL + href
                title = link.get_text(strip=True) or f"Wohnung in {city}"
                listings.append(Listing(
                    external_id=external_id,
                    source=self.name,
                    title=title,
                    city=city,
                    listing_url=listing_url,
                    condition="renovierungsbedürftig",
                ))
            logger.info(f"[eBay] [{city}] {len(listings)} via Link-Fallback")
            if not listings:
                logger.warning(f"[eBay] [{city}] 0 Items. HTML-Snippet: {response.text[:2000]}")
            return listings

        logger.info(f"[eBay] [{city}] {len(items)} articles gefunden (vor Filter)")
        pre_filter = len(items)

        for item in items:
            try:
                adid = item.get("data-adid") or ""
                if not adid:
                    link_el = item.select_one("a[href*='/s-anzeige/']")
                    href = link_el.get("href", "") if link_el else ""
                    m = re.search(r"/(\d+)-", href)
                    adid = m.group(1) if m else ""
                if not adid:
                    continue
                external_id = self.build_external_id("ebay", adid)

                title_el = item.select_one("h2.text-module-begin, h2")
                title = title_el.get_text(strip=True) if title_el else f"Wohnung in {city}"

                link_el = item.select_one("a[href*='/s-anzeige/'], a.ellipsis, h2 a")
                href = link_el.get("href", "") if link_el else ""
                listing_url = href if href.startswith("http") else BASE_URL + href
                if not listing_url:
                    continue

                price_el = item.select_one("p.aditem-main--middle--price-shipping--price")
                price_text = price_el.get_text(strip=True) if price_el else ""
                price = self.parse_price(price_text) if price_text else None

                desc_el = item.select_one("p.aditem-main--middle--description")
                description = desc_el.get_text(strip=True) if desc_el else ""

                city_el = item.select_one("div.aditem-main--top--left")
                item_city = city
                if city_el:
                    spans = city_el.select("span")
                    if spans:
                        item_city = spans[-1].get_text(strip=True) or city

                img_el = item.select_one("img")
                image_url = img_el.get("src") if img_el else None

                sqm = self.parse_sqm(title + " " + description)

                combined = f"{title} {description}"
                if not self.matches_keywords(combined, f.keywords):
                    continue
                if price and price > f.max_price:
                    continue
                if sqm and (sqm < f.min_sqm or sqm > f.max_sqm):
                    continue

                listings.append(Listing(
                    external_id=external_id,
                    source=self.name,
                    title=title,
                    price=price,
                    sqm=sqm,
                    city=item_city,
                    description=description[:500] if description else None,
                    image_url=image_url,
                    listing_url=listing_url,
                    condition="renovierungsbedürftig",
                ))
            except Exception as e:
                logger.warning(f"[eBay] [{city}] Item parse error: {e}")

        logger.info(f"[eBay] [{city}] {pre_filter} gefunden → {len(listings)} nach Filter")
        return listings
