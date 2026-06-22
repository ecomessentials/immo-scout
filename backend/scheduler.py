import asyncio
import logging
from datetime import datetime, timezone
from database import get_config, is_database_configured, save_listing, save_scan_log
from telegram_bot import is_telegram_configured, send_listing_notification, send_error_alert
from models import ScanResult
from scrapers import EbayScraper, ImmoScout24Scraper, ImmoweltScraper

logger = logging.getLogger(__name__)
_scan_lock = asyncio.Lock()
_SCRAPER_TIMEOUT_SECONDS = 180

_LABELS: dict[str, str] = {
    "ebay": "eBay Kleinanzeigen",
    "immowelt": "Immowelt",
    "immoscout24": "ImmoScout24",
}


def _wohnungen(n: int) -> str:
    return "1 Wohnung" if n == 1 else f"{n} Wohnungen"


async def _emit(queue: asyncio.Queue | None, status: str, message: str) -> None:
    if queue is not None:
        await queue.put({"status": status, "message": message})


async def run_all_scrapers(progress_queue: asyncio.Queue | None = None) -> None:
    if _scan_lock.locked():
        logger.warning("Scan skipped because another scan is already running")
        await _emit(progress_queue, "error", "Scan läuft bereits – dieser Lauf wird übersprungen.")
        await _emit(progress_queue, "done", "")
        return

    async with _scan_lock:
        await _run_all_scrapers_locked(progress_queue)


async def _run_all_scrapers_locked(progress_queue: asyncio.Queue | None = None) -> None:
    start = datetime.now(timezone.utc)
    logger.info("=== Starting scrape cycle ===")
    await _emit(progress_queue, "ok", "Scan gestartet")

    db_ready = is_database_configured()
    telegram_ready = is_telegram_configured()
    if not db_ready:
        msg = "Supabase fehlt – Treffer können nicht gespeichert und nicht als neu erkannt werden."
        logger.error(msg)
        await _emit(progress_queue, "error", msg)
    if not telegram_ready:
        msg = "Telegram fehlt – Benachrichtigungen können nicht gesendet werden."
        logger.error(msg)
        await _emit(progress_queue, "error", msg)

    config = await get_config()

    if not config.active:
        logger.info("Scanning is disabled, skipping.")
        await _emit(progress_queue, "error", "Scan ist deaktiviert – bitte in den Einstellungen aktivieren.")
        await _emit(progress_queue, "done", "")
        return

    scrapers = [EbayScraper(), ImmoweltScraper(), ImmoScout24Scraper()]
    all_listings = []
    errors = []
    # Track found count per scraper for the summary log
    scraper_found: dict[str, int] = {s.name: 0 for s in scrapers}

    for scraper in scrapers:
        label = _LABELS.get(scraper.name, scraper.name)
        for city in config.cities:
            radius = config.city_radius.get(city, config.default_radius)
            radius_str = f" ({radius}km Umkreis)" if radius > 0 else ""
            await _emit(progress_queue, "info", f"Durchsuche {label} – {city}{radius_str}...")
            try:
                results = await asyncio.wait_for(
                    scraper.scrape(city, config),
                    timeout=_SCRAPER_TIMEOUT_SECONDS,
                )
                all_listings.extend(results)
                scraper_found[scraper.name] += len(results)
                n = len(results)
                if n > 0:
                    await _emit(progress_queue, "ok", f"{label} {city}: {_wohnungen(n)} gefunden")
                else:
                    await _emit(progress_queue, "error", f"{label} {city}: keine Treffer")
                logger.info(f"[{scraper.name}] {city}: {n} found")
                await asyncio.sleep(1)
            except asyncio.TimeoutError:
                err = {
                    "scraper": scraper.name,
                    "city": city,
                    "error": f"Timeout nach {_SCRAPER_TIMEOUT_SECONDS}s",
                }
                errors.append(err)
                logger.error(f"[{scraper.name}] {city} timeout after {_SCRAPER_TIMEOUT_SECONDS}s")
                await _emit(progress_queue, "error", f"{label} {city}: Timeout beim Abrufen")
                await send_error_alert(scraper.name, err["error"])
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
    skipped_count = 0
    save_error_count = 0
    telegram_sent = 0
    # Per-scraper DB stats
    scraper_new: dict[str, int] = {s.name: 0 for s in scrapers}
    scraper_dup: dict[str, int] = {s.name: 0 for s in scrapers}
    scraper_skipped: dict[str, int] = {s.name: 0 for s in scrapers}
    scraper_save_errors: dict[str, int] = {s.name: 0 for s in scrapers}

    for listing in unique:
        save_result = await save_listing(listing)
        if save_result == "new":
            new_count += 1
            scraper_new[listing.source] = scraper_new.get(listing.source, 0) + 1
            await send_listing_notification(listing)
            telegram_sent += 1
        elif save_result == "duplicate":
            duplicate_count += 1
            scraper_dup[listing.source] = scraper_dup.get(listing.source, 0) + 1
        elif save_result == "skipped":
            skipped_count += 1
            scraper_skipped[listing.source] = scraper_skipped.get(listing.source, 0) + 1
        else:
            save_error_count += 1
            scraper_save_errors[listing.source] = scraper_save_errors.get(listing.source, 0) + 1

    logger.info(
        f"Gespeichert: {new_count} neu, {duplicate_count} bereits in DB, "
        f"{skipped_count} außerhalb Zielorte, {save_error_count} Speicherfehler"
    )
    for scraper in scrapers:
        label = _LABELS.get(scraper.name, scraper.name)
        logger.info(
            f"[GESAMT] {label}: {scraper_found[scraper.name]} gefunden, "
            f"{scraper_new.get(scraper.name, 0)} neu gespeichert, "
            f"{scraper_dup.get(scraper.name, 0)} Duplikate, "
            f"{scraper_skipped.get(scraper.name, 0)} außerhalb Zielorte, "
            f"{scraper_save_errors.get(scraper.name, 0)} Speicherfehler"
        )

    if new_count > 0:
        await _emit(progress_queue, "ok", f"{_wohnungen(new_count)} neu gespeichert")
    if skipped_count > 0:
        await _emit(progress_queue, "info", f"{_wohnungen(skipped_count)} außerhalb der Zielorte übersprungen")
    if save_error_count > 0:
        await _emit(progress_queue, "error", f"{_wohnungen(save_error_count)} konnten nicht gespeichert werden")
    if telegram_sent > 0:
        await _emit(progress_queue, "ok", f"Telegram-Benachrichtigung{'en' if telegram_sent > 1 else ''} gesendet")
    elif new_count > 0 and not telegram_ready:
        await _emit(progress_queue, "error", "Neue Treffer vorhanden, aber Telegram ist nicht konfiguriert.")

    if save_error_count > 0:
        abschluss = f"Scan abgeschlossen – {save_error_count} Speicherfehler, bitte Supabase prüfen"
    elif new_count > 0:
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
