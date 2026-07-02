import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8b-owner-account-status-endpoint-ui-wiring.md')
const functionPath = path.join(root, 'supabase', 'functions', 'list-center-admin-accounts', 'index.ts')
const denoPath = path.join(root, 'supabase', 'functions', 'list-center-admin-accounts', 'deno.json')
const configPath = path.join(root, 'supabase', 'config.toml')
const mainPath = path.join(root, 'src', 'main.js')
const stylesPath = path.join(root, 'src', 'styles.css')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function getStatusPaths() {
  const status = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'))
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

assert(fs.existsSync(docPath), 'Docs C7.8B must exist')
assert(fs.existsSync(functionPath), 'list-center-admin-accounts function must exist')
assert(fs.existsSync(denoPath), 'list-center-admin-accounts deno config must exist')

const docs = readUtf8(docPath)
const fn = readUtf8(functionPath)
const deno = readUtf8(denoPath)
const config = readUtf8(configPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8B STATUS: OWNER ACCOUNT STATUS ENDPOINT UI WIRING',
  'C7_8A_STATUS: PASS',
  'C7_8A_MANUAL_QA_RESULT: UI_SHELL_PASS_ADMIN_DATA_NOT_LOADED',
  'LIST_CENTER_ADMIN_ACCOUNTS_FUNCTION_CREATED: YES',
  'LIST_CENTER_ADMIN_ACCOUNTS_READONLY: YES',
  'OWNER_GUARD_IMPLEMENTED: YES',
  'SERVICE_ROLE_SERVER_SIDE_ONLY: YES',
  'SERVICE_ROLE_FRONTEND_EXPOSURE: NO',
  'FRONTEND_ACCOUNT_STATUS_WIRED: YES',
  'ADMIN_EMAIL_DISPLAY_FROM_ENDPOINT: YES',
  'COPY_EMAIL_SAFE_ACTION_ALLOWED: YES',
  'ACTION_BUTTONS_SAFE_DISABLED: YES',
  'EDGE_FUNCTION_MUTATION: NO',
  'AUTH_USER_CREATED: NO',
  'PASSWORD_RESET: NO',
  'ACCESS_REVOKED: NO',
  'PASSWORD_LONG_TERM_STORAGE: NO',
  'RUNTIME_UI_CHANGE: YES',
  'C7_8C_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  '## 1. Bối cảnh C7.8A manual QA',
  '## 3. Function list-center-admin-accounts',
  '## 11. C7.8C recommendation',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'Deno.serve',
  "Deno.env.get('SUPABASE_URL')",
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  'Authorization: `Bearer ${serviceRoleKey}`',
  'persistSession: false',
  'autoRefreshToken: false',
  'adminClient.auth.getUser(token)',
  ".from('center_members')",
  ".eq('user_id', actorUser.id)",
  ".eq('role', 'owner')",
  ".eq('status', 'active')",
  ".from('centers')",
  ".eq('environment', 'production')",
  ".eq('role', 'center_admin')",
  'adminClient.auth.admin.getUserById(userId)',
  'center_admin_accounts_loaded',
  'multiple_active_admins',
  'forbidden_client_fields',
].forEach((marker) => assertIncludes(fn, marker))

assertIncludes(deno, '"@supabase/supabase-js": "npm:@supabase/supabase-js@2"')
assertIncludes(config, '[functions.list-center-admin-accounts]')
assertIncludes(config, 'verify_jwt = true')

assert(!/\.insert\s*\(/.test(fn), 'C7.8B read-only function must not insert data.')
assert(!/\.update\s*\(/.test(fn), 'C7.8B read-only function must not update data.')
assert(!/\.upsert\s*\(/.test(fn), 'C7.8B read-only function must not upsert data.')
assert(!/\.delete\s*\(/.test(fn), 'C7.8B read-only function must not delete data.')
assert(!/auth\.admin\.createUser\s*\(/.test(fn), 'C7.8B function must not create auth users.')
assert(!/auth\.admin\.updateUserById\s*\(/.test(fn), 'C7.8B function must not update auth users.')
assert(!/auth\.admin\.deleteUser\s*\(/.test(fn), 'C7.8B function must not delete auth users.')

;[
  "supabase.functions.invoke('list-center-admin-accounts'",
  'center_admin_accounts_loaded',
  'Đang tải...',
  'Đang tải dữ liệu tài khoản',
  'Không tải được dữ liệu tài khoản',
  'Đã có admin',
  'Cần tạo tài khoản',
  'Chưa có email admin để copy',
  'data-internal-copy-admin-email',
  'navigator.clipboard.writeText(email)',
  'Tạo admin',
  'Tạo mật khẩu tạm mới',
  'Thu hồi quyền',
  'Sắp bật',
  "supabase.functions.invoke('reset-center-admin-password'",
].forEach((marker) => assertIncludes(main, marker))

assert(
  /data-internal-copy-admin-email="\$\{escapeAttribute\(adminEmail\)\}"[\s\S]{0,180}\$\{adminEmail \? '' : 'disabled'\}/.test(main),
  'Copy email must be disabled when adminEmail is empty.',
)
assert(
  /if \(!email\) \{[\s\S]{0,220}Chưa có email admin để copy/.test(main),
  'Copy email handler must no-op safely without email.',
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
  /const resetEnabled = Boolean\(hasAdmin && adminEmail\)/.test(main),
  'After C7.8C, reset temporary password action must only enable for cards with admin email.',
)
assert(
  /<button type="button" disabled title="Sẽ được bật ở C7\.8B\/C7\.8C">Thu hồi quyền/.test(main),
  'Revoke action must remain disabled.',
)

assertIncludes(styles, '.internal-account-copy-message')

const sourceFiles = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((filePath) => path.join(root, filePath))
const srcCombined = sourceFiles.map(readUtf8).join('\n')

assert(!srcCombined.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend src must not expose service role env key.')
assert(!srcCombined.includes('service_role'), 'Frontend src must not reference service_role.')
assert(!srcCombined.includes('auth.admin'), 'Frontend src must not use auth.admin.')
assert(
  !/localStorage[\s\S]{0,160}temporary_password|temporary_password[\s\S]{0,160}localStorage/.test(srcCombined),
  'Frontend src must not persist temporary_password to localStorage.',
)
assert(
  !/sessionStorage[\s\S]{0,160}temporary_password|temporary_password[\s\S]{0,160}sessionStorage/.test(srcCombined),
  'Frontend src must not persist temporary_password to sessionStorage.',
)
assert(!/createUser|updateUserById|deleteUser/.test(srcCombined), 'Frontend src must not call Auth Admin account mutation APIs.')
assert(!/functions\.invoke\s*\(\s*['"`]revoke-center-admin-access/.test(srcCombined), 'C7.8B-D must not invoke revoke Edge Function.')

const changedPaths = getStatusPaths()
const allowedPaths = new Set([
  'src/main.js',
  'src/styles.css',
  'supabase/config.toml',
  'supabase/functions/list-center-admin-accounts/',
  'docs/supabase-c7-8a-owner-account-management-ui-readonly.md',
  'tests/supabase-c7-8a-owner-account-management-ui-readonly-smoke.js',
  'docs/supabase-c7-8b-owner-account-status-endpoint-ui-wiring.md',
  'tests/supabase-c7-8b-owner-account-status-endpoint-ui-wiring-smoke.js',
  'docs/supabase-c7-8c-wire-reset-password-button-handoff-ui.md',
  'tests/supabase-c7-8c-wire-reset-password-button-handoff-ui-smoke.js',
  'docs/supabase-c7-8c-1-fix-account-management-scroll-jump.md',
  'tests/supabase-c7-8c-1-fix-account-management-scroll-jump-smoke.js',
  'docs/supabase-c7-8d-wire-create-admin-button-handoff-ui.md',
  'tests/supabase-c7-8d-wire-create-admin-button-handoff-ui-smoke.js',
])

for (const changedPath of changedPaths) {
  if (changedPath === 'readmepl.txt') {
    continue
  }

  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.8B scope: ${changedPath}`)
  assert(!/sql$/i.test(changedPath), `C7.8B must not add SQL apply files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(functionPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8B owner account status endpoint UI wiring smoke: PASS')
