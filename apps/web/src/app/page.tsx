"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuthStore } from "@/stores/auth";

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) router.replace("/login");
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return (
      <main className="flex h-screen items-center justify-center bg-surface">
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-label="Loading" />
      </main>
    );
  }

  return <AppShell />;
}
