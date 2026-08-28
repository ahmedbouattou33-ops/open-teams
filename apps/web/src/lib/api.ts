import {
  MediaRtcToolName,
  MessagingToolName,
  StorageToolName,
  ToolName,
  type AddReactionInput,
  type EditMessageInput,
  type DeleteMessageInput,
  type DirectUploadDTO,
  type AgendaEventDTO,
  type CreateAgendaEventInput,
  type CreateNoteInput,
  type ListAgendaEventsInput,
  type ListNotesInput,
  type PersonalNoteDTO,
  type CreateTeamToolInput,
  type CreateWorkTaskInput,
  type ListTeamToolsInput,
  type ListWorkTasksInput,
  type TeamToolDTO,
  type WorkTaskDTO,
  type AcceptInviteInput,
  type CreateInviteInput,
  type ListWorkspaceInvitesInput,
  type ListWorkspaceMembersInput,
  type RemoveMemberInput,
  type RevokeInviteInput,
  type UpdateMemberRoleInput,
  type WorkspaceInviteDTO,
  type WorkspaceMemberDTO,
  type AuthResult,
  type AuthenticateUserInput,
  type ChannelDTO,
  type ChannelFileListDTO,
  type ConfirmUploadInput,
  type CreateChannelInput,
  type CreateWorkspaceInput,
  type FileDTO,
  type GenerateUploadUrlInput,
  type GetChannelHistoryInput,
  type ListChannelFilesInput,
  type MarkAsReadInput,
  type MessageDTO,
  type PresignedDownloadDTO,
  type PresignedUploadDTO,
  type RegisterUserInput,
  type SendMessageInput,
  type WorkspaceDTO,
  type TranslationLocale,
} from "@openteams/shared-types";
import { SERVICES } from "./env";
import { RpcError, rpc } from "./rpc";
import { useAuthStore } from "@/stores/auth";

let sessionRedirectInProgress = false;

function expireSession(): never {
  useAuthStore.getState().clearSession();
  try { window.localStorage.removeItem("openteams.auth.v1"); } catch { /* storage may be unavailable */ }
  if (!sessionRedirectInProgress && window.location.pathname !== "/login") {
    sessionRedirectInProgress = true;
    window.location.replace("/login?reason=session-expired");
  }
  throw new RpcError(-32001, "Session expired");
}

export interface ParticipantSnapshot {
  readonly userId: string;
  readonly joinedAt: string;
  readonly audioMuted: boolean;
  readonly videoOff: boolean;
  readonly screenSharing: boolean;
}

export interface InitiateCallResult {
  readonly callId: string;
  readonly wsUrl: string;
  readonly callType: string;
}

export interface JoinCallResult {
  readonly callId: string;
  readonly hostUserId: string;
  readonly callType: string;
  readonly you: ParticipantSnapshot;
  readonly participants: readonly ParticipantSnapshot[];
}

export interface HistoryPage {
  readonly messages: readonly MessageDTO[];
  readonly nextCursor: string | null;
}

export interface SummarizeResult {
  readonly summary: string;
  readonly sourceMessages: number;
}

export type { TranslationLocale } from "@openteams/shared-types";
export interface TranslateResult { readonly translation: string; readonly targetLocale: TranslationLocale; }

async function callTool<T>(baseUrl: string, tool: string, params?: unknown): Promise<T> {
  const state = useAuthStore.getState();
  if (!state.accessToken) throw new RpcError(-32001, "Not signed in");
  try {
    return await rpc<T>(baseUrl, tool, params, state.accessToken);
  } catch (error) {
    if (!(error instanceof RpcError) || !error.isUnauthorized) throw error;
    if (!state.refreshToken) expireSession();
    try {
      const refreshed = await rpc<AuthResult>(
        SERVICES.auth,
        ToolName.RefreshToken,
        { refreshToken: state.refreshToken },
      );
      state.setSession(refreshed);
      return await rpc<T>(baseUrl, tool, params, refreshed.tokens.accessToken);
    } catch {
      // Refresh tokens are persisted and single-use; a failed rotation ends the session.
      expireSession();
    }
  }
}

