import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getInventoryStats,
  renderInventoryCycleCountPanel,
  renderInventoryModule,
  renderInventoryMovementsWindow,
  createEditInventoryFormState,
  createInventoryMovementFormState,
  validateInventoryForm,
} from '../src/inventory-module.js'
import {
  mutateC56InventorySharedTruth,
  pullC56InventorySharedTruth,
  getC56InventoryOutcomeMessage,
} from '../src/cloud-authoritative-inventory.js'

const id = '597cb34c-85f6-47bb-b53c-683ab474781d'
const movementId = '235f8520-4ec1-4ed5-964b-1c5c431cc45a'
const actorId = '9683b2c8-3970-4eac-99b3-985d503bdeb9'
const item = {
  id, name: 'INV QA - Bộ cờ', category: 'Bàn cờ / quân cờ', unit: 'Bộ',
  quantity: 14, lowStockThreshold: 3, condition: 'Đang dùng',
  location: 'Tủ lớp', note: '', cloudVersion: 2,
}
const movement = {
  id: movementId, itemId: id, itemName: item.name, itemUnit: item.unit,
  type: 'in', quantity: 14, beforeQuantity: 0, afterQuantity: 14,
  movementDate: '2026-09-29', reason: 'Tồn đầu kỳ', handledBy: 'owner',
  costAmount: 0, note: '', createdAt: '2026-09-29T00:00:00Z',
}

assert.deepEqual(getInventoryStats([
  item,
  { ...item, id: '7b271e3b-df1d-4746-ac27-25a326a8f49f', unit: 'Cái', quantity: 0 },
  { ...item, id: 'f3e268fe-4391-45e3-bfc8-f5e1c09d09bb', unit: 'Hộp', quantity: 2, lowStockThreshold: 4 },
]), { itemCount: 3, inStockCount: 2, lowStockCount: 1, outOfStockCount: 1 })

const overview = renderInventoryModule([item], undefined, createEditInventoryFormState(item),
  null, [movement])
assert(overview.includes('Mặt hàng có tồn'))
assert(!overview.includes('Tổng tồn'))
assert(!overview.includes(`<span>${id}</span>`))
assert(overview.includes('data-inventory-item-id='))
assert(overview.includes('data-inventory-form-field="unit"'))
assert.match(overview, /data-inventory-form-field="unit"[\s\S]*?readonly/)
assert(overview.includes('Đơn vị đã được dùng trong lịch sử kho nên không thể đổi.'))
assert.match(overview, /data-inventory-action="delete-item" disabled/)
const archiveGuidance = 'Chỉ có thể lưu trữ khi tồn kho bằng 0. Nhập/xuất và kiểm kê phải phản ánh số lượng thực tế.'
assert(overview.includes(archiveGuidance))
assert.equal(getC56InventoryOutcomeMessage('ITEM_HAS_STOCK'), archiveGuidance)
const stockInForm = renderInventoryModule([item], undefined, null, createInventoryMovementFormState(item))
assert(stockInForm.includes('Thông tin chi phí tại đây chỉ dùng cho lịch sử nhập kho, không ghi vào Sổ quỹ.'))

const zeroItem = { ...item, quantity: 0 }
const zeroForm = renderInventoryModule([zeroItem], undefined, createEditInventoryFormState(zeroItem))
assert(!zeroForm.includes('data-inventory-action="delete-item" disabled'))
assert(!/data-inventory-form-field="unit"[\s\S]*?readonly/.test(zeroForm.split('data-inventory-form-field="unit"')[1]?.split('</label>')[0] || ''))

const legacyCondition = renderInventoryModule([{ ...item, condition: 'Hết hàng', quantity: 4 }])
assert(legacyCondition.includes('4 Bộ'))
assert(!legacyCondition.includes('<span class="inventory-condition-badge is-danger">Hết hàng</span>'))
assert.equal(validateInventoryForm({ ...createEditInventoryFormState(item).values, condition: 'Hết hàng' }).condition,
  'Hết hàng được xác định từ số lượng tồn, không chọn thủ công.')

const history = renderInventoryMovementsWindow([], [movement], undefined, movementId)
assert(history.includes('+14 Bộ'))
assert(!history.includes('14 SL'))
const emptyCount = renderInventoryCycleCountPanel({ counts: [], canWrite: true, activeItemCount: 0 })
assert.match(emptyCount, /type="submit" disabled/)
assert(emptyCount.includes('Chưa có mặt hàng để kiểm kê.'))
const nonemptyCount = renderInventoryCycleCountPanel({ counts: [], canWrite: true, activeItemCount: 1 })
assert(!nonemptyCount.includes('type="submit" disabled'))

for (const [serverMessage, expectedCode] of [
  ['INVENTORY_ITEM_HAS_STOCK', 'ITEM_HAS_STOCK'],
  ['INVENTORY_UNIT_HAS_HISTORY', 'UNIT_HAS_HISTORY'],
]) {
  const result = await mutateC56InventorySharedTruth({
    supabase: { rpc: async () => ({ error: { message: serverMessage, code: 'P0001' } }) },
    centerId: 'phongtrong_prod', command: { operation: 'ARCHIVE_ITEM' },
    idempotencyKey: movementId,
  })
  assert.equal(result.ok, false)
  assert.equal(result.outcome_code, expectedCode)
}

const rawItem = (status) => ({
  center_id: 'phongtrong_prod', id, name: item.name, category: item.category,
  unit: item.unit, quantity: 0, low_stock_threshold: 3, condition: 'Đang dùng',
  location: '', note: '', status, version: 3,
  created_at: '2026-09-29T00:00:00Z', updated_at: '2026-09-29T00:00:00Z',
})
const rawMovement = {
  center_id: 'phongtrong_prod', id: movementId, item_id: id, item_name: item.name,
  movement_type: 'IN', quantity: 2, before_quantity: 0, after_quantity: 2,
  cost_amount_minor: 0, movement_date: '2026-09-29', reason: 'QA',
  actor_user_id: actorId, actor_membership_id: actorId, actor_role: 'owner',
  created_at: '2026-09-29T00:00:00Z',
}
const pulled = await pullC56InventorySharedTruth({
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'phongtrong_prod',
    items: [rawItem('archived')], movements: [rawMovement], requests: [],
  } }) },
  centerId: 'phongtrong_prod',
})
assert.equal(pulled.ok, true)
assert.equal(pulled.items[0].isArchived, true)
assert.equal(pulled.movements[0].itemUnit, 'Bộ')

const migration = readFileSync('supabase/migrations/202609290001_k2_inventory_item_safety.sql', 'utf8')
assert(migration.includes('new.quantity > 0'))
assert(migration.includes('new.unit is distinct from old.unit'))
assert(migration.includes('public.center_inventory_movements'))
assert(!migration.includes('delete from public.center_inventory'))
const main = readFileSync('src/main.js', 'utf8')
assert(main.includes("reason: 'notification-exact-route'"))
assert(main.includes('selectedInventoryCycleCountId = cycleCountId'))
const theme = readFileSync('src/inventory-v2-8p2-theme.css', 'utf8')
assert(theme.includes('.inventory-movement-type.is-in { color: var(--inventory-green); background: var(--inventory-green-bg); }'))
assert(theme.includes('.inventory-movement-type.is-out { color: var(--inventory-red); background: var(--inventory-red-bg); }'))
console.log('K2 Inventory safety and clarity smoke passed')
