import asyncio
import logging
import re
from urllib.parse import quote
from playwright.async_api import async_playwright
from models import Listing, SearchFilter
from .base import BaseScraper, BROWSER_ARGS, USER_AGENT

logger = logging.getLogger(__name__)

BASE_URL = "https://www.immonet.de"


class ImmonetScraper(BaseScraper):
    name = "immonet"

    def _build_url(self, city: str, f: SearchFilter) -> str:
        city_encoded = quote(city)
        return (
            f"{BASE_URL}/immobiliensuche/sel.do"
            f"?objecttype=1"
            f"&listsize=26"
            f"&sortby=19"
            f"&suchart=1"
            f"&city={city_encoded}"
            f"&region=DE-NW"
            f"&pricemax={f.max_price}"
            f"&areamin={f.min_sqm}"
            f"&areamax={f.max_sqm}"
            f"&furnishing=14"
        )

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        url = self._build_url(city, f)
        logger.info(f"[Immonet] [{city}] Loading: {url}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=BROWSER_ARGS)
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(3)

                try:
                    accept_btn = await page.query_selector(
                        'button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler'
                    )
                    if accept_btn:
                        await accept_btn.click()
                        await asyncio.sleep(1)
                except Exception:
                    pass

                items = await page.query_selector_all("div[id*='selObject'], div[data-item-id]")
                if not items:
                    items = await page.query_selector_all(".result-list-entry, .offer-list-item")
                logger.info(f"[Immonet] [{city}] Found {len(items)} items")

                for item in items:
                    try:
                        item_id = await item.get_attribute("data-item-id") or ""
                        if not item_id:
                            id_attr = await item.get_attribute("id") or ""
                            id_match = re.search(r"(\d+)", id_attr)
                            item_id = id_match.group(1) if id_match else ""
                        if not item_id:
                            continue
                        external_id = self.build_external_id("inet", item_id)

                        link_el = await item.query_selector("a[href]")
                        href = ""
                        if link_el:
                            href = await link_el.get_attribute("href") or ""
                        if not href:
                            href = f"/expose/view/{item_id}"
                        listing_url = href if href.startswith("http") else BASE_URL + href

                        title_el = await item.query_selector(
                            ".result-list-entry__realty-title, h3, h2"
                        )
                        title = (await title_el.inner_text()).strip() if title_el else f"Wohnung in {city}"

                        price = None
                        sqm = None
                        criteria_els = await item.query_selector_all(
                            ".result-list-entry__primary-criterion, .criteria-group span, td"
                        )
                        for el in criteria_els:
                            text = (await el.inner_text()).strip()
                            if "€" in text and price is None:
                                price = self.parse_price(text)
                            if "m²" in text or "m2" in text and sqm is None:
                                sqm = self.parse_sqm(text)

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
                                city=city,
                                image_url=image_url,
                                listing_url=listing_url,
                                condition="renovierungsbedürftig",
                            )
                        )
                    except Exception as e:
                        logger.warning(f"[Immonet] [{city}] Item parse error: {e}")
            except Exception as e:
                logger.error(f"[Immonet] [{city}] Scrape error: {e}")
            finally:
                await browser.close()
        return listings
