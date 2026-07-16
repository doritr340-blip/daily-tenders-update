"use strict";

/* ============================================================
   מחולל הוראות עיצוב לקרוסלות
   מזהה עמודות מתוך הגריד, מחיל מערכת פונטים, ומייצר הוראות
   עיצוב מדויקות לכל סלייד — אחד לאחד.
   ============================================================ */

/* ---------- 1. הגדרות זיהוי עמודות ---------- */
const ROLE_KEYWORDS = {
  index:    ["מספר", "מס'", "סלייד", "slide", "index", "#", "no", "num"],
  type:     ["סוג", "type", "שלב", "stage", "kind", "category"],
  headline: ["כותרת ראשית", "כותרת", "title", "headline", "header"],
  sub:      ["כותרת משנה", "תת כותרת", "subtitle", "subheadline", "sub"],
  body:     ["טקסט", "תוכן", "body", "text", "content", "פסקה", "description", "תיאור"],
  cta:      ["cta", "קריאה", "כפתור", "button", "פעולה", "call to action"],
  visual:   ["תמונה", "ויזואל", "רקע", "image", "visual", "background", "אייקון", "icon", "graphic"],
  notes:    ["הערה", "הערות", "notes", "remark", "comment"],
};

// סדר עדיפות לזיהוי (ספציפי לפני כללי) כדי ש"כותרת משנה" לא ייתפס כ"כותרת"
const ROLE_ORDER = ["index", "type", "sub", "headline", "cta", "visual", "notes", "body"];

/* ---------- 2. תקרות אורך מומלצות ---------- */
const LIMITS = {
  headline: { rec: 40, max: 60, label: "כותרת ראשית" },
  sub:      { rec: 60, max: 90, label: "כותרת משנה" },
  body:     { rec: 150, max: 220, label: "טקסט גוף" },
  cta:      { rec: 25, max: 35, label: "CTA" },
};

/* ---------- 3. מערכת פונטים – ברירת מחדל ---------- */
const FONT_ROLES = [
  { key: "headline", label: "כותרת ראשית (H1)", font: "Heebo",     weight: "Bold",    size: 64 },
  { key: "sub",      label: "כותרת משנה (H2)",  font: "Heebo",     weight: "Medium",  size: 40 },
  { key: "body",     label: "טקסט גוף",          font: "Assistant", weight: "Regular", size: 30 },
  { key: "cta",      label: "CTA / כפתור",       font: "Heebo",     weight: "Bold",    size: 34 },
  { key: "caption",  label: "כיתוב / הערה",      font: "Assistant", weight: "Regular", size: 22 },
];

const WEIGHTS = ["Thin", "Light", "Regular", "Medium", "SemiBold", "Bold", "Black"];

/* ---------- 4. פריסות מומלצות לפי סוג סלייד ---------- */
const LAYOUTS = {
  "שער":       "כותרת ענקית ממורכזת אנכית, ויזואל רקע מלא, לוגו קטן בפינה העליונה.",
  "בעיה":      "כותרת בחצי העליון, טקסט גוף מתחת, ניגודיות גבוהה להדגשת הכאב.",
  "פתרון":     "כותרת + פסקת גוף, מקום לאייקון/ויזואל תומך בצד שמאל.",
  "טיפ":       "מספר טיפ גדול בפינה, כותרת קצרה, גוף ממוקד במשפט אחד.",
  "רשימה":     "כותרת למעלה, פריטי רשימה עם בולטים/מספור בכיוון עברית.",
  "ציטוט":     "גרשיים גדולים, טקסט ציטוט ממורכז, שם המצטט קטן מתחת.",
  "נתון":      "מספר/סטטיסטיקה ענק במרכז, כותרת הסבר קצרה מתחת.",
  "לפני/אחרי": "חלוקה לשני חצאים (לפני | אחרי) עם תוויות ברורות.",
  "סיכום":     "כותרת סיכום, 3 נקודות עיקריות, מעבר רך ל-CTA.",
  "cta":       "כותרת מזמינה, כפתור/הנחיה בולט, פרטי יצירת קשר/עקבו.",
  "תוכן":      "כותרת + גוף בהיררכיה ברורה, שוליים בטוחים, יישור לימין.",
};

