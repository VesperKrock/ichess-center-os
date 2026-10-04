import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getFilteredInventoryItems,
  getInventoryMovementActorRoleLabel,
  getInventoryReadState,
  getInventoryStats,
  initialInventoryFilters,
  initialInventoryMovementFilters,
  initialInventoryRequestFilters,
  renderInventoryModule,
} from '../src/inventory-module.js'

const centerId = 'phongtrong_prod'
const loaded = { centerId, lastLoadedAt: '2026-10-04T00:00:00.000Z', messageTone: 'success' }
const capabilities = { centerId, centerName: 'Phòng Trống', inventoryStatus: 'ready' }
const activeItem = {
  id: 'active-item',
  name: 'Bộ cờ thử nghiệm',
  category: 'Bàn cờ / quân cờ',
  unit: 'Bộ',
  quantity: 14,
  lowStockThreshold: 3,
  condition: 'Đang dùng',
  location: 'Tủ lớp học',
  note: '',
  isArchived: false,
}
const archivedItem = {
  ...activeItem,
  id: 'archived-secret-id',
  name: 'Bộ cờ lưu trữ',
  quantity: 4,
  unit: 'bộ',
  isArchived: true,
}
const movement = {
  id: 'movement-id',
  itemId: activeItem.id,
  itemName: activeItem.name,
  itemUnit: activeItem.unit,
  type: 'in',
  quantity: 1,
  beforeQuantity: 13,
  afterQuantity: 14,
  movementDate: '2026-09-29',
  reason: 'Mua mới',
  handledBy: 'owner',
  actorRole: 'owner',
  note: '',
  costAmount: 0,
  createdAt: '2026-09-29T12:00:00.000Z',
}

function render({
  items = [],
  archived = [],
  movements = [],
  filters = initialInventoryFilters,
  movementId = null,
  historyOpen = false,
  state = loaded,
  access = capabilities,
} = {}) {
  return renderInventoryModule(
    items, filters, null, null, movements, initialInventoryMovementFilters,
    movementId, historyOpen, [], initialInventoryRequestFilters, false,
    null, null, null, [], state, access, {}, archived,
  )
}

// Archived stock is visible as a read-only exception, never inserted into active rows.
const archivedHtml = render({ archived: [archivedItem] })
assert(archivedHtml.includes('Bộ cờ lưu trữ: <strong>4 bộ</strong>'))
assert(archivedHtml.includes('Hãy kiểm tra lịch sử trước khi xử lý tồn thực tế.'))
assert(archivedHtml.includes('data-inventory-open-subwindow="movements"'))
assert(!archivedHtml.includes('data-inventory-item-id="archived-secret-id"'))
assert(!archivedHtml.includes('archived-secret-id'))
assert(!render({ archived: [{ ...archivedItem, quantity: 0 }] }).includes('inventory-archived-stock-notice'))

// Loading and failed reads cannot masquerade as confirmed zero stock.
assert.equal(getInventoryReadState({}, { ...capabilities, inventoryStatus: 'idle' }), 'loading')
assert.equal(getInventoryReadState({ ...loaded, isLoading: true }, { ...capabilities, inventoryStatus: 'loading' }), 'loading')
assert.equal(getInventoryReadState({ ...loaded, centerId: 'other' }, capabilities), 'loading')
assert.equal(getInventoryReadState(loaded, { ...capabilities, inventoryStatus: 'failed' }), 'error')
const loadingHtml = render({ state: { centerId, isLoading: true }, access: { ...capabilities, inventoryStatus: 'loading' } })
assert(loadingHtml.includes('Đang tải dữ liệu Kho hàng'))
assert(!loadingHtml.includes('inventory-stats'))
assert(!loadingHtml.includes('Không tìm thấy vật tư'))
const failedHtml = render({
  state: { centerId, message: 'PostgREST SQL RPC secret', messageTone: 'error' },
  access: { ...capabilities, inventoryStatus: 'failed' },
})
assert(failedHtml.includes('Chưa tải được dữ liệu Kho hàng'))
assert(failedHtml.includes('data-inventory-action="refresh-authoritative"'))
assert(!failedHtml.includes('PostgREST') && !failedHtml.includes('inventory-stats'))
const emptyHtml = render()
assert(emptyHtml.includes('Kho hàng chưa có mặt hàng đang sử dụng.'))
assert(emptyHtml.includes('inventory-stats'))
const filteredHtml = render({ items: [activeItem], filters: { ...initialInventoryFilters, query: 'không khớp' } })
assert(filteredHtml.includes('Không tìm thấy vật tư/tài sản/sản phẩm phù hợp.'))
assert(!filteredHtml.includes('Kho hàng chưa có mặt hàng đang sử dụng.'))
assert.equal(getFilteredInventoryItems([activeItem], { query: 'không khớp' }).length, 0)
assert.equal(getFilteredInventoryItems([activeItem], { query: '' }).length, 1)

// The backend exposes role, not a human name. UI and CSV rows share rendered wording.
assert.equal(getInventoryMovementActorRoleLabel(movement), 'Chủ hệ thống')
assert.equal(getInventoryMovementActorRoleLabel({ actorRole: 'center_admin' }), 'Quản lý cơ sở')
const historyHtml = render({ items: [activeItem], movements: [movement], movementId: movement.id, historyOpen: true })
assert(historyHtml.includes('Vai trò thực hiện'))
assert(historyHtml.includes('Chủ hệ thống'))
assert(!historyHtml.includes('Người thực hiện'))
assert(!historyHtml.includes('>owner<'))

// Frozen quantity boundaries and the existing move chain remain intact.
assert.equal(getInventoryStats([{ ...activeItem, quantity: 0 }]).outOfStockCount, 1)
assert.equal(getInventoryStats([{ ...activeItem, quantity: 4, lowStockThreshold: 4 }]).lowStockCount, 1)
assert.equal(getInventoryStats([{ ...activeItem, quantity: 5, lowStockThreshold: 4 }]).lowStockCount, 0)

const main = readFileSync('src/main.js', 'utf8')
const theme = readFileSync('src/inventory-v2-8p2-theme.css', 'utf8')
assert(main.includes('[data-inventory-filter], [data-inventory-movement-filter], [data-inventory-request-filter]'))
assert(main.includes("['Cơ sở', 'Ngày', 'Loại', 'Vật tư'"))
assert(main.includes("'Vai trò thực hiện', 'Ghi chú'"))
assert(main.includes('inventoryArchivedStockItems = result.items.filter((item) => item.isArchived && item.quantity > 0)'))
assert(theme.includes('.inventory-request-table td strong { color: var(--inventory-text); }'))
assert(theme.includes('.inventory-request-chip-list span'))
assert(theme.includes('.inventory-request-status.is-pending'))

console.log('M8_1_INVENTORY_AUDIT_FIXES_SMOKE: PASS')
