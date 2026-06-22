import logging
import re
from datetime import datetime, timezone
from typing import Literal, Optional
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, DEFAULT_FILTER, TARGET_CITIES
from models import Listing, ListingResponse, SearchFilter, ScanResult

logger = logging.getLogger(__name__)

_client: Optional[Client] = None
SaveListingResult = Literal["new", "duplicate", "skipped", "error"]


def _city_key(value: str) -> str:
    return (
        value.lower()
        .replace("ü", "ue")
        .replace("ö", "oe")
        .replace("ä", "ae")
        .replace("ß", "ss")
    )


_TARGET_CITY_KEYS = {_city_key(city) for city in TARGET_CITIES}


def _dedupe_key(row: dict) -> str:
    url = (row.get("listing_url") or "").split("?")[0].rstrip("/")
    if url:
        return f"url:{url.lower()}"
    title = re.sub(r"\s+", " ", (row.get("title") or "").lower()).strip()
    city = _city_key(row.get("city") or "")
    price = row.get("price") or ""
    sqm = row.get("sqm") or ""
    return f"fallback:{city}:{price}:{sqm}:{title[:80]}"


def dedupe_listing_rows(rows: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []
    for row in rows:
        key = _dedupe_key(row)
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def _price_within_limit(row: dict, max_price: Optional[int]) -> bool:
    if max_price is None or row.get("price") is None:
        return True
    try:
        return float(row["price"]) <= float(max_price)
    except (TypeError, ValueError):
        return True


def is_database_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


def is_target_city(value: Optional[str]) -> bool:
    if not value:
        return False
    city_key = _city_key(value)
    return any(target in city_key for target in _TARGET_CITY_KEYS)


def get_db() -> Client:
    if not is_database_configured():
        raise RuntimeError("Supabase ist nicht konfiguriert: SUPABASE_URL und SUPABASE_SERVICE_KEY fehlen")
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


async def listing_exists(external_id: str) -> bool:
    try:
        db = get_db()
        result = db.table("listings").select("external_id").eq("external_id", external_id).execute()
        return len(result.data) > 0
    except Exception as e:
        logger.error(f"listing_exists error: {e}")
        return False


async def similar_listing_exists(listing: Listing) -> bool:
    try:
        db = get_db()
        listing_url = listing.listing_url.split("?")[0].rstrip("/")
        if listing_url:
            result = db.table("listings").select("id").eq("listing_url", listing_url).limit(1).execute()
            if result.data:
                return True

        query = db.table("listings").select("id").eq("city", listing.city).eq("title", listing.title).limit(1)
        if listing.price is not None:
            query = query.eq("price", listing.price)
        if listing.sqm is not None:
            query = query.eq("sqm", listing.sqm)
        result = query.execute()
        return len(result.data) > 0
    except Exception as e:
        logger.error(f"similar_listing_exists error: {e}")
        return False


async def save_listing(listing: Listing) -> SaveListingResult:
    try:
        if not is_target_city(listing.city):
            logger.info(f"Skipped listing outside target cities: {listing.external_id} ({listing.city})")
            return "skipped"
        db = get_db()
        if await listing_exists(listing.external_id) or await similar_listing_exists(listing):
            return "duplicate"
        data = listing.model_dump(exclude={"created_at", "notified"})
        data["listing_url"] = data["listing_url"].split("?")[0].rstrip("/")
        data["notified"] = False
        db.table("listings").insert(data).execute()
        logger.info(f"Saved new listing: {listing.external_id}")
        return "new"
    except Exception as e:
        logger.error(f"save_listing error for {listing.external_id}: {e}")
        return "error"


async def mark_notified(external_id: str) -> None:
    try:
        db = get_db()
        db.table("listings").update({"notified": True}).eq("external_id", external_id).execute()
    except Exception as e:
        logger.error(f"mark_notified error: {e}")


async def update_listing_contact_status(listing_id: str, status: str) -> Optional[ListingResponse]:
    try:
        db = get_db()
        normalized = status.strip().lower()
        allowed = {"new", "contacted", "reply", "rejected", "interesting"}
        if normalized not in allowed:
            raise ValueError("Invalid contact status")

        data = {
            "notified": normalized != "new",
            "condition": None if normalized == "new" else normalized,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        result = db.table("listings").update(data).eq("id", listing_id).execute()
        if not result.data:
            return None
        return ListingResponse(**result.data[0])
    except Exception as e:
        logger.error(f"update_listing_contact_status error for {listing_id}: {e}")
        raise


async def get_listings(
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    min_sqm: Optional[float] = None,
    max_sqm: Optional[float] = None,
    min_rooms: Optional[float] = None,
    max_rooms: Optional[float] = None,
    city: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[ListingResponse]:
    def matches_optional_range(value, min_value, max_value) -> bool:
        if value is None:
            return True
        numeric_value = float(value)
        if min_value is not None and numeric_value < float(min_value):
            return False
        if max_value is not None and numeric_value > float(max_value):
            return False
        return True

    try:
        db = get_db()
        query = db.table("listings").select("*").order("created_at", desc=True)

        if min_price is not None:
            query = query.gte("price", min_price)
        if max_price is not None:
            query = query.lte("price", max_price)
        if city:
            query = query.ilike("city", f"%{city}%")
        if source:
            query = query.eq("source", source)

        query = query.limit(1000)
        result = query.execute()
        rows = result.data
        if not city:
            rows = [row for row in rows if is_target_city(row.get("city"))]
        rows = [
            row for row in rows
            if matches_optional_range(row.get("sqm"), min_sqm, max_sqm)
            and matches_optional_range(row.get("rooms"), min_rooms, max_rooms)
        ]
        rows = dedupe_listing_rows(rows)
        rows = rows[offset:offset + limit]
        return [ListingResponse(**row) for row in rows]
    except Exception as e:
        logger.error(f"get_listings error: {e}")
        return []


async def get_stats() -> dict:
    try:
        db = get_db()
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        config = await get_config()
        sources_result = db.table("listings").select("source,city,created_at,listing_url,title,price,sqm").execute()
        target_rows = dedupe_listing_rows([
            row for row in sources_result.data
            if is_target_city(row.get("city"))
            and _price_within_limit(row, config.max_price)
        ])
        total = len(target_rows)
        today = sum(1 for row in target_rows if (row.get("created_at") or "") >= today_start)
        by_source: dict[str, int] = {}
        for row in target_rows:
            s = row["source"]
            by_source[s] = by_source.get(s, 0) + 1

        last_scan_result = (
            db.table("scan_logs").select("finished_at").order("finished_at", desc=True).limit(1).execute()
        )
        last_scan_at = None
        if last_scan_result.data:
            last_scan_at = last_scan_result.data[0].get("finished_at")

        return {"total": total, "today": today, "by_source": by_source, "last_scan_at": last_scan_at}
    except Exception as e:
        logger.error(f"get_stats error: {e}")
        return {"total": 0, "today": 0, "by_source": {}, "last_scan_at": None}


async def get_config() -> SearchFilter:
    try:
        db = get_db()
        result = db.table("search_config").select("*").limit(1).execute()
        if result.data:
            row = result.data[0]
            return SearchFilter(
                max_price=row.get("max_price", DEFAULT_FILTER["max_price"]),
                min_sqm=row.get("min_sqm", DEFAULT_FILTER["min_sqm"]),
                max_sqm=row.get("max_sqm", DEFAULT_FILTER["max_sqm"]),
                min_rooms=row.get("min_rooms", DEFAULT_FILTER.get("min_rooms", 3)),
                max_rooms=row.get("max_rooms", DEFAULT_FILTER.get("max_rooms", 4)),
                default_radius=row.get("default_radius", DEFAULT_FILTER.get("default_radius", 15)),
                city_radius=row.get("city_radius") or DEFAULT_FILTER.get("city_radius", {}),
                cities=row.get("cities", DEFAULT_FILTER["cities"]),
                keywords=row.get("keywords", DEFAULT_FILTER["keywords"]),
                active=row.get("active", DEFAULT_FILTER["active"]),
                scan_interval=row.get("scan_interval", DEFAULT_FILTER["scan_interval"]),
            )
    except Exception as e:
        logger.warning(f"get_config DB error, using defaults: {e}")
    return SearchFilter(**DEFAULT_FILTER)


async def update_config(f: SearchFilter) -> SearchFilter:
    try:
        db = get_db()
        existing = db.table("search_config").select("id").limit(1).execute()
        data = f.model_dump()
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if existing.data:
            db.table("search_config").update(data).eq("id", existing.data[0]["id"]).execute()
        else:
            db.table("search_config").insert(data).execute()
        return f
    except Exception as e:
        logger.error(f"update_config error: {e}")
        return f


async def save_scan_log(result: ScanResult) -> None:
    try:
        db = get_db()
        data = {
            "started_at": result.started_at.isoformat(),
            "finished_at": result.finished_at.isoformat() if result.finished_at else None,
            "duration_ms": result.duration_ms,
            "total_found": result.total_found,
            "new_listings": result.new_listings,
            "errors": result.errors,
            "sources_scanned": result.sources_scanned,
        }
        db.table("scan_logs").insert(data).execute()
    except Exception as e:
        logger.error(f"save_scan_log error: {e}")


async def get_scan_logs(limit: int = 10) -> list[dict]:
    try:
        db = get_db()
        result = db.table("scan_logs").select("*").order("started_at", desc=True).limit(limit).execute()
        return result.data
    except Exception as e:
        logger.error(f"get_scan_logs error: {e}")
        return []
