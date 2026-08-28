import { z } from "zod";

export * from "./enums.js";
import { ChannelTypeSchema, MemberRoleSchema, UserStatusSchema } from "./enums.js";

/* ---------- DTOs ---------- */

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: z.infer<typeof UserStatusSchema>;
  hasIdentityKey: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: UserDTO;
  tokens: AuthTokens;
}

export interface WorkspaceDTO {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: z.infer<typeof MemberRoleSchema>;
  createdAt: string;
}

export interface ChannelDTO {
  id: string;
  workspaceId: string;
  name: string;
  type: z.infer<typeof ChannelTypeSchema>;
  isEncrypted: boolean;
  joined: boolean;
  myRole: z.infer<typeof MemberRoleSchema> | null;
}

/* ---------- Tool I/O schemas ---------- */

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a digit");

const slugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

const channelNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-_]+$/, "Channel name may only contain lowercase letters, digits, '-' and '_'");

/** X25519 SPKI DER public keys are exactly 44 bytes (base64: 60 chars incl. padding). */
export const identityPublicKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, "identityPublicKey must be base64-encoded")
  .refine((v) => {
    // Decoded byte length = floor(len * 3 / 4) minus padding chars.
    const padding = (v.match(/=+$/)?.[0].length ?? 0);
    return Math.floor((v.length * 3) / 4) - padding === 44;
  }, { message: "identityPublicKey must decode to 44 bytes (X25519 SPKI DER)" });

export const RegisterUserInputSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: passwordSchema,
  displayName: z.string().min(1).max(64).trim(),
});
export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;

export const AuthenticateUserInputSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(1).max(128),
});
export type AuthenticateUserInput = z.infer<typeof AuthenticateUserInputSchema>;

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string().min(20).max(256),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenInputSchema>;

export const StoreUserPublicKeyInputSchema = z.object({
  identityPublicKey: identityPublicKeySchema,
});
export type StoreUserPublicKeyInput = z.infer<typeof StoreUserPublicKeyInputSchema>;

export const GetUserPublicKeyInputSchema = z.object({
  userId: z.string().min(1),
});
export type GetUserPublicKeyInput = z.infer<typeof GetUserPublicKeyInputSchema>;

export const CreateWorkspaceInputSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  slug: slugSchema.optional(),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;

export const GetUserWorkspacesInputSchema = z.object({}).strict();
export type GetUserWorkspacesInput = z.infer<typeof GetUserWorkspacesInputSchema>;

export const CreateChannelInputSchema = z.object({
  workspaceId: z.string().min(1),
  name: channelNameSchema,
  type: ChannelTypeSchema.default("PUBLIC"),
  isEncrypted: z.boolean().default(false),
});
export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;

export const ListChannelsInputSchema = z.object({
  workspaceId: z.string().min(1),
});
export type ListChannelsInput = z.infer<typeof ListChannelsInputSchema>;

export const AgendaVisibilitySchema = z.enum(["PRIVATE", "SHARED", "WORKSPACE"]);
export type AgendaVisibility = z.infer<typeof AgendaVisibilitySchema>;
export const AgendaPermissionSchema = z.enum(["VIEW", "EDIT"]);
export type AgendaPermission = z.infer<typeof AgendaPermissionSchema>;

export const CreateAgendaEventInputSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(10_000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().min(1).max(80).default("UTC"),
  visibility: AgendaVisibilitySchema.default("PRIVATE"),
  workspaceId: z.string().min(1).optional(),
  participantUserIds: z.array(z.string().min(1)).max(100).default([]),
  participantPermission: AgendaPermissionSchema.default("VIEW"),
}).refine((v) => new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(), {
  message: "endsAt must be later than startsAt",
  path: ["endsAt"],
});
export type CreateAgendaEventInput = z.infer<typeof CreateAgendaEventInputSchema>;

