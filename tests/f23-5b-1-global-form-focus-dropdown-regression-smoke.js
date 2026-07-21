import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const mainPath = path.join(repoRoot, 'src', 'main.js')
const docsPath = path.join(repoRoot, 'docs', 'f23-5b-1-global-form-focus-dropdown-regression.md')
const main = fs.readFileSync(mainPath, 'utf8')

assert(fs.existsSync(docsPath), 'F23.5B.1 docs must exist.')
const docs = fs.readFileSync(docsPath, 'utf8')

for (const marker of [
  'function render()',
  'app.innerHTML =',
  'function openModuleWindow(moduleId)',
  'function getModuleLauncherFromEventTarget(target)',
  'const moduleLauncherSelector =',
  '.module-button[data-module-launcher][data-module-id]',
  '.start-menu-module[data-module-launcher][data-module-id]',
  'data-module-launcher="desktop"',
  'data-module-launcher="start-menu"',
  'document.querySelectorAll(moduleLauncherSelector).forEach((button) =>',
  'openModuleWindow(button.dataset.moduleId)',
  "document.querySelectorAll('[data-taskbar-window-id]').forEach((button) =>",
  'focusWindow(button.dataset.taskbarWindowId)',
  'document.querySelectorAll(\'[data-window-id]\').forEach((windowElement) =>',
  'focusWindow(windowElement.dataset.windowId)',
  'function installTextEditingRenderProtection()',
  'function scheduleDeferredTextEditingRenderFlush(event = null)',
  "event?.type === 'focusout' && isTextEditingElement(event.relatedTarget)",
  'let textEditingFieldPointerUntil = 0',
  'function shouldDelayTextEditingRenderFlushForFieldTransition()',
  'shouldDelayTextEditingRenderFlushForAction() || shouldDelayTextEditingRenderFlushForFieldTransition()',
]) {
  assert(main.includes(marker), `Missing runtime marker: ${marker}`)
}

assert(
  !main.includes("document.querySelectorAll('[data-module-id]').forEach((button) =>"),
  'Module opener must not bind the generic [data-module-id] selector.',
)

const launcherHelper = getFunctionBlock(main, 'getModuleLauncherFromEventTarget')
assert(launcherHelper.includes('isTextEditingElement(target)'), 'Text-editing targets must never be treated as module launchers.')
assert(launcherHelper.includes("launcher.closest('.desktop-window')"), 'Launchers inside module windows must be rejected.')
assert(launcherHelper.includes('return launcher'), 'Valid launchers must still be returned.')

const launcherBinding = getSnippetAfter(main, 'document.querySelectorAll(moduleLauncherSelector).forEach((button) =>', 700)
assert(launcherBinding.includes('getModuleLauncherFromEventTarget(event.target)'), 'Launcher click must validate the event target.')
assert(launcherBinding.includes('launcher !== button'), 'Delegated child clicks must be checked against the real launcher.')
assert(launcherBinding.includes('openModuleWindow(button.dataset.moduleId)'), 'Desktop/Start launchers must still open modules.')

const interactiveAction = getFunctionBlock(main, 'isInteractiveActionElement')
assert(!interactiveAction.includes("'[data-module-id]'"), 'Text editing action guard must not treat every module window as an action.')
assert(interactiveAction.includes("'[data-module-launcher]'"), 'Text editing action guard may still recognize real launchers.')

