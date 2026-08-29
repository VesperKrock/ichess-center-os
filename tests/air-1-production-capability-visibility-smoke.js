import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getProductionLauncherModules,
  isProductionModuleAvailable,
  isProductionModuleVisible,
  modules,
  resolveCapabilityDrivenLauncherPresentation,
} from '../src/modules.js'

const root = process.cwd()
const main = readFileSync(join(root, 'src/main.js'), 'utf8')
const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
const tuitionModule = readFileSync(join(root, 'src/tuition-module.js'), 'utf8')

const unavailableVisibleIds = ['khach-hang-tu-van', 'kho-hang']
const hiddenIds = ['nhan-vien', 'dang-cap-nhat']
const expectedActionableIds = [
  'hoc-vien',
  'giao-vien',
  'thoi-khoa-bieu',
  'hoc-phi',
  'nhom-tai-chinh',
  'thu-chi',
  'so-quy',
  'bao-cao',
  'cai-dat-co-so',
  'bang-diem-danh',
]
const expectedVisibleIds = [
  'hoc-vien',
  'khach-hang-tu-van',
  'giao-vien',
  'thoi-khoa-bieu',
  'hoc-phi',
  'nhom-tai-chinh',
  'thu-chi',
  'so-quy',
  'kho-hang',
  'bao-cao',
  'cai-dat-co-so',
  'bang-diem-danh',
]

assert.equal(modules.length, 14)
assert.equal(modules.find((moduleItem) => moduleItem.id === 'dang-cap-nhat')?.status, 'placeholder')
assert.equal(modules.find((moduleItem) => moduleItem.id === 'nhan-vien')?.status, 'unavailable')
for (const moduleId of unavailableVisibleIds) {
  const moduleItem = modules.find((item) => item.id === moduleId)
  assert.equal(moduleItem?.status, 'unavailable')
  assert.equal(moduleItem?.launcherVisibility, 'unavailable')
}

const visibleIds = getProductionLauncherModules().map((moduleItem) => moduleItem.id)
const actionableIds = modules
  .filter((moduleItem) => isProductionModuleAvailable(moduleItem.id))
  .map((moduleItem) => moduleItem.id)
assert.deepEqual(visibleIds, expectedVisibleIds)
assert.deepEqual(actionableIds, expectedActionableIds)
assert.equal(visibleIds.length, 12, 'Launcher must contain twelve visible product tiles')
assert.equal(actionableIds.length, 10, 'Exactly ten core product tiles must remain actionable')

for (const moduleId of unavailableVisibleIds) {
  assert.equal(isProductionModuleVisible(moduleId), true, `${moduleId} must remain visible`)
  assert.equal(isProductionModuleAvailable(moduleId), false, `${moduleId} must fail closed`)
}
for (const moduleId of hiddenIds) {
  assert.equal(isProductionModuleVisible(moduleId), false, `${moduleId} must stay hidden`)
  assert.equal(isProductionModuleAvailable(moduleId), false, `${moduleId} must fail closed`)
  assert(!visibleIds.includes(moduleId))
}

// Launcher truth must be stable across role, login lifecycle, center switch and theme.
for (const context of [
  { role: 'owner', lifecycle: 'fresh-login', theme: 'light' },
  { role: 'owner', lifecycle: 'center-switch', theme: 'dark' },
  { role: 'center_admin', lifecycle: 'fresh-login', theme: 'dark' },
  { role: 'center_admin', lifecycle: 'center-switch', theme: 'light' },
]) {
  assert.deepEqual(
    getProductionLauncherModules().map((moduleItem) => moduleItem.id),
    expectedVisibleIds,
    `Visible launcher drifted for ${JSON.stringify(context)}`,
  )
  assert.deepEqual(
    modules
      .filter((moduleItem) => isProductionModuleAvailable(moduleItem.id))
      .map((moduleItem) => moduleItem.id),
    expectedActionableIds,
    `Actionable launcher drifted for ${JSON.stringify(context)}`,
  )
}

