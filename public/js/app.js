// ============================================================
//  MOCHI PLANNER — app.js
//  Lógica principal: navegación, render, modales, eventos
// ============================================================

import { tasksDB, habitsDB, formatDate, getDueLabel, isOverdue } from './db.js';
import { requestPermission, getPermission, startReminderLoop, scheduleHabitReminders, sendNotification } from './notifications.js';

// ─── ESTADO ──────────────────────────────────────────────────
let allTasks  = [];
let allHabits = [];
let editingTaskId = null;
let selectedTaskColor = '#dcd0ff';
let selectedHabitColor = '#dae8c3';

// Calendarios
let currentMonth = new Date();
let currentWeekStart = getMonday(new Date());
let currentDay = new Date();

// ─── QUOTES / TIPS ───────────────────────────────────────────
const quotes = [
  '"El secreto para salir adelante es comenzar." — Mark Twain',
  '"Haz que hoy cuente." ✨',
  '"Pequeños pasos, grandes cambios." 🐾',
  '"La constancia supera al talento." 🌸',
  '"Un mochi a la vez." 🍡',
  '"Cuida de ti, para poder dar lo mejor." 💜',
];

const tips = [
  'Dividí tareas grandes en mochis de 15 min 🐾',
  'Tomá un descanso de 5 min por cada hora de trabajo 🌿',
  'Hidratarte mejora la concentración 💧',
  'La técnica Pomodoro puede ser tu mejor aliada 🍅',
  'Celebrá cada tarea completada, por pequeña que sea 🎉',
  'Priorizá las 3 tareas más importantes del día 🎯',
];

// ─── NAVEGACIÓN ───────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-page]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');

  if (page === 'monthly') renderMonthly();
  if (page === 'weekly')  renderWeekly();
  if (page === 'daily')   renderDaily();
  if (page === 'tasks')   renderTasks();
  if (page === 'habits')  renderHabits();
}

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
  // Greeting
  const hour = new Date().getHours();
  const greetEl = document.getElementById('greeting');
  if (greetEl) {
    greetEl.textContent = hour < 12 ? '☀️ ¡Buenos días, Mochi!'
      : hour < 18 ? '🌸 ¡Buenas tardes, Mochi!'
      : '🌙 ¡Buenas noches, Mochi!';
  }
  const quoteEl = document.getElementById('dailyQuote');
  if (quoteEl) quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
  const tipEl = document.getElementById('mochiTip');
  if (tipEl) tipEl.textContent = tips[Math.floor(Math.random() * tips.length)];

  // Notificaciones
  const perm = getPermission();
  const banner = document.getElementById('notifBanner');
  if (perm !== 'granted' && banner) {
    banner.style.display = 'flex';
    document.getElementById('enableNotifBtn')?.addEventListener('click', async () => {
      const granted = await requestPermission();
      if (granted) {
        banner.style.display = 'none';
        sendNotification('🐱 ¡Mochi Planner activado!', 'Ya recibirás recordatorios de tus tareas.');
      }
    });
  }

  // Escuchar Firebase
  tasksDB.listen(tasks => {
    allTasks = tasks;
    renderDashboard();
    const activePage = document.querySelector('.page.active')?.id;
    if (activePage === 'page-tasks')   renderTasks();
    if (activePage === 'page-monthly') renderMonthly();
    if (activePage === 'page-weekly')  renderWeekly();
    if (activePage === 'page-daily')   renderDaily();
    startReminderLoop(() => allTasks);
  });

  habitsDB.listen(habits => {
    allHabits = habits;
    renderDashboard();
    const activePage = document.querySelector('.page.active')?.id;
    if (activePage === 'page-habits') renderHabits();
    scheduleHabitReminders(allHabits);
  });

  // Mobile FAB
  const fab = document.getElementById('fabBtn');
  if (window.innerWidth <= 768 && fab) fab.style.display = 'flex';
  fab?.addEventListener('click', openTaskModal);
}