export const ListAgendaEventsInputSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  workspaceId: z.string().min(1).optional(),
});
export type ListAgendaEventsInput = z.infer<typeof ListAgendaEventsInputSchema>;

export const CreateNoteInputSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().max(100_000),
  workspaceId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  isPrivate: z.boolean().default(true),
});
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;

export const ListNotesInputSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
});
export type ListNotesInput = z.infer<typeof ListNotesInputSchema>;

export interface AgendaEventDTO {
  id: string; ownerId: string; workspaceId: string | null; title: string;
  description: string | null; startsAt: string; endsAt: string; timezone: string;
  visibility: AgendaVisibility; participants: Array<{ userId: string; permission: AgendaPermission; accepted: boolean }>;
}
export interface WorkTaskDTO {
  id: string; workspaceId: string; creatorId: string; assigneeId: string | null;
  title: string; description: string | null; status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; dueAt: string | null; createdAt: string; updatedAt: string;
}
export interface WorkspaceInviteDTO {
  id: string; workspaceId: string; inviterUserId: string; inviteeEmail: string | null; role: "ADMIN" | "MEMBER" | "GUEST"; status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"; maxUses: number | null; useCount: number; expiresAt: string; createdAt: string;
}
export interface WorkspaceMemberDTO { id: string; workspaceId: string; userId: string; displayName: string; email: string; role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST"; status: "ONLINE" | "OFFLINE" | "AWAY" | "DND"; joinedAt: string; }
export const CreateInviteInputSchema = z.object({ workspaceId: z.string().min(1), role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"), email: z.string().email().optional(), expiresInHours: z.number().int().min(1).max(8760).default(168), maxUses: z.number().int().min(1).optional(), channelIds: z.array(z.string().min(1)).max(100).default([]), directAdd: z.boolean().default(false) });
export type CreateInviteInput = z.infer<typeof CreateInviteInputSchema>;
export const AcceptInviteInputSchema = z.object({ code: z.string().min(20).max(200) });
export type AcceptInviteInput = z.infer<typeof AcceptInviteInputSchema>;
export const ListWorkspaceInvitesInputSchema = z.object({ workspaceId: z.string().min(1) });
export type ListWorkspaceInvitesInput = z.infer<typeof ListWorkspaceInvitesInputSchema>;
export const RevokeInviteInputSchema = z.object({ inviteId: z.string().min(1) });
export type RevokeInviteInput = z.infer<typeof RevokeInviteInputSchema>;
export const ListWorkspaceMembersInputSchema = z.object({ workspaceId: z.string().min(1) });
export type ListWorkspaceMembersInput = z.infer<typeof ListWorkspaceMembersInputSchema>;
export const UpdateMemberRoleInputSchema = z.object({ workspaceId: z.string().min(1), userId: z.string().min(1), role: z.enum(["ADMIN", "MEMBER", "GUEST"]) });
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleInputSchema>;
export const RemoveMemberInputSchema = z.object({ workspaceId: z.string().min(1), userId: z.string().min(1) });
export type RemoveMemberInput = z.infer<typeof RemoveMemberInputSchema>;

export interface TeamToolDTO {
  id: string; workspaceId: string; name: string; description: string | null; url: string | null; enabled: boolean; createdById: string;
}
export const CreateWorkTaskInputSchema = z.object({
  workspaceId: z.string().min(1), title: z.string().min(1).max(200).trim(), description: z.string().max(10_000).optional(),
  assigneeId: z.string().min(1).optional(), status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"), dueAt: z.string().datetime().optional(),
});
export type CreateWorkTaskInput = z.infer<typeof CreateWorkTaskInputSchema>;
export const ListWorkTasksInputSchema = z.object({ workspaceId: z.string().min(1), status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional() });
export type ListWorkTasksInput = z.infer<typeof ListWorkTasksInputSchema>;
export const CreateTeamToolInputSchema = z.object({ workspaceId: z.string().min(1), name: z.string().min(1).max(100).trim(), description: z.string().max(1000).optional(), url: z.string().url().optional() });
export type CreateTeamToolInput = z.infer<typeof CreateTeamToolInputSchema>;
export const ListTeamToolsInputSchema = z.object({ workspaceId: z.string().min(1) });
export type ListTeamToolsInput = z.infer<typeof ListTeamToolsInputSchema>;

export interface PersonalNoteDTO {
  id: string; ownerId: string; workspaceId: string | null; eventId: string | null;
  title: string; content: string; isPrivate: boolean; createdAt: string; updatedAt: string;
}

/* ---------- Practical enterprise contracts ---------- */

/** Structured message tags used by mcp-messaging (Phase 2). */
export const MessageTagSchema = z.enum(["DECISION", "ACTION_ITEM", "NOTE"]);
export type MessageTag = z.infer<typeof MessageTagSchema>;

export interface TaggedMessageDTO {
  readonly id: string;
  readonly channelId: string;
  readonly authorId: string;
  readonly body: string;
  readonly tag: MessageTag | null;
  /** Reference to the entity this message resolves/affects (task ID, message ID, doc ID). */
  readonly referenceId: string | null;
  readonly createdAt: string;
}

/** Tool names reserved by mcp-ai-agent (Phase 6). */
export const AiToolName = Object.freeze({
  GenerateAsyncDigest: "generate_async_digest",
  ExtractActionItems: "extract_action_items",
  SemanticSearch: "semantic_search",
} as const);
export type AiToolName = (typeof AiToolName)[keyof typeof AiToolName];

export const GenerateAsyncDigestInputSchema = z.object({
  workspaceId: z.string().min(1),
  channelIds: z.array(z.string()).optional(),
  /** ISO timestamp: summarize messages newer than this (e.g. last seen). */
  since: z.string().datetime().optional(),
  maxPriorities: z.number().int().min(1).max(20).default(5),
});
export type GenerateAsyncDigestInput = z.infer<typeof GenerateAsyncDigestInputSchema>;

export const ExtractActionItemsInputSchema = z
  .object({
    text: z.string().min(1).max(50_000).optional(),
    /** Media asset (transcribed audio) from mcp-storage / mcp-media-rtc. */
    transcriptId: z.string().optional(),
  })
  .refine((v) => v.text !== undefined || v.transcriptId !== undefined, {
    message: "Provide either `text` or `transcriptId`",
  });
export type ExtractActionItemsInput = z.infer<typeof ExtractActionItemsInputSchema>;

export const SemanticSearchInputSchema = z.object({
  workspaceId: z.string().min(1),
  query: z.string().min(1).max(2_000),
  channelIds: z.array(z.string()).optional(),
  includeDocuments: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(10),
});
export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>;

/* ---------- MCP tool names ---------- */

export const ToolName = Object.freeze({
  RegisterUser: "register_user",
  AuthenticateUser: "authenticate_user",
  RefreshToken: "refresh_token",
  StoreUserPublicKey: "store_user_public_key",
  GetUserPublicKey: "get_user_public_key",
  CreateWorkspace: "create_workspace",
  GetUserWorkspaces: "get_user_workspaces",
  CreateChannel: "create_channel",
  ListChannels: "list_channels",
  CreateAgendaEvent: "create_agenda_event",
  ListAgendaEvents: "list_agenda_events",
  CreateNote: "create_note",
  ListNotes: "list_notes",
  CreateWorkTask: "create_work_task",
  ListWorkTasks: "list_work_tasks",
  CreateTeamTool: "create_team_tool",
  CreateInvite: "create_invite",
  AcceptInvite: "accept_invite",
  ListWorkspaceInvites: "list_workspace_invites",
  RevokeInvite: "revoke_invite",
  ListWorkspaceMembers: "list_workspace_members",
  UpdateMemberRole: "update_member_role",
  RemoveMember: "remove_member",
  ListTeamTools: "list_team_tools",
} as const);
export type ToolName = (typeof ToolName)[keyof typeof ToolName];

/* ---------- messaging (Phase 2) ---------- */

export const MessagingToolName = Object.freeze({
  SendMessage: "send_message",
  GetChannelHistory: "get_channel_history",
  MarkAsRead: "mark_as_read",
  AddReaction: "add_reaction",
  EditMessage: "edit_message",
  DeleteMessage: "delete_message",
} as const);
export type MessagingToolName = (typeof MessagingToolName)[keyof typeof MessagingToolName];

export const TranslationLocaleSchema = z.enum(["en", "fr", "ar"]);
export type TranslationLocale = z.infer<typeof TranslationLocaleSchema>;

/** Message content is either plaintext or an E2EE AES-256-GCM envelope — never both. */
export const MessageContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plain"), body: z.string().min(1).max(20_000) }),
  z.object({
    type: z.literal("encrypted"),
    ciphertextB64: z.string().regex(/^[A-Za-z0-9+/]+=*$/),
    ivB64: z.string().regex(/^[A-Za-z0-9+/]+=*$/),
    authTagB64: z.string().regex(/^[A-Za-z0-9+/]+=*$/),
  }),
]);
export type MessageContent = z.infer<typeof MessageContentSchema>;

export interface ReactionSummary {
  readonly emoji: string;
  readonly count: number;
}

export interface MessageDTO {
  readonly id: string;
  readonly channelId: string;
  readonly workspaceId: string;
  readonly parentId: string | null;
  readonly authorId: string;
  readonly tag: MessageTag | null;
  readonly referenceId: string | null;
  readonly assigneeId: string | null;
  readonly content: MessageContent;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly reactions: readonly ReactionSummary[];
}

export const SendMessageInputSchema = z.object({
  channelId: z.string().min(1),
  /** Reply threading: must reference a message in the same channel. */
  parentId: z.string().min(1).optional(),
  tag: MessageTagSchema.optional(),
  /** Entity this message resolves/affects (task ID, doc ID, prior message ID…). */
  referenceId: z.string().max(128).optional(),
  /** User responsible when tag = ACTION_ITEM. */
  assigneeId: z.string().min(1).optional(),
  content: MessageContentSchema,
}).refine(
  (v) => v.assigneeId === undefined || v.tag === "ACTION_ITEM",
  { message: "`assigneeId` requires `tag` = ACTION_ITEM" },
);
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

export const EditMessageInputSchema = z.object({
  messageId: z.string().min(1),
  content: MessageContentSchema,
});
export type EditMessageInput = z.infer<typeof EditMessageInputSchema>;

export const DeleteMessageInputSchema = z.object({ messageId: z.string().min(1) });
export type DeleteMessageInput = z.infer<typeof DeleteMessageInputSchema>;

export const GetChannelHistoryInputSchema = z.object({
  channelId: z.string().min(1),
  /** ISO-8601 cursor: fetch messages strictly older than this instant. */
  before: z.string().datetime().optional(),
  /** Thread filter: only replies to this message. */
  threadOf: z.string().min(1).optional(),
  tag: MessageTagSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type GetChannelHistoryInput = z.infer<typeof GetChannelHistoryInputSchema>;

export const MarkAsReadInputSchema = z.object({
  channelId: z.string().min(1),
  messageId: z.string().min(1).optional(),
});
export type MarkAsReadInput = z.infer<typeof MarkAsReadInputSchema>;

const emojiSchema = z.string().min(1).max(16);
export const AddReactionInputSchema = z.object({
  messageId: z.string().min(1),
  emoji: emojiSchema,
  /** When true, retracts the caller's existing reaction instead of adding it. */
  remove: z.boolean().default(false),
});
export type AddReactionInput = z.infer<typeof AddReactionInputSchema>;

/* ---------- storage (Phase 4) ---------- */

export const StorageToolName = Object.freeze({
  GenerateUploadUrl: "generate_upload_url",
  ConfirmUpload: "confirm_upload",
  GenerateDownloadUrl: "generate_download_url",
  ListChannelFiles: "list_channel_files",
} as const);
export type StorageToolName = (typeof StorageToolName)[keyof typeof StorageToolName];

export const FileStatusSchema = z.enum(["PENDING", "UPLOADED"]);
export type FileStatus = z.infer<typeof FileStatusSchema>;

/** 1 byte .. 100 MB per attachment. */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const fileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((v) => !v.includes("/") && !v.includes("\\") && v !== "." && v !== "..", {
    message: "fileName must not contain path separators",
  });

const mimeTypeSchema = z.string().regex(/^[\w.+-]+\/[\w.+-]+$/, "mimeType must look like `type/subtype`");

export interface FileDTO {
  readonly id: string;
  readonly workspaceId: string;
  readonly channelId: string;
  readonly key: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly status: FileStatus;
  readonly uploaderId: string;
  readonly createdAt: string;
}

export interface DirectUploadDTO {
  readonly file: FileDTO;
  readonly downloadUrl: string;
  readonly previewUrl: string;
  readonly expiresIn: number;
}

export const GenerateUploadUrlInputSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
  fileName: fileNameSchema,
  mimeType: mimeTypeSchema,
  size: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
});
export type GenerateUploadUrlInput = z.infer<typeof GenerateUploadUrlInputSchema>;

export const ConfirmUploadInputSchema = z.object({
  fileId: z.string().min(1),
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
  key: z.string().min(1).max(1024),
  mimeType: mimeTypeSchema,
  size: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
});
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInputSchema>;

export const GenerateDownloadUrlInputSchema = z.object({
  fileId: z.string().min(1),
  workspaceId: z.string().min(1),
});
export type GenerateDownloadUrlInput = z.infer<typeof GenerateDownloadUrlInputSchema>;

export const ListChannelFilesInputSchema = z.object({
  channelId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListChannelFilesInput = z.infer<typeof ListChannelFilesInputSchema>;

export interface PresignedUploadDTO {
  readonly fileId: string;
  /** S3 object key the client must PUT to. */
  readonly key: string;
  readonly uploadUrl: string;
  /** Seconds until `uploadUrl` expires. */
  readonly expiresIn: number;
}

export interface PresignedDownloadDTO {
  readonly fileId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly downloadUrl: string;
  /** Seconds until `downloadUrl` expires. */
  readonly expiresIn: number;
}

export interface ChannelFileListDTO {
  readonly files: readonly FileDTO[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/* ---------- media-rtc (Phase 3) ---------- */

export const MediaRtcToolName = Object.freeze({
  InitiateCall: "initiate_call",
  JoinCall: "join_call",
  LeaveCall: "leave_call",
  GetActiveCalls: "get_active_calls",
} as const);
export type MediaRtcToolName = (typeof MediaRtcToolName)[keyof typeof MediaRtcToolName];

const callTypeSchema = z.enum(["AUDIO", "VIDEO"]);

export const InitiateCallInputSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
  callType: callTypeSchema,
});
export type InitiateCallInput = z.infer<typeof InitiateCallInputSchema>;

export const JoinCallInputSchema = z.object({
  callId: z.string().min(1),
});
export type JoinCallInput = z.infer<typeof JoinCallInputSchema>;

export const LeaveCallInputSchema = z.object({
  callId: z.string().min(1),
});
export type LeaveCallInput = z.infer<typeof LeaveCallInputSchema>;

export const GetActiveCallsInputSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().optional(),
});
export type GetActiveCallsInput = z.infer<typeof GetActiveCallsInputSchema>;

export const WebRTCSignalingFrameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("sdp-offer"),
    targetUserId: z.string().optional(),
    payload: z.any(),
  }),
  z.object({
    type: z.literal("sdp-answer"),
    targetUserId: z.string().optional(),
    payload: z.any(),
  }),
  z.object({
    type: z.literal("ice-candidate"),
    targetUserId: z.string().optional(),
    payload: z.any(),
  }),
  z.object({
    type: z.literal("media-state"),
    targetUserId: z.string().optional(),
    payload: z.object({
      userId: z.string(),
      audioMuted: z.boolean(),
      videoOff: z.boolean(),
      screenSharing: z.boolean(),
    }),
  }),
]);
export type WebRTCSignalingFrame = z.infer<typeof WebRTCSignalingFrameSchema>;

