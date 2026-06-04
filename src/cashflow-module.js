import { cashflowMethods } from './cashflow-data.js'

export const initialCashflowFilters = {
  query: '',
  type: 'all',
  category: 'all',
  date: '',
}

export const emptyCashflowFormValues = {
  type: 'income',
  category: '',
  amount: '',
  transactionDate: getTodayDate(),
  method: 'Tiền mặt',
  personName: '',
  recordedBy: 'Admin DreamHome',
  note: '',
}

export const emptyCashflowCategoryFormValues = {
  name: '',
  type: 'both',
}

export function createEmptyCashflowFormState() {
  return createEmptyCashflowFormStateWithCategories()
}

export function createEmptyCashflowFormStateWithCategories(categories = []) {
  const defaultCategory = getDefaultCategoryNameForType(categories, 'income') || 'Học phí'

  return {
    mode: 'create',
    transactionId: null,
    values: {
      ...emptyCashflowFormValues,
      category: defaultCategory,
      transactionDate: getTodayDate(),
    },
    errors: {},
  }
}

export function createEditCashflowFormState(transaction) {
  return {
    mode: 'edit',
    transactionId: transaction.id,
    values: {
      type: transaction.type ?? 'income',
      category: transaction.category ?? 'Khác',
      amount: formatAmountForInput(transaction.amount),
      transactionDate: transaction.transactionDate ?? getTodayDate(),
      method: transaction.method ?? 'Tiền mặt',
      personName: transaction.personName ?? '',
      recordedBy: transaction.recordedBy ?? 'Admin DreamHome',
      note: transaction.note ?? '',
    },
    errors: {},
  }
}

export function createEmptyCashflowCategoryFormState() {
  return {
    mode: 'create',
    categoryId: null,
    values: { ...emptyCashflowCategoryFormValues },
    errors: {},
  }
}

export function createEditCashflowCategoryFormState(category) {
  return {
    mode: 'edit',
    categoryId: category.id,
    values: {
      name: category.name ?? '',
      type: category.type ?? 'both',
    },
    errors: {},
  }
}

export function renderCashflowModule(
  transactions,
  filters = initialCashflowFilters,
  formState = null,
  categories = [],
  isCategoryPanelOpen = false,
  categoryFormState = createEmptyCashflowCategoryFormState(),
) {
  const activeFilters = { ...initialCashflowFilters, ...filters }
  const filteredTransactions = getFilteredCashflowTransactions(transactions, activeFilters)
  const stats = getCashflowStats(filteredTransactions)
  const filterCategories = getCashflowFilterCategories(categories, transactions)

  return `
    <section class="cashflow-module" aria-labelledby="cashflow-title">
      <div class="cashflow-toolbar">
        <div>
          <h3 id="cashflow-title">Thu chi</h3>
          <p>Ghi nhận giao dịch thu/chi của cơ sở DreamHome, bao gồm khoản thu học phí được đồng bộ tự động.</p>
        </div>
        <div class="cashflow-toolbar-actions">
          <button class="cashflow-category-button" type="button" data-cashflow-action="open-categories">
            Danh mục
          </button>
          <button class="cashflow-add-button" type="button" data-cashflow-action="open-create">
            + Thêm giao dịch
          </button>
        </div>
        <div class="cashflow-filter-grid" aria-label="Tìm kiếm và lọc giao dịch thu chi">
          <label class="cashflow-search-field">
            <span>Tìm kiếm</span>
            <input
              type="search"
              value="${escapeAttribute(activeFilters.query)}"
              placeholder="Danh mục, người liên quan, người ghi nhận, phương thức, ghi chú"
              data-cashflow-filter="query"
            />
          </label>
          <label>
            <span>Loại</span>
            <select data-cashflow-filter="type">
              ${renderOption('all', 'Tất cả', activeFilters.type)}
              ${renderOption('income', 'Thu', activeFilters.type)}
              ${renderOption('expense', 'Chi', activeFilters.type)}
            </select>
          </label>
          <label>
            <span>Danh mục</span>
            <select data-cashflow-filter="category">
              ${renderOption('all', 'Tất cả danh mục', activeFilters.category)}
              ${filterCategories
                .map((category) =>
                  renderOption(category.name, getCategoryOptionLabel(category), activeFilters.category),
                )
                .join('')}
            </select>
          </label>
          <label>
            <span>Ngày</span>
            <input
              type="date"
              value="${escapeAttribute(activeFilters.date)}"
              data-cashflow-filter="date"
            />
          </label>
        </div>
      </div>

      <div class="cashflow-stats" aria-label="Tổng hợp thu chi theo bộ lọc hiện tại">
        ${renderStatChip('Tổng thu', formatMoney(stats.totalIncome), 'income')}
        ${renderStatChip('Tổng chi', formatMoney(stats.totalExpense), 'expense')}
        ${renderStatChip('Chênh lệch', formatSignedMoney(stats.balance), stats.balance >= 0 ? 'income' : 'expense')}
        ${renderStatChip('Số giao dịch', `${stats.count}`, '')}
      </div>

      <div class="cashflow-table-wrap">
        <table class="cashflow-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Loại</th>
              <th>Danh mục</th>
              <th>Nội dung / Người liên quan</th>
              <th title="Phương thức">P.thức</th>
              <th>Số tiền</th>
              <th title="Người ghi nhận">Ghi nhận</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredTransactions.length
                ? filteredTransactions.map(renderTransactionRow).join('')
                : renderEmptyState()
            }
          </tbody>
        </table>
      </div>
      ${formState ? renderCashflowForm(formState, categories) : ''}
      ${
        isCategoryPanelOpen
          ? renderCategoryPanel(categories, transactions, categoryFormState)
          : ''
      }
    </section>
  `
}

