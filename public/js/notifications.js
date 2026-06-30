// ─── NOTIFICACIONES PUSH (vía Service Worker, funciona en mobile) ─────────

let swRegistration = null;
let checkInterval = null;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Este navegador no soporta Service Workers');
    return null;
  }
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return swRegistration;
  } catch (err) {
    console.error('Error registrando Service Worker:', err);
    return null;
  }
}

export async function requestPermission() {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones');
    return false;
  }
  if (!swRegistration) await registerServiceWorker();
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function getPermission() {
  return 'Notification' in window ? Notification.permission : 'denied';
}

// Envía la notificación A TRAVÉS del Service Worker (esto es lo que la hace
// funcionar de verdad en Android/Chrome incluso con la app en background)
export async function sendNotification(title, body, options = {}) {
  if (Notification.permission !== 'granted') return;

  if (swRegistration) {
    swRegistration.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      title, body,
      tag: options.tag || 'mochi-reminder',
      requireInteraction: options.requireInteraction || false
    });
  } else {
    // Fallback para desktop si el SW no está listo
    new Notification(title, { body, icon: '/cats/cat-peeking.png' });
  }
}

// Chequea recordatorios cada minuto
export function startReminderLoop(getTasksCallback) {
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => checkReminders(getTasksCallback), 30000);
  checkReminders(getTasksCallback);
}

async function checkReminders(getTasksCallback) {
  if (Notification.permission !== 'granted') return;
  const tasks = getTasksCallback();
  const now = new Date();

  for (const task of tasks) {
    if (!task.reminder || task.reminderNotified || task.status === 'completada') continue;
    const reminderDate = new Date(task.reminder);
    const diff = reminderDate - now;
    if (diff <= 30000 && diff > -60000) {
      await sendNotification(
        `🐱 Recordatorio: ${task.title}`,
        task.description || '¡No te olvides de esta tarea!',
        { tag: `task-${task.id}`, requireInteraction: true }
      );
      const { tasksDB } = await import('./db.js');
      await tasksDB.update(task.id, { reminderNotified: true });
    }
  }
}

export async function scheduleHabitReminders(habits) {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  for (const habit of habits) {
    if (!habit.reminderTime) continue;
    const [h, m] = habit.reminderTime.split(':').map(Number);
    const reminderDate = new Date();
    reminderDate.setHours(h, m, 0, 0);
    const diff = reminderDate - now;
    const alreadyDone = (habit.completedDates || []).includes(todayStr);

    if (diff <= 30000 && diff > -60000 && !alreadyDone) {
      await sendNotification(
        `${habit.icon} Hábito: ${habit.title}`,
        '¡Es momento de tu hábito de hoy! 🌸',
        { tag: `habit-${habit.id}-${todayStr}` }
      );
    }
  }
}

export function stopReminderLoop() {
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}