// ─── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  const pending   = allTasks.filter(t => t.status !== 'completada');
  const completed = allTasks.filter(t => t.status === 'completada');
  const todayTasks = getTodayTasks();

  document.getElementById('dashPending').textContent = pending.length;
  document.getElementById('dashCompleted').textContent = completed.length;
  document.getElementById('dashTodayCount').textContent = `${todayTasks.length} tareas`;

  // Donut
  const totalMins = pending.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  document.getElementById('donutLabel').textContent = h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
  const ring = document.getElementById('donutRing');
  const pct = Math.min(allTasks.length ? completed.length / allTasks.length : 0, 1);
  ring.style.strokeDashoffset = 314 * (1 - pct);

  // Tareas de hoy
  const todayEl = document.getElementById('dashTodayTasks');
  todayEl.innerHTML = todayTasks.length === 0
    ? `<div class="empty-state" style="padding:16px;"><img src="cats/cat-cloud.png" style="width:60px;height:60px;margin-bottom:8px;"><p>¡Sin tareas para hoy! 🎉</p></div>`
    : todayTasks.slice(0, 4).map(t => miniTaskHTML(t)).join('');

  // Mini semana
  const miniWeekEl = document.getElementById('miniWeek');
  const days = ['L','M','X','J','V','S','D'];
  const now = new Date();
  miniWeekEl.innerHTML = days.map((d, i) => {
    const date = new Date(getMonday(now));
    date.setDate(date.getDate() + i);
    const isToday = date.toDateString() === now.toDateString();
    const hasTask = allTasks.some(t => {
      if (!t.dueDate) return false;
      const dd = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return dd.toDateString() === date.toDateString();
    });
    return `<div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-radius:var(--radius-md); background:${isToday ? 'var(--primary)' : 'transparent'};">
      <span style="font-weight:700; font-size:12px; color:${isToday ? 'var(--on-primary)' : 'var(--on-surface-variant)'};">${d}</span>
      <span style="font-size:12px; color:${isToday ? 'var(--on-primary)' : 'var(--on-surface)'};">${date.getDate()}</span>
      ${hasTask ? `<span style="width:6px;height:6px;border-radius:50%;background:${isToday ? 'white' : 'var(--primary)'};"></span>` : '<span style="width:6px;"></span>'}
    </div>`;
  }).join('');

  // Week note
  const upcoming = allTasks.filter(t => {
    if (!t.dueDate || t.status === 'completada') return false;
    const d = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
    const diff = Math.ceil((d - now) / 86400000);
    return diff >= 0 && diff <= 7;
  });
  document.getElementById('weekNote').textContent =
    upcoming.length === 0 ? '¡Semana despejada! 🌈'
    : `Tenés ${upcoming.length} tarea${upcoming.length > 1 ? 's' : ''} esta semana.`;

  // Hábitos
  const dashHabitsEl = document.getElementById('dashHabits');
  const todayStr = new Date().toISOString().split('T')[0];
  dashHabitsEl.innerHTML = allHabits.length === 0
    ? `<p class="text-body-sm" style="color:var(--on-surface-variant);">Todavía no tenés hábitos. ¡Creá uno! 🌱</p>`
    : allHabits.slice(0, 4).map(h => {
        const done = (h.completedDates || []).includes(todayStr);
        return `<div style="display:flex; align-items:center; gap:12px; padding:8px; border-radius:var(--radius-md); background:var(--surface-container-low);">
          <span style="font-size:20px;">${h.icon || '✨'}</span>
          <span class="text-body-sm" style="flex:1;">${h.title}</span>
          <span style="font-size:18px;">${done ? '✅' : '⬜'}</span>
        </div>`;
      }).join('');

  // Streak
  const maxStreak = allHabits.length > 0 ? Math.max(...allHabits.map(h => h.streak || 0)) : 0;
  document.getElementById('dashStreak').textContent = maxStreak;
  document.getElementById('streakBar').style.width = `${Math.min((maxStreak / 30) * 100, 100)}%`;
}

