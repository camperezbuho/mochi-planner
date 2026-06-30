// ============================================================
//  SERVICE WORKER — necesario para notificaciones reales en mobile
// ============================================================
const CACHE_NAME = 'mochi-planner-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Escucha mensajes desde la app para disparar notificaciones
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, requireInteraction } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/cats/cat-peeking.png',
      badge: '/cats/cat-peeking.png',
      tag: tag || 'mochi-reminder',
      requireInteraction: requireInteraction || false,
      vibrate: [200, 100, 200],
    });
  }
});

// Click en la notificación: abre/enfoca la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});