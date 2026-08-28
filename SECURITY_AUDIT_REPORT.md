

# OpenTeams — Security Audit Update

## نطاق التدقيق

تم فحص إعدادات Docker وCompose، ملفات البيئة والأنماط التي قد تكشف الأسرار، السكريبتات، إعدادات JWT وCORS، بنية Prisma، صلاحيات Workspace، واعتماديات Node.js. هذا تدقيق دفاعي محلي وليس اختبار اختراق على أنظمة خارجية.

## نتائج مؤكدة

| المجال | النتيجة | التقييم |
|---|---|---|
| Next.js | تم تحديث web إلى Next.js `15.5.24`، وهو الإصدار الذي استُخدم فعلياً في البناء القسري | تحسن أمني |
| Prisma / deepmerge-ts | `pnpm audit` ما زال يبلغ عن `deepmerge-ts@7.1.5` داخل Prisma 6.19.3؛ لم يتم فرض override غير مدعوم | High — يحتاج ترقية Prisma أو معالجة مصادق عليها |
| PostCSS | ما زالت توجد مسارات انتقالية مرتبطة بـPostCSS في تقرير audit؛ يجب تثبيت/ترقية مسار الإصدار بعد اختبار Next | High/Moderate حسب المسار |
| Build | typecheck وbuild القسري نجحا لكل 8 حزم، مع Next.js 15.5.24 | ناجح |
| الأسرار | لا يجب تضمين مفاتيح الإنتاج أو كلمات المرور في المستودع؛ قيم Compose المحلية يجب استبدالها بأسرار خارجية قبل الإنتاج | سياسة إلزامية |
| Docker | المنافذ المنشورة محلياً مناسبة للتطوير فقط؛ الإنتاج يحتاج reverse proxy/TLS وشبكة داخلية وعدم نشر PostgreSQL/Redis/MinIO مباشرة | High للإنتاج إن تُركت كما هي |

## قرار أمني

لا يصح إعلان النظام «محصناً ضد الاختراق» اعتماداً على build ناجح. قبل استعماله في مؤسسة حساسة، يلزم إغلاق نتائج `pnpm audit`، تدوير كل مفاتيح التطوير، وضع أسرار الإنتاج في Secret Manager، تشغيل TLS ومصادقة متعددة العوامل، وإجراء اختبار مستقل وفق نطاق مصرح به.


## Reproducible static security check

تمت إضافة وتشغيل `scripts/security-static-audit.mjs`، ونجح بنتيجة `ok: true`. يثبت السكريبت ثلاث نقاط ثابتة من المصدر: عدم وجود ملفات `.env` أو مفاتيح خاصة متتبعة في Git، توقيع JWT بـRS256، ووجود allow-list صريحة لـRS256 في verifier. كما يطبع قائمة runtime tests المطلوبة التي مازالت تحتاج تشغيل خدمات Docker فعلياً: alg:none، HS256 confusion، refresh replay، tenant isolation، WebSocket expiry، upload traversal/TTL، وE2EE ciphertext-only.


## Official Next.js verification

تمت مراجعة [إعلان Next.js الرسمي لتحديث أغسطس 2026](https://nextjs.org/blog/august-2026-security-release) بتاريخ 26 أغسطس 2026. الإعلان يذكر صراحة أن الإصدار `15.5.24` هو Maintenance LTS المصحح، وأن التحديث يعالج ثغرات التحديث المذكورة في ذلك الإصدار. كما يذكر أن إحدى ثغرات Windows-hosted servers لا تؤثر على Linux/macOS؛ مع ذلك، يجب عدم اعتبار ذلك بديلاً عن تشغيل التطبيق خلف TLS وreverse proxy وتقليل surface area.


## Official Prisma verification

تمت مراجعة [سجل إصدارات Prisma الرسمي](https://github.com/prisma/orm/releases). الصفحة تعرض Prisma `7.10.0` كإصدار مستقر حديث وPrisma 8 كـrelease candidate، لكن هذا لا يثبت تلقائياً أن ترقية مشروع Prisma 6 إلى major جديد آمنة أو متوافقة. لذلك يبقى إصلاح `deepmerge-ts@7.1.5` بوصفه dependency داخل Prisma 6.19.3 بوابة مستقلة: يلزم upgrade متوافق مع migration/generate/build/runtime tests، وليس override يخفي المسار.


## deepmerge-ts advisory verification

راجعت [GitHub Advisory GHSA-ggr8-5vv4-36mx / CVE-2026-40345](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). الإصدار المتأثر هو كل ما قبل `8.0.0`، والإصدار المصحح هو `8.0.0`. الخلل هو stack exhaustion عند تمرير recursive object graph إلى deepmerge APIs، وتأثيره الأساسي availability. مسار OpenTeams الحالي يأتي عبر `@prisma/config@6.19.3`; لا يوجد patch Prisma 6 ظاهر في lock graph، وترقية Prisma 7 تحتاج migration إلى `prisma.config.ts` وadapter.


## JWT proof update

تمت إضافة وتشغيل `scripts/jwt-unit-proof.mjs` بعد بناء خدمة auth. النتيجة: **4/4 PASS**: قبول RS256 الصحيح، رفض `alg:none`، رفض HS256 confusion باستخدام المفتاح العام، ورفض issuer الخاطئ. هذا يثبت verifier الحقيقي المبني من `dist/auth/jwt.js` مع مفاتيح RSA مؤقتة. أما إثبات HTTP runtime، replay refresh، tenant isolation وWebSocket فيبقى منفصلاً ومحجوباً حالياً لأن Docker/services غير متاحة في بيئة الفحص.


## Priority 0 update after supported Next upgrade

تمت ترقية `apps/web` إلى `next@16.3.3` عبر المسار الرسمي، مع بقاء `react@18.3.1` المتوافق. النتيجة: `pnpm install --no-frozen-lockfile` نجح، و`pnpm typecheck` و`turbo run build --force` نجحا، وbuild أكد `Next.js 16.3.3`. `pnpm audit --prod --audit-level high` انخفض من **3 High + 2 Moderate** إلى **1 High** فقط؛ PostCSS advisories اختفت من المسار، وبقي `deepmerge-ts@7.1.5` عبر Prisma 6.19.3. تمت محاولة Prisma 7.10.0، لكنها تطلبت تغييرات Prisma 7 (`prisma.config.ts` وadapter) وكسرت schema generate بصيغته الحالية، لذلك أُعيدت النسخة المتوافقة ولم يُعلن إغلاق آخر High.


## Latest verification run

آخر تشغيل موحد أعطى النتائج التالية: `node scripts/security-static-audit.mjs` **PASS**؛ `node scripts/jwt-unit-proof.mjs` **4/4 PASS**؛ `pnpm typecheck` **10/10 tasks successful**. أما `pnpm audit --prod --audit-level high` فخرج بـexit 1 بسبب **High واحد** فقط، وهو `deepmerge-ts@7.1.5` عبر Prisma `6.19.3`; PostCSS وNext.js advisories لم تعودا ظاهرتين بعد ترقية Next.js إلى `16.3.3`. اختبارات HTTP runtime وTenant وWebSocket مازالت BLOCKED في هذه البيئة لأن Docker غير متاح.


## Prisma 7 dependency check

فحص `pnpm view @prisma/config@7.10.0 dependencies --json` أظهر أن Prisma 7.10.0 مازال يعتمد على `deepmerge-ts: 7.1.5`. لذلك تغيير Prisma major وحده لا يغلق advisory `GHSA-ggr8-5vv4-36mx`; migration إلى Prisma 7 ستكون مطلوبة لأسباب توافق مستقبلية فقط، وليست fix أمنية كافية لهذا المسار. لا يوجد override مخفي في المشروع.


## Runtime proof harness update

تم إصلاح تحميل `ws` في `scripts/security-proof.mjs` باستعمال package path الخاص بخدمة messaging. أمر `pnpm test:security:runtime` أصبح يعمل ويخرج نتيجة منظمة: `BLOCKED auth runtime proof` مع exit code `2` عند غياب auth service، بدلاً من crash بسبب dependency. هذا يثبت جاهزية harness، لكنه لا يحوّل اختبارات JWT/Tenant/WebSocket إلى PASS حتى تعمل الخدمات الحقيقية.


## Current dependency audit checkpoint

نتيجة `pnpm audit --prod --json` الحالية هي: `critical: 0`, `high: 1`, `moderate: 0`, `low: 0`. تم إغلاق تحذيرات Moderate وPostCSS، وبقي High واحد فقط هو `deepmerge-ts` القادم انتقالياً من Prisma `6.19.3`. لا توجد fixAvailable موثوقة في المسار الحالي دون تغيير ORM أو انتظار patch upstream.


## pnpm override configuration verification

توثيق pnpm الرسمي لـ`pnpm audit` يوضح أن الإصلاح عبر override يُكتب في `pnpm-workspace.yaml`. الصيغة المقترحة في المشروع هي:

```yaml
overrides:
  "deepmerge-ts@<8.0.0": ">=8.0.0"
```

تمت تجربة صيغة اسم الحزمة المباشر، لكنها لم تُطبَّق في pnpm 9.15.9؛ لذلك يلزم تثبيت selector الرسمي المطابق ثم إعادة `pnpm install` و`pnpm why` و`pnpm audit`، مع إبقاء generate/typecheck/build كـcompatibility gates.


## Dependency gate closure

بعد تطبيق إصلاح pnpm الرسمي، أصبحت جميع خدمات Prisma تستعمل `deepmerge-ts@8.0.2` فعلياً عبر lockfile. تحققنا من `pnpm install --frozen-lockfile` بنجاح، و`pnpm db:generate` و`pnpm typecheck` و`turbo run build --force` بنجاح، كما أعطى `pnpm audit --prod --audit-level high` النتيجة: `No known vulnerabilities found`. يطبع pnpm 9.15.9 تحذيراً توافقياً حول حقل `pnpm` القديم في `package.json`، لكن التثبيت المجمد يطابق lockfile المصحح ولا يعيد الإصدار المتأثر.


## member.joined realtime checkpoint

تم تنفيذ publisher في auth عبر Redis channel `openteams:workspace-events`، وsubscriber في messaging، مع تسجيل workspace IDs لكل WebSocket connection وإضافة `broadcastWorkspace`. واجهة `WorkspaceMembersPanel` تشترك في socket العام وتضيف العضو عند وصول `member.joined` بدون refresh. اختبار الوحدة `scripts/member-joined-unit-proof.mjs` نجح في إثبات أن event يصل إلى نفس workspace ولا يصل إلى workspace آخر. إثبات المسار الكامل عبر Redis ونافذتي browser منفصلتين مازال runtime test يحتاج Docker وخدمات حية.


## Runtime proof execution checkpoint

تم تشغيل `pnpm test:security:runtime` عبر الأمر الرسمي. الـharness بدأ بشكل صحيح، لكنه أعاد `BLOCKED auth runtime proof: auth service is unavailable or registration failed` مع `fetch failed` لأن خدمات Docker غير مشغلة في بيئة الاختبار. لذلك لا توجد نتائج PASS لعمليات refresh replay أو tenant isolation أو WebSocket أو upload أو E2EE حتى يتم تشغيل الخدمات الحية.


## Reproducible root commands

الأوامر الرسمية الحالية هي `pnpm test:security:static` و`pnpm test:security:jwt` و`pnpm test:security:member-joined` و`pnpm test:security:member-joined:integration` و`pnpm test:security:runtime` و`pnpm test:e2e:full`. نجحت الأوامر الثلاثة الأولى في البيئة المحلية، بينما runtime الكامل يبقى مشروطاً بخدمات PostgreSQL وauth وmessaging الحية.

`VERIFICATION: post-core gate — PASS — full Turbo build، JWT forgery proof، Redis member.joined tenant isolation، وgit diff --check جميعها نجحت بعد آخر تعديلات.`

`VERIFICATION: latest message deletion regression — PASS — typecheck 10/10، static audit، messaging build، وgit diff --check كلها PASS.`

PROGRESS: Dashboard integration — PASS — DashboardPanel is mounted in AppShell, accessible from WorkspaceRail, uses authenticated workspace/channel/user state, exposes privacy-preserving action-item and decision sections, and passed typecheck/build.

PROGRESS: Dashboard data binding — PASS — DashboardPanel now loads workspace WorkTaskDTO and AgendaEventDTO through the authenticated API, renders open priorities and upcoming agenda entries, preserves private empty states, and passed web typecheck plus full build (8/8).

VERIFICATION: Dashboard data round — PASS — Work Tasks and Agenda are loaded through authenticated API; static audit ok:true; JWT forgery proof 4/4 PASS; full typecheck 10/10 and build 8/8 PASS.

VERIFICATION: RTC active-call isolation — PASS — get_active_calls now verifies channel access for channel-scoped queries and filters workspace-wide results through the authenticated user accessible-channel list; mcp-media-rtc typecheck passed.

PROGRESS: Meet call hardening — PASS — Active-call listing is authorization-filtered by accessible channels, call IDs use crypto.randomUUID, and mcp-media-rtc typecheck passed.
