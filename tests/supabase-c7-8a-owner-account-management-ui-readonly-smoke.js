import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-8a-owner-account-management-ui-readonly.md')
const testPath = path.join(root, 'tests', 'supabase-c7-8a-owner-account-management-ui-readonly-smoke.js')
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

assert(fs.existsSync(docPath), 'Docs C7.8A must exist')
assert(fs.existsSync(testPath), 'Smoke C7.8A must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C7.8A STATUS: OWNER ACCOUNT MANAGEMENT UI READONLY',
  'C7_7C_STATUS: PASS',
  'OWNER_FACING_ACCOUNT_UI_ADDED: YES',
  'INTERNAL_CENTER_CONSOLE_UPDATED: YES',
  'READONLY_ONLY: YES',
  'EDGE_FUNCTION_INVOKED: NO',
  'SUPABASE_MUTATION: NO',
  'AUTH_USER_CREATED: NO',
  'PASSWORD_RESET: NO',
  'ACCESS_REVOKED: NO',
  'SERVICE_ROLE_FRONTEND_EXPOSURE: NO',
  'PASSWORD_LONG_TERM_STORAGE: NO',
  'ACTION_BUTTONS_SAFE_DISABLED: YES',
  'COPY_EMAIL_SAFE_ACTION_ALLOWED: YES',
  'RUNTIME_UI_CHANGE: YES',
  'C7_8B_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  '## 3. UI added',
  '## 4. Data source / limitations',
  '## 5. Buttons disabled/coming soon',
  '## 8. C7.8B recommendation',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'Quản lý tài khoản cơ sở',
  'Admin cơ sở',
  'Trạng thái tài khoản',
  'Tạo admin',
  'Tạo mật khẩu tạm mới',
  'Thu hồi quyền',
  'Copy email',
  'Sắp bật',
  'Sẽ được bật ở C7.8B/C7.8C',
  'data-internal-copy-admin-email',
].forEach((marker) => assertIncludes(main, marker))

assert(
  main.includes("from('center_members')") ||
    main.includes("supabase.functions.invoke('list-center-admin-accounts'"),
  'C7.8A account UI must keep a read-only admin account data source.',
)

assertIncludes(styles, '.internal-account-management')
assertIncludes(styles, '.internal-account-card')
assertIncludes(styles, '.internal-account-actions')

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
  'Revoke action must be disabled.',
)

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
assert(!/functions\.invoke\s*\(\s*['"`]revoke-center-admin-access/.test(srcCombined), 'C7.8A-D must not invoke revoke account ops Edge Function.')
assert(!/data-internal-[\w-]*(password|temporary)[\w-]*\s*=/.test(main), 'C7.8A must not add password input/storage data hooks.')

const changedPaths = getStatusPaths()
const allowedPaths = new Set([
  'src/main.js',
  'src/styles.css',
  'docs/supabase-c7-8a-owner-account-management-ui-readonly.md',
  'tests/supabase-c7-8a-owner-account-management-ui-readonly-smoke.js',
  'supabase/config.toml',
  'supabase/functions/list-center-admin-accounts/',
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

  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.8A scope: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath === 'supabase/functions/list-center-admin-accounts/',
    `Only C7.8B read-only status Edge Function is allowed after C7.8A: ${changedPath}`,
  )
}

assertNoMojibake(docPath)
assertNoMojibake(testPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C7.8A owner account management UI readonly smoke: PASS')
