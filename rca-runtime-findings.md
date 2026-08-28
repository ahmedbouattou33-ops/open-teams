# Runtime findings

- `pnpm --dir apps/web build` completed successfully with exit code 0.
- A production `next start -p 3000` attempt could not bind because port 3000 was already occupied by an existing Next server process.
- Browser smoke test at `http://127.0.0.1:3000/register` rendered the registration form without an error boundary.
- Browser navigation to `http://127.0.0.1:3000/` redirected to `/login` because the browser context had no authenticated session; `/login` rendered normally.
- No new server stack trace or React #185 was emitted by the tested public routes.
- The strongest static root-cause candidate remains the mounted `AddMemberModal` selector: `useWorkspaceStore((s) => workspaceId ? s.channelsByWorkspace[workspaceId] ?? [] : [])`, which returned a fresh array on each snapshot while the modal was mounted even when closed. This was replaced with a module-level stable `EMPTY_CHANNELS` constant. `UsersDirectory` received the analogous stable `EMPTY_PRESENCE` fix.
- A client `apps/web/src/app/providers.tsx` boundary was added and `layout.tsx` now mounts `<Providers>{children}</Providers>`.

- Authenticated browser smoke test using a synthetic local persisted session rendered the full `AppShell` at `/` without `This page couldn’t load`, React #185, or a blank error boundary. The UI showed the workspace rail, channel sidebar, header actions, composer, and PANIC control.
