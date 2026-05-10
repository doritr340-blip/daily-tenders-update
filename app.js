// Tender Parser - Daily clippings extractor
// Uses pdf.js (loaded as ESM from CDN), JSZip and SheetJS (loaded as classic scripts)

import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

// ---------- State ----------
const state = {
  pdfFileName: null,
  source: "גלובס",
  pages: [],            // [{ pageNum, canvas, dataUrl, width, height }]
  tenders: [],          // [{ inviter, tender_number, classification, code, title, source, note, page, bbox, imageBlob, imageUrl }]
  counters: {},         // per-classification daily counter
};

const CLASSIFICATIONS = {
  P:  "ביצוע",
  S:  "אספקה",
  M:  "ניהול",
  G:  "פסולת",
  K:  "קול קורא",
  PT: "פטור ממכרז",
  Y:  "מגרשים",
  YR: "מגרשי רמ\"י / דירה להשכיר",
  CP: "עדכון ביצוע",
  CM: "עדכון ניהול",
  CS: "עדכון אספקה",
  CG: "עדכון פסולת",
  CY: "עדכון מגרש",
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const todayDate = $("todayDate");
const sourceSelect = $("sourceSelect");
const pdfInput = $("pdfInput");
const pdfStatus = $("pdfStatus");

const step2 = $("step2");
const step3 = $("step3");
const step4 = $("step4");
const step5 = $("step5");

const copyPromptBtn = $("copyPromptBtn");
const showPromptBtn = $("showPromptBtn");
const promptPreview = $("promptPreview");
const promptText = $("promptText");
const pagesInfo = $("pagesInfo");

const jsonInput = $("jsonInput");
const parseJsonBtn = $("parseJsonBtn");
const parseStatus = $("parseStatus");

const tendersBody = $("tendersBody");
const addRowBtn = $("addRowBtn");

const downloadZipBtn = $("downloadZipBtn");
const downloadCsvBtn = $("downloadCsvBtn");
const downloadStatus = $("downloadStatus");

const cropModal = $("cropModal");
const cropTitle = $("cropTitle");
const cropClose = $("cropClose");
const cropCanvas = $("cropCanvas");
const cropBox = $("cropBox");
const cropSaveBtn = $("cropSaveBtn");
const cropResetBtn = $("cropResetBtn");

// ---------- Init ----------
function todayString() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
function todayFolder() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
todayDate.textContent = todayString();

sourceSelect.addEventListener("change", () => { state.source = sourceSelect.value; });
state.source = sourceSelect.value;

// ---------- Step 1: PDF upload + render ----------
pdfInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  state.pdfFileName = file.name;
  pdfStatus.textContent = "טוען PDF...";
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    state.pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      pdfStatus.textContent = `מעבד עמוד ${i} מתוך ${pdf.numPages}...`;
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 }); // 2x for crisp crops
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      state.pages.push({
        pageNum: i,
        canvas,
        width: viewport.width,
        height: viewport.height,
      });
    }
    pdfStatus.textContent = `✓ ${pdf.numPages} עמודים נטענו (${file.name})`;
    pagesInfo.textContent = `${pdf.numPages} עמודים מוכנים. מקור: ${state.source}.`;
    step2.hidden = false;
    step3.hidden = false;
    refreshPrompt();
  } catch (err) {
    console.error(err);
    pdfStatus.textContent = `✗ שגיאה: ${err.message}`;
  }
});

