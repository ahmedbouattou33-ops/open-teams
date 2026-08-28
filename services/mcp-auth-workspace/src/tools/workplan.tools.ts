import { defineTool } from "@openteams/mcp-core";
import {
  CreateTeamToolInputSchema,
  CreateWorkTaskInputSchema,
  ListTeamToolsInputSchema,
  ListWorkTasksInputSchema,
  ToolName,
  type TeamToolDTO,
  type WorkTaskDTO,
} from "@openteams/shared-types";
import type { PrismaClient } from "../generated/prisma/index.js";

async function member(prisma: PrismaClient, workspaceId: string, userId: string) {
  const row = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true } });
  if (!row) throw new Error("You must belong to this team");
  return row;
}
function taskDto(row: any): WorkTaskDTO { return { id: row.id, workspaceId: row.workspaceId, creatorId: row.creatorId, assigneeId: row.assigneeId, title: row.title, description: row.description, status: row.status, priority: row.priority, dueAt: row.dueAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
function toolDto(row: any): TeamToolDTO { return { id: row.id, workspaceId: row.workspaceId, name: row.name, description: row.description, url: row.url, enabled: row.enabled, createdById: row.createdById }; }

export function buildWorkplanTools(prisma: PrismaClient) {
  return [
    defineTool({ name: ToolName.CreateWorkTask, description: "Creates a task in a team work plan and optionally assigns it to a team member.", input: CreateWorkTaskInputSchema, secure: true, handler: async (input, ctx): Promise<WorkTaskDTO> => {
      const creatorId = ctx.userId as string;
      await member(prisma, input.workspaceId, creatorId);
      if (input.assigneeId) await member(prisma, input.workspaceId, input.assigneeId);
      const row = await prisma.workTask.create({ data: { workspaceId: input.workspaceId, creatorId, assigneeId: input.assigneeId, title: input.title, description: input.description, status: input.status, priority: input.priority, dueAt: input.dueAt ? new Date(input.dueAt) : undefined } });
      return taskDto(row);
    } }),
    defineTool({ name: ToolName.ListWorkTasks, description: "Lists the shared work plan for a team member.", input: ListWorkTasksInputSchema, secure: true, handler: async (input, ctx): Promise<{ tasks: WorkTaskDTO[] }> => {
      await member(prisma, input.workspaceId, ctx.userId as string);
      const rows = await prisma.workTask.findMany({ where: { workspaceId: input.workspaceId, ...(input.status ? { status: input.status } : {}) }, orderBy: [{ status: "asc" }, { dueAt: "asc" }, { updatedAt: "desc" }] });
      return { tasks: rows.map(taskDto) };
    } }),
    defineTool({ name: ToolName.CreateTeamTool, description: "Adds an approved shared tool/link to a team workspace.", input: CreateTeamToolInputSchema, secure: true, handler: async (input, ctx): Promise<TeamToolDTO> => {
      const userId = ctx.userId as string;
      const access = await member(prisma, input.workspaceId, userId);
      if (!["OWNER", "ADMIN"].includes(access.role)) throw new Error("Only team owners or admins can add tools");
      const row = await prisma.teamTool.create({ data: { workspaceId: input.workspaceId, createdById: userId, name: input.name, description: input.description, url: input.url } });
      return toolDto(row);
    } }),
    defineTool({ name: ToolName.ListTeamTools, description: "Lists enabled shared tools for a team member.", input: ListTeamToolsInputSchema, secure: true, handler: async (input, ctx): Promise<{ tools: TeamToolDTO[] }> => {
      await member(prisma, input.workspaceId, ctx.userId as string);
      const rows = await prisma.teamTool.findMany({ where: { workspaceId: input.workspaceId, enabled: true }, orderBy: { name: "asc" } });
      return { tools: rows.map(toolDto) };
    } }),
  ] as const;
}
