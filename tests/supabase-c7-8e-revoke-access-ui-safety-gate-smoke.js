import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8e-revoke-access-ui-safety-gate.md')
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

assert(fs.existsSync(docPath), 'Docs C7.8E must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8E STATUS: REVOKE ACCESS UI SAFETY GATE',
  'C7_8D_STATUS: PASS',
  'INPUT_FOCUS_HOTFIX_STATUS: PASS',
  'REVOKE_UI_PANEL_ADDED: YES',
  'REVOKE_TYPED_CONFIRMATION_ADDED: YES',
  'REVOKE_SAFETY_GATE_DEFAULT_OFF: YES',
  'REVOKE_LIVE_ACTION_ENABLED: NO',
  'REVOKE_FUNCTION_CALLED_FROM_UI: NO',
  'REVOKE_FUNCTION_CALL_PREPARED_FOR_C7_8F: YES',
  'CENTER_MEMBERS_UPDATE_GRANT_APPLIED: NO',
  'ACCESS_REVOKED: NO',
  'AUTH_USER_DISABLED: NO',
  'RESET_PASSWORD_FLOW_PRESERVED: YES',
  'CREATE_ADMIN_FLOW_PRESERVED: YES',
  'ACCOUNT_STATUS_UI_PRESERVED: YES',
  'SCROLL_JUMP_FIX_PRESERVED: YES',
  'INPUT_FOCUS_FIX_PRESERVED: YES',
  'SERVICE_ROLE_FRONTEND_EXPOSURE: NO',
  'PASSWORD_LONG_TERM_STORAGE_ALLOWED: NO',
  'RUNTIME_UI_CHANGE: YES',
  'C7_8F_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  "const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])",
  'revokeStatus',
  'revokeConfirm',
  'revokeTypedConfirmation',
  'revokeRiskAcknowledged',
  'getInternalAccountRevokeTarget',
  'openInternalRevokeAccessConfirm',
  'closeInternalRevokeAccessConfirm',
  'acknowledgeInternalRevokeRisk',
  'updateInternalRevokeTypedConfirmation',
  'handleInternalRevokeAdminAccess',
  'createInternalRevokeAccessIdempotencyKey',
  'c7-8g-ui-revoke-',
  'owner_ui_controlled_revoke_center_admin_access',
  'disable_auth_user: false',
  "supabase.functions.invoke('revoke-center-admin-access'",
  'data-internal-revoke-admin-center-id',
  'data-internal-revoke-typed-confirmation',
  'data-internal-revoke-acknowledge-risk',
  'data-internal-revoke-confirm',
  'data-internal-revoke-cancel',
  'internal-account-revoke-modal',
  'internal-account-revoke-window',
  'Thu hồi quyền admin cơ sở',
  'Nhập REVOKE để xác nhận',
  'Đã bật cho cơ sở này',
  'Thao tác thu hồi quyền cho cơ sở này chưa được bật.',
  'Đã thu hồi quyền',
  'Admin sẽ không còn quyền truy cập cơ sở này.',
  'Khôi phục quyền',
  'Owner có thể khôi phục quyền hoặc tạo admin mới',
  "supabase.functions.invoke('list-center-admin-accounts'",
  "supabase.functions.invoke('reset-center-admin-password'",
  "supabase.functions.invoke('provision-center-admin-account'",
  'deferRenderUntilTextEditingEnds()',
  'installTextEditingRenderProtection()',
  "['.desktop-area.is-internal-console-route', 'internal-console-route']",
  'rememberPreservedScrollPositions',
  'restorePreservedScrollPositions',
].forEach((marker) => assertIncludes(main, marker))

