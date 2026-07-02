import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const paths = {
  mainDoc: path.join(root, 'docs', 'supabase-c7-8f-controlled-live-revoke-restore-phongtrong.md'),
  grantSql: path.join(root, 'docs', 'supabase-c7-8f-manual-apply-service-role-update-grant.sql'),
  preflightSql: path.join(root, 'docs', 'supabase-c7-8f-readonly-preflight-phongtrong-revoke.sql'),
  postRevokeSql: path.join(root, 'docs', 'supabase-c7-8f-readonly-post-revoke-verify.sql'),
  postRestoreSql: path.join(root, 'docs', 'supabase-c7-8f-readonly-post-restore-verify.sql'),
  revokeScript: path.join(root, 'docs', 'supabase-c7-8f-browser-invoke-revoke-phongtrong.js'),
  restoreScript: path.join(root, 'docs', 'supabase-c7-8f-browser-invoke-restore-phongtrong.js'),
  restoreFn: path.join(root, 'supabase', 'functions', 'restore-center-admin-access', 'index.ts'),
  restoreDeno: path.join(root, 'supabase', 'functions', 'restore-center-admin-access', 'deno.json'),
  revokeFn: path.join(root, 'supabase', 'functions', 'revoke-center-admin-access', 'index.ts'),
  config: path.join(root, 'supabase', 'config.toml'),
  main: path.join(root, 'src', 'main.js'),
  eDoc: path.join(root, 'docs', 'supabase-c7-8e-revoke-access-ui-safety-gate.md'),
  e1Doc: path.join(root, 'docs', 'supabase-c7-8e-1-revoke-window-restore-ux-polish.md'),
}

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

for (const [label, filePath] of Object.entries(paths)) {
  assert(fs.existsSync(filePath), `Expected ${label} file to exist`)
}

const mainDoc = readUtf8(paths.mainDoc)
const grantSql = readUtf8(paths.grantSql)
const preflightSql = readUtf8(paths.preflightSql)
const postRevokeSql = readUtf8(paths.postRevokeSql)
const postRestoreSql = readUtf8(paths.postRestoreSql)
const revokeScript = readUtf8(paths.revokeScript)
const restoreScript = readUtf8(paths.restoreScript)
const restoreFn = readUtf8(paths.restoreFn)
const revokeFn = readUtf8(paths.revokeFn)
const config = readUtf8(paths.config)
const main = readUtf8(paths.main)
const eDoc = readUtf8(paths.eDoc)
const e1Doc = readUtf8(paths.e1Doc)

