"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Volume2, VolumeX, Loader2, Mic } from "lucide-react";
import { ChatMessage, RouteSearchResult } from "@/types";
import { sendChatMessage } from "@/lib/actions/data";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useLanguage } from "@/components/providers/language-provider";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  sessionId: string | null;
  initialMessages: ChatMessage[];
  searchResult: RouteSearchResult | null;
}

const SUGGESTED_PROMPTS = {
  en: ["Cheapest option?", "Fare breakdown", "Any alternatives?", "Is it safe at night?"],
  ta: ["மிகக் குறைந்த விலை வழி?", "கட்டண விவரம்", "மாற்று வழிகள்?", "இரவில் பாதுகாப்பானதா?"],
};

export function ChatPanel({ sessionId, initialMessages, searchResult }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { language } = useLanguage();
  const { speak, stop, isSpeaking, isSupported: ttsSupported } = useTextToSpeech();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { isListening, isSupported: sttSupported, start, stop: stopListening } = useSpeechRecognition({
    language: language === "ta" ? "ta-IN" : "en-IN",
    onResult: (transcript) => handleSend(transcript),
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const messageText = (text ?? input).trim();
    if (!messageText || !sessionId || loading) return;

    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const result = await sendChatMessage(sessionId, messageText, searchResult, language === "ta" ? "ta" : "en");
    setLoading(false);

    if (result.message) {
      setMessages((prev) => [
        ...prev,
        {
          id: result.message!.id,
          role: "assistant",
          content: result.message!.content,
          created_at: result.message!.created_at,
        },
      ]);
    } else if (result.error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Sorry, something went wrong: ${result.error}`,
          created_at: new Date().toISOString(),
        },
      ]);
    }
  }

  const prompts = SUGGESTED_PROMPTS[language === "ta" ? "ta" : "en"];

  return (
    <Card glass className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-accent" />
          {language === "ta" ? "AI உரையாடல்" : "AI Route Chat"}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 p-3 sm:p-4 pt-0 min-h-0">
        <ScrollArea className="flex-1 pr-2">
          <div className="flex flex-col gap-3 pb-2">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6">
                {language === "ta"
                  ? "இந்த வழி பற்றி எதையும் கேளுங்கள் — விலை, வேகம், மாற்று வழிகள், பாதுகாப்பு."
                  : "Ask anything about this route — fares, speed, alternatives, safety, and more."}
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                    msg.role === "user" ? "bg-gradient-to-r from-primary to-accent text-white" : "glass"
                  )}
                >
                  {msg.content}
                  {msg.role === "assistant" && ttsSupported && (
                    <button
                      onClick={() => (isSpeaking ? stop() : speak(msg.content, language === "ta" ? "ta-IN" : "en-IN"))}
                      className="ml-2 inline-flex align-middle text-muted-foreground hover:text-foreground"
                      aria-label="Read aloud"
                    >
                      {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="glass rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {language === "ta" ? "சிந்திக்கிறேன்..." : "Thinking..."}
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="text-xs glass rounded-full px-3 py-1.5 hover:bg-accent/30 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={language === "ta" ? "இந்த வழி பற்றி கேளுங்கள்..." : "Ask about this route..."}
            disabled={!sessionId}
          />
          <Button size="icon" variant="gradient" onClick={() => handleSend()} disabled={!sessionId || loading}>
            <Send className="h-4 w-4" />
          </Button>
          {sttSupported && (
            <Button
              size="icon"
              variant={isListening ? "destructive" : "glass"}
              onClick={isListening ? stopListening : start}
              disabled={!sessionId}
              aria-label="Voice input"
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!sessionId && (
          <p className="text-xs text-muted-foreground text-center">
            {language === "ta" ? "உரையாடலைத் தொடங்க முதலில் தேடுங்கள்." : "Search a route first to start chatting."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