function miniTaskHTML(task) {
  const done = task.status === 'completada';
  return `<div style="display:flex; align-items:center; gap:8px; padding:8px; border-radius:var(--radius-md); background:var(--surface-container-low);" data-id="${task.id}">
    <div class="task-checkbox ${done ? 'checked' : ''}" onclick="toggleTask('${task.id}', '${task.status}')">
      <span class="material-symbols-outlined">check</span>
    </div>
    <span class="text-body-sm" style="${done ? 'text-decoration:line-through;opacity:0.5;' : ''}">${task.title}</span>
    ${task.priority === 'alta' ? '<span class="chip priority-alta" style="margin-left:auto;">Alta</span>' : ''}
  </div>`;
}

function getTodayTasks() {
  const today = new Date();
  return allTasks.filter(t => {
    if (!t.dueDate) return false;
    const d = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
    return d.toDateString() === today.toDateString() && t.status !== 'completada';
  });
}

// ─── TASKS PAGE ───────────────────────────────────────────────
function renderTasks() {
  const statusFilter   = document.getElementById('filterStatus')?.value || 'all';
  const priorityFilter = document.getElementById('filterPriority')?.value || 'all';
  const search = document.getElementById('searchInput')?.value.toLowerCase() || '';

  let filtered = allTasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (search && !t.title.toLowerCase().includes(search) && !t.description?.toLowerCase().includes(search)) return false;
    return true;
  });

  const inProgress = filtered.filter(t => t.status === 'en-progreso');
  const pending    = filtered.filter(t => t.status === 'pendiente');
  const done       = filtered.filter(t => t.status === 'completada');

  const renderCol = (tasks, colId) => {
    const el = document.getElementById(colId);
    el.innerHTML = tasks.length === 0
      ? `<div style="padding:20px; text-align:center; color:var(--on-surface-variant); font-size:13px; border:2px dashed var(--outline-variant); border-radius:var(--radius-md);">Sin tareas aquí 🌸</div>`
      : tasks.map(t => taskCardHTML(t)).join('');
  };

  renderCol(inProgress, 'colInProgress');
  renderCol(pending,    'colPending');
  renderCol(done,       'colCompleted');

  const subtitle = document.getElementById('tasksSubtitle');
  if (subtitle) subtitle.textContent = `${filtered.length} tarea${filtered.length !== 1 ? 's' : ''} ${statusFilter === 'all' ? 'en total' : ''}.`;
}

