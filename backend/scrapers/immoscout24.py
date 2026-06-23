import base64
import hashlib
import hmac
import logging
import time
import uuid
from urllib.parse import quote

import httpx

from config import IMMO_SCOUT24_BASE_URL, IMMO_SCOUT24_CONSUMER_KEY, IMMO_SCOUT24_CONSUMER_SECRET
from models import Listing, SearchFilter
from .base import BaseScraper

logger = logging.getLogger(__name__)

CITY_COORDINATES: dict[str, tuple[float, float]] = {
    "Winterberg": (51.1920, 8.5347),
    "Münster": (51.9607, 7.6261),
    "Bad Salzuflen": (52.0862, 8.7443),
    "Paderborn": (51.7189, 8.7575),
    "Detmold": (51.9363, 8.8792),
    "Hameln": (52.1030, 9.3567),
}


def _percent(value: str) -> str:
    return quote(str(value), safe="")


class ImmoScout24Scraper(BaseScraper):
    name = "immoscout24"

    def _is_configured(self) -> bool:
        return bool(IMMO_SCOUT24_CONSUMER_KEY and IMMO_SCOUT24_CONSUMER_SECRET)

    def _oauth_header(self, method: str, url: str, params: dict[str, str]) -> str:
        oauth_params = {
            "oauth_consumer_key": IMMO_SCOUT24_CONSUMER_KEY,
            "oauth_nonce": uuid.uuid4().hex,
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp": str(int(time.time())),
            "oauth_version": "1.0",
        }
        signature_params = {**params, **oauth_params}
        param_string = "&".join(
            f"{_percent(k)}={_percent(v)}"
            for k, v in sorted(signature_params.items())
        )
        base_string = "&".join([method.upper(), _percent(url), _percent(param_string)])
        signing_key = f"{_percent(IMMO_SCOUT24_CONSUMER_SECRET)}&"
        digest = hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).digest()
        oauth_params["oauth_signature"] = base64.b64encode(digest).decode()
        return "OAuth " + ", ".join(
            f'{_percent(k)}="{_percent(v)}"'
            for k, v in oauth_params.items()
        )

    def _result_entries(self, payload: dict) -> list[dict]:
        root = payload.get("resultlist.resultlist") or payload.get("resultlist") or payload
        entries = root.get("resultlistEntries", [])
        if isinstance(entries, dict):
            entries = [entries]
        result: list[dict] = []
        for group in entries:
            group_entries = group.get("resultlistEntry", [])
            if isinstance(group_entries, dict):
                group_entries = [group_entries]
            result.extend([entry for entry in group_entries if isinstance(entry, dict)])
        return result

    def _real_estate(self, entry: dict) -> dict:
        return (
            entry.get("resultlist.realEstate")
            or entry.get("realEstate")
            or entry.get("realestate")
            or {}
        )

    def _title(self, real_estate: dict, city: str) -> str:
        return (
            real_estate.get("title")
            or real_estate.get("externalId")
            or real_estate.get("address", {}).get("street")
            or f"Wohnung in {city}"
        )

    def _price(self, real_estate: dict) -> int | None:
        price = real_estate.get("price") or real_estate.get("calculatedPrice") or {}
        if isinstance(price, dict):
            value = price.get("value") or price.get("amount")
            return int(float(value)) if value is not None else None
        if price is not None:
            return int(float(price))
        return None

    def _sqm(self, real_estate: dict) -> float | None:
        value = real_estate.get("livingSpace") or real_estate.get("livingSpaceTotal")
        return float(value) if value is not None else None

    def _rooms(self, real_estate: dict) -> float | None:
        value = real_estate.get("numberOfRooms")
        return float(value) if value is not None else None

    def _image_url(self, real_estate: dict) -> str | None:
        attachments = real_estate.get("titlePicture") or real_estate.get("attachments") or []
        if isinstance(attachments, dict):
            urls = attachments.get("urls", [])
            if isinstance(urls, list) and urls:
                first = urls[0]
                if isinstance(first, dict):
                    return first.get("url")
            return attachments.get("url")
        return None

    async def scrape(self, city: str, f: SearchFilter) -> list[Listing]:
        if not self._is_configured():
            logger.info("[ImmoScout24] Credentials fehlen, Scraper übersprungen")
            return []
        if city not in CITY_COORDINATES:
            logger.info(f"[ImmoScout24] Keine Koordinaten für {city}, übersprungen")
            return []

        lat, lon = CITY_COORDINATES[city]
        radius = max(f.city_radius.get(city, f.default_radius), 1)
        url = f"{IMMO_SCOUT24_BASE_URL.rstrip('/')}/restapi/api/search/v1.0/search/radius"
        listings: list[Listing] = []
        seen_ids: set[str] = set()

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for page in range(1, 4):
                params = {
                    "realestatetype": "apartmentrent",
                    "geocoordinates": f"{lat};{lon};{radius}",
                    "price": f"-{f.max_price}",
                    "pricetype": "rentpermonth",
                    "pagenumber": str(page),
                    "pagesize": "20",
                }
                headers = {
                    "Accept": "application/json",
                    "Authorization": self._oauth_header("GET", url, params),
                }
                try:
                    response = await client.get(url, params=params, headers=headers)
                    logger.info(f"[ImmoScout24] [{city}] HTTP {response.status_code} Page {page}")
                    if response.status_code in {401, 403}:
                        logger.warning("[ImmoScout24] API-Key hat keine Berechtigung oder ist nicht freigeschaltet")
                        return listings
                    if response.status_code != 200:
                        logger.warning(f"[ImmoScout24] [{city}] Antwort: {response.text[:300]}")
                        return listings

                    entries = self._result_entries(response.json())
                    if not entries:
                        break

                    page_new = 0
                    for entry in entries:
                        raw_id = str(entry.get("@id") or entry.get("realEstateId") or "")
                        if not raw_id:
                            continue
                        external_id = self.build_external_id("is24", raw_id)
                        if external_id in seen_ids:
                            continue
                        seen_ids.add(external_id)

                        real_estate = self._real_estate(entry)
                        title = self._title(real_estate, city)
                        if self.is_wanted_ad(title):
                            continue

                        price = self._price(real_estate)
                        sqm = self._sqm(real_estate)
                        rooms = self._rooms(real_estate)
                        if price is not None and price > f.max_price:
                            continue
                        if sqm and f.min_sqm is not None and sqm < f.min_sqm:
                            continue
                        if sqm and f.max_sqm is not None and sqm > f.max_sqm:
                            continue
                        if rooms is not None and f.min_rooms is not None and f.max_rooms is not None:
                            if rooms < f.min_rooms or rooms > f.max_rooms:
                                continue

                        listing_url = f"https://www.immobilienscout24.de/expose/{raw_id}"
                        listings.append(Listing(
                            external_id=external_id,
                            source=self.name,
                            title=title,
                            price=price,
                            sqm=sqm,
                            rooms=rooms,
                            city=city,
                            image_url=self._image_url(real_estate),
                            listing_url=listing_url,
                            condition=None,
                        ))
                        page_new += 1

                    logger.info(f"[ImmoScout24] [{city}] Page {page}: {page_new} neue Listings")
                    if page_new == 0:
                        break
                except Exception as e:
                    logger.warning(f"[ImmoScout24] [{city}] Fehler: {e}")
                    return listings

        logger.info(f"[ImmoScout24] [{city}] Gesamt: {len(listings)} Listings")
        return listings
