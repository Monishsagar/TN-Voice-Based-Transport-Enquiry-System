-- Seed trusted local places for Chennai suburban corridor
-- Run these in Supabase SQL editor (replace coordinates if you have more accurate ones)

INSERT INTO places (id, name, name_ta, lat, lng, district, place_type, aliases)
VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Pazhavanthangal', 'பழவந்தாங்கல்', 12.9967, 80.2059, 'Chennai', 'railway_station', ARRAY['pazhavanthangal','pazhavanthangai','pazha vanthangal']),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'Potheri', 'போதேரி', 12.8240, 80.0410, 'Chengalpattu', 'railway_station', ARRAY['potheri','pothery']),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'Velachery', 'வேளச்சேரி', 12.9941, 80.2256, 'Chennai', 'town', ARRAY['velachery','velacheri']),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'Tambaram', 'தாம்பரம்', 12.9249, 80.1000, 'Chengalpattu', 'town', ARRAY['tambaram','tambaram bus stand']),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'Chromepet', 'குரோம்பேட்', 12.9516, 80.1462, 'Chengalpattu', 'town', ARRAY['chromepet','chrompet']),
  ('66666666-6666-4666-8666-666666666666'::uuid, 'Pallavaram', 'பல்லாவரம்', 12.9675, 80.1491, 'Chengalpattu', 'town', ARRAY['pallavaram','pallavaram bus stand']);

-- Add any other local stops similarly.

-- Note: This SQL assumes your `places` table has columns: id (uuid), name, name_ta, lat, lng, district, place_type, aliases (text[]).
-- If your schema differs, adapt column names/types accordingly.
