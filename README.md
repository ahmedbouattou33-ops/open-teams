# OpenTeams

Enterprise-grade, open-source alternative to Microsoft Teams.
Modular microservices monorepo powered by **MCP (Model Context Protocol) servers**, with End-to-End Encryption (E2EE) for Direct Messages.

## Architecture

```
[User / Frontend]
        │
        ├── (JSON-RPC via MCP Protocol) ──► [MCP Auth Server] ────► [PostgreSQL]
        │
        ├── (WebSockets / MCP) ───────────► [MCP Messaging] ────► [Redis / PostgreSQL]
        │
        └── (WebRTC Signaling / MCP) ─────► [MCP Media Server] ──► [LiveKit / SFU]
```

## Structure

| Path | Description |
|---|---|
| `apps/web` | Next.js 14 client (Phase 5) |
| `packages/mcp-core` | JSON-RPC protocol layer, tool registry, E2EE crypto primitives |
| `packages/shared-types` | Shared TS interfaces + Zod schemas |
| `services/mcp-auth-workspace` | Auth, JWT, Workspaces, Channels, E2EE key registry (**Phase 1 — done**) |
| `services/mcp-messaging` | Real-time chat engine (Phase 2) |
| `services/mcp-media-rtc` | Audio/Video signaling via LiveKit (Phase 3) |
| `services/mcp-storage` | File storage / attachments (Phase 4) |

## Quick start (Phase 1)

```bash
corepack enable || npm i -g pnpm   # ensure pnpm >= 9
pnpm install
cp services/mcp-auth-workspace/.env.example services/mcp-auth-workspace/.env
pnpm gen:keys                      # RS256 keypair for JWT signing -> keys/
pnpm db:push                       # create schema in PostgreSQL
pnpm dev:auth                      # MCP server on http://localhost:4001/mcp
```

## Calling an MCP tool

All tools are exposed as JSON-RPC 2.0 methods over `POST /mcp`:

```bash
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"register_user","params":{"email":"a@b.c","password":"Str0ng!Pass","displayName":"Alice"}}'
```

Authenticated tools accept `Authorization: Bearer <accessToken>`.

See `services/mcp-auth-workspace/README.md` for the full tool catalog and security model.
