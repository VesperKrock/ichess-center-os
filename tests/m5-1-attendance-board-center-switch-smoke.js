import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { buildCanonicalAttendanceLedger, normalizeAttendanceLedgerFilters } from '../src/attendance-ledger.js'
import { ledgerFixture } from './a6-attendance-ledger-fixtures.js'

const source = readFileSync('src/main.js', 'utf8')
const functionSource = (name) => {
  const start = source.indexOf(`function ${name}(`)
  assert(start >= 0, `${name} must exist`)
  const end = source.indexOf('\nfunction ', start + 1)
  return source.slice(start, end < 0 ? undefined : end)
}
const switchStart = source.indexOf('async function handleInternalOpenCenter(')
const switchEnd = source.indexOf('\nfunction normalizeInternalCenters(', switchStart)
assert(switchStart >= 0 && switchEnd > switchStart)
assert.match(functionSource('resetTransientStateForCenterSwitch'), /clearAttendanceBoardCenterFilters\(\)/)

const fixture = ledgerFixture()
const calls = []
const pendingBootstraps = new Map()
let currentCenter = 'phongtrong_prod'
let readyCenter = ''
let board = null
const vm = createContext({
  attendanceBoardFilters: { ...fixture.filters, classSessionId: 'class-a', teacherId: 'teacher-history' },
  cloudUserSyncId: 0,
  cloudStatus: { role: 'owner', membershipStatus: 'loaded' },
  openWindows: [{ moduleId: 'bang-diem-danh' }],
  window: { location: { hash: '' } },
  getInternalCenterById: id => ({ id, name: id, environment: 'production', status: 'active' }),
  getActiveMembershipForInternalCenter: id => ({ centerId: id, role: 'owner' }),
  canOpenInternalCenter: () => true,
  createInternalCenterSwitchState: (state = {}) => state,
  resetCloudRuntimeStateForOwnerCenterSwitch: () => { readyCenter = ''; calls.push('invalidate') },
  setCurrentStorageCenterId: id => { currentCenter = id; calls.push(`center:${id}`) },
  reloadLocalDataForResolvedCenter: () => {
    vm.clearAttendanceBoardCenterFilters()
    board = null
    calls.push('clear-board')
  },
  normalizeOnlineRole: role => role,
  getCurrentMonthKey: () => '2026-10',
  render: () => {},
  refreshInstallationHandoffCapability: async () => {},
  bootstrapCoreCloudDataForCurrentCenter: async () => {
    const center = currentCenter
    if (pendingBootstraps.has(center)) await pendingBootstraps.get(center)
    if (currentCenter === center) readyCenter = center
    calls.push(`core:${center}`)
  },
  refreshParentStudentLinksSharedTruth: async () => {},
  refreshInventoryAuthoritativeTruth: async () => {},
  refreshV21CenterSettings: async () => {},
  refreshV22StudentEnrollments: async () => {},
  refreshV23AttendanceCapability: async () => {},
  refreshV24PackageCycles: async () => {},
  loadCenterMemberProfiles: async () => {},
  loadCurrentMonthCloudAttachments: async () => {},
  startStudentRealtimeSubscription: async () => {},
  startTeacherRealtimeSubscription: async () => {},
  startClassSessionRealtimeSubscription: async () => {},
  startScheduleSessionRealtimeSubscription: async () => {},
  refreshModuleAuthoritativeUpstreams: async (module, options) => {
    assert.equal(module, 'bang-diem-danh')
    assert.equal(options.reason, 'center-switch')
    assert.equal(readyCenter, currentCenter, 'Board refresh must follow current-center core bootstrap')
    assert.equal(vm.attendanceBoardFilters.classSessionId, 'all')
    assert.equal(vm.attendanceBoardFilters.teacherId, 'all')
    board = currentCenter === 'phongtrong_prod'
      ? buildCanonicalAttendanceLedger({ ...fixture, filters: vm.attendanceBoardFilters })
      : { rows: [], columns: [] }
    calls.push(`ledger:${currentCenter}`)
    return { ok: true, centerId: currentCenter }
  },
  queueNotificationAttentionRefresh: () => {},
})
runInContext(functionSource('clearAttendanceBoardCenterFilters'), vm)
runInContext(source.slice(switchStart, switchEnd), vm)

