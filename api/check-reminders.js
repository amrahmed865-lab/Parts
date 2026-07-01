console.log("CHECK REMINDERS RUNNING");

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

// ⚠️ تم إضافة "لا تعمل" وترتيب المراحل
const STAGE_NAMES = [
  "بالخارج للاصلاح",    // 0
  "رجعت من المركز",     // 1
  "لا تعمل",            // 2
  "اتجربت في الماكينة", // 3
  "في الضمان",           // 4
  "مكتملة"              // 5
];

function getDeadline(part) {
  const val = part.reminderValue || part.reminderDays;
  const unit = part.reminderUnit || "days";

  if (!val) return null;

  const baseDate = part.updatedAt ? part.updatedAt : part.createdAt;
  const created = baseDate?._seconds
    ? new Date(baseDate._seconds * 1000)
    : new Date(baseDate);

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

      // التذكير يقف لو المرحلة 5 (مكتملة)
      if (part.stage >= 5) continue;  

      const deadline = getDeadline(part);  

      if (!deadline) continue;  
      if (now <= deadline.getTime()) continue;  

      if (part.reminderSentDate === today) continue;  

      toNotify.push(part);  
    }  

    if (toNotify.length === 0) {  
      return res.status(200).json({ success: true, notified: 0, message: "No reminders due" });  
    }  

    const tokenSnap = await db.collection("tokens").get();  
    const seen = new Set();  
    const tokens = [];  

    tokenSnap.forEach(doc => {  
      const token = doc.data().token;  
      if (token && !seen.has(token)) { seen.add(token); tokens.push(token); }  
    });  

    if (tokens.length === 0) {  
      return res.status(200).json({ success: true, notified: 0, reason: "No tokens found" });  
    }  

    const messaging = getMessaging();  
    const batch = db.batch();  

    for (const part of toNotify) {  
      const val = part.reminderValue || part.reminderDays || 7;
      const unit = part.reminderUnit || "days";
      const unitAr = unit === "minutes" ? "دقيقة" : (unit === "hours" ? "ساعة" : "يوم");

      const stageName = STAGE_NAMES[part.stage] || "مرحلة غير معروفة";
      const centerName = part.center ? part.center : "المركز الخارجي";

      // ⚠️ تحديد الجملة الختامية بناءً على رقم المرحلة
      let actionText = `برجاء المتابعة`;
      if (part.stage === 0) {
        actionText = `برجاء المتابعة مع ${centerName}`;
      } else if (part.stage === 1) {
        actionText = `برجاء تجربة الـ ${part.name} بـ ${part.machine}`;
      } else if (part.stage === 2) {
        actionText = `برجاء سرعة إرجاع الـ ${part.name} للاصلاح`;
      } else if (part.stage === 3 || part.stage === 4) {
        actionText = `برجاء متابعة حالة الـ ${part.name}`;
      }

      const notificationTitle = "⚠️ تنبيه متابعة";
      // ⚠️ دمج الجملة الختامية في الإشعار
      const notificationBody = `${part.name} خاص بـ ${part.machine} لسة في مرحلة "${stageName}" بقالها ${val} ${unitAr} ... ${actionText}`;

      await messaging.sendEachForMulticast({  
        tokens,  
        notification: { title: notificationTitle, body: notificationBody },  
        webpush: { 
          data: { partId: part.id },
          headers: { TTL: "86400", Urgency: "high" },  
          notification: {  
            title: notificationTitle,  
            body: notificationBody,  
            icon: "/icon-192.png",  
            badge: "/icon-192.png"  
          },  
          fcmOptions: { link: `/parts.html?part=${part.id}` }  
        }  
      });  

      batch.update(db.collection("parts").doc(part.id), { reminderSentDate: today });  
    }  

    await batch.commit();  

    return res.status(200).json({ success: true, notified: toNotify.length });
  } catch (e) {
    console.error("check-reminders error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
