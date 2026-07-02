import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8d-wire-create-admin-button-handoff-ui.md')
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

assert(fs.existsSync(docPath), 'Docs C7.8D must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8D STATUS: WIRE CREATE ADMIN BUTTON HANDOFF UI',
  'C7_8C_1_STATUS: PASS',
  'CREATE_ADMIN_BUTTON_ENABLED_FOR_NO_ADMIN_CENTER: YES',
  'CREATE_ADMIN_BUTTON_DISABLED_FOR_HAS_ADMIN_CENTER: YES',
  'PROVISION_CENTER_ADMIN_FUNCTION_CALLED_FROM_UI: YES',
  'CREATE_ADMIN_CONFIRM_REQUIRED: YES',
  'CREATE_ADMIN_HANDOFF_CARD_CREATED: YES',
  'COPY_EMAIL_ACTION: YES',
  'COPY_PASSWORD_ACTION: YES',
  'COPY_ALL_HANDOFF_ACTION: YES',
  'TEMPORARY_PASSWORD_DISPLAY_ONCE_UI: YES',
  'TEMPORARY_PASSWORD_LOCAL_STORAGE_ALLOWED: NO',
  'TEMPORARY_PASSWORD_SESSION_STORAGE_ALLOWED: NO',
  'PLAINTEXT_PASSWORD_LONG_TERM_STORAGE_ALLOWED: NO',
  'RESET_PASSWORD_FLOW_PRESERVED: YES',
  'REVOKE_ACCESS_BUTTON_ENABLED: NO',
  'REVOKE_FUNCTION_CALLED_FROM_UI: NO',
  'SERVICE_ROLE_FRONTEND_EXPOSURE: NO',
  'SCROLL_JUMP_FIX_PRESERVED: YES',
  'RUNTIME_UI_CHANGE: YES',
  'C7_8E_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'createStatus',
  'createConfirm',
  'getExpectedInternalAdminEmail',
  'getInternalAccountCreateTarget',
  'openInternalCreateAdminConfirm',
  'handleInternalCreateAdminAccount',
  "supabase.functions.invoke('provision-center-admin-account'",
  'createInternalCreateAdminIdempotencyKey',
  'c7-8d-create-admin-',
  'display_name: target.displayName',
  'center_admin_already_exists',
  'Cơ sở này đã có admin. Đang tải lại trạng thái tài khoản.',
  'data-internal-create-admin-center-id',
  'data-internal-create-admin-cancel',
  'data-internal-create-admin-confirm',
  'Tạo admin cơ sở?',
  'Đã tạo tài khoản admin cơ sở',
  "kind: 'create'",
  "kind: 'reset'",
  'data-internal-handoff-copy="email"',
  'data-internal-handoff-copy="password"',
  'data-internal-handoff-copy="all"',
  'data-internal-handoff-close',
  'copyInternalAccountText(handoff.email',
  'copyInternalAccountText(handoff.temporaryPassword',
  'buildInternalPasswordHandoffText(handoff)',
  'closeInternalPasswordHandoff',
  "supabase.functions.invoke('reset-center-admin-password'",
  "['.desktop-area.is-internal-console-route', 'internal-console-route']",
].forEach((marker) => assertIncludes(main, marker))

assert(
  /const createEnabled = Boolean\([\s\S]*center\.environment === 'production'[\s\S]*center\.status === 'active'[\s\S]*internalCenterAdminAccountsState\.status === 'loaded'[\s\S]*adminAccount\?\.exists === false/.test(main),
  'Create admin button must only enable for production active centers loaded with no admin.',
)
assert(
  /createButtonLabel[\s\S]*hasAdmin[\s\S]*'Đã có admin'/.test(main),
  'Centers with existing admin must show create action disabled as already having admin.',
)
assert(
  /data-internal-create-admin-center-id="\$\{escapeAttribute\(center\.id\)\}"[\s\S]{0,220}\$\{createEnabled && !isCreating \? '' : 'disabled'\}/.test(main),
  'Create admin button must be disabled unless createEnabled and not submitting.',
)
assert(
  /document\.querySelectorAll\('\[data-internal-create-admin-center-id\]'\)[\s\S]{0,420}event\.preventDefault\(\)[\s\S]{0,160}event\.stopPropagation\(\)/.test(main),
  'Create admin click handler must preserve scroll by preventing default and propagation.',
)
assert(
  /document\.querySelector\('\[data-internal-create-admin-confirm\]'\)[\s\S]{0,360}event\.preventDefault\(\)[\s\S]{0,160}event\.stopPropagation\(\)/.test(main),
  'Create admin confirm handler must preserve scroll by preventing default and propagation.',
)

const provisionStart = main.indexOf("supabase.functions.invoke('provision-center-admin-account'")
assert(provisionStart >= 0, 'Provision invoke must exist')
const provisionBlock = main.slice(provisionStart, provisionStart + 760)

;[
  'center_id: target.centerId',
  'idempotency_key: createInternalCreateAdminIdempotencyKey(target.centerId)',
  'display_name: target.displayName',
].forEach((marker) => assertIncludes(provisionBlock, marker))

;[
  /email\s*:/,
  /password\s*:/,
  /temporary_password\s*:/,
  /role\s*:/,
  /actor_/,
  /service_role/i,
  /Authorization/i,
].forEach((pattern) => {
  assert(!pattern.test(provisionBlock), `Provision UI request body must not include forbidden field/pattern: ${pattern}`)
})

assert(main.includes("const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])"), 'C7.8G live actions must be allowlisted to Phong Trong.')
assert(!/ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS[\s\S]{0,120}dreamhome_prod/.test(main), 'DreamHome must not be in live account access allowlist.')
assert(!main.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend must not expose service role key.')
assert(!main.includes('service_role'), 'Frontend must not reference service_role.')
assert(!main.includes('auth.admin'), 'Frontend must not use auth.admin.')
assert(!/console\.log/.test(main), 'Runtime must not console.log password or handoff data.')
assert(
  !/localStorage[\s\S]{0,160}temporary_password|temporary_password[\s\S]{0,160}localStorage/.test(main),
  'Runtime must not persist temporary_password to localStorage.',
)
assert(
  !/sessionStorage[\s\S]{0,160}temporary_password|temporary_password[\s\S]{0,160}sessionStorage/.test(main),
  'Runtime must not persist temporary_password to sessionStorage.',
)

;[
  'width: min(1120px, 100%)',
  '.internal-account-email',
  'white-space: nowrap',
  '.internal-password-handoff',
].forEach((marker) => assertIncludes(styles, marker))

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8D wire create admin button handoff UI smoke: PASS')
