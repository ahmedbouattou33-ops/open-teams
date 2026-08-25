import type { FastifyRequest } from "fastify";
import type { AuthContext } from "@openteams/mcp-core";
import type { AppEnv } from "./env.js";
import { verifyAccessToken } from "./auth/jwt.js";

/** Resolves the caller from `Authorization: Bearer <accessToken>`. Anonymous callers yield `{}`. */
export function authenticateFactory(env: AppEnv) {
  return (request: FastifyRequest): AuthContext => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return {};
    const claims = verifyAccessToken(header.slice("Bearer ".length).trim(), env);
    return claims ? { userId: claims.sub } : {};
  };
}
