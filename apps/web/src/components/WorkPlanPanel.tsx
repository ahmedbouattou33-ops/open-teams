"use client";

import { FormEvent, useEffect, useState } from "react";
import { ClipboardList, ExternalLink, Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace";
import type { TeamToolDTO, WorkTaskDTO } from "@openteams/shared-types";
import { useTranslation } from "@/lib/i18n";

const columnKeys: readonly WorkTaskDTO["status"][] = ["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

export default function WorkPlanPanel() {
  const { t } = useTranslation();
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [tasks, setTasks] = useState<readonly WorkTaskDTO[]>([]);
  const [tools, setTools] = useState<readonly TeamToolDTO[]>([]);
  const [title, setTitle] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function refresh() { if (!workspaceId) return; setBusy(true); setError(null); try { const [t, x] = await Promise.all([api.listWorkTasks({ workspaceId }), api.listTeamTools({ workspaceId })]); setTasks(t); setTools(x); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load work plan"); } finally { setBusy(false); } }
  useEffect(() => { void refresh(); }, [workspaceId]);
  async function submit(e: FormEvent) { e.preventDefault(); if (!workspaceId || !title.trim()) return; setBusy(true); try { await api.createWorkTask({ workspaceId, title, status: "TODO", priority: "MEDIUM" }); setTitle(""); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create task"); } finally { setBusy(false); } }
  const columnLabels: Record<WorkTaskDTO["status"], string> = { BACKLOG: t("backlog"), TODO: t("todo"), IN_PROGRESS: t("inProgress"), BLOCKED: t("blocked"), DONE: t("done") };
  return <aside className="flex min-h-full w-full shrink-0 flex-col overflow-y-auto bg-panel p-4" aria-label={t("workPlan")}><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("teamWorkspace")}</p><h2 className="text-lg font-semibold text-foreground">{t("workPlan")}</h2></div><button onClick={() => void refresh()} className="rounded-md p-2 text-muted hover:bg-surface hover:text-foreground" aria-label={t("refresh")}><RefreshCw className="h-4 w-4" /></button></div><form onSubmit={submit} className="mb-5 flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("newTask")} className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /><button disabled={busy || !workspaceId || !title.trim()} className="rounded-md bg-accent px-3 text-white disabled:opacity-50" aria-label={t("addTask")}><Plus className="h-4 w-4" /></button></form>{error && <p className="mb-3 rounded-md bg-red-500/10 p-2 text-xs text-red-400">{error}</p>}<div className="space-y-4">{columnKeys.map((key) => { const label = columnLabels[key]; return <section key={key}> <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><ClipboardList className="h-3.5 w-3.5" />{label}<span className="ml-auto rounded-full bg-surface px-2 py-0.5">{tasks.filter((t) => t.status === key).length}</span></h3><div className="space-y-2">{tasks.filter((t) => t.status === key).map((task) => <article key={task.id} className="rounded-lg border border-border bg-surface p-3"><p className="text-sm font-medium text-foreground">{task.title}</p><p className="mt-1 text-[11px] text-muted">{task.priority}{task.dueAt ? ` · ${new Date(task.dueAt).toLocaleDateString()}` : ""}</p></article>)}</div></section>; })}{!busy && tasks.length === 0 && <p className="py-5 text-center text-sm text-muted">{t("noTasks")}</p>}</div>{tools.length > 0 && <section className="mt-6 border-t border-border pt-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("sharedTools")}</h3>{tools.map((tool) => <a key={tool.id} href={tool.url ?? "#"} target="_blank" rel="noreferrer" className="mb-2 flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface/70">{tool.name}<ExternalLink className="h-3.5 w-3.5 text-muted" /></a>)}</section>}</aside>;
}
