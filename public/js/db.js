import { db, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, where, Timestamp } from './firebase-config.js';

// ─── TAREAS ────────────────────────────────────────────────────────────────

export const tasksDB = {
  // Escuchar cambios en tiempo real
  listen(callback) {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => {
      const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(tasks);
    });
  },

  // Crear tarea
  async create(task) {
    return await addDoc(collection(db, 'tasks'), {
      title: task.title,
      description: task.description || '',
      category: task.category || 'General',
      priority: task.priority || 'media',
      status: 'pendiente',        // pendiente | en-progreso | completada
      dueDate: task.dueDate ? Timestamp.fromDate(new Date(task.dueDate)) : null,
      estimatedMinutes: task.estimatedMinutes || null,
      reminder: task.reminder || null,  // ISO string
      reminderNotified: false,
      color: task.color || '#dcd0ff',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  },

  // Actualizar tarea
  async update(id, changes) {
    await updateDoc(doc(db, 'tasks', id), {
      ...changes,
      updatedAt: Timestamp.now()
    });
  },

  // Completar / descompletar
  async toggleComplete(id, currentStatus) {
    const newStatus = currentStatus === 'completada' ? 'pendiente' : 'completada';
    await updateDoc(doc(db, 'tasks', id), {
      status: newStatus,
      updatedAt: Timestamp.now()
    });
  },

  // Eliminar
  async delete(id) {
    await deleteDoc(doc(db, 'tasks', id));
  }
};

// ─── HÁBITOS ───────────────────────────────────────────────────────────────

export const habitsDB = {
  listen(callback) {
    const q = query(collection(db, 'habits'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => {
      const habits = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(habits);
    });
  },

  async create(habit) {
    return await addDoc(collection(db, 'habits'), {
      title: habit.title,
      icon: habit.icon || '✨',
      color: habit.color || '#dae8c3',
      frequency: habit.frequency || 'daily',   // daily | weekdays | custom
      reminderTime: habit.reminderTime || null, // "08:00"
      completedDates: [],                       // ["2024-01-15", ...]
      streak: 0,
      createdAt: Timestamp.now()
    });
  },

  async markToday(id, date, completedDates, streak) {
    const dateStr = date.toISOString().split('T')[0];
    const already = completedDates.includes(dateStr);
    const newDates = already
      ? completedDates.filter(d => d !== dateStr)
      : [...completedDates, dateStr];
    const newStreak = already ? Math.max(0, streak - 1) : streak + 1;
    await updateDoc(doc(db, 'habits', id), {
      completedDates: newDates,
      streak: newStreak
    });
  },

  async delete(id) {
    await deleteDoc(doc(db, 'habits', id));
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
