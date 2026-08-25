# PROJECT_STATE.md

> Auto-maintained system state. Updated after every phase.

## System Architecture

```
[User / Frontend]
        │
        ├── (JSON-RPC via MCP Protocol) ──► [1. mcp-auth-workspace :4001] ──► [PostgreSQL]
        │        Identity · JWT RS256 · RBAC · E2EE key registry
        │
        ├── (WebSockets / MCP) ───────────► [2. mcp-messaging]             ──► [Redis / PostgreSQL]   (Phase 2)
        │        Real-time sockets · Redis Pub/Sub · chat & DM history
        │
        ├── (WebRTC Signaling / MCP) ─────► [3. mcp-media-rtc]             ──► [LiveKit / SFU]       (Phase 3)
        │        WebRTC signaling · Neural Noise Isolation / audio enhancement
        │                                          │
        │            audio streams + join/leave events (Redis Streams, MediaAiStreamEvent contract)
        │                                          ▼
        │                                  [5. mcp-ai-agent]              ──► [Whisper STT / LLM]   (Phase 6)
        │                                     ├─► Live Speech-to-Text (Whisper)
        │                                     ├─► Live Audio/Text Translation stream
        │                                     ├─► Dynamic Meeting Org-Chart (Chef de Projet, Marketing Director, …)
        │                                     ├─► Automated Action Items & Task extraction
        │                                     ├─► "Catch-Up" summary generator for late joiners
        │                                     ├─► Sentiment analysis (per-meeting / per-participant)
        │                                     └─► Semantic search over transcripts & messages
        │
        ├── (MCP: uploads/attachments) ───► [4. mcp-storage]               ──► [S3-compatible]       (Phase 4)
        │        File Vault · attachment processing · presigned uploads
        │
        └── [apps/web — Next.js 14, TailwindCSS, shadcn/ui]                                        (Phase 5)

Shared libraries:
  packages/mcp-core        JSON-RPC 2.0 layer, ToolRegistry, Fastify adapter,
                           E2EE crypto (X25519 + Ed25519 + HKDF ratchet + AES-256-GCM)
  packages/shared-types    DTOs, Zod tool I/O schemas, RBAC hierarchy, tool names,
                           MediaAiStreamEvent contract (media-rtc -> ai-agent pipeline)
```

### media-rtc → ai-agent data pipeline

`mcp-media-rtc` publishes `MediaAiStreamEvent`s (`audio.chunk`, `meeting.joined`,
`meeting.left`) to a Redis Stream per meeting. `mcp-ai-agent` consumes them to:

1. Transcribe audio chunks with Whisper → `TranscriptSegment`s.
2. Translate segments live per-participant locale.
3. Build the meeting org-chart incrementally from `meeting.joined` role metadata
   (`roleTitle`, `reportsToParticipantId`) → `OrgChartNode[]`.
4. Extract action items from transcript windows → `ActionItem[]`.
5. Serve `CatchUpSummary` via an MCP tool for late joiners.

All event schemas live in `packages/shared-types` (single source of truth).

## Implemented Features & MCP Tools

### Phase 1 — `services/mcp-auth-workspace` (DONE — verified ✅)
| Area | Details |
|---|---|
| Auth | RS256 JWT access tokens (15 m), single-use rotating refresh tokens (SHA-256 at rest, replay detection), bcrypt cost 12 |
| RBAC | OWNER > ADMIN > MEMBER > GUEST enforced per tool (`src/rbac.ts`) |
| E2EE | Public X25519 identity key registry; private keys never leave clients |

**MCP tools** (`POST /mcp`, JSON-RPC 2.0):

