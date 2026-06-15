"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { resendVerification } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { MapPin, Loader2, AlertCircle, MailCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setError("Please verify your email address before logging in. Check your inbox for the verification link.");
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        setError("Please verify your email before logging in.");
        setLoading(false);
        return;
      }

      setLoading(false);
      router.refresh();
      router.push(redirectTo ?? "/dashboard");
    } catch (err: any) {
      const message = err?.message || "An unexpected error occurred. Please try again.";
      setError(
        message.toLowerCase().includes("fetch failed")
          ? "Could not reach Supabase from the browser. Check your internet connection and Supabase project settings, then try again."
          : message
      );
      setLoading(false);
    }
  }

  async function handleResend(formData: FormData) {
    const email = formData.get("email") as string;
    if (!email) return;
    const result = await resendVerification(email);
    if (!result.error) setResent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card glass className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <Link href="/" className="inline-flex mx-auto items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary via-secondary to-accent text-white mb-2 shadow-lg">
            <MapPin className="h-6 w-6" />
          </Link>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            {redirectTo ? "Sign in to continue to your search." : "Sign in to your TN Transport account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const formData = new FormData(form);
              await handleSubmit(formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required placeholder="••••••••" autoComplete="current-password" />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p>{error}</p>
                  {error.toLowerCase().includes("verify") && (
                    <form action={handleResend} className="mt-2">
                      <input type="hidden" name="email" />
                      <button
                        type="button"
                        onClick={(e) => {
                          const form = e.currentTarget.closest("form") as HTMLFormElement;
                          const emailInput = form.querySelector('input[name="email"]') as HTMLInputElement;
                          const mainEmailInput = document.getElementById("email") as HTMLInputElement;
                          emailInput.value = mainEmailInput.value;
                          form.requestSubmit();
                        }}
                        className="underline font-medium"
                      >
                        Resend verification email
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {resent && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                <MailCheck className="h-4 w-4" /> Verification email sent — check your inbox.
              </div>
            )}

            <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
