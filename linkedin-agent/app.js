/* ============================================================
   רדאר הבוקר — סוכן LinkedIn של כוכבית ארנון
   כלי עזר בדפדפן: רדאר חיפוש + מנוע ניקוד + מחולל תגובות.
   רץ 100% מקומית, ללא שרת. הניקוד הוא היוריסטי (כללי אצבע);
   הליטוש הסופי נעשה ע"י ה-LLM עם agent-prompt.md.
   ============================================================ */

/* ---------- 1. ניווט בין טאבים ---------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.getElementById(tab.dataset.tab).classList.add("is-active");
  });
});

/* ---------- 2. רדאר חיפוש: בניית קישורי לינקדאין ---------- */
// חיפוש פוסטים אחרונים בלינקדאין. sortBy=date_posted מציג טריים קודם.
function liPostSearch(query) {
  return (
    "https://www.linkedin.com/search/results/content/?keywords=" +
    encodeURIComponent(query) +
    "&sortBy=%22date_posted%22"
  );
}
function liHashtag(tag) {
  return "https://www.linkedin.com/feed/hashtag/?keywords=" + encodeURIComponent(tag);
}

// חיפושים מוכנים — ממוקדים בקהל היעד (מנכ"לים/ארגונים) ובנושאים של כוכבית.
const TOPIC_SEARCHES = [
  { title: "AI בארגונים", sub: "הטמעת בינה מלאכותית בעסקים", q: "הטמעת בינה מלאכותית בארגונים" },
  { title: "סוכני AI", sub: "AI agents ואוטומציה", q: "סוכני AI אוטומציה ארגונים" },
  { title: "חוויית לקוח (CX)", sub: "שירות וחוויית לקוח", q: "חווית לקוח שירות לקוחות CX" },
  { title: "עתיד העבודה", sub: "AI ומקצועות העתיד", q: "עתיד העבודה בינה מלאכותית עובדים" },
  { title: "מנכ\"לים על AI", sub: "מקבלי החלטות מדברים AI", q: "מנכ\"ל בינה מלאכותית חדשנות" },
  { title: "טרנספורמציה דיגיטלית", sub: "שינוי ארגוני וטכנולוגיה", q: "טרנספורמציה דיגיטלית ארגונים" },
  { title: "AI in organizations (EN)", sub: "global decision-makers", q: "AI adoption organizations CEO" },
  { title: "Customer Experience (EN)", sub: "CX leaders", q: "customer experience AI automation" },
];

const HASHTAGS = [
  "בינהמלאכותית", "AI", "חווייתלקוח", "ArtificialIntelligence",
  "CustomerExperience", "עתידהעבודה", "חדשנות", "AIAgents",
  "טרנספורמציהדיגיטלית", "FutureOfWork", "מנהיגות", "Automation",
];

(function buildRadar() {
  const grid = document.getElementById("topicLinks");
  TOPIC_SEARCHES.forEach((t) => {
    const a = document.createElement("a");
    a.className = "link-card";
    a.href = liPostSearch(t.q);
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = `<div class="lc-title">${t.title}</div><div class="lc-sub">${t.sub} ↗</div>`;
    grid.appendChild(a);
  });

  const chips = document.getElementById("hashtagLinks");
  HASHTAGS.forEach((h) => {
    const a = document.createElement("a");
    a.className = "chip";
    a.href = liHashtag(h);
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "#" + h;
    chips.appendChild(a);
  });
})();

document.getElementById("freeSearchBtn").addEventListener("click", () => {
  const q = document.getElementById("freeQuery").value.trim();
  if (!q) { toast("הקלידי מילת חיפוש"); return; }
  window.open(liPostSearch(q), "_blank", "noopener");
});

/* ---------- 3. מנוע הניקוד (היוריסטי) ---------- */
// קבוצות מילות-מפתח עם משקלים, בהתאם לקריטריונים ב-agent-prompt.md.
const SENIORITY = [
  "מנכ\"ל", "מנכ\"לית", "מנכל", "ceo", "founder", "מייסד", "מייסדת", "בעל חברה", "בעלת חברה",
  "סמנכ\"ל", "סמנכל", "vp", "chief", "cxo", "cto", "coo", "cmo", "מנהל בכיר", "מנהלת בכירה",
  "יו\"ר", "דירקטור", "מנהל חדשנות", "מנהלת חדשנות", "מנהל דיגיטל",
];
const TOPIC_AI = ["בינה מלאכותית", "ai", "בינה", "gpt", "llm", "סוכן ai", "סוכני ai", "agent", "אוטומציה", "automation", "מודל שפה"];
const TOPIC_CX = ["חווית לקוח", "חוויית לקוח", "cx", "שירות לקוחות", "customer experience", "שירות", "מוקד", "צ'אטבוט", "chatbot"];
const TOPIC_BIZ = ["ארגון", "ארגונים", "חברה", "ניהול", "מנהיגות", "עתיד העבודה", "פרודוקטיביות", "יעילות", "טרנספורמציה", "חדשנות", "תהליך", "תפעול", "מכירות", "roi", "transformation", "leadership"];
const VALUE_SIGNALS = ["?", "מה דעתכם", "איך אתם", "שאלה", "מתלבט", "מתלבטת", "אתגר", "טעות", "לקח", "תובנה", "ניסיון", "סקר", "what do you think", "how do you"];
const DISQUALIFY = ["פוליטי", "בחירות", "מפלגה", "מלחמה", "דת", "גזע"];

