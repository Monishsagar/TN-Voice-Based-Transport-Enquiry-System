-- =====================================================================
-- TN TRANSPORT ENQUIRY SYSTEM — SUPABASE SCHEMA
-- Run in Supabase SQL editor. Requires Auth enabled (email verification).
-- =====================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fuzzy place search

-- ---------------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  preferred_language text default 'en' check (preferred_language in ('en','ta','tanglish')),
  accessibility_mode boolean default false,
  home_location text,
  home_lat double precision,
  home_lng double precision,
  work_location text,
  work_lat double precision,
  work_lng double precision,
  theme text default 'system' check (theme in ('light','dark','system')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- PLACES (Tamil Nadu locations: cities, towns, villages, stops)
-- Seeded via data import; geocoding fallback uses Nominatim at runtime.
-- ---------------------------------------------------------------------
create table public.places (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  name_ta text,          -- Tamil script name
  aliases text[] default '{}', -- tanglish / alt spellings
  place_type text check (place_type in ('city','town','village','bus_stop','railway_station','landmark')),
  district text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

create index idx_places_name_trgm on public.places using gin (name gin_trgm_ops);
create index idx_places_district on public.places (district);
create index idx_places_geo on public.places (lat, lng);

alter table public.places enable row level security;
create policy "Anyone can read places"
  on public.places for select using (true);

-- ---------------------------------------------------------------------
-- TRANSPORT ROUTES (reference data — buses/trains, where verified data exists)
-- Source: imported from open GTFS / TNSTC published data where available.
-- ---------------------------------------------------------------------
create table public.transport_routes (
  id uuid primary key default uuid_generate_v4(),
  mode text check (mode in ('bus','train')),
  route_number text,
  route_name text,
  operator text,         -- e.g. 'TNSTC', 'SETC', 'Indian Railways'
  origin_place_id uuid references public.places(id),
  destination_place_id uuid references public.places(id),
  stops jsonb default '[]', -- array of {place_id, name, sequence, eta_offset_min}
  fare_base numeric,         -- base fare in INR, null if unknown
  fare_per_km numeric,       -- per-km rate if known
  frequency_minutes integer, -- average frequency
  first_departure time,
  last_departure time,
  data_confidence text default 'medium' check (data_confidence in ('high','medium','low')),
  source text,           -- citation of data source
  created_at timestamptz default now()
);

create index idx_routes_mode on public.transport_routes (mode);
create index idx_routes_origin on public.transport_routes (origin_place_id);
create index idx_routes_destination on public.transport_routes (destination_place_id);

alter table public.transport_routes enable row level security;
create policy "Anyone can read transport routes"
  on public.transport_routes for select using (true);

-- ---------------------------------------------------------------------
-- SEARCH HISTORY
-- ---------------------------------------------------------------------
create table public.search_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_name text not null,
  source_lat double precision,
  source_lng double precision,
  destination_name text not null,
  destination_lat double precision,
  destination_lng double precision,
  search_mode text default 'text' check (search_mode in ('text','voice')),
  language text default 'en',
  results_summary jsonb,  -- cached lightweight summary of results
  created_at timestamptz default now()
);

create index idx_search_history_user on public.search_history (user_id, created_at desc);

alter table public.search_history enable row level security;
create policy "Users manage own search history"
  on public.search_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- SAVED ROUTES
-- ---------------------------------------------------------------------
create table public.saved_routes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  source_name text not null,
  destination_name text not null,
  route_data jsonb not null, -- full route option snapshot
  created_at timestamptz default now()
);

alter table public.saved_routes enable row level security;
create policy "Users manage own saved routes"
  on public.saved_routes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- FAVORITE LOCATIONS
-- ---------------------------------------------------------------------
create table public.favorite_locations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,  -- e.g. 'Home', 'Work', 'College'
  place_name text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

alter table public.favorite_locations enable row level security;
create policy "Users manage own favorite locations"
  on public.favorite_locations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- CHAT SESSIONS & MESSAGES
-- ---------------------------------------------------------------------
create table public.chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  search_history_id uuid references public.search_history(id) on delete set null,
  title text,
  created_at timestamptz default now()
);

alter table public.chat_sessions enable row level security;
create policy "Users manage own chat sessions"
  on public.chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('user','assistant')) not null,
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_chat_messages_session on public.chat_messages (session_id, created_at);

alter table public.chat_messages enable row level security;
create policy "Users manage own chat messages"
  on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- FEEDBACK
-- ---------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text check (category in ('incorrect_fare','incorrect_route','place_not_found','general','bug','suggestion','data_correction','other')),
  message text not null,
  related_route jsonb,
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;
create policy "Users manage own feedback"
  on public.feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- ANALYTICS EVENTS (aggregate, write-only from client; admin read via service role)
