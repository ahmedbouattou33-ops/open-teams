import { defineTool, McpError } from "@openteams/mcp-core";
import {
  CreateChannelInputSchema,
  ListChannelsInputSchema,
  ToolName,
  type ChannelDTO,
} from "@openteams/shared-types";
import { Prisma, type PrismaClient } from "../generated/prisma/index.js";
import type { AuthContext } from "@openteams/mcp-core";
import { toChannelDTO } from "../mappers.js";
import { assertWorkspaceRole } from "../rbac.js";

export function buildChannelTools(prisma: PrismaClient) {
  return [
    defineTool({
      name: ToolName.CreateChannel,
      description: "Creates a channel (ADMIN+ required) and joins the creator as channel OWNER.",
      input: CreateChannelInputSchema,
      secure: true,
      handler: async (input, ctx: AuthContext): Promise<ChannelDTO> => {
        const userId = ctx.userId as string;
        await assertWorkspaceRole(prisma, input.workspaceId, userId, "ADMIN");

        try {
          const channel = await prisma.channel.create({
            data: {
              workspaceId: input.workspaceId,
              name: input.name,
              type: input.type,
              isEncrypted: input.isEncrypted,
              members: { create: { userId, role: "OWNER" } },
            },
            include: { members: { select: { userId: true, role: true } } },
          });
          return toChannelDTO(channel, userId);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw McpError.conflict(`Channel "${input.name}" already exists in this workspace`);
          }
          throw error;
        }
      },
    }),

    defineTool({
      name: ToolName.ListChannels,
      description: "Lists all channels of a workspace the caller belongs to, with joined/role flags.",
      input: ListChannelsInputSchema,
      secure: true,
      handler: async (input, ctx: AuthContext): Promise<{ channels: ChannelDTO[] }> => {
        const userId = ctx.userId as string;
        await assertWorkspaceRole(prisma, input.workspaceId, userId, "GUEST");

        const [channels, myMemberships] = await prisma.$transaction([
          prisma.channel.findMany({
            where: { workspaceId: input.workspaceId },
            orderBy: [{ type: "asc" }, { name: "asc" }],
          }),
          prisma.channelMember.findMany({
            where: { userId, channel: { workspaceId: input.workspaceId } },
            select: { channelId: true, role: true },
          }),
        ]);

        const roleByChannel = new Map(myMemberships.map((m) => [m.channelId, m.role]));
        return {
          channels: channels.map((channel) =>
            toChannelDTO(
              {
                ...channel,
                members: [...roleByChannel.entries()]
                  .filter(([id]) => id === channel.id)
                  .map(([id, role]) => ({ userId, channelId: id, role })),
              },
              userId,
            ),
          ),
        };
      },
    }),
  ] as const;
}