export function getFilteredCashflowTransactions(transactions, filters = initialCashflowFilters) {
  const activeFilters = { ...initialCashflowFilters, ...filters }
  const normalizedQuery = normalizeText(activeFilters.query)
  const queryDigits = String(activeFilters.query ?? '').replace(/\D/g, '')

  return [...transactions]
    .filter((transaction) => {
      const matchesType = activeFilters.type === 'all' || transaction.type === activeFilters.type
      const matchesCategory =
        activeFilters.category === 'all' || transaction.category === activeFilters.category
      const matchesDate =
        !activeFilters.date || transaction.transactionDate === activeFilters.date
      const matchesQuery =
        !normalizedQuery ||
        [
          transaction.category,
          transaction.personName,
          transaction.recordedBy,
          transaction.method,
          transaction.note,
          formatMoney(transaction.amount),
        ].some((value) => normalizeText(value).includes(normalizedQuery)) ||
        (queryDigits && String(transaction.amount).includes(queryDigits))

      return matchesType && matchesCategory && matchesDate && matchesQuery
    })
    .sort(
      (firstTransaction, secondTransaction) =>
        new Date(secondTransaction.transactionDate) - new Date(firstTransaction.transactionDate) ||
        new Date(secondTransaction.createdAt) - new Date(firstTransaction.createdAt),
    )
}

export function getCashflowStats(transactions) {
  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0)
  const totalExpense = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0)

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    count: transactions.length,
  }
}

export function formatCashflowMoney(amount) {
  return formatMoney(amount)
}

export function validateCashflowForm(values) {
  const errors = {}
  const amount = parseMoneyInput(values.amount)
  const validTypes = ['income', 'expense']

  if (!validTypes.includes(values.type)) {
    errors.type = 'Loại giao dịch không hợp lệ.'
  }

  if (!String(values.category ?? '').trim()) {
    errors.category = 'Danh mục là bắt buộc.'
  }

  if (!amount || amount <= 0) {
    errors.amount = 'Số tiền cần lớn hơn 0.'
  }

  if (!isValidDate(values.transactionDate)) {
    errors.transactionDate = 'Ngày giao dịch không hợp lệ.'
  }

  if (!String(values.recordedBy ?? '').trim()) {
    errors.recordedBy = 'Người ghi nhận là bắt buộc.'
  }

  return errors
}

export function validateCashflowCategoryForm(values, categories, editingCategoryId = null) {
  const errors = {}
  const name = String(values.name ?? '').trim()
  const validTypes = ['income', 'expense', 'both']
  const normalizedName = normalizeText(name)
  const duplicatedCategory = categories.find(
    (category) =>
      !category.isArchived &&
      category.id !== editingCategoryId &&
      normalizeText(category.name) === normalizedName,
  )

  if (!name) {
    errors.name = 'Tên danh mục là bắt buộc.'
  }

  if (duplicatedCategory) {
    errors.name = 'Danh mục đang hoạt động đã tồn tại.'
  }

  if (!validTypes.includes(values.type)) {
    errors.type = 'Loại danh mục không hợp lệ.'
  }

  return errors
}

