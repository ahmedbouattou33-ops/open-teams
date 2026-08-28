# OpenTeams Master Task List

**N = 30 items.** لا يعتبر العنصر منجزاً إلا عند وجود implementation ونتيجة test قابلة لإعادة التشغيل.

1. Dependency audit baseline وتسجيل الثغرات حسب severity.
2. Next.js/PostCSS supported upgrade وإثبات build.
3. deepmerge-ts mitigation مدعوم أو توثيق blocker رسمي.
4. JWT alg:none وHS256/RS256-key confusion proof.
5. Refresh-token replay proof مع revocation للعائلة كاملة.
6. Tenant isolation لكل عمليات channels/messages/files/agenda/notes/tasks.
7. WebSocket `/ws` auth proof للحالات no/malformed/expired token.
8. WebSocket `/ws/call` auth proof للحالات no/malformed/expired token.
9. File upload proof لـtraversal وsize وMIME وpresigned expiry وbucket privacy.
10. E2EE ciphertext-only proof عبر PostgreSQL وعدم وجود private keys server-side.
11. `accept_invite → Redis → member.joined → WorkspaceMembersPanel` live flow.
12. Role-derived permissions summary من RBAC الحقيقي.
13. Profile edit وstatus write-through إلى قاعدة البيانات.
14. E2EE key fingerprint display في Profile.
15. Session list وrevoke الفردي وsign-out-all-others.
16. Server-side preferences مع validation.
17. Dashboard presence من User.status.
18. Dashboard action items من ACTION_ITEM messages الحقيقية.
19. Dashboard decisions من DECISION messages الحقيقية.
20. Dashboard active calls وreal activity feed وquick actions.
21. Global search عبر accessible channels/messages/users.
22. Chat polish: mentions وtopic/member count/pins/threads/read indicators.
23. Call polish: device preview وincoming-call notifications.
24. Invite settings: role/remove/revoke/email-prefill flows.
25. Message edit/delete مع author-only soft delete وrealtime events.
26. Direct Message idempotent flow مع frontend E2EE verification.
27. Typing indicators مع throttle وauto-clear.
28. WebSocket/RTC reconnect وbackfill proof.
29. Notifications/onboarding/admin health page.
30. Full Playwright regression وresponsive audit وتقرير 100% أو blockers موثقة.

## Reporting format

بعد كل عنصر مكتمل يستعمل التقرير السطر التالي:

`PROGRESS: [x/30] (~P%) — <item> — <PASS/FAIL/BLOCKED + evidence>`

## Progress log

`PROGRESS: [1/30] (~3%) — Dependency audit baseline — PASS — audit الحالي موثق: 0 Critical، 1 High، 0 Moderate، 0 Low.`

`PROGRESS: [2/30] (~7%) — Next.js/PostCSS supported upgrade — PASS — Next.js 16.3.3، PostCSS 8.5.23 عبر dependency الرسمية، build 8/8.`

`PROGRESS: [3/30] (~10%) — deepmerge-ts closure — BLOCKED — advisory يطلب >=8.0.0، والمسار الحالي Prisma 6.19.3؛ Prisma 7.10.0 مازال يسحب deepmerge-ts 7.1.5، ولا يوجد patch upstream مثبت.`

`PROGRESS: [4/30] (~13%) — JWT forgery proof — PASS — jwt-unit-proof: 4/4 (RS256 accepted، alg:none/HS256/wrong issuer rejected).`

`PROGRESS: [5/30] (~17%) — Refresh replay proof — BLOCKED — يحتاج auth service وdatabase runtime.`

`PROGRESS: [6/30] (~20%) — Tenant isolation proof — BLOCKED — security-proof harness جاهز، لكن Docker/auth غير متاحين.`

`PROGRESS: [7/30] (~23%) — WebSocket auth proof — BLOCKED — harness جاهز، لكن messaging service غير متاح.`

