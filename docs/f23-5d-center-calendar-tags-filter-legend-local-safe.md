# F23.5D - Center Calendar Tags, Filter, Legend Local-Safe

Date: 2026-07-22

Scope: local-safe tag management for Module Thời khóa biểu on `main`. No Auth, Supabase, SQL, deploy, Teacher secret, push, or commit.

## Model Tag

`centerCalendarTags` keeps one center-scoped list per storage key:

- `ichessCenterOS.centerCalendarTags.<centerId>`
- required: `id`, `centerId`, `label`, `colorKey`, `isActive`, `createdAt`, `updatedAt`
- optional: `defaultItemType`, `description`, `customColor`

Labels are trimmed and limited to 50 characters. Empty labels are rejected. Tag colors use the same safe palette keys as F23.5C: blue, green, emerald, yellow, orange, red, purple, pink, gray. Raw CSS values are not accepted for tag color.

## Center Scope

Tags are loaded and saved with `getCurrentResolvedCenterId()`. Center A and center B use different localStorage keys. Switching center resets schedule calendar tag manager state and filter state so a stale tag id from the previous center is not kept in the UI.

Malformed storage still falls back safely through the F23.5A helpers.

## CRUD Tag

The TKB toolbar now has `Quản lý nhãn` beside `+ Thêm buổi học` and `+ Thêm hoạt động`. It opens a separate manager window titled `Quản lý nhãn hoạt động`.

The manager supports:

- create a tag with name, palette color, optional default item type, and short description;
- edit tag name/color/default type/description while preserving `id`, `centerId`, and `createdAt`;
- archive active tags;
- restore archived tags.

There is no hard delete in F23.5D.

## Duplicate Rule

Within the same center, two active tags cannot share the same trimmed, case-insensitive label. If a matching archived tag exists, validation asks the user to restore it instead of creating a duplicate. Restore is also guarded against creating duplicate active labels.

## Archive And Restore

Archive only sets `isActive = false`. It does not delete the tag and does not rewrite items.

Old activities keep their `tagId` and `tagLabel`. Archived tags still render on old cards and in detail, but they are not offered for newly tagged activities. Restore sets `isActive = true` and the old links become selectable again.

## One Tag Per Item

F23.5D is an MVP with một nhãn per `centerCalendarItem`.

The activity model uses:

- `tagId`
- `tagLabel`

It does not use `tagIds[]`, multi-label UI, tag ordering, drag/drop, automation, recurrence, conflict detection, participant picker, PDF, print preview, cloud sync, or real permissions.

## Assign And Unassign

The create/edit activity form has a `Nhãn` select:

- `Không gắn nhãn`
- active tags of the current center
- the item current archived tag only when editing an old item that already has it

Saving an assigned tag writes `tagId` and a `tagLabel` snapshot. Unassigning clears both. Choosing a tag does not change `itemType`, `colorKey`, or `customColor`.

## Snapshot Label

Cards and detail prefer the current tag label from `centerCalendarTags`. If the tag cannot be found, they fall back to the stored `tagLabel` snapshot. Renaming a tag does not require rewriting all items just to update card text.

## Color Independence

Tag color is used only for the tag badge/chip and không đổi màu thẻ. Card color stays controlled by the activity `colorKey` and item type defaults from F23.5C. A meeting with a purple tag remains a meeting, and assigning a red tag does not make the activity card red.

## Filter

The TKB has local UI filters for calendar items:

- type: `Tất cả loại`, `Hội họp`, `Sự kiện`, `Giải đấu`, `Hoạt động khác`
- tag: `Tất cả nhãn`, `Không gắn nhãn`, active tags, and archived tags only when the current week uses them

Type and tag filters combine with AND logic. Filters apply only to `centerCalendarItems`; fixed slots, class sessions, empty class slots, attendance paths, and taskbar/window state are not filtered.

`Xóa bộ lọc` appears only when a filter is active. Filter state is session UI state and is not persisted.

## Legend

The compact TKB legend has two groups:

- activity type colors;
- tags used by activities in the current week, with counts.

Legend chips are read-only in this MVP. This avoids adding extra render paths or click-to-filter behavior during the focus/dropdown guarded phase.

## Focus Guard

The manager, tag form, palette, filters, and badges do not use `data-module-launcher`. The global module opener remains restricted to marked launchers.

Input/change handlers for activity fields and tag fields update local state only. They do not call `render()` and do not call `openModuleWindow()`. Render is used only for explicit actions such as open/close manager, switch create/edit mode, save, archive, restore, delete activity, and filter apply/reset.

## Boundaries

F23.5D does not modify class/session data and does not touch:

- `classSessions`
- `scheduleSessions`
- attendance records
- session reports
- `tuition.usedSessions`
- Teacher Portal or Teacher Workspace
- Auth, Supabase, SQL, or cloud sync

Calendar item tags are metadata for center activities only.

## Tests

Expected checks:

- `node --check src/main.js`
- `node --check src/schedule-module.js`
- `node --check src/center-calendar-data.js`
- `node --check tests/f23-5d-center-calendar-tags-filter-legend-local-safe-smoke.js`
- F23.5A/B/B.1/C/D smokes
- TKB/class-session/attendance/taskbar regressions
- `npm run build`
- `git diff --check`
- mojibake scan

Manual QA is still required before calling the feature fully accepted.

## Next

F23.5E can handle conflict warnings and recurrence MVP. F23.6 can handle weekly print/PDF export.
