"use client";

import dynamic from "next/dynamic";
import { Place, RouteOption } from "@/types";

const RouteMap = dynamic(() => import("@/components/route-map"), {
  ssr: false,
  loading: () => null,
});

interface RouteMapWrapperProps {
  source: Place;
  destination: Place;
  selectedOption?: RouteOption | null;
  className?: string;
}

export function RouteMapWrapper(props: RouteMapWrapperProps) {
  return (
    <div className={props.className}>
      <StaticMapFallback source={props.source} destination={props.destination} />
      <RouteMap {...props} className="absolute inset-0 z-10" />
    </div>
  );
}

function StaticMapFallback({ source, destination }: { source: Place; destination: Place }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border))_1px,transparent_1px)] bg-[size:42px_42px] bg-muted">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M14 72 C 32 44, 57 62, 86 28" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 4" />
      </svg>
      <div className="absolute left-[12%] top-[68%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow" />
      <div className="absolute left-[86%] top-[28%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500 shadow" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/10 via-transparent to-background/20">
        <div className="absolute left-4 top-4 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-emerald-700 shadow dark:bg-black/70 dark:text-emerald-300">
          A {source.name}
        </div>
        <div className="absolute bottom-4 right-4 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-rose-700 shadow dark:bg-black/70 dark:text-rose-300">
          B {destination.name}
        </div>
      </div>
    </div>
  );
}
