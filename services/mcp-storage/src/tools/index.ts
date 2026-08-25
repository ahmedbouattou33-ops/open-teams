import { ToolRegistry } from "@openteams/mcp-core";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { AuthWorkspaceClient } from "../internal/client.js";
import type { StorageBackend } from "../s3.js";
import { buildStorageTools } from "./storage.tools.js";

export function buildToolRegistry(
  prisma: PrismaClient,
  authClient: AuthWorkspaceClient,
  storage: StorageBackend,
): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of buildStorageTools({ prisma, authClient, storage })) {
    registry.register(tool);
  }
  return registry;
}
