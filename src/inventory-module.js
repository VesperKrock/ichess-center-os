import { inventoryCategories, inventoryConditions } from './inventory-data.js'

export const initialInventoryFilters = {
  query: '',
  category: 'all',
  condition: 'all',
  stockAlert: 'all',
}

export const initialInventoryMovementFilters = {
  query: '',
  type: 'all',
  itemId: 'all',
  date: '',
}

const emptyInventoryFormValues = {
  name: '',
  category: inventoryCategories[0] ?? 'Khác',
  unit: 'cái',
  quantity: '0',
  lowStockThreshold: '0',
  condition: inventoryConditions[0] ?? 'Đang dùng',
  location: '',
  note: '',
}

const inventoryMovementReasons = [
  'Mua mới',
  'Bổ sung tồn kho',
  'Hoàn trả',
  'Điều chỉnh tăng',
  'Cấp cho lớp học',
  'Sử dụng nội bộ',
  'Hỏng/mất',
  'Điều chỉnh giảm',
  'Khác',
]

const emptyInventoryMovementFormValues = {
  itemId: '',
  type: 'in',
  quantity: '',
  movementDate: getTodayDate(),
  reason: 'Mua mới',
  handledBy: 'Admin',
  costAmount: '',
  costMethod: 'Tiền mặt',
  supplierName: '',
  note: '',
}

export function createEmptyInventoryFormState() {
  return {
    mode: 'create',
    itemId: null,
    values: { ...emptyInventoryFormValues },
    errors: {},
  }
}

export function createEditInventoryFormState(item) {
  return {
    mode: 'edit',
    itemId: item.id,
    values: {
      name: item.name ?? '',
      category: item.category ?? inventoryCategories[0] ?? 'Khác',
      unit: item.unit ?? 'cái',
      quantity: String(getSafeQuantity(item.quantity)),
      lowStockThreshold: String(getSafeQuantity(item.lowStockThreshold)),
      condition: item.condition ?? inventoryConditions[0] ?? 'Đang dùng',
      location: item.location ?? '',
      note: item.note ?? '',
    },
    errors: {},
  }
}

export function createInventoryMovementFormState(item) {
  return {
    values: {
      ...emptyInventoryMovementFormValues,
      itemId: item?.id ?? '',
      itemName: item?.name ?? '',
      currentQuantity: String(getSafeQuantity(item?.quantity)),
      movementDate: getTodayDate(),
    },
    errors: {},
  }
}

export function renderInventoryModule(
  items,
  filters = initialInventoryFilters,
  formState = null,
  movementFormState = null,
  movements = [],
  movementFilters = initialInventoryMovementFilters,
  selectedMovementId = null,
  isHistoryPanelOpen = false,
) {
  const activeFilters = { ...initialInventoryFilters, ...filters, stockAlert: 'all' }
  const activeMovementFilters = { ...initialInventoryMovementFilters, ...movementFilters }
  const filteredItems = getFilteredInventoryItems(items, activeFilters)
  const filteredMovements = getFilteredInventoryMovements(movements, activeMovementFilters)
  const categories = getInventoryFilterCategories(items)
  const stats = getInventoryStats(items)
  const movementStats = getInventoryMovementStats(filteredMovements)
  const selectedMovement =
    (movements ?? []).find((movement) => movement.id === selectedMovementId) ?? null

  return `
    <section class="inventory-module inventory-main-table" aria-label="Kho hàng">
      <div class="inventory-main-topbar">
        <div class="inventory-stats" aria-label="Tổng quan kho">
          ${renderInventoryStat('Tổng mặt hàng', stats.itemCount, 'neutral')}
          ${renderInventoryStat('Tổng tồn', stats.totalQuantity, 'stock')}
          ${renderInventoryStat('Sắp hết', stats.lowStockCount, 'warning')}
          ${renderInventoryStat('Hết hàng', stats.outOfStockCount, 'danger')}
        </div>
        <div class="inventory-dashboard-actions">
          <button type="button" data-inventory-open-subwindow="movements">Mở lịch sử nhập/xuất</button>
          <button class="inventory-add-button" type="button" data-inventory-action="open-create">
            + Thêm vật tư
          </button>
        </div>
      </div>

      ${renderInventoryListSection(filteredItems, activeFilters, categories)}
      ${formState ? renderInventoryForm(formState, items) : ''}
      ${movementFormState ? renderInventoryMovementForm(movementFormState, items) : ''}
      ${
        isHistoryPanelOpen
          ? renderInventoryHistoryPanel(
              filteredMovements,
              movements,
              items,
              activeMovementFilters,
              movementStats,
              selectedMovement,
            )
          : ''
      }
    </section>
  `
}

