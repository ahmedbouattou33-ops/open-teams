"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { initials, avatarColor } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const PREF_KEY = "openteams.preferences.v1";
const STATUS_KEY = "openteams.custom-status.v1";

type Preferences = { compactMode: boolean; soundNotifications: boolean };

export default function ProfilePanel({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.profileOpen);
  const setOpen = useUiStore((s) => s.setProfileOpen);
  const user = useAuthStore((s) => s.user);
  const customStatus = useUiStore((s) => s.customStatus);
  const setCustomStatus = useUiStore((s) => s.setCustomStatus);
  const [preferences, setPreferences] = useState<Preferences>({ compactMode: false, soundNotifications: true });
  const [saved, setSaved] = useState(false);
  const [statusDraft, setStatusDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    try {
      const raw = window.localStorage.getItem(PREF_KEY);
      if (raw) setPreferences((current) => ({ ...current, ...JSON.parse(raw) as Partial<Preferences> }));
      setStatusDraft(window.localStorage.getItem(STATUS_KEY) ?? customStatus);
    } catch { /* Ignore malformed local preferences and keep secure defaults. */ }
  }, [open, customStatus]);

  if (!open || !user) return null;

  function saveStatus(): void {
    const next = statusDraft.trim();
    setCustomStatus(next);
    window.localStorage.setItem(STATUS_KEY, next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  function updatePreferences(next: Preferences) {
    setPreferences(next);
    window.localStorage.setItem(PREF_KEY, JSON.stringify(next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <aside className="absolute right-4 top-16 z-40 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl" aria-label="Profile and preferences">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t("account")}</p><h2 className="mt-1 text-lg font-bold text-white">{t("profilePreferences")}</h2>
        </div>
        <button type="button" title={t("closeProfile")} onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-surface-hover hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface p-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white ${avatarColor(user.id)}`}>{initials(user.displayName || user.email)}</div>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{user.displayName || "OpenTeams user"}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div>
        <ShieldCheck className="h-4 w-4 text-emerald-400" aria-label="Protected session" />
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><UserRound className="h-4 w-4 text-accent" /> {t("sessionSecurity")}</div>
        <div className="rounded-xl border border-surface-border p-3 text-xs leading-5 text-slate-400">{t("sessionDescription")}</div>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-sm font-semibold text-white">{t("preferences")}</p>
        <Toggle label={t("compactLayout")} checked={preferences.compactMode} onChange={(checked) => updatePreferences({ ...preferences, compactMode: checked })} />
        <Toggle label={t("soundNotifications")} checked={preferences.soundNotifications} onChange={(checked) => updatePreferences({ ...preferences, soundNotifications: checked })} />
      </div>

      <div className="mt-5 space-y-2"><p className="text-sm font-semibold text-white">{t("customStatus")}</p><div className="flex gap-2"><input value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)} placeholder={t("statusPlaceholder")} className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent" /><button type="button" onClick={saveStatus} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white">{t("saveStatus")}</button></div><button type="button" onClick={() => { setStatusDraft(""); setCustomStatus(""); window.localStorage.removeItem(STATUS_KEY); }} className="text-xs text-slate-400 hover:text-white">{t("clearStatus")}</button></div>

      <Link href="/admin" onClick={() => setOpen(false)} className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/20">Enterprise Admin Console</Link>

      <div className="mt-5 flex items-center justify-between border-t border-surface-border pt-4">
        <span className="text-xs text-emerald-400">{saved ? <><Check className="mr-1 inline h-3.5 w-3.5" />{t("savedLocally")}</> : t("deviceLocal")}</span>
        <button type="button" onClick={onSignOut} className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"><LogOut className="h-3.5 w-3.5" /> {t("secureSignOut")}</button>
      </div>
    </aside>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-300"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /></label>;
}
