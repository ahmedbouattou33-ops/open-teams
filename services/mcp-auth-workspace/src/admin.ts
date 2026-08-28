import type { FastifyInstance, FastifyRequest } from "fastify";
import os from "node:os";
import type { PrismaClient } from "./generated/prisma/index.js";
import type { AppEnv } from "./env.js";
import { verifyAccessToken } from "./auth/jwt.js";

const serviceTargets: Record<string, string> = {
  "mcp-auth-workspace": "http://127.0.0.1:4001/health",
  "mcp-messaging": "http://messaging:4002/health",
  "mcp-media-rtc": "http://rtc:4003/health",
  "mcp-storage": "http://storage:4004/health",
  "mcp-ai-agent": "http://ai-agent:4005/health",
  minio: "http://minio:9000/minio/health/live",
};

async function requireWorkspaceAdmin(request: FastifyRequest, prisma: PrismaClient, env: AppEnv): Promise<{ userId: string; workspaceId: string }> {
  const header = request.headers.authorization;
  const claims = header?.startsWith("Bearer ") ? verifyAccessToken(header.slice(7).trim(), env) : null;
  if (!claims?.sub) throw new Error("Unauthorized");
  const workspaceId = String((request.query as { workspaceId?: string } | undefined)?.workspaceId ?? request.headers["x-workspace-id"] ?? "");
  if (!workspaceId) throw new Error("workspaceId is required");
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: claims.sub } }, select: { role: true } });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) throw new Error("Workspace admin role required");
  return { userId: claims.sub, workspaceId };
}

async function probe(name: string, url: string): Promise<{ name: string; status: "ONLINE" | "OFFLINE" | "DEGRADED"; latencyMs: number; checkedAt: string }> {
  const started = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    const latencyMs = Math.round(performance.now() - started);
    return { name, status: response.ok ? "ONLINE" : "DEGRADED", latencyMs, checkedAt: new Date().toISOString() };
  } catch {
    return { name, status: "OFFLINE", latencyMs: Math.round(performance.now() - started), checkedAt: new Date().toISOString() };
  }
}

