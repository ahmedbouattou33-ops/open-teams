"use client";

import { useState } from "react";
import { Command } from "cmdk";
import { FileBox, Hash, Lock, LogOut, Phone, Plus, Video } from "lucide-react";
import type { ChannelDTO } from "@openteams/shared-types";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { CreateChannelDialog } from "@/components/dialogs/WorkspaceDialogs";

export default function CommandPalette({ onSignOut }: { onSignOut: () => void }) {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const channelsByWorkspace = useWorkspaceStore((s) => s.channelsByWorkspace);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const setActiveChannel = useWorkspaceStore((s) => s.setActiveChannel);
  const startCall = useUiStore((s) => s.startCall);
  const setFilesDrawerOpen = useUiStore((s) => s.setFilesDrawerOpen);

  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const channels: readonly ChannelDTO[] =
    (activeWorkspaceId ? channelsByWorkspace[activeWorkspaceId] : undefined) ?? [];
  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  function run(action: () => void): void {
    setOpen(false);
    action();
  }

  return (
    <>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Global command palette"
        overlayClassName="fixed inset-0 z-50 animate-fade-in bg-black/60"
        contentClassName="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-surface-border bg-surface-overlay shadow-2xl"
      >
        <Command.Input
          autoFocus
          placeholder="Jump to a channel, workspace or action…"
          className="w-full border-b border-surface-border bg-transparent px-5 py-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-slate-500">
            No results found.
          </Command.Empty>

          <Group heading="Channels">
            {channels.map((channel) => (
              <Item
                key={channel.id}
                onSelect={() => run(() => setActiveChannel(channel.id))}
                icon={
                  channel.type === "PUBLIC" ? (
                    <Hash className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Lock className="h-4 w-4 text-slate-500" />
                  )
                }
              >
                {channel.name}
              </Item>
            ))}
          </Group>

          <Group heading="Workspaces">
            {workspaces.map((workspace) => (
              <Item
                key={workspace.id}
                onSelect={() =>
                  run(() => {
                    void selectWorkspace(workspace.id);
                  })
                }
              >
                {workspace.name}
              </Item>
            ))}
          </Group>

          <Group heading="Actions">
            <Item
              icon={<FileBox className="h-4 w-4 text-slate-500" />}
              onSelect={() => run(() => setFilesDrawerOpen(true))}
            >
              Open file vault
            </Item>

            {activeChannel && activeWorkspaceId ? (
              <>
                <Item
                  icon={<Phone className="h-4 w-4 text-slate-500" />}
                  onSelect={() =>
                    run(() =>
                      startCall({
                        workspaceId: activeWorkspaceId,
                        channelId: activeChannel.id,
                        channelName: activeChannel.name,
                        callType: "AUDIO",
                      }),
                    )
                  }
                >
                  Start voice call in #{activeChannel.name}
                </Item>
                <Item
                  icon={<Video className="h-4 w-4 text-slate-500" />}
                  onSelect={() =>
                    run(() =>
                      startCall({
                        workspaceId: activeWorkspaceId,
                        channelId: activeChannel.id,
                        channelName: activeChannel.name,
                        callType: "VIDEO",
                      }),
                    )
                  }
                >
                  Start video call in #{activeChannel.name}
                </Item>
              </>
            ) : null}

            <Item
              icon={<Plus className="h-4 w-4 text-slate-500" />}
              onSelect={() =>
                run(() => setCreateChannelOpen(true))
              }
            >
              Create a new channel
            </Item>

            <Item
              icon={<LogOut className="h-4 w-4 text-slate-500" />}
              onSelect={() => run(onSignOut)}
            >
              Sign out
            </Item>
          </Group>
        </Command.List>
      </Command.Dialog>

      {createChannelOpen && activeWorkspaceId ? (
        <CreateChannelDialog
          workspaceId={activeWorkspaceId}
          onClose={() => setCreateChannelOpen(false)}
        />
      ) : null}
    </>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-500"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  children,
  onSelect,
  icon,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors data-[selected=true]:bg-accent-muted/50 data-[selected=true]:text-white"
    >
      {icon}
      <span>{children}</span>
    </Command.Item>
  );
}
