# FB Admin DreamHome - Vong 0 window stack live filter

FB ADMIN DREAMHOME STATUS: VONG 0 WINDOW STACK LIVE FILTER
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
WINDOW_STACK_APP_WIDE_POLICY_FIXED: YES
SPECIAL_LAYER_PRIORITY_PRESERVED: YES
OPEN_WINDOW_BRING_TO_FRONT_FIXED: YES
SETTINGS_OPEN_FROM_STUDENT_EDIT_BRING_TO_FRONT: YES
WINDOW_CLOSE_LIFO_FIXED: YES
STUDENT_SEARCH_LIVE_INPUT_FIXED: YES
STUDENT_FILTER_CHANGE_LIVE_FIXED: YES
INPUT_ACTION_SINGLE_CLICK_FIXED: YES
BLUR_RENDER_CLICK_SWALLOW_REDUCED: YES
PARENT_MODULE_WIRING_DEFERRED: YES
ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Context

Vong 0 QA DreamHome found two app-wide blockers: normal windows could still hide special layers or newly opened windows, and filters in Students did not visually apply until the user blurred the active field. This patch keeps scope to window/input wiring and does not change C8 Teacher, SQL, Supabase functions, deploy, commit, or push.

## Root Causes

- Window stack: module windows had a bring-to-front helper, but newly opened module windows were not always routed through it, and close did not explicitly promote the latest visible remaining window. Opening Settings from Edit Student therefore depended on incidental render/focus timing.
- Live filter: Student filter handlers updated state on `input`, but `render()` was globally deferred whenever an input/select was focused. The state changed, yet DOM did not refresh until blur/focusout flushed the deferred render.
- Click swallowing: the same deferred render could flush on focusout before the browser delivered the intended click on a button, summary, taskbar item, or window action.

## Patch Summary

- `openModuleWindow()` focuses newly created module windows.
- `closeWindow()` promotes the next visible highest-z window, giving repeated X close LIFO behavior.
- `shouldAllowImmediateRenderForActiveElement()` lets filter controls and selects render immediately while preserving caret protection for normal text inputs/textareas.
- Student filters now use `input` for search and `change` for select filters.
- Pointerdown action guard keeps deferred form renders from replacing the clicked action target before click dispatch.
- Special layers have explicit high z-index policy: notification, Start, center popover, and taskbar overflow all sit above normal windows.

## Window Stack Policy

Special layers stay above normal windows. Normal windows are ordered by the shared z-index counter. Opening or clicking a window brings it to front; opening an existing window focuses it; closing a window promotes the latest visible remaining window.

## Live Filter Policy

Search fields with `data-*-filter` render on `input`. Select filters render on `change`. Filter controls are allowed to render while focused because they are navigation controls, not free-form form draft fields. Normal form text inputs still keep deferred full-render protection to avoid caret loss.

## Manual QA Checklist

- Open Students, student profile, Edit Student, then Open Settings. Settings must appear in front and taskbar active must be Settings.
- Press X repeatedly. Expected close order: Settings, Edit Student/Students form window, Student Profile, Students.
- Open Start, center profile, notification bell, and taskbar overflow over normal windows. They must stay on top.
- In Students, type a name in search and change status, level, and class filters. Results must update immediately without blur.
- Focus an input, then click another field, X, Cancel, or Open Settings. One click should be enough.

## Known Remaining Issues

- Parent module wiring is deferred to a separate feedback.
- Attendance baseline logic is deferred to a separate feedback.

## Safety Notes

- SQL: not run.
- Deploy: not run.
- Edge Functions: not invoked.
- Commit/push: not run.
- C8 Teacher runtime/roadmap: not changed by this feedback.
