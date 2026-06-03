# خادم غرف البث المباشر — أكاديمية دوز

## التشغيل المحلي
```bash
npm install
npm start
```

## النشر على Railway (مجاني)
1. ارفع هذا المجلد على GitHub
2. اذهب إلى https://railway.app
3. New Project → Deploy from GitHub
4. اختر المستودع → سيعمل تلقائياً

## النشر على Render (مجاني)
1. ارفع على GitHub
2. اذهب إلى https://render.com
3. New → Web Service → اختر المستودع
4. Start Command: `node server.js`

## إعداد الـ Frontend

في مشروع React الخاص بك، غيّر رابط الاتصال:

```javascript
import { io } from "socket.io-client";

const socket = io("https://YOUR-SERVER-URL.railway.app", {
  path: "/socket.io",
  transports: ["websocket", "polling"],
});
```

## متغيرات البيئة (اختياري)
- `PORT` — رقم المنفذ (افتراضي: 3001)
- `ALLOWED_ORIGINS` — روابط مسموح بها مفصولة بفاصلة (افتراضي: *)

مثال:
```
ALLOWED_ORIGINS=https://username.github.io,https://my-site.com
```
