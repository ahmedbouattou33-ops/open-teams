import type { WebSocket } from "ws";

export interface ParticipantState {
  readonly userId: string;
  readonly joinedAt: Date;
  audioMuted: boolean;
  videoOff: boolean;
  screenSharing: boolean;
  /**
   * Null between `join_call` (MCP intent registration) and the actual
   * WebSocket handshake — a participant legitimately has no socket yet.
   */
  socket: WebSocket | null;
}

export interface ActiveCall {
  readonly id: string;
  readonly workspaceId: string;
  readonly channelId: string;
  readonly hostUserId: string;
  readonly callType: "AUDIO" | "VIDEO";
  readonly createdAt: Date;
  participants: Map<string, ParticipantState>;
}

export class RoomManager {
  private readonly calls = new Map<string, ActiveCall>();

  createCall(workspaceId: string, channelId: string, hostUserId: string, callType: "AUDIO" | "VIDEO"): ActiveCall {
    const callId = `call_${Math.random().toString(36).slice(2, 12)}`;
    const call: ActiveCall = {
      id: callId,
      workspaceId,
      channelId,
      hostUserId,
      callType,
      createdAt: new Date(),
      participants: new Map(),
    };
    this.calls.set(callId, call);
    return call;
  }

  getCall(callId: string): ActiveCall | undefined {
    return this.calls.get(callId);
  }

  /**
   * Registers (or re-registers) a participant. Every call site guarantees the
   * call exists — `join_call` and the WS handler both resolve the call first.
   */
  addParticipant(callId: string, userId: string, socket: WebSocket | null): ParticipantState {
    const call = this.calls.get(callId);
    if (!call) throw new Error(`addParticipant on unknown call: ${callId}`);

    const existing = call.participants.get(userId);
    if (existing) {
      // Re-connect: swap in the fresh socket; only close a live previous one.
      if (existing.socket && socket && existing.socket !== socket) {
        existing.socket.close(4000, "Replaced by new session");
      }
      if (socket) existing.socket = socket;
      return existing;
    }

    const participant: ParticipantState = {
      userId,
      joinedAt: new Date(),
      audioMuted: false,
      videoOff: true,
      screenSharing: false,
      socket,
    };
    call.participants.set(userId, participant);
    return participant;
  }

  removeParticipant(callId: string, userId: string): ParticipantState | undefined {
    const call = this.calls.get(callId);
    if (!call) return undefined;

    const removed = call.participants.get(userId);
    if (!removed) return undefined;
    call.participants.delete(userId);

    // Auto-cleanup: drop the room when the last participant leaves.
    if (call.participants.size === 0) this.calls.delete(callId);
    return removed;
  }

  getWorkspaceCalls(workspaceId: string, channelId?: string): ActiveCall[] {
    return [...this.calls.values()].filter(
      (c) => c.workspaceId === workspaceId && (channelId === undefined || c.channelId === channelId),
    );
  }

  getAllCalls(): ActiveCall[] {
    return [...this.calls.values()];
  }
}
