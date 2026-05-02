'use strict';

const STORAGE_KEYS = {
  entries: 'attendance:entries',
  active: 'attendance:active',
  ceoEmail: 'attendance:ceoEmail',
  accountingEmail: 'attendance:accountingEmail',
  employeeName: 'attendance:employeeName',
  employeeId: 'attendance:employeeId',
  hourlyRate: 'attendance:hourlyRate',
  vatPercent: 'attendance:vatPercent',
  dailyNotes: 'attendance:dailyNotes',
  installDismissed: 'attendance:installDismissed',
  notificationsEnabled: 'attendance:notificationsEnabled',
  lastReminderDay: 'attendance:lastReminderDay',
  lastMonthlyReminder: 'attendance:lastMonthlyReminder',
  welcomeDone: 'attendance:welcomeDone',
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
  statusHeadline: $('statusHeadline'),
  statusDetail: $('statusDetail'),
  workTypes: $('workTypes'),
  startBtn: $('startBtn'),
  stopBtn: $('stopBtn'),
  summaryBody: $('summaryBody'),
  totalPill: $('totalPill'),
  dailyNotes: $('dailyNotes'),
  ceoEmail: $('ceoEmail'),
  accountingEmail: $('accountingEmail'),
  employeeName: $('employeeName'),
  employeeId: $('employeeId'),
  hourlyRate: $('hourlyRate'),
  vatPercent: $('vatPercent'),
  sendBtn: $('sendBtn'),
  downloadDailyBtn: $('downloadDailyBtn'),
  previewBtn: $('previewBtn'),
  monthSelect: $('monthSelect'),
  monthSummary: $('monthSummary'),
  sendMonthBtn: $('sendMonthBtn'),
  downloadMonthBtn: $('downloadMonthBtn'),
  previewMonthBtn: $('previewMonthBtn'),
  printInvoiceBtn: $('printInvoiceBtn'),
  clearBtn: $('clearBtn'),
  installBanner: $('installBanner'),
  installBtn: $('installBtn'),
  installDismiss: $('installDismiss'),
  history: $('history'),
  notificationsEnabled: $('notificationsEnabled'),
  notificationsHint: $('notificationsHint'),
  welcomeModal: $('welcomeModal'),
  welcomeName: $('welcomeName'),
  welcomeCeo: $('welcomeCeo'),
  welcomeRate: $('welcomeRate'),
  welcomeSave: $('welcomeSave'),
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
  els.accountingEmail.value = localStorage.getItem(STORAGE_KEYS.accountingEmail) || '';
  els.employeeName.value = localStorage.getItem(STORAGE_KEYS.employeeName) || '';
  els.employeeId.value = localStorage.getItem(STORAGE_KEYS.employeeId) || '';
  els.hourlyRate.value = localStorage.getItem(STORAGE_KEYS.hourlyRate) || '';
  els.vatPercent.value = localStorage.getItem(STORAGE_KEYS.vatPercent) || '';
  els.dailyNotes.value = getDailyNotes(todayKey());
}

function getHourlyRate() {
  const v = parseFloat(els.hourlyRate.value);
  return isNaN(v) ? 0 : v;
}
function getVatPercent() {
  const v = parseFloat(els.vatPercent.value);
  return isNaN(v) ? 0 : v;
}
function formatMoney(amount) {
  return amount.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ₪';
}
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function currentMonthKey() {
  return monthKey(Date.now());
}
function formatHebrewMonth(mKey) {
  const [year, month] = mKey.split('-').map(Number);
  return `${MONTHS_HE[month - 1]} ${year}`;
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
    const label = cat ? `${cat.icon} ${cat.label}` : activeSession.workType;
    els.statusHeadline.textContent = `בעבודה: ${label}`;
    els.statusHeadline.classList.add('active');
    const elapsed = Date.now() - activeSession.startTs;
    els.statusDetail.textContent = `החל מ-${formatHM(activeSession.startTs)} · ${formatDuration(elapsed)}`;
  } else {
    els.statusHeadline.textContent = 'לא בעבודה';
    els.statusHeadline.classList.remove('active');
    els.statusDetail.textContent = 'בחרי סוג עבודה ולחצי "התחל"';
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

    rows.push(`
      <tr class="${hasData ? '' : 'empty-row'}">
        <td><span class="cat-label">${c.icon} ${escapeHtml(c.label)}</span></td>
        <td>${startLabel}</td>
        <td>${endLabel}</td>
        <td>${durLabel}</td>
        <td>${escapeHtml(qtyText) || '—'}</td>
      </tr>
    `);
  });

  els.summaryBody.innerHTML = rows.join('');

  const liveMs = activeSession ? Date.now() - activeSession.startTs : 0;
  els.totalPill.textContent = `סה"כ: ${formatHoursDecimal(totalMs + liveMs)} ש׳`;
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

  saveAllSettings();

  const employee = els.employeeName.value.trim() || '(לא צוין)';
  const dateStr = formatHebrewDate(Date.now());
  const subject = `דו"ח נוכחות יומי — ${employee} — ${dateStr}`;

  const body = `שלום,

מצורף דו"ח הנוכחות שלי להיום (${dateStr}):

${buildReportPlainText(rows)}

קובץ CSV מצורף הורד מקומית.

תודה,
${employee}
`;

  const url = `mailto:${encodeURIComponent(ceo)}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`;

  downloadDailyReport();
  setTimeout(() => { window.location.href = url; }, 200);
}

