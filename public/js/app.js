// ============================================================
//  MOCHI PLANNER — app.js
// ============================================================

import { tasksDB, habitsDB, journalDB, getDueLabel, isOverdue, calcWSJF } from './db.js';
import { requestPermission, getPermission, startReminderLoop, scheduleHabitReminders, sendNotification, registerServiceWorker } from './notifications.js';
import { initAuth, onUserReady, logout, getUserDisplayName, updateDisplayName, getUserProfile } from './auth.js';

let allTasks  = [];
let allHabits = [];
let allJournal = [];
let editingTaskId = null;
let selectedTaskColor  = '#dcd0ff';
let selectedHabitColor = '#dae8c3';
let currentMonth    = new Date();
let currentWeekStart = getMonday(new Date());
let currentDay      = new Date();
let selectedMood = '😊';
let draggedTaskId = null;

const quotes = [
  '"El secreto para salir adelante es comenzar." — Mark Twain',
  '"Haz que hoy cuente." ✨',
  '"Pequeños pasos, grandes cambios." 🐾',
  '"La constancia supera al talento." 🌸',
  '"Un mochi a la vez." 🍡',
  '"Cuida de ti, para poder dar lo mejor." 💜',
];

const tips = [
  { icon: '💧', text: 'Dividí tareas grandes en mochis de 15 min 🐾' },
  { icon: '🍅', text: 'La técnica Pomodoro puede ser tu mejor aliada: 25 min de foco, 5 de descanso' },
  { icon: '🎯', text: 'Priorizá tus 3 tareas más importantes del día, no más' },
  { icon: '🌿', text: 'Tomá un descanso de 5 min por cada hora de trabajo' },
  { icon: '🎉', text: 'Celebrá cada tarea completada, por pequeña que sea' },
  { icon: '📵', text: 'Silenciá notificaciones del celu mientras hacés deep work' },
  { icon: '✍️', text: 'Escribí tu lista de tareas la noche anterior, no a la mañana' },
  { icon: '🧘', text: 'Respirá hondo 3 veces antes de empezar algo difícil' },
  { icon: '🚰', text: 'Tomá agua: la deshidratación reduce tu concentración' },
  { icon: '🌞', text: 'Hacé las tareas más difíciles cuando tengas más energía' },
  { icon: '📱', text: 'Probá el modo avión 30 min para trabajar sin distracciones' },
  { icon: '🛏️', text: 'Dormir bien mejora tu productividad más que cualquier app' },
  { icon: '🗂️', text: 'Agrupá tareas similares y hacelas juntas (batching)' },
  { icon: '⏰', text: 'Si una tarea toma menos de 2 minutos, hacela ahora mismo' },
  { icon: '🎵', text: 'La música instrumental puede ayudarte a concentrarte mejor' },
];

// ─── WSJF METHOD INFO ──────────────────────────────────────────
// WSJF = (Valor + Urgencia) / Tamaño — a mayor resultado, mayor prioridad

