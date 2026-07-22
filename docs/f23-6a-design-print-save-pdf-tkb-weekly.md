# F23.6A - Design In / Lưu PDF Thời khóa biểu tuần

Date: 2026-07-22

Scope: design-only on `main`. This document does not implement runtime code, UI, CSS, route, dependency, Auth, Supabase, SQL, deploy, Teacher secret, commit, or push.

## Audit Summary

Current TKB rendering is data-driven in `src/schedule-module.js`. `renderScheduleModule()` receives `scheduleSessions`, `classSessions`, teachers, students, `scheduleWeekStartDate`, center calendar items/tags, and activity filters from `src/main.js`.

The viewed week is Monday `00:00` through next Monday `00:00`, derived from `scheduleWeekStartDate`. Week navigation mutates `scheduleWeekStartDate` through previous/today/next actions, closes schedule activity panels, resets report panels, then renders.

Visible teaching content comes from `getVisibleScheduleSessions()`:

- active fixed class slots from `classSessions`;
- recurring schedule assignments linked by `classSessionId`;
- real one-off `scheduleSessions`;
- orphan recurring schedule records only when no visible class-session backing exists.

Center activity content comes from `loadStoredCenterCalendarItems(getCurrentResolvedCenterId())` and `loadStoredCenterCalendarTags(getCurrentResolvedCenterId())`. `getCenterCalendarItemsForDisplayRange()` returns single items plus weekly virtual occurrences from `expandWeeklyCenterCalendarOccurrences()`. It does not materialize occurrences.

Activity filters are held in `scheduleCalendarFilters`. `filterCenterCalendarItems()` applies type/tag filters only to center calendar items and virtual occurrences. Class slots and lesson sessions are not filtered. The compact legend currently lists all activity type colors and tags used by items in the week.

Existing print support is report-specific: `src/main.js` opens a report print window and calls `window.print()`, while `src/styles.css` has `@media print` rules for report UI. There is no TKB print preview, no TKB print CSS, and no PDF dependency. `package.json` has only Vite and `@supabase/supabase-js`; no `jsPDF`, `html2canvas`, headless browser, or PDF generator is installed.

Center identity is resolved by `getCurrentResolvedCenterId()`. Display name is available in center profile paths from center binding/cloud status, falling back to `DreamHome` today; F23.6B should centralize a small read-only helper for current center print title instead of hardcoding.

## Chosen Architecture

F23.6B should use Browser print + Save as PDF with a TKB-specific print preview built from an immutable data snapshot.

The snapshot is created from normalized model data, not from screenshot, viewport, scroll position, desktop window height, or the currently visible DOM cards. This keeps text selectable, avoids raster quality problems, avoids taskbar/window chrome, and avoids adding a PDF library.

Recommended implementation shape for F23.6B:

1. User clicks `In / Lưu PDF` in the TKB toolbar.
2. Runtime reads the latest data for current center and current week.
3. Runtime builds an immutable print snapshot.
4. App opens an in-app preview panel/window dedicated to `Thời khóa biểu tuần`.
5. User reviews center/week/options.
6. User clicks `In / Lưu PDF`, and only then `window.print()` is called.

The preferred rendering target is a print-only section in the same document, controlled by `@media print`, because the app already uses a desktop shell where popup windows can be blocked and state can be lost. F23.6B may still use a minimal separate route if CSS isolation becomes too noisy, but the official MVP direction is same-document preview plus print-only document area.

No PDF dependency should be added for MVP. Browser Save as PDF already covers the product need, keeps selectable text, avoids bundle size, and avoids maintaining pagination/canvas/export code.

## Snapshot Scope

The print snapshot is bound to:

- current resolved center;
- current center display name;
- current viewed week;
- timestamp when preview was generated;
- filter mode selected in the preview.

If the user changes center or week while preview is open, the preview should keep its snapshot and show the generated timestamp. F23.6B can add a `Làm mới bản xem trước` action if needed, but it must not silently mix old center/week data with new state.

Header content:

- center name, with center id only as a non-prominent fallback when name is unavailable;
- title `Thời khóa biểu tuần`;
- week range;
- generated timestamp;
- optional timezone `Asia/Ho_Chi_Minh` while per-center timezone does not exist.