function scorePost(author, text) {
  const A = (author || "").toLowerCase();
  const T = (text || "").toLowerCase();
  const all = A + " " + T;
  const reasons = [];

  // פוסל אוטומטי
  if (DISQUALIFY.some((w) => all.includes(w))) {
    return { score: 0, reasons: ["⛔ זוהה תוכן רגיש/פוליטי — מומלץ לדלג."], topic: "none" };
  }

  let score = 0;

  // (30%) בכירות הכותב
  const sen = SENIORITY.some((w) => A.includes(w));
  if (sen) { score += 30; reasons.push("✅ הכותב/ת בקהל היעד (בכיר/ת / מקבל/ת החלטות)"); }
  else if (SENIORITY.some((w) => T.includes(w))) { score += 14; reasons.push("◐ נושא של מקבלי החלטות, אך זהות הכותב/ת לא ודאית"); }
  else { reasons.push("◌ לא זוהתה בכירות בשדה הכותב/ת — מלאי תפקיד לדיוק"); }

  // (25%) רלוונטיות נושא + זיהוי קטגוריה
  let topic = "biz";
  const hitAI = TOPIC_AI.some((w) => all.includes(w));
  const hitCX = TOPIC_CX.some((w) => all.includes(w));
  const hitBIZ = TOPIC_BIZ.some((w) => all.includes(w));
  if (hitAI && hitCX) { score += 25; topic = "ai_cx"; reasons.push("🎯 צומת AI + חוויית לקוח — בול המומחיות של כוכבית"); }
  else if (hitAI) { score += 23; topic = "ai"; reasons.push("🎯 נושא בינה מלאכותית — ליבת המיצוב"); }
  else if (hitCX) { score += 21; topic = "cx"; reasons.push("🎯 נושא חוויית לקוח — ליבת המיצוב"); }
  else if (hitBIZ) { score += 13; topic = "biz"; reasons.push("◐ נושא ניהולי/עסקי רחב — יש זווית, פחות ממוקד"); }
  else { topic = "none"; reasons.push("◌ הנושא רחוק מתחומי הליבה של כוכבית"); }

  // (20%) פוטנציאל חשיפה — אורך/עומק כסיגנל גס
  const len = (text || "").length;
  if (len > 280) { score += 16; reasons.push("📈 פוסט מהותי (טקסט עשיר) — סביר שיקבל חשיפה"); }
  else if (len > 120) { score += 11; }
  else if (len > 0) { score += 5; reasons.push("◌ פוסט קצר — פוטנציאל חשיפה נמוך יותר"); }

  // (15%) הזדמנות להוסיף ערך
  if (VALUE_SIGNALS.some((w) => T.includes(w))) {
    score += 15; reasons.push("💬 יש פתח לדיאלוג (שאלה/אתגר/דעה) — קל להוסיף ערך");
  } else { score += 6; reasons.push("◌ אין שאלה מפורשת — צריך זווית ערך יזומה"); }

  // (10%) התאמת מיצוב — בונוס אם AI/CX
  if (topic === "ai_cx" || topic === "ai" || topic === "cx") { score += 10; }
  else if (hitBIZ) { score += 4; }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, reasons, topic };
}

