// ═══════════════════════════════════════════════════
//  notif-helper.js  —  ملف مركزي للإشعارات
// ═══════════════════════════════════════════════════

// تم توحيد مفتاح VAPID الجديد هنا
const VAPID_KEY = 'BMSMjWqfwasyn7XybR4j17mn0PBtEPeb_i6GxPQohaXEDteaW2R0eMtD4rdPTTe0SyYi6ajf_wLq_o4lxPnfb4A';

// ── تهيئة FCM وطلب الصلاحية ──
async function initFCM(db, currentUser = null) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const messaging = firebase.messaging();
    // الاعتماد حصرياً على ملف SW الخاص بفايربيز
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return false;

    const user = currentUser || localStorage.getItem('user') || 'unknown';
    
    // حفظ التوكن لربطه بالمستخدم الحالي
    await db.collection('tokens').doc(token).set({ 
      token: token, 
      user: user, 
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('[FCM] Token saved successfully');

    // استقبال الإشعارات والتطبيق مفتوح
    messaging.onMessage(async (payload) => {
      const r = await navigator.serviceWorker.getRegistration();
      if (r) r.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200]
      });
    });

    return true; // نجاح التسجيل
  } catch (e) {
    console.error('[FCM] init error:', e);
    return false;
  }
}

// ── إرسال إشعار للجميع ──
async function sendNotificationToAll(title, body) {
  try {
    const RLM = '\u200F'; // لضبط اتجاه القراءة
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: RLM + title, body: RLM + body })
    });
    return await response.json();
  } catch (e) {
    console.error('[FCM] sendNotificationToAll error:', e);
    throw e;
  }
}
