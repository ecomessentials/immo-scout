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

# Relaxed URL range to catch more listings; hard filter applied on results
_URL_MIN_SQM = 50
_URL_MAX_SQM = 150
_URL_MAX_PRICE = 195000


class ImmoweltScraper(BaseScraper):
    name = "immowelt"

    def _build_url(self, city: str, page: int = 1) -> str:
        slug = self.city_slug(city)
        url = (
            f"{BASE_URL}/suche/{slug}/wohnungen/kaufen"
            f"?pma={_URL_MAX_PRICE}&wflmi={_URL_MIN_SQM}&wflma={_URL_MAX_SQM}"
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

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        seen_ids: set[str] = set()

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=LAUNCH_ARGS)
            context = await browser.new_context(**CONTEXT_OPTIONS)
            await context.add_init_script(HIDE_WEBDRIVER)
            page = await context.new_page()
            try:
                for page_num in range(1, 6):  # up to 5 pages
                    url = self._build_url(city, page_num)
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
                                id_match = re.search(r"/expose/([^/?]+)", href)
                                if not id_match:
                                    continue
                                raw_id = id_match.group(1)
                                external_id = self.build_external_id("iw", raw_id)
                                if external_id in seen_ids:
                                    continue
                                seen_ids.add(external_id)
                                title_text = (await link_el.inner_text()).strip()
                                listings.append(Listing(
                                    external_id=external_id,
                                    source=self.name,
                                    title=title_text or f"Wohnung in {city}",
                                    city=city,
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

                            id_match = re.search(r"/expose/([^/?]+)", href)
                            if not id_match:
                                id_match = re.search(r"/(\w{6,})", href)
                            raw_id = id_match.group(1) if id_match else href.split("/")[-1]
                            external_id = self.build_external_id("iw", raw_id)
                            if external_id in seen_ids:
                                continue
                            seen_ids.add(external_id)

                            title_el = await item.query_selector("h2, h3")
                            title = (await title_el.inner_text()).strip() if title_el else f"Wohnung in {city}"

                            price_el = await item.query_selector('[data-testid="cardmfe-price-testid"]')
                            price_text = (await price_el.inner_text()).strip() if price_el else ""
                            price = self.parse_price(price_text) if price_text else None

                            keyfacts_el = await item.query_selector('[data-testid="cardmfe-keyfacts-testid"]')
                            keyfacts_text = (await keyfacts_el.inner_text()).strip() if keyfacts_el else ""
                            sqm = self.parse_sqm(keyfacts_text)
                            rooms = self.parse_rooms(keyfacts_text)

                            img_el = await item.query_selector("img")
                            image_url = await img_el.get_attribute("src") if img_el else None

                            # Set condition based on keywords; save ALL listings regardless
                            combined = f"{title} {keyfacts_text}"
                            condition = "renovierungsbedürftig" if self.matches_keywords(combined, f.keywords) else None

                            # Only hard price filter; accept all sqm
                            if price and price > _URL_MAX_PRICE:
                                continue

                            listings.append(Listing(
                                external_id=external_id,
                                source=self.name,
                                title=title,
                                price=price,
                                sqm=sqm,
                                rooms=rooms,
                                city=city,
                                image_url=image_url,
                                listing_url=listing_url,
                                condition=condition,
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
