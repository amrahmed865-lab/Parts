// api/cron.js
import admin from 'firebase-admin';

// تهيئة Firebase Admin (تأكد من إعداد Firebase Service Account في Vercel Environment Variables)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

export default async function handler(req, res) {
  const db = admin.firestore();
  const parts = await db.collection('parts').where('stage', 'in', [0, 1]).get();
  
  const now = Date.now();

  for (const doc of parts.docs) {
    const p = doc.data();
    // منطق حساب التاريخ (نفس المنطق السابق)
    const created = p.createdAt.toDate();
    const deadline = new Date(created);
    deadline.setDate(deadline.getDate() + (p.reminderDays || 7));

    if (now > deadline.getTime()) {
      // إرسال الإشعار عبر FCM
      await admin.messaging().send({
        topic: 'all',
        notification: {
          title: '⚠️ تذكير بقطعة غيار',
          body: `${p.name} تأخرت خارج المصنع!`
        }
      });
    }
  }

  res.status(200).end('Cron job finished');
}
