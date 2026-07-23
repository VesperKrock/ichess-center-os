import { cashflowMethods } from './cashflow-data.js'
import { getUploaderDisplayName } from './uploader-display.js'

export const CASHFLOW_ATTACHMENT_MAX_SIZE = 1024 * 1024
export const CASHFLOW_EVIDENCE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

export const initialCashflowFilters = {
  query: '',
  type: 'all',
  category: 'all',
  date: '',
  periodMode: 'all',
  periodDate: getTodayDate(),
  periodWeek: getCurrentWeekInputValue(),
  periodMonth: getCurrentMonthInputValue(),
  periodQuarter: getCurrentQuarterValue(),
  periodYear: getCurrentYearValue(),
  rangeStart: '',
  rangeEnd: '',
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
  attachment: null,
}

export const emptyCashflowCategoryFormValues = {
  name: '',
  type: 'both',
}

export function createEmptyCashflowFormState() {
  return createEmptyCashflowFormStateWithCategories()
}

export function createEmptyCashflowFormStateWithCategories(categories = [], centerId = '') {
  const defaultCategory = getDefaultCategoryNameForType(categories, 'income') || 'Học phí'

  return {
    mode: 'create',
    transactionId: null,
    centerId: String(centerId || '').trim(),
    isSaving: false,
    attachmentDraft: createEmptyCashflowAttachmentDraft(),
    values: {
      ...emptyCashflowFormValues,
      category: defaultCategory,
      transactionDate: getTodayDate(),
    },
    errors: {},
  }
}

export function createEditCashflowFormState(
  transaction,
  centerId = '',
  { hydrateAttachment = false } = {},
) {
  const legacyAttachment = normalizeCashflowAttachment(transaction.attachment)

  return {
    mode: 'edit',
    transactionId: transaction.id,
    centerId: String(centerId || '').trim(),
    openedUpdatedAt: transaction.updatedAt || '',
    isSaving: false,
    attachmentDraft: hydrateAttachment
      ? createLoadingCashflowAttachmentDraft(legacyAttachment)
      : createCashflowAttachmentDraftFromExisting(legacyAttachment),
    values: {
      type: transaction.type ?? 'income',
      category: transaction.category ?? 'Khác',
      amount: formatAmountForInput(transaction.amount),
      transactionDate: transaction.transactionDate ?? getTodayDate(),
      method: transaction.method ?? 'Tiền mặt',
      personName: transaction.personName ?? '',
      recordedBy: transaction.recordedBy ?? 'Admin DreamHome',
      note: transaction.note ?? '',
      attachment: legacyAttachment,
    },
    errors: {},
  }
}

export function createEmptyCashflowAttachmentDraft() {
  return {
    mode: 'none',
    fileName: '',
    mimeType: '',
    sizeBytes: 0,
    objectUrl: '',
    existingAttachment: null,
    source: '',
    error: '',
    isUploading: false,
  }
}

export function createCashflowAttachmentDraftFromExisting(attachment, source = 'legacy') {
  const existingAttachment = normalizeCashflowAttachment(attachment)

  return {
    ...createEmptyCashflowAttachmentDraft(),
    mode: existingAttachment ? `keep-existing-${source}` : 'none',
    existingAttachment,
    source: existingAttachment ? source : '',
  }
}

export function createLoadingCashflowAttachmentDraft(legacyAttachment = null) {
  const existingAttachment = normalizeCashflowAttachment(legacyAttachment)

  return {
    ...createEmptyCashflowAttachmentDraft(),
    mode: 'loading',
    existingAttachment,
    source: existingAttachment ? 'legacy' : '',
  }
}

