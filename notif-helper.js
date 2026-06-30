// ═══════════════════════════════════════════════════
//  notif-helper.js  —  ملف مركزي للإشعارات
//  يتحمّل في كل صفحة بدل firebase-notifications.js
// ═══════════════════════════════════════════════════

const VAPID_KEY = 'BMSMjWqfwasyn7XybR4j17mn0PBtEPeb_i6GxPQohaXEDteaW2R0eMtD4rdPTTe0SyYi6ajf_wLq_o4lxPnfb4A';

// ── بيشغّل FCM ويحفظ التوكن في Firestore ──
async function initFCM(db) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const messaging = firebase.messaging();

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return;

    const user = localStorage.getItem('user') || 'unknown';
    // احفظ بـ user كـ ID عشان كل يوزر يفضل عنده token واحد بس
    await db.collection('tokens').doc(user).set({ token, user, createdAt: new Date() });

    console.log('[FCM] Token saved:', token.slice(0, 20) + '...');

    // استقبال الإشعارات لما الصفحة مفتوحة
    messaging.onMessage(async (payload) => {
      const r = await navigator.serviceWorker.getRegistration();
      if (r) r.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200]
      });
    });

  } catch (e) {
    console.error('[FCM] init error:', e);
  }
}

// ── بيبعت إشعار — Vercel بيجيب التوكنات هو نفسه ──
async function sendNotificationToAll(db, title, body) {
  try {
    const RLM = '\u200F'; // علامة RTL لضبط اتجاه القراءة في الإشعار
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: RLM + title, body: RLM + body })
    });
    const result = await response.json();
    console.log('[FCM] notify result:', result);
  } catch (e) {
    console.error('[FCM] sendNotificationToAll error:', e);
  }
}
