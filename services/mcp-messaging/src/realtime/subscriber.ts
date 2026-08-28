import { Redis } from "ioredis";
import type { MessagingSocketEvent } from "@openteams/shared-types";
import type { AppEnv } from "../env.js";
import type { RealtimeHub } from "./hub.js";

const CHANNEL = "openteams:workspace-events";

type WorkspaceEvent = {
  type: "member.joined";
  workspaceId: string;
  userId: string;
  displayName: string;
  email?: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
  joinedAt: string;
};

function isMemberJoinedEvent(value: unknown): value is WorkspaceEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<WorkspaceEvent>;
  return event.type === "member.joined"
    && typeof event.workspaceId === "string"
    && typeof event.userId === "string"
    && typeof event.displayName === "string"
    && typeof event.role === "string"
    && typeof event.joinedAt === "string";
}

export function createWorkspaceEventSubscriber(env: AppEnv, hub: RealtimeHub): { start(): Promise<void>; close(): Promise<void> } {
  const subscriber = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  subscriber.on("error", () => undefined);

  subscriber.on("message", (_channel, raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isMemberJoinedEvent(parsed)) return;
      const event: MessagingSocketEvent = {
        type: "member.joined",
        workspaceId: parsed.workspaceId,
        userId: parsed.userId,
        displayName: parsed.displayName,
        email: parsed.email,
        role: parsed.role,
        joinedAt: parsed.joinedAt,
      };
      hub.broadcastWorkspace(parsed.workspaceId, event);
    } catch {
      // Ignore malformed internal events; never crash the realtime service.
    }
  });

  return {
    async start() {
      try {
        if (subscriber.status === "wait") await subscriber.connect();
        if (subscriber.status === "ready" || subscriber.status === "connecting") await subscriber.subscribe(CHANNEL);
      } catch {
        // Redis is an enhancement for live fan-out; the WS service remains available.
      }
    },
    async close() {
      if (subscriber.status !== "end") await subscriber.quit().catch(() => subscriber.disconnect());
    },
  };
}
