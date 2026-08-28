import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { RealtimeHub } from "../services/mcp-messaging/dist/realtime/hub.js";
import { createWorkspaceEventSubscriber } from "../services/mcp-messaging/dist/realtime/subscriber.js";

const require = createRequire(new URL("../services/mcp-messaging/package.json", import.meta.url));
const { Redis } = require("ioredis");
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";

function socket() {
  return { OPEN: 1, readyState: 1, frames: [], send(payload) { this.frames.push(JSON.parse(payload)); } };
}

const hub = new RealtimeHub();
const memberSocket = socket();
const isolatedSocket = socket();
hub.register(memberSocket, "user-a", ["channel-a"], ["workspace-a"]);
hub.register(isolatedSocket, "user-b", ["channel-b"], ["workspace-b"]);
const subscriber = createWorkspaceEventSubscriber({ REDIS_URL: redisUrl }, hub);
const publisher = new Redis(redisUrl);
try {
  await subscriber.start();
  await publisher.publish("openteams:workspace-events", JSON.stringify({
    type: "member.joined",
    workspaceId: "workspace-a",
    userId: "user-c",
    displayName: "User C",
    role: "MEMBER",
    joinedAt: new Date().toISOString(),
  }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(memberSocket.frames.length, 1, "same workspace must receive Redis event");
  assert.equal(memberSocket.frames[0].type, "member.joined");
  assert.equal(isolatedSocket.frames.length, 0, "different workspace must not receive Redis event");
  console.log("PASS Redis subscriber member.joined fan-out and tenant isolation");
} finally {
  await publisher.quit();
  await subscriber.close();
}
