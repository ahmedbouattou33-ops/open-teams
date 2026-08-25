import { ToolRegistry } from "@openteams/mcp-core";
import type { AuthWorkspaceClient } from "../internal/client.js";
import type { RoomManager } from "../rooms.js";
import { buildMediaTools } from "./media.tools.js";

export function buildToolRegistry(authClient: AuthWorkspaceClient, roomManager: RoomManager): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of buildMediaTools(authClient, roomManager)) {
    registry.register(tool);
  }
  return registry;
}
