import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import { registerMcpEndpoint } from "@openteams/mcp-core";
import websocket from "@fastify/websocket";
import { prisma } from "./db.js";
import type { AppEnv } from "./env.js";
import { authenticateFactory } from "./context.js";
import { buildToolRegistry } from "./tools/index.js";
import { AuthWorkspaceClient } from "./internal/client.js";
import { RealtimeHub } from "./realtime/hub.js";
import { registerSocketRoute } from "./realtime/socket.js";
import { createWorkspaceEventSubscriber } from "./realtime/subscriber.js";
import { completeLocalLlm } from "./ai/local-llm.js";
import { saveSubscription, pushConfigStatus } from "./push/web-push.js";
import type { TranslationLocale } from "@openteams/shared-types";

function isTranslationLocale(value: unknown): value is TranslationLocale {
  return value === "en" || value === "fr" || value === "ar";
}

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
  const workspaceEvents = createWorkspaceEventSubscriber(env, hub);

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "mcp-session-id", "mcp-protocol-version"],
    exposedHeaders: ["mcp-session-id"],
  });
  app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  const registry = buildToolRegistry(prisma, hub, authClient);
  await app.register(rateLimit, { max: env.NODE_ENV === "production" ? 120 : 600, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: {
      info: { title: "OpenTeams Messaging API", version: "0.1.0" },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      tags: [{ name: "system" }, { name: "messaging" }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  registerMcpEndpoint(app, registry, { path: "/mcp", authenticate: authenticateFactory(env) });

  app.get("/push/vapid-public-key", async (_request, reply) => {
    return reply.send({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null, configured: pushConfigStatus().configured });
  });

  app.post("/push/subscribe", async (request, reply) => {
    const ctx = authenticateFactory(env)(request);
    if (!ctx.userId) return reply.code(401).send({ error: "Unauthorized" });
    const candidate = (request.body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    if (typeof candidate.endpoint !== "string" || typeof candidate.keys?.p256dh !== "string" || typeof candidate.keys?.auth !== "string") {
      return reply.code(400).send({ error: "Invalid push subscription" });
    }
    saveSubscription(ctx.userId, { endpoint: candidate.endpoint, keys: { p256dh: candidate.keys.p256dh, auth: candidate.keys.auth } });
    return reply.code(201).send({ ok: true });
  });

  app.post("/summarize", async (request, reply) => {
    const ctx = authenticateFactory(env)(request);
    if (!ctx.userId) return reply.code(401).send({ error: "Unauthorized" });
    const body = (request.body ?? {}) as { channelId?: unknown; limit?: unknown };
    if (typeof body.channelId !== "string" || body.channelId.length === 0) {
      return reply.code(400).send({ error: "channelId is required" });
    }
    const access = await authClient.getChannelAccess(body.channelId, ctx.userId);
    if (!access.allowed) return reply.code(404).send({ error: "Channel not found or access denied" });
    const limit = typeof body.limit === "number" ? Math.min(100, Math.max(1, Math.floor(body.limit))) : 50;
    const messages = await prisma.message.findMany({
      where: { channelId: body.channelId, deletedAt: null, body: { not: null } },
      select: { authorId: true, body: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const transcript = messages.reverse().map((m) => `[${m.createdAt.toISOString()}] ${m.authorId}: ${m.body}`).join("\\n");
    if (!transcript) return reply.send({ summary: "No plaintext messages available to summarize.", sourceMessages: 0 });
    const summary = await completeLocalLlm([
      { role: "system", content: "Summarize enterprise channel messages faithfully. Do not invent facts. Return concise decisions, action items, risks, and open questions." },
      { role: "user", content: transcript.slice(0, 40_000) },
    ]);
    return reply.send({ summary, sourceMessages: messages.length });
  });

  app.post("/translate", async (request, reply) => {
    const ctx = authenticateFactory(env)(request);
    if (!ctx.userId) return reply.code(401).send({ error: "Unauthorized" });
    const body = (request.body ?? {}) as { channelId?: unknown; text?: unknown; targetLocale?: unknown };
    if (typeof body.channelId !== "string" || typeof body.text !== "string" || body.text.trim().length === 0 || !isTranslationLocale(body.targetLocale)) {
      return reply.code(400).send({ error: "channelId, text and targetLocale are required" });
    }
    const access = await authClient.getChannelAccess(body.channelId, ctx.userId);
    if (!access.allowed) return reply.code(404).send({ error: "Channel not found or access denied" });
    const translation = await completeLocalLlm([
      { role: "system", content: `Translate the user message to ${body.targetLocale}. Preserve meaning, names, formatting and confidentiality. Return only the translation.` },
      { role: "user", content: body.text.slice(0, 20_000) },
    ], { timeoutMs: 10_000 });
    return reply.send({ translation, targetLocale: body.targetLocale });
  });

  app.post("/suggest-reply", async (request, reply) => {
    const ctx = authenticateFactory(env)(request);
    if (!ctx.userId) return reply.code(401).send({ error: "Unauthorized" });
    const body = (request.body ?? {}) as { channelId?: unknown; thread?: unknown };
    if (typeof body.channelId !== "string" || typeof body.thread !== "string" || body.thread.length === 0) {
      return reply.code(400).send({ error: "channelId and thread are required" });
    }
    const access = await authClient.getChannelAccess(body.channelId, ctx.userId);
    if (!access.allowed) return reply.code(404).send({ error: "Channel not found or access denied" });
    const suggestion = await completeLocalLlm([
      { role: "system", content: "Suggest one short, professional reply to the thread. Return only the reply text and do not claim actions were completed." },
      { role: "user", content: body.thread.slice(0, 8_000) },
    ], { timeoutMs: 10_000 });
    return reply.send({ suggestion });
  });
  // WS routes must be declared inside a nested plugin scope so that the
  // @fastify/websocket `onRoute` wrapper applies (root-level routes are
  // dispatched as plain HTTP handlers and crash on socket calls).
  app.register(async (scope) => {
    registerSocketRoute(scope, env, hub, authClient);
  });

  const startedAt = Date.now();
  app.get("/metrics", async (_request, reply) => {
    reply.type("text/plain; version=0.0.4");
    return `openteams_service_up{service="mcp-messaging"} 1\nopenteams_service_uptime_seconds{service="mcp-messaging"} ${Math.floor((Date.now() - startedAt) / 1000)}\nopenteams_websocket_connections ${hub.connectionCount}\n`;
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
      await workspaceEvents.start();
      app.log.info(`MCP tools registered: ${registry.size}`);
      return address;
    },
    async close() {
      await app.close();
      await workspaceEvents.close();
      await prisma.$disconnect();
    },
  };
}
