import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const docPath = 'docs/fb-admin-dreamhome-vong-0-window-stack-live-filter.md'
const main = read('src/main.js')
const styles = read('src/styles.css')
const studentModule = read('src/student-module.js')
const doc = exists(docPath) ? read(docPath) : ''

const markers = [
  'FB ADMIN DREAMHOME STATUS: VONG 0 WINDOW STACK LIVE FILTER',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'WINDOW_STACK_APP_WIDE_POLICY_FIXED: YES',
  'SPECIAL_LAYER_PRIORITY_PRESERVED: YES',
  'OPEN_WINDOW_BRING_TO_FRONT_FIXED: YES',
  'SETTINGS_OPEN_FROM_STUDENT_EDIT_BRING_TO_FRONT: YES',
  'WINDOW_CLOSE_LIFO_FIXED: YES',
  'STUDENT_SEARCH_LIVE_INPUT_FIXED: YES',
  'STUDENT_FILTER_CHANGE_LIVE_FIXED: YES',
  'INPUT_ACTION_SINGLE_CLICK_FIXED: YES',
  'BLUR_RENDER_CLICK_SWALLOW_REDUCED: YES',
  'PARENT_MODULE_WIRING_DEFERRED: YES',
  'ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]

assert(exists(docPath), 'Docs report must exist.')
for (const marker of markers) {
  assert(doc.includes(marker), `Docs marker missing: ${marker}`)
}

assert(/function bringWindowToFront\(windowId\)/.test(main), 'bringWindowToFront must exist.')
assert(
  /function openModuleWindow\(moduleId\)[\s\S]*const nextWindowId[\s\S]*focusWindow\(nextWindowId\)/.test(main),
  'openModuleWindow must focus newly opened module windows.',
)
assert(
  /function closeWindow\(windowId\)[\s\S]*nextActiveWindow[\s\S]*zIndex: \+\+topZIndex/.test(main),
  'closeWindow must promote next active window in LIFO/z-index order.',
)
assert(
  /data-student-action="open-settings-module"[\s\S]*openModuleWindowFromChildInteraction\('cai-dat-co-so'\)/.test(main),
  'Student edit open settings must use child open/focus helper.',
)

assert(/data-student-filter="query"/.test(studentModule), 'Student search filter input must exist.')
assert(
  /querySelectorAll\('\[data-student-filter\]'\)[\s\S]*control\.addEventListener\(control\.matches\('select'\) \? 'change' : 'input'/.test(main),
  'Student search must use input and select filters must use change.',
)
assert(
  /function shouldAllowImmediateRenderForActiveElement\(element\)/.test(main) &&
    /\[data-student-filter\]/.test(main) &&
    /function isNativeSelectElement\(element\)/.test(main) &&
    /markNativeSelectChangeRender/.test(main),
  'Focused text filters must render safely and native selects must render after change.',
)
assert(
  /function isInteractiveActionElement\(element\)/.test(main) &&
    /textEditingActionPointerUntil/.test(main) &&
    /'summary'/.test(main) &&
    /pointerdown/.test(main),
  'Input/action click swallowing must be mitigated with pointerdown action guard.',
)

assert(/\.notification-center\s*\{[\s\S]*z-index:\s*2147483004/.test(styles), 'Notification layer priority must be highest.')
assert(/\.start-menu\s*\{[\s\S]*z-index:\s*2147483003/.test(styles), 'Start menu priority must be explicit.')
assert(/\.center-profile-popover\s*\{[\s\S]*z-index:\s*2147483002/.test(styles), 'Center popover priority must be explicit.')
assert(/\.window-overflow-menu\s*\{[\s\S]*z-index:\s*2147483001/.test(styles), 'Taskbar overflow priority must be explicit.')
assert(/\.taskbar\s*\{[\s\S]*z-index:\s*2147482000/.test(styles), 'Taskbar must remain above normal windows.')

const changedText = [main, styles, studentModule, doc].join('\n')
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=|service_role\s*key\s*=|password\s*=\s*['"][^'"]+['"]/i.test(changedText), 'No password/secret exposure.')
assert(!/supabase\/functions/.test(changedText), 'No Supabase function edits should be part of this feedback.')
assert(!exists('docs/fb-admin-dreamhome-vong-0-window-stack-live-filter.sql'), 'No SQL file for this feedback.')

if (failures.length) {
  console.error('FB admin DreamHome Vong 0 smoke failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('FB admin DreamHome Vong 0 smoke passed.')
