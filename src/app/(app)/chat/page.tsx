import { createClient } from "@/lib/supabase/server";
import { getOrCreateChatSession, getChatHistory } from "@/lib/actions/data";
import { ChatPanel } from "@/components/chat-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ChatPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // General chat session (no associated search)
  const sessionResult = user ? await getOrCreateChatSession(null) : { sessionId: null };
  const sessionId = "sessionId" in sessionResult ? sessionResult.sessionId ?? null : null;

  let initialMessages: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [];
  if (sessionId) {
    const history = await getChatHistory(sessionId);
    if ("messages" in history && history.messages) {
      initialMessages = history.messages as typeof initialMessages;
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in h-[calc(100vh-140px)] flex flex-col">
      <div>
        <h1 className="text-3xl font-bold">AI Chat</h1>
        <p className="text-muted-foreground mt-1">
          General questions about Tamil Nadu transport. For route-specific questions, search first for grounded answers.
        </p>
      </div>

      <Card glass>
        <CardContent className="p-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Want answers grounded in a specific route?</span>
          <Button asChild size="sm" variant="gradient" className="gap-1.5 shrink-0">
            <Link href="/search"><Search className="h-3.5 w-3.5" /> New search</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex-1 min-h-0">
        <ChatPanel sessionId={sessionId} initialMessages={initialMessages} searchResult={null} />
      </div>
    </div>
  );
}
