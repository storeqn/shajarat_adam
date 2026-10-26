# حلويات شجرة آدم — Shajarat Adam Sweets

نسخة تأسيسية قيد التطوير، **ليست اكتمالاً لجميع المواصفات ولا جاهزة للإطلاق التجاري**.

## المنفذ
React/TypeScript، واجهة عربية متجاوبة، بحث ومفضلة وسلة محلية، خيارات وأسعار مستقلة، نافذة تفاصيل، إدارة منتجات وأقسام ومناطق توصيل وإعدادات وطلبات، رفع صورة رئيسية إلى R2، تخزين D1، إعادة تسعير الطلبات على الخادم، رسالة واتساب، معرف طلب فريد لمنع تكرار الإرسال، حساب إدارة بكلمة مرور PBKDF2 وجلسة HttpOnly/Secure وSameSite وحماية Origin وتحديد معدل الطلبات. المتجر مغلق افتراضياً ولا توجد أسعار أو منتجات وهمية.

## تحديث لوحة الإدارة — 26 أكتوبر 2026
أضيفت إمكانية تعديل اسم القسم وإخفائه وإظهاره، وتعديل اسم منطقة التوصيل وأجرتها وإخفائها، وإخفاء المنتجات وإظهارها دون حذف بياناتها. هذه التغييرات غير مختبرة ببناء إنتاجي بعد، ولا تعني جاهزية المتجر للإطلاق.\n\n## ما لم ينفذ بعد
مصمم الهدايا، تخصيص الكيك، الكوبونات والعروض المؤقتة، إدارة المخزون والحجز المتزامن، صور متعددة ومصغرات، حذف وترتيب الأقسام والمناطق (يتوفر الآن تعديل الاسم والإخفاء والإظهار)، الأدوار والصلاحيات، النسخ الاحتياطي والاستيراد، الفواتير وCSV، شرائح الرئيسية والمناسبات، SEO للمنتج على الخادم وروابط مستقلة وQR، PWA، فلاتر متقدمة وإعادة الطلب، اختبارات المتصفح والتكامل الكاملة وتحسين الوصول للنافذة. الأسعار المعروضة أولية لحين التحقق على الخادم؛ الطلب المبدئي لا يحجز المخزون. اعتماد الطلب لا يخصم المخزون حالياً. لا تفعّل الطلبات التجارية قبل استكمال ذلك.

## تشغيل محلي
Node 22.13+ (Node 24 موصى به).
```bash
npm ci
npm test
npm run build
npx wrangler d1 migrations apply shajarat-adam --local
npm run preview
```
`npm run dev` يشغّل الواجهة فقط؛ API يحتاج Pages dev بعد البناء. جلسة الإدارة Secure: استخدم HTTPS محلياً إذا لم يقبل المتصفح كوكي localhost:
```bash
npx wrangler pages dev dist --local-protocol https
```

## Cloudflare
```bash
npx wrangler login
npx wrangler d1 create shajarat-adam
npx wrangler r2 bucket create shajarat-adam-media
```
انسخ database_id الناتج إلى wrangler.toml مكان REPLACE_WITH_D1_ID. الربط DB لقاعدة D1 وMEDIA لحاوية R2؛ لا تضع مفاتيح في الواجهة. قد يتطلب تفعيل R2 إعداد فوترة حساب Cloudflare حتى ضمن الحدود المجانية.
```bash
npx wrangler d1 migrations apply shajarat-adam --remote
```

## إنشاء المدير الأول
لا توجد كلمة مرور افتراضية. في Bash اقرأ كلمة المرور سرياً، ثم أنشئ SQL مؤقتاً خارج المستودع (يتضمن تجزئة فقط):
```bash
read -s -p 'Admin password (14+ characters): ' ADMIN_PASSWORD
export ADMIN_PASSWORD
node scripts/admin.mjs owner@example.com > /tmp/shajarat-admin.sql
unset ADMIN_PASSWORD
npx wrangler d1 execute shajarat-adam --remote --file=/tmp/shajarat-admin.sql
rm /tmp/shajarat-admin.sql
```
للمحلي استبدل --remote بـ --local. افتح /admin. من الإعدادات ضع واتساب دولياً دون +، والعنوان والساعات؛ أضف أقساماً ومنتجات وأوزاناً بأسعارك الحقيقية. لا تفتح استقبال الطلبات قبل استكمال المتطلبات الناقصة.

## النشر
```bash
npm run build
npx wrangler pages project create shajarat-adam --production-branch main
npx wrangler pages deploy dist --project-name shajarat-adam
```
أو اربط مستودع storeqn/shajarat_adam بمشروع Pages؛ البناء npm run build والمخرج dist، واضبط DB وMEDIA للإنتاج والمعاينة. لا تستخدم GitHub Pages لأنه لا يشغل D1 وFunctions. المرجع: https://developers.cloudflare.com/pages/functions/bindings/

## التحديث
احتفظ بملف القفل. شغّل npm ci وnpm test وnpm run build، طبّق الترحيلات الجديدة ثم انشر. لا تعدّل الترحيلات المطبقة؛ أضف ترحيلاً جديداً. احفظ نسخة D1 قبل التغييرات الإنتاجية.

## حدود الأمان والتحقق
الصور محدودة 5MB وفحص توقيع JPEG/PNG/WebP؛ يلزم إضافة إعادة ترميز وفحص صور قبل الإطلاق. لا توجد صلاحيات متعددة أو تدقيق أمني مستقل. حد تسجيل الدخول الحالي 30 طلباً/دقيقة/IP، ويجب تقويته حسب الحمل. الطلب يحتفظ بلقطة السعر ولا تُكشف بيانات العملاء إلا للإدارة. فتح واتساب لا يغيّر الحالة ولا يمسح السلة.
