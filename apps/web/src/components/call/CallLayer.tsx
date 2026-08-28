"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video as VideoIcon,
  VideoOff,
  Hand,
} from "lucide-react";
import { avatarColor, cn, initials } from "@/lib/utils";
import { useCallSession } from "@/hooks/use-call-session";
import { useUiStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";

export default function CallLayer() {
  const pendingCall = useUiStore((s) => s.pendingCall);
  const endCall = useUiStore((s) => s.endCall);
  const selfId = useAuthStore((s) => s.user?.id ?? "");
  const { state, start, leave, toggleMic, toggleCam, toggleScreenShare } = useCallSession();
  const [handRaised, setHandRaised] = useState(false);

  useEffect(() => {
    if (pendingCall && state.phase === "idle" && !state.error && state.callId === null) {
      void start(pendingCall);
    }
  }, [pendingCall, state.phase, state.error, state.callId, start]);

  if (!pendingCall || state.phase === "idle") return null;

  function hangUp(): void {
    leave();
    endCall();
  }

  return (
    <section
      aria-label="Ongoing call"
      className="fixed bottom-4 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] animate-slide-up overflow-hidden rounded-2xl border border-surface-border bg-surface-overlay shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-accent" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">
            #{state.channelName || "call"}{" "}
            <span className="font-normal text-slate-400">
              · {state.callType === "VIDEO" ? "Video" : "Voice"}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            {state.phase === "connecting"
              ? "Connecting…"
              : `${state.peerIds.length + 1} participant${state.peerIds.length ? "s" : ""}`}
          </p>
        </div>
      </header>

      {state.error ? (
        <p className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
          {state.error}
        </p>
      ) : null}

      <div
        className={cn(
          "grid gap-2 p-3",
          state.callType === "VIDEO"
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-3",
        )}
      >
        {state.callType === "VIDEO" ? (
          <>
            <VideoTile stream={state.localStream} muted mirror label="You" off={state.camOff} />
            {state.peerIds.map((peerId) => (
              <VideoTile
                key={peerId}
                stream={state.remoteStreams[peerId] ?? null}
                label={`Peer ${peerId.slice(0, 6)}`}
                off={state.peerStates[peerId]?.videoOff ?? false}
              />
            ))}
          </>
        ) : (
          <>
            <AudioTile name="You" id={selfId} muted={state.micMuted} />
            {state.peerIds.map((peerId) => (
              <AudioTile
                key={peerId}
                name={`Peer ${peerId.slice(0, 6)}`}
                id={peerId}
                muted={state.peerStates[peerId]?.audioMuted ?? false}
              />
            ))}
          </>
        )}
      </div>

      <footer className="flex items-center justify-center gap-2 border-t border-surface-border px-4 py-3">
        <ControlButton title={state.micMuted ? "Unmute microphone" : "Mute microphone"} onClick={toggleMic} danger={state.micMuted}>
          {state.micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </ControlButton>
        {state.callType === "VIDEO" ? (
          <ControlButton title={state.camOff ? "Turn camera on" : "Turn camera off"} onClick={toggleCam} danger={state.camOff}>
            {state.camOff ? <VideoOff className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
          </ControlButton>
        ) : null}
          <ControlButton title={handRaised ? "Lower hand" : "Raise hand"} onClick={() => setHandRaised((value) => !value)} active={handRaised}>
            <Hand className="h-4 w-4" />
          </ControlButton>
          <ControlButton
          title={state.screenSharing ? "Stop screen share" : "Share your screen"}
          onClick={() => void toggleScreenShare()}
          active={state.screenSharing}
        >
          <MonitorUp className="h-4 w-4" />
        </ControlButton>
        <button
          type="button"
          title="Leave call"
          onClick={hangUp}
          disabled={state.phase === "connecting"}
          className="flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
        >
          {state.phase === "connecting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PhoneOff className="h-4 w-4" />
          )}
          Leave
        </button>
      </footer>
    </section>
  );
}

function VideoTile({
  stream,
  muted,
  mirror,
  label,
  off,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  label: string;
  off?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-surface-border bg-black/60">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted ?? false}
        className={cn("h-full w-full object-cover", mirror && "-scale-x-100", off && "hidden")}
      />
      {off || !stream ? (
        <div className="flex h-full items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted text-sm font-bold text-white">
            {initials(label)}
          </span>
        </div>
      ) : null}
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {label}
      </span>
    </div>
  );
}

function AudioTile({ name, id, muted }: { name: string; id: string; muted?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-surface-border bg-surface-raised px-2 py-3">
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white",
          avatarColor(id),
        )}
      >
        {initials(name)}
      </span>
      <span className="max-w-full truncate text-[11px] font-medium text-slate-300">{name}</span>
      {muted ? <MicOff className="h-3 w-3 text-rose-400" /> : <Mic className="h-3 w-3 text-emerald-400" />}
    </div>
  );
}

function ControlButton({
  title,
  children,
  onClick,
  active,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
        danger
          ? "border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
          : active
            ? "border-accent bg-accent-muted/50 text-white"
            : "border-surface-border bg-surface-raised text-slate-300 hover:bg-surface-hover hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
