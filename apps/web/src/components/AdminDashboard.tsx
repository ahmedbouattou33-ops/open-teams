"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Download, RefreshCw, ShieldCheck, Users, Database, Cpu, Server } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace";

type Health = Awaited<ReturnType<typeof api.adminHealth>>;
type Stats = Awaited<ReturnType<typeof api.adminStats>>;

type Props = { initialWorkspaceId?: string };

export default function AdminDashboard({ initialWorkspaceId }: Props) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const workspaceId = initialWorkspaceId ?? activeWorkspaceId;
  const actualRole = workspaces.find((workspace) => workspace.id === workspaceId)?.role ?? "MEMBER";
  const [viewAs, setViewAs] = useState<"ACTUAL" | "MEMBER" | "GUEST" | "AUDITOR">("ACTUAL");
  const effectiveRole = viewAs === "ACTUAL" ? actualRole : viewAs;
  const canSeeAdmin = ["OWNER", "ADMIN", "AUDITOR"].includes(effectiveRole);
  const [health, setHealth] = useState<Health | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true); setError(null);
    try {
      const [nextHealth, nextStats, nextLogs] = await Promise.all([api.adminHealth(workspaceId), api.adminStats(workspaceId), api.adminSiemLogs(workspaceId)]);
      setHealth(nextHealth); setStats(nextStats); setLogs(nextLogs.events);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load admin dashboard"); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 10000); return () => window.clearInterval(timer); }, [refresh]);

  const onlineCount = useMemo(() => health?.services.filter((service) => service.status === "ONLINE").length ?? 0, [health]);
  async function exportLogs(format: "json" | "csv") {
    if (!workspaceId) return;
    setExporting(true);
    try { await api.adminExportAudit(workspaceId, format); } catch (cause) { setError(cause instanceof Error ? cause.message : "Audit export failed"); } finally { setExporting(false); }
  }

  if (!workspaceId) return <main className="min-h-screen bg-surface p-8 text-white"><h1 className="text-2xl font-bold">Enterprise Admin Dashboard</h1><p className="mt-3 text-slate-400">Select or create a workspace before opening the admin console.</p></main>;
  if (!canSeeAdmin) return <main className="min-h-screen bg-surface p-8 text-white"><h1 className="text-2xl font-bold">Enterprise Admin Dashboard</h1><p className="mt-3 text-slate-400">This console is available to Workspace Admins, Owners and Auditors.</p></main>;
  return <main className="min-h-screen overflow-y-auto bg-surface p-4 text-white sm:p-8">
    <header className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Governance & observability</p><h1 className="mt-2 text-3xl font-bold">Enterprise Admin Dashboard</h1><p className="mt-2 text-sm text-slate-400">Live workspace telemetry, security controls and operational analytics.</p></div><div className="flex flex-wrap items-center gap-2"><Link href="/users" className="rounded-xl border border-surface-border px-3 py-2 text-sm text-slate-300 hover:bg-surface-hover">All Users</Link>{["OWNER", "ADMIN"].includes(actualRole) ? <label className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-xs text-slate-400">View As<select aria-label="View dashboard as" value={viewAs} onChange={(event) => setViewAs(event.target.value as typeof viewAs)} className="bg-transparent text-slate-200 outline-none"><option value="ACTUAL">Actual ({actualRole})</option><option value="MEMBER">Member</option><option value="GUEST">Guest</option><option value="AUDITOR">Auditor</option></select></label> : null}<button type="button" onClick={() => void refresh()} className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-slate-300 hover:bg-surface-hover"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</button></div></header>
    {error ? <div role="alert" className="mx-auto mt-6 max-w-7xl rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}
    <section className="mx-auto mt-8 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<Server />} label="Services online" value={`${onlineCount}/${health?.services.length ?? 0}`} /><Metric icon={<Users />} label="Active members" value={String(stats?.activeMembers ?? "—")} /><Metric icon={<ShieldCheck />} label="Active sessions" value={String(stats?.activeSessions ?? "—")} /><Metric icon={<Database />} label="Pending invites" value={String(stats?.pendingInvites ?? "—")} /></section>
    <section className="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[1.2fr_0.8fr]"><Panel title="System health" icon={<Activity />}><div className="grid gap-2 sm:grid-cols-2">{health?.services.map((service) => <div key={service.name} className="flex items-center justify-between rounded-xl bg-surface px-3 py-3"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${service.status === "ONLINE" ? "bg-emerald-400" : service.status === "DEGRADED" ? "bg-amber-400" : "bg-rose-400"}`} /><span className="text-sm text-slate-200">{service.name}</span></div><span className="text-xs text-slate-500">{service.status} · {service.latencyMs}ms</span></div>)}</div></Panel><Panel title="Workspace governance" icon={<Cpu />}><div className="space-y-3 text-sm text-slate-300"><Row label="Users in system" value={stats?.users} /><Row label="Channels" value={stats?.channels} /><Row label="Work tasks" value={stats?.tasks} /><Row label="Seat usage" value={`${stats?.activeMembers ?? 0} active / policy controlled`} /></div></Panel></section>
    <section className="mx-auto mt-6 max-w-7xl"><Panel title="Security & SIEM audit console" icon={<ShieldCheck />}><div className="mb-4 flex flex-wrap gap-2"><button type="button" onClick={() => void exportLogs("json")} className="flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-xs text-slate-300 hover:bg-surface-hover"><Download className="h-3.5 w-3.5" />{exporting ? "Exporting…" : "Export JSON"}</button><button type="button" onClick={() => void exportLogs("csv")} className="flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-xs text-slate-300 hover:bg-surface-hover"><Download className="h-3.5 w-3.5" />{exporting ? "Exporting…" : "Export CSV"}</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">Timestamp</th><th className="px-3 py-2">Event</th><th className="px-3 py-2">Actor/IP</th><th className="px-3 py-2">Details</th></tr></thead><tbody>{logs.map((log, index) => <tr key={index} className="border-t border-surface-border text-slate-300"><td className="px-3 py-3">{String(log.timestamp ?? "—")}</td><td className="px-3 py-3">{String(log.event ?? "—")}</td><td className="px-3 py-3">{String(log.actor ?? log.ip ?? "—")}</td><td className="px-3 py-3">{String(log.details ?? "—")}</td></tr>)}</tbody></table>{logs.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No persisted SIEM events available for this workspace.</p> : null}</div></Panel></section>
  </main>;
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-surface-border bg-surface-raised p-4"><div className="flex items-center gap-2 text-accent">{icon}<span className="text-xs uppercase tracking-wider text-slate-500">{label}</span></div><p className="mt-3 text-2xl font-bold text-white">{value}</p></div>; }
function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-surface-border bg-surface-raised p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold text-white">{icon}{title}</h2>{children}</section>; }
function Row({ label, value }: { label: string; value: unknown }) { return <div className="flex items-center justify-between border-b border-surface-border pb-2"><span>{label}</span><strong className="text-white">{String(value ?? "—")}</strong></div>; }
