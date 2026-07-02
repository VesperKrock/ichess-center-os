import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8g-wire-live-revoke-restore-ui-phongtrong.md')
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

assert(fs.existsSync(docPath), 'Docs C7.8G must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8G STATUS: WIRE LIVE REVOKE RESTORE UI PHONGTRONG',
  'C7_8F_MANUAL_LIVE_REVOKE_PASS: YES',
  'C7_8F_MANUAL_LIVE_RESTORE_PASS: YES',
  'TARGET_CENTER_ID: phongtrong_prod',
  'TARGET_ADMIN_EMAIL: admin.phongtrong@ichess.vn',
  'DREAMHOME_PROTECTED: YES',
  'UI_LIVE_REVOKE_ENABLED_FOR_PHONGTRONG: YES',
  'UI_LIVE_RESTORE_ENABLED_FOR_PHONGTRONG: YES',
  'UI_LIVE_REVOKE_ENABLED_FOR_DREAMHOME: NO',
  'UI_LIVE_RESTORE_ENABLED_FOR_DREAMHOME: NO',
  'REVOKE_TYPED_CONFIRMATION_REQUIRED: YES',
  'RESTORE_CONFIRMATION_REQUIRED: YES',
  'DISABLE_AUTH_USER_ALLOWED: NO',
  'HARD_DELETE_ALLOWED: NO',
  'PASSWORD_OR_SECRET_INCLUDED: NO',
  'SERVICE_ROLE_FRONTEND_EXPOSURE: NO',
  'CODEX_APPLIED_SQL: NO',
  'CODEX_DEPLOYED_FUNCTIONS: NO',
  'CODEX_INVOKED_REVOKE: NO',
  'CODEX_INVOKED_RESTORE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'const ACCOUNT_REVOKE_LIVE_ACTIONS_ENABLED = true',
  'const ACCOUNT_RESTORE_LIVE_ACTIONS_ENABLED = true',
  "const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])",
  'isInternalAccountLiveAllowedCenter',
  'canLiveRevokeInternalAccount',
  'canLiveRestoreInternalAccount',
  "supabase.functions.invoke('revoke-center-admin-access'",
  "supabase.functions.invoke('restore-center-admin-access'",
  'disable_auth_user: false',
  'owner_ui_controlled_revoke_center_admin_access',
  'owner_ui_controlled_restore_center_admin_access',
  'c7-8g-ui-revoke-',
  'c7-8g-ui-restore-',
  "typedValue === 'REVOKE'",
  "restoreTypedConfirmation !== 'RESTORE'",
  'localAccountSnapshotsByCenterId',
  'Đã thu hồi quyền admin cơ sở.',
  'Đã khôi phục quyền admin cơ sở.',
  'data-internal-restore-admin-center-id',
  'data-internal-restore-typed-confirmation',
  'data-internal-restore-confirm',
  "supabase.functions.invoke('list-center-admin-accounts'",
  "supabase.functions.invoke('reset-center-admin-password'",
  "supabase.functions.invoke('provision-center-admin-account'",
].forEach((marker) => assertIncludes(main, marker))

assert(!/ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set\([^)]*dreamhome_prod/.test(main), 'DreamHome must not be in live allowlist.')
assert(
  /const finalRevokeEnabled = Boolean\([\s\S]*liveAllowed[\s\S]*revokeRiskAcknowledged[\s\S]*typedValue === 'REVOKE'/.test(main),
  'Revoke final button must require liveAllowed, risk acknowledgement, and REVOKE.',
)
assert(
  /const finalRestoreEnabled = Boolean\(liveAllowed && typedValue === 'RESTORE'/.test(main),
  'Restore final button must require liveAllowed and RESTORE.',
)
assert(
  /if \(!canLiveRevokeInternalAccount\(target\)\)[\s\S]*Thao tác thu hồi quyền cho cơ sở này chưa được bật/.test(main),
  'Revoke handler must block non-allowlisted centers.',
)
assert(
  /if \(!canLiveRestoreInternalAccount\(target\)\)[\s\S]*Thao tác khôi phục quyền cho cơ sở này chưa được bật/.test(main),
  'Restore handler must block non-allowlisted centers.',
)
assert(
  /localAccountSnapshotsByCenterId:[\s\S]*state: 'revoked'/.test(main),
  'Runtime must keep local revoked snapshot after revoke.',
)
assert(
  /delete nextLocalSnapshots\[target\.centerId\]/.test(main),
  'Runtime must clear local revoked snapshot after restore.',
)
assert(
  /document\.querySelectorAll\('\[data-internal-restore-admin-center-id\]'\)[\s\S]{0,420}event\.preventDefault\(\)[\s\S]{0,160}event\.stopPropagation\(\)/.test(main),
  'Restore open handler must preserve scroll.',
)

const revokeStart = main.indexOf("supabase.functions.invoke('revoke-center-admin-access'")
const revokeBlock = main.slice(revokeStart, revokeStart + 760)
assertIncludes(revokeBlock, 'center_id: target.centerId')
assertIncludes(revokeBlock, 'target_email: target.email')
assertIncludes(revokeBlock, 'disable_auth_user: false')
assert(!/password\s*:|temporary_password\s*:|service_role|actor_user_id|actor_email|authorization/i.test(revokeBlock), 'Revoke UI body must not include forbidden fields.')

const restoreStart = main.indexOf("supabase.functions.invoke('restore-center-admin-access'")
const restoreBlock = main.slice(restoreStart, restoreStart + 720)
assertIncludes(restoreBlock, 'center_id: target.centerId')
assertIncludes(restoreBlock, 'target_email: target.email')
assert(!/password\s*:|temporary_password\s*:|service_role|actor_user_id|actor_email|authorization|disable_auth_user/i.test(restoreBlock), 'Restore UI body must not include forbidden fields.')

assert(!main.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend must not expose service role key.')
assert(!main.includes('service_role'), 'Frontend must not reference service_role.')
assert(!main.includes('auth.admin'), 'Frontend must not use auth.admin.')
assert(!/console\.log/.test(main), 'Runtime must not console.log account secrets.')
assert(
  !/localStorage[\s\S]{0,180}temporary_password|temporary_password[\s\S]{0,180}localStorage/.test(main),
  'Runtime must not persist temporary_password to localStorage.',
)
assert(
  !/sessionStorage[\s\S]{0,180}temporary_password|temporary_password[\s\S]{0,180}sessionStorage/.test(main),
  'Runtime must not persist temporary_password to sessionStorage.',
)

assertIncludes(styles, '.internal-account-restore:not(:disabled)')

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8G wire live revoke restore UI Phong Trong smoke: PASS')
