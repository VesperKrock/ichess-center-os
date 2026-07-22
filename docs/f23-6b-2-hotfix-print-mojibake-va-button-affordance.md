# F23.6B.2 - Hotfix Print Mojibake Và Button Affordance

Date: 2026-07-22

Scope: final QA polish for `In / Lưu PDF` in Module Thời khóa biểu. No commit, push, Auth, Supabase, SQL, deploy, Teacher secret, PDF dependency, storage write, or report print rewrite.

## Audit

Manual QA confirmed F23.6B.1 direct browser print is working. The remaining print issue was display text, not print wiring or font support.

Runtime TKB already repairs a narrow legacy Vietnamese title through `repairScheduleDisplayText()` in `src/schedule-module.js`. `src/schedule-print-module.js` created its own snapshot from raw schedule data and escaped HTML correctly, but it did not pass dynamic text through the same display repair behavior before rendering. That allowed legacy raw values such as `Buổi học mới` stored in mojibake form to reach the print document.

The TKB toolbar button was wired and clickable through `data-schedule-print-action="print"`, but its CSS had no pointer, hover, active, or focus-visible state, so it looked inert.

## Implementation

`src/schedule-print-module.js` now applies a display-only repair helper before escaping HTML for dynamic print text:

- center name;
- fixed class/session title;
- schedule session title;
- activity title;
- teacher name;
- room/location;
- tag label.

The helper is intentionally narrow and matches the existing TKB runtime behavior for the known legacy `Buổi học mới` mojibake signature. It trims and NFC-normalizes text, repairs only the known mojibake title shape, and leaves already-correct Vietnamese, English, names, and HTML-special characters unchanged until the normal HTML escape step.

It does not mutate records, write localStorage, migrate data, repair after escaping, or decode arbitrary user text.

`src/styles.css` now gives `.schedule-print-button`:

- `cursor: pointer`;
- hover background/border/color feedback;
- light active pressed feedback;
- `focus-visible` outline;
- disabled affordance.

The button keeps the same text, class, data action, layout, and direct print lifecycle.

## Safety Boundaries

Unchanged:

- direct click path;
- `window.print()` lifecycle;
- temporary `.schedule-print-runtime-root`;
- document title restore;
- cleanup after print;
- A4 landscape print stylesheet;
- report print flow;
- activity recurrence expansion;
- class/session/calendar source data.

No custom preview was restored.

## Smoke Coverage

`tests/f23-6b-print-preview-browser-print-tkb-weekly-smoke.js` now covers F23.6B.2 in the same regression path:

- legacy title repairs to `Buổi học mới`;
- already-correct Vietnamese remains unchanged;
- English and HTML-special dynamic text are preserved before render;
- rendered print HTML escapes `<`, `>`, `&`, quotes, and apostrophes;
- fixed class, schedule session, and activity titles are repaired;
- source objects are not mutated;
- generated snapshot/HTML fixture has no legacy mojibake markers;
- toolbar keeps `data-schedule-print-action="print"`;
- direct handler remains reachable;
- no custom preview markers return;
- report print wiring remains present;
- print button has pointer, hover, active, and focus-visible CSS.

## Manual QA

Expected:

1. Click `In / Lưu PDF` in TKB opens browser print immediately.
2. The print card previously showing mojibake now shows `Buổi học mới`.
3. Correct Vietnamese text remains correct.
4. No `á»`, `Ã`, `Â`, or replacement character appears in the generated print output.
5. Hovering the toolbar button shows pointer and visual feedback.
6. Keyboard focus shows a visible focus ring.
7. `In báo cáo` still works through its existing report print flow.

FINAL PRINT POLISH COMPLETE - AWAITING MANUAL QA