// ---------- Monthly report ----------
function entriesInMonth(mKey) {
  return entries.filter((e) => monthKey(e.startTs) === mKey);
}

function summarizeMonth(mKey) {
  const monthEntries = entriesInMonth(mKey);
  const days = [...new Set(monthEntries.map((e) => dateKey(e.startTs)))].sort();

  const totals = {
    totalMs: 0,
    tendersHoursMs: 0,
    articlesHoursMs: 0,
    byCategory: {},
  };
  CATEGORIES.forEach((c) => {
    totals.byCategory[c.key] = { totalMs: 0, count: 0, words: 0 };
  });

  days.forEach((d) => {
    const sd = summarizeDay(d);
    totals.totalMs += sd.totalMs;
    totals.tendersHoursMs += sd.tendersHoursMs;
    totals.articlesHoursMs += sd.articlesHoursMs;
    Object.entries(sd.summary).forEach(([key, s]) => {
      totals.byCategory[key].totalMs += s.totalMs;
      if (s.qty.count) totals.byCategory[key].count += s.qty.count;
      if (s.qty.words) totals.byCategory[key].words += s.qty.words;
    });
  });

  const hourlyRate = getHourlyRate();
  const vatPercent = getVatPercent();
  const totalHours = hoursDecimal(totals.totalMs);
  const subtotal = totalHours * hourlyRate;
  const vatAmount = subtotal * (vatPercent / 100);
  const grandTotal = subtotal + vatAmount;

  return {
    mKey,
    days,
    daysCount: days.length,
    ...totals,
    totalHours,
    hourlyRate,
    vatPercent,
    subtotal,
    vatAmount,
    grandTotal,
  };
}

function getReportRowsForMonth(mKey) {
  const days = [...new Set(entriesInMonth(mKey).map((e) => dateKey(e.startTs)))].sort();
  return days.map((k) => {
    const r = buildReportRow(k);
    r.__dKey = k;
    return r;
  });
}

function buildMonthCSV(mKey) {
  const rows = getReportRowsForMonth(mKey);
  const sm = summarizeMonth(mKey);
  const employee = els.employeeName.value.trim();
  const employeeId = els.employeeId.value.trim();

  const csv = buildReportCSV(rows, false);
  const lines = [csv];

  const trailer = [];
  trailer.push('');
  trailer.push(`"דו""ח חודשי","${formatHebrewMonth(mKey)}"`);
  if (employee) trailer.push(`"שם העובד","${employee}"`);
  if (employeeId) trailer.push(`"ת.ז. / מס׳ עוסק","${employeeId}"`);
  trailer.push(`"ימי עבודה","${sm.daysCount}"`);
  trailer.push('');
  trailer.push('"פירוט לפי קטגוריה:"');
  trailer.push('"קטגוריה","שעות","כמות","מילים"');
  CATEGORIES.forEach((c) => {
    const cs = sm.byCategory[c.key];
    trailer.push(
      `"${c.label}","${formatHoursDecimal(cs.totalMs)}","${cs.count || ''}","${cs.words || ''}"`
    );
  });
  trailer.push('');
  trailer.push('"סיכום חודשי:"');
  trailer.push(`"סה""כ שעות","${formatHoursDecimal(sm.totalMs)}"`);
  trailer.push(`"שעות מכרזים+גזירים","${formatHoursDecimal(sm.tendersHoursMs)}"`);
  trailer.push(`"שעות כתבות","${formatHoursDecimal(sm.articlesHoursMs)}"`);
  if (sm.hourlyRate > 0) {
    trailer.push(`"תעריף שעתי","${sm.hourlyRate.toFixed(2)} ₪"`);
    trailer.push(`"סכום לפני מע""מ","${sm.subtotal.toFixed(2)} ₪"`);
    if (sm.vatPercent > 0) {
      trailer.push(`"מע""מ ${sm.vatPercent}%","${sm.vatAmount.toFixed(2)} ₪"`);
    }
    trailer.push(`"סכום לתשלום","${sm.grandTotal.toFixed(2)} ₪"`);
  }

  return csv + '\n' + trailer.join('\n');
}

