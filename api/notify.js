import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        error: 'title and body required'
      });
    }

    const db = getFirestore();
    const snap = await db.collection('tokens').get();

    const seen = new Set();
    const tokens = [];

    snap.forEach(doc => {
      const t = doc.data().token;

      if (t && !seen.has(t)) {
        seen.add(t);
        tokens.push(t);
      }
    });

    console.log('[notify] tokens found:', tokens.length);

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        sent: 0,
        message: 'No tokens found'
      });
    }

    const response = await getMessaging().sendEachForMulticast({
      tokens,

      notification: {
        title,
        body
      },

      webpush: {
        headers: {
          TTL: '86400',
          Urgency: 'high'
        },

        notification: {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        },

        // ← هنا التعديل
        fcmOptions: {
          link: '/parts.html'
        }
      }
    });

    let totalSuccess = 0;
    let totalFail = 0;
    const badTokens = [];

    response.responses.forEach((r, i) => {
      if (r.success) {
        totalSuccess++;
      } else {
        totalFail++;

        const errCode = r.error?.code;

        if (
          errCode === 'messaging/registration-token-not-registered' ||
          errCode === 'messaging/invalid-registration-token'
        ) {
          badTokens.push(tokens[i]);
        }
      }
    });

//    if (badTokens.length > 0) {
   //   const batch = db.batch();

    ///  const toDelSnap = await db
    //    .collection('tokens')
    //    .where('token', 'in', badTokens.slice(0, 30))
     //   .get();

  //   toDelSnap.forEach(d => batch.delete(d.ref));

    //  await batch.commit();
   // }

    return res.status(200).json({
      success: true,
      sent: totalSuccess,
      failed: totalFail,
      total: tokens.length
    });

  } catch (e) {
    console.error('[notify] error:', e);

    return res.status(500).json({
      error: e.message
    });
  }
}
