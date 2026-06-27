# TN Transport Enquiry

A production-ready, full-stack Voice & Text Based Transport Enquiry System covering all of Tamil Nadu (cities, towns, villages). Built with Next.js 14 (App Router + TypeScript), Tailwind CSS + shadcn/ui, and Supabase (Auth, PostgreSQL, RLS). No Python/FastAPI anywhere.

## Features

- Email-verified Supabase Auth (no anonymous access)
- Glassmorphism UI, dark/light mode, animations, fully responsive
- Text + Voice search (Web Speech API) - English, Tamil, and Tanglish
- Deterministic route engine: bus, train, cab (mini/sedan/SUV), auto, walking, multi-modal combinations
- Distance/duration via OSRM, geocoding via Nominatim (both OpenStreetMap, free)
- Transparent, non-fabricated fare estimation with confidence levels and source notes
- AI chat with session memory, grounded entirely in the generated route data
- Interactive Leaflet map: pins, route polylines, transfer points
- Best Choice recommendation, Budget/Fastest/Least-Walking/Accessibility modes
- Safety score, route confidence indicator, one-click shareable summary
- Home/Work shortcuts, search history, saved routes, feedback
- Bilingual (English/Tamil) instant UI switching

## Tech Stack

- Frontend: Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons
- Maps: Leaflet + react-leaflet + OpenStreetMap tiles
- Backend: Next.js Server Actions + Route Handlers (no separate API server)
- Database/Auth: Supabase (PostgreSQL + Row Level Security + Auth)
- Routing/Geocoding: OSRM (public demo server) + Nominatim, optionally OpenRouteService
- Speech: Browser Web Speech API (SpeechRecognition + SpeechSynthesis) - free, no external service

## Project Structure

src/
  app/
    (auth)/login, register          - Auth pages
    auth/callback                   - Supabase email verification callback
    (app)/dashboard                 - Authenticated shell (navbar, theme/lang providers)
      search/                       - Text/voice search + trip priority
      results/                      - Route results, map, chat
      history/                      - Search history
      saved/                        - Saved routes
      profile/                      - Profile, home/work shortcuts, feedback
      chat/                         - General AI chat
  components/                       - UI components (shadcn-based + custom)
  lib/
    actions/                        - Server Actions (auth.ts, search.ts, data.ts)
    services/                       - geocoding, routing (OSRM), fare estimation,
                                       route engine, chat engine (deterministic NLU)
    supabase/                       - client/server Supabase clients
    language.ts                     - Tamil/Tanglish parsing + i18n strings
    utils.ts                        - formatting helpers
  hooks/                            - useSpeechRecognition, useTextToSpeech
  types/                            - Shared TypeScript types
supabase/
  schema.sql                        - Full DB schema + RLS policies + seed places
```

## Setup

### 1. Supabase project

1. Create a free project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql` - this creates all tables, RLS policies, triggers, and seeds a starter set of Tamil Nadu places.
3. Under Authentication -> Providers, ensure Email provider is enabled and "Confirm email" is turned ON (required - this app rejects unverified/anonymous access).
4. Under Authentication -> URL Configuration, set the Site URL and add `<your-app-url>/auth/callback` as a redirect URL.
5. Copy your Project URL, anon key, and service role key into `.env.local` (see `.env.example`).

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The OSRM/Nominatim defaults work out of the box for development (subject to public rate limits - see notes below).

### 3. Install & run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, register with a real email, verify it and then log in 

## Expanding Tamil Nadu Coverage

`schema.sql` seeds major cities/towns/villages with coordinates and Tamil names/aliases in `public.places`. To cover all TN towns/villages and real routes:

- Bulk-insert additional rows into `public.places` (name, name_ta, aliases[], place_type, district, lat, lng) - source coordinates from OpenStreetMap/Nominatim or government village directories.
- Populate `public.transport_routes` from TNSTC route data, Indian Railways timetables, or any GTFS feed you can obtain - each row must cite its `source` and set an honest `data_confidence` (`high`/`medium`/`low`).
- The route engine (`src/lib/services/route-engine.ts`) automatically falls back to OSRM-driven estimates with `low`/`medium` confidence and a clear data note when no curated `transport_routes` record exists - it never invents specific bus numbers, train numbers, or timings.

## Truthfulness Guarantees

- Fare figures come from `src/lib/services/fare-estimation.ts`, which uses transparent per-km slabs (clearly labeled as estimates) or curated `transport_routes.fare_base`/`fare_per_km` records.
- The AI chat (`src/lib/services/chat-engine.ts`) is deterministic/rule-based and only reasons over the `RouteSearchResult` already generated for the session - it cannot fabricate route numbers or fares. An optional LLM key can be wired in purely for phrasing, never for facts.
- Every result includes `overall_confidence` (high/medium/low) and a `data_note` explaining the basis of any estimate.

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import into Vercel (vercel.com/new).
3. Add the environment variables from `.env.example` in Project Settings -> Environment Variables.
4. Deploy. Update your Supabase Auth redirect URL to `https://<your-domain>/auth/callback`.

## Notes on free APIs

- Nominatim (nominatim.openstreetmap.org) and the OSRM demo server (router.project-osrm.org) are public, free, but rate-limited (~1 req/sec) and not suited for heavy production traffic. For production, self-host OSRM with a Tamil Nadu OSM extract, or use OpenRouteService's free tier (`ORS_API_KEY`).
- Web Speech API runs entirely in the browser - no server cost, but availability/accuracy varies by browser (best in Chrome/Edge).

## Database Schema Overview

| Table | Purpose |
|---|---|
| profiles | User profile, home/work shortcuts, preferences |
| places | Tamil Nadu cities/towns/villages with TA names & aliases |
| transport_routes | Curated bus/train route records with fares & confidence |
| search_history | Every route search a user performs |
| saved_routes | Bookmarked routes |
| favorite_locations | Home/Work/custom shortcuts |
| chat_sessions / chat_messages | AI chat conversation memory per search session |
| feedback | User-submitted data corrections/suggestions |
| analytics_events | Lightweight usage analytics |

All tables have Row Level Security enabled - users can only access their own rows; `places` and `transport_routes` are public-read.

## License

MIT - adapt freely. Replace seed/sample transport data with verified sources before production use.