/* ============================================================
   פרסור CSV
   ============================================================ */
function parseCSV(text) {
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return [];
  // זיהוי מפריד: טאב (הדבקה מ-Sheets) או פסיק
  const firstLine = text.split("\n")[0];
  const delim = firstLine.includes("\t") ? "\t" : ",";

  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === delim) { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else { field += c; }
    }
  }
  row.push(field);
  rows.push(row);
  return rows.map(r => r.map(c => c.trim()));
}

/* ============================================================
   זיהוי עמודות → תפקידים
   ============================================================ */
function detectColumns(headers) {
  const map = {};      // role -> column index
  const used = new Set();
  const norm = headers.map(h => h.toLowerCase().trim());

  for (const role of ROLE_ORDER) {
    const kws = ROLE_KEYWORDS[role];
    for (let i = 0; i < norm.length; i++) {
      if (used.has(i)) continue;
      if (kws.some(kw => norm[i].includes(kw.toLowerCase()))) {
        map[role] = i;
        used.add(i);
        break;
      }
    }
  }
  // עמודות שלא זוהו
  const extras = [];
  headers.forEach((h, i) => { if (!used.has(i)) extras.push({ i, name: h }); });
  return { map, extras };
}

/* ============================================================
   גזירת סוג סלייד כשלא צוין
   ============================================================ */
function inferType(explicit, idx, total) {
  if (explicit) return explicit.trim();
  if (idx === 0) return "שער";
  if (idx === total - 1) return "CTA";
  return "תוכן";
}

function layoutFor(type) {
  const key = type.toLowerCase();
  if (LAYOUTS[type]) return LAYOUTS[type];
  if (key === "cta") return LAYOUTS["cta"];
  return LAYOUTS["תוכן"];
}

/* ============================================================
   מערכת פונטים – קריאה מה-UI
   ============================================================ */
function readFontSystem() {
  const sys = {};
  FONT_ROLES.forEach(r => {
    const font = document.getElementById(`f_${r.key}_font`).value.trim() || r.font;
    const weight = document.getElementById(`f_${r.key}_weight`).value.trim() || r.weight;
    const size = parseInt(document.getElementById(`f_${r.key}_size`).value, 10) || r.size;
    sys[r.key] = { font, weight, size, label: r.label };
  });
  return sys;
}

function fontSpec(fs) {
  return `${fs.font} · ${fs.weight} · ${fs.size}px`;
}

/* ============================================================
   בדיקת אורך
   ============================================================ */
function lengthCheck(role, text) {
  const lim = LIMITS[role];
  if (!lim) return null;
  const n = [...text].length;
  if (n === 0) return null;
  if (n <= lim.rec) return { level: "ok", text: `תקין (${n} תווים)` };
  if (n <= lim.max) return { level: "warn", text: `גבולי (${n}/${lim.rec} מומלץ)` };
  return { level: "danger", text: `חריגה: ${n} תווים (מקס' ${lim.max})` };
}

/* ============================================================
   בניית מודל הסליידים
   ============================================================ */
function buildSlides(rows) {
  if (rows.length < 2) return null;
  const headers = rows[0];
  const { map, extras } = detectColumns(headers);
  const dataRows = rows.slice(1).filter(r => r.some(c => c !== ""));
  const total = dataRows.length;

  const slides = dataRows.map((r, idx) => {
    const get = role => (map[role] != null ? (r[map[role]] || "") : "");
    const type = inferType(get("type"), idx, total);
    const number = get("index") || String(idx + 1);
    const extraFields = extras
      .map(e => ({ name: e.name || `עמודה ${e.i + 1}`, value: r[e.i] || "" }))
      .filter(e => e.value !== "");
    return {
      number, type,
      headline: get("headline"),
      sub: get("sub"),
      body: get("body"),
      cta: get("cta"),
      visual: get("visual"),
      notes: get("notes"),
      extras: extraFields,
    };
  });

  return { headers, map, extras, slides };
}

