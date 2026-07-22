# F23.5E2B - Edit delete whole weekly series

## Master Resolution

Virtual occurrence actions always resolve the latest master from `centerCalendarItems` using `masterId` and the current resolved center. The runtime never saves or deletes by `occurrenceId`.

If the master is missing, from another center, or no longer weekly recurring, the action is stopped safely and no replacement record is created.

## Detail Actions

Occurrence detail now shows:

- `Chỉnh sửa toàn bộ chuỗi`
- `Xóa toàn bộ chuỗi`
- `Đóng`

It does not show `Chỉ lần này`, `Lần này và các lần sau`, detached occurrence, exception, or occurrence-only edit/delete actions.

## Edit Whole-Series Flow

`Chỉnh sửa toàn bộ chuỗi` opens the existing activity form in series-edit mode from the latest master. The form date remains the master anchor date, not the occurrence date that was clicked.

Saving replaces exactly one master item. It preserves `id`, `centerId`, `createdAt`, and `sourceModule`, updates user metadata, `recurrenceRule`, and `updatedAt`, then virtual occurrences are recalculated from the updated master.

## Self-Exclusion

Conflict checking passes the master id as the current item id. The conflict adapter excludes the master and all virtual occurrences expanded from that same master. Editing only title/color/tag does not conflict with the series itself, but conflicts with other activities and other recurring series still surface.

## Hard And Soft Conflict

Hard conflict with real `classSessions` or `scheduleSessions` blocks the whole save and keeps the old master untouched.

Soft conflict with another activity or another recurring occurrence opens one summary panel. `Quay lại chỉnh sửa` restores the full form state. `Vẫn lưu toàn bộ chuỗi` updates exactly one master.

## Rule Recalculation

Changing weekdays, count, until date, anchor date, all-day, or cross-midnight time recalculates virtual occurrences. Old occurrence dates disappear automatically because occurrences are never materialized.

## Convert Series To Single

Choosing `Không lặp` while editing a series stores `recurrenceRule: null` on the same master id. The result is one single activity at the master anchor date. The occurrence that was clicked is not converted into a separate activity.

## Delete Whole-Series

`Xóa toàn bộ chuỗi` opens a clear confirmation:

- `Xóa toàn bộ chuỗi hoạt động?`
- title and recurrence summary;
- `Tất cả các lần lặp của chuỗi sẽ biến mất.`

Confirming removes exactly the master item from current-center `centerCalendarItems`. It does not loop occurrences, write tombstones, delete tags, delete classes, or touch attendance.

## Center And Stale Safety

All edit/delete actions reload from the current center. A stale pending state is not persisted. If the center changes, the old master cannot be resolved through another center namespace.

## Filter, Tag, Legend

Filters, badges, colors, and legend continue to operate on virtual occurrences in the viewed week. Tag manager counts master items, not occurrences. Deleting a series reduces tag usage by one master only.

## Boundaries

No class/session writes, no attendance, no tuition, no Teacher Portal or Teacher Workspace, no Auth, Supabase, SQL, deploy, PDF, materialization, exceptions, participant/teacher conflict, or cloud audit trail.

## Tests

Smoke: `tests/f23-5e2b-edit-delete-whole-weekly-series-smoke.js`.

Coverage includes master resolution markers, whole-series actions, edit preserving id/createdAt/sourceModule, self-exclusion, hard/soft conflict behavior, convert-to-single, delete confirmation, no occurrence-id storage mutation, no materialization, no focus/render regression, and mojibake scan.

## Limits

F23.5E2B supports only edit/delete whole weekly series. Single occurrence edit/delete, this-and-following, exceptions, skipped dates, detached occurrence, daily/monthly recurrence, drag/drop, and permission/audit flows remain out of scope.
