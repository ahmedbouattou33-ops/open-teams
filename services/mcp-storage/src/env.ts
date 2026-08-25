import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4004),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_PUBLIC_KEY_PATH: z.string().min(1),
  JWT_ISSUER: z.string().default("openteams:mcp-auth-workspace"),
  AUTH_SERVICE_URL: z.string().url().default("http://localhost:4001"),
  INTERNAL_API_KEY: z.string().min(16),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1).regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "Invalid S3 bucket name"),
});

export type AppEnv = Readonly<
  z.infer<typeof EnvSchema> & {
    readonly accessPublicKeyPem: string;
    readonly internalApiKey: string;
  }
>;

export function loadEnv(): AppEnv {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file — rely on real environment variables.
  }
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  const keyPath = isAbsolute(env.JWT_ACCESS_PUBLIC_KEY_PATH)
    ? env.JWT_ACCESS_PUBLIC_KEY_PATH
    : resolve(process.cwd(), env.JWT_ACCESS_PUBLIC_KEY_PATH);
  let accessPublicKeyPem: string;
  try {
    accessPublicKeyPem = readFileSync(keyPath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read JWT public key at "${keyPath}". Run \`pnpm gen:keys\` and copy keys/ into this service.`,
      { cause: error },
    );
  }
  return Object.freeze({ ...env, accessPublicKeyPem, internalApiKey: env.INTERNAL_API_KEY });
}
