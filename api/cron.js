import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

export default async function handler(req, res) {
  const db = admin.firestore();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // نجلب فقط القطع التي لا تزال خارج المصنع
  const snapshot = await db.collection('parts').where('stage', 'in', [0, 1]).get();

  for (const doc of snapshot.docs) {
    const p = doc.data();
    
    // منع السبام: لا نرسل إذا كان تم الإرسال اليوم
    if (p.lastNotifiedDate === todayStr) continue;

    const created = p.createdAt.toDate();
    let deadline = new Date(created);
    
    // حساب الموعد النهائي
    if (p.reminderUnit === 'days') deadline.setDate(deadline.getDate() + p.reminderValue);
    else if (p.reminderUnit === 'hours') deadline.setHours(deadline.getHours() + p.reminderValue);

    // إذا تأخرت القطعة، نرسل إشعاراً واحداً فقط ونحدث التاريخ
    if (now > deadline) {
      await admin.messaging().send({
        topic: 'all',
        notification: {
          title: '⚠️ تذكير: قطعة متأخرة',
          body: `${p.name} — ${p.machine} متأخرة عن موعد عودتها!`
        }
      });
      await doc.ref.update({ lastNotifiedDate: todayStr });
    }
  }
  res.status(200).send('Checked successfully');
}
