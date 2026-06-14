import asyncio
import logging
from datetime import datetime, timezone
from database import get_config, save_listing, save_scan_log
from telegram_bot import send_listing_notification, send_error_alert
from models import ScanResult
from scrapers import ImmoScout24Scraper, EbayScraper, ImmoweltScraper, ImmonetScraper

logger = logging.getLogger(__name__)


async def run_all_scrapers() -> None:
    start = datetime.now(timezone.utc)
    logger.info("=== Starting scrape cycle ===")

    config = await get_config()

    if not config.active:
        logger.info("Scanning is disabled, skipping.")
        return

    scrapers = [ImmoScout24Scraper(), EbayScraper(), ImmoweltScraper(), ImmonetScraper()]
    all_listings = []
    errors = []

    for scraper in scrapers:
        for city in config.cities:
            try:
                results = await scraper.scrape(city, config)
                all_listings.extend(results)
                logger.info(f"[{scraper.name}] {city}: {len(results)} found")
                await asyncio.sleep(1)
            except Exception as e:
                err = {"scraper": scraper.name, "city": city, "error": str(e)}
                errors.append(err)
                logger.error(f"[{scraper.name}] {city} error: {e}")
                await send_error_alert(scraper.name, str(e))

    seen: set[str] = set()
    unique = []
    for listing in all_listings:
        if listing.external_id not in seen:
            seen.add(listing.external_id)
            unique.append(listing)

    new_count = 0
    for listing in unique:
        is_new = await save_listing(listing)
        if is_new:
            new_count += 1
            await send_listing_notification(listing)

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
