"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, History, Star, Settings, LogOut, User as UserIcon } from "lucide-react";

export function UserMenu({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="glass" size="icon" className="rounded-full font-semibold">
          {initial}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="glass-strong z-50 min-w-56 rounded-xl p-2 shadow-2xl animate-fade-in"
        >
          <div className="px-3 py-2 text-sm text-muted-foreground truncate">{email}</div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <MenuLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</MenuLink>
          <MenuLink href="/history" icon={<History className="h-4 w-4" />}>Search History</MenuLink>
          <MenuLink href="/saved" icon={<Star className="h-4 w-4" />}>Saved Routes</MenuLink>
          <MenuLink href="/profile" icon={<UserIcon className="h-4 w-4" />}>Profile</MenuLink>
          <MenuLink href="/profile#settings" icon={<Settings className="h-4 w-4" />}>Settings</MenuLink>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <DropdownMenu.Item asChild>
      <Link href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent/50 transition-colors">
        {icon} {children}
      </Link>
    </DropdownMenu.Item>
  );
}
