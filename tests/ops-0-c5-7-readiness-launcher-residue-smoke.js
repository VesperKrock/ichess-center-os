import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  getProductionLauncherModules,
  resolveCapabilityDrivenLauncherPresentation,
} from '../src/modules.js'

const read = (path) => readFileSync(path, 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const main = read('src/main.js')
const registry = read('src/module-authority-registry.js')
const schedule = read('src/schedule-module.js')
const attendance = read('src/attendance-board-module.js')
const tuition = read('src/tuition-module.js')
const baseMigration = 'supabase/migrations/202608140010_c5_7_calendar_operational_notes_authoritative_shared_truth.sql'
const hardeningMigration = 'supabase/migrations/202608140011_c5_7_independent_review_recurrence_reference_hardening.sql'

assert.equal(sha256(baseMigration), 'C1C9EACF39548E977CB2C09165CA6AC9DFCD156C4A3EACD4C1951F92933F8167')
assert.equal(sha256(hardeningMigration), 'DB628B00196EAAEA4DBB864DAFE9D6B0B1A8E47D2115AF865A387940EB9F7129')

const expectedPresentations = [
  [{ canOpen: true, capabilityStatus: 'ready' }, { state: 'ready', isUnavailable: false, label: '' }],
  [{ canOpen: false, capabilityStatus: 'idle' }, { state: 'idle', isUnavailable: false, label: '' }],
  [{ canOpen: false, capabilityStatus: 'loading' }, { state: 'loading', isUnavailable: false, label: '' }],
  [{ canOpen: false, capabilityStatus: 'unavailable' }, { state: 'unavailable', isUnavailable: true, label: 'Chưa khả dụng' }],
  [{ canOpen: false, capabilityStatus: 'failed' }, { state: 'failed', isUnavailable: true, label: 'Chưa tải được' }],
]
for (const [input, expected] of expectedPresentations) {
  assert.deepEqual(resolveCapabilityDrivenLauncherPresentation(input), expected)
}
assert.deepEqual(
  resolveCapabilityDrivenLauncherPresentation({ canOpen: false, capabilityStatus: 'ready' }),
  { state: 'idle', isUnavailable: false, label: '' },
  'A stale READY state from another center must remain closed without masquerading as a real backend failure',
)

assert.equal(getProductionLauncherModules().length, 12)
const launcherPresentationSource = main.slice(
  main.indexOf('function getProductionModuleLauncherPresentation(moduleId)'),
  main.indexOf('function getStudentsWithCanonicalProjections()'),
)
for (const token of [
  "moduleId === 'khach-hang-tu-van'",
  'parentFirstCapabilityState.status',
  "moduleId === 'kho-hang'",
  'c56InventoryCapabilityState.status',
  'resolveCapabilityDrivenLauncherPresentation',
]) assert(launcherPresentationSource.includes(token), `Missing capability-driven launcher token: ${token}`)
assert(!launcherPresentationSource.includes('Đang kiểm tra...'))

for (const [start, end] of [
  ['function renderDashboard()', 'function renderOpenWindows()'],
  ['function renderStartMenu()', 'function renderNotificationRefreshNotice()'],
]) {
  const source = main.slice(main.indexOf(start), main.indexOf(end))
  assert(source.includes('const presentation = getProductionModuleLauncherPresentation(moduleItem.id)'))
  assert(source.includes('const canOpen = presentation.canOpen'))
  assert(source.includes("presentation.isUnavailable ? 'is-unavailable' : ''"))
  assert(source.includes('presentation.label ?'))
  assert(source.includes('data-module-unavailable="true" aria-disabled="true" tabindex="-1" disabled'))
  assert(source.includes('data-module-capability-pending="true" aria-disabled="true" tabindex="-1" disabled'))
  assert(!source.includes('getUnavailableModuleLabel('))
}

const openModuleSource = main.slice(
  main.indexOf('function openModuleWindow(moduleId)'),
  main.indexOf('function resetModuleRefreshStateForOpen(moduleId)'),
)
assert(openModuleSource.indexOf('if (!isProductionModuleAvailable(moduleId))') >= 0)
assert(openModuleSource.indexOf('if (!isProductionModuleAvailable(moduleId))') < openModuleSource.indexOf('const existingWindow'))
assert(openModuleSource.includes('return false'))

for (const contract of [
  "['attendance', 'calendar-notes']",
  "['tuition', 'calendar-notes']",
]) assert(registry.includes(contract), `Missing optional C5.7 refresh contract: ${contract}`)
for (const token of [
  'data-schedule-optional-capability="calendar-notes"',
  'Quản lý nhãn',
  '+ Thêm hoạt động',
]) assert(schedule.includes(token), `Schedule C5.7 consumer drifted: ${token}`)
for (const token of [
  'attendanceBoardNotes',
  'attendanceAdvisoryNotes',
]) assert(attendance.includes(token), `Attendance C5.7 consumer drifted: ${token}`)
for (const token of [
  'Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng.',
  'Ghi chú học viên vẫn dùng được.',
]) assert(tuition.includes(token), `Tuition C5.7 boundary drifted: ${token}`)

console.log('OPS_0_C5_7_READINESS_LAUNCHER_RESIDUE_SMOKE: PASS')
