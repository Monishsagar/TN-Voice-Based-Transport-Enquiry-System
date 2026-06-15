"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Place, RouteOption } from "@/types";

// Fix default marker icons (Leaflet's default asset paths break with bundlers)
const sourceIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:linear-gradient(135deg,#22c55e,#16a34a);width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">A</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const destIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:linear-gradient(135deg,#ef4444,#dc2626);width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">B</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const transferIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#f59e0b;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const MODE_COLORS: Record<string, string> = {
  bus: "#22c55e",
  train: "#3b82f6",
  cab: "#f59e0b",
  auto: "#ec4899",
  walk: "#94a3b8",
};

interface RouteMapProps {
  source: Place;
  destination: Place;
  selectedOption?: RouteOption | null;
  className?: string;
}

function FitBounds({ source, destination, selectedOption }: { source: Place; destination: Place; selectedOption?: RouteOption | null }) {
  const map = useMap();
  useEffect(() => {
    try {
      const latLngs: [number, number][] = [];

      // include source/destination
      latLngs.push([source.lat, source.lng]);
      latLngs.push([destination.lat, destination.lng]);

      // include any polylines from selected option
      if (selectedOption) {
        for (const leg of selectedOption.legs) {
          if (leg.polyline && leg.polyline.length) {
            for (const p of leg.polyline) latLngs.push([p[0], p[1]]);
          }
        }
      }

      const bounds = L.latLngBounds(latLngs as any);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
            // Ensure Leaflet recalculates tile sizes after layout changes
            setTimeout(() => {
              try {
                map.invalidateSize();
              } catch {}
            }, 120);
          }
    } catch (e) {
      // ignore errors and keep default view
    }
  }, [map, source, destination, selectedOption]);
  return null;
}

function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    // Invalidate size on window resize
    const onWin = () => {
      try {
        map.invalidateSize();
      } catch {}
    };
    window.addEventListener("resize", onWin);

    // Use ResizeObserver to detect size changes of the map container or parents
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => {
        try {
          map.invalidateSize();
        } catch {}
      });
      ro.observe(container);
      // also observe parent in case card size changes
      if (container.parentElement) ro.observe(container.parentElement);
    } catch {}

    // Also try one delayed invalidate to catch animations
    const t = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 200);

    return () => {
      window.removeEventListener("resize", onWin);
      if (ro) {
        try {
          ro.disconnect();
        } catch {}
      }
      clearTimeout(t);
    };
  }, [map]);
  return null;
}

function MapReadyHandler() {
  const map = useMap();
  useEffect(() => {
    const timers = [60, 180, 420].map((delay) =>
      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {}
      }, delay)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [map]);

  return null;
}

export default function RouteMap({ source, destination, selectedOption, className }: RouteMapProps) {
  const center: [number, number] = [
    (source.lat + destination.lat) / 2,
    (source.lng + destination.lng) / 2,
  ];

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={8}
        scrollWheelZoom
        zoomControl
        style={{ width: "100%", height: "100%" }}
      >
        <MapReadyHandler />
        <MapResizeHandler />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds source={source} destination={destination} selectedOption={selectedOption} />

        <Marker position={[source.lat, source.lng]} icon={sourceIcon}>
          <Popup>
            <strong>{source.name}</strong>
            <br />
            Source {source.district ? `· ${source.district}` : ""}
          </Popup>
        </Marker>

        <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
          <Popup>
            <strong>{destination.name}</strong>
            <br />
            Destination {destination.district ? `· ${destination.district}` : ""}
          </Popup>
        </Marker>

        {selectedOption?.legs.map((leg, idx) => {
          if (!leg.polyline || leg.polyline.length === 0) return null;
          return (
            <Polyline
              key={idx}
              positions={leg.polyline}
              pathOptions={{
                color: MODE_COLORS[leg.mode] ?? "#7c3aed",
                weight: 5,
                opacity: 0.75,
                dashArray: leg.mode === "walk" ? "6 8" : undefined,
              }}
            />
          );
        })}

        {/* Transfer points: markers between legs when there are 2+ legs */}
        {selectedOption && selectedOption.legs.length > 1 &&
          selectedOption.legs.slice(0, -1).map((leg, idx) => (
            <Marker key={`transfer-${idx}`} position={[leg.to.lat, leg.to.lng]} icon={transferIcon}>
              <Popup>
                <strong>Transfer point</strong>
                <br />
                {leg.to.name}
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
