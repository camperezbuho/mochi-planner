import { db, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp } from './firebase-config.js';
import { getUID } from './auth.js';

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

// ─── SUELDO ────────────────────────────────────────────────────────────────
export const salaryDB = {
  listen(callback) {
    const q = query(userCollection('finance_salary'), orderBy('monthKey', 'desc'));
    return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },
  async save(monthKey, data) {
    const uid = getUID();
    const q = query(userCollection('finance_salary'));
    const existing = await new Promise(resolve => {
      const unsub = onSnapshot(q, snap => { unsub(); resolve(snap.docs.find(d => d.data().monthKey === monthKey)); });
    });
    if (existing) {
      await updateDoc(userDoc('finance_salary', existing.id), { ...data, monthKey, updatedAt: Timestamp.now() });
      return existing.id;
    } else {
      const ref = await addDoc(userCollection('finance_salary'), { ...data, monthKey, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      return ref.id;
    }
  },
  async delete(id) { await deleteDoc(userDoc('finance_salary', id)); }
};

// ─── CAMBIOS DE DIVISAS ────────────────────────────────────────────────────
export const exchangeDB = {
  listen(callback) {
    const q = query(userCollection('finance_exchanges'), orderBy('date', 'desc'));
    return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },
  async create(exchange) {
    return await addDoc(userCollection('finance_exchanges'), {
      date: exchange.date, usdAmount: exchange.usdAmount, rate: exchange.rate,
      arsResult: exchange.usdAmount * exchange.rate, note: exchange.note || '',
      createdAt: Timestamp.now()
    });
  },
  async delete(id) { await deleteDoc(userDoc('finance_exchanges', id)); }
};

// ─── GASTOS FIJOS ──────────────────────────────────────────────────────────
export const fixedExpensesDB = {
  listen(callback) {
    const q = query(userCollection('finance_fixed_expenses'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },
  async create(expense) {
    return await addDoc(userCollection('finance_fixed_expenses'), {
      name: expense.name, amount: expense.amount, currency: expense.currency || 'ARS',
      category: expense.category || 'Servicios', active: true, createdAt: Timestamp.now()
    });
  },
  async update(id, changes) { await updateDoc(userDoc('finance_fixed_expenses', id), changes); },
  async delete(id) { await deleteDoc(userDoc('finance_fixed_expenses', id)); }
};

// ─── GASTOS DIARIOS ────────────────────────────────────────────────────────
export const dailyExpensesDB = {
  listen(callback) {
    const q = query(userCollection('finance_daily_expenses'), orderBy('date', 'desc'));
    return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },
  async create(expense) {
    return await addDoc(userCollection('finance_daily_expenses'), {
      description: expense.description, amount: expense.amount, currency: expense.currency || 'ARS',
      category: expense.category || 'Varios', date: expense.date || new Date().toISOString().split('T')[0],
      createdAt: Timestamp.now()
    });
  },
  async delete(id) { await deleteDoc(userDoc('finance_daily_expenses', id)); }
};

// ─── CUOTAS ────────────────────────────────────────────────────────────────
export const installmentsDB = {
  listen(callback) {
    const q = query(userCollection('finance_installments'), orderBy('startDate', 'desc'));
    return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },
  async create(inst) {
    const monthlyAmount = inst.totalAmount / inst.totalInstallments;
    return await addDoc(userCollection('finance_installments'), {
      description: inst.description, totalAmount: inst.totalAmount, currency: inst.currency || 'ARS',
      totalInstallments: inst.totalInstallments, paidInstallments: 0, monthlyAmount,
      paymentMethod: inst.paymentMethod || 'Tarjeta de crédito', startDate: inst.startDate,
      active: true, createdAt: Timestamp.now()
    });
  },
  async payInstallment(id, paidInstallments, totalInstallments) {
    const newPaid = paidInstallments + 1;
    await updateDoc(userDoc('finance_installments', id), { paidInstallments: newPaid, active: newPaid < totalInstallments });
  },
  async delete(id) { await deleteDoc(userDoc('finance_installments', id)); }
};

// ─── FRASCOS DE AHORRO ────────────────────────────────────────────────────
export const jarsDB = {
  listen(callback) {
    const q = query(userCollection('finance_jars'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },
  async create(jar) {
    return await addDoc(userCollection('finance_jars'), {
      name: jar.name, emoji: jar.emoji || '🫙', currency: jar.currency || 'ARS',
      goal: jar.goal || null, color: jar.color || '#dcd0ff',
      entries: [], totalARS: 0, totalUSD: 0, createdAt: Timestamp.now()
    });
  },
  async addEntry(jarId, currentEntries, currentTotalARS, currentTotalUSD, entry) {
    const newEntries = [...currentEntries, { ...entry, addedAt: new Date().toISOString() }];
    await updateDoc(userDoc('finance_jars', jarId), {
      entries: newEntries,
      totalARS: (currentTotalARS || 0) + (entry.amountARS || 0),
      totalUSD: (currentTotalUSD || 0) + (entry.amountUSD || 0)
    });
  },
  async removeEntry(jarId, entries, totalARS, totalUSD, index) {
    const entry = entries[index];
    await updateDoc(userDoc('finance_jars', jarId), {
      entries: entries.filter((_, i) => i !== index),
      totalARS: Math.max(0, (totalARS || 0) - (entry.amountARS || 0)),
      totalUSD: Math.max(0, (totalUSD || 0) - (entry.amountUSD || 0))
    });
  },
  async delete(id) { await deleteDoc(userDoc('finance_jars', id)); }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────
export function formatARS(amount) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
}
export function formatUSD(amount) {
  if (amount === null || amount === undefined) return '—';
  return `U$S ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}`;
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
export function getMonthsRange(startKey, count) {
  const [y, m] = startKey.split('-').map(Number);
  const result = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(y, m - 1 + i, 1);
    result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}