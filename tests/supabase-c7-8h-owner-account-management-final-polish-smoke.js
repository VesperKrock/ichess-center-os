import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8h-owner-account-management-final-polish.md')
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

assert(fs.existsSync(docPath), 'Docs C7.8H must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8H STATUS: OWNER ACCOUNT MANAGEMENT FINAL POLISH',
  'DEV_COPY_REMOVED_FROM_OWNER_UI: YES',
  'OWNER_FACING_COPY_ADDED: YES',
  'BUTTON_HOVER_AFFORDANCE_POLISHED: YES',
  'BUTTON_DISABLED_AFFORDANCE_POLISHED: YES',
  'REVOKE_MODAL_COPY_POLISHED: YES',
  'RESTORE_MODAL_COPY_POLISHED: YES',
  'DREAMHOME_PRODUCT_COPY_PROTECTED: YES',
  'PHONGTRONG_LIVE_REVOKE_RESTORE_PRESERVED: YES',
  'DREAMHOME_LIVE_REVOKE_RESTORE_ENABLED: NO',
  'RESET_PASSWORD_FLOW_PRESERVED: YES',
  'CREATE_ADMIN_FLOW_PRESERVED: YES',
  'COPY_EMAIL_FLOW_PRESERVED: YES',
  'INPUT_FOCUS_FIX_PRESERVED: YES',
  'SCROLL_JUMP_FIX_PRESERVED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'LIVE_REVOKE_INVOKED_BY_CODEX: NO',
  'LIVE_RESTORE_INVOKED_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

const accountUiStart = main.indexOf('function renderInternalCenterAccountStatusNote()')
const accountUiEnd = main.indexOf('function renderInternalCreateAdminConfirm()')
assert(accountUiStart > 0 && accountUiEnd > accountUiStart, 'Account management UI slice must be found.')
const accountUi = main.slice(accountUiStart, accountUiEnd)

;[
  'Safety gate',
  'C7.8E',
  'C7.8F',
  'C7.8G',
  'Live test',
  'disable_auth_user',
  'snapshot',
  'Final action',
  'revoked về active',
  'active về revoked',
  'Protected',
  'allowlist',
  'endpoint read-only',
  'deploy list-center-admin-accounts',
].forEach((forbidden) => {
  assert(!accountUi.includes(forbidden), `Owner Account UI must not show dev copy: ${forbidden}`)
})

;[
  'Thao tác bảo mật',
  'Đã bật cho cơ sở này',
  'Chưa bật thao tác thật',
  'Thao tác thu hồi quyền cho cơ sở này chưa được bật.',
  'Đã thu hồi quyền',
  'Khôi phục quyền',
  'Tài khoản đăng nhập vẫn tồn tại',
  'Khôi phục quyền sẽ cho admin truy cập lại cơ sở này.',
  'Nhập REVOKE để xác nhận',
  'Nhập RESTORE để xác nhận',
].forEach((marker) => assertIncludes(accountUi, marker))

assertIncludes(main, "const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])")
assert(!/ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set\([^)]*dreamhome_prod/.test(main), 'DreamHome must not be in live allowlist.')
assertIncludes(main, "supabase.functions.invoke('revoke-center-admin-access'")
assertIncludes(main, "supabase.functions.invoke('restore-center-admin-access'")
assertIncludes(main, 'disable_auth_user: false', 'Revoke request must still keep Auth user enabled internally.')
assert(
  /const finalRevokeEnabled = Boolean\([\s\S]*liveAllowed[\s\S]*revokeRiskAcknowledged[\s\S]*typedValue === 'REVOKE'/.test(main),
  'Revoke final button must require liveAllowed, risk acknowledgement, and typed REVOKE.',
)
assert(
  /const finalRestoreEnabled = Boolean\(liveAllowed && typedValue === 'RESTORE'/.test(main),
  'Restore final button must require liveAllowed and typed RESTORE.',
)
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

;[
  '.internal-account-create:not(:disabled):hover',
  '.internal-account-reset:not(:disabled):focus-visible',
  '.internal-account-copy:not(:disabled):active',
  '.internal-account-revoke:not(:disabled):hover',
  '.internal-account-restore:not(:disabled):focus-visible',
  '.internal-account-revoke-actions button.is-danger:not(:disabled):hover',
  '.internal-account-revoke-actions button.is-success:not(:disabled):focus-visible',
  'transform: translateY(-1px)',
  'transform: translateY(1px)',
  'cursor: not-allowed',
  'transition: background 140ms ease',
].forEach((marker) => assertIncludes(styles, marker))

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8H owner account management final polish smoke: PASS')
