import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_PRIVATE_KEY_PATH: z.string().min(1),
  JWT_ACCESS_PUBLIC_KEY_PATH: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_ISSUER: z.string().default("openteams:mcp-auth-workspace"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** Shared secret for service-to-service calls; internal API disabled when unset. */
  INTERNAL_API_KEY: z.string().min(16).optional(),
});

export type AppEnv = Readonly<
  z.infer<typeof EnvSchema> & {
    readonly accessPrivateKeyPem: string;
    readonly accessPublicKeyPem: string;
    readonly refreshTokenTtlMs: number;
  }
>;

function readKeyFile(path: string): string {
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
  try {
    return readFileSync(absolute, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read JWT key at "${absolute}". Generate the keypair first with: pnpm gen:keys`,
      { cause: error },
    );
  }
}

export function loadEnv(): AppEnv {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file present — rely on real environment variables.
  }
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  return Object.freeze({
    ...env,
    accessPrivateKeyPem: readKeyFile(env.JWT_ACCESS_PRIVATE_KEY_PATH),
    accessPublicKeyPem: readKeyFile(env.JWT_ACCESS_PUBLIC_KEY_PATH),
    refreshTokenTtlMs: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}
