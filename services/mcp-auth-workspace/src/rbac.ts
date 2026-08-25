import { AppErrorCode, McpError } from "@openteams/mcp-core";
import { roleAtLeast, type ChannelType, type MemberRole } from "@openteams/shared-types";
import type { PrismaClient } from "./generated/prisma/index.js";

export interface WorkspaceMembership {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: MemberRole;
}

export interface ChannelAccess {
  readonly channelId: string;
  readonly workspaceId: string;
  readonly userId: string;
  /** Effective role (channel role if member; otherwise inherited workspace role). */
  readonly role: MemberRole;
  readonly channelType: ChannelType;
  readonly isDirectMember: boolean;
}

/**
 * Enforces the RBAC hierarchy at the tool boundary.
 * - Unknown workspace  -> NotFound
 * - No membership      -> Forbidden
 * - Role below `min`   -> Forbidden
 */
export async function assertWorkspaceRole(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string,
  min: MemberRole,
): Promise<WorkspaceMembership> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) throw McpError.notFound("Workspace not found");

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!member) throw McpError.forbidden("You are not a member of this workspace");
  if (!roleAtLeast(member.role, min)) {
    throw McpError.forbidden(`Requires ${min} role or higher`);
  }
  return { workspaceId, userId, role: member.role };
}

/**
 * Channel-level access rule:
 * - DIRECT channels and PRIVATE channels require explicit ChannelMember.
 * - PUBLIC channels inherit workspace membership (GUEST+).
 */
export async function getChannelAccess(
  prisma: PrismaClient,
  channelId: string,
  userId: string,
): Promise<ChannelAccess | null> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, workspaceId: true, type: true },
  });
  if (!channel) return null;

  const [direct, wsMembership] = await Promise.all([
    prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { role: true },
    }),
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: channel.workspaceId, userId } },
      select: { role: true },
    }),
  ]);

  const isPublic = channel.type === "PUBLIC" && direct === null && wsMembership !== null;
  if (!isPublic && !direct) return null;

  return {
    channelId,
    workspaceId: channel.workspaceId,
    userId,
    role: (direct?.role ?? wsMembership!.role) as MemberRole,
    channelType: channel.type,
    isDirectMember: direct !== null,
  };
}

export function requireChannelAccess(access: ChannelAccess | null): ChannelAccess {
  if (!access) throw McpError.notFound("Channel not found or access denied");
  return access;
}
