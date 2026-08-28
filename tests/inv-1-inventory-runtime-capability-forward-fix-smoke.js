import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  C56_INVENTORY_CAPABILITY_STATUS,
  createC56InventoryCapabilityState,
  getC56InventoryOutcomeMessage,
  isC56InventoryBackendUnavailable,
  isC56InventoryCapabilityReady,
  mutateC56InventorySharedTruth,
  pullC56InventorySharedTruth,
} from '../src/cloud-authoritative-inventory.js'
import {
  getModuleRefreshContract,
} from '../src/module-authority-registry.js'
import {
  createEmptyInventoryRequestFormState,
  renderInventoryModule,
} from '../src/inventory-module.js'
import {
  getProductionLauncherModules,
  isProductionModuleAvailable as isStaticProductionModuleAvailable,
} from '../src/modules.js'

const read = (path) => readFileSync(path, 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const main = read('src/main.js')
const adapter = read('src/cloud-authoritative-inventory.js')
const inventoryModule = read('src/inventory-module.js')
const migration = 'supabase/migrations/202608140009_c5_6_inventory_authoritative_shared_truth.sql'

assert.equal(
  sha256(migration),
  '4D7BD90677E3B3237514A1D684C472ECEEF22F9BCCE562E5B90082D9E92B24B1',
  'Frozen C5.6 migration drifted',
)

const idle = createC56InventoryCapabilityState({ centerId: 'center-a' })
const loading = createC56InventoryCapabilityState({
  centerId: 'center-a',
  status: C56_INVENTORY_CAPABILITY_STATUS.LOADING,
  isLoading: true,
})
const unavailable = createC56InventoryCapabilityState({
  centerId: 'center-a',
  status: C56_INVENTORY_CAPABILITY_STATUS.UNAVAILABLE,
})
const failed = createC56InventoryCapabilityState({
  centerId: 'center-a',
  status: C56_INVENTORY_CAPABILITY_STATUS.FAILED,
})
const ready = createC56InventoryCapabilityState({
  centerId: 'center-a',
  status: C56_INVENTORY_CAPABILITY_STATUS.READY,
})
assert.equal(isC56InventoryCapabilityReady(idle, 'center-a'), false)
assert.equal(isC56InventoryCapabilityReady(loading, 'center-a'), false)
assert.equal(isC56InventoryCapabilityReady(unavailable, 'center-a'), false)
assert.equal(isC56InventoryCapabilityReady(failed, 'center-a'), false)
assert.equal(isC56InventoryCapabilityReady(ready, 'center-a'), true)
assert.equal(isC56InventoryCapabilityReady(ready, 'center-b'), false, 'Capability leaked across center')
assert.equal(isC56InventoryCapabilityReady(ready, ''), false)

for (const code of ['PGRST202', 'PGRST205', '42P01', '42883']) {
  assert.equal(isC56InventoryBackendUnavailable({ outcome_code: code }), true, `${code} not unavailable`)
}
assert.equal(isC56InventoryBackendUnavailable({ outcome_code: 'PGRST301' }), false)

for (const code of ['PGRST202', 'PGRST205']) {
  const absentPull = await pullC56InventorySharedTruth({
    centerId: 'center-a',
    supabase: { rpc: async () => ({ data: null, error: { code, message: 'Not found' } }) },
  })
  assert.equal(absentPull.ok, false)
  assert.equal(absentPull.outcome_code, 'BACKEND_NOT_DEPLOYED')
  assert.equal(absentPull.error, 'Kho hàng hiện chưa khả dụng.')
}

const deployedFailure = await pullC56InventorySharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: null, error: { code: '57014', message: 'statement timeout' } }) },
})
assert.equal(deployedFailure.ok, false)
assert.equal(deployedFailure.outcome_code, 'INVENTORY_SHARED_TRUTH_READ_FAILED')
assert.match(deployedFailure.error, /Chưa tải được dữ liệu Kho hàng/)
assert.equal(getC56InventoryOutcomeMessage('BACKEND_NOT_DEPLOYED'), 'Kho hàng hiện chưa khả dụng.')

const writeFailure = await mutateC56InventorySharedTruth({
  centerId: 'center-a',
  command: { operation: 'CREATE_ITEM', expected_version: 0 },
  idempotencyKey: '00000000-0000-4000-8000-000000000001',
  supabase: { rpc: async () => ({
    data: null,
    error: { code: '57014', message: 'raw database timeout detail' },
  }) },
})
assert.equal(writeFailure.outcome_code, 'SERVER_COMMAND_FAILED')
assert.equal(writeFailure.error, 'Chưa thể lưu thay đổi Kho hàng. Nội dung đang nhập vẫn được giữ nguyên.')
assert.doesNotMatch(writeFailure.error, /database|57014|timeout/i)

