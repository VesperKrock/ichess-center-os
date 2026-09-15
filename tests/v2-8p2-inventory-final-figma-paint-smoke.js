import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createEmptyInventoryFormState,
  createEmptyInventoryRequestFormState,
  renderInventoryModule,
} from '../src/inventory-module.js'

const items = [{
  id: 'item-a',
  name: 'Bộ bàn cờ tiêu chuẩn',
  category: 'Bàn cờ / quân cờ',
  unit: 'Bộ',
  quantity: 10,
  lowStockThreshold: 1,
  condition: 'Đang dùng',
  location: 'Tủ lớp 1',
  note: '',
}]
const movements = [{
  id: 'movement-a',
  itemId: 'item-a',
  itemName: 'Bộ bàn cờ tiêu chuẩn',
  type: 'in',
  quantity: 10,
  beforeQuantity: 0,
  afterQuantity: 10,
  movementDate: '2026-09-13',
  reason: 'Tồn đầu kỳ khi tạo vật tư',
  handledBy: 'center_admin',
  createdAt: '2026-09-13T00:00:00.000Z',
}]

const renderInventory = (overrides = {}) => renderInventoryModule(
  items,
  { query: '', category: 'all', condition: 'all', location: 'all', stockAlert: 'all' },
  overrides.formState ?? null,
  null,
  movements,
  { query: '', type: 'all', itemId: 'all', date: '' },
  null,
  overrides.historyOpen ?? false,
  [],
  { query: '', status: 'all', neededDate: '' },
  overrides.requestsOpen ?? false,
  overrides.requestFormState ?? null,
  null,
  null,
  [],
  overrides.sharedTruthState ?? { message: 'Không thể làm mới dữ liệu lúc này.', messageTone: 'error' },
  { coreStatus: 'ready', coreCurrent: true, centerName: 'DreamHome' },
  overrides.cycleCountState ?? {},
)

const defaultHtml = renderInventory()
for (const expected of [
  'inventory-page-header',
  '<span>KHO HÀNG</span>',
  '<h3>Kho hàng</h3>',
  'Quản lý vật tư, tài sản và tồn kho tại cơ sở DreamHome.',
  'Lịch sử nhập/xuất',
  'Đề xuất vật tư',
  'Kiểm kê định kỳ',
  '+ Thêm sản phẩm',
  'data-inventory-filter="location"',
  'inventory-stat-icon',
  'inventory-table-panel',
  '1 mặt hàng · Tồn kho được tính từ dữ liệu nhập/xuất gần nhất.',
]) {
  assert(defaultHtml.includes(expected), `Final Inventory paint is missing ${expected}`)
}
assert(!defaultHtml.includes('Không thể làm mới dữ liệu lúc này.'))
assert(!defaultHtml.includes('module-authoritative-refresh-notice'))

const legacyHtml = renderInventory({
  sharedTruthState: { legacyMigrationRequired: true },
})
assert(legacyHtml.includes('Dữ liệu Kho hàng cũ:'))

const historyHtml = renderInventory({ historyOpen: true })
for (const expected of [
  'Theo dõi các lượt nhập, xuất kho và biến động tồn theo dữ liệu đã ghi nhận.',
  'data-inventory-export-movements',
  'Xuất CSV',
  'NHẬP KHO',
  'XUẤT KHO',
  'inventory-history-panel-footer',
  'Hiển thị 1 / 1 bản ghi',
]) {
  assert(historyHtml.includes(expected), `History state is missing ${expected}`)
}

const requestsHtml = renderInventory({ requestsOpen: true })
assert(requestsHtml.includes('inventory-request-panel'))
assert(requestsHtml.includes('Không có đề xuất vật tư phù hợp.'))

const requestFormHtml = renderInventory({
  requestsOpen: true,
  requestFormState: createEmptyInventoryRequestFormState(),
})
for (const expected of [
  'inventory-request-form-layout',
  'Thông tin đề xuất',
  'Hình thức / địa điểm sử dụng',
  'Vật tư đề xuất',
  'Mô tả & Ghi chú',
  'Tất cả thông tin nằm trên một màn — không cần cuộn.',
]) {
  assert(requestFormHtml.includes(expected), `Add-proposal state is missing ${expected}`)
}

const cycleHtml = renderInventory({
  cycleCountState: {
    isPanelOpen: true,
    canWrite: false,
    counts: [],
    message: 'Khả năng kiểm kê chưa sẵn sàng tại cơ sở này.',
  },
})
for (const expected of [
  'inventory-cycle-count-panel',
  'Quyền hiện tại',
  'Vai trò hiện tại được xem nhưng không được thay đổi kiểm kê.',
  'Chưa có phiên kiểm kê',
]) {
  assert(cycleHtml.includes(expected), `Cycle-count state is missing ${expected}`)
}

const productHtml = renderInventory({ formState: createEmptyInventoryFormState() })
for (const expected of [
  'inventory-product-form-grid',
  'Tạo mặt hàng mới và thiết lập tồn đầu kỳ.',
  'Tên vật tư / tài sản / sản phẩm',
  'Lưu sản phẩm',
]) {
  assert(productHtml.includes(expected), `Add-product state is missing ${expected}`)
}

const themeSource = readFileSync(new URL('../src/inventory-v2-8p2-theme.css', import.meta.url), 'utf8')
for (const expected of [
  'padding: 32px;',
  'height: 78px;',
  'padding: 18px 28px;',
  'padding: 72px 108px 74px;',
  'max-width: 1480px;',
  'max-height: 636px;',
  'padding: 96px 138px 100px;',
  'width: 820px;',
  'height: 548px;',
  '--inventory-workspace: #0f1115;',
  '--inventory-panel: #14171c;',
]) {
  assert(themeSource.includes(expected), `Figma geometry/theme contract is missing ${expected}`)
}

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(mainSource.includes("import './inventory-v2-8p2-theme.css'"))
assert(mainSource.includes("['bang-diem-danh', 'kho-hang'].includes(windowItem?.moduleId)"))
assert(mainSource.includes("['bang-diem-danh', 'kho-hang'].includes(windowItem.moduleId)"))
assert(mainSource.includes("link.download = `lich-su-nhap-xuat-${new Date().toISOString().slice(0, 10)}.csv`"))

console.log('V2-8P2 INVENTORY FINAL FIGMA PAINT SMOKE: PASS')
