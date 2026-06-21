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
    "Referer": "https://www.google.de/",
    "DNT": "1",
    "Sec-GPC": "1",
}


class EbayScraper(BaseScraper):
    name = "ebay"

    def _page_url(self, slug: str, page: int, radius: int = 15) -> str:
        # Radius encoded as {slug}+{radius}km in the path (Kleinanzeigen URL convention)
        city_part = f"{slug}+{radius}km" if radius > 0 else slug
        base = f"{BASE_URL}/s-wohnung-mieten/{city_part}/c203"
        return base if page == 1 else f"{base}?pageNum={page}"

    async def _fetch(self, url: str, city: str = "") -> str | None:
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                r = await client.get(url, headers=HEADERS)
            logger.info(f"[eBay] [{city}] HTTP {r.status_code} – {url}")
            logger.info(f"[eBay] [{city}] 'aditem' in HTML: {'aditem' in r.text}")
            logger.info(f"[eBay] [{city}] 's-anzeige' in HTML: {'s-anzeige' in r.text}")
            logger.info(f"[eBay] [{city}] HTML-Start: {r.text[:1000]}")
            if r.status_code != 200:
                logger.warning(f"[eBay] [{city}] Non-200: {r.text[:300]}")
                return None
            return r.text
        except Exception as e:
            logger.error(f"[eBay] [{city}] HTTP error: {e}")
            return None

    def _parse_items(self, html: str, city: str, f: SearchFilter, seen_ids: set[str]) -> list[Listing]:
        soup = BeautifulSoup(html, "lxml")
        listings: list[Listing] = []

        items = soup.select("article.aditem")
        if not items:
            items = soup.select("div[data-adid]")

        if not items:
            # Fallback: unique /s-anzeige/ links
            ad_links = soup.select("a[href*='/s-anzeige/']")
            for link in ad_links:
                href = link.get("href", "")
                m = re.search(r"/(\d+)-", href)
                if not m:
                    continue
                external_id = self.build_external_id("ebay", m.group(1))
                if external_id in seen_ids:
                    continue
                seen_ids.add(external_id)
                listing_url = href if href.startswith("http") else BASE_URL + href
                title = link.get_text(strip=True) or f"Wohnung in {city}"
                listings.append(Listing(
                    external_id=external_id, source=self.name, title=title,
                    city=city, listing_url=listing_url, condition=None,
                ))
            logger.info(f"[eBay] [{city}] {len(listings)} via Link-Fallback")
            return listings

        html_count = len(items)
        for item in items:
            try:
                adid = item.get("data-adid") or ""
                if not adid:
                    link_el = item.select_one("a[href*='/s-anzeige/']")
                    href_tmp = link_el.get("href", "") if link_el else ""
                    m = re.search(r"/(\d+)-", href_tmp)
                    adid = m.group(1) if m else ""
                if not adid:
                    continue
                external_id = self.build_external_id("ebay", adid)
                if external_id in seen_ids:
                    continue
                seen_ids.add(external_id)

                title_el = item.select_one("h2.text-module-begin, h2")
                title = title_el.get_text(strip=True) if title_el else f"Wohnung in {city}"

                if self.is_wanted_ad(title):
                    logger.info(f"[eBay] [{city}] Überspringe Gesuch: {title[:60]}")
                    continue

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

                rooms_match = re.search(
                    r"(\d+[\.,]?\d*)\s*(?:zimmer|zi\.?\b|-zimmer)",
                    title + " " + (description or ""),
                    re.IGNORECASE,
                )
                rooms = float(rooms_match.group(1).replace(",", ".")) if rooms_match else None

                # Filters: rent, living space, and rooms if the portal exposes them.
                if price and price > f.max_price:
                    continue
                if sqm and (sqm < f.min_sqm or sqm > f.max_sqm):
                    continue
                if rooms is not None and f.min_rooms is not None and f.max_rooms is not None:
                    if rooms < f.min_rooms or rooms > f.max_rooms:
                        logger.info(f"[eBay] [{city}] Überspringe {rooms} Zi: {title[:40]}")
                        continue

                listings.append(Listing(
                    external_id=external_id, source=self.name, title=title,
                    price=price, sqm=sqm, rooms=rooms, city=item_city,
                    description=description[:500] if description else None,
                    image_url=image_url, listing_url=listing_url, condition=None,
                ))
            except Exception as e:
                logger.warning(f"[eBay] [{city}] Item parse error: {e}")

        logger.info(f"[eBay] [{city}] {html_count} items im HTML gefunden, {len(listings)} nach Preisfilter")
        return listings

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        await asyncio.sleep(2)  # polite rate limit
        slug = self.city_slug(city)
        radius = f.city_radius.get(city, f.default_radius)
        logger.info(f"[eBay] [{city}] Umkreis: {radius} km")
        listings: list[Listing] = []
        seen_ids: set[str] = set()

        for page_num in range(1, 4):  # up to 3 pages
            url = self._page_url(slug, page_num, radius)
            logger.info(f"[eBay] [{city}] Page {page_num}: {url}")

            html = await self._fetch(url, city)
            if not html:
                break

            page_listings = self._parse_items(html, city, f, seen_ids)
            listings.extend(page_listings)

            if not page_listings:
                logger.info(f"[eBay] [{city}] Page {page_num}: 0 Items – stoppe Pagination")
                if page_num == 1:
                    logger.warning(f"[eBay] [{city}] 0 Items auf Seite 1. HTML-Snippet: {html[:2000]}")
                break

            logger.info(f"[eBay] [{city}] Page {page_num}: {len(page_listings)} Items")
            if page_num < 3:
                await asyncio.sleep(2)

        logger.info(f"[eBay] [{city}] Gesamt: {len(listings)} Listings")
        return listings
