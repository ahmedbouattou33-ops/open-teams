## 2026-08-28 feature pass

- `pnpm --dir apps/web build` completed successfully on Next.js 16.3.3.
- A production server from the new build was started on `127.0.0.1:3010`; `/register` returned HTTP 200 and rendered without the error boundary.
- A synthetic non-sensitive authenticated session loaded `/` and rendered AppShell without React #185 or hydration errors.
- The rendered UI exposed the new Bold/Italic/Inline Code/Code Block/Bullet List/Record voice note controls, Summarize-ready header surface, and real status/unread-capable shell.
- LanguageSwitcher after selecting French displayed one flag and one visible ChevronDown; browser console returned no errors.
- The local authenticated smoke uses a synthetic token only and does not prove a live backend auth session.

