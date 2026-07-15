/**
 * G-Scheduler & Notes - scheduler_hyunji final app.js
 * - APP_ID isolated localStorage
 * - Calendar time fields with 5-minute step
 * - GitHub Gist sync UI + mobile sync status
 */

window.GS_APP_ID = window.GS_APP_ID || 'scheduler_hyunji';
const STORAGE_PREFIX = `${window.GS_APP_ID}__`;

const state = {
  events: [],
  todos: [],
  notes: [],
  ddays: [],
  currentDate: new Date()
};

const STORAGE_KEYS = {
  EVENTS: `${STORAGE_PREFIX}gs_events`,
  TODOS: `${STORAGE_PREFIX}gs_todos`,
  NOTES: `${STORAGE_PREFIX}gs_notes`,
  DDAYS: `${STORAGE_PREFIX}gs_ddays`
};

let todoFilter = 'all';
let activeNoteId = null;
let appInitialized = false;

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  ensureEventTimeFields();
  loadDataFromStorage();
  initDateTime();
  initTabs();
  initModals();
  initDashboard();
  initCalendar();
  initTodos();
  initNotes();
  initSettings();
  renderAll();
  updateSyncIndicator();
  renderSyncLogBox();
  ensureMobileSyncStatusBox();
}

function renderAll() {
  renderDashboard();
  renderCalendar();
  renderTodoList();
  renderNotesList();
}

// ==========================================
// DATA MANAGEMENT
// ==========================================

function migrateEvent(evt) {
  if (!evt) return evt;
  if (evt.date && !evt.startDate) {
    evt.startDate = evt.date;
    evt.endDate = evt.date;
    delete evt.date;
  }
  if (!evt.startDate && evt.endDate) evt.startDate = evt.endDate;
  if (!evt.endDate && evt.startDate) evt.endDate = evt.startDate;
  if (!evt.startTime) evt.startTime = '';
  if (!evt.endTime) evt.endTime = '';
  return evt;
}

function loadDataFromStorage() {
  try {
    state.events = (JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS)) || []).map(migrateEvent);
    state.todos = JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS)) || [];
    state.notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES)) || [];
    state.ddays = JSON.parse(localStorage.getItem(STORAGE_KEYS.DDAYS)) || [];
  } catch (e) {
    console.error('로컬 데이터를 불러오는 중 오류 발생:', e);
    state.events = [];
    state.todos = [];
    state.notes = [];
    state.ddays = [];
  }
}

function saveDataToStorage(options = {}) {
  state.events = state.events.map(migrateEvent);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
  localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));

  if (!options.skipRender) renderAll();

  if (!options.skipSync && typeof AutoSync !== 'undefined' && typeof AutoSync.scheduleUpload === 'function') {
    AutoSync.scheduleUpload(getFullAppState());
  }
}

function getFullAppState() {
  return {
    events: state.events.map(migrateEvent),
    todos: state.todos,
    notes: state.notes,
    ddays: state.ddays
  };
}

function restoreFullAppState(data, options = {}) {
  if (!data) return;
  state.events = Array.isArray(data.events) ? data.events.map(migrateEvent) : [];
  state.todos = Array.isArray(data.todos) ? data.todos : [];
  state.notes = Array.isArray(data.notes) ? data.notes : [];
  state.ddays = Array.isArray(data.ddays) ? data.ddays : [];
  saveDataToStorage({ skipSync: options.skipSync, skipRender: true });
  renderAll();
}

function countAppData(data) {
  if (!data) return 0;
  return (Array.isArray(data.events) ? data.events.length : 0)
    + (Array.isArray(data.todos) ? data.todos.length : 0)
    + (Array.isArray(data.notes) ? data.notes.length : 0)
    + (Array.isArray(data.ddays) ? data.ddays.length : 0);
}

// ==========================================
// CORE UI & NAVIGATION
// ==========================================

