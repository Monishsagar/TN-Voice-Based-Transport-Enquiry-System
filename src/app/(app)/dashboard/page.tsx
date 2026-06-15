import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, History, Star, MapPin, MessageCircle, User } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to <span className="gradient-text">your dashboard</span>
        </h1>
        <p className="text-muted-foreground mt-1">Search routes, review saved journeys, and ask follow-up questions.</p>
      </div>

      <Card glass className="overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Plan a Tamil Nadu journey</h2>
              <p className="text-sm text-muted-foreground">
                Get bus, train, cab, and auto options with fares, duration, and map view.
              </p>
            </div>
            <Button asChild size="lg" variant="gradient">
              <Link href="/search" className="gap-2">
                <Search className="h-4 w-4" /> New Search
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLink href="/search" icon={<Search className="h-5 w-5 text-secondary" />} title="Search Routes" description="Find exact route options" />
        <QuickLink href="/history" icon={<History className="h-5 w-5 text-primary" />} title="History" description="View previous searches" />
        <QuickLink href="/saved" icon={<Star className="h-5 w-5 text-amber-500" />} title="Saved Routes" description="Open bookmarked trips" />
        <QuickLink href="/profile" icon={<User className="h-5 w-5 text-accent" />} title="Profile" description="Manage preferences" />
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-accent" /> Follow-up help
          </CardTitle>
          <CardDescription>
            After searching a route, use the chat panel to ask fare, safety, timing, or comparison questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/search" className="gap-2">
              <MapPin className="h-4 w-4" /> Start with a route
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card glass className="hover:scale-[1.02] transition-transform h-full">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl glass">{icon}</div>
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