export function buildCashflowTransactionFromForm(values, existingTransaction = null) {
  const now = new Date().toISOString()

  return {
    id: existingTransaction?.id ?? createCashflowId(),
    ...existingTransaction,
    type: values.type === 'expense' ? 'expense' : 'income',
    category: String(values.category ?? '').trim() || 'Khác',
    amount: parseMoneyInput(values.amount),
    transactionDate: values.transactionDate,
    method: String(values.method ?? '').trim() || 'Khác',
    personName: String(values.personName ?? '').trim(),
    recordedBy: String(values.recordedBy ?? '').trim(),
    note: String(values.note ?? '').trim(),
    sourceModule: existingTransaction?.sourceModule ?? 'manual',
    createdAt: existingTransaction?.createdAt ?? now,
    updatedAt: now,
  }
}

export function buildCashflowCategoryFromForm(values, existingCategory = null) {
  const now = new Date().toISOString()

  return {
    id: existingCategory?.id ?? createCashflowCategoryId(),
    ...existingCategory,
    name: String(values.name ?? '').trim(),
    type: ['income', 'expense', 'both'].includes(values.type) ? values.type : 'both',
    isArchived: existingCategory?.isArchived ?? false,
    createdAt: existingCategory?.createdAt ?? now,
    updatedAt: now,
  }
}

export function getAvailableCashflowCategoriesForType(categories, type, currentCategoryName = '') {
  const availableCategories = categories.filter(
    (category) =>
      !category.isArchived && (category.type === 'both' || category.type === type),
  )
  const currentCategory = categories.find((category) => category.name === currentCategoryName)

  if (
    currentCategoryName &&
    currentCategory &&
    !availableCategories.some((category) => category.name === currentCategoryName)
  ) {
    return [...availableCategories, currentCategory]
  }

  if (
    currentCategoryName &&
    !currentCategory &&
    !availableCategories.some((category) => category.name === currentCategoryName)
  ) {
    return [
      ...availableCategories,
      {
        id: `legacy-${normalizeText(currentCategoryName)}`,
        name: currentCategoryName,
        type: 'both',
        isArchived: true,
      },
    ]
  }

  return availableCategories
}

export function getDefaultCategoryNameForType(categories, type) {
  return getAvailableCashflowCategoriesForType(categories, type)[0]?.name ?? ''
}

