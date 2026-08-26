import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerMcpEndpoint } from "@openteams/mcp-core";
import websocket from "@fastify/websocket";
import { prisma } from "./db.js";
import type { AppEnv } from "./env.js";
import { authenticateFactory } from "./context.js";
import { buildToolRegistry } from "./tools/index.js";
import { AuthWorkspaceClient } from "./internal/client.js";
import { RealtimeHub } from "./realtime/hub.js";
import { registerSocketRoute } from "./realtime/socket.js";

export interface ServerHandle {
  readonly app: FastifyInstance;
  readonly env: AppEnv;
  readonly port: number;
  readonly hub: RealtimeHub;
  start(): Promise<string>;
  close(): Promise<void>;
}

export async function createServer(env: AppEnv): Promise<ServerHandle> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "debug" : "info",
      transport:
        env.NODE_ENV === "development" ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } } : undefined,
    },
    trustProxy: true,
    bodyLimit: 1 * 1024 * 1024,
  });

  const hub = new RealtimeHub();
  const authClient = new AuthWorkspaceClient(env);

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "mcp-session-id", "mcp-protocol-version"],
    exposedHeaders: ["mcp-session-id"],
  });
  app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  const registry = buildToolRegistry(prisma, hub, authClient);
  registerMcpEndpoint(app, registry, { path: "/mcp", authenticate: authenticateFactory(env) });
  // WS routes must be declared inside a nested plugin scope so that the
  // @fastify/websocket `onRoute` wrapper applies (root-level routes are
  // dispatched as plain HTTP handlers and crash on socket calls).
  app.register(async (scope) => {
    registerSocketRoute(scope, env, hub, authClient);
  });

  app.get("/health", async () => {
    const dbReachable = await prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    return {
      status: dbReachable ? "ok" : "degraded",
      service: "mcp-messaging",
      realtimeConnections: hub.connectionCount,
      tools: registry.list(),
    };
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => void app.close());
  }

  return {
    app,
    env,
    port: env.PORT,
    hub,
    async start() {
      await app.ready();
      const address = await app.listen({ port: env.PORT, host: "0.0.0.0" });
      app.log.info(`MCP tools registered: ${registry.size}`);
      return address;
    },
    async close() {
      await app.close();
      await prisma.$disconnect();
    },
  };
}
