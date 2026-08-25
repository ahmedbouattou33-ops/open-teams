import { defineTool, McpError, type AuthContext } from "@openteams/mcp-core";
import {
  InitiateCallInputSchema,
  JoinCallInputSchema,
  LeaveCallInputSchema,
  GetActiveCallsInputSchema,
  MediaRtcToolName,
  type InitiateCallInput,
  type JoinCallInput,
  type LeaveCallInput,
  type GetActiveCallsInput,
  type ActiveCall,
} from "@openteams/shared-types";
import type { AuthWorkspaceClient } from "../internal/client.js";
import type { RoomManager } from "../rooms.js";

/** Enforces channel RBAC via mcp-auth-workspace; throws on denial. */
async function requireAccess(authClient: AuthWorkspaceClient, channelId: string, userId: string): Promise<void> {
  const access = await authClient.getChannelAccess(channelId, userId);
  if (!access.allowed || !access.workspaceId) throw McpError.notFound("Channel not found or access denied");
}

export function buildMediaTools(authClient: AuthWorkspaceClient, roomManager: RoomManager) {
  return [
    defineTool({
      name: MediaRtcToolName.InitiateCall,
      description:
        "Validates channel membership and creates a call session. Returns `{ callId, wsUrl, callType }`.",
      input: InitiateCallInputSchema,
      secure: true,
      handler: async (
        input: InitiateCallInput,
        ctx: AuthContext,
      ): Promise<{ callId: string; wsUrl: string; callType: string }> => {
        const userId = ctx.userId as string;
        await requireAccess(authClient, input.channelId, userId);

        const call = roomManager.createCall(input.workspaceId, input.channelId, userId, input.callType);
        return {
          callId: call.id,
          wsUrl: `/ws/call?callId=${call.id}`,
          callType: call.callType,
        };
      },
    }),

    defineTool({
      name: MediaRtcToolName.JoinCall,
      description:
        "Verifies access and registers the caller in a call room. Returns the call snapshot with existing participants.",
      input: JoinCallInputSchema,
      secure: true,
      handler: async (input: JoinCallInput, ctx: AuthContext) => {
        const userId = ctx.userId as string;

        const call = roomManager.getCall(input.callId);
        if (!call) throw McpError.notFound("Call not found");
        await requireAccess(authClient, call.channelId, userId);

        const participant = roomManager.addParticipant(call.id, userId, null);
        return {
          callId: call.id,
          hostUserId: call.hostUserId,
          callType: call.callType,
          you: {
            userId: participant.userId,
            joinedAt: participant.joinedAt.toISOString(),
            audioMuted: participant.audioMuted,
            videoOff: participant.videoOff,
            screenSharing: participant.screenSharing,
          },
          participants: [...call.participants.values()].map((p) => ({
            userId: p.userId,
            joinedAt: p.joinedAt.toISOString(),
            audioMuted: p.audioMuted,
            videoOff: p.videoOff,
            screenSharing: p.screenSharing,
          })),
        };
      },
    }),

    defineTool({
      name: MediaRtcToolName.LeaveCall,
      description: "Removes the caller from a call room session.",
      input: LeaveCallInputSchema,
      secure: true,
      handler: async (input: LeaveCallInput, ctx: AuthContext): Promise<{ ok: true }> => {
        const userId = ctx.userId as string;

        const call = roomManager.getCall(input.callId);
        if (!call) throw McpError.notFound("Call not found");

        const removed = roomManager.removeParticipant(input.callId, userId);
        if (!removed) throw McpError.notFound("You are not part of this call");
        return { ok: true };
      },
    }),

    defineTool({
      name: MediaRtcToolName.GetActiveCalls,
      description: "Lists running calls filtered by workspaceId (and optional channelId).",
      input: GetActiveCallsInputSchema,
      secure: true,
      handler: async (input: GetActiveCallsInput, ctx: AuthContext) => {
        void ctx;
        const calls = roomManager.getWorkspaceCalls(input.workspaceId, input.channelId);
        return {
          calls: calls.map(
            (c): ActiveCallSummary => ({
              id: c.id,
              workspaceId: c.workspaceId,
              channelId: c.channelId,
              hostUserId: c.hostUserId,
              callType: c.callType,
              createdAt: c.createdAt.toISOString(),
              participantCount: c.participants.size,
            }),
          ),
        };
      },
    }),
  ] as const;
}

interface ActiveCallSummary {
  id: string;
  workspaceId: string;
  channelId: string;
  hostUserId: string;
  callType: string;
  createdAt: string;
  participantCount: number;
}
