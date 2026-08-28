# OpenTeams — Docker runtime verification on Windows PowerShell

## 1. Start Docker Desktop

افتح Docker Desktop وانتظر حتى يظهر Docker Engine بحالة Running. لا تبدأ الاختبارات قبل نجاح الأمرين التاليين:

```powershell
docker version
docker compose version
```

يجب أن يظهر قسما Client وServer في `docker version`.

## 2. Open the project

```powershell
cd "C:\Users\Bsi\Downloads\open-teams-final\open-teams"
```

استعمل مسار المجلد الذي يحتوي `docker-compose.yml` فعلياً.

## 3. Start the stack

```powershell
docker compose down --remove-orphans
docker compose up --build -d
docker compose ps
```

انتظر حتى تكون PostgreSQL وRedis وMinIO والخدمات الخمس في حالة `Up`، ويفضل أن تكون healthchecks في حالة `healthy`.

## 4. Run local gates

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm test:security:static
pnpm test:security:jwt
pnpm test:security:member-joined
pnpm test:security:member-joined:integration
pnpm test:security:runtime
pnpm test:e2e:full
```

## 5. If a service is unhealthy

```powershell
docker compose ps
docker compose logs --tail=200 auth
docker compose logs --tail=200 messaging
docker compose logs --tail=200 postgres
docker compose logs --tail=200 redis
docker compose logs --tail=200 storage
```

لا تستعمل `--no-verify` ولا تتجاهل نتيجة `BLOCKED` أو `FAIL`. أرسل مخرجات الأمر الفاشل كاملة حتى يتم إصلاح السبب.

## 6. Browser checks

افتح `http://localhost:8080` على PC. أنشئ User A في Chrome وUser B في Firefox أو نافذة Private مختلفة. تحقق من أن logout من أحدهما لا يمسح Workspace الآخر، وأن User A يرى member.joined خلال ثانيتين بعد قبول User B للدعوة.

## 7. Mobile on local IP

استخرج IP الجهاز:

```powershell
ipconfig
```

استعمل IPv4 الخاص بالشبكة المحلية، مثلاً `192.168.1.25`, ثم افتح من الهاتف:

```text
http://192.168.1.25:8080
```

إذا لم يفتح الرابط، اسمح للمنفذ 8080 في Windows Firewall وتأكد أن الهاتف والـPC في نفس الشبكة.
