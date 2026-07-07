# FB Admin DreamHome - Interaction wiring, window stack, attendance

FB ADMIN DREAMHOME STATUS: INTERACTION WIRING WINDOW STACK ATTENDANCE
FEEDBACK_SOURCE: ADMIN_DREAMHOME_RUNTIME_QA
C8_TEACHER_ROADMAP_SCOPE: NO
ATTENDANCE_BASELINE_START_FIXED: YES
INFO_BELL_CLICK_FIXED: YES
CENTER_MEMBERS_400_HANDLED: YES
INPUT_SINGLE_CLICK_ACTION_FIXED_APP_WIDE: YES
BLUR_RENDER_CLICK_SWALLOW_REDUCED: YES
WINDOW_BRING_TO_FRONT_POLICY_FIXED: YES
WINDOW_CLOSE_LIFO_POLICY_FIXED: YES
NOTIFICATION_START_LAYER_PRIORITY_PRESERVED: YES
TASKBAR_OVERFLOW_PRIORITY_PRESERVED: YES
SETTINGS_OPEN_FROM_STUDENT_EDIT_BRING_TO_FRONT: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Context

Admin DreamHome QA reported that attendance baseline controls, notification/info clicks, form actions, and nested window focus felt unreliable. This patch stays in admin runtime wiring only. It does not touch C8 Teacher, SQL, Supabase functions, deploy, commit, or push.

## Root Cause

1. `center_members` profile reads in `src/member-profiles.js` selected optional columns: `display_name`, `member_label`, `email_snapshot`, and `updated_at`. On DreamHome schema variants where those columns are absent, Supabase REST returned 400. The auth membership path already used minimal columns, but the profile helper could still produce noisy 400s during runtime.
2. The app-wide caret protection deferred `render()` while an input/select/textarea was focused, then flushed on `focusout` with `setTimeout(0)`. When the user clicked a button while editing, that flush could replace DOM before the browser delivered the `click`, so the first click only blurred the field.
3. `openModuleWindow()` created new module windows with a z-index but did not route new windows through the same bring-to-front helper. `closeWindow()` removed a window without explicitly promoting the next highest visible window.
4. Taskbar popovers needed explicit layer policy above normal windows, not implicit stacking.

## Patch Summary

- `member-profiles.js` now reads `center_members` with the guaranteed minimal profile fields: `user_id`, `center_id`, `role`, `status`. It no longer hard-requires optional `email_snapshot` or `updated_at` on GET.
- `main.js` adds `isInteractiveActionElement()` and a short pointerdown action window before deferred text-edit render flushes. Buttons, taskbar items, module buttons, notification actions, window controls, attendance baseline actions, and student/settings actions get their click before the pending render is flushed.
- `openModuleWindow()` now calls `focusWindow()` for newly created module windows, so opening Settings from Edit Student brings Settings to the front.
- `closeWindow()` now promotes the next visible window with the highest z-index, giving repeated X clicks LIFO behavior.
- `styles.css` gives taskbar/start/overflow explicit high z-index priority while notification overlay remains highest.

## Window Stack Policy

Layer order:

1. Notification overlay and notification center.
2. Start menu.
3. Taskbar overflow.
4. Active recent window.
5. Other windows.

Opening an existing window focuses it. Opening a new window creates it, calls `focusWindow()`, clears transient overlays, and renders. Closing a window promotes the latest visible remaining window.

## Input/Focus/Render Policy

Text editing still protects caret by deferring full renders while an editable field is active. If the next pointerdown is on an action control, the deferred render waits briefly so the browser can dispatch the intended click first. Validation and state updates should continue to prefer save/change handlers over synchronous blur re-render.

## Supabase 400 Handling

No SQL was applied. The runtime avoids optional `center_members` fields for profile reads, preventing missing-column GET 400s from breaking UI wiring. Optional member profile fields map to empty values when absent.

## Manual QA Checklist

- Attendance board: select month/class, click `Bat dau nhap du lieu nen`, confirm baseline input mode starts.
- Attendance board: click module bell/info controls and confirm the popover/action responds on first click.
- Forms/modals: focus an input in Add/Edit Student, Add/Edit Teacher, Settings, and Attendance, then click another field or X/Cancel. The first click should work.
- Student flow: open Students, open a student profile, open Edit Student, click Open Settings. Settings should appear in front and taskbar should mark it active.
- Close windows repeatedly with X. Expected order is Settings, Edit Student, Student Profile, Students module.
- Open notification center, Start, and taskbar overflow; each should stay above normal windows.

## Safety Notes

- SQL: not run.
- Deploy: not run.
- Edge Functions: not invoked.
- Commit/push: not run.
- C8 Teacher files: not changed by this feedback.
