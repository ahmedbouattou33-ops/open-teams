"use client";

import { Bookmark, X } from "lucide-react";
import { useMessagesStore } from "@/stores/messages";
import { useUiStore } from "@/stores/ui";
import { Markdown } from "@/components/chat/Markdown";
import { useLanguage } from "@/lib/i18n";

export default function SavedItemsPanel() {
  const { t } = useLanguage();
  const open = useUiStore((state) => state.savedOpen);
  const setOpen = useUiStore((state) => state.setSavedOpen);
  const savedIds = useUiStore((state) => state.savedMessageIds);
  const messagesByChannel = useMessagesStore((state) => state.messagesByChannel);
  if (!open) return null;
  const saved = Object.values(messagesByChannel).flatMap((messages) => messages.filter((message) => savedIds.has(message.id)));
  return <aside className="fixed inset-y-0 right-0 z-[60] flex w-[min(440px,100vw)] flex-col border-l border-surface-border bg-surface-raised shadow-2xl" aria-label={t("savedItems")}>
    <header className="flex items-center justify-between border-b border-surface-border px-4 py-3"><div className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold text-white">{t("savedItems")}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label={t("closeSavedItems")} className="rounded-lg p-2 text-slate-400 hover:bg-surface-hover hover:text-white"><X className="h-4 w-4" /></button></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">{saved.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{t("noSavedItems")}</p> : <div className="space-y-3">{saved.map((message) => <article key={message.id} className="rounded-xl bg-surface p-3"><p className="mb-1 text-xs text-slate-500">{message.authorId.slice(0, 8)} · {new Date(message.createdAt).toLocaleString()}</p>{message.content.type === "plain" ? <Markdown text={message.content.body} /> : <p className="text-sm text-slate-500">Encrypted message</p>}</article>)}</div>}</div>
  </aside>;
}
