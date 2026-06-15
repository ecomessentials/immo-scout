import logging
from datetime import datetime, timezone
from typing import Optional
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, DEFAULT_FILTER
from models import Listing, ListingResponse, SearchFilter, ScanResult

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def get_db() -> Client:
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


async def save_listing(listing: Listing) -> bool:
    try:
        db = get_db()
        if await listing_exists(listing.external_id):
            return False
        data = listing.model_dump(exclude={"created_at", "notified"})
        data["notified"] = False
        db.table("listings").insert(data).execute()
        logger.info(f"Saved new listing: {listing.external_id}")
        return True
    except Exception as e:
        logger.error(f"save_listing error for {listing.external_id}: {e}")
        return False


async def mark_notified(external_id: str) -> None:
    try:
        db = get_db()
        db.table("listings").update({"notified": True}).eq("external_id", external_id).execute()
    except Exception as e:
        logger.error(f"mark_notified error: {e}")


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
    try:
        db = get_db()
        query = db.table("listings").select("*").order("created_at", desc=True)

        if min_price is not None:
            query = query.gte("price", min_price)
        if max_price is not None:
            query = query.lte("price", max_price)
        if min_sqm is not None:
            query = query.gte("sqm", min_sqm)
        if max_sqm is not None:
            query = query.lte("sqm", max_sqm)
        if min_rooms is not None:
            query = query.gte("rooms", min_rooms)
        if max_rooms is not None:
            query = query.lte("rooms", max_rooms)
        if city:
            query = query.ilike("city", f"%{city}%")
        if source:
            query = query.eq("source", source)

        query = query.range(offset, offset + limit - 1)
        result = query.execute()
        return [ListingResponse(**row) for row in result.data]
    except Exception as e:
        logger.error(f"get_listings error: {e}")
        return []


async def get_stats() -> dict:
    try:
        db = get_db()
        total_result = db.table("listings").select("id", count="exact").execute()
        total = total_result.count or 0

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_result = db.table("listings").select("id", count="exact").gte("created_at", today_start).execute()
        today = today_result.count or 0

        sources_result = db.table("listings").select("source").execute()
        by_source: dict[str, int] = {}
        for row in sources_result.data:
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
        # Only persist fields that exist as columns in the search_config table.
        data = f.model_dump(exclude={"min_rooms", "max_rooms", "default_radius", "city_radius"})
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
