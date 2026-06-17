import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
initializeApp({
credential: cert({
projectId: process.env.FIREBASE_PROJECT_ID,
clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g, "\n")
})
});
}

const db = getFirestore();

export default async function handler(req, res) {

try {

const { title, body } = req.body;

const usersSnap = await db.collection("users").get();

const tokens = [];
const uniqueTokens = new Set();

usersSnap.forEach(doc => {

  const token = doc.data()?.token;

  if (!token) return;

  if (uniqueTokens.has(token)) return;

  uniqueTokens.add(token);
  tokens.push(token);

});

if (!tokens.length) {
  return res.status(200).json({
    success: true,
    sent: 0
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
      link: "/request.html"
    }

  }

});

return res.status(200).json({
  success: true,
  sent: tokens.length,
  response
});

} catch (e) {

console.error(e);

return res.status(500).json({
  success: false,
  error: e.message
});

}

}
