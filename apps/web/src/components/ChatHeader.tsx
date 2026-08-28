"use client";

import { useState } from "react";
import { CalendarDays, FileBox, Hash, ListChecks, Lock, Phone, Search, ShieldCheck, Sparkles, UserRound, Users, Video, X } from "lucide-react";
import Link from "next/link";
import { useUiStore, type CallType } from "@/stores/ui";
import { errorMessage } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import NotificationCenter from "@/components/NotificationCenter";
import { useLanguage } from "@/lib/i18n";
import { api } from "@/lib/api";

export default function ChatHeader() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const channelsByWorkspace = useWorkspaceStore((s) => s.channelsByWorkspace);
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const filesDrawerOpen = useUiStore((s) => s.filesDrawerOpen);
  const setFilesDrawerOpen = useUiStore((s) => s.setFilesDrawerOpen);
  const startCall = useUiStore((s) => s.startCall);
  const setCallError = useUiStore((s) => s.setCallError);
  const callError = useUiStore((s) => s.callError);
  const setProfileOpen = useUiStore((s) => s.setProfileOpen);
  const membersOpen = useUiStore((s) => s.membersOpen);
  const agendaOpen = useUiStore((s) => s.agendaOpen);
  const workPlanOpen = useUiStore((s) => s.workPlanOpen);
  const setMembersOpen = useUiStore((s) => s.setMembersOpen);
  const setAgendaOpen = useUiStore((s) => s.setAgendaOpen);
  const setWorkPlanOpen = useUiStore((s) => s.setWorkPlanOpen);
  const setAddMemberOpen = useUiStore((s) => s.setAddMemberOpen);
  const typingCount = useUiStore((s) => (activeChannelId ? (s.typingByChannel[activeChannelId]?.size ?? 0) : 0));

  const channel =
    (activeWorkspaceId ? channelsByWorkspace[activeWorkspaceId] : undefined)?.find(
      (c) => c.id === activeChannelId,
    ) ?? null;
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  async function summarizeChat(): Promise<void> {
    if (!channel) return;
    setSummaryBusy(true); setSummaryError(null);
    try { setSummary((await api.summarizeChannel(channel.id)).summary); }
    catch (cause) { setSummaryError(cause instanceof Error ? cause.message : "Unable to summarize chat"); }
    finally { setSummaryBusy(false); }
  }

  async function launchCall(callType: CallType): Promise<void> {
    if (!channel || !workspace) return;
    setCallError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError("Microphone and camera access are unavailable in this browser or context.");
      return;
    }
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "VIDEO" });
      startCall({ workspaceId: workspace.id, channelId: channel.id, channelName: channel.name, callType, localStream });
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setCallError(name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "Microphone/camera permission was denied. Allow access in the browser, then try again."
        : `Unable to access media devices: ${errorMessage(cause)}`);
    }
  }

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-surface-border bg-surface px-4">
      <div className="min-w-0 flex-1">
        {channel ? (
          <div className="flex min-w-0 items-center gap-2">
            {channel.type === "PUBLIC" ? (
              <Hash className="h-4 w-4 shrink-0 text-slate-500" />
            ) : (
              <Lock className="h-4 w-4 shrink-0 text-slate-500" />
            )}
            <h2 className="truncate text-sm font-bold text-white">{channel.name}</h2>
            {typingCount > 0 ? <span className="hidden text-[11px] text-accent sm:inline">{typingCount === 1 ? "Someone is typing…" : `${typingCount} people are typing…`}</span> : null}
            <span className="hidden rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:inline">
              {workspace?.name ?? ""}
            </span>
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-slate-400">Select a channel</h2>
        )}
      </div>

      {callError ? <p role="alert" className="max-w-[280px] truncate rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200" title={callError}>{callError}</p> : null}
      <ThemeToggle />
      <LanguageSwitcher />
      <NotificationCenter />
      <button
        type="button"
        title="Open profile"
        onClick={() => setProfileOpen(true)}
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white"
      >
        <UserRound className="h-4 w-4" />
      </button>

      <button type="button" title="Add member or invite" onClick={() => setAddMemberOpen(true)} className="hidden items-center gap-2 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/80 sm:flex"><Users className="h-3.5 w-3.5" /><span className="hidden xl:inline">Add member</span></button>
      <IconButton title={agendaOpen ? "Close agenda and notes" : "Open agenda and notes"} active={agendaOpen} onClick={() => setAgendaOpen(!agendaOpen)}><CalendarDays className="h-4 w-4" /></IconButton>
      <IconButton title={workPlanOpen ? "Close work plan" : "Open work plan"} active={workPlanOpen} onClick={() => setWorkPlanOpen(!workPlanOpen)}><ListChecks className="h-4 w-4" /></IconButton>
      <button type="button" title={membersOpen ? "Close members" : "Open members"} onClick={() => setMembersOpen(!membersOpen)} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${membersOpen ? "border-accent bg-accent/15 text-white" : "border-surface-border text-slate-400 hover:border-accent hover:text-white"}`}>
        <Users className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Members</span>
      </button>

      <Link
        href="/enterprise"
        title="Enterprise console"
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white"
      >
        <ShieldCheck className="h-4 w-4" />
      </Link>

      <button
        type="button"
        title="Search (Ctrl+K)"
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-accent hover:text-white"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Jump to…</span>
        <kbd className="hidden rounded bg-black/40 px-1 font-mono text-[10px] md:inline">Ctrl K</kbd>
      </button>

      {channel ? <IconButton title={t("summarizeChat")} onClick={() => void summarizeChat()} active={summaryBusy}><Sparkles className="h-4 w-4" /></IconButton> : null}
      <div className="flex items-center gap-0.5">
        <IconButton
          title={filesDrawerOpen ? "Close file vault" : "Open file vault"}
          active={filesDrawerOpen}
          onClick={() => setFilesDrawerOpen(!filesDrawerOpen)}
        >
          <FileBox className="h-4 w-4" />
        </IconButton>
        {channel && workspace ? (
          <>
            <IconButton
              title="Start voice call"
              onClick={() => void launchCall("AUDIO")}
            >
              <Phone className="h-4 w-4" />
            </IconButton>
            <IconButton
              title="Start video call"
              onClick={() => void launchCall("VIDEO")}
            >
              <Video className="h-4 w-4" />
            </IconButton>
          </>
        ) : null}
      </div>
      {summary || summaryError ? <div className="absolute right-4 top-16 z-50 w-[min(480px,calc(100vw-2rem))] rounded-xl border border-surface-border bg-surface-overlay p-4 shadow-2xl"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-white">{t("summarizeChat")}</p><button type="button" aria-label="Close summary" onClick={() => { setSummary(null); setSummaryError(null); }} className="rounded p-1 text-slate-400 hover:bg-surface-hover hover:text-white"><X className="h-4 w-4" /></button></div>{summaryError ? <p role="alert" className="mt-3 text-xs text-rose-300">{summaryError}</p> : <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{summary}</p>}</div> : null}
    </header>
  );
}

function IconButton(props: {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      className={`rounded-lg p-2 transition-colors ${
        props.active ? "bg-accent-muted/60 text-white" : "text-slate-400 hover:bg-surface-hover hover:text-white"
      }`}
    >
      {props.children}
    </button>
  );
}
