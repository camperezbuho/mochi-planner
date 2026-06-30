import { db, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp } from './firebase-config.js';
import { getUID } from './auth.js';

// Todas las colecciones ahora viven bajo users/{uid}/{collection}
// para que cada usuario tenga sus propios datos, totalmente separados.

function userCollection(name) {
  const uid = getUID();
  if (!uid) throw new Error('No hay usuario logueado');
  return collection(db, 'users', uid, name);
}
function userDoc(name, id) {
  const uid = getUID();
  if (!uid) throw new Error('No hay usuario logueado');
  return doc(db, 'users', uid, name, id);
}

// ─── TAREAS ────────────────────────────────────────────────────────────────

export const tasksDB = {
  listen(callback) {
    const q = query(userCollection('tasks'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  async create(task) {
    return await addDoc(userCollection('tasks'), {
      title: task.title,
      description: task.description || '',
      category: task.category || 'General',
      priority: task.priority || 'media',
      status: task.status || 'pendiente',
      dueDate: task.dueDate ? Timestamp.fromDate(new Date(task.dueDate)) : null,
      estimatedMinutes: task.estimatedMinutes || null,
      reminder: task.reminder || null,
      reminderNotified: false,
      color: task.color || '#dcd0ff',
      // WSJF
      wsjfValue: task.wsjfValue || null,       // valor de negocio 1-10
      wsjfUrgency: task.wsjfUrgency || null,   // urgencia 1-10
      wsjfSize: task.wsjfSize || null,         // tamaño/esfuerzo 1-10
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  },

  async update(id, changes) {
    await updateDoc(userDoc('tasks', id), { ...changes, updatedAt: Timestamp.now() });
  },

  async setStatus(id, status) {
    await updateDoc(userDoc('tasks', id), { status, updatedAt: Timestamp.now() });
  },

  async toggleComplete(id, currentStatus) {
    const newStatus = currentStatus === 'completada' ? 'pendiente' : 'completada';
    await updateDoc(userDoc('tasks', id), { status: newStatus, updatedAt: Timestamp.now() });
  },

  async delete(id) {
    await deleteDoc(userDoc('tasks', id));
  }
};

// ─── HÁBITOS / MILESTONES ──────────────────────────────────────────────────

export const habitsDB = {
  listen(callback) {
    const q = query(userCollection('habits'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  async create(habit) {
    return await addDoc(userCollection('habits'), {
      title: habit.title,
      icon: habit.icon || '✨',
      color: habit.color || '#dae8c3',
      frequency: habit.frequency || 'daily',
      reminderTime: habit.reminderTime || null,
      goalDays: habit.goalDays || 30,        // milestone: meta de días
      completedDates: [],
      streak: 0,
      bestStreak: 0,
      createdAt: Timestamp.now()
    });
  },

  async markToday(id, date, completedDates, streak, bestStreak) {
    const dateStr = date.toISOString().split('T')[0];
    const already = completedDates.includes(dateStr);
    const newDates = already ? completedDates.filter(d => d !== dateStr) : [...completedDates, dateStr];
    const newStreak = already ? Math.max(0, streak - 1) : streak + 1;
    const newBest = Math.max(bestStreak || 0, newStreak);
    await updateDoc(userDoc('habits', id), { completedDates: newDates, streak: newStreak, bestStreak: newBest });
  },

  async update(id, changes) {
    await updateDoc(userDoc('habits', id), changes);
  },

  async delete(id) {
    await deleteDoc(userDoc('habits', id));
  }
};

// ─── DIARIO ÍNTIMO ─────────────────────────────────────────────────────────

export const journalDB = {
  listen(callback) {
    const q = query(userCollection('journal'), orderBy('date', 'desc'));
    return onSnapshot(q, snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  async create(entry) {
    return await addDoc(userCollection('journal'), {
      date: entry.date || new Date().toISOString().split('T')[0],
      mood: entry.mood || '😊',
      text: entry.text,
      createdAt: Timestamp.now()
    });
  },

  async update(id, changes) {
    await updateDoc(userDoc('journal', id), changes);
  },

  async delete(id) {
    await deleteDoc(userDoc('journal', id));
  }
};

// ─── UTILIDADES ────────────────────────────────────────────────────────────

export function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function isOverdue(dueDate) {
  if (!dueDate) return false;
  const d = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
  return d < new Date();
}

export function getDueLabel(dueDate) {
  if (!dueDate) return null;
  const d = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: 'Vencida', class: 'overdue' };
  if (diff === 0) return { label: 'Hoy', class: 'today' };
  if (diff === 1) return { label: 'Mañana', class: 'soon' };
  if (diff <= 7) return { label: `En ${diff} días`, class: 'soon' };
  return { label: formatDate(dueDate), class: 'future' };
}

// ─── WSJF ──────────────────────────────────────────────────────────────────
// WSJF simplificado = (Valor + Urgencia) / Tamaño
export function calcWSJF(task) {
  const v = task.wsjfValue, u = task.wsjfUrgency, s = task.wsjfSize;
  if (!v || !u || !s) return null;
  return +((v + u) / s).toFixed(2);
}