import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { verifyAccessToken } from "../auth/jwt.js";
import type { AppEnv } from "../env.js";
import type { AuthWorkspaceClient } from "../internal/client.js";
import type { RealtimeHub } from "./hub.js";
import { decodeFrame } from "./hub.js";

const HEARTBEAT_MS = 30_000;

/**
 * `GET /ws?token=<accessToken>`
 * Verifies the JWT, subscribes the socket to every channel the user can
 * reach and streams realtime events (message.created, reaction.updated,
 * receipt.updated).
 */
export function registerSocketRoute(
  app: FastifyInstance,
  env: AppEnv,
  hub: RealtimeHub,
  authClient: AuthWorkspaceClient,
): void {
  app.get("/ws", { websocket: true }, (socket: WebSocket, request) => {
    const url = new URL(request.url, "http://localhost");
    const token = url.searchParams.get("token") ?? "";
    const claims = token ? verifyAccessToken(token, env) : null;
    if (!claims) {
      socket.close(4401, "Unauthorized: missing or invalid access token");
      return;
    }
    const userId = claims.sub;

    void Promise.all([authClient.listAccessibleChannels(userId), authClient.listAccessibleWorkspaces(userId)])
      .then(([channelIds, workspaceIds]) => {
        if (socket.readyState !== socket.OPEN) return;
        const client = hub.register(socket, userId, channelIds, workspaceIds);
        safeSend(socket, JSON.stringify({ type: "ready", userId, channelIds }));
        for (const workspaceId of workspaceIds) hub.broadcastWorkspace(workspaceId, { type: "presence.updated", workspaceId, userId, status: "ONLINE" });

        const heartbeat = setInterval(() => {
          if (socket.readyState === socket.OPEN) {
            socket.ping();
          } else {
            clearInterval(heartbeat);
          }
        }, HEARTBEAT_MS);

        let lastTypingAt = 0;
        socket.on("message", (data) => {
          // Client frames are control hints only; message data flows through POST /mcp.
          const frame = decodeFrame(data) as { type: string; channelId?: unknown; active?: unknown } | null;
          const channelId = frame?.channelId;
          if (frame?.type === "join" && typeof channelId === "string") {
            hub.join(client, channelId);
            return;
          }
          if (frame?.type === "typing" && typeof channelId === "string" && typeof frame.active === "boolean") {
            const now = Date.now();
            if (now - lastTypingAt < 300 || !hub.canPublish(client, channelId)) return;
            lastTypingAt = now;
            hub.broadcast(channelId, { type: "typing", channelId, userId, active: frame.active });
          }
        });

        const unregisterAndBroadcast = () => {
          hub.unregister(client);
          if (!hub.hasUserConnection(userId)) for (const workspaceId of workspaceIds) hub.broadcastWorkspace(workspaceId, { type: "presence.updated", workspaceId, userId, status: "OFFLINE" });
        };
        socket.on("close", () => {
          clearInterval(heartbeat);
          unregisterAndBroadcast();
        });

        socket.on("error", () => {
          clearInterval(heartbeat);
          unregisterAndBroadcast();
        });
      })
      .catch(() => socket.close(1011, "Failed to resolve channel memberships"));
  });
}

function safeSend(socket: WebSocket, payload: string): void {
  if (socket.readyState === socket.OPEN) socket.send(payload);
}
