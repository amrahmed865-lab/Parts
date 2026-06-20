console.log("CHECK REMINDERS RUNNING");

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

const OUTSIDE_STAGES = new Set([0, 1]);

function getDeadline(part) {
const val = part.reminderValue || part.reminderDays;
const unit = part.reminderUnit || "days";

if (!val) return null;

const created = part.createdAt?._seconds
? new Date(part.createdAt._seconds * 1000)
: new Date(part.createdAt);

const deadline = new Date(created);

if (unit === "minutes") {
deadline.setMinutes(deadline.getMinutes() + Number(val));
} else if (unit === "hours") {
deadline.setHours(deadline.getHours() + Number(val));
} else {
deadline.setDate(deadline.getDate() + Number(val));
}

return deadline;
}

export default async function handler(req, res) {
try {
const db = getFirestore();
const snap = await db.collection("parts").get();

const now = Date.now();  
const today = new Date().toISOString().split("T")[0];  

const toNotify = [];  

for (const doc of snap.docs) {  
  const part = { id: doc.id, ...doc.data() };  

  if (!OUTSIDE_STAGES.has(part.stage)) continue;  

  const deadline = getDeadline(part);  

  if (!deadline) continue;  
  if (now <= deadline.getTime()) continue;  

  if (part.reminderSentDate === today) continue;  

  toNotify.push(part);  
}  

if (toNotify.length === 0) {  
  return res.status(200).json({  
    success: true,  
    notified: 0,  
    message: "No reminders due"  
  });  
}  

const tokenSnap = await db.collection("tokens").get();  

const seen = new Set();  
const tokens = [];  

tokenSnap.forEach(doc => {  
  const token = doc.data().token;  

  if (token && !seen.has(token)) {  
    seen.add(token);  
    tokens.push(token);  
  }  
});  

if (tokens.length === 0) {  
  return res.status(200).json({  
    success: true,  
    notified: 0,  
    reason: "No tokens found"  
  });  
}  

const messaging = getMessaging();  
const batch = db.batch();  

for (const part of toNotify) {  
  const created = part.createdAt?._seconds  
    ? new Date(part.createdAt._seconds * 1000)  
    : new Date(part.createdAt);  

  const daysPassed = Math.floor(  
    (now - created.getTime()) / 86400000  
  );  

  await messaging.sendEachForMulticast({  
    tokens,  
    notification: {  
      title: "⚠️ قطعة غيار تعدّت المدة!",  
      body: `${part.name} - ${part.machine} - بقالها ${daysPassed} يوم برّا المصنع`  
    },  
    webpush: {  
      headers: {  
        TTL: "86400",  
        Urgency: "high"  
      },  
      notification: {  
        title: "⚠️ قطعة غيار تعدّت المدة!",  
        body: `${part.name} - ${part.machine} - بقالها ${daysPassed} يوم برّا المصنع`,  
        icon: "/icon-192.png",  
        badge: "/icon-192.png"  
      },  
      fcmOptions: {  
        link: "parts.html?part=${part.id}"  
      }  
    }  
  });  

  batch.update(  
    db.collection("parts").doc(part.id),  
    {  
      reminderSentDate: today  
    }  
  );  
}  

await batch.commit();  

return res.status(200).json({  
  success: true,  
  notified: toNotify.length  
});

} catch (e) {
console.error("check-reminders error:", e);

return res.status(500).json({  
  success: false,  
  error: e.message  
});

}
}
