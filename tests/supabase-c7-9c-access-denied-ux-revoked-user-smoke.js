import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-9c-access-denied-ux-revoked-user.md')
const appAuthPath = path.join(root, 'src', 'app-auth.js')
const appCenterBindingPath = path.join(root, 'src', 'app-center-binding.js')
const cloudStatusPath = path.join(root, 'src', 'cloud-status.js')
const mainPath = path.join(root, 'src', 'main.js')
const stylesPath = path.join(root, 'src', 'styles.css')
const supabaseAuthPath = path.join(root, 'src', 'supabase-auth.js')

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

function getStatusPaths() {
  const output = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'))
}

assert(fs.existsSync(docPath), 'C7.9C docs must exist')

const docs = readUtf8(docPath)
const appAuth = readUtf8(appAuthPath)
const appCenterBinding = readUtf8(appCenterBindingPath)
const cloudStatus = readUtf8(cloudStatusPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)
const supabaseAuth = readUtf8(supabaseAuthPath)

;[
  'C7.9C STATUS: ACCESS DENIED UX REVOKED USER',
  'C7_9B_STATUS: PASS',
  'SIGNED_IN_NO_ACTIVE_MEMBERSHIP_BLOCKED: YES',
  'REVOKED_USER_ACCESS_DENIED_UI: YES',
  'PAUSED_USER_ACCESS_DENIED_UI: YES',
  'NO_MEMBERSHIP_ACCESS_DENIED_UI: YES',
  'DASHBOARD_RENDER_BLOCKED_WHEN_DENIED: YES',
  'CLOUD_BOOTSTRAP_BLOCKED_WHEN_DENIED: YES',
  'LOGOUT_FROM_DENIED_UI: YES',
  'OWNER_ACTIVE_FLOW_PRESERVED: YES',
  'CENTER_ADMIN_ACTIVE_FLOW_PRESERVED: YES',
  'DEV_COPY_REINTRODUCED: NO',
  'RUNTIME_CHANGED: YES',
  'EDGE_FUNCTION_CHANGED: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'LIVE_REVOKE_INVOKED_BY_CODEX: NO',
  'LIVE_RESTORE_INVOKED_BY_CODEX: NO',
  'PASSWORD_OR_SECRET_INCLUDED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'renderAccessDeniedState',
  'Không có quyền truy cập',
  'Quyền truy cập của tài khoản này đã được thu hồi.',
  'Quyền truy cập của tài khoản này đang tạm dừng.',
  'Tài khoản này chưa được cấp quyền truy cập cơ sở.',
  'data-cloud-action="logout"',
  'Đăng xuất',
].forEach((marker) => assertIncludes(appAuth, marker))

const deniedUiStart = appAuth.indexOf('function renderAccessDeniedState')
const deniedUiEnd = appAuth.indexOf('function getAuthStatusText')
const deniedUi = appAuth.slice(deniedUiStart, deniedUiEnd)
;['revoked-only', 'membership_status', 'center_members', 'auth.uid', 'RLS', 'C7.9C'].forEach(
  (forbidden) => {
    assert(!deniedUi.includes(forbidden), `Access denied UI must not show dev copy: ${forbidden}`)
  },
)

assertIncludes(supabaseAuth, 'export async function listCenterMemberships')
assertIncludes(supabaseAuth, ".select('center_id, role, status')")
assertIncludes(supabaseAuth, 'function getAccessDeniedReason')
assertIncludes(supabaseAuth, "status: 'denied'")
assertIncludes(supabaseAuth, 'accessDeniedReason')
assertIncludes(supabaseAuth, "return 'revoked'")
assertIncludes(supabaseAuth, "return 'paused'")
assertIncludes(supabaseAuth, "return 'no_membership'")

const listCenterMembershipsStart = supabaseAuth.indexOf('export async function listCenterMemberships')
const listCenterMembershipsEnd = supabaseAuth.indexOf('function getAccessDeniedReason')
const listCenterMemberships = supabaseAuth.slice(listCenterMembershipsStart, listCenterMembershipsEnd)
assert(!listCenterMemberships.includes(".eq('status', 'active')"), 'Denied resolver must inspect non-active memberships.')

assertIncludes(appCenterBinding, "status: 'denied'")
assertIncludes(appCenterBinding, "source: 'access-denied-membership'")
assertIncludes(appCenterBinding, 'deniedMemberships')
assertIncludes(appCenterBinding, 'deniedReason')

assertIncludes(cloudStatus, 'deniedMemberships: []')
assertIncludes(cloudStatus, "accessDeniedReason: ''")

