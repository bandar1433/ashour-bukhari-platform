# حلقات عاشور بخاري — نسخة Vercel/Neon المستقلة

هذه الحزمة تحول الواجهة إلى Vite/React مستقل، وتستبدل `@appdeploy/client` بعميل محلي يعتمد على Neon Auth، وتضيف API متوافقًا مع Vercel Functions.

## المتغيرات المطلوبة في Vercel

- `DATABASE_URL` — رابط قاعدة Neon لفرع النقل أو الإنتاج.
- `VITE_NEON_AUTH_URL` — رابط Neon Managed Better Auth.
- `NEON_AUTH_JWKS_URL` — رابط JWKS للتحقق من JWT.

## أوامر التشغيل

```bash
npm install
npm run build
```

## ملاحظات

- لم يتم المساس بنسخة AppDeploy الحالية.
- تسجيل الدخول يعتمد على Neon Auth، ويربط المستخدمين الحاليين بالبريد الإلكتروني الموثق.
- `Google Sheets` محفوظ كطبقة تكامل لاحقة ولا يُفعل قبل استقرار النقل.
