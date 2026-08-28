"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const [state, setState] = useState<"ready" | "loading" | "error" | "done">("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!user) router.replace(`/login?next=/invite/${params.code}`); }, [user, params.code, router]);

  async function accept() {
    setState("loading"); setError(null);
    try { const result = await api.acceptInvite({ code: params.code }); await selectWorkspace(result.workspaceId); setState("done"); router.replace("/"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Invitation could not be accepted"); setState("error"); }
  }

  if (!user) return <main className="flex min-h-screen items-center justify-center bg-surface p-6"><div className="text-center text-muted">Redirecting to sign in…</div></main>;
  return <main className="flex min-h-screen items-center justify-center bg-surface p-6"><section className="w-full max-w-md rounded-xl border border-border bg-panel p-8 shadow-xl"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent"><ShieldCheck className="h-6 w-6" /></div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Workspace invitation</p><h1 className="mt-2 text-2xl font-semibold text-foreground">Join this Team?</h1><p className="mt-3 text-sm text-muted">You are signed in as <strong className="text-foreground">{user.displayName}</strong>. Confirm to accept this secure invitation.</p>{error && <p role="alert" className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}<button onClick={() => void accept()} disabled={state === "loading"} className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 font-medium text-white disabled:opacity-50">{state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}Accept invitation</button></section></main>;
}
