# F23.5C - CRUD Center Calendar Items Local-Safe

Date: 2026-07-22

Scope: local-safe CRUD for non-class calendar activities in Module Thoi khoa bieu. No Auth/Supabase/SQL/deploy/Teacher Workspace changes.

## Entry Point

The schedule toolbar has a separate `+ Them hoat dong` action beside the existing `+ Them buoi hoc` action.

The activity action opens its own form and does not reuse the lesson/session form.

The lesson/session taxonomy is intentionally separate from activity taxonomy:

- lesson/session create: `Hoc bu`, `Hoc thu`, `Hoc them`, `Buoi hoc khac`;
- activity create/edit: `Hoi hop`, `Su kien`, `Giai dau`, `Hoat dong khac`.

Legacy lesson/session data with `occurrenceReason: "event"` is still accepted when editing/rendering existing one-off sessions. F23.5C does not migrate, delete, or rewrite those records.

## Data Model

F23.5C writes only `centerCalendarItems` through the F23.5A center-scoped helpers:

- `loadStoredCenterCalendarItems(centerId)`
- `saveStoredCenterCalendarItems(centerId, items)`
- `normalizeCenterCalendarItem(...)`

Allowed `itemType` values:

- `meeting`
- `event`
- `tournament`
- `other`

Class/session item types are rejected. New activity items use `sourceModule: "centerCalendar"` and do not set linked session/class fields, attendance fields, tuition fields, or teacher assignments.

## Form

The create/edit form includes:

- type;
- title;
- date;
- all-day checkbox;
- start/end time;
- location;
- description;
- Trello-basic color palette.

The palette includes about 8 basic presets: blue, green, yellow, orange, red, purple, pink, gray, and emerald. Each swatch is a button with a selected state and readable color name.

Activity type only supplies the default color. A user-selected color overrides that default and must persist across save/edit/reload. Changing activity type updates the color only while the user has not manually selected a color. The `Dat lai theo loai` action clears the override and reapplies the type default.

Validation blocks empty title, invalid date, invalid type, and non-all-day items whose end time is not after start time.

## Detail, Edit, Delete

Clicking a rendered calendar card opens a detail panel with type, title, date/time, location, description, color, and cancelled status when present.

Detail actions:

- `Chinh sua`
- `Xoa hoat dong`
- `Dong`

Delete uses an explicit confirmation panel showing the item title. Confirmed delete reloads latest center-scoped items and filters only the matching item id for the current center.

## Refresh

After save/delete, the schedule module re-renders so the F23.5B cards update immediately. The flow does not call the lesson/session save path and does not write class sessions, schedule sessions, attendance, tuition, reports, or Teacher Portal data.

## F23.5B.1 Guard

The activity form/card does not use `data-module-launcher`.

Input/select/textarea updates only mutate `scheduleCalendarItemState`; they do not call `render()` on ordinary input/change. `render()` is called only for explicit actions such as open, save validation, save success, detail/edit/delete, close, and delete success.

The global module opener remains restricted to `moduleLauncherSelector`; the generic `[data-module-id]` opener is not restored.

## Not In This Phase

No tag management, label naming, colorblind mode, custom color picker, recurrence, conflict detection, filter, legend, PDF, print preview, drag/drop, cloud sync, or real permissions.

## Checks

Run:

- `node --check src/main.js`
- `node --check src/schedule-module.js`
- `node --check src/center-calendar-data.js`
- `node --check tests/f23-5c-crud-center-calendar-items-local-safe-smoke.js`
- `node tests/f23-5c-crud-center-calendar-items-local-safe-smoke.js`
- F23.5A, F23.5B, F23.5B.1 smokes
- schedule/class-session/attendance regressions
- taskbar/window launcher regressions
- `npm run build`
- `git diff --check`
- mojibake scan

Manual QA is still required before calling this pass.
