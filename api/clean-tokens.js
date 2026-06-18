import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

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

    const all = [];
    snap.forEach(d => all.push({ ref: d.ref, ...d.data() }));

    console.log('[clean] total tokens:', all.length);

    if (all.length === 0) return res.json({ deleted: 0, kept: 0 });

    // تحقق من كل token إنه لسه valid
    const tokens    = all.map(t => t.token).filter(Boolean);
    const response  = await getMessaging().sendEachForMulticast({
      tokens,
      data: { ping: '1' } // مش notification — بس للتحقق
    });

    const batch    = db.batch();
    let deleted    = 0;
    let kept       = 0;

    response.responses.forEach((r, i) => {
      const errCode = r.error?.code;
      const isDead  =
        errCode === 'messaging/registration-token-not-registered' ||
        errCode === 'messaging/invalid-registration-token';

      if (isDead) {
        console.log('[clean] deleting dead token:', tokens[i].slice(0, 20) + '...');
        batch.delete(all[i].ref);
        deleted++;
      } else {
        kept++;
      }
    });

    await batch.commit();

    return res.json({ success: true, deleted, kept, total: all.length });

  } catch(e) {
    console.error('[clean] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