function taskCardHTML(task) {
  const done = task.status === 'completada';
  const due = task.dueDate ? getDueLabel(task.dueDate) : null;
  const overdue = task.dueDate && isOverdue(task.dueDate) && !done;

  return `<div class="task-card ${done ? 'completed' : ''} ${overdue ? 'overdue' : ''}" style="border-left:4px solid ${task.color || '#dcd0ff'};">
    <div class="task-checkbox ${done ? 'checked' : ''}" onclick="toggleTask('${task.id}', '${task.status}')">
      <span class="material-symbols-outlined">check</span>
    </div>
    <div class="task-body">
      <p class="task-title">${task.title}</p>
      ${task.description ? `<p class="task-desc">${task.description}</p>` : ''}
      <div class="task-meta">
        <span class="chip priority-${task.priority}">${task.priority}</span>
        ${task.category ? `<span class="chip chip-gray">${task.category}</span>` : ''}
        ${task.estimatedMinutes ? `<span class="chip chip-purple"><span class="material-symbols-outlined" style="font-size:11px;">schedule</span>${task.estimatedMinutes}min</span>` : ''}
        ${due ? `<span class="chip due-${due.class}">${due.label}</span>` : ''}
        ${task.reminder ? `<span class="chip chip-pink"><span class="material-symbols-outlined" style="font-size:11px;">notifications</span>${formatShortDate(task.reminder)}</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="task-action-btn" title="Editar" onclick="editTask('${task.id}')">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="task-action-btn delete" title="Eliminar" onclick="deleteTask('${task.id}')">
        <span class="material-symbols-outlined">delete</span>
      </button>
    </div>
  </div>`;
}

function formatShortDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'short' });
}

// ─── HABITS PAGE ──────────────────────────────────────────────
function renderHabits() {
  const todayStr = new Date().toISOString().split('T')[0];
  const el = document.getElementById('habitsList');
  el.innerHTML = allHabits.length === 0
    ? `<div class="empty-state"><img src="cats/cat-yarn.png" alt=""><h3>¡Tu primera rutina!</h3><p>Creá un hábito para empezar tu racha. 🌱</p></div>`
    : allHabits.map(h => {
        const done = (h.completedDates || []).includes(todayStr);
        return `<div class="habit-card">
          <div class="habit-icon" style="background:${h.color || '#dae8c3'};">
            <span style="font-size:24px;">${h.icon || '✨'}</span>
          </div>
          <div style="flex:1;">
            <p class="text-title" style="margin-bottom:2px;">${h.title}</p>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="text-body-sm" style="color:var(--on-surface-variant);">${h.frequency === 'daily' ? 'Diario' : 'Días de semana'}</span>
              ${h.reminderTime ? `<span class="chip chip-pink"><span class="material-symbols-outlined" style="font-size:10px;">alarm</span>${h.reminderTime}</span>` : ''}
            </div>
          </div>
          <div class="habit-streak">
            <strong>${h.streak || 0}</strong>
            <span>🔥</span>
          </div>
          <button class="habit-check ${done ? 'done' : ''}" onclick="toggleHabit('${h.id}', ${done}, '${todayStr}', ${JSON.stringify(h.completedDates || []).replace(/"/g,"'")}, ${h.streak || 0})">
            <span class="material-symbols-outlined">${done ? 'check' : 'add'}</span>
          </button>
          <button class="task-action-btn delete" onclick="deleteHabit('${h.id}')" title="Eliminar" style="opacity:0.7;">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>`;
      }).join('');
}

// ─── MONTHLY CALENDAR ─────────────────────────────────────────
function renderMonthly() {
  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('monthTitle').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Start from Monday
  let startDate = new Date(firstDay);
  const dow = (firstDay.getDay() + 6) % 7; // Mon=0
  startDate.setDate(startDate.getDate() - dow);

  const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const grid = document.getElementById('monthlyCalendar');
  let html = days.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  const today = new Date();
  let d = new Date(startDate);
  for (let i = 0; i < 42; i++) {
    const isToday = d.toDateString() === today.toDateString();
    const isOther = d.getMonth() !== month;
    const dayTasks = allTasks.filter(t => {
      if (!t.dueDate) return false;
      const td = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return td.toDateString() === d.toDateString();
    });

    const eventsHTML = dayTasks.slice(0, 3).map(t => {
      const bg = t.status === 'completada' ? 'var(--surface-container-high)' : (t.color || '#dcd0ff');
      const color = 'var(--on-primary-container)';
      return `<div class="calendar-event" style="background:${bg}; color:${color};">${t.title}</div>`;
    }).join('');

    html += `<div class="calendar-cell ${isOther ? 'other-month' : ''} ${isToday ? 'today' : ''}" onclick="openDayFromCalendar('${d.toISOString()}')">
      <div class="day-num">${d.getDate()}</div>
      ${eventsHTML}
      ${dayTasks.length > 3 ? `<div class="text-label" style="color:var(--on-surface-variant); margin-top:2px;">+${dayTasks.length-3} más</div>` : ''}
    </div>`;

    d.setDate(d.getDate() + 1);
  }
  grid.innerHTML = html;
}

// ─── WEEKLY CALENDAR ──────────────────────────────────────────
function renderWeekly() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const rangeStart = days[0].toLocaleDateString('es-AR', { day:'2-digit', month:'short' });
  const rangeEnd   = days[6].toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' });
  document.getElementById('weeklyRange').textContent = `${rangeStart} – ${rangeEnd}`;

  const hours = [8,9,10,11,12,13,14,15,16,17,18,19];
  const today = new Date();
  const dayNames = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  let html = `<div style="display:grid; grid-template-columns:60px repeat(7,1fr); gap:0;">`;
  // Header
  html += `<div></div>`;
  days.forEach((d, i) => {
    const isToday = d.toDateString() === today.toDateString();
    html += `<div style="text-align:center; padding:8px; ${isToday ? 'color:var(--primary); font-weight:700;' : 'color:var(--on-surface-variant);'}">
      <div class="text-label">${dayNames[i]}</div>
      <div class="text-title">${d.getDate()}</div>
      ${isToday ? '<div style="width:6px;height:6px;border-radius:50%;background:var(--primary);margin:4px auto 0;"></div>' : ''}
    </div>`;
  });

  // Slots
  hours.forEach(hour => {
    html += `<div style="text-align:right; padding-right:10px; font-size:11px; color:var(--on-surface-variant); height:72px; display:flex; align-items:flex-start; padding-top:4px;">${hour}:00</div>`;
    days.forEach(d => {
      const slotTasks = allTasks.filter(t => {
        if (!t.dueDate) return false;
        const td = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
        return td.toDateString() === d.toDateString();
      });
      html += `<div style="border-left:1px dashed var(--outline-variant); border-top:1px dashed var(--outline-variant); height:72px; position:relative; padding:4px;">
        ${slotTasks.slice(0, 1).map(t =>
          `<div class="timeline-event" style="background:${t.color || 'var(--primary-container)'}; color:var(--on-primary-container); position:relative; top:0; height:auto;">${t.title}</div>`
        ).join('')}
      </div>`;
    });
  });
  html += `</div>`;
  document.getElementById('weeklyGrid').innerHTML = html;
}

// ─── DAILY VIEW ───────────────────────────────────────────────
function renderDaily() {
  const dateLabel = currentDay.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('dailyDateLabel').textContent = dateLabel.toUpperCase();

  const dayTasks = allTasks.filter(t => {
    if (!t.dueDate) return false;
    const d = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
    return d.toDateString() === currentDay.toDateString();
  });

  // Timeline
  const hours = [7,8,9,10,11,12,13,14,15,16,17,18,19,20];
  let timeline = '';
  hours.forEach(hour => {
    const slotTasks = dayTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return d.getHours() === hour;
    });
    timeline += `<div style="display:grid; grid-template-columns:56px 1fr; min-height:64px;">
      <div style="text-align:right; padding-right:12px; font-size:11px; color:var(--on-surface-variant); padding-top:6px;">${hour}:00</div>
      <div style="border-left:2px dashed var(--outline-variant); padding:4px 0 4px 12px; min-height:64px;">
        ${slotTasks.map(t => `<div class="timeline-event" style="background:${t.color || 'var(--primary-container)'}; color:var(--on-primary-container); position:relative; top:0; height:auto; margin-bottom:4px;">
          <p style="font-weight:700;">${t.title}</p>
          ${t.estimatedMinutes ? `<p style="font-size:10px; opacity:0.7;">${t.estimatedMinutes} min estimados</p>` : ''}
        </div>`).join('')}
      </div>
    </div>`;
  });
  document.getElementById('dailyTimeline').innerHTML = timeline || `<p style="text-align:center; color:var(--on-surface-variant); padding:32px;">Sin eventos para este día 🌸</p>`;

  // Panel tareas
  document.getElementById('dailyTasks').innerHTML = dayTasks.length === 0
    ? `<p class="text-body-sm" style="color:var(--on-surface-variant);">Sin tareas para este día.</p>`
    : dayTasks.map(t => miniTaskHTML(t)).join('');

  // Energía según hora
  const hour = new Date().getHours();
  const energyEl = document.getElementById('dailyEnergyLabel');
  if (energyEl) {
    energyEl.textContent = hour < 10 ? '☀️ ¡Arrancando!'
      : hour < 13 ? '🔥 ¡En llamas!'
      : hour < 16 ? '✨ ¡Fluye!'
      : hour < 19 ? '🌿 Bajando el ritmo'
      : '🌙 Modo relax';
  }
}

// ─── MODALES: TAREAS ──────────────────────────────────────────
function openTaskModal(task = null) {
  editingTaskId = task?.id || null;
  const modal = document.getElementById('taskModal');
  const title = document.getElementById('taskModalTitle');
  title.textContent = task ? '✏️ Editar Tarea' : '✨ Nueva Tarea';

  document.getElementById('taskTitle').value     = task?.title || '';
  document.getElementById('taskDesc').value      = task?.description || '';
  document.getElementById('taskCategory').value  = task?.category || 'General';
  document.getElementById('taskPriority').value  = task?.priority || 'media';
  document.getElementById('taskEstimated').value = task?.estimatedMinutes || '';
  document.getElementById('taskReminder').value  = task?.reminder || '';

  if (task?.dueDate) {
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    document.getElementById('taskDueDate').value = d.toISOString().split('T')[0];
  } else {
    document.getElementById('taskDueDate').value = '';
  }

  selectedTaskColor = task?.color || '#dcd0ff';
  document.querySelectorAll('#colorPicker .color-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === selectedTaskColor);
  });

  modal.classList.add('open');
  document.getElementById('taskTitle').focus();
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('open');
  editingTaskId = null;
}

async function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { document.getElementById('taskTitle').style.borderColor = 'var(--error)'; return; }

  const taskData = {
    title,
    description:        document.getElementById('taskDesc').value.trim(),
    category:           document.getElementById('taskCategory').value,
    priority:           document.getElementById('taskPriority').value,
    estimatedMinutes:   parseInt(document.getElementById('taskEstimated').value) || null,
    dueDate:            document.getElementById('taskDueDate').value || null,
    reminder:           document.getElementById('taskReminder').value || null,
    color:              selectedTaskColor,
  };

  if (editingTaskId) {
    await tasksDB.update(editingTaskId, taskData);
  } else {
    await tasksDB.create(taskData);
  }
  closeTaskModal();
}

// ─── MODALES: HÁBITOS ────────────────────────────────────────
function openHabitModal() {
  document.getElementById('habitTitle').value     = '';
  document.getElementById('habitIcon').value      = '✨';
  document.getElementById('habitFrequency').value = 'daily';
  document.getElementById('habitReminder').value  = '';
  selectedHabitColor = '#dae8c3';
  document.querySelectorAll('#habitColorPicker .color-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.color === selectedHabitColor);
  });
  document.getElementById('habitModal').classList.add('open');
  document.getElementById('habitTitle').focus();
}

function closeHabitModal() {
  document.getElementById('habitModal').classList.remove('open');
}

async function saveHabit() {
  const title = document.getElementById('habitTitle').value.trim();
  if (!title) return;
  await habitsDB.create({
    title,
    icon:          document.getElementById('habitIcon').value,
    color:         selectedHabitColor,
    frequency:     document.getElementById('habitFrequency').value,
    reminderTime:  document.getElementById('habitReminder').value || null,
  });
  closeHabitModal();
}

// ─── ACCIONES GLOBALES (llamadas desde HTML) ──────────────────
window.toggleTask = async (id, status) => {
  await tasksDB.toggleComplete(id, status);
};

window.editTask = (id) => {
  const task = allTasks.find(t => t.id === id);
  if (task) openTaskModal(task);
};

window.deleteTask = async (id) => {
  if (confirm('¿Eliminar esta tarea? 🗑️')) await tasksDB.delete(id);
};

window.toggleHabit = async (id, done, todayStr, completedDatesStr, streak) => {
  const completedDates = completedDatesStr
    .replace(/'/g, '"')
    .slice(1,-1)
    .split('","')
    .map(s => s.replace(/"/g,''))
    .filter(Boolean);
  await habitsDB.markToday(id, new Date(todayStr), completedDates, streak);
};

window.deleteHabit = async (id) => {
  if (confirm('¿Eliminar este hábito? 🌱')) await habitsDB.delete(id);
};

window.openDayFromCalendar = (isoStr) => {
  currentDay = new Date(isoStr);
  navigateTo('daily');
};

// ─── EVENT LISTENERS ──────────────────────────────────────────
// Botones de nueva tarea
document.getElementById('sidebarNewTask')?.addEventListener('click', () => openTaskModal());
document.getElementById('topbarNewTask')?.addEventListener('click', () => openTaskModal());
document.getElementById('tasksNewBtn')?.addEventListener('click', () => openTaskModal());
document.getElementById('cancelTaskBtn')?.addEventListener('click', closeTaskModal);
document.getElementById('saveTaskBtn')?.addEventListener('click', saveTask);

// Modal overlay click
document.getElementById('taskModal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('taskModal')) closeTaskModal();
});
document.getElementById('habitModal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('habitModal')) closeHabitModal();
});

// Hábitos
document.getElementById('habitsNewBtn')?.addEventListener('click', openHabitModal);
document.getElementById('cancelHabitBtn')?.addEventListener('click', closeHabitModal);
document.getElementById('saveHabitBtn')?.addEventListener('click', saveHabit);

// Color pickers
document.getElementById('colorPicker')?.addEventListener('click', e => {
  const dot = e.target.closest('.color-dot');
  if (!dot) return;
  selectedTaskColor = dot.dataset.color;
  document.querySelectorAll('#colorPicker .color-dot').forEach(d => d.classList.toggle('active', d === dot));
});
document.getElementById('habitColorPicker')?.addEventListener('click', e => {
  const dot = e.target.closest('.color-dot');
  if (!dot) return;
  selectedHabitColor = dot.dataset.color;
  document.querySelectorAll('#habitColorPicker .color-dot').forEach(d => d.classList.toggle('active', d === dot));
});

// Búsqueda
document.getElementById('searchInput')?.addEventListener('input', () => {
  const activePage = document.querySelector('.page.active')?.id;
  if (activePage === 'page-tasks') renderTasks();
});

// Filtros
document.getElementById('filterStatus')?.addEventListener('change', renderTasks);
document.getElementById('filterPriority')?.addEventListener('change', renderTasks);

// Navegación mensual
document.getElementById('prevMonth')?.addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth()-1); renderMonthly(); });
document.getElementById('nextMonth')?.addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth()+1); renderMonthly(); });
document.getElementById('todayMonth')?.addEventListener('click', () => { currentMonth = new Date(); renderMonthly(); });

// Navegación semanal
document.getElementById('prevWeek')?.addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate()-7); renderWeekly(); });
document.getElementById('nextWeek')?.addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate()+7); renderWeekly(); });
document.getElementById('todayWeek')?.addEventListener('click', () => { currentWeekStart = getMonday(new Date()); renderWeekly(); });

// Navegación diaria
document.getElementById('prevDay')?.addEventListener('click', () => { currentDay.setDate(currentDay.getDate()-1); renderDaily(); });
document.getElementById('nextDay')?.addEventListener('click', () => { currentDay.setDate(currentDay.getDate()+1); renderDaily(); });
document.getElementById('todayDay')?.addEventListener('click', () => { currentDay = new Date(); renderDaily(); });

// FAB
document.getElementById('fabBtn')?.addEventListener('click', () => openTaskModal());

// Mobile sidebar
document.getElementById('mobilMenuBtn')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('mobile-open');
});

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeTaskModal(); closeHabitModal(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveTask();
});

// ─── HELPERS ──────────────────────────────────────────────────
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

// ─── ARRANCAR ─────────────────────────────────────────────────
init();
