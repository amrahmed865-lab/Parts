// 🔥 Firebase Cloud Messaging Integration
// يتكامل مع API الخاص بك (notify.js)

class FirebaseNotificationsManager {
  constructor(apiUrl = '/api/notify') {
    this.apiUrl = apiUrl;
    this.enabled = localStorage.getItem('notifications_enabled') === 'true';
    this.registrationToken = null;
    this.sw = null;
    this.initServiceWorker();
  }

  // 🔧 تهيئة Service Worker
  async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('service-worker.js');
        console.log('✅ Service Worker registered');
        this.sw = registration;
        
        // احصل على device token
        await this.getDeviceToken();
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    }
  }

  // 📱 طلب إذن الإشعارات
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('⚠️ Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'denied') {
      console.warn('⚠️ Notifications are blocked by user');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.enabled = true;
      localStorage.setItem('notifications_enabled', 'true');
      await this.getDeviceToken();
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      
      if (granted) {
        this.enabled = true;
        localStorage.setItem('notifications_enabled', 'true');
        await this.getDeviceToken();
        console.log('✅ Notification permission granted');
      }
      
      return granted;
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      return false;
    }
  }

  // 🔑 الحصول على Device Token من Firebase
  async getDeviceToken() {
    if (!this.sw || !('pushManager' in this.sw)) {
      console.warn('⚠️ Push notifications not supported');
      return;
    }

    try {
      // احصل على subscription موجودة
      let subscription = await this.sw.pushManager.getSubscription();
      
      if (!subscription) {
        // إذا لم توجد، أنشئ واحدة جديدة
        subscription = await this.createSubscription();
      }

      if (subscription) {
        // حوّل الـ subscription إلى token
        this.registrationToken = subscription.endpoint;
        console.log('✅ Device token obtained');
        
        // احفظ محلياً
        localStorage.setItem('deviceToken', this.registrationToken);
        localStorage.setItem('pushSubscription', JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: subscription.toJSON().keys?.p256dh,
          auth: subscription.toJSON().keys?.auth
        }));
      }
    } catch (error) {
      console.error('❌ Error getting device token:', error);
    }
  }

  // 🔑 إنشاء Subscription جديدة
  async createSubscription() {
    try {
      const subscription = await this.sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          // استخدم VAPID public key من Firebase Console
          // Project Settings → Cloud Messaging → Web Push certificates
          localStorage.getItem('vapidPublicKey') || 'BMSMjWqfwasyn7XybR4j17mn0PBtEPeb_i6GxPQohaXEDteaW2R0eMtD4rdPTTe0SyYi6ajf_wLq_o4lxPnfb4A'
        )
      });
      return subscription;
    } catch (error) {
      console.error('❌ Subscription creation failed:', error);
      return null;
    }
  }

  // 🔐 تحويل VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // 📤 إرسال الإشعار عبر API الخاص بك
  async sendNotification(title, body, data = {}) {
    if (!this.enabled || !this.registrationToken) {
      console.warn('⚠️ Notifications not enabled or no token available');
      return;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title,
          body: body,
          token: this.registrationToken,
          data: data,
          user: localStorage.getItem('user'),
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Notification sent successfully:', result);
        this.logNotification(title, body, data);
        return result;
      } else {
        console.error('❌ API Error:', result.error);
      }
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      // حاول إرسال local notification كـ fallback
      this.showLocalNotification(title, body, data);
    }
  }

  // 📋 إرسال إشعار طلب صيانة جديد
  async notifyNewMaintenanceRequest(requestData) {
    if (!this.enabled) return;

    const title = '🔧 طلب صيانة جديد';
    const body = `طلب جديد من ${requestData.requester}\nالآلة: ${requestData.machine}\nالأولوية: ${requestData.priority}`;
    
    const data = {
      type: 'maintenance_request',
      id: requestData.id,
      requester: requestData.requester,
      machine: requestData.machine,
      priority: requestData.priority,
      url: `/request.html?id=${requestData.id}`
    };

    await this.sendNotification(title, body, data);
    this.broadcastToAllClients({ type: 'NEW_REQUEST', data: requestData });
  }

  // 📋 إرسال إشعار رد على طلب
  async notifyMaintenanceReply(replyData) {
    if (!this.enabled) return;

    const title = '✅ رد على طلب صيانة';
    const body = `${replyData.technician} رد على طلبك:\n${replyData.message}`;
    
    const data = {
      type: 'maintenance_reply',
      requestId: replyData.requestId,
      technician: replyData.technician,
      message: replyData.message,
      url: `/request.html?id=${replyData.requestId}`
    };

    await this.sendNotification(title, body, data);
    this.broadcastToAllClients({ type: 'NEW_REPLY', data: replyData });
  }

  // 📋 إرسال إشعار إغلاق طلب
  async notifyRequestClosed(requestData) {
    if (!this.enabled) return;

    const title = '🔒 تم إغلاق الطلب';
    const body = `تم إغلاق الطلب #${requestData.id}\nبواسطة: ${requestData.closedBy}`;
    
    const data = {
      type: 'request_closed',
      id: requestData.id,
      closedBy: requestData.closedBy
    };

    await this.sendNotification(title, body, data);
    this.broadcastToAllClients({ type: 'REQUEST_CLOSED', data: requestData });
  }

  // 📋 إرسال إشعار تغيير الحالة
  async notifyStatusChanged(statusData) {
    if (!this.enabled) return;

    const title = '🔄 تم تغيير حالة الطلب';
    const body = `الطلب #${statusData.id}\n${statusData.oldStatus} → ${statusData.newStatus}`;
    
    const data = {
      type: 'status_changed',
      id: statusData.id,
      status: statusData.newStatus
    };

    await this.sendNotification(title, body, data);
    this.broadcastToAllClients({ type: 'STATUS_CHANGED', data: statusData });
  }

  // 🎨 إرسال إشعار اختبار
  async sendTestNotification() {
    const title = '🧪 إشعار اختبار';
    const body = 'هذا إشعار اختبار من Firebase Cloud Messaging! ✅';
    
    const data = {
      type: 'test',
      timestamp: new Date().toISOString()
    };

    await this.sendNotification(title, body, data);
  }

  // 🎨 إرسال إشعار محلي (fallback)
  showLocalNotification(title, body, data = {}) {
    if (!this.sw || !this.sw.active) return;

    this.sw.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: title,
      options: {
        body: body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.type + '-' + (data.id || Date.now()),
        data: data,
        vibrate: [200, 100, 200]
      }
    });
  }

  // 📡 بث الحدث لجميع النوافذ
  broadcastToAllClients(message) {
    localStorage.setItem('lastNotification', JSON.stringify({
      timestamp: Date.now(),
      ...message
    }));
  }

  // 📝 تسجيل الإشعار
  logNotification(title, body, data) {
    const notifications = JSON.parse(
      localStorage.getItem('notification_logs') || '[]'
    );

    notifications.push({
      timestamp: new Date().toLocaleString('ar-EG'),
      title: title,
      body: body,
      type: data.type || 'general',
      user: localStorage.getItem('user') || 'Unknown',
      sent: 'Firebase API'
    });

    if (notifications.length > 100) {
      notifications.shift();
    }

    localStorage.setItem('notification_logs', JSON.stringify(notifications));
  }

  // 📋 الحصول على السجل
  getNotificationLogs() {
    return JSON.parse(localStorage.getItem('notification_logs') || '[]');
  }

  // ⚙️ التحقق من الحالة
  isEnabled() {
    return this.enabled && Notification.permission === 'granted' && !!this.registrationToken;
  }

  // ⚙️ تعطيل الإشعارات
  disable() {
    this.enabled = false;
    localStorage.setItem('notifications_enabled', 'false');
  }

  // ⚙️ تفعيل الإشعارات
  enable() {
    if (Notification.permission === 'granted') {
      this.enabled = true;
      localStorage.setItem('notifications_enabled', 'true');
    }
  }

  // 📊 معلومات النظام
  getSystemInfo() {
    return {
      notificationsEnabled: this.enabled,
      permissionStatus: Notification.permission,
      hasDeviceToken: !!this.registrationToken,
      serviceWorkerActive: this.sw && this.sw.active ? true : false,
      pushNotificationsSupported: 'pushManager' in (this.sw || {}),
      deviceType: /mobile/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
      apiUrl: this.apiUrl,
      firebase: 'Connected ✅'
    };
  }

  // 🧪 اختبار الاتصال بالـ API
  async testConnection() {
    console.log('🧪 Testing Firebase API connection...');
    
    try {
      if (!this.registrationToken) {
        throw new Error('No device token available');
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🧪 اختبار الاتصال',
          body: 'اختبار الاتصال بـ Firebase API',
          token: this.registrationToken,
          data: { type: 'test_connection' }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Firebase API Connection Test Passed:', result);
        return true;
      } else {
        console.error('❌ API Error:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }
}

// ✅ إنشاء نسخة عالمية
// استخدم نفس endpoint الخاص بك أو غيّره
const notificationsManager = new FirebaseNotificationsManager('/api/notify');

// 📡 الاستماع للتغييرات
window.addEventListener('storage', (event) => {
  if (event.key === 'lastNotification' && event.newValue) {
    const notification = JSON.parse(event.newValue);
    console.log('📨 Notification from another window:', notification);
  }
});

// ✅ التسجيل التلقائي عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('role')) {
    if (Notification.permission === 'default') {
      notificationsManager.requestPermission();
    } else if (Notification.permission === 'granted') {
      // أعد الحصول على الـ token إذا كان مسموحاً
      notificationsManager.getDeviceToken();
    }
  }
});
