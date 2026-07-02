import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8e-1-revoke-window-restore-ux-polish.md')
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
    [0x0050, 0x0068].map((code) => String.fromCharCode(code)).join('') + String.fromCharCode(0x0102),
    [0x00c3, 0x00a1, 0x00bb].map((code) => String.fromCharCode(code)).join(''),
    '\uFFFD',
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'Docs C7.8E.1 must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8E.1 STATUS: REVOKE WINDOW UX POLISH',
  'C7_8E_STATUS: PASS_UNCOMMITTED',
  'REVOKE_INLINE_PANEL_REMOVED_OR_DEPRECATED: YES',
  'REVOKE_WINDOW_OR_MODAL_ADDED: YES',
  'REVOKE_BUTTON_AFFORDANCE_FIXED: YES',
  'REVOKE_TYPED_CONFIRMATION_PRESERVED: YES',
  'REVOKE_SAFETY_GATE_DEFAULT_OFF: YES',
  'REVOKE_LIVE_ACTION_ENABLED: NO',
  'REVOKE_FUNCTION_CALLED_FROM_UI: NO',
  'RESTORE_ACCESS_DESIGN_PLACEHOLDER_ADDED: YES',
  'RESTORE_ACCESS_LIVE_ACTION_ENABLED: NO',
  'ACCESS_REVOKED: NO',
  'ACCESS_RESTORED: NO',
  'RESET_PASSWORD_FLOW_PRESERVED: YES',
  'CREATE_ADMIN_FLOW_PRESERVED: YES',
  'ACCOUNT_STATUS_UI_PRESERVED: YES',
  'SCROLL_JUMP_FIX_PRESERVED: YES',
  'INPUT_FOCUS_FIX_PRESERVED: YES',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  "const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])",
  'internal-account-revoke-modal',
  'internal-account-revoke-window',
  'aria-modal="true"',
  'Thu hồi quyền admin cơ sở',
  'Đã bật cho cơ sở này',
  'data-internal-revoke-cancel',
  'aria-label="Đóng cửa sổ thu hồi quyền"',
  'Nhập REVOKE để xác nhận',
  'data-internal-revoke-typed-confirmation',
  'Đã bật cho cơ sở này',
  'Thao tác thu hồi quyền cho cơ sở này chưa được bật.',
  'internal-account-restore-placeholder',
  'Sau khi thu hồi quyền',
  'Đã thu hồi quyền',
  'Admin sẽ không còn quyền truy cập cơ sở này.',
  'Owner có thể khôi phục quyền hoặc tạo admin mới',
  'Khôi phục quyền',
  'Tạo admin mới',
  "supabase.functions.invoke('list-center-admin-accounts'",
  "supabase.functions.invoke('reset-center-admin-password'",
  "supabase.functions.invoke('provision-center-admin-account'",
  'deferRenderUntilTextEditingEnds()',
  'installTextEditingRenderProtection()',
  "['.desktop-area.is-internal-console-route', 'internal-console-route']",
].forEach((marker) => assertIncludes(main, marker))

assert(
  !/<div class="internal-account-revoke-panel" role="dialog"[\s\S]*aria-labelledby="internal-revoke-title"/.test(main),
  'Revoke confirm must no longer be a deep inline panel dialog.',
)
assert(
  /<div class="internal-account-revoke-modal"[\s\S]*<div class="internal-account-revoke-window" role="dialog" aria-modal="true"/.test(main),
  'Revoke confirm must render as a viewport modal/window.',
)
assert(
  /const finalRevokeEnabled = Boolean\([\s\S]*liveAllowed[\s\S]*typedValue === 'REVOKE'/.test(main),
  'Final revoke action must still require live allowlist and typed REVOKE.',
)
assert(
  /if \(!canLiveRevokeInternalAccount\(target\)\)[\s\S]*return[\s\S]*supabase\.functions\.invoke\('revoke-center-admin-access'/.test(main),
  'Revoke invoke must remain blocked outside the Phong Trong allowlist.',
)
assert(
  /document\.querySelectorAll\('\[data-internal-revoke-cancel\]'\)[\s\S]{0,360}event\.preventDefault\(\)[\s\S]{0,160}event\.stopPropagation\(\)/.test(main),
  'Both revoke close controls must prevent default and preserve scroll.',
)
assert(
  /document\.querySelector\('\[data-internal-revoke-typed-confirmation\]'\)\?\.addEventListener\('input'[\s\S]{0,220}updateInternalRevokeTypedConfirmation\(event\.target\.value\)/.test(main),
  'Typed confirmation must preserve input text through input handler.',
)
assert(
  /supabase\.functions\.invoke\('restore-center-admin-access'/.test(main) &&
    /canLiveRestoreInternalAccount\([\s\S]*isInternalAccountLiveAllowedCenter\(target\.centerId\)/.test(main),
  'After C7.8G, live restore implementation must remain gated to the Phong Trong allowlist.',
)

;[
  '.internal-account-revoke-modal',
  'position: fixed',
  'place-items: center',
  '.internal-account-revoke-window',
  'max-height: min(760px, calc(100vh - 44px))',
  '.internal-account-actions button:not(:disabled)',
  'cursor: pointer',
  '.internal-account-revoke:not(:disabled):hover',
  '.internal-account-revoke:not(:disabled):focus-visible',
  '.internal-account-revoke-close',
  '.internal-account-restore-placeholder',
].forEach((marker) => assertIncludes(styles, marker))

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

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8E.1 revoke window restore UX polish smoke: PASS')
