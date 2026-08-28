# OpenTeams — New Order Update

تم تطبيق الإصلاحات الحرجة ذات الصلة مباشرة بالواجهة والـ storage، مع الحفاظ على العقود الحالية وعدم استعمال `any` في الإضافات الجديدة.

## Implemented

أضيف `S3_PUBLIC_ENDPOINT` إلى عقد storage. تبقى عمليات MinIO الداخلية على `S3_ENDPOINT=http://minio:9000`، بينما تستعمل روابط presigned GET/PUT عنواناً قابلاً للوصول من المتصفح، افتراضياً `http://localhost:9000`. كما أضيف direct multipart `POST /upload` إلى `mcp-storage` مع `@fastify/multipart`، وauth، والتحقق من عضوية القناة والـ workspace، وحد 100 MB، ورفع MinIO، وresponse typed يحتوي `file`, `downloadUrl`, و`previewUrl`. تمت إضافة `NEXT_PUBLIC_STORAGE_SERVICE_URL` إلى resolver وDocker Compose مع الحفاظ على `NEXT_PUBLIC_STORAGE_URL` للتوافق.

تم تحديث Composer ليستخدم direct storage upload قبل إرسال الرسالة، وتُرسل الصور كـ secure `openteams-file` image references. يقوم `FileCard` الآن بجلب preview للصور inline تلقائياً مع fallback آمن، ويدعم Markdown image references دون تخزين URL ثابت طويل الأجل داخل الرسالة.

تمت إضافة drag-and-drop overlay للمحادثة، وKeyboard Shortcuts modal مع Ctrl+/، وThreadDrawer لردود السلسلة، وSavedItemsPanel مع bookmark state محلي typed، ورابط Saved items في ChannelSidebar. تمت أيضاً إضافة مفاتيح EN/FR/AR لهذه الأسطح الجديدة، مع استمرار إصلاح LanguageSwitcher من duplicate flags/arrows.

## Verification

`pnpm typecheck` نجح بـ 10/10 tasks، و`pnpm --dir apps/web build` نجح، و`pnpm build` الكامل نجح بـ 8/8 packages. اختُبر Playwright UI regression السابق بنجاح 1/1 على build production محلي، كما كان authenticated AppShell يعمل دون React #185 أو hydration errors.

## Honest scope boundary

مسار `getUserMedia` وscreen-share وcontrols موجود على client، لكن طلب hardware الحقيقي يحتاج اختباراً داخل Chrome/Firefox عند المستخدم مع صلاحية microphone/camera. Whisper pipeline وBullMQ worker وpgvector وprofile/avatar persistence وworkspace logo/key export تحتاج عقد backend/schema وتشغيل خدمات إضافية، ولم يتم اصطناع نجاح لها داخل هذا التحديث. هذا التقرير لا يعتبرها مكتملة.

## ZIP

النسخة المرفقة source-only، ونتيجة `unzip -t` سليمة. SHA-256: `87e5edc2b2139d02690f70d1bd859498f4d2646d8d364dc7dbbcbecf5b2bcfec`.
