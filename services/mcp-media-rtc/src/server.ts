import Fastify, { type FastifyInstance } from "fastify";
import type { AppEnv } from "./env.js";
import { verifyAccessToken } from "./auth/jwt.js";
import { registerMcpEndpoint } from "@openteams/mcp-core";
import { WebRTCSignalingFrameSchema } from "@openteams/shared-types";
import websocket from "@fastify/websocket";
import { authenticateFactory } from "./context.js";
import { buildToolRegistry } from "./tools/index.js";
import { AuthWorkspaceClient } from "./internal/client.js";
import { RoomManager, type ActiveCall } from "./rooms.js";
import type { WebSocket } from "ws";

/*
 * Persistence note (deliberate decision — Option A): mcp-media-rtc is fully
 * stateless/in-memory. Call rooms live and die with the process; there is no
 * call history worth persisting yet, so Prisma/PostgreSQL were removed from
 * this service entirely. The health check therefore reports unconditionally.
 */

export interface ServerHandle {
  readonly app: FastifyInstance;
  readonly env: AppEnv;
  readonly port: number;
  start(): Promise<string>;
  close(): Promise<void>;
}

function safeSend(socket: WebSocket | null, payload: string): void {
  if (socket && socket.readyState === socket.OPEN) socket.send(payload);
}

function snapshot(call: ActiveCall) {
  return [...call.participants.values()].map((p) => ({
    userId: p.userId,
    joinedAt: p.joinedAt.toISOString(),
    audioMuted: p.audioMuted,
    videoOff: p.videoOff,
    screenSharing: p.screenSharing,
  }));
}

export function createServer(env: AppEnv): ServerHandle {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "debug" : "info",
      transport:
        env.NODE_ENV === "development" ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } } : undefined,
    },
    trustProxy: true,
    bodyLimit: 1 * 1024 * 1024,
  });

  const authClient = new AuthWorkspaceClient(env);
  const roomManager = new RoomManager();

  const registry = buildToolRegistry(authClient, roomManager);
  registerMcpEndpoint(app, registry, { path: "/mcp", authenticate: authenticateFactory(env) });

  app.register(websocket);

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "mcp-media-rtc",
      activeCalls: roomManager.getAllCalls().length,
      tools: registry.list(),
    };
  });

  // `GET /ws/call?token=<jwt>&callId=<id>`
  // Nested plugin scope is required for @fastify/websocket's onRoute wrapper
  // to transform this into a real WebSocket route.
  app.register((scope) => {
    scope.get("/ws/call", { websocket: true }, (socket: WebSocket, request) => {
      const url = new URL(request.url, "http://localhost");
      const token = url.searchParams.get("token") ?? "";
      const callId = url.searchParams.get("callId") ?? "";
  
      const claims = token ? verifyAccessToken(token, env) : null;
      if (!claims) {
        socket.close(4401, "Unauthorized: missing or invalid access token");
        return;
      }
      const userId = claims.sub;
  
      const call = roomManager.getCall(callId);
      if (!call) {
        socket.close(4404, "Unknown call");
        return;
      }
  
      // Verify channel access before admitting the peer.
      void authClient
        .getChannelAccess(call.channelId, userId)
        .then((access) => {
          if (!access.allowed || !access.workspaceId) {
            socket.close(4403, "Access denied");
            return;
          }
          if (socket.readyState !== socket.OPEN) return;
  
          roomManager.addParticipant(call.id, userId, socket);
  
          for (const [pid, p] of call.participants) {
            if (pid !== userId) safeSend(p.socket, JSON.stringify({ type: "peer-joined", userId }));
          }
          safeSend(socket, JSON.stringify({ type: "ready", callId: call.id, userId, participants: snapshot(call) }));
  
          const heartbeat = setInterval(() => {
            if (socket.readyState === socket.OPEN) socket.ping();
            else clearInterval(heartbeat);
          }, 30_000);
  
          socket.on("message", (data) => {
            let raw: unknown;
            try {
              raw = JSON.parse(data.toString());
            } catch {
              return; // non-JSON frame — drop
            }
            // Strict contract validation; malformed frames are silently dropped.
            const parsed = WebRTCSignalingFrameSchema.safeParse(raw);
            if (!parsed.success) return;
            const frame = parsed.data;
  
            if (frame.type === "media-state") {
              const participant = call.participants.get(userId);
              if (participant) {
                participant.audioMuted = frame.payload.audioMuted;
                participant.videoOff = frame.payload.videoOff;
                participant.screenSharing = frame.payload.screenSharing;
              }
            }
  
            const envelope = JSON.stringify({ type: frame.type, fromUserId: userId, payload: frame.payload });
            const target = frame.targetUserId ? call.participants.get(frame.targetUserId) : undefined;
            if (target) {
              safeSend(target.socket, envelope);
            } else {
              for (const [pid, p] of call.participants) {
                if (pid !== userId) safeSend(p.socket, envelope);
              }
            }
          });
  
          const leave = () => {
            clearInterval(heartbeat);
            const removed = roomManager.removeParticipant(call.id, userId);
            if (!removed) return;
            const remaining = roomManager.getCall(call.id);
            if (remaining) {
              for (const [, p] of remaining.participants) {
                safeSend(p.socket, JSON.stringify({ type: "peer-left", userId }));
              }
            }
          };
  
          socket.on("close", leave);
          socket.on("error", leave);
        })
        .catch(() => socket.close(1011, "Failed to resolve channel access"));
    });
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => void app.close());
  }

  return {
    app,
    env,
    port: env.PORT,
    async start() {
      await app.ready();
      const address = await app.listen({ port: env.PORT, host: "0.0.0.0" });
      app.log.info(`MCP tools registered: ${registry.size}`);
      return address;
    },
    async close() {
      await app.close();
    },
  };
}
