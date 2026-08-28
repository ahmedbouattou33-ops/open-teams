"use client";

import { useState } from "react";
import { LayoutDashboard, Plus } from "lucide-react";
import { avatarColor, cn, initials } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import { CreateWorkspaceDialog } from "@/components/dialogs/WorkspaceDialogs";
import { useUiStore } from "@/stores/ui";

export default function WorkspaceRail() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const [createOpen, setCreateOpen] = useState(false);
  const setDashboardOpen = useUiStore((s) => s.setDashboardOpen);

  return (
    <nav
      aria-label="Workspaces"
      className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-surface-border bg-surface py-3"
    >
      {workspaces.map((workspace) => (
        <button
          key={workspace.id}
          type="button"
          title={`${workspace.name} (${workspace.role.toLowerCase()})`}
          onClick={() => void selectWorkspace(workspace.id)}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white transition-all",
            avatarColor(workspace.id),
            workspace.id === activeWorkspaceId
              ? "ring-2 ring-white ring-offset-2 ring-offset-surface"
              : "opacity-70 hover:opacity-100",
          )}
        >
          {initials(workspace.name)}
        </button>
      ))}

      <button
        type="button"
        title="Open workspace dashboard"
        onClick={() => setDashboardOpen(true)}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-slate-400 transition-colors hover:border-accent hover:text-accent"
      >
        <LayoutDashboard className="h-5 w-5" />
      </button>

      <button
        type="button"
        title="Create workspace"
        onClick={() => setCreateOpen(true)}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-surface-border text-slate-400 transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="h-5 w-5" />
      </button>

      {createOpen ? <CreateWorkspaceDialog onClose={() => setCreateOpen(false)} /> : null}
    </nav>
  );
}
