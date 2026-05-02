'use strict';

const STORAGE_KEYS = {
  entries: 'attendance:entries',
  active: 'attendance:active',
  ceoEmail: 'attendance:ceoEmail',
  employeeName: 'attendance:employeeName',
  dailyNotes: 'attendance:dailyNotes',
};

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const CATEGORIES = [
  { key: 'גזירים',   label: 'גזירים',           icon: '✂️', qty: { count: 'כמות גזירים' } },
  { key: 'הקלדות',   label: 'הקלדות',           icon: '⌨️', qty: { count: 'כמות מכרזים' } },
  { key: 'כתבות',    label: 'כתיבת כתבות',      icon: '📝', qty: { count: 'מספר כתבות', words: 'מספר מילים' } },
  { key: 'זומים',    label: 'זומים / שיחות',    icon: '📞', qty: {} },
];

const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

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
  startBtn: $('startBtn'),
  stopBtn: $('stopBtn'),
  summaryBody: $('summaryBody'),
  entriesBody: $('entriesBody'),
  totalPill: $('totalPill'),
  dailyNotes: $('dailyNotes'),
  ceoEmail: $('ceoEmail'),
  employeeName: $('employeeName'),
  sendBtn: $('sendBtn'),
  downloadBtn: $('downloadBtn'),
  previewBtn: $('previewBtn'),
  exportMonthBtn: $('exportMonthBtn'),
  clearBtn: $('clearBtn'),
  history: $('history'),
  quantityModal: $('quantityModal'),
  quantityTitle: $('quantityTitle'),
  quantityFields: $('quantityFields'),
  quantitySave: $('quantitySave'),
  quantityCancel: $('quantityCancel'),
  quantityClose: $('quantityClose'),
  previewModal: $('previewModal'),
  previewBody: $('previewBody'),
  modalClose: $('modalClose'),
};

let selectedWorkType = null;
let activeSession = null;
let entries = [];
let pendingEntry = null;

// ---------- Storage ----------
function loadAll() {
  try { entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.entries) || '[]'); }
  catch { entries = []; }
  try { activeSession = JSON.parse(localStorage.getItem(STORAGE_KEYS.active) || 'null'); }
  catch { activeSession = null; }

  els.ceoEmail.value = localStorage.getItem(STORAGE_KEYS.ceoEmail) || '';
  els.employeeName.value = localStorage.getItem(STORAGE_KEYS.employeeName) || '';
  els.dailyNotes.value = getDailyNotes(todayKey());
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

function getAllDailyNotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyNotes) || '{}'); }
  catch { return {}; }
}
function getDailyNotes(dayKey) {
  return getAllDailyNotes()[dayKey] || '';
}
function setDailyNotes(dayKey, text) {
  const all = getAllDailyNotes();
  if (text) all[dayKey] = text;
  else delete all[dayKey];
  localStorage.setItem(STORAGE_KEYS.dailyNotes, JSON.stringify(all));
}

// ---------- Time helpers ----------
function pad(n) { return String(n).padStart(2, '0'); }

