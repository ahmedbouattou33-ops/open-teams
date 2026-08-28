"use client";

import { memo, useState } from "react";
import { CheckCircle2, ClipboardList, CornerUpLeft, Flame, Languages, Pencil, Pin, Plus, Bookmark, Save, StickyNote, Smile, Trash2, X } from "lucide-react";
import type { MessageDTO } from "@openteams/shared-types";
import { avatarColor, cn, formatTime, initials } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore } from "@/stores/messages";
import { useUiStore } from "@/stores/ui";
import { Markdown } from "./Markdown";
import { useLanguage } from "@/lib/i18n";

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
  const { locale, t } = useLanguage();
  const toggleReaction = useMessagesStore((s) => s.toggleReaction);
  const applyEditedMessage = useMessagesStore((s) => s.applyEditedMessage);
  const removeMessage = useMessagesStore((s) => s.removeMessage);
  const myReactions = useMessagesStore((s) => s.myReactions[message.id]);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const setReplyTo = useUiStore((s) => s.setReplyTo);
  const togglePinned = useUiStore((s) => s.togglePinned);
  const toggleSaved = useUiStore((s) => s.toggleSaved);
  const setThreadRoot = useUiStore((s) => s.setThreadRoot);
  const pinned = useUiStore((s) => s.pinnedMessageIds.has(message.id));
  const saved = useUiStore((s) => s.savedMessageIds.has(message.id));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content.type === "plain" ? message.content.body : "");
  const [busy, setBusy] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translationBusy, setTranslationBusy] = useState(false);

  if (message.content.type === "encrypted") return null;
  const sourceText = message.content.body;

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
            {pinned ? <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300"><Pin className="h-3 w-3" />{t("pin")}</span> : null}
            {message.parentId ? (
              <span className="flex items-center gap-1 rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-slate-400">
                <CornerUpLeft className="h-3 w-3" /> reply
              </span>
            ) : null}
          </div>
        ) : null}

        {!showHeader && message.tag ? <div className="mb-0.5"><TagBadge tag={message.tag} /></div> : null}

        {editing ? (
          <div className="flex gap-2">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className="min-w-0 flex-1 rounded-lg border border-accent bg-surface-raised px-3 py-2 text-sm text-slate-200 outline-none" autoFocus />
            <div className="flex items-start gap-1">
              <button type="button" title="Save edit" disabled={busy || !draft.trim()} onClick={async () => {
                setBusy(true);
                try { const updated = await api.editMessage({ messageId: message.id, content: { type: "plain", body: draft.trim() } }); applyEditedMessage(updated); setEditing(false); }
                finally { setBusy(false); }
              }} className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"><Save className="h-4 w-4" /></button>
              <button type="button" title="Cancel edit" disabled={busy} onClick={() => { setDraft(message.content.type === "plain" ? message.content.body : ""); setEditing(false); }} className="rounded p-1.5 text-slate-400 hover:bg-surface-hover"><X className="h-4 w-4" /></button>
            </div>
          </div>
        ) : <Markdown text={translatedText ?? message.content.body} />}
        {translatedText ? <p className="mt-1 text-[10px] text-slate-500">{t("translate")} · {locale.toUpperCase()}</p> : null}

        {burnInSeconds !== null && burnInSeconds !== undefined ? (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400/80">
            <Flame className="h-3 w-3" /> self-destructs in {burnInSeconds}s
          </p>
        ) : null}

        {message.reactions.length > 0 ? (
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
        {currentUserId === message.authorId && message.content.type === "plain" ? <>
          <button type="button" title="Edit message" onClick={() => setEditing(true)} className="rounded p-1.5 text-slate-400 hover:bg-surface-hover hover:text-white"><Pencil className="h-4 w-4" /></button>
          <button type="button" title="Delete message" disabled={busy} onClick={async () => { if (!window.confirm("Delete this message permanently from server content?")) return; setBusy(true); try { await api.deleteMessage({ messageId: message.id }); removeMessage(message.channelId, message.id); } finally { setBusy(false); } }} className="rounded p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
        </> : null}
        <button type="button" title={saved ? "Remove from saved items" : "Save message"} onClick={() => toggleSaved(message.id)} className={cn("rounded p-1.5 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white", saved && "bg-accent/15 text-accent")}><Bookmark className="h-4 w-4" /></button>
        <button type="button" title={pinned ? "Unpin message" : t("pin")} onClick={() => togglePinned(message.id)} className={cn("rounded p-1.5 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white", pinned && "bg-amber-500/15 text-amber-300")}><Pin className="h-4 w-4" /></button>
        <button type="button" title={t("translate")} disabled={translationBusy} onClick={async () => { setTranslationBusy(true); try { const result = await api.translateMessage({ channelId: message.channelId, text: sourceText, targetLocale: locale }); setTranslatedText(result.translation); } catch { setTranslatedText(null); } finally { setTranslationBusy(false); } }} className="rounded p-1.5 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white disabled:opacity-40"><Languages className="h-4 w-4" /></button>
        <button
          type="button"
          title={t("replyThread")}
          onClick={() => { setThreadRoot(message); setReplyTo(message); }}
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