;[
  'C7.8F STATUS: CONTROLLED LIVE REVOKE RESTORE PACK',
  'TARGET_CENTER_ID: phongtrong_prod',
  'TARGET_ADMIN_EMAIL: admin.phongtrong@ichess.vn',
  'DREAMHOME_PROTECTED: YES',
  'REVOKE_FUNCTION_REVIEWED: YES',
  'RESTORE_FUNCTION_ADDED_OR_CONFIRMED: YES',
  'SERVICE_ROLE_UPDATE_GRANT_SQL_CREATED: YES',
  'PREFLIGHT_SQL_CREATED: YES',
  'POST_REVOKE_VERIFY_SQL_CREATED: YES',
  'POST_RESTORE_VERIFY_SQL_CREATED: YES',
  'BROWSER_REVOKE_SCRIPT_CREATED: YES',
  'BROWSER_RESTORE_SCRIPT_CREATED: YES',
  'DISABLE_AUTH_USER_ALLOWED: NO',
  'HARD_DELETE_ALLOWED: NO',
  'PASSWORD_OR_SECRET_INCLUDED: NO',
  'UI_LIVE_REVOKE_FLAG_ENABLED: NO',
  'CODEX_APPLIED_SQL: NO',
  'CODEX_DEPLOYED_FUNCTIONS: NO',
  'CODEX_INVOKED_REVOKE: NO',
  'CODEX_INVOKED_RESTORE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(mainDoc, marker))

assertIncludes(grantSql, 'grant select, insert, update on public.center_members to service_role')
assertIncludes(grantSql, 'grant select, insert on public.account_audit_logs to service_role')
assertIncludes(grantSql, 'information_schema.table_privileges')

;[preflightSql, postRevokeSql, postRestoreSql].forEach((sql) => {
  assertIncludes(sql, 'phongtrong_prod')
  assertIncludes(sql, 'admin.phongtrong@ichess.vn')
  const sqlWithoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  assert(!/^\s*(update|insert|delete|drop|alter|grant|revoke)\b/im.test(sqlWithoutComments), 'Readonly verify SQL must not mutate data.')
})

assertIncludes(postRevokeSql, 'account.revoke_center_admin_access')
assertIncludes(postRestoreSql, 'account.restore_center_admin_access')
assertIncludes(postRevokeSql, 'admin.dreamhome@ichess.vn')
assertIncludes(postRestoreSql, 'admin.dreamhome@ichess.vn')

;[
  revokeScript,
  restoreScript,
].forEach((script) => {
  assertIncludes(script, 'phongtrong_prod')
  assertIncludes(script, 'admin.phongtrong@ichess.vn')
  assert(!script.includes('admin.dreamhome@ichess.vn'), 'Browser scripts must not target DreamHome.')
  assert(!script.includes('password'), 'Browser scripts must not include password fields.')
})

assertIncludes(revokeScript, "disable_auth_user: false")
assertIncludes(revokeScript, "fetch('https://zahcfnpaprbnuqpegdmo.supabase.co/functions/v1/revoke-center-admin-access'")
assertIncludes(restoreScript, "fetch('https://zahcfnpaprbnuqpegdmo.supabase.co/functions/v1/restore-center-admin-access'")

assertIncludes(restoreFn, 'account.restore_center_admin_access')
assertIncludes(restoreFn, "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")
assertIncludes(restoreFn, "adminClient.auth.getUser(token)")
assertIncludes(restoreFn, ".eq('role', 'owner')")
assertIncludes(restoreFn, ".eq('status', 'active')")
assertIncludes(restoreFn, ".in('status', ['revoked', 'paused'])")
assertIncludes(restoreFn, ".update({ status: 'active' })")
assertIncludes(restoreFn, "code: 'center_admin_access_restored'")
assertIncludes(restoreFn, 'forbidden_client_fields')
assertIncludes(revokeFn, 'account.revoke_center_admin_access')
assertIncludes(revokeFn, "disable_auth_user")
assertIncludes(revokeFn, "auth_disable_not_implemented")

const combinedServer = `${restoreFn}\n${revokeFn}`
assert(!/\bdelete\s+from\s+public\.center_members\b/i.test(combinedServer), 'Functions must not hard delete center_members.')
assert(!/auth\.admin\.deleteUser\s*\(/.test(combinedServer), 'Functions must not hard delete Auth users.')
assert(!/disable_auth_user:\s*true/.test(`${combinedServer}\n${revokeScript}\n${restoreScript}`), 'C7.8F must not enable auth disable.')
assert(!/updateUserById\s*\([^)]*ban_duration|ban_duration/i.test(combinedServer), 'C7.8F must not ban Auth users.')

assertIncludes(config, '[functions.restore-center-admin-access]')
assertIncludes(config, 'verify_jwt = true')
assertIncludes(readUtf8(paths.restoreDeno), '"@supabase/supabase-js": "npm:@supabase/supabase-js@2"')

assertIncludes(main, "const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])")
assert(!/ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS[\s\S]{0,120}dreamhome_prod/.test(main), 'DreamHome must not be in live account access allowlist.')
assert(!main.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend must not expose service role key.')
assert(!main.includes('service_role'), 'Frontend must not reference service_role.')
assert(!main.includes('auth.admin'), 'Frontend must not use auth.admin.')

assertIncludes(eDoc, 'C7.8E STATUS: REVOKE ACCESS UI SAFETY GATE')
assertIncludes(e1Doc, 'C7.8E.1 STATUS: REVOKE WINDOW UX POLISH')

;[
  paths.mainDoc,
  paths.grantSql,
  paths.preflightSql,
  paths.postRevokeSql,
  paths.postRestoreSql,
  paths.revokeScript,
  paths.restoreScript,
  paths.restoreFn,
  paths.config,
  paths.main,
].forEach(assertNoMojibake)

console.log('C7.8F controlled live revoke restore Phong Trong smoke: PASS')
