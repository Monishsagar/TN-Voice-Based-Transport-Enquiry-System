import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { History, MapPin, Clock, Wallet, Mic, Type } from "lucide-react";
import { formatDuration, formatINR } from "@/lib/utils";
import { format } from "date-fns";

export default async function HistoryPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: history } = await supabase
    .from("search_history")
    .select("id, source_name, destination_name, search_mode, language, results_summary, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-7 w-7 text-secondary" /> Search History
        </h1>
        <p className="text-muted-foreground mt-1">Your past route enquiries.</p>
      </div>

      {!history || history.length === 0 ? (
        <Card glass>
          <CardContent className="p-10 text-center text-muted-foreground">
            <p>No searches yet.</p>
            <Button asChild variant="gradient" className="mt-4">
              <Link href="/search">Start your first search</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => {
            const summary = entry.results_summary as
              | { best_option_label: string; total_duration_min: number; total_fare_estimate: number | null }
              | null;
            return (
              <Card key={entry.id} glass className="hover:scale-[1.005] transition-transform">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <Link
                    href={`/results?from=${encodeURIComponent(entry.source_name)}&to=${encodeURIComponent(entry.destination_name)}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary shrink-0">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {entry.source_name} → {entry.destination_name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          {entry.search_mode === "voice" ? <Mic className="h-3 w-3" /> : <Type className="h-3 w-3" />}
                          {entry.search_mode}
                        </span>
                        {summary && (
                          <>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(summary.total_duration_min)}</span>
                            <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> {formatINR(summary.total_fare_estimate)}</span>
                          </>
                        )}
                        <span>{format(new Date(entry.created_at), "MMM d, h:mm a")}</span>
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
