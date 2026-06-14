import asyncio
import logging
import re
from playwright.async_api import async_playwright
from models import Listing, SearchFilter
from .base import BaseScraper, BROWSER_ARGS, USER_AGENT

logger = logging.getLogger(__name__)

BASE_URL = "https://www.kleinanzeigen.de"


class EbayScraper(BaseScraper):
    name = "ebay"

    def _build_url(self, city: str, f: SearchFilter) -> str:
        slug = self.city_slug(city)
        return (
            f"{BASE_URL}/s-wohnung-kaufen/{slug}"
            f"/preis::{f.max_price}"
            f"/k0c196l{{}}"
        )

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        listings: list[Listing] = []
        slug = self.city_slug(city)
        url = f"{BASE_URL}/s-wohnung-kaufen/{slug}/preis::{f.max_price}/k0c196"
        logger.info(f"[eBay] [{city}] Loading: {url}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=BROWSER_ARGS)
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(3)

                try:
                    await page.click("#gdpr-banner-accept", timeout=3000)
                    await asyncio.sleep(1)
                except Exception:
                    pass

                items = await page.query_selector_all("article.aditem")
                logger.info(f"[eBay] [{city}] Found {len(items)} items")

                for item in items:
                    try:
                        link_el = await item.query_selector("a.ellipsis, h2 a")
                        href = ""
                        if link_el:
                            href = await link_el.get_attribute("href") or ""
                        if not href:
                            continue
                        listing_url = href if href.startswith("http") else BASE_URL + href

                        id_match = re.search(r"/(\d+)-", href)
                        raw_id = id_match.group(1) if id_match else href.split("/")[-1]
                        external_id = self.build_external_id("ebay", raw_id)

                        title_el = await item.query_selector("h2.text-module-begin, h2")
                        title = (await title_el.inner_text()).strip() if title_el else f"Wohnung in {city}"

                        price_el = await item.query_selector(
                            "p.aditem-main--middle--price-shipping--price"
                        )
                        price_text = (await price_el.inner_text()).strip() if price_el else ""
                        price = self.parse_price(price_text)

                        desc_el = await item.query_selector("p.aditem-main--middle--description")
                        description = (await desc_el.inner_text()).strip() if desc_el else ""

                        sqm = self.parse_sqm(title + " " + description)

                        location_el = await item.query_selector("div.aditem-main--top--left")
                        item_city = city
                        if location_el:
                            loc_text = (await location_el.inner_text()).strip()
                            item_city = loc_text.split("\n")[0].strip() or city

                        img_el = await item.query_selector("img.imagebox-thumbnail")
                        image_url = await img_el.get_attribute("src") if img_el else None

                        combined_text = f"{title} {description}"
                        if not self.matches_keywords(combined_text, f.keywords):
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
                                city=item_city,
                                description=description[:500] if description else None,
                                image_url=image_url,
                                listing_url=listing_url,
                                condition="renovierungsbedürftig",
                            )
                        )
                    except Exception as e:
                        logger.warning(f"[eBay] [{city}] Item parse error: {e}")
            except Exception as e:
                logger.error(f"[eBay] [{city}] Scrape error: {e}")
            finally:
                await browser.close()
        return listings
