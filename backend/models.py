from datetime import datetime
from typing import Optional
from pydantic import BaseModel, computed_field


class Listing(BaseModel):
    external_id: str
    source: str
    title: str
    price: Optional[int] = None
    sqm: Optional[float] = None
    rooms: Optional[float] = None
    city: str
    address: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    listing_url: str
    condition: Optional[str] = None
    notified: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ListingResponse(Listing):
    id: Optional[str] = None

    @computed_field
    @property
    def price_per_sqm(self) -> Optional[float]:
        if self.price and self.sqm and self.sqm > 0:
            return round(self.price / self.sqm, 0)
        return None


class SearchFilter(BaseModel):
    max_price: int = 1500
    min_sqm: int = 25
    max_sqm: int = 140
    min_rooms: Optional[float] = 1.0
    max_rooms: Optional[float] = 5.0
    cities: list[str] = [
        "Winterberg", "Willingen", "Schmallenberg", "Bad Berleburg", "Medebach", "Olsberg",
        "Brilon", "Hallenberg", "Eslohe", "Marsberg", "Sundern", "Arnsberg", "Meschede",
        "Bestwig", "Diemelsee", "Bad Driburg", "Bad Pyrmont", "Horn-Bad Meinberg", "Detmold",
        "Lemgo", "Bad Salzuflen", "Höxter", "Steinheim", "Schieder-Schwalenberg", "Blomberg",
        "Augustdorf", "Bad Lippspringe", "Bodenwerder", "Hameln", "Möhnesee",
    ]
    # default_radius: km Umkreis für alle Städte; city_radius überschreibt pro Stadt
    default_radius: int = 0
    city_radius: dict[str, int] = {}
    keywords: list[str] = []
    active: bool = True
    scan_interval: int = 180


class ScanResult(BaseModel):
    started_at: datetime
    finished_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    total_found: int = 0
    new_listings: int = 0
    errors: list[dict] = []
    sources_scanned: list[str] = []


class FilterParams(BaseModel):
    min_price: Optional[int] = None
    max_price: Optional[int] = None
    min_sqm: Optional[float] = None
    max_sqm: Optional[float] = None
    city: Optional[str] = None
    source: Optional[str] = None
    limit: int = 50
    offset: int = 0
