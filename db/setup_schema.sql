-- Schema setup for TN Transport app
-- Run this first in Supabase SQL editor, then run seed SQL files.

-- Ensure extensions for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Places table: stores curated places/stations
CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ta text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  district text,
  place_type text,
  aliases text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

-- Transport routes: verified operator/route records
CREATE TABLE IF NOT EXISTS transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_place_id uuid REFERENCES places(id) ON DELETE SET NULL,
  destination_place_id uuid REFERENCES places(id) ON DELETE SET NULL,
  mode text NOT NULL,
  route_number text,
  route_name text,
  operator text,
  fare_base numeric,
  fare_per_km numeric,
  frequency_minutes integer,
  first_departure time,
  last_departure time,
  data_confidence text,
  source text,
  created_at timestamptz DEFAULT now()
);

-- Search history for logged-in users (optional)
CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  source_name text,
  source_lat double precision,
  source_lng double precision,
  destination_name text,
  destination_lat double precision,
  destination_lng double precision,
  search_mode text,
  language text,
  results_summary jsonb,
  created_at timestamptz DEFAULT now()
);

-- Analytics events (optional)
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes to speed lookups
CREATE INDEX IF NOT EXISTS idx_places_name ON places USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_places_aliases ON places USING gin (aliases);
CREATE INDEX IF NOT EXISTS idx_transport_origin_dest ON transport_routes (origin_place_id, destination_place_id);

-- End of schema setup