function formatHM(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatHMS(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function hoursDecimal(ms) {
  return (ms / 3600000);
}
function formatHoursDecimal(ms) {
  const h = hoursDecimal(ms);
  return h.toFixed(2);
}
function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayKey() { return dateKey(Date.now()); }

function formatHebrewDate(ts) {
  const d = new Date(ts);
  return `יום ${DAYS_HE[d.getDay()]}, ${d.getDate()} ב${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}
function formatShortDate(ts) {
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function formatDayName(ts) {
  return DAYS_HE[new Date(ts).getDay()];
}

// ---------- Live clock ----------
function tickClock() {
  const now = Date.now();
  els.liveClock.textContent = formatHMS(now);

  if (activeSession) {
    const elapsed = now - activeSession.startTs;
    els.elapsed.textContent = formatDuration(elapsed);
  }
}

// ---------- Work type ----------
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
  };
  saveActive();
  renderStatus();
  renderAll();
  updateButtonsState();
}

function stopWork() {
  if (!activeSession) return;
  const endTs = Date.now();
  pendingEntry = {
    id: `${activeSession.startTs}-${Math.random().toString(36).slice(2, 7)}`,
    startTs: activeSession.startTs,
    endTs,
    workType: activeSession.workType,
    qty: {},
    note: '',
  };
  activeSession = null;
  saveActive();
  renderStatus();
  updateButtonsState();
  openQuantityModal();
}

function deleteEntry(id) {
  if (!confirm('למחוק את הרישום הזה?')) return;
  entries = entries.filter((e) => e.id !== id);
  saveEntries();
  renderAll();
}

// ---------- Quantity modal ----------
function openQuantityModal() {
  if (!pendingEntry) return;
  const cat = CAT_BY_KEY[pendingEntry.workType];
  els.quantityTitle.textContent = `סיום סשן: ${cat.icon} ${cat.label}`;

  const html = [];
  Object.entries(cat.qty).forEach(([field, label]) => {
    html.push(`
      <div class="qty-field">
        <label for="qty_${field}">${escapeHtml(label)}</label>
        <input type="number" min="0" step="1" id="qty_${field}" class="input" placeholder="0" />
      </div>
    `);
  });
  html.push(`
    <div class="qty-field">
      <label for="qty_note">הערה (לא חובה)</label>
      <input type="text" id="qty_note" class="input" placeholder="פרטים נוספים..." />
    </div>
  `);
  els.quantityFields.innerHTML = html.join('');
  els.quantityModal.hidden = false;

  setTimeout(() => {
    const first = els.quantityFields.querySelector('input');
    if (first) first.focus();
  }, 50);
}

function saveQuantityAndClose() {
  if (!pendingEntry) {
    els.quantityModal.hidden = true;
    return;
  }
  const cat = CAT_BY_KEY[pendingEntry.workType];
  const qty = {};
  Object.keys(cat.qty).forEach((field) => {
    const input = $(`qty_${field}`);
    const v = input ? input.value.trim() : '';
    qty[field] = v === '' ? null : Number(v);
  });
  const noteInput = $('qty_note');
  pendingEntry.qty = qty;
  pendingEntry.note = noteInput ? noteInput.value.trim() : '';

  entries.push(pendingEntry);
  pendingEntry = null;
  saveEntries();
  selectWorkType(null);
  els.quantityModal.hidden = true;
  renderAll();
}

function skipQuantityAndClose() {
  if (pendingEntry) {
    entries.push(pendingEntry);
    pendingEntry = null;
    saveEntries();
  }
  selectWorkType(null);
  els.quantityModal.hidden = true;
  renderAll();
}

// ---------- Aggregation ----------
function entriesForDay(dKey) {
  return entries.filter((e) => dateKey(e.startTs) === dKey)
    .sort((a, b) => a.startTs - b.startTs);
}

function summarizeDay(dKey) {
  const dayEntries = entriesForDay(dKey);
  const summary = {};
  CATEGORIES.forEach((c) => {
    summary[c.key] = {
      category: c,
      sessions: [],
      totalMs: 0,
      qty: {},
      notes: [],
    };
  });

  dayEntries.forEach((e) => {
    const s = summary[e.workType];
    if (!s) return;
    s.sessions.push(e);
    s.totalMs += (e.endTs - e.startTs);
    Object.entries(e.qty || {}).forEach(([field, val]) => {
      if (val == null || isNaN(val)) return;
      s.qty[field] = (s.qty[field] || 0) + Number(val);
    });
    if (e.note) s.notes.push(e.note);
  });

  let totalMs = 0;
  let tendersHoursMs = 0;
  let articlesHoursMs = 0;
  Object.values(summary).forEach((s) => {
    totalMs += s.totalMs;
    if (s.category.key === 'הקלדות' || s.category.key === 'גזירים') tendersHoursMs += s.totalMs;
    if (s.category.key === 'כתבות') articlesHoursMs += s.totalMs;
  });

  return { dKey, summary, totalMs, tendersHoursMs, articlesHoursMs };
}

function categoryRange(s) {
  if (s.sessions.length === 0) return { start: null, end: null };
  const start = s.sessions[0].startTs;
  const end = s.sessions[s.sessions.length - 1].endTs;
  return { start, end };
}

function categoryQtyText(s) {
  const cat = s.category;
  const parts = [];
  if (cat.qty.count != null) {
    const c = s.qty.count;
    if (c) parts.push(`${c} ${cat.key === 'גזירים' ? 'גזירים' : cat.key === 'הקלדות' ? 'מכרזים' : 'כתבות'}`);
  }
  if (cat.qty.words != null) {
    const w = s.qty.words;
    if (w) parts.push(`${w} מילים`);
  }
  return parts.join(', ');
}

// ---------- Render ----------
function renderStatus() {
  if (activeSession) {
    const cat = CAT_BY_KEY[activeSession.workType];
    els.statusValue.textContent = `בעבודה: ${cat ? cat.icon + ' ' + cat.label : activeSession.workType}`;
    els.statusValue.classList.add('active');
    els.activeSince.textContent = formatHM(activeSession.startTs);
    els.activeSinceLine.hidden = false;
    els.elapsedLine.hidden = false;
  } else {
    els.statusValue.textContent = 'לא בעבודה';
    els.statusValue.classList.remove('active');
    els.activeSinceLine.hidden = true;
    els.elapsedLine.hidden = true;
  }
}

function renderSummary() {
  const { summary, totalMs } = summarizeDay(todayKey());
  const rows = [];

  CATEGORIES.forEach((c) => {
    const s = summary[c.key];
    const isLive = activeSession && activeSession.workType === c.key;
    const hasData = s.sessions.length > 0 || isLive;

    let startLabel = '—';
    let endLabel = '—';
    let durLabel = '—';

    if (s.sessions.length > 0) {
      const r = categoryRange(s);
      startLabel = formatHM(r.start);
      endLabel = formatHM(r.end);
      const liveMs = isLive ? Date.now() - activeSession.startTs : 0;
      durLabel = formatHoursDecimal(s.totalMs + liveMs) + ' ש׳';
    } else if (isLive) {
      startLabel = formatHM(activeSession.startTs);
      endLabel = 'פעיל...';
      durLabel = formatHoursDecimal(Date.now() - activeSession.startTs) + ' ש׳';
    }

    const qtyText = categoryQtyText(s);
    const notesText = s.notes.join(' · ');

    rows.push(`
      <tr class="${hasData ? '' : 'empty-row'}">
        <td><span class="cat-label">${c.icon} ${escapeHtml(c.label)}</span></td>
        <td>${startLabel}</td>
        <td>${endLabel}</td>
        <td>${durLabel}</td>
        <td>${escapeHtml(qtyText) || '—'}</td>
        <td>${escapeHtml(notesText) || '—'}</td>
      </tr>
    `);
  });

  els.summaryBody.innerHTML = rows.join('');

  const liveMs = activeSession ? Date.now() - activeSession.startTs : 0;
  els.totalPill.textContent = `סה"כ שעות: ${formatHoursDecimal(totalMs + liveMs)}`;
}

function renderEntries() {
  const today = entriesForDay(todayKey());
  const rows = [];

  today.forEach((e) => {
    const cat = CAT_BY_KEY[e.workType];
    const dur = formatDuration(e.endTs - e.startTs);
    const qtyParts = [];
    if (e.qty?.count != null) qtyParts.push(`${e.qty.count}`);
    if (e.qty?.words != null) qtyParts.push(`${e.qty.words} מילים`);
    rows.push(`
      <tr>
        <td>${cat ? cat.icon : ''} ${escapeHtml(e.workType)}</td>
        <td>${formatHM(e.startTs)}</td>
        <td>${formatHM(e.endTs)}</td>
        <td>${dur}</td>
        <td>${qtyParts.join(', ') || '—'}</td>
        <td>${escapeHtml(e.note || '')}</td>
        <td><button class="delete-btn" data-del="${e.id}" title="מחק">🗑</button></td>
      </tr>
    `);
  });

  if (activeSession) {
    const cat = CAT_BY_KEY[activeSession.workType];
    rows.push(`
      <tr class="active-row">
        <td>${cat ? cat.icon : ''} ${escapeHtml(activeSession.workType)}</td>
        <td>${formatHM(activeSession.startTs)}</td>
        <td>—</td>
        <td>פעיל...</td>
        <td>—</td>
        <td>—</td>
        <td></td>
      </tr>
    `);
  }

  if (rows.length === 0) {
    els.entriesBody.innerHTML = '<tr class="empty"><td colspan="7">אין רישומים עדיין</td></tr>';
  } else {
    els.entriesBody.innerHTML = rows.join('');
    els.entriesBody.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => deleteEntry(btn.dataset.del));
    });
  }
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

  els.history.innerHTML = days.slice(0, 30).map((k) => {
    const dayEntries = byDay[k];
    const total = dayEntries.reduce((s, e) => s + (e.endTs - e.startTs), 0);
    const types = [...new Set(dayEntries.map((e) => CAT_BY_KEY[e.workType]?.icon || ''))]
      .filter(Boolean).join(' ');
    return `
      <div class="history-day">
        <div>
          <div class="date">${formatHebrewDate(dayEntries[0].startTs)}</div>
          <div class="summary">${types} · ${dayEntries.length} סשנים</div>
        </div>
        <div class="total">${formatHoursDecimal(total)} ש׳</div>
      </div>
    `;
  }).join('');
}

