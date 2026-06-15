How to build a comprehensive `places` dataset for Tamil Nadu

Overview
- Creating an exhaustive list of all places in Tamil Nadu is large — use authoritative sources and automated imports.
- This repo includes `scripts/import_overpass_places.js` that queries OpenStreetMap (Overpass API) for stations, bus stops, towns, and villages inside the Tamil Nadu admin boundary and generates SQL inserts for the `places` table.

Recommended flow
1. Prepare a temporary Node environment in the project root:

   ```bash
   npm init -y
   npm install node-fetch@2
   ```

2. Run the Overpass import script (may take several minutes and produce a large file):

   ```bash
   node scripts/import_overpass_places.js > db/generated_places.sql
   ```

3. Inspect `db/generated_places.sql` and remove duplicates or any undesired rows. The script includes a safety note to review before applying.

4. Apply the SQL in Supabase SQL Editor or via `psql`:

   - Supabase: paste the SQL and run.
   - psql (if you have a direct DB connection):
     ```bash
     psql "<CONNECTION_STRING>" -f db/generated_places.sql
     ```

5. After the import, run the app locally and test searches like "Pazhavanthangal to Potheri".

Notes & alternatives
- For official administrative lists (districts/taluks/villages), prefer government data portals (Data.gov.in, state portals) and import CSVs directly.
- For Indian Railways station lists, use published station lists or extract stations from OpenRailwayMap / Indian Railways datasets.
- If you want, I can prepare a second script to merge government CSVs (districts/taluks/villages) into the `places` table with proper district mapping.