Suggested document title for browser PDF naming:

```txt
TKB-<center-slug>-<YYYY-MM-DD>_<YYYY-MM-DD>
```

Do not hardcode DreamHome as the file identity.

## Data Mapping

The weekly print document includes three content classes:

- `Lớp học`: fixed class slots from `classSessions` and recurring assignments.
- `Buổi học`: real `scheduleSessions`, including one-off lessons and orphan recurring schedule records.
- `Hoạt động cơ sở`: `centerCalendarItems`, including single items and weekly virtual occurrences.

Card minimum fields:

- time label;
- title;
- source/type label;
- room/location when available;
- teacher name for class/session cards when current data already has it;
- activity tag badge when present;
- recurring marker `Lặp hàng tuần` for virtual occurrences;
- cancelled marker `Đã hủy`.

Do not include long activity descriptions in weekly cards. F23.6B can truncate titles/locations with a documented limit, but should prefer wrapping over losing essential identity. Do not print technical IDs, localStorage keys, conflict internals, edit/delete buttons, or taskbar/window controls.

## Filter Semantics

Official MVP default: `Toàn bộ thời khóa biểu tuần`.

This prints all class slots, all real schedule sessions, all single center activities, and all virtual recurring occurrences that intersect the week.

Preview can expose one option: `Theo bộ lọc hiện tại`.

When enabled, it applies current F23.5D type/tag filters only to center activities and virtual occurrences. It must still print fixed class slots and real schedule sessions. If filters hide all activities but classes remain, the document is not empty.

If F23.6B needs to reduce scope, it may ship only the default `Toàn bộ thời khóa biểu tuần`; however, the snapshot model should keep a `filterMode` field so filtered export can be added without changing data mapping.

## Recurring Occurrences

Only virtual occurrences that intersect the selected week are printed. The master item outside the week is not printed as a separate row, raw recurrence JSON is not shown, and no occurrence is saved to storage.

Occurrence cards should show `Lặp hàng tuần` and use the occurrence date/time, inherited type/color/tag/location/title from the master. Edit/delete whole-series controls are preview-only UI controls and must be hidden in print.

## All-Day And Cross-Midnight

All-day items should render in a dedicated `Cả ngày` area per day, above timed cards. Do not place all-day items into a fake time slot. If there are many all-day cards, wrap them compactly and allow the day section to grow across pages.

Cross-midnight items should print once on their start date with a clear time label such as `22:00-01:00 hôm sau`. Do not duplicate the item on the next day in MVP. This matches the current interval model and avoids fake records.

## Cancelled Items

Cancelled classes/sessions/items that are present in the TKB data should remain visible in print. Use `Đã hủy`, reduced emphasis, and text decoration or border treatment so they are not mistaken for active items.

F23.6B should not add an `Ẩn mục đã hủy` option in MVP. That can be F23.6C.

## Layout, Paper, And Pagination

MVP target:

- A4;
- landscape;
- safe narrow margins;
- readable text size;
- seven day columns plus a compact time/source structure.

Do not assume a dense week always fits on one page. The print stylesheet should allow multiple pages without scrollbars or clipped overflow.

Page strategy:

- keep document header together when possible;
- keep day headers with their first items;
- avoid splitting individual cards where browser CSS supports it;
- allow day sections to continue onto later pages for dense weeks;
- repeat or restate day heading on continuation only if implementation can do so without custom pagination complexity;
- avoid placing legend alone on a final page when possible.

The print document must not depend on desktop window height, `.schedule-week-scroll`, or overflow-hidden app containers.

## Color, Legend, And Grayscale

Color is useful but must not be the only signal. Every printed card should include text labels such as `Lớp học`, `Buổi học`, `Hội họp`, `Sự kiện`, `Giải đấu`, or `Hoạt động khác`.

F23.6B print CSS may use:

```css
print-color-adjust: exact;
-webkit-print-color-adjust: exact;
```

But the design must still work when browser `Background graphics` is off:

- use borders/left bars that remain visible;
- show type text;
- show tag text and bordered tag chips;
- use cancelled/recurring markers as text, not only color.

Printed legend should include:

