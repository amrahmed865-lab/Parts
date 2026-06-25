تم إضافة Firebase Push Notifications بالكامل.

بعد رفع المشروع على GitHub و Vercel:

1- افتح التطبيق من Chrome
2- Install App
3- وافق على الإشعارات

Firestore Rules المطلوبة:

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /{document=**} {
      allow read, write: if true;
    }
  }
}

الملفات المعدلة:
- firebase-messaging-sw.js
- index.html
- dashboard.html
- request.html
