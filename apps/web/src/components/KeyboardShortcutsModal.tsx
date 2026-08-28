"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useUiStore } from "@/stores/ui";

const shortcuts = [
  ["Ctrl / Cmd + K", "Open global search"],
  ["Ctrl / Cmd + /", "Open keyboard shortcuts"],
  ["Enter", "Send message"],
  ["Shift + Enter", "New line"],
  ["Ctrl / Cmd + Shift + L", "Emergency lock"],
] as const;

export default function KeyboardShortcutsModal() {
  const open = useUiStore((state) => state.shortcutsOpen);
  const setOpen = useUiStore((state) => state.setShortcutsOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
    <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Keyboard shortcuts</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close shortcuts" className="rounded-lg p-2 text-slate-400 hover:bg-surface-hover hover:text-white"><X className="h-4 w-4" /></button></div>
      <div className="space-y-2">{shortcuts.map(([key, description]) => <div key={key} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"><span className="text-slate-300">{description}</span><kbd className="rounded bg-black/30 px-2 py-1 font-mono text-xs text-slate-300">{key}</kbd></div>)}</div>
    </div>
  </div>;
}
