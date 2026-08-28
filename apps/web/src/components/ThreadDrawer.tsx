"use client";

import { useEffect, useState } from "react";
import { CornerUpLeft, X } from "lucide-react";
import type { MessageDTO } from "@openteams/shared-types";
import { api, type HistoryPage } from "@/lib/api";
import { useUiStore } from "@/stores/ui";
import { Markdown } from "@/components/chat/Markdown";

export default function ThreadDrawer() {
  const root = useUiStore((state) => state.threadRoot);
  const setRoot = useUiStore((state) => state.setThreadRoot);
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    setPage(null); setError(null);
    void api.history({ channelId: root.channelId, threadOf: root.id, limit: 50 }).then((next) => { if (!cancelled) setPage(next); }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load thread"); });
    return () => { cancelled = true; };
  }, [root]);

  if (!root) return null;
  const replies = page?.messages ?? [];
  return <aside className="fixed inset-y-0 right-0 z-[60] flex w-[min(440px,100vw)] flex-col border-l border-surface-border bg-surface-raised shadow-2xl" aria-label="Thread replies">
    <header className="flex items-center justify-between border-b border-surface-border px-4 py-3"><div className="flex items-center gap-2"><CornerUpLeft className="h-4 w-4 text-accent" /><div><p className="text-sm font-semibold text-white">Thread replies</p><p className="text-xs text-slate-500">{replies.length} replies</p></div></div><button type="button" onClick={() => setRoot(null)} aria-label="Close thread" className="rounded-lg p-2 text-slate-400 hover:bg-surface-hover hover:text-white"><X className="h-4 w-4" /></button></header>
    <div className="border-b border-surface-border p-4"><p className="mb-1 text-xs text-slate-500">Original message</p><Markdown text={root.content.type === "plain" ? root.content.body : "Encrypted message"} /></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">{error ? <p role="alert" className="text-xs text-rose-300">{error}</p> : null}{!error && !page ? <p className="text-sm text-slate-500">Loading thread…</p> : null}{!error && page && replies.length === 0 ? <p className="text-sm text-slate-500">No replies yet.</p> : null}<div className="space-y-3">{replies.map((reply: MessageDTO) => <article key={reply.id} className="rounded-xl bg-surface p-3"><p className="mb-1 text-xs font-semibold text-slate-300">{reply.authorId.slice(0, 8)} <span className="font-normal text-slate-500">{new Date(reply.createdAt).toLocaleString()}</span></p>{reply.content.type === "plain" ? <Markdown text={reply.content.body} /> : <p className="text-sm text-slate-500">Encrypted message</p>}</article>)}</div></div>
  </aside>;
}