function renderAll() {
  renderStatus();
  renderSummary();
  renderEntries();
  renderHistory();
}

// ---------- Report (Drive-format) ----------
const REPORT_HEADERS = [
  'יום',
  'תאריך',
  'סה"כ שעות יומי',
  'גזירים- התחלה',
  'גזירים- סיום',
  'כמות הגזירים',
  'הקלדות- התחלה',
  'הקלדות- סיום',
  'כמות מכרזים',
  'כתבות- התחלה',
  'כתבות- סיום',
  'כמות כתבות ומספר המילים הכולל שלהן',
  'שיחות/זומים- התחלה',
  'שיחות/זומים- סיום',
  'הערות',
];

function buildReportRow(dKey) {
  const { summary, totalMs } = summarizeDay(dKey);
  const sample = entriesForDay(dKey)[0];
  const baseTs = sample ? sample.startTs : new Date(dKey).getTime();
  const dailyNote = getDailyNotes(dKey);

  const row = {};
  row['יום'] = formatDayName(baseTs);
  row['תאריך'] = formatShortDate(baseTs);
  row['סה"כ שעות יומי'] = totalMs > 0 ? formatHoursDecimal(totalMs) : '';

  const fillCategory = (catKey, startCol, endCol, qtyCol, qtyTextFn) => {
    const s = summary[catKey];
    if (s.sessions.length === 0) {
      row[startCol] = ''; row[endCol] = ''; row[qtyCol] = '';
      return;
    }
    const r = categoryRange(s);
    row[startCol] = formatHM(r.start);
    row[endCol] = formatHM(r.end);
    row[qtyCol] = qtyTextFn(s);
  };

  fillCategory('גזירים', 'גזירים- התחלה', 'גזירים- סיום', 'כמות הגזירים',
    (s) => s.qty.count != null ? String(s.qty.count) : '');
  fillCategory('הקלדות', 'הקלדות- התחלה', 'הקלדות- סיום', 'כמות מכרזים',
    (s) => s.qty.count != null ? String(s.qty.count) : '');
  fillCategory('כתבות', 'כתבות- התחלה', 'כתבות- סיום', 'כמות כתבות ומספר המילים הכולל שלהן',
    (s) => {
      const parts = [];
      if (s.qty.count != null) parts.push(`${s.qty.count} כתבות`);
      if (s.qty.words != null) parts.push(`${s.qty.words} מילים`);
      const sessionNotes = s.notes.join(' · ');
      if (sessionNotes) parts.push(sessionNotes);
      return parts.join(', ');
    });
  fillCategory('זומים', 'שיחות/זומים- התחלה', 'שיחות/זומים- סיום', 'שיחות/זומים-הערה-internal',
    () => '');

  const zoomNotes = summary['זומים'].notes.join(' · ');
  const allNotes = [dailyNote, zoomNotes].filter(Boolean).join(' · ');
  row['הערות'] = allNotes;
  delete row['שיחות/זומים-הערה-internal'];

  return row;
}

