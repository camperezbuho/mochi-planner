// ============================================================
//  CLOUDFLARE PAGES FUNCTION
//  GET /api/check-reminders
//  Revisa Firestore por recordatorios pendientes y manda push vía FCM.
//  Pensado para ser llamado por un cron externo (cron-job.org) cada minuto.
// ============================================================

const FIREBASE_PROJECT_ID = 'mochi-planner';

// ── JWT signing usando WebCrypto (disponible en Cloudflare Workers) ───────
async function importPrivateKey(pem) {
  const pemBody = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8', binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
}

function base64url(input) {
  let str = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore'
  };

  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const unsigned = `${encHeader}.${encPayload}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo obtener access token: ' + JSON.stringify(data));
  return data.access_token;
}

// ── Firestore REST helpers ────────────────────────────────────────────────
async function firestoreQuery(accessToken, structuredQuery) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery })
    }
  );
  return await res.json();
}

async function listUsers(accessToken) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return (data.documents || []).map(doc => doc.name.split('/').pop());
}

async function listSubcollectionDocs(accessToken, uid, collectionName) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}/${collectionName}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.documents || [];
}

function fsValue(field) {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return parseInt(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('timestampValue' in field) return field.timestampValue;
  if ('nullValue' in field) return null;
  return null;
}

async function patchDoc(accessToken, path, fields) {
  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}?${updateMask}`,
    {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: encodeFields(fields) })
    }
  );
}

function encodeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'boolean') out[k] = { booleanValue: v };
    else if (typeof v === 'string') out[k] = { stringValue: v };
    else out[k] = { stringValue: String(v) };
  }
  return out;
}

// ── FCM send ───────────────────────────────────────────────────────────────
async function sendFcmPush(accessToken, token, title, body, tag) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          webpush: {
            notification: {
              icon: 'https://mochi-planner.pages.dev/cats/cat-peeking.png',
              tag: tag || 'mochi-push',
              requireInteraction: true
            },
            fcm_options: { link: 'https://mochi-planner.pages.dev/' }
          }
        }
      })
    }
  );
  return await res.json();
}

// ── HANDLER ──────────────────────────────────────────────────────────────
export async function onRequestGet({ env }) {
  try {
    const clientEmail = env.FCM_CLIENT_EMAIL;
    const privateKey = env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n');

    const accessToken = await getAccessToken(clientEmail, privateKey);
    const now = new Date();
    const results = [];

    const uids = await listUsers(accessToken);

    for (const uid of uids) {
      // ── Revisar tareas con recordatorio ──
      const tasks = await listSubcollectionDocs(accessToken, uid, 'tasks');
      const tokens = await listSubcollectionDocs(accessToken, uid, 'fcm_tokens');
      const deviceTokens = tokens.map(t => fsValue(t.fields?.token)).filter(Boolean);

      if (deviceTokens.length === 0) continue;

      for (const taskDoc of tasks) {
        const f = taskDoc.fields || {};
        const reminder = fsValue(f.reminder);
        const reminderNotified = fsValue(f.reminderNotified);
        const status = fsValue(f.status);
        const title = fsValue(f.title);
        const description = fsValue(f.description);

        if (!reminder || reminderNotified || status === 'completada') continue;

        const reminderDate = new Date(reminder);
        const diff = reminderDate - now;

        // Disparar si el recordatorio es AHORA (ventana de 90 segundos)
        if (diff <= 0 && diff > -90000) {
          for (const tok of deviceTokens) {
            await sendFcmPush(accessToken, tok, `🐱 Recordatorio: ${title}`, description || '¡No te olvides de esta tarea!', `task-${taskDoc.name.split('/').pop()}`);
          }
          const docPath = taskDoc.name.split('/documents/')[1];
          await patchDoc(accessToken, docPath, { reminderNotified: true });
          results.push({ uid, task: title, sent: true });
        }
      }

      // ── Revisar hábitos con recordatorio diario ──
      const habits = await listSubcollectionDocs(accessToken, uid, 'habits');
      const todayStr = now.toISOString().split('T')[0];
      const nowHHMM = now.toTimeString().slice(0,5);

      for (const habitDoc of habits) {
        const f = habitDoc.fields || {};
        const reminderTime = fsValue(f.reminderTime);
        const title = fsValue(f.title);
        const icon = fsValue(f.icon) || '✨';
        if (!reminderTime) continue;

        // Comparar HH:MM con ventana de 1 minuto
        if (reminderTime === nowHHMM) {
          for (const tok of deviceTokens) {
            await sendFcmPush(accessToken, tok, `${icon} Hábito: ${title}`, '¡Es momento de tu hábito de hoy! 🌸', `habit-${habitDoc.name.split('/').pop()}-${todayStr}`);
          }
          results.push({ uid, habit: title, sent: true });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: uids.length, results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}