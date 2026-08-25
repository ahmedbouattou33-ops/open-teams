# mcp-messaging

Real-time messaging engine: tagged messages, E2EE payload transport, threading,
reactions, read receipts — exposed as MCP tools plus WebSocket streaming.

## Setup

```bash
cp .env.example .env               # dedicated DB: openteams_messaging
pnpm --filter @openteams/mcp-auth-workspace gen:keys   # reuse the same keys dir
mkdir -p keys && cp ../mcp-auth-workspace/keys/access-public.pem keys/
pnpm db:push
pnpm dev                           # http://localhost:4002
```

Requires `mcp-auth-workspace` running (RBAC source of truth, `INTERNAL_API_KEY` shared).

## Endpoints

| Route | Description |
|---|---|
| `POST /mcp` | MCP tools (JSON-RPC 2.0), `Authorization: Bearer <accessToken>` |
| `GET /ws?token=<accessToken>` | Realtime event stream |
| `GET /health` | Liveness + DB check + connection count |

## Tools

| Tool | Notes |
|---|---|
| `send_message` | `content` is `plain` **or** `encrypted` (AES-256-GCM envelope) — never both. Optional `tag` (`DECISION`/`ACTION_ITEM`/`NOTE`) with `referenceId`; `assigneeId` requires `tag=ACTION_ITEM`. Threads via `parentId`. |
| `get_channel_history` | Newest-first pagination via ISO `before` cursor; filters: `tag`, `threadOf`. |
| `mark_as_read` | Per-user read receipt; broadcasts `receipt.updated`. |
| `add_reaction` | Add/retract emoji; broadcasts `reaction.updated`. |

## Socket events (`GET /ws`)

`ready`, `message.created`, `reaction.updated`, `receipt.updated`.
Metadata (tags, sender, timestamps) travels unencrypted by design; message
bodies may be end-to-end encrypted envelopes decrypted client-side.

## RBAC

Membership is never duplicated here — every tool verifies channel access against
`mcp-auth-workspace` via the internal API (`x-internal-key`, 30 s cache).
PUBLIC channels inherit workspace membership; PRIVATE/DIRECT require explicit membership.
