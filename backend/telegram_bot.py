import asyncio
import logging
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError
from config import BACKEND_PUBLIC_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS
from contact_templates import rotated_contact_template
from database import update_listing_contact_status_by_external_id
from models import Listing

logger = logging.getLogger(__name__)

_consecutive_errors = 0
_error_threshold = 3
_notification_batches: dict[str, list[Listing]] = {}
_BATCH_SIZE = 10


def _get_bot() -> Bot | None:
    if not is_telegram_configured():
        logger.warning("Telegram credentials not configured")
        return None
    return Bot(token=TELEGRAM_BOT_TOKEN)


def is_telegram_configured() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS)


def _format_listing_message(listing: Listing, message: str) -> str:
    price_per_sqm = None
    if listing.price and listing.sqm and listing.sqm > 0:
        price_per_sqm = round(listing.price / listing.sqm)

    price_str = f"{listing.price:,}".replace(",", ".") if listing.price else "k.A."
    sqm_str = f"{listing.sqm}" if listing.sqm else "k.A."
    ppm_str = f"{int(price_per_sqm):,}".replace(",", ".") + " €" if price_per_sqm else "k.A."
    rooms_line = f"🚪 Zimmer: {listing.rooms}\n" if listing.rooms is not None else ""

    return (
        f"🏠 NEUE WOHNUNG GEFUNDEN\n\n"
        f"Titel: {listing.title}\n"
        f"Preis: {price_str}€/Monat\n"
        f"Größe: {sqm_str}m²\n"
        f"Ort: {listing.city}\n"
        f"Link: {listing.listing_url}\n\n"
        f"📝 NACHRICHT ENTWURF:\n"
        f"{message}\n\n"
        f"Was möchtest du tun?\n\n"
        f"{rooms_line}"
        f"Quelle: {listing.source} · €/m²: {ppm_str}"
    )


def _listing_keyboard(listing: Listing) -> InlineKeyboardMarkup:
    external_id = listing.external_id
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🚀 Automatisch senden", callback_data=f"send|{external_id}"),
            InlineKeyboardButton("✏️ Bearbeiten", callback_data=f"edit|{external_id}"),
            InlineKeyboardButton("❌ Überspringen", callback_data=f"skip|{external_id}"),
        ],
        [
            InlineKeyboardButton("🔗 Inserat öffnen", url=listing.listing_url),
        ],
    ])


async def _send_listing_notification_to_chats(listing: Listing, chat_ids: list[str | int]) -> None:
    bot = _get_bot()
    if not bot:
        return

    contact_message = rotated_contact_template(listing)
    message = _format_listing_message(listing, contact_message)
    keyboard = _listing_keyboard(listing)
    await asyncio.sleep(0.5)

    for chat_id in chat_ids:
        if listing.image_url:
            try:
                await bot.send_photo(
                    chat_id=chat_id,
                    photo=listing.image_url,
                    caption=message,
                    reply_markup=keyboard,
                )
                continue
            except TelegramError as e:
                logger.warning(f"send_photo failed for {listing.external_id} to {chat_id}: {e}, falling back to text")

        try:
            await bot.send_message(
                chat_id=chat_id,
                text=message,
                disable_web_page_preview=False,
                reply_markup=keyboard,
            )
        except TelegramError as e:
            logger.error(f"send_message failed for {listing.external_id} to {chat_id}: {e}")


async def send_listing_notification(listing: Listing) -> None:
    await _send_listing_notification_to_chats(listing, TELEGRAM_CHAT_IDS)


async def _send_more_prompt(chat_ids: list[str | int], batch_id: str, next_offset: int, total: int) -> None:
    bot = _get_bot()
    if not bot:
        return

    remaining = max(total - next_offset, 0)
    if remaining <= 0:
        return

    next_count = min(_BATCH_SIZE, remaining)
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"📦 {next_count} weitere anzeigen", callback_data=f"more|{batch_id}|{next_offset}")],
    ])
    text = (
        f"📦 Es gibt noch {remaining} weitere neue Wohnungen aus diesem Scan.\n"
        f"Klicke auf den Button, dann schicke ich dir die nächsten {next_count}."
    )
    for chat_id in chat_ids:
        try:
            await bot.send_message(chat_id=chat_id, text=text, reply_markup=keyboard)
        except TelegramError as e:
            logger.error(f"send_more_prompt failed for {chat_id}: {e}")


