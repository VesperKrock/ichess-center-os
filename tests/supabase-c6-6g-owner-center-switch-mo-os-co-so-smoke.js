import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6g-owner-center-switch-mo-os-co-so.md')
const mainPath = path.join(root, 'src', 'main.js')
const stylesPath = path.join(root, 'src', 'styles.css')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function assertNotIncludes(content, needle, label = needle) {
  assert(!content.includes(needle), `Unexpected ${label}`)
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath)
  const forbidden = [
    [0x0043, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x0192].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x2020, 0x00c2, 0x00b0].map((code) => String.fromCharCode(code)).join(''),
    [0x0048, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    '\uFFFD',
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'C6.6G docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C6.6G STATUS: OWNER CENTER SWITCH MO OS CO SO',
  'C6_6F_STATUS: PASS',
  'PHONG_TRONG_CREATED_BY_USER: YES',
  'OWNER_CENTER_SWITCH_IMPLEMENTED: YES',
  'CENTER_SWITCH_ACTION_LABEL: Mở OS cơ sở',
  'OWNER_ONLY_CENTER_SWITCH: YES',
  'CENTER_SWITCH_REQUIRES_ACTIVE_MEMBERSHIP: YES',
  'CENTER_SWITCH_IS_ACTING_MODE: NO',
  'ACTING_MODE_IMPLEMENTED: NO',
  'ACTING_MODE_DEFERRED_TO_C7_4: YES',
  'PHONG_TRONG_OPEN_OS_DESIGNED_OR_IMPLEMENTED: YES',
  'PHONG_TRONG_CENTER_ID: phongtrong_prod',
  'PHONG_TRONG_EMPTY_DATA_EXPECTED: YES',
  'DREAMHOME_OPEN_OS_PRESERVED: YES',
  'STAGING_DREAMHOME_HIDDEN_BY_DEFAULT: YES',
  'CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'ADMIN_ACCOUNT_CREATION_IMPLEMENTED: NO',
  'TEACHER_ACCOUNT_CREATION_IMPLEMENTED: NO',
  'ACCOUNT_MANAGEMENT_DEFERRED_TO_C7: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'RPC_CALLED_BY_CODEX: NO',
  'AUTH_USER_CREATED: NO',
  'CENTER_CREATED_BY_CODEX: NO',
  'MEMBERSHIP_CREATED_BY_CODEX: NO',
  'RUNTIME_CHANGE: YES',
  'RUNTIME_CHANGE_SCOPE: OWNER_CENTER_SWITCH_ONLY',
  'C6_6H_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.6G',
  '## 2. Trạng thái sau C6.6F',
  '## 3. Runtime changes summary',
  '## 4. Center switch definition',
  '## 5. Center switch khác acting mode',
  '## 6. Owner-only access',
  '## 7. `Mở OS cơ sở` action',
  '## 8. Active center binding behavior',
  '## 9. Cloud/localStorage namespace behavior',
  '## 10. Phòng Trống expected empty behavior',
  '## 11. DreamHome still available',
  '## 12. Staging hidden by default',
  '## 13. Manual QA owner mở Phòng Trống',
  '## 14. Manual QA owner quay lại DreamHome',
  '## 15. Regression center_admin/signed-out',
  '## 16. Account/admin/teacher deferred C7',
  '## 17. Risk list',
  '## 18. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'Center switch là việc user đang đăng nhập chọn một center mà chính user có active membership.',
  'Center switch không phải acting mode.',
  'không bypass permission',
  'không đổi user',
  'production empty center',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'Mở OS cơ sở',
  'data-internal-open-center-id',
  'handleInternalOpenCenter',
  'canOpenInternalCenter',
  'getActiveMembershipForInternalCenter',
  'access.isOwner',
  "center.environment === 'production'",
  "center.status === 'active'",
  'setCurrentStorageCenterId(normalizedCenterId)',
  'reloadLocalDataForResolvedCenter({ useSampleFallback: false })',
  'resetCloudRuntimeStateForOwnerCenterSwitch',
  'bootstrapCoreCloudDataForCurrentCenter(switchSyncId)',
  'loadCurrentMonthCloudAttachments(switchSyncId)',
  'startStudentRealtimeSubscription(switchSyncId)',
  'startC52TuitionRealtimeSubscription(switchSyncId)',
].forEach((needle) => assertIncludes(main, needle))

assertIncludes(styles, '.internal-centers-open')

assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate centers')
assert(!/\.from\("centers"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate centers')
assert(!/\.from\('center_members'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate center_members')
assert(!/\.from\("center_members"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate center_members')

assert(!/provision_center_for_owner[\s\S]{0,300}handleInternalOpenCenter/i.test(main), 'open center must not call create-center RPC')
assert(!/handleInternalOpenCenter[\s\S]{0,600}provision_center_for_owner/i.test(main), 'open center must not call create-center RPC')
assert(!/phongtrong_prod[\s\S]{0,300}handleInternalOpenCenter/i.test(main), 'runtime must not hardcode Phòng Trống switch target')
assert(!/handleInternalOpenCenter[\s\S]{0,600}phongtrong_prod/i.test(main), 'runtime must not hardcode Phòng Trống switch target')

;[
  'acting mode',
  'Acting as',
  'Impersonate',
  'Biến thành admin',
  'username login',
  'Teacher Portal',
  'Super Admin',
].forEach((needle) => assertNotIncludes(main, needle, `runtime ${needle}`))

const changedFiles = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
}).split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))

for (const fileName of changedFiles.filter((fileName) => fileName.startsWith('src/'))) {
  assert(
    ['src/main.js', 'src/styles.css'].includes(fileName),
    `Unexpected runtime file in C6.6G scope: ${fileName}`,
  )
}

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

const allowedNewPaths = new Set([
  'docs/supabase-c6-6g-owner-center-switch-mo-os-co-so.md',
  'tests/supabase-c6-6g-owner-center-switch-mo-os-co-so-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  if (changedPath.includes('c6-6g')) {
    assert(allowedNewPaths.has(changedPath), `Unexpected C6.6G file: ${changedPath}`)
  }
  assert(!/c6-6i|c7|teacher-portal|super-admin/i.test(changedPath), `C6.6G must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C6.6G smoke: PASS')
