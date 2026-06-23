import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import get_config, update_config, get_listings, get_stats, get_scan_logs, get_send_queue, update_listing_contact_status
from contact_templates import rotated_contact_template
from telegram_bot import configure_webhook, handle_telegram_update, send_startup_message, send_test_message
from scheduler import run_all_scrapers
from models import ContactUpdate, SearchFilter, ListingResponse
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
        await update_config(SearchFilter(**DEFAULT_FILTER))
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
            hours=1,
            id="scrape_job",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=1800,
            next_run_time=datetime.now(timezone.utc),
        )
        scheduler.start()
        logger.info("Scheduler started, interval: 1 hour")
    except Exception as e:
        logger.error(f"Scheduler failed to start: {e}")

    await configure_webhook()
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


@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Immo Scout API</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #0f172a;
            color: #e5e7eb;
          }
          main {
            width: min(720px, calc(100vw - 32px));
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 28px;
            background: #111827;
            box-shadow: 0 20px 70px rgba(0, 0, 0, 0.35);
          }
          h1 { margin: 0 0 10px; font-size: 28px; }
          p { margin: 0 0 20px; color: #94a3b8; line-height: 1.6; }
          .status {
            display: inline-flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 18px;
            color: #86efac;
            font-weight: 700;
          }
          .dot {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: #22c55e;
          }
          nav { display: flex; flex-wrap: wrap; gap: 10px; }
          a {
            color: #bfdbfe;
            text-decoration: none;
            border: 1px solid #334155;
            border-radius: 10px;
            padding: 10px 12px;
            background: #1f2937;
          }
          a:hover { border-color: #60a5fa; color: white; }
        </style>
      </head>
      <body>
        <main>
          <div class="status"><span class="dot"></span> Backend läuft</div>
          <h1>Immo Scout API</h1>
          <p>
            Das ist die Backend-URL für Automatisierung, Scraper und Telegram.
            Die Website läuft separat über das Frontend.
          </p>
          <nav>
            <a href="/health">Health Check</a>
            <a href="/docs">API Docs</a>
            <a href="/api/stats">Statistiken</a>
            <a href="/api/config">Konfiguration</a>
          </nav>
        </main>
      </body>
    </html>
    """


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
    limit: int = Query(50, ge=1, le=1000),
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


@app.patch("/api/listings/{listing_id}/contact", response_model=ListingResponse)
async def api_update_listing_contact(listing_id: str, payload: ContactUpdate):
    try:
        updated = await update_listing_contact_status(listing_id, payload.status)
        if not updated:
            raise HTTPException(status_code=404, detail="Listing not found")
        return updated
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/automation/send-queue")
async def api_automation_send_queue(limit: int = Query(10, ge=1, le=50)):
    listings = await get_send_queue(limit=limit)
    return [
        {
            **listing.model_dump(mode="json"),
            "message": rotated_contact_template(listing),
        }
        for listing in listings
    ]


@app.post("/api/automation/listings/{listing_id}/status", response_model=ListingResponse)
async def api_automation_update_status(listing_id: str, payload: ContactUpdate):
    try:
        updated = await update_listing_contact_status(listing_id, payload.status)
        if not updated:
            raise HTTPException(status_code=404, detail="Listing not found")
        return updated
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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
        scheduler.reschedule_job("scrape_job", trigger="interval", hours=1)
        logger.info("Rescheduled job to 1 hour interval")
    return updated


@app.get("/api/telegram/test")
async def api_telegram_test():
    success = await send_test_message()
    if success:
        return {"status": "ok", "message": "Test message sent"}
    raise HTTPException(status_code=500, detail="Failed to send Telegram message – check credentials")


@app.post("/api/telegram/webhook")
async def api_telegram_webhook(request: Request):
    payload = await request.json()
    try:
        return await handle_telegram_update(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/telegram/set-webhook")
async def api_telegram_set_webhook():
    success = await configure_webhook()
    if success:
        return {"status": "ok"}
    raise HTTPException(status_code=500, detail="Webhook konnte nicht gesetzt werden. BACKEND_PUBLIC_URL prüfen.")


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
