import { create } from "zustand";
import type { MessageDTO } from "@openteams/shared-types";

export type CallType = "AUDIO" | "VIDEO";

export interface PendingCallRequest {
  readonly workspaceId: string;
  readonly channelId: string;
  readonly channelName: string;
  readonly callType: CallType;
}

interface UiState {
  readonly commandPaletteOpen: boolean;
  readonly filesDrawerOpen: boolean;
  readonly pendingCall: PendingCallRequest | null;
  readonly replyTo: MessageDTO | null;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setFilesDrawerOpen: (open: boolean) => void;
  startCall: (request: PendingCallRequest) => void;
  endCall: () => void;
  setReplyTo: (message: MessageDTO | null) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  commandPaletteOpen: false,
  filesDrawerOpen: false,
  pendingCall: null,
  replyTo: null,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set({ commandPaletteOpen: !get().commandPaletteOpen }),
  setFilesDrawerOpen: (open) => set({ filesDrawerOpen: open }),
  startCall: (request) => set({ pendingCall: request }),
  endCall: () => set({ pendingCall: null }),
  setReplyTo: (message) => set({ replyTo: message }),
}));