function navigateTo(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item[data-page]').forEach(l => l.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelector(`.mobile-nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  if (page === 'monthly') renderMonthly();
  if (page === 'weekly')  renderWeekly();
  if (page === 'daily')   renderDaily();
  if (page === 'tasks')   renderTasks();
  if (page === 'habits')  renderHabits();
  if (page === 'journal') renderJournal();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-item[data-page]').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.page); });
});
document.querySelectorAll('.mobile-nav-item[data-page]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

// ─── INIT ──────────────────────────────────────────────────────
async function init() {
  await initAuth({ requireAuth: true });
  await registerServiceWorker();

  onUserReady((user, profile) => {
    if (!user) return;
    renderUserBadge();
  });

  const hour = new Date().getHours();
  const greetEl = document.getElementById('greeting');
  if (greetEl) updateGreeting();
  const quoteEl = document.getElementById('dailyQuote');
  if (quoteEl) quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
  renderMochiTip();

  const perm = getPermission();
  const banner = document.getElementById('notifBanner');
  if (perm !== 'granted' && banner) {
    banner.style.display = 'flex';
    document.getElementById('enableNotifBtn')?.addEventListener('click', async () => {
      const granted = await requestPermission();
      if (granted) {
        banner.style.display = 'none';
        sendNotification('🐱 ¡Mochi Planner activado!', 'Ya recibirás recordatorios.');
      } else {
        alert('Activá las notificaciones desde la configuración del navegador para recibir recordatorios. En Chrome Android: ⋮ → Configuración del sitio → Notificaciones → Permitir.');
      }
    });
  }

  tasksDB.listen(tasks => {
    allTasks = tasks;
    renderDashboard();
    const ap = document.querySelector('.page.active')?.id;
    if (ap === 'page-tasks')   renderTasks();
    if (ap === 'page-monthly') renderMonthly();
    if (ap === 'page-weekly')  renderWeekly();
    if (ap === 'page-daily')   renderDaily();
    startReminderLoop(() => allTasks);
  });

  habitsDB.listen(habits => {
    allHabits = habits;
    renderDashboard();
    const ap = document.querySelector('.page.active')?.id;
    if (ap === 'page-habits') renderHabits();
    scheduleHabitReminders(allHabits);
  });

  journalDB.listen(entries => {
    allJournal = entries;
    const ap = document.querySelector('.page.active')?.id;
    if (ap === 'page-journal') renderJournal();
  });
}

function updateGreeting() {
  const hour = new Date().getHours();
  const name = getUserDisplayName();
  const greetEl = document.getElementById('greeting');
  if (!greetEl) return;
  greetEl.textContent = hour < 12 ? `☀️ ¡Buenos días, ${name}!` : hour < 18 ? `🌸 ¡Buenas tardes, ${name}!` : `🌙 ¡Buenas noches, ${name}!`;
}

function renderUserBadge() {
  updateGreeting();
  const profile = getUserProfile();
  const badge = document.getElementById('userBadge');
  if (badge && profile) {
    badge.innerHTML = `
      <img src="${profile.photoURL || 'cats/cat-peeking.png'}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
      <div style="display:flex;flex-direction:column;line-height:1.2;">
        <span style="font-weight:700;font-size:13px;">${getUserDisplayName()}</span>
        <span style="font-size:11px;color:var(--on-surface-variant);">${profile.email || ''}</span>
      </div>
    `;
  }
}

function renderMochiTip() {
  const tip = tips[Math.floor(Math.random() * tips.length)];
  const tipEl = document.getElementById('mochiTip');
  const iconEl = document.getElementById('mochiTipIcon');
  if (tipEl) tipEl.textContent = tip.text;
  if (iconEl) iconEl.textContent = tip.icon;
}

// ─── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  const pending   = allTasks.filter(t => t.status !== 'completada');
  const completed = allTasks.filter(t => t.status === 'completada');
  const todayTasks = getTodayTasks();

  document.getElementById('dashPending').textContent   = pending.length;
  document.getElementById('dashCompleted').textContent = completed.length;
  document.getElementById('dashTodayCount').textContent = `${todayTasks.length} tareas`;

  const totalMins = pending.reduce((s,t) => s + (t.estimatedMinutes||0), 0);
  const h = Math.floor(totalMins/60), m = totalMins%60;
  document.getElementById('donutLabel').textContent = h > 0 ? `${h}h${m>0?` ${m}m`:''}` : `${m}m`;
  const pct = Math.min(allTasks.length ? completed.length/allTasks.length : 0, 1);
  document.getElementById('donutRing').style.strokeDashoffset = 314*(1-pct);

  document.getElementById('dashTodayTasks').innerHTML = todayTasks.length === 0
    ? `<div class="empty-state" style="padding:16px;"><img src="cats/cat-cloud.png" style="width:60px;height:60px;margin-bottom:8px;"><p>¡Sin tareas para hoy! 🎉</p></div>`
    : todayTasks.slice(0,4).map(t => miniTaskHTML(t)).join('');

  const now = new Date();
  const days = ['L','M','X','J','V','S','D'];
  document.getElementById('miniWeek').innerHTML = days.map((d,i) => {
    const date = new Date(getMonday(now));
    date.setDate(date.getDate()+i);
    const isToday = date.toDateString() === now.toDateString();
    const hasTask = allTasks.some(t => { if(!t.dueDate) return false; const dd = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate); return dd.toDateString()===date.toDateString(); });
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:var(--radius-md);background:${isToday?'var(--primary)':'transparent'};">
      <span style="font-weight:700;font-size:12px;color:${isToday?'var(--on-primary)':'var(--on-surface-variant)'};">${d}</span>
      <span style="font-size:12px;color:${isToday?'var(--on-primary)':'var(--on-surface)'};">${date.getDate()}</span>
      ${hasTask?`<span style="width:6px;height:6px;border-radius:50%;background:${isToday?'white':'var(--primary)'};"></span>`:'<span style="width:6px;"></span>'}
    </div>`;
  }).join('');

  const upcoming = allTasks.filter(t => { if(!t.dueDate||t.status==='completada') return false; const d=t.dueDate.toDate?t.dueDate.toDate():new Date(t.dueDate); const diff=Math.ceil((d-now)/86400000); return diff>=0&&diff<=7; });
  document.getElementById('weekNote').textContent = upcoming.length===0 ? '¡Semana despejada! 🌈' : `Tenés ${upcoming.length} tarea${upcoming.length>1?'s':''} esta semana.`;

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('dashHabits').innerHTML = allHabits.length===0
    ? `<p class="text-body-sm" style="color:var(--on-surface-variant);">Todavía no tenés hábitos. ¡Creá uno! 🌱</p>`
    : allHabits.slice(0,4).map(h => { const done=(h.completedDates||[]).includes(todayStr); return `<div style="display:flex;align-items:center;gap:12px;padding:8px;border-radius:var(--radius-md);background:var(--surface-container-low);"><span style="font-size:20px;">${h.icon||'✨'}</span><span class="text-body-sm" style="flex:1;">${h.title}</span><span style="font-size:18px;">${done?'✅':'⬜'}</span></div>`; }).join('');

  const maxStreak = allHabits.length>0 ? Math.max(...allHabits.map(h=>h.streak||0)) : 0;
  document.getElementById('dashStreak').textContent = maxStreak;
  document.getElementById('streakBar').style.width = `${Math.min((maxStreak/30)*100,100)}%`;

  // Reflexión diaria rápida (preview del journal)
  const todayEntry = allJournal.find(j => j.date === todayStr);
  const reflBtn = document.getElementById('quickJournalBtn');
  if (reflBtn) {
    reflBtn.querySelector('.journal-preview-text').textContent = todayEntry
      ? `${todayEntry.mood} ${todayEntry.text.slice(0, 60)}${todayEntry.text.length > 60 ? '...' : ''}`
      : '¿Cómo te sentís hoy? Anotá un pensamiento.';
  }
}

function miniTaskHTML(task) {
  const done = task.status==='completada';
  return `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:var(--radius-md);background:var(--surface-container-low);">
    <div class="task-checkbox ${done?'checked':''}" onclick="toggleTask('${task.id}','${task.status}')">
      <span class="material-symbols-outlined">check</span>
    </div>
    <span class="text-body-sm" style="${done?'text-decoration:line-through;opacity:0.5;':''}">${task.title}</span>
    ${task.priority==='alta'?'<span class="chip priority-alta" style="margin-left:auto;">Alta</span>':''}
  </div>`;
}

function getTodayTasks() {
  const today = new Date();
  return allTasks.filter(t => { if(!t.dueDate) return false; const d=t.dueDate.toDate?t.dueDate.toDate():new Date(t.dueDate); return d.toDateString()===today.toDateString()&&t.status!=='completada'; });
}

// ─── TASKS (con drag & drop + WSJF) ────────────────────────────
function renderTasks() {
  const sf = document.getElementById('filterStatus')?.value||'all';
  const pf = document.getElementById('filterPriority')?.value||'all';
  const sortWsjf = document.getElementById('sortWsjf')?.checked || false;
  const search = document.getElementById('searchInput')?.value.toLowerCase()||'';
  let filtered = allTasks.filter(t => {
    if (sf!=='all'&&t.status!==sf) return false;
    if (pf!=='all'&&t.priority!==pf) return false;
    if (search&&!t.title.toLowerCase().includes(search)&&!t.description?.toLowerCase().includes(search)) return false;
    return true;
  });

  const sortFn = sortWsjf
    ? (a,b) => (calcWSJF(b)||0) - (calcWSJF(a)||0)
    : (a,b) => 0;

  const renderCol = (tasks, id) => {
    const sorted = [...tasks].sort(sortFn);
    const el = document.getElementById(id);
    el.innerHTML = sorted.length===0
      ? `<div class="kanban-empty" data-status="${id === 'colInProgress' ? 'en-progreso' : id === 'colPending' ? 'pendiente' : 'completada'}">Sin tareas aquí 🌸</div>`
      : sorted.map(t => taskCardHTML(t)).join('');
    setupDragAndDrop(el);
  };
  renderCol(filtered.filter(t=>t.status==='en-progreso'), 'colInProgress');
  renderCol(filtered.filter(t=>t.status==='pendiente'),   'colPending');
  renderCol(filtered.filter(t=>t.status==='completada'),  'colCompleted');
  const sub = document.getElementById('tasksSubtitle');
  if (sub) sub.textContent = `${filtered.length} tarea${filtered.length!==1?'s':''} en total.`;
}

function taskCardHTML(task) {
  const done = task.status==='completada';
  const due  = task.dueDate ? getDueLabel(task.dueDate) : null;
  const overdue = task.dueDate&&isOverdue(task.dueDate)&&!done;
  const wsjf = calcWSJF(task);
  return `<div class="task-card ${done?'completed':''} ${overdue?'overdue':''}" style="border-left:4px solid ${task.color||'#dcd0ff'};" draggable="true" data-id="${task.id}" data-status="${task.status}">
    <div class="task-checkbox ${done?'checked':''}" onclick="toggleTask('${task.id}','${task.status}')">
      <span class="material-symbols-outlined">check</span>
    </div>
    <div class="task-body">
      <p class="task-title">${task.title}</p>
      ${task.description?`<p class="task-desc">${task.description}</p>`:''}
      <div class="task-meta">
        <span class="chip priority-${task.priority}">${task.priority}</span>
        ${task.category?`<span class="chip chip-gray">${task.category}</span>`:''}
        ${task.estimatedMinutes?`<span class="chip chip-purple"><span class="material-symbols-outlined" style="font-size:11px;">schedule</span>${task.estimatedMinutes}min</span>`:''}
        ${due?`<span class="chip due-${due.class}">${due.label}</span>`:''}
        ${wsjf!==null?`<span class="chip" style="background:#ffefc1;color:#8a6000;"><span class="material-symbols-outlined" style="font-size:11px;">bolt</span>WSJF ${wsjf}</span>`:''}
      </div>
    </div>
    <div class="task-actions">
      <button class="task-action-btn" title="Editar" onclick="editTask('${task.id}')"><span class="material-symbols-outlined">edit</span></button>
      <button class="task-action-btn delete" title="Eliminar" onclick="deleteTask('${task.id}')"><span class="material-symbols-outlined">delete</span></button>
    </div>
  </div>`;
}

// Drag and drop entre columnas
function setupDragAndDrop(container) {
  container.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedTaskId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); });
  });
}

['colInProgress','colPending','colCompleted'].forEach(colId => {
  const statusMap = { colInProgress: 'en-progreso', colPending: 'pendiente', colCompleted: 'completada' };
  document.addEventListener('DOMContentLoaded', () => {});
  const setup = () => {
    const col = document.getElementById(colId);
    if (!col) return;
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (draggedTaskId) {
        await tasksDB.setStatus(draggedTaskId, statusMap[colId]);
        draggedTaskId = null;
      }
    });
  };
  setTimeout(setup, 0);
});

// ─── HABITS COMO MILESTONES ──────────────────────────────────
function renderHabits() {
  const todayStr = new Date().toISOString().split('T')[0];
  const el = document.getElementById('habitsList');
  el.innerHTML = allHabits.length===0
    ? `<div class="empty-state"><img src="cats/cat-yarn.png" alt=""><h3>¡Tu primer milestone!</h3><p>Creá un hábito y mirá tu progreso hacia la meta. 🌱</p></div>`
    : allHabits.map(h => {
        const done=(h.completedDates||[]).includes(todayStr);
        const goal = h.goalDays || 30;
        const pct = Math.min(Math.round(((h.streak||0) / goal) * 100), 100);
        const bestStreak = h.bestStreak || 0;
        return `<div class="habit-card" style="flex-direction:column;align-items:stretch;gap:10px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="habit-icon" style="background:${h.color||'#dae8c3'};"><span style="font-size:24px;">${h.icon||'✨'}</span></div>
            <div style="flex:1;">
              <p class="text-title" style="margin-bottom:2px;">${h.title}</p>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="text-body-sm" style="color:var(--on-surface-variant);">${h.frequency==='daily'?'Diario':'Días de semana'}</span>
                ${h.reminderTime?`<span class="chip chip-pink"><span class="material-symbols-outlined" style="font-size:10px;">alarm</span>${h.reminderTime}</span>`:''}
              </div>
            </div>
            <div class="habit-streak"><strong>${h.streak||0}</strong><span>🔥</span></div>
            <button class="habit-check ${done?'done':''}" onclick="toggleHabit('${h.id}',${done},'${todayStr}',${JSON.stringify(h.completedDates||[]).replace(/"/g,"'")},${h.streak||0},${bestStreak})">
              <span class="material-symbols-outlined">${done?'check':'add'}</span>
            </button>
            <button class="task-action-btn delete" onclick="deleteHabit('${h.id}')" title="Eliminar" style="opacity:0.7;"><span class="material-symbols-outlined">delete</span></button>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:12px;font-weight:700;color:var(--on-surface-variant);">🎯 Milestone: ${goal} días</span>
              <span style="font-size:12px;color:var(--on-surface-variant);">Mejor racha: ${bestStreak} días</span>
            </div>
            <div style="height:8px;background:var(--surface-container-high);border-radius:var(--radius-full);overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${h.color||'var(--secondary)'};border-radius:var(--radius-full);transition:width 0.8s ease;"></div>
            </div>
            <span style="font-size:11px;color:var(--on-surface-variant);">${pct}% completado</span>
          </div>
        </div>`;
      }).join('');
}

// ─── DIARIO ÍNTIMO (JOURNAL) ──────────────────────────────────
const moods = ['😊','😴','🥳','😔','😤','🥰','😰','🤔','😌','🥺'];

function renderJournal() {
  const el = document.getElementById('journalList');
  if (allJournal.length === 0) {
    el.innerHTML = `<div class="empty-state"><img src="cats/cat-cloud.png" alt=""><h3>Tu diario está vacío</h3><p>Empezá a escribir tus pensamientos del día. 📖</p></div>`;
    return;
  }
  el.innerHTML = allJournal.map(j => `
    <div class="card" style="margin-bottom:0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">${j.mood}</span>
          <span style="font-weight:700;color:var(--primary);">${new Date(j.date).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</span>
        </div>
        <button class="task-action-btn delete" onclick="deleteJournalEntry('${j.id}')"><span class="material-symbols-outlined">delete</span></button>
      </div>
      <p style="color:var(--on-surface);line-height:1.6;white-space:pre-wrap;">${j.text}</p>
    </div>`).join('');
}

function openJournalModal() {
  const todayStr = new Date().toISOString().split('T')[0];
  const existing = allJournal.find(j => j.date === todayStr);
  selectedMood = existing?.mood || '😊';
  document.getElementById('journalText').value = existing?.text || '';
  document.getElementById('journalEditingId').value = existing?.id || '';
  document.getElementById('journalDateLabel').textContent = new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' });
  renderMoodPicker();
  document.getElementById('journalModal').classList.add('open');
}

function renderMoodPicker() {
  document.getElementById('moodPicker').innerHTML = moods.map(m =>
    `<button class="mood-btn ${m===selectedMood?'active':''}" data-mood="${m}">${m}</button>`
  ).join('');
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMood = btn.dataset.mood;
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}

async function saveJournalEntry() {
  const text = document.getElementById('journalText').value.trim();
  if (!text) return;
  const id = document.getElementById('journalEditingId').value;
  const todayStr = new Date().toISOString().split('T')[0];
  if (id) {
    await journalDB.update(id, { mood: selectedMood, text });
  } else {
    await journalDB.create({ date: todayStr, mood: selectedMood, text });
  }
  document.getElementById('journalModal').classList.remove('open');
}

window.deleteJournalEntry = async (id) => { if (confirm('¿Eliminar esta entrada?')) await journalDB.delete(id); };

// ─── MONTHLY ──────────────────────────────────────────────────
function renderMonthly() {
  const year=currentMonth.getFullYear(), month=currentMonth.getMonth();
  const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('monthTitle').textContent = `${monthNames[month]} ${year}`;
  const firstDay=new Date(year,month,1);
  let startDate=new Date(firstDay);
  startDate.setDate(startDate.getDate()-((firstDay.getDay()+6)%7));
  const days=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const grid=document.getElementById('monthlyCalendar');
  let html=days.map(d=>`<div class="calendar-day-header">${d}</div>`).join('');
  const today=new Date();
  let d=new Date(startDate);
  for(let i=0;i<42;i++){
    const isToday=d.toDateString()===today.toDateString();
    const isOther=d.getMonth()!==month;
    const dayTasks=allTasks.filter(t=>{if(!t.dueDate)return false;const td=t.dueDate.toDate?t.dueDate.toDate():new Date(t.dueDate);return td.toDateString()===d.toDateString();});
    const eventsHTML=dayTasks.slice(0,2).map(t=>`<div class="calendar-event" style="background:${t.color||'#dcd0ff'};color:var(--on-primary-container);">${t.title}</div>`).join('');
    html+=`<div class="calendar-cell ${isOther?'other-month':''} ${isToday?'today':''}" onclick="openDayFromCalendar('${d.toISOString()}')">
      <div class="day-num">${d.getDate()}</div>${eventsHTML}
      ${dayTasks.length>2?`<div class="text-label" style="color:var(--on-surface-variant);margin-top:2px;">+${dayTasks.length-2}</div>`:''}
    </div>`;
    d.setDate(d.getDate()+1);
  }
  grid.innerHTML=html;
}

// ─── WEEKLY ───────────────────────────────────────────────────
function renderWeekly() {
  const days=[];
  for(let i=0;i<7;i++){const d=new Date(currentWeekStart);d.setDate(d.getDate()+i);days.push(d);}
  document.getElementById('weeklyRange').textContent = `${days[0].toLocaleDateString('es-AR',{day:'2-digit',month:'short'})} – ${days[6].toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}`;
  const hours=[8,9,10,11,12,13,14,15,16,17,18,19];
  const today=new Date();
  const dayNames=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  let html=`<div style="display:grid;grid-template-columns:50px repeat(7,1fr);gap:0;min-width:500px;">`;
  html+=`<div></div>`;
  days.forEach((d,i)=>{
    const isToday=d.toDateString()===today.toDateString();
    html+=`<div style="text-align:center;padding:8px;${isToday?'color:var(--primary);font-weight:700;':'color:var(--on-surface-variant);'}">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${dayNames[i]}</div>
      <div style="font-size:16px;font-weight:600;">${d.getDate()}</div>
      ${isToday?'<div style="width:5px;height:5px;border-radius:50%;background:var(--primary);margin:3px auto 0;"></div>':''}
    </div>`;
  });
  hours.forEach(hour=>{
    html+=`<div style="text-align:right;padding-right:8px;font-size:10px;color:var(--on-surface-variant);height:60px;display:flex;align-items:flex-start;padding-top:4px;">${hour}:00</div>`;
    days.forEach(d=>{
      const st=allTasks.filter(t=>{if(!t.dueDate)return false;const td=t.dueDate.toDate?t.dueDate.toDate():new Date(t.dueDate);return td.toDateString()===d.toDateString();});
      html+=`<div style="border-left:1px dashed var(--outline-variant);border-top:1px dashed var(--outline-variant);height:60px;padding:3px;">
        ${st.slice(0,1).map(t=>`<div style="background:${t.color||'var(--primary-container)'};color:var(--on-primary-container);border-radius:8px;padding:4px 6px;font-size:10px;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${t.title}</div>`).join('')}
      </div>`;
    });
  });
  html+=`</div>`;
  document.getElementById('weeklyGrid').innerHTML=html;
}

// ─── DAILY ────────────────────────────────────────────────────
function renderDaily() {
  const dateLabel=currentDay.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('dailyDateLabel').textContent=dateLabel.toUpperCase();
  const dayTasks=allTasks.filter(t=>{if(!t.dueDate)return false;const d=t.dueDate.toDate?t.dueDate.toDate():new Date(t.dueDate);return d.toDateString()===currentDay.toDateString();});
  const hours=[7,8,9,10,11,12,13,14,15,16,17,18,19,20];
  let timeline='';
  hours.forEach(hour=>{
    const st=dayTasks.filter(t=>{if(!t.dueDate)return false;const d=t.dueDate.toDate?t.dueDate.toDate():new Date(t.dueDate);return d.getHours()===hour;});
    timeline+=`<div style="display:grid;grid-template-columns:48px 1fr;min-height:56px;">
      <div style="text-align:right;padding-right:10px;font-size:10px;color:var(--on-surface-variant);padding-top:4px;">${hour}:00</div>
      <div style="border-left:2px dashed var(--outline-variant);padding:3px 0 3px 10px;min-height:56px;">
        ${st.map(t=>`<div style="background:${t.color||'var(--primary-container)'};color:var(--on-primary-container);border-radius:10px;padding:6px 10px;margin-bottom:4px;">
          <p style="font-weight:700;font-size:13px;">${t.title}</p>
          ${t.estimatedMinutes?`<p style="font-size:10px;opacity:0.7;">${t.estimatedMinutes} min</p>`:''}
        </div>`).join('')}
      </div>
    </div>`;
  });
  document.getElementById('dailyTimeline').innerHTML=timeline||`<p style="text-align:center;color:var(--on-surface-variant);padding:32px;">Sin eventos para este día 🌸</p>`;
  document.getElementById('dailyTasks').innerHTML=dayTasks.length===0
    ? `<p class="text-body-sm" style="color:var(--on-surface-variant);">Sin tareas para este día.</p>`
    : dayTasks.map(t=>miniTaskHTML(t)).join('');
  const hour=new Date().getHours();
  const energyEl=document.getElementById('dailyEnergyLabel');
  if(energyEl) energyEl.textContent=hour<10?'☀️ ¡Arrancando!':hour<13?'🔥 ¡En llamas!':hour<16?'✨ ¡Fluye!':hour<19?'🌿 Bajando el ritmo':'🌙 Modo relax';
}

// ─── MODAL TAREA (con status y WSJF) ──────────────────────────
function openTaskModal(task=null) {
  editingTaskId=task?.id||null;
  document.getElementById('taskModalTitle').textContent=task?'✏️ Editar Tarea':'✨ Nueva Tarea';
  document.getElementById('taskTitle').value    =task?.title||'';
  document.getElementById('taskDesc').value     =task?.description||'';
  document.getElementById('taskCategory').value =task?.category||'General';
  document.getElementById('taskPriority').value =task?.priority||'media';
  document.getElementById('taskStatus').value   =task?.status||'pendiente';
  document.getElementById('taskEstimated').value=task?.estimatedMinutes||'';
  document.getElementById('taskReminder').value =task?.reminder||'';
  document.getElementById('wsjfValue').value    =task?.wsjfValue||'';
  document.getElementById('wsjfUrgency').value  =task?.wsjfUrgency||'';
  document.getElementById('wsjfSize').value     =task?.wsjfSize||'';
  updateWsjfPreview();

  // Mostrar selector de status solo al editar
  document.getElementById('taskStatusGroup').style.display = task ? 'block' : 'none';

  if(task?.dueDate){const d=task.dueDate.toDate?task.dueDate.toDate():new Date(task.dueDate);document.getElementById('taskDueDate').value=d.toISOString().split('T')[0];}
  else document.getElementById('taskDueDate').value='';
  selectedTaskColor=task?.color||'#dcd0ff';
  document.querySelectorAll('#colorPicker .color-dot').forEach(dot=>dot.classList.toggle('active',dot.dataset.color===selectedTaskColor));
  document.getElementById('taskModal').classList.add('open');
  setTimeout(()=>document.getElementById('taskTitle').focus(),100);
}

function updateWsjfPreview() {
  const v = parseFloat(document.getElementById('wsjfValue').value);
  const u = parseFloat(document.getElementById('wsjfUrgency').value);
  const s = parseFloat(document.getElementById('wsjfSize').value);
  const preview = document.getElementById('wsjfPreview');
  if (v && u && s) {
    const score = ((v+u)/s).toFixed(2);
    preview.innerHTML = `⚡ Score WSJF: <strong>${score}</strong> <span style="color:var(--on-surface-variant);">(mayor = más prioridad)</span>`;
  } else {
    preview.innerHTML = '';
  }
}

function closeTaskModal(){document.getElementById('taskModal').classList.remove('open');editingTaskId=null;}

async function saveTask(){
  const title=document.getElementById('taskTitle').value.trim();
  if(!title){document.getElementById('taskTitle').style.borderColor='var(--error)';return;}
  const taskData={
    title,description:document.getElementById('taskDesc').value.trim(),
    category:document.getElementById('taskCategory').value,
    priority:document.getElementById('taskPriority').value,
    estimatedMinutes:parseInt(document.getElementById('taskEstimated').value)||null,
    dueDate:document.getElementById('taskDueDate').value||null,
    reminder:document.getElementById('taskReminder').value||null,
    color:selectedTaskColor,
    wsjfValue: parseFloat(document.getElementById('wsjfValue').value) || null,
    wsjfUrgency: parseFloat(document.getElementById('wsjfUrgency').value) || null,
    wsjfSize: parseFloat(document.getElementById('wsjfSize').value) || null,
  };
  if (editingTaskId) {
    taskData.status = document.getElementById('taskStatus').value;
    await tasksDB.update(editingTaskId,taskData);
  } else {
    await tasksDB.create(taskData);
  }
  closeTaskModal();
}

// ─── MODAL HÁBITO (con meta) ──────────────────────────────────
function openHabitModal(){
  document.getElementById('habitTitle').value='';
  document.getElementById('habitIcon').value='✨';
  document.getElementById('habitFrequency').value='daily';
  document.getElementById('habitReminder').value='';
  document.getElementById('habitGoal').value='30';
  selectedHabitColor='#dae8c3';
  document.querySelectorAll('#habitColorPicker .color-dot').forEach(d=>d.classList.toggle('active',d.dataset.color===selectedHabitColor));
  document.getElementById('habitModal').classList.add('open');
  setTimeout(()=>document.getElementById('habitTitle').focus(),100);
}
function closeHabitModal(){document.getElementById('habitModal').classList.remove('open');}
async function saveHabit(){
  const title=document.getElementById('habitTitle').value.trim();
  if(!title) return;
  await habitsDB.create({
    title,icon:document.getElementById('habitIcon').value,color:selectedHabitColor,
    frequency:document.getElementById('habitFrequency').value,
    reminderTime:document.getElementById('habitReminder').value||null,
    goalDays: parseInt(document.getElementById('habitGoal').value) || 30
  });
  closeHabitModal();
}

// ─── GLOBALES ─────────────────────────────────────────────────
window.toggleTask = async(id,status)=>{ await tasksDB.toggleComplete(id,status); };
window.editTask   = (id)=>{ const t=allTasks.find(t=>t.id===id); if(t) openTaskModal(t); };
window.deleteTask = async(id)=>{ if(confirm('¿Eliminar esta tarea? 🗑️')) await tasksDB.delete(id); };
window.toggleHabit = async(id,done,todayStr,completedDatesStr,streak,bestStreak)=>{
  const completedDates=completedDatesStr.replace(/'/g,'"').slice(1,-1).split('","').map(s=>s.replace(/"/g,'')).filter(Boolean);
  await habitsDB.markToday(id,new Date(todayStr),completedDates,streak,bestStreak);
};
window.deleteHabit = async(id)=>{ if(confirm('¿Eliminar este hábito? 🌱')) await habitsDB.delete(id); };
window.openDayFromCalendar = (isoStr)=>{ currentDay=new Date(isoStr); navigateTo('daily'); };
window.handleLogout = async () => { if (confirm('¿Cerrar sesión?')) await logout(); };

// ─── EVENTOS ──────────────────────────────────────────────────
document.getElementById('sidebarNewTask')?.addEventListener('click',()=>openTaskModal());
document.getElementById('topbarNewTask')?.addEventListener('click',()=>openTaskModal());
document.getElementById('tasksNewBtn')?.addEventListener('click',()=>openTaskModal());
document.getElementById('cancelTaskBtn')?.addEventListener('click',closeTaskModal);
document.getElementById('saveTaskBtn')?.addEventListener('click',saveTask);
document.getElementById('taskModal')?.addEventListener('click',e=>{ if(e.target===document.getElementById('taskModal')) closeTaskModal(); });
document.getElementById('habitModal')?.addEventListener('click',e=>{ if(e.target===document.getElementById('habitModal')) closeHabitModal(); });
['wsjfValue','wsjfUrgency','wsjfSize'].forEach(id => document.getElementById(id)?.addEventListener('input', updateWsjfPreview));
document.getElementById('habitsNewBtn')?.addEventListener('click',openHabitModal);
document.getElementById('cancelHabitBtn')?.addEventListener('click',closeHabitModal);
document.getElementById('saveHabitBtn')?.addEventListener('click',saveHabit);
document.getElementById('colorPicker')?.addEventListener('click',e=>{ const dot=e.target.closest('.color-dot');if(!dot)return;selectedTaskColor=dot.dataset.color;document.querySelectorAll('#colorPicker .color-dot').forEach(d=>d.classList.toggle('active',d===dot)); });
document.getElementById('habitColorPicker')?.addEventListener('click',e=>{ const dot=e.target.closest('.color-dot');if(!dot)return;selectedHabitColor=dot.dataset.color;document.querySelectorAll('#habitColorPicker .color-dot').forEach(d=>d.classList.toggle('active',d===dot)); });
document.getElementById('searchInput')?.addEventListener('input',()=>{ if(document.querySelector('.page.active')?.id==='page-tasks') renderTasks(); });
document.getElementById('filterStatus')?.addEventListener('change',renderTasks);
document.getElementById('filterPriority')?.addEventListener('change',renderTasks);
document.getElementById('sortWsjf')?.addEventListener('change',renderTasks);
document.getElementById('prevMonth')?.addEventListener('click',()=>{ currentMonth.setMonth(currentMonth.getMonth()-1);renderMonthly(); });
document.getElementById('nextMonth')?.addEventListener('click',()=>{ currentMonth.setMonth(currentMonth.getMonth()+1);renderMonthly(); });
document.getElementById('todayMonth')?.addEventListener('click',()=>{ currentMonth=new Date();renderMonthly(); });
document.getElementById('prevWeek')?.addEventListener('click',()=>{ currentWeekStart.setDate(currentWeekStart.getDate()-7);renderWeekly(); });
document.getElementById('nextWeek')?.addEventListener('click',()=>{ currentWeekStart.setDate(currentWeekStart.getDate()+7);renderWeekly(); });
document.getElementById('todayWeek')?.addEventListener('click',()=>{ currentWeekStart=getMonday(new Date());renderWeekly(); });
document.getElementById('prevDay')?.addEventListener('click',()=>{ currentDay.setDate(currentDay.getDate()-1);renderDaily(); });
document.getElementById('nextDay')?.addEventListener('click',()=>{ currentDay.setDate(currentDay.getDate()+1);renderDaily(); });
document.getElementById('todayDay')?.addEventListener('click',()=>{ currentDay=new Date();renderDaily(); });
document.getElementById('fabBtn')?.addEventListener('click',()=>openTaskModal());

// Journal
document.getElementById('quickJournalBtn')?.addEventListener('click', openJournalModal);
document.getElementById('journalNewBtn')?.addEventListener('click', openJournalModal);
document.getElementById('cancelJournalBtn')?.addEventListener('click', () => document.getElementById('journalModal').classList.remove('open'));
document.getElementById('saveJournalBtn')?.addEventListener('click', saveJournalEntry);
document.getElementById('journalModal')?.addEventListener('click', e => { if (e.target.id === 'journalModal') document.getElementById('journalModal').classList.remove('open'); });

// Settings / perfil
document.getElementById('logoutBtn')?.addEventListener('click', window.handleLogout);
document.getElementById('saveNameBtn')?.addEventListener('click', async () => {
  const newName = document.getElementById('customNameInput').value.trim();
  if (newName) { await updateDisplayName(newName); updateGreeting(); renderUserBadge(); alert('¡Nombre actualizado! 🌸'); }
});

document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeTaskModal();closeHabitModal();document.getElementById('journalModal')?.classList.remove('open');} if((e.ctrlKey||e.metaKey)&&e.key==='Enter') saveTask(); });

// ─── HELPERS ──────────────────────────────────────────────────
function getMonday(date){
  const d=new Date(date);
  const day=d.getDay();
  d.setDate(d.getDate()+(day===0?-6:1-day));
  d.setHours(0,0,0,0);
  return d;
}

init();