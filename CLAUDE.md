# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Hebrew (RTL), single-user PWA for tracking attendance and producing daily/monthly hour reports. Vanilla HTML/CSS/JS — **no build step, no framework, no package manager, no tests**. The whole app is four files at the repo root: `index.html`, `app.js`, `styles.css`, `sw.js` (plus `manifest.webmanifest` and `icons/`).

All data lives in `localStorage`. There is no backend. "Sending a report" opens a `mailto:` URL and downloads a CSV — there is no SMTP path.

## Running locally

Any static file server works. The service worker only registers over `http(s)://`, so opening `index.html` via `file://` will skip SW registration (handled at `app.js:1376`). Quick options:

```sh
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`.

After editing assets that the service worker caches (`index.html`, `app.js`, `styles.css`, manifest, icons), bump `CACHE_NAME` in `sw.js:3` (e.g. `attendance-v3` → `attendance-v4`). Otherwise installed PWA clients keep serving stale files.

## CI workflows — do not trust them

`.github/workflows/deno.yml` and `npm-publish-github-packages.yml` are unmodified GitHub starter templates. There is no Deno code, no `package.json`, no `npm test`. Both workflows will fail if they run. The Deno workflow is also pinned to a branch that no longer exists (`claude/attendance-tracking-app-C6oqe`). Treat these as dead weight unless the user asks to wire up real CI.

## Architecture

`app.js` is a single ~1450-line module with no exports — everything is top-level state and functions, wired up in `init()` at the bottom. The mental model:

- **State**: three globals — `entries` (completed sessions, persisted), `activeSession` (current clock-in, persisted), `pendingEntry` (just-stopped session awaiting the quantity modal, in-memory only). All `localStorage` keys are namespaced under `attendance:` and centralized in `STORAGE_KEYS` at the top of the file.
- **Domain model**: a session = `{ id, startTs, endTs, workType, qty: {count?, words?}, note }`. `workType` is one of four Hebrew category keys defined in `CATEGORIES` (`app.js:26`). The category config also drives which quantity fields the post-stop modal asks for.
- **Flow**: select work type → `startWork()` writes `activeSession` → `stopWork()` moves it to `pendingEntry` and opens the quantity modal → `saveQuantityAndClose()` / `skipQuantityAndClose()` pushes it into `entries`.
- **Aggregation pipeline**: `entriesForDay` → `summarizeDay` → `buildReportRow` → `buildReportCSV` / `buildReportHTMLTable` / `buildReportPlainText`. The monthly path layers `summarizeMonth` on top, which iterates days and adds payment math (`hourlyRate`, `vatPercent`).
- **Report column schema**: `REPORT_HEADERS` (`app.js:499`) defines the exact Hebrew column order expected by the user's Google Drive sheet. Don't reorder or rename — downstream consumers depend on it. The CSV is emitted with a UTF-8 BOM (`'﻿'` at `app.js:588`) so Excel opens Hebrew correctly.
- **Render layer**: `renderStatus` / `renderSummary` / `renderHistory` / `renderMonthSummary` rebuild DOM from state. Live-running sessions are merged into the daily summary by adding `Date.now() - activeSession.startTs` (see `renderSummary` at `app.js:415` and the 1s ticker in `init`). The status card and "today" table are the only things that update every second; the rest re-renders on user actions.
- **PWA pieces**: `sw.js` is cache-first with stale-while-revalidate and falls back to `index.html` on offline navigations. `setupInstall()` handles `beforeinstallprompt` plus an iOS-Safari "Add to Home Screen" hint. `setupNotifications()` polls every 5 minutes and fires reminders at 18:00 (if still clocked in) and on the last day of the month at 17:00+.
- **First-run UX**: `maybeShowWelcome()` opens a 3-field welcome modal if `attendance:welcomeDone` isn't set. Settings live in a collapsed `<details>` at the bottom; the welcome path writes into the same inputs to keep one source of truth.

## Conventions worth preserving

- **Hebrew strings are user-facing copy.** All UI labels, modal text, alerts, email subject/body, and CSV headers are Hebrew. Don't translate them when refactoring. The HTML is `dir="rtl"` and styling assumes it.
- **All HTML inserted into the DOM goes through `escapeHtml()`** (`app.js:1058`). Do the same for any new dynamic content — entries, notes, and emails contain user input.
- **No external runtime dependencies.** Don't pull in npm packages or CDN scripts; the offline/PWA story depends on the asset list in `sw.js` being complete and self-contained. If you add a new top-level asset, also add it to the `ASSETS` array and bump `CACHE_NAME`.
- **Settings persistence is centralized** in `saveAllSettings()` (`app.js:1038`). New persisted fields should be added there and to `STORAGE_KEYS`, and read in `loadAll()`.
- **Report-row construction is shared** between daily, monthly, preview, email, CSV, and printable invoice. If you change a column, change it once in `buildReportRow` / `REPORT_HEADERS` and verify all six consumers.

## Branch policy

Per the session task description, develop on `claude/add-claude-documentation-F06hY` and push only there.
