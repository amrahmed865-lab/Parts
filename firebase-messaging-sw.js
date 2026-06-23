importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
 apiKey: "AIzaSyDZ1RAn4fIN6Rqc-b5-BoHiiNFQ9GvZZJA",
  authDomain: "parts-7e82e.firebaseapp.com",
  projectId: "parts-7e82e",
  storageBucket: "parts-7e82e.firebasestorage.app",
  messagingSenderId: "198514736431",
  appId: "1:198514736431:web:3e88fb478f4cfc910035da"
});

const messaging = firebase.messaging();

messaging.setBackgroundMessageHandler(function(payload) {

  const partId = payload.data?.partId || "";

  return self.registration.showNotification(
    payload.notification.title,
    {
      body: payload.notification.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: partId
          ? `/parts.html?part=${partId}`
          : '/parts.html'
      }
    }
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url || '/parts.html';

  event.waitUntil(
    clients.openWindow(targetUrl)
  );
});