// ---------- Step 2: Prompt ----------
function buildPrompt() {
  return `אני שולח לך PDF של עיתון ישראלי (מקור: ${state.source}). זהה את כל מודעות המכרזים הרלוונטיות לקבלנים בתחומי תשתיות, בנייה, אנרגיה, פסולת, אספקה, פיקוח, ניהול, מגרשים ומבנים.

כללי הכללה:
- ✅ ביצוע, ניהול, פיקוח, אספקה לקבלנים
- ✅ שירותים מקצועיים בתחום (אדריכלות, הנדסה, ייעוץ)
- ✅ פסולת — אבל לא נייר/קרטון
- ✅ מגרשים, מבנים, כלי רכב/צמ"ה
- ❌ אל תכלול: כוח אדם, משרות, גיוס עובדים

קודי סיווג (השתמש בקוד אחד בלבד):
- P  = ביצוע (עבודות בנייה/שיפוץ/תשתית/סלילה)
- S  = אספקה (אספקת חומרים/ציוד)
- M  = ניהול (פיקוח, ניהול פרויקט, ייעוץ)
- G  = פסולת (לא נייר/קרטון)
- K  = קול קורא
- PT = פטור ממכרז
- Y  = מכירת/החכרת מגרשים
- YR = מגרשי רמ"י / דירה להשכיר (רמ"י)
- CP / CM / CS / CG / CY = עדכון/דחייה/שינוי של מכרז קיים מהסוג המתאים

עבור כל מודעה החזר אובייקט JSON עם השדות:
- page: מספר עמוד (החל מ-1)
- inviter: שם המזמין (הרשות/חברה שמפרסמת)
- tender_number: מספר המכרז כפי שמופיע במודעה (אם אין — מחרוזת ריקה)
- classification: קוד סיווג (אחד מהרשימה למעלה)
- title: שם/נושא קצר של המכרז (1-8 מילים בלבד)
- note: הערה אופציונלית (תאריכי סיור/דחייה, "אין שינוי", וכו'). אם אין — מחרוזת ריקה
- bbox: [x, y, width, height] — מיקום המודעה בעמוד באחוזים (0-100). x,y = פינה שמאלית עליונה. הערכה גסה זה בסדר, יש אפשרות לתקן ידנית.

החזר אך ורק מערך JSON תקין, ללא טקסט נוסף, ללא markdown, ללא הסברים. דוגמה:

[
  {"page": 3, "inviter": "עיריית ירושלים", "tender_number": "107/2025", "classification": "P", "title": "ניקיון וטיאוט רחובות", "note": "", "bbox": [50, 20, 45, 30]},
  {"page": 5, "inviter": "נתיבי ישראל", "tender_number": "74/25", "classification": "CP", "title": "טעינת חשמל", "note": "סיור נדחה מ-12/08", "bbox": [10, 60, 40, 35]}
]`;
}

function refreshPrompt() {
  promptText.textContent = buildPrompt();
}

copyPromptBtn.addEventListener("click", async () => {
  refreshPrompt();
  try {
    await navigator.clipboard.writeText(buildPrompt());
    copyPromptBtn.textContent = "✓ הועתק!";
    setTimeout(() => { copyPromptBtn.textContent = "📋 העתק פרומפט ל-Claude"; }, 2000);
  } catch (e) {
    promptPreview.hidden = false;
    promptPreview.open = true;
  }
});
showPromptBtn.addEventListener("click", () => {
  refreshPrompt();
  promptPreview.hidden = false;
  promptPreview.open = !promptPreview.open;
});

// ---------- Step 3: Parse JSON ----------
parseJsonBtn.addEventListener("click", async () => {
  const raw = jsonInput.value.trim();
  if (!raw) {
    parseStatus.textContent = "✗ הדביקי את ה-JSON של Claude";
    return;
  }
  let parsed;
  try {
    // Strip optional markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    parseStatus.textContent = `✗ JSON לא תקין: ${err.message}`;
    return;
  }
  if (!Array.isArray(parsed)) {
    parseStatus.textContent = "✗ ה-JSON חייב להיות מערך של מכרזים";
    return;
  }

  state.tenders = [];
  state.counters = {};

  for (const item of parsed) {
    const cls = (item.classification || "").trim();
    if (!CLASSIFICATIONS[cls]) {
      console.warn("Unknown classification, skipping:", item);
      continue;
    }
    state.counters[cls] = (state.counters[cls] || 0) + 1;
    const code = `${cls}${String(state.counters[cls]).padStart(2, "0")}`;

    const tender = {
      inviter: item.inviter || "",
      tender_number: item.tender_number || "",
      classification: cls,
      code,
      title: item.title || "",
      source: state.source,
      note: item.note || "",
      page: parseInt(item.page, 10) || 1,
      bbox: Array.isArray(item.bbox) && item.bbox.length === 4 ? item.bbox.map(Number) : null,
      imageBlob: null,
      imageUrl: null,
    };
    state.tenders.push(tender);
  }

  parseStatus.textContent = `✓ נטענו ${state.tenders.length} מכרזים`;

  // Auto-crop using bbox hints
  await autoCropAll();

  step4.hidden = false;
  step5.hidden = false;
  renderTendersTable();
});

