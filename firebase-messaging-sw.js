importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({

  apiKey: "AIzaSyCk-sP0Z-TGyx1rcyQhXFR1D52BY-aLt1E",

  authDomain: "maintenance-nahda.firebaseapp.com",

  projectId: "maintenance-nahda",

  storageBucket: "maintenance-nahda.firebasestorage.app",

  messagingSenderId: "1055981144653",

  appId: "1:1055981144653:web:cecf0a83969248f7d12a04"

});

const messaging = firebase.messaging();

messaging.setBackgroundMessageHandler(function(payload) {

  return self.registration.showNotification(

    payload.notification.title,

    {
      body: payload.notification.body,
      icon: '/icon-192.png',
      badge:'/icon-192.png'
    }

  );

});
