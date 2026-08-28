"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ChannelDTO } from "@openteams/shared-types";
import { useTranslation } from "@/lib/i18n";

type Role = "ADMIN" | "MEMBER" | "GUEST";
const EMPTY_CHANNELS: readonly ChannelDTO[] = [];

export default function AddMemberModal() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.addMemberOpen);
  const setOpen = useUiStore((s) => s.setAddMemberOpen);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const channels = useWorkspaceStore((s) => workspaceId ? s.channelsByWorkspace[workspaceId] ?? EMPTY_CHANNELS : EMPTY_CHANNELS);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [directAdd, setDirectAdd] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null); setInviteUrl(null); setCopied(false);
  }, [open]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !email.trim()) return;
    setBusy(true); setError(null); setInviteUrl(null);
    try {
      const result = await api.createInvite({ workspaceId, email: email.trim().toLowerCase(), role, channelIds, directAdd, expiresInHours: 168 });
      if (result.directAdded) setInviteUrl("Member added directly to the workspace.");
      else setInviteUrl(`${window.location.origin}${result.inviteUrl}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add or invite this member");
    } finally { setBusy(false); }
  }

  async function copyLink() {
    if (!inviteUrl || inviteUrl.startsWith("Member added")) return;
    await navigator.clipboard?.writeText(inviteUrl);
    setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t("addMemberInvite")}>
    <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Workspace access</p><h2 className="mt-1 text-xl font-bold text-white">{t("addMemberInvite")}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close add member dialog" className="rounded-lg p-2 text-slate-400 hover:bg-surface-hover hover:text-white"><X className="h-5 w-5" /></button></div>
      {!workspaceId ? <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">Create or select a workspace before adding members.</p> : <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-slate-300">{t("emailOrUsername")}<input required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alice@company.com" className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm text-white outline-none focus:border-accent" /></label>
        <label className="block text-sm text-slate-300">{t("initialRole")}<select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm text-white outline-none focus:border-accent"><option value="ADMIN">{t("workspaceAdmin")}</option><option value="MEMBER">{t("member")}</option><option value="GUEST">{t("guest")}</option></select></label>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={directAdd} onChange={(e) => setDirectAdd(e.target.checked)} className="accent-[var(--accent)]" /> {t("directAdd")}</label>
        <fieldset><legend className="mb-2 text-sm font-semibold text-white">{t("channelAssignment")}</legend><div className="grid max-h-32 gap-2 overflow-y-auto sm:grid-cols-2">{channels.map((channel) => <label key={channel.id} className="flex items-center gap-2 rounded-lg bg-surface p-2 text-sm text-slate-300"><input type="checkbox" checked={channelIds.includes(channel.id)} onChange={(e) => setChannelIds((current) => e.target.checked ? [...current, channel.id] : current.filter((id) => id !== channel.id))} className="accent-[var(--accent)]" /><span className="truncate"># {channel.name}</span></label>)}{channels.length === 0 ? <p className="text-xs text-slate-500">{t("noChannelsAvailable")}</p> : null}</div></fieldset>
        {error ? <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
        {inviteUrl ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"><div className="flex items-center gap-2"><Check className="h-4 w-4" />{inviteUrl.startsWith("Member added") ? inviteUrl : t("invitationGenerated")}</div>{!inviteUrl.startsWith("Member added") ? <button type="button" onClick={() => void copyLink()} className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100"><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : t("copyLink")}</button> : null}</div> : null}
        <button disabled={busy || !email.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Users className="h-4 w-4" />{busy ? "Working…" : directAdd ? t("addMember") : t("generateInvite")}</button>
      </form>}
    </div>
  </div>;
}
