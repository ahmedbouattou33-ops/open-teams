"use client";

import { useEffect, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { useMessagesStore } from "@/stores/messages";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { audit, auditActions } from "@/lib/audit";
import { joinChannelOverSocket, useRealtime } from "@/hooks/use-realtime";
import WorkspaceRail from "@/components/WorkspaceRail";
import ChannelSidebar from "@/components/ChannelSidebar";
import ChatHeader from "@/components/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import Composer from "@/components/chat/Composer";
import FilesDrawer from "@/components/files/FilesDrawer";
import CommandPalette from "@/components/command/CommandPalette";
import CallLayer from "@/components/call/CallLayer";
import WatermarkOverlay from "@/components/security/WatermarkOverlay";
import PanicButton from "@/components/security/PanicButton";
import ProfilePanel from "@/components/ProfilePanel";
import AgendaNotesPanel from "@/components/AgendaNotesPanel";
import WorkPlanPanel from "@/components/WorkPlanPanel";
import WorkspaceMembersPanel from "@/components/WorkspaceMembersPanel";
import DashboardPanel from "@/components/DashboardPanel";
import AddMemberModal from "@/components/AddMemberModal";
import KeyboardShortcutsModal from "@/components/KeyboardShortcutsModal";
import ThreadDrawer from "@/components/ThreadDrawer";
import SavedItemsPanel from "@/components/SavedItemsPanel";

export default function AppShell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const resetWorkspaces = useWorkspaceStore((s) => s.reset);
  const markChannelRead = useUiStore((s) => s.markChannelRead);
  const [dragActive, setDragActive] = useState(false);
  const [dropFiles, setDropFiles] = useState<readonly File[]>([]);

  useRealtime(true);

  useEffect(() => {
    if (user) void loadWorkspaces();
  }, [user, loadWorkspaces]);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useUiStore.getState().toggleCommandPalette();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();
        useUiStore.getState().setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;
    joinChannelOverSocket(activeChannelId);
    markChannelRead(activeChannelId);
    void useMessagesStore.getState().loadHistory(activeChannelId);
    void api.markAsRead({ channelId: activeChannelId }).catch(() => undefined);
  }, [activeChannelId, markChannelRead]);

  function handleDrop(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) setDropFiles(files);
  }

  function handleSignOut(): void {
    audit(auditActions.logout, { details: "Session closed by user" });
    clearSession();
    resetWorkspaces();
    router.replace("/login");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <WorkspaceRail />
      <ChannelSidebar onSignOut={handleSignOut} />
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <ChatHeader />
        <div className="flex min-h-0 flex-1">
          <section className="relative flex min-w-0 flex-1 flex-col" aria-label="Conversation" onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}>
            <MessageList />
            <Composer dropFiles={dropFiles} onDropFilesConsumed={() => setDropFiles([])} />
            {dragActive ? <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 text-sm font-semibold text-white">Drop files to upload securely</div> : null}
          </section>
          <DrawerLayer />
        </div>
      </div>
      <CommandPalette onSignOut={handleSignOut} />
      <ProfilePanel onSignOut={handleSignOut} />
      <CallLayer />
      <WatermarkOverlay />
      <PanicButton />
      <DashboardPanelWrapper />
      <AddMemberModal />
      <KeyboardShortcutsModal />
      <ThreadDrawer />
      <SavedItemsPanel />
    </div>
  );
}

function DashboardPanelWrapper() {
  const open = useUiStore((s) => s.dashboardOpen);
  return open ? <DashboardPanel /> : null;
}

function DrawerLayer() {
  const filesOpen = useUiStore((s) => s.filesDrawerOpen);
  const agendaOpen = useUiStore((s) => s.agendaOpen);
  const workPlanOpen = useUiStore((s) => s.workPlanOpen);
  const membersOpen = useUiStore((s) => s.membersOpen);
  const closeAll = () => {
    useUiStore.getState().setFilesDrawerOpen(false);
    useUiStore.getState().setAgendaOpen(false);
    useUiStore.getState().setWorkPlanOpen(false);
    useUiStore.getState().setMembersOpen(false);
  };
  if (!filesOpen && !agendaOpen && !workPlanOpen && !membersOpen) return null;
  return <>
    <button type="button" aria-label="Close open drawer" onClick={closeAll} className="fixed inset-0 z-30 cursor-default bg-black/40" />
    <div className="fixed inset-y-0 right-0 z-40 w-[min(420px,100vw)] overflow-y-auto border-l border-surface-border bg-surface-raised shadow-2xl">
      {filesOpen ? <FilesDrawer /> : null}
      {agendaOpen ? <AgendaNotesPanel /> : null}
      {workPlanOpen ? <WorkPlanPanel /> : null}
      {membersOpen ? <WorkspaceMembersPanel /> : null}
    </div>
  </>;
}
