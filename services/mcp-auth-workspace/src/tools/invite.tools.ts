import { randomBytes } from "node:crypto";
import { defineTool } from "@openteams/mcp-core";
import {
  AcceptInviteInputSchema, CreateInviteInputSchema, ListWorkspaceInvitesInputSchema, ListWorkspaceMembersInputSchema,
  RemoveMemberInputSchema, RevokeInviteInputSchema, ToolName, UpdateMemberRoleInputSchema,
  type WorkspaceInviteDTO, type WorkspaceMemberDTO,
} from "@openteams/shared-types";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { MemberJoinedEvent } from "../realtime/events.js";

const adminRoles = new Set(["OWNER", "ADMIN"]);
async function access(prisma: PrismaClient, workspaceId: string, userId: string) {
  const row = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true } });
  if (!row) throw new Error("You are not a member of this workspace");
  return row.role;
}
async function admin(prisma: PrismaClient, workspaceId: string, userId: string) {
  const role = await access(prisma, workspaceId, userId);
  if (!adminRoles.has(role)) throw new Error("Only workspace owners or admins can manage invitations and members");
  return role;
}
function inviteDto(x: any): WorkspaceInviteDTO { return { id: x.id, workspaceId: x.workspaceId, inviterUserId: x.inviterUserId, inviteeEmail: x.inviteeEmail, role: x.role, status: x.status, maxUses: x.maxUses, useCount: x.useCount, expiresAt: x.expiresAt.toISOString(), createdAt: x.createdAt.toISOString() }; }
function memberDto(x: any): WorkspaceMemberDTO { return { id: x.id, workspaceId: x.workspaceId, userId: x.userId, displayName: x.user.displayName, email: x.user.email, role: x.role, status: x.user.status, joinedAt: x.createdAt.toISOString() }; }
function refreshStatus(invite: any) { return invite.status === "PENDING" && invite.expiresAt.getTime() <= Date.now() ? "EXPIRED" : invite.status; }

