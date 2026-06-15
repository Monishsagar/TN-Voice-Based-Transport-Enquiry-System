import { Place } from "@/types";

const OSRM_URL = process.env.NEXT_PUBLIC_OSRM_URL || "https://router.project-osrm.org";
const ORS_KEY = process.env.ORS_API_KEY || process.env.NEXT_PUBLIC_ORS_API_KEY || null;
const REQUEST_TIMEOUT_MS = 6500;

export interface OSRMRouteResult {
  distance_km: number;
  duration_min: number;
  polyline: [number, number][]; // [lat, lng]
}

/**
 * Fetches a driving route between two points from the public OSRM
 * demo server (free, rate-limited). Returns null on failure so
 * callers can fall back to haversine-based estimation.
 */
export async function getOSRMRoute(
  from: Place,
  to: Place,
  profile: "driving" | "foot" = "driving"
): Promise<OSRMRouteResult | null> {
  try {
    // Prefer OpenRouteService when an API key is available (more reliable geometry)
    if (ORS_KEY) {
      console.log("[routing] Using ORS key, attempting OpenRouteService request");
      const orsUrl = `https://api.openrouteservice.org/v2/directions/${profile === "foot" ? "foot-walking" : "driving-car"}/geojson`;
      const body = {
        coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
      };

      const res = await fetchWithTimeout(orsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: ORS_KEY,
        },
        body: JSON.stringify(body),
        next: { revalidate: 60 * 60 },
      });
      if (!res.ok) {
        console.log("[routing] ORS request failed", res.status, await res.text().catch(() => "<body?>"));
      } else {
        const data = await res.json();
        const feat = data.features?.[0];
        if (feat && feat.geometry && feat.properties && feat.properties.summary) {
          const coords: [number, number][] = feat.geometry.coordinates;
          const polyline: [number, number][] = coords.map((c) => [c[1], c[0]]);
          console.log("[routing] ORS success", { distance: feat.properties.summary.distance, duration: feat.properties.summary.duration });
          return {
            distance_km: feat.properties.summary.distance / 1000,
            duration_min: feat.properties.summary.duration / 60,
            polyline,
          };
        }
        console.log("[routing] ORS returned no usable feature", { data });
      }

    }

    // Fallback to public OSRM demo server
    const url = `${OSRM_URL}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

    const res = await fetchWithTimeout(url, {
      next: { revalidate: 60 * 60 }, // cache 1h
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const route = data.routes[0];
    const polyline: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] // GeoJSON is [lng, lat] → flip to [lat, lng]
    );

    return {
      distance_km: route.distance / 1000,
      duration_min: route.duration / 60,
      polyline,
    };
  } catch {
    return null;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
