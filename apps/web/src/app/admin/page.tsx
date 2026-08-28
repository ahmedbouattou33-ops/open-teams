"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  useEffect(() => { if (!user) router.replace("/login"); }, [user, router]);
  if (!user) return <main className="min-h-screen bg-surface p-8 text-white">Loading secure admin console…</main>;
  return <AdminDashboard initialWorkspaceId={activeWorkspaceId ?? undefined} />;
}
