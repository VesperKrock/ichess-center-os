# F23.6B.1 - Hotfix In / Lưu PDF theo flow Báo cáo

Date: 2026-07-22

Scope: blocker hotfix on `main`. No commit, push, Auth, Supabase, SQL, deploy, Teacher secret, PDF dependency, screenshot, storage write, or business-module write.

## Root Cause

Manual QA showed the TKB toolbar button `In / Lưu PDF` appeared but did not visibly open a preview or browser print dialog. The first F23.6B implementation introduced a custom preview state and a separate print action inside that preview. That added an extra render/state layer and did not match the known-working report print lifecycle.

The hotfix removes the dead custom preview flow from runtime. The TKB toolbar button now has one final action: direct browser print.

## Report Print Audit

The existing report flow is wired in `src/main.js` with selector:

```txt
[data-report-action="print"]
```

The button is rendered by `src/report-module.js` as `In báo cáo`.

The handler:

1. builds report data from current runtime state;
2. opens a print document/window with `window.open('', 'ichess-report-print', 'width=960,height=720')`;
3. writes semantic report HTML with `buildReportPrintHtml(...)`;
4. closes the document;
5. focuses the print window;
6. calls `printWindow.print()` directly from the user click.

There is no custom in-app preview in the report flow.

## TKB Hotfix Flow

The TKB button is rendered as:

```txt
data-schedule-print-action="print"
```

The `src/main.js` click handler:

1. prevents default and stops propagation;
2. builds a fresh immutable TKB snapshot from current center and current week;
3. filters with `Toàn bộ thời khóa biểu tuần`;
4. creates a temporary `.schedule-print-runtime-root`;
5. injects `renderSchedulePrintDocument(...)`;
6. sets document title with `getSchedulePrintDocumentTitle(...)`;
7. calls `window.print()` in the same click stack;
8. restores title and removes the runtime print root through `afterprint` plus a fallback cleanup timer.

This ports the essential report pattern: explicit click, build print document, call browser print immediately, cleanup after print. It does not copy report content or report business data. The printed document title remains `Thời khóa biểu tuần`.

## Print Snapshot

The print document is still built from `src/schedule-print-module.js`, not from DOM cloning, viewport capture, canvas, or screenshot.

Snapshot sources:

- current center id and center name;
- current `scheduleWeekStartDate`;
- fixed class slots via `getVisibleScheduleSessions()`;
- real schedule sessions;
- single `centerCalendarItems`;
- weekly virtual recurring occurrences in the selected week;
- tags used in the printed week.

The hotfix does not write localStorage and does not materialize recurrence.

## Filter Decision

Final hotfix mode is `Toàn bộ thời khóa biểu tuần`.

Reason: user prioritized a working direct print dialog matching `In báo cáo`. The snapshot helper still supports `Theo bộ lọc hiện tại` for future UI, but F23.6B.1 does not show a chooser or custom preview.

## Layout And CSS

The TKB print stylesheet keeps:

- `@page { size: A4 landscape; }`;
- seven-day weekly grid including `Chủ nhật`;
- `Cả ngày` section;
- `hôm sau` for cross-midnight;
- `Đã hủy`;
- `Lặp hàng tuần`;
- type/tag/recurring/cancelled text markers;
- `print-color-adjust: exact` plus grayscale-readable borders/text.

During TKB print, `.schedule-print-runtime-root` is the printed root and the app shell/taskbar/window chrome/toolbars/buttons/modals are hidden.

## Report Regression Boundary

The report print handler and `buildReportPrintHtml(...)` remain unchanged. The TKB hotfix does not alter report content, report selectors, or report data sources.

## Read-Only Boundary

Opening print, canceling print, or saving as PDF does not save:

- `centerCalendarItems`;
- `classSessions`;
- `scheduleSessions`;
- tags;
- attendance;
- tuition;
- session reports;
- Teacher Portal data.

No Auth, Supabase, SQL, deploy, or Teacher Workspace changes.

## Tests

Updated smoke: `tests/f23-6b-print-preview-browser-print-tkb-weekly-smoke.js`.

Coverage includes direct handler reachability, fresh snapshot, runtime print root, explicit `window.print()`, title restore, cleanup, no dead preview state, report print wiring still present, A4 landscape, hidden app shell, no storage write, no PDF dependency, no html2canvas/jsPDF, recurrence boundaries, and mojibake scan.
