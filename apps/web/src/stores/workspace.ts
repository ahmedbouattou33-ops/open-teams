import { create } from "zustand";
import type { ChannelDTO, WorkspaceDTO } from "@openteams/shared-types";
import { api } from "@/lib/api";

interface WorkspaceState {
  readonly workspaces: readonly WorkspaceDTO[];
  readonly channelsByWorkspace: Readonly<Record<string, readonly ChannelDTO[]>>;
  readonly activeWorkspaceId: string | null;
  readonly activeChannelId: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  loadWorkspaces: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  setActiveChannel: (channelId: string) => void;
  addWorkspace: (workspace: WorkspaceDTO) => Promise<void>;
  addChannel: (channel: ChannelDTO) => Promise<void>;
  reset: () => void;
}

const emptyChannels: readonly ChannelDTO[] = [];

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  channelsByWorkspace: {},
  activeWorkspaceId: null,
  activeChannelId: null,
  loading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const workspaces = await api.listWorkspaces();
      set({ workspaces, loading: false });
      const current = get().activeWorkspaceId;
      const firstId = workspaces[0]?.id;
      if ((!current || !workspaces.some((w) => w.id === current)) && firstId) {
        await get().selectWorkspace(firstId);
      }
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "Failed to load workspaces" });
    }
  },

  selectWorkspace: async (workspaceId) => {
    if (!workspaceId) return;
    const existing = get().channelsByWorkspace[workspaceId] ?? emptyChannels;
    set({ activeWorkspaceId: workspaceId, activeChannelId: null });
    try {
      const channels = await api.listChannels(workspaceId);
      set((state) => ({ channelsByWorkspace: { ...state.channelsByWorkspace, [workspaceId]: channels } }));
      const first = channels.find((c) => c.joined) ?? channels[0];
      if (first) set({ activeChannelId: first.id });
    } catch (error) {
      // Auth failures are handled centrally by api.ts; preserve a useful local error for non-auth failures.
      set((state) => ({ channelsByWorkspace: { ...state.channelsByWorkspace, [workspaceId]: existing }, error: error instanceof Error ? error.message : "Failed to load channels" }));
    }
  },

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  addWorkspace: async (workspace) => {
    set((state) => ({
      workspaces: [...state.workspaces.filter((w) => w.id !== workspace.id), workspace],
      channelsByWorkspace: { ...state.channelsByWorkspace, [workspace.id]: [] },
    }));
    await get().selectWorkspace(workspace.id);
  },

  addChannel: async (channel) => {
    set((state) => {
      const list = state.channelsByWorkspace[channel.workspaceId] ?? emptyChannels;
      return {
        channelsByWorkspace: {
          ...state.channelsByWorkspace,
          [channel.workspaceId]: list.some((c) => c.id === channel.id) ? list : [...list, channel],
        },
      };
    });
    if (get().activeWorkspaceId === channel.workspaceId) {
      set({ activeChannelId: channel.id });
    }
  },

  reset: () =>
    set({
      workspaces: [],
      channelsByWorkspace: {},
      activeWorkspaceId: null,
      activeChannelId: null,
      error: null,
    }),
}));
