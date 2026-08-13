import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))

const reportPath = 'docs/c5-0-system-wide-shared-source-of-truth-audit.md'
assert(exists(reportPath), 'Missing canonical C5.0 audit report')

const report = read(reportPath)
const modulesSource = read('src/modules.js')
const storageSource = read('src/storage.js')
const mainSource = read('src/main.js')
const cloudDbSource = read('src/cloud-db-sync.js')
const cloudBootstrapSource = read('src/cloud-bootstrap.js')
const attendanceCloudSource = read('src/cloud-attendance-realtime.js')
const tuitionCloudSource = read('src/cloud-tuition-record-package-bridge.js')
const remoteSchema = read('supabase/migrations/20260722000000_remote_schema.sql')
const p4bReport = read('docs/f23-3e-p4b-safe-server-bridge-auth-step-up-conversion-ui-legacy-projection.md')

const includesAll = (content, markers, label) => {
  for (const marker of markers) assert(content.includes(marker), `${label}: ${marker}`)
}

const expectedModules = [
  'hoc-vien', 'khach-hang-tu-van', 'giao-vien', 'nhan-vien', 'thoi-khoa-bieu',
  'hoc-phi', 'nhom-tai-chinh', 'thu-chi', 'so-quy', 'kho-hang', 'bao-cao',
  'cai-dat-co-so', 'bang-diem-danh', 'dang-cap-nhat',
]
const actualModules = [...modulesSource.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1])
assert.deepEqual(actualModules, expectedModules, 'Current public/Admin registry drifted')
includesAll(report, expectedModules, 'Audit does not represent every registry module')

includesAll(report, [
  'C5_0_AUDIT_STATUS: PASS',
  'C5_0_REGISTRY_MODULE_COUNT: 14',
  'C5_0_OPERATIONAL_AUDIT_UNIT_COUNT: 43',
  'C5_0_SHARED_CLOUD_COUNT: 4',
  'C5_0_HYBRID_PARTIAL_COUNT: 13',
  'C5_0_LOCAL_AUTHORITATIVE_COUNT: 17',
  'C5_0_DERIVED_COUNT: 9',
  'C5_0_SYSTEM_SHARED_TRUTH_ACCEPTANCE: FAIL / REMEDIATION REQUIRED',
  'C5_0_REBUILD_FROM_SCRATCH: NO',
  'C5_0_RUNTIME_REMEDIATION: NOT STARTED',
  'F23_3E_P4B_STATUS: FROZEN / MANUAL PRODUCT E2E PENDING / NOT DONE',
], 'Status/count truth missing')

includesAll(report, [
  'A — SHARED / CLOUD AUTHORITATIVE',
  'B — HYBRID / PARTIAL',
  'C — LOCAL AUTHORITATIVE',
  'D — DERIVED',
  'REALTIME', 'REFRESH-ONLY', 'BOOTSTRAP-ONLY', 'NO SHARED SYNC',
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
], 'Classification vocabulary incomplete')

const storageScopes = [
  'students', 'classSessions', 'tuition', 'teachers', 'centerStaffMembers',
  'centerStaffAdministrativeProfiles', 'centerStaffDocuments',
  'centerStaffAdministrativeAuditEvents', 'centerStaffAdministrativeRetentionPolicies',
  'centerStaffAdministrativeDeletionRequests', 'centerDepartments', 'schedule',
  'sessionReports', 'attendanceAdvisoryNotes', 'attendanceBoardNotes',
  'parentConsultations', 'cashflow', 'cashflowCategories', 'cashbookSettings',
  'cashbookReconciliations', 'inventory', 'inventoryMovements', 'inventoryRequests',
]
for (const scope of storageScopes) {
  assert(storageSource.includes(`createCenterScopedStorageKey('${scope}')`) || storageSource.includes(`'${scope}'`), `Storage scope disappeared: ${scope}`)
  assert(report.includes(`ichessCenterOS.${scope}.<center>`), `Audit omitted authoritative/hybrid storage scope: ${scope}`)
}
includesAll(report, [
  'ichessCenterOS.attendanceRecords.<center>',
  'ichessCenterOS.attendanceBaselineState.<center>',
  'ichessCenterOS.centerCalendarItems.<center>',
  'ichessCenterOS.centerCalendarTags.<center>',
  'ichessCenterOS.tuitionPackages.dreamhome',
  'ichess.crmConversionProjection.v1:<center>:<source>',
  'ichess-center-os:view-mode',
  'ichess-center-os:desktop-module-order',
  'ichessCenterOS.notifications.<center>',
  'ichessCenterOS.notifications.version.<center>',
  'ichessCenterOS.notifications.deletedIds.<center>',
], 'Extended LocalStorage/sessionStorage inventory incomplete')