export function buildInviteTools(prisma: PrismaClient, publishMemberJoined?: (event: MemberJoinedEvent) => Promise<void>) {
  return [
    defineTool({ name: ToolName.CreateInvite, description: "Creates a secure workspace invitation or directly adds an existing user to selected channels.", input: CreateInviteInputSchema, secure: true, handler: async (input, ctx): Promise<{ inviteId: string; code: string; inviteUrl: string; directAdded: boolean; userId?: string }> => {
      await admin(prisma, input.workspaceId, ctx.userId as string);
      if (input.directAdd && input.email) {
        const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true, email: true, displayName: true, status: true } });
        if (user) {
          const joined = await prisma.$transaction(async (tx) => {
            const membership = await tx.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: user.id } }, update: { role: input.role }, create: { workspaceId: input.workspaceId, userId: user.id, role: input.role } });
            const channels = await tx.channel.findMany({ where: { workspaceId: input.workspaceId, id: { in: input.channelIds } }, select: { id: true } });
            for (const channel of channels) await tx.channelMember.upsert({ where: { channelId_userId: { channelId: channel.id, userId: user.id } }, update: { role: input.role }, create: { channelId: channel.id, userId: user.id, role: input.role } });
            return membership;
          });
          await publishMemberJoined?.({ type: "member.joined", workspaceId: input.workspaceId, userId: user.id, displayName: user.displayName, email: user.email, role: joined.role, joinedAt: joined.createdAt.toISOString() });
          return { inviteId: "", code: "", inviteUrl: "", directAdded: true, userId: user.id };
        }
      }
      const code = randomBytes(32).toString("base64url");
      const invite = await prisma.workspaceInvite.create({ data: { workspaceId: input.workspaceId, inviterUserId: ctx.userId as string, inviteeEmail: input.email?.toLowerCase(), code, role: input.role, maxUses: input.maxUses, expiresAt: new Date(Date.now() + input.expiresInHours * 3600000) } });
      return { inviteId: invite.id, code, inviteUrl: `/invite/${code}`, directAdded: false };
    } }),
    defineTool({ name: ToolName.AcceptInvite, description: "Accepts a valid invitation for the authenticated caller and joins the workspace.", input: AcceptInviteInputSchema, secure: true, handler: async (input, ctx): Promise<{ workspaceId: string; role: string; alreadyMember: boolean }> => {
      const userId = ctx.userId as string;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } });
      if (!user) throw new Error("Authenticated user not found");
      const joined = await prisma.$transaction(async (tx) => {
        const invite = await tx.workspaceInvite.findUnique({ where: { code: input.code } });
        if (!invite) throw new Error("Invitation not found");
        const currentStatus = refreshStatus(invite);
        if (currentStatus !== "PENDING") throw new Error(`Invitation is ${currentStatus.toLowerCase()}`);
        if (invite.maxUses !== null && invite.useCount >= invite.maxUses) throw new Error("Invitation has reached its maximum uses");
        if (invite.inviteeEmail && invite.inviteeEmail.toLowerCase() !== user.email.toLowerCase()) throw new Error("This invitation is restricted to another email");
        const existing = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } } });
        if (existing) return { workspaceId: invite.workspaceId, role: existing.role, alreadyMember: true, joinedAt: existing.createdAt.toISOString(), displayName: user.displayName, email: user.email };
        await tx.workspaceMember.create({ data: { workspaceId: invite.workspaceId, userId, role: invite.role } });
        const general = await tx.channel.findFirst({ where: { workspaceId: invite.workspaceId, name: "general" }, select: { id: true } });
        if (general) await tx.channelMember.create({ data: { channelId: general.id, userId, role: invite.role } });
        const nextUses = invite.useCount + 1;
        await tx.workspaceInvite.update({ where: { id: invite.id }, data: { useCount: nextUses, status: invite.maxUses !== null && nextUses >= invite.maxUses ? "ACCEPTED" : undefined } });
        return { workspaceId: invite.workspaceId, role: invite.role, alreadyMember: false, joinedAt: new Date().toISOString(), displayName: user.displayName, email: user.email };
      });
      if (!joined.alreadyMember) {
        await publishMemberJoined?.({ type: "member.joined", workspaceId: joined.workspaceId, userId, displayName: joined.displayName, email: joined.email, role: joined.role, joinedAt: joined.joinedAt });
      }
      return { workspaceId: joined.workspaceId, role: joined.role, alreadyMember: joined.alreadyMember };
    } }),
    defineTool({ name: ToolName.ListWorkspaceInvites, description: "Lists pending and historical workspace invitations for admins.", input: ListWorkspaceInvitesInputSchema, secure: true, handler: async (input, ctx): Promise<{ invites: WorkspaceInviteDTO[] }> => {
      await admin(prisma, input.workspaceId, ctx.userId as string);
      const rows = await prisma.workspaceInvite.findMany({ where: { workspaceId: input.workspaceId }, orderBy: { createdAt: "desc" } });
      return { invites: rows.map((row) => inviteDto({ ...row, status: refreshStatus(row) })) };
    } }),
    defineTool({ name: ToolName.RevokeInvite, description: "Revokes a workspace invitation; only its workspace admins may do so.", input: RevokeInviteInputSchema, secure: true, handler: async (input, ctx): Promise<{ ok: true }> => {
      const invite = await prisma.workspaceInvite.findUnique({ where: { id: input.inviteId }, select: { workspaceId: true } });
      if (!invite) throw new Error("Invitation not found");
      await admin(prisma, invite.workspaceId, ctx.userId as string);
      await prisma.workspaceInvite.update({ where: { id: input.inviteId }, data: { status: "REVOKED" } });
      return { ok: true };
    } }),
    defineTool({ name: ToolName.ListWorkspaceMembers, description: "Lists members and live account status for a workspace member.", input: ListWorkspaceMembersInputSchema, secure: true, handler: async (input, ctx): Promise<{ members: WorkspaceMemberDTO[] }> => {
      await access(prisma, input.workspaceId, ctx.userId as string);
      const rows = await prisma.workspaceMember.findMany({ where: { workspaceId: input.workspaceId }, include: { user: true }, orderBy: { createdAt: "asc" } });
      return { members: rows.map(memberDto) };
    } }),
    defineTool({ name: ToolName.UpdateMemberRole, description: "Updates a non-owner workspace member role under strict owner/admin rules.", input: UpdateMemberRoleInputSchema, secure: true, handler: async (input, ctx): Promise<{ ok: true }> => {
      const actorRole = await admin(prisma, input.workspaceId, ctx.userId as string);
      const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } }, select: { role: true } });
      if (!target) throw new Error("Member not found");
      if (target.role === "OWNER" || input.userId === ctx.userId) throw new Error("Owner role and self role changes are blocked");
      if (actorRole === "ADMIN" && target.role === "ADMIN") throw new Error("An admin cannot change another admin");
      await prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } }, data: { role: input.role } });
      return { ok: true };
    } }),
    defineTool({ name: ToolName.RemoveMember, description: "Removes a member or lets the caller leave; owners cannot be removed.", input: RemoveMemberInputSchema, secure: true, handler: async (input, ctx): Promise<{ ok: true }> => {
      const actorId = ctx.userId as string;
      const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } }, select: { role: true } });
      if (!target) throw new Error("Member not found");
      if (target.role === "OWNER") throw new Error("The workspace owner cannot be removed");
      if (input.userId !== actorId) {
        const actorRole = await admin(prisma, input.workspaceId, actorId);
        if (actorRole === "ADMIN" && target.role === "ADMIN") throw new Error("An admin cannot remove another admin");
      }
      await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } } });
      await prisma.channelMember.deleteMany({ where: { userId: input.userId, channel: { workspaceId: input.workspaceId } } });
      return { ok: true };
    } }),
  ] as const;
}