assert(
  /document\.addEventListener\(\s*'pointerdown'[\s\S]{0,220}isTextEditingElement\(event\.target\)[\s\S]{0,120}textEditingFieldPointerUntil = Date\.now\(\) \+ 220/.test(main),
  'Pointerdown on input/select/textarea must delay deferred render flush during field transition.',
)

assert(
  /function flushDeferredTextEditingRender\(\)[\s\S]{0,180}window\.setTimeout\(flushDeferredTextEditingRender, 80\)/.test(main),
  'Deferred render flush must retry while an action or field transition guard is active.',
)

assert(
  /function scheduleDeferredTextEditingRenderFlush\(event = null\)[\s\S]{0,180}return[\s\S]{0,120}window\.setTimeout\(flushDeferredTextEditingRender, 0\)/.test(main),
  'Focusout to another text field must not schedule immediate full render.',
)

for (const moduleEvidence of [
  '[data-student-form-field]',
  '[data-tuition-form-field]',
  '[data-parent-contact-field]',
]) {
  assert(main.includes(moduleEvidence), `Representative module path missing: ${moduleEvidence}`)
}

for (const forbiddenRuntime of [
  'ichessDebugFormFocus',
  '__ichessFocusTrace',
  '__ichessFocusTraceClear',
  '__ichessFocusTraceCopy',
  '__ichessFocusTraceSnapshot',
  'installFocusTrace',
  'appendFocusTraceRecord',
  'focusTrace',
  'new MutationObserver(',
  'console.log(',
  'debugger',
  'setTimeout(() => focus',
]) {
  assert(!main.includes(forbiddenRuntime), `Runtime debug/workaround must not remain: ${forbiddenRuntime}`)
}

assert(!/function .*Focus.*\([\s\S]{0,500}querySelectorAll\('\[data-tuition-form-field\]'\)/.test(main), 'Must not add tuition-specific focus workaround.')
assert(!/function .*Focus.*\([\s\S]{0,500}querySelectorAll\('\[data-parent-contact-field\]'\)/.test(main), 'Must not add CRM-specific focus workaround.')
assert(!/function .*Focus.*\([\s\S]{0,500}querySelectorAll\('\[data-student-form-field\]'\)/.test(main), 'Must not add student-specific focus workaround.')

for (const docsMarker of [
  'ROOT_CAUSE_IDENTIFIED: YES',
  'REAL_TRACE_CALL_PATH',
  'GENERIC_SELECTOR_REMOVED',
  'FINAL_RUNTIME_INSTRUMENTATION: REMOVED',
  'Student, Tuition, Parent consultation',
  'Manual QA',
  'No Auth/Supabase/SQL/deploy/Teacher Workspace changes',
]) {
  assert(docs.includes(docsMarker), `Missing docs marker: ${docsMarker}`)
}

for (const mojibakeMarker of createMojibakeMarkers()) {
  assert(!main.includes(mojibakeMarker), `Mojibake marker found in main: ${mojibakeMarker}`)
  assert(!docs.includes(mojibakeMarker), `Mojibake marker found in docs: ${mojibakeMarker}`)
}

console.log('F23.5B.1 global form focus/dropdown regression smoke passed')

function getSnippetAfter(source, marker, length) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `Missing marker: ${marker}`)
  return source.slice(start, start + length)
}

function getFunctionBlock(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`)
  assert.notEqual(start, -1, `Missing function: ${functionName}`)

  const nextFunction = source.indexOf('\nfunction ', start + 1)
  return source.slice(start, nextFunction === -1 ? source.length : nextFunction)
}

function createMojibakeMarkers() {
  return [
    ['C', '\u0102', '\u00a1', '\u00c2', '\u00ba'].join(''),
    ['\u0102', '\u0192'].join(''),
    ['\u0102', '\u2020', '\u00c2', '\u00b0'].join(''),
    ['H', '\u0102', '\u00a1', '\u00c2', '\u00ba'].join(''),
    ['\u0102', '\u00a1', '\u00c2', '\u00bb'].join(''),
    'Bu' + '\u0102' + '\u00a1' + '\u00c2' + '\u00bb' + '\u00e2' + '\u20ac' + '\u00a2i h' + '\u0102' + '\u00a1' + '\u00c2' + '\u00bb' + '\u00c2' + '\u008d' + 'c m' + '\u0102' + '\u00a1' + '\u00c2' + '\u00bb' + '\u00e2' + '\u20ac' + '\u00ba' + 'i',
  ]
}