function createCashflowId() {
  return `cashflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createCashflowCategoryId() {
  return `cash-cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function parseCashflowMoneyInput(value) {
  return parseMoneyInput(value)
}

function renderCashflowForm(formState, categories = []) {
  const isEditMode = formState.mode === 'edit'
  const categoryOptions = getAvailableCashflowCategoriesForType(
    categories,
    formState.values.type,
    formState.values.category,
  )

  return `
    <div class="cashflow-form-backdrop" role="presentation">
      <form class="cashflow-form-panel" data-cashflow-form>
        <div class="cashflow-form-header">
          <div>
            <h4>${isEditMode ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h4>
            <p>${isEditMode ? 'Cập nhật giao dịch thu/chi thủ công.' : 'Nhập giao dịch thu/chi thủ công mới.'}</p>
          </div>
          <button type="button" data-cashflow-action="cancel-form" aria-label="Đóng form">×</button>
        </div>
        <div class="cashflow-form-grid">
          ${renderSelectField('Loại giao dịch', 'type', formState, [
            ['income', 'Thu'],
            ['expense', 'Chi'],
          ])}
          ${renderSelectField(
            'Danh mục',
            'category',
            formState,
            categoryOptions.map((category) => [
              category.name,
              getCategoryOptionLabel(category),
            ]),
          )}
          ${renderInputField('Số tiền', 'amount', formState, 'text', 'Ví dụ: 1.200.000')}
          ${renderInputField('Ngày giao dịch', 'transactionDate', formState, 'date')}
          ${renderSelectField(
            'Phương thức',
            'method',
            formState,
            cashflowMethods.map((method) => [method, method]),
          )}
          ${renderInputField('Người liên quan', 'personName', formState, 'text', 'Phụ huynh, giáo viên, nhà cung cấp')}
          ${renderInputField('Người ghi nhận', 'recordedBy', formState)}
          <label class="cashflow-field cashflow-field-wide">
            <span>Ghi chú</span>
            <textarea data-cashflow-form-field="note">${escapeHtml(formState.values.note ?? '')}</textarea>
          </label>
        </div>
        ${renderFormErrors(formState.errors)}
        <div class="cashflow-form-actions">
          ${
            isEditMode
              ? '<button class="cashflow-delete-button" type="button" data-cashflow-action="delete-transaction">Xóa giao dịch</button>'
              : '<span></span>'
          }
          <div>
            <button type="button" data-cashflow-action="cancel-form">Hủy</button>
            <button class="cashflow-save-button" type="submit">Lưu giao dịch</button>
          </div>
        </div>
      </form>
    </div>
  `
}

function renderCategoryPanel(categories, transactions, categoryFormState) {
  const isEditMode = categoryFormState.mode === 'edit'

  return `
    <div class="cashflow-form-backdrop" role="presentation">
      <section class="cashflow-category-panel" aria-label="Danh mục thu chi">
        <div class="cashflow-form-header">
          <div>
            <h4>Danh mục thu chi</h4>
            <p>Quản lý danh mục dùng cho form và bộ lọc Thu chi.</p>
          </div>
          <button type="button" data-cashflow-category-action="close" aria-label="Đóng danh mục">×</button>
        </div>
        <div class="cashflow-category-layout">
          <form class="cashflow-category-form" data-cashflow-category-form>
            <h5>${isEditMode ? 'Sửa danh mục' : 'Thêm danh mục'}</h5>
            ${renderCategoryInputField('Tên danh mục', 'name', categoryFormState)}
            ${renderCategorySelectField('Loại danh mục', 'type', categoryFormState)}
            ${renderFormErrors(categoryFormState.errors)}
            <div class="cashflow-category-form-actions">
              ${
                isEditMode
                  ? '<button type="button" data-cashflow-category-action="reset-form">Thêm mới</button>'
                  : '<span></span>'
              }
              <button class="cashflow-save-button" type="submit">
                ${isEditMode ? 'Lưu danh mục' : 'Thêm danh mục'}
              </button>
            </div>
          </form>
          <div class="cashflow-category-list">
            ${categories.map((category) => renderCategoryItem(category, transactions)).join('')}
          </div>
        </div>
      </section>
    </div>
  `
}

function renderCategoryItem(category, transactions) {
  const transactionCount = transactions.filter(
    (transaction) => transaction.category === category.name,
  ).length

  return `
    <article class="cashflow-category-item ${category.isArchived ? 'is-archived' : ''}">
      <div>
        <strong title="${escapeAttribute(category.name)}">${escapeHtml(category.name)}</strong>
        <span>${getCategoryTypeLabel(category.type)} · ${category.isArchived ? 'Đã ẩn' : 'Đang dùng'} · ${transactionCount} giao dịch</span>
      </div>
      <div>
        <button type="button" data-cashflow-category-action="edit" data-cashflow-category-id="${category.id}">
          Sửa
        </button>
        <button type="button" data-cashflow-category-action="archive" data-cashflow-category-id="${category.id}" ${category.isArchived ? 'disabled' : ''}>
          Ẩn
        </button>
      </div>
    </article>
  `
}

function renderCategoryInputField(label, name, formState) {
  return `
    <label class="cashflow-field">
      <span>${label}</span>
      <input
        type="text"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        data-cashflow-category-field="${name}"
      />
      ${renderFieldError(formState.errors[name])}
    </label>
  `
}

function renderCategorySelectField(label, name, formState) {
  return `
    <label class="cashflow-field">
      <span>${label}</span>
      <select data-cashflow-category-field="${name}">
        ${[
          ['income', 'Thu'],
          ['expense', 'Chi'],
          ['both', 'Cả hai'],
        ]
          .map(([value, optionLabel]) => renderOption(value, optionLabel, formState.values[name]))
          .join('')}
      </select>
      ${renderFieldError(formState.errors[name])}
    </label>
  `
}

function renderInputField(label, name, formState, type = 'text', placeholder = '') {
  return `
    <label class="cashflow-field">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        placeholder="${escapeAttribute(placeholder)}"
        data-cashflow-form-field="${name}"
      />
      ${renderFieldError(formState.errors[name])}
    </label>
  `
}

function renderSelectField(label, name, formState, options) {
  return `
    <label class="cashflow-field">
      <span>${label}</span>
      <select data-cashflow-form-field="${name}">
        ${options.map(([value, optionLabel]) => renderOption(value, optionLabel, formState.values[name])).join('')}
      </select>
      ${renderFieldError(formState.errors[name])}
    </label>
  `
}

function renderFieldError(error) {
  return error ? `<small>${escapeHtml(error)}</small>` : ''
}

function renderFormErrors(errors) {
  const errorMessages = Object.values(errors).filter(Boolean)

  if (!errorMessages.length) {
    return ''
  }

  return `
    <div class="cashflow-form-errors">
      ${errorMessages.map((error) => `<p>${escapeHtml(error)}</p>`).join('')}
    </div>
  `
}

function renderTransactionRow(transaction) {
  return `
    <tr class="cashflow-row" data-cashflow-transaction-id="${transaction.id}" tabindex="0">
      <td>${formatDate(transaction.transactionDate)}</td>
      <td><span class="cashflow-type-badge is-${transaction.type}">${getTypeLabel(transaction.type)}</span></td>
      <td title="${escapeAttribute(transaction.category)}">${escapeHtml(transaction.category)}</td>
      <td title="${escapeAttribute(transaction.personName)}">${transaction.personName ? escapeHtml(transaction.personName) : '—'}</td>
      <td>${escapeHtml(transaction.method)}</td>
      <td class="cashflow-amount is-${transaction.type}">${formatMoney(transaction.amount)}</td>
      <td title="${escapeAttribute(transaction.recordedBy)}">${escapeHtml(getRecordedByDisplayName(transaction.recordedBy))}</td>
      <td title="${escapeAttribute(transaction.note)}">${renderTransactionNote(transaction)}</td>
    </tr>
  `
}

function renderTransactionNote(transaction) {
  const noteText = transaction.note ? escapeHtml(transaction.note) : '—'

  const sourceLabel = getSourceBadgeLabel(transaction.sourceModule)

  if (!sourceLabel) {
    return noteText
  }

  return `
    <span class="cashflow-source-badge">${sourceLabel}</span>
    <span>${noteText}</span>
  `
}

function getSourceBadgeLabel(sourceModule) {
  const labels = {
    'hoc-phi': 'Từ Học phí',
    'kho-hang': 'Từ Kho hàng',
  }

  return labels[sourceModule] ?? ''
}

function getRecordedByDisplayName(recordedBy) {
  const text = String(recordedBy ?? '').trim()

  if (text === 'Admin DreamHome') {
    return 'Admin'
  }

  return text || '—'
}

function renderStatChip(label, value, tone) {
  return `
    <div class="cashflow-stat-chip ${tone ? `is-${tone}` : ''}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `
}

function renderOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${
    String(value) === String(selectedValue) ? 'selected' : ''
  }>${escapeHtml(label)}</option>`
}

function getCashflowFilterCategories(categories, transactions) {
  const categoryMap = new Map()

  categories.forEach((category) => {
    if (!category.isArchived) {
      categoryMap.set(category.name, category)
    }
  })

  transactions.forEach((transaction) => {
    const category = categories.find((item) => item.name === transaction.category)

    if (category) {
      categoryMap.set(category.name, category)
      return
    }

    if (transaction.category) {
      categoryMap.set(transaction.category, {
        id: `legacy-${normalizeText(transaction.category)}`,
        name: transaction.category,
        type: 'both',
        isArchived: true,
      })
    }
  })

  return Array.from(categoryMap.values())
}

function getCategoryOptionLabel(category) {
  return category.isArchived ? `${category.name} (đã ẩn)` : category.name
}

function getCategoryTypeLabel(type) {
  const labels = {
    income: 'Thu',
    expense: 'Chi',
    both: 'Cả hai',
  }

  return labels[type] ?? 'Cả hai'
}

function renderEmptyState() {
  return `
    <tr>
      <td class="cashflow-empty" colspan="8">Không tìm thấy giao dịch phù hợp với bộ lọc hiện tại.</td>
    </tr>
  `
}

function getTypeLabel(type) {
  return type === 'expense' ? 'Chi' : 'Thu'
}

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('vi-VN')} VNĐ`
}

function formatSignedMoney(amount) {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}${formatMoney(Math.abs(amount))}`
}

function formatDate(value) {
  if (!value) {
    return '—'
  }

  const [year, month, day] = String(value).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function parseMoneyInput(value) {
  const normalizedValue = String(value ?? '').replace(/[^\d]/g, '')
  const amount = Number(normalizedValue)

  return Number.isFinite(amount) ? amount : 0
}

function formatAmountForInput(amount) {
  return Number(amount || 0).toLocaleString('vi-VN')
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
