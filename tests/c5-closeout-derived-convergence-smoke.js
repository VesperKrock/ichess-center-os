import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  MODULE_AUTHORITY_REGISTRY,
  evaluateModuleRefreshResults,
  getModuleRefreshContract,
  getModuleRefreshUpstreams,
} from '../src/module-authority-registry.js'
import {
  BROWSER_STORAGE_CLASSIFICATIONS,
  BROWSER_STORAGE_REGISTRY,
  assertNoBrowserBusinessAuthority,
  countBrowserStorageClassifications,
} from '../src/browser-storage-registry.js'
import {
  buildReportDownloadText,
  buildReportPrintHtml,
  getReportDownloadFilename,
} from '../src/report-module.js'
import { buildParentFollowupNotificationCandidates } from '../src/notification-center.js'
import { buildAttendanceRecordCloudEntity } from '../src/cloud-attendance-records.js'
import { pullC51AttendanceSessionReportCloudEntities } from '../src/cloud-attendance-realtime.js'
import {
  buildTuitionRecordPackageCloudEntity,
  pullC52TuitionRecordPackageCloudEntities,
} from '../src/cloud-tuition-record-package-bridge.js'
import { listCloudEntityPayloads } from '../src/cloud-db-sync.js'
import { pullC53CrmSharedTruth } from '../src/cloud-authoritative-crm.js'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex').toUpperCase()
const paths = [
  'src/main.js',
  'src/modules.js',
  'src/module-authority-registry.js',
  'src/browser-storage-registry.js',
  'src/legacy-closeout-preservation.js',
  'src/report-module.js',
  'src/settings-module.js',
  'src/notification-center.js',
]
paths.forEach((path) => assert(existsSync(join(root, path)), `Missing C5 closeout artifact: ${path}`))
const main = read('src/main.js')
const modulesSource = read('src/modules.js')
const reportSource = read('src/report-module.js')
const settingsSource = read('src/settings-module.js')
const storageSource = read('src/storage.js')

assert.equal(MODULE_AUTHORITY_REGISTRY.length, 14)
assert.equal(MODULE_AUTHORITY_REGISTRY.filter((entry) => entry.business).length, 13)
for (const entry of MODULE_AUTHORITY_REGISTRY.filter((item) => item.business)) {
  assert(entry.refreshUpstreams.length > 0, `${entry.moduleId} must have targeted upstream refresh`)
  assert.equal(entry.manualRefresh, true)
  assert.equal(entry.sameCenter, 'AUTHORITATIVE_REFRESH')
  assert.equal(entry.crossCenter, 'EXACT_CENTER_ISOLATED')
}
assert.deepEqual(getModuleRefreshUpstreams('bao-cao'), ['core', 'attendance', 'finance'])
assert.deepEqual(getModuleRefreshUpstreams('cai-dat-co-so'), ['core', 'tuition'])
assert.deepEqual(getModuleRefreshUpstreams('bang-diem-danh'), ['core', 'attendance', 'tuition', 'calendar-notes'])
assert.deepEqual(getModuleRefreshUpstreams('nhom-tai-chinh'), ['finance'])
assert.deepEqual(getModuleRefreshUpstreams('hoc-vien'), ['core-student'])
assert.deepEqual(getModuleRefreshUpstreams('dang-cap-nhat'), [])
assert.deepEqual(getModuleRefreshContract('giao-vien'), {
  required: ['core'],
  optional: ['attendance', 'staff'],
  actionRequired: {},
  all: ['core', 'attendance', 'staff'],
})
assert.deepEqual(getModuleRefreshContract('hoc-phi').actionRequired, {
  payment: ['finance'],
  'collected-balance': ['finance'],
})
assert.deepEqual(
  evaluateModuleRefreshResults('bang-diem-danh', [
    { upstream: 'core', ok: true },
    { upstream: 'attendance', ok: true },
    { upstream: 'tuition', ok: false, outcome_code: 'SCHEMA_NOT_READY' },
    { upstream: 'calendar-notes', ok: false, outcome_code: 'SCHEMA_NOT_READY' },
  ]).status,
  'limited',
)

assert.equal(assertNoBrowserBusinessAuthority().ok, true)
assert.equal(BROWSER_STORAGE_REGISTRY.length, 42)
assert.deepEqual(BROWSER_STORAGE_CLASSIFICATIONS, [
  'ACTIVE_AUTHORITY', 'CACHE_PROJECTION', 'PERSONAL_UI_STATE', 'UNSAVED_DRAFT',
  'FIXTURE_SAMPLE', 'REAL_LOCAL_ONLY', 'UNCERTAIN', 'QUARANTINED_NOT_ACTIVE',
  'DEPRECATED_EMPTY',
])
const storageCounts = countBrowserStorageClassifications()
assert.equal(storageCounts.ACTIVE_AUTHORITY || 0, 0)
assert.equal(storageCounts.CACHE_PROJECTION, 12)
assert.equal(storageCounts.PERSONAL_UI_STATE, 3)
assert.equal(storageCounts.QUARANTINED_NOT_ACTIVE, 27)
const declaredCenterScopes = [...storageSource.matchAll(/createCenterScopedStorageKey\(\s*'([^']+)'/g)]
  .map((match) => match[1])
const registeredCenterPatterns = new Set(BROWSER_STORAGE_REGISTRY.map((item) => item.keyPattern))
for (const scope of declaredCenterScopes) {
  assert(
    registeredCenterPatterns.has(`ichessCenterOS.${scope}.<center>`),
    `Unclassified browser storage scope: ${scope}`,
  )
}

for (const token of [
  'refreshModuleAuthoritativeUpstreams',
  "reason: 'module-open'",
  "reason: 'module-reopen'",
  "reason: 'manual-refresh'",
  'data-module-authoritative-refresh',
  'Thông tin đang hiển thị có thể chưa phải bản mới nhất',
  'getCurrentCanonicalCenterContext()',
  'module-center-context-blocked',
  'refreshNotificationAuthoritativeUpstreams',
  "getStoredNotifications([])",
  'reportState = createInitialReportState()',
]) assert(main.includes(token), `Missing runtime closeout token: ${token}`)
for (const forbidden of [
  'getStoredStudents(sampleStudents)',
  'getStoredTeachers(sampleTeachers)',
  'getStoredClassSessions(sampleClassSessions)',
  'getStoredSchedule(sampleScheduleSessions)',
  'getStoredNotifications(createSampleNotifications())',
  'listLegacyStudentProjections',
]) assert(!main.includes(forbidden), `Fixture may not seed runtime/server path: ${forbidden}`)
assert.equal((modulesSource.match(/status: 'active'/g) || []).length, 13)
assert(!modulesSource.includes("status: 'in-progress'"))
assert(!modulesSource.includes("status: 'planned'"))

const centerInfo = { ok: true, centerId: 'center-a', centerName: 'Cơ sở Alpha' }
const reportOptions = {
  centerInfo,
  filters: { reportDate: '2026-08-20', weekStartDate: '2026-08-17' },
  draft: { ownerName: 'Owner A' },
  students: [], cashflowTransactions: [], attendanceRecords: [],
}
const reportText = buildReportDownloadText(reportOptions)
const printHtml = buildReportPrintHtml(reportOptions)
assert(reportText.includes('Cơ sở Alpha'))
assert(reportText.includes('Mã cơ sở: center-a'))
assert(printHtml.includes('Cơ sở Alpha'))
assert.equal(getReportDownloadFilename('2026-08-20', centerInfo), 'bao-cao-co-so-center-a-2026-08-20.txt')
for (const source of [reportText, printHtml, reportSource, settingsSource]) {
  assert(!source.includes('DreamHome'), 'Report/Settings may not hard-code DreamHome')
  assert(!source.includes('local/cloud/cache'), 'Report may not label cache as its business source')
}
assert(!reportSource.includes('data-report-action="save"'))
assert(!/localStorage|sessionStorage/.test(reportSource), 'Report draft must remain memory-only')

const crmCandidates = buildParentFollowupNotificationCandidates([{
  id: 'crm-1', parentName: 'Parent', consultationStatus: 'newLead', nextAction: 'Call',
}])
assert.equal(crmCandidates[0].sourceModule, 'khach-hang-tu-van')

const queryClient = (rows) => {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    is: () => query,
    order: async () => ({ data: rows, error: null }),
  }
  return { from: () => query }
}
const coreRows = [
  { center_id: 'center-a', entity_type: 'student', local_id: 'student-a', payload: { id: 'student-a' }, entity_version: 1, updated_at: '2026-08-20T00:00:00.000Z', deleted_at: null },
  { center_id: 'center-b', entity_type: 'student', local_id: 'student-b', payload: { id: 'student-b' }, entity_version: 1, updated_at: '2026-08-20T00:00:00.000Z', deleted_at: null },
]
assert.equal((await listCloudEntityPayloads({
  supabase: queryClient(coreRows), centerId: 'center-a', entityType: 'student',
})).outcome_code, 'INVALID_SERVER_RESULT')
assert.equal((await listCloudEntityPayloads({
  supabase: queryClient([{ ...coreRows[0], local_id: 'student-wrong' }]),
  centerId: 'center-a',
  entityType: 'student',
})).outcome_code, 'INVALID_SERVER_RESULT')

