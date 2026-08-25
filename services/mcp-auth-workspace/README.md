# mcp-auth-workspace

MCP (JSON-RPC 2.0 over HTTP) server for **authentication, workspaces, channels and the E2EE identity key registry**.

## Setup

```bash
pnpm install                      # from repo root
cp .env.example .env              # adjust DATABASE_URL
pnpm gen:keys                     # RS256 JWT keypair -> keys/
pnpm db:push                      # sync Prisma schema
pnpm dev                          # http://localhost:4001
```

## Endpoints

| Route | Description |
|---|---|
| `POST /mcp` | MCP transport — JSON-RPC 2.0 |
| `GET /health` | Liveness + DB check + tool catalog |

Authenticated tools accept `Authorization: Bearer <accessToken>`.

## Tool catalog

| Tool | Auth | Notes |
|---|---|---|
| `register_user` | – | Password policy enforced; returns token pair |
| `authenticate_user` | – | Uniform error for wrong email/password |
| `refresh_token` | – | Single-use rotation; replay revokes the family |
| `store_user_public_key` | JWT | Own key only; validates X25519 SPKI (44 bytes) |
| `get_user_public_key` | – | Public — needed for E2EE DM handshake |
| `create_workspace` | JWT | Caller becomes OWNER; creates `#general`; transactional |
| `get_user_workspaces` | JWT | Includes caller's role per workspace |
| `create_channel` | JWT | Requires workspace ADMIN+; creator joins as channel OWNER |
| `list_channels` | JWT | Workspace members only (GUEST+) |

## Security model

- **JWT**: RS256 (4096-bit), 15 min TTL, issuer-pinned verification.
- **Refresh tokens**: opaque 48-byte, SHA-256-at-rest, single-use rotation.
- **Passwords**: bcrypt cost 12.
- **RBAC**: `OWNER > ADMIN > MEMBER > GUEST` enforced inside every workspace-scoped tool handler (`src/rbac.ts`).
- **E2EE**: private keys never touch this service — it is a public-key directory only.

## E2EE DM flow (client side)

```ts
import { generateAgreementKeyPair } from "@openteams/mcp-core";

const { publicKey, privateKey } = generateAgreementKeyPair();
// register publicKey via store_user_public_key (keep privateKey on device)
// fetch peer key via get_user_public_key, then:
// sharedSecret = computeSharedSecret(privateKey, peerKey)
// [root, chain] = ratchetStep(rootInit, sharedSecret)
```

See `packages/mcp-core/src/crypto.ts` for the full Double-Ratchet primitive set.