assertIncludes(main, "'denied'")
assertIncludes(main, "membershipStatus: 'denied'")
assertIncludes(main, 'deniedMemberships')
assertIncludes(main, 'accessDeniedReason')
assertIncludes(main, 'stopStudentRealtimeSubscription()')
assertIncludes(main, 'stopTeacherRealtimeSubscription()')
assertIncludes(main, 'stopScheduleSessionRealtimeSubscription()')
assertIncludes(main, 'stopC51AttendanceRealtimeSubscription()')
assertIncludes(main, 'stopC52TuitionRealtimeSubscription()')
assertIncludes(main, "cloudDbState = createInitialCloudDbState()")
assertIncludes(main, "cloudBootstrapState = createInitialCloudBootstrapState()")
assertIncludes(main, "isLoginGateOpen ? '' :")
assertIncludes(main, 'renderDashboard()')
assertIncludes(main, "isLoginGateOpen || isInternalCentersRoute ? '' : renderTaskbar()")

const resolveIndex = main.indexOf('const resolvedMembership = await resolveActiveCenterMembership(user.id)')
const deniedIndex = main.indexOf('if (resolvedMembership.ok)', resolveIndex)
const bootstrapIndex = main.indexOf('await bootstrapCoreCloudDataForCurrentCenter(syncId)', resolveIndex)
const deniedBlock = main.slice(deniedIndex, bootstrapIndex)
assert(deniedIndex > -1 && bootstrapIndex > -1, 'syncCloudUser must resolve membership before bootstrap.')
assertIncludes(deniedBlock, 'membershipStatus: \'denied\'')
assertIncludes(deniedBlock, 'render()')
assertIncludes(deniedBlock, 'return')
assert(
  deniedBlock.indexOf("membershipStatus: 'denied'") < deniedBlock.indexOf('return'),
  'Denied membership must render and return before cloud bootstrap.',
)

assertIncludes(styles, '.app-auth-access-denied')
assertIncludes(styles, '.app-auth-access-denied-actions')

const frontendCombined = [appAuth, appCenterBinding, cloudStatus, main, supabaseAuth].join('\n')
assert(!frontendCombined.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend must not expose service role key.')
assert(!frontendCombined.includes('service_role'), 'Frontend must not reference service_role.')
assert(!frontendCombined.includes('auth.admin'), 'Frontend must not use auth.admin.')
assert(
  !/localStorage[\s\S]{0,180}temporary_password|temporary_password[\s\S]{0,180}localStorage/.test(frontendCombined),
  'Runtime must not persist temporary_password to localStorage.',
)
assert(
  !/sessionStorage[\s\S]{0,180}temporary_password|temporary_password[\s\S]{0,180}sessionStorage/.test(frontendCombined),
  'Runtime must not persist temporary_password to sessionStorage.',
)

const allowedPaths = new Set([
  'src/app-auth.js',
  'src/app-center-binding.js',
  'src/cloud-status.js',
  'src/main.js',
  'src/styles.css',
  'src/supabase-auth.js',
  'supabase/functions/list-center-admin-accounts/index.ts',
  'tests/supabase-c7-8a-owner-account-management-ui-readonly-smoke.js',
  'tests/supabase-c7-8b-owner-account-status-endpoint-ui-wiring-smoke.js',
  'docs/supabase-c7-9a-account-lifecycle-readonly-audit.md',
  'docs/supabase-c7-9a-readonly-account-lifecycle-inspection.sql',
  'tests/supabase-c7-9a-account-lifecycle-readonly-audit-smoke.js',
  'docs/supabase-c7-9b-persistent-revoked-restore-state.md',
  'tests/supabase-c7-9b-persistent-revoked-restore-state-smoke.js',
  'docs/supabase-c7-9c-access-denied-ux-revoked-user.md',
  'tests/supabase-c7-9c-access-denied-ux-revoked-user-smoke.js',
])

for (const changedPath of getStatusPaths()) {
  assert(allowedPaths.has(changedPath), `Unexpected C7.9C changed file: ${changedPath}`)
  assert(!changedPath.endsWith('.sql') || changedPath.includes('readonly'), `C7.9C must not add SQL apply files: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath === 'supabase/functions/list-center-admin-accounts/index.ts',
    `C7.9C must not add or modify live Edge Functions: ${changedPath}`,
  )
}

;[
  docPath,
  appAuthPath,
  appCenterBindingPath,
  cloudStatusPath,
  mainPath,
  stylesPath,
  supabaseAuthPath,
  path.join(root, 'tests', 'supabase-c7-9c-access-denied-ux-revoked-user-smoke.js'),
].forEach(assertNoMojibake)

console.log('C7.9C access denied UX revoked user smoke: PASS')
