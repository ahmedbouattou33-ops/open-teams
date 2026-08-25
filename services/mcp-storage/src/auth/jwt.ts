import jwt from "jsonwebtoken";
import type { AppEnv } from "../env.js";

export interface AccessTokenClaims {
  readonly sub: string;
}

export function verifyAccessToken(token: string, env: AppEnv): AccessTokenClaims | null {
  try {
    const payload = jwt.verify(token, env.accessPublicKeyPem, {
      algorithms: ["RS256"],
      issuer: env.JWT_ISSUER,
    });
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
