import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getProductionLauncherModules,
  isProductionModuleAvailable,
  isProductionModuleVisible,
  modules,
  PRODUCT_LAUNCHER_MODULE_IDS,
} from '../src/modules.js'

const read = (path) => readFileSync(path, 'utf8')
const main = read('src/main.js')
const finance = read('src/finance-workspace-module.js')
const storage = read('src/storage.js')

const expectedLauncherIds = [
  'hoc-vien',
  'khach-hang-tu-van',
  'hoc-phi',
  'bang-diem-danh',
  'thoi-khoa-bieu',
  'giao-vien',
  'nhom-tai-chinh',
  'bao-cao',
  'kho-hang',
  'cai-dat-co-so',
]
const hiddenLauncherIds = ['thu-chi', 'so-quy', 'nhan-vien', 'dang-cap-nhat']

assert.deepEqual(PRODUCT_LAUNCHER_MODULE_IDS, expectedLauncherIds)
assert.deepEqual(
  getProductionLauncherModules().map((moduleItem) => moduleItem.id),
  expectedLauncherIds,
)
assert.equal(getProductionLauncherModules().length, 10)
assert.deepEqual(expectedLauncherIds.slice(0, 4), [
  'hoc-vien',
  'khach-hang-tu-van',
  'hoc-phi',
  'bang-diem-danh',
])

for (const moduleId of expectedLauncherIds) {
  assert.equal(isProductionModuleVisible(moduleId), true, `${moduleId} must be on the product launcher`)
}
for (const moduleId of hiddenLauncherIds) {
  assert.equal(isProductionModuleVisible(moduleId), false, `${moduleId} must stay off the product launcher`)
}

assert.equal(modules.length, 14, 'V2-0 must preserve internal module definitions')
assert.equal(isProductionModuleAvailable('thu-chi'), true, 'Thu chi internal capability must remain available')
assert.equal(isProductionModuleAvailable('so-quy'), true, 'Sổ quỹ internal capability must remain available')
assert.equal(isProductionModuleAvailable('nhan-vien'), false, 'Legacy Check-in/Check-out surface stays unavailable')

for (const moduleId of ['thu-chi', 'so-quy']) {
  assert(
    finance.includes(`data-finance-open-module="${moduleId}"`),
    `Finance workspace must retain its ${moduleId} route`,
  )
}
assert(main.includes("document.querySelectorAll('[data-finance-open-module]')"))
assert(main.includes('openModuleWindow(button.dataset.financeOpenModule)'))

assert(
  storage.includes("const DESKTOP_ORDER_KEY = 'ichess-center-os:v2-desktop-module-order'"),
  'Existing browsers need a one-time V2 launcher-order namespace reset',
)

const taskbarSource = main.slice(
  main.indexOf('function renderTaskbar()'),
  main.indexOf('function renderStartMenu()'),
)
for (const token of [
  'data-action="toggle-start"',
  'data-taskbar-window-id',
  'data-action="toggle-window-overflow"',
  'data-action="toggle-notifications"',
]) {
  assert(taskbarSource.includes(token), `Canonical taskbar behavior drifted: ${token}`)
}

console.log('V2_0_PRODUCT_SURFACE_SIMPLIFICATION_SMOKE: PASS')
