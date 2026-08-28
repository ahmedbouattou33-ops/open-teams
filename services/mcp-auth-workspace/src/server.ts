import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import { registerMcpEndpoint } from "@openteams/mcp-core";
import { prisma } from "./db.js";
import type { AppEnv } from "./env.js";
import { authenticateFactory } from "./context.js";
import { buildToolRegistry } from "./tools/index.js";
import { registerInternalRoutes } from "./internal.js";
import { createMemberEventPublisher } from "./realtime/events.js";
import { registerAdminRoutes } from "./admin.js";

export interface ServerHandle {
  readonly app: FastifyInstance;
  readonly env: AppEnv;
  readonly port: number;
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

  const memberEvents = createMemberEventPublisher(env);
  const registry = buildToolRegistry(env, prisma, (event) => memberEvents.publish(event));
  await app.register(rateLimit, { max: env.NODE_ENV === "production" ? 120 : 600, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: {
      info: { title: "OpenTeams Auth & Workspace API", version: "0.1.0" },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      tags: [{ name: "system" }, { name: "mcp" }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "mcp-session-id", "mcp-protocol-version"],
    exposedHeaders: ["mcp-session-id"],
  });
  registerMcpEndpoint(app, registry, { path: "/mcp", authenticate: authenticateFactory(env) });
  registerInternalRoutes(app, prisma, env.INTERNAL_API_KEY);
  registerAdminRoutes(app, prisma, env);

  const startedAt = Date.now();
  app.get("/metrics", async (_request, reply) => {
    reply.type("text/plain; version=0.0.4");
    return `openteams_service_up{service="mcp-auth-workspace"} 1\nopenteams_service_uptime_seconds{service="mcp-auth-workspace"} ${Math.floor((Date.now() - startedAt) / 1000)}\n`;
  });

  app.get("/health", async () => {
    const dbReachable = await prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    return {
      status: dbReachable ? "ok" : "degraded",
      service: "mcp-auth-workspace",
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
    async start() {
      await app.ready();
      const address = await app.listen({ port: env.PORT, host: "0.0.0.0" });
      app.log.info(`MCP tools registered: ${registry.size}`);
      return address;
    },
    async close() {
      await app.close();
      await memberEvents.close();
      await prisma.$disconnect();
    },
  };
}