const readyPull = await pullC56InventorySharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({
    data: {
      ok: true,
      outcome_code: 'AUTHORITATIVE_SNAPSHOT',
      center_id: 'center-a',
      items: [],
      movements: [],
      requests: [],
    },
    error: null,
  }) },
})
assert.equal(readyPull.ok, true)

const launcher = getProductionLauncherModules()
assert.equal(launcher.length, 12, 'Visible launcher module count drifted')
const availableCount = (inventoryCapability) => launcher.filter((moduleItem) => {
  if (moduleItem.id === 'khach-hang-tu-van') return true // Parent is READY in production baseline.
  if (moduleItem.id === 'kho-hang') {
    return isC56InventoryCapabilityReady(inventoryCapability, 'center-a')
  }
  return isStaticProductionModuleAvailable(moduleItem.id)
}).length
assert.equal(availableCount(unavailable), 11, 'Absent C5.6 launcher must remain 12/11/1')
assert.equal(availableCount(ready), 12, 'READY C5.6 launcher must become 12/12/0')

const refreshContract = getModuleRefreshContract('kho-hang')
assert.deepEqual(refreshContract.required, ['inventory'])
assert.deepEqual(refreshContract.optional, ['core'])
assert.deepEqual(refreshContract.actionRequired, { 'student-link': ['core'] })

const requestForm = createEmptyInventoryRequestFormState()
const unavailableLinkHtml = renderInventoryModule(
  [], undefined, null, null, [], undefined, null, false,
  [], undefined, true, requestForm, null, null, [], {},
  { coreStatus: 'failed', coreCurrent: false },
)
assert.match(unavailableLinkHtml, /data-inventory-request-field="linkedStudentId" disabled aria-disabled="true"/)
assert.match(unavailableLinkHtml, /Bạn vẫn có thể tạo đề xuất không liên kết học viên/)

const readyLinkHtml = renderInventoryModule(
  [], undefined, null, null, [], undefined, null, false,
  [], undefined, true, requestForm, null, null,
  [{ id: 'student-1', fullName: 'Học viên QA' }], {},
  { coreStatus: 'ready', coreCurrent: true },
)
assert.doesNotMatch(readyLinkHtml, /data-inventory-request-field="linkedStudentId" disabled/)
assert.match(readyLinkHtml, /Học viên QA/)

for (const token of [
  "if (moduleId === 'kho-hang')",
  'isC56InventoryCapabilityReady(',
  "status: C56_INVENTORY_CAPABILITY_STATUS.LOADING",
  "C56_INVENTORY_CAPABILITY_STATUS.UNAVAILABLE",
  "C56_INVENTORY_CAPABILITY_STATUS.FAILED",
  "C56_INVENTORY_CAPABILITY_STATUS.READY",
  "reason: 'capability-probe'",
  "areModuleActionUpstreamsCurrent('kho-hang', 'student-link')",
]) {
  assert(main.includes(token), `Missing runtime capability boundary: ${token}`)
}
assert(main.includes("...(isC56InventoryCapabilityReady(c56InventoryCapabilityState, centerContext.centerId)"))
assert(!main.includes("const upstreams = ['core', 'crm', 'tuition', 'inventory']"),
  'Notification Center still pulls unavailable Inventory unconditionally')
assert(main.includes("resetC56InventoryRuntimeForAccessBoundary('')"),
  'Account boundary does not clear Inventory capability/projection')
assert(main.includes('resetC56InventoryRuntimeForAccessBoundary(getCurrentCanonicalCenterContext().centerId)'),
  'Center switch does not reset Inventory against canonical center')
assert(!main.includes('getStoredInventory('))
assert(!main.includes('saveStoredInventory('))

for (const forbidden of [
  'authoritative Inventory',
  'projection chưa thay đổi',
  'commit server',
  'phase 5D',
  'movement server',
]) {
  assert(!adapter.includes(forbidden), `Operator adapter copy still contains: ${forbidden}`)
  assert(!inventoryModule.includes(forbidden), `Operator Inventory copy still contains: ${forbidden}`)
}

console.log('INV_1_INVENTORY_RUNTIME_CAPABILITY_FORWARD_FIX_SMOKE: PASS')
