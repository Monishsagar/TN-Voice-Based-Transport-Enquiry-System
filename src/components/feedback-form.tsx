"use client";

import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { submitFeedback } from "@/lib/actions/data";
import { Loader2, Check } from "lucide-react";

const CATEGORIES = [
  { value: "incorrect_fare", label: "Incorrect fare estimate" },
  { value: "incorrect_route", label: "Incorrect / missing route" },
  { value: "place_not_found", label: "Place not found" },
  { value: "general", label: "General feedback" },
];

export function FeedbackForm() {
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSent(false);
    startTransition(async () => {
      const result = await submitFeedback(category, message);
      if ("success" in result) {
        setSent(true);
        setMessage("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Details</Label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe what's wrong or your suggestion..."
          rows={4}
          className="flex w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm resize-none"
        />
      </div>
      <Button type="submit" variant="gradient" disabled={pending || !message.trim()} className="gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {sent && !pending && <Check className="h-4 w-4" />}
        {sent && !pending ? "Thanks for the feedback!" : "Submit feedback"}
      </Button>
    </form>
  );
}