function buildReportCSV(rows, includeTotals) {
  const headers = REPORT_HEADERS.slice();
  const body = rows.map((row) => headers.map((h) => row[h] || ''));

  if (includeTotals && rows.length > 0) {
    const totalTendersMs = rows.reduce((acc, _, i) => acc + summarizeDay(rows[i].__dKey).tendersHoursMs, 0);
    const totalArticlesMs = rows.reduce((acc, _, i) => acc + summarizeDay(rows[i].__dKey).articlesHoursMs, 0);
    const totalsRow = new Array(headers.length).fill('');
    totalsRow[0] = 'סה"כ';
    totalsRow[2] = formatHoursDecimal(totalTendersMs + totalArticlesMs);
    body.push(totalsRow);
    const labelRow = new Array(headers.length).fill('');
    labelRow[0] = 'מכרזים+גזירים';
    labelRow[2] = formatHoursDecimal(totalTendersMs);
    body.push(labelRow);
    const articlesRow = new Array(headers.length).fill('');
    articlesRow[0] = 'כתבות';
    articlesRow[2] = formatHoursDecimal(totalArticlesMs);
    body.push(articlesRow);
  }

  const csvLines = [headers, ...body].map((r) =>
    r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
  );
  return '﻿' + csvLines.join('\n');
}

