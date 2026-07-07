# FB Hotfix - Render input caret stability app-wide

FB HOTFIX STATUS: RENDER INPUT CARET STABILITY APP WIDE
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
INPUT_CARET_LOSS_FIXED: YES
FULL_RENDER_WHILE_TYPING_PREVENTED: YES
STUDENT_SEARCH_LIVE_WITHOUT_BLUR: YES
STUDENT_FILTER_LIVE_WITHOUT_BLUR: YES
ACTION_CLICK_SINGLE_CLICK_PRESERVED: YES
WINDOW_STACK_FIX_PRESERVED: YES
BLUR_RENDER_CLICK_SWALLOW_REDUCED: YES
PARTIAL_OR_FOCUS_SAFE_RENDER_USED: YES
SETTINGS_CLOUD_CLASS_SYNC_DEFERRED: YES
PARENT_MODULE_WIRING_DEFERRED: YES
ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Context

After Vong 0, Student search/filter was live but used full `render()` while the search input was focused. That kept filters fresh, but it could replace the active input node and make the caret unstable. Blocking every focused-input render fixed caret loss but made search/filter stale until blur.

## Root Cause

- The global `render()` replaces `app.innerHTML`, so any immediate render while a text field is focused can replace the active node.
- Vong 0 allowed all filter controls to bypass the text-edit render guard. That made live filters update, but it also expanded the number of focused inputs that could trigger full app renders.
- The focusout flush could still race with action clicks, so the pointerdown action guard must remain.

## Patch Summary

- Normal text input, textarea, select, and contenteditable edits still defer full app render.
- Immediate render is limited to Student filters and select controls that need change-time feedback.
- `render()` now snapshots the active editable element before replacing DOM and restores focus/caret afterward when it is safe.
- The action pointerdown guard is preserved so X, Cancel, Start, taskbar, and Open Settings clicks are not swallowed.
- Window stack helpers from Vong 0 are preserved.

## Render Policy

Full app render is deferred while a regular editing control is focused. If a focused Student filter or select must render live, the render captures a stable selector plus `selectionStart/selectionEnd`, then restores that element after event binding and scroll restoration. No restore happens during an action click window.

## Live Filter Policy

Student search remains `input`-driven and Student select filters remain `change`-driven. They update state and render live without requiring blur, with focus/caret restored after render.

## Action Click Policy

Pointerdown on action controls marks a short action window. During that window, deferred blur renders wait so the browser can deliver the click to the intended button/window control.

## Manual QA Checklist

- Open Students and type in search. Results update live and caret stays visible.
- Change Student status, level, and class filters. Results update immediately.
- In Edit Student, type in text fields. Caret stays stable and full renders defer.
- From an active input, click another field, X, Cancel, or Open Settings. One click should be enough.
- Verify Settings opens in front and repeated X closes windows LIFO.

## Deferred Issues

- Settings class cloud sync remains deferred.
- Parent module wiring remains deferred.
- Attendance baseline logic remains deferred.

## Safety Notes

- SQL: not run.
- Deploy: not run.
- Edge Functions: not invoked.
- Commit/push: not run.
- C8 Teacher runtime/roadmap: not changed by this hotfix.