export interface ParticipantState {
  readonly userId: string;
  readonly joinedAt: Date;
  readonly audioMuted: boolean;
  readonly videoOff: boolean;
  readonly screenSharing: boolean;
}

export interface ActiveCall {
  readonly id: string;
  readonly workspaceId: string;
  readonly channelId: string;
  readonly hostUserId: string;
  readonly callType: string;
  readonly createdAt: Date;
  readonly participants: ReadonlyMap<string, ParticipantState>;
}

/* ---------- realtime socket events (server -> client over /ws) ---------- */

export type MessagingSocketEvent =
  | { readonly type: "ready"; readonly userId: string; readonly channelIds: readonly string[] }
  | { readonly type: "member.joined"; readonly workspaceId: string; readonly userId: string; readonly displayName: string; readonly email?: string; readonly role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST"; readonly joinedAt: string }
  | { readonly type: "presence.updated"; readonly workspaceId: string; readonly userId: string; readonly status: "ONLINE" | "OFFLINE" }
  | { readonly type: "message.created"; readonly message: MessageDTO }
  | { readonly type: "message.edited"; readonly message: MessageDTO }
  | { readonly type: "message.deleted"; readonly channelId: string; readonly messageId: string }
  | { readonly type: "typing"; readonly channelId: string; readonly userId: string; readonly active: boolean }
  | {
      readonly type: "reaction.updated";
      readonly channelId: string;
      readonly messageId: string;
      readonly reactions: readonly ReactionSummary[];
    }
  | {
      readonly type: "receipt.updated";
      readonly channelId: string;
      readonly userId: string;
      readonly lastReadMessageId: string | null;
      readonly readAt: string;
    };

/* ---------- media-rtc -> ai-agent stream contract (Phase 6) ----------
 * Events emitted by mcp-media-rtc and consumed by mcp-ai-agent over
 * Redis Streams. Kept here so both services share one source of truth.
 * ------------------------------------------------------------------ */

export const MediaAiStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("audio.chunk"),
    meetingId: z.string(),
    participantId: z.string(),
    /** Opus-encoded audio frame, base64 */
    payloadB64: z.string(),
    sequence: z.number().int().nonnegative(),
    timestampMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("meeting.joined"),
    meetingId: z.string(),
    participantId: z.string(),
    displayName: z.string(),
    /** Job title / role used for org-chart generation, e.g. "Chef de Projet" */
    roleTitle: z.string().optional(),
    reportsToParticipantId: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("meeting.left"),
    meetingId: z.string(),
    participantId: z.string(),
  }),
]);
export type MediaAiStreamEvent = z.infer<typeof MediaAiStreamEventSchema>;

export interface TranscriptSegment {
  readonly meetingId: string;
  readonly participantId: string;
  readonly language: string;
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface OrgChartNode {
  readonly participantId: string;
  readonly displayName: string;
  readonly roleTitle: string;
  readonly reportsTo: string | null;
}

export interface ActionItem {
  readonly id: string;
  readonly description: string;
  readonly assigneeParticipantId: string | null;
  readonly dueHint: string | null;
  readonly sourceSegmentRange: readonly [number, number];
}

export interface CatchUpSummary {
  readonly meetingId: string;
  readonly generatedForParticipantId: string;
  readonly summary: string;
  readonly keyDecisions: readonly string[];
  readonly actionItems: readonly ActionItem[];
}
