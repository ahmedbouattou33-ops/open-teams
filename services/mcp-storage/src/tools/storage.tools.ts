import { randomUUID } from "node:crypto";
import { defineTool, McpError, type AuthContext } from "@openteams/mcp-core";
import {
  ConfirmUploadInputSchema,
  GenerateDownloadUrlInputSchema,
  GenerateUploadUrlInputSchema,
  ListChannelFilesInputSchema,
  StorageToolName,
  type ChannelFileListDTO,
  type ConfirmUploadInput,
  type FileDTO,
  type GenerateDownloadUrlInput,
  type GenerateUploadUrlInput,
  type ListChannelFilesInput,
  type PresignedDownloadDTO,
  type PresignedUploadDTO,
} from "@openteams/shared-types";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { AuthWorkspaceClient } from "../internal/client.js";
import type { StorageBackend } from "../s3.js";
import { PRESIGN_EXPIRES_SECONDS } from "../s3.js";
import { toFileDTO } from "../mappers.js";

/** Enforces channel RBAC via mcp-auth-workspace; throws on denial. */
async function requireAccess(authClient: AuthWorkspaceClient, channelId: string, userId: string): Promise<string> {
  const access = await authClient.getChannelAccess(channelId, userId);
  if (!access.allowed || !access.workspaceId) throw McpError.notFound("Channel not found or access denied");
  return access.workspaceId;
}

/** Builds a collision-proof, path-traversal-safe S3 object key. */
function buildObjectKey(workspaceId: string, channelId: string, fileId: string, fileName: string): string {
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
  return `workspaces/${workspaceId}/channels/${channelId}/${fileId}/${safeName}`;
}

export interface StorageToolsDeps {
  readonly prisma: PrismaClient;
  readonly authClient: AuthWorkspaceClient;
  readonly storage: StorageBackend;
}

export function buildStorageTools(deps: StorageToolsDeps) {
  const { prisma, authClient, storage } = deps;

  return [
    defineTool({
      name: StorageToolName.GenerateUploadUrl,
      description:
        "Registers a pending attachment in a channel and returns a presigned S3 PUT URL (valid 15 minutes). " +
        "Call `confirm_upload` after the client completes the HTTP PUT.",
      input: GenerateUploadUrlInputSchema,
      secure: true,
      handler: async (
        input: GenerateUploadUrlInput,
        ctx: AuthContext,
      ): Promise<{ upload: PresignedUploadDTO }> => {
        const userId = ctx.userId as string;

        // The channel's workspace must match the declared one (prevents cross-workspace smuggling).
        const actualWorkspaceId = await requireAccess(authClient, input.channelId, userId);
        if (actualWorkspaceId !== input.workspaceId) {
          throw McpError.forbidden("workspaceId does not match the channel's workspace");
        }

        const fileId = randomUUID();
        const key = buildObjectKey(input.workspaceId, input.channelId, fileId, input.fileName);

        await prisma.storedFile.create({
          data: {
            id: fileId,
            workspaceId: input.workspaceId,
            channelId: input.channelId,
            key,
            fileName: input.fileName,
            mimeType: input.mimeType,
            size: input.size,
            status: "PENDING",
            uploaderId: userId,
          },
        });

        const uploadUrl = await storage.presignPut(key, input.mimeType);
        return { upload: { fileId, key, uploadUrl, expiresIn: PRESIGN_EXPIRES_SECONDS } };
      },
    }),

    defineTool({
      name: StorageToolName.ConfirmUpload,
      description:
        "Finalizes a pending attachment: verifies the object exists in the bucket (HEAD) and that the caller " +
        "is its uploader, then flips metadata status to UPLOADED.",
      input: ConfirmUploadInputSchema,
      secure: true,
      handler: async (input: ConfirmUploadInput, ctx: AuthContext): Promise<{ file: FileDTO }> => {
        const userId = ctx.userId as string;
        await requireAccess(authClient, input.channelId, userId);

        const record = await prisma.storedFile.findUnique({ where: { id: input.fileId } });
        if (!record) throw McpError.notFound("Unknown fileId");
        if (record.uploaderId !== userId) throw McpError.forbidden("Only the uploader may confirm this upload");

        // Replay/tamper guard: the echoed descriptor must match what was issued.
        if (
          record.key !== input.key ||
          record.channelId !== input.channelId ||
          record.workspaceId !== input.workspaceId
        ) {
          throw McpError.conflict("Descriptor mismatch with the registered pending upload");
        }
        if (record.status === "UPLOADED") throw McpError.conflict("Upload already confirmed");

        const head = await storage.objectExists(record.key);
        if (!head.exists) {
          throw McpError.notFound("Object not found in bucket — complete the PUT before confirming");
        }
        if (head.size !== null && head.size !== input.size) {
          throw McpError.conflict(`Uploaded object size (${head.size}) does not match declared size (${input.size})`);
        }

        const updated = await prisma.storedFile.update({
          where: { id: record.id },
          data: {
            status: "UPLOADED",
            mimeType: input.mimeType,
            size: input.size,
          },
        });
        return { file: toFileDTO(updated) };
      },
    }),

    defineTool({
      name: StorageToolName.GenerateDownloadUrl,
      description:
        "Returns a presigned S3 GET URL (valid 15 minutes) for an UPLOADED file, after verifying the caller " +
        "has access to the file's channel within the given workspace.",
      input: GenerateDownloadUrlInputSchema,
      secure: true,
      handler: async (
        input: GenerateDownloadUrlInput,
        ctx: AuthContext,
      ): Promise<{ download: PresignedDownloadDTO }> => {
        const userId = ctx.userId as string;

        const record = await prisma.storedFile.findUnique({ where: { id: input.fileId } });
        if (!record || record.status !== "UPLOADED") throw McpError.notFound("File not found or not yet uploaded");
        if (record.workspaceId !== input.workspaceId) throw McpError.notFound("File not found in this workspace");

        await requireAccess(authClient, record.channelId, userId);

        const downloadUrl = await storage.presignGet(record.key);
        return {
          download: {
            fileId: record.id,
            fileName: record.fileName,
            mimeType: record.mimeType,
            downloadUrl,
            expiresIn: PRESIGN_EXPIRES_SECONDS,
          },
        };
      },
    }),

    defineTool({
      name: StorageToolName.ListChannelFiles,
      description:
        "Paginated list of uploaded files attached to a channel (offset/limit), newest first. " +
        "Requires channel access.",
      input: ListChannelFilesInputSchema,
      secure: true,
      handler: async (input: ListChannelFilesInput, ctx: AuthContext): Promise<ChannelFileListDTO> => {
        const userId = ctx.userId as string;
        await requireAccess(authClient, input.channelId, userId);

        const [files, total] = await prisma.$transaction([
          prisma.storedFile.findMany({
            where: { channelId: input.channelId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: input.limit,
            skip: input.offset,
          }),
          prisma.storedFile.count({ where: { channelId: input.channelId } }),
        ]);

        return { files: files.map(toFileDTO), total, limit: input.limit, offset: input.offset };
      },
    }),
  ] as const;
}
