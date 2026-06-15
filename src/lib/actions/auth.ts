"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  const supabase = createClient();

  const result = await safeAuthCall(() =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })
  );

  if ("authServiceError" in result) return { error: result.authServiceError };

  const { error } = result;

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Check your email to verify your account before logging in." };
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = createClient();

  const result = await safeAuthCall(() => supabase.auth.signInWithPassword({ email, password }));
  if ("authServiceError" in result) return { error: result.authServiceError };

  const { error, data } = result;

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Please verify your email address before logging in. Check your inbox for the verification link." };
    }
    return { error: error.message };
  }

  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    return { error: "Please verify your email before logging in." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/login");
}

export async function resendVerification(email: string) {
  const supabase = createClient();
  const result = await safeAuthCall(() =>
    supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    })
  );
  if ("authServiceError" in result) return { error: result.authServiceError };

  const { error } = result;
  if (error) return { error: error.message };
  return { success: true };
}

async function safeAuthCall<T>(call: () => Promise<T>): Promise<T | { authServiceError: string }> {
  try {
    return await call();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("fetch failed")) {
      return {
        authServiceError:
          "Could not reach the login service. Check your internet connection and Supabase project URL, then try again.",
      };
    }

    return { authServiceError: message || "Authentication service failed. Please try again." };
  }
}
