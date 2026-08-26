"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type JoinCallResult, type ParticipantSnapshot } from "@/lib/api";
import { SERVICES, httpToWs } from "@/lib/env";
import { errorMessage } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import type { CallType, PendingCallRequest } from "@/stores/ui";

interface MediaStatePayload {
  userId: string;
  audioMuted: boolean;
  videoOff: boolean;
  screenSharing: boolean;
}

type SignalingMessage =
  | { type: "ready"; callId: string; userId: string; participants: readonly ParticipantSnapshot[] }
  | { type: "peer-joined"; userId: string }
  | { type: "peer-left"; userId: string }
  | { type: "sdp-offer"; fromUserId: string; payload: RTCSessionDescriptionInit }
  | { type: "sdp-answer"; fromUserId: string; payload: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; fromUserId: string; payload: RTCIceCandidateInit }
  | { type: "media-state"; fromUserId: string; payload: MediaStatePayload };

const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];

export interface CallSessionState {
  readonly phase: "idle" | "connecting" | "active";
  readonly callId: string | null;
  readonly callType: CallType;
  readonly channelName: string;
  readonly error: string | null;
  readonly peerIds: readonly string[];
  readonly peerStates: Readonly<Record<string, ParticipantSnapshot>>;
  readonly remoteStreams: Readonly<Record<string, MediaStream>>;
  readonly localStream: MediaStream | null;
  readonly micMuted: boolean;
  readonly camOff: boolean;
  readonly screenSharing: boolean;
}

const idleState: CallSessionState = {
  phase: "idle",
  callId: null,
  callType: "AUDIO",
  channelName: "",
  error: null,
  peerIds: [],
  peerStates: {},
  remoteStreams: {},
  localStream: null,
  micMuted: false,
  camOff: false,
  screenSharing: false,
};

function toSnapshot(input: Partial<ParticipantSnapshot> & { userId: string }): ParticipantSnapshot {
  return {
    userId: input.userId,
    joinedAt: input.joinedAt ?? new Date().toISOString(),
    audioMuted: input.audioMuted ?? false,
    videoOff: input.videoOff ?? false,
    screenSharing: input.screenSharing ?? false,
  };
}

interface CallRefs {
  ws: WebSocket | null;
  pcs: Map<string, RTCPeerConnection>;
  remoteStreams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  callId: string | null;
  selfId: string;
  joining: boolean;
  micMuted: boolean;
  camOff: boolean;
  screenSharing: boolean;
}

