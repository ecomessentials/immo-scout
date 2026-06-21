-- Tabelle: listings
CREATE TABLE IF NOT EXISTS listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT UNIQUE NOT NULL,
  source          TEXT NOT NULL,
  title           TEXT NOT NULL,
  price           INTEGER,
  sqm             NUMERIC(6,2),
  rooms           NUMERIC(4,1),
  city            TEXT NOT NULL,
  address         TEXT,
  description     TEXT,
  image_url       TEXT,
  listing_url     TEXT NOT NULL,
  condition       TEXT,
  notified        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_external_id ON listings(external_id);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);

-- Tabelle: scan_logs
CREATE TABLE IF NOT EXISTS scan_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER,
  total_found     INTEGER DEFAULT 0,
  new_listings    INTEGER DEFAULT 0,
  errors          JSONB DEFAULT '[]',
  sources_scanned TEXT[] DEFAULT '{}'
);

-- Tabelle: search_config (immer nur 1 Zeile)
CREATE TABLE IF NOT EXISTS search_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_price       INTEGER DEFAULT 1500,
  min_sqm         INTEGER DEFAULT 25,
  max_sqm         INTEGER DEFAULT 140,
  min_rooms       NUMERIC(4,1) DEFAULT 1,
  max_rooms       NUMERIC(4,1) DEFAULT 5,
  default_radius  INTEGER DEFAULT 0,
  city_radius     JSONB DEFAULT '{}'::jsonb,
  cities          TEXT[] DEFAULT '{"Winterberg","Willingen","Schmallenberg","Bad Berleburg","Medebach","Olsberg","Brilon","Hallenberg","Eslohe","Marsberg","Sundern","Arnsberg","Meschede","Bestwig","Diemelsee","Bad Driburg","Bad Pyrmont","Horn-Bad Meinberg","Detmold","Lemgo","Bad Salzuflen","Höxter","Steinheim","Schieder-Schwalenberg","Blomberg","Augustdorf","Bad Lippspringe","Bodenwerder","Hameln","Möhnesee"}',
  keywords        TEXT[] DEFAULT '{}',
  active          BOOLEAN DEFAULT TRUE,
  scan_interval   INTEGER DEFAULT 180,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO search_config DEFAULT VALUES
ON CONFLICT DO NOTHING;

-- Migration: neue Spalten zu bestehender Tabelle hinzufügen (idempotent)
ALTER TABLE search_config
  ADD COLUMN IF NOT EXISTS min_rooms      NUMERIC(4,1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_rooms      NUMERIC(4,1) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS default_radius INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS city_radius    JSONB DEFAULT '{}'::jsonb;

UPDATE search_config
SET
  max_price = 1500,
  min_sqm = 25,
  max_sqm = 140,
  min_rooms = 1,
  max_rooms = 5,
  default_radius = 0,
  city_radius = '{}'::jsonb,
  cities = '{"Winterberg","Willingen","Schmallenberg","Bad Berleburg","Medebach","Olsberg","Brilon","Hallenberg","Eslohe","Marsberg","Sundern","Arnsberg","Meschede","Bestwig","Diemelsee","Bad Driburg","Bad Pyrmont","Horn-Bad Meinberg","Detmold","Lemgo","Bad Salzuflen","Höxter","Steinheim","Schieder-Schwalenberg","Blomberg","Augustdorf","Bad Lippspringe","Bodenwerder","Hameln","Möhnesee"}',
  keywords = '{}',
  active = TRUE,
  scan_interval = 180,
  updated_at = NOW();
