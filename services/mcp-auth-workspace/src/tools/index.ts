import { ToolRegistry } from "@openteams/mcp-core";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { AppEnv } from "../env.js";
import { buildAuthTools } from "./auth.tools.js";
import { buildKeyTools } from "./keys.tools.js";
import { buildChannelTools } from "./channel.tools.js";
import { buildWorkspaceTools } from "./workspace.tools.js";

export function buildToolRegistry(env: AppEnv, prisma: PrismaClient): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of [
    ...buildAuthTools(env, prisma),
    ...buildKeyTools(prisma),
    ...buildWorkspaceTools(prisma),
    ...buildChannelTools(prisma),
  ]) {
    registry.register(tool);
  }
  return registry;
}
