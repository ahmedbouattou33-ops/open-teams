import { randomBytes } from "node:crypto";
import { defineTool } from "@openteams/mcp-core";
import {
  CreateWorkspaceInputSchema,
  GetUserWorkspacesInputSchema,
  ToolName,
  type WorkspaceDTO,
} from "@openteams/shared-types";
import type { PrismaClient } from "../generated/prisma/index.js";
import { toWorkspaceDTO } from "../mappers.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";
}

async function uniqueSlug(prisma: PrismaClient, base: string): Promise<string> {
  let candidate = base;
  while (await prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${randomBytes(3).toString("hex")}`;
  }
  return candidate;
}

export function buildWorkspaceTools(prisma: PrismaClient) {
  return [
    defineTool({
      name: ToolName.CreateWorkspace,
      description:
        "Creates a workspace with the caller as OWNER, a default #general channel and both memberships. Transactional.",
      input: CreateWorkspaceInputSchema,
      secure: true,
      handler: async (input, ctx): Promise<WorkspaceDTO> => {
        const userId = ctx.userId as string;
        const slug = await uniqueSlug(prisma, input.slug ?? slugify(input.name));

        const { workspace, membership } = await prisma.$transaction(async (tx) => {
          const workspace = await tx.workspace.create({
            data: { name: input.name, slug, ownerId: userId },
          });
          const membership = await tx.workspaceMember.create({
            data: { workspaceId: workspace.id, userId, role: "OWNER" },
          });
          const general = await tx.channel.create({
            data: {
              workspaceId: workspace.id,
              name: "general",
              type: "PUBLIC",
              members: { create: { userId, role: "OWNER" } },
            },
          });
          return { workspace, membership, generalChannelId: general.id };
        });

        return toWorkspaceDTO(workspace, membership);
      },
    }),

    defineTool({
      name: ToolName.GetUserWorkspaces,
      description: "Lists all workspaces the caller belongs to, including their role in each.",
      input: GetUserWorkspacesInputSchema,
      secure: true,
      handler: async (_input, ctx): Promise<{ workspaces: WorkspaceDTO[] }> => {
        const memberships = await prisma.workspaceMember.findMany({
          where: { userId: ctx.userId },
          include: { workspace: true },
          orderBy: { createdAt: "asc" },
        });
        return {
          workspaces: memberships.map((m) =>
            toWorkspaceDTO(m.workspace, m),
          ),
        };
      },
    }),
  ] as const;
}