- `Lớp học`;
- `Buổi học`;
- activity types actually relevant to the printed content;
- tags used in the printed week, not all center tags;
- marker `Lặp hàng tuần`;
- marker `Đã hủy`;
- optional note that colors may depend on printer background settings.

If many tags are used, wrap chips and cap the visible list with `+N nhãn khác` rather than letting the legend consume a full page.

## Preview And Actions

Preview content:

- heading `Bản xem trước`;
- center name;
- week range;
- generated timestamp;
- selected print scope;
- preview of the weekly document;
- buttons `Quay lại` and `In / Lưu PDF`.

Do not call `window.print()` when preview opens. Call it only from the explicit `In / Lưu PDF` button. Do not use `window.confirm()`.

Preview controls are not printed. Print output hides desktop background, taskbar, Start menu, notifications, window titlebar/chrome, TKB toolbar, `+ Thêm buổi học`, `+ Thêm hoạt động`, `Quản lý nhãn`, filters, edit/delete buttons, conflict panel, modals, debug text, and any technical IDs.

## Privacy And Boundaries

The print snapshot is read-only. It must not write or normalize records back into storage.

Do not print:

- parent phone numbers;
- CRM notes;
- tuition data;
- attendance notes;
- report content;
- login/account data;
- internal IDs;
- Teacher secret or Teacher Workspace content.

Activities remain activities. Print must not create or modify `classSessions`, `scheduleSessions`, attendance records, session reports, `tuition.usedSessions`, Teacher Portal, or Teacher Workspace.

## Accessibility

Preview should use semantic headings and real buttons. The print document should have a clear reading order: header, legend/summary, then days from Monday through Sunday.

Color must not be the only meaning. Text size on paper should stay readable; do not shrink the entire week to illegible text just to force one page. Truncated content should be limited to non-essential detail, not title/time/source identity.

## Focus And Window Guard

F23.6B must preserve F23.5B.1:

- the print action is a real TKB toolbar action, not a generic module launcher;
- preview controls do not carry `data-module-launcher`;
- option inputs/selects in preview do not reopen the module;
- ordinary preview option changes should update preview state without full app render loops;
- `window.print()` is called only from explicit user action;
- no `.focus()` workaround;
- no pointer grace timeout changes.

## Empty States

If the week has no class slots, sessions, or printed activities, show `Không có nội dung trong tuần này` under the header.

If the week only has classes or only has activities, print normally.

If `Theo bộ lọc hiện tại` hides all activities but class/session content remains, the document should still show those class/session cards and may note that no activity matches the current filter.

## Performance

F23.6B should expand recurrence only for the selected week. It should not scan all historical activity ranges, clone the entire app DOM, rasterize the page, or upload data. The snapshot should be a small plain object with sorted day buckets and legend metadata.

## Roadmap

F23.6B: implement print snapshot helper, TKB print preview, same-document print-only output, A4 landscape print CSS, browser print action, current center/current week, all schedule sources, virtual occurrences, cancelled/all-day/cross-midnight handling, legend, and no new dependency.

F23.6C later: advanced options such as hide cancelled, always print according to filter, compact/detail mode, legend toggle, multi-week export, better filename polish, or direct PDF generation only if browser print proves insufficient.

## Definition Of Ready For F23.6B

F23.6B is ready when implementation follows:

- Browser print + Save as PDF;
- no new PDF dependency;
- snapshot from normalized data model;
- current center and current week;
- default full-week print;
- optional current-filter mode affects activities only;
- single items and virtual weekly occurrences;
- `Cả ngày`, `hôm sau`, and `Đã hủy` semantics;
- A4 landscape with overflow/page-break policy;
- text labels plus grayscale fallback;
- concise legend from printed data;
- preview action flow;
- privacy and business-module boundaries;
- F23.5B.1 focus/window guard.

## Checks

Design-only verification for F23.6A:

- `git diff --check`;
- docs marker/content check for `F23.6A`, `In / Lưu PDF`, `Thời khóa biểu tuần`, `Bản xem trước`, `Toàn bộ thời khóa biểu tuần`, `Theo bộ lọc hiện tại`, `Không có nội dung trong tuần này`, `Lặp hàng tuần`, `Đã hủy`, `Cả ngày`, and `hôm sau`;
- mojibake scan on this document;
- `npm run build`.