// ---------- Auto-crop ----------
async function autoCropAll() {
  for (const t of state.tenders) {
    if (!t.bbox) continue;
    const page = state.pages.find(p => p.pageNum === t.page);
    if (!page) continue;
    try {
      const blob = await cropPageByBBox(page, t.bbox);
      t.imageBlob = blob;
      if (t.imageUrl) URL.revokeObjectURL(t.imageUrl);
      t.imageUrl = URL.createObjectURL(blob);
    } catch (e) {
      console.warn("auto-crop failed for", t.code, e);
    }
  }
}

function cropPageByBBox(page, bboxPercent) {
  let [x, y, w, h] = bboxPercent.map(Number);
  // Clamp to 0..100
  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));
  w = Math.max(1, Math.min(100 - x, w));
  h = Math.max(1, Math.min(100 - y, h));
  const sx = Math.round((x / 100) * page.width);
  const sy = Math.round((y / 100) * page.height);
  const sw = Math.round((w / 100) * page.width);
  const sh = Math.round((h / 100) * page.height);
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(page.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return new Promise(res => out.toBlob(res, "image/png"));
}

// ---------- Step 4: Tenders table ----------
function renderTendersTable() {
  tendersBody.innerHTML = "";
  state.tenders.forEach((t, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.idx = idx;
    tr.innerHTML = `
      <td><input data-field="inviter" value="${escapeHtml(t.inviter)}" /></td>
      <td><input data-field="tender_number" value="${escapeHtml(t.tender_number)}" /></td>
      <td>
        <select data-field="classification">
          ${Object.keys(CLASSIFICATIONS).map(k =>
            `<option value="${k}" ${k === t.classification ? "selected" : ""}>${k} - ${CLASSIFICATIONS[k]}</option>`
          ).join("")}
        </select>
      </td>
      <td><span class="badge">${escapeHtml(t.code)}</span></td>
      <td><input data-field="title" value="${escapeHtml(t.title)}" /></td>
      <td><input data-field="source" value="${escapeHtml(t.source)}" /></td>
      <td><input data-field="note" value="${escapeHtml(t.note)}" /></td>
      <td><input data-field="page" type="number" min="1" value="${t.page}" style="width:60px;" /></td>
      <td class="img-cell">
        ${t.imageUrl
          ? `<img class="img-thumb" src="${t.imageUrl}" data-action="crop" alt="${t.code}" />`
          : `<span class="img-placeholder" data-action="crop">חתוך</span>`}
      </td>
      <td class="actions-cell">
        <button class="row-btn" data-action="renumber">🔢</button>
        <button class="row-btn delete" data-action="delete">🗑</button>
      </td>
    `;
    tendersBody.appendChild(tr);
  });

  // Attach handlers
  tendersBody.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", onCellEdit);
    el.addEventListener("change", onCellEdit);
  });
  tendersBody.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", onRowAction);
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c]));
}

function onCellEdit(e) {
  const tr = e.target.closest("tr");
  const idx = parseInt(tr.dataset.idx, 10);
  const t = state.tenders[idx];
  const field = e.target.dataset.field;
  if (!field) return;
  if (field === "page") {
    t[field] = parseInt(e.target.value, 10) || 1;
  } else if (field === "classification") {
    t[field] = e.target.value;
    renumberAll();
    renderTendersTable();
  } else {
    t[field] = e.target.value;
  }
}