async function adminFetch<T>(path: string, workspaceId: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new RpcError(-32001, "Not signed in");
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${SERVICES.auth}${path}${separator}workspaceId=${encodeURIComponent(workspaceId)}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? `Admin request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export const api = {
  register: (input: RegisterUserInput): Promise<AuthResult> =>
    rpc<AuthResult>(SERVICES.auth, ToolName.RegisterUser, input),
  login: (input: AuthenticateUserInput): Promise<AuthResult> =>
    rpc<AuthResult>(SERVICES.auth, ToolName.AuthenticateUser, input),

  listWorkspaces: async (): Promise<readonly WorkspaceDTO[]> => {
    const result = await callTool<{ workspaces: WorkspaceDTO[] }>(
      SERVICES.auth,
      ToolName.GetUserWorkspaces,
    );
    return result.workspaces;
  },
  createWorkspace: (input: CreateWorkspaceInput): Promise<WorkspaceDTO> =>
    callTool<WorkspaceDTO>(SERVICES.auth, ToolName.CreateWorkspace, input),

  listChannels: async (workspaceId: string): Promise<readonly ChannelDTO[]> => {
    const result = await callTool<{ channels: ChannelDTO[] }>(
      SERVICES.auth,
      ToolName.ListChannels,
      { workspaceId },
    );
    return result.channels;
  },
  createChannel: (input: CreateChannelInput): Promise<ChannelDTO> =>
    callTool<ChannelDTO>(SERVICES.auth, ToolName.CreateChannel, input),

  listAgendaEvents: async (input: ListAgendaEventsInput = {}): Promise<readonly AgendaEventDTO[]> => {
    const result = await callTool<{ events: AgendaEventDTO[] }>(SERVICES.auth, ToolName.ListAgendaEvents, input);
    return result.events;
  },
  createAgendaEvent: (input: CreateAgendaEventInput): Promise<AgendaEventDTO> =>
    callTool<AgendaEventDTO>(SERVICES.auth, ToolName.CreateAgendaEvent, input),
  listNotes: async (input: ListNotesInput = {}): Promise<readonly PersonalNoteDTO[]> => {
    const result = await callTool<{ notes: PersonalNoteDTO[] }>(SERVICES.auth, ToolName.ListNotes, input);
    return result.notes;
  },
  createNote: (input: CreateNoteInput): Promise<PersonalNoteDTO> =>
    callTool<PersonalNoteDTO>(SERVICES.auth, ToolName.CreateNote, input),
  listWorkTasks: async (input: ListWorkTasksInput): Promise<readonly WorkTaskDTO[]> => (await callTool<{ tasks: WorkTaskDTO[] }>(SERVICES.auth, ToolName.ListWorkTasks, input)).tasks,
  createWorkTask: (input: CreateWorkTaskInput): Promise<WorkTaskDTO> => callTool<WorkTaskDTO>(SERVICES.auth, ToolName.CreateWorkTask, input),
  listTeamTools: async (input: ListTeamToolsInput): Promise<readonly TeamToolDTO[]> => (await callTool<{ tools: TeamToolDTO[] }>(SERVICES.auth, ToolName.ListTeamTools, input)).tools,
  createTeamTool: (input: CreateTeamToolInput): Promise<TeamToolDTO> => callTool<TeamToolDTO>(SERVICES.auth, ToolName.CreateTeamTool, input),
  createInvite: (input: CreateInviteInput) => callTool<{ inviteId: string; code: string; inviteUrl: string; directAdded: boolean; userId?: string }>(SERVICES.auth, ToolName.CreateInvite, input),
  adminHealth: (workspaceId: string) => adminFetch<{ status: string; services: Array<{ name: string; status: string; latencyMs: number; checkedAt: string }>; postgres: string; telemetry?: { rssBytes: number; heapUsedBytes: number; cpuLoad1m: number; websocketLatencyMs: number; sampledAt: string } }>("/admin/health", workspaceId),
  adminStats: (workspaceId: string) => adminFetch<{ workspaceId: string; users: number; activeMembers: number; channels: number; tasks: number; pendingInvites: number; activeSessions: number; collectedAt: string }>("/admin/stats", workspaceId),
  adminSiemLogs: (workspaceId: string) => adminFetch<{ events: Array<Record<string, unknown>>; source: string; message?: string }>("/admin/siem-logs", workspaceId),
  adminExportAudit: async (workspaceId: string, format: "json" | "csv") => {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw new RpcError(-32001, "Not signed in");
    const response = await fetch(`${SERVICES.auth}/admin/export-audit-logs?workspaceId=${encodeURIComponent(workspaceId)}&format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Audit export failed (${response.status})`);
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `openteams-audit.${format}`; anchor.click(); URL.revokeObjectURL(url);
  },
  listMembers: (workspaceId: string, filters: { search?: string; role?: string; status?: string; page?: number; pageSize?: number } = {}) => adminFetch<{ items: Array<{ id: string; workspaceId: string; userId: string; displayName: string; email: string; role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST"; status: "ONLINE" | "OFFLINE" | "AWAY" | "DND"; department: string | null; joinedAt: string }>; page: number; pageSize: number; total: number }>(`/workspaces/${encodeURIComponent(workspaceId)}/members?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))}`, workspaceId),
  updateMemberRoleRest: (workspaceId: string, userId: string, role: "ADMIN" | "MEMBER" | "GUEST") => adminFetch<{ ok: true; role: string }>(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}/role`, workspaceId, { method: "PATCH", body: JSON.stringify({ role }), headers: { "content-type": "application/json" } }),
  removeMemberRest: (workspaceId: string, userId: string) => adminFetch<{ ok: true }>(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`, workspaceId, { method: "DELETE" }),
  revokeMemberSessions: (workspaceId: string, userId: string) => adminFetch<{ ok: true; revoked: number }>(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}/revoke-sessions`, workspaceId, { method: "POST" }),
  acceptInvite: (input: AcceptInviteInput) => callTool<{ workspaceId: string; role: string; alreadyMember: boolean }>(SERVICES.auth, ToolName.AcceptInvite, input),
  listWorkspaceInvites: async (input: ListWorkspaceInvitesInput): Promise<readonly WorkspaceInviteDTO[]> => (await callTool<{ invites: WorkspaceInviteDTO[] }>(SERVICES.auth, ToolName.ListWorkspaceInvites, input)).invites,
  revokeInvite: (input: RevokeInviteInput) => callTool<{ ok: true }>(SERVICES.auth, ToolName.RevokeInvite, input),
  listWorkspaceMembers: async (input: ListWorkspaceMembersInput): Promise<readonly WorkspaceMemberDTO[]> => (await callTool<{ members: WorkspaceMemberDTO[] }>(SERVICES.auth, ToolName.ListWorkspaceMembers, input)).members,
  updateMemberRole: (input: UpdateMemberRoleInput) => callTool<{ ok: true }>(SERVICES.auth, ToolName.UpdateMemberRole, input),
  removeMember: (input: RemoveMemberInput) => callTool<{ ok: true }>(SERVICES.auth, ToolName.RemoveMember, input),

  sendMessage: async (input: SendMessageInput): Promise<MessageDTO> => {
    const result = await callTool<{ message: MessageDTO }>(
      SERVICES.messaging,
      MessagingToolName.SendMessage,
      input,
    );
    return result.message;
  },
  history: (input: GetChannelHistoryInput): Promise<HistoryPage> =>
    callTool<HistoryPage>(SERVICES.messaging, MessagingToolName.GetChannelHistory, input),
  markAsRead: (input: MarkAsReadInput): Promise<{ ok: true }> =>
    callTool<{ ok: true }>(SERVICES.messaging, MessagingToolName.MarkAsRead, input),
  addReaction: (input: AddReactionInput): Promise<{ ok: true }> =>
    callTool<{ ok: true }>(SERVICES.messaging, MessagingToolName.AddReaction, input),
  editMessage: async (input: EditMessageInput): Promise<MessageDTO> => {
    const result = await callTool<{ message: MessageDTO }>(SERVICES.messaging, MessagingToolName.EditMessage, input);
    return result.message;
  },
  deleteMessage: (input: DeleteMessageInput): Promise<{ ok: true }> =>
    callTool<{ ok: true }>(SERVICES.messaging, MessagingToolName.DeleteMessage, input),
  translateMessage: async (input: { channelId: string; text: string; targetLocale: TranslationLocale }): Promise<TranslateResult> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw new RpcError(-32001, "Not signed in");
    const response = await fetch(`${SERVICES.messaging}/translate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(input) });
    if (response.status === 401) return expireSession();
    if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? `Translation failed (${response.status})`);
    return response.json() as Promise<TranslateResult>;
  },
  summarizeChannel: async (channelId: string, limit = 50): Promise<SummarizeResult> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw new RpcError(-32001, "Not signed in");
    const response = await fetch(`${SERVICES.messaging}/summarize`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ channelId, limit }) });
    if (response.status === 401) return expireSession();
    if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? `Summarize failed (${response.status})`);
    return response.json() as Promise<SummarizeResult>;
  },

  generateUploadUrl: async (input: GenerateUploadUrlInput) => {
    const result = await callTool<{ upload: PresignedUploadDTO }>(
      SERVICES.storage,
      StorageToolName.GenerateUploadUrl,
      input,
    );
    return result.upload;
  },
  confirmUpload: async (input: ConfirmUploadInput): Promise<FileDTO> => {
    const result = await callTool<{ file: FileDTO }>(
      SERVICES.storage,
      StorageToolName.ConfirmUpload,
      input,
    );
    return result.file;
  },
  downloadUrl: async (fileId: string, workspaceId: string): Promise<PresignedDownloadDTO> => {
    const result = await callTool<{ download: PresignedDownloadDTO }>(
      SERVICES.storage,
      StorageToolName.GenerateDownloadUrl,
      { fileId, workspaceId },
    );
    return result.download;
  },
  listChannelFiles: (input: ListChannelFilesInput): Promise<ChannelFileListDTO> =>
    callTool<ChannelFileListDTO>(SERVICES.storage, StorageToolName.ListChannelFiles, input),

  initiateCall: (input: {
    workspaceId: string;
    channelId: string;
    callType: "AUDIO" | "VIDEO";
  }): Promise<InitiateCallResult> =>
    callTool<InitiateCallResult>(SERVICES.mediaRtc, MediaRtcToolName.InitiateCall, input),
  joinCall: (callId: string): Promise<JoinCallResult> =>
    callTool<JoinCallResult>(SERVICES.mediaRtc, MediaRtcToolName.JoinCall, { callId }),
  leaveCall: (callId: string): Promise<{ ok: true }> =>
    callTool<{ ok: true }>(SERVICES.mediaRtc, MediaRtcToolName.LeaveCall, { callId }),

  uploadFile: async (
    file: File,
    workspaceId: string,
    channelId: string,
  ): Promise<DirectUploadDTO> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw new RpcError(-32001, "Not signed in");
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("channelId", channelId);
    form.append("file", file, file.name);
    const response = await fetch(`${SERVICES.storage}/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    if (response.status === 401) return expireSession();
    const payload = await response.json().catch(() => null) as DirectUploadDTO | { error?: string } | null;
    if (!response.ok || !payload || !("file" in payload)) throw new Error((payload && "error" in payload ? payload.error : undefined) ?? `Storage upload failed (HTTP ${response.status})`);
    return payload;
  },
};