includesAll(mainSource, [
  'reloadLocalDataForResolvedCenter', 'saveStoredParentConsultations',
  'saveStoredCashflow', 'saveStoredCashbookSettings', 'saveStoredInventory',
  'writeStudentThroughCloud', 'writeTeacherThroughCloud', 'writeScheduleSessionThroughCloud',
  'writeC51AttendanceSessionReportThroughCloud', 'writeC52TuitionRecordPackageThroughCloud',
], 'Physical read/write evidence drifted')
includesAll(cloudDbSource, [
  "from('center_cloud_entities')", 'pullCloudBootstrapCoreEntities',
  'pushLocalCoreEntitiesToCloud',
], 'Generic cloud foundation evidence drifted')
const c51Migration = 'supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql'
if (exists(c51Migration)) {
  includesAll(cloudBootstrapSource, [
    "source: 'cache-projection'",
    'CLOUD_BOOTSTRAP_STATUS',
    "ERROR: 'error'",
  ], 'C5.1 durable cache-projection boundary drifted')
} else {
  includesAll(cloudBootstrapSource, ['source: \'local-cache\'', 'CLOUD_BOOTSTRAP_STATUS'], 'C5.0 checkpoint fallback evidence drifted')
}
includesAll(attendanceCloudSource, [
  "ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE", "ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE",
  "SESSION_REPORT_CLOUD_ENTITY_TYPE", ".channel(`ichess-center-attendance-session-report:",
], 'Attendance cloud/realtime evidence drifted')
includesAll(tuitionCloudSource, [
  "TUITION_RECORD_PACKAGE_ENTITY_TYPE", ".channel(`ichess-center-tuition-record-package:",
], 'Tuition cloud/realtime evidence drifted')
includesAll(remoteSchema, [
  'CREATE TABLE public.center_cloud_entities',
  'ALTER PUBLICATION supabase_realtime ADD TABLE public.center_cloud_entities',
  'USING (public.is_center_member(center_id))',
  'WITH CHECK (public.is_center_member(center_id))',
], 'Cloud/RLS evidence drifted')

includesAll(report, [
  'C5-CR1 — CRM identity/enrollment split-brain',
  'C5-CR2 — Finance/cashbook split-brain',
  'C5-CR3 — Attendance/tuition local-first',
  'C5-CR4 — Core Student/Class split-brain',
  'C5-H4 — Server write policy mismatch',
  'CLOUD FOUNDATION EXISTS — PRODUCT WIRING INCOMPLETE',
  'REBUILD FROM SCRATCH: NO',
  'Wave 1 — Authority foundation và core upstream',
  'Wave 2 — CRITICAL transactional domains',
  'Wave 3 — Remaining operational truth',
  'Wave 4 — Derived convergence và system acceptance',
  'C5.1 — AUTHORITATIVE CORE CONTRACT + MULTI-ACCOUNT HARNESS',
  'xóa localStorage không xóa business truth',
  'hai authenticated user khác nhau',
  'hai browser context độc lập cùng center',
  'ít nhất một context khác center',
  'Smoke tài liệu C5.0 không giả vờ thay thế các runtime test đó.',
], 'Finding/remediation/exit contract incomplete')

includesAll(p4bReport, [
  'F23_3E_P4B_MANUAL_PRODUCT_E2E: PAUSED / NOT ACCEPTED',
  'F23_3E_P4B_STATUS: FROZEN / MANUAL PRODUCT E2E PENDING',
  'không phải DONE',
], 'P4B freeze truth drifted')

const c5Files = [
  ...fs.readdirSync(path.join(root, 'docs')).filter((name) => name.startsWith('c5-0-system-wide-shared-source-of-truth-audit'))
    .map((name) => `docs/${name}`),
  ...fs.readdirSync(path.join(root, 'tests')).filter((name) => name.startsWith('c5-0-system-wide-shared-source-of-truth-audit'))
    .map((name) => `tests/${name}`),
].sort()
assert.deepEqual(c5Files, [
  'docs/c5-0-system-wide-shared-source-of-truth-audit.md',
  'tests/c5-0-system-wide-shared-source-of-truth-audit-smoke.js',
], 'C5.0 audit package must contain exactly report + smoke')

for (const content of [report, read('tests/c5-0-system-wide-shared-source-of-truth-audit-smoke.js')]) {
  assert(!content.includes('\uFFFD'), 'Replacement character detected')
  assert(!/\r(?!\n)/.test(content), 'Bare carriage return detected')
  assert(!/^(<{7}|={7}|>{7})/m.test(content), 'Conflict marker detected')
}

console.log('C5.0 system-wide shared source-of-truth audit smoke: PASS')
console.log('14 registry modules / 43 operational units accounted')
console.log('4 shared / 13 hybrid / 17 local-authoritative / 9 derived')
