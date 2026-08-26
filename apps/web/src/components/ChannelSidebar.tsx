"use client";

import { useState, type FormEvent } from "react";
import { Hash, Lock, LogOut, Plus, Settings2 } from "lucide-react";
import type { ChannelDTO } from "@openteams/shared-types";
import { cn, initials } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import { CreateChannelDialog } from "@/components/dialogs/WorkspaceDialogs";

export default function ChannelSidebar({ onSignOut }: { onSignOut: () => void }) {
  const user = useAuthStore((s) => s.user);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const channelsByWorkspace = useWorkspaceStore((s) => s.channelsByWorkspace);
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const setActiveChannel = useWorkspaceStore((s) => s.setActiveChannel);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const channels = (activeWorkspaceId ? channelsByWorkspace[activeWorkspaceId] : undefined) ?? [];

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-surface-border bg-surface-raised md:flex">
      <header className="flex h-14 items-center justify-between border-b border-surface-border px-4">
        <h1 className="truncate text-sm font-bold text-white" title={activeWorkspace?.name}>
          {activeWorkspace?.name ?? "No workspace"}
        </h1>
        {activeWorkspace ? (
          <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-300">
            {activeWorkspace.role}
          </span>
        ) : null}
      </header>

      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Channels</span>
        <button
          type="button"
          title={activeWorkspaceId ? "Create channel" : "Select a workspace first"}
          disabled={!activeWorkspaceId}
          onClick={() => setCreateChannelOpen(true)}
          className="rounded p-0.5 text-slate-400 transition-colors hover:text-white disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {channels.map((channel) => (
          <li key={channel.id}>
            <ChannelButton
              channel={channel}
              active={channel.id === activeChannelId}
              onClick={() => setActiveChannel(channel.id)}
            />
          </li>
        ))}
        {channels.length === 0 ? (
          <li className="px-2 py-3 text-xs text-slate-500">No channels yet.</li>
        ) : null}
      </ul>

      <footer className="flex items-center gap-2 border-t border-surface-border bg-surface px-3 py-3">
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
            {user ? initials(user.displayName) : "?"}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-emerald-500" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{user?.displayName ?? "—"}</p>
          <p className="truncate text-xs text-slate-400">{user?.email ?? ""}</p>
        </div>
        <button
          type="button"
          title="Sign out"
          onClick={onSignOut}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-surface-hover hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </footer>

      {createChannelOpen && activeWorkspaceId ? (
        <CreateChannelDialog workspaceId={activeWorkspaceId} onClose={() => setCreateChannelOpen(false)} />
      ) : null}
    </aside>
  );
}

function ChannelButton({
  channel,
  active,
  onClick,
}: {
  channel: ChannelDTO;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        active ? "bg-accent-muted/60 font-semibold text-white" : "text-slate-400 hover:bg-surface-hover hover:text-slate-200",
      )}
    >
      {channel.type === "PRIVATE" || channel.type === "DIRECT" ? (
        <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" />
      ) : (
        <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />
      )}
      <span className="truncate">{channel.name}</span>
      {channel.isEncrypted ? <Settings2 className="ml-auto h-3 w-3 shrink-0 text-emerald-400/70" /> : null}
    </button>
  );
}
