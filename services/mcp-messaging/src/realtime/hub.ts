import type { RawData, WebSocket } from "ws";
import type { MessagingSocketEvent } from "@openteams/shared-types";

interface ConnectedClient {
  readonly socket: WebSocket;
  readonly userId: string;
  readonly channels: Set<string>;
  readonly workspaces: Set<string>;
}

/**
 * In-process connection registry and room-based broadcaster.
 * One instance per service replica; cross-replica fan-out plugs into Redis
 * Pub/Sub at the same seam (`publish`) in a later hardening step.
 */
export class RealtimeHub {
  readonly #byUser = new Map<string, Set<ConnectedClient>>();
  readonly #byChannel = new Map<string, Set<ConnectedClient>>();

  get connectionCount(): number {
    let n = 0;
    for (const set of this.#byUser.values()) n += set.size;
    return n;
  }

  hasUserConnection(userId: string): boolean {
    return (this.#byUser.get(userId)?.size ?? 0) > 0;
  }

  register(socket: WebSocket, userId: string, channelIds: readonly string[], workspaceIds: readonly string[] = []): ConnectedClient {
    const client: ConnectedClient = { socket, userId, channels: new Set(channelIds), workspaces: new Set(workspaceIds) };
    this.#addTo(this.#byUser, userId, client);
    for (const channelId of client.channels) this.#addTo(this.#byChannel, channelId, client);
    return client;
  }

  unregister(client: ConnectedClient): void {
    const users = this.#byUser.get(client.userId);
    if (users) {
      users.delete(client);
      if (users.size === 0) this.#byUser.delete(client.userId);
    }
    for (const channelId of client.channels) {
      const rooms = this.#byChannel.get(channelId);
      if (rooms) {
        rooms.delete(client);
        if (rooms.size === 0) this.#byChannel.delete(channelId);
      }
    }
  }

  /** Returns whether this authenticated connection is allowed to publish to the channel. */
  canPublish(client: ConnectedClient, channelId: string): boolean {
    return client.channels.has(channelId);
  }

  /** Subscribes an existing connection to a newly joined channel. */
  join(client: ConnectedClient, channelId: string): void {
    if (!client.channels.add(channelId)) return;
    this.#addTo(this.#byChannel, channelId, client);
  }

  broadcast(channelId: string, event: MessagingSocketEvent): void {
    const payload = serialize(event);
    for (const client of this.#byChannel.get(channelId) ?? []) safeSend(client.socket, payload);
  }

  broadcastWorkspace(workspaceId: string, event: MessagingSocketEvent): void {
    const payload = serialize(event);
    for (const clients of this.#byUser.values()) {
      for (const client of clients) {
        if (client.workspaces.has(workspaceId)) safeSend(client.socket, payload);
      }
    }
  }

  sendToUser(userId: string, event: MessagingSocketEvent): void {
    const payload = serialize(event);
    for (const client of this.#byUser.get(userId) ?? []) safeSend(client.socket, payload);
  }

  #addTo(map: Map<string, Set<ConnectedClient>>, key: string, client: ConnectedClient): void {
    let set = map.get(key);
    if (!set) map.set(key, (set = new Set()));
    set.add(client);
  }
}

function serialize(event: MessagingSocketEvent): string {
  try {
    return JSON.stringify(event);
  } catch {
    return JSON.stringify({ type: "error", message: "serialization failed" } satisfies MessagingSocketEvent | object);
  }
}

function safeSend(socket: WebSocket, payload: string): void {
  if (socket.readyState === socket.OPEN) socket.send(payload);
}

/** Parses inbound client frames; currently only used for keep-alive/subscribe hints. */
export function decodeFrame(data: RawData): { type: string } | null {
  try {
    const parsed: unknown = JSON.parse(typeof data === "string" ? data : data.toString());
    if (typeof parsed === "object" && parsed !== null && typeof (parsed as { type?: unknown }).type === "string") {
      return parsed as { type: string };
    }
    return null;
  } catch {
    return null;
  }
}