function buildReportHTMLTable(rows) {
  const headerHtml = REPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const bodyHtml = rows.map((row) =>
    '<tr>' + REPORT_HEADERS.map((h) => `<td>${escapeHtml(row[h] || '')}</td>`).join('') + '</tr>'
  ).join('');
  return `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  `;
}

function buildReportPlainText(rows) {
  const lines = [];
  rows.forEach((row) => {
    lines.push(`${row['יום']} ${row['תאריך']} — סה"כ ${row['סה"כ שעות יומי']} ש׳`);
    if (row['גזירים- התחלה']) {
      lines.push(`  ✂️ גזירים: ${row['גזירים- התחלה']}-${row['גזירים- סיום']} (${row['כמות הגזירים']})`);
    }
    if (row['הקלדות- התחלה']) {
      lines.push(`  ⌨️ הקלדות: ${row['הקלדות- התחלה']}-${row['הקלדות- סיום']} (${row['כמות מכרזים']} מכרזים)`);
    }
    if (row['כתבות- התחלה']) {
      lines.push(`  📝 כתבות: ${row['כתבות- התחלה']}-${row['כתבות- סיום']} (${row['כמות כתבות ומספר המילים הכולל שלהן']})`);
    }
    if (row['שיחות/זומים- התחלה']) {
      lines.push(`  📞 זומים: ${row['שיחות/זומים- התחלה']}-${row['שיחות/זומים- סיום']}`);
    }
    if (row['הערות']) lines.push(`  📌 הערות: ${row['הערות']}`);
  });
  return lines.join('\n');
}

function getReportRowsForToday() {
  const tk = todayKey();
  const row = buildReportRow(tk);
  row.__dKey = tk;
  return [row];
}

