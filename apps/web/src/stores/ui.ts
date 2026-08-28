import { create } from "zustand";
import type { MessageDTO } from "@openteams/shared-types";

export type CallType = "AUDIO" | "VIDEO";
export type AppNotification = { id: string; title: string; body: string; kind: "mention" | "member" | "system"; createdAt: string; read: boolean };

export interface PendingCallRequest {
  readonly workspaceId: string;
  readonly channelId: string;
  readonly channelName: string;
  readonly callType: CallType;
  /** Captured in the originating user gesture before WebRTC signalling starts. */
  readonly localStream?: MediaStream;
}

interface UiState {
  readonly commandPaletteOpen: boolean;
  readonly shortcutsOpen: boolean;
  readonly threadRoot: MessageDTO | null;
  readonly savedOpen: boolean;
  readonly savedMessageIds: ReadonlySet<string>;
  readonly filesDrawerOpen: boolean;
  readonly profileOpen: boolean;
  readonly dashboardOpen: boolean;
  readonly membersOpen: boolean;
  readonly agendaOpen: boolean;
  readonly workPlanOpen: boolean;
  readonly channelDetailsOpen: boolean;
  readonly addMemberOpen: boolean;
  readonly realtimeConnected: boolean;
  readonly presenceByWorkspace: Readonly<Record<string, Readonly<Record<string, "ONLINE" | "OFFLINE">>>>;
  readonly notifications: readonly AppNotification[];
  readonly typingByChannel: Readonly<Record<string, ReadonlySet<string>>>;
  readonly pendingCall: PendingCallRequest | null;
  readonly callError: string | null;
  readonly customStatus: string;
  readonly unreadByChannel: Readonly<Record<string, number>>;
  readonly pinnedMessageIds: ReadonlySet<string>;
  readonly replyTo: MessageDTO | null;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setThreadRoot: (message: MessageDTO | null) => void;
  setSavedOpen: (open: boolean) => void;
  toggleSaved: (messageId: string) => void;
  setFilesDrawerOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  setDashboardOpen: (open: boolean) => void;
  setMembersOpen: (open: boolean) => void;
  setAgendaOpen: (open: boolean) => void;
  setWorkPlanOpen: (open: boolean) => void;
  setChannelDetailsOpen: (open: boolean) => void;
  setAddMemberOpen: (open: boolean) => void;
  setRealtimeConnected: (connected: boolean) => void;
  setPresence: (workspaceId: string, userId: string, status: "ONLINE" | "OFFLINE") => void;
  setCallError: (error: string | null) => void;
  setCustomStatus: (status: string) => void;
  incrementUnread: (channelId: string) => void;
  markChannelRead: (channelId: string) => void;
  togglePinned: (messageId: string) => void;
  addNotification: (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markNotificationsRead: () => void;
  setTyping: (channelId: string, userId: string, active: boolean) => void;
  startCall: (request: PendingCallRequest) => void;
  endCall: () => void;
  setReplyTo: (message: MessageDTO | null) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  commandPaletteOpen: false,
  shortcutsOpen: false,
  threadRoot: null,
  savedOpen: false,
  savedMessageIds: new Set<string>(),
  filesDrawerOpen: false,
  profileOpen: false,
  dashboardOpen: false,
  membersOpen: false,
  agendaOpen: false,
  workPlanOpen: false,
  channelDetailsOpen: false,
  addMemberOpen: false,
  realtimeConnected: false,
  presenceByWorkspace: {},
  notifications: [],
  typingByChannel: {},
  pendingCall: null,
  callError: null,
  customStatus: "",
  unreadByChannel: {},
  pinnedMessageIds: new Set<string>(),
  replyTo: null,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set({ commandPaletteOpen: !get().commandPaletteOpen }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setThreadRoot: (message) => set({ threadRoot: message }),
  setSavedOpen: (open) => set({ savedOpen: open }),
  toggleSaved: (messageId) => set((state) => { const next = new Set(state.savedMessageIds); if (next.has(messageId)) next.delete(messageId); else next.add(messageId); return { savedMessageIds: next }; }),
  setFilesDrawerOpen: (open) => set({ filesDrawerOpen: open }),
  setProfileOpen: (open) => set({ profileOpen: open }),
  setDashboardOpen: (open) => set({ dashboardOpen: open }),
  setMembersOpen: (open) => set({ membersOpen: open }),
  setAgendaOpen: (open) => set({ agendaOpen: open }),
  setWorkPlanOpen: (open) => set({ workPlanOpen: open }),
  setChannelDetailsOpen: (open) => set({ channelDetailsOpen: open }),
  setAddMemberOpen: (open) => set({ addMemberOpen: open }),
  setRealtimeConnected: (connected) => set({ realtimeConnected: connected }),
  setPresence: (workspaceId, userId, status) => set((state) => ({ presenceByWorkspace: { ...state.presenceByWorkspace, [workspaceId]: { ...(state.presenceByWorkspace[workspaceId] ?? {}), [userId]: status } } })),
  setCallError: (error) => set({ callError: error }),
  setCustomStatus: (status) => set({ customStatus: status }),
  incrementUnread: (channelId) => set((state) => ({ unreadByChannel: { ...state.unreadByChannel, [channelId]: (state.unreadByChannel[channelId] ?? 0) + 1 } })),
  markChannelRead: (channelId) => set((state) => state.unreadByChannel[channelId] ? { unreadByChannel: { ...state.unreadByChannel, [channelId]: 0 } } : state),
  togglePinned: (messageId) => set((state) => { const next = new Set(state.pinnedMessageIds); if (next.has(messageId)) next.delete(messageId); else next.add(messageId); return { pinnedMessageIds: next }; }),
  addNotification: (notification) => set((state) => ({ notifications: [{ ...notification, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString(), read: false }, ...state.notifications].slice(0, 50) })),
  markNotificationsRead: () => set((state) => ({ notifications: state.notifications.map((notification) => ({ ...notification, read: true })) })),
  setTyping: (channelId, userId, active) => set((state) => {
    const next = new Set(state.typingByChannel[channelId] ?? []);
    if (active) next.add(userId);
    else next.delete(userId);
    return { typingByChannel: { ...state.typingByChannel, [channelId]: next } };
  }),
  startCall: (request) => set({ pendingCall: request, callError: null }),
  endCall: () => set({ pendingCall: null }),
  setReplyTo: (message) => set({ replyTo: message }),
}));
