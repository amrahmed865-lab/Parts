import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

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

  const partsSnap = await db.collection("parts").get();
  const tokensSnap = await db.collection("tokens").get();

  const tokens = tokensSnap.docs.map(d => d.data().token);

  let sent = 0;

  for (const doc of partsSnap.docs) {

    const part = doc.data();

    if (![0,1].includes(part.stage)) continue;

    const created = part.createdAt.toDate();

    let deadline = new Date(created);

    const value = part.reminderValue || part.reminderDays || 7;
    const unit = part.reminderUnit || "days";

    if (unit === "minutes")
      deadline.setMinutes(deadline.getMinutes() + value);
    else if (unit === "hours")
      deadline.setHours(deadline.getHours() + value);
    else
      deadline.setDate(deadline.getDate() + value);

    if (Date.now() < deadline.getTime()) continue;

    await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "⚠️ قطعة غيار متأخرة",
        body: `${part.name} - ${part.machine}`
      }
    });

    sent++;
  }

  res.status(200).json({
    success: true,
    remindersSent: sent
  });
}
