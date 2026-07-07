import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const docPath = 'docs/fb-hotfix-render-input-caret-stability-app-wide.md'
const main = read('src/main.js')
const doc = exists(docPath) ? read(docPath) : ''
const getFunctionBody = (source, name) => {
  const start = source.indexOf(`function ${name}`)
  if (start === -1) return ''
  const next = source.indexOf('\nfunction ', start + 1)
  return source.slice(start, next === -1 ? source.length : next)
}
const immediateRenderGuard = getFunctionBody(main, 'shouldAllowImmediateRenderForActiveElement')

const markers = [
  'FB HOTFIX STATUS: RENDER INPUT CARET STABILITY APP WIDE',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'INPUT_CARET_LOSS_FIXED: YES',
  'FULL_RENDER_WHILE_TYPING_PREVENTED: YES',
  'STUDENT_SEARCH_LIVE_WITHOUT_BLUR: YES',
  'STUDENT_FILTER_LIVE_WITHOUT_BLUR: YES',
  'ACTION_CLICK_SINGLE_CLICK_PRESERVED: YES',
  'WINDOW_STACK_FIX_PRESERVED: YES',
  'BLUR_RENDER_CLICK_SWALLOW_REDUCED: YES',
  'PARTIAL_OR_FOCUS_SAFE_RENDER_USED: YES',
  'SETTINGS_CLOUD_CLASS_SYNC_DEFERRED: YES',
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

assert(
  /function shouldDeferRenderForTextEditing\(\)[\s\S]*return isTextEditingElement\(activeElement\)/.test(main),
  'Runtime must guard against full render while typing.',
)
assert(
  /\[data-student-filter\]/.test(immediateRenderGuard) &&
    !/\[data-teacher-filter\]/.test(immediateRenderGuard),
  'Immediate text-input render should be narrowed to Student filters, not every module filter.',
)
assert(
  /function getActiveElementRenderSnapshot\(\)/.test(main) &&
    /function restoreActiveElementRenderSnapshot\(snapshot\)/.test(main) &&
    /selectionStart/.test(main) &&
    /setSelectionRange/.test(main),
  'Runtime must have focus/caret restore for live renders.',
)
assert(
  /querySelectorAll\('\[data-student-filter\]'\)[\s\S]*control\.addEventListener\(control\.matches\('select'\) \? 'change' : 'input'/.test(main),
  'Student search/filter must remain live without blur.',
)
assert(
  /function isInteractiveActionElement\(element\)/.test(main) &&
    /textEditingActionPointerUntil/.test(main) &&
    /pointerdown/.test(main),
  'Action click pointerdown guard must be preserved.',
)
assert(/function openModuleWindow\(moduleId\)[\s\S]*focusWindow\(nextWindowId\)/.test(main), 'Window open bring-to-front fix must be preserved.')
assert(/function closeWindow\(windowId\)[\s\S]*nextActiveWindow/.test(main), 'Window close LIFO fix must be preserved.')
assert(!exists('docs/fb-hotfix-render-input-caret-stability-app-wide.sql'), 'No SQL file for this hotfix.')
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=|service_role\s*key\s*=|password\s*=\s*['"][^'"]+['"]/i.test([main, doc].join('\n')), 'No password/secret exposure.')
assert(!/supabase\/functions/.test([main, doc].join('\n')), 'No Supabase function edits should be part of this hotfix.')

if (failures.length) {
  console.error('FB hotfix render input caret smoke failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('FB hotfix render input caret smoke passed.')
