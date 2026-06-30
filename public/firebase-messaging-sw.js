// ============================================================
//  FIREBASE MESSAGING SERVICE WORKER
//  Recibe notificaciones push aunque la app esté cerrada
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCSt9GrpNut3SatAjkCtCH2KWgOLu2OqTQ",
  authDomain: "mochi-planner.firebaseapp.com",
  projectId: "mochi-planner",
  storageBucket: "mochi-planner.firebasestorage.app",
  messagingSenderId: "862459716867",
  appId: "1:862459716867:web:dcd57dbd8381899df27536"
});

const messaging = firebase.messaging();

// Notificación recibida con la app cerrada/background
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || '🐱 Mochi Planner';
  const body  = payload.notification?.body  || payload.data?.body  || 'Tenés un recordatorio';

  self.registration.showNotification(title, {
    body,
    icon: '/cats/cat-peeking.png',
    badge: '/cats/cat-peeking.png',
    tag: payload.data?.tag || 'mochi-push',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});