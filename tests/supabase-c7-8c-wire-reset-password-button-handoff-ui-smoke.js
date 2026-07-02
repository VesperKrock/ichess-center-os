import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8c-wire-reset-password-button-handoff-ui.md')
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

assert(fs.existsSync(docPath), 'Docs C7.8C must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8C STATUS: WIRE RESET PASSWORD BUTTON HANDOFF UI',
  'C7_8B_STATUS: PASS',
  'RESET_PASSWORD_BUTTON_ENABLED: YES',
  'RESET_PASSWORD_FUNCTION_CALLED_FROM_UI: YES',
  'RESET_CONFIRM_REQUIRED: YES',
  'HANDOFF_CARD_CREATED: YES',
  'COPY_EMAIL_ACTION: YES',
  'COPY_PASSWORD_ACTION: YES',
  'COPY_ALL_HANDOFF_ACTION: YES',
  'TEMPORARY_PASSWORD_DISPLAY_ONCE_UI: YES',
  'TEMPORARY_PASSWORD_LOCAL_STORAGE_ALLOWED: NO',
  'TEMPORARY_PASSWORD_SESSION_STORAGE_ALLOWED: NO',
  'PLAINTEXT_PASSWORD_LONG_TERM_STORAGE_ALLOWED: NO',
  'CREATE_ADMIN_BUTTON_ENABLED: NO',
  'REVOKE_ACCESS_BUTTON_ENABLED: NO',
  'SERVICE_ROLE_FRONTEND_EXPOSURE: NO',
  'ACCOUNT_PANEL_WIDER_POLISH: YES',
  'EMAIL_WRAP_POLISH: YES',
  'RUNTIME_UI_CHANGE: YES',
  'C7_8D_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  '## 4. Confirm UX',
  '## 5. Handoff card',
  '## 7. Password non-persistence',
].forEach((marker) => assertIncludes(docs, marker))

;[
  "supabase.functions.invoke('reset-center-admin-password'",
  'owner_ui_temporary_password_reset',
  'createInternalResetPasswordIdempotencyKey',
  'data-internal-reset-admin-center-id',
  'data-internal-reset-confirm',
  'data-internal-reset-cancel',
  'Tạo mật khẩu tạm mới?',
  'Mật khẩu cũ sẽ không dùng được sau khi reset',
  'Đã tạo mật khẩu tạm mới',
  'Mật khẩu này chỉ hiển thị trong lần này',
  'data-internal-handoff-copy="email"',
  'data-internal-handoff-copy="password"',
  'data-internal-handoff-copy="all"',
  'data-internal-handoff-close',
  'Tôi đã lưu',
  'copyInternalAccountText(handoff.email',
  'copyInternalAccountText(handoff.temporaryPassword',
  'buildInternalPasswordHandoffText(handoff)',
  'closeInternalPasswordHandoff',
  'handoff: null',
].forEach((marker) => assertIncludes(main, marker))

assert(
  /const resetEnabled = Boolean\(hasAdmin && adminEmail\)/.test(main),
  'Reset button must only enable for cards with admin email.',
)
assert(
  /class="internal-account-reset"[\s\S]{0,260}\$\{resetEnabled && !isResetting \? '' : 'disabled'\}/.test(main),
  'Reset button must be disabled when resetEnabled is false or submitting.',
)
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
assert(
  /handleInternalResetAdminPassword[\s\S]*supabase\.functions\.invoke\('reset-center-admin-password'/.test(main),
  'Reset function call must happen inside reset handler.',
)
assert(
  /openInternalResetPasswordConfirm[\s\S]*resetConfirm: target/.test(main),
  'Confirm state must be created before reset submit.',
)
assert(
  /data\.temporary_password/.test(main),
  'Runtime must read temporary_password only from success response for handoff.',
)
assert(
  !/localStorage[\s\S]{0,160}temporary_password|temporary_password[\s\S]{0,160}localStorage/.test(main),
  'Runtime must not persist temporary_password to localStorage.',
)
assert(
  !/sessionStorage[\s\S]{0,160}temporary_password|temporary_password[\s\S]{0,160}sessionStorage/.test(main),
  'Runtime must not persist temporary_password to sessionStorage.',
)
assert(!/console\.log/.test(main), 'Runtime must not console.log password or handoff data.')
assert(!main.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend must not expose service role key.')
assert(!main.includes('service_role'), 'Frontend must not reference service_role.')
assert(!main.includes('auth.admin'), 'Frontend must not use auth.admin.')

;[
  'width: min(1120px, 100%)',
  '.internal-account-email',
  'white-space: nowrap',
  'overflow-x: auto',
  '.internal-account-reset-panel',
  '.internal-password-handoff',
  '.internal-password-handoff-details',
  '.internal-password-handoff-secret',
].forEach((marker) => assertIncludes(styles, marker))

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8C wire reset password button handoff UI smoke: PASS')
