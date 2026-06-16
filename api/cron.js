// api/cron.js
import admin from 'firebase-admin';

// تأكد من ضبط Firebase Admin في Vercel Environment Variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

export default async function handler(req, res) {
  const db = admin.firestore();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const parts = await db.collection('parts')
    .where('stage', 'in', [0, 1]) // القطع التي خارج المصنع
    .get();
  
  for (const doc of parts.docs) {
    const p = doc.data();
    
    // تحقق هل تم إرسال إشعار لهذه القطعة اليوم؟
    if (p.lastNotifiedDate === todayStr) continue; 

    // منطق حساب الوقت (نفس المنطق في الكود الأصلي)
    const deadline = calculateDeadline(p); 
    
    if (new Date() > deadline) {
      // إرسال الإشعار
      await admin.messaging().send({
        topic: 'all', // أو أرسل لـ token محدد
        notification: {
          title: '⚠️ تذكير: قطعة غيار متأخرة',
          body: `${p.name} — ${p.machine} — تخطت المدة المحددة!`
        }
      });

      // تسجيل أننا أرسلنا إشعاراً اليوم لهذه القطعة تحديداً
      await doc.ref.update({ lastNotifiedDate: todayStr });
    }
  }

  res.status(200).send('Cron job executed');
}
