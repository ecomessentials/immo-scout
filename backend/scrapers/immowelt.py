import asyncio
import logging
import re
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from models import Listing, SearchFilter
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.immowelt.de"

LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
]
CONTEXT_OPTIONS = {
    "user_agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "viewport": {"width": 1280, "height": 800},
    "locale": "de-DE",
    "timezone_id": "Europe/Berlin",
}
HIDE_WEBDRIVER = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"

class ImmoweltScraper(BaseScraper):
    name = "immowelt"

    def _build_url(self, city: str, f: SearchFilter, page: int = 1, radius: int = 0) -> str:
        slug = self.city_slug(city)
        url = (
            f"{BASE_URL}/suche/{slug}/wohnungen/mieten"
            f"?wflmi={f.min_sqm}&wflma={f.max_sqm}"
            f"&umkreis={radius}"
        )
        if page > 1:
            url += f"&cp={page}"
        return url

    async def _extract_items(self, page) -> list:
        """Try multiple selectors, fallback to expose links."""
        for selector in [
            '[data-testid="serp-core-classified-card-testid"]',
            'div[class*="EstateItem"]',
            'div[class*="estateItem"]',
            'article',
        ]:
            items = await page.query_selector_all(selector)
            if items:
                return items
        return []

    async def _extract_location_text(self, item) -> str:
        selectors = [
            '[data-testid*="address"]',
            '[data-testid*="location"]',
            '[class*="address"]',
            '[class*="Address"]',
            '[class*="location"]',
            '[class*="Location"]',
        ]
        parts: list[str] = []
        for selector in selectors:
            for element in await item.query_selector_all(selector):
                text = (await element.inner_text()).strip()
                if text:
                    parts.append(text)
        return " ".join(parts)

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        seen_ids: set[str] = set()
        radius = f.city_radius.get(city, f.default_radius)
        logger.info(f"[Immowelt] [{city}] Umkreis: {radius} km")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=LAUNCH_ARGS)
            context = await browser.new_context(**CONTEXT_OPTIONS)
            await context.add_init_script(HIDE_WEBDRIVER)
            page = await context.new_page()
            try:
                for page_num in range(1, 6):  # up to 5 pages
                    url = self._build_url(city, f, page_num, radius)
                    logger.info(f"[Immowelt] [{city}] Page {page_num}: {url}")
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(3)

                    if page_num == 1:
                        try:
                            await page.click('[data-testid="uc-accept-all-button"]', timeout=3000)
                            await asyncio.sleep(1)
                        except Exception:
                            pass

                    items = await self._extract_items(page)

                    # Fallback: expose links when no card containers found
                    if not items:
                        expose_links = await page.query_selector_all("a[href*='/expose/']")
                        logger.info(f"[Immowelt] [{city}] Page {page_num}: 0 cards, {len(expose_links)} expose links (fallback)")
                        if not expose_links:
                            break
                        for link_el in expose_links:
                            try:
                                href = await link_el.get_attribute("href") or ""
                                if not href:
                                    continue
                                listing_url = href if href.startswith("http") else BASE_URL + href
                                id_match = re.search(r"/expose/([a-zA-Z0-9]{8,})", href)
                                if not id_match:
                                    continue
                                raw_id = id_match.group(1)
                                logger.info(f"[Immowelt] ID extrahiert: {raw_id} aus {href}")
                                external_id = self.build_external_id("iw", raw_id)
                                if external_id in seen_ids:
                                    continue
                                seen_ids.add(external_id)
                                title_text = (await link_el.inner_text()).strip()
                                verified_city = self.verified_target_city(title_text, city)
                                if not verified_city:
                                    logger.info(f"[Immowelt] [{city}] Fallback ohne verifizierten Zielort übersprungen")
                                    continue
                                listings.append(Listing(
                                    external_id=external_id,
                                    source=self.name,
                                    title=title_text or f"Wohnung in {city}",
                                    city=verified_city,
                                    listing_url=listing_url,
                                    condition=None,
                                ))
                            except Exception as e:
                                logger.warning(f"[Immowelt] [{city}] Expose link error: {e}")
                        break

                    logger.info(f"[Immowelt] [{city}] Page {page_num}: {len(items)} cards gefunden")
                    page_new = 0

                    for item in items:
                        try:
                            link_el = await item.query_selector("a[href*='/expose/'], a[href]")
                            href = await link_el.get_attribute("href") if link_el else ""
                            if not href:
                                continue
                            listing_url = href if href.startswith("http") else BASE_URL + href

                            id_match = re.search(r"/expose/([a-zA-Z0-9]{8,})", href)
                            if not id_match:
                                continue  # skip items without a clean /expose/ ID
                            raw_id = id_match.group(1)
                            logger.info(f"[Immowelt] ID extrahiert: {raw_id} aus {href}")
                            external_id = self.build_external_id("iw", raw_id)
                            if external_id in seen_ids:
                                continue
                            seen_ids.add(external_id)

                            title_el = await item.query_selector("h2, h3")
                            title = (await title_el.inner_text()).strip() if title_el else f"Wohnung in {city}"

                            if self.is_wanted_ad(title):
                                logger.info(f"[Immowelt] [{city}] Überspringe Gesuch: {title[:60]}")
                                continue

                            location_text = await self._extract_location_text(item)
                            verified_city = self.verified_target_city(location_text, city)
                            if not verified_city:
                                logger.info(f"[Immowelt] [{city}] Ort nicht verifiziert, überspringe: {location_text or title[:80]}")
                                continue
                            if self.mentions_other_location(f"{title} {location_text}", verified_city):
                                logger.info(f"[Immowelt] [{city}] Fremder Ort im Text, überspringe: {title[:80]}")
                                continue

                            price_el = await item.query_selector('[data-testid="cardmfe-price-testid"]')
                            price_text = (await price_el.inner_text()).strip() if price_el else ""
                            price = self.parse_price(price_text) if price_text else None

                            keyfacts_el = await item.query_selector('[data-testid="cardmfe-keyfacts-testid"]')
                            keyfacts_text = (await keyfacts_el.inner_text()).strip() if keyfacts_el else ""
                            sqm = self.parse_sqm(keyfacts_text)
                            rooms = self.parse_rooms(keyfacts_text)

                            if rooms is not None and f.min_rooms is not None and f.max_rooms is not None:
                                if rooms < f.min_rooms or rooms > f.max_rooms:
                                    logger.info(f"[Immowelt] [{city}] Überspringe {rooms} Zi: {title[:40]}")
                                    continue

                            img_el = await item.query_selector("img")
                            image_url = await img_el.get_attribute("src") if img_el else None

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
                                rooms=rooms,
                                city=verified_city,
                                image_url=image_url,
                                listing_url=listing_url,
                                condition=None,
                            ))
                            page_new += 1
                        except Exception as e:
                            logger.warning(f"[Immowelt] [{city}] Item error: {e}")

                    logger.info(f"[Immowelt] [{city}] Page {page_num}: {page_new} neue Listings")
                    if page_new == 0:
                        break
                    await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"[Immowelt] [{city}] Scrape error: {e}")
            finally:
                await browser.close()

        logger.info(f"[Immowelt] [{city}] Gesamt: {len(listings)} Listings")
        return listings
