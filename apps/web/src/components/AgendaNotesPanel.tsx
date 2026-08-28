"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, FileText, Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { AgendaEventDTO, PersonalNoteDTO } from "@openteams/shared-types";
import { useTranslation } from "@/lib/i18n";

export default function AgendaNotesPanel() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<readonly AgendaEventDTO[]>([]);
  const [notes, setNotes] = useState<readonly PersonalNoteDTO[]>([]);
  const [tab, setTab] = useState<"agenda" | "notes">("agenda");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true); setError(null);
    try {
      const [nextEvents, nextNotes] = await Promise.all([api.listAgendaEvents(), api.listNotes()]);
      setEvents(nextEvents); setNotes(nextNotes);
    } catch { setError(t("noDataYet")); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (tab === "agenda" && startsAt && Number.isNaN(new Date(startsAt).getTime())) {
      setError(t("optionalDetails"));
      return;
    }
    setBusy(true); setError(null);
    try {
      if (tab === "agenda") {
        const start = startsAt ? new Date(startsAt) : new Date(Date.now() + 3600000);
        await api.createAgendaEvent({ title, description: content || undefined, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600000).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, visibility: "PRIVATE", participantUserIds: [], participantPermission: "VIEW" });
      } else await api.createNote({ title, content, isPrivate: true });
      setTitle(""); setContent(""); setStartsAt(""); await refresh();
    } catch { setError(t("noDataYet")); }
    finally { setBusy(false); }
  }

  return <aside className="flex min-h-full w-full shrink-0 flex-col bg-panel p-4" aria-label="Personal agenda and notes">
    <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("personalSpace")}</p><h2 className="text-lg font-semibold text-foreground">{t("agendaNotes")}</h2></div><button onClick={() => void refresh()} className="rounded-md p-2 text-muted hover:bg-surface hover:text-foreground" aria-label={t("refresh")}> <RefreshCw className="h-4 w-4" /></button></div>
    <div className="mb-4 grid grid-cols-2 rounded-lg bg-surface p-1"><button onClick={() => setTab("agenda")} className={`flex items-center justify-center gap-2 rounded-md px-2 py-2 text-sm ${tab === "agenda" ? "bg-accent text-white" : "text-muted"}`}><CalendarDays className="h-4 w-4" />{t("agenda")}</button><button onClick={() => setTab("notes")} className={`flex items-center justify-center gap-2 rounded-md px-2 py-2 text-sm ${tab === "notes" ? "bg-accent text-white" : "text-muted"}`}><FileText className="h-4 w-4" />{t("notes")}</button></div>
    <form onSubmit={submit} className="mb-5 space-y-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tab === "agenda" ? t("appointmentTitle") : t("noteTitle")} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={tab === "agenda" ? t("optionalDetails") : t("writePrivateNote")} className="min-h-20 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent" />{tab === "agenda" && <input type="datetime-local" min={new Date().toISOString().slice(0, 16)} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground" />}<button disabled={busy || !title.trim()} className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" />{t("savePrivate")}</button></form>
    {error && <p className="mb-3 rounded-md bg-red-500/10 p-2 text-xs text-red-400">{error}</p>}
    <div className="space-y-2 overflow-y-auto">{tab === "agenda" ? events.map((item) => <div key={item.id} className="rounded-lg border border-border bg-surface p-3"><p className="font-medium text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted">{new Date(item.startsAt).toLocaleString()}</p><span className="mt-2 inline-block rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400">{t("private")}</span></div>) : notes.map((item) => <div key={item.id} className="rounded-lg border border-border bg-surface p-3"><p className="font-medium text-foreground">{item.title}</p><p className="mt-1 line-clamp-3 text-sm text-muted">{item.content}</p><span className="mt-2 inline-block rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400">{t("private")}</span></div>)}{!busy && (tab === "agenda" ? events.length : notes.length) === 0 && <p className="py-8 text-center text-sm text-muted">{t("noDataYet")}</p>}</div>
  </aside>;
}
