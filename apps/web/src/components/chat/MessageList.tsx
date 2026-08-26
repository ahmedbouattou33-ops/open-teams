"use client";

import { useEffect, useRef, useState } from "react";
import { History, Loader2, MessageSquareDashed } from "lucide-react";
import { formatDayLabel } from "@/lib/utils";
import { useMessagesStore } from "@/stores/messages";
import { useWorkspaceStore } from "@/stores/workspace";
import { MessageItem } from "./MessageItem";

export default function MessageList() {
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const messagesByChannel = useMessagesStore((s) => s.messagesByChannel);
  const loadingByChannel = useMessagesStore((s) => s.loadingByChannel);
  const expiryByMessageId = useMessagesStore((s) => s.expiryByMessageId);
  const olderCursor = useMessagesStore(
    (s) => (activeChannelId ? s.olderCursorByChannel[activeChannelId] : null) ?? null,
  );
  const loadOlder = useMessagesStore((s) => s.loadOlder);

  const [now, setNow] = useState(() => Date.now());
  const hasEphemeral = Object.keys(expiryByMessageId).length > 0;

  useEffect(() => {
    if (!hasEphemeral) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [hasEphemeral]);

  const messages = activeChannelId ? messagesByChannel[activeChannelId] ?? [] : [];
  const loading = activeChannelId ? loadingByChannel[activeChannelId] ?? false : false;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    stickToBottomRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeChannelId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleScroll(): void {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  if (!activeChannelId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500">
        <MessageSquareDashed className="h-10 w-10" />
        <p className="text-sm">Pick a channel to start collaborating.</p>
      </div>
    );
  }

  let lastDay = "";

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Channel messages"
      className="min-h-0 flex-1 overflow-y-auto py-2"
    >
      {olderCursor ? (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={() => void loadOlder(activeChannelId)}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised px-4 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-accent hover:text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
            Load earlier messages
          </button>
        </div>
      ) : null}

      {messages.length === 0 && !loading ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
          <MessageSquareDashed className="h-8 w-8" />
          <p className="text-sm">No messages yet — say hello!</p>
        </div>
      ) : null}

      {messages.map((message, index) => {
        const expiry = expiryByMessageId[message.id];
        const remainingSeconds = expiry !== undefined ? Math.max(0, Math.ceil((expiry - now) / 1_000)) : null;
        if (remainingSeconds === 0) return null;

        const previous = index > 0 ? messages[index - 1] : undefined;
        const day = formatDayLabel(message.createdAt);
        const showDivider = day !== lastDay;
        if (showDivider) lastDay = day;

        const showHeader =
          showDivider ||
          !previous ||
          previous.authorId !== message.authorId ||
          new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60_000 ||
          previous.parentId !== message.parentId;

        return (
          <div key={message.id}>
            {showDivider ? (
              <div className="my-3 flex items-center gap-3 px-4">
                <span className="h-px flex-1 bg-surface-border" />
                <span className="text-[11px] font-semibold text-slate-500">{day}</span>
                <span className="h-px flex-1 bg-surface-border" />
              </div>
            ) : null}
            <MessageItem message={message} showHeader={showHeader} burnInSeconds={remainingSeconds} />
          </div>
        );
      })}
    </div>
  );
}