function initDateTime() {
  const timeEl = document.getElementById('header-time');
  if (!timeEl) return;
  const updateHeaderTime = () => {
    const now = new Date();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${y}. ${m}. ${d}. (${weekdays[now.getDay()]}) ${h}:${min}`;
  };
  updateHeaderTime();
  setInterval(updateHeaderTime, 30000);
}

function initTabs() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('page-title');
  const btnQuickAdd = document.getElementById('btn-quick-add');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      navButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add('active');
      if (pageTitle) pageTitle.textContent = btn.innerText.trim();
      if (tab === 'settings') {
        updateSyncIndicator();
        renderSyncLogBox();
      }
    });
  });

  if (btnQuickAdd) btnQuickAdd.addEventListener('click', () => openEventModal(null, getLocalDateString(new Date())));
}

function initModals() {
  const eventModal = document.getElementById('modal-event');
  document.getElementById('modal-event-close')?.addEventListener('click', () => closeModal(eventModal));
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => closeModal(eventModal));

  const ddayModal = document.getElementById('modal-dday');
  document.getElementById('modal-dday-close')?.addEventListener('click', () => closeModal(ddayModal));
  document.getElementById('btn-cancel-dday')?.addEventListener('click', () => closeModal(ddayModal));

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal);
    });
  });
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = 'flex';
  setTimeout(() => modalEl.classList.add('active'), 10);
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('active');
  setTimeout(() => { modalEl.style.display = 'none'; }, 250);
}

// ==========================================
// DASHBOARD
// ==========================================

function initDashboard() {
  document.getElementById('btn-add-dday')?.addEventListener('click', openDdayModal);

  const ddayForm = document.getElementById('dday-form');
  ddayForm?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('dday-id').value;
    const title = document.getElementById('dday-title').value.trim();
    const date = document.getElementById('dday-date').value;
    if (!title || !date) return;

    if (id) {
      const item = state.ddays.find(d => d.id === id);
      if (item) Object.assign(item, { title, date });
    } else {
      state.ddays.push({ id: 'dday_' + Date.now(), title, date });
    }
    saveDataToStorage();
    closeModal(document.getElementById('modal-dday'));
  });
}

function renderDashboard() {
  renderProgressCircle();
  renderDdayList();
  renderTodayEvents();
  renderDashboardQuickLinks();
}

function renderProgressCircle() {
  const total = state.todos.length;
  const done = state.todos.filter(t => t.completed).length;
  const percent = total ? Math.round(done / total * 100) : 0;
  const bar = document.getElementById('dashboard-progress-bar');
  const pctEl = document.getElementById('progress-percentage');
  const ratioEl = document.getElementById('progress-ratio');
  if (bar) bar.style.strokeDashoffset = String(439.82 - 439.82 * percent / 100);
  if (pctEl) pctEl.textContent = `${percent}%`;
  if (ratioEl) ratioEl.textContent = `${done} / ${total} 완료`;
}

function renderDdayList() {
  const el = document.getElementById('dashboard-dday-list');
  if (!el) return;
  el.innerHTML = '';
  if (!state.ddays.length) {
    el.innerHTML = '<div class="no-data">등록된 D-Day 일정이 없습니다.</div>';
    return;
  }
  const today = new Date(getLocalDateString(new Date()));
  [...state.ddays].sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
    const diff = Math.ceil((new Date(d.date) - today) / 86400000);
    const label = diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
    const cls = diff < 0 ? 'dday-passed' : diff <= 7 ? 'dday-urgent' : '';
    const item = document.createElement('div');
    item.className = 'dday-item';
    item.innerHTML = `
      <div class="dday-info">
        <div class="dday-title">${escapeHTML(d.title)}</div>
        <div class="dday-target-date">${escapeHTML(d.date)}</div>
      </div>
      <div style="display:flex;align-items:center;">
        <div class="dday-badge ${cls}">${label}</div>
        <button class="btn-delete-dday" title="삭제"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    item.querySelector('.btn-delete-dday').addEventListener('click', () => {
      if (!confirm('D-Day 일정을 삭제하시겠습니까?')) return;
      state.ddays = state.ddays.filter(x => x.id !== d.id);
      saveDataToStorage();
    });
    el.appendChild(item);
  });
}

function renderTodayEvents() {
  const el = document.getElementById('dashboard-today-events');
  if (!el) return;
  el.innerHTML = '';
  const today = getLocalDateString(new Date());
  const events = state.events
    .map(migrateEvent)
    .filter(e => isDateInRange(today, e.startDate, e.endDate))
    .sort(compareEventsByTime);
  if (!events.length) {
    el.innerHTML = '<div class="no-data">오늘 일정이 없습니다.</div>';
    return;
  }
  events.forEach(evt => {
    const item = document.createElement('div');
    item.className = 'today-event-item';
    item.style.borderLeftColor = evt.color || 'var(--color-primary)';
    item.innerHTML = `
      <div>
        <div class="today-event-title">${escapeHTML(formatEventTime(evt) + (evt.title || ''))}</div>
        <div class="today-event-desc">${escapeHTML(evt.desc || '')}</div>
      </div>`;
    el.appendChild(item);
  });
}

