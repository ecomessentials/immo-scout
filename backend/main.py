import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import get_config, update_config, get_listings, get_stats, get_scan_logs, get_db
from telegram_bot import send_startup_message, send_test_message
from scheduler import run_all_scrapers
from models import SearchFilter, ListingResponse
from log_stream import SSELogHandler, log_event_stream

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Attach the SSE handler to the root logger so every log record is captured.
_sse_handler = SSELogHandler()
_sse_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s – %(message)s"))
logging.getLogger().addHandler(_sse_handler)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sync config defaults to Supabase so DB and code always stay consistent.
    try:
        from config import DEFAULT_FILTER
        get_db().table("search_config").update({
            "scan_interval": DEFAULT_FILTER["scan_interval"],
            "cities": DEFAULT_FILTER["cities"],
            "min_sqm": DEFAULT_FILTER["min_sqm"],
            "max_sqm": DEFAULT_FILTER["max_sqm"],
            "min_rooms": DEFAULT_FILTER.get("min_rooms", 3),
            "max_rooms": DEFAULT_FILTER.get("max_rooms", 4),
            "default_radius": DEFAULT_FILTER.get("default_radius", 15),
            "city_radius": DEFAULT_FILTER.get("city_radius", {}),
        }).neq("id", "").execute()
        logger.info(
            f"search_config synced: {len(DEFAULT_FILTER['cities'])} Städte, "
            f"interval={DEFAULT_FILTER['scan_interval']}min, "
            f"radius default={DEFAULT_FILTER.get('default_radius')}km, "
            f"overrides={list(DEFAULT_FILTER.get('city_radius', {}).keys())}"
        )
    except Exception as e:
        logger.warning(f"Could not sync search_config to Supabase: {e}")

    try:
        scheduler.add_job(
            run_all_scrapers,
            "interval",
            hours=3,
            id="scrape_job",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("Scheduler started, interval: 3 hours")
    except Exception as e:
        logger.error(f"Scheduler failed to start: {e}")

    await send_startup_message()
    yield
    scheduler.shutdown()
    logger.info("Scheduler stopped")


app = FastAPI(title="Immo Scout API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "scheduler_running": scheduler.running}


@app.get("/api/listings", response_model=list[ListingResponse])
async def api_listings(
    min_price: Optional[int] = Query(None),
    max_price: Optional[int] = Query(None),
    min_sqm: Optional[float] = Query(None),
    max_sqm: Optional[float] = Query(None),
    min_rooms: Optional[float] = Query(None),
    max_rooms: Optional[float] = Query(None),
    city: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await get_listings(
        min_price=min_price,
        max_price=max_price,
        min_sqm=min_sqm,
        max_sqm=max_sqm,
        min_rooms=min_rooms,
        max_rooms=max_rooms,
        city=city,
        source=source,
        limit=limit,
        offset=offset,
    )


@app.get("/api/listings/{listing_id}", response_model=ListingResponse)
async def api_listing_detail(listing_id: str):
    from database import get_db
    try:
        db = get_db()
        result = db.table("listings").select("*").eq("id", listing_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        return ListingResponse(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def api_stats():
    return await get_stats()


@app.get("/api/scan-logs")
async def api_scan_logs():
    return await get_scan_logs(limit=10)


@app.post("/api/trigger-scan")
async def api_trigger_scan(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_all_scrapers)
    return {"status": "scan started"}


@app.get("/api/config", response_model=SearchFilter)
async def api_get_config():
    return await get_config()


@app.put("/api/config", response_model=SearchFilter)
async def api_update_config(f: SearchFilter):
    updated = await update_config(f)
    if scheduler.running:
        scheduler.reschedule_job("scrape_job", trigger="interval", hours=3)
        logger.info("Rescheduled job to 3 hours interval")
    return updated


@app.get("/api/telegram/test")
async def api_telegram_test():
    success = await send_test_message()
    if success:
        return {"status": "ok", "message": "Test message sent"}
    raise HTTPException(status_code=500, detail="Failed to send Telegram message – check credentials")


@app.get("/api/scan/stream")
async def api_scan_stream():
    """SSE endpoint: starts a scan and streams user-friendly progress events."""
    queue: asyncio.Queue = asyncio.Queue()

    async def event_stream():
        task = asyncio.create_task(run_all_scrapers(progress_queue=queue))
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=600.0)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                    if event.get("status") == "done":
                        break
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'status': 'done', 'message': ''})}\n\n"
                    break
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/logs/stream")
async def api_logs_stream():
    return StreamingResponse(
        log_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
