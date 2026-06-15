import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User as UserIcon, MapPin, Settings, MessageSquarePlus } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { FeedbackForm } from "@/components/feedback-form";

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, home_location, home_lat, home_lng, work_location, work_lat, work_lng")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserIcon className="h-7 w-7 text-primary" /> Profile &amp; Settings
        </h1>
        <p className="text-muted-foreground mt-1">{user?.email}</p>
      </div>

      <Card glass id="settings">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-secondary" /> Home &amp; Work Shortcuts
          </CardTitle>
          <CardDescription>
            Save your frequent locations for one-tap searches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            fullName={profile?.full_name ?? ""}
            homeLocation={profile?.home_location ?? ""}
            workLocation={profile?.work_location ?? ""}
          />
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-accent" /> Preferences
          </CardTitle>
          <CardDescription>
            Language and theme can be toggled from the navigation bar at any time. Accessibility (voice-first) mode is available as a search priority on the Search page.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-bus" /> Feedback
          </CardTitle>
          <CardDescription>
            Spotted an incorrect route, fare, or place name? Let us know — this helps improve the dataset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackForm />
        </CardContent>
      </Card>
    </div>
  );
}
