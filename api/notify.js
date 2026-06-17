import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

const db = getFirestore();

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    const { title, body } = req.body || {};

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: "Missing title or body",
        received: req.body
      });
    }

    const tokensSnapshot = await db.collection("tokens").get();

    const tokens = [];
    const unique = new Set();

    tokensSnapshot.forEach(doc => {

      const token = doc.data()?.token;

      if (!token) return;

      if (unique.has(token)) return;

      unique.add(token);
      tokens.push(token);

    });

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        sent: 0,
        message: "No tokens found"
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
          TTL: "86400",
          Urgency: "high"
        },

        notification: {
          title,
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png"
        },

        fcmOptions: {
          link: "/dashboard.html"
        }
      }

    });

    return res.status(200).json({
      success: true,
      sent: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount
    });

  } catch (e) {

    console.error("FCM ERROR:", e);

    return res.status(500).json({
      success: false,
      error: e.message
    });

  }

}
