import asyncio
import logging
from datetime import datetime, timezone
from database import get_config, save_listing, save_scan_log
from telegram_bot import send_listing_notification, send_error_alert
from models import ScanResult
from scrapers import EbayScraper, ImmoweltScraper, ImmonetScraper

logger = logging.getLogger(__name__)

_LABELS: dict[str, str] = {
    "ebay": "eBay Kleinanzeigen",
    "immowelt": "Immowelt",
    "immonet": "Immonet",
}


def _wohnungen(n: int) -> str:
    return "1 Wohnung" if n == 1 else f"{n} Wohnungen"


async def _emit(queue: asyncio.Queue | None, status: str, message: str) -> None:
    if queue is not None:
        await queue.put({"status": status, "message": message})


async def run_all_scrapers(progress_queue: asyncio.Queue | None = None) -> None:
    start = datetime.now(timezone.utc)
    logger.info("=== Starting scrape cycle ===")
    await _emit(progress_queue, "ok", "Scan gestartet")

    config = await get_config()

    if not config.active:
        logger.info("Scanning is disabled, skipping.")
        await _emit(progress_queue, "error", "Scan ist deaktiviert – bitte in den Einstellungen aktivieren.")
        await _emit(progress_queue, "done", "")
        return

    scrapers = [EbayScraper(), ImmoweltScraper(), ImmonetScraper()]
    all_listings = []
    errors = []

    for scraper in scrapers:
        label = _LABELS.get(scraper.name, scraper.name)
        for city in config.cities:
            await _emit(progress_queue, "info", f"Durchsuche {label} – {city}...")
            try:
                results = await scraper.scrape(city, config)
                all_listings.extend(results)
                n = len(results)
                if n > 0:
                    await _emit(progress_queue, "ok", f"{label} {city}: {_wohnungen(n)} gefunden")
                else:
                    await _emit(progress_queue, "error", f"{label} {city}: keine Treffer")
                logger.info(f"[{scraper.name}] {city}: {n} found")
                await asyncio.sleep(1)
            except Exception as e:
                err = {"scraper": scraper.name, "city": city, "error": str(e)}
                errors.append(err)
                logger.error(f"[{scraper.name}] {city} error: {e}")
                await _emit(progress_queue, "error", f"{label} {city}: Fehler beim Abrufen")
                await send_error_alert(scraper.name, str(e))

    seen: set[str] = set()
    unique = []
    for listing in all_listings:
        if listing.external_id not in seen:
            seen.add(listing.external_id)
            unique.append(listing)

    logger.info(
        f"Scrape done: {len(all_listings)} gesamt, {len(unique)} dedupliziert "
        f"({len(all_listings) - len(unique)} Duplikate in dieser Session)"
    )

    new_count = 0
    duplicate_count = 0
    telegram_sent = 0
    for listing in unique:
        is_new = await save_listing(listing)
        if is_new:
            new_count += 1
            await send_listing_notification(listing)
            telegram_sent += 1
        else:
            duplicate_count += 1

    logger.info(f"Gespeichert: {new_count} neu, {duplicate_count} bereits in DB")

    if new_count > 0:
        await _emit(progress_queue, "ok", f"{_wohnungen(new_count)} neu gespeichert")
    if telegram_sent > 0:
        await _emit(progress_queue, "ok", f"Telegram-Benachrichtigung{'en' if telegram_sent > 1 else ''} gesendet")

    if new_count > 0:
        abschluss = f"Scan abgeschlossen – {_wohnungen(new_count)} neue Treffer"
    else:
        abschluss = "Scan abgeschlossen – keine neuen Treffer"
    await _emit(progress_queue, "ok", abschluss)
    await _emit(progress_queue, "done", "")

    finished = datetime.now(timezone.utc)
    duration_ms = int((finished - start).total_seconds() * 1000)

    scan_result = ScanResult(
        started_at=start,
        finished_at=finished,
        duration_ms=duration_ms,
        total_found=len(unique),
        new_listings=new_count,
        errors=errors,
        sources_scanned=[s.name for s in scrapers],
    )
    await save_scan_log(scan_result)
    logger.info(
        f"=== Scan done: {len(unique)} total, {new_count} new, {len(errors)} errors, {duration_ms}ms ==="
    )