for (const token of [
  'getProductionLauncherModules',
  'isProductionModuleAvailable',
  'isProductionModuleVisible',
  'resolveCapabilityDrivenLauncherPresentation',
  'getProductionLauncherModules().map((moduleItem) => moduleItem.id)',
  '.filter((moduleItem) => isProductionModuleVisible(moduleItem?.id))',
  'data-module-unavailable="true" aria-disabled="true" tabindex="-1" disabled',
  'data-module-capability-pending="true" aria-disabled="true" tabindex="-1" disabled',
  '<span class="module-availability-label">${presentation.label}</span>',
  '<span class="start-menu-availability-label">${presentation.label}</span>',
  'if (!isProductionModuleAvailable(moduleId))',
  'if (!openModuleWindow(moduleId))',
  'summary.canOpen && isProductionModuleAvailable(summary.sourceModule)',
  "void refreshModuleAuthoritativeUpstreams(moduleId, { reason: 'module-open' })",
  "void refreshModuleAuthoritativeUpstreams(moduleId, { reason: 'module-reopen' })",
]) {
  assert(main.includes(token), `Missing AIR-1B runtime guard: ${token}`)
}

const dashboardSource = main.slice(
  main.indexOf('function renderDashboard()'),
  main.indexOf('function renderOpenWindows()'),
)
assert(dashboardSource.includes('const presentation = getProductionModuleLauncherPresentation(moduleItem.id)'))
assert(dashboardSource.includes('const canOpen = presentation.canOpen'))
assert(dashboardSource.includes('? `data-module-launcher="desktop" data-shortcut-id="${moduleItem.id}"`'))
assert(dashboardSource.includes(': presentation.isUnavailable'))
assert(dashboardSource.includes('canOpen && unreadCount'), 'Unavailable tiles must not expose active badges')

const startMenuSource = main.slice(
  main.indexOf('function renderStartMenu()'),
  main.indexOf('function renderNotificationRefreshNotice()'),
)
assert(startMenuSource.includes('const presentation = getProductionModuleLauncherPresentation(moduleItem.id)'))
assert(startMenuSource.includes('const canOpen = presentation.canOpen'))
assert(startMenuSource.includes('? \'data-module-launcher="start-menu"\''))
assert(startMenuSource.includes('data-module-unavailable="true" aria-disabled="true" tabindex="-1" disabled'))
assert(startMenuSource.includes('data-module-capability-pending="true" aria-disabled="true" tabindex="-1" disabled'))

assert.deepEqual(
  resolveCapabilityDrivenLauncherPresentation({ canOpen: false, capabilityStatus: 'loading' }),
  { state: 'loading', isUnavailable: false, label: '' },
)

const openModuleSource = main.slice(
  main.indexOf('function openModuleWindow(moduleId)'),
  main.indexOf('function resetModuleRefreshStateForOpen(moduleId)'),
)
const guardIndex = openModuleSource.indexOf('if (!isProductionModuleAvailable(moduleId))')
assert(guardIndex >= 0)
assert(
  guardIndex < openModuleSource.indexOf('const existingWindow'),
  'Unsupported direct/deep open must stop before window creation or reuse',
)
assert(
  guardIndex < openModuleSource.indexOf('refreshModuleAuthoritativeUpstreams'),
  'Unsupported direct/deep open must stop before any network-backed refresh',
)
assert(openModuleSource.includes('return false'))

assert(
  !dashboardSource.includes('data-module-launcher="desktop"\n            data-module-id'),
  'Unavailable desktop markup must not inherit an unconditional launcher attribute',
)
for (const token of [
  '.module-button.is-unavailable',
  '.module-availability-label',
  '.start-menu .start-menu-module.is-unavailable',
  '.start-menu-availability-label',
  'cursor: not-allowed',
  'opacity: 1',
]) assert(styles.includes(token), `Missing unavailable-state styling: ${token}`)

const preciseNotesCopy =
  'Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng. Ghi chú học viên vẫn dùng được.'
assert(tuitionModule.includes(preciseNotesCopy))
assert(tuitionModule.includes('Đang tải ghi chú chăm sóc theo tháng và ghi chú điểm danh...'))
assert(!tuitionModule.includes('Ghi chú chăm sóc hiện chưa tải được. Gói học phí vẫn có thể xem và cập nhật.'))
for (const studentCareToken of [
  'data-tuition-action="open-care-notes"',
  'data-tuition-care-note-action="save"',
  'Lưu ghi chú',
]) assert(tuitionModule.includes(studentCareToken), `Embedded Student Care must remain usable: ${studentCareToken}`)

const taskbarSource = main.slice(
  main.indexOf('function renderTaskbar()'),
  main.indexOf('function renderStartMenu()'),
)
for (const token of [
  'data-action="toggle-start"',
  'data-taskbar-window-id',
  'data-action="toggle-window-overflow"',
  'data-action="toggle-notifications"',
]) assert(taskbarSource.includes(token), `Taskbar contract changed: ${token}`)

console.log('AIR_1B_TRUTHFUL_UNAVAILABLE_MODULES_CARE_NOTES_SMOKE: PASS')
