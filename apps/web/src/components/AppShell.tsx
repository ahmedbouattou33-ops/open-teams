"use client";

import { useEffect } from "react";
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

export default function AppShell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const resetWorkspaces = useWorkspaceStore((s) => s.reset);

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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;
    joinChannelOverSocket(activeChannelId);
    void useMessagesStore.getState().loadHistory(activeChannelId);
    void api.markAsRead({ channelId: activeChannelId }).catch(() => undefined);
  }, [activeChannelId]);

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
          <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
            <MessageList />
            <Composer />
          </section>
          <FilesDrawerPanel />
        </div>
      </div>
      <CommandPalette onSignOut={handleSignOut} />
      <CallLayer />
      <WatermarkOverlay />
      <PanicButton />
    </div>
  );
}

function FilesDrawerPanel() {
  const open = useUiStore((s) => s.filesDrawerOpen);
  return open ? <FilesDrawer /> : null;
}
