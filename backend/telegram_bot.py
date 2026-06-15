import asyncio
import logging
from telegram import Bot
from telegram.error import TelegramError
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from models import Listing

logger = logging.getLogger(__name__)

_consecutive_errors = 0
_error_threshold = 3


def _get_bot() -> Bot | None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram credentials not configured")
        return None
    return Bot(token=TELEGRAM_BOT_TOKEN)


def _format_listing_message(listing: Listing) -> str:
    price_per_sqm = None
    if listing.price and listing.sqm and listing.sqm > 0:
        price_per_sqm = round(listing.price / listing.sqm)

    price_str = f"{listing.price:,}".replace(",", ".") + " €" if listing.price else "k.A."
    sqm_str = f"{listing.sqm} m²" if listing.sqm else "k.A."
    ppm_str = f"{int(price_per_sqm):,}".replace(",", ".") + " €" if price_per_sqm else "k.A."
    rooms_line = f"🚪 Zimmer: {listing.rooms}\n" if listing.rooms is not None else ""

    return (
        f"🏠 *Neue Wohnung gefunden!*\n\n"
        f"📍 *{listing.title}*\n"
        f"🏙️ Stadt: {listing.city}\n"
        f"💰 Preis: {price_str}\n"
        f"📐 Größe: {sqm_str}\n"
        f"{rooms_line}"
        f"💡 €/m²: {ppm_str}\n"
        f"🌐 Quelle: {listing.source}\n\n"
        f"🔗 [Zum Inserat]({listing.listing_url})"
    )


async def send_listing_notification(listing: Listing) -> None:
    bot = _get_bot()
    if not bot:
        return

    message = _format_listing_message(listing)
    await asyncio.sleep(0.5)

    if listing.image_url:
        try:
            await bot.send_photo(
                chat_id=TELEGRAM_CHAT_ID,
                photo=listing.image_url,
                caption=message,
                parse_mode="Markdown",
            )
            return
        except TelegramError as e:
            logger.warning(f"send_photo failed for {listing.external_id}: {e}, falling back to text")

    try:
        await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=message,
            parse_mode="Markdown",
            disable_web_page_preview=False,
        )
    except TelegramError as e:
        logger.error(f"send_message failed for {listing.external_id}: {e}")


async def send_startup_message() -> None:
    bot = _get_bot()
    if not bot:
        return
    text = "🏠 ImmobilienKrieger gestartet! Nächster Scan in 3 Stunden."
    try:
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=text)
    except TelegramError as e:
        logger.error(f"send_startup_message failed: {e}")


async def send_error_alert(scraper: str, error: str) -> None:
    global _consecutive_errors
    _consecutive_errors += 1

    if _consecutive_errors < _error_threshold:
        return

    bot = _get_bot()
    if not bot:
        return

    text = f"⚠️ Scraper-Fehler: {scraper}\n❌ {error}"
    try:
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=text)
        _consecutive_errors = 0
    except TelegramError as e:
        logger.error(f"send_error_alert failed: {e}")


async def send_test_message() -> bool:
    bot = _get_bot()
    if not bot:
        return False
    try:
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text="✅ Immo Scout – Test-Nachricht erfolgreich!")
        return True
    except TelegramError as e:
        logger.error(f"send_test_message failed: {e}")
        return False
