import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8c-1-fix-account-management-scroll-jump.md')
const mainPath = path.join(root, 'src', 'main.js')
const stylesPath = path.join(root, 'src', 'styles.css')

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

assert(fs.existsSync(docPath), 'Docs C7.8C.1 must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8C.1 STATUS: FIX ACCOUNT MANAGEMENT SCROLL JUMP',
  'C7_8C_STATUS: PASS',
  'C7_8C_RESET_UI_MANUAL_QA_PASS: YES',
  'SCROLL_JUMP_BUG_CONFIRMED: YES',
  'ACCOUNT_ACTION_BUTTONS_TYPE_BUTTON: YES',
  'ACCOUNT_ACTION_PREVENT_DEFAULT: YES',
  'SCROLL_POSITION_PRESERVED: YES',
  'CREATE_ADMIN_BUTTON_ENABLED: NO',
  'REVOKE_ACCESS_BUTTON_ENABLED: NO',
  'RESET_PASSWORD_LOGIC_CHANGED: NO',
  'EDGE_FUNCTION_CHANGED: NO',
  'SUPABASE_MUTATION_ADDED: NO',
  'RUNTIME_UI_CHANGE: YES',
  'C7_8D_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  '## 3. Root cause found',
  '## 4. Patch summary',
  '## 5. Manual QA checklist',
].forEach((marker) => assertIncludes(docs, marker))

assertIncludes(main, "['.desktop-area.is-internal-console-route', 'internal-console-route']")
assertIncludes(main, 'rememberPreservedScrollPositions')
assertIncludes(main, 'restorePreservedScrollPositions')

;[
  "document.querySelectorAll('[data-internal-copy-admin-email]')",
  "document.querySelectorAll('[data-internal-create-admin-center-id]')",
  "document.querySelector('[data-internal-create-admin-cancel]')",
  "document.querySelector('[data-internal-create-admin-confirm]')",
  "document.querySelectorAll('[data-internal-reset-admin-center-id]')",
  "document.querySelector('[data-internal-reset-cancel]')",
  "document.querySelector('[data-internal-reset-confirm]')",
  "document.querySelectorAll('[data-internal-handoff-copy]')",
  "document.querySelector('[data-internal-handoff-close]')",
].forEach((selector) => {
  const start = main.indexOf(selector)
  assert(start >= 0, `Expected handler for ${selector}`)
  const block = main.slice(start, start + 520)
  assert(block.includes('event.preventDefault()'), `Expected preventDefault in ${selector}`)
  assert(block.includes('event.stopPropagation()'), `Expected stopPropagation in ${selector}`)
})

;[
  'button type="button"',
  "supabase.functions.invoke('reset-center-admin-password'",
  'owner_ui_temporary_password_reset',
  'data-internal-reset-admin-center-id',
  'data-internal-handoff-copy="password"',
].forEach((marker) => assertIncludes(main, marker))

assert(
  /const createEnabled = Boolean\([\s\S]*adminAccount\?\.exists === false/.test(main),
  'After C7.8D, create admin action must only enable for no-admin centers.',
)
assert(
  /createButtonLabel[\s\S]*hasAdmin[\s\S]*'Đã có admin'/.test(main),
  'After C7.8D, centers with existing admin must keep create action disabled.',
)
assert(
  /<button type="button" disabled title="Sẽ được bật ở C7\.8B\/C7\.8C">Thu hồi quyền/.test(main),
  'Revoke action must remain disabled.',
)
assert(!main.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend must not expose service role key.')
assert(!main.includes('service_role'), 'Frontend must not reference service_role.')
assert(
  !/localStorage[\s\S]{0,160}temporary_password|temporary_password[\s\S]{0,160}localStorage/.test(main),
  'Runtime must not persist temporary_password to localStorage.',
)
assert(
  !/sessionStorage[\s\S]{0,160}temporary_password|temporary_password[\s\S]{0,160}sessionStorage/.test(main),
  'Runtime must not persist temporary_password to sessionStorage.',
)

assertIncludes(styles, '.internal-account-management')

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8C.1 fix account management scroll jump smoke: PASS')
