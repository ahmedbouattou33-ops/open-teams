"use client";

import { FileBox, Hash, Lock, Phone, Search, ShieldCheck, Video } from "lucide-react";
import Link from "next/link";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";

export default function ChatHeader() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const channelsByWorkspace = useWorkspaceStore((s) => s.channelsByWorkspace);
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const filesDrawerOpen = useUiStore((s) => s.filesDrawerOpen);
  const setFilesDrawerOpen = useUiStore((s) => s.setFilesDrawerOpen);
  const startCall = useUiStore((s) => s.startCall);

  const channel =
    (activeWorkspaceId ? channelsByWorkspace[activeWorkspaceId] : undefined)?.find(
      (c) => c.id === activeChannelId,
    ) ?? null;
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border bg-surface px-4">
      <div className="min-w-0 flex-1">
        {channel ? (
          <div className="flex min-w-0 items-center gap-2">
            {channel.type === "PUBLIC" ? (
              <Hash className="h-4 w-4 shrink-0 text-slate-500" />
            ) : (
              <Lock className="h-4 w-4 shrink-0 text-slate-500" />
            )}
            <h2 className="truncate text-sm font-bold text-white">{channel.name}</h2>
            <span className="hidden rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:inline">
              {workspace?.name ?? ""}
            </span>
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-slate-400">Select a channel</h2>
        )}
      </div>

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
              onClick={() =>
                startCall({
                  workspaceId: workspace.id,
                  channelId: channel.id,
                  channelName: channel.name,
                  callType: "AUDIO",
                })
              }
            >
              <Phone className="h-4 w-4" />
            </IconButton>
            <IconButton
              title="Start video call"
              onClick={() =>
                startCall({
                  workspaceId: workspace.id,
                  channelId: channel.id,
                  channelName: channel.name,
                  callType: "VIDEO",
                })
              }
            >
              <Video className="h-4 w-4" />
            </IconButton>
          </>
        ) : null}
      </div>
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