// ---------- Actions ----------
function downloadDailyReport() {
  const rows = getReportRowsForToday();
  if (!rows[0]['סה"כ שעות יומי']) {
    if (!confirm('אין רישומים להיום. להוריד דו"ח ריק בכל זאת?')) return;
  }
  const csv = buildReportCSV(rows, false);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `attendance-${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportMonth() {
  const allDays = [...new Set(entries.map((e) => dateKey(e.startTs)))].sort();
  if (allDays.length === 0) {
    alert('אין נתונים לייצוא.');
    return;
  }
  const rows = allDays.map((k) => {
    const r = buildReportRow(k);
    r.__dKey = k;
    return r;
  });
  const csv = buildReportCSV(rows, true);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `attendance-full-${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function previewReport() {
  const rows = getReportRowsForToday();
  const employee = els.employeeName.value.trim() || '(לא צוין)';
  const dateStr = formatHebrewDate(Date.now());

  if (!rows[0]['סה"כ שעות יומי']) {
    els.previewBody.innerHTML = '<p>אין רישומים להיום עדיין.</p>';
  } else {
    els.previewBody.innerHTML = `
      <p><strong>שם העובד:</strong> ${escapeHtml(employee)}</p>
      <p><strong>תאריך:</strong> ${escapeHtml(dateStr)}</p>
      ${buildReportHTMLTable(rows)}
    `;
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
  const rows = getReportRowsForToday();
  if (!rows[0]['סה"כ שעות יומי']) {
    alert('אין רישומים להיום - אין מה לשלוח.');
    return;
  }

  localStorage.setItem(STORAGE_KEYS.ceoEmail, ceo);
  localStorage.setItem(STORAGE_KEYS.employeeName, els.employeeName.value.trim());

  const employee = els.employeeName.value.trim() || '(לא צוין)';
  const dateStr = formatHebrewDate(Date.now());
  const subject = `דו"ח נוכחות יומי — ${employee} — ${dateStr}`;

  const body = `שלום,

מצורף דו"ח הנוכחות שלי להיום (${dateStr}):

${buildReportPlainText(rows)}

קובץ CSV מצורף הורד מקומית. ניתן לפתוח ב-Excel / Google Sheets ולהדביק לטבלה.

תודה,
${employee}
`;

  const url = `mailto:${encodeURIComponent(ceo)}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`;

  downloadDailyReport();
  setTimeout(() => { window.location.href = url; }, 200);
}

function clearToday() {
  if (!confirm('למחוק את כל הרישומים של היום? פעולה זו אינה הפיכה.')) return;
  const tk = todayKey();
  entries = entries.filter((e) => dateKey(e.startTs) !== tk);
  saveEntries();
  setDailyNotes(tk, '');
  els.dailyNotes.value = '';
  renderAll();
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
  els.downloadBtn.addEventListener('click', downloadDailyReport);
  els.previewBtn.addEventListener('click', previewReport);
  els.exportMonthBtn.addEventListener('click', exportMonth);
  els.clearBtn.addEventListener('click', clearToday);

  els.modalClose.addEventListener('click', () => { els.previewModal.hidden = true; });
  els.previewModal.addEventListener('click', (e) => {
    if (e.target === els.previewModal) els.previewModal.hidden = true;
  });
  els.quantityClose.addEventListener('click', skipQuantityAndClose);
  els.quantityCancel.addEventListener('click', skipQuantityAndClose);
  els.quantitySave.addEventListener('click', saveQuantityAndClose);
  els.quantityModal.addEventListener('click', (e) => {
    if (e.target === els.quantityModal) skipQuantityAndClose();
  });

  els.ceoEmail.addEventListener('change', () => {
    localStorage.setItem(STORAGE_KEYS.ceoEmail, els.ceoEmail.value.trim());
  });
  els.employeeName.addEventListener('change', () => {
    localStorage.setItem(STORAGE_KEYS.employeeName, els.employeeName.value.trim());
  });
  els.dailyNotes.addEventListener('change', () => {
    setDailyNotes(todayKey(), els.dailyNotes.value.trim());
  });

  if (activeSession) {
    selectedWorkType = activeSession.workType;
    selectWorkType(activeSession.workType);
  }

  renderAll();
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(() => { if (activeSession) renderSummary(); }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
