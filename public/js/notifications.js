// ─── NOTIFICACIONES PUSH ──────────────────────────────────────────────────

let notificationPermission = 'default';
let checkInterval = null;

export async function requestPermission() {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones');
    return false;
  }
  const permission = await Notification.requestPermission();
  notificationPermission = permission;
  return permission === 'granted';
}

export function getPermission() {
  return 'Notification' in window ? Notification.permission : 'denied';
}

export function sendNotification(title, body, options = {}) {
  if (Notification.permission !== 'granted') return;
  const notification = new Notification(title, {
    body,
    icon: '/cats/cat-peeking.png',
    badge: '/cats/cat-peeking.png',
    tag: options.tag || 'mochi-reminder',
    requireInteraction: options.requireInteraction || false,
    ...options
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
    if (options.onClick) options.onClick();
  };
  return notification;
}

// Chequea recordatorios cada minuto
export function startReminderLoop(getTasksCallback) {
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => checkReminders(getTasksCallback), 60000);
  // También chequear inmediatamente
  checkReminders(getTasksCallback);
}

async function checkReminders(getTasksCallback) {
  if (Notification.permission !== 'granted') return;
  const tasks = getTasksCallback();
  const now = new Date();

  tasks.forEach(task => {
    if (!task.reminder || task.reminderNotified || task.status === 'completada') return;
    const reminderDate = new Date(task.reminder);
    const diff = reminderDate - now;
    // Disparar si falta 1 minuto o menos y no se notificó
    if (diff <= 60000 && diff > -60000) {
      sendNotification(
        `🐱 Recordatorio: ${task.title}`,
        task.description || `¡No te olvides de esta tarea!`,
        { tag: `task-${task.id}`, requireInteraction: true }
      );
      // Marcar como notificada
      import('./db.js').then(({ tasksDB }) => {
        tasksDB.update(task.id, { reminderNotified: true });
      });
    }
  });
}

// Recordatorio de hábitos
export function scheduleHabitReminders(habits) {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  habits.forEach(habit => {
    if (!habit.reminderTime) return;
    const [h, m] = habit.reminderTime.split(':').map(Number);
    const reminderDate = new Date();
    reminderDate.setHours(h, m, 0, 0);

    const diff = reminderDate - now;
    const alreadyDone = (habit.completedDates || []).includes(todayStr);

    if (diff <= 60000 && diff > -60000 && !alreadyDone) {
      sendNotification(
        `${habit.icon} Hábito diario: ${habit.title}`,
        '¡Es momento de tu hábito de hoy! 🌸',
        { tag: `habit-${habit.id}` }
      );
    }
  });
}

export function stopReminderLoop() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
