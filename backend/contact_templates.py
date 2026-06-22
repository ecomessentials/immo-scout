import zlib
from models import Listing


def _city_from_listing(listing: Listing) -> str:
    return listing.city or "Ihrer Stadt"


def contact_templates(listing: Listing) -> list[str]:
    city = _city_from_listing(listing)
    return [
        (
            f"Hallo,\n"
            f"ich interessiere mich für Ihre Wohnung in {city}.\n"
            f"Ich würde sie gerne langfristig anmieten und vorab offen fragen, ob eine möblierte Untervermietung bzw. Nutzung als Ferienwohnung/Airbnb nach Absprache mit Ihnen grundsätzlich denkbar wäre.\n"
            f"Uns ist wichtig, dass Sie mit einem zuverlässigen und finanziell starken Mieter planen können. Wenn das Objekt grundsätzlich passt, sind wir auch bereit, für eine saubere, langfristige Lösung mehr zu zahlen als andere Interessenten.\n"
            f"Falls ja, freue ich mich über eine kurze Rückmeldung und würde gern einen Besichtigungstermin vereinbaren.\n"
            f"Viele Grüße\n"
            f"Fabio Krieger"
        ),
        (
            f"Hallo,\n"
            f"ich interessiere mich für Ihre Wohnung in {city}.\n"
            f"Ich würde sie gerne langfristig anmieten und vorab offen fragen, ob eine möblierte Untervermietung bzw. Nutzung als Ferienwohnung/Airbnb nach Absprache mit Ihnen grundsätzlich denkbar wäre.\n"
            f"Falls ja, freue ich mich über eine kurze Rückmeldung und würde gern einen Besichtigungstermin vereinbaren.\n"
            f"Viele Grüße\n"
            f"Fabio Krieger"
        ),
        (
            f"Hallo,\n"
            f"ich interessiere mich für Ihre Wohnung in {city}.\n"
            f"Ich würde sie gerne langfristig anmieten und vorab offen fragen, ob eine möblierte Untervermietung bzw. Nutzung als Ferienwohnung/Airbnb nach Absprache mit Ihnen grundsätzlich denkbar wäre.\n"
            f"Für Sie hätte das klare Vorteile: kein Leerstand, pünktliche Mietzahlungen, wenig Aufwand und eine professionelle Verwaltung der Wohnung. Unser Ziel ist eine einfache, stabile Lösung, bei der Sie dauerhaft planbare Mieteinnahmen haben.\n"
            f"Falls ja, freue ich mich über eine kurze Rückmeldung und würde gern einen Besichtigungstermin vereinbaren.\n"
            f"Viele Grüße\n"
            f"Fabio Krieger"
        ),
    ]


def rotated_contact_template(listing: Listing) -> str:
    key = listing.external_id or listing.listing_url or listing.title
    index = zlib.crc32(key.encode("utf-8")) % 3
    return contact_templates(listing)[index]
