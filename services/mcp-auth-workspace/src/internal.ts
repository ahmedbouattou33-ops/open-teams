import type { FastifyInstance } from "fastify";
import { getChannelAccess } from "./rbac.js";
import type { PrismaClient } from "./generated/prisma/index.js";

/**
 * Service-to-service API for trusted MCP services (messaging, media, storage).
 * Guarded by a shared `x-internal-key` secret; disabled entirely when
 * INTERNAL_API_KEY is not configured.
 */
export function registerInternalRoutes(app: FastifyInstance, prisma: PrismaClient, internalKey: string | undefined): void {
  if (!internalKey) {
    app.log.warn("INTERNAL_API_KEY not set — internal service API disabled");
    return;
  }

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/internal/")) return;
    if (request.headers["x-internal-key"] !== internalKey) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  });

  /** Channel access check used by messaging/media before any write or read. */
  app.get<{ Params: { channelId: string; userId: string } }>(
    "/internal/channels/:channelId/access/:userId",
    async (request) => {
      const access = await getChannelAccess(prisma, request.params.channelId, request.params.userId);
      return {
        allowed: access !== null,
        role: access?.role ?? null,
        workspaceId: access?.workspaceId ?? null,
        channelType: access?.channelType ?? null,
      };
    },
  );

  /** All channel IDs a user can currently reach (for socket room subscription). */
  app.get<{ Params: { userId: string } }>("/internal/users/:userId/channels", async (request) => {
    const memberships = await prisma.channelMember.findMany({
      where: { userId: request.params.userId },
      select: { channelId: true },
    });
    const publicChannels = await prisma.channel.findMany({
      where: {
        type: "PUBLIC",
        workspace: { members: { some: { userId: request.params.userId } } },
      },
      select: { id: true },
    });
    const ids = new Set<string>([...memberships.map((m) => m.channelId), ...publicChannels.map((c) => c.id)]);
    return { channelIds: [...ids] };
  });
}
