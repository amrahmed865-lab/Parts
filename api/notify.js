import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

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

  try {

    const { title, body, token } = req.body;

    const response = await getMessaging().sendEachForMulticast({

      tokens: [token],

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

        fcmOptions: {
          link: '/request.html'
        }

      }

    });

    return res.status(200).json({
      success: true,
      response
    });

  } catch (e) {

    return res.status(500).json({
      error: e.message
    });

  }

}