/* ============================================================
   רינדור הזיהוי (חיווי איזו עמודה זוהתה כמה)
   ============================================================ */
const ROLE_LABELS = {
  index: "מספר", type: "סוג", headline: "כותרת", sub: "כותרת משנה",
  body: "טקסט", cta: "CTA", visual: "ויזואל", notes: "הערות",
};

function renderDetected(model) {
  const el = document.getElementById("detected");
  const parts = [];
  for (const role of ROLE_ORDER) {
    if (model.map[role] != null) {
      parts.push(`<span class="tag">${ROLE_LABELS[role]} ← "${model.headers[model.map[role]]}"</span>`);
    }
  }
  model.extras.forEach(e => {
    parts.push(`<span class="tag unknown">מידע נוסף ← "${e.name}"</span>`);
  });
  el.innerHTML = `<b>זוהו ${model.slides.length} סליידים.</b> מיפוי עמודות:<br>${parts.join(" ")}`;
  el.hidden = false;
}

/* ============================================================
   רינדור הוראות העיצוב
   ============================================================ */
function fieldRow(k, text, spec, badge) {
  const b = badge ? ` <span class="badge ${badge.level}">${badge.text}</span>` : "";
  const s = spec ? `<span class="spec">→ ${spec}</span>` : "";
  return `<div class="field"><div class="k">${k}</div><div class="v"><span class="txt">${escapeHtml(text)}</span>${b}${s}</div></div>`;
}

