import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import { registerMcpEndpoint } from "@openteams/mcp-core";
import { prisma } from "./db.js";
import type { AppEnv } from "./env.js";
import { authenticateFactory } from "./context.js";
import { buildToolRegistry } from "./tools/index.js";
import { AuthWorkspaceClient } from "./internal/client.js";
import { createStorageBackend, PRESIGN_EXPIRES_SECONDS } from "./s3.js";
import { MAX_FILE_SIZE_BYTES, type DirectUploadDTO } from "@openteams/shared-types";
import { toFileDTO } from "./mappers.js";

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
    bodyLimit: MAX_FILE_SIZE_BYTES + 1024 * 1024,
  });

  const authClient = new AuthWorkspaceClient(env);
  const storage = createStorageBackend(env);

  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 8 } });
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "mcp-session-id", "mcp-protocol-version"],
    exposedHeaders: ["mcp-session-id"],
  });
  const registry = buildToolRegistry(prisma, authClient, storage);
  await app.register(rateLimit, { max: env.NODE_ENV === "production" ? 120 : 600, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: {
      info: { title: "OpenTeams Storage API", version: "0.1.0" },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      tags: [{ name: "system" }, { name: "storage" }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  registerMcpEndpoint(app, registry, { path: "/mcp", authenticate: authenticateFactory(env) });

  app.post<{ Reply: DirectUploadDTO | { error: string } }>("/upload", async (request, reply) => {
    const ctx = authenticateFactory(env)(request);
    if (!ctx.userId) return reply.code(401).send({ error: "Unauthorized" });
    const parts = request.parts();
    let workspaceId = "";
    let channelId = "";
    let filePart: Awaited<ReturnType<typeof request.file>> | undefined;
    for await (const part of parts) {
      if (part.type === "file") {
        if (filePart) return reply.code(400).send({ error: "Only one file is allowed" });
        filePart = part;
      } else if (part.fieldname === "workspaceId" && typeof part.value === "string") workspaceId = part.value;
      else if (part.fieldname === "channelId" && typeof part.value === "string") channelId = part.value;
    }
    if (!workspaceId || !channelId || !filePart) return reply.code(400).send({ error: "workspaceId, channelId and file are required" });
    const access = await authClient.getChannelAccess(channelId, ctx.userId);
    if (!access.allowed || access.workspaceId !== workspaceId) return reply.code(404).send({ error: "Channel not found or access denied" });
    const mimeType = filePart.mimetype || "application/octet-stream";
    const fileName = filePart.filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128) || "attachment";
    const body = await filePart.toBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_FILE_SIZE_BYTES) return reply.code(413).send({ error: "File size is invalid" });
    const fileId = randomUUID();
    const key = `workspaces/${workspaceId}/channels/${channelId}/${fileId}/${fileName}`;
    const record = await prisma.storedFile.create({ data: { id: fileId, workspaceId, channelId, key, fileName, mimeType, size: body.byteLength, status: "PENDING", uploaderId: ctx.userId } });
    try {
      await storage.putObject(key, body, mimeType);
      const uploaded = await prisma.storedFile.update({ where: { id: fileId }, data: { status: "UPLOADED" } });
      const url = await storage.presignGet(key);
      return reply.code(201).send({ file: toFileDTO(uploaded), downloadUrl: url, previewUrl: url, expiresIn: PRESIGN_EXPIRES_SECONDS });
    } catch (error) {
      request.log.error({ err: error, fileId }, "Direct upload failed");
      await prisma.storedFile.delete({ where: { id: record.id } }).catch(() => undefined);
      return reply.code(502).send({ error: "Storage upload failed" });
    }
  });

  const startedAt = Date.now();
  app.get("/metrics", async (_request, reply) => {
    reply.type("text/plain; version=0.0.4");
    return `openteams_service_up{service="mcp-storage"} 1\nopenteams_service_uptime_seconds{service="mcp-storage"} ${Math.floor((Date.now() - startedAt) / 1000)}\n`;
  });

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
      await storage.ensureBucket();
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
