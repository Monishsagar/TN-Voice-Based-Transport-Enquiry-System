import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Star, MapPin } from "lucide-react";
import { format } from "date-fns";
import { RouteSearchResult } from "@/types";
import { formatDistance, formatDuration, formatINR } from "@/lib/utils";
import { DeleteSavedRouteButton } from "@/components/delete-saved-route-button";

export default async function SavedRoutesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: saved } = await supabase
    .from("saved_routes")
    .select("id, title, source_name, destination_name, route_data, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Star className="h-7 w-7 text-amber-500" /> Saved Routes
        </h1>
        <p className="text-muted-foreground mt-1">Bookmarked journeys for quick access.</p>
      </div>

      {!saved || saved.length === 0 ? (
        <Card glass>
          <CardContent className="p-10 text-center text-muted-foreground">
            <p>No saved routes yet.</p>
            <Button asChild variant="gradient" className="mt-4">
              <Link href="/search">Search &amp; save a route</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {saved.map((route) => {
            const data = route.route_data as RouteSearchResult | null;
            const option = data?.options?.[0];
            return (
              <Card key={route.id} glass>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/results?from=${encodeURIComponent(route.source_name)}&to=${encodeURIComponent(route.destination_name)}`}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{route.title}</p>
                        {option && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {option.label} · {formatDistance(option.total_distance_km)} · {formatDuration(option.total_duration_min)} · {formatINR(option.total_fare_estimate)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(route.created_at), "MMM d, yyyy")}</p>
                      </div>
                    </Link>
                    <DeleteSavedRouteButton id={route.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
