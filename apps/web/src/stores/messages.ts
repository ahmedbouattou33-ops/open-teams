import { create } from "zustand";
import type { MessageDTO, ReactionSummary } from "@openteams/shared-types";
import { api } from "@/lib/api";

function sortMessages(messages: readonly MessageDTO[]): MessageDTO[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

interface MessagesState {
  readonly messagesByChannel: Readonly<Record<string, readonly MessageDTO[]>>;
  readonly olderCursorByChannel: Readonly<Record<string, string | null>>;
  readonly loadingByChannel: Readonly<Record<string, boolean>>;
  readonly myReactions: Readonly<Record<string, ReadonlySet<string>>>;
  readonly expiryByMessageId: Readonly<Record<string, number>>;
  markEphemeral: (messageId: string, ttlSeconds: number) => void;
  loadHistory: (channelId: string) => Promise<void>;
  loadOlder: (channelId: string) => Promise<void>;
  receiveMessage: (message: MessageDTO) => void;
  applyEditedMessage: (message: MessageDTO) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  applyReactions: (
    channelId: string,
    messageId: string,
    reactions: readonly ReactionSummary[],
  ) => void;
  toggleReaction: (message: MessageDTO, emoji: string) => Promise<void>;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByChannel: {},
  olderCursorByChannel: {},
  loadingByChannel: {},
  myReactions: {},
  expiryByMessageId: {},

  markEphemeral: (messageId, ttlSeconds) =>
    set((state) => ({
      expiryByMessageId: {
        ...state.expiryByMessageId,
        [messageId]: Date.now() + ttlSeconds * 1_000,
      },
    })),

  loadHistory: async (channelId) => {
    if (get().loadingByChannel[channelId]) return;
    set((state) => ({ loadingByChannel: { ...state.loadingByChannel, [channelId]: true } }));
    try {
      const page = await api.history({ channelId, limit: 50 });
      set((state) => ({
        messagesByChannel: { ...state.messagesByChannel, [channelId]: sortMessages(page.messages) },
        olderCursorByChannel: { ...state.olderCursorByChannel, [channelId]: page.nextCursor },
      }));
    } finally {
      set((state) => ({ loadingByChannel: { ...state.loadingByChannel, [channelId]: false } }));
    }
  },

  loadOlder: async (channelId) => {
    const cursor = get().olderCursorByChannel[channelId];
    if (!cursor || get().loadingByChannel[channelId]) return;
    set((state) => ({ loadingByChannel: { ...state.loadingByChannel, [channelId]: true } }));
    try {
      const page = await api.history({ channelId, limit: 50, before: cursor });
      set((state) => {
        const existing = state.messagesByChannel[channelId] ?? [];
        const knownIds = new Set(existing.map((m) => m.id));
        const merged = sortMessages([
          ...existing,
          ...page.messages.filter((m) => !knownIds.has(m.id)),
        ]);
        return {
          messagesByChannel: { ...state.messagesByChannel, [channelId]: merged },
          olderCursorByChannel: { ...state.olderCursorByChannel, [channelId]: page.nextCursor },
        };
      });
    } finally {
      set((state) => ({ loadingByChannel: { ...state.loadingByChannel, [channelId]: false } }));
    }
  },

  receiveMessage: (message) => {
    set((state) => {
      const existing = state.messagesByChannel[message.channelId] ?? [];
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [message.channelId]: sortMessages([...existing, message]),
        },
      };
    });
  },

  applyEditedMessage: (message) => {
    set((state) => ({
      messagesByChannel: {
        ...state.messagesByChannel,
        [message.channelId]: (state.messagesByChannel[message.channelId] ?? []).map((item) =>
          item.id === message.id ? message : item,
        ),
      },
    }));
  },

  removeMessage: (channelId, messageId) => {
    set((state) => {
      const nextExpiry = { ...state.expiryByMessageId };
      delete nextExpiry[messageId];
      return {
        expiryByMessageId: nextExpiry,
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: (state.messagesByChannel[channelId] ?? []).filter((item) => item.id !== messageId),
        },
      };
    });
  },

  applyReactions: (channelId, messageId, reactions) => {
    set((state) => {
      const existing = state.messagesByChannel[channelId] ?? [];
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: existing.map((m) =>
            m.id === messageId ? { ...m, reactions } : m,
          ),
        },
      };
    });
  },

  toggleReaction: async (message, emoji) => {
    const mine = get().myReactions[message.id];
    const remove = mine?.has(emoji) ?? false;

    set((state) => {
      const nextMine = new Set(state.myReactions[message.id] ?? []);
      if (remove) nextMine.delete(emoji);
      else nextMine.add(emoji);

      const existing = state.messagesByChannel[message.channelId] ?? [];
      return {
        myReactions: { ...state.myReactions, [message.id]: nextMine },
        messagesByChannel: {
          ...state.messagesByChannel,
          [message.channelId]: existing.map((m) => {
            if (m.id !== message.id) return m;
            const others = new Map(m.reactions.map((r) => [r.emoji, r.count]));
            const currentCount = others.get(emoji) ?? 0;
            const nextCount = Math.max(0, currentCount + (remove ? -1 : 1));
            if (nextCount === 0) others.delete(emoji);
            else others.set(emoji, nextCount);
            return { ...m, reactions: [...others].map(([e, count]) => ({ emoji: e, count })) };
          }),
        },
      };
    });

    try {
      await api.addReaction({ messageId: message.id, emoji, remove });
    } catch {
      set((state) => {
        const nextMine = new Set(state.myReactions[message.id] ?? []);
        if (remove) nextMine.add(emoji);
        else nextMine.delete(emoji);
        return { myReactions: { ...state.myReactions, [message.id]: nextMine } };
      });
      void get().loadHistory(message.channelId);
    }
  },
}));
