import { ToolRegistry } from "@openteams/mcp-core";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { AppEnv } from "../env.js";
import { buildAuthTools } from "./auth.tools.js";
import { buildKeyTools } from "./keys.tools.js";
import { buildChannelTools } from "./channel.tools.js";
import { buildWorkspaceTools } from "./workspace.tools.js";
import { buildAgendaTools } from "./agenda.tools.js";
import { buildWorkplanTools } from "./workplan.tools.js";
import { buildInviteTools } from "./invite.tools.js";
import type { MemberJoinedEvent } from "../realtime/events.js";

export function buildToolRegistry(env: AppEnv, prisma: PrismaClient, publishMemberJoined?: (event: MemberJoinedEvent) => Promise<void>): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of [
    ...buildAuthTools(env, prisma),
    ...buildKeyTools(prisma),
    ...buildWorkspaceTools(prisma),
    ...buildChannelTools(prisma),
    ...buildAgendaTools(prisma),
    ...buildWorkplanTools(prisma),
    ...buildInviteTools(prisma, publishMemberJoined),
  ]) {
    registry.register(tool);
  }
  return registry;
}
