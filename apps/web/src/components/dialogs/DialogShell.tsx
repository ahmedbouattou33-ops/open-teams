"use client";

import type { FormEvent } from "react";

export function DialogShell(props: {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  children: React.ReactNode;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <form
        onSubmit={props.onSubmit}
        className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-overlay p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-lg font-bold text-white">{props.title}</h2>
        {props.children}
        {props.error ? <p className="mt-3 text-sm text-rose-400">{props.error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button type="submit" disabled={props.busy} className="btn-primary">
            {props.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