assert(
  /const revokeEnabled = Boolean\(hasAdmin && adminEmail && !isRevokedAdmin\)/.test(main),
  'Revoke entry action must only enable for active centers with admin email.',
)
assert(
  /data-internal-revoke-admin-center-id="\$\{escapeAttribute\(center\.id\)\}"[\s\S]{0,180}\$\{revokeEnabled \? '' : 'disabled'\}/.test(main),
  'Revoke entry button must be disabled when no admin exists.',
)
assert(
  /const finalRevokeEnabled = Boolean\([\s\S]*liveAllowed[\s\S]*revokeRiskAcknowledged[\s\S]*typedValue === 'REVOKE'/.test(main),
  'Final destructive action must require live allowlist, risk acknowledgement, and typed REVOKE.',
)
assert(
  /data-internal-revoke-confirm[\s\S]{0,140}\$\{finalRevokeEnabled \? '' : 'disabled'\}/.test(main),
  'Final revoke button must be disabled unless finalRevokeEnabled is true.',
)

const revokeHandlerStart = main.indexOf('async function handleInternalRevokeAdminAccess()')
assert(revokeHandlerStart >= 0, 'Revoke handler must exist')
const revokeHandler = main.slice(revokeHandlerStart, revokeHandlerStart + 2400)
const guardIndex = revokeHandler.indexOf('if (!canLiveRevokeInternalAccount(target))')
const invokeIndex = revokeHandler.indexOf("supabase.functions.invoke('revoke-center-admin-access'")
assert(guardIndex >= 0, 'Revoke handler must check live allowlist gate.')
assert(invokeIndex >= 0, 'Future revoke invoke wrapper must exist.')
assert(guardIndex < invokeIndex, 'Safety gate must run before future revoke invoke.')
assertIncludes(revokeHandler, 'return')

const revokeInvokeBlock = main.slice(main.indexOf("supabase.functions.invoke('revoke-center-admin-access'"), main.indexOf("supabase.functions.invoke('revoke-center-admin-access'") + 760)
;[
  'center_id: target.centerId',
  'target_email: target.email',
  'idempotency_key: createInternalRevokeAccessIdempotencyKey(target.centerId)',
  "reason: 'owner_ui_controlled_revoke_center_admin_access'",
  'disable_auth_user: false',
].forEach((marker) => assertIncludes(revokeInvokeBlock, marker))

;[
  /password\s*:/,
  /temporary_password\s*:/,
  /role\s*:/,
  /actor_/,
  /service_role/i,
  /Authorization/i,
].forEach((pattern) => {
  assert(!pattern.test(revokeInvokeBlock), `Revoke UI request body must not include forbidden field/pattern: ${pattern}`)
})

assert(
  /document\.querySelectorAll\('\[data-internal-revoke-admin-center-id\]'\)[\s\S]{0,420}event\.preventDefault\(\)[\s\S]{0,160}event\.stopPropagation\(\)/.test(main),
  'Revoke open handler must preserve scroll by preventing default and propagation.',
)
assert(
  /document\.querySelector\('\[data-internal-revoke-confirm\]'\)\?\.addEventListener\('click'[\s\S]{0,360}event\.preventDefault\(\)[\s\S]{0,160}event\.stopPropagation\(\)/.test(main),
  'Revoke final handler must preserve scroll by preventing default and propagation.',
)
assert(
  /document\.querySelector\('\[data-internal-revoke-typed-confirmation\]'\)\?\.addEventListener\('input'[\s\S]{0,220}updateInternalRevokeTypedConfirmation\(event\.target\.value\)/.test(main),
  'Typed confirmation input must update state from input event.',
)

assert(!main.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend must not expose service role key.')
assert(!main.includes('service_role'), 'Frontend must not reference service_role.')
assert(!main.includes('auth.admin'), 'Frontend must not use auth.admin.')
assert(!/console\.log/.test(main), 'Runtime must not console.log password or handoff data.')
assert(
  !/localStorage[\s\S]{0,180}temporary_password|temporary_password[\s\S]{0,180}localStorage/.test(main),
  'Runtime must not persist temporary_password to localStorage.',
)
assert(
  !/sessionStorage[\s\S]{0,180}temporary_password|temporary_password[\s\S]{0,180}sessionStorage/.test(main),
  'Runtime must not persist temporary_password to sessionStorage.',
)

;[
  '.internal-account-revoke-modal',
  '.internal-account-revoke-window',
  '.internal-account-revoke-warning',
  '.internal-account-revoke-typed',
  '.internal-account-revoke-actions',
  '.internal-account-revoke-gate',
  '.internal-account-restore-placeholder',
].forEach((marker) => assertIncludes(styles, marker))

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8E revoke access UI safety gate smoke: PASS')