const attendanceBuilt = buildAttendanceRecordCloudEntity({
  centerId: 'center-a',
  record: {
    id: 'attendance-a', studentId: 'student-a', date: '2026-08-20', source: 'admin',
    status: 'present', attendanceStatus: 'present', counted: true, creditValue: 1,
  },
})
assert.equal(attendanceBuilt.ok, true)
const attendanceRow = { ...attendanceBuilt.data, entity_version: 1, updated_at: '2026-08-20T00:00:00.000Z' }
assert.equal((await pullC51AttendanceSessionReportCloudEntities({
  supabase: queryClient([attendanceRow, { ...attendanceRow, center_id: 'center-b' }]),
  centerId: 'center-a',
})).outcome_code, 'INVALID_SERVER_RESULT')

const tuitionBuilt = buildTuitionRecordPackageCloudEntity({
  centerId: 'center-a',
  tuitionRecord: { id: 'tuition-a', studentId: 'student-a', packageName: 'Gói A' },
})
assert.equal(tuitionBuilt.ok, true)
const tuitionRow = { ...tuitionBuilt.data, entity_version: 1, updated_at: '2026-08-20T00:00:00.000Z' }
assert.equal((await pullC52TuitionRecordPackageCloudEntities({
  supabase: queryClient([tuitionRow, { ...tuitionRow, center_id: 'center-b' }]),
  centerId: 'center-a',
})).outcome_code, 'INVALID_SERVER_RESULT')

const crmRpcClient = {
  rpc: async () => ({
    data: {
      ok: true,
      outcome_code: 'CRM_SHARED_TRUTH_READ',
      center_id: 'center-a',
      projection_cache_policy: 'MASKED_CACHE_ONLY',
      eligible_consultants: [],
      records: [
        { id: 'lead-a', canonicalCaseId: '11111111-1111-4111-8111-111111111111' },
        { id: '', canonicalCaseId: '' },
      ],
    },
    error: null,
  }),
}
assert.equal((await pullC53CrmSharedTruth({
  supabase: crmRpcClient,
  centerId: 'center-a',
})).outcome_code, 'INVALID_SERVER_RESULT')

assert.equal(
  sha256('supabase/migrations/202608140010_c5_7_calendar_operational_notes_authoritative_shared_truth.sql'),
  'C1C9EACF39548E977CB2C09165CA6AC9DFCD156C4A3EACD4C1951F92933F8167',
)
const migrationStatus = spawnSync(
  'git', ['status', '--porcelain', '--untracked-files=all', '--', 'supabase/migrations'],
  { cwd: root, encoding: 'utf8' },
)
assert.equal(migrationStatus.status, 0)
const allowedPostC5AdditiveMigrations = new Set([
  'supabase/migrations/202608210001_c5_1_dreamhome_schedule_identity_normalization.sql',
  'supabase/migrations/202608210002_ov1_4_tuition_payment_finance_void.sql',
  'supabase/migrations/202608210003_ov1_4_tuition_payment_identity_compatibility_hardening.sql',
])
const changedMigrationPaths = migrationStatus.stdout.trim().split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).replaceAll('\\', '/'))
assert(
  changedMigrationPaths.every((path) => allowedPostC5AdditiveMigrations.has(path)),
  `Inherited migrations must remain byte-immutable: ${changedMigrationPaths.join(', ')}`,
)

console.log('C5_CLOSEOUT_DERIVED_CONVERGENCE_SMOKE: PASS')