function renderSlides(model, fs) {
  const container = document.getElementById("slides");
  container.innerHTML = "";
  const warnings = [];

  model.slides.forEach(s => {
    const rows = [];
    rows.push(`<div class="field"><div class="k">פריסה</div><div class="v">${escapeHtml(layoutFor(s.type))}</div></div>`);

    if (s.headline) rows.push(fieldRow("כותרת ראשית", `"${s.headline}"`, fontSpec(fs.headline) + " · יישור לימין", lengthCheck("headline", s.headline)));
    if (s.sub)      rows.push(fieldRow("כותרת משנה", `"${s.sub}"`, fontSpec(fs.sub), lengthCheck("sub", s.sub)));
    if (s.body)     rows.push(fieldRow("טקסט גוף", `"${s.body}"`, fontSpec(fs.body) + " · רוחב שורה ~40 תווים", lengthCheck("body", s.body)));
    if (s.cta)      rows.push(fieldRow("CTA", `"${s.cta}"`, fontSpec(fs.cta) + " · הדגשה/כפתור", lengthCheck("cta", s.cta)));
    if (s.visual)   rows.push(fieldRow("ויזואל", s.visual, "ודאו ניגודיות טקסט מעל הרקע"));
    if (s.notes)    rows.push(`<div class="field"><div class="k">הערות</div><div class="v">${escapeHtml(s.notes)}</div></div>`);

    rows.push(`<div class="field"><div class="k">מרווחים</div><div class="v">שוליים בטוחים 8% · ריווח בין בלוקים 1.5×</div></div>`);

    if (s.extras.length) {
      const ex = s.extras.map(e => `${escapeHtml(e.name)}: ${escapeHtml(e.value)}`).join(" · ");
      rows.push(`<div class="field"><div class="k">מידע נוסף</div><div class="v">${ex}</div></div>`);
    }

    // איסוף אזהרות אורך
    [["headline", s.headline], ["sub", s.sub], ["body", s.body], ["cta", s.cta]].forEach(([role, txt]) => {
      const c = lengthCheck(role, txt);
      if (c && c.level !== "ok") warnings.push(`סלייד ${s.number} (${LIMITS[role].label}): ${c.text}`);
    });

    const div = document.createElement("div");
    div.className = "slide";
    div.innerHTML = `<h3>━ סלייד ${escapeHtml(s.number)} <span class="type">— ${escapeHtml(s.type)}</span></h3>${rows.join("")}`;
    container.appendChild(div);
  });

  // סיכום
  const sum = document.getElementById("summary");
  const fontsUsed = FONT_ROLES.map(r => `${r.label}: <b>${fs[r.key].font} ${fs[r.key].weight} ${fs[r.key].size}px</b>`).join(" · ");
  let html = `<div>📊 <b>${model.slides.length}</b> סליידים · מערכת פונטים — ${fontsUsed}</div>`;
  if (warnings.length) {
    html += `<div style="margin-top:8px;color:var(--warn)">⚠️ אזהרות אורך (${warnings.length}):<br>${warnings.map(escapeHtml).join("<br>")}</div>`;
  } else {
    html += `<div style="margin-top:8px;color:var(--ok)">✓ כל הטקסטים בתוך התקרות המומלצות.</div>`;
  }
  sum.innerHTML = html;

  document.getElementById("outputCard").hidden = false;
  document.getElementById("outputCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ============================================================
   ייצוא ל-Markdown
   ============================================================ */
function buildMarkdown(model, fs) {
  const L = [];
  L.push(`# הוראות עיצוב לקרוסלה\n`);
  L.push(`**${model.slides.length} סליידים**\n`);
  L.push(`## מערכת פונטים`);
  FONT_ROLES.forEach(r => L.push(`- ${r.label}: ${fs[r.key].font} · ${fs[r.key].weight} · ${fs[r.key].size}px`));
  L.push(``);

  model.slides.forEach(s => {
    L.push(`\n━━━ סלייד ${s.number} — ${s.type} ━━━`);
    L.push(`פריסה:        ${layoutFor(s.type)}`);
    if (s.headline) L.push(`כותרת ראשית:  "${s.headline}"  → ${fontSpec(fs.headline)} · ימין`);
    if (s.sub)      L.push(`כותרת משנה:   "${s.sub}"  → ${fontSpec(fs.sub)}`);
    if (s.body)     L.push(`טקסט גוף:     "${s.body}"  → ${fontSpec(fs.body)}`);
    if (s.cta)      L.push(`CTA:          "${s.cta}"  → ${fontSpec(fs.cta)}`);
    if (s.visual)   L.push(`ויזואל:       ${s.visual}`);
    if (s.notes)    L.push(`הערות:        ${s.notes}`);
    L.push(`מרווחים:      שוליים בטוחים 8% · ריווח 1.5×`);
    [["headline", s.headline, "כותרת"], ["sub", s.sub, "כותרת משנה"], ["body", s.body, "גוף"], ["cta", s.cta, "CTA"]].forEach(([role, txt, lbl]) => {
      const c = lengthCheck(role, txt);
      if (c && c.level !== "ok") L.push(`בדיקת אורך:   ⚠️ ${lbl} — ${c.text}`);
    });
    if (s.extras.length) L.push(`מידע נוסף:    ${s.extras.map(e => `${e.name}: ${e.value}`).join(" · ")}`);
  });
  return L.join("\n");
}

/* ============================================================
   עזרי DOM
   ============================================================ */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

/* ============================================================
   הדבקת גוש פונטים → מילוי השדות
   ============================================================ */
function applyFontsPaste() {
  const raw = document.getElementById("fontsPaste").value.trim();
  if (!raw) return;
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  let applied = 0;
  lines.forEach(line => {
    const [rolePart, specPart] = line.split(":");
    if (!specPart) return;
    const roleText = rolePart.toLowerCase();
    // התאמת התפקיד
    let key = null;
    if (/ראשית|h1|כותרת(?!\s*משנה)/.test(roleText) && !/משנה/.test(roleText)) key = "headline";
    if (/משנה|h2|subtitle|sub/.test(roleText)) key = "sub";
    if (/גוף|body|טקסט|text/.test(roleText)) key = "body";
    if (/cta|כפתור|button|קריאה/.test(roleText)) key = "cta";
    if (/כיתוב|caption|הערה/.test(roleText)) key = "caption";
    if (!key) return;
    const parts = specPart.split(/[|,]/).map(p => p.trim()).filter(Boolean);
    if (parts[0]) document.getElementById(`f_${key}_font`).value = parts[0];
    parts.forEach(p => {
      if (WEIGHTS.some(w => w.toLowerCase() === p.toLowerCase())) {
        document.getElementById(`f_${key}_weight`).value =
          WEIGHTS.find(w => w.toLowerCase() === p.toLowerCase());
      }
      const num = p.match(/\d+/);
      if (num) document.getElementById(`f_${key}_size`).value = num[0];
    });
    applied++;
  });
  toast(applied ? `הוחלו ${applied} פונטים` : "לא זוהו פונטים");
}

/* ============================================================
   אתחול UI
   ============================================================ */
let currentModel = null;
let currentFonts = null;

function buildFontsUI() {
  const grid = document.getElementById("fontsGrid");
  const weightOpts = WEIGHTS.map(w => `<option value="${w}">${w}</option>`).join("");
  grid.innerHTML = FONT_ROLES.map(r => `
    <div class="font-row">
      <span class="role">${r.label}</span>
      <input type="text" id="f_${r.key}_font" value="${r.font}" placeholder="שם פונט" />
      <select id="f_${r.key}_weight" class="btn ghost" style="padding:8px">${weightOpts}</select>
      <input type="number" id="f_${r.key}_size" value="${r.size}" min="8" max="200" />
    </div>`).join("");
  FONT_ROLES.forEach(r => { document.getElementById(`f_${r.key}_weight`).value = r.weight; });
}

const SAMPLE = `מספר,סוג,כותרת,טקסט,CTA,ויזואל,הערות
1,שער,5 טעויות שהורסות לך את הקמפיין,המדריך שכל בעל עסק חייב להכיר,,רקע מלא בצבע המותג,פתיחה חזקה
2,בעיה,אתם משקיעים כסף בפרסום — ומקבלים אפס לידים,רוב העסקים מבזבזים תקציב בלי לדעת למה זה לא עובד,,אייקון גרף יורד,
3,טיפ,טעות 1: אתם מדברים על עצמכם,הלקוח רוצה לשמוע מה יוצא לו מזה — לא כמה אתם מקצועיים,,,
4,טיפ,טעות 2: אין קריאה לפעולה ברורה,אם לא אמרתם ללקוח מה לעשות עכשיו — הוא פשוט ימשיך לגלול,,,
5,סיכום,אז מה עושים מכאן?,מתקנים את 5 הטעויות ומתחילים לראות לידים אמיתיים,,,3 נקודות
6,CTA,רוצים שנעשה לכם את זה?,שלחו לנו הודעה ונבנה קמפיין שממיר,שלחו הודעה ✉️,רקע מלא בצבע מותג,`;

document.addEventListener("DOMContentLoaded", () => {
  buildFontsUI();

  document.getElementById("csvFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { document.getElementById("gridInput").value = ev.target.result; toast("הקובץ נטען"); };
    reader.readAsText(file, "UTF-8");
  });

  document.getElementById("sampleBtn").addEventListener("click", () => {
    document.getElementById("gridInput").value = SAMPLE;
    toast("דוגמה נטענה");
  });

  document.getElementById("clearGrid").addEventListener("click", () => {
    document.getElementById("gridInput").value = "";
    document.getElementById("detected").hidden = true;
  });

  document.getElementById("applyFontsPaste").addEventListener("click", applyFontsPaste);

  document.getElementById("generate").addEventListener("click", () => {
    const raw = document.getElementById("gridInput").value;
    if (!raw.trim()) { toast("הכניסו קודם גריד"); return; }
    const rows = parseCSV(raw);
    const model = buildSlides(rows);
    if (!model || !model.slides.length) { toast("לא זוהו סליידים — בדקו את הטבלה"); return; }
    currentModel = model;
    currentFonts = readFontSystem();
    renderDetected(model);
    renderSlides(model, currentFonts);
  });

  document.getElementById("copyBtn").addEventListener("click", () => {
    if (!currentModel) return;
    const md = buildMarkdown(currentModel, currentFonts);
    navigator.clipboard.writeText(md).then(() => toast("הועתק ✓")).catch(() => toast("העתקה נכשלה"));
  });

  document.getElementById("downloadBtn").addEventListener("click", () => {
    if (!currentModel) return;
    const md = buildMarkdown(currentModel, currentFonts);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "carousel-instructions.md";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("הורד ✓");
  });
});
