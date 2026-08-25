import { defineTool, McpError } from "@openteams/mcp-core";
import {
  AddReactionInputSchema,
  GetChannelHistoryInputSchema,
  MarkAsReadInputSchema,
  MessagingToolName,
  SendMessageInputSchema,
  type AddReactionInput,
  type GetChannelHistoryInput,
  type MarkAsReadInput,
  type MessageDTO,
  type SendMessageInput,
} from "@openteams/shared-types";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { AuthContext } from "@openteams/mcp-core";
import type { RealtimeHub } from "../realtime/hub.js";
import type { AuthWorkspaceClient } from "../internal/client.js";
import { summarizeReactions, toMessageDTO } from "../mappers.js";

/** Enforces channel RBAC via mcp-auth-workspace; throws on denial. */
async function requireAccess(authClient: AuthWorkspaceClient, channelId: string, userId: string): Promise<string> {
  const access = await authClient.getChannelAccess(channelId, userId);
  if (!access.allowed || !access.workspaceId) throw McpError.notFound("Channel not found or access denied");
  return access.workspaceId;
}

export function buildMessagingTools(prisma: PrismaClient, hub: RealtimeHub, authClient: AuthWorkspaceClient) {
  return [
    defineTool({
      name: MessagingToolName.SendMessage,
      description:
        "Sends a message (plaintext or E2EE payload) to a channel or thread. Optional structured tag (DECISION/ACTION_ITEM/NOTE) with referenceId/assigneeId metadata. Broadcasts `message.created`.",
      input: SendMessageInputSchema,
      secure: true,
      handler: async (input: SendMessageInput, ctx: AuthContext): Promise<{ message: MessageDTO }> => {
        const userId = ctx.userId as string;
        const workspaceId = await requireAccess(authClient, input.channelId, userId);

        if (input.parentId) {
          const parent = await prisma.message.findUnique({
            where: { id: input.parentId },
            select: { channelId: true, deletedAt: true },
          });
          if (!parent || parent.deletedAt || parent.channelId !== input.channelId) {
            throw McpError.notFound("Parent message not found in this channel");
          }
        }

        const created = await prisma.message.create({
          data: {
            channelId: input.channelId,
            workspaceId,
            authorId: userId,
            parentId: input.parentId ?? null,
            body: input.content.type === "plain" ? input.content.body : null,
            ciphertext: input.content.type === "encrypted" ? input.content.ciphertextB64 : null,
            iv: input.content.type === "encrypted" ? input.content.ivB64 : null,
            authTag: input.content.type === "encrypted" ? input.content.authTagB64 : null,
            tag: input.tag ?? null,
            referenceId: input.referenceId ?? null,
            assigneeId: input.assigneeId ?? null,
          },
          include: { reactions: true },
        });

        const dto = toMessageDTO(created);
        hub.broadcast(input.channelId, { type: "message.created", message: dto });
        return { message: dto };
      },
    }),

    defineTool({
      name: MessagingToolName.GetChannelHistory,
      description:
        "Paginated channel history (newest first), filterable by `tag` (e.g. DECISION/ACTION_ITEM) and by thread (`threadOf`).",
      input: GetChannelHistoryInputSchema,
      secure: true,
      handler: async (
        input: GetChannelHistoryInput,
        ctx: AuthContext,
      ): Promise<{ messages: MessageDTO[]; nextCursor: string | null }> => {
        await requireAccess(authClient, input.channelId, ctx.userId as string);

        const messages = await prisma.message.findMany({
          where: {
            channelId: input.channelId,
            deletedAt: null,
            ...(input.tag ? { tag: input.tag } : {}),
            ...(input.threadOf ? { parentId: input.threadOf } : {}),
            ...(input.before ? { createdAt: { lt: new Date(input.before) } } : {}),
          },
          include: { reactions: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: input.limit,
        });

        const oldest = messages.at(-1);
        return {
          messages: messages.map(toMessageDTO),
          nextCursor: messages.length === input.limit && oldest ? oldest.createdAt.toISOString() : null,
        };
      },
    }),

    defineTool({
      name: MessagingToolName.MarkAsRead,
      description:
        "Updates the caller's read receipt for a channel (optionally pinned to a message). Broadcasts `receipt.updated`.",
      input: MarkAsReadInputSchema,
      secure: true,
      handler: async (input: MarkAsReadInput, ctx: AuthContext): Promise<{ ok: true }> => {
        const userId = ctx.userId as string;
        await requireAccess(authClient, input.channelId, userId);

        const receipt = await prisma.readReceipt.upsert({
          where: { channelId_userId: { channelId: input.channelId, userId } },
          create: { channelId: input.channelId, userId, lastReadMessageId: input.messageId ?? null },
          update: {
            lastReadAt: new Date(),
            ...(input.messageId ? { lastReadMessageId: input.messageId } : {}),
          },
        });

        hub.broadcast(input.channelId, {
          type: "receipt.updated",
          channelId: input.channelId,
          userId,
          lastReadMessageId: receipt.lastReadMessageId,
          readAt: receipt.lastReadAt.toISOString(),
        });
        return { ok: true };
      },
    }),

    defineTool({
      name: MessagingToolName.AddReaction,
      description:
        "Adds an emoji reaction to a message; pass `remove: true` to retract it. Broadcasts `reaction.updated`.",
      input: AddReactionInputSchema,
      secure: true,
      handler: async (input: AddReactionInput, ctx: AuthContext): Promise<{ ok: true }> => {
        const userId = ctx.userId as string;

        const message = await prisma.message.findUnique({
          where: { id: input.messageId },
          select: { channelId: true, deletedAt: true },
        });
        if (!message || message.deletedAt) throw McpError.notFound("Message not found");
        await requireAccess(authClient, message.channelId, userId);

        if (input.remove) {
          await prisma.reaction.deleteMany({
            where: { messageId: input.messageId, userId, emoji: input.emoji },
          });
        } else {
          await prisma.reaction.upsert({
            where: {
              messageId_userId_emoji: {
                messageId: input.messageId,
                userId,
                emoji: input.emoji,
              },
            },
            create: { messageId: input.messageId, userId, emoji: input.emoji },
            update: {},
          });
        }

        const reactions = await prisma.reaction.findMany({
          where: { messageId: input.messageId },
          select: { emoji: true },
        });

        hub.broadcast(message.channelId, {
          type: "reaction.updated",
          channelId: message.channelId,
          messageId: input.messageId,
          reactions: summarizeReactions(reactions),
        });
        return { ok: true };
      },
    }),
  ] as const;
}
