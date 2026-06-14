import asyncio
import logging
import re
from playwright.async_api import async_playwright
from models import Listing, SearchFilter
from .base import BaseScraper, BROWSER_ARGS, USER_AGENT

logger = logging.getLogger(__name__)

BASE_URL = "https://www.immowelt.de"


class ImmoweltScraper(BaseScraper):
    name = "immowelt"

    def _build_url(self, city: str, f: SearchFilter) -> str:
        slug = self.city_slug(city)
        return (
            f"{BASE_URL}/suche/{slug}/wohnungen/kaufen"
            f"?pma={f.max_price}"
            f"&wflmi={f.min_sqm}"
            f"&wflma={f.max_sqm}"
            f"&oid=4"
        )

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        url = self._build_url(city, f)
        logger.info(f"[Immowelt] [{city}] Loading: {url}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=BROWSER_ARGS)
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(3)

                try:
                    await page.click('[data-testid="uc-accept-all-button"]', timeout=3000)
                    await asyncio.sleep(2)
                except Exception:
                    pass

                items = await page.query_selector_all(
                    '[data-testid="serp-core-classified-card-testid"], div[class*="EstateItem"], div[class*="estateItem"]'
                )
                if not items:
                    items = await page.query_selector_all("div[class*='card'], article[class*='card']")
                logger.info(f"[Immowelt] [{city}] Found {len(items)} items")

                for item in items:
                    try:
                        link_el = await item.query_selector("a[href*='/expose/'], a[href]")
                        href = ""
                        if link_el:
                            href = await link_el.get_attribute("href") or ""
                        if not href:
                            continue
                        listing_url = href if href.startswith("http") else BASE_URL + href

                        id_match = re.search(r"/expose/([^/?]+)", href)
                        if not id_match:
                            id_match = re.search(r"/(\w{8,})", href)
                        raw_id = id_match.group(1) if id_match else href.split("/")[-1]
                        external_id = self.build_external_id("iw", raw_id)

                        title_el = await item.query_selector("h2")
                        title = (await title_el.inner_text()).strip() if title_el else f"Wohnung in {city}"

                        price_el = await item.query_selector('[data-testid="cardmfe-price-testid"]')
                        price_text = (await price_el.inner_text()).strip() if price_el else ""
                        price = self.parse_price(price_text)

                        keyfacts_el = await item.query_selector('[data-testid="cardmfe-keyfacts-testid"]')
                        keyfacts_text = (await keyfacts_el.inner_text()).strip() if keyfacts_el else ""
                        sqm = self.parse_sqm(keyfacts_text)
                        rooms = self.parse_rooms(keyfacts_text)

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
                                image_url=image_url,
                                listing_url=listing_url,
                                condition="renovierungsbedürftig",
                            )
                        )
                    except Exception as e:
                        logger.warning(f"[Immowelt] [{city}] Item parse error: {e}")
            except Exception as e:
                logger.error(f"[Immowelt] [{city}] Scrape error: {e}")
            finally:
                await browser.close()
        return listings