| Tool | Secure | Status |
|---|---|---|
| `register_user` | no | ✅ |
| `authenticate_user` | no | ✅ |
| `refresh_token` | no | ✅ |
| `store_user_public_key` | yes | ✅ |
| `get_user_public_key` | no | ✅ |
| `create_workspace` | yes | ✅ (transactional, auto #general + OWNER memberships) |
| `get_user_workspaces` | yes | ✅ |
| `create_channel` | yes | ✅ (ADMIN+ required) |
| `list_channels` | yes | ✅ (membership-gated) |

**DB models**: User, RefreshToken, Workspace, WorkspaceMember, Channel, ChannelMember.
**Internal API** (`/internal/*`, guarded by `x-internal-key`): channel-access checks + user
channel listing — the RBAC source of truth consumed by all other services.

### Phase 2 — `services/mcp-messaging` (DONE — verified ✅)

| Area | Details |
|---|---|
| Realtime | Fastify WebSocket (`GET /ws?token=<jwt>`), room-based hub (per-user/per-channel), events: `ready`, `message.created`, `reaction.updated`, `receipt.updated`; heartbeat; Redis Pub/Sub seam ready for multi-replica fan-out |
| Tagging | Optional structured `tag` (`DECISION`/`ACTION_ITEM`/`NOTE`) + `referenceId`; `assigneeId` enforced to require `tag=ACTION_ITEM` |
| E2EE transport | Message body is either plaintext or an AES-256-GCM envelope (`ciphertextB64`/`ivB64`/`authTagB64`) — never both; metadata stays unencrypted by design |
| Threading & receipts | `parentId` threads w/ same-channel validation; per-user read receipts |
| RBAC | Zero duplication: every tool verifies channel access against mcp-auth-workspace internal API (30 s cache). PUBLIC channels inherit workspace membership; PRIVATE/DIRECT need explicit membership |

**MCP tools**:

| Tool | Secure | Status |
|---|---|---|
| `send_message` | yes | ✅ broadcasts realtime |
| `get_channel_history` | yes | ✅ paginated (ISO cursor), filterable by tag/thread |
| `mark_as_read` | yes | ✅ broadcasts receipt |
| `add_reaction` | yes | ✅ add/retract + broadcast |

**DB models** (dedicated `openteams_messaging` database): Message (threaded), Reaction, ReadReceipt.

## Core Practical Features (Strict Enterprise Directives)

Low-noise, productivity-first workspace. These are locked into the roadmap contracts:

1. **`mcp-messaging` (Phase 2) — Message Tagging**: every message may carry exactly one
   tag — `DECISION`, `ACTION_ITEM`, `NOTE` — plus a `referenceId` pointing at the entity
   it resolves or affects. Contract: `MessageTagSchema`, `TaggedMessageDTO` in `shared-types`.
2. **`mcp-ai-agent` (Phase 6) — three practical tools** (names & schemas reserved in `shared-types`):
   - `generate_async_digest` — summarizes unread messages + mentions into ranked actionable priorities.
   - `extract_action_items` — parses text or transcripts into structured tasks with assignees and deadlines.
   - `semantic_search` — contextual retrieval across channels *and* stored documents.
3. **`mcp-auth-workspace` (Phase 1 ✅) — clean RBAC** (`OWNER > ADMIN > MEMBER > GUEST`,
   enforced per tool in `src/rbac.ts`) and **session isolation** (per-user refresh-token
   families, single-use rotation, replay revocation).

## Roadmap

- [x] **Phase 1** — Monorepo foundation + MCP auth/workspace server
- [x] **Phase 2** — Real-time messaging engine & WebSockets (`services/mcp-messaging`)
- [x] **Phase 3** — Voice/video calls & screen sharing SFU (`services/mcp-media-rtc`, :4003) — DONE (in-memory rooms; SFU/LiveKit integration + Neural Noise Isolation deferred) — verified ✅
      - WebRTC signaling over `GET /ws/call?token=<jwt>&callId=<id>`: SDP offer/answer +
        ICE-candidate relay to `targetUserId` (or broadcast), media-state updates,
        heartbeat, auto-leave on socket drop, auto room cleanup when empty.
      - MCP tools (`POST /mcp`): `initiate_call` → `{callId, wsUrl, callType}`,
        `join_call` (RBAC via auth-workspace internal API) → participant snapshot,
        `leave_call`, `get_active_calls` (workspace/channel filter).
      - Room manager in `src/rooms.ts`: ActiveCall/ParticipantState with socket swap on
        reconnect, thread-safe single-process ops. Contracts (`MediaRtcToolName`,
        input schemas, `WebRTCSignalingFrameSchema`) live in `shared-types`.
- [ ] **Phase 4** — File storage & media attachments (`services/mcp-storage`)
- [ ] **Phase 5** — Web client UI integration (`apps/web`)
- [ ] **Phase 6** — AI meeting intelligence (`services/mcp-ai-agent`): Whisper live STT, live translation,
      dynamic org-chart generation, action-item extraction, catch-up summaries.
      Consumes `MediaAiStreamEvent` stream from Phase 3 (contract already defined in `shared-types`).
      - **Autonomous AI Co-Pilot**: observes live transcripts and *proactively* generates
            project timelines, milestones and task assignments during discussion — pushing
            draft plans into channels without being asked.
      - **AI-Powered Interactive Whiteboard**: freehand sketch → professional diagram/wireframe
            conversion (image-to-structured-DiagramML), shared live across participants,
            exportable to `mcp-storage`.
      - **"War Room Mode"**: one-click emergency alignment — spins up a priority channel +
            ad-hoc meeting, pins unified metrics dashboards (incident, KPIs, on-call roster),
            applies focus layout, silences non-critical notifications workspace-wide.

## ⏸️ RESUME HERE — Next Session Checklist

**Status when paused:** Phases 1–3 **verified**: real E2E flow passing via
`scripts/verify-e2e.mjs` (2 consecutive green runs against live servers on :4001/:4002/:4003).
The script covers: register_user → authenticate_user → store_user_public_key → create_workspace
→ create_channel → send_message (tag `ACTION_ITEM`) → get_channel_history → mark_as_read
→ add_reaction → real WS to mcp-messaging asserting `message.created` → initiate_call
→ join_call (pre-register, socket still null) → real WS to `/ws/call` asserting `ready`
→ media-state frame → leave_call → `get_active_calls` no longer lists the caller.
Run it any time with `node scripts/verify-e2e.mjs` (servers must be up; plain Node ESM,
no new deps — `ws` resolved via createRequire from mcp-messaging's node_modules).

**Bugs found & fixed by the E2E run (2026-08-25):**
- `create_workspace`/`create_channel` return flat DTOs (`result.id`) — verify-e2e.mjs was
  reading a non-existent `result.workspace.id` nesting (script bug, fixed in script).
- **Real bug (both services)**: WebSocket routes declared on the root Fastify app were NOT
  transformed by @fastify/websocket's `onRoute` wrapper — the handler was dispatched as a
  plain HTTP handler `(request, reply)`, crashing with `socket.close is not a function`
  (HTTP 500 on every upgrade). Fixed in `mcp-messaging/src/server.ts` and
  `mcp-media-rtc/src/server.ts` by registering the WS routes inside a nested
  `app.register(scope => …)` plugin scope. Typecheck passes because the v11 typings
  declare `(socket, request)` — only runtime surfaced it. Lesson: WS handshake paths
  need runtime verification.
- Script ordering fix: MCP `leave_call` must be called BEFORE closing the call socket —
  socket close triggers auto-leave + room cleanup ("Call not found" otherwise; correct
  server behavior).

**Next steps, in order:**
1. Phase 4 (`mcp-storage`) is built + typechecked + smoke-tested but NOT E2E-verified —
   extend `scripts/verify-e2e.mjs` with its upload/download/presign tools next.
2. Only then start **Phase 5** — Web client (`apps/web`), or **Phase 6** — `mcp-ai-agent`.

**Gotchas already fixed this session:**
- auth `.env` was missing `INTERNAL_API_KEY` (internal RBAC API disabled) — appended.
- pnpm + Prisma shared-store clash — solved via per-service generator outputs.

## Build Status

- ✅ `pnpm install` — workspace linked (media-rtc incl. @fastify/websocket + @types/ws).
- ✅ Prisma clients generated per-service (custom output — pnpm shared-store clash resolved).
- ✅ `pnpm build` — all services successful (incl. @openteams/mcp-media-rtc).
- ✅ `pnpm typecheck` — 10/10 tasks successful, strict mode (re-verified after WS-route fix).
- ✅ **Phases 1–3 verified: real E2E flow passing via `scripts/verify-e2e.mjs`**
      (DB-backed: real PostgreSQL for auth + messaging; media-rtc in-memory).

## Environment

- Node >= 20, pnpm >= 9 (via corepack or npm -g).
- PostgreSQL required for Phase 1 runtime.