function renderDashboardQuickLinks() {
  const el = document.getElementById('dashboard-quick-links');
  if (!el) return;
  el.innerHTML = '';
  const favorites = state.notes.filter(n => n.favorite);
  if (!favorites.length) {
    el.innerHTML = '<div class="no-data">등록된 중요 메모가 없습니다.</div>';
    return;
  }
  favorites.forEach(note => {
    const btn = document.createElement('button');
    btn.className = 'quick-link-btn';
    btn.innerHTML = `<span class="quick-link-title"><i class="fa-solid fa-star"></i>${escapeHTML(note.title || '제목 없는 메모')}</span><span class="quick-link-cat">${escapeHTML(note.category || '미분류')}</span>`;
    btn.addEventListener('click', () => {
      document.querySelector('.nav-btn[data-tab="notes"]')?.click();
      selectNote(note.id);
    });
    el.appendChild(btn);
  });
}

function openDdayModal() {
  const modal = document.getElementById('modal-dday');
  document.getElementById('dday-id').value = '';
  document.getElementById('dday-form')?.reset();
  document.getElementById('dday-date').value = getLocalDateString(new Date());
  openModal(modal);
}

// ==========================================
// CALENDAR WITH 5-MINUTE TIME
// ==========================================

function ensureEventTimeFields() {
  if (document.getElementById('event-start-time')) return;
  const startDateInput = document.getElementById('event-start-date');
  const endDateInput = document.getElementById('event-end-date');
  if (!startDateInput || !endDateInput) return;
  const dateRow = startDateInput.closest('.form-row');
  if (!dateRow) return;
  const timeRow = document.createElement('div');
  timeRow.className = 'form-row';
  timeRow.innerHTML = `
    <div class="form-group">
      <label for="event-start-time">시작시간</label>
      <input type="time" id="event-start-time" step="300">
    </div>
    <div class="form-group">
      <label for="event-end-time">종료시간</label>
      <input type="time" id="event-end-time" step="300">
    </div>`;
  dateRow.insertAdjacentElement('afterend', timeRow);
}

function initCalendar() {
  ensureEventTimeFields();
  document.getElementById('cal-prev-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('cal-next-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    state.currentDate = new Date();
    renderCalendar();
  });
  document.getElementById('btn-add-event')?.addEventListener('click', () => openEventModal(null, getLocalDateString(new Date())));

  const startDateInput = document.getElementById('event-start-date');
  const endDateInput = document.getElementById('event-end-date');
  startDateInput?.addEventListener('change', () => {
    if (!endDateInput.value || endDateInput.value < startDateInput.value) endDateInput.value = startDateInput.value;
  });

  document.getElementById('event-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const title = document.getElementById('event-title').value.trim();
    const startDate = document.getElementById('event-start-date').value;
    const endDate = document.getElementById('event-end-date').value;
    const startTime = document.getElementById('event-start-time')?.value || '';
    const endTime = document.getElementById('event-end-time')?.value || '';
    const color = document.getElementById('event-color').value;
    const desc = document.getElementById('event-desc').value.trim();

    if (!title) return alert('일정 제목을 입력해주세요.');
    if (startDate > endDate) return alert('종료일은 시작일보다 빠를 수 없습니다.');
    if (startDate === endDate && startTime && endTime && endTime < startTime) return alert('같은 날짜에서는 종료시간이 시작시간보다 빠를 수 없습니다.');

    const eventData = { id: id || 'evt_' + Date.now(), title, startDate, endDate, startTime, endTime, color, desc };
    if (id) {
      const idx = state.events.findIndex(evt => evt.id === id);
      if (idx !== -1) state.events[idx] = eventData;
    } else {
      state.events.push(eventData);
    }
    saveDataToStorage();
    closeModal(document.getElementById('modal-event'));
  });

  document.getElementById('btn-delete-event')?.addEventListener('click', () => {
    const id = document.getElementById('event-id').value;
    if (!id) return;
    if (!confirm('일정을 삭제하시겠습니까?')) return;
    state.events = state.events.filter(evt => evt.id !== id);
    saveDataToStorage();
    closeModal(document.getElementById('modal-event'));
  });
}

