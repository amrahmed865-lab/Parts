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

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        error: "title and body required"
      });
    }

    const db = getFirestore();

    const snap = await db.collection("tokens").get();

    const seen = new Set();
    const tokens = [];

    snap.forEach(doc => {
      const token = doc.data()?.token;

      if (token && !seen.has(token)) {
        seen.add(token);
        tokens.push(token);
      }
    });

    console.log("[notify] tokens:", tokens.length);

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        sent: 0,
        failed: 0,
        total: 0
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
          link: "/parts.html"
        }
      }
    });

    console.log(
      "[notify] success:",
      response.successCount,
      "failed:",
      response.failureCount
    );

    response.responses.forEach((r, i) => {
      if (!r.success) {
        console.log(
          "[notify] token error:",
          i,
          r.error?.code,
          r.error?.message
        );
      }
    });

    return res.status(200).json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      total: tokens.length
    });

  } catch (e) {

    console.error("[notify] error:", e);

    return res.status(500).json({
      error: e.message
    });
  }
}
