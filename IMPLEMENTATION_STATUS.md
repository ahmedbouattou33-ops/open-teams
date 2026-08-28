# OpenTeams — Implementation Status

## Implemented in this worktree

| Area | Delivered |
|---|---|
| Infrastructure | Root `Dockerfile`, `.dockerignore`, and `docker-compose.yml` for PostgreSQL, Redis, MinIO, five services, and Next.js |
| AI | `mcp-ai-agent` activated on port 4005 with `/health`, `/metrics`, `/summarize`, and `/transcribe` against configurable local LLM/Whisper-compatible endpoints |
| Messaging AI | `/summarize` and `/suggest-reply` endpoints in `mcp-messaging`, both authenticated and channel-access checked |
| API docs | Swagger and Swagger UI registration at `/docs` for auth, messaging, RTC, and storage services |
| Rate limiting | `@fastify/rate-limit` registered on the four existing Fastify services |
| Web Push | VAPID subscription endpoints, browser `PushRegistration`, and `public/sw.js` |
| JWT hardening | RS256, issuer, and audience checks applied to token issuance/verification where access JWTs are handled |
| Telemetry | Prometheus-compatible `/metrics` endpoints on all existing services and AI agent |
| Recovery | `scripts/backup-db.sh` for PostgreSQL dump and MinIO mirror with checksums |
| CI | `.github/workflows/ci.yml` for frozen install, typecheck, build, browser installation, and E2E execution |
| E2E | `scripts/e2e-full-coverage.spec.ts` with four isolated user contexts and authentication, workspace, enterprise, and panic-mode scenarios |

## Verification

`pnpm typecheck` completed successfully with **10/10 tasks**. `pnpm build` completed successfully with **8/8 tasks**. Playwright discovered **4 tests** in the new suite via `--list`.

The full browser suite was not truthfully reported as passed because the sandbox does not have Docker installed and the PostgreSQL, MinIO, Redis, and five application services were not running. The earlier smoke suite consequently returned connection failures. This is an environment limitation, not evidence that the complete runtime flow is correct.

## Remaining external or architectural work

The Whisper route is an integration boundary: it requires a running Whisper-compatible endpoint. The local LLM routes require LM Studio or another OpenAI-compatible endpoint. VAPID notifications require real keys and a persistent subscription store for production. SFU/LiveKit, WebAuthn/passkeys, double-ratchet cryptography, DLP/antimalware scanning, centralized immutable SIEM, and server-side emergency session revocation are not fully implemented by this patch and must not be advertised as complete until their backend, persistence, and security tests exist.

Before production deployment, set non-default secrets, run database migrations, configure TLS, supply JWT audience consistently, configure persistent push subscriptions, and execute the complete Playwright suite against the Compose stack in an environment with Docker.

## Latest hardening pass

- Added author-only message edit and soft delete with content purge.
- Added typed realtime events for edited, deleted, and typing messages.
- Added channel-membership enforcement and 300ms typing throttle on WebSocket input.
- Added client-side realtime store handling for edited/deleted/typing events.
- Added typed API client methods for edit/delete.
- Added Profile & Preferences panel with secure sign-out and local preference storage.
- Moved dependency override to `pnpm-workspace.yaml` and removed the deprecated package-level setting.
- Latest evidence: typecheck 10/10, build 8/8, JWT proof 4/4, Redis workspace isolation PASS, static audit PASS, git diff --check PASS.