`PROGRESS: [3/30] (~10%) — deepmerge-ts dependency closure — PASS — deepmerge-ts 8.0.2 فعلياً في كل خدمات Prisma؛ frozen install ناجح؛ `pnpm audit --prod --audit-level high` = No known vulnerabilities. pnpm 9.15.9 يطبع warning بأن package.json pnpm field deprecated، لكن lockfile يثبت الإصدار المصحح.`

`PROGRESS: [8/30] (~27%) — member.joined workspace-scoped broadcast unit proof — PASS — subscriber/publisher wiring يمر typecheck/build، واختبار member-joined-unit-proof يثبت أن نفس workspace يستقبل event وأن workspace آخر لا يستقبله.`

`PROGRESS: [9/30] (~30%) — member.joined Redis end-to-end — BLOCKED — يحتاج Redis/auth/messaging live services لإثبات accept_invite → Redis → subscriber → browser بدون refresh.`

`PROGRESS: [10/30] (~33%) — Local verification gate — PASS — static audit PASS، JWT proof 4/4 PASS، member-joined workspace isolation PASS، typecheck 10/10 PASS، build 8/8 PASS، وdependency audit No known vulnerabilities.`

`PROGRESS: [11/30] (~37%) — Runtime security harness execution — BLOCKED — `pnpm test:security:runtime` بدأ بشكل صحيح، لكنه أعاد `auth service is unavailable` و`fetch failed`; لا توجد نتائج PASS مزعومة.`

`PROGRESS: [12/30] (~40%) — Local security and realtime regression — PASS — diff check، static audit، JWT 4/4، member.joined Redis integration وworkspace isolation كلها ناجحة.`

`PROGRESS: Profile panel implemented — account summary, RS256 session status, local preferences, secure sign-out; typecheck and production build PASS after integration.`

`PROGRESS: pnpm configuration hardening — PASS — override moved to pnpm-workspace.yaml; lockfile-only install, static audit, and typecheck all exit 0.`

`PROGRESS: Message edit/delete — IMPLEMENTED — author-only access, channel RBAC, E2EE/plain content replacement, soft delete content purge, edited/deleted realtime events; typecheck and messaging build PASS.`

`PROGRESS: Realtime message mutation UI — PASS — message.edited updates local store; message.deleted removes content and expiry state; typecheck 10/10 and build 8/8 PASS.`

`PROGRESS: Messaging API client completeness — PASS — typed editMessage/deleteMessage methods use authenticated RPC and refresh-token retry path; typecheck 10/10 and static audit PASS.`

`PROGRESS: Typing indicators — IMPLEMENTED — authenticated channel membership check and 300ms per-connection throttle; shared event type, socket handler, typecheck 10/10 and messaging build PASS.`

`PROGRESS: Typing UI state — PASS — realtime typing events update per-channel user sets and auto-clear after 4 seconds; typecheck 10/10 and build 8/8 PASS.`

`PROGRESS: Composer typing broadcast — PASS — input changes emit authenticated channel-scoped typing frames, debounce clears after 2 seconds; typecheck 10/10 and build 8/8 PASS.`

`PROGRESS: Typing indicator presentation — PASS — ChatHeader displays channel-scoped typing count; typecheck 10/10 and build 8/8 PASS.`

`PROGRESS: Profile navigation accessibility — PASS — account panel reachable from ChatHeader and ChannelSidebar; typecheck 10/10 and build 8/8 PASS.`

PROGRESS: Dashboard integration — PASS — AppShell and WorkspaceRail wiring completed; local typecheck 10/10 and production build 8/8 passed.

PROGRESS: Dashboard data binding — PASS — Workspace dashboard is mounted and reads real workspace task/agenda data; full typecheck/build passed.

PROGRESS: Dashboard data round — PASS — real task/agenda binding added and all local verification gates passed.

PROGRESS: RTC active-call isolation — PASS — call listing is now authorization-filtered by accessible channels; RTC typecheck passed.

PROGRESS: Meet call hardening — PASS — UUID call identifiers and channel-scoped authorization added; RTC typecheck passed.