export function createErrorCashflowAttachmentDraft(error, legacyAttachment = null) {
  const existingAttachment = normalizeCashflowAttachment(legacyAttachment)

  return {
    ...createEmptyCashflowAttachmentDraft(),
    mode: existingAttachment ? 'keep-existing-legacy' : 'error',
    existingAttachment,
    source: existingAttachment ? 'legacy' : '',
    error: String(error || 'Không thể tải thông tin chứng từ'),
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
  cloudStatusHtml = '',
  cloudAttachmentOptions = {},
  imageManagerState = null,
  cloudGalleryState = null,
) {
  const activeFilters = { ...initialCashflowFilters, ...filters }
  const filteredTransactions = getFilteredCashflowTransactions(transactions, activeFilters)
  const stats = getCashflowStats(filteredTransactions)
  const filterCategories = getCashflowFilterCategories(categories, transactions)
  const periodLabel = getCashflowPeriodLabel(activeFilters)

  return `
    <section class="cashflow-module" aria-labelledby="cashflow-title">
      <div class="cashflow-toolbar">
        <div>
          <h3 id="cashflow-title">Thu chi</h3>
          <p>Ghi nhận giao dịch thu/chi của cơ sở DreamHome, bao gồm khoản thu học phí được đồng bộ tự động.</p>
        </div>
        <div class="cashflow-toolbar-actions">
          <button
            class="cashflow-export-button"
            type="button"
            data-cashflow-action="download-csv"
            ${filteredTransactions.length ? '' : 'disabled'}
            title="Xuất theo bộ lọc hiện tại"
          >
            Tải CSV
          </button>
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
          ${renderCashflowPeriodFilters(activeFilters)}
        </div>
      </div>

      ${cloudStatusHtml}
      ${periodLabel ? `<p class="cashflow-period-label">Kỳ: ${escapeHtml(periodLabel)}</p>` : ''}
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
              <th title="Phương thức thanh toán">THANH TOÁN</th>
              <th>Số tiền</th>
              <th title="Người ghi nhận">Ghi nhận</th>
              <th>Ghi chú</th>
              <th title="Ảnh giao dịch cloud">Ảnh cloud</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredTransactions.length
                ? filteredTransactions
                    .map((transaction) =>
                      renderTransactionRow(transaction, cloudAttachmentOptions),
                    )
                    .join('')
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
      ${imageManagerState ? renderTransactionImageManager(imageManagerState) : ''}
      ${cloudGalleryState ? renderCloudGallery(cloudGalleryState) : ''}
    </section>
  `
}

export function filterCloudGalleryAttachments(
  attachments = [],
  query = '',
  currentUser = null,
  memberProfileMap = {},
) {
  const normalizedQuery = normalizeText(query).trim()

  if (!normalizedQuery) {
    return attachments
  }

  return attachments.filter((attachment) => {
    const uploaderName = getUploaderDisplayName(
      attachment,
      currentUser,
      memberProfileMap,
    )
    const searchableText = [
      attachment.transactionCode,
      attachment.fileName,
      attachment.originalName,
      attachment.note,
      attachment.uploadedByName,
      uploaderName,
      attachment.cashflowType,
      attachment.amount,
    ]
      .map(normalizeText)
      .join(' ')

    return searchableText.includes(normalizedQuery)
  })
}

export function getFilteredCashflowTransactions(transactions, filters = initialCashflowFilters) {
  const activeFilters = { ...initialCashflowFilters, ...filters }
  const normalizedQuery = normalizeText(activeFilters.query)
  const queryDigits = String(activeFilters.query ?? '').replace(/\D/g, '')
  const periodRange = getCashflowPeriodRange(activeFilters)

  return [...transactions]
    .filter((transaction) => {
      const matchesType = activeFilters.type === 'all' || transaction.type === activeFilters.type
      const matchesCategory =
        activeFilters.category === 'all' || transaction.category === activeFilters.category
      const matchesDate =
        matchesTransactionPeriod(transaction.transactionDate, periodRange)
      const matchesQuery =
        !normalizedQuery ||
        [
          transaction.category,
          transaction.personName,
          transaction.recordedBy,
          transaction.method,
          transaction.note,
          getSourceBadgeLabel(transaction.sourceModule),
          transaction.attachment?.name,
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

export function getCashflowPeriodRange(filters = initialCashflowFilters) {
  const activeFilters = { ...initialCashflowFilters, ...filters }

  if (activeFilters.periodMode === 'day') {
    return isValidDate(activeFilters.periodDate)
      ? { startDate: activeFilters.periodDate, endDate: activeFilters.periodDate }
      : null
  }

  if (activeFilters.periodMode === 'week') {
    return getWeekRange(activeFilters.periodWeek)
  }

  if (activeFilters.periodMode === 'month') {
    return getMonthRange(activeFilters.periodMonth)
  }

  if (activeFilters.periodMode === 'quarter') {
    return getQuarterRange(activeFilters.periodQuarter, activeFilters.periodYear)
  }

  if (activeFilters.periodMode === 'year') {
    return getYearRange(activeFilters.periodYear)
  }

  if (activeFilters.periodMode === 'range') {
    return getCustomDateRange(activeFilters.rangeStart, activeFilters.rangeEnd)
  }

  if (activeFilters.date) {
    return isValidDate(activeFilters.date)
      ? { startDate: activeFilters.date, endDate: activeFilters.date }
      : null
  }

  return null
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

export function buildCashflowCsvExport(transactions, filters = initialCashflowFilters) {
  const activeFilters = { ...initialCashflowFilters, ...filters }
  const filteredTransactions = getFilteredCashflowTransactions(transactions, activeFilters)
  const stats = getCashflowStats(filteredTransactions)
  const periodLabel = getCashflowPeriodLabel(activeFilters) || 'Tất cả'
  const rows = [
    ['Báo cáo Thu chi - DreamHome'],
    ['Kỳ', periodLabel],
    ['Tổng thu', stats.totalIncome],
    ['Tổng chi', stats.totalExpense],
    ['Chênh lệch', stats.balance],
    ['Số giao dịch', stats.count],
    [],
    [
      'Ngày',
      'Loại',
      'Danh mục',
      'Nội dung / Người liên quan',
      'Thanh toán',
      'Số tiền',
      'Người ghi nhận',
      'Ghi chú',
      'Nguồn',
      'Có ảnh',
    ],
    ...filteredTransactions.map((transaction) => [
      transaction.transactionDate || '',
      getTypeLabel(transaction.type),
      transaction.category || '',
      transaction.personName || '',
      getTransactionMethodDisplay(transaction.method),
      Number(transaction.amount || 0),
      transaction.recordedBy || '',
      transaction.note || '',
      getTransactionSourceExportLabel(transaction.sourceModule),
      transaction.attachment?.dataUrl ? 'Có' : 'Không',
    ]),
  ]

  return {
    csvContent: rows.map(formatCsvRow).join('\r\n'),
    filename: getCashflowCsvFilename(activeFilters),
    count: filteredTransactions.length,
  }
}

function renderCashflowPeriodFilters(filters) {
  return `
    <label>
      <span>Kỳ lọc</span>
      <select data-cashflow-filter="periodMode">
        ${renderOption('all', 'Tất cả', filters.periodMode)}
        ${renderOption('day', 'Ngày', filters.periodMode)}
        ${renderOption('week', 'Tuần', filters.periodMode)}
        ${renderOption('month', 'Tháng', filters.periodMode)}
        ${renderOption('quarter', 'Quý', filters.periodMode)}
        ${renderOption('year', 'Năm', filters.periodMode)}
        ${renderOption('range', 'Khoảng ngày', filters.periodMode)}
      </select>
    </label>
    ${renderCashflowPeriodValueFilters(filters)}
  `
}

function renderCashflowPeriodValueFilters(filters) {
  if (filters.periodMode === 'day') {
    return renderCashflowFilterInput('Ngày', 'periodDate', filters.periodDate, 'date')
  }

  if (filters.periodMode === 'week') {
    return renderCashflowFilterInput('Tuần', 'periodWeek', filters.periodWeek, 'week')
  }

  if (filters.periodMode === 'month') {
    return renderCashflowFilterInput('Tháng', 'periodMonth', filters.periodMonth, 'month')
  }

  if (filters.periodMode === 'quarter') {
    return `
      <label>
        <span>Quý</span>
        <select data-cashflow-filter="periodQuarter">
          ${renderOption('1', 'Q1', filters.periodQuarter)}
          ${renderOption('2', 'Q2', filters.periodQuarter)}
          ${renderOption('3', 'Q3', filters.periodQuarter)}
          ${renderOption('4', 'Q4', filters.periodQuarter)}
        </select>
      </label>
      ${renderCashflowFilterInput('Năm', 'periodYear', filters.periodYear, 'number')}
    `
  }

  if (filters.periodMode === 'year') {
    return renderCashflowFilterInput('Năm', 'periodYear', filters.periodYear, 'number')
  }

  if (filters.periodMode === 'range') {
    return `
      ${renderCashflowFilterInput('Từ ngày', 'rangeStart', filters.rangeStart, 'date')}
      ${renderCashflowFilterInput('Đến ngày', 'rangeEnd', filters.rangeEnd, 'date')}
    `
  }

  return ''
}

function renderCashflowFilterInput(label, fieldName, value, type) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input
        type="${escapeAttribute(type)}"
        value="${escapeAttribute(value)}"
        data-cashflow-filter="${escapeAttribute(fieldName)}"
        ${type === 'number' ? 'min="2000" max="2100" step="1"' : ''}
      />
    </label>
  `
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

  if (values.attachment && !normalizeCashflowAttachment(values.attachment)) {
    errors.attachment = 'Ảnh giao dịch không hợp lệ.'
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
  const nextTransaction = {
    ...existingTransaction,
    id: existingTransaction?.id ?? createCashflowId(),
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
  const attachment = normalizeCashflowAttachment(values.attachment)

  if (attachment) {
    nextTransaction.attachment = attachment
  } else {
    delete nextTransaction.attachment
  }

  return nextTransaction
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
  const isSaving = Boolean(formState.isSaving)
  const disabledAttribute = isSaving ? 'disabled' : ''
  const categoryOptions = getAvailableCashflowCategoriesForType(
    categories,
    formState.values.type,
    formState.values.category,
  )

  return `
    <div class="cashflow-form-backdrop" role="presentation">
      <form class="cashflow-form-panel" data-cashflow-form data-cashflow-form-mode="${escapeAttribute(formState.mode)}">
        <div class="cashflow-form-header">
          <div>
            <h4>${isEditMode ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h4>
            <p>${isEditMode ? 'Cập nhật giao dịch thu/chi thủ công.' : 'Nhập giao dịch thu/chi thủ công mới.'}</p>
          </div>
          <button type="button" data-cashflow-action="cancel-form" aria-label="Đóng form" ${disabledAttribute}>×</button>
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
          ${renderEvidenceField(formState)}
          <label class="cashflow-field cashflow-field-wide">
            <span>Ghi chú</span>
            <textarea data-cashflow-form-field="note" ${disabledAttribute}>${escapeHtml(formState.values.note ?? '')}</textarea>
          </label>
        </div>
        ${renderFormErrors(formState.errors)}
        <div class="cashflow-form-actions">
          ${
            isEditMode
              ? `<button class="cashflow-delete-button" type="button" data-cashflow-action="delete-transaction" ${disabledAttribute}>Xóa giao dịch</button>`
              : '<span></span>'
          }
          <div>
            <button type="button" data-cashflow-action="cancel-form" ${disabledAttribute}>Hủy</button>
            <button class="cashflow-save-button" type="submit" ${disabledAttribute}>${isSaving ? 'Đang lưu...' : 'Lưu giao dịch'}</button>
          </div>
        </div>
      </form>
    </div>
  `
}

function renderEvidenceField(formState) {
  const draft = formState.attachmentDraft || createEmptyCashflowAttachmentDraft()
  const fieldError = formState.errors.attachment || draft.error
  const disabledAttribute = formState.isSaving ? 'disabled' : ''
  const hasStaged = draft.mode === 'staged-new' && draft.objectUrl
  const hasExisting = isKeepExistingAttachmentDraft(draft) && draft.existingAttachment
  const isRemoved = draft.mode === 'remove-existing'
  const isLoading = draft.mode === 'loading'
  const isError = draft.mode === 'error'
  const summary = hasStaged
    ? {
        name: draft.fileName || 'anh-giao-dich',
        type: draft.mimeType || 'image/*',
        size: draft.sizeBytes,
        imageUrl: draft.objectUrl,
        status: 'Ảnh mới, sẽ tải lên khi lưu',
      }
    : hasExisting
      ? {
          name: getAttachmentDisplayName(draft.existingAttachment),
          type: draft.existingAttachment.mimeType || draft.existingAttachment.type || 'image/*',
          size: draft.existingAttachment.sizeBytes || draft.existingAttachment.size || 0,
          imageUrl: draft.existingAttachment.dataUrl || draft.existingAttachment.signedUrl || '',
          status: draft.source === 'cloud' ? 'Có chứng từ' : 'Chứng từ legacy hiện có',
        }
      : null

  return `
    <div class="cashflow-field cashflow-evidence-field ${fieldError ? 'has-error' : ''}" data-cashflow-evidence-field>
      <span>Chứng từ</span>
      <input
        type="file"
        accept="${escapeAttribute(CASHFLOW_EVIDENCE_ACCEPT)}"
        data-cashflow-evidence-input
        tabindex="-1"
        ${disabledAttribute}
      />
      ${
        summary
          ? `
            <div class="cashflow-evidence-preview" data-cashflow-evidence-preview>
              ${
                summary.imageUrl
                  ? `<img src="${escapeAttribute(summary.imageUrl)}" alt="${escapeAttribute(summary.name)}" />`
                  : '<div class="cashflow-evidence-thumb" aria-hidden="true">IMG</div>'
              }
              <div>
                <strong title="${escapeAttribute(summary.name)}">${escapeHtml(summary.name)}</strong>
                <small>${escapeHtml(summary.type)} · ${formatFileSize(summary.size)}</small>
                <small>${escapeHtml(summary.status)}</small>
              </div>
              <div class="cashflow-evidence-actions">
                <button type="button" data-cashflow-evidence-action="preview" ${disabledAttribute}>Xem trước</button>
                <button type="button" data-cashflow-evidence-action="replace" ${disabledAttribute}>Thay ảnh</button>
                <button type="button" data-cashflow-evidence-action="remove" ${disabledAttribute}>Gỡ</button>
              </div>
            </div>
          `
          : isLoading
            ? `
            <div class="cashflow-evidence-empty is-loading" data-cashflow-evidence-preview>
              <button type="button" data-cashflow-evidence-action="insert" disabled>Chèn ảnh</button>
              <small>Đang tải chứng từ...</small>
            </div>
          `
            : isError
              ? `
            <div class="cashflow-evidence-empty is-error" data-cashflow-evidence-preview>
              <button type="button" data-cashflow-evidence-action="insert" disabled>Chèn ảnh</button>
              <small>Không thể tải thông tin chứng từ</small>
            </div>
          `
              : `
            <div class="cashflow-evidence-empty" data-cashflow-evidence-preview>
              <button type="button" data-cashflow-evidence-action="insert" ${disabledAttribute}>Chèn ảnh</button>
              <small>${isRemoved ? 'Chứng từ sẽ được gỡ khi lưu.' : 'Không có chứng từ'}</small>
            </div>
          `
      }
      ${fieldError ? `<small>${escapeHtml(fieldError)}</small>` : ''}
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
  const disabledAttribute = formState.isSaving ? 'disabled' : ''

  return `
    <label class="cashflow-field">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        placeholder="${escapeAttribute(placeholder)}"
        data-cashflow-form-field="${name}"
        ${disabledAttribute}
      />
      ${renderFieldError(formState.errors[name])}
    </label>
  `
}

function renderSelectField(label, name, formState, options) {
  const disabledAttribute = formState.isSaving ? 'disabled' : ''

  return `
    <label class="cashflow-field">
      <span>${label}</span>
      <select data-cashflow-form-field="${name}" ${disabledAttribute}>
        ${options.map(([value, optionLabel]) => renderOption(value, optionLabel, formState.values[name])).join('')}
      </select>
      ${renderFieldError(formState.errors[name])}
    </label>
  `
}

function renderAttachmentField(formState) {
  const attachment = normalizeCashflowAttachment(formState.values.attachment)
  const error = formState.errors.attachment

  return `
    <div class="cashflow-field cashflow-field-wide cashflow-attachment-field ${error ? 'has-error' : ''}">
      <span>Ảnh giao dịch</span>
      ${
        attachment
          ? `
            <div class="cashflow-attachment-preview">
              <img src="${escapeAttribute(attachment.dataUrl)}" alt="${escapeAttribute(attachment.name)}" />
              <div>
                <strong title="${escapeAttribute(attachment.name)}">${escapeHtml(attachment.name)}</strong>
                <small>${escapeHtml(attachment.type)} · ${formatFileSize(attachment.size)}</small>
              </div>
              <button type="button" data-cashflow-action="remove-attachment">Xóa ảnh</button>
            </div>
          `
          : '<p class="cashflow-attachment-empty">Chưa có ảnh đính kèm.</p>'
      }
      <label class="cashflow-attachment-picker">
        <input type="file" accept="image/*" data-cashflow-attachment-input />
        <span>Chọn ảnh</span>
      </label>
      <small>Chỉ nhận ảnh, tối đa ${formatFileSize(CASHFLOW_ATTACHMENT_MAX_SIZE)}.</small>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </div>
  `
}

function renderFieldError(error) {
  return error ? `<small>${escapeHtml(error)}</small>` : ''
}

function isKeepExistingAttachmentDraft(draft) {
  return ['keep-existing', 'keep-existing-cloud', 'keep-existing-legacy'].includes(draft?.mode)
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

export function getCloudAttachmentButtonLabel(attachmentCount) {
  const count = Number(attachmentCount || 0)
  return count > 0 ? `${count} ảnh` : 'Chèn ảnh'
}

function renderTransactionRow(transaction, cloudAttachmentOptions = {}) {
  const transactionCode =
    cloudAttachmentOptions.transactionCodes?.[transaction.id] ?? ''
  const attachmentCount =
    cloudAttachmentOptions.attachmentCounts?.[transactionCode] ?? 0
  const isUploading =
    cloudAttachmentOptions.uploadingTransactionId === transaction.id
  const canUpload = Boolean(cloudAttachmentOptions.canUpload) && !isUploading

  return `
    <tr class="cashflow-row" data-cashflow-transaction-id="${transaction.id}" tabindex="0">
      <td>${formatDate(transaction.transactionDate)}</td>
      <td><span class="cashflow-type-badge is-${transaction.type}">${getTypeLabel(transaction.type)}</span></td>
      <td title="${escapeAttribute(transaction.category)}">${escapeHtml(transaction.category)}</td>
      <td title="${escapeAttribute(transaction.personName)}">${transaction.personName ? escapeHtml(transaction.personName) : '—'}</td>
      <td>${escapeHtml(getTransactionMethodDisplay(transaction.method))}</td>
      <td class="cashflow-amount is-${transaction.type}">${formatMoney(transaction.amount)}</td>
      <td title="${escapeAttribute(transaction.recordedBy)}">${escapeHtml(getRecordedByDisplayName(transaction.recordedBy))}</td>
      <td title="${escapeAttribute(transaction.note)}">${renderTransactionNote(transaction)}</td>
      <td class="cashflow-cloud-attachment-cell">
        <button
          type="button"
          data-cashflow-cloud-action="select-image"
          data-cashflow-transaction-id="${escapeAttribute(transaction.id)}"
          data-cloud-attachment-count="${attachmentCount}"
          title="Chèn ảnh giao dịch"
          ${canUpload ? '' : 'disabled'}
        >
          ${isUploading ? 'Đang tải...' : getCloudAttachmentButtonLabel(attachmentCount)}
        </button>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          data-cashflow-cloud-image-input="${escapeAttribute(transaction.id)}"
          tabindex="-1"
        />
      </td>
    </tr>
  `
}

function renderTransactionImageManager(state) {
  const transaction = state.transaction
  const attachments = state.attachments ?? []

  return `
    <div class="transaction-image-manager-backdrop" role="presentation">
      <section
        class="transaction-image-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-image-manager-title"
      >
        <header class="transaction-image-manager-header">
          <div>
            <h4 id="transaction-image-manager-title">Ảnh giao dịch</h4>
            <p>
              ${escapeHtml(state.transactionCode)} ·
              ${formatDate(transaction.transactionDate)} ·
              ${formatMoney(transaction.amount)}
            </p>
            <span>${escapeHtml(transaction.personName || transaction.note || 'Không có nội dung')}</span>
            <small>${attachments.length} ảnh đã tải lên</small>
          </div>
          <button type="button" data-transaction-image-manager-action="close" aria-label="Đóng">×</button>
        </header>

        <div class="transaction-image-manager-toolbar">
          <button
            type="button"
            data-transaction-image-manager-action="add"
            ${state.isUploading ? 'disabled' : ''}
          >
            ${state.isUploading ? 'Đang tải ảnh...' : '+ Thêm ảnh'}
          </button>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            data-transaction-image-manager-input
            tabindex="-1"
          />
          <button type="button" data-transaction-image-manager-action="close">Đóng</button>
        </div>

        ${state.message ? `<p class="transaction-image-manager-message is-${escapeAttribute(state.messageTone || 'error')}" role="status">${escapeHtml(state.message)}</p>` : ''}

        <div class="transaction-image-manager-list">
          ${
            state.status === 'loading'
              ? '<p class="transaction-image-manager-empty">Đang tải danh sách ảnh...</p>'
              : state.error
                ? `<p class="transaction-image-manager-error">${escapeHtml(state.error)}</p>`
                : attachments.length
                  ? attachments.map((attachment) => renderManagedAttachment(attachment, state)).join('')
                  : '<p class="transaction-image-manager-empty">Chưa có ảnh giao dịch nào.</p>'
          }
        </div>
      </section>
    </div>
  `
}

function renderCloudGallery(state) {
  const filteredAttachments = filterCloudGalleryAttachments(
    state.attachments,
    state.query,
    state.currentUser,
    state.memberProfileMap,
  )

  return `
    <div class="cloud-gallery-backdrop" role="presentation">
      <section
        class="cloud-gallery-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-gallery-title"
      >
        <header class="cloud-gallery-header">
          <div>
            <h4 id="cloud-gallery-title">Kho ảnh giao dịch cloud</h4>
            <p>DreamHome · Tháng ${escapeHtml(state.monthKey)}</p>
          </div>
          <button type="button" data-cloud-gallery-action="close" aria-label="Đóng">×</button>
        </header>

        <div class="cloud-gallery-toolbar">
          <label>
            <span>Tháng</span>
            <input type="month" value="${escapeAttribute(state.monthKey)}" data-cloud-gallery-month />
          </label>
          <label class="cloud-gallery-search">
            <span>Tìm kiếm</span>
            <input
              type="search"
              value="${escapeAttribute(state.query)}"
              placeholder="Mã giao dịch, tên file, người liên quan, người tải"
              data-cloud-gallery-search
            />
          </label>
          <strong>${filteredAttachments.length}/${state.attachments.length} ảnh</strong>
        </div>

        ${state.message ? `<p class="cloud-gallery-message is-${escapeAttribute(state.messageTone || 'error')}" role="status">${escapeHtml(state.message)}</p>` : ''}

        <div class="cloud-gallery-body">
          ${
            state.status === 'loading'
              ? '<p class="cloud-gallery-empty">Đang tải kho ảnh cloud...</p>'
              : state.status === 'error'
                ? `<p class="cloud-gallery-error">${escapeHtml(state.error || 'Không thể tải kho ảnh cloud. Vui lòng kiểm tra đăng nhập/quyền DreamHome.')}</p>`
                : !state.attachments.length
                  ? '<p class="cloud-gallery-empty">Chưa có ảnh giao dịch cloud trong tháng này.</p>'
                  : !filteredAttachments.length
                    ? '<p class="cloud-gallery-empty">Không tìm thấy ảnh phù hợp.</p>'
                    : filteredAttachments.map((attachment) => renderCloudGalleryItem(attachment, state)).join('')
          }
        </div>
      </section>
    </div>
  `
}

function renderCloudGalleryItem(attachment, state) {
  const uploaderName = getUploaderDisplayName(
    attachment,
    state.currentUser,
    state.memberProfileMap,
  )
  const hasLocalTransaction = Boolean(
    state.transactionIdsByCode?.[attachment.transactionCode],
  )

  return `
    <article class="cloud-gallery-item">
      <div class="cloud-gallery-item-transaction">
        <strong>${escapeHtml(attachment.transactionCode || 'Chưa có mã')}</strong>
        <span>${formatDate(attachment.transactionDate)} · ${formatMoney(attachment.amount)}</span>
        <span>${escapeHtml(attachment.note || 'Không có nội dung/người liên quan')}</span>
      </div>
      <div class="cloud-gallery-item-file">
        <strong title="${escapeAttribute(attachment.fileName)}">${escapeHtml(attachment.fileName || attachment.originalName || 'Ảnh giao dịch')}</strong>
        <span>Tải lên bởi: ${escapeHtml(uploaderName)}</span>
        <time datetime="${escapeAttribute(attachment.createdAt)}">${formatDateTime(attachment.createdAt)}</time>
      </div>
      <div class="cloud-gallery-item-actions">
        ${
          attachment.signedUrl
            ? `
              <a href="${escapeAttribute(attachment.signedUrl)}" target="_blank" rel="noopener noreferrer">Xem ảnh</a>
              <a href="${escapeAttribute(attachment.signedUrl)}" download="${escapeAttribute(attachment.fileName || 'anh-giao-dich.jpg')}" target="_blank" rel="noopener noreferrer">Tải xuống</a>
            `
            : '<span>Không tạo được link xem</span>'
        }
        <button
          type="button"
          data-cloud-gallery-action="manage"
          data-transaction-code="${escapeAttribute(attachment.transactionCode)}"
          ${hasLocalTransaction ? '' : 'title="Không tìm thấy giao dịch local tương ứng"'}
        >
          Quản lý ảnh
        </button>
      </div>
    </article>
  `
}

function renderManagedAttachment(attachment, state) {
  const isDeleting = state.deletingAttachmentId === attachment.id
  const uploaderDisplayName = getUploaderDisplayName(
    attachment,
    state.currentUser,
    state.memberProfileMap,
  )

  return `
    <article class="transaction-image-manager-item">
      <div class="transaction-image-manager-item-summary">
        <strong title="${escapeAttribute(attachment.fileName)}">${escapeHtml(attachment.fileName || 'Ảnh giao dịch')}</strong>
        <span>${formatFileSize(attachment.sizeBytes)} · Tải lên lúc ${formatDateTime(attachment.createdAt)}</span>
        <span>Tải lên bởi: ${escapeHtml(uploaderDisplayName)}</span>
        <details class="transaction-image-technical-details">
          <summary>Chi tiết kỹ thuật</summary>
          <span>Tên file gốc: ${escapeHtml(attachment.originalName || 'Không rõ')}</span>
          <span>Đường dẫn lưu trữ: ${escapeHtml(attachment.storagePath || 'Không rõ')}</span>
        </details>
      </div>
      <div class="transaction-image-manager-actions">
        ${
          attachment.signedUrl
            ? `
              <a href="${escapeAttribute(attachment.signedUrl)}" target="_blank" rel="noopener noreferrer">Xem ảnh</a>
              <a href="${escapeAttribute(attachment.signedUrl)}" download="${escapeAttribute(attachment.fileName || 'anh-giao-dich.jpg')}" target="_blank" rel="noopener noreferrer">Tải xuống</a>
            `
            : '<span>Không tạo được link xem ảnh</span>'
        }
        <button
          type="button"
          data-transaction-image-manager-action="delete"
          data-attachment-id="${escapeAttribute(attachment.id)}"
          ${isDeleting ? 'disabled' : ''}
        >
          ${isDeleting ? 'Đang xóa...' : 'Xóa ảnh'}
        </button>
      </div>
    </article>
  `
}

function formatDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Không rõ thời gian'
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function renderTransactionNote(transaction) {
  const noteText = transaction.note ? escapeHtml(transaction.note) : '—'

  const sourceLabel = getSourceBadgeLabel(transaction.sourceModule)
  const attachmentBadge = transaction.attachment
    ? '<span class="cashflow-attachment-badge">Có ảnh</span>'
    : ''

  if (!sourceLabel && !attachmentBadge) {
    return noteText
  }

  return `
    ${sourceLabel ? `<span class="cashflow-source-badge">${sourceLabel}</span>` : ''}
    ${attachmentBadge}
    <span>${noteText}</span>
  `
}

function getTransactionMethodDisplay(method) {
  return String(method ?? '').trim() === 'Tiền mặt' ? 'TM' : String(method ?? '').trim() || 'Khác'
}

function formatCsvRow(row) {
  return row.map(escapeCsvCell).join(',')
}

function escapeCsvCell(value) {
  const text = String(value ?? '')

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

function getTransactionSourceExportLabel(sourceModule) {
  return getSourceBadgeLabel(sourceModule) || 'Thủ công'
}

function getCashflowCsvFilename(filters = initialCashflowFilters) {
  const activeFilters = { ...initialCashflowFilters, ...filters }
  const safePart = getCashflowFilenamePeriodPart(activeFilters)
  return `thu-chi-dreamhome-${safePart}.csv`
}

function getCashflowFilenamePeriodPart(filters) {
  const range = getCashflowPeriodRange(filters)

  if (filters.periodMode === 'day' && range) {
    return range.startDate
  }

  if (filters.periodMode === 'week') {
    return String(filters.periodWeek || 'tuan').toLowerCase()
  }

  if (filters.periodMode === 'month' && /^\d{4}-\d{2}$/.test(String(filters.periodMonth ?? ''))) {
    return filters.periodMonth
  }

  if (filters.periodMode === 'quarter') {
    return `q${String(filters.periodQuarter || '').toLowerCase()}-${filters.periodYear || ''}`.replace(/-$/, '')
  }

  if (filters.periodMode === 'year' && filters.periodYear) {
    return String(filters.periodYear)
  }

  if (filters.periodMode === 'range' && range) {
    return `${range.startDate}_${range.endDate}`
  }

  return 'tat-ca'
}

function normalizeCashflowAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') {
    return null
  }

  const dataUrl = String(attachment.dataUrl ?? '')
  const type = String(attachment.type ?? attachment.mimeType ?? '')
  const size = Number(attachment.size ?? attachment.sizeBytes ?? 0)
  const storagePath = String(attachment.storagePath ?? '')

  if (!type.startsWith('image/')) {
    return null
  }

  if (dataUrl) {
    if (!dataUrl.startsWith('data:image/') || size > CASHFLOW_ATTACHMENT_MAX_SIZE) {
      return null
    }

    return {
      ...attachment,
      id: String(attachment.id || `attachment-${Date.now()}`),
      name: String(attachment.name || attachment.fileName || attachment.originalName || 'anh-giao-dich'),
      type,
      size: Number.isFinite(size) ? size : 0,
      dataUrl,
      createdAt: attachment.createdAt || attachment.uploadedAt || new Date().toISOString(),
    }
  }

  if (!storagePath || storagePath.includes('\\') || storagePath.includes('//')) {
    return null
  }

  return {
    ...attachment,
    id: String(attachment.id || `attachment-${Date.now()}`),
    name: String(attachment.name || attachment.fileName || attachment.originalName || 'anh-giao-dich'),
    type,
    mimeType: type,
    size: Number.isFinite(size) ? size : 0,
    sizeBytes: Number.isFinite(size) ? size : 0,
    storagePath,
    storageBucket: String(attachment.storageBucket || 'transaction-images'),
    transactionCode: String(attachment.transactionCode || ''),
    metadataId: String(attachment.metadataId || attachment.id || ''),
    createdAt: attachment.createdAt || attachment.uploadedAt || new Date().toISOString(),
  }
}

export function formatFileSize(size) {
  const numberSize = Number(size || 0)

  if (numberSize >= 1024 * 1024) {
    return `${(numberSize / 1024 / 1024).toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(numberSize / 1024)).toLocaleString('vi-VN')} KB`
}

function getAttachmentDisplayName(attachment) {
  return String(
    attachment?.fileName ||
      attachment?.name ||
      attachment?.originalName ||
      'Ảnh giao dịch',
  )
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

function matchesTransactionPeriod(transactionDate, periodRange) {
  if (!periodRange) {
    return true
  }

  if (!isValidDate(transactionDate)) {
    return false
  }

  return transactionDate >= periodRange.startDate && transactionDate <= periodRange.endDate
}

function getCashflowPeriodLabel(filters = initialCashflowFilters) {
  const range = getCashflowPeriodRange(filters)

  if (!range || filters.periodMode === 'all') {
    return ''
  }

  if (filters.periodMode === 'day') {
    return formatDate(range.startDate)
  }

  if (filters.periodMode === 'week') {
    return `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`
  }

  if (filters.periodMode === 'month' && /^\d{4}-\d{2}$/.test(String(filters.periodMonth ?? ''))) {
    const [year, month] = filters.periodMonth.split('-')
    return `Tháng ${month}/${year}`
  }

  if (filters.periodMode === 'quarter') {
    return `Q${filters.periodQuarter}/${filters.periodYear}`
  }

  if (filters.periodMode === 'year') {
    return `Năm ${filters.periodYear}`
  }

  if (filters.periodMode === 'range') {
    return `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`
  }

  return `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`
}

function getWeekRange(weekValue) {
  const match = String(weekValue ?? '').match(/^(\d{4})-W(\d{2})$/)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const week = Number(match[2])

  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    return null
  }

  const firstThursday = new Date(Date.UTC(year, 0, 4))
  const firstMonday = new Date(firstThursday)
  firstMonday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7))

  const startDate = new Date(firstMonday)
  startDate.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7)

  const endDate = new Date(startDate)
  endDate.setUTCDate(startDate.getUTCDate() + 6)

  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  }
}

function getMonthRange(monthValue) {
  const match = String(monthValue ?? '').match(/^(\d{4})-(\d{2})$/)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  return {
    startDate: `${match[1]}-${match[2]}-01`,
    endDate: toDateInputValue(new Date(Date.UTC(year, month, 0))),
  }
}

function getQuarterRange(quarterValue, yearValue) {
  const quarter = Number(quarterValue)
  const year = Number(yearValue)

  if (!Number.isInteger(year) || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return null
  }

  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2

  return {
    startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    endDate: toDateInputValue(new Date(Date.UTC(year, endMonth, 0))),
  }
}

function getYearRange(yearValue) {
  const year = Number(yearValue)

  if (!Number.isInteger(year)) {
    return null
  }

  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

function getCustomDateRange(startDate, endDate) {
  const normalizedStartDate = isValidDate(startDate) ? startDate : ''
  const normalizedEndDate = isValidDate(endDate) ? endDate : ''

  if (!normalizedStartDate && !normalizedEndDate) {
    return null
  }

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    return {
      startDate: normalizedEndDate,
      endDate: normalizedStartDate,
    }
  }

  return {
    startDate: normalizedStartDate || normalizedEndDate,
    endDate: normalizedEndDate || normalizedStartDate,
  }
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
      <td class="cashflow-empty" colspan="9">Không tìm thấy giao dịch phù hợp với bộ lọc hiện tại.</td>
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
  const rawValue = String(value ?? '').trim()
  const isNegative = /^-/.test(rawValue) || /^−/.test(rawValue)
  const normalizedValue = rawValue.replace(/[^\d]/g, '')
  const amount = Number(normalizedValue)

  if (!Number.isFinite(amount)) {
    return 0
  }

  return isNegative ? -amount : amount
}

function formatAmountForInput(amount) {
  return Number(amount || 0).toLocaleString('vi-VN')
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function getCurrentWeekInputValue() {
  const today = new Date()
  const utcDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const dayNumber = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber)

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7)

  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function getCurrentMonthInputValue() {
  return getTodayDate().slice(0, 7)
}

function getCurrentQuarterValue() {
  return String(Math.floor(new Date().getMonth() / 3) + 1)
}

function getCurrentYearValue() {
  return String(new Date().getFullYear())
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10)
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
  return escapeHtml(value)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
