"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UsersDirectory from "@/components/UsersDirectory";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import { useRealtime } from "@/hooks/use-realtime";

export default function UsersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  useRealtime(Boolean(user));
  useEffect(() => { if (!user) router.replace("/login"); }, [user, router]);
  if (!user) return <main className="min-h-screen bg-surface p-8 text-white">Loading users directory…</main>;
  return <UsersDirectory key={workspaceId ?? "none"} />;
}
