import asyncio
import logging
import random
import re
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from models import Listing, SearchFilter
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.immobilienscout24.de"

LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
]

CONTEXT_OPTIONS = {
    "user_agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "viewport": {"width": 1280, "height": 800},
    "locale": "de-DE",
    "timezone_id": "Europe/Berlin",
}

HIDE_WEBDRIVER = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"


class ImmoScout24Scraper(BaseScraper):
    name = "immoscout24"

    def _build_url(self, city: str, f: SearchFilter, page: int = 1) -> str:
        slug = self.city_slug(city)
        return (
            f"{BASE_URL}/Suche/de/nordrhein-westfalen/{slug}/wohnung-kaufen"
            f"?price=-{f.max_price}"
            f"&livingspace={f.min_sqm}-{f.max_sqm}"
            f"&equipment=renovationneed"
            f"&pagenumber={page}"
        )

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=LAUNCH_ARGS)
            context = await browser.new_context(**CONTEXT_OPTIONS)
            await context.add_init_script(HIDE_WEBDRIVER)
            page = await context.new_page()
            try:
                for page_num in range(1, 4):
                    url = self._build_url(city, f, page_num)
                    await asyncio.sleep(random.uniform(2, 4))
                    logger.info(f"[ImmoScout24] [{city}] Loading page {page_num}: {url}")
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)

                    if page_num == 1:
                        try:
                            await page.click('[data-testid="uc-accept-all-button"]', timeout=3000)
                            await asyncio.sleep(1)
                        except Exception:
                            pass

                    # Wait for primary selector; fall back to alternate on timeout.
                    items = []
                    try:
                        await page.wait_for_selector("article[data-obid]", timeout=10000)
                        items = await page.query_selector_all("article[data-obid]")
                    except PlaywrightTimeout:
                        logger.warning(f"[ImmoScout24] [{city}] Page {page_num}: blockiert oder keine Ergebnisse (data-obid)")
                        try:
                            await page.wait_for_selector('[data-testid="result-list-entry"]', timeout=5000)
                            items = await page.query_selector_all('[data-testid="result-list-entry"]')
                        except PlaywrightTimeout:
                            logger.warning(f"[ImmoScout24] [{city}] Page {page_num}: Fallback-Selector ebenfalls leer – überspringe")
                            break

                    if not items:
                        logger.info(f"[ImmoScout24] [{city}] Page {page_num}: keine Items, stoppe")
                        break

                    page_listings = 0
                    for item in items:
                        try:
                            obid = await item.get_attribute("data-obid") or ""
                            if not obid:
                                link_el = await item.query_selector("a[href*='/expose/']")
                                if link_el:
                                    href = await link_el.get_attribute("href") or ""
                                    m = re.search(r"/expose/(\d+)", href)
                                    obid = m.group(1) if m else ""
                            if not obid:
                                continue

                            external_id = self.build_external_id("is24", obid)

                            link_el = await item.query_selector("a")
                            href = ""
                            if link_el:
                                href = await link_el.get_attribute("href") or ""
                            listing_url = href if href.startswith("http") else BASE_URL + href
                            if not listing_url or listing_url == BASE_URL:
                                continue

                            title_el = await item.query_selector(
                                '.result-list-entry__brand-title, [data-testid="result-list-entry-title"]'
                            )
                            title = (await title_el.inner_text()).strip() if title_el else f"Wohnung in {city}"

                            criteria_text = ""
                            criteria_el = await item.query_selector(".result-list-entry__criteria")
                            if criteria_el:
                                criteria_text = await criteria_el.inner_text()

                            price_el = await item.query_selector(
                                '.result-list-entry__primary-criterion, [data-testid="result-list-entry-price"]'
                            )
                            price_text = (await price_el.inner_text()).strip() if price_el else ""
                            price = self.parse_price(price_text)

                            sqm = self.parse_sqm(criteria_text)
                            rooms = self.parse_rooms(criteria_text)

                            img_el = await item.query_selector("img")
                            image_url = await img_el.get_attribute("src") if img_el else None

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
                                    rooms=rooms,
                                    city=city,
                                    description=criteria_text[:500] if criteria_text else None,
                                    image_url=image_url,
                                    listing_url=listing_url,
                                    condition="renovierungsbedürftig",
                                )
                            )
                            page_listings += 1
                        except Exception as e:
                            logger.warning(f"[ImmoScout24] [{city}] Item parse error: {e}")

                    logger.info(f"[ImmoScout24] [{city}] Page {page_num}: {page_listings} listings parsed")
                    if page_listings == 0:
                        break
            except Exception as e:
                logger.error(f"[ImmoScout24] [{city}] Scrape error: {e}")
            finally:
                await browser.close()
        return listings
