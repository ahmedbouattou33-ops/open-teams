import {
  MediaRtcToolName,
  MessagingToolName,
  StorageToolName,
  ToolName,
  type AddReactionInput,
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
} from "@openteams/shared-types";
import { SERVICES } from "./env";
import { RpcError, rpc } from "./rpc";
import { useAuthStore } from "@/stores/auth";

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

async function callTool<T>(baseUrl: string, tool: string, params?: unknown): Promise<T> {
  const state = useAuthStore.getState();
  if (!state.accessToken) throw new RpcError(-32001, "Not signed in");
  try {
    return await rpc<T>(baseUrl, tool, params, state.accessToken);
  } catch (error) {
    if (!(error instanceof RpcError) || !error.isUnauthorized || !state.refreshToken) throw error;
    const refreshed = await rpc<AuthResult>(
      SERVICES.auth,
      ToolName.RefreshToken,
      { refreshToken: state.refreshToken },
    );
    state.setSession(refreshed);
    return rpc<T>(baseUrl, tool, params, refreshed.tokens.accessToken);
  }
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
  ): Promise<FileDTO> => {
    const mimeType = file.type || "application/octet-stream";
    const upload = await api.generateUploadUrl({
      workspaceId,
      channelId,
      fileName: file.name,
      mimeType,
      size: file.size,
    });
    const put = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "content-type": mimeType },
      body: file,
    });
    if (!put.ok) throw new Error(`MinIO upload failed (HTTP ${put.status})`);
    return api.confirmUpload({
      fileId: upload.fileId,
      workspaceId,
      channelId,
      key: upload.key,
      mimeType,
      size: file.size,
    });
  },
};