function renumberAll() {
  state.counters = {};
  state.tenders.forEach(t => {
    state.counters[t.classification] = (state.counters[t.classification] || 0) + 1;
    t.code = `${t.classification}${String(state.counters[t.classification]).padStart(2, "0")}`;
  });
}

function onRowAction(e) {
  const action = e.currentTarget.dataset.action;
  const tr = e.target.closest("tr");
  const idx = parseInt(tr.dataset.idx, 10);
  if (action === "delete") {
    if (state.tenders[idx].imageUrl) URL.revokeObjectURL(state.tenders[idx].imageUrl);
    state.tenders.splice(idx, 1);
    renumberAll();
    renderTendersTable();
  } else if (action === "renumber") {
    renumberAll();
    renderTendersTable();
  } else if (action === "crop") {
    openCropModal(idx);
  }
}

addRowBtn.addEventListener("click", () => {
  state.tenders.push({
    inviter: "", tender_number: "", classification: "P",
    code: "", title: "", source: state.source, note: "",
    page: 1, bbox: null, imageBlob: null, imageUrl: null,
  });
  renumberAll();
  renderTendersTable();
});

// ---------- Crop modal ----------
let cropCtx = null;
let cropDrag = null; // { startX, startY, x, y, w, h }
let cropTargetIdx = null;
let cropPageRef = null;
let cropDisplayScale = 1;

function openCropModal(idx) {
  const t = state.tenders[idx];
  const page = state.pages.find(p => p.pageNum === t.page);
  if (!page) {
    alert("עמוד לא נמצא: " + t.page);
    return;
  }
  cropTargetIdx = idx;
  cropPageRef = page;
  cropTitle.textContent = `חיתוך מודעה — ${t.code} (עמוד ${t.page})`;

  // Fit canvas to modal width
  const maxWidth = Math.min(window.innerWidth - 80, 940);
  cropDisplayScale = Math.min(1, maxWidth / page.width);
  cropCanvas.width = Math.round(page.width * cropDisplayScale);
  cropCanvas.height = Math.round(page.height * cropDisplayScale);
  cropCtx = cropCanvas.getContext("2d");
  cropCtx.drawImage(page.canvas, 0, 0, cropCanvas.width, cropCanvas.height);

  // Draw existing bbox if exists
  cropBox.hidden = true;
  if (t.bbox) {
    const [x, y, w, h] = t.bbox;
    cropDrag = {
      x: (x / 100) * cropCanvas.width,
      y: (y / 100) * cropCanvas.height,
      w: (w / 100) * cropCanvas.width,
      h: (h / 100) * cropCanvas.height,
    };
    drawCropBox();
  } else {
    cropDrag = null;
  }

  cropModal.hidden = false;
}

function drawCropBox() {
  if (!cropDrag) { cropBox.hidden = true; return; }
  const wrap = cropCanvas.parentElement;
  const wrapRect = wrap.getBoundingClientRect();
  const canvasRect = cropCanvas.getBoundingClientRect();
  const offsetX = canvasRect.left - wrapRect.left + wrap.scrollLeft;
  const offsetY = canvasRect.top - wrapRect.top + wrap.scrollTop;
  cropBox.style.left = (offsetX + cropDrag.x) + "px";
  cropBox.style.top = (offsetY + cropDrag.y) + "px";
  cropBox.style.width = cropDrag.w + "px";
  cropBox.style.height = cropDrag.h + "px";
  cropBox.hidden = false;
}