function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const title = document.getElementById('calendar-month-year');
  const grid = document.getElementById('calendar-grid');
  if (title) title.textContent = `${year}년 ${month + 1}월`;
  if (!grid) return;
  grid.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();
  const cells = [];

  for (let x = firstDayIndex; x > 0; x--) {
    const day = prevLastDay - x + 1;
    const d = new Date(year, month - 1, day);
    cells.push({ day, dateStr: getLocalDateString(d), isOtherMonth: true });
  }
  for (let i = 1; i <= lastDay; i++) {
    const d = new Date(year, month, i);
    cells.push({ day: i, dateStr: getLocalDateString(d), isOtherMonth: false });
  }
  const remain = 42 - cells.length;
  for (let j = 1; j <= remain; j++) {
    const d = new Date(year, month + 1, j);
    cells.push({ day: j, dateStr: getLocalDateString(d), isOtherMonth: true });
  }

  const todayStr = getLocalDateString(new Date());
  state.events = state.events.map(migrateEvent);

  cells.forEach(cell => {
    const cellEl = document.createElement('div');
    cellEl.className = 'calendar-cell';
    if (cell.isOtherMonth) cellEl.classList.add('other-month');
    if (cell.dateStr === todayStr) cellEl.classList.add('today');
    cellEl.innerHTML = `<span class="cell-num">${cell.day}</span><div class="cell-events"></div>`;
    const wrap = cellEl.querySelector('.cell-events');
    state.events
      .filter(evt => isDateInRange(cell.dateStr, evt.startDate, evt.endDate))
      .sort(compareEventsByTime)
      .forEach(evt => {
        const badge = document.createElement('div');
        badge.className = 'event-badge';
        badge.style.backgroundColor = evt.color || 'var(--color-primary)';
        badge.textContent = `${formatEventTime(evt)}${evt.title}`;
        badge.title = `${formatEventTime(evt)}${evt.title}`;
        badge.addEventListener('click', e => {
          e.stopPropagation();
          openEventModal(evt);
        });
        wrap.appendChild(badge);
      });
    cellEl.addEventListener('click', () => openEventModal(null, cell.dateStr));
    grid.appendChild(cellEl);
  });
}

function openEventModal(eventObj = null, defaultDateStr = null) {
  ensureEventTimeFields();
  const modal = document.getElementById('modal-event');
  const form = document.getElementById('event-form');
  const deleteBtn = document.getElementById('btn-delete-event');
  const titleHeader = document.getElementById('modal-event-title');
  if (form) form.reset();
  const date = defaultDateStr || getLocalDateString(new Date());

  if (eventObj) {
    eventObj = migrateEvent(eventObj);
    if (titleHeader) titleHeader.textContent = '일정 수정';
    document.getElementById('event-id').value = eventObj.id || '';
    document.getElementById('event-title').value = eventObj.title || '';
    document.getElementById('event-start-date').value = eventObj.startDate || date;
    document.getElementById('event-end-date').value = eventObj.endDate || eventObj.startDate || date;
    document.getElementById('event-start-time').value = eventObj.startTime || '';
    document.getElementById('event-end-time').value = eventObj.endTime || '';
    document.getElementById('event-color').value = eventObj.color || '#3498db';
    document.getElementById('event-desc').value = eventObj.desc || '';
    deleteBtn?.classList.remove('hidden');
  } else {
    if (titleHeader) titleHeader.textContent = '새 일정 추가';
    document.getElementById('event-id').value = '';
    document.getElementById('event-start-date').value = date;
    document.getElementById('event-end-date').value = date;
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
    document.getElementById('event-color').value = '#3498db';
    document.getElementById('event-desc').value = '';
    deleteBtn?.classList.add('hidden');
  }
  openModal(modal);
}

// ==========================================
// TODO
// ==========================================

function initTodos() {
  document.getElementById('todo-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;
    state.todos.push({
      id: 'todo_' + Date.now(),
      text,
      priority: document.getElementById('todo-priority').value,
      duedate: document.getElementById('todo-duedate').value,
      completed: false,
      createdAt: new Date().toISOString()
    });
    input.value = '';
    document.getElementById('todo-duedate').value = '';
    saveDataToStorage();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      todoFilter = btn.dataset.filter || 'all';
      renderTodoList();
    });
  });
}