async def send_listing_notifications_batch(listings: list[Listing], batch_id: str) -> int:
    if not listings:
        return 0

    _notification_batches[batch_id] = listings
    first_batch = listings[:_BATCH_SIZE]
    for listing in first_batch:
        await send_listing_notification(listing)

    await _send_more_prompt(TELEGRAM_CHAT_IDS, batch_id, len(first_batch), len(listings))
    return len(first_batch)


async def configure_webhook() -> bool:
    bot = _get_bot()
    if not bot or not BACKEND_PUBLIC_URL:
        return False
    webhook_url = f"{BACKEND_PUBLIC_URL.rstrip('/')}/api/telegram/webhook"
    try:
        await bot.set_webhook(webhook_url)
        logger.info(f"Telegram webhook configured: {webhook_url}")
        return True
    except TelegramError as e:
        logger.error(f"configure_webhook failed: {e}")
        return False


async def handle_telegram_update(update: dict) -> dict:
    bot = _get_bot()
    if not bot:
        return {"ok": False, "detail": "Telegram not configured"}

    callback = update.get("callback_query")
    if not callback:
        return {"ok": True, "ignored": True}

    query_id = callback.get("id")
    data = callback.get("data") or ""
    message = callback.get("message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")

    if "|" not in data:
        if query_id:
            await bot.answer_callback_query(query_id, text="Unbekannte Aktion")
        return {"ok": False, "detail": "Invalid callback data"}

    parts = data.split("|")
    action = parts[0]

    if action == "more":
        if len(parts) != 3:
            if query_id:
                await bot.answer_callback_query(query_id, text="Ungültiger Mehr-Button")
            return {"ok": False, "detail": "Invalid more callback data"}

        batch_id = parts[1]
        try:
            offset = int(parts[2])
        except ValueError:
            offset = 0

        batch = _notification_batches.get(batch_id, [])
        if not batch:
            if query_id:
                await bot.answer_callback_query(query_id, text="Dieser Scan ist nicht mehr im Speicher")
            if chat_id:
                await bot.send_message(chat_id=chat_id, text="Dieser Scan ist nicht mehr im Speicher. Bitte öffne die Webseite für die vollständige Liste.")
            return {"ok": False, "detail": "Batch not found"}

        next_items = batch[offset:offset + _BATCH_SIZE]
        if query_id:
            await bot.answer_callback_query(query_id, text=f"{len(next_items)} weitere Wohnungen")
        if chat_id:
            for listing in next_items:
                await _send_listing_notification_to_chats(listing, [chat_id])
            await _send_more_prompt([chat_id], batch_id, offset + len(next_items), len(batch))
        return {"ok": True, "action": action, "batch_id": batch_id, "offset": offset}

    if len(parts) != 2:
        if query_id:
            await bot.answer_callback_query(query_id, text="Unbekannte Aktion")
        return {"ok": False, "detail": "Invalid callback data"}

    external_id = parts[1]
    status_by_action = {
        "send": "send_requested",
        "skip": "skipped",
    }

    if action == "edit":
        if query_id:
            await bot.answer_callback_query(query_id, text="Entwurf ist in der Nachricht. Kopieren, anpassen, im Inserat senden.")
        if chat_id:
            await bot.send_message(
                chat_id=chat_id,
                text="✏️ Kopiere den Entwurf aus der Nachricht, passe ihn an und sende ihn im Inserat. Danach kannst du 🚀 Automatisch senden drücken oder manuell auf der Webseite als angeschrieben markieren.",
            )
        return {"ok": True, "action": action, "external_id": external_id}

    status = status_by_action.get(action)
    if not status:
        if query_id:
            await bot.answer_callback_query(query_id, text="Unbekannte Aktion")
        return {"ok": False, "detail": "Unknown action"}

    updated = await update_listing_contact_status_by_external_id(external_id, status)
    if query_id:
        label = "Sendeauftrag erstellt" if status == "send_requested" else "übersprungen"
        await bot.answer_callback_query(query_id, text=f"✅ {label}")

    if chat_id and updated:
        if status == "send_requested":
            await bot.send_message(chat_id=chat_id, text=f"🚀 Sendeauftrag erstellt: {updated.title}\nDer lokale Mac-Worker verschickt die Nachricht automatisch, sobald er läuft.")
        elif status == "skipped":
            await bot.send_message(chat_id=chat_id, text=f"⏭️ Übersprungen: {updated.title}")

    return {"ok": True, "action": action, "external_id": external_id, "status": status}


