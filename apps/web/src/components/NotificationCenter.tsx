"use client";

import { Bell, Check, X } from "lucide-react";
import { useUiStore } from "@/stores/ui";
import { useState } from "react";

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const notifications = useUiStore((s) => s.notifications);
  const markRead = useUiStore((s) => s.markNotificationsRead);
  const unread = notifications.filter((item) => !item.read).length;
  return <div className="relative"><button type="button" aria-label="Notifications" title="Notifications" onClick={() => { setOpen((value) => !value); markRead(); }} className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-surface-hover hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"><Bell className="h-4 w-4" />{unread ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span> : null}</button>{open ? <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-surface-border bg-surface-raised p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h2><button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-surface-hover"><X className="h-4 w-4" /></button></div>{notifications.length ? <div className="max-h-80 space-y-1 overflow-y-auto">{notifications.map((item) => <div key={item.id} className="rounded-xl border border-surface-border p-3"><div className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 text-accent" /><div><p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.body}</p></div></div></div>)}</div> : <p className="py-6 text-center text-xs text-slate-500">No new notifications.</p>}</div> : null}</div>;
}