export function renderInventoryListWindow(
  items,
  filters = initialInventoryFilters,
  formState = null,
  movementFormState = null,
) {
  const activeFilters = { ...initialInventoryFilters, ...filters }
  const filteredItems = getFilteredInventoryItems(items, activeFilters)
  const categories = getInventoryFilterCategories(items)

  return `
    <section class="inventory-module inventory-list-window" aria-labelledby="inventory-list-window-title">
      <div class="inventory-toolbar">
        <div>
          <h3 id="inventory-list-window-title">Danh sách vật tư</h3>
        </div>
        <div class="inventory-filter-grid" aria-label="Tìm kiếm và lọc vật tư kho">
          <label class="inventory-search-field">
            <span>Tìm kiếm</span>
            <input
              type="search"
              value="${escapeAttribute(activeFilters.query)}"
              placeholder="Tên, nhóm, vị trí, ghi chú, tình trạng"
              data-inventory-filter="query"
            />
          </label>
          <label>
            <span>Nhóm</span>
            <select data-inventory-filter="category">
              ${renderOption('all', 'Tất cả nhóm', activeFilters.category)}
              ${categories
                .map((category) => renderOption(category, category, activeFilters.category))
                .join('')}
            </select>
          </label>
          <label>
            <span>Tình trạng</span>
            <select data-inventory-filter="condition">
              ${renderOption('all', 'Tất cả tình trạng', activeFilters.condition)}
              ${inventoryConditions
                .map((condition) => renderOption(condition, condition, activeFilters.condition))
                .join('')}
            </select>
          </label>
          <button
            class="inventory-add-button"
            type="button"
            data-inventory-action="open-create"
          >
            + Thêm vật tư
          </button>
        </div>
      </div>

      ${renderInventoryListSection(filteredItems, activeFilters, categories)}
      ${formState ? renderInventoryForm(formState, items) : ''}
      ${movementFormState ? renderInventoryMovementForm(movementFormState, items) : ''}
    </section>
  `
}

export function renderInventoryMovementsWindow(
  items,
  movements = [],
  movementFilters = initialInventoryMovementFilters,
  selectedMovementId = null,
) {
  const activeMovementFilters = { ...initialInventoryMovementFilters, ...movementFilters }
  const filteredMovements = getFilteredInventoryMovements(movements, activeMovementFilters)
  const movementStats = getInventoryMovementStats(filteredMovements)
  const selectedMovement =
    (movements ?? []).find((movement) => movement.id === selectedMovementId) ?? null

  return `
    <section class="inventory-module inventory-movements-window" aria-labelledby="inventory-movements-title">
      ${renderInventoryMovementHistory(
        filteredMovements,
        movements,
        items,
        activeMovementFilters,
        movementStats,
      )}
      ${selectedMovement ? renderInventoryMovementDetail(selectedMovement, items) : ''}
    </section>
  `
}

function renderInventoryHistoryPanel(
  filteredMovements,
  allMovements,
  items,
  filters,
  stats,
  selectedMovement,
) {
  return `
    <div class="inventory-history-backdrop" role="presentation">
      <section class="inventory-history-panel" aria-label="Lịch sử nhập xuất kho">
        <div class="inventory-history-panel-header">
          <h4>Lịch sử nhập/xuất kho</h4>
          <button type="button" data-inventory-history-action="close" aria-label="Đóng lịch sử">×</button>
        </div>
        ${renderInventoryMovementHistory(filteredMovements, allMovements, items, filters, stats)}
      </section>
      ${selectedMovement ? renderInventoryMovementDetail(selectedMovement, items) : ''}
    </div>
  `
}

function renderInventoryListSection(filteredItems, activeFilters, categories = []) {
  return `
    <section class="inventory-list-section" aria-label="Danh sách vật tư">
      <div class="inventory-list-filters" aria-label="Tìm kiếm và lọc danh sách vật tư">
        <label class="inventory-search-field">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value="${escapeAttribute(activeFilters.query)}"
            placeholder="Tên, nhóm, vị trí, ghi chú, tình trạng"
            data-inventory-filter="query"
          />
        </label>
        <label>
          <span>Nhóm</span>
          <select data-inventory-filter="category">
            ${renderOption('all', 'Tất cả nhóm', activeFilters.category)}
            ${categories
              .map((category) => renderOption(category, category, activeFilters.category))
              .join('')}
          </select>
        </label>
        <label>
          <span>Tình trạng</span>
          <select data-inventory-filter="condition">
            ${renderOption('all', 'Tất cả tình trạng', activeFilters.condition)}
            ${inventoryConditions
              .map((condition) => renderOption(condition, condition, activeFilters.condition))
              .join('')}
          </select>
        </label>
      </div>
      ${
        filteredItems.length
          ? `
            <div class="inventory-table-wrap">
              <table class="inventory-table">
                <thead>
                  <tr>
                    <th>Hạng mục</th>
                    <th>Nhóm</th>
                    <th>Tồn kho</th>
                    <th>Định mức tối thiểu</th>
                    <th>Tình trạng</th>
                    <th>Vị trí</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredItems.map(renderInventoryRow).join('')}
                </tbody>
              </table>
            </div>
          `
          : '<div class="inventory-empty">Không có vật tư phù hợp.</div>'
      }
    </section>
  `
}

