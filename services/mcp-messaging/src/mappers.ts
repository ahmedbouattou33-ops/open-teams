import type { Message, Reaction } from "./generated/prisma/index.js";
import type { MessageContent, MessageDTO, ReactionSummary } from "@openteams/shared-types";

type MessageWithReactions = Message & { reactions: Reaction[] };

export function toMessageContent(message: Pick<Message, "body" | "ciphertext" | "iv" | "authTag">): MessageContent {
  if (message.ciphertext && message.iv && message.authTag) {
    return {
      type: "encrypted",
      ciphertextB64: message.ciphertext,
      ivB64: message.iv,
      authTagB64: message.authTag,
    };
  }
  return { type: "plain", body: message.body ?? "" };
}

export function summarizeReactions(reactions: Iterable<{ emoji: string }>): ReactionSummary[] {
  const counts = new Map<string, number>();
  for (const reaction of reactions) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  }
  return [...counts.entries()].map(([emoji, count]) => ({ emoji, count }));
}

export function toMessageDTO(message: MessageWithReactions): MessageDTO {
  return {
    id: message.id,
    channelId: message.channelId,
    workspaceId: message.workspaceId,
    parentId: message.parentId,
    authorId: message.authorId,
    tag: message.tag,
    referenceId: message.referenceId,
    assigneeId: message.assigneeId,
    content: toMessageContent(message),
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    reactions: summarizeReactions(message.reactions),
  };
}
