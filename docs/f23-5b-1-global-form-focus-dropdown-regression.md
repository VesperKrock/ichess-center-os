# F23.5B.1 - Global Form Focus/Dropdown Regression

Date: 2026-07-22

ROOT_CAUSE_IDENTIFIED: YES

REAL_TRACE_CALL_PATH: `render()` -> `openModuleWindow()` -> module launcher click listener.

GENERIC_SELECTOR_REMOVED: YES

FINAL_RUNTIME_INSTRUMENTATION: REMOVED

Scope: shared runtime fix in `src/main.js`. No Auth/Supabase/SQL/deploy/Teacher Workspace changes.

## Symptoms

When a user clicked from one form field to another inside an already open module window, the second field briefly received focus and then lost it. Native selects opened and immediately closed on the first click.

The confirmed browser trace showed that the focused input/select node was disconnected during the same interaction. `document.activeElement` fell back to `body`, and an equivalent replacement node appeared after the app root was rebuilt.

## Root Cause

The module opener listener was bound to every `[data-module-id]` element. Real module windows also carry `data-module-id`, so a click inside a module bubbled to `.desktop-window[data-module-id]`.

That meant ordinary content clicks inside Student, Tuition, and Parent consultation could run:

1. click input/select inside `.desktop-window`
2. generic `[data-module-id]` listener matches the window ancestor
3. `openModuleWindow(button.dataset.moduleId)`
4. `openModuleWindow()` calls `render()`
5. `render()` replaces the app root with `app.innerHTML = ...`
6. the field that just focused is disconnected
7. caret/dropdown is lost

This was not a Student-specific bug and was not fixed by restoring focus.

## Fix

The opener now binds only real launchers:

- `.module-button[data-module-launcher][data-module-id]`
- `.start-menu-module[data-module-launcher][data-module-id]`

`getModuleLauncherFromEventTarget(target)` rejects:

- text editing elements;
- anything inside `.desktop-window`;
- any element that is not a marked launcher.

Desktop and Start menu launchers still call `openModuleWindow(button.dataset.moduleId)`. Taskbar activation stays on its own `[data-taskbar-window-id]` flow with `focusWindow(...)`. Plain clicks inside an app window use the existing `[data-window-id]` pointerdown focus/z-index flow and do not reopen the module.

## Deferred Render Audit

The existing deferred render guard is retained because it protects form edits from unrelated full renders:

- `shouldDeferRenderForTextEditing()`
- `textEditingFieldPointerUntil`
- `flushDeferredTextEditingRender()`
- `scheduleDeferredTextEditingRenderFlush(event)`

The audit removed the overly broad `[data-module-id]` action match from `isInteractiveActionElement()`. That attribute exists on window roots, so it should not make every click inside a module look like a launcher/action. The guard now recognizes `[data-module-launcher]` instead.

No timeout was increased. No module-specific focus patch was added.

## Instrumentation Cleanup

F23.5B.1A diagnostic runtime was removed:

- debug localStorage flag;
- `window.__ichessFocusTrace*` APIs;
- event trace capture listeners;
- focus node token `WeakMap`;
- debug `MutationObserver`;
- render stack tracing;
- post-event microtask/rAF tracing;
- diagnostic counters and trace records.

The old diagnostic-only doc and smoke can be deleted after this final blocker patch. The final regression smoke does not require any debug API.

## Regression Coverage

Final smoke checks:

- no generic `[data-module-id]` opener binding;
- marked launcher selector exists;
- launcher clicks still call `openModuleWindow`;
- input/textarea/select/contenteditable paths cannot be treated as module launchers;
- clicks inside `.desktop-window` cannot reopen/rerender a module;
- taskbar/window activation still uses `focusWindow`;
- deferred timer keeps the field-transition guard;
- instrumentation/debug APIs and MutationObserver are absent;
- no Student, Tuition, or Parent consultation focus workaround;
- no mojibake markers.

Representative modules covered by runtime paths: Student, Tuition, Parent consultation.

## Manual QA

Student:

- open add/edit student form;
- click name, then level/class, then school;
- open school level native select;
- caret/dropdown should remain on first click.

Tuition:

- click two fields in a row;
- open a native select;
- no second click should be needed.

Parent consultation:

- open add new customer;
- move name -> phone -> email;
- open stage/contact type select;
- step 4 should still sync latest data.

Launcher/window:

- desktop module icon opens/focuses module;
- Start menu module opens/focuses module;
- taskbar focuses the existing window;
- clicking module content does not flash, rerender, reset input data, or jump scroll.

## Checks

Run:

- `node --check src/main.js`
- `node --check tests/f23-5b-1-global-form-focus-dropdown-regression-smoke.js`
- `node tests/f23-5b-1-global-form-focus-dropdown-regression-smoke.js`
- representative Student, Tuition, Parent consultation, Settings/Thu chi smokes
- F23.3B, F23.3D, F23.5A, F23.5B smokes
- `npm run build`
- `git diff --check`
- mojibake scan