export function getFilteredInventoryItems(items, filters = initialInventoryFilters) {
  const activeFilters = { ...initialInventoryFilters, ...filters }
  const normalizedQuery = normalizeText(activeFilters.query)

  return [...(items ?? [])]
    .filter((item) => {
      const matchesCategory =
        activeFilters.category === 'all' || item.category === activeFilters.category
      const matchesCondition =
        activeFilters.condition === 'all' || item.condition === activeFilters.condition
      const matchesStockAlert =
        activeFilters.stockAlert === 'all' ||
        getStockState(item).key === activeFilters.stockAlert
      const matchesQuery =
        !normalizedQuery ||
        [item.name, item.category, item.location, item.note, item.condition].some((value) =>
          normalizeText(value).includes(normalizedQuery),
        )

      return matchesCategory && matchesCondition && matchesStockAlert && matchesQuery
    })
    .sort((firstItem, secondItem) => {
      const stockPriority = { out: 0, low: 1, ok: 2 }
      const priorityCompare =
        stockPriority[getStockState(firstItem).key] - stockPriority[getStockState(secondItem).key]

      if (priorityCompare !== 0) {
        return priorityCompare
      }

      return String(firstItem.name ?? '').localeCompare(String(secondItem.name ?? ''), 'vi')
    })
}

function getAttentionInventoryItems(items) {
  return [...(items ?? [])]
    .map((item) => ({
      item,
      stockState: getStockState(item),
    }))
    .filter(({ stockState }) => stockState.key === 'out' || stockState.key === 'low')
    .sort((firstEntry, secondEntry) => {
      const stateOrder = { out: 0, low: 1, ok: 2 }
      const stateCompare =
        stateOrder[firstEntry.stockState.key] - stateOrder[secondEntry.stockState.key]

      if (stateCompare !== 0) {
        return stateCompare
      }

      return getSafeQuantity(firstEntry.item.quantity) - getSafeQuantity(secondEntry.item.quantity)
    })
}

function renderInventoryAttentionPanel(attentionEntries) {
  const visibleEntries = attentionEntries.slice(0, 4)
  const hiddenCount = Math.max(0, attentionEntries.length - visibleEntries.length)

  return `
    <section class="inventory-attention-panel" aria-label="Vật tư cần chú ý">
      <div class="inventory-attention-header">
        <h4>Cần chú ý</h4>
        <span>${attentionEntries.length} vật tư</span>
      </div>
      ${
        visibleEntries.length
          ? `
            <div class="inventory-attention-list">
              ${visibleEntries.map(({ item, stockState }) => renderInventoryAttentionItem(item, stockState)).join('')}
            </div>
            ${
              hiddenCount
                ? `<p class="inventory-attention-more">+${hiddenCount} vật tư khác cần kiểm tra</p>`
                : ''
            }
          `
          : '<div class="inventory-attention-empty">Tồn kho đang ổn.</div>'
      }
    </section>
  `
}

function renderInventoryAttentionItem(item, stockState) {
  const quantity = getSafeQuantity(item.quantity)
  const threshold = getSafeQuantity(item.lowStockThreshold)

  return `
    <article class="inventory-attention-item is-${stockState.tone}">
      <div>
        <strong title="${escapeAttribute(item.name)}">${escapeHtml(item.name || 'Vật tư')}</strong>
        <span title="${escapeAttribute(item.category)}">${escapeHtml(item.category || 'Khác')}</span>
      </div>
      <div>
        <span class="inventory-stock-badge is-${stockState.tone}">${stockState.label}</span>
        <span>${quantity.toLocaleString('vi-VN')} ${escapeHtml(item.unit || '')} / định mức tối thiểu ${threshold.toLocaleString('vi-VN')}</span>
      </div>
      <span title="${escapeAttribute(item.location)}">${escapeHtml(item.location || '—')}</span>
    </article>
  `
}

function renderStockFilterButton(value, label, activeValue) {
  return `
    <button
      class="${String(value) === String(activeValue) ? 'active' : ''}"
      type="button"
      data-inventory-stock-alert="${escapeAttribute(value)}"
    >
      ${escapeHtml(label)}
    </button>
  `
}