async def send_startup_message() -> None:
    bot = _get_bot()
    if not bot:
        return
    text = "🏠 ImmobilienKrieger gestartet! Nächster Scan in 1 Stunde."
    for chat_id in TELEGRAM_CHAT_IDS:
        try:
            await bot.send_message(chat_id=chat_id, text=text)
        except TelegramError as e:
            logger.error(f"send_startup_message failed for {chat_id}: {e}")


async def send_scan_started_message(cities: list[str], max_price: int, radius: int) -> None:
    bot = _get_bot()
    if not bot:
        return
    city_text = ", ".join(cities)
    text = (
        "🔎 Scan startet jetzt\n\n"
        f"Städte: {city_text}\n"
        f"Umkreis: {radius} km\n"
        f"Max. Kaltmiete: {max_price} €"
    )
    for chat_id in TELEGRAM_CHAT_IDS:
        try:
            await bot.send_message(chat_id=chat_id, text=text)
        except TelegramError as e:
            logger.error(f"send_scan_started_message failed for {chat_id}: {e}")


async def send_scan_summary_message(
    total_found: int,
    new_count: int,
    duplicate_count: int,
    skipped_count: int,
    error_count: int,
    by_source: dict[str, int],
) -> None:
    bot = _get_bot()
    if not bot:
        return

    source_lines = "\n".join(f"- {source}: {count}" for source, count in by_source.items())
    if not source_lines:
        source_lines = "- keine Treffer"
    text = (
        "✅ Scan abgeschlossen\n\n"
        f"Gefunden gesamt: {total_found}\n"
        f"Neu: {new_count}\n"
        f"Bereits bekannt: {duplicate_count}\n"
        f"Übersprungen: {skipped_count}\n"
        f"Fehler: {error_count}\n\n"
        f"Nach Portal:\n{source_lines}"
    )
    for chat_id in TELEGRAM_CHAT_IDS:
        try:
            await bot.send_message(chat_id=chat_id, text=text)
        except TelegramError as e:
            logger.error(f"send_scan_summary_message failed for {chat_id}: {e}")


async def send_error_alert(scraper: str, error: str) -> None:
    global _consecutive_errors
    _consecutive_errors += 1

    if _consecutive_errors < _error_threshold:
        return

    bot = _get_bot()
    if not bot:
        return

    text = f"⚠️ Scraper-Fehler: {scraper}\n❌ {error}"
    for chat_id in TELEGRAM_CHAT_IDS:
        try:
            await bot.send_message(chat_id=chat_id, text=text)
        except TelegramError as e:
            logger.error(f"send_error_alert failed for {chat_id}: {e}")
    _consecutive_errors = 0


async def send_test_message() -> bool:
    bot = _get_bot()
    if not bot:
        return False
    success = True
    for chat_id in TELEGRAM_CHAT_IDS:
        try:
            await bot.send_message(chat_id=chat_id, text="✅ Immo Scout – Test-Nachricht erfolgreich!")
        except TelegramError as e:
            logger.error(f"send_test_message failed for {chat_id}: {e}")
            success = False
    return success
