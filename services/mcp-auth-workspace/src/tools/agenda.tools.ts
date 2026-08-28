import { defineTool } from "@openteams/mcp-core";
import {
  CreateAgendaEventInputSchema,
  CreateNoteInputSchema,
  ListAgendaEventsInputSchema,
  ListNotesInputSchema,
  ToolName,
  type AgendaEventDTO,
  type PersonalNoteDTO,
} from "@openteams/shared-types";
import type { PrismaClient } from "../generated/prisma/index.js";

async function assertWorkspaceMember(prisma: PrismaClient, workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { userId: true },
  });
  if (!membership) throw new Error("You must belong to this workspace");
}

function eventDto(event: any): AgendaEventDTO {
  return {
    id: event.id,
    ownerId: event.ownerId,
    workspaceId: event.workspaceId,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    timezone: event.timezone,
    visibility: event.visibility,
    participants: (event.participants ?? []).map((p: any) => ({
      userId: p.userId,
      permission: p.permission,
      accepted: p.accepted,
    })),
  };
}

function noteDto(note: any): PersonalNoteDTO {
  return {
    id: note.id,
    ownerId: note.ownerId,
    workspaceId: note.workspaceId,
    eventId: note.eventId,
    title: note.title,
    content: note.content,
    isPrivate: note.isPrivate,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function buildAgendaTools(prisma: PrismaClient) {
  return [
    defineTool({
      name: ToolName.CreateAgendaEvent,
      description: "Creates a personal calendar event; sharing is explicit with selected users or a workspace.",
      input: CreateAgendaEventInputSchema,
      secure: true,
      handler: async (input, ctx): Promise<AgendaEventDTO> => {
        const ownerId = ctx.userId as string;
        if (input.workspaceId) await assertWorkspaceMember(prisma, input.workspaceId, ownerId);
        const participantIds = [...new Set(input.participantUserIds.filter((id) => id !== ownerId))];
        if (input.visibility === "SHARED" && participantIds.length === 0) throw new Error("Shared events need at least one participant");
        if (input.visibility === "WORKSPACE" && !input.workspaceId) throw new Error("Workspace-wide events need a workspace");
        if (participantIds.length) {
          const count = await prisma.user.count({ where: { id: { in: participantIds } } });
          if (count !== participantIds.length) throw new Error("One or more participants do not exist");
        }
        const event = await prisma.agendaEvent.create({
          data: {
            ownerId,
            workspaceId: input.workspaceId,
            title: input.title,
            description: input.description,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            timezone: input.timezone,
            visibility: input.visibility,
            participants: participantIds.length ? { create: participantIds.map((userId) => ({ userId, permission: input.participantPermission })) } : undefined,
          },
          include: { participants: true },
        });
        return eventDto(event);
      },
    }),
    defineTool({
      name: ToolName.ListAgendaEvents,
      description: "Lists events owned by or explicitly shared with the caller, plus workspace-wide events in member workspaces.",
      input: ListAgendaEventsInputSchema,
      secure: true,
      handler: async (input, ctx): Promise<{ events: AgendaEventDTO[] }> => {
        const userId = ctx.userId as string;
        const memberships = await prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } });
        const workspaceIds = memberships.map((m) => m.workspaceId);
        const events = await prisma.agendaEvent.findMany({
          where: {
            ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
            ...(input.from || input.to ? { startsAt: { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lte: new Date(input.to) } : {}) } } : {}),
            OR: [
              { ownerId: userId },
              { participants: { some: { userId } } },
              { visibility: "WORKSPACE", workspaceId: { in: workspaceIds } },
            ],
          },
          include: { participants: true },
          orderBy: { startsAt: "asc" },
        });
        return { events: events.map(eventDto) };
      },
    }),
    defineTool({
      name: ToolName.CreateNote,
      description: "Creates a personal note; private is the safe default. Workspace notes require membership.",
      input: CreateNoteInputSchema,
      secure: true,
      handler: async (input, ctx): Promise<PersonalNoteDTO> => {
        const ownerId = ctx.userId as string;
        if (input.workspaceId) await assertWorkspaceMember(prisma, input.workspaceId, ownerId);
        if (input.eventId) {
          const event = await prisma.agendaEvent.findFirst({ where: { id: input.eventId, OR: [{ ownerId }, { participants: { some: { userId: ownerId } } }] }, select: { id: true } });
          if (!event) throw new Error("You cannot attach a note to this event");
        }
        const note = await prisma.personalNote.create({ data: { ownerId, title: input.title, content: input.content, workspaceId: input.workspaceId, eventId: input.eventId, isPrivate: input.isPrivate } });
        return noteDto(note);
      },
    }),
    defineTool({
      name: ToolName.ListNotes,
      description: "Lists private notes owned by the caller and non-private notes in member workspaces.",
      input: ListNotesInputSchema,
      secure: true,
      handler: async (input, ctx): Promise<{ notes: PersonalNoteDTO[] }> => {
        const userId = ctx.userId as string;
        const memberships = await prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } });
        const workspaceIds = memberships.map((m) => m.workspaceId);
        const notes = await prisma.personalNote.findMany({
          where: {
            ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
            ...(input.eventId ? { eventId: input.eventId } : {}),
            OR: [{ ownerId: userId }, { isPrivate: false, workspaceId: { in: workspaceIds } }, { shares: { some: { userId } } }],
          },
          orderBy: { updatedAt: "desc" },
        });
        return { notes: notes.map(noteDto) };
      },
    }),
  ] as const;
}
