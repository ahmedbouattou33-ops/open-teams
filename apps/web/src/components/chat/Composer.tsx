"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  Bold,
  ClipboardList,
  CheckCircle2,
  CornerUpLeft,
  Eye,
  Code2,
  EyeOff,
  Italic,
  List,
  Loader2,
  Mic,
  Paperclip,
  SendHorizontal,
  Square,
  StickyNote,
  Tag,
  Timer,
  X,
} from "lucide-react";
import { MessageTagSchema, MAX_FILE_SIZE_BYTES, type MessageTag } from "@openteams/shared-types";
import { api } from "@/lib/api";
import { cn, errorMessage, formatBytes } from "@/lib/utils";
import { useMessagesStore } from "@/stores/messages";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { sendTypingFrame } from "@/hooks/use-realtime";
import { Markdown } from "./Markdown";

const TAG_OPTIONS: readonly { value: MessageTag | ""; label: string; icon: React.ElementType }[] = [
  { value: "", label: "No tag", icon: Tag },
  { value: "DECISION", label: "Decision", icon: CheckCircle2 },
  { value: "ACTION_ITEM", label: "Action item", icon: ClipboardList },
  { value: "NOTE", label: "Note", icon: StickyNote },
];

interface Attachment {
  readonly file: File;
  readonly state: "pending" | "uploading" | "done" | "error";
}

const EMPTY_FILES: readonly File[] = [];

const EPHEMERAL_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: "Persist" },
  { value: 30, label: "Burn 30s" },
  { value: 300, label: "Burn 5m" },
  { value: 3600, label: "Burn 1h" },
];

