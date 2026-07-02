import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-9b-persistent-revoked-restore-state.md')
const mainPath = path.join(root, 'src', 'main.js')
const listFnPath = path.join(root, 'supabase', 'functions', 'list-center-admin-accounts', 'index.ts')
const smokeAPath = path.join(root, 'tests', 'supabase-c7-8a-owner-account-management-ui-readonly-smoke.js')
const smokeBPath = path.join(root, 'tests', 'supabase-c7-8b-owner-account-status-endpoint-ui-wiring-smoke.js')

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

assert(fs.existsSync(docPath), 'C7.9B docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const listFn = readUtf8(listFnPath)
const smokeA = readUtf8(smokeAPath)
const smokeB = readUtf8(smokeBPath)

;[
  'C7.9B STATUS: PERSISTENT REVOKED RESTORE STATE',
  'C7_9A_STATUS: PASS_WITH_LEGACY_SCOPE_NOTE',
  'LIST_CENTER_ADMIN_ACCOUNTS_RETURNS_REVOKED: YES',
  'OWNER_UI_HANDLES_REVOKED_FROM_ENDPOINT: YES',
  'RESTORE_AFTER_RELOAD_SUPPORTED: YES',
  'LOCAL_SNAPSHOT_NO_LONGER_REQUIRED_FOR_RESTORE_AFTER_RELOAD: YES',
  'PHONGTRONG_LIVE_RESTORE_PRESERVED: YES',
  'DREAMHOME_LIVE_RESTORE_ENABLED: NO',
  'DREAMHOME_LIVE_REVOKE_ENABLED: NO',
  'DEV_COPY_REINTRODUCED: NO',
  'RUNTIME_CHANGED: YES',
  'EDGE_FUNCTION_CHANGED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'LIVE_REVOKE_INVOKED_BY_CODEX: NO',
  'LIVE_RESTORE_INVOKED_BY_CODEX: NO',
  'PASSWORD_OR_SECRET_INCLUDED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  ".in('status', ['active', 'revoked'])",
  'getLifecycleAdminMembership',
  'compareMembershipsForLifecycle',
  "membershipStatus === 'revoked'",
  "state: isRevoked ? 'revoked' : adminEmail ? 'active' : 'email_unavailable'",
  'is_active: membershipStatus === \'active\'',
  'is_revoked: isRevoked',
  'can_restore: isRevoked',
  "source: 'center_members'",
].forEach((marker) => assertIncludes(listFn, marker))

assertIncludes(listFn, ".eq('role', 'owner')")
assertIncludes(listFn, ".eq('status', 'active')")
assertIncludes(listFn, "auth.getUser(token)")
assert(!/from\('account_audit_logs'\)\.insert|\.update\(|\.delete\(/.test(listFn), 'list-center-admin-accounts must remain read-only.')
assert(!/temporary_password\s*:|new_password\s*:|password\s*:/.test(listFn), 'Endpoint response must not include credential fields.')

;[
  'normalizeCenterAdminAccount',
  'mergeInternalAccountSnapshots',
  'hasDurableInternalAccountLifecycle',
  'isRevoked',
  'canRestore',
  'adminAccount?.isRevoked',
  'getInternalAccountRecord(center.id)',
  'Khôi phục quyền',
  'Admin này hiện không còn quyền truy cập cơ sở.',
  'Thao tác khôi phục cho cơ sở này chưa được bật.',
].forEach((marker) => assertIncludes(main, marker))

assert(
  /const accountState = mergeInternalAccountSnapshots\(\s*endpointAdminsByCenterId,\s*internalCenterAdminAccountsState\.localAccountSnapshotsByCenterId,\s*\)/.test(main),
  'Runtime must merge endpoint lifecycle before local snapshot fallback.',
)
assert(
  /function getInternalAccountRecord\(centerId\)[\s\S]{0,220}adminsByCenterId\[normalizedCenterId\][\s\S]{0,120}localAccountSnapshotsByCenterId\[normalizedCenterId\]/.test(main),
  'Endpoint account record must take priority over local snapshot fallback.',
)
assert(
  /const restoreEnabled = Boolean\(isRevokedAdmin && adminEmail && canLiveRestoreInternalAccount/.test(main),
  'Restore entry must require revoked state, email, and live allowlist.',
)
assertIncludes(main, "const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])")
assert(!/ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set\([^)]*dreamhome_prod/.test(main), 'DreamHome must not be in live allowlist.')
assertIncludes(main, 'disable_auth_user: false', 'Revoke must keep Auth user enabled internally.')
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

const accountUiStart = main.indexOf('function renderInternalCenterAccountStatusNote()')
const accountUiEnd = main.indexOf('function renderInternalCreateAdminConfirm()')
const accountUi = main.slice(accountUiStart, accountUiEnd)
;[
  'Safety gate',
  'Live test',
  'C7.8',
  'C7.9',
  'disable_auth_user',
  'snapshot',
  'Final action',
].forEach((forbidden) => {
  assert(!accountUi.includes(forbidden), `Owner UI must not reintroduce dev copy: ${forbidden}`)
})

;[
  'docs/supabase-c7-9a-account-lifecycle-readonly-audit.md',
  'docs/supabase-c7-9a-readonly-account-lifecycle-inspection.sql',
  'tests/supabase-c7-9a-account-lifecycle-readonly-audit-smoke.js',
  'docs/supabase-c7-9b-persistent-revoked-restore-state.md',
  'tests/supabase-c7-9b-persistent-revoked-restore-state-smoke.js',
  'supabase/functions/list-center-admin-accounts/index.ts',
].forEach((marker) => {
  assert(smokeA.includes(marker), `C7.8A legacy smoke allowlist must include ${marker}`)
  assert(smokeB.includes(marker), `C7.8B legacy smoke allowlist must include ${marker}`)
})

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(listFnPath)
assertNoMojibake(path.join(root, 'tests', 'supabase-c7-9b-persistent-revoked-restore-state-smoke.js'))

console.log('C7.9B persistent revoked restore state smoke: PASS')
