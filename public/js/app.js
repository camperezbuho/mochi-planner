// ============================================================
//  MOCHI PLANNER — app.js
// ============================================================

import { tasksDB, habitsDB, getDueLabel, isOverdue } from './db.js';
import { requestPermission, getPermission, startReminderLoop, scheduleHabitReminders, sendNotification } from './notifications.js';

let allTasks  = [];
let allHabits = [];
let editingTaskId = null;
let selectedTaskColor  = '#dcd0ff';
let selectedHabitColor = '#dae8c3';
let currentMonth    = new Date();
let currentWeekStart = getMonday(new Date());
let currentDay      = new Date();

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

// ─── NAVEGACIÓN ───────────────────────────────────────────
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
  window.scrollTo(0, 0);
}

// Nav links desktop
document.querySelectorAll('.nav-item[data-page]').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.page); });
});
// Nav buttons mobile
document.querySelectorAll('.mobile-nav-item[data-page]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

// ─── INIT ──────────────────────────────────────────────────
async function init() {
  const hour = new Date().getHours();
  const greetEl = document.getElementById('greeting');
  if (greetEl) greetEl.textContent = hour < 12 ? '☀️ ¡Buenos días, Mochi!' : hour < 18 ? '🌸 ¡Buenas tardes, Mochi!' : '🌙 ¡Buenas noches, Mochi!';
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
      if (granted) { banner.style.display = 'none'; sendNotification('🐱 ¡Mochi Planner activado!', 'Ya recibirás recordatorios.'); }
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
}

// ─── DASHBOARD ────────────────────────────────────────────
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

// ─── TASKS ────────────────────────────────────────────────
function renderTasks() {
  const sf = document.getElementById('filterStatus')?.value||'all';
  const pf = document.getElementById('filterPriority')?.value||'all';
  const search = document.getElementById('searchInput')?.value.toLowerCase()||'';
  let filtered = allTasks.filter(t => {
    if (sf!=='all'&&t.status!==sf) return false;
    if (pf!=='all'&&t.priority!==pf) return false;
    if (search&&!t.title.toLowerCase().includes(search)&&!t.description?.toLowerCase().includes(search)) return false;
    return true;
  });
  const renderCol = (tasks, id) => {
    document.getElementById(id).innerHTML = tasks.length===0
      ? `<div style="padding:20px;text-align:center;color:var(--on-surface-variant);font-size:13px;border:2px dashed var(--outline-variant);border-radius:var(--radius-md);">Sin tareas aquí 🌸</div>`
      : tasks.map(t => taskCardHTML(t)).join('');
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
  return `<div class="task-card ${done?'completed':''} ${overdue?'overdue':''}" style="border-left:4px solid ${task.color||'#dcd0ff'};">
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
        ${task.reminder?`<span class="chip chip-pink"><span class="material-symbols-outlined" style="font-size:11px;">notifications</span>${formatShortDate(task.reminder)}</span>`:''}
      </div>
    </div>
    <div class="task-actions">
      <button class="task-action-btn" title="Editar" onclick="editTask('${task.id}')"><span class="material-symbols-outlined">edit</span></button>
      <button class="task-action-btn delete" title="Eliminar" onclick="deleteTask('${task.id}')"><span class="material-symbols-outlined">delete</span></button>
    </div>
  </div>`;
}

function formatShortDate(isoStr) {
  if(!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('es-AR', {day:'2-digit', month:'short'});
}

// ─── HABITS ───────────────────────────────────────────────
function renderHabits() {
  const todayStr = new Date().toISOString().split('T')[0];
  const el = document.getElementById('habitsList');
  el.innerHTML = allHabits.length===0
    ? `<div class="empty-state"><img src="cats/cat-yarn.png" alt=""><h3>¡Tu primera rutina!</h3><p>Creá un hábito para empezar tu racha. 🌱</p></div>`
    : allHabits.map(h => {
        const done=(h.completedDates||[]).includes(todayStr);
        return `<div class="habit-card">
          <div class="habit-icon" style="background:${h.color||'#dae8c3'};"><span style="font-size:24px;">${h.icon||'✨'}</span></div>
          <div style="flex:1;">
            <p class="text-title" style="margin-bottom:2px;">${h.title}</p>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="text-body-sm" style="color:var(--on-surface-variant);">${h.frequency==='daily'?'Diario':'Días de semana'}</span>
              ${h.reminderTime?`<span class="chip chip-pink"><span class="material-symbols-outlined" style="font-size:10px;">alarm</span>${h.reminderTime}</span>`:''}
            </div>
          </div>
          <div class="habit-streak"><strong>${h.streak||0}</strong><span>🔥</span></div>
          <button class="habit-check ${done?'done':''}" onclick="toggleHabit('${h.id}',${done},'${todayStr}',${JSON.stringify(h.completedDates||[]).replace(/"/g,"'")},${h.streak||0})">
            <span class="material-symbols-outlined">${done?'check':'add'}</span>
          </button>
          <button class="task-action-btn delete" onclick="deleteHabit('${h.id}')" title="Eliminar" style="opacity:0.7;"><span class="material-symbols-outlined">delete</span></button>
        </div>`;
      }).join('');
}

// ─── MONTHLY ──────────────────────────────────────────────
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

// ─── WEEKLY ───────────────────────────────────────────────
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

// ─── DAILY ────────────────────────────────────────────────
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

// ─── MODAL TAREA ──────────────────────────────────────────
function openTaskModal(task=null) {
  editingTaskId=task?.id||null;
  document.getElementById('taskModalTitle').textContent=task?'✏️ Editar Tarea':'✨ Nueva Tarea';
  document.getElementById('taskTitle').value    =task?.title||'';
  document.getElementById('taskDesc').value     =task?.description||'';
  document.getElementById('taskCategory').value =task?.category||'General';
  document.getElementById('taskPriority').value =task?.priority||'media';
  document.getElementById('taskEstimated').value=task?.estimatedMinutes||'';
  document.getElementById('taskReminder').value =task?.reminder||'';
  if(task?.dueDate){const d=task.dueDate.toDate?task.dueDate.toDate():new Date(task.dueDate);document.getElementById('taskDueDate').value=d.toISOString().split('T')[0];}
  else document.getElementById('taskDueDate').value='';
  selectedTaskColor=task?.color||'#dcd0ff';
  document.querySelectorAll('#colorPicker .color-dot').forEach(dot=>dot.classList.toggle('active',dot.dataset.color===selectedTaskColor));
  document.getElementById('taskModal').classList.add('open');
  setTimeout(()=>document.getElementById('taskTitle').focus(),100);
}

function closeTaskModal(){document.getElementById('taskModal').classList.remove('open');editingTaskId=null;}

async function saveTask(){
  const title=document.getElementById('taskTitle').value.trim();
  if(!title){document.getElementById('taskTitle').style.borderColor='var(--error)';return;}
  const taskData={title,description:document.getElementById('taskDesc').value.trim(),category:document.getElementById('taskCategory').value,priority:document.getElementById('taskPriority').value,estimatedMinutes:parseInt(document.getElementById('taskEstimated').value)||null,dueDate:document.getElementById('taskDueDate').value||null,reminder:document.getElementById('taskReminder').value||null,color:selectedTaskColor};
  if(editingTaskId) await tasksDB.update(editingTaskId,taskData);
  else await tasksDB.create(taskData);
  closeTaskModal();
}

// ─── MODAL HÁBITO ─────────────────────────────────────────
function openHabitModal(){
  document.getElementById('habitTitle').value='';
  document.getElementById('habitIcon').value='✨';
  document.getElementById('habitFrequency').value='daily';
  document.getElementById('habitReminder').value='';
  selectedHabitColor='#dae8c3';
  document.querySelectorAll('#habitColorPicker .color-dot').forEach(d=>d.classList.toggle('active',d.dataset.color===selectedHabitColor));
  document.getElementById('habitModal').classList.add('open');
  setTimeout(()=>document.getElementById('habitTitle').focus(),100);
}
function closeHabitModal(){document.getElementById('habitModal').classList.remove('open');}
async function saveHabit(){
  const title=document.getElementById('habitTitle').value.trim();
  if(!title) return;
  await habitsDB.create({title,icon:document.getElementById('habitIcon').value,color:selectedHabitColor,frequency:document.getElementById('habitFrequency').value,reminderTime:document.getElementById('habitReminder').value||null});
  closeHabitModal();
}

// ─── GLOBALES ─────────────────────────────────────────────
window.toggleTask = async(id,status)=>{ await tasksDB.toggleComplete(id,status); };
window.editTask   = (id)=>{ const t=allTasks.find(t=>t.id===id); if(t) openTaskModal(t); };
window.deleteTask = async(id)=>{ if(confirm('¿Eliminar esta tarea? 🗑️')) await tasksDB.delete(id); };
window.toggleHabit = async(id,done,todayStr,completedDatesStr,streak)=>{
  const completedDates=completedDatesStr.replace(/'/g,'"').slice(1,-1).split('","').map(s=>s.replace(/"/g,'')).filter(Boolean);
  await habitsDB.markToday(id,new Date(todayStr),completedDates,streak);
};
window.deleteHabit = async(id)=>{ if(confirm('¿Eliminar este hábito? 🌱')) await habitsDB.delete(id); };
window.openDayFromCalendar = (isoStr)=>{ currentDay=new Date(isoStr); navigateTo('daily'); };

// ─── EVENTOS ──────────────────────────────────────────────
document.getElementById('sidebarNewTask')?.addEventListener('click',()=>openTaskModal());
document.getElementById('topbarNewTask')?.addEventListener('click',()=>openTaskModal());
document.getElementById('tasksNewBtn')?.addEventListener('click',()=>openTaskModal());
document.getElementById('cancelTaskBtn')?.addEventListener('click',closeTaskModal);
document.getElementById('saveTaskBtn')?.addEventListener('click',saveTask);
document.getElementById('taskModal')?.addEventListener('click',e=>{ if(e.target===document.getElementById('taskModal')) closeTaskModal(); });
document.getElementById('habitModal')?.addEventListener('click',e=>{ if(e.target===document.getElementById('habitModal')) closeHabitModal(); });
document.getElementById('habitsNewBtn')?.addEventListener('click',openHabitModal);
document.getElementById('cancelHabitBtn')?.addEventListener('click',closeHabitModal);
document.getElementById('saveHabitBtn')?.addEventListener('click',saveHabit);
document.getElementById('colorPicker')?.addEventListener('click',e=>{ const dot=e.target.closest('.color-dot');if(!dot)return;selectedTaskColor=dot.dataset.color;document.querySelectorAll('#colorPicker .color-dot').forEach(d=>d.classList.toggle('active',d===dot)); });
document.getElementById('habitColorPicker')?.addEventListener('click',e=>{ const dot=e.target.closest('.color-dot');if(!dot)return;selectedHabitColor=dot.dataset.color;document.querySelectorAll('#habitColorPicker .color-dot').forEach(d=>d.classList.toggle('active',d===dot)); });
document.getElementById('searchInput')?.addEventListener('input',()=>{ if(document.querySelector('.page.active')?.id==='page-tasks') renderTasks(); });
document.getElementById('filterStatus')?.addEventListener('change',renderTasks);
document.getElementById('filterPriority')?.addEventListener('change',renderTasks);
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
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeTaskModal();closeHabitModal();} if((e.ctrlKey||e.metaKey)&&e.key==='Enter') saveTask(); });

// ─── HELPERS ──────────────────────────────────────────────
function getMonday(date){
  const d=new Date(date);
  const day=d.getDay();
  d.setDate(d.getDate()+(day===0?-6:1-day));
  d.setHours(0,0,0,0);
  return d;
}

init();