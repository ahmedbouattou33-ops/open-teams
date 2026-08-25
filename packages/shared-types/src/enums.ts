import { z } from "zod";

export const MemberRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const ChannelTypeSchema = z.enum(["PUBLIC", "PRIVATE", "DIRECT"]);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const UserStatusSchema = z.enum(["ONLINE", "OFFLINE", "AWAY", "DND"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const ROLE_HIERARCHY: Readonly<Record<MemberRole, number>> = Object.freeze({
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  GUEST: 1,
});

export function roleAtLeast(role: MemberRole, min: MemberRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[min];
}