function renderTodoList() {
  const el = document.getElementById('todo-items-list');
  if (!el) return;
  el.innerHTML = '';
  let todos = [...state.todos];
  if (todoFilter === 'active') todos = todos.filter(t => !t.completed);
  if (todoFilter === 'completed') todos = todos.filter(t => t.completed);
  if (!todos.length) {
    el.innerHTML = '<div class="no-data">할 일이 없습니다. 여유로운 하루를 보내세요!</div>';
    return;
  }
  todos.sort((a, b) => (a.duedate || '9999-12-31').localeCompare(b.duedate || '9999-12-31'));
  todos.forEach(todo => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (todo.completed ? ' completed' : '');
    item.innerHTML = `
      <div class="todo-item-left">
        <label class="todo-checkbox-wrapper"><input type="checkbox" ${todo.completed ? 'checked' : ''}><span class="todo-checkmark"></span></label>
        <div class="todo-details">
          <div class="todo-text">${escapeHTML(todo.text)}</div>
          <div class="todo-meta"><span class="todo-priority-badge priority-${escapeHTML(todo.priority || 'medium')}">${priorityLabel(todo.priority)}</span>${todo.duedate ? `<span class="todo-due-meta"><i class="fa-regular fa-calendar"></i>${escapeHTML(todo.duedate)}</span>` : ''}</div>
        </div>
      </div>
      <div class="todo-actions"><button class="btn-todo-action btn-todo-delete" title="삭제"><i class="fa-solid fa-trash"></i></button></div>`;
    item.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      todo.completed = e.target.checked;
      saveDataToStorage();
    });
    item.querySelector('.btn-todo-delete').addEventListener('click', () => {
      if (!confirm('할 일을 삭제하시겠습니까?')) return;
      state.todos = state.todos.filter(t => t.id !== todo.id);
      saveDataToStorage();
    });
    el.appendChild(item);
  });
}

// ==========================================
// NOTES
// ==========================================

function initNotes() {
  document.getElementById('btn-new-note')?.addEventListener('click', createNewNote);
  document.getElementById('btn-save-note')?.addEventListener('click', saveActiveNote);
  document.getElementById('btn-delete-note')?.addEventListener('click', deleteActiveNote);
  document.getElementById('btn-favorite-note')?.addEventListener('click', toggleNoteFavorite);
}

function createNewNote() {
  const note = { id: 'note_' + Date.now(), title: '', category: '', links: '', content: '', favorite: false, updatedAt: new Date().toISOString() };
  state.notes.unshift(note);
  activeNoteId = note.id;
  saveDataToStorage();
  selectNote(note.id);
}

function selectNote(id) {
  activeNoteId = id;
  const note = state.notes.find(n => n.id === id);
  if (!note) return;
  document.getElementById('note-editor-placeholder')?.classList.add('hidden');
  document.getElementById('note-editor-form')?.classList.remove('hidden');
  document.getElementById('note-id').value = note.id;
  document.getElementById('note-title').value = note.title || '';
  document.getElementById('note-category').value = note.category || '';
  document.getElementById('note-links').value = note.links || '';
  document.getElementById('note-content').value = note.content || '';
  updateFavoriteButton(note.favorite);
  renderNotesList();
}

function saveActiveNote() {
  if (!activeNoteId) return;
  const note = state.notes.find(n => n.id === activeNoteId);
  if (!note) return;
  note.title = document.getElementById('note-title').value.trim();
  note.category = document.getElementById('note-category').value.trim();
  note.links = document.getElementById('note-links').value.trim();
  note.content = document.getElementById('note-content').value.trim();
  note.updatedAt = new Date().toISOString();
  saveDataToStorage();
  alert('메모가 저장되었습니다.');
}

function deleteActiveNote() {
  if (!activeNoteId) return;
  if (!confirm('정말 이 메모를 삭제하시겠습니까?')) return;
  state.notes = state.notes.filter(n => n.id !== activeNoteId);
  activeNoteId = null;
  saveDataToStorage();
  document.getElementById('note-editor-placeholder')?.classList.remove('hidden');
  document.getElementById('note-editor-form')?.classList.add('hidden');
}

