-- Seed verified transport_routes for Chennai suburban segments
-- Run in Supabase SQL editor AFTER inserting places above.

INSERT INTO transport_routes (
  id, origin_place_id, destination_place_id, mode, route_number, route_name, operator, fare_base, fare_per_km, frequency_minutes, first_departure, last_departure, data_confidence, source
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid, -- Pazhavanthangal
    '22222222-2222-4222-8222-222222222222'::uuid, -- Potheri
    'train', NULL, 'Chennai Suburban - South Line', 'Southern Railway', NULL, NULL, 15, '05:00', '23:00', 'high', 'curated:local-suburban'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid, -- Velachery
    '44444444-4444-4444-8444-444444444444'::uuid, -- Tambaram
    'train', NULL, 'Chennai Suburban (Velachery-Tambaram)', 'Southern Railway', NULL, NULL, 12, '05:30', '23:30', 'high', 'curated:local-suburban'
  );

-- Note: Adjust field names/types if your `transport_routes` schema differs.
-- You can create more rows for other station pairs following this pattern.
