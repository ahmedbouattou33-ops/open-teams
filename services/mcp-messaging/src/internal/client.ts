import type { AppEnv } from "../env.js";

export interface ChannelAccessResult {
  readonly allowed: boolean;
  readonly role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST" | null;
  readonly workspaceId: string | null;
}

interface CachedAccess extends ChannelAccessResult {
  readonly expiresAt: number;
}

const TTL_MS = 30_000;

/**
 * Verifies channel access against mcp-auth-workspace (the RBAC source of
 * truth) with a short-lived in-process cache to keep the hot path fast.
 */
export class AuthWorkspaceClient {
  readonly #cache = new Map<string, CachedAccess>();

  constructor(private readonly env: AppEnv) {}

  async getChannelAccess(channelId: string, userId: string): Promise<ChannelAccessResult> {
    const key = `${channelId}:${userId}`;
    const hit = this.#cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit;

    const response = await fetch(
      `${this.env.AUTH_SERVICE_URL}/internal/channels/${encodeURIComponent(channelId)}/access/${encodeURIComponent(userId)}`,
      { headers: { "x-internal-key": this.env.internalApiKey }, signal: AbortSignal.timeout(3_000) },
    );
    if (!response.ok) throw new Error(`auth-workspace returned ${response.status}`);
    const result = (await response.json()) as ChannelAccessResult;

    const cached: CachedAccess = { ...result, expiresAt: Date.now() + TTL_MS };
    this.#cache.set(key, cached);
    if (this.#cache.size > 10_000) this.#cache.clear();
    return result;
  }

  async listAccessibleWorkspaces(userId: string): Promise<string[]> {
    const response = await fetch(
      `${this.env.AUTH_SERVICE_URL}/internal/users/${encodeURIComponent(userId)}/workspaces`,
      { headers: { "x-internal-key": this.env.internalApiKey }, signal: AbortSignal.timeout(3_000) },
    );
    if (!response.ok) return [];
    const result = (await response.json()) as { workspaceIds: string[] };
    return result.workspaceIds ?? [];
  }

  async listAccessibleChannels(userId: string): Promise<string[]> {
    const response = await fetch(
      `${this.env.AUTH_SERVICE_URL}/internal/users/${encodeURIComponent(userId)}/channels`,
      { headers: { "x-internal-key": this.env.internalApiKey }, signal: AbortSignal.timeout(3_000) },
    );
    if (!response.ok) return [];
    const result = (await response.json()) as { channelIds: string[] };
    return result.channelIds ?? [];
  }
}
