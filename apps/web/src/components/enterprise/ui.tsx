"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ModuleHeader(props: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-white">{props.title}</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-slate-400">{props.description}</p>
      </div>
      {props.actions ? <div className="flex items-center gap-2">{props.actions}</div> : null}
    </header>
  );
}

export function Card(props: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-lg",
        props.className,
      )}
    >
      {props.title ? (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {props.title}
        </h3>
      ) : null}
      {props.children}
    </section>
  );
}

export function StatCard(props: { label: string; value: string | number; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneClass =
    props.tone === "good"
      ? "text-emerald-400"
      : props.tone === "warn"
        ? "text-amber-400"
        : props.tone === "bad"
          ? "text-rose-400"
          : "text-white";
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised px-4 py-3">
      <p className={cn("text-2xl font-bold", toneClass)}>{props.value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {props.label}
      </p>
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  OPEN: "border-sky-400/40 bg-sky-500/15 text-sky-300",
  IN_PROGRESS: "border-amber-400/40 bg-amber-500/15 text-amber-300",
  RESOLVED: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  CRITICAL: "border-rose-400/40 bg-rose-500/15 text-rose-300",
  HIGH: "border-orange-400/40 bg-orange-500/15 text-orange-300",
  MEDIUM: "border-yellow-400/40 bg-yellow-500/15 text-yellow-300",
  LOW: "border-slate-400/40 bg-slate-500/15 text-slate-300",
  APPROVED: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  REJECTED: "border-rose-400/40 bg-rose-500/15 text-rose-300",
  PENDING: "border-slate-400/40 bg-slate-500/15 text-slate-300",
  NEW: "border-indigo-400/40 bg-indigo-500/15 text-indigo-300",
  ACKNOWLEDGED: "border-amber-400/40 bg-amber-500/15 text-amber-300",
  CLOSED: "border-slate-400/40 bg-slate-500/15 text-slate-300",
  INFO: "border-sky-400/40 bg-sky-500/15 text-sky-300",
  WARNING: "border-amber-400/40 bg-amber-500/15 text-amber-300",
};

export function Badge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        BADGE_TONES[label] ?? "border-slate-400/40 bg-slate-500/15 text-slate-300",
      )}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

export function TableShell(props: { headers: readonly string[]; children: ReactNode; empty?: string; isEmpty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-black/20">
            {props.headers.map((header) => (
              <th
                key={header}
                className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/60">
          {props.isEmpty ? (
            <tr>
              <td colSpan={props.headers.length} className="px-3 py-6 text-center text-xs text-slate-500">
                {props.empty ?? "No records yet."}
              </td>
            </tr>
          ) : (
            props.children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function LabeledInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        className="input-dark py-1.5 text-sm"
      />
    </label>
  );
}

export function SelectInput<T extends string>(props: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        className="input-dark appearance-none py-1.5 text-sm [&>option]:bg-surface-overlay"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GhostButton(props: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      className={cn(
        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
        props.danger
          ? "text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
          : "text-slate-400 hover:bg-accent-muted/40 hover:text-white",
      )}
    >
      {props.children}
    </button>
  );
}
