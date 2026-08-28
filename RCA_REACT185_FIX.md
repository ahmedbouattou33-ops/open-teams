# OpenTeams React #185 Runtime RCA and Fix

## Executive finding

The inherited failure was a **frontend runtime failure in `apps/web`**, not a Fastify, Prisma, JWT, CORS, WebSocket, WebRTC, storage, or Whisper failure. The affected code path was the always-mounted `AddMemberModal` component, specifically its Zustand selector in `apps/web/src/components/AddMemberModal.tsx`.

The selector returned a newly allocated empty array whenever there was no active workspace:

```tsx
const channels = useWorkspaceStore((s) =>
  workspaceId ? s.channelsByWorkspace[workspaceId] ?? [] : [],
);
```

Because the fallback literal `[]` has a new identity on every snapshot read, the external-store selection was not referentially stable. React can repeatedly observe a different selected snapshot and re-render until it raises **maximum update depth exceeded** (minified React error #185). The modal was rendered by `AppShell` even when closed, so the bug could occur before the user interacted with the Add Member UI.

## Exact origin

| Item | Finding |
|---|---|
| Origin service | `apps/web` |
| Responsible file | `apps/web/src/components/AddMemberModal.tsx` |
| Responsible statement | The `useWorkspaceStore` selector that used `?? []` and `: []` |
| Failure class | Unstable Zustand external-store selector result causing a React render loop |
| Not the cause | `mcp-auth-workspace`, `mcp-messaging`, `mcp-media-rtc`, `mcp-storage`, Prisma, JWT, CORS, or WebSocket signaling |

The same unstable fallback pattern was also corrected defensively in `apps/web/src/components/UsersDirectory.tsx`, where the presence selector used a fresh `{}`. That route is not the primary root path, but it could reproduce the same class of error when mounted.

## Minimal production fix

A module-level typed constant now provides a stable fallback identity:

```tsx
import type { ChannelDTO } from "@openteams/shared-types";

type Role = "ADMIN" | "MEMBER" | "GUEST";
const EMPTY_CHANNELS: readonly ChannelDTO[] = [];

const channels = useWorkspaceStore((s) =>
  workspaceId
    ? s.channelsByWorkspace[workspaceId] ?? EMPTY_CHANNELS
    : EMPTY_CHANNELS,
);
```

The analogous presence selector now uses:

```tsx
const EMPTY_PRESENCE: Readonly<Record<string, string>> = {};

const presence = useUiStore((s) =>
  workspaceId
    ? s.presenceByWorkspace[workspaceId] ?? EMPTY_PRESENCE
    : EMPTY_PRESENCE,
);
```

This keeps the frontend decoupled from backend services and preserves strict typing through `ChannelDTO` and a readonly presence record. No shared protocol, MCP contract, service endpoint, JWT implementation, or WebSocket event was changed for this fix.

## Provider boundary correction

The root layout now remains a Server Component and delegates client-only providers to `apps/web/src/app/providers.tsx`:

```tsx
// apps/web/src/app/providers.tsx
"use client";

import type { ReactNode } from "react";
import PushRegistration from "@/components/PushRegistration";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <PushRegistration />
        {children}
      </LanguageProvider>
    </ThemeProvider>
  );
}
```

`apps/web/src/app/layout.tsx` now mounts `<Providers>{children}</Providers>` and retains `suppressHydrationWarning` for the client-controlled theme and direction attributes. Interactive components inspected in the affected path, including `AddMemberModal`, `ThemeToggle`, `Composer`, `MessageList`, `PushRegistration`, `ThemeProvider`, and `LanguageProvider`, have a top-level `"use client"` directive.

## Regression coverage and verification

A Playwright regression test was added to `scripts/e2e-full-coverage.spec.ts`. It visits `/register` and `/login`, rejects the Next error screen, and fails on page errors matching maximum update depth, invalid hook calls, or hydration errors.

The following checks were executed in the sandbox:

| Check | Result |
|---|---|
| `pnpm --dir apps/web typecheck` | Passed |
| `pnpm --dir apps/web build` | Passed; Next compiled, typechecked, generated 8 static pages, and exited 0 |
| Full workspace `pnpm typecheck` | Passed; 10 tasks successful across web, shared types, and services |
| Playwright public-route regression | Passed; 1 test passed in 4.2 seconds |
| Browser `/register` smoke test | Passed; registration form rendered without error boundary |
| Browser `/login` smoke test | Passed; login form rendered without error boundary |
| Authenticated synthetic `/` smoke test | Passed; full AppShell rendered without `This page couldn’t load` or React #185 |
| Browser console after AppShell mount | No React #185, hydration error, or runtime exception; only normal React DevTools/HMR messages |

The first production-server start attempt reported `EADDRINUSE` because port 3000 already had a Next server listening. This is an environment/process collision, not an application defect. The existing server was then used for HTTP and browser smoke tests.

## Verification commands

From the repository root:

```bash
pnpm typecheck
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
pnpm exec playwright install chromium
pnpm exec playwright test scripts/e2e-full-coverage.spec.ts --grep "public routes render without client runtime errors" --reporter=line
```

For a clean local production smoke test, stop any process already using port 3000, then run:

```bash
pnpm --dir apps/web start
```

In another terminal, verify the rendered routes:

```bash
curl -I http://127.0.0.1:3000/register
curl -I http://127.0.0.1:3000/login
```

For Docker on Windows PowerShell, use the project directory first and keep Docker Desktop running:

```powershell
cd "C:\Users\Bsi\Downloads\open-teams-final-latest\open-teams"
docker compose up -d --build
docker compose ps
```

Then browse to `http://localhost:3000`, not `127.0.0.1:3000`, unless the CORS allowlist has explicitly been expanded to include both origins. Do not use a wildcard origin with credentials.

## Remaining limitation

The original user-provided browser screenshot contained the minified React #185 message, but no raw component stack trace was supplied. The exact origin above is established from the source-path audit plus successful authenticated AppShell reproduction after replacing the unstable selector. Backend health is therefore not being used as proof of frontend correctness; the browser smoke and Playwright results are the relevant runtime evidence.