export function useCallSession() {
  const [state, setState] = useState<CallSessionState>(idleState);
  const r = useRef<CallRefs>({
    ws: null,
    pcs: new Map(),
    remoteStreams: new Map(),
    localStream: null,
    screenStream: null,
    callId: null,
    selfId: "",
    joining: false,
    micMuted: false,
    camOff: false,
    screenSharing: false,
  });

  const sendFrame = useCallback((frame: Record<string, unknown>): void => {
    const ws = r.current.ws;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
  }, []);

  const publishMediaState = useCallback((): void => {
    sendFrame({
      type: "media-state",
      payload: {
        userId: r.current.selfId,
        audioMuted: r.current.micMuted,
        videoOff: r.current.camOff,
        screenSharing: r.current.screenSharing,
      },
    });
  }, [sendFrame]);

  const dropPeer = useCallback((peerId: string): void => {
    const pc = r.current.pcs.get(peerId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
      r.current.pcs.delete(peerId);
    }
    r.current.remoteStreams.delete(peerId);
    setState((s) => ({
      ...s,
      peerIds: s.peerIds.filter((id) => id !== peerId),
      peerStates: Object.fromEntries(Object.entries(s.peerStates).filter(([id]) => id !== peerId)),
      remoteStreams: Object.fromEntries(r.current.remoteStreams),
    }));
  }, []);

  const ensurePeer = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = r.current.pcs.get(peerId);
      if (existing) return existing;

      const local = r.current.localStream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      if (local) for (const track of local.getTracks()) pc.addTrack(track, local);

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        r.current.remoteStreams.set(peerId, stream);
        setState((s) => ({ ...s, remoteStreams: Object.fromEntries(r.current.remoteStreams) }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendFrame({ type: "ice-candidate", targetUserId: peerId, payload: event.candidate.toJSON() });
        }
      };

      r.current.pcs.set(peerId, pc);
      return pc;
    },
    [sendFrame],
  );

  const createOfferTo = useCallback(
    async (peerId: string): Promise<void> => {
      try {
        const pc = ensurePeer(peerId);
        if (pc.signalingState !== "stable") return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendFrame({ type: "sdp-offer", targetUserId: peerId, payload: offer });
      } catch {
        return;
      }
    },
    [ensurePeer, sendFrame],
  );

  const handleSignaling = useCallback(
    async (message: SignalingMessage): Promise<void> => {
      switch (message.type) {
        case "ready": {
          setState((s) => ({ ...s, phase: "active", callId: message.callId }));
          break;
        }
        case "peer-joined": {
          setState((s) =>
            s.peerIds.includes(message.userId)
              ? s
              : {
                  ...s,
                  peerIds: [...s.peerIds, message.userId],
                  peerStates: { ...s.peerStates, [message.userId]: toSnapshot({ userId: message.userId }) },
                },
          );
          break;
        }
        case "peer-left": {
          dropPeer(message.userId);
          break;
        }
        case "sdp-offer": {
          try {
            const pc = ensurePeer(message.fromUserId);
            await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendFrame({ type: "sdp-answer", targetUserId: message.fromUserId, payload: answer });
          } catch {
            return;
          }
          break;
        }
        case "sdp-answer": {
          const pc = r.current.pcs.get(message.fromUserId);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(message.payload)).catch(() => undefined);
          }
          break;
        }
        case "ice-candidate": {
          const pc = r.current.pcs.get(message.fromUserId);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(message.payload)).catch(() => undefined);
          }
          break;
        }
        case "media-state": {
          const p = message.payload;
          setState((s) => ({
            ...s,
            peerStates: { ...s.peerStates, [p.userId]: toSnapshot(p) },
          }));
          break;
        }
      }
    },
    [dropPeer, ensurePeer, sendFrame],
  );

  const teardown = useCallback((): void => {
    const cur = r.current;
    if (cur.callId) void api.leaveCall(cur.callId).catch(() => undefined);
    for (const pc of cur.pcs.values()) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
    }
    cur.pcs.clear();
    cur.remoteStreams.clear();
    cur.screenStream?.getTracks().forEach((t) => t.stop());
    cur.screenStream = null;
    cur.localStream?.getTracks().forEach((t) => t.stop());
    cur.localStream = null;
    if (cur.ws) {
      cur.ws.onclose = null;
      cur.ws.onerror = null;
      cur.ws.onmessage = null;
      cur.ws.onopen = null;
      cur.ws.close();
    }
    cur.ws = null;
    cur.callId = null;
    cur.micMuted = false;
    cur.camOff = false;
    cur.screenSharing = false;
  }, []);

  const start = useCallback(
    async (request: PendingCallRequest): Promise<void> => {
      const cur = r.current;
      if (cur.joining || cur.callId) return;
      cur.joining = true;

      const auth = useAuthStore.getState();
      cur.selfId = auth.user?.id ?? "";
      setState({
        ...idleState,
        phase: "connecting",
        callType: request.callType,
        channelName: request.channelName,
      });

      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: request.callType === "VIDEO",
        });
        cur.localStream = localStream;
        setState((s) => ({ ...s, localStream }));

        const init = await api.initiateCall({
          workspaceId: request.workspaceId,
          channelId: request.channelId,
          callType: request.callType,
        });
        cur.callId = init.callId;

        let joined: JoinCallResult | null = null;
        try {
          joined = await api.joinCall(init.callId);
        } catch {
          joined = null;
        }

        const ws = new WebSocket(
          `${httpToWs(SERVICES.mediaRtc)}${init.wsUrl}&token=${encodeURIComponent(auth.accessToken ?? "")}`,
        );
        cur.ws = ws;

        ws.onmessage = (raw) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(String(raw.data));
          } catch {
            return;
          }
          if (!parsed || typeof parsed !== "object") return;
          const msg = parsed as SignalingMessage;
          if (typeof msg.type !== "string") return;
          void handleSignaling(msg);
        };

        ws.onerror = () => {
          setState((s) =>
            s.phase === "connecting" ? { ...s, phase: "idle", error: "Signaling connection failed" } : s,
          );
        };

        ws.onopen = () => {
          setState((s) => ({ ...s, phase: "active", callId: init.callId }));
          if (!joined) return;
          const others = joined.participants.filter((p) => p.userId !== cur.selfId);
          setState((s) => ({
            ...s,
            peerIds: [...new Set([...s.peerIds, ...others.map((p) => p.userId)])],
            peerStates: {
              ...s.peerStates,
              ...Object.fromEntries(others.map((p) => [p.userId, toSnapshot(p)])),
            },
          }));
          void Promise.all(others.map((p) => createOfferTo(p.userId)));
        };
      } catch (error) {
        teardown();
        setState({ ...idleState, error: errorMessage(error) });
      } finally {
        cur.joining = false;
      }
    },
    [createOfferTo, handleSignaling, teardown],
  );

  const leave = useCallback((): void => {
    teardown();
    setState(idleState);
  }, [teardown]);

  const toggleMic = useCallback((): void => {
    const stream = r.current.localStream;
    if (!stream) return;
    const next = !r.current.micMuted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    r.current.micMuted = next;
    setState((s) => ({ ...s, micMuted: next }));
    publishMediaState();
  }, [publishMediaState]);

  const toggleCam = useCallback((): void => {
    const stream = r.current.localStream;
    if (!stream || stream.getVideoTracks().length === 0) return;
    const next = !r.current.camOff;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    r.current.camOff = next;
    setState((s) => ({ ...s, camOff: next }));
    publishMediaState();
  }, [publishMediaState]);

  const toggleScreenShare = useCallback(async (): Promise<void> => {
    const cur = r.current;
    if (!cur.localStream) return;

    if (cur.screenStream) {
      cur.screenStream.getTracks().forEach((t) => t.stop());
      cur.screenStream = null;
      const cameraTrack = cur.localStream.getVideoTracks()[0];
      for (const pc of cur.pcs.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && cameraTrack) await sender.replaceTrack(cameraTrack).catch(() => undefined);
      }
      cur.screenSharing = false;
      setState((s) => ({ ...s, screenSharing: false }));
      publishMediaState();
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screen.getVideoTracks()[0];
      if (!screenTrack) throw new Error("No screen track available");
      cur.screenStream = screen;
      screenTrack.onended = () => void toggleScreenShare();

      let replacedAny = false;
      for (const pc of cur.pcs.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(screenTrack).catch(() => undefined);
          replacedAny = true;
        }
      }
      if (!replacedAny && cur.pcs.size > 0) throw new Error("Screen sharing requires a video call");
      cur.screenSharing = true;
      setState((s) => ({ ...s, screenSharing: true }));
      publishMediaState();
    } catch (error) {
      setState((s) => ({ ...s, error: errorMessage(error) }));
    }
  }, [publishMediaState]);

  useEffect(() => teardown(), [teardown]);

  return { state, start, leave, toggleMic, toggleCam, toggleScreenShare };
}
