"use client";

import { memo, useState } from "react";
import { CheckCircle2, ClipboardList, CornerUpLeft, Flame, Plus, StickyNote, Smile } from "lucide-react";
import type { MessageDTO } from "@openteams/shared-types";
import { avatarColor, cn, formatTime, initials } from "@/lib/utils";
import { useMessagesStore } from "@/stores/messages";
import { useUiStore } from "@/stores/ui";
import { Markdown } from "./Markdown";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "✅"] as const;

const TAG_STYLES = {
  DECISION: {
    icon: CheckCircle2,
    className: "border-indigo-400/40 bg-indigo-500/15 text-indigo-300",
    label: "Decision",
  },
  ACTION_ITEM: {
    icon: ClipboardList,
    className: "border-amber-400/40 bg-amber-500/15 text-amber-300",
    label: "Action item",
  },
  NOTE: {
    icon: StickyNote,
    className: "border-slate-400/40 bg-slate-500/15 text-slate-300",
    label: "Note",
  },
} as const;

export const MessageItem = memo(function MessageItem({
  message,
  showHeader,
  burnInSeconds,
}: {
  message: MessageDTO;
  showHeader: boolean;
  burnInSeconds?: number | null;
}) {
  const toggleReaction = useMessagesStore((s) => s.toggleReaction);
  const myReactions = useMessagesStore((s) => s.myReactions[message.id]);
  const setReplyTo = useUiStore((s) => s.setReplyTo);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (message.content.type === "encrypted") return null;

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-4 transition-colors hover:bg-surface-raised/40",
        showHeader ? "pt-3" : "mt-0.5",
      )}
    >
      <div className="w-10 shrink-0">
        {showHeader ? (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white",
              avatarColor(message.authorId),
            )}
          >
            {initials(`user-${message.authorId.slice(0, 4)}`)}
          </div>
        ) : (
          <span className="hidden text-[10px] text-slate-600 group-hover:block">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 pb-0.5">
        {showHeader ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {message.authorId.slice(0, 8)}
            </span>
            <span className="text-[11px] text-slate-500">{formatTime(message.createdAt)}</span>
            {message.tag ? <TagBadge tag={message.tag} /> : null}
            {message.parentId ? (
              <span className="flex items-center gap-1 rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-slate-400">
                <CornerUpLeft className="h-3 w-3" /> reply
              </span>
            ) : null}
          </div>
        ) : null}

        {!showHeader && message.tag ? <div className="mb-0.5"><TagBadge tag={message.tag} /></div> : null}

        <Markdown text={message.content.body} />

        {burnInSeconds !== null && burnInSeconds !== undefined ? (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400/80">
            <Flame className="h-3 w-3" /> self-destructs in {burnInSeconds}s
          </p>
        ) : null}

        {message.reactions.length > 0 || true ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {message.reactions.map((reaction) => {
              const mine = myReactions?.has(reaction.emoji) ?? false;
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => void toggleReaction(message, reaction.emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    mine
                      ? "border-accent bg-accent-muted/50 text-white"
                      : "border-surface-border bg-black/20 text-slate-300 hover:border-slate-500",
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "absolute -top-3 right-4 hidden items-center gap-0.5 rounded-lg border border-surface-border bg-surface-overlay p-0.5 shadow-lg group-hover:flex",
          pickerOpen && "flex",
        )}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            title={`React ${emoji}`}
            onClick={() => {
              void toggleReaction(message, emoji);
              setPickerOpen(false);
            }}
            className={cn("rounded p-1 text-sm transition-transform hover:scale-125", !pickerOpen && "hidden")}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          title="Add reaction"
          onClick={() => setPickerOpen((v) => !v)}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white"
        >
          {pickerOpen ? <Smile className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
        <button
          type="button"
          title="Reply in thread"
          onClick={() => setReplyTo(message)}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white"
        >
          <CornerUpLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

function TagBadge({ tag }: { tag: keyof typeof TAG_STYLES }) {
  const style = TAG_STYLES[tag];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide",
        style.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {style.label}
    </span>
  );
}