/* ---------- 4. מחולל התגובות (3 זוויות, בקול של כוכבית) ---------- */
function buildComments(topic, author) {
  const name = firstName(author);
  const greet = name ? `${name}, ` : "";

  const BANK = {
    ai_cx: {
      insight: `${greet}נקודה מצוינת. מהליווי שלי בארגונים אני רואה שה-AI באמת זורח דווקא בנקודות המגע עם הלקוח — לא כ"גימיק" אלא כשהוא חוסך ללקוח זמן ולנציג עומס. השילוב של חוויית לקוח חכמה ואוטומציה הוא בדיוק מקום ה-ROI.`,
      experience: `${greet}מזדהה לגמרי. בארגון שליוויתי לאחרונה, הטמעת AI במוקד השירות הורידה זמני המתנה משמעותית — אבל הקפיצה האמיתית הגיעה כשהגדרנו מתי המערכת *מעבירה* ללקוח לאדם. הטכנולוגיה מעצימה את האנושיות, לא מחליפה אותה.`,
      question: `${greet}תובנה חשובה 🙏 מסקרן אותי — בארגונים שאת/ה מכיר/ה, מה היה החסם הגדול יותר בהטמעת AI בחוויית הלקוח: הטכנולוגיה עצמה או דווקא ההסתגלות של הצוותים?`,
    },
    ai: {
      insight: `${greet}מדויק. הפער שאני פוגשת בשטח הוא בין ארגונים ש"מנסים AI" לבין כאלה שמטמיעים אותו בתהליך עבודה אמיתי. הכלי הוא 20% — 80% זה השינוי הארגוני סביבו. שם נופלים או מצליחים.`,
      experience: `${greet}מהשטח אצלי: הטמעות AI שמצליחות לא מתחילות מהטכנולוגיה אלא מהשאלה "איזו בעיה עסקית אנחנו פותרים". כשהתחלנו ככה בארגון שליוויתי, גם האימוץ של העובדים קפץ — כי הם ראו ערך, לא איום.`,
      question: `${greet}שיתוף חשוב 👏 שאלה שמעסיקה אותי: לתפיסתך, מה היום מבדיל ארגון ש"באמת" הטמיע AI מארגון שרק התנסה? אשמח לשמוע מהזווית שלך.`,
    },
    cx: {
      insight: `${greet}בול. חוויית לקוח מצוינת היא לא "להיות נחמדים" — היא לתכנן את המסע כך שהלקוח מקבל ערך בכל נקודת מגע. AI מאפשר היום לעשות את זה בקנה מידה שלא היה אפשרי לפני שנתיים.`,
      experience: `${greet}מתחברת מאוד. בליווי ארגונים אני רואה שהמדד שבאמת זז הוא לא שביעות רצון אלא מאמץ הלקוח (Customer Effort) — כמה קל לו לקבל את מה שהוא צריך. שם השינוי הקטן עושה את ההבדל הגדול.`,
      question: `${greet}פוסט שנוגע בעצב 🙌 מעניין אותי: מה לדעתך הצעד הראשון שארגון צריך לעשות כדי לשפר חוויית לקוח — בלי להמתין לפרויקט טכנולוגי ענק?`,
    },
    biz: {
      insight: `${greet}אמירה חשובה. מהזווית שלי כמלווה ארגונים, השינוי הגדול בשנים הקרובות לא יהיה טכנולוגי בלבד אלא ניהולי — מי שילמד לשלב בין ניסיון אנושי לכלים חכמים ייצור יתרון אמיתי.`,
      experience: `${greet}מהשטח אני רואה שזה בדיוק כך. ארגונים שמצליחים הם אלו שמעיזים לחבר בין הניסיון של האנשים שלהם לבין כלים חדשים — במקום לבחור צד. השילוב הזה הוא שמייצר את הקפיצה.`,
      question: `${greet}תודה על השיתוף 🙏 אשמח לשמוע — מה לדעתך הכי מעכב ארגונים מלאמץ שינוי, גם כשברור שהוא נחוץ?`,
    },
  };

  const set = BANK[topic] || BANK.biz;
  return [
    { head: "א. זווית התובנה 💡", text: set.insight },
    { head: "ב. זווית הניסיון 🛠️", text: set.experience },
    { head: "ג. זווית השאלה ❓", text: set.question },
  ];
}

function firstName(author) {
  if (!author) return "";
  const cleaned = author.split(/[,،\-|]/)[0].trim();
  const first = cleaned.split(/\s+/)[0];
  return first && first.length <= 12 ? first : "";
}

/* ---------- 5. הצגת תוצאות ---------- */
const analyzeBtn = document.getElementById("analyzeBtn");
analyzeBtn.addEventListener("click", () => {
  const author = document.getElementById("authorRole").value.trim();
  const text = document.getElementById("postText").value.trim();
  if (!text) { toast("הדביקי קודם את תוכן הפוסט"); return; }

  const { score, reasons, topic } = scorePost(author, text);
  const verdict = verdictFor(score);
  const box = document.getElementById("result");
  box.classList.remove("empty");

  let html = `<div class="score-badge ${score >= 80 ? "score-hi" : score >= 60 ? "score-mid" : "score-lo"}">
      ${verdict.emoji} ${score}<span style="font-size:13px;font-weight:600">/100</span></div>
    <p class="verdict">${verdict.label}</p>
    <ul class="reasons">${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>`;

  if (score >= 40 && topic !== "none") {
    html += `<h4 style="margin:8px 0 10px;color:var(--brand)">תגובות מוצעות:</h4>`;
    buildComments(topic, author).forEach((c, i) => {
      html += `<div class="comment-card">
          <div class="cc-head">${c.head}</div>
          <div class="cc-text" id="cc-${i}">${c.text}</div>
          <button class="copy-mini" data-copy="cc-${i}">📋 העתק תגובה</button>
        </div>`;
    });
    html += `<button class="btn ghost" id="saveBtn" style="margin-top:6px">⭐ שמור לרשימת היום</button>`;
  } else {
    html += `<div class="tip-box" style="margin-top:6px">הציון נמוך — מומלץ לדלג ולחסוך את הזמן לפוסט עם פוטנציאל קידום גבוה יותר.</div>`;
  }
  box.innerHTML = html;

  box.querySelectorAll(".copy-mini").forEach((b) => {
    b.addEventListener("click", () => {
      copyText(document.getElementById(b.dataset.copy).innerText);
    });
  });
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.addEventListener("click", () => savePost(author, score, verdict.emoji));
});

function verdictFor(s) {
  if (s >= 80) return { emoji: "🔥", label: "חובה להגיב היום — הזדמנות קידום מצוינת!" };
  if (s >= 60) return { emoji: "✅", label: "שווה תגובה — להגיב אם יש זמן." };
  if (s >= 40) return { emoji: "🤔", label: "גבולי — רק אם יש לך זווית ייחודית." };
  return { emoji: "❌", label: "מומלץ לדלג — לא מקדם מספיק." };
}

/* ---------- 6. שמירת פוסטים של היום (localStorage) ---------- */
const SKEY = "ka_radar_saved_" + new Date().toISOString().slice(0, 10);
function loadSaved() { try { return JSON.parse(localStorage.getItem(SKEY)) || []; } catch { return []; } }
function savePost(author, score, emoji) {
  const list = loadSaved();
  list.push({ author: author || "ללא שם", score, emoji, t: Date.now() });
  list.sort((a, b) => b.score - a.score);
  localStorage.setItem(SKEY, JSON.stringify(list));
  renderSaved();
  toast("נשמר לרשימת היום ⭐");
}
function renderSaved() {
  const wrap = document.getElementById("savedList");
  const list = loadSaved();
  if (!list.length) { wrap.innerHTML = `<p class="muted">עדיין לא שמרת פוסטים היום.</p>`; return; }
  wrap.innerHTML = list.map((x, i) =>
    `<div class="saved-item">
       <span>${x.emoji} <strong>${x.author}</strong></span>
       <span class="si-score">${x.score}/100</span>
       <button class="copy-mini" data-del="${i}">🗑️</button>
     </div>`).join("");
  wrap.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const list = loadSaved(); list.splice(+b.dataset.del, 1);
      localStorage.setItem(SKEY, JSON.stringify(list)); renderSaved();
    }));
}
renderSaved();

/* ---------- 7. העתקת פרומפט מלא ל-LLM ---------- */
document.getElementById("copyPromptBtn").addEventListener("click", () => {
  const author = document.getElementById("authorRole").value.trim() || "(לא צוין)";
  const text = document.getElementById("postText").value.trim();
  if (!text) { toast("הדביקי קודם פוסט"); return; }
  const prompt =
`את/ה רדאר הבוקר — סוכן הנוכחות בלינקדאין של כוכבית ארנון, מנכ"לית KA / K-Expert AI,
מומחית להטמעת AI וחוויית לקוח בארגונים. הקול: "בינה מלאכותית בגובה העיניים" — סמכותי, חם, פרקטי.
קהל היעד: מנכ"לים, בעלי חברות וסמנכ"לים.

לפניך פוסט מלינקדאין. כתוב/כתבי 3 טיוטות תגובה קצרות (2–4 משפטים) בקול של כוכבית:
(א) זווית תובנה מקצועית (ב) זווית ניסיון מהשטח (ג) זווית שאלה שמעמיקה דיון.
כל תגובה חייבת להוסיף ערך אמיתי, למצב את כוכבית כמומחית בלי למכור, ולכבד את הכותב/ת.
בלי קלישאות, בלי להתחנף, עברית זורמת, אימוג'י אחד לכל היותר.

כותב/ת הפוסט: ${author}
תוכן הפוסט:
"""
${text}
"""`;
  copyText(prompt);
});

/* ---------- 8. עזרי UI ---------- */
function copyText(t) {
  navigator.clipboard.writeText(t).then(() => toast("הועתק ללוח ✓")).catch(() => toast("לא הצלחתי להעתיק"));
}
let toastTimer;
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
}
