"use strict";
/* never fail silently to a blank page */
function __fatalBanner(msg) {
  let el = document.getElementById("__fatal");
  if (!el) {
    el = document.createElement("div");
    el.id = "__fatal";
    el.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:999;background:#331b1d;color:#f2726f;font:13px/1.5 -apple-system,sans-serif;padding:12px 16px;border-bottom:1px solid #f2726f";
    document.body && document.body.appendChild(el);
  }
  el.textContent = "job cache error: " + msg + "  — press ⌘⇧R to hard-reload.";
}
window.addEventListener("error", (e) => __fatalBanner(e.message || String(e.error)));
window.addEventListener("unhandledrejection", (e) => __fatalBanner(String(e.reason && e.reason.message || e.reason)));
/* ═══════════════════════════════════════════════════════════════════════════
   job cache — dashboard client
   Pages render into #view; chrome (sidebar) + overlays (palette, modal, ws,
   toaster) persist. Keyboard-first, learns from your decisions.
   ═══════════════════════════════════════════════════════════════════════════ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const api = (p, opts) => fetch(p, opts).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
const label = (s) => (s || "").replace(/_/g, " ");
const esc = (s) => (s || "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (v) => Math.round((v || 0) * 100);

/* ── icons (drawn SVG, single stroke) ──────────────────────────────────── */
const V = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  sidebar: V('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
  overview: V('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  jobs: V('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>'),
  queue: V('<path d="M3 8l9-5 9 5-9 5-9-5Z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>'),
  applications: V('<path d="M22 3 11 14"/><path d="M22 3l-7 18-4-8-8-4 19-6Z"/>'),
  insights: V('<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4M13 16V8M18 16v-6"/>'),
  profile: V('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  settings: V('<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.991l1.005.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.296-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>'),
  sparkle: V('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8.5 13.2 11 15.7 12.2 13.2 13.4 12 15.9 10.8 13.4 8.3 12.2 10.8 11 12 8.5Z"/>'),
  check: V('<path class="check-draw" d="M4 12.5l5 5L20 6.5"/>'),
  copy: V('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  external: V('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  refresh: V('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  x: V('<path d="M6 6l12 12M18 6 6 18"/>'),
  info: V('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  search: V('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  download: V('<path d="M12 3v12"/><path d="M7 11l5 4 5-4"/><path d="M5 21h14"/>'),
  upload: V('<path d="M12 21V9"/><path d="M7 13l5-4 5 4"/><path d="M5 3h14"/>'),
  trophy: V('<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  mic: V('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  star: V('<path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8 6.2 21.8l1.1-6.5L2.6 9.8l6.5-.9L12 3Z"/>'),
  note: V('<path d="M4 4h16v13l-4 4H4V4Z"/><path d="M16 21v-4h4M8 9h8M8 13h5"/>'),
  brain: V('<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 7 17a3 3 0 0 0 5 1 3 3 0 0 0 5-1 3 3 0 0 0 2-5.2A3 3 0 0 0 18 6a3 3 0 0 0-3-3 3 3 0 0 0-3 1.5A3 3 0 0 0 9 3Z"/><path d="M12 4.5v14"/>'),
  sun: V('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5 4 4M20 20l-1-1M19 5l1-1M4 20l1-1"/>'),
  moon: V('<path d="M21 12.8A8 8 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"/>'),
  popout: V('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>'),
  arrow: V('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  bolt: V('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>'),
  clock: V('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  chat: V('<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-4a8 8 0 1 1 18-7Z"/><path d="M8 11h8M8 14h5"/>'),
  trash: V('<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>'),
  book: V('<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5Z"/><path d="M4 20a2 2 0 0 1 2-2h13"/><path d="M9 7h6M9 10h6"/>'),
  terminal: V('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>'),
  lock: V('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  pin: V('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  building: V('<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>'),
  globe: V('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  tag: V('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  lang: V('<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 4-3 7-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>'),
  send: V('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>'),
};
const ico = (n, cls = "ico") => `<span class="${cls}">${ICONS[n] || ""}</span>`;

/* ── state ─────────────────────────────────────────────────────────────── */
let page = "overview";
let selectedId = null;
let fadeDetail = false;   // one-shot: fade the detail in when the next job auto-advances
let counts = { jobs: 0, queue: 0, applications: 0, pending: 0, starred: 0 };
let config = { owner_name: "", theme: "dark" };
let modelReady = false;
let listCache = [];              // ids currently shown (for j/k nav)
let jobsPrefs = null;   // /api/preferences, cached for the Jobs sidebar's "Your preferences" box

const NAV = [
  { id: "overview", icon: "overview", label: "Overview", sec: null },
  { id: "jobs", icon: "jobs", label: "Jobs", sec: null },
  { id: "queue", icon: "queue", label: "Queue", sec: null },
  { id: "applications", icon: "applications", label: "Applications", sec: null },
  { id: "profile", icon: "profile", label: "Profile", sec: null },
  { id: "about", icon: "book", label: "How to use", sec: null },
];
const STATUSES = ["interested", "queued", "materials_ready", "applied", "interview", "offer", "rejected"];
const QUEUE_GROUPS = [["materials_ready", "Ready for your review", "check"], ["queued", "Queued for Claude", "queue"]];
const QUEUE_EMPTY_ARGS = ["queue", "Your queue is empty", "Queue a job from <b>Jobs</b> and it'll show up here — or use the Q&amp;A assistant to draft answers to application questions."];
const APP_GROUPS = [["applied", "Applied", "send"], ["interview", "Interviewing", "mic"], ["offer", "Offers", "trophy"], ["rejected", "Closed", "x"]];
const STATUS_COLOR = {
  interested: "var(--faint)", queued: "var(--accent)", materials_ready: "var(--ok)",
  applied: "var(--accent-2)", interview: "var(--warn)", offer: "var(--ok)",
  rejected: "var(--bad)", dismissed: "var(--faint)", closed: "var(--line-2)",
};

/* ── toaster + copy ────────────────────────────────────────────────────── */
function toast(msg, type = "ok") {
  const iconName = type === "err" ? "x" : type === "info" ? "info" : "check";
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="t-ico">${ICONS[iconName]}</span><span class="t-msg">${esc(msg)}</span>`;
  $("#toaster").appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
}
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const prev = btn.innerHTML; btn.classList.add("copied");
      btn.innerHTML = `<span class="btn-ico">${ICONS.check}</span>${btn.dataset.lbl ? "<span>Copied</span>" : ""}`;
      setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = prev; }, 1500);
    }
    toast("Copied to clipboard", "ok");
  } catch (e) { toast("Couldn't copy", "err"); }
}

/* ── markdown-lite ─────────────────────────────────────────────────────── */
function mdLite(text) {
  return esc(text)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>").replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^- (.*)$/gm, "• $1");
}
function renderAnalysis(md) {
  const items = (md || "").split("\n").filter((l) => l.trim().startsWith("- "))
    .map((l) => l.replace(/^\s*-\s*/, "").replace(/^([A-Za-z][\w /"']*?):/, "<b>$1:</b>"))
    .map((l) => `<li>${l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</li>`);
  return items.length ? `<ul>${items.join("")}</ul>` : `<div>${esc(md || "")}</div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Chrome
   ═══════════════════════════════════════════════════════════════════════════ */
function renderNav() {
  $("#nav").innerHTML = NAV.map((n) => {
    const c = counts[n.id];
    const hot = n.id === "queue" && counts.pending > 0;
    const badge = (c && ["jobs", "queue", "applications"].includes(n.id)) ? `<span class="nav-count ${hot ? "hot" : ""}">${c}</span>` : "";
    return `<button class="nav-item ${n.id === page ? "active" : ""}" data-page="${n.id}">${ico(n.icon)}<span class="lbl">${n.label}</span>${badge}</button>`;
  }).join("");
  $$(".nav-item").forEach((el) => (el.onclick = () => setPage(el.dataset.page)));
  updateSidebarCompact();
}
// Manual, persisted — not tied to page/workspace state. Auto-toggling the
// sidebar on every navigation (the old behavior) was jarring; the user
// decides once and it stays that way until they click it again.
let sidebarCollapsed = false;
try { sidebarCollapsed = localStorage.getItem("jc-sidebar-collapsed") === "1"; } catch (e) {}
function updateSidebarCompact() {
  const app = $(".app");
  // The Apply workspace needs the width back -- force compact while it's
  // docked, regardless of the user's manual preference, and fall back to
  // that preference again as soon as it closes.
  if (app) app.classList.toggle("sidebar-compact", sidebarCollapsed || !!wsOpenForId);
  const btn = $("#sidebarToggleBtn");
  if (btn) btn.title = sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
}
function toggleSidebarCollapsed() {
  sidebarCollapsed = !sidebarCollapsed;
  try { localStorage.setItem("jc-sidebar-collapsed", sidebarCollapsed ? "1" : "0"); } catch (e) {}
  updateSidebarCompact();
}
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $("#themeBtn").innerHTML = ico(t === "dark" ? "sun" : "moon");
  config.theme = t; localStorage.setItem("jc-theme", t);
}
function toggleTheme() {
  const t = config.theme === "dark" ? "light" : "dark";
  applyTheme(t);
  api("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: t }) }).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared bits: cards, detail, split shell
   ═══════════════════════════════════════════════════════════════════════════ */
function chipsFor(j) {
  return [
    `<span class="chip city">${esc(j.city)}</span>`,
    `<span class="chip">${label(j.role_family)}</span>`,
    `<span class="chip">${label(j.seniority)}${j.req_years ? " · " + j.req_years + "y" : ""}</span>`,
    j.is_startup ? `<span class="chip startup">startup</span>` : "",
    `<span class="chip spon-${j.sponsorship}">${label(j.sponsorship)}</span>`,
    (j.status && j.status !== "interested") ? `<span class="chip status">${label(j.status)}</span>` : "",
  ].join("");
}
function cardHtml(j, opts = {}) {
  const ready = j.status === "materials_ready";
  const applied = j.status === "applied";
  const showForYou = opts.forYou && j.for_you != null;
  const scoreBadge = showForYou
    ? `<span class="score foryou" title="For-you score">${pct(j.for_you)}</span>`
    : `<span class="score" title="Match score">${pct(j.match_score)}</span>`;
  return `<article class="card ${j.id === selectedId ? "active" : ""}" data-id="${j.id}">
    <button class="icon-btn star-btn cardstar ${j.starred ? "on" : ""}" data-star="${j.id}" title="Star">${ico("star")}</button>
    <div class="row1">
      <div style="min-width:0"><div class="title">${esc(j.title)}</div><div class="co">${esc(j.company)}</div></div>
      <div class="scorewrap">${scoreBadge}</div>
    </div>
    <div class="chips">${chipsFor(j)}</div>
    ${ready ? `<div class="card-cta"><button class="btn btn-ok btn-sm" data-apply="${j.id}">${ico("check", "btn-ico")}<span>Mark as applied</span></button></div>`
      : applied ? `<div class="ready-dot">${ico("check")} Applied</div>` : ""}
  </article>`;
}
function skeletons(n = 5) {
  return Array.from({ length: n }, () => `<div class="skel"><div class="skel-line" style="width:70%"></div><div class="skel-line" style="width:45%"></div><div class="skel-line" style="width:88%;margin-top:14px"></div></div>`).join("");
}
function emptyState(icon, title, body) {
  return `<div class="empty">${ico(icon)}<h3>${esc(title)}</h3><p>${body}</p></div>`;
}
function wireCards(root = document) {
  $$(".card", root).forEach((el) => (el.onclick = () => selectJob(el.dataset.id)));
  $$("[data-apply]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); markApplied(b.dataset.apply); }));
  $$("[data-star]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleStar(b.dataset.star); }));
}
function selectJob(id) {
  selectedId = id;
  $$(".card").forEach((el) => el.classList.toggle("active", el.dataset.id === id));
  renderDetail(id);
}

/* shared split shell for jobs/queue/applications */
function splitShell(titleHtml, subHtml, actionsHtml, filtersHtml) {
  $("#view").innerHTML = `
    <div class="pagehead">
      <div class="pagehead-l"><h1 class="pagetitle">${titleHtml}</h1><p class="pagesub">${subHtml}</p></div>
      <div class="pagehead-r">${actionsHtml || ""}</div>
    </div>
    ${filtersHtml || ""}
    <div class="split"><section id="list" class="list"></section><section id="detail" class="detail"></section></div>`;
}

/* ── detail (shared) ───────────────────────────────────────────────────── */
function clearDetail(forPage) {
  teardownWorkspace();
  if (forPage === "queue") { renderQAChat(); return; }
  const map = {
    jobs: emptyState("jobs", "Select a job", "Pick a posting to see why it matched, what the model thinks, and queue it for a tailored application."),
    queue: emptyState("queue", "Nothing selected", "Choose a queued job to review the materials Claude generated."),
    applications: emptyState("applications", "Select an application", "Review its materials, copy your answers, or update its status."),
  };
  if ($("#detail")) $("#detail").innerHTML = map[forPage] || map.jobs;
}
function matBlock(title, bodyHtml, copyText_) {
  const copy = copyText_ != null ? `<button class="btn btn-ghost btn-sm copy-btn" data-copy="1" data-lbl="1">${ico("copy", "btn-ico")}<span>Copy</span></button>` : "";
  return `<div class="mat-block"><header><h4>${esc(title)}</h4>${copy}</header><div class="mat-body prose" data-text="${esc(copyText_ || "")}">${bodyHtml}</div></div>`;
}
function materialsHtml(m) {
  if (!m) return `<div class="section-h">Generated materials</div>
    <div class="notice">${ico("sparkle")}<div><b>Not generated yet.</b> Click <b>Queue for Claude</b>, then run <code>/apply</code> in Claude Code. Materials appear here automatically.</div></div>`;
  const blocks = [];
  if (m.fit_summary) blocks.push(matBlock("Fit summary", `<p>${esc(m.fit_summary)}</p>`, null));
  if (m.cover_letter) {
    const paras = m.cover_letter_paragraphs.map((p) => `<div class="para"><button class="btn btn-ghost para-copy copy-btn" data-copy="1" title="Copy paragraph">${ico("copy", "btn-ico")}</button>${esc(p)}</div>`).join("");
    blocks.push(`<div class="mat-block"><header><h4>Cover letter</h4><button class="btn btn-ghost btn-sm copy-btn" data-copy="1" data-lbl="1">${ico("copy", "btn-ico")}<span>Copy letter</span></button></header><div class="mat-body" data-text="${esc(m.cover_letter)}">${paras}</div></div>`);
  }
  if (m.short_form) blocks.push(matBlock('"What brings you to apply?"', `<p>${esc(m.short_form)}</p>`, m.short_form));
  if (m.match_analysis) blocks.push(matBlock("Match analysis", `<div class="analysis">${renderAnalysis(m.match_analysis)}</div>`, null));
  if (m.cv_variant) blocks.push(matBlock("CV variant for this company", `<div class="analysis">${mdLite(m.cv_variant)}</div>`, m.cv_variant));
  return `<div class="section-h">${ico("check")} Generated materials</div><div class="mat">${blocks.join("")}</div>`;
}
function learnedHtml(j) {
  const lr = j.learned_reasons || [];
  if (!lr.length) return "";
  const rows = lr.map((r) => `<div class="lr"><span class="lr-k">${esc(r.label)}</span><span class="lr-v">${esc(label(String(r.value)))}</span><span class="lr-w ${r.weight >= 0 ? "pos" : "neg"}">${r.weight >= 0 ? "+" : ""}${r.weight.toFixed(2)}</span></div>`).join("");
  const badge = j.model_ready ? `<span class="pill ok">${pct(j.for_you)} for you</span>` : `<span class="pill muted">learning</span>`;
  return `<div class="section-h">${ico("brain")} Why the model rates this <span class="pill">${badge}</span></div><div class="learned">${rows}</div>`;
}
async function renderDetail(id) {
  const host = $("#detail"); if (!host) return;
  teardownWorkspace();
  const j = await api("/api/jobs/" + id);
  const m = j.materials_struct;
  const applied = j.status === "applied";
  const statusSel = `<label>Status <select class="input" id="statusSel">${STATUSES.map((s) => `<option value="${s}" ${s === j.status ? "selected" : ""}>${label(s)}</option>`).join("")}</select></label>`;
  const applyBtn = m
    ? (applied ? `<button class="btn is-done" disabled>${ico("check", "btn-ico")}<span>Applied</span></button>`
      : `<button class="btn btn-ok" id="applyBtn">${ico("check", "btn-ico")}<span>Mark as applied</span></button>`)
    : `<button class="btn btn-primary" id="queueBtn">${ico("sparkle", "btn-ico")}<span>Queue for Claude</span></button>`;
  const wsBtn = j.apply_url ? `<button class="btn btn-primary" id="wsBtn">${ico("bolt", "btn-ico")}<span>Apply workspace</span></button>` : "";

  host.innerHTML = `
    <h1 class="d-title">${esc(j.title)}</h1>
    <div class="d-meta">
      <span>${esc(j.company)}</span><span class="dot">·</span><span>${esc(j.city)}</span><span class="dot">·</span>
      <span>${label(j.role_family)}</span><span class="dot">·</span>
      <span>${label(j.seniority)}${j.req_years ? " (" + j.req_years + "y req)" : ""}</span><span class="dot">·</span>
      <span>${j.is_startup ? "startup" : "big company"}</span><span class="dot">·</span><span>sponsorship: ${label(j.sponsorship)}</span>
    </div>
    <div class="d-bar">
      ${wsBtn}
      ${j.apply_url ? `<a class="btn btn-ghost" href="${esc(j.apply_url)}" target="_blank" rel="noopener">${ico("external", "btn-ico")}<span>Open page</span></a>` : ""}
      ${applyBtn}
      <button class="btn btn-ghost star-btn ${j.starred ? "on" : ""}" id="starBtn">${ico("star", "btn-ico")}<span>${j.starred ? "Starred" : "Star"}</span></button>
      <button class="btn btn-ghost" id="dismissBtn">${ico("x", "btn-ico")}<span>Dismiss</span></button>
      <span class="spacer"></span>${statusSel}
    </div>
    ${materialsHtml(m)}
    ${learnedHtml(j)}
    <div class="section-h">Why it matched <span class="pill accent">${pct(j.match_score)}</span></div>
    <ul class="reasons">${(j.match_reasons || []).map((r) => `<li>${esc(r)}</li>`).join("") || "<li>No reasons recorded.</li>"}</ul>
    <div class="section-h">${ico("note")} Your notes</div>
    <div class="notes-wrap"><textarea class="input" id="notesArea" placeholder="Private notes: recruiter name, referral, deadline…">${esc(j.notes)}</textarea><button class="btn btn-sm btn-ghost notes-save" id="notesSave">Save</button></div>
    <div class="section-h">Description</div>
    <div class="desc">${esc(j.description || "(no description)")}</div>`;

  $$("[data-copy]", host).forEach((b) => (b.onclick = () => {
    const body = b.closest(".mat-block").querySelector(".mat-body");
    const text = b.classList.contains("para-copy") ? b.parentElement.textContent.trim() : body.dataset.text;
    copyText(text, b);
  }));
  const wire = (sel, fn) => { const el = $(sel, host); if (el) el.onclick = fn; };
  wire("#queueBtn", (e) => queueJob(id, e.currentTarget));
  wire("#applyBtn", () => markApplied(id));
  wire("#wsBtn", () => openWorkspace(id));
  wire("#starBtn", () => toggleStar(id));
  wire("#dismissBtn", () => dismissJob(id));
  wire("#notesSave", async () => { await api(`/api/jobs/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: $("#notesArea").value }) }); toast("Notes saved", "ok"); });
  const ss = $("#statusSel", host); if (ss) ss.onchange = async (e) => { await api(`/api/jobs/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: e.target.value }) }); toast(`Status → ${label(e.target.value)}`, "ok"); softReload(); };

  if (fadeDetail) {   // the next job just advanced into view: fade it in + flag the card
    fadeDetail = false;
    host.classList.remove("fade-swap"); void host.offsetWidth; host.classList.add("fade-swap");
    const card = $(`.card[data-id="${id}"]`);
    if (card) { card.scrollIntoView({ block: "nearest" }); card.classList.add("just-selected"); setTimeout(() => card.classList.remove("just-selected"), 950); }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Actions
   ═══════════════════════════════════════════════════════════════════════════ */
// When a job leaves the current list, pick the one that slides into its place
// (the next job, or the previous if it was last).
function nextAfter(id) {
  const idx = listCache.indexOf(id);
  const remaining = listCache.filter((x) => x !== id);
  return remaining[idx] || remaining[idx - 1] || null;
}
// Drop one card out of the visible list in place: fade it out, remove it from
// the DOM and from listCache, but leave every other card untouched. The list
// only ever gets refetched (with its loading skeleton) when it runs dry or on
// an explicit Refresh — never as a side effect of a single dismiss/queue.
function removeCard(id) {
  listCache = listCache.filter((x) => x !== id);
  const card = $(`.card[data-id="${id}"]`);
  if (card) {
    card.addEventListener("animationend", () => card.remove(), { once: true });
    card.classList.add("removing");
  }
}
// Advance the UI first, let the API call catch up in the background — the
// dismiss/queue POST no longer blocks the move to the next job.
async function advanceAfter(id, apiCall, onOk, onErr) {
  const next = (selectedId === id) ? nextAfter(id) : selectedId;
  removeCard(id);
  selectedId = next;
  fadeDetail = !!next;   // consumed by renderDetail once the next job's content lands
  const detailP = selectedId ? renderDetail(selectedId) : Promise.resolve(clearDetail(page));
  apiCall
    .then(() => onOk(next))
    .catch((e) => { onErr(e); softReload(); });   // out of sync with the server — resync for real
  await detailP;
  refreshCounts();
  if (!listCache.length) await softReload();   // ran out — quietly pull the next batch
}
async function queueJob(id, btn) {
  if (btn) btn.disabled = true;
  const co = ($(`.card[data-id="${id}"] .co`) || {}).textContent || "";
  await advanceAfter(id, api(`/api/jobs/${id}/queue`, { method: "POST" }),
    (next) => toast(`Queued for Claude${co ? " · " + co : ""}${next ? " — next job up" : ""}`, "ok"),
    () => toast("Couldn't queue this job", "err"));
}
async function dismissJob(id) {
  await advanceAfter(id, api(`/api/jobs/${id}/dismiss`, { method: "POST" }),
    (next) => toast(`Job dismissed${next ? " — next job up" : ""}`, "info"),
    () => toast("Couldn't dismiss this job", "err"));
}
async function markApplied(id) {
  try {
    await api(`/api/jobs/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "applied" }) });
    toast("Marked as applied", "ok");
    if (wsOpenForId) { teardownWorkspace(); }
    selectedId = null;
    await setPage("queue");   // back to the queue to pick the next one
  } catch (e) { toast("Couldn't update status", "err"); }
}
async function toggleStar(id) {
  const j = await api("/api/jobs/" + id);
  const next = !j.starred;
  await api(`/api/jobs/${id}/star`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: next }) });
  toast(next ? "Starred" : "Unstarred", "ok"); reload();
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page: Jobs
   ═══════════════════════════════════════════════════════════════════════════ */
const LOCATION_OPTS = [
  ["paris", "Paris"], ["london", "London"], ["brussels", "Brussels"], ["geneva", "Switzerland (Geneva/Zürich)"],
  ["amsterdam", "Amsterdam"], ["berlin", "Berlin"], ["munich", "Munich"], ["dublin", "Dublin"],
  ["madrid", "Madrid"], ["barcelona", "Barcelona"], ["lisbon", "Lisbon"], ["milan", "Milan"],
  ["stockholm", "Stockholm"], ["copenhagen", "Copenhagen"], ["france", "France (other)"], ["uk", "UK (other)"],
  ["belgium", "Belgium (other)"], ["switzerland", "Switzerland (other)"], ["netherlands", "Netherlands"],
  ["germany", "Germany (other)"], ["spain", "Spain (other)"], ["italy", "Italy (other)"], ["portugal", "Portugal (other)"],
  ["ireland", "Ireland (other)"], ["sweden", "Sweden"], ["denmark", "Denmark"], ["poland", "Poland"],
  ["eu-other", "Rest of Europe"], ["remote-eu", "Remote (EU)"], ["remote-global", "Remote (Worldwide)"],
];
const CITY_LABEL = Object.fromEntries(LOCATION_OPTS);
const ROLE_LABEL = { ai_agentic: "AI / Agentic", ai_ml: "AI / ML", data_eng: "Data Eng", swe: "Software Eng" };
const JOBS_KW_CHIPS = ["Python", "Backend", "LLM", "RAG", "SQL", "Docker"];

// All jobs fetched for the current level filter (the only server-side toggle
// left); everything else — city, keywords, sponsorship, company type, posted,
// search, saved-only, sort — is instant client-side filtering over this array,
// same as the rest of this session's "make it feel instant" work.
let jobsAll = [];
const JOBS_FIRST_PAGE = 5;   // small first paint — see results immediately
const JOBS_PAGE_SIZE = 24;   // bigger batches once scrolling (fewer fetch/render cycles)
let jobsIO = null;
let jobsView = {
  allLevels: false, q: "", kw: [], cities: new Set(), spon: "", ctype: "", posted: "",
  sort: "fy", starredOnly: false, expandedId: null, visibleCount: JOBS_FIRST_PAGE,
};
function daysAgo(iso) {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return Number.isFinite(d) ? Math.max(0, Math.floor(d)) : null;
}
function jobsPasses(j, skip) {
  const v = jobsView;
  const hay = (j.title + " " + j.company + " " + (j.description || "") + " " + (j.match_reasons || []).join(" ")).toLowerCase();
  const age = daysAgo(j.posted_at);
  return (skip === "city" || !v.cities.size || v.cities.has(j.city))
    && (!v.q.trim() || hay.includes(v.q.trim().toLowerCase()))
    && v.kw.every((k) => hay.includes(k.toLowerCase()))
    && (!v.spon || j.sponsorship === v.spon)
    && (!v.ctype || (v.ctype === "startup") === !!j.is_startup)
    && (!v.posted || age == null || (v.posted === "today" ? age === 0 : age <= 7))
    && (!v.starredOnly || j.starred);
}
function computeJobsList() {
  const scoreKey = jobsView.sort === "match" ? "match_score" : "for_you";
  let list = jobsAll.filter((j) => jobsPasses(j));
  list = [...list].sort(jobsView.sort === "new"
    ? (a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0)
    : (a, b) => (b[scoreKey] ?? b.match_score) - (a[scoreKey] ?? a.match_score));
  return list;
}
function jobBlurb(description) {
  const text = (description || "").replace(/\s+/g, " ").trim();
  if (text.length <= 140) return text;
  const cut = text.slice(0, 140);
  const sp = cut.lastIndexOf(" ");
  return (sp > 80 ? cut.slice(0, sp) : cut) + "…";
}
// Legal-entity suffixes strip cleanly off a company name before slugifying —
// "Chapters Group AG" -> "chaptersgroup" guesses a real domain far more often
// than "chaptersgroupag" does. Word-boundary match only: never eat a suffix
// that's fused into the brand itself.
const _CO_SUFFIX_RE = /\b(gmbh|ag|ltd|llc|inc|corp|corporation|co|sa|srl|bv|plc|oy|ab|nv|spa|pty|kg|sarl|kk)\.?\s*$/i;
function companyAvatarHtml(company) {
  const mono = esc((company || "?").trim().slice(0, 2).toUpperCase());
  const stripped = (company || "").trim().replace(_CO_SUFFIX_RE, "").trim();
  const domain = (stripped || company || "").toLowerCase().replace(/[^a-z0-9]+/g, "") + ".com";
  return `<span class="jf-avatar"><span class="jf-avatar-mono">${mono}</span>` +
    `<img class="jf-avatar-img" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="" loading="lazy" onerror="this.remove()"></span>`;
}
function scoreBarHtml(pctVal) {
  return `<div class="score-bar"><div class="score-bar-fill" style="width:${pctVal}%"></div></div>`;
}
function jobTagsHtml(j) {
  const sponLabel = j.sponsorship === "likely_sponsors" ? "Sponsors visas" : j.sponsorship === "no_sponsorship" ? "No sponsorship" : "Visa not mentioned";
  const tags = [
    [label(j.seniority) + (j.req_years ? " · " + j.req_years + "y" : ""), "jobs"],
    [CITY_LABEL[j.city] || label(j.city), "pin"],
    [sponLabel, "globe", j.sponsorship === "likely_sponsors" ? "tag-sky" : ""],
    [j.is_startup ? "Startup" : "Established", "building"],
    [ROLE_LABEL[j.role_family] || label(j.role_family), "tag", "tag-accent"],
  ];
  return tags.map(([txt, ic, cls]) => `<span class="chip tag-chip ${cls || ""}">${ico(ic, "ico tag-ico")}${esc(txt)}</span>`).join("");
}
async function renderJobs() {
  $("#view").innerHTML = `
    <div class="pagehead"><div class="pagehead-l"><h1 class="pagetitle">Jobs</h1><p class="pagesub" id="jfSummary">Loading…</p></div>
      <div class="pagehead-r"><button class="btn btn-ghost" id="reloadBtn">${ico("refresh", "btn-ico")}<span>Refresh</span></button></div></div>
    <div class="jf-layout">
      <aside class="jf-side" id="jfSide"></aside>
      <div class="jf-feed">
        <div class="jf-feedtop">
          <div class="seg" id="jfTabs"></div>
          <span class="grow"></span>
          <div class="jf-sort"><span class="jf-sort-lbl">Sort</span><div class="seg" id="jfSort"></div></div>
        </div>
        <div class="jf-hint" id="jfHint"></div>
        <div id="jfCards"></div>
      </div>
    </div>`;
  $("#reloadBtn").onclick = () => loadJobsAll(true);
  await loadJobsAll(false);
}
async function loadJobsAll(forceToast) {
  $("#jfCards").innerHTML = skeletons();
  const [data, prefs] = await Promise.all([
    api("/api/jobs?level=" + (jobsView.allLevels ? "all" : "suitable")),
    api("/api/preferences").catch(() => null),
  ]);
  jobsAll = data.jobs;
  jobsPrefs = prefs && prefs.preferences;
  jobsView.visibleCount = JOBS_FIRST_PAGE;
  // Arriving here from Overview or the command palette with a specific job in
  // mind (selectedId already set) opens straight to it, expanded and in view.
  const preselect = selectedId && jobsAll.some((j) => j.id === selectedId) ? selectedId : null;
  jobsView.expandedId = preselect;
  renderJobsFeed();
  if (preselect) {
    const card = $(`.card[data-id="${preselect}"]`);
    if (card) card.scrollIntoView({ block: "center" });
    const j = jobsAll.find((x) => x.id === preselect);
    if (j) { api("/api/jobs/" + preselect).then((full) => { j._learned = full.learned_reasons || []; if (jobsView.expandedId === preselect) renderJobsFeed(); }).catch(() => {}); }
  }
  if (forceToast) toast("Refreshed", "ok");
}
function jfPrefBoxHtml() {
  const p = jobsPrefs || {};
  const chips = [];
  (p.titles || []).slice(0, 3).forEach((t) => chips.push([t, "jobs"]));
  if ((p.titles || []).length > 3) chips.push(["+" + (p.titles.length - 3) + " titles", "jobs"]);
  (p.locations || []).slice(0, 2).forEach((l) => chips.push([CITY_LABEL[l] || label(l), "pin"]));
  if ((p.locations || []).length > 2) chips.push(["+" + (p.locations.length - 2) + " places", "pin"]);
  chips.push([(p.language ? label(p.language) : "Match posting") + " letters", "lang"]);
  return `<div class="jf-prefbox">
    <div class="jf-prefhead"><span>Your preferences</span><button class="linklike" id="jfEditPrefs">Edit</button></div>
    <div class="jf-chiprow">${chips.map(([t, ic]) => `<span class="chip pref-chip">${ico(ic, "ico tag-ico")}${esc(t)}</span>`).join("")}</div>
  </div>`;
}
function jfSideHtml() {
  const v = jobsView;
  const avail = jobsAll;
  const cityCounts = {};
  avail.forEach((j) => { if (jobsPasses(j, "city")) cityCounts[j.city] = (cityCounts[j.city] || 0) + 1; });
  const cityKeys = Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a]);
  const cityRows = cityKeys.map((c) => {
    const on = v.cities.has(c);
    return `<button class="jf-cityrow ${on ? "on" : ""}" data-city="${esc(c)}"><span class="jf-checkbox">${on ? ico("check") : ""}</span><span class="jf-citylbl">${esc(CITY_LABEL[c] || label(c))}</span><span class="jf-cityn">${cityCounts[c]}</span></button>`;
  }).join("");
  const kwChips = JOBS_KW_CHIPS.map((k) => `<button class="chip filter-chip ${v.kw.includes(k) ? "on" : ""}" data-kw="${esc(k)}">${esc(k)}</button>`).join("");
  const pill = (val, cur, label_) => `<button class="chip filter-chip ${cur === val ? "on" : ""}" data-pillval="${esc(val)}">${esc(label_)}</button>`;
  const hasFilters = !!(v.cities.size || v.kw.length || v.q || v.spon || v.ctype || v.posted || v.allLevels);
  return `${jfPrefBoxHtml()}
    <div class="jf-filterbox">
      <div class="jf-fgroup">
        <div class="jf-flabel">Keywords</div>
        <div class="searchbox jf-kwsearch"><span class="ci">${ICONS.search}</span><input class="input" id="jfQ" placeholder="Title, company, skill" value="${esc(v.q)}"></div>
        <div class="jf-chiprow" id="jfKwChips">${kwChips}</div>
      </div>
      <div class="jf-fgroup">
        <div class="jf-flabel">City</div>
        <div class="jf-citylist">${cityRows || `<div class="jf-noneyet">No jobs harvested yet.</div>`}</div>
      </div>
      <div class="jf-fgroup" data-pillgroup="spon">
        <div class="jf-flabel">Visa sponsorship</div>
        <div class="jf-chiprow">${pill("likely_sponsors", v.spon, "Likely")}${pill("silent", v.spon, "Not mentioned")}${pill("no_sponsorship", v.spon, "No")}</div>
      </div>
      <div class="jf-fgroup" data-pillgroup="ctype">
        <div class="jf-flabel">Company</div>
        <div class="jf-chiprow">${pill("startup", v.ctype, "Startup")}${pill("est", v.ctype, "Established")}</div>
      </div>
      <div class="jf-fgroup" data-pillgroup="posted">
        <div class="jf-flabel">Posted</div>
        <div class="jf-chiprow">${pill("today", v.posted, "Today")}${pill("week", v.posted, "This week")}</div>
      </div>
      <button class="jf-switch-row" id="jfLevelToggle"><span class="jf-switch ${v.allLevels ? "on" : ""}"><span class="jf-switch-knob"></span></span>Include senior roles</button>
      ${hasFilters ? `<button class="linklike" id="jfClear">Clear filters</button>` : ""}
    </div>`;
}
function jobCardHtml(j, scoreKey) {
  const expanded = jobsView.expandedId === j.id;
  const shown = pct(j[scoreKey] ?? j.match_score);
  return `<article class="card jf-card ${expanded ? "expanded" : ""}" data-id="${j.id}">
    <div class="jf-cardtop" data-toggle="${j.id}">
      ${companyAvatarHtml(j.company)}
      <div class="jf-cardmain">
        <div class="jf-cardtitle">${esc(j.title)}</div>
        <div class="jf-cardco">${esc(j.company)}</div>
        <div class="jf-cardblurb">${esc(jobBlurb(j.description))}</div>
        <div class="jf-chiprow">${jobTagsHtml(j)}</div>
      </div>
      <div class="jf-scorewrap"><div class="jf-scorelbl">${scoreKey === "match_score" ? "Match" : "For you"}</div><div class="jf-scorenum">${shown}<span>/100</span></div>${scoreBarHtml(shown)}</div>
    </div>
    <div class="jf-cardactions">
      <button class="btn btn-ghost btn-sm star-btn ${j.starred ? "on" : ""}" data-star="${j.id}">${ico("star", "btn-ico")}<span>${j.starred ? "Saved" : "Save"}</span></button>
      <span class="jf-posted">${ico("clock", "ico tag-ico")}${ago(j.posted_at)}</span>
      <span class="grow"></span>
      <button class="btn btn-ghost btn-sm" data-dismiss="${j.id}">${ico("x", "btn-ico")}<span>Not for me</span></button>
      <button class="btn btn-primary btn-sm" data-queue="${j.id}">Queue for Claude</button>
    </div>
    ${expanded ? jfExpandHtml(j) : ""}
  </article>`;
}
function ago(iso) {
  const d = daysAgo(iso);
  if (d == null) return "Unknown date";
  return d === 0 ? "Posted today" : d === 1 ? "Posted yesterday" : `Posted ${d}d ago`;
}
function jfExpandHtml(j) {
  const why = (j.match_reasons || []).map((r) => `<div class="jf-why-row">${esc(r)}</div>`).join("") || `<div class="jf-why-row">No reasons recorded.</div>`;
  const learned = j._learned == null
    ? `<div class="jf-why-row">${ico("refresh", "ico spin")} Loading…</div>`
    : (j._learned.length ? j._learned.map((r) => `<div class="jf-learn-row"><span class="jf-learn-w ${r.weight >= 0 ? "pos" : "neg"}">${r.weight >= 0 ? "+" : ""}${r.weight.toFixed(2)}</span><span>${esc(r.label)}: ${esc(label(String(r.value)))}</span></div>`).join("")
      : `<div class="jf-why-row">Not enough signal yet.</div>`);
  return `<div class="jf-expand">
    <div class="jf-expand-col"><div class="jf-expand-h">Why it matched · ${pct(j.match_score)}/100</div>${why}</div>
    <div class="jf-expand-col"><div class="jf-expand-h">Why it's ranked here${j.for_you != null ? " · " + pct(j.for_you) + " for you" : ""}</div>${learned}</div>
    <a class="jf-openlink" href="${esc(j.apply_url || "#")}" target="_blank" rel="noopener">Open job page ↗</a>
  </div>`;
}
function renderJobsFeed() {
  const list = computeJobsList();
  listCache = list.map((j) => j.id);
  const scoreKey = jobsView.sort === "match" ? "match_score" : "for_you";
  // A job deep-linked from Overview/palette must land in view even if it's
  // past the current page — widen the page rather than leave it unrendered.
  if (jobsView.expandedId) {
    const idx = list.findIndex((j) => j.id === jobsView.expandedId);
    if (idx >= 0 && idx >= jobsView.visibleCount) jobsView.visibleCount = idx + 1;
  }
  const shown = list.slice(0, jobsView.visibleCount || JOBS_FIRST_PAGE);
  const hasMore = shown.length < list.length;
  $("#jfCards").innerHTML = list.length
    ? shown.map((j) => jobCardHtml(j, scoreKey)).join("") + (hasMore ? `<div class="jf-sentinel" id="jfSentinel"></div>` : "")
    : emptyState("search", "Nothing matches these filters", "Widen your filters or clear them to see everything.");
  wireJobsCards();
  wireJobsLazyLoad(hasMore);
  refreshJobsChrome();
}
// Infinite scroll: the feed lives inside .jf-layout's own scroll container
// (not the window), so the observer's root has to be pointed at it explicitly.
function wireJobsLazyLoad(hasMore) {
  if (jobsIO) { jobsIO.disconnect(); jobsIO = null; }
  if (!hasMore) return;
  const sentinel = $("#jfSentinel");
  const root = $(".jf-layout");
  if (!sentinel || !root) return;
  jobsIO = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      jobsView.visibleCount = (jobsView.visibleCount || JOBS_PAGE_SIZE) + JOBS_PAGE_SIZE;
      renderJobsFeed();
    }
  }, { root, rootMargin: "600px" });
  jobsIO.observe(sentinel);
}
// Everything except the card list itself (sidebar filters, tabs, sort, the
// summary line) — split out so a single dismiss/queue can update counts
// without touching #jfCards and cancelling the card's own fade-out animation.
function refreshJobsChrome() {
  const tabsOn = jobsView.starredOnly;
  const allCount = jobsAll.filter((j) => jobsPasses(j)).length;
  $("#jfSide").innerHTML = jfSideHtml();
  $("#jfTabs").innerHTML = `
    <button class="${!tabsOn ? "on" : ""}" data-tab="all">All matches</button>
    <button class="${tabsOn ? "on" : ""}" data-tab="saved">Saved${jobsAll.filter((j) => j.starred).length ? ` <span class="seg-n">${jobsAll.filter((j) => j.starred).length}</span>` : ""}</button>`;
  $("#jfSort").innerHTML = [["fy", "For you"], ["match", "Match"], ["new", "Newest"]]
    .map(([k, l]) => `<button class="${jobsView.sort === k ? "on" : ""}" data-sort="${k}">${l}</button>`).join("");
  $("#jfHint").textContent = { fy: "For you blends the match score with what you tend to queue, save or dismiss.", match: "Match only: how well the posting fits your CV and preferences.", new: "Newest postings first." }[jobsView.sort];
  $("#jfSummary").textContent = `${allCount} at your level · matched from ${jobsAll.length} harvested`;
  wireJobsSide();
  wireJobsTop();
}
function refilterJobs() { jobsView.visibleCount = JOBS_FIRST_PAGE; renderJobsFeed(); }
function wireJobsSide() {
  const host = $("#jfSide");
  $("#jfQ", host).oninput = (e) => { jobsView.q = e.target.value; refilterJobs(); $("#jfQ").focus(); $("#jfQ").selectionStart = $("#jfQ").value.length; };
  $$("[data-kw]", host).forEach((b) => (b.onclick = () => {
    const k = b.dataset.kw; jobsView.kw = jobsView.kw.includes(k) ? jobsView.kw.filter((x) => x !== k) : [...jobsView.kw, k]; refilterJobs();
  }));
  $$(".jf-cityrow", host).forEach((b) => (b.onclick = () => {
    const c = b.dataset.city; if (jobsView.cities.has(c)) jobsView.cities.delete(c); else jobsView.cities.add(c); refilterJobs();
  }));
  $$("[data-pillval]", host).forEach((b) => (b.onclick = () => {
    const group = b.closest("[data-pillgroup]").dataset.pillgroup;
    const key = group === "spon" ? "spon" : group === "ctype" ? "ctype" : "posted";
    jobsView[key] = jobsView[key] === b.dataset.pillval ? "" : b.dataset.pillval;
    refilterJobs();
  }));
  const lvl = $("#jfLevelToggle", host); if (lvl) lvl.onclick = () => { jobsView.allLevels = !jobsView.allLevels; loadJobsAll(false); };
  const clr = $("#jfClear", host); if (clr) clr.onclick = () => { jobsView = { ...jobsView, q: "", kw: [], cities: new Set(), spon: "", ctype: "", posted: "", allLevels: false }; loadJobsAll(false); };
  const editP = $("#jfEditPrefs", host); if (editP) editP.onclick = () => setPage("profile");
}
function wireJobsTop() {
  $$("#jfTabs [data-tab]").forEach((b) => (b.onclick = () => { jobsView.starredOnly = b.dataset.tab === "saved"; refilterJobs(); }));
  $$("#jfSort [data-sort]").forEach((b) => (b.onclick = () => { jobsView.sort = b.dataset.sort; refilterJobs(); }));
}
function wireJobsCards() {
  const host = $("#jfCards");
  $$("[data-toggle]", host).forEach((el) => (el.onclick = () => toggleJobExpand(el.dataset.toggle)));
  $$("[data-star]", host).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleStarCard(b.dataset.star); }));
  $$("[data-dismiss]", host).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); dismissJobCard(b.dataset.dismiss); }));
  $$("[data-queue]", host).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); queueJobCard(b.dataset.queue); }));
}
async function toggleJobExpand(id) {
  jobsView.expandedId = jobsView.expandedId === id ? null : id;
  selectedId = jobsView.expandedId;
  if (jobsView.expandedId) {
    renderJobsFeed();
    const j = jobsAll.find((x) => x.id === id);
    if (j && j._learned == null) {
      try {
        const full = await api("/api/jobs/" + id);
        j._learned = full.learned_reasons || [];
      } catch (e) { j._learned = []; }
      if (jobsView.expandedId === id) renderJobsFeed();
    }
  } else {
    renderJobsFeed();
  }
}
async function toggleStarCard(id) {
  const j = jobsAll.find((x) => x.id === id); if (!j) return;
  const next = !j.starred;
  j.starred = next;
  renderJobsFeed();
  try { await api(`/api/jobs/${id}/star`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: next }) }); toast(next ? "Saved" : "Unsaved", "ok"); }
  catch (e) { j.starred = !next; renderJobsFeed(); toast("Couldn't update", "err"); }
}
async function dismissJobCard(id) {
  const j = jobsAll.find((x) => x.id === id);
  jobsAll = jobsAll.filter((x) => x.id !== id);
  removeCard(id);
  refreshCounts();
  try { await api(`/api/jobs/${id}/dismiss`, { method: "POST" }); toast(`Job dismissed${j ? " · " + j.company : ""}`, "info"); }
  catch (e) { toast("Couldn't dismiss this job", "err"); loadJobsAll(false); return; }
  if (!jobsAll.length) loadJobsAll(false); else refreshJobsChrome();
}
async function queueJobCard(id) {
  const j = jobsAll.find((x) => x.id === id);
  jobsAll = jobsAll.filter((x) => x.id !== id);
  removeCard(id);
  refreshCounts();
  try { await api(`/api/jobs/${id}/queue`, { method: "POST" }); toast(`Queued for Claude${j ? " · " + j.company : ""}`, "ok"); }
  catch (e) { toast("Couldn't queue this job", "err"); loadJobsAll(false); return; }
  if (!jobsAll.length) loadJobsAll(false); else refreshJobsChrome();
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pages: Queue + Applications (grouped)
   ═══════════════════════════════════════════════════════════════════════════ */
async function renderGrouped(kind) {
  splitShell("Queue", "Jobs handed to Claude, materials to review, and an assistant for application questions.",
    `<button class="btn btn-ghost" id="qaBtn">${ico("chat", "btn-ico")}<span>Q&amp;A</span></button><button class="btn btn-ghost" id="reloadBtn">${ico("refresh", "btn-ico")}<span>Refresh</span></button>`);
  $("#reloadBtn").onclick = reload;
  $("#qaBtn").onclick = () => { selectedId = null; $$(".card").forEach((el) => el.classList.remove("active")); renderQAChat(); };
  await loadGrouped(QUEUE_GROUPS, QUEUE_EMPTY_ARGS);
}

/* ── Applications: one merged view — at-a-glance, company bubbles, and the
   full learned-preference insights, all in the same scroll. No tabs, no
   separate Insights page. Drilling into a company (click a bubble) swaps
   this out for the familiar list+detail history view. ─────────────────── */
let appsData = null;
let appsInsights = null;
let appsCompanyFilter = null;

// Shared by the at-a-glance strip and the full insights section below it.
function insightsTilesHtml(ins) {
  const m = ins.model;
  return `<div class="grid tiles" style="margin-bottom:16px">
    <div class="tile"><div class="t-top"><span class="t-label">Decisions</span>${ico("bolt")}</div><div class="t-num">${ins.totals.decided}</div><div class="t-foot">${ins.totals.pursued} pursued · ${ins.totals.rejected} passed</div></div>
    <div class="tile"><div class="t-top"><span class="t-label">Pursue rate</span>${ico("check")}</div><div class="t-num ok">${ins.totals.pursue_rate != null ? Math.round(ins.totals.pursue_rate * 100) + "%" : "—"}</div><div class="t-foot">of decided jobs</div></div>
    <div class="tile"><div class="t-top"><span class="t-label">Signals</span>${ico("brain")}</div><div class="t-num accent">${m.n_features}</div><div class="t-foot">feature weights</div></div>
    <div class="tile"><div class="t-top"><span class="t-label">Starred</span>${ico("star")}</div><div class="t-num">${ins.totals.starred}</div><div class="t-foot">your shortlist</div></div>
  </div>`;
}
function insightsBannerHtml(ins) {
  const m = ins.model;
  return m.ready
    ? `<div class="model-banner ready">${ico("check")}<div class="mb-txt"><b>Model active.</b> Learned from ${m.pos} pursued and ${m.neg} rejected jobs across ${m.n_features} signals. The <b>For you</b> sort now blends this with base relevance.</div></div>`
    : `<div class="model-banner">${ico("brain")}<div class="mb-txt"><b>Still learning.</b> It has ${m.pos} pursued and ${m.neg} rejected so far. <b>Dismiss</b> a few jobs you're not into (and star ones you love) so it can learn what to avoid, not just what you like.</div></div>`;
}
// The affinity panels + activity chart — everything from the old standalone
// Insights page, minus the tiles (already shown once, at the top).
function insightsPanelsHtml(ins) {
  const m = ins.model;
  const allW = [];
  ["role", "city", "company", "kw", "seniority", "sponsorship", "startup"].forEach((ns) => {
    (ins.likes[ns] || []).forEach((x) => allW.push(Math.abs(x.weight)));
    (ins.dislikes[ns] || []).forEach((x) => allW.push(Math.abs(x.weight)));
  });
  const maxW = Math.max(0.5, ...allW);
  const likePanel = (title, ns) => `<div class="panel"><h3>${title}</h3>${affRows(ins.likes[ns] || [], maxW)}</div>`;
  const maxN = ins.timeline.length ? Math.max(1, ...ins.timeline.map((d) => d.n)) : 1;
  const spark = ins.timeline.length
    ? `<div class="spark-wrap"><div class="spark">${ins.timeline.map((d) => `<div class="spark-col" title="${d.day}: ${d.n}"><span class="spark-n">${d.n || ""}</span><span class="bar" style="height:${(d.n / maxN) * 100}%"></span></div>`).join("")}</div></div>`
    : `<div style="color:var(--faint);font-size:12.5px">No activity logged yet.</div>`;
  return `
    <div class="grid aff-grid" style="margin-bottom:16px">
      ${likePanel("Roles", "role")}
      ${likePanel("Locations", "city")}
      ${likePanel("Keywords", "kw")}
      ${likePanel("Companies", "company")}
    </div>
    ${m.ready ? `<div class="grid aff-grid" style="margin-bottom:16px">
      <div class="panel"><h3>Passed on</h3>${affRows([...(ins.dislikes.kw || []), ...(ins.dislikes.role || []), ...(ins.dislikes.city || [])].sort((a, b) => a.weight - b.weight).slice(0, 8), maxW)}</div>
      <div class="panel"><h3>Level &amp; type</h3>${affRows([...(ins.likes.seniority || []), ...(ins.likes.startup || []), ...(ins.likes.sponsorship || [])], maxW)}</div>
    </div>` : ""}
    <div class="panel"><h3>Applications <span class="pill muted">30d</span></h3>${spark}</div>`;
}

function computeApplicationCompanies(data) {
  const byCo = new Map();
  for (const [status] of APP_GROUPS) {
    for (const j of (data.groups[status] || [])) {
      if (!byCo.has(j.company)) byCo.set(j.company, { company: j.company, items: [], counts: {} });
      const c = byCo.get(j.company);
      c.items.push(j);
      c.counts[status] = (c.counts[status] || 0) + 1;
    }
  }
  return [...byCo.values()].sort((a, b) => (b.items.length - a.items.length) || a.company.localeCompare(b.company));
}
function companyBubbleHtml(c) {
  const tags = [
    c.counts.interview ? `<span class="co-tag interview">${c.counts.interview} interviewing</span>` : "",
    c.counts.offer ? `<span class="co-tag offer">${c.counts.offer} offer</span>` : "",
  ].filter(Boolean).join("");
  return `<button class="co-bubble" data-co="${esc(c.company)}">
    ${companyAvatarHtml(c.company)}
    <div class="co-bubble-name">${esc(c.company)}</div>
    <div class="co-bubble-n">${c.items.length} application${c.items.length === 1 ? "" : "s"}</div>
    ${tags ? `<div class="co-bubble-tags">${tags}</div>` : ""}
  </button>`;
}
async function renderApplications() {
  $("#view").innerHTML = `
    <div class="pagehead">
      <div class="pagehead-l"><h1 class="pagetitle">Applications</h1><p class="pagesub">Where things stand, by company — and what the model has learned.</p></div>
      <div class="pagehead-r">
        <a class="btn btn-ghost" href="/api/applications.csv" download="applications.csv">${ico("download", "btn-ico")}<span>CSV</span></a>
        <button class="btn btn-ghost" id="reloadBtn">${ico("refresh", "btn-ico")}<span>Refresh</span></button>
      </div>
    </div>
    <div class="apps-wrap" id="appsBodyWrap"></div>`;
  $("#reloadBtn").onclick = reload;
  await loadApplications();
}
async function loadApplications() {
  const wrap = $("#appsBodyWrap"); if (!wrap) return;
  wrap.innerHTML = `<div class="scroll pad narrowpad">${skeletons(3)}</div>`;
  const [apps, ins] = await Promise.all([api("/api/applications"), api("/api/insights").catch(() => null)]);
  appsData = apps;
  appsInsights = ins;
  if (appsCompanyFilter && !computeApplicationCompanies(appsData).some((c) => c.company === appsCompanyFilter)) appsCompanyFilter = null;
  if (appsCompanyFilter) renderAppsDrill(); else renderAppsOverview();
}
// Default landing view: Companies (bubbles) on the left at 70% width, its
// own scroll; Insights (banner, at-a-glance, affinity panels, activity) on
// the right at 30%, no tabs. Full per-job details only show up once you
// drill into a company.
function renderAppsOverview() {
  const wrap = $("#appsBodyWrap"); if (!wrap || !appsData) return;
  const companies = computeApplicationCompanies(appsData);
  const bubblesHtml = companies.length
    ? `<div class="co-bubbles">${companies.map(companyBubbleHtml).join("")}</div>`
    : emptyState("applications", "No applications yet", "Queue a job for Claude, or mark one as applied, and it lands here.");
  wrap.innerHTML = `<div class="apps-split">
    <div class="apps-col-companies scroll pad">
      <div class="apps-section-h apps-section-h--first">Companies</div>
      ${bubblesHtml}
    </div>
    <div class="apps-col-insights scroll pad">
      ${appsInsights ? insightsBannerHtml(appsInsights) : ""}
      ${appsInsights ? `<div class="apps-section-h apps-section-h--first">At a glance</div>${insightsTilesHtml(appsInsights)}` : ""}
      ${appsInsights ? insightsPanelsHtml(appsInsights) : ""}
    </div>
  </div>`;
  $$("[data-co]", wrap).forEach((el) => (el.onclick = () => { appsCompanyFilter = el.dataset.co; selectedId = null; renderAppsDrill(); }));
}
// Drill-in: the familiar list+detail split, scoped to one company — this is
// where the full history (cover letter, CV variant, status) lives on demand.
function renderAppsDrill() {
  const wrap = $("#appsBodyWrap"); if (!wrap) return;
  wrap.innerHTML = `
    <div class="apps-drillbar"><button class="linklike" id="appsBack">← All companies</button><span class="apps-drillco">${esc(appsCompanyFilter)}</span></div>
    <div class="split"><section id="list" class="list"></section><section id="detail" class="detail"></section></div>`;
  $("#appsBack").onclick = () => { appsCompanyFilter = null; selectedId = null; renderAppsOverview(); };
  renderAppsList();
}
function renderAppsList() {
  const list = $("#list"); if (!list || !appsData) return;
  const parts = []; listCache = [];
  for (const [status, heading, iconName] of APP_GROUPS) {
    const items = (appsData.groups[status] || []).filter((j) => j.company === appsCompanyFilter);
    if (!items.length) continue;
    parts.push(`<div class="group-label">${ico(iconName)} ${esc(heading)} <span class="n">${items.length}</span></div>`);
    items.forEach((j) => { listCache.push(j.id); parts.push(cardHtml(j)); });
  }
  list.innerHTML = parts.length ? parts.join("") : emptyState("applications", `No applications for ${appsCompanyFilter}`, "");
  wireCards();
  if (selectedId && listCache.includes(selectedId)) renderDetail(selectedId); else clearDetail("applications");
}

/* ── Application Q&A chat (reusable: Queue page + Apply Workspace drawer) ─ */
function createQaChat(prefix) {
  const ids = { messages: `${prefix}Messages`, text: `${prefix}Text`, mention: `${prefix}Mention`, refs: `${prefix}Refs`, send: `${prefix}Send` };
  const st = { jobs: [], refs: [], mentionList: [], mentionSel: 0, pollTimer: null };
  const el = (id) => $("#" + id);

  function stopPoll() { if (st.pollTimer) { clearInterval(st.pollTimer); st.pollTimer = null; } }
  async function refreshJobs() {
    try {
      const a = await api("/api/applications");
      // any job you've generated materials for is referenceable (queued, ready, applied, …)
      st.jobs = Object.values(a.groups).flat().map((j) => ({ id: j.id, company: j.company, title: j.title, status: j.status }));
    } catch (e) { st.jobs = []; }
  }
  function mentionCtx() {
    const t = el(ids.text); if (!t) return null;
    const upto = t.value.slice(0, t.selectionStart);
    const m = upto.match(/(^|\s)@([\w-]*)$/);      // @ at a word boundary, up to the caret
    return m ? { q: m[2], start: t.selectionStart - m[2].length - 1 } : null;
  }
  function handleMention() {
    const ctx = mentionCtx();
    if (!ctx) return hideMention();
    const q = ctx.q.toLowerCase().replace(/[^a-z0-9]/g, "");
    st.mentionList = st.jobs.filter((j) => (j.company + j.title).toLowerCase().replace(/[^a-z0-9]/g, "").includes(q)).slice(0, 6);
    if (!st.mentionList.length) return hideMention();
    st.mentionSel = 0; renderMention();
  }
  function renderMention() {
    const pop = el(ids.mention); if (!pop) return;
    pop.innerHTML = st.mentionList.map((j, i) =>
      `<div class="qa-mi ${i === st.mentionSel ? "sel" : ""}" data-i="${i}"><span class="qa-mi-co">${esc(j.company)}</span><span class="qa-mi-title">${esc(j.title)}</span></div>`).join("");
    pop.hidden = false;
    pop.querySelectorAll(".qa-mi").forEach((elm) => (elm.onmousedown = (e) => { e.preventDefault(); pickMention(st.mentionList[+elm.dataset.i]); }));
  }
  function hideMention() { const p = el(ids.mention); if (p) { p.hidden = true; } st.mentionList = []; }
  function pickMention(job) {
    const t = el(ids.text); const ctx = mentionCtx(); if (!ctx || !job) return;
    const token = "@" + job.company.replace(/\s+/g, "");
    const before = t.value.slice(0, ctx.start);
    const after = t.value.slice(t.selectionStart);
    t.value = `${before}${token} ${after}`;
    const caret = (before + token + " ").length;
    t.setSelectionRange(caret, caret);
    addRef(job); hideMention(); t.focus();
  }
  function keydown(e) {
    const pop = el(ids.mention);
    if (pop && !pop.hidden && st.mentionList.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); st.mentionSel = (st.mentionSel + 1) % st.mentionList.length; return renderMention(); }
      if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); st.mentionSel = (st.mentionSel - 1 + st.mentionList.length) % st.mentionList.length; return renderMention(); }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); return pickMention(st.mentionList[st.mentionSel]); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return hideMention(); }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
  }
  function addRef(job) { if (!st.refs.some((r) => r.id === job.id)) { st.refs.push(job); renderRefs(); } }
  function removeRef(id) { st.refs = st.refs.filter((r) => r.id !== id); renderRefs(); }
  function renderRefs() {
    const bar = el(ids.refs); if (!bar) return;
    bar.hidden = !st.refs.length;
    bar.innerHTML = st.refs.map((r) =>
      `<span class="qa-ref">${ico("jobs")}<span class="qa-ref-co">${esc(r.company)}</span><span class="qa-ref-t">${esc(r.title)}</span><button class="qa-ref-x" data-ref="${r.id}">${ICONS.x}</button></span>`).join("");
    bar.querySelectorAll("[data-ref]").forEach((b) => (b.onclick = () => removeRef(b.dataset.ref)));
  }
  function bubble(q) {
    const tag = q.company ? `<span class="qa-co">${esc(q.company)}</span>` : "";
    const ans = q.status === "answered"
      ? `<div class="qa-a"><div class="qa-a-text">${esc(q.answer)}</div>
          <button class="btn btn-ghost btn-sm copy-btn" data-copyq="${q.id}" data-lbl="1" data-text="${esc(q.answer)}">${ico("copy", "btn-ico")}<span>Copy</span></button></div>`
      : `<div class="qa-pending">${ico("clock")} Waiting for Claude — run <code>/answer</code> in Claude Code</div>`;
    return `<div class="qa-msg">
      <div class="qa-q"><span class="qa-q-text">${esc(q.question)}</span>${tag}
        <button class="icon-btn qa-del" data-delq="${q.id}" title="Delete">${ICONS.trash}</button></div>
      ${ans}</div>`;
  }
  async function load() {
    const box = el(ids.messages); if (!box) return;
    const data = await api("/api/questions");
    if (!data.questions.length) {
      box.innerHTML = `<div class="qa-empty">${ico("chat")}<p>No questions yet.<br>Ask one below, then run <code>/answer</code> in Claude Code.</p></div>`;
    } else {
      box.innerHTML = data.questions.map(bubble).join("");
      box.querySelectorAll("[data-copyq]").forEach((b) => (b.onclick = () => copyText(b.dataset.text, b)));
      box.querySelectorAll("[data-delq]").forEach((b) => (b.onclick = async () => { await api("/api/questions/" + b.dataset.delq, { method: "DELETE" }); load(); refreshCounts(); }));
      box.scrollTop = box.scrollHeight;
    }
    stopPoll();
    if (data.pending > 0) st.pollTimer = setInterval(() => { if (el(ids.messages)) load(); else stopPoll(); }, 4000);
  }
  async function send() {
    const t = el(ids.text); const q = (t.value || "").trim(); if (!q) return;
    const job_ids = st.refs.map((r) => r.id);
    t.disabled = true;
    try {
      await api("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, job_ids }) });
      toast(job_ids.length ? `Queued with ${job_ids.length} reference${job_ids.length > 1 ? "s" : ""} — run /answer` : "Question queued — run /answer in Claude Code", "info");
      t.value = ""; st.refs = []; renderRefs(); hideMention();
      await load(); refreshCounts();
    } catch (e) { toast("Couldn't save question", "err"); }
    finally { t.disabled = false; t.focus(); }
  }
  function wire() {
    const t = el(ids.text);
    t.addEventListener("input", handleMention);
    t.addEventListener("keydown", keydown);
    t.addEventListener("blur", () => setTimeout(hideMention, 150));
    el(ids.send).onclick = send;
    renderRefs();
  }
  return { ids, state: st, stopPoll, refreshJobs, addRef, wire, load };
}
const qaMain = createQaChat("qa");
const qaWorkspace = createQaChat("wsQa");

async function renderQAChat() {
  const host = $("#detail"); if (!host) return;
  qaMain.state.refs = [];
  await qaMain.refreshJobs();
  host.innerHTML = `
    <div class="qa">
      <div class="qa-top">
        <div class="section-h" style="margin:0">${ico("chat")} Application Q&amp;A</div>
        <p class="qa-hint">Ask a question a form asks. Type <b>@</b> to reference a queued job (e.g. <code>@Wise</code>) so Claude can use that role and its generated materials. After asking, run <code>/answer</code> in Claude Code.</p>
      </div>
      <div class="qa-messages" id="qaMessages">${skeletons(2)}</div>
      <div class="qa-input">
        <div class="qa-refs" id="qaRefs" hidden></div>
        <div class="qa-row">
          <div class="qa-textwrap">
            <textarea class="input" id="qaText" rows="2" placeholder="e.g. Describe a full-stack project — or @Wise rewrite this as a cover letter"></textarea>
            <div class="qa-mention" id="qaMention" hidden></div>
          </div>
          <button class="btn btn-primary" id="qaSend">${ico("send", "btn-ico")}<span>Ask</span></button>
        </div>
      </div>
    </div>`;
  qaMain.wire();
  await qaMain.load();
}

/* ── Same Q&A chat, as a collapsible drawer inside the Apply Workspace ──── */
function toggleWsQa() {
  const drawer = $("#wsQa"); if (!drawer) return;
  drawer.classList.toggle("open", wsQaOpenFlag);
}
async function renderWsQaPanel(job) {
  const host = $("#wsQaBody"); if (!host) return;
  qaWorkspace.state.refs = [];
  await qaWorkspace.refreshJobs();
  if (job && job.id) qaWorkspace.addRef({ id: job.id, company: job.company, title: job.title });
  host.innerHTML = `
    <p class="qa-hint">Ask a question this form asks. <b>${esc(job.company)}</b> is referenced below — type <b>@</b> to add another queued job. After asking, run <code>/answer</code> in Claude Code.</p>
    <div class="qa-messages" id="wsQaMessages">${skeletons(2)}</div>
    <div class="qa-input">
      <div class="qa-refs" id="wsQaRefs" hidden></div>
      <div class="qa-row">
        <div class="qa-textwrap">
          <textarea class="input" id="wsQaText" rows="2" placeholder="e.g. Describe a full-stack project"></textarea>
          <div class="qa-mention" id="wsQaMention" hidden></div>
        </div>
        <button class="btn btn-primary" id="wsQaSend">${ico("send", "btn-ico")}<span>Ask</span></button>
      </div>
    </div>`;
  qaWorkspace.wire();
  await qaWorkspace.load();
}
async function loadGrouped(groups, emptyArgs) {
  $("#list").innerHTML = skeletons(4);
  const data = await api("/api/applications");
  const parts = []; let total = 0; listCache = [];
  for (const [status, heading, iconName] of groups) {
    const items = data.groups[status] || [];
    if (!items.length) continue;
    total += items.length;
    parts.push(`<div class="group-label">${ico(iconName)} ${esc(heading)} <span class="n">${items.length}</span></div>`);
    items.forEach((j) => { listCache.push(j.id); parts.push(cardHtml(j)); });
  }
  $("#list").innerHTML = total ? parts.join("") : emptyState(...emptyArgs);
  wireCards();
  if (selectedId && listCache.includes(selectedId)) renderDetail(selectedId); else clearDetail(page);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page: Overview
   ═══════════════════════════════════════════════════════════════════════════ */
function greeting() {
  const h = new Date().getHours();
  const t = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return config.owner_name ? `${t}, ${config.owner_name.split(" ")[0]}` : t;
}

/* ── "This week" applications strip (Overview header, beside Harvest) ──── */
const WS_DOW = ["M", "T", "W", "T", "F", "S", "S"];
function wsLocalKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function wsWeekDays() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Monday = 0 .. Sunday = 6
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}
async function loadWeekStrip() {
  const host = $("#weekStrip"); if (!host) return;
  let applied = [];
  try { applied = (await api("/api/applications/week")).applied || []; } catch (e) {}
  const host2 = $("#weekStrip"); if (!host2) return;   // page may have moved on while this awaited
  const days = wsWeekDays();
  const todayKey = wsLocalKey(new Date());
  const counts = new Map(days.map((d) => [wsLocalKey(d), 0]));
  applied.forEach((ts) => {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return;
    const key = wsLocalKey(d);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });
  const cols = days.map((d, i) => {
    const key = wsLocalKey(d);
    const n = counts.get(key) || 0;
    const state = key === todayKey ? "today" : key < todayKey ? "past" : "future";
    const shown = state === "future" ? 0 : Math.min(6, n);
    const ticks = Array.from({ length: shown }, () => `<span class="ws-tick"></span>`).join("");
    const dow = d.toLocaleDateString(undefined, { weekday: "short" });
    const tip = n ? `${dow} ${d.getDate()} · ${n} application${n === 1 ? "" : "s"}` : "No applications";
    return `<div class="ws-col ws-${state}" title="${esc(tip)}">
      <div class="ws-ticks">${ticks}</div>
      <div class="ws-lbl">${WS_DOW[i]}</div>
    </div>`;
  }).join("");
  host2.innerHTML = `<div class="ws-label">This<br>week</div><div class="ws-cols">${cols}</div>`;
}
async function renderOverview() {
  $("#view").innerHTML = `<div class="pagehead"><div class="pagehead-l"><h1 class="pagetitle">Overview</h1><p class="pagesub">Your job hunt at a glance.</p></div>
    <div class="pagehead-r">
      <div class="week-strip" id="weekStrip" title="Applications sent this week"></div>
      <button class="btn btn-ghost btn-sm harvest-trigger" id="ovHarvestBtn" data-label="Harvest">${ico("sparkle", "btn-ico")}<span class="btn-txt">Harvest</span></button>
      <button class="btn btn-ghost" id="reloadBtn">${ico("refresh", "btn-ico")}<span>Refresh</span></button>
    </div></div>
    <div class="scroll pad" id="ovBody">${skeletons(1)}</div>`;
  $("#reloadBtn").onclick = reload;
  $("#ovHarvestBtn").onclick = doHarvest;
  loadWeekStrip();
  const [stats, ins, jobsData] = await Promise.all([
    api("/api/stats"), api("/api/insights"), api("/api/jobs?sort=for_you&level=suitable"),
  ]);
  const bs = stats.by_status || {};
  const picks = jobsData.jobs.filter((j) => j.status === "interested").slice(0, 5);
  const funnelRows = [
    ["interested", "Interested"], ["queued", "Queued"], ["materials_ready", "Ready"],
    ["applied", "Applied"], ["interview", "Interview"], ["offer", "Offer"], ["rejected", "Closed"],
  ];
  const maxF = Math.max(1, ...funnelRows.map(([k]) => bs[k] || 0));
  const tile = (label_, num, cls, foot, icon, pageLink) =>
    `<div class="tile ${pageLink ? "click" : ""}" ${pageLink ? `data-goto="${pageLink}"` : ""}>
      <div class="t-top"><span class="t-label">${label_}</span>${ico(icon)}</div>
      <div class="t-num ${cls || ""}">${num}</div><div class="t-foot">${foot}</div></div>`;

  $("#ovBody").innerHTML = `
    <h1 class="hello">${esc(greeting())}</h1>
    <p class="hello-sub">${ins.totals.pursued} pursued · ${ins.totals.applied} applied · ${counts.pending} waiting for your review.</p>
    <div class="grid tiles" style="margin-bottom:16px">
      ${tile("Jobs that fit you", stats.browsable, "accent", "matched to your level", "jobs", "jobs")}
      ${tile("Ready to review", counts.pending || 0, counts.pending ? "ok" : "", "materials generated", "check", "queue")}
      ${tile("Applied", ins.totals.applied, "", "in flight", "send", "applications")}
      ${tile("Starred", ins.totals.starred, "", "your shortlist", "star", "jobs")}
    </div>
    <div class="grid two-col">
      <div class="panel">
        <h3>${ico("bolt")} Top picks for you <a data-goto="jobs">See all →</a></h3>
        <div class="picks">${picks.length ? picks.map((j) => `<div class="pick" data-id="${j.id}">
          <span class="p-score">${pct(j.for_you)}</span>
          <div class="p-main"><div class="p-title">${esc(j.title)}</div><div class="p-co">${esc(j.company)} · ${esc(j.city)}</div></div>
          ${ico("arrow")}</div>`).join("") : emptyState("sparkle", "Nothing to pick yet", "Harvest jobs to get started.")}</div>
      </div>
      <div class="panel">
        <h3>${ico("insights")} Pipeline <a data-goto="insights">Insights →</a></h3>
        <div class="funnel">${funnelRows.map(([k, l]) => `<div class="fn-row">
          <span class="fn-k"><span class="dotc" style="background:${STATUS_COLOR[k]}"></span>${l}</span>
          <span class="fn-bar"><span style="--f:${(bs[k] || 0) / maxF};background:${STATUS_COLOR[k]}"></span></span>
          <span class="fn-n">${bs[k] || 0}</span></div>`).join("")}</div>
      </div>
    </div>`;
  // "insights" was a distinct page/tab once; it now just lives further down
  // the Applications view, so the goto target collapses to that page.
  $$("[data-goto]").forEach((el) => (el.onclick = () => setPage(el.dataset.goto === "insights" ? "applications" : el.dataset.goto)));
  $$(".pick[data-id]").forEach((el) => (el.onclick = () => { selectedId = el.dataset.id; setPage("jobs"); }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Insights — affinity rows shared by the panels rendered inside Applications
   ═══════════════════════════════════════════════════════════════════════════ */
function affRows(list, maxW) {
  if (!list.length) return `<div style="color:var(--faint);font-size:12.5px;padding:4px 0">Not enough signal yet.</div>`;
  return `<div class="aff">${list.map((x) => {
    const w = Math.min(1, Math.abs(x.weight) / maxW);
    const side = x.weight >= 0 ? "pos" : "neg";
    const style = x.weight >= 0 ? `left:50%;width:${w * 50}%` : `right:50%;width:${w * 50}%`;
    return `<div class="aff-row"><span class="aff-k">${esc(label(String(x.value)))}</span>
      <span class="aff-track"><span class="${side}" style="${style}"></span></span>
      <span class="aff-sup">${x.pos}✓ ${x.neg}✕</span></div>`;
  }).join("")}</div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page: Profile (search preferences + CV + application voice, all editable)
   ═══════════════════════════════════════════════════════════════════════════ */
let profileEditing = false;
const PREF_EXP = [["", "No preference"], ["0-1", "0-1 yrs"], ["1-3", "1-3 yrs"], ["3-5", "3-5 yrs"], ["5-8", "5-8 yrs"], ["8+", "8+ yrs"]];
const PREF_LANG = [["", "No preference"], ["english", "English"], ["french", "French"], ["both", "Both"]];

async function renderProfile() {
  $("#view").innerHTML = `<div class="pagehead"><div class="pagehead-l"><h1 class="pagetitle">Profile</h1><p class="pagesub">What you search for, and the CV and voice that shape every application.</p></div>
    <div class="pagehead-r"><div class="seg"><button data-mode="view" class="${!profileEditing ? "on" : ""}">Preview</button><button data-mode="edit" class="${profileEditing ? "on" : ""}">Edit</button></div></div></div>
    <div class="scroll pad" id="profBody">${skeletons(1)}</div>`;
  $$('.seg [data-mode]').forEach((b) => (b.onclick = () => { profileEditing = b.dataset.mode === "edit"; renderProfile(); }));
  const [p, pref] = await Promise.all([api("/api/profile"), api("/api/preferences")]);
  const prefsHtml = searchPrefsHtml(pref);
  const cvBlock = profileEditing
    ? `<div><div class="section-h">My CV <span class="pill muted">cv/cv.md</span></div><textarea class="input" id="cvEdit" style="min-height:44vh">${esc(p.cv)}</textarea></div>`
    : `<div><div class="section-h">My CV <span class="pill muted">cv/cv.md</span></div><div class="panel">${mdLite(p.cv || "(no cv.md yet — switch to Edit to add one)")}</div></div>`;
  const voiceBlock = profileEditing
    ? `<div><div class="section-h">Application voice <span class="pill muted">preferences.md</span></div><textarea class="input" id="prefEdit" style="min-height:44vh">${esc(p.preferences)}</textarea></div>`
    : `<div><div class="section-h">Application voice <span class="pill muted">preferences.md</span></div><div class="panel">${mdLite(p.preferences || "(no preferences.md)")}</div></div>`;
  const saveRow = profileEditing
    ? `<div class="modal-actions" style="justify-content:flex-start"><button class="btn btn-primary" id="saveProf">${ico("check", "btn-ico")}<span>Save CV &amp; voice</span></button></div>` : "";

  $("#profBody").innerHTML = `${prefsHtml}
    <div class="grid two-col" style="margin-top:20px">${cvBlock}${voiceBlock}</div>${saveRow}`;

  wireSearchPrefs(pref);
  if (profileEditing) {
    $("#saveProf").onclick = async () => {
      await api("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv: $("#cvEdit").value, preferences: $("#prefEdit").value }) });
      toast("CV & voice saved", "ok");
    };
  }
}

/* ── Search preferences: countries, role families, titles, keywords ──────── */
// Working copy, mutated by the chip/tag widgets, read on save.
let spDraft = null;
function searchPrefsHtml(pref) {
  const P = pref.preferences || {};
  spDraft = {
    locations: [...(P.locations || [])], role_families: [...(P.role_families || [])],
    titles: [...(P.titles || [])], keywords: [...(P.keywords || [])],
    experience: P.experience || "", language: P.language || "",
  };
  const cat = pref.catalog || { locations: [], role_families: [] };
  const chip = (group, tok, lbl, on) => `<button type="button" class="ob-chip ${on ? "on" : ""}" data-sp="${group}" data-val="${esc(tok)}">${esc(lbl)}</button>`;
  const locChips = cat.locations.map(([t, l]) => chip("locations", t, l, spDraft.locations.includes(t))).join("");
  const roleChips = cat.role_families.map(([t, l]) => chip("role_families", t, l, spDraft.role_families.includes(t))).join("");
  const sel = (id, opts, cur) => `<select class="input" id="${id}" style="max-width:220px">${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  const savedPill = pref.saved ? `<span class="pill ok">saved</span>` : `<span class="pill muted">from onboarding</span>`;
  return `
    <div class="panel sp-panel">
      <div class="sp-head">
        <div><div class="section-h" style="margin:0">${ico("search")} Search preferences ${savedPill}</div>
          <p class="qa-hint" style="margin:6px 0 0">Where and what to search for. These drive the harvester and ranking — edit them here anytime, no need to re-onboard. <b>Leave a group empty to include everything.</b></p></div>
      </div>
      <div class="sp-grid">
        <div class="sp-field"><label class="sp-label">Locations &amp; countries</label><div class="ob-chips" id="sp-locations">${locChips}</div></div>
        <div class="sp-field"><label class="sp-label">Role families</label><div class="ob-chips" id="sp-role_families">${roleChips}</div></div>
        <div class="sp-field"><label class="sp-label">Job titles to target <span class="hint">e.g. "backend engineer", "MLOps"</span></label>
          <div class="sp-tags" id="sp-titles-tags"></div>
          <div class="ob-add"><input class="input" id="sp-titles-add" placeholder="Add a job title…"><button type="button" class="btn btn-ghost btn-sm" id="sp-titles-btn">Add</button></div></div>
        <div class="sp-field"><label class="sp-label">Keywords to boost <span class="hint">skills / tech that should rank higher</span></label>
          <div class="sp-tags" id="sp-keywords-tags"></div>
          <div class="ob-add"><input class="input" id="sp-keywords-add" placeholder="Add a keyword…"><button type="button" class="btn btn-ghost btn-sm" id="sp-keywords-btn">Add</button></div></div>
        <div class="sp-field"><label class="sp-label">Experience level</label>${sel("sp-experience", PREF_EXP, spDraft.experience)}</div>
        <div class="sp-field"><label class="sp-label">Cover-letter language</label>${sel("sp-language", PREF_LANG, spDraft.language)}</div>
      </div>
      <div class="sp-actions">
        <button class="btn btn-primary" id="sp-save">${ico("check", "btn-ico")}<span>Save preferences</span></button>
        <button class="btn btn-ok" id="sp-save-harvest">${ico("sparkle", "btn-ico")}<span>Save &amp; re-harvest</span></button>
      </div>
    </div>`;
}
function wireSearchPrefs() {
  // chip groups (locations, role_families): toggle membership in the draft
  $$("[data-sp]").forEach((b) => (b.onclick = () => {
    const g = b.dataset.sp, v = b.dataset.val;
    const arr = spDraft[g];
    const i = arr.indexOf(v);
    if (i >= 0) { arr.splice(i, 1); b.classList.remove("on"); }
    else { arr.push(v); b.classList.add("on"); }
  }));
  // tag inputs (titles, keywords)
  ["titles", "keywords"].forEach((g) => {
    const box = $(`#sp-${g}-tags`);
    const draw = () => {
      box.innerHTML = spDraft[g].map((t, i) =>
        `<span class="sp-tag">${esc(t)}<button type="button" data-rm="${g}" data-i="${i}">${ICONS.x}</button></span>`).join("")
        || `<span class="sp-tag-empty">none — matches everything</span>`;
      box.querySelectorAll("[data-rm]").forEach((x) => (x.onclick = () => { spDraft[g].splice(+x.dataset.i, 1); draw(); }));
    };
    const input = $(`#sp-${g}-add`);
    const add = () => { const v = input.value.trim(); if (v && !spDraft[g].some((t) => t.toLowerCase() === v.toLowerCase())) spDraft[g].push(v); input.value = ""; input.focus(); draw(); };
    $(`#sp-${g}-btn`).onclick = add;
    input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } };
    draw();
  });
  const collect = () => ({
    locations: spDraft.locations, role_families: spDraft.role_families,
    titles: spDraft.titles, keywords: spDraft.keywords,
    experience: $("#sp-experience").value, language: $("#sp-language").value,
  });
  const save = async () => {
    await api("/api/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(collect()) });
  };
  $("#sp-save").onclick = async () => { await save(); toast("Search preferences saved", "ok"); renderProfile(); };
  $("#sp-save-harvest").onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      await save();
      toast("Saved — re-harvesting with your preferences…", "info");
      const s = await api("/api/harvest", { method: "POST" });
      toast(`Harvested ${s.kept} jobs${s.errors && s.errors.length ? ` · ${s.errors.length} skipped` : ""}`, "ok");
      await refreshCounts(); renderProfile();
    } catch (err) { toast("Re-harvest failed", "err"); btn.disabled = false; }
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page: How to use (About)
   ═══════════════════════════════════════════════════════════════════════════ */
function renderAbout() {
  const step = (n, title, body) => `<li class="step"><span class="step-n">${n}</span><div><div class="step-t">${title}</div><div class="step-b">${body}</div></div></li>`;
  const cmd = (c, where, body) => `<div class="cmd"><div class="cmd-top"><code class="cmd-code">${esc(c)}</code><span class="cmd-where">${where}</span></div><div class="cmd-body">${body}</div></div>`;
  const key = (k, d) => `<div class="kbd-row"><span class="kbd-keys">${k}</span><span class="kbd-desc">${d}</span></div>`;
  const pageRow = (icon, name, d) => `<div class="pg-row">${ico(icon)}<div><b>${name}</b> ${d}</div></div>`;

  $("#view").innerHTML = `
    <div class="pagehead"><div class="pagehead-l"><h1 class="pagetitle">${ico("book")} How to use job cache</h1>
      <p class="pagesub">The whole workflow, every command, and the shortcuts.</p></div></div>
    <div class="scroll pad narrowpad" id="aboutBody">
      <div class="ab-hero">
        <p>job cache finds real jobs, ranks them against your CV, and helps you apply, all locally and with <b>no API keys</b>. The AI is <b>you running Claude Code</b> in this repo: the dashboard and Claude talk through files in the <code>queue/</code> folder, so there's nothing to pay for. Assisted apply, not auto-apply: it finds, ranks, and drafts; you review and submit.</p>
      </div>

      <div class="ab-grid">
        <div class="panel ab-flow">
          <h3>${ico("bolt")} The workflow</h3>
          <ol class="steps">
            ${step(1, "Set what you want", "In <b>Profile → Search preferences</b>, pick your countries, role families, target titles and keywords (leave a group empty to include everything). This drives what gets harvested and how it's ranked.")}
            ${step(2, "Harvest", "Click <b>Harvest jobs</b> (bottom-left). It pulls fresh postings from free public ATS boards <b>and</b> keyless aggregators (Remotive, Arbeitnow, Jobicy, Himalayas, RemoteOK, The Muse), so the pool is wide. The first launch does this automatically.")}
            ${step(3, "Browse", "Go to <b>Jobs</b>. Filter, search, and sort by <b>For you</b>. Star ones you like, take private notes, or dismiss the rest. Jobs you've applied to or dismissed drop out of this list.")}
            ${step(4, "Queue", "On a job you want, click <b>Queue for Claude</b>. It moves to the <b>Queue</b> tab.")}
            ${step(5, "Generate", "In a terminal in this repo, run <code>claude</code>, then <code>/apply</code>. Claude writes a tailored cover letter and per-role notes, grouped by company, in your voice.")}
            ${step(6, "Review &amp; apply", "Back in the app, open a queued job. Read the materials, hit <b>Apply workspace</b> for side-by-side copy-paste (or <b>Pop out</b> the form), submit, then click <b>Mark as applied</b>.")}
            ${step(7, "Answer questions", "For custom form questions (\"describe a project…\"), use the <b>Q&amp;A</b> on the Queue page. Type <b>@</b> to reference a job, ask, run <code>/answer</code>, and copy the draft.")}
            ${step(8, "Track &amp; learn", "<b>Applications</b> tracks each one's status, grouped by company, with what the model has learned right below — it sharpens the <b>For you</b> ranking as you go.")}
          </ol>
        </div>

        <div class="ab-side">
          <div class="panel">
            <h3>${ico("terminal")} Commands</h3>
            <div class="cmd-list">
              ${cmd("./run.sh", "terminal", "Start the app at <code>localhost:8000</code>. First run installs everything and harvests jobs. Port busy? <code>PORT=8080 ./run.sh</code>.")}
              ${cmd("/apply", "Claude Code", "Turn your queued jobs into tailored cover letters + CV notes, grouped by company.")}
              ${cmd("/answer", "Claude Code", "Draft answers to the application questions you asked in the Queue Q&amp;A (uses your @-referenced jobs).")}
              ${cmd("/setup", "Claude Code", "Install and launch on a fresh machine, end to end.")}
            </div>
          </div>
          <div class="panel">
            <h3>${ico("brain")} Good to know</h3>
            <div class="pg-list">
              ${pageRow("sparkle", "The AI is Claude Code.", "No keys, no cost. The dashboard hands work to Claude via the <code>queue/</code> folder; you run the command.")}
              ${pageRow("insights", "It learns from you.", "Every queue, apply, star, and dismiss trains the local model behind the <b>For you</b> sort and <b>Insights</b>.")}
              ${pageRow("popout", "Some forms can't embed.", "Ashby/Workday block being framed. Use <b>Pop out</b> to open the form beside your materials.")}
            </div>
          </div>
        </div>
      </div>

      <div class="ab-grid2">
        <div class="panel">
          <h3>${ico("jobs")} The pages</h3>
          <div class="pg-list">
            ${pageRow("overview", "Overview", "your hunt at a glance, plus top picks.")}
            ${pageRow("jobs", "Jobs", "browse matches (hides applied &amp; dismissed).")}
            ${pageRow("queue", "Queue", "pursue jobs, review materials, and the Q&amp;A assistant.")}
            ${pageRow("applications", "Applications", "your tracker by company, with what the model has learned built in, and CSV export.")}
            ${pageRow("profile", "Profile", "your search preferences (countries, roles, titles, keywords), CV, and voice.")}
          </div>
        </div>
        <div class="panel">
          <h3>${ico("bolt")} Keyboard shortcuts</h3>
          <div class="kbd-grid">
            ${key("<kbd>⌘</kbd><kbd>K</kbd>", "Command palette (search + jump + actions)")}
            ${key("<kbd>g</kbd> then <kbd>o</kbd>/<kbd>j</kbd>/<kbd>q</kbd>/<kbd>a</kbd>/<kbd>p</kbd>/<kbd>h</kbd>", "Go to a page")}
            ${key("<kbd>j</kbd> / <kbd>k</kbd>", "Move up / down the list")}
            ${key("<kbd>s</kbd>", "Star the selected job")}
            ${key("<kbd>e</kbd>", "Queue the selected job")}
            ${key("<kbd>x</kbd>", "Dismiss the selected job")}
            ${key("<kbd>/</kbd>", "Search jobs")}
            ${key("<kbd>Esc</kbd>", "Close a dialog or the workspace")}
            ${key("<kbd>?</kbd>", "Show this shortcut list")}
          </div>
        </div>
      </div>

      <div class="panel ab-share">
        <h3>${ico("download")} Share with a friend</h3>
        <p>Anyone can clone the repo and run <code>./run.sh</code> with their own <code>cv/cv.md</code> and <code>preferences.md</code> (or paste them in the first-run welcome). In <b>Settings</b> you can <b>Export</b> your jobs, decisions, and learned model to a file, and a friend can <b>Import</b> it.</p>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Apply workspace (iframe + copyable materials)
   ═══════════════════════════════════════════════════════════════════════════ */
let wsQaOpenFlag = false;
let wsOpenForId = null;   // id of the job currently docked in the workspace, or null
async function openWorkspace(id) {
  const host = $("#detail"); if (!host) return;
  const j = await api("/api/jobs/" + id);
  if (!j.apply_url) { toast("No apply URL for this job", "err"); return; }
  wsOpenForId = id;
  updateSidebarCompact();
  const m = j.materials_struct;
  const applied = j.status === "applied";
  const leftBlocks = m ? materialsHtml(m) : emptyState("sparkle", "No materials yet", "Queue this job and run /apply first.");
  host.classList.add("ws-host");
  host.innerHTML = `
    <div class="ws-head">
      <div><div class="ws-title">${esc(j.title)}</div><div class="ws-co">${esc(j.company)} · ${esc(j.city)}</div></div>
      <span class="spacer"></span>
      ${applied ? `<span class="pill ok">Applied</span>` : `<button class="btn btn-ok" id="wsApply">${ico("check", "btn-ico")}<span>Mark as applied</span></button>`}
      <button class="icon-btn" id="wsClose" title="Close (Esc)">${ICONS.x}</button>
    </div>
    <div class="ws-body">
      <div class="ws-left">
        <div style="color:var(--muted);font-size:12.5px;line-height:1.6">Copy from here, paste into the form. If the form won't embed on the right, hit <b>Pop out</b> to open it in a window beside the app. Hover a paragraph for a per-paragraph copy button.</div>
        ${leftBlocks}
      </div>
      <div class="ws-right">
        <div class="ws-toolbar">
          <span class="url">${esc(j.apply_url)}</span>
          <button class="btn btn-ghost btn-sm" id="wsReload" title="Reload">${ico("refresh", "btn-ico")}</button>
          <button class="btn btn-primary btn-sm" id="wsPop">${ico("popout", "btn-ico")}<span>Pop out</span></button>
          <button class="btn btn-ghost btn-sm" id="wsQaToggle" title="Application Q&amp;A">${ico("chat", "btn-ico")}<span>Q&amp;A</span></button>
        </div>
        <div class="ws-hint">${ico("info")}<span>Loaded but the form looks blank? A handful of sites block framing hard enough that nothing renders right — hit <b>Pop out</b> above to open it in a window beside the app instead.</span></div>
        <div class="ws-stage" id="wsStage"></div>
      </div>
      <div class="ws-qa ${wsQaOpenFlag ? "open" : ""}" id="wsQa">
        <div class="ws-qa-head">
          <div class="section-h" style="margin:0">${ico("chat")} Application Q&amp;A</div>
          <span class="spacer"></span>
          <button class="icon-btn" id="wsQaClose" title="Collapse">${ICONS.x}</button>
        </div>
        <div class="ws-qa-body qa" id="wsQaBody">${skeletons(2)}</div>
      </div>
    </div>`;
  $$("[data-copy]", host).forEach((b) => (b.onclick = () => {
    const body = b.closest(".mat-block").querySelector(".mat-body");
    const text = b.classList.contains("para-copy") ? b.parentElement.textContent.trim() : body.dataset.text;
    copyText(text, b);
  }));
  $("#wsClose").onclick = closeWorkspace;
  $("#wsReload").onclick = () => loadWsStage(id, j.apply_url);
  $("#wsPop").onclick = () => openDirectPopout(j.apply_url);
  $("#wsQaToggle").onclick = () => { wsQaOpenFlag = !wsQaOpenFlag; toggleWsQa(); };
  $("#wsQaClose").onclick = () => { wsQaOpenFlag = false; toggleWsQa(); };
  const wa = $("#wsApply"); if (wa) wa.onclick = () => markApplied(id);  // closes workspace + goes to Queue
  loadWsStage(id, j.apply_url);
  await renderWsQaPanel(j);
}
// Opens the apply page in its own positioned window — used by the toolbar's
// "Pop out" button and by the blocked-embed fallback card's CTA.
function openDirectPopout(url) {
  const w = Math.min(1040, Math.floor(screen.availWidth * 0.52));
  const left = Math.max(0, screen.availWidth - w);
  const win = window.open(url, "jobapply", `width=${w},height=${Math.max(700, screen.availHeight - 60)},left=${left},top=24`);
  if (!win) { toast("Allow pop-ups for localhost, or opening in a new tab", "info"); window.open(url, "_blank", "noopener"); }
}
function wsBlockedHtml(url) {
  return `<div class="empty">${ico("lock")}<h3>Oh, guess this website won't let us in</h3>
    <p>This one refuses to load inside the workspace (dead link, blocked, or just not answering). The job itself is one click away though.</p>
    <button class="btn btn-primary" id="wsOpenDirect">${ico("popout", "btn-ico")}<span>Open job page</span></button></div>`;
}
// Some client-rendered ATS pages (Ashby, notably) block framing outright, so
// the only way in is fetching the HTML ourselves and loading it via srcdoc —
// which changes its origin. Their own JS then can't fetch its own job data
// (now cross-origin) and quietly renders ITS OWN "page not found", which lies
// to the user: the job is fine, only the embed broke. Caught by
// wsLooksMisrendered below and swapped for this instead.
function wsMisrenderedHtml(url) {
  return `<div class="empty">${ico("lock")}<h3>That "not found" is a lie</h3>
    <p>This site's application form only works once it thinks it owns the address bar. Embedding it broke that, and it's showing you a fake dead end, not a real one. Pop it out and it'll load fine.</p>
    <button class="btn btn-primary" id="wsOpenDirect">${ico("popout", "btn-ico")}<span>Open job page</span></button></div>`;
}
function wsLooksMisrendered(text) {
  const t = (text || "").trim();
  return t.length < 40 || /\b(page not found|not found|application error|something went wrong)\b/i.test(t);
}
// (Re)loads the right-hand stage. Always asks our backend first whether this
// site blocks framing (checks its real X-Frame-Options/CSP headers): sites
// that don't block get a real iframe src (mode "direct") so their own JS runs
// with its real origin and works normally; sites that do block get the
// fetched HTML with those headers stripped, via srcdoc (mode "proxy") — a
// fallback that can still misrender for client apps that don't survive an
// origin change, but it's the only way to beat an actual framing block. A
// dead link or a hard embedding failure (site refuses to answer, isn't HTML)
// shows the blocked-card fallback instead of an error rendered inside the
// iframe.
async function loadWsStage(id, url) {
  const stage = $("#wsStage");
  if (!stage) return;
  stage.innerHTML = `<div class="empty">${ico("refresh", "ico spin")}<h3>Loading the application page…</h3></div>`;
  let res;
  try { res = await fetch("/api/proxy?url=" + encodeURIComponent(url)); } catch (e) { res = null; }
  if (wsOpenForId !== id) return;   // closed or switched jobs while this was in flight
  if (!res || !res.ok) {
    stage.innerHTML = wsBlockedHtml(url);
    $("#wsOpenDirect", stage).onclick = () => openDirectPopout(url);
    return;
  }
  const data = await res.json();
  if (wsOpenForId !== id) return;
  if (data.mode === "direct") {
    stage.innerHTML = `<iframe class="ws-frame" id="wsFrame" src="${esc(url)}" sandbox="allow-forms allow-scripts allow-same-origin allow-popups"></iframe>`;
    return;
  }
  stage.innerHTML = `<iframe class="ws-frame" id="wsFrame" sandbox="allow-forms allow-scripts allow-same-origin allow-popups"></iframe>`;
  const frame = $("#wsFrame");
  frame.srcdoc = data.html;
  // Give the client app a moment to hydrate (or fail to) before judging it —
  // the iframe's "load" event fires on the raw HTML, not after its JS runs.
  frame.addEventListener("load", () => setTimeout(() => {
    if (wsOpenForId !== id || $("#wsFrame") !== frame) return;
    let text = "";
    try { text = frame.contentDocument.body.innerText; } catch (e) { /* not readable; leave it be */ }
    if (wsLooksMisrendered(text)) {
      stage.innerHTML = wsMisrenderedHtml(url);
      $("#wsOpenDirect", stage).onclick = () => openDirectPopout(url);
    }
  }, 900));
}
function teardownWorkspace() {
  qaWorkspace.stopPoll();
  wsOpenForId = null;
  updateSidebarCompact();
  const host = $("#detail");
  if (host) host.classList.remove("ws-host");
}
function closeWorkspace() {
  const id = wsOpenForId;
  teardownWorkspace();
  if (id && listCache.includes(id)) renderDetail(id); else clearDetail(page);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Command palette
   ═══════════════════════════════════════════════════════════════════════════ */
let palItems = [], palSel = 0;
async function openPalette() {
  $("#palette").hidden = false;
  $("#palette").innerHTML = `<div class="scrim" data-close></div><div class="palette">
    <input id="palInput" placeholder="Search jobs, jump to a page, run a command…" autocomplete="off">
    <div class="pal-list" id="palList"></div></div>`;
  $("[data-close]", $("#palette")).onclick = closePalette;
  const input = $("#palInput"); input.focus();
  const commands = [
    { t: "Go to Overview", ico: "overview", run: () => setPage("overview"), sub: "Page" },
    { t: "Go to Jobs", ico: "jobs", run: () => setPage("jobs"), sub: "Page" },
    { t: "Go to Queue", ico: "queue", run: () => setPage("queue"), sub: "Page" },
    { t: "Go to Applications", ico: "applications", run: () => setPage("applications"), sub: "Page" },
    { t: "Go to Profile", ico: "profile", run: () => setPage("profile"), sub: "Page" },
    { t: "Go to How to use", ico: "book", run: () => setPage("about"), sub: "Page" },
    { t: "Harvest jobs", ico: "sparkle", run: () => { closePalette(); doHarvest(); }, sub: "Action" },
    { t: "Toggle theme", ico: config.theme === "dark" ? "sun" : "moon", run: toggleTheme, sub: "Action" },
    { t: "Open settings", ico: "settings", run: openSettings, sub: "Action" },
    { t: "Export data", ico: "download", run: () => { window.location = "/api/export"; }, sub: "Share" },
  ];
  let jobs = [];
  try { jobs = (await api("/api/jobs?level=all&sort=for_you")).jobs; } catch (e) {}
  // The user can close the palette (Escape, scrim click) while this fetch is
  // still in flight — closePalette() wipes #palette's innerHTML, so #palList
  // is gone by the time we get here. Bail out instead of crashing on null.
  if ($("#palette").hidden || !$("#palList")) return;
  const render = () => {
    const list = $("#palList"); if (!list) return;
    const q = input.value.trim().toLowerCase();
    const cmdMatches = commands.filter((c) => !q || c.t.toLowerCase().includes(q));
    const jobMatches = q ? jobs.filter((j) => (j.title + " " + j.company).toLowerCase().includes(q)).slice(0, 7) : [];
    palItems = [...cmdMatches.map((c) => ({ ...c, kind: "cmd" })), ...jobMatches.map((j) => ({ t: j.title, sub: j.company, ico: "jobs", kind: "job", id: j.id }))];
    palSel = 0;
    list.innerHTML =
      (cmdMatches.length ? `<div class="pal-sec">Commands</div>` + cmdMatches.map((c, i) => palRow(c, i)).join("") : "") +
      (jobMatches.length ? `<div class="pal-sec">Jobs</div>` + jobMatches.map((j, i) => palRow({ t: j.title, sub: j.company, ico: "jobs" }, cmdMatches.length + i)).join("") : "");
    highlightPal();
  };
  input.oninput = render; render();
  input.onkeydown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); highlightPal(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(0, palSel - 1); highlightPal(); }
    else if (e.key === "Enter") { e.preventDefault(); runPal(palSel); }
    else if (e.key === "Escape") closePalette();
  };
}
function palRow(c, i) { return `<div class="pal-item" data-i="${i}">${ico(c.ico)}<span class="p-main">${esc(c.t)}</span><span class="p-sub">${esc(c.sub || "")}</span></div>`; }
function highlightPal() {
  $$("#palList .pal-item").forEach((el) => el.classList.toggle("sel", +el.dataset.i === palSel));
  $$("#palList .pal-item").forEach((el) => (el.onclick = () => runPal(+el.dataset.i)));
  const sel = $(`#palList .pal-item[data-i="${palSel}"]`); if (sel) sel.scrollIntoView({ block: "nearest" });
}
function runPal(i) {
  const it = palItems[i]; if (!it) return;
  closePalette();
  if (it.kind === "job") { selectedId = it.id; setPage("jobs"); }
  else if (it.run) it.run();
}
function closePalette() { $("#palette").hidden = true; $("#palette").innerHTML = ""; }

/* ═══════════════════════════════════════════════════════════════════════════
   Modal: settings / onboarding / share
   ═══════════════════════════════════════════════════════════════════════════ */
function openModal(html) {
  $("#modal").hidden = false;
  $("#modal").innerHTML = `<div class="scrim" data-close></div><div class="modal">${html}</div>`;
  $$("[data-close]", $("#modal")).forEach((el) => (el.onclick = closeModal));
}
function closeModal() { $("#modal").hidden = true; $("#modal").innerHTML = ""; }
function openSettings() {
  openModal(`
    <button class="icon-btn modal-x" data-close>${ICONS.x}</button>
    <h2>Settings</h2><p class="sub">Personalize your workspace. Everything is stored locally in this repo.</p>
    <div class="field"><label>Your name <span class="hint">shown on the overview</span></label><input class="input" id="setName" value="${esc(config.owner_name)}"></div>
    <div class="field"><label>Theme</label><div class="seg" id="setTheme"><button data-t="dark" class="${config.theme === "dark" ? "on" : ""}">Dark</button><button data-t="light" class="${config.theme === "light" ? "on" : ""}">Light</button></div></div>
    <div class="field"><label>Your data <span class="hint">CV, preferences, decisions, generated materials, Q&amp;A</span></label>
      <div class="share-box">Your data lives on your machine, never in the repo. <b>Export</b> saves all of it to one file (back it up, move machines, or share). <b>Import</b> restores it.
        <div style="display:flex;gap:8px;margin-top:11px">
          <a class="btn btn-sm" href="/api/export">${ico("download", "btn-ico")}<span>Export everything</span></a>
          <button class="btn btn-sm" id="importBtn">${ico("upload", "btn-ico")}<span>Import</span></button>
          <input type="file" id="importFile" accept="application/json" hidden>
        </div>
      </div>
    </div>
    <div class="field"><label>Onboarding</label>
      <div class="share-box">Re-run the setup form (CV + cities, experience, roles), then <code>/onboard</code> regenerates your <code>preferences.md</code>.
        <div style="margin-top:11px"><button class="btn btn-sm" id="reonboardBtn">${ico("sparkle", "btn-ico")}<span>Re-run onboarding</span></button></div>
      </div>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" id="saveSet">Save</button></div>`);
  $("#reonboardBtn").onclick = async () => { closeModal(); let st = {}; try { st = await api("/api/onboarding"); } catch (e) {} openOnboarding(st); };
  $$("#setTheme [data-t]").forEach((b) => (b.onclick = () => { $$("#setTheme [data-t]").forEach((x) => x.classList.toggle("on", x === b)); applyTheme(b.dataset.t); }));
  $("#saveSet").onclick = async () => {
    config.owner_name = $("#setName").value.trim();
    await api("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner_name: config.owner_name, theme: config.theme }) });
    toast("Settings saved", "ok"); closeModal(); if (page === "overview") renderOverview();
  };
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const res = await api("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        jobs: data.jobs || [], events: data.events || [], questions: data.questions || [],
        materials: data.materials || {}, profile: data.profile || {}, config: data.config || {}, merge: true,
      }) });
      toast(`Imported ${res.added} new job${res.added === 1 ? "" : "s"}, ${res.materials} materials`, "ok"); closeModal(); reload();
    } catch (err) { toast("Import failed — bad file", "err"); }
  };
}
const OB_CITIES = ["Paris", "London", "Brussels", "Geneva", "Remote (EU)"];
const OB_ROLES = [["ai_agentic", "AI / Agentic"], ["ai_ml", "AI / ML"], ["data_eng", "Data Eng"], ["swe", "Software Eng"]];
const OB_EXP = [["0-1", "0-1 yrs"], ["1-3", "1-3 yrs"], ["3-5", "3-5 yrs"], ["5-8", "5-8 yrs"], ["8+", "8+ yrs"]];
const OB_LANG = [["english", "English"], ["french", "French"], ["both", "Both"]];

async function maybeOnboard() {
  try {
    const st = await api("/api/onboarding");
    if (!st.needs_onboarding) return;   // has a CV and preferences already
    openOnboarding(st);
  } catch (e) {}
}
function openOnboarding(st) {
  const chips = (id, opts) => opts.map((o) => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<button type="button" class="ob-chip" data-group="${id}" data-val="${v}">${esc(l)}</button>`;
  }).join("");
  const prefsReady = st && st.preferences_ready;
  openModal(`
    <h2>Welcome to job cache</h2>
    <p class="sub">Tell it about you. Your CV and answers stay on your machine; nothing is committed to the repo.</p>
    <div class="field"><label>Your name</label><input class="input" id="obName" placeholder="Alex Rivera"></div>
    <div class="field"><label>Your CV <span class="hint">paste markdown, or upload a .md / .txt file</span></label>
      <textarea class="input" id="obCv" style="min-height:150px" placeholder="# Your Name&#10;## Skills&#10;..."></textarea>
      <div style="margin-top:7px"><input type="file" id="obCvFile" accept=".md,.txt,text/markdown,text/plain" hidden>
        <button class="btn btn-ghost btn-sm" id="obCvUpload">${ico("upload", "btn-ico")}<span>Upload a file</span></button>
        <span class="hint" id="obCvName" style="margin-left:8px"></span></div>
    </div>
    <div class="field"><label>Target cities</label><div class="ob-chips" id="ob-cities">${chips("cities", OB_CITIES)}</div>
      <div class="ob-add"><input class="input" id="ob-cities-add" placeholder="Add another city…"><button type="button" class="btn btn-ghost btn-sm" id="ob-cities-addBtn">Add</button></div>
    </div>
    <div class="field"><label>Experience</label><div class="ob-chips" id="ob-exp">${chips("experience", OB_EXP)}</div></div>
    <div class="field"><label>Role types</label><div class="ob-chips" id="ob-roles">${chips("roles", OB_ROLES)}</div>
      <div class="ob-add"><input class="input" id="ob-roles-add" placeholder="Add another role type…"><button type="button" class="btn btn-ghost btn-sm" id="ob-roles-addBtn">Add</button></div>
    </div>
    <div class="field"><label>Cover-letter language</label><div class="ob-chips" id="ob-lang">${chips("language", OB_LANG)}</div></div>
    <div class="field"><label>How should your cover letters sound? <span class="hint">optional</span></label>
      <textarea class="input" id="obTone" style="min-height:56px" placeholder="e.g. direct and confident, a bit warm, no corporate jargon"></textarea></div>
    <div class="share-box">After saving, run <code>/onboard</code> in Claude Code. It reads your CV + answers and writes your personal <code>preferences.md</code> (voice + a reference letter). ${prefsReady ? "You already have preferences; onboarding will refresh your inputs." : ""}</div>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>Skip</button><button class="btn btn-primary" id="obSave">Save &amp; continue</button></div>`);
  // single-select for experience/language, multi for cities/roles
  const single = new Set(["experience", "language"]);
  const bindChip = (b) => (b.onclick = () => {
    if (single.has(b.dataset.group)) $$(`.ob-chip[data-group="${b.dataset.group}"]`).forEach((x) => x.classList.toggle("on", x === b));
    else b.classList.toggle("on");
  });
  $$(".ob-chip", $("#modal")).forEach(bindChip);
  // custom tags: cities and roles accept free-text additions beyond the fixed list
  [["cities", "#ob-cities"], ["roles", "#ob-roles"]].forEach(([group, sel]) => {
    const container = $(sel);
    const input = $(`${sel}-add`);
    const addTag = () => {
      const val = input.value.trim();
      if (!val) return;
      const existing = $$(".ob-chip", container).find((x) => x.dataset.val.toLowerCase() === val.toLowerCase());
      if (existing) { existing.classList.add("on"); }
      else {
        const b = document.createElement("button");
        b.type = "button"; b.className = "ob-chip on"; b.dataset.group = group; b.dataset.val = val; b.textContent = val;
        bindChip(b);
        container.appendChild(b);
      }
      input.value = ""; input.focus();
    };
    $(`${sel}-addBtn`).onclick = addTag;
    input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } };
  });
  $("#obCvUpload").onclick = () => $("#obCvFile").click();
  $("#obCvFile").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; $("#obCv").value = await f.text(); $("#obCvName").textContent = f.name; };
  $("#obSave").onclick = async () => {
    const picked = (g) => $$(`.ob-chip.on[data-group="${g}"]`).map((x) => x.dataset.val);
    const body = {
      owner_name: ($("#obName").value || "").trim(),
      cv: $("#obCv").value.trim(),
      cities: picked("cities"), roles: picked("roles"),
      experience: picked("experience")[0] || "", language: picked("language")[0] || "",
      tone: ($("#obTone").value || "").trim(),
    };
    await api("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    config.owner_name = body.owner_name;
    closeModal();
    openModal(`<h2>${ico("terminal")} One last step</h2>
      <p class="sub">Your details are saved. Now generate your application voice.</p>
      <div class="share-box">In a terminal in this repo, run <code>claude</code>, then:
        <div style="margin:10px 0 2px"><code style="font-size:14px">/onboard</code></div>
        It reads your CV + answers and writes your personal <code>preferences.md</code>. Then harvest jobs and you're off.</div>
      <div class="modal-actions"><button class="btn btn-primary" data-close>Got it</button></div>`);
    reload();
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Harvest + routing + counts
   ═══════════════════════════════════════════════════════════════════════════ */
// Two harvest triggers exist (sidebar + Overview header) — both share the
// .harvest-trigger class so either one reflects the busy state correctly,
// and each keeps its own idle label via data-label.
function _setHarvestBusy(busy) {
  $$(".harvest-trigger").forEach((b) => {
    b.disabled = busy;
    const txt = b.querySelector(".btn-txt");
    if (txt) txt.textContent = busy ? "Harvesting…" : (b.dataset.label || "Harvest jobs");
  });
}
async function doHarvest() {
  _setHarvestBusy(true);
  try { const s = await api("/api/harvest", { method: "POST" }); toast(`Harvested ${s.kept} jobs${s.errors && s.errors.length ? ` · ${s.errors.length} skipped` : ""}`, "ok"); await reload(); }
  catch (e) { toast("Harvest failed", "err"); }
  finally { _setHarvestBusy(false); }
}
async function setPage(p) {
  page = p;
  renderNav();
  await reload();
}
async function reload() {
  try {
    await refreshCounts();
    if (page === "overview") await renderOverview();
    else if (page === "jobs") await renderJobs();
    else if (page === "queue") await renderGrouped("queue");
    else if (page === "applications") await renderApplications();
    else if (page === "about") renderAbout();
    else if (page === "profile") await renderProfile();
  } catch (err) {
    showFatal(err);
  }
}
// Lighter-weight refresh for in-place actions (queue/dismiss/status change):
// updates the list + detail panes without rebuilding the page shell (filters,
// search box, tab bar), so the view doesn't visibly "reload".
async function softReload() {
  try {
    await refreshCounts();
    if (page === "jobs") await loadJobs();
    else if (page === "queue") await loadGrouped(QUEUE_GROUPS, QUEUE_EMPTY_ARGS);
    else if (page === "applications") await loadApplications();
    else await reload();
  } catch (err) {
    showFatal(err);
  }
}
function showFatal(err) {
  const v = $("#view");
  if (v) v.innerHTML = `<div class="empty">${ico("info")}<h3>Something failed to load</h3>
    <p>${esc(String(err && err.message || err))}</p>
    <button class="btn btn-primary" onclick="location.reload()">Reload</button></div>`;
  console.error("job cache:", err);
}
async function refreshCounts() {
  try {
    const s = await api("/api/stats");
    const bs = s.by_status || {};
    counts.jobs = s.browsable || 0;
    counts.pending = bs.materials_ready || 0;
    counts.queue = (bs.queued || 0) + (bs.materials_ready || 0);
    counts.applications = (bs.applied || 0) + (bs.interview || 0) + (bs.offer || 0) + (bs.rejected || 0);
    counts.starred = s.starred || 0;
    modelReady = s.model_ready;
    renderNav();
    $("#footStat").textContent = `${counts.jobs} fit you`;
  } catch (e) {}
}

/* ── Update banner: is origin/main ahead of what's running locally? ─────── */
function setBannerHeight() {
  const el = $("#updateBanner");
  document.documentElement.style.setProperty("--banner-h", el && !el.hidden ? el.offsetHeight + "px" : "0px");
}
async function checkForUpdate() {
  let v;
  try { v = await api("/api/version"); } catch (e) { return; }
  const el = $("#updateBanner"); if (!el) return;
  if (!v || !v.available || v.up_to_date) { el.hidden = true; setBannerHeight(); return; }
  if (localStorage.getItem("jc-update-dismissed") === v.latest) { el.hidden = true; setBannerHeight(); return; }
  const behind = v.behind ? `${v.behind} commit${v.behind === 1 ? "" : "s"} behind` : "out of date";
  el.innerHTML = `${ico("info")}<span class="ub-text">A newer version of job cache is available (${esc(behind)}). Run <code>git pull origin main</code>, then restart the app to update.</span>
    <button class="ub-x" id="ubDismiss" title="Dismiss">${ICONS.x}</button>`;
  el.hidden = false;
  $("#ubDismiss").onclick = () => { el.hidden = true; setBannerHeight(); localStorage.setItem("jc-update-dismissed", v.latest); };
  setBannerHeight();
}
window.addEventListener("resize", () => { if (!$("#updateBanner")?.hidden) setBannerHeight(); });

/* ═══════════════════════════════════════════════════════════════════════════
   Keyboard
   ═══════════════════════════════════════════════════════════════════════════ */
let gPending = false;
function moveSel(delta) {
  if (!listCache.length) return;
  let i = listCache.indexOf(selectedId);
  i = i < 0 ? 0 : Math.min(listCache.length - 1, Math.max(0, i + delta));
  selectedId = listCache[i];
  const card = $(`.card[data-id="${selectedId}"]`);
  if (card) { $$(".card").forEach((el) => el.classList.toggle("active", el.dataset.id === selectedId)); card.scrollIntoView({ block: "nearest" }); }
  if (page !== "jobs") renderDetail(selectedId);
}
document.addEventListener("keydown", (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#palette").hidden ? openPalette() : closePalette(); return; }
  if (e.key === "Escape") {
    if (wsOpenForId) {
      if (wsQaOpenFlag) { wsQaOpenFlag = false; return toggleWsQa(); }
      return closeWorkspace();
    }
    if (!$("#modal").hidden) return closeModal();
    if (!$("#palette").hidden) return closePalette();
  }
  if (typing) return;
  if (gPending) {
    gPending = false;
    const map = { o: "overview", j: "jobs", q: "queue", a: "applications", p: "profile", h: "about" };
    if (map[e.key]) { setPage(map[e.key]); return; }
  }
  if (e.key === "g") { gPending = true; setTimeout(() => (gPending = false), 800); return; }
  if (e.key === "/") { e.preventDefault(); if (page !== "jobs") setPage("jobs").then(() => $("#jfQ")?.focus()); else $("#jfQ")?.focus(); return; }
  if (e.key === "j") moveSel(1);
  else if (e.key === "k") moveSel(-1);
  else if (e.key === "s" && selectedId) { if (page === "jobs") toggleStarCard(selectedId); else toggleStar(selectedId); }
  else if (e.key === "e" && selectedId) { if (page === "jobs") queueJobCard(selectedId); else queueJob(selectedId); }
  else if (e.key === "x" && selectedId) { if (page === "jobs") dismissJobCard(selectedId); else dismissJob(selectedId); }
  else if (e.key === "?") toast("⌘K palette · g+o/j/q/a/p/h pages · j/k move · s star · e queue · x dismiss", "info");
});

/* ═══════════════════════════════════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════════════════════════════════ */
$("#harvestBtn").onclick = doHarvest;
$("#cmdTrigger").onclick = openPalette;
$("#settingsBtn").innerHTML = ico("settings"); $("#settingsBtn").onclick = openSettings;
$("#themeBtn").onclick = toggleTheme;
$("#sidebarToggleBtn").innerHTML = ico("sidebar"); $("#sidebarToggleBtn").onclick = toggleSidebarCollapsed;

(async function init() {
  try {
    try { applyTheme(localStorage.getItem("jc-theme") || localStorage.getItem("jh-theme") || "dark"); } catch (e) { document.documentElement.dataset.theme = "dark"; }
    try { config = await api("/api/config"); } catch (e) {}
    try { applyTheme(config.theme || "dark"); } catch (e) {}
    renderNav();
    const boot = new URLSearchParams(location.search);
    if (boot.get("job")) selectedId = boot.get("job");
    await setPage(NAV.some((n) => n.id === boot.get("page")) ? boot.get("page") : "overview");
    maybeOnboard();
    setInterval(refreshCounts, 15000);
    checkForUpdate();
    setInterval(checkForUpdate, 600000);
  } catch (err) {
    showFatal(err);
  }
})();
