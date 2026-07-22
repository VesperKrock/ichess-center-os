# F23.6B - Print preview browser print TKB weekly

Date: 2026-07-22

Scope: runtime MVP for `In / Lưu PDF` in Module Thời khóa biểu. No Auth, Supabase, SQL, deploy, Teacher secret, PDF dependency, screenshot, storage write, commit, or push.

F23.6B.1 hotfix decision: the final MVP flow is direct browser print from the TKB toolbar button. The custom in-app preview from the first F23.6B cut was removed because manual QA showed the button did not reliably reach a visible preview or print dialog.

F23.6B.2 hotfix keeps that direct print lifecycle unchanged. It adds display-only Vietnamese text repair inside the print snapshot path, matching the TKB runtime behavior for legacy `Buổi học mới` mojibake, and adds hover, active, pointer, and focus-visible affordance to the TKB print toolbar button.

## Print Architecture

F23.6B implements the F23.6A architecture: Browser print + Save as PDF.

The app renders semantic HTML from an immutable schedule print snapshot. It does not use `html2canvas`, `jsPDF`, canvas rasterization, screenshot DOM, server PDF, headless browser, fake download, or a package PDF dependency.

`window.print()` is called only from the explicit `In / Lưu PDF` toolbar click in TKB.

## Snapshot Helper

New module: `src/schedule-print-module.js`.

Primary APIs:

- `createSchedulePrintSnapshot(...)`
- `getSchedulePrintFilteredSnapshot(snapshot, filterMode)`
- `renderSchedulePrintDocument(snapshot)`
- `getSchedulePrintDocumentTitle(snapshot)`

The module is data-first and testable with Node. It does not read DOM cards, clone viewport, depend on scroll position, call `window.print()`, mutate input, save localStorage, materialize recurrence, or write class/session data.

Dynamic print text is normalized before HTML escaping. The hotfix repairs legacy mojibake only at display time and never writes repaired strings back to `classSessions`, `scheduleSessions`, `centerCalendarItems`, tags, or storage.

## Current Center And Week

`main.js` creates the print snapshot from:

- `getCurrentResolvedCenterId()`;
- current center display name from the center profile state;
- `scheduleWeekStartDate`;
- latest center-scoped `centerCalendarItems` and `centerCalendarTags`.

Each click creates a fresh snapshot and stores it only in memory long enough to build the temporary print root. Canceling or closing the browser print dialog keeps the current week and activity filter state unchanged.

## Data Sources

The snapshot includes:

- fixed class slots expanded from `classSessions` through `getVisibleScheduleSessions()`;
- schedule sessions, including one-off and orphan recurring records already visible in TKB;
- single `centerCalendarItems` intersecting the week;
- weekly virtual recurring occurrences intersecting the week.

Recurring masters are not printed as duplicates when virtual occurrences are generated. Occurrences are never persisted.

## Filter Mode

Default mode: `Toàn bộ thời khóa biểu tuần`.

F23.6B.1 prints the full week directly, matching the working `In báo cáo` interaction style. The snapshot helper still supports `Theo bộ lọc hiện tại` for a later option, where filters apply only to activity entries and never hide fixed class slots or real schedule sessions. The direct hotfix does not show a filter chooser before print.

## Direct Print Flow

The TKB toolbar has a real button:

`In / Lưu PDF`

Clicking it immediately builds a fresh immutable snapshot, injects a temporary print root into `document.body`, sets a safe document title, calls `window.print()`, then restores title and removes the print root after `afterprint` or the fallback cleanup timer.

No custom preview panel is kept in the final flow. No `window.confirm()` is used.

The same button keeps `data-schedule-print-action="print"` and now has visible hover, active, pointer, disabled, and keyboard focus states without changing toolbar layout or report print behavior.

## Print Action

When the user clicks `In / Lưu PDF` in TKB:

1. runtime resolves the current print snapshot;
2. runtime creates a safe document title via `getSchedulePrintDocumentTitle`;
3. runtime calls `window.print()`;
4. title is restored asynchronously.

No file is downloaded by app code. Browser Save as PDF remains the PDF path.

## A4 Landscape And Shell Hiding

`src/styles.css` adds a TKB print stylesheet with:

```css
@page {
  size: A4 landscape;
}
```

The print root is a temporary `.schedule-print-runtime-root` appended outside the app shell for the print lifecycle. During print, app shell pieces such as desktop area, taskbar, Start menu, notifications, window chrome, TKB toolbar, filters, controls, and modals are hidden. Only the schedule print runtime root is displayed.

The weekly document uses a seven-column print grid so Sunday is not dropped because of desktop window width. Dense weeks may continue across pages; the stylesheet avoids card and heading breaks where browsers support it.

## All-Day, Cross-Midnight, Cancelled

All-day entries render in a `Cả ngày` section at the top of each day.

Cross-midnight entries print once on the start date and append `hôm sau` to the time label, for example `22:00-01:00 hôm sau`.

Cancelled entries remain visible with text marker `Đã hủy`, dashed treatment, and strike-through title so they remain understandable in grayscale.

If the active snapshot has no printable class, session, activity, or recurring occurrence, the document shows `Không có nội dung trong tuần này` below the header instead of a blank page.

## Recurring Occurrence

Virtual recurring occurrences in the selected week print as activity cards with marker `Lặp hàng tuần`.

The document does not print raw recurrence JSON, out-of-range occurrences, or duplicate master records.

## Legend, Color, Grayscale

The legend is derived from entries in the active print snapshot:

- classes/sessions/activity types that actually appear;
- tags actually used by printed activities;
- recurring and cancelled markers when present.

Cards include text labels, borders, and marker text. Color uses CSS variables and `print-color-adjust: exact`, but the document is still readable when browser background graphics are off.

## Privacy And Boundary

The print snapshot includes only schedule identity needed for a weekly TKB: time, title, type, room/location, teacher name when already available, tag, recurring marker, and cancelled marker.

It does not include parent phone numbers, CRM, tuition, attendance notes, account data, localStorage keys, or internal technical IDs.

Print is read-only and does not save:

- `classSessions`;
- `scheduleSessions`;
- `centerCalendarItems`;
- tags;
- attendance;
- tuition;
- session reports;
- Teacher Portal data.

## Focus Guard

The print toolbar button does not use `data-module-launcher`. It calls the direct print helper from the button click handler and does not call `openModuleWindow()` or full `render()`.

F23.5B.1 remains protected: no generic `[data-module-id]` launcher, no focus workaround, no pointer timeout change, and no render loop before print.

## Tests

Smoke: `tests/f23-6b-print-preview-browser-print-tkb-weekly-smoke.js`.

Coverage includes toolbar action, direct handler reachability, snapshot current center/week, fixed slots, schedule sessions, single activities, virtual occurrences, no out-of-week occurrence, filter-only-activity helper behavior, all-day, cross-midnight `hôm sau`, `Đã hủy`, `Lặp hàng tuần`, legend tag/type, A4 landscape CSS, print-color-adjust, hidden app shell, explicit `window.print()`, title restore, runtime root cleanup, report print wiring preservation, no dead preview state, no PDF dependency, no storage write, no recurrence materialization, no Auth/Supabase/SQL implementation, display-only mojibake repair for fixed class/session/activity titles, HTML escaping, no source mutation, output fixture mojibake scan, and print button hover/focus affordance.

## MVP Limits

F23.6B does not add advanced export settings, hide-cancelled option, direct PDF generation, multi-week export, mobile-specific print flow, email/share, cloud upload, or custom pagination engine.

## Roadmap

F23.6C later can add hide cancelled, compact/detail mode, legend toggle, multi-week print, refined document title, and direct PDF only if browser print is not enough after manual QA.
