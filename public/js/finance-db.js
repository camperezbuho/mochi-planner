import { db, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp } from './firebase-config.js';

// ─── REGISTROS MENSUALES ───────────────────────────────────────────────────
// Cada documento es un mes. monthKey = "2024-06"

export const financeDB = {

  listenMonths(callback) {
    const q = query(collection(db, 'finance_months'), orderBy('monthKey', 'desc'));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  async saveMonth(monthKey, data) {
    // Buscar si ya existe ese mes
    const q = query(collection(db, 'finance_months'));
    const existing = await new Promise(resolve => {
      const unsub = onSnapshot(q, snap => {
        unsub();
        resolve(snap.docs.find(d => d.data().monthKey === monthKey));
      });
    });

    if (existing) {
      await updateDoc(doc(db, 'finance_months', existing.id), {
        ...data,
        monthKey,
        updatedAt: Timestamp.now()
      });
      return existing.id;
    } else {
      const ref = await addDoc(collection(db, 'finance_months'), {
        ...data,
        monthKey,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return ref.id;
    }
  },

  async deleteMonth(id) {
    await deleteDoc(doc(db, 'finance_months', id));
  }
};

// ─── FRASCOS DE AHORRO ────────────────────────────────────────────────────

export const jarsDB = {

  listen(callback) {
    const q = query(collection(db, 'finance_jars'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  async create(jar) {
    return await addDoc(collection(db, 'finance_jars'), {
      name:     jar.name,
      emoji:    jar.emoji || '🫙',
      currency: jar.currency || 'ARS',  // ARS | USD | BOTH
      goal:     jar.goal || null,       // meta opcional
      color:    jar.color || '#dcd0ff',
      entries:  [],                     // [{date, amount, note}]
      totalARS: 0,
      totalUSD: 0,
      createdAt: Timestamp.now()
    });
  },

  async addEntry(jarId, currentEntries, currentTotalARS, currentTotalUSD, entry) {
    // entry = { date, amountARS, amountUSD, note }
    const newEntries = [...currentEntries, { ...entry, addedAt: new Date().toISOString() }];
    const newTotalARS = (currentTotalARS || 0) + (entry.amountARS || 0);
    const newTotalUSD = (currentTotalUSD || 0) + (entry.amountUSD || 0);
    await updateDoc(doc(db, 'finance_jars', jarId), {
      entries:  newEntries,
      totalARS: newTotalARS,
      totalUSD: newTotalUSD
    });
  },

  async removeEntry(jarId, entries, totalARS, totalUSD, index) {
    const entry = entries[index];
    const newEntries = entries.filter((_, i) => i !== index);
    await updateDoc(doc(db, 'finance_jars', jarId), {
      entries:  newEntries,
      totalARS: Math.max(0, (totalARS || 0) - (entry.amountARS || 0)),
      totalUSD: Math.max(0, (totalUSD || 0) - (entry.amountUSD || 0))
    });
  },

  async update(id, changes) {
    await updateDoc(doc(db, 'finance_jars', id), changes);
  },

  async delete(id) {
    await deleteDoc(doc(db, 'finance_jars', id));
  }
};

// ─── GASTOS ───────────────────────────────────────────────────────────────

export const expensesDB = {

  listen(callback) {
    const q = query(collection(db, 'finance_expenses'), orderBy('date', 'desc'));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  async create(expense) {
    return await addDoc(collection(db, 'finance_expenses'), {
      description: expense.description,
      category:    expense.category || 'General',
      currency:    expense.currency || 'ARS',
      amount:      expense.amount,
      date:        expense.date || new Date().toISOString().split('T')[0],
      note:        expense.note || '',
      createdAt:   Timestamp.now()
    });
  },

  async delete(id) {
    await deleteDoc(doc(db, 'finance_expenses', id));
  }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────

export function formatARS(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
}

export function formatUSD(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount);
}

export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyToLabel(key) {
  if (!key) return '';
  const [year, month] = key.split('-');
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${months[parseInt(month) - 1]} ${year}`;
}