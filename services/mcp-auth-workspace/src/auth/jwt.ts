import jwt, { type SignOptions } from "jsonwebtoken";
import type { AppEnv } from "../env.js";

export interface AccessTokenClaims {
  readonly sub: string;
  readonly email: string;
  readonly displayName: string;
}

export function signAccessToken(claims: AccessTokenClaims, env: AppEnv): string {
  const options: SignOptions = {
    algorithm: "RS256",
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  };
  return jwt.sign({ email: claims.email, displayName: claims.displayName }, env.accessPrivateKeyPem, {
    ...options,
    subject: claims.sub,
  });
}

export function verifyAccessToken(token: string, env: AppEnv): AccessTokenClaims | null {
  try {
    const payload = jwt.verify(token, env.accessPublicKeyPem, {
      algorithms: ["RS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      displayName: typeof payload.displayName === "string" ? payload.displayName : "",
    };
  } catch {
    return null;
  }
}
