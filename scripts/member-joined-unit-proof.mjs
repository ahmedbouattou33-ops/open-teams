import assert from "node:assert/strict";
import { RealtimeHub } from "../services/mcp-messaging/dist/realtime/hub.js";

function socket() {
  return { OPEN: 1, readyState: 1, frames: [], send(payload) { this.frames.push(JSON.parse(payload)); } };
}

const hub = new RealtimeHub();
const sameWorkspace = socket();
const otherWorkspace = socket();
hub.register(sameWorkspace, "user-a", ["channel-a"], ["workspace-a"]);
hub.register(otherWorkspace, "user-b", ["channel-b"], ["workspace-b"]);
hub.broadcastWorkspace("workspace-a", {
  type: "member.joined",
  workspaceId: "workspace-a",
  userId: "user-c",
  displayName: "User C",
  role: "MEMBER",
  joinedAt: new Date().toISOString(),
});
assert.equal(sameWorkspace.frames.length, 1, "same workspace must receive the event");
assert.equal(otherWorkspace.frames.length, 0, "other workspace must not receive the event");
console.log("PASS member.joined workspace fan-out isolation");