function getCanvasPos(evt) {
  const rect = cropCanvas.getBoundingClientRect();
  const e = evt.touches ? evt.touches[0] : evt;
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function onCropDown(e) {
  e.preventDefault();
  const p = getCanvasPos(e);
  cropDrag = { startX: p.x, startY: p.y, x: p.x, y: p.y, w: 0, h: 0 };
  drawCropBox();
}
function onCropMove(e) {
  if (!cropDrag || cropDrag.startX === undefined) return;
  e.preventDefault();
  const p = getCanvasPos(e);
  cropDrag.x = Math.min(cropDrag.startX, p.x);
  cropDrag.y = Math.min(cropDrag.startY, p.y);
  cropDrag.w = Math.abs(p.x - cropDrag.startX);
  cropDrag.h = Math.abs(p.y - cropDrag.startY);
  drawCropBox();
}
function onCropUp() {
  if (cropDrag) cropDrag.startX = undefined;
}

cropCanvas.addEventListener("mousedown", onCropDown);
cropCanvas.addEventListener("mousemove", onCropMove);
window.addEventListener("mouseup", onCropUp);
cropCanvas.addEventListener("touchstart", onCropDown, { passive: false });
cropCanvas.addEventListener("touchmove", onCropMove, { passive: false });
window.addEventListener("touchend", onCropUp);

cropResetBtn.addEventListener("click", () => {
  cropDrag = null;
  drawCropBox();
});

cropClose.addEventListener("click", () => { cropModal.hidden = true; });

cropSaveBtn.addEventListener("click", async () => {
  if (cropTargetIdx == null) return;
  if (!cropDrag || cropDrag.w < 5 || cropDrag.h < 5) {
    alert("נא לסמן את אזור המודעה");
    return;
  }
  // Convert display coords back to percentage of page
  const x = (cropDrag.x / cropCanvas.width) * 100;
  const y = (cropDrag.y / cropCanvas.height) * 100;
  const w = (cropDrag.w / cropCanvas.width) * 100;
  const h = (cropDrag.h / cropCanvas.height) * 100;
  const t = state.tenders[cropTargetIdx];
  t.bbox = [x, y, w, h];
  const blob = await cropPageByBBox(cropPageRef, t.bbox);
  t.imageBlob = blob;
  if (t.imageUrl) URL.revokeObjectURL(t.imageUrl);
  t.imageUrl = URL.createObjectURL(blob);
  cropModal.hidden = true;
  renderTendersTable();
});

// ---------- Step 5: Download ----------
function buildSheetData() {
  const headers = ["שם מזמין", "מס' מכרז", "סיווג", "סיווג ומספר", "שם מכרז", "מקור", "הערה"];
  const rows = state.tenders.map(t => [
    t.inviter, t.tender_number, t.classification, t.code, t.title, t.source, t.note,
  ]);
  return [headers, ...rows];
}

function buildCsv() {
  const data = buildSheetData();
  return "﻿" + data.map(row =>
    row.map(cell => {
      const s = String(cell ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  ).join("\n");
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

downloadCsvBtn.addEventListener("click", () => {
  const csv = buildCsv();
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `tenders_${todayFolder()}.csv`);
});

downloadZipBtn.addEventListener("click", async () => {
  if (!state.tenders.length) {
    downloadStatus.textContent = "אין מכרזים להוריד";
    return;
  }
  downloadStatus.textContent = "בונה ZIP...";
  const zip = new JSZip();
  const folder = zip.folder(todayFolder());
  const imagesFolder = folder.folder("images");

  // Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(buildSheetData());
  ws["!cols"] = [
    { wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 12 },
    { wch: 50 }, { wch: 14 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "מכרזים");
  const xlsxArr = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  folder.file("tenders.xlsx", xlsxArr);

  // CSV (also include for convenience)
  folder.file("tenders.csv", buildCsv());

  // Images
  let added = 0, missing = 0;
  for (const t of state.tenders) {
    if (t.imageBlob) {
      imagesFolder.file(`${t.code}.png`, t.imageBlob);
      added++;
    } else {
      missing++;
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `tenders_${todayFolder()}.zip`);
  downloadStatus.textContent = `✓ הורד: ${added} תמונות, ${state.tenders.length} שורות בטבלה${missing ? ` (${missing} שורות ללא תמונה)` : ""}`;
});
