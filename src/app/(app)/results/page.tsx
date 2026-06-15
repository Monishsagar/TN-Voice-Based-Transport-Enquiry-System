import { resolvePlace } from "@/lib/services/geocoding";
import { generateRouteOptions } from "@/lib/services/route-engine";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateChatSession, getChatHistory } from "@/lib/actions/data";
import { ResultsView } from "@/components/results-view";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ResultsPageProps {
  searchParams: { from?: string; to?: string; mode?: string };
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const fromText = searchParams.from?.trim();
  const toText = searchParams.to?.trim();

  if (!fromText || !toText) {
    return (
      <Card glass className="max-w-lg mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
          <p>Missing source or destination. Please search again.</p>
          <Button asChild variant="gradient">
            <Link href="/search">Back to Search</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const [source, destination] = await Promise.all([resolvePlace(fromText), resolvePlace(toText)]);

  if (!source || !destination) {
    return (
      <Card glass className="max-w-lg mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-semibold">Location not found</h2>
          <p className="text-sm text-muted-foreground">
            {!source && `Couldn't locate "${fromText}" in Tamil Nadu. `}
            {!destination && `Couldn't locate "${toText}" in Tamil Nadu. `}
            Try a nearby major town or check spelling.
          </p>
          <Button asChild variant="gradient">
            <Link href="/search">Try Again</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const result = await generateRouteOptions(source, destination);

  // Find/create search history entry + chat session for conversation memory
  let searchHistoryId: string | null = null;
  const supabase = createClient();
  const user = await getCurrentUserWithTimeout(supabase);

  if (user) {
    const { data: existing } = await supabase
      .from("search_history")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_name", source.name)
      .eq("destination_name", destination.name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      searchHistoryId = existing.id;
    } else {
      const best = result.options.find((o) => o.tags.includes("best_choice")) ?? result.options[0];
      const { data: inserted } = await supabase
        .from("search_history")
        .insert({
          user_id: user.id,
          source_name: source.name,
          source_lat: source.lat,
          source_lng: source.lng,
          destination_name: destination.name,
          destination_lat: destination.lat,
          destination_lng: destination.lng,
          search_mode: "text",
          language: "en",
          results_summary: best
            ? {
                best_option_label: best.label,
                total_duration_min: best.total_duration_min,
                total_fare_estimate: best.total_fare_estimate,
              }
            : null,
        })
        .select("id")
        .single();
      searchHistoryId = inserted?.id ?? null;
    }
  }

  const sessionResult = user ? await getOrCreateChatSession(searchHistoryId) : { sessionId: `guest-${result.generated_at}` };
  const sessionId = "sessionId" in sessionResult ? sessionResult.sessionId ?? null : null;

  let initialMessages: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [];
  if (sessionId) {
    const history = await getChatHistory(sessionId);
    if ("messages" in history && history.messages) {
      initialMessages = history.messages as typeof initialMessages;
    }
  }

  return (
    <ResultsView
      result={result}
      sessionId={sessionId}
      initialMessages={initialMessages}
      searchHistoryId={searchHistoryId}
      mode={searchParams.mode as never}
    />
  );
}

async function getCurrentUserWithTimeout(supabase: ReturnType<typeof createClient>) {
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);

    return authResult && "data" in authResult ? authResult.data.user : null;
  } catch {
    return null;
  }
}
