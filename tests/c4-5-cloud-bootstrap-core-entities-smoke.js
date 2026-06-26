import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  CLOUD_BOOTSTRAP_ENTITY_TYPES,
  canRunCloudBootstrap,
  createEmptyCloudBootstrapCounts,
  getCloudBootstrapSnapshotCounts,
  hasCloudBootstrapSnapshotData,
} from '../src/cloud-bootstrap.js'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/cloud-bootstrap-c4-5-core-entities.md'
const smokePath = 'tests/c4-5-cloud-bootstrap-core-entities-smoke.js'
const bootstrapPath = 'src/cloud-bootstrap.js'
const mainPath = 'src/main.js'
const cloudDbSyncPath = 'src/cloud-db-sync.js'
const appAuthPath = 'src/app-auth.js'
const loginGatePath = 'src/app-login-gate.js'
const centerBindingPath = 'src/app-center-binding.js'

for (const filePath of [docPath, smokePath, bootstrapPath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.5 artifact: ${filePath}`)
}

const doc = read(docPath)
const smoke = read(smokePath)
const bootstrap = read(bootstrapPath)
const main = read(mainPath)
const cloudDbSync = read(cloudDbSyncPath)
const appAuth = read(appAuthPath)
const loginGate = read(loginGatePath)
const centerBinding = read(centerBindingPath)
const runtimeSources = [main, appAuth, loginGate, centerBinding, bootstrap, cloudDbSync].join('\n')

for (const term of [
  'C4.5 thêm cloud bootstrap guarded',
  'Cloud Bootstrap Core Entities',
  'signed-in + center binding ready + cloud configured',
  'student',
  'teacher',
  'schedule_session',
  'cloud là source of truth',
  'localStorage chỉ là cache/fallback',
  'Cloud chưa có dữ liệu cho center này. Đang dùng cache/staging local.',
  'Không thể tải dữ liệu cloud. Đang dùng cache cục bộ.',
  'không chạy SQL',
  'không seed cloud',
  'không claim live T/P pass',
  'Gói 29 học viên từ C4.4 vẫn là staging fallback',
  'C4.6',
  'C4.7',
]) {
  assert(doc.includes(term), `C4.5 doc missing term: ${term}`)
}

assert.deepEqual(CLOUD_BOOTSTRAP_ENTITY_TYPES, ['student', 'teacher', 'schedule_session'])
assert.deepEqual(createEmptyCloudBootstrapCounts(), {
  student: 0,
  teacher: 0,
  schedule_session: 0,
})
assert.equal(
  canRunCloudBootstrap({
    authStatus: 'signed-in',
    user: { id: 'u1' },
    centerBinding: { status: 'bound', currentCenterId: 'dreamhome' },
    configStatus: 'configured',
  }),
  true,
)
assert.equal(
  canRunCloudBootstrap({
    authStatus: 'signed-out',
    user: null,
    centerBinding: { status: 'signed-out', currentCenterId: '' },
    configStatus: 'configured',
  }),
  false,
)
assert.equal(
  canRunCloudBootstrap({
    authStatus: 'signed-in',
    user: { id: 'u1' },
    centerBinding: { status: 'error', currentCenterId: '' },
    configStatus: 'configured',
  }),
  false,
)
assert.deepEqual(
  getCloudBootstrapSnapshotCounts({
    students: [{ id: 's1' }],
    teachers: [{ id: 't1' }],
    scheduleSessions: [{ id: 'sc1' }],
  }),
  { student: 1, teacher: 1, schedule_session: 1 },
)
assert.equal(hasCloudBootstrapSnapshotData({ students: [], teachers: [], scheduleSessions: [] }), false)
assert.equal(hasCloudBootstrapSnapshotData({ students: [{ id: 's1' }] }), true)

assert(bootstrap.includes("CLOUD_BOOTSTRAP_ENTITY_TYPES = Object.freeze([\n  'student',\n  'teacher',\n  'schedule_session',\n])"))
assert(bootstrap.includes('canRunCloudBootstrap'))
assert(bootstrap.includes("authStatus === 'signed-in'"))
assert(bootstrap.includes("centerBinding?.status === 'bound'"))
assert(bootstrap.includes("configStatus === 'configured'"))

assert(cloudDbSync.includes('pullCloudBootstrapCoreEntities'))
assert(cloudDbSync.includes('listScheduleSessionCloudPayloads'))
assert(cloudDbSync.includes('SCHEDULE_SESSION_CLOUD_ENTITY_TYPE'))
assert(cloudDbSync.includes("entityType: CLOUD_ENTITY_TYPES.STUDENT"))
assert(cloudDbSync.includes("entityType: CLOUD_ENTITY_TYPES.TEACHER"))
assert(cloudDbSync.includes('scheduleSessionsResult'))

assert(main.includes('bootstrapCoreCloudDataForCurrentCenter(syncId)'))
assert(main.includes('canRunCloudBootstrap(context)'))
assert(main.includes('pullCloudBootstrapCoreEntities(centerId)'))
assert(main.includes('applyCloudBootstrapSnapshotToLocal(result.data)'))
assert(main.includes('saveStoredStudents(students)'))
assert(main.includes('saveStoredTeachers(teachers)'))
assert(main.includes('saveStoredSchedule(scheduleSessions)'))
assert(main.includes('Cloud chưa có dữ liệu cho center này. Đang dùng cache/staging local.'))
assert(main.includes('Không thể tải dữ liệu cloud. Đang dùng cache cục bộ.'))
assert(main.includes('Dữ liệu: Cloud'))
assert(main.includes('getCloudBootstrapStatusLabel(cloudBootstrapState)'))

const entityLiteralBlock = bootstrap.match(/CLOUD_BOOTSTRAP_ENTITY_TYPES[\s\S]*?\]\)/)?.[0] || ''
for (const forbidden of [
  'tuition',
  'payment',
  'attendance',
  'cashflow',
  'inventory',
  'session_report',
  'staff',
]) {
  assert(!entityLiteralBlock.includes(forbidden), `C4.5 bootstrap must not include ${forbidden}`)
}

assert(!runtimeSources.includes('localStorage.clear('), 'C4.5 must not hard reset localStorage.')
assert(!runtimeSources.includes('seedCloud29'), 'C4.5 must not seed cloud 29.')
assert(!runtimeSources.includes('seed cloud 29'), 'C4.5 must not seed cloud 29.')
assert(!runtimeSources.includes('CREATE POLICY'), 'C4.5 runtime must not include SQL.')
assert(!runtimeSources.includes('CREATE TABLE'), 'C4.5 runtime must not include SQL.')
assert(!appAuth.includes('Đăng ký'), 'No signup action in app auth.')
assert(!/signUp\s*\(/.test(runtimeSources), 'C4.5 runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(runtimeSources), 'C4.5 runtime must not call supabase.auth.signUp.')

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
  [0x00c3, 0x00a1],
  [0x00c3, 0x00b4],
].map((codes) => String.fromCodePoint(...codes))

for (const [label, source] of [
  [docPath, doc],
  [smokePath, smoke],
  [bootstrapPath, bootstrap],
  [mainPath, main],
  [cloudDbSyncPath, cloudDbSync],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.5 cloud bootstrap core entities smoke passed')
