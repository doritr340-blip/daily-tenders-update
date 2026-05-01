'use strict';

const STORAGE_KEYS = {
  entries: 'attendance:entries',
  active: 'attendance:active',
  ceoEmail: 'attendance:ceoEmail',
  employeeName: 'attendance:employeeName',
};

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const $ = (id) => document.getElementById(id);

const els = {
  liveClock: $('liveClock'),
  todayDate: $('todayDate'),
  statusValue: $('statusValue'),
  activeSinceLine: $('activeSinceLine'),
  activeSince: $('activeSince'),
  elapsedLine: $('elapsedLine'),
  elapsed: $('elapsed'),
  workTypes: $('workTypes'),
  workNote: $('workNote'),
  startBtn: $('startBtn'),
  stopBtn: $('stopBtn'),
  entriesBody: $('entriesBody'),
  totalPill: $('totalPill'),
  ceoEmail: $('ceoEmail'),
  employeeName: $('employeeName'),
  sendBtn: $('sendBtn'),
  previewBtn: $('previewBtn'),
  clearBtn: $('clearBtn'),
  exportBtn: $('exportBtn'),
  history: $('history'),
  previewModal: $('previewModal'),
  previewBody: $('previewBody'),
  modalClose: $('modalClose'),
};

let selectedWorkType = null;
let activeSession = null;
let entries = [];

// ---------- Storage ----------
function loadAll() {
  try {
    entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.entries) || '[]');
  } catch { entries = []; }
  try {
    activeSession = JSON.parse(localStorage.getItem(STORAGE_KEYS.active) || 'null');
  } catch { activeSession = null; }

  els.ceoEmail.value = localStorage.getItem(STORAGE_KEYS.ceoEmail) || '';
  els.employeeName.value = localStorage.getItem(STORAGE_KEYS.employeeName) || '';
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries));
}

function saveActive() {
  if (activeSession) {
    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(activeSession));
  } else {
    localStorage.removeItem(STORAGE_KEYS.active);
  }
}

// ---------- Time helpers ----------
function pad(n) { return String(n).padStart(2, '0'); }

function formatTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayKey() {
  return dateKey(Date.now());
}

