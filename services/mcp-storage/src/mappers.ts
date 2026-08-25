import type { StoredFile } from "./generated/prisma/index.js";
import type { FileDTO } from "@openteams/shared-types";

export function toFileDTO(file: StoredFile): FileDTO {
  return {
    id: file.id,
    workspaceId: file.workspaceId,
    channelId: file.channelId,
    key: file.key,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    status: file.status,
    uploaderId: file.uploaderId,
    createdAt: file.createdAt.toISOString(),
  };
}
