import { ToolRegistry } from "@openteams/mcp-core";
import type { PrismaClient } from "../generated/prisma/index.js";
import { buildMessagingTools } from "./messages.tools.js";
import type { RealtimeHub } from "../realtime/hub.js";
import type { AuthWorkspaceClient } from "../internal/client.js";

export function buildToolRegistry(prisma: PrismaClient, hub: RealtimeHub, authClient: AuthWorkspaceClient): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of buildMessagingTools(prisma, hub, authClient)) {
    registry.register(tool);
  }
  return registry;
}
