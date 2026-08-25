import { defineTool, McpError, AppErrorCode } from "@openteams/mcp-core";
import {
  GetUserPublicKeyInputSchema,
  StoreUserPublicKeyInputSchema,
  ToolName,
} from "@openteams/shared-types";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { AuthContext } from "@openteams/mcp-core";

/** X25519 SPKI DER is exactly 44 bytes. */
function isValidIdentityKey(base64: string): boolean {
  return Buffer.from(base64, "base64").length === 44;
}

export function buildKeyTools(prisma: PrismaClient) {
  return [
    defineTool({
      name: ToolName.StoreUserPublicKey,
      description:
        "Publishes the caller's X25519 identity public key (base64 SPKI) for E2EE DM session establishment. Users can only register their own key.",
      input: StoreUserPublicKeyInputSchema,
      secure: true,
      handler: async (input, ctx: AuthContext) => {
        if (!isValidIdentityKey(input.identityPublicKey)) {
          throw new McpError(AppErrorCode.NotFound - 1, "identityPublicKey must be a base64-encoded X25519 SPKI (44 bytes)");
        }
        const user = await prisma.user.update({
          where: { id: ctx.userId },
          data: { identityPublicKey: input.identityPublicKey },
          select: { id: true, identityPublicKey: true },
        });
        return { userId: user.id, identityPublicKey: user.identityPublicKey };
      },
    }),

    defineTool({
      name: ToolName.GetUserPublicKey,
      description: "Fetches a user's published E2EE identity public key. Public — required for encrypted DM handshake.",
      input: GetUserPublicKeyInputSchema,
      secure: false,
      handler: async (input) => {
        const user = await prisma.user.findUnique({
          where: { id: input.userId },
          select: { id: true, identityPublicKey: true },
        });
        if (!user?.identityPublicKey) throw McpError.notFound("No registered identity key for this user");
        return { userId: user.id, identityPublicKey: user.identityPublicKey };
      },
    }),
  ] as const;
}
