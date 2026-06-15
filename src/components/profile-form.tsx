"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/lib/actions/data";
import { Loader2, Check } from "lucide-react";

interface ProfileFormProps {
  fullName: string;
  homeLocation: string;
  workLocation: string;
}

export function ProfileForm({ fullName, homeLocation, workLocation }: ProfileFormProps) {
  const [name, setName] = useState(fullName);
  const [home, setHome] = useState(homeLocation);
  const [work, setWork] = useState(workLocation);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile(name, home, work);
      if ("success" in result) setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="home">Home location</Label>
        <Input id="home" value={home} onChange={(e) => setHome(e.target.value)} placeholder="e.g. Tambaram, Chennai" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="work">Work location</Label>
        <Input id="work" value={work} onChange={(e) => setWork(e.target.value)} placeholder="e.g. T. Nagar, Chennai" />
      </div>

      <Button type="submit" variant="gradient" disabled={pending} className="gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {saved && !pending && <Check className="h-4 w-4" />}
        {saved && !pending ? "Saved!" : "Save changes"}
      </Button>
    </form>
  );
}
