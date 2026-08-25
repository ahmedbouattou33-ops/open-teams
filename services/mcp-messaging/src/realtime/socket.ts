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

    void authClient
      .listAccessibleChannels(userId)
      .then((channelIds) => {
        if (socket.readyState !== socket.OPEN) return;
        const client = hub.register(socket, userId, channelIds);
        safeSend(socket, JSON.stringify({ type: "ready", userId, channelIds }));

        const heartbeat = setInterval(() => {
          if (socket.readyState === socket.OPEN) {
            socket.ping();
          } else {
            clearInterval(heartbeat);
          }
        }, HEARTBEAT_MS);

        socket.on("message", (data) => {
          // Client frames are control hints only; data flows through POST /mcp.
          const frame = decodeFrame(data);
          const channelId = (frame as unknown as { channelId?: unknown })?.channelId;
          if (frame?.type === "join" && typeof channelId === "string") {
            hub.join(client, channelId);
          }
        });

        socket.on("close", () => {
          clearInterval(heartbeat);
          hub.unregister(client);
        });

        socket.on("error", () => {
          clearInterval(heartbeat);
          hub.unregister(client);
        });
      })
      .catch(() => socket.close(1011, "Failed to resolve channel memberships"));
  });
}

function safeSend(socket: WebSocket, payload: string): void {
  if (socket.readyState === socket.OPEN) socket.send(payload);
}