function toggleNoteFavorite() {
  if (!activeNoteId) return;
  const note = state.notes.find(n => n.id === activeNoteId);
  if (!note) return;
  note.favorite = !note.favorite;
  updateFavoriteButton(note.favorite);
  saveDataToStorage();
}

function updateFavoriteButton(isFavorite) {
  const btn = document.getElementById('btn-favorite-note');
  if (btn) btn.innerHTML = isFavorite ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
}

function renderNotesList() {
  const el = document.getElementById('notes-list-items');
  if (!el) return;
  el.innerHTML = '';
  if (!state.notes.length) {
    el.innerHTML = '<div class="no-data">메모가 없습니다.</div>';
    return;
  }
  [...state.notes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-item' + (note.id === activeNoteId ? ' active' : '');
    item.innerHTML = `
      <div class="note-item-title">${escapeHTML(note.title || '제목 없는 메모')}</div>
      <div class="note-item-preview">${escapeHTML(note.content || '')}</div>
      <div class="note-item-meta"><span class="note-item-category">${escapeHTML(note.category || '미분류')}</span><span>${formatShortDate(note.updatedAt)}</span></div>
      ${note.favorite ? '<i class="fa-solid fa-star note-item-star"></i>' : ''}`;
    item.addEventListener('click', () => selectNote(note.id));
    el.appendChild(item);
  });
}

// ==========================================
// SETTINGS & SYNC
// ==========================================

function initSettings() {
  const patInput = document.getElementById('github-pat');
  const gistIdInput = document.getElementById('github-gist-id');
  const syncForm = document.getElementById('github-sync-form');
  const syncNowBtn = document.getElementById('btn-sync-now');

  if (typeof GithubSync !== 'undefined') {
    const settings = GithubSync.getSettings();
    if (patInput && settings.pat) patInput.value = settings.pat;
    if (gistIdInput && settings.gistId) gistIdInput.value = settings.gistId;
    if (syncNowBtn && settings.pat) syncNowBtn.classList.remove('hidden');
  }

  syncForm?.addEventListener('submit', e => {
    e.preventDefault();
    const pat = patInput?.value.trim() || '';
    const gistId = gistIdInput?.value.trim() || '';
    if (!pat) return alert('GitHub PAT를 입력해주세요.');
    GithubSync.saveSettings(pat, gistId);
    syncNowBtn?.classList.remove('hidden');
    updateSyncIndicator();
    renderSyncLogBox();
    setMobileSyncStatus('동기화 설정 저장 완료', 'online');
    alert('동기화 설정이 저장되었습니다. 지금 동기화를 눌러주세요.');
  });

  syncNowBtn?.addEventListener('click', executeGitHubSync);

  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(getFullAppState(), null, 2));
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = `scheduler-backup-${getLocalDateString(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  const importBtn = document.getElementById('btn-trigger-import');
  const fileInput = document.getElementById('import-file-input');
  importBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target.result);
        if (confirm('백업 데이터를 불러오시겠습니까? 기존 로컬 데이터는 덮어씌워집니다.')) {
          restoreFullAppState(data);
          alert('데이터 복원이 완료되었습니다.');
        }
      } catch (err) {
        alert('유효하지 않은 JSON 파일입니다.');
      }
    };
    reader.readAsText(file);
  });
}

async function executeGitHubSync() {
  const syncNowBtn = document.getElementById('btn-sync-now');
  try {
    if (!GithubSync.isConfigured()) throw new Error('PAT가 저장되지 않았습니다.');
    if (syncNowBtn) syncNowBtn.disabled = true;
    setMobileSyncStatus('동기화 중...', 'syncing');

    const localData = getFullAppState();
    const localCount = countAppData(localData);
    const downloaded = await GithubSync.downloadData();

    if (downloaded.success && downloaded.data) {
      const remoteCount = countAppData(downloaded.data);
      if (localCount === 0 && remoteCount > 0) {
        restoreFullAppState(downloaded.data, { skipSync: true });
        setMobileSyncStatus(`다운로드 완료 | ${remoteCount}개 항목`, 'online');
        alert(`클라우드 데이터를 불러왔습니다. (${remoteCount}개 항목)`);
        updateSyncIndicator();
        renderSyncLogBox();
        return;
      }
    }

    const uploaded = await GithubSync.uploadData(localData);
    if (document.getElementById('github-gist-id') && uploaded.gistId) document.getElementById('github-gist-id').value = uploaded.gistId;
    setMobileSyncStatus(`업로드 완료 | ${countAppData(localData)}개 항목`, 'online');
    alert('동기화가 완료되었습니다.');
    updateSyncIndicator();
    renderSyncLogBox();
  } catch (err) {
    console.error(err);
    setMobileSyncStatus(`동기화 실패: ${err.message}`, 'error');
    alert(`동기화 실패: ${err.message}`);
  } finally {
    if (syncNowBtn) syncNowBtn.disabled = false;
  }
}

function updateSyncIndicator() {
  const indicator = document.getElementById('sidebar-sync-indicator');
  const text = document.getElementById('sidebar-sync-text');
  const configured = typeof GithubSync !== 'undefined' && GithubSync.isConfigured();
  if (indicator && text) {
    indicator.className = configured ? 'sync-status online' : 'sync-status offline';
    text.textContent = configured ? '클라우드 동기화' : '로컬 모드';
  }
  setMobileSyncStatus(configured ? '클라우드 동기화' : '로컬 모드 | PAT 필요', configured ? 'online' : 'offline');
}

function renderSyncLogBox() {
  const box = document.getElementById('sync-log-box');
  const link = document.getElementById('gist-url-link');
  const last = document.getElementById('last-sync-time');
  if (!box || typeof GithubSync === 'undefined') return;
  const settings = GithubSync.getSettings();
  if (!settings.pat) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  if (link) {
    link.href = settings.gistId ? `https://gist.github.com/${settings.gistId}` : '#';
    link.textContent = settings.gistId ? 'Gist 열기' : '새 Gist 생성 예정';
  }
  if (last) last.textContent = settings.lastSync ? new Date(settings.lastSync).toLocaleString('ko-KR') : '없음';
}