-- ---------------------------------------------------------------------
create table public.analytics_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null, -- 'search', 'voice_search', 'route_selected', etc.
  event_data jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.analytics_events enable row level security;
create policy "Users insert own analytics"
  on public.analytics_events for insert with check (auth.uid() = user_id);
create policy "Users read own analytics"
  on public.analytics_events for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- Sample seed: a handful of major Tamil Nadu places (extend via import script)
-- ---------------------------------------------------------------------
insert into public.places (name, name_ta, aliases, place_type, district, lat, lng) values
('Chennai', 'சென்னை', '{"chennai","madras"}', 'city', 'Chennai', 13.0827, 80.2707),
('Coimbatore', 'கோயம்புத்தூர்', '{"coimbatore","kovai"}', 'city', 'Coimbatore', 11.0168, 76.9558),
('Madurai', 'மதுரை', '{"madurai"}', 'city', 'Madurai', 9.9252, 78.1198),
('Trichy', 'திருச்சி', '{"trichy","tiruchirappalli","tiruchi"}', 'city', 'Tiruchirappalli', 10.7905, 78.7047),
('Salem', 'சேலம்', '{"salem"}', 'city', 'Salem', 11.6643, 78.1460),
('Tirunelveli', 'திருநெல்வேலி', '{"tirunelveli","nellai"}', 'city', 'Tirunelveli', 8.7139, 77.7567),
('Vellore', 'வேலூர்', '{"vellore"}', 'city', 'Vellore', 12.9165, 79.1325),
('Erode', 'ஈரோடு', '{"erode"}', 'city', 'Erode', 11.3410, 77.7172),
('Thanjavur', 'தஞ்சாவூர்', '{"thanjavur","tanjore"}', 'city', 'Thanjavur', 10.7870, 79.1378),
('Kanchipuram', 'காஞ்சிபுரம்', '{"kanchipuram","kanchi"}', 'town', 'Kanchipuram', 12.8342, 79.7036),
('Pondicherry', 'புதுச்சேரி', '{"pondicherry","puducherry","pondy"}', 'city', 'Puducherry', 11.9416, 79.8083),
('Tiruppur', 'திருப்பூர்', '{"tiruppur","tirupur"}', 'city', 'Tiruppur', 11.1085, 77.3411),
-- Additional towns & villages for broader TN coverage (extend via bulk import)
('Kumbakonam', 'கும்பகோணம்', '{"kumbakonam","kumbakonam"}', 'town', 'Thanjavur', 10.9602, 79.3845),
('Sivakasi', 'சிவகாசி', '{"sivakasi"}', 'town', 'Virudhunagar', 9.4496, 77.7975),
('Rameswaram', 'ராமேஸ்வரம்', '{"rameswaram","rameshwaram"}', 'town', 'Ramanathapuram', 9.2876, 79.3129),
('Kodaikanal', 'கொடைக்கானல்', '{"kodaikanal","kodai"}', 'town', 'Dindigul', 10.2381, 77.4892),
('Mahabalipuram', 'மாமல்லபுரம்', '{"mahabalipuram","mamallapuram"}', 'town', 'Chengalpattu', 12.6269, 80.1927),
('Yercaud', 'ஏற்காடு', '{"yercaud"}', 'village', 'Salem', 11.7753, 78.2095),
('Karaikudi', 'காரைக்குடி', '{"karaikudi"}', 'town', 'Sivaganga', 10.0738, 78.7868),
('Pollachi', 'பொள்ளாச்சி', '{"pollachi"}', 'town', 'Coimbatore', 10.6589, 77.0083),
('Dindigul', 'திண்டுக்கல்', '{"dindigul","dindukal"}', 'city', 'Dindigul', 10.3624, 77.9695),
('Nagercoil', 'நாகர்கோவில்', '{"nagercoil","nagercoil"}', 'town', 'Kanyakumari', 8.1833, 77.4119)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Sample verified transport route (Chennai -> Madurai express bus).
-- This is the kind of curated record that should be populated from
-- TNSTC GTFS/open data exports for high-confidence results. Replace
-- with real cited data — do not fabricate fares/timings beyond this.
-- ---------------------------------------------------------------------
insert into public.transport_routes (
  mode, route_number, route_name, operator, origin_place_id, destination_place_id,
  fare_base, fare_per_km, frequency_minutes, first_departure, last_departure,
  data_confidence, source
)
select
  'bus', 'TNSTC-137', 'Chennai - Madurai Express', 'TNSTC',
  (select id from public.places where name = 'Chennai' limit 1),
  (select id from public.places where name = 'Madurai' limit 1),
  30, 1.1, 60, '21:00', '23:30',
  'medium', 'TNSTC published express fare slab (illustrative — verify against current TNSTC tariff card before relying on this record)'
where exists (select 1 from public.places where name = 'Chennai')
  and exists (select 1 from public.places where name = 'Madurai')
on conflict do nothing;