export function getInventoryStats(items) {
  return (items ?? []).reduce(
    (stats, item) => {
      const quantity = getSafeQuantity(item.quantity)
      const threshold = getSafeQuantity(item.lowStockThreshold)

      stats.itemCount += 1
      stats.totalQuantity += quantity

      if (quantity <= 0) {
        stats.outOfStockCount += 1
      } else if (quantity <= threshold) {
        stats.lowStockCount += 1
      }

      return stats
    },
    {
      itemCount: 0,
      totalQuantity: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
  )
}

export function getFilteredInventoryMovements(
  movements,
  filters = initialInventoryMovementFilters,
) {
  const activeFilters = { ...initialInventoryMovementFilters, ...filters }
  const normalizedQuery = normalizeText(activeFilters.query)

  return [...(movements ?? [])]
    .filter((movement) => {
      const matchesType = activeFilters.type === 'all' || movement.type === activeFilters.type
      const matchesItem =
        activeFilters.itemId === 'all' || movement.itemId === activeFilters.itemId
      const matchesDate = !activeFilters.date || movement.movementDate === activeFilters.date
      const matchesQuery =
        !normalizedQuery ||
        [movement.itemName, movement.reason, movement.handledBy, movement.note].some((value) =>
          normalizeText(value).includes(normalizedQuery),
        )

      return matchesType && matchesItem && matchesDate && matchesQuery
    })
    .sort(compareInventoryMovements)
}

export function getInventoryMovementStats(movements) {
  return (movements ?? []).reduce(
    (stats, movement) => {
      const quantity = getSafeQuantity(movement.quantity)

      if (movement.type === 'out') {
        stats.outCount += 1
        stats.totalOutQuantity += quantity
      } else {
        stats.inCount += 1
        stats.totalInQuantity += quantity
      }

      return stats
    },
    {
      inCount: 0,
      outCount: 0,
      totalInQuantity: 0,
      totalOutQuantity: 0,
    },
  )
}

export function validateInventoryForm(values) {
  const errors = {}
  const quantity = parseInventoryInteger(values.quantity)
  const lowStockThreshold = parseInventoryInteger(values.lowStockThreshold)

  if (!String(values.name ?? '').trim()) {
    errors.name = 'Tên vật tư / tài sản không được để trống.'
  }

  if (!String(values.category ?? '').trim()) {
    errors.category = 'Nhóm là bắt buộc.'
  }

  if (!String(values.unit ?? '').trim()) {
    errors.unit = 'Đơn vị tính là bắt buộc.'
  }

  if (quantity === null) {
    errors.quantity = 'Số lượng tồn cần là số nguyên không âm.'
  }

  if (lowStockThreshold === null) {
    errors.lowStockThreshold = 'Định mức tối thiểu cần là số nguyên không âm.'
  }

  if (!String(values.condition ?? '').trim()) {
    errors.condition = 'Tình trạng là bắt buộc.'
  }

  return errors
}

export function buildInventoryItemFromForm(values, existingItem = null) {
  const now = new Date().toISOString()

  return {
    ...existingItem,
    id: existingItem?.id ?? createInventoryId(),
    name: String(values.name ?? '').trim(),
    category: String(values.category ?? '').trim(),
    unit: String(values.unit ?? '').trim(),
    quantity: parseInventoryInteger(values.quantity) ?? 0,
    lowStockThreshold: parseInventoryInteger(values.lowStockThreshold) ?? 0,
    condition: String(values.condition ?? '').trim(),
    location: String(values.location ?? '').trim(),
    note: String(values.note ?? '').trim(),
    createdAt: existingItem?.createdAt ?? now,
    updatedAt: now,
  }
}

export function validateInventoryMovementForm(values, items) {
  const errors = {}
  const item = (items ?? []).find((inventoryItem) => inventoryItem.id === values.itemId)
  const quantity = parsePositiveInventoryInteger(values.quantity)
  const costAmount = parseMoneyInput(values.costAmount)

  if (!item) {
    errors.itemId = 'Vật tư không hợp lệ hoặc đã bị xóa.'
  }

  if (values.type !== 'in' && values.type !== 'out') {
    errors.type = 'Loại thao tác không hợp lệ.'
  }

  if (quantity === null) {
    errors.quantity = 'Số lượng cần là số nguyên lớn hơn 0.'
  }

  if (!isValidDate(values.movementDate)) {
    errors.movementDate = 'Ngày nhập/xuất không hợp lệ.'
  }

  if (!String(values.handledBy ?? '').trim()) {
    errors.handledBy = 'Người thực hiện không được để trống.'
  }

  if (values.type === 'in' && costAmount === null) {
    errors.costAmount = 'Chi phí nhập kho cần là số không âm.'
  }

  if (item && values.type === 'out' && quantity !== null && quantity > getSafeQuantity(item.quantity)) {
    errors.quantity = 'Không thể xuất quá số lượng tồn hiện tại.'
  }

  return errors
}

export function buildInventoryMovementFromForm(values, item) {
  const now = new Date().toISOString()
  const beforeQuantity = getSafeQuantity(item?.quantity)
  const quantity = parsePositiveInventoryInteger(values.quantity) ?? 0
  const type = values.type === 'out' ? 'out' : 'in'
  const afterQuantity = type === 'out' ? beforeQuantity - quantity : beforeQuantity + quantity

  return {
    id: createInventoryMovementId(),
    itemId: item.id,
    itemName: item.name,
    type,
    quantity,
    movementDate: values.movementDate,
    reason: String(values.reason ?? '').trim() || 'Khác',
    handledBy: String(values.handledBy ?? '').trim() || 'Admin',
    note: String(values.note ?? '').trim(),
    costAmount: type === 'in' ? parseMoneyInput(values.costAmount) ?? 0 : 0,
    costMethod: type === 'in' ? String(values.costMethod ?? '').trim() || 'Tiền mặt' : '',
    supplierName: type === 'in' ? String(values.supplierName ?? '').trim() : '',
    beforeQuantity,
    afterQuantity,
    createdAt: now,
  }
}

export function applyInventoryMovementToItem(item, movement) {
  return {
    ...item,
    quantity: getSafeQuantity(movement.afterQuantity),
    updatedAt: new Date().toISOString(),
  }
}

function getInventoryFilterCategories(items) {
  return Array.from(
    new Set((items ?? []).map((item) => String(item.category ?? '').trim()).filter(Boolean)),
  ).sort((firstCategory, secondCategory) => firstCategory.localeCompare(secondCategory, 'vi'))
}

function renderInventoryRow(item) {
  const quantity = getSafeQuantity(item.quantity)
  const threshold = getSafeQuantity(item.lowStockThreshold)
  const stockState = getStockState(item)

  return `
    <tr class="inventory-row" data-inventory-item-id="${escapeAttribute(item.id)}" tabindex="0">
      <td title="${escapeAttribute(item.name)}">
        <strong>${escapeHtml(item.name || 'Vật tư')}</strong>
        <span>${escapeHtml(item.id || '')}</span>
      </td>
      <td title="${escapeAttribute(item.category)}">${escapeHtml(item.category || 'Khác')}</td>
      <td title="${quantity} ${escapeAttribute(item.unit)}">
        <span class="inventory-quantity">${quantity.toLocaleString('vi-VN')} ${escapeHtml(item.unit || '')}</span>
        <span class="inventory-stock-badge is-${stockState.tone}">${stockState.label}</span>
      </td>
      <td>${threshold.toLocaleString('vi-VN')}</td>
      <td title="${escapeAttribute(item.condition)}">
        <span class="inventory-condition-badge is-${getConditionTone(item.condition)}">
          ${escapeHtml(item.condition || 'Đang dùng')}
        </span>
      </td>
      <td title="${escapeAttribute(item.location)}">${escapeHtml(item.location || '—')}</td>
      <td title="${escapeAttribute(item.note)}">${escapeHtml(item.note || '—')}</td>
    </tr>
  `
}

function renderInventoryForm(formState, items) {
  const isEditMode = formState.mode === 'edit'
  const categories = getInventoryFormCategories(items, formState.values.category)
  const conditions = getInventoryFormConditions(formState.values.condition)

  return `
    <div class="inventory-form-backdrop" role="presentation">
      <form class="inventory-form-panel" data-inventory-form>
        <div class="inventory-form-header">
          <div>
            <h4>${isEditMode ? 'Sửa vật tư' : 'Thêm vật tư'}</h4>
          </div>
          <button type="button" data-inventory-action="cancel-form" aria-label="Đóng form">×</button>
        </div>
        <div class="inventory-form-grid">
          ${renderInventoryInputField('Tên vật tư / tài sản', 'name', formState, 'text', 'Ví dụ: Bộ bàn cờ tiêu chuẩn')}
          ${renderInventorySelectField('Nhóm', 'category', formState, categories)}
          ${renderInventoryInputField('Đơn vị tính', 'unit', formState, 'text', 'quyển, bộ, cái, tờ')}
          ${renderInventoryInputField('Số lượng tồn', 'quantity', formState, 'number', '0')}
          ${renderInventoryInputField('Định mức tối thiểu', 'lowStockThreshold', formState, 'number', '0')}
          ${renderInventorySelectField('Tình trạng', 'condition', formState, conditions)}
          ${renderInventoryInputField('Vị trí', 'location', formState, 'text', 'Tủ tài liệu lớp 1')}
          <label class="inventory-field span-full ${formState.errors.note ? 'has-error' : ''}">
            <span>Ghi chú</span>
            <textarea data-inventory-form-field="note">${escapeHtml(formState.values.note ?? '')}</textarea>
            ${renderFieldError(formState.errors.note)}
          </label>
        </div>
        ${renderFormErrors(formState.errors)}
        <div class="inventory-form-actions">
          ${
            isEditMode
              ? `
                <div class="inventory-form-left-actions">
                  <button class="inventory-movement-button" type="button" data-inventory-action="open-movement">Nhập/Xuất kho</button>
                  <button class="inventory-delete-button" type="button" data-inventory-action="delete-item">Xóa vật tư</button>
                </div>
              `
              : '<span></span>'
          }
          <div>
            <button type="button" data-inventory-action="cancel-form">Hủy</button>
            <button class="inventory-save-button" type="submit">${isEditMode ? 'Lưu thay đổi' : 'Lưu vật tư'}</button>
          </div>
        </div>
      </form>
    </div>
  `
}

function renderInventoryMovementForm(formState, items) {
  const item = (items ?? []).find((inventoryItem) => inventoryItem.id === formState.values.itemId)
  const currentQuantity = getSafeQuantity(item?.quantity ?? formState.values.currentQuantity)
  const isInbound = formState.values.type !== 'out'

  return `
    <div class="inventory-form-backdrop" role="presentation">
      <form class="inventory-form-panel inventory-movement-panel" data-inventory-movement-form>
        <div class="inventory-form-header">
          <div>
            <h4>Nhập/Xuất kho</h4>
            <p>Cập nhật số lượng tồn cho một vật tư hiện có, không ghi nhận chi phí.</p>
          </div>
          <button type="button" data-inventory-movement-action="cancel" aria-label="Đóng form">×</button>
        </div>
        <div class="inventory-movement-summary">
          <span>Vật tư</span>
          <strong title="${escapeAttribute(item?.name ?? formState.values.itemName)}">${escapeHtml(item?.name ?? formState.values.itemName ?? 'Vật tư')}</strong>
          <span>Tồn hiện tại</span>
          <strong>${currentQuantity.toLocaleString('vi-VN')} ${escapeHtml(item?.unit ?? '')}</strong>
        </div>
        <div class="inventory-form-grid">
          ${renderInventorySelectField('Loại thao tác', 'type', formState, ['in', 'out'], getMovementTypeLabel, 'inventory-movement-field')}
          ${renderInventoryInputField('Số lượng', 'quantity', formState, 'number', '1', 'inventory-movement-field')}
          ${renderInventoryInputField('Ngày nhập/xuất', 'movementDate', formState, 'date', '', 'inventory-movement-field')}
          ${renderInventorySelectField('Lý do', 'reason', formState, inventoryMovementReasons, null, 'inventory-movement-field')}
          ${renderInventoryInputField('Người thực hiện', 'handledBy', formState, 'text', 'Admin', 'inventory-movement-field')}
          ${
            isInbound
              ? `
                ${renderInventoryInputField('Chi phí nhập kho', 'costAmount', formState, 'text', '0', 'inventory-movement-field')}
                ${renderInventorySelectField('Phương thức thanh toán', 'costMethod', formState, ['Tiền mặt', 'Chuyển khoản', 'Khác'], null, 'inventory-movement-field')}
                ${renderInventoryInputField('Nhà cung cấp / nơi mua', 'supplierName', formState, 'text', 'Nhà cung cấp', 'inventory-movement-field')}
              `
              : ''
          }
          <label class="inventory-field ${formState.errors.note ? 'has-error' : ''}">
            <span>Ghi chú</span>
            <textarea data-inventory-movement-field="note">${escapeHtml(formState.values.note ?? '')}</textarea>
            ${renderFieldError(formState.errors.note)}
          </label>
        </div>
        ${renderFormErrors(formState.errors)}
        <div class="inventory-form-actions">
          <span></span>
          <div>
            <button type="button" data-inventory-movement-action="cancel">Hủy</button>
            <button class="inventory-save-button" type="submit">Lưu nhập/xuất</button>
          </div>
        </div>
      </form>
    </div>
  `
}

function renderInventoryInputField(
  label,
  name,
  formState,
  type = 'text',
  placeholder = '',
  dataAttribute = 'inventory-form-field',
) {
  const isNumber = type === 'number'

  return `
    <label class="inventory-field ${formState.errors[name] ? 'has-error' : ''}">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        placeholder="${escapeAttribute(placeholder)}"
        ${isNumber ? 'min="0" step="1" inputmode="numeric"' : ''}
        data-${dataAttribute}="${name}"
      />
      ${renderFieldError(formState.errors[name])}
    </label>
  `
}

function renderInventorySelectField(
  label,
  name,
  formState,
  options,
  labelGetter = null,
  dataAttribute = 'inventory-form-field',
) {
  return `
    <label class="inventory-field ${formState.errors[name] ? 'has-error' : ''}">
      <span>${label}</span>
      <select data-${dataAttribute}="${name}">
        ${options
          .map((option) =>
            renderOption(option, labelGetter ? labelGetter(option) : option, formState.values[name]),
          )
          .join('')}
      </select>
      ${renderFieldError(formState.errors[name])}
    </label>
  `
}

function renderInventoryMovementHistory(
  filteredMovements,
  allMovements,
  items,
  filters,
  stats,
) {
  return `
    <section class="inventory-movement-history" aria-label="Lịch sử nhập xuất kho">
      <div class="inventory-history-filters" aria-label="Tìm kiếm và lọc lịch sử nhập xuất kho">
        <label class="inventory-history-search">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value="${escapeAttribute(filters.query)}"
            placeholder="Vật tư, lý do, người thực hiện, ghi chú"
            data-inventory-movement-filter="query"
          />
        </label>
        <label>
          <span>Loại</span>
          <select data-inventory-movement-filter="type">
            ${renderOption('all', 'Tất cả', filters.type)}
            ${renderOption('in', 'Nhập kho', filters.type)}
            ${renderOption('out', 'Xuất kho', filters.type)}
          </select>
        </label>
        <label>
          <span>Vật tư</span>
          <select data-inventory-movement-filter="itemId">
            ${renderOption('all', 'Tất cả vật tư', filters.itemId)}
            ${getInventoryMovementItemOptions(allMovements, items)
              .map((option) => renderOption(option.id, option.name, filters.itemId))
              .join('')}
          </select>
        </label>
        <label>
          <span>Ngày</span>
          <input
            type="date"
            value="${escapeAttribute(filters.date)}"
            data-inventory-movement-filter="date"
          />
        </label>
      </div>
      <div class="inventory-history-summary" aria-label="Tóm tắt lịch sử theo bộ lọc hiện tại">
        Nhập: ${stats.inCount.toLocaleString('vi-VN')} lượt / ${stats.totalInQuantity.toLocaleString('vi-VN')} SL
        <span>·</span>
        Xuất: ${stats.outCount.toLocaleString('vi-VN')} lượt / ${stats.totalOutQuantity.toLocaleString('vi-VN')} SL
      </div>
      ${
        filteredMovements.length
          ? `
            <div class="inventory-history-list">
              <div class="inventory-history-table-head">
                <span>Ngày</span>
                <span>Loại</span>
                <span>Vật tư</span>
                <span>Số lượng</span>
                <span>Tồn trước → sau</span>
                <span>Lý do</span>
                <span>Người thực hiện</span>
                <span>Ghi chú</span>
              </div>
              ${filteredMovements.map((movement) => renderInventoryMovementHistoryItem(movement, items)).join('')}
            </div>
          `
          : '<div class="inventory-history-empty">Không có lịch sử nhập/xuất phù hợp.</div>'
      }
    </section>
  `
}

function renderInventoryMovementHistoryItem(movement, items) {
  const item = (items ?? []).find((inventoryItem) => inventoryItem.id === movement.itemId)
  const unit = item?.unit ? ` ${item.unit}` : ''
  const noteText = movement.costAmount > 0
    ? `Chi phí: ${formatMoney(movement.costAmount)}${movement.note ? ` · ${movement.note}` : ''}`
    : movement.note || '—'

  return `
    <button
      class="inventory-history-item is-${movement.type}"
      type="button"
      data-inventory-movement-id="${escapeAttribute(movement.id)}"
    >
      <span>${formatDate(movement.movementDate)}</span>
      <span class="inventory-movement-type is-${movement.type}">${getMovementTypeLabel(movement.type)}</span>
      <strong title="${escapeAttribute(movement.itemName)}">${escapeHtml(movement.itemName || 'Vật tư')}</strong>
      <span>${getMovementSign(movement.type)}${getSafeQuantity(movement.quantity).toLocaleString('vi-VN')}${escapeHtml(unit)}</span>
      <span>${getSafeQuantity(movement.beforeQuantity).toLocaleString('vi-VN')} → ${getSafeQuantity(movement.afterQuantity).toLocaleString('vi-VN')}</span>
      <span title="${escapeAttribute(movement.reason)}">${escapeHtml(movement.reason || 'Khác')}</span>
      <span title="${escapeAttribute(movement.handledBy)}">${escapeHtml(movement.handledBy || 'Admin')}</span>
      <span title="${escapeAttribute(noteText)}">${escapeHtml(noteText)}</span>
    </button>
  `
}

function renderInventoryMovementDetail(movement, items) {
  const item = (items ?? []).find((inventoryItem) => inventoryItem.id === movement.itemId)
  const unit = item?.unit ? ` ${item.unit}` : ''

  return `
    <div class="inventory-form-backdrop" role="presentation">
      <section class="inventory-form-panel inventory-movement-detail-panel" aria-label="Chi tiết nhập xuất kho">
        <div class="inventory-form-header">
          <div>
            <h4>Chi tiết nhập/xuất kho</h4>
            <p>Bản ghi chỉ đọc, không sửa/xóa ở phase 5D.</p>
          </div>
          <button type="button" data-inventory-movement-detail-action="close" aria-label="Đóng chi tiết">×</button>
        </div>
        <div class="inventory-movement-detail-grid">
          ${renderMovementDetailField('Vật tư', movement.itemName || item?.name || 'Vật tư')}
          ${renderMovementDetailField('Loại thao tác', getMovementTypeLabel(movement.type))}
          ${renderMovementDetailField('Số lượng', `${getMovementSign(movement.type)}${getSafeQuantity(movement.quantity).toLocaleString('vi-VN')}${unit}`)}
          ${renderMovementDetailField('Ngày', formatDate(movement.movementDate))}
          ${renderMovementDetailField('Tồn trước', getSafeQuantity(movement.beforeQuantity).toLocaleString('vi-VN'))}
          ${renderMovementDetailField('Tồn sau', getSafeQuantity(movement.afterQuantity).toLocaleString('vi-VN'))}
          ${renderMovementDetailField('Lý do', movement.reason || 'Khác')}
          ${renderMovementDetailField('Người thực hiện', movement.handledBy || 'Admin')}
          ${
            movement.costAmount > 0
              ? `
                ${renderMovementDetailField('Chi phí', formatMoney(movement.costAmount))}
                ${renderMovementDetailField('Phương thức thanh toán', movement.costMethod || 'Tiền mặt')}
                ${renderMovementDetailField('Nhà cung cấp / nơi mua', movement.supplierName || '—', true)}
              `
              : ''
          }
          ${renderMovementDetailField('Ghi chú', movement.note || '—', true)}
          ${renderMovementDetailField('Thời gian tạo', formatDateTime(movement.createdAt), true)}
        </div>
        <div class="inventory-form-actions">
          <span></span>
          <div>
            <button class="inventory-save-button" type="button" data-inventory-movement-detail-action="close">Đóng</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderMovementDetailField(label, value, wide = false) {
  return `
    <div class="inventory-movement-detail-field ${wide ? 'span-full' : ''}">
      <span>${label}</span>
      <strong title="${escapeAttribute(value)}">${escapeHtml(value)}</strong>
    </div>
  `
}

function renderFieldError(error) {
  return error ? `<small>${escapeHtml(error)}</small>` : ''
}

function renderFormErrors(errors) {
  const errorMessages = Object.values(errors ?? {}).filter(Boolean)

  if (!errorMessages.length) {
    return ''
  }

  return `
    <div class="inventory-form-errors">
      ${errorMessages.map((error) => `<p>${escapeHtml(error)}</p>`).join('')}
    </div>
  `
}

function getInventoryFormCategories(items, currentCategory = '') {
  const categories = new Set([...inventoryCategories, ...getInventoryFilterCategories(items)])

  if (String(currentCategory ?? '').trim()) {
    categories.add(String(currentCategory).trim())
  }

  return Array.from(categories)
}

function getInventoryFormConditions(currentCondition = '') {
  const conditions = new Set(inventoryConditions)

  if (String(currentCondition ?? '').trim()) {
    conditions.add(String(currentCondition).trim())
  }

  return Array.from(conditions)
}

function getStockState(item) {
  const quantity = getSafeQuantity(item.quantity)
  const threshold = getSafeQuantity(item.lowStockThreshold)

  if (quantity <= 0) {
    return { key: 'out', label: 'Hết hàng', tone: 'danger' }
  }

  if (quantity <= threshold) {
    return { key: 'low', label: 'Sắp hết', tone: 'warning' }
  }

  return { key: 'ok', label: 'Đủ dùng', tone: 'success' }
}

function getConditionTone(condition) {
  const normalizedCondition = normalizeText(condition)

  if (normalizedCondition.includes('het hang')) {
    return 'danger'
  }

  if (normalizedCondition.includes('can bo sung')) {
    return 'warning'
  }

  if (normalizedCondition.includes('hong') || normalizedCondition.includes('kiem tra')) {
    return 'check'
  }

  return 'active'
}

function renderInventoryStat(label, value, tone) {
  return `
    <div class="inventory-stat-card is-${tone}">
      <span>${label}</span>
      <strong>${Number(value || 0).toLocaleString('vi-VN')}</strong>
    </div>
  `
}

function renderInventoryHistoryStat(label, value, tone) {
  return `
    <div class="inventory-history-stat is-${tone}">
      <span>${label}</span>
      <strong>${Number(value || 0).toLocaleString('vi-VN')}</strong>
    </div>
  `
}

function getInventoryMovementItemOptions(movements, items) {
  const itemOptions = new Map()

  ;(items ?? []).forEach((item) => {
    if (item.id) {
      itemOptions.set(item.id, item.name || 'Vật tư')
    }
  })

  ;(movements ?? []).forEach((movement) => {
    if (movement.itemId) {
      itemOptions.set(movement.itemId, movement.itemName || itemOptions.get(movement.itemId) || 'Vật tư')
    }
  })

  return Array.from(itemOptions, ([id, name]) => ({ id, name })).sort((firstOption, secondOption) =>
    firstOption.name.localeCompare(secondOption.name, 'vi'),
  )
}

function compareInventoryMovements(firstMovement, secondMovement) {
  const dateCompare = String(secondMovement.movementDate ?? '').localeCompare(
    String(firstMovement.movementDate ?? ''),
  )

  if (dateCompare !== 0) {
    return dateCompare
  }

  return new Date(secondMovement.createdAt) - new Date(firstMovement.createdAt)
}

function renderOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${
    String(value) === String(selectedValue) ? 'selected' : ''
  }>${escapeHtml(label)}</option>`
}

function getSafeQuantity(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0
}

function parseInventoryInteger(value) {
  const text = String(value ?? '').trim()

  if (!/^\d+$/.test(text)) {
    return null
  }

  const numberValue = Number(text)
  return Number.isSafeInteger(numberValue) && numberValue >= 0 ? numberValue : null
}

function parsePositiveInventoryInteger(value) {
  const numberValue = parseInventoryInteger(value)
  return numberValue && numberValue > 0 ? numberValue : null
}

function parseMoneyInput(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    return 0
  }

  if (text.startsWith('-')) {
    return null
  }

  const normalizedDigits = text.replace(/[^\d]/g, '')

  if (!normalizedDigits) {
    return null
  }

  const amount = Number(normalizedDigits)
  return Number.isFinite(amount) ? amount : null
}

function createInventoryId() {
  return `inventory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createInventoryMovementId() {
  return `inventory-movement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) {
    return false
  }

  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function getMovementTypeLabel(type) {
  return type === 'out' ? 'Xuất kho' : 'Nhập kho'
}

function getMovementSign(type) {
  return type === 'out' ? '-' : '+'
}

function formatDate(value) {
  const [year, month, day] = String(value ?? '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

function formatDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('vi-VN')} VNĐ`
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/"/g, '&quot;')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
