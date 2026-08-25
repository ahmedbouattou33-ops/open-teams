import { createHash, randomBytes } from "node:crypto";
import { McpError, AppErrorCode } from "@openteams/mcp-core";
import type { PrismaClient } from "../generated/prisma/index.js";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issues an opaque refresh token; only its SHA-256 digest is persisted. */
export async function issueRefreshToken(prisma: PrismaClient, userId: string, ttlMs: number): Promise<string> {
  const raw = randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return raw;
}

/**
 * Validates and rotates a refresh token (single-use). Returns the subject
 * of the freshly issued token pair.
 */
export async function rotateRefreshToken(
  prisma: PrismaClient,
  raw: string,
  ttlMs: number,
): Promise<{ userId: string; nextToken: string }> {
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!stored) throw new McpError(AppErrorCode.Unauthorized, "Invalid refresh token");

  const isReplay = !stored.revokedAt && stored.expiresAt <= new Date();
  // Revoke immediately on replay detection to force full re-authentication.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  if (stored.revokedAt || isReplay) {
    throw new McpError(AppErrorCode.Unauthorized, "Refresh token revoked or expired");
  }

  const nextToken = await issueRefreshToken(prisma, stored.userId, ttlMs);
  return { userId: stored.userId, nextToken };
}