function ensureMobileSyncStatusBox() {
  let box = document.getElementById('mobile-sync-status-box');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'mobile-sync-status-box';
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:3000;display:none;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(17,14,36,.96);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);backdrop-filter:blur(10px);';
  box.innerHTML = `<span id="mobile-sync-status-text">로컬 모드</span><button type="button" id="mobile-sync-status-button" style="border:0;border-radius:9px;padding:7px 10px;background:#34d399;color:#06120d;font-weight:700;font-size:12px;">동기화</button>`;
  document.body.appendChild(box);
  document.getElementById('mobile-sync-status-button').addEventListener('click', executeGitHubSync);
  return box;
}

function setMobileSyncStatus(message, mode = 'offline') {
  const box = ensureMobileSyncStatusBox();
  const text = document.getElementById('mobile-sync-status-text');
  if (!box || !text) return;

  box.style.display = 'flex';
  text.textContent = message;

  const colors = {
    online: 'rgba(52,211,153,.20)',
    syncing: 'rgba(251,191,36,.22)',
    offline: 'rgba(255,255,255,.06)',
    error: 'rgba(248,113,113,.24)'
  };
  box.style.background = colors[mode] || colors.offline;

  // 기존 자동 숨김 타이머 제거
  if (window.__mobileSyncHideTimer) {
    clearTimeout(window.__mobileSyncHideTimer);
  }

  // 동기화 중/오류일 때는 계속 표시하여 상태 확인 가능
  if (mode === 'syncing' || mode === 'error') {
    return;
  }

  // 성공/로컬/온라인 상태는 3초 후 자동 숨김
  window.__mobileSyncHideTimer = setTimeout(() => {
    box.style.display = 'none';
  }, 3000);
}

// ==========================================
// HELPERS
// ==========================================

function getLocalDateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isDateInRange(dateStr, startDate, endDate) {
  if (!startDate) return false;
  return dateStr >= startDate && dateStr <= (endDate || startDate);
}

function compareEventsByTime(a, b) {
  const at = a.startTime || '99:99';
  const bt = b.startTime || '99:99';
  return at === bt ? (a.title || '').localeCompare(b.title || '') : at.localeCompare(bt);
}

function formatEventTime(evt) {
  if (evt.startTime && evt.endTime) return `${evt.startTime}~${evt.endTime} `;
  if (evt.startTime) return `${evt.startTime} `;
  return '';
}

function priorityLabel(priority) {
  if (priority === 'high') return '높음';
  if (priority === 'low') return '낮음';
  return '보통';
}

function formatShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