function formatHebrewDate(ts) {
  const d = new Date(ts);
  return `יום ${DAYS_HE[d.getDay()]}, ${d.getDate()} ב${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------- Live clock ----------
function tickClock() {
  const now = Date.now();
  els.liveClock.textContent = formatTime(now);

  if (activeSession) {
    const elapsed = now - activeSession.startTs;
    els.elapsed.textContent = formatDuration(elapsed);
  }
}

// ---------- Work type selection ----------
function selectWorkType(type) {
  selectedWorkType = type;
  els.workTypes.querySelectorAll('.work-type-btn').forEach((btn) => {
    const isSelected = btn.dataset.type === type;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  });
  updateButtonsState();
}

function updateButtonsState() {
  const hasActive = !!activeSession;
  els.startBtn.disabled = hasActive || !selectedWorkType;
  els.stopBtn.disabled = !hasActive;
  els.workTypes.querySelectorAll('.work-type-btn').forEach((btn) => {
    btn.disabled = hasActive;
  });
}

// ---------- Start / Stop ----------
function startWork() {
  if (activeSession || !selectedWorkType) return;
  activeSession = {
    startTs: Date.now(),
    workType: selectedWorkType,
    note: els.workNote.value.trim(),
  };
  saveActive();
  renderStatus();
  renderEntries();
  updateButtonsState();
}

function stopWork() {
  if (!activeSession) return;
  const endTs = Date.now();
  const entry = {
    id: `${activeSession.startTs}-${Math.random().toString(36).slice(2, 7)}`,
    startTs: activeSession.startTs,
    endTs,
    workType: activeSession.workType,
    note: activeSession.note,
  };
  entries.push(entry);
  activeSession = null;
  els.workNote.value = '';
  saveEntries();
  saveActive();
  selectWorkType(null);
  renderStatus();
  renderEntries();
  renderHistory();
  updateButtonsState();
}

function deleteEntry(id) {
  if (!confirm('למחוק את הרישום הזה?')) return;
  entries = entries.filter((e) => e.id !== id);
  saveEntries();
  renderEntries();
  renderHistory();
}

// ---------- Render ----------
function renderStatus() {
  if (activeSession) {
    els.statusValue.textContent = `בעבודה: ${activeSession.workType}`;
    els.statusValue.classList.add('active');
    els.activeSince.textContent = formatTime(activeSession.startTs);
    els.activeSinceLine.hidden = false;
    els.elapsedLine.hidden = false;
  } else {
    els.statusValue.textContent = 'לא בעבודה';
    els.statusValue.classList.remove('active');
    els.activeSinceLine.hidden = true;
    els.elapsedLine.hidden = true;
  }
}

function todayEntries() {
  const tk = todayKey();
  return entries.filter((e) => dateKey(e.startTs) === tk);
}

function renderEntries() {
  const today = todayEntries();
  const rows = [];

  today.forEach((e) => {
    const dur = formatDuration(e.endTs - e.startTs);
    rows.push(`
      <tr>
        <td>${formatTime(e.startTs)}</td>
        <td>${formatTime(e.endTs)}</td>
        <td>${dur}</td>
        <td>${escapeHtml(e.workType)}</td>
        <td>${escapeHtml(e.note || '')}</td>
        <td><button class="delete-btn" data-del="${e.id}" title="מחק">🗑</button></td>
      </tr>
    `);
  });

  if (activeSession) {
    rows.push(`
      <tr class="active-row">
        <td>${formatTime(activeSession.startTs)}</td>
        <td>—</td>
        <td>פעיל...</td>
        <td>${escapeHtml(activeSession.workType)}</td>
        <td>${escapeHtml(activeSession.note || '')}</td>
        <td></td>
      </tr>
    `);
  }

  if (rows.length === 0) {
    els.entriesBody.innerHTML = '<tr class="empty"><td colspan="6">אין רישומים עדיין</td></tr>';
  } else {
    els.entriesBody.innerHTML = rows.join('');
  }

  const totalMs = today.reduce((sum, e) => sum + (e.endTs - e.startTs), 0)
    + (activeSession ? Date.now() - activeSession.startTs : 0);
  els.totalPill.textContent = `סה"כ: ${formatDuration(totalMs)}`;

  els.entriesBody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteEntry(btn.dataset.del));
  });
}

function renderHistory() {
  const byDay = {};
  entries.forEach((e) => {
    const k = dateKey(e.startTs);
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(e);
  });

  const tk = todayKey();
  const days = Object.keys(byDay).filter((k) => k !== tk).sort().reverse();

  if (days.length === 0) {
    els.history.innerHTML = '<div class="history-empty">אין היסטוריה עדיין</div>';
    return;
  }

  els.history.innerHTML = days.slice(0, 14).map((k) => {
    const dayEntries = byDay[k];
    const total = dayEntries.reduce((s, e) => s + (e.endTs - e.startTs), 0);
    const types = [...new Set(dayEntries.map((e) => e.workType))].join(', ');
    return `
      <div class="history-day">
        <div>
          <div class="date">${formatHebrewDate(dayEntries[0].startTs)}</div>
          <div class="summary">${dayEntries.length} רישומים · ${escapeHtml(types)}</div>
        </div>
        <div class="total">${formatDuration(total)}</div>
      </div>
    `;
  }).join('');
}

// ---------- Report ----------
function buildReportText() {
  const today = todayEntries().slice().sort((a, b) => a.startTs - b.startTs);
  const employee = els.employeeName.value.trim() || '(לא צוין)';
  const dateStr = formatHebrewDate(Date.now());

  if (today.length === 0) {
    return { subject: '', body: '', empty: true };
  }

  const totalMs = today.reduce((s, e) => s + (e.endTs - e.startTs), 0);
  const byType = {};
  today.forEach((e) => {
    byType[e.workType] = (byType[e.workType] || 0) + (e.endTs - e.startTs);
  });

  let body = '';
  body += `דו"ח נוכחות יומי\n`;
  body += `=================\n\n`;
  body += `שם העובד: ${employee}\n`;
  body += `תאריך: ${dateStr}\n\n`;
  body += `פירוט הרישומים:\n`;
  body += `─────────────────────────────────────────────────\n`;
  body += `התחלה   | סיום    | משך      | סוג עבודה | הערה\n`;
  body += `─────────────────────────────────────────────────\n`;
  today.forEach((e) => {
    const start = formatTime(e.startTs).slice(0, 5);
    const end = formatTime(e.endTs).slice(0, 5);
    const dur = formatDuration(e.endTs - e.startTs);
    body += `${start}   | ${end}   | ${dur} | ${e.workType}${e.note ? ' — ' + e.note : ''}\n`;
  });
  body += `─────────────────────────────────────────────────\n\n`;
  body += `סיכום לפי סוג עבודה:\n`;
  Object.entries(byType).forEach(([type, ms]) => {
    body += `  • ${type}: ${formatDuration(ms)}\n`;
  });
  body += `\nסה"כ זמן עבודה היום: ${formatDuration(totalMs)}\n`;

  const subject = `דו"ח נוכחות — ${employee} — ${dateStr}`;
  return { subject, body, empty: false };
}

