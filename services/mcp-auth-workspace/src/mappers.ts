import type {
  AuthResult,
  ChannelDTO,
  UserDTO,
  WorkspaceDTO,
  ChannelType,
  MemberRole,
} from "@openteams/shared-types";
import type { User, Workspace, WorkspaceMember, Channel, ChannelMember } from "./generated/prisma/index.js";

export function toUserDTO(user: Pick<User, "id" | "email" | "displayName" | "avatarUrl" | "status" | "identityPublicKey" | "createdAt">): UserDTO {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    hasIdentityKey: user.identityPublicKey !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toWorkspaceDTO(workspace: Workspace, membership: Pick<WorkspaceMember, "role">): WorkspaceDTO {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    ownerId: workspace.ownerId,
    role: membership.role,
    createdAt: workspace.createdAt.toISOString(),
  };
}

export interface ChannelWithMemberships extends Channel {
  members: Array<Pick<ChannelMember, "userId" | "role">>;
}

export function toChannelDTO(channel: ChannelWithMemberships, viewerId: string): ChannelDTO {
  const mine = channel.members.find((m) => m.userId === viewerId);
  return {
    id: channel.id,
    workspaceId: channel.workspaceId,
    name: channel.name,
    type: channel.type satisfies ChannelType as ChannelType,
    isEncrypted: channel.isEncrypted,
    joined: mine !== undefined,
    myRole: (mine?.role ?? null) satisfies MemberRole | null as MemberRole | null,
  };
}

export interface AuthResultInput {
  user: Parameters<typeof toUserDTO>[0];
  accessToken: string;
  refreshToken: string;
}

export function toAuthResult({ user, accessToken, refreshToken }: AuthResultInput): AuthResult {
  return { user: toUserDTO(user), tokens: { accessToken, refreshToken } };
}
