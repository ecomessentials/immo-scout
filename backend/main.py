import logging
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import get_config, update_config, get_listings, get_stats, get_scan_logs
from telegram_bot import send_startup_message, send_test_message
from scheduler import run_all_scrapers
from models import SearchFilter, ListingResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = await get_config()
    scheduler.add_job(
        run_all_scrapers,
        "interval",
        minutes=config.scan_interval,
        id="scrape_job",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started, interval: {config.scan_interval} min")
    await send_startup_message(
        interval=config.scan_interval,
        cities=config.cities,
        max_price=config.max_price,
        min_sqm=config.min_sqm,
        max_sqm=config.max_sqm,
    )
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
        scheduler.reschedule_job("scrape_job", trigger="interval", minutes=f.scan_interval)
        logger.info(f"Rescheduled job to {f.scan_interval} min interval")
    return updated


@app.get("/api/telegram/test")
async def api_telegram_test():
    success = await send_test_message()
    if success:
        return {"status": "ok", "message": "Test message sent"}
    raise HTTPException(status_code=500, detail="Failed to send Telegram message – check credentials")