function previewReport() {
  const r = buildReportText();
  if (r.empty) {
    els.previewBody.textContent = 'אין רישומים להיום עדיין.';
  } else {
    els.previewBody.textContent = `נושא: ${r.subject}\n\n${r.body}`;
  }
  els.previewModal.hidden = false;
}

function sendReport() {
  const ceo = els.ceoEmail.value.trim();
  if (!ceo) {
    alert('יש להזין את האימייל של המנכ"ל לפני שליחה.');
    els.ceoEmail.focus();
    return;
  }
  const r = buildReportText();
  if (r.empty) {
    alert('אין רישומים להיום - אין מה לשלוח.');
    return;
  }

  localStorage.setItem(STORAGE_KEYS.ceoEmail, ceo);
  localStorage.setItem(STORAGE_KEYS.employeeName, els.employeeName.value.trim());

  const url = `mailto:${encodeURIComponent(ceo)}`
    + `?subject=${encodeURIComponent(r.subject)}`
    + `&body=${encodeURIComponent(r.body)}`;
  window.location.href = url;
}

function clearToday() {
  if (!confirm('למחוק את כל הרישומים של היום? פעולה זו אינה הפיכה.')) return;
  const tk = todayKey();
  entries = entries.filter((e) => dateKey(e.startTs) !== tk);
  saveEntries();
  renderEntries();
  renderHistory();
}

function exportCSV() {
  if (entries.length === 0) {
    alert('אין נתונים לייצוא.');
    return;
  }
  const header = ['תאריך', 'התחלה', 'סיום', 'משך', 'סוג עבודה', 'הערה'];
  const rows = entries.slice().sort((a, b) => a.startTs - b.startTs).map((e) => {
    const d = new Date(e.startTs);
    return [
      `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      formatTime(e.startTs),
      formatTime(e.endTs),
      formatDuration(e.endTs - e.startTs),
      e.workType,
      e.note || '',
    ];
  });
  const csv = '﻿' + [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `attendance-${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ---------- Utils ----------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Init ----------
function init() {
  loadAll();

  els.todayDate.textContent = formatHebrewDate(Date.now());

  els.workTypes.querySelectorAll('.work-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activeSession) return;
      selectWorkType(btn.dataset.type);
    });
  });

  els.startBtn.addEventListener('click', startWork);
  els.stopBtn.addEventListener('click', stopWork);
  els.sendBtn.addEventListener('click', sendReport);
  els.previewBtn.addEventListener('click', previewReport);
  els.clearBtn.addEventListener('click', clearToday);
  els.exportBtn.addEventListener('click', exportCSV);
  els.modalClose.addEventListener('click', () => { els.previewModal.hidden = true; });
  els.previewModal.addEventListener('click', (e) => {
    if (e.target === els.previewModal) els.previewModal.hidden = true;
  });

  [els.ceoEmail, els.employeeName].forEach((input) => {
    input.addEventListener('change', () => {
      localStorage.setItem(
        input === els.ceoEmail ? STORAGE_KEYS.ceoEmail : STORAGE_KEYS.employeeName,
        input.value.trim()
      );
    });
  });

  if (activeSession) {
    selectedWorkType = activeSession.workType;
    selectWorkType(activeSession.workType);
  }

  renderStatus();
  renderEntries();
  renderHistory();
  updateButtonsState();
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(() => { if (activeSession) renderEntries(); }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
