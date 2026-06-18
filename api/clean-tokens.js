import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const db   = getFirestore();
    const snap = await db.collection('tokens').get();

    // جمّع التوكنات لكل يوزر
    const byUser = {};
    snap.forEach(doc => {
      const data = doc.data();
      const user = data.user || 'unknown';
      if (!byUser[user]) byUser[user] = [];
      byUser[user].push({ ref: doc.ref, createdAt: data.createdAt?.toMillis?.() || 0 });
    });

    const batch = db.batch();
    let deleted = 0;
    let kept    = 0;

    for (const user in byUser) {
      const tokens = byUser[user];
      // رتّب من الأحدث للأقدم
      tokens.sort((a, b) => b.createdAt - a.createdAt);
      // سيب الأول (الأحدث) وامسح الباقي
      tokens.forEach((t, i) => {
        if (i === 0) { kept++; }
        else         { batch.delete(t.ref); deleted++; }
      });
    }

    await batch.commit();

    console.log('[clean-tokens] kept:', kept, 'deleted:', deleted);
    return res.json({ success: true, kept, deleted });

  } catch(e) {
    console.error('[clean-tokens] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
