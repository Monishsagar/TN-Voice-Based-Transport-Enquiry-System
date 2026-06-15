/*
Fetch Tamil Nadu places (stations, towns, villages, bus stops) from OpenStreetMap via Overpass API
and emit SQL INSERT statements suitable for the project's `places` table.

Usage:
  1. Install dependencies:
     npm init -y
     npm install node-fetch@2 csv-stringify

  2. Run:
     node scripts/import_overpass_places.js > db/generated_places.sql

Notes:
- The script queries for railway stations, metro stations, bus stops, town/village place tags inside the
  Tamil Nadu administrative relation. Overpass may return a large result; split or refine queries
  if you hit timeouts or rate limits.
- Review `db/generated_places.sql` before running it in Supabase.
*/

const fetch = require('node-fetch');
const fs = require('fs');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function fetchTamilNaduRelation() {
  // Find the relation id for Tamil Nadu (state level)
  const q = `rel["name"="Tamil Nadu"]["admin_level"="4"];out ids;`;
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: q,
    headers: { 'Content-Type': 'text/plain' },
  });
  const text = await res.text();
  const m = text.match(/rel\s+(\d+)/);
  if (!m) throw new Error('Tamil Nadu relation not found');
  return m[1];
}

function buildOverpassQuery(relationId) {
  // Query nodes and ways for: railway=station/halt, railway=subway_entrance, public_transport=station,
  // bus stops, bus stations, place=town/village/hamlet, station=railway
  return `
  [out:json][timeout:600];
  // bounding by relation
  relation(${relationId});
  map_to_area -> .searchArea;

  (
    // railway stations / halts
    node["railway"~"station|halt"](area.searchArea);
    way["railway"~"station|halt"](area.searchArea);
    relation["railway"~"station|halt"](area.searchArea);

    // suburban / metro stations
    node["public_transport"~"station|stop_position|platform"](area.searchArea);
    way["public_transport"~"station|stop_position|platform"](area.searchArea);

    // bus stops / bus stations
    node["highway"="bus_stop"](area.searchArea);
    node["amenity"="bus_station"](area.searchArea);

    // places (town/village/hamlet)
    node["place"~"town|village|hamlet|suburb"](area.searchArea);
    way["place"~"town|village|hamlet|suburb"](area.searchArea);
  );
  out center tags geom;
  `;
}

function normalizeName(name) {
  if (!name) return null;
  return name.trim();
}

function sqlEscape(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function placeTypeFromTags(tags) {
  if (!tags) return 'landmark';
  if (tags.railway) return 'railway_station';
  if (tags.amenity === 'bus_station' || tags.highway === 'bus_stop') return 'bus_stop';
  if (tags.place) {
    if (['city','town'].includes(tags.place)) return 'town';
    if (['village','hamlet','suburb'].includes(tags.place)) return 'village';
  }
  return 'landmark';
}

(async function main(){
  try {
    console.log('-- Generating places SQL via Overpass (Tamil Nadu)');
    const rel = await fetchTamilNaduRelation();
    const q = buildOverpassQuery(rel);

    const res = await fetch(OVERPASS_URL, { method: 'POST', body: q, headers: { 'Content-Type': 'text/plain' } });
    const data = await res.json();
    const elements = data.elements || [];

    const seen = new Set();
    const rows = [];

    for (const el of elements) {
      const tags = el.tags || {};
      let name = tags.name || tags['ref'] || null;
      if (!name) continue;
      name = normalizeName(name);
      const name_ta = tags['name:ta'] || null;

      // coords: prefer center (for ways/relations), else node lat/lon
      let lat = null;
      let lng = null;
      if (el.type === 'node') {
        lat = el.lat;
        lng = el.lon;
      } else if (el.center) {
        lat = el.center.lat;
        lng = el.center.lon;
      } else if (el.lat && el.lon) {
        lat = el.lat;
        lng = el.lon;
      } else continue;

      if (!lat || !lng) continue;

      const key = `${name}::${Math.round(lat*10000)}::${Math.round(lng*10000)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const place_type = placeTypeFromTags(tags);

      const aliases = [name.toLowerCase()];
      if (tags.alt_name) aliases.push(tags.alt_name.toLowerCase());
      if (tags['name:en']) aliases.push(tags['name:en'].toLowerCase());

      rows.push({ name, name_ta, lat, lng, place_type, aliases });
    }

    // Emit SQL
    console.log('-- WARNING: Review this file before applying to your DB');
    console.log('BEGIN;');
    for (const r of rows) {
      const aliases_sql = "{" + r.aliases.map(a => a.replace(/"/g, '\\"')).join(',') + "}";
      const id = 'gen-' + Math.random().toString(36).slice(2, 10);
      console.log(`INSERT INTO places (name, name_ta, lat, lng, district, place_type, aliases) VALUES (${sqlEscape(r.name)}, ${sqlEscape(r.name_ta)}, ${r.lat}, ${r.lng}, NULL, ${sqlEscape(r.place_type)}, '${aliases_sql}');`);
    }
    console.log('COMMIT;');

  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