await vm.handleInternalOpenCenter('tester_prod')
assert.equal(currentCenter, 'tester_prod')
assert.deepEqual([board.rows.length, board.columns.length], [0, 0])
assert.equal(vm.attendanceBoardFilters.classSessionId, 'all')
assert.equal(vm.attendanceBoardFilters.teacherId, 'all')
assert(calls.indexOf('core:tester_prod') < calls.indexOf('ledger:tester_prod'))

await vm.handleInternalOpenCenter('phongtrong_prod')
assert.equal(currentCenter, 'phongtrong_prod')
assert(board.rows.length > 0 && board.columns.length > 0)
assert.equal(board.rows.find(row => row.student.id === 'student-a').tuition.progressLabel, '4/8')
assert.deepEqual(calls.filter(call => call.startsWith('ledger:')),
  ['ledger:tester_prod', 'ledger:phongtrong_prod'])

let releaseOldBootstrap
pendingBootstraps.set('tester_prod', new Promise(resolve => { releaseOldBootstrap = resolve }))
const oldSwitch = vm.handleInternalOpenCenter('tester_prod')
await vm.handleInternalOpenCenter('phongtrong_prod')
releaseOldBootstrap()
await oldSwitch
assert.equal(currentCenter, 'phongtrong_prod')
assert(board.rows.length > 0 && board.columns.length > 0)
assert.equal(calls.filter(call => call === 'ledger:tester_prod').length, 1,
  'Late old-center bootstrap must not refresh the Board')

// Execute the actual ledger read guard: an old response cannot repaint the
// final center even when its request resolves after the new-center ledger.
const readStart = source.indexOf('async function refreshAttendanceLedgerContext(')
const readEnd = source.indexOf('\nfunction getAttendanceLedgerPlannedOccurrences(', readStart)
assert(readStart >= 0 && readEnd > readStart)
let activeReadCenter = 'tester_prod'
let releaseOldRead
const oldRead = new Promise(resolve => { releaseOldRead = resolve })
const renders = []
const readVm = createContext({
  attendanceBoardFilters: { ...fixture.filters },
  attendanceLedgerReadRunId: 0,
  attendanceLedgerContext: { status: 'idle', centerId: '' },
  attendanceRecords: fixture.attendanceRecords,
  getCurrentCanonicalCenterContext: () => ({ centerId: activeReadCenter }),
  normalizeAttendanceLedgerFilters,
  getSupabaseClient: () => ({}),
  pullCanonicalAttendanceLedgerContext: ({ centerId }) => centerId === 'tester_prod'
    ? oldRead : Promise.resolve({ ok: true, centerId, occurrences: fixture.occurrences, assignments: [] }),
  render: () => renders.push(`${activeReadCenter}:${readVm.attendanceLedgerContext.status}`),
})
runInContext(source.slice(readStart, readEnd), readVm)
const staleRead = readVm.refreshAttendanceLedgerContext()
activeReadCenter = 'phongtrong_prod'
await readVm.refreshAttendanceLedgerContext()
const renderCount = renders.length
releaseOldRead({ ok: true, centerId: 'tester_prod', occurrences: [], assignments: [] })
await staleRead
assert.equal(readVm.attendanceLedgerContext.centerId, 'phongtrong_prod')
assert.equal(readVm.attendanceLedgerContext.status, 'ready')
assert.equal(renders.length, renderCount, 'Late old-center ledger must not render')

const switchSource = source.slice(switchStart, switchEnd)
assert.doesNotMatch(switchSource, /attendance.*(?:write|mutate|save|upsert)|schedule.*(?:write|mutate|save|upsert)/i)
assert.match(switchSource, /refreshModuleAuthoritativeUpstreams\('bang-diem-danh', \{ reason: 'center-switch' \}\)/)
console.log('M5_1_ATTENDANCE_BOARD_CENTER_SWITCH_SMOKE_PASS')
