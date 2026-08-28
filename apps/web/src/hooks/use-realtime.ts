"use client";

import { useEffect } from "react";
import type { MessagingSocketEvent } from "@openteams/shared-types";
import { SERVICES, httpToWs } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore } from "@/stores/messages";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";

type Listener = (event: MessagingSocketEvent) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let connectedToken: string | null = null;
let attempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(event: MessagingSocketEvent): void {
  for (const listener of listeners) listener(event);
}

function clearReconnect(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export function connectRealtime(token: string): void {
  if (socket && connectedToken === token && socket.readyState <= WebSocket.OPEN) return;
  disconnectRealtime();
  connectedToken = token;

  const ws = new WebSocket(`${httpToWs(SERVICES.messaging)}/ws?token=${encodeURIComponent(token)}`);
  socket = ws;

  ws.onopen = () => {
    attempts = 0;
    useUiStore.getState().setRealtimeConnected(true);
  };

  ws.onmessage = (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw.data));
    } catch {
      return;
    }
    const type = (parsed as { type?: unknown } | null)?.type;
    if (typeof type === "string") notify(parsed as MessagingSocketEvent);
  };

  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    useUiStore.getState().setRealtimeConnected(false);
    if (connectedToken !== token) return;
    attempts += 1;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
    reconnectTimer = setTimeout(() => connectRealtime(token), delay);
  };

  ws.onerror = () => ws.close();
}

export function disconnectRealtime(): void {
  clearReconnect();
  connectedToken = null;
  const current = socket;
  socket = null;
  useUiStore.getState().setRealtimeConnected(false);
  if (current) {
    current.onclose = null;
    current.onerror = null;
    current.onmessage = null;
    current.close();
  }
}

export function sendTypingFrame(channelId: string, active: boolean): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", channelId, active }));
}

export function joinChannelOverSocket(channelId: string): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "join", channelId }));
  }
}

export function useRealtime(enabled: boolean): void {
  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (!enabled || !token) {
      disconnectRealtime();
      return;
    }

    const listener: Listener = (event) => {
      switch (event.type) {
        case "message.created": {
          useMessagesStore.getState().receiveMessage(event.message);
          const currentUserId = useAuthStore.getState().user?.id;
          const activeChannelId = useWorkspaceStore.getState().activeChannelId;
          if (event.message.authorId !== currentUserId) {
            if (activeChannelId !== event.message.channelId) useUiStore.getState().incrementUnread(event.message.channelId);
            useUiStore.getState().addNotification({ title: "New message", body: event.message.content.type === "plain" ? event.message.content.body.slice(0, 120) : "Encrypted message", kind: "system" });
          }
          break;
        }
        case "message.edited":
          useMessagesStore.getState().applyEditedMessage(event.message);
          break;
        case "message.deleted":
          useMessagesStore.getState().removeMessage(event.channelId, event.messageId);
          break;
        case "member.joined":
          useUiStore.getState().addNotification({ title: "Member joined", body: `${event.displayName} joined the workspace`, kind: "member" });
          break;
        case "presence.updated":
          useUiStore.getState().setPresence(event.workspaceId, event.userId, event.status);
          break;
        case "typing":
          useUiStore.getState().setTyping(event.channelId, event.userId, event.active);
          if (event.active) window.setTimeout(() => useUiStore.getState().setTyping(event.channelId, event.userId, false), 4_000);
          break;
        case "reaction.updated":
          useMessagesStore
            .getState()
            .applyReactions(event.channelId, event.messageId, event.reactions);
          break;
        default:
          break;
      }
    };

    const unsubscribe = subscribeRealtime(listener);
    connectRealtime(token);

    return () => {
      unsubscribe();
    };
  }, [enabled]);
}
