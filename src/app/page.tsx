import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { HomeRedirect } from "@/components/home-redirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Mic, Bus, Train, Car, Footprints, MapPin, MessageCircle,
  ShieldCheck, Gauge, Wallet, Globe2, Sparkles,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <HomeRedirect />
      <Navbar />

      {/* Hero */}
      <section className="container py-16 sm:py-24">
        <div className="text-center max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            Voice + Text · English, Tamil &amp; Tanglish
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6">
            Get anywhere in <span className="gradient-text">Tamil Nadu</span>,
            <br /> in one search.
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Buses, trains, cabs, and autos — cities to villages. Speak or type your
            journey in English, Tamil, or Tanglish, and get transparent fare and
            time estimates instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" variant="gradient">
              <Link href="/register">Get Started Free</Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>

        {/* Mode chips */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {[
            { icon: Bus, label: "Bus", color: "text-bus" },
            { icon: Train, label: "Train", color: "text-train" },
            { icon: Car, label: "Cab", color: "text-cab" },
            { icon: MapPin, label: "Auto", color: "text-auto" },
            { icon: Footprints, label: "Walk", color: "text-walk" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium animate-fade-in">
              <Icon className={`h-4 w-4 ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Voice demo card */}
      <section className="container pb-16">
        <Card glass className="max-w-2xl mx-auto overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="relative inline-flex mb-4">
              <div className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                <Mic className="h-7 w-7" />
              </div>
            </div>
            <h3 className="font-semibold text-lg mb-1">&quot;Chennai to Madurai eppadi poganum?&quot;</h3>
            <p className="text-sm text-muted-foreground">
              Speak naturally — Tanglish, Tamil, or English all work. Sign in to try voice search.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <h2 className="text-3xl font-bold text-center mb-10">Built for every traveller</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={<Wallet className="h-5 w-5 text-cab" />}
            title="Transparent Fares"
            description="Every estimate shows its basis — TNSTC tariff slabs, rail per-km rates, or app-cab pricing. No invented numbers."
          />
          <FeatureCard
            icon={<Gauge className="h-5 w-5 text-secondary" />}
            title="Budget, Fastest & Least-Walking Modes"
            description="Switch between trip styles instantly to match your priority — cost, speed, or comfort."
          />
          <FeatureCard
            icon={<MessageCircle className="h-5 w-5 text-accent" />}
            title="AI Route Chat"
            description="Ask follow-ups — cheapest option, fare breakdown, alternatives — in English, Tamil, or Tanglish."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5 text-bus" />}
            title="Safety Score"
            description="Heuristic scoring based on transfers and late-night travel helps you choose wisely."
          />
          <FeatureCard
            icon={<Globe2 className="h-5 w-5 text-train" />}
            title="All of Tamil Nadu"
            description="From major cities to small towns and villages — powered by OpenStreetMap coverage."
          />
          <FeatureCard
            icon={<Mic className="h-5 w-5 text-primary" />}
            title="Accessibility Mode"
            description="Voice-first navigation and text-to-speech results for visually impaired users."
          />
        </div>
      </section>

      <footer className="container py-8 text-center text-sm text-muted-foreground border-t border-border/50">
        Built with free & open data: OpenStreetMap, Nominatim, OSRM. Fares are estimates — always confirm with operators.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card glass className="hover:scale-[1.02] transition-transform">
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl glass mb-2">{icon}</div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
