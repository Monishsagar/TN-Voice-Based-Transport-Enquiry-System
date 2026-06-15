"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card glass className="max-w-md w-full">
            <CardContent className="p-8 text-center space-y-4">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <h2 className="text-xl font-semibold">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. You can try again, or go back to the dashboard.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="gradient" onClick={() => reset()}>Try again</Button>
                <Button variant="glass" onClick={() => (window.location.href = "/dashboard")}>Dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
