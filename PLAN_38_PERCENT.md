# OpenTeams — خطة إغلاق الـ38% المتبقية

## الهدف

الوصول إلى نسخة قابلة للتحقق، وليس مجرد اكتمال واجهات. لا تُرفع النسبة إلا عند وجود كود + اختبار قابل لإعادة التشغيل + نتيجة مسجلة.

## المسار الحرج

| الأولوية | العمل | معيار الإغلاق | الوضع |
|---|---|---|---|
| P0 | Dependency vulnerabilities | `pnpm audit --prod --audit-level high` بلا High/Critical، مع build/typecheck | قيد التنفيذ؛ 3 High و2 Moderate مازالت ظاهرة |
| P1 | JWT proof | رفض alg:none وHS256 عبر HTTP الحقيقي، وقبول RS256 الصحيح | السكريبت موجود؛ runtime blocked بدون Docker |
| P1 | Tenant proof | Workspace A لا يقرأ أو يكتب بيانات B في كل العمليات | harness مضاف؛ runtime blocked |
| P1 | WebSocket proof | no token/malformed/expired مرفوضة في `/ws` و`/ws/call` | harness جزئي؛ `/ws/call` يحتاج endpoint حقيقي مطابق للخدمة |
| P1 | Storage/E2EE proof | traversal/size/MIME/TTL/bucket policy وciphertext-only مثبتة | لم يُشغّل runtime بعد |
| P2 | member.joined | Redis publish → messaging subscribe → client update بلا refresh خلال 2s | type موجود؛ wiring end-to-end ناقص |
| P3 | Profile/Settings | edit/status/fingerprint/sessions/revoke/preferences/RBAC UI | ناقص بدرجة كبيرة |
| P3 | Dashboard | presence/action items/decisions/calls/search/notifications/quick actions حقيقية | ناقص بدرجة كبيرة |
| P3 | Chat/Call | mentions/pins/threads/read avatars/device preview/incoming calls | جزئي |
| P4 | Regression | كل suite القديمة والجديدة خضراء بلا console errors | لم يُشغّل على Docker |

## خطة التنفيذ السريعة

### المرحلة الأولى: إغلاق الأمن والاعتماديات

يُعاد تثبيت نسخة Prisma متوافقة فقط بعد اختبار migration وgenerate وbuild. لا يُستعمل `pnpm.overrides` لإخفاء `deepmerge-ts`. إذا لم يوجد patch متوافق داخل Prisma 6، تُختبر ترقية Prisma 7 في branch منفصل، مع `db:generate`, `db:push` على قاعدة اختبار، typecheck، build، وsmoke test. PostCSS يُتتبع إلى Next.js ويُحل عبر إصدار Next مدعوم أو patch رسمي، لا عبر lockfile يدوي مخفي.

بعدها يُشغّل `scripts/security-proof.mjs` مع Docker حي. يُنشأ مستخدمان وWorkspaceان وقناة لكل Workspace، ثم تُحفظ كل نتيجة في JSON/Markdown. أي فشل High يوقف الانتقال للواجهة.

### المرحلة الثانية: Realtime وTeam

تُستخدم Redis Pub/Sub كقناة بين auth-workspace وmessaging. حدث `member.joined` يجب أن يحمل workspaceId وuserId وrole وdisplayName، ويُرسل عبر قناة داخلية موثقة. خدمة messaging تتحقق من مصدر الحدث وتعيد بثه فقط إلى عملاء workspace المعني. الواجهة تستمع للحدث وتعيد تحميل `list_workspace_members` من MCP، وليس من localStorage.

### المرحلة الثالثة: Profile وDashboard

تُضاف أدوات حقيقية للـprofile/session/preferences إذا لم تكن موجودة: update profile، list sessions، revoke session، revoke other sessions، update status، get preferences، update preferences. كل لوحة تعرض skeleton عند التحميل، toast + retry عند الخطأ، وempty state عند عدم وجود بيانات.

Dashboard يستعمل real data: presence من User.status، action items من رسائل ACTION_ITEM المعينة للمستخدم، decisions من رسائل DECISION، calls من `get_active_calls`، والبحث من endpoint مقيّد بالـWorkspace membership.

### المرحلة الرابعة: Chat/Call وInvite settings

تُستكمل واجهة إدارة الأعضاء: تغيير role، remove/leave، revoke invite، وقبول invite للمستخدم غير المسجل مع email prefill. Chat يستعمل أدوات upload/reaction/thread/read/mention الحقيقية. Call يستعمل signaling الموجود مع preview وmedia-state وtimer وincoming notification.

### المرحلة الخامسة: التحقق النهائي

يُشغّل بالترتيب:

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm build
pnpm audit --prod --audit-level high
node scripts/security-static-audit.mjs
node scripts/security-proof.mjs
pnpm test:e2e:full
node scripts/e2e-browser.mjs
```

ثم يُراجع كل screen على viewport desktop وmobile، ويُحفظ output كامل. لا تُعلن نسبة 100% إذا كان Docker أو E2E غير متاح؛ حينها تُعرض الحالة `BLOCKED` مع سببها.

## معادلة النسبة

النسبة النهائية تُحسب من سبع مجموعات موزونة: Security 25%، Auth/RBAC 15%، Team/Invite 15%، Dashboard/Profile 15%، Chat/Call/Files 15%، Agenda/Notes/WorkPlan 5%، Testing/Operations 10%. كل مجموعة تأخذ درجة code + runtime proof، ولا تكفي علامة build وحدها.

## النتيجة المتوقعة

أسرع طريق واقعي هو تثبيت Priority 0 وPriority 1 أولاً، لأنهما gate. بعد تشغيل Docker على PC، يمكن تحويل الـblocked tests إلى Pass أو Fail حقيقيين، ثم إكمال Profile/Dashboard وrealtime وfull Playwright. أي estimate زمني يبقى مشروطاً بتوفر Docker وPostgreSQL وRedis وMinIO وبيانات اختبار نظيفة.
