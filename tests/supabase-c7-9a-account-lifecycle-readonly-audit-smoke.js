import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-9a-account-lifecycle-readonly-audit.md')
const sqlPath = path.join(root, 'docs', 'supabase-c7-9a-readonly-account-lifecycle-inspection.sql')
const mainPath = path.join(root, 'src', 'main.js')
const appAuthPath = path.join(root, 'src', 'app-auth.js')
const appCenterBindingPath = path.join(root, 'src', 'app-center-binding.js')
const cloudStatusPath = path.join(root, 'src', 'cloud-status.js')
const stylesPath = path.join(root, 'src', 'styles.css')
const supabaseAuthPath = path.join(root, 'src', 'supabase-auth.js')
const listFnPath = path.join(root, 'supabase', 'functions', 'list-center-admin-accounts', 'index.ts')
const revokeFnPath = path.join(root, 'supabase', 'functions', 'revoke-center-admin-access', 'index.ts')
const restoreFnPath = path.join(root, 'supabase', 'functions', 'restore-center-admin-access', 'index.ts')
const provisionFnPath = path.join(root, 'supabase', 'functions', 'provision-center-admin-account', 'index.ts')
const resetFnPath = path.join(root, 'supabase', 'functions', 'reset-center-admin-password', 'index.ts')

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
    [0x0050, 0x0068].map((code) => String.fromCharCode(code)).join('') +
      [0x0102].map((code) => String.fromCharCode(code)).join(''),
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
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^([ MADRCU?]{1,2})\s+/, ''))
}

assert(fs.existsSync(docPath), 'C7.9A docs must exist')
assert(fs.existsSync(sqlPath), 'C7.9A readonly SQL inspection must exist')

const docs = readUtf8(docPath)
const sql = readUtf8(sqlPath)
const main = readUtf8(mainPath)
const listFn = readUtf8(listFnPath)
const revokeFn = readUtf8(revokeFnPath)
const restoreFn = readUtf8(restoreFnPath)
const provisionFn = readUtf8(provisionFnPath)
const resetFn = readUtf8(resetFnPath)

;[
  'C7.9A STATUS: ACCOUNT LIFECYCLE READONLY AUDIT',
  'C7_8_OWNER_ACCOUNT_MANAGEMENT_STATUS: DONE',
  'READONLY_AUDIT_ONLY: YES',
  'RUNTIME_CHANGED: NO',
  'EDGE_FUNCTION_CHANGED: NO',
  'SQL_MUTATION_CREATED: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'LIVE_FUNCTION_INVOKED_BY_CODEX: NO',
  'ACCOUNT_CREATED_BY_CODEX: NO',
  'ACCOUNT_RESET_BY_CODEX: NO',
  'ACCOUNT_REVOKED_BY_CODEX: NO',
  'ACCOUNT_RESTORED_BY_CODEX: NO',
  'ACCESS_ENFORCEMENT_AUDITED: YES',
  'OWNER_UI_LIFECYCLE_AUDITED: YES',
  'AUDIT_LOG_READINESS_AUDITED: YES',
  'TEACHER_READINESS_NOTED_FOR_C8: YES',
  'PASSWORD_OR_SECRET_INCLUDED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'active',
  'revoked',
  'restore',
  'Access Enforcement Audit',
  'list-center-admin-accounts',
  'account_audit_logs',
  'Teacher',
  'C8',
  'NEEDS C7.9B',
  'NEEDS C7.9C',
  'NEEDS C7.9D',
].forEach((marker) => assertIncludes(docs, marker))

assertIncludes(sql, 'select')
assertIncludes(sql, 'from public.centers')
assertIncludes(sql, 'from public.center_members')
assertIncludes(sql, 'from public.account_audit_logs')
assertIncludes(sql, 'from pg_policies')
assertIncludes(sql, "cm.status in ('revoked', 'paused', 'disabled', 'banned', 'inactive', 'expired')")
assertIncludes(sql, "'account.provision_center_admin'")
assertIncludes(sql, "'account.reset_center_admin_password'")
assertIncludes(sql, "'account.revoke_center_admin_access'")
assertIncludes(sql, "'account.restore_center_admin_access'")

;[
  /\binsert\b/i,
  /\bupdate\b/i,
  /\bdelete\b/i,
  /\bdrop\b/i,
  /\balter\b/i,
  /\bcreate\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\btruncate\b/i,
].forEach((pattern) => {
  assert(!pattern.test(sql), `Readonly SQL must not contain mutation statement: ${pattern}`)
})

assertIncludes(main, 'resolveActiveCenterMembership(user.id)')
assertIncludes(main, "cloudStatus.membership?.status || ''")
assertIncludes(main, "membershipStatus === 'active'")
assertIncludes(main, 'localAccountSnapshotsByCenterId')
assertIncludes(main, 'delete nextLocalSnapshots[target.centerId]')

assertIncludes(listFn, ".eq('role', 'center_admin')")
assertIncludes(listFn, ".in('status', ['active', 'revoked'])")
assertIncludes(listFn, "state: 'none'")
assertIncludes(listFn, "state: isRevoked ? 'revoked' : adminEmail ? 'active' : 'email_unavailable'")

assertIncludes(provisionFn, "const AUDIT_ACTION = 'account.provision_center_admin'")
assertIncludes(resetFn, "const AUDIT_ACTION = 'account.reset_center_admin_password'")
assertIncludes(revokeFn, "const AUDIT_ACTION = 'account.revoke_center_admin_access'")
assertIncludes(restoreFn, "const AUDIT_ACTION = 'account.restore_center_admin_access'")
;[provisionFn, resetFn, revokeFn, restoreFn].forEach((fnSource) => {
  assertIncludes(fnSource, "from('account_audit_logs')")
  assertIncludes(fnSource, 'request_id')
  assertIncludes(fnSource, 'before_state')
  assertIncludes(fnSource, 'after_state')
})
assertIncludes(revokeFn, "after_state: { membership_status: 'revoked', auth_user_disabled: false }")
assertIncludes(restoreFn, "after_state: { membership_status: 'active', auth_user_disabled: false }")

const allowedPaths = new Set([
  'src/main.js',
  'src/app-auth.js',
  'src/app-center-binding.js',
  'src/cloud-status.js',
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

const allowedRuntimePaths = new Set([
  'src/main.js',
  'src/app-auth.js',
  'src/app-center-binding.js',
  'src/cloud-status.js',
  'src/styles.css',
  'src/supabase-auth.js',
])

for (const changedPath of getStatusPaths()) {
  assert(allowedPaths.has(changedPath), `Unexpected C7.9A/C7.9B changed file: ${changedPath}`)
  assert(
    !changedPath.startsWith('src/') || allowedRuntimePaths.has(changedPath),
    `Only account access runtime may change with C7.9B/C7.9C: ${changedPath}`,
  )
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath === 'supabase/functions/list-center-admin-accounts/index.ts',
    `Only list-center-admin-accounts may change with C7.9B: ${changedPath}`,
  )
}

assertNoMojibake(docPath)
assertNoMojibake(sqlPath)
assertNoMojibake(path.join(root, 'tests', 'supabase-c7-9a-account-lifecycle-readonly-audit-smoke.js'))
assertNoMojibake(appAuthPath)
assertNoMojibake(appCenterBindingPath)
assertNoMojibake(cloudStatusPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)
assertNoMojibake(supabaseAuthPath)

console.log('C7.9A account lifecycle readonly audit smoke: PASS')