function buildMonthHTMLEmail(mKey) {
  const rows = getReportRowsForMonth(mKey);
  const sm = summarizeMonth(mKey);
  const employee = els.employeeName.value.trim() || '(לא צוין)';
  const employeeId = els.employeeId.value.trim();
  const monthLabel = formatHebrewMonth(mKey);

  const tableRows = rows.map((row) =>
    '<tr>' + REPORT_HEADERS.map((h) => `<td>${escapeHtml(row[h] || '')}</td>`).join('') + '</tr>'
  ).join('');

  const headerRow = REPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');

  const catRows = CATEGORIES.map((c) => {
    const cs = sm.byCategory[c.key];
    if (cs.totalMs === 0) return '';
    const qtyText = [];
    if (cs.count) qtyText.push(`${cs.count}`);
    if (cs.words) qtyText.push(`${cs.words} מילים`);
    return `<tr><td>${c.icon} ${escapeHtml(c.label)}</td><td>${formatHoursDecimal(cs.totalMs)} ש׳</td><td>${qtyText.join(', ') || '—'}</td></tr>`;
  }).filter(Boolean).join('');

  let paymentBlock = '';
  if (sm.hourlyRate > 0) {
    paymentBlock = `
      <h3 style="color:#10b981;">💰 חישוב תשלום</h3>
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;direction:rtl;">
        <tr><td style="padding:6px;">סה"כ שעות:</td><td style="padding:6px;text-align:left;"><strong>${formatHoursDecimal(sm.totalMs)} ש׳</strong></td></tr>
        <tr><td style="padding:6px;">תעריף שעתי:</td><td style="padding:6px;text-align:left;">${sm.hourlyRate.toFixed(2)} ₪</td></tr>
        <tr><td style="padding:6px;">סכום לפני מע"מ:</td><td style="padding:6px;text-align:left;">${formatMoney(sm.subtotal)}</td></tr>
        ${sm.vatPercent > 0 ? `<tr><td style="padding:6px;">מע"מ (${sm.vatPercent}%):</td><td style="padding:6px;text-align:left;">${formatMoney(sm.vatAmount)}</td></tr>` : ''}
        <tr style="background:#10b981;color:white;font-size:18px;"><td style="padding:10px;"><strong>סכום לתשלום (כולל מע"מ):</strong></td><td style="padding:10px;text-align:left;"><strong>${formatMoney(sm.grandTotal)}</strong></td></tr>
      </table>
    `;
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><title>דו"ח חודשי</title></head>
<body style="font-family:Arial,'Heebo',sans-serif;direction:rtl;background:#f8fafc;padding:20px;color:#1e293b;">
  <div style="max-width:900px;margin:0 auto;background:white;padding:24px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color:#1e40af;border-bottom:3px solid #3b82f6;padding-bottom:8px;">📊 דו"ח נוכחות חודשי</h1>
    <p><strong>חודש:</strong> ${escapeHtml(monthLabel)}</p>
    <p><strong>שם העובד:</strong> ${escapeHtml(employee)}</p>
    ${employeeId ? `<p><strong>ת.ז. / מס׳ עוסק:</strong> ${escapeHtml(employeeId)}</p>` : ''}
    <p><strong>ימי עבודה:</strong> ${sm.daysCount}</p>

    <h3>פירוט יומי</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl;">
      <thead style="background:#1e40af;color:white;"><tr>${headerRow}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <h3 style="margin-top:24px;">סיכום לפי קטגוריה</h3>
    <table style="width:100%;border-collapse:collapse;direction:rtl;">
      <thead style="background:#f1f5f9;"><tr><th style="padding:8px;text-align:right;">קטגוריה</th><th style="padding:8px;text-align:right;">שעות</th><th style="padding:8px;text-align:right;">כמות</th></tr></thead>
      <tbody>${catRows || '<tr><td colspan="3" style="padding:12px;color:#64748b;">אין נתונים</td></tr>'}</tbody>
    </table>

    ${paymentBlock}

    <p style="margin-top:30px;color:#64748b;font-size:12px;">
      קובץ CSV מצורף עם פירוט מלא - מתאים להעברה להנהלת חשבונות.
    </p>
  </div>
  <style>
    table th, table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
    h3 { color: #1e40af; margin-top: 20px; }
  </style>
</body>
</html>`;
}

function buildMonthPlainText(mKey) {
  const rows = getReportRowsForMonth(mKey);
  const sm = summarizeMonth(mKey);
  const employee = els.employeeName.value.trim() || '(לא צוין)';
  const monthLabel = formatHebrewMonth(mKey);

  const lines = [];
  lines.push(`דו"ח נוכחות חודשי`);
  lines.push(`==================`);
  lines.push('');
  lines.push(`חודש: ${monthLabel}`);
  lines.push(`עובד: ${employee}`);
  lines.push(`ימי עבודה: ${sm.daysCount}`);
  lines.push('');
  lines.push(`פירוט יומי:`);
  lines.push(buildReportPlainText(rows));
  lines.push('');
  lines.push(`סיכום לפי קטגוריה:`);
  CATEGORIES.forEach((c) => {
    const cs = sm.byCategory[c.key];
    if (cs.totalMs === 0) return;
    const qty = [];
    if (cs.count) qty.push(`${cs.count}`);
    if (cs.words) qty.push(`${cs.words} מילים`);
    lines.push(`  ${c.icon} ${c.label}: ${formatHoursDecimal(cs.totalMs)} ש׳ ${qty.length ? '(' + qty.join(', ') + ')' : ''}`);
  });
  lines.push('');
  lines.push(`סה"כ שעות חודשי: ${formatHoursDecimal(sm.totalMs)}`);

  if (sm.hourlyRate > 0) {
    lines.push('');
    lines.push(`תעריף שעתי: ${sm.hourlyRate.toFixed(2)} ₪`);
    lines.push(`סכום לפני מע"מ: ${formatMoney(sm.subtotal)}`);
    if (sm.vatPercent > 0) lines.push(`מע"מ (${sm.vatPercent}%): ${formatMoney(sm.vatAmount)}`);
    lines.push(`סכום לתשלום: ${formatMoney(sm.grandTotal)}`);
  }

  return lines.join('\n');
}

function renderMonthSummary() {
  const mKey = els.monthSelect.value || currentMonthKey();
  const sm = summarizeMonth(mKey);

  if (sm.daysCount === 0) {
    els.monthSummary.innerHTML = `<div class="empty-state">אין רישומים לחודש ${escapeHtml(formatHebrewMonth(mKey))}</div>`;
    return;
  }

  const catRows = CATEGORIES.map((c) => {
    const cs = sm.byCategory[c.key];
    if (cs.totalMs === 0) return '';
    const qty = [];
    if (cs.count) qty.push(`${cs.count}`);
    if (cs.words) qty.push(`${cs.words} מילים`);
    return `
      <div class="summary-row">
        <span class="summary-label">${c.icon} ${escapeHtml(c.label)}</span>
        <span class="summary-value">${formatHoursDecimal(cs.totalMs)} ש׳ ${qty.length ? '· ' + qty.join(', ') : ''}</span>
      </div>
    `;
  }).filter(Boolean).join('');

  const paymentRow = sm.hourlyRate > 0
    ? `
      <div class="summary-row">
        <span class="summary-label">תעריף שעתי</span>
        <span class="summary-value">${sm.hourlyRate.toFixed(2)} ₪</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">סכום לפני מע"מ</span>
        <span class="summary-value">${formatMoney(sm.subtotal)}</span>
      </div>
      ${sm.vatPercent > 0 ? `
      <div class="summary-row">
        <span class="summary-label">מע"מ (${sm.vatPercent}%)</span>
        <span class="summary-value">${formatMoney(sm.vatAmount)}</span>
      </div>` : ''}
      <div class="summary-row payment">
        <span class="summary-label">💰 סכום לתשלום</span>
        <span class="summary-value">${formatMoney(sm.grandTotal)}</span>
      </div>
    `
    : `<div class="summary-row"><span class="summary-label" style="font-size:12px;">להזנת חישוב תשלום, מלאי "תעריף שעתי" בהגדרות.</span></div>`;

  els.monthSummary.innerHTML = `
    <div class="summary-row">
      <span class="summary-label">📅 ימי עבודה</span>
      <span class="summary-value">${sm.daysCount}</span>
    </div>
    ${catRows}
    <div class="summary-row total">
      <span class="summary-label">סה"כ שעות חודשי</span>
      <span class="summary-value">${formatHoursDecimal(sm.totalMs)} ש׳</span>
    </div>
    ${paymentRow}
  `;
}

function downloadMonthReport() {
  const mKey = els.monthSelect.value || currentMonthKey();
  const sm = summarizeMonth(mKey);
  if (sm.daysCount === 0) {
    alert('אין רישומים לחודש שנבחר.');
    return;
  }
  const csv = buildMonthCSV(mKey);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `attendance-month-${mKey}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function previewMonthReport() {
  const mKey = els.monthSelect.value || currentMonthKey();
  const sm = summarizeMonth(mKey);
  if (sm.daysCount === 0) {
    els.previewBody.innerHTML = `<p>אין רישומים לחודש ${escapeHtml(formatHebrewMonth(mKey))}</p>`;
  } else {
    const html = buildMonthHTMLEmail(mKey);
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    els.previewBody.innerHTML = match ? match[1] : html;
  }
  els.previewModal.hidden = false;
}

function sendMonthReport() {
  const ceo = els.ceoEmail.value.trim();
  const accounting = els.accountingEmail.value.trim();
  if (!ceo && !accounting) {
    alert('יש להזין לפחות אימייל אחד (מנכ"ל או הנהלת חשבונות) לפני שליחה.');
    els.ceoEmail.focus();
    return;
  }
  const mKey = els.monthSelect.value || currentMonthKey();
  const sm = summarizeMonth(mKey);
  if (sm.daysCount === 0) {
    alert('אין רישומים לחודש שנבחר.');
    return;
  }

  saveAllSettings();

  const employee = els.employeeName.value.trim() || '(לא צוין)';
  const monthLabel = formatHebrewMonth(mKey);
  const subject = `דו"ח נוכחות חודשי — ${employee} — ${monthLabel}`;
  const body = buildMonthPlainText(mKey);

  const recipients = [ceo, accounting].filter(Boolean).join(',');
  const url = `mailto:${encodeURIComponent(recipients)}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`;

  downloadMonthReport();
  setTimeout(() => { window.location.href = url; }, 200);
}

// ---------- Settings persistence ----------
function saveAllSettings() {
  localStorage.setItem(STORAGE_KEYS.ceoEmail, els.ceoEmail.value.trim());
  localStorage.setItem(STORAGE_KEYS.accountingEmail, els.accountingEmail.value.trim());
  localStorage.setItem(STORAGE_KEYS.employeeName, els.employeeName.value.trim());
  localStorage.setItem(STORAGE_KEYS.employeeId, els.employeeId.value.trim());
  localStorage.setItem(STORAGE_KEYS.hourlyRate, els.hourlyRate.value.trim());
  localStorage.setItem(STORAGE_KEYS.vatPercent, els.vatPercent.value.trim());
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

// ---------- First-run welcome ----------
function maybeShowWelcome() {
  const done = localStorage.getItem(STORAGE_KEYS.welcomeDone) === '1';
  const hasName = !!els.employeeName.value.trim();
  if (done || hasName) return;
  els.welcomeModal.hidden = false;
  setTimeout(() => els.welcomeName.focus(), 100);
}

function saveWelcome() {
  const name = els.welcomeName.value.trim();
  const ceo = els.welcomeCeo.value.trim();
  const rate = els.welcomeRate.value.trim();

  if (!name) {
    alert('יש להזין שם.');
    els.welcomeName.focus();
    return;
  }

  els.employeeName.value = name;
  if (ceo) els.ceoEmail.value = ceo;
  if (rate) els.hourlyRate.value = rate;

  saveAllSettings();
  localStorage.setItem(STORAGE_KEYS.welcomeDone, '1');
  els.welcomeModal.hidden = true;
  renderMonthSummary();
}

// ---------- Print invoice ----------
function buildInvoiceHTML(mKey) {
  const sm = summarizeMonth(mKey);
  const rows = getReportRowsForMonth(mKey);
  const employee = els.employeeName.value.trim() || '(לא צוין)';
  const employeeId = els.employeeId.value.trim();
  const monthLabel = formatHebrewMonth(mKey);
  const today = formatHebrewDate(Date.now());

  const headerCells = REPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const tableRows = rows.map((row) =>
    '<tr>' + REPORT_HEADERS.map((h) => `<td>${escapeHtml(row[h] || '')}</td>`).join('') + '</tr>'
  ).join('');

  const catRows = CATEGORIES.map((c) => {
    const cs = sm.byCategory[c.key];
    if (cs.totalMs === 0) return '';
    const qty = [];
    if (cs.count) qty.push(`${cs.count}`);
    if (cs.words) qty.push(`${cs.words} מילים`);
    return `<tr><td>${c.icon} ${escapeHtml(c.label)}</td><td>${formatHoursDecimal(cs.totalMs)} ש׳</td><td>${qty.join(', ') || '—'}</td></tr>`;
  }).filter(Boolean).join('');

  const paymentSection = sm.hourlyRate > 0 ? `
    <h2>חישוב לתשלום</h2>
    <table class="totals">
      <tr><td>סה"כ שעות</td><td>${formatHoursDecimal(sm.totalMs)} שעות</td></tr>
      <tr><td>תעריף שעתי</td><td>${sm.hourlyRate.toFixed(2)} ₪</td></tr>
      <tr><td>סכום לפני מע"מ</td><td>${formatMoney(sm.subtotal)}</td></tr>
      ${sm.vatPercent > 0 ? `<tr><td>מע"מ ${sm.vatPercent}%</td><td>${formatMoney(sm.vatAmount)}</td></tr>` : ''}
      <tr class="grand-total"><td>סכום לתשלום (כולל מע"מ)</td><td>${formatMoney(sm.grandTotal)}</td></tr>
    </table>
  ` : '<p style="color:#888;">לחישוב תשלום הזיני תעריף שעתי בהגדרות.</p>';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>חשבונית — ${escapeHtml(employee)} — ${escapeHtml(monthLabel)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: 'Heebo', 'Arial', sans-serif; color: #1e293b; direction: rtl; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 3px solid #1e40af; }
    .header h1 { color: #1e40af; margin: 0; font-size: 26px; }
    .header .meta { text-align: left; font-size: 13px; color: #64748b; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; }
    .info-grid div { font-size: 14px; }
    .info-grid strong { color: #1e40af; }
    h2 { color: #1e40af; margin-top: 24px; margin-bottom: 10px; font-size: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; vertical-align: top; }
    th { background: #1e40af; color: white; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fafc; }
    table.totals { font-size: 14px; }
    table.totals td:first-child { width: 60%; color: #475569; }
    table.totals td:last-child { text-align: left; font-weight: 600; }
    table.totals tr.grand-total td { background: #10b981 !important; color: white; font-size: 17px; padding: 12px; border-color: #10b981; }
    .signature { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .signature div { border-top: 1px solid #1e293b; padding-top: 6px; font-size: 12px; color: #64748b; text-align: center; }
    .actions { margin: 20px 0; text-align: center; }
    .actions button { padding: 12px 24px; font-size: 16px; background: #1e40af; color: white; border: none; border-radius: 8px; cursor: pointer; margin: 0 4px; }
    @media print { .actions { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="actions no-print">
    <button onclick="window.print()">🖨 הדפסה / שמירה כ-PDF</button>
    <button onclick="window.close()">סגור</button>
  </div>

  <div class="header">
    <h1>חשבונית — דו"ח שעות</h1>
    <div class="meta">הופק בתאריך: ${escapeHtml(today)}</div>
  </div>

  <div class="info-grid">
    <div><strong>שם העובד:</strong> ${escapeHtml(employee)}</div>
    ${employeeId ? `<div><strong>ת.ז. / מס׳ עוסק:</strong> ${escapeHtml(employeeId)}</div>` : '<div></div>'}
    <div><strong>חודש דיווח:</strong> ${escapeHtml(monthLabel)}</div>
    <div><strong>ימי עבודה:</strong> ${sm.daysCount}</div>
  </div>

  <h2>פירוט יומי</h2>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${tableRows || '<tr><td colspan="' + REPORT_HEADERS.length + '">אין נתונים</td></tr>'}</tbody>
  </table>

  <h2>סיכום לפי קטגוריה</h2>
  <table>
    <thead><tr><th>קטגוריה</th><th>שעות</th><th>כמות</th></tr></thead>
    <tbody>${catRows || '<tr><td colspan="3">אין נתונים</td></tr>'}</tbody>
  </table>

  ${paymentSection}

  <div class="signature">
    <div>חתימת העובד</div>
    <div>אישור המנכ"ל</div>
  </div>

  <script>
    setTimeout(() => window.print(), 400);
  </script>
</body>
</html>`;
}

function printInvoice() {
  const mKey = els.monthSelect.value || currentMonthKey();
  const sm = summarizeMonth(mKey);
  if (sm.daysCount === 0) {
    alert('אין רישומים לחודש שנבחר.');
    return;
  }
  const html = buildInvoiceHTML(mKey);
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('הדפדפן חסם את פתיחת החלון. יש לאשר חלונות קופצים מהאתר.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------- Notifications / reminders ----------
function notificationsEnabled() {
  return localStorage.getItem(STORAGE_KEYS.notificationsEnabled) === '1';
}

function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted';
}

function notify(title, body, tag) {
  if (!canNotify()) return;
  try {
    new Notification(title, {
      body,
      tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      lang: 'he',
      dir: 'rtl',
    });
  } catch {}
}

async function toggleNotifications(enabled) {
  if (!('Notification' in window)) {
    alert('הדפדפן לא תומך בהתראות.');
    els.notificationsEnabled.checked = false;
    return;
  }
  if (enabled) {
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        els.notificationsEnabled.checked = false;
        alert('כדי לקבל התראות יש לאשר את ההרשאה בדפדפן.');
        return;
      }
    } else if (Notification.permission === 'denied') {
      els.notificationsEnabled.checked = false;
      alert('ההתראות חסומות בדפדפן. יש לאשר אותן בהגדרות הדפדפן.');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.notificationsEnabled, '1');
    notify('🔔 התראות מופעלות', 'תקבלי הזכרה בסוף יום ובסוף חודש.', 'init');
  } else {
    localStorage.setItem(STORAGE_KEYS.notificationsEnabled, '0');
  }
}

function checkReminders() {
  if (!notificationsEnabled() || !canNotify()) return;
  const now = new Date();
  const tk = todayKey();
  const mKey = currentMonthKey();

  // End-of-day reminder if user is still clocked in at 18:00+
  if (now.getHours() >= 18 && activeSession) {
    const lastDay = localStorage.getItem(STORAGE_KEYS.lastReminderDay);
    if (lastDay !== tk) {
      notify('⏱ שכחת לסמן סיום?', 'יש סשן עבודה פעיל שעדיין לא נסגר. אל תשכחי ללחוץ "סיים עבודה".', 'eod');
      localStorage.setItem(STORAGE_KEYS.lastReminderDay, tk);
    }
  }

  // Last day of month reminder at 17:00+
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isLastDayOfMonth = tomorrow.getMonth() !== now.getMonth();
  if (isLastDayOfMonth && now.getHours() >= 17) {
    const last = localStorage.getItem(STORAGE_KEYS.lastMonthlyReminder);
    if (last !== mKey) {
      const sm = summarizeMonth(mKey);
      if (sm.daysCount > 0) {
        notify(
          '📊 סוף החודש',
          `החודש ${formatHebrewMonth(mKey)} מסתיים. סה"כ ${formatHoursDecimal(sm.totalMs)} שעות. אל תשכחי לשלוח את הדו"ח החודשי.`,
          'eom'
        );
        localStorage.setItem(STORAGE_KEYS.lastMonthlyReminder, mKey);
      }
    }
  }
}

function setupNotifications() {
  els.notificationsEnabled.checked = notificationsEnabled();
  els.notificationsEnabled.addEventListener('change', () => {
    toggleNotifications(els.notificationsEnabled.checked);
  });

  // Check immediately and every 5 minutes
  checkReminders();
  setInterval(checkReminders, 5 * 60 * 1000);

  // Update hint text based on permission state
  if ('Notification' in window) {
    if (Notification.permission === 'denied') {
      els.notificationsHint.textContent = '⚠ ההתראות חסומות בדפדפן. יש לאשר אותן בהגדרות הדפדפן.';
    }
  } else {
    els.notificationsHint.textContent = '⚠ הדפדפן לא תומך בהתראות.';
    els.notificationsEnabled.disabled = true;
  }
}

// ---------- PWA install ----------
let deferredInstallPrompt = null;

function setupInstall() {
  if (localStorage.getItem(STORAGE_KEYS.installDismissed) === '1') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!isStandalone()) els.installBanner.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    els.installBanner.hidden = true;
    deferredInstallPrompt = null;
  });

  els.installBtn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch {}
      deferredInstallPrompt = null;
      els.installBanner.hidden = true;
    } else {
      alert('להתקנה ידנית:\n\niOS Safari: לחצי על כפתור השיתוף ⬆ ובחרי "הוסף למסך הבית"\n\nAndroid Chrome: לחצי על תפריט ⋮ ובחרי "הוספה למסך הבית"');
    }
  });

  els.installDismiss.addEventListener('click', () => {
    els.installBanner.hidden = true;
    localStorage.setItem(STORAGE_KEYS.installDismissed, '1');
  });

  if (isIOS() && !isStandalone()) {
    els.installBanner.hidden = false;
  }
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------- Init ----------
function init() {
  loadAll();
  els.todayDate.textContent = formatHebrewDate(Date.now());
  els.monthSelect.value = currentMonthKey();

  els.workTypes.querySelectorAll('.work-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activeSession) return;
      selectWorkType(btn.dataset.type);
    });
  });

  els.startBtn.addEventListener('click', startWork);
  els.stopBtn.addEventListener('click', stopWork);
  els.sendBtn.addEventListener('click', sendReport);
  els.downloadDailyBtn.addEventListener('click', downloadDailyReport);
  els.previewBtn.addEventListener('click', previewReport);
  els.sendMonthBtn.addEventListener('click', sendMonthReport);
  els.downloadMonthBtn.addEventListener('click', downloadMonthReport);
  els.previewMonthBtn.addEventListener('click', previewMonthReport);
  els.printInvoiceBtn.addEventListener('click', printInvoice);
  els.monthSelect.addEventListener('change', renderMonthSummary);
  els.clearBtn.addEventListener('click', clearToday);
  els.welcomeSave.addEventListener('click', saveWelcome);

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

  [
    els.ceoEmail, els.accountingEmail, els.employeeName, els.employeeId,
    els.hourlyRate, els.vatPercent,
  ].forEach((input) => {
    input.addEventListener('change', () => {
      saveAllSettings();
      renderMonthSummary();
    });
  });

  els.dailyNotes.addEventListener('change', () => {
    setDailyNotes(todayKey(), els.dailyNotes.value.trim());
  });

  if (activeSession) {
    selectedWorkType = activeSession.workType;
    selectWorkType(activeSession.workType);
  }

  const params = new URLSearchParams(location.search);
  if (params.get('action') === 'start') {
    setTimeout(() => {
      const firstBtn = els.workTypes.querySelector('.work-type-btn');
      if (firstBtn) firstBtn.focus();
    }, 100);
  }

  renderAll();
  renderMonthSummary();
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(() => { if (activeSession) renderSummary(); }, 1000);

  setupInstall();
  setupNotifications();
  registerServiceWorker();
  maybeShowWelcome();
}

document.addEventListener('DOMContentLoaded', init);
