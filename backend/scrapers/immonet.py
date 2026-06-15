import asyncio
import logging
import re
from urllib.parse import quote
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from models import Listing, SearchFilter
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.immonet.de"

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

# Selector cascade to try in order
_SELECTORS = [
    "div[id^='selObject']",
    "div.result-list-entry",
    "div.col-xs-12.col-sm-12",
    "article",
]


class ImmonetScraper(BaseScraper):
    name = "immonet"

    def _build_url(self, city: str, f: SearchFilter) -> str:
        city_encoded = quote(city)
        return (
            f"{BASE_URL}/immobiliensuche/sel.do"
            f"?objecttype=1&listsize=26&sortby=19&suchart=1"
            f"&city={city_encoded}&region=DE-NW"
            f"&pricemax={f.max_price}&areamin={f.min_sqm}&areamax={f.max_sqm}"
        )

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        url = self._build_url(city, f)
        logger.info(f"[Immonet] [{city}] Loading: {url}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=LAUNCH_ARGS)
            context = await browser.new_context(**CONTEXT_OPTIONS)
            await context.add_init_script(HIDE_WEBDRIVER)
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(5)

                # Cookie / consent banner
                try:
                    accept = await page.query_selector(
                        'button[id*="accept"], button[class*="accept"], '
                        '#onetrust-accept-btn-handler, button[title*="Akzeptieren"]'
                    )
                    if accept:
                        await accept.click()
                        await asyncio.sleep(1)
                except Exception:
                    pass

                # Capture full HTML for debug logging
                html = await page.content()

                # Try selector cascade
                items = []
                used_selector = ""
                for sel in _SELECTORS:
                    items = await page.query_selector_all(sel)
                    if items:
                        used_selector = sel
                        break

                if items:
                    logger.info(f"[Immonet] [{city}] {len(items)} items via '{used_selector}'")
                else:
                    logger.warning(f"[Immonet] [{city}] Alle Selektoren leer – versuche Expose-Links")
                    logger.debug(f"[Immonet] [{city}] HTML (3000 Zeichen): {html[:3000]}")

                    # Fallback: alle /expose/ Links
                    expose_links = await page.query_selector_all("a[href*='/expose/']")
                    logger.info(f"[Immonet] [{city}] {len(expose_links)} Expose-Links gefunden")
                    seen_ids: set[str] = set()
                    for link_el in expose_links:
                        try:
                            href = await link_el.get_attribute("href") or ""
                            if not href:
                                continue
                            listing_url = href if href.startswith("http") else BASE_URL + href
                            id_match = re.search(r"/expose/(?:view/)?(\d+)", href)
                            if not id_match:
                                continue
                            raw_id = id_match.group(1)
                            external_id = self.build_external_id("inet", raw_id)
                            if external_id in seen_ids:
                                continue
                            seen_ids.add(external_id)
                            title_text = (await link_el.inner_text()).strip()
                            # Try to grab surrounding text for price/sqm
                            parent_text = await link_el.evaluate(
                                "el => el.closest('div,li,td,tr') ? el.closest('div,li,td,tr').innerText : ''"
                            )
                            price = self.parse_price(parent_text) if "€" in parent_text else None
                            sqm = self.parse_sqm(parent_text)
                            listings.append(Listing(
                                external_id=external_id,
                                source=self.name,
                                title=title_text or f"Wohnung in {city}",
                                price=price,
                                sqm=sqm,
                                city=city,
                                listing_url=listing_url,
                                condition="renovierungsbedürftig",
                            ))
                        except Exception as e:
                            logger.warning(f"[Immonet] [{city}] Expose-Link-Fehler: {e}")
                    logger.info(f"[Immonet] [{city}] {len(listings)} via Expose-Link-Fallback")
                    return listings

                # Parse items from matched selector
                for item in items:
                    try:
                        # ID extraction
                        item_id = await item.get_attribute("data-item-id") or ""
                        if not item_id:
                            id_attr = await item.get_attribute("id") or ""
                            m = re.search(r"(\d+)", id_attr)
                            item_id = m.group(1) if m else ""
                        if not item_id:
                            # try to find from expose link within item
                            link_el = await item.query_selector("a[href*='/expose/']")
                            if link_el:
                                href = await link_el.get_attribute("href") or ""
                                m = re.search(r"/expose/(?:view/)?(\d+)", href)
                                item_id = m.group(1) if m else ""
                        if not item_id:
                            continue
                        external_id = self.build_external_id("inet", item_id)

                        # URL
                        link_el = await item.query_selector("a[href*='/expose/'], a[href]")
                        href = await link_el.get_attribute("href") if link_el else ""
                        if not href:
                            href = f"/expose/view/{item_id}"
                        listing_url = href if href.startswith("http") else BASE_URL + href

                        # Title
                        title_el = await item.query_selector(
                            ".result-list-entry__realty-title, h3, h2"
                        )
                        title = (await title_el.inner_text()).strip() if title_el else f"Wohnung in {city}"

                        # Price and sqm from criteria elements
                        price = None
                        sqm = None
                        criteria_els = await item.query_selector_all(
                            ".result-list-entry__primary-criterion, "
                            ".criteria-group span, .resultlist-attributes span, td, .advert-price"
                        )
                        for el in criteria_els:
                            text = (await el.inner_text()).strip()
                            if "€" in text and price is None:
                                price = self.parse_price(text)
                            if ("m²" in text or "m2" in text.lower()) and sqm is None:
                                sqm = self.parse_sqm(text)

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
                            city=city,
                            image_url=image_url,
                            listing_url=listing_url,
                            condition="renovierungsbedürftig",
                        ))
                    except Exception as e:
                        logger.warning(f"[Immonet] [{city}] Item-Fehler: {e}")

                logger.info(f"[Immonet] [{city}] {len(listings)} Listings nach Filter")

            except Exception as e:
                logger.error(f"[Immonet] [{city}] Scrape error: {e}")
            finally:
                await browser.close()

        return listings
