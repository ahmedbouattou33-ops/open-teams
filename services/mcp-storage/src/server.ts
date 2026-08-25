import Fastify, { type FastifyInstance } from "fastify";
import { registerMcpEndpoint } from "@openteams/mcp-core";
import { prisma } from "./db.js";
import type { AppEnv } from "./env.js";
import { authenticateFactory } from "./context.js";
import { buildToolRegistry } from "./tools/index.js";
import { AuthWorkspaceClient } from "./internal/client.js";
import { createStorageBackend } from "./s3.js";

export interface ServerHandle {
  readonly app: FastifyInstance;
  readonly env: AppEnv;
  readonly port: number;
  start(): Promise<string>;
  close(): Promise<void>;
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
  const storage = createStorageBackend(env);

  const registry = buildToolRegistry(prisma, authClient, storage);
  registerMcpEndpoint(app, registry, { path: "/mcp", authenticate: authenticateFactory(env) });

  app.get("/health", async () => {
    const dbReachable = await prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    return {
      status: dbReachable ? "ok" : "degraded",
      service: "mcp-storage",
      bucket: env.S3_BUCKET_NAME,
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
      await prisma.$disconnect();
    },
  };
}
