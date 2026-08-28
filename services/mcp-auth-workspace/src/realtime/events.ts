import { Redis } from "ioredis";
import type { AppEnv } from "../env.js";

export type MemberJoinedEvent = {
  type: "member.joined";
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string;
  role: string;
  joinedAt: string;
};

export function createMemberEventPublisher(env: AppEnv): { publish(event: MemberJoinedEvent): Promise<void>; close(): Promise<void> } {
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  return {
    async publish(event) {
      try {
        if (redis.status === "wait") await redis.connect();
        await redis.publish("openteams:workspace-events", JSON.stringify(event));
      } catch {
        // Membership is already committed; realtime delivery is best effort.
      }
    },
    async close() {
      if (redis.status !== "end") await redis.quit().catch(() => redis.disconnect());
    },
  };
}
