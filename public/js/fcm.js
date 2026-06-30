// ============================================================
//  FCM CLIENT — registra el dispositivo para recibir push reales
// ============================================================
import { db, doc, setDoc, Timestamp } from './firebase-config.js';
import { getUID } from './auth.js';

const VAPID_KEY = 'BHdFNfWYfY6kOil6rvCiv2ykU5ousZhh8y1vqP0NPtUgmllXnp77vkM2MxDOTopNqiH-uaGerBXgH4U9SbPTWjI';

let messaging = null;

async function getMessagingInstance() {
  if (messaging) return messaging;
  const { getMessaging } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');
  const { db: firebaseApp } = await import('./firebase-config.js');
  messaging = getMessaging();
  return messaging;
}

// Registra el service worker de FCM y guarda el token en Firestore
export async function registerFcmToken() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Este navegador no soporta push notifications');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');
    const msg = getMessaging();

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      console.warn('No se pudo obtener el token FCM');
      return null;
    }

    const uid = getUID();
    if (uid) {
      await setDoc(doc(db, 'users', uid, 'fcm_tokens', token), {
        token,
        userAgent: navigator.userAgent,
        createdAt: Timestamp.now()
      });
    }

    return token;
  } catch (err) {
    console.error('Error registrando FCM:', err);
    return null;
  }
}