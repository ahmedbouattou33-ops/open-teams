import { defineTool, McpError } from "@openteams/mcp-core";
import {
  AuthenticateUserInputSchema,
  RefreshTokenInputSchema,
  RegisterUserInputSchema,
  ToolName,
  type AuthResult,
} from "@openteams/shared-types";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { Prisma } from "../generated/prisma/index.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { issueRefreshToken, rotateRefreshToken } from "../auth/refresh.js";
import { signAccessToken } from "../auth/jwt.js";
import type { AppEnv } from "../env.js";
import { toAuthResult, toUserDTO } from "../mappers.js";

export function buildAuthTools(env: AppEnv, prisma: PrismaClient) {
  const issueTokens = async (user: { id: string; email: string; displayName: string }) => ({
    accessToken: signAccessToken({ sub: user.id, email: user.email, displayName: user.displayName }, env),
    refreshToken: await issueRefreshToken(prisma, user.id, env.refreshTokenTtlMs),
  });

  return [
    defineTool({
      name: ToolName.RegisterUser,
      description: "Creates a user account and returns an initial token pair.",
      input: RegisterUserInputSchema,
      secure: false,
      handler: async (input): Promise<AuthResult> => {
        const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
        if (existing) throw McpError.conflict("Email is already registered");

        const user = await prisma.user.create({
          data: {
            email: input.email,
            passwordHash: await hashPassword(input.password),
            displayName: input.displayName,
          },
        });
        const tokens = await issueTokens(user);
        return toAuthResult({ user, ...tokens });
      },
    }),

    defineTool({
      name: ToolName.AuthenticateUser,
      description: "Verifies credentials and returns a fresh access/refresh token pair.",
      input: AuthenticateUserInputSchema,
      secure: false,
      handler: async (input): Promise<AuthResult> => {
        const user = await prisma.user.findUnique({ where: { email: input.email } });
        // Constant-ish response regardless of which factor failed.
        if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new McpError(-32001, "Invalid credentials");
        }
        const tokens = await issueTokens(user);
        return toAuthResult({ user, ...tokens });
      },
    }),

    defineTool({
      name: ToolName.RefreshToken,
      description: "Rotates a single-use refresh token; returns the next token pair.",
      input: RefreshTokenInputSchema,
      secure: false,
      handler: async (input): Promise<AuthResult> => {
        const { userId, nextToken } = await rotateRefreshToken(prisma, input.refreshToken, env.refreshTokenTtlMs);
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        return toAuthResult({
          user,
          accessToken: signAccessToken(
            { sub: user.id, email: user.email, displayName: user.displayName },
            env,
          ),
          refreshToken: nextToken,
        });
      },
    }),
  ] as const;
}

export type AuthTool = ReturnType<typeof buildAuthTools>[number];
export type { Prisma };
