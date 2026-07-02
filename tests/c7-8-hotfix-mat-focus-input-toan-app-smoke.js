import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'c7-8-hotfix-mat-focus-input-toan-app.md')
const mainPath = path.join(root, 'src', 'main.js')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath)
  const forbidden = [
    [0x0043, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x004b, 0x0068, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x0050, 0x0068, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x00c3, 0x00a1, 0x00bb].map((code) => String.fromCharCode(code)).join(''),
    '\uFFFD',
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'Hotfix docs must exist')
assert(fs.existsSync(mainPath), 'Runtime source must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)

;[
  'C7.8 HOTFIX STATUS: INPUT FOCUS LOSS FIX',
  'INPUT_FOCUS_LOSS_CONFIRMED: YES',
  'ROOT_CAUSE_IDENTIFIED: YES',
  'FULL_RENDER_LOOP_FIXED_OR_GUARDED: YES',
  'TEXT_EDITING_FOCUS_PROTECTED: YES',
  'CLOCK_TASKBAR_REGRESSION: NO',
  'ACCOUNT_MANAGEMENT_REGRESSION: NO',
  'RESET_PASSWORD_FLOW_REGRESSION: NO',
  'CREATE_ADMIN_GUARD_REGRESSION: NO',
  'SCROLL_JUMP_FIX_PRESERVED: YES',
  'SUPABASE_MUTATION_ADDED: NO',
  'EDGE_FUNCTION_CHANGED: NO',
  'RUNTIME_UI_CHANGE: YES',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  '## Root cause found',
  '## Patch summary',
  '## Manual QA checklist',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'let pendingTextEditingRender = false',
  'function isTextEditingElement(element)',
  "tagName === 'input'",
  "tagName === 'textarea'",
  "tagName === 'select'",
  'element.isContentEditable',
  'function shouldDeferRenderForTextEditing()',
  'deferRenderUntilTextEditingEnds()',
  'flushDeferredTextEditingRender()',
  'installTextEditingRenderProtection()',
  "document.addEventListener('focusout', scheduleDeferredTextEditingRenderFlush, true)",
  "document.addEventListener('change', scheduleDeferredTextEditingRenderFlush, true)",
].forEach((marker) => assertIncludes(main, marker))

assert(
  /function render\(\) \{\s*if \(shouldDeferRenderForTextEditing\(\)\) \{\s*deferRenderUntilTextEditingEnds\(\)\s*return\s*\}/.test(main),
  'render() must guard full app DOM replacement while a text-editing element is focused.',
)

assert(
  /function updateClock\(\)[\s\S]*clock\.textContent = `\$\{date\} \$\{time\}`/.test(main),
  'Clock must still update only the taskbar clock element text.',
)
assert(
  /window\.__ichessClockTimer = setInterval\(updateClock, 1000\)/.test(main),
  'Clock timer must call updateClock directly.',
)
assert(
  !/setInterval\s*\(\s*(?:\(\)\s*=>\s*)?render\s*\(/.test(main),
  'No setInterval should call full render() directly.',
)
assert(
  !/setInterval\s*\([^)]*render\(\)[\s\S]{0,80}1000/.test(main),
  'No 1-second timer should call full render().',
)

;[
  "supabase.functions.invoke('list-center-admin-accounts'",
  "supabase.functions.invoke('reset-center-admin-password'",
  "supabase.functions.invoke('provision-center-admin-account'",
  "['.desktop-area.is-internal-console-route', 'internal-console-route']",
  'rememberPreservedScrollPositions',
  'restorePreservedScrollPositions',
].forEach((marker) => assertIncludes(main, marker))

assert(main.includes("const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])"), 'C7.8G live actions must be allowlisted to Phong Trong.')
assert(!/ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS[\s\S]{0,120}dreamhome_prod/.test(main), 'DreamHome must not be in live account access allowlist.')
assert(!main.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend must not expose service role key.')
assert(!main.includes('service_role'), 'Frontend must not reference service_role.')
assert(!main.includes('auth.admin'), 'Frontend must not use auth.admin.')
assert(
  !/localStorage[\s\S]{0,180}temporary_password|temporary_password[\s\S]{0,180}localStorage/.test(main),
  'Runtime must not persist temporary_password to localStorage.',
)
assert(
  !/sessionStorage[\s\S]{0,180}temporary_password|temporary_password[\s\S]{0,180}sessionStorage/.test(main),
  'Runtime must not persist temporary_password to sessionStorage.',
)

assertNoMojibake(docPath)
assertNoMojibake(mainPath)

console.log('C7.8 hotfix input focus loss smoke: PASS')