export default function Composer({ dropFiles = EMPTY_FILES, onDropFilesConsumed }: { dropFiles?: readonly File[]; onDropFilesConsumed?: () => void }) {
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const sendMessage = useMessagesStore((s) => s.receiveMessage);
  const markEphemeral = useMessagesStore((s) => s.markEphemeral);
  const replyTo = useUiStore((s) => s.replyTo);
  const setReplyTo = useUiStore((s) => s.setReplyTo);

  const [text, setText] = useState("");
  const [tag, setTag] = useState<MessageTag | "">("");
  const [ephemeralSeconds, setEphemeralSeconds] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [attachments, setAttachments] = useState<readonly Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (dropFiles.length === 0) return;
    setAttachments((current) => [...current, ...dropFiles.map((file): Attachment => file.size > MAX_FILE_SIZE_BYTES ? { file, state: "error" } : { file, state: "pending" })]);
    onDropFilesConsumed?.();
  }, [dropFiles, onDropFilesConsumed]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
  }, [voicePreviewUrl]);

  function applyFormat(prefix: string, suffix = prefix): void {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end) || "text";
    const next = `${text.slice(0, start)}${prefix}${selected}${suffix}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  async function startRecording(): Promise<void> {
    if (recording || busy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recorderStreamRef.current = stream;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) voiceChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
        setVoicePreviewUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); });
        setAttachments((current) => [...current, { file, state: "pending" }]);
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setError(null);
    } catch {
      setError("Microphone permission is required to record a voice note.");
    }
  }

  function stopRecording(): void {
    recorderRef.current?.stop();
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>): void {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;
    setError(null);
    setAttachments((current) => [
      ...current,
      ...files.map((file): Attachment =>
        file.size > MAX_FILE_SIZE_BYTES
          ? { file, state: "error" }
          : { file, state: "pending" },
      ),
    ]);
  }

  async function submit(): Promise<void> {
    if (!activeChannelId || busy) return;
    const body = text.trim();
    const hasPendingWork =
      body.length > 0 ||
      attachments.some((a) => a.state === "pending" || a.state === "uploading");
    if (!hasPendingWork) return;

    setBusy(true);
    setError(null);
    try {
      for (const attachment of attachments) {
        if (attachment.state === "done") continue;
        if (attachment.state === "error") throw new Error(`"${attachment.file.name}" exceeds the size limit`);
        setAttachments((current) =>
          current.map((a) => (a.file === attachment.file ? { ...a, state: "uploading" } : a)),
        );
        const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
        if (!workspaceId) throw new Error("No workspace selected");
        const stored = await api.uploadFile(attachment.file, workspaceId, activeChannelId);
        setAttachments((current) =>
          current.map((a) => (a.file === attachment.file ? { ...a, state: "done" } : a)),
        );
        const file = stored.file;
        const fileReference = file.mimeType.startsWith("image/")
          ? `![${file.fileName}](openteams-file:${file.id} "${file.mimeType} · ${formatBytes(file.size)}")`
          : `[${file.fileName}](openteams-file:${file.id} "${file.mimeType} · ${formatBytes(file.size)}")`;
        const message = await api.sendMessage({
          channelId: activeChannelId,
          content: { type: "plain", body: fileReference },
          referenceId: file.id,
          ...(replyTo ? { parentId: replyTo.id } : {}),
        });
        sendMessage(message);
      }

      if (body.length > 0) {
        const message = await api.sendMessage({
          channelId: activeChannelId,
          content: { type: "plain", body },
          ...(tag !== "" ? { tag } : {}),
          ...(replyTo ? { parentId: replyTo.id } : {}),
        });
        sendMessage(message);
        if (ephemeralSeconds > 0) markEphemeral(message.id, ephemeralSeconds);
      }

      setText("");
      if (activeChannelId) sendTypingFrame(activeChannelId, false);
      setTag("");
      setEphemeralSeconds(0);
      setAttachments([]);
      setReplyTo(null);
    } catch (err) {
      setError(errorMessage(err));
      setAttachments((current) =>
        current.map((a) => (a.state === "uploading" ? { ...a, state: "pending" } : a)),
      );
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} className="shrink-0 border-t border-surface-border bg-surface p-3">
      {replyTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-t-lg border-l-2 border-accent bg-surface-raised px-3 py-1.5 text-xs text-slate-400">
          <CornerUpLeft className="h-3 w-3" />
          Replying to <span className="font-semibold text-slate-200">{replyTo.authorId.slice(0, 8)}</span>
          <span className="truncate">{replyTo.content.type === "plain" ? ` · ${replyTo.content.body.slice(0, 60)}` : ""}</span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="ml-auto rounded p-0.5 hover:bg-surface-hover hover:text-white"
            title="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {attachments.map(({ file, state }) => (
            <li
              key={`${file.name}-${file.lastModified}`}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs",
                state === "error"
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                  : "border-surface-border bg-surface-raised text-slate-300",
              )}
            >
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="max-w-[180px] truncate font-medium">{file.name}</span>
              <span className="text-slate-500">{formatBytes(file.size)}</span>
              {state === "uploading" ? <Loader2 className="h-3 w-3 animate-spin text-accent" /> : null}
              {state === "done" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : null}
              {state !== "done" ? (
                <button
                  type="button"
                  title="Remove"
                  disabled={busy}
                  onClick={() =>
                    setAttachments((current) => current.filter((a) => a.file !== file))
                  }
                  className="rounded p-0.5 hover:bg-surface-hover hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {voicePreviewUrl ? <div className="mb-2 flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised p-2"><audio controls src={voicePreviewUrl} className="h-8 min-w-0 flex-1" aria-label="Voice note preview" /><button type="button" title="Remove voice note" onClick={() => { setAttachments((current) => current.filter((item) => !item.file.name.startsWith("voice-note-"))); setVoicePreviewUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return null; }); }} className="rounded p-1.5 text-slate-400 hover:bg-surface-hover hover:text-white"><X className="h-4 w-4" /></button></div> : null}

      {previewMode ? (
        <div className="min-h-[44px] rounded-t-lg border border-surface-border bg-surface-raised px-4 py-2.5">
          {text.trim() ? <Markdown text={text} /> : <p className="text-sm text-slate-500">Nothing to preview.</p>}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            if (activeChannelId) {
              sendTypingFrame(activeChannelId, next.trim().length > 0);
              if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
              typingTimerRef.current = setTimeout(() => sendTypingFrame(activeChannelId, false), 2_000);
            }
          }}
          onKeyDown={onKeyDown}
          rows={Math.min(8, Math.max(1, text.split("\n").length))}
          placeholder={activeChannelId ? "Message… (Markdown supported · Enter to send · Shift+Enter for newline)" : "Select a channel first"}
          disabled={!activeChannelId}
          className="w-full resize-none rounded-t-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-[15px] text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none disabled:opacity-60"
        />
      )}

      <div className="flex items-center gap-1 rounded-b-lg border border-t-0 border-surface-border bg-surface-raised px-2 py-1.5">
        <ToolbarButton title="Bold" onClick={() => applyFormat("**")} disabled={!activeChannelId || busy}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => applyFormat("*")} disabled={!activeChannelId || busy}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Inline code" onClick={() => applyFormat("`")} disabled={!activeChannelId || busy}><Code2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Code block" onClick={() => applyFormat("```\\n", "\\n```")} disabled={!activeChannelId || busy}><Code2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Bullet list" onClick={() => applyFormat("- ", "")} disabled={!activeChannelId || busy}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title={recording ? "Stop recording" : "Record voice note"} onClick={recording ? stopRecording : () => void startRecording()} disabled={!activeChannelId || busy} active={recording}>{recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={addFiles}
          aria-label="Attach files"
        />
        <ToolbarButton
          title="Attach files"
          onClick={() => fileInputRef.current?.click()}
          disabled={!activeChannelId || busy}
        >
          <Paperclip className="h-4 w-4" />
        </ToolbarButton>

        <label className="relative flex items-center" title="Message tag">
          <Tag className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-500" />
          <select
            value={tag}
            onChange={(e) => setTag(MessageTagSchema.safeParse(e.target.value).success ? (e.target.value as MessageTag) : "")}
            disabled={!activeChannelId || busy}
            className="appearance-none rounded-lg bg-transparent py-1.5 pl-7 pr-6 text-xs font-medium text-slate-300 outline-none transition-colors hover:text-white focus:bg-black/30 disabled:opacity-40 [&>option]:bg-surface-overlay"
            aria-label="Message tag"
          >
            {TAG_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <ToolbarButton
          title={previewMode ? "Edit markdown" : "Preview markdown"}
          onClick={() => setPreviewMode((v) => !v)}
          disabled={!activeChannelId}
          active={previewMode}
        >
          {previewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </ToolbarButton>

        <label className="relative flex items-center" title="Ephemeral / self-destruct mode">
          <Timer className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-500" />
          <select
            value={ephemeralSeconds}
            onChange={(e) => setEphemeralSeconds(Number(e.target.value))}
            disabled={!activeChannelId || busy}
            className="appearance-none rounded-lg bg-transparent py-1.5 pl-7 pr-6 text-xs font-medium text-slate-300 outline-none transition-colors hover:text-white focus:bg-black/30 disabled:opacity-40 [&>option]:bg-surface-overlay"
            aria-label="Ephemeral message lifetime"
          >
            {EPHEMERAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex-1" />

        {error ? <p className="mr-2 max-w-xs truncate text-xs text-rose-400" title={error}>{error}</p> : null}

        <button
          type="submit"
          disabled={!activeChannelId || busy}
          className="btn-primary h-8 rounded-lg px-3 py-1"
          title="Send (Enter)"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          Send
        </button>
      </div>
    </form>
  );
}

function ToolbarButton(props: {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(
        "rounded-lg p-2 transition-colors disabled:opacity-40",
        props.active ? "bg-accent-muted/60 text-white" : "text-slate-400 hover:bg-surface-hover hover:text-white",
      )}
    >
      {props.children}
    </button>
  );
}