export function registerAdminRoutes(app: FastifyInstance, prisma: PrismaClient, env: AppEnv): void {
  app.get("/admin/health", async (request, reply) => {
    try { await requireWorkspaceAdmin(request, prisma, env); } catch (error) { return reply.code(String(error).includes("Unauthorized") ? 401 : 403).send({ error: String(error) }); }
    const dbStarted = performance.now();
    const dbOnline = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const services = await Promise.all(Object.entries(serviceTargets).map(([name, url]) => probe(name, url)));
    services[0] = { name: "mcp-auth-workspace", status: dbOnline ? "ONLINE" : "DEGRADED", latencyMs: Math.round(performance.now() - dbStarted), checkedAt: new Date().toISOString() };
    const memory = process.memoryUsage();
    return { status: services.every((service) => service.status === "ONLINE") && dbOnline ? "ONLINE" : "DEGRADED", services, postgres: dbOnline ? "ONLINE" : "OFFLINE", telemetry: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, cpuLoad1m: os.loadavg()[0] ?? 0, websocketLatencyMs: Math.max(...services.map((service) => service.latencyMs), 0), sampledAt: new Date().toISOString() } };
  });

  app.get("/admin/stats", async (request, reply) => {
    let context: { workspaceId: string };
    try { context = await requireWorkspaceAdmin(request, prisma, env); } catch (error) { return reply.code(String(error).includes("Unauthorized") ? 401 : 403).send({ error: String(error) }); }
    const [users, members, tasks, channels, invites, sessions] = await Promise.all([
      prisma.user.count(),
      prisma.workspaceMember.count({ where: { workspaceId: context.workspaceId } }),
      prisma.workTask.count({ where: { workspaceId: context.workspaceId } }),
      prisma.channel.count({ where: { workspaceId: context.workspaceId } }),
      prisma.workspaceInvite.count({ where: { workspaceId: context.workspaceId, status: "PENDING" } }),
      prisma.refreshToken.count({ where: { revokedAt: null, expiresAt: { gt: new Date() }, user: { workspaceMembers: { some: { workspaceId: context.workspaceId } } } } }),
    ]);
    return { workspaceId: context.workspaceId, users, activeMembers: members, channels, tasks, pendingInvites: invites, activeSessions: sessions, collectedAt: new Date().toISOString() };
  });

  app.get<{ Querystring: { workspaceId?: string; format?: string } }>("/admin/export-audit-logs", async (request, reply) => {
    let context: { workspaceId: string };
    try { context = await requireWorkspaceAdmin(request, prisma, env); } catch (error) { return reply.code(String(error).includes("Unauthorized") ? 401 : 403).send({ error: String(error) }); }
    const format = request.query.format === "csv" ? "csv" : "json";
    const [memberships, invites, sessions] = await Promise.all([
      prisma.workspaceMember.findMany({ where: { workspaceId: context.workspaceId }, include: { user: { select: { email: true, displayName: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.workspaceInvite.findMany({ where: { workspaceId: context.workspaceId }, select: { id: true, inviteeEmail: true, role: true, status: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: "asc" } }),
      prisma.refreshToken.findMany({ where: { user: { workspaceMembers: { some: { workspaceId: context.workspaceId } } } }, select: { id: true, userId: true, createdAt: true, expiresAt: true, revokedAt: true }, orderBy: { createdAt: "asc" } }),
    ]);
    const events = [
      ...memberships.map((item) => ({ timestamp: item.createdAt.toISOString(), category: "membership", event: "member.joined", actor: item.user.email, subject: item.user.displayName, role: item.role, source: "postgres" })),
      ...invites.map((item) => ({ timestamp: item.createdAt.toISOString(), category: "invitation", event: `invite.${item.status.toLowerCase()}`, actor: item.inviteeEmail ?? "anonymous", subject: item.id, role: item.role, source: "postgres", expiresAt: item.expiresAt.toISOString() })),
      ...sessions.map((item) => ({ timestamp: item.createdAt.toISOString(), category: "authentication", event: item.revokedAt ? "session.revoked" : "session.active", actor: item.userId, subject: item.id, expiresAt: item.expiresAt.toISOString(), source: "postgres" })),
    ];
    if (format === "csv") {
      const columns = ["timestamp", "category", "event", "actor", "subject", "role", "expiresAt", "source"];
      const quote = (value: unknown) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
      const csv = [columns.join(","), ...events.map((event) => columns.map((column) => quote(event[column as keyof typeof event])).join(","))].join("\n");
      return reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", "attachment; filename=openteams-audit.csv").send(csv);
    }
    return reply.header("content-disposition", "attachment; filename=openteams-audit.json").send({ workspaceId: context.workspaceId, generatedAt: new Date().toISOString(), events, unavailableSources: ["panic_mode", "file_access"], note: "Panic Mode and file access require persisted AuditEvent records in a future migration; no synthetic records are generated." });
  });

  app.get("/admin/siem-logs", async (request, reply) => {
    try { await requireWorkspaceAdmin(request, prisma, env); } catch (error) { return reply.code(String(error).includes("Unauthorized") ? 401 : 403).send({ error: String(error) }); }
    return { events: [], source: "workspace-audit-stream", message: "No persisted SIEM events are available in this deployment yet." };
  });

  async function requirePathAdmin(request: FastifyRequest, workspaceId: string): Promise<string> {
    const header = request.headers.authorization;
    const claims = header?.startsWith("Bearer ") ? verifyAccessToken(header.slice(7).trim(), env) : null;
    if (!claims?.sub) throw new Error("Unauthorized");
    const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: claims.sub } }, select: { role: true } });
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) throw new Error("Workspace admin role required");
    return claims.sub;
  }

  app.get<{ Params: { id: string }; Querystring: { page?: string; pageSize?: string; search?: string; role?: string; status?: string } }>("/workspaces/:id/members", async (request, reply) => {
    try { await requirePathAdmin(request, request.params.id); } catch (error) { return reply.code(String(error).includes("Unauthorized") ? 401 : 403).send({ error: String(error) }); }
    const page = Math.max(1, Number(request.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize ?? 25) || 25));
    const search = request.query.search?.trim();
    const role = ["OWNER", "ADMIN", "MEMBER", "GUEST"].includes(request.query.role ?? "") ? request.query.role as "OWNER" | "ADMIN" | "MEMBER" | "GUEST" : undefined;
    const status = ["ONLINE", "OFFLINE", "AWAY", "DND"].includes(request.query.status ?? "") ? request.query.status as "ONLINE" | "OFFLINE" | "AWAY" | "DND" : undefined;
    const where = { workspaceId: request.params.id, ...(role ? { role } : {}), ...(status ? { user: { status } } : {}), ...(search ? { user: { ...(status ? { status } : {}), OR: [{ displayName: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } } : {}) };
    const [total, rows] = await Promise.all([prisma.workspaceMember.count({ where }), prisma.workspaceMember.findMany({ where, include: { user: true }, orderBy: { createdAt: "asc" }, skip: (page - 1) * pageSize, take: pageSize })]);
    return { items: rows.map((row) => ({ id: row.id, workspaceId: row.workspaceId, userId: row.userId, displayName: row.user.displayName, email: row.user.email, role: row.role, status: row.user.status, department: null, joinedAt: row.createdAt.toISOString() })), page, pageSize, total };
  });

  app.patch<{ Params: { id: string; userId: string }; Body: { role?: string } }>("/workspaces/:id/members/:userId/role", async (request, reply) => {
    try { await requirePathAdmin(request, request.params.id); } catch (error) { return reply.code(String(error).includes("Unauthorized") ? 401 : 403).send({ error: String(error) }); }
    const role = request.body?.role;
    if (!role || !["ADMIN", "MEMBER", "GUEST"].includes(role)) return reply.code(400).send({ error: "role must be ADMIN, MEMBER or GUEST" });
    const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.params.userId } }, select: { role: true } });
    if (!target || target.role === "OWNER") return reply.code(404).send({ error: "Member not found or owner is immutable" });
    const updated = await prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.params.userId } }, data: { role: role as "ADMIN" | "MEMBER" | "GUEST" } });
    return { ok: true, role: updated.role };
  });

  app.delete<{ Params: { id: string; userId: string } }>("/workspaces/:id/members/:userId", async (request, reply) => {
    try { await requirePathAdmin(request, request.params.id); } catch (error) { return reply.code(String(error).includes("Unauthorized") ? 401 : 403).send({ error: String(error) }); }
    const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.params.userId } }, select: { role: true } });
    if (!target || target.role === "OWNER") return reply.code(404).send({ error: "Member not found or owner cannot be removed" });
    await prisma.$transaction([prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.params.userId } } }), prisma.channelMember.deleteMany({ where: { userId: request.params.userId, channel: { workspaceId: request.params.id } } })]);
    return { ok: true };
  });

  app.post<{ Params: { id: string; userId: string } }>("/workspaces/:id/members/:userId/revoke-sessions", async (request, reply) => {
    try { await requirePathAdmin(request, request.params.id); } catch (error) { return reply.code(String(error).includes("Unauthorized") ? 401 : 403).send({ error: String(error) }); }
    const result = await prisma.refreshToken.updateMany({ where: { userId: request.params.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true, revoked: result.count };
  });
}
