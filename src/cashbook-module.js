export function createDefaultCashbookSettings(transactions = []) {
  return {
    openingBalance: 0,
    openingDate: getEarliestTransactionDate(transactions) || getTodayDate(),
    updatedAt: '',
    updatedBy: 'Admin',
    isConfigured: false,
  }
}

export function getDefaultCashbookDate(transactions) {
  const today = getTodayDate()
  const validDates = getValidCashflowTransactions(transactions).map(
    (transaction) => transaction.transactionDate,
  )

  if (validDates.includes(today) || !validDates.length) {
    return today
  }

  return validDates.sort((firstDate, secondDate) => secondDate.localeCompare(firstDate))[0]
}

export function createCashbookSettingsFormState(settings) {
  return {
    values: {
      openingBalance: formatAmountForInput(settings.openingBalance),
      openingDate: settings.openingDate || getTodayDate(),
      updatedBy: settings.updatedBy || 'Admin',
    },
    errors: {},
  }
}

export function validateCashbookSettingsForm(values) {
  const errors = {}
  const openingBalance = parseMoneyInput(values.openingBalance)

  if (openingBalance < 0) {
    errors.openingBalance = 'Số dư đầu kỳ không được âm.'
  }

  if (!isValidDate(values.openingDate)) {
    errors.openingDate = 'Ngày bắt đầu không hợp lệ.'
  }

  return errors
}

export function buildCashbookSettingsFromForm(values, currentSettings = {}) {
  return {
    ...currentSettings,
    openingBalance: parseMoneyInput(values.openingBalance),
    openingDate: values.openingDate,
    updatedAt: new Date().toISOString(),
    updatedBy: String(values.updatedBy ?? '').trim() || 'Admin',
    isConfigured: true,
  }
}

export function createCashbookReconciliationFormState(
  reconciliation,
  selectedDate,
  systemClosingBalance,
) {
  return {
    values: {
      date: selectedDate,
      systemClosingBalance,
      actualCash: reconciliation ? formatAmountForInput(reconciliation.actualCash) : '',
      checkedBy: reconciliation?.checkedBy || 'Admin',
      note: reconciliation?.note || '',
    },
    errors: {},
  }
}

export function validateCashbookReconciliationForm(values) {
  const errors = {}
  const actualCashText = String(values.actualCash ?? '').trim()
  const actualCash = parseMoneyInput(values.actualCash)

  if (!isValidDate(values.date)) {
    errors.date = 'Ngày đối soát không hợp lệ.'
  }

  if (!actualCashText) {
    errors.actualCash = 'Tiền thực tế trong quỹ là bắt buộc.'
  } else if (!hasMoneyDigits(actualCashText)) {
    errors.actualCash = 'Tiền thực tế trong quỹ không hợp lệ.'
  } else if (actualCash < 0) {
    errors.actualCash = 'Tiền thực tế trong quỹ không được âm.'
  }

  if (!String(values.checkedBy ?? '').trim()) {
    errors.checkedBy = 'Người đối soát là bắt buộc.'
  }

  return errors
}

export function buildCashbookReconciliationFromForm(values, currentReconciliation = null) {
  const now = new Date().toISOString()
  const systemClosingBalance = Number(values.systemClosingBalance || 0)
  const actualCash = parseMoneyInput(values.actualCash)
  const difference = actualCash - systemClosingBalance

  return {
    id: currentReconciliation?.id || `cashbook-reconciliation-${values.date}-${Date.now()}`,
    date: values.date,
    systemClosingBalance,
    actualCash,
    difference,
    status: difference === 0 ? 'matched' : 'mismatched',
    checkedBy: String(values.checkedBy ?? '').trim() || 'Admin',
    note: String(values.note ?? '').trim(),
    checkedAt: currentReconciliation?.checkedAt || now,
    updatedAt: now,
    isClosed: Boolean(currentReconciliation?.isClosed),
    closedAt: currentReconciliation?.closedAt || null,
    closedBy: currentReconciliation?.closedBy || null,
  }
}

export function closeCashbookReconciliation(reconciliation, closedBy = 'Admin') {
  const now = new Date().toISOString()

  return {
    ...reconciliation,
    isClosed: true,
    closedAt: reconciliation.closedAt || now,
    closedBy: reconciliation.closedBy || closedBy || 'Admin',
    updatedAt: now,
  }
}

export function renderCashbookModule(
  transactions,
  selectedDate = getDefaultCashbookDate(transactions),
  settings = createDefaultCashbookSettings(transactions),
  settingsFormState = null,
  reconciliations = [],
  reconciliationFormState = null,
) {
  const activeDate = isValidDate(selectedDate) ? selectedDate : getDefaultCashbookDate(transactions)
  const activeSettings = {
    ...createDefaultCashbookSettings(transactions),
    ...settings,
  }
  const dailyTransactions = getDailyCashbookTransactions(transactions, activeDate)
  const stats = getCashbookBalanceStats(transactions, activeDate, activeSettings)
  const reconciliation = getCashbookReconciliationForDate(reconciliations, activeDate)
  const closingTone = stats.closingBalance > 0 ? 'income' : stats.closingBalance < 0 ? 'expense' : 'neutral'
  const balanceLabelSuffix = activeSettings.isConfigured ? '' : ' (tạm tính)'

  return `
    <section class="cashbook-module" aria-labelledby="cashbook-title">
      <div class="cashbook-toolbar">
        <div>
          <h3 id="cashbook-title">Sổ quỹ</h3>
        </div>
        <div class="cashbook-date-actions" aria-label="Chọn ngày xem sổ quỹ">
          <label>
            <span>Ngày</span>
            <input
              type="date"
              value="${escapeAttribute(activeDate)}"
              data-cashbook-date
            />
          </label>
          <button type="button" data-cashbook-action="today">Hôm nay</button>
          <button type="button" data-cashbook-action="open-settings">Thiết lập số dư</button>
        </div>
      </div>

      ${renderCashbookSettingsSummary(activeSettings, activeDate)}

      <div class="cashbook-stats" aria-label="Tổng quan sổ quỹ theo ngày">
        ${renderCashbookStat(`Số dư đầu ngày${balanceLabelSuffix}`, formatMoney(stats.openingBalanceOfDay), 'neutral')}
        ${renderCashbookStat('Tổng thu', formatMoney(stats.dailyIncome), 'income')}
        ${renderCashbookStat('Tổng chi', formatMoney(stats.dailyExpense), 'expense')}
        ${renderCashbookStat(`Số dư cuối ngày${balanceLabelSuffix}`, formatMoney(stats.closingBalance), closingTone)}
        ${renderCashbookStat('Số giao dịch', String(stats.transactionCount), 'neutral')}
      </div>

      <div class="cashbook-workspace">
        ${renderCashbookReconciliationCard(reconciliation, activeDate, stats.closingBalance)}
        ${renderCashbookReconciliationHistory(reconciliations, transactions, activeSettings, activeDate)}
      </div>

      <section class="cashbook-transactions" aria-label="Giao dịch trong ngày">
        <div class="cashbook-transactions-header">
          <h4>Giao dịch trong ngày</h4>
          <span>${stats.transactionCount} giao dịch</span>
        </div>
        ${
          dailyTransactions.length
            ? renderCashbookTransactionList(dailyTransactions)
            : '<div class="cashbook-empty">Chưa có giao dịch trong ngày này.</div>'
        }
      </section>

      ${settingsFormState ? renderCashbookSettingsPanel(settingsFormState) : ''}
      ${
        reconciliationFormState
          ? renderCashbookReconciliationPanel(reconciliationFormState)
          : ''
      }
    </section>
  `
}

export function getCashbookBalanceStats(transactions, selectedDate, settings) {
  const validTransactions = getValidCashflowTransactions(transactions)
  const dailyTransactions = validTransactions.filter(
    (transaction) => transaction.transactionDate === selectedDate,
  )
  const dailyIncome = dailyTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + getTransactionAmount(transaction), 0)
  const dailyExpense = dailyTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + getTransactionAmount(transaction), 0)
  const previousNet =
    selectedDate < settings.openingDate
      ? 0
      : validTransactions
          .filter(
            (transaction) =>
              transaction.transactionDate >= settings.openingDate &&
              transaction.transactionDate < selectedDate,
          )
          .reduce((total, transaction) => total + getTransactionNet(transaction), 0)
  const openingBalanceOfDay = Number(settings.openingBalance || 0) + previousNet
  const dailyNet = dailyIncome - dailyExpense

  return {
    openingBalanceOfDay,
    dailyIncome,
    dailyExpense,
    dailyNet,
    closingBalance: openingBalanceOfDay + dailyNet,
    transactionCount: dailyTransactions.length,
  }
}

function getCashbookReconciliationForDate(reconciliations, selectedDate) {
  return (reconciliations ?? []).find((reconciliation) => reconciliation.date === selectedDate) ?? null
}

function getDailyCashbookTransactions(transactions, selectedDate) {
  return getValidCashflowTransactions(transactions)
    .filter((transaction) => transaction.transactionDate === selectedDate)
    .sort(
      (firstTransaction, secondTransaction) =>
        new Date(secondTransaction.createdAt || secondTransaction.transactionDate) -
        new Date(firstTransaction.createdAt || firstTransaction.transactionDate),
    )
}

function getValidCashflowTransactions(transactions) {
  return (transactions ?? []).filter(
    (transaction) =>
      transaction &&
      ['income', 'expense'].includes(transaction.type) &&
      isValidDate(transaction.transactionDate),
  )
}

function getTransactionNet(transaction) {
  const amount = getTransactionAmount(transaction)
  return transaction.type === 'expense' ? -amount : amount
}

function getTransactionAmount(transaction) {
  const numberValue =
    typeof transaction.amount === 'string'
      ? Number(transaction.amount.replace(/[^\d]/g, ''))
      : Number(transaction.amount)

  return Number.isFinite(numberValue) ? numberValue : 0
}

function renderCashbookSettingsSummary(settings, selectedDate) {
  const summary = settings.isConfigured
    ? `Số dư đầu kỳ: ${formatMoney(settings.openingBalance)} · Từ ${formatDate(settings.openingDate)} · Cập nhật bởi ${escapeHtml(settings.updatedBy || 'Admin')}`
    : `Số dư đầu kỳ: Chưa thiết lập · Tạm tính từ 0 VNĐ`
  const warning = selectedDate < settings.openingDate
    ? 'Ngày đang chọn trước ngày bắt đầu sổ.'
    : ''

  return `
    <div class="cashbook-settings-summary ${settings.isConfigured ? '' : 'is-warning'}">
      <p>${summary}${warning ? ` · ${warning}` : ''}</p>
    </div>
  `
}

function renderCashbookSettingsPanel(formState) {
  return `
    <div class="cashbook-settings-backdrop" role="presentation">
      <form class="cashbook-settings-panel" data-cashbook-settings-form>
        <div class="cashbook-settings-header">
          <div>
            <h4>Thiết lập số dư đầu kỳ</h4>
            <p>Lưu số dư ban đầu của cơ sở để tính số dư đầu ngày và cuối ngày.</p>
          </div>
          <button type="button" data-cashbook-action="cancel-settings" aria-label="Đóng form">×</button>
        </div>
        <div class="cashbook-settings-grid">
          ${renderSettingsInputField('Số dư đầu kỳ', 'openingBalance', formState, 'text', 'Ví dụ: 5.000.000')}
          ${renderSettingsInputField('Ngày bắt đầu', 'openingDate', formState, 'date')}
          ${renderSettingsInputField('Người cập nhật', 'updatedBy', formState)}
        </div>
        ${renderFormErrors(formState.errors)}
        <div class="cashbook-settings-actions">
          <button type="button" data-cashbook-action="cancel-settings">Hủy</button>
          <button type="submit">Lưu số dư</button>
        </div>
      </form>
    </div>
  `
}

function renderCashbookReconciliationCard(reconciliation, selectedDate, systemClosingBalance) {
  const status = reconciliation ? reconciliation.status : 'pending'
  const difference =
    reconciliation ? reconciliation.actualCash - systemClosingBalance : 0
  const systemChanged =
    reconciliation && reconciliation.systemClosingBalance !== systemClosingBalance
  const actionLabel = reconciliation ? 'Cập nhật đối soát' : 'Đối soát quỹ'
  const closedMeta =
    reconciliation?.isClosed && reconciliation.closedAt
      ? `${formatDateTime(reconciliation.closedAt)} · ${escapeHtml(reconciliation.closedBy || 'Admin')}`
      : ''

  return `
    <section class="cashbook-reconciliation-card is-${status}" aria-label="Đối soát quỹ">
      <div class="cashbook-reconciliation-header">
        <div>
          <h4>Đối soát quỹ</h4>
          <p>${formatDate(selectedDate)}</p>
        </div>
        <span class="cashbook-reconciliation-status is-${status}">
          ${getReconciliationStatusLabel(status)}
        </span>
        ${
          reconciliation?.isClosed
            ? '<span class="cashbook-closed-badge">Đã chốt</span>'
            : ''
        }
      </div>
      <div class="cashbook-reconciliation-grid">
        <div>
          <span>Số dư hệ thống</span>
          <strong>${formatMoney(systemClosingBalance)}</strong>
        </div>
        <div>
          <span>Tiền thực tế</span>
          <strong>${reconciliation ? formatMoney(reconciliation.actualCash) : '—'}</strong>
        </div>
        <div>
          <span>Chênh lệch</span>
          <strong class="${getDifferenceTone(difference)}">
            ${reconciliation ? formatSignedMoney(difference) : '—'}
          </strong>
        </div>
        <div>
          <span>Người đối soát</span>
          <strong>${reconciliation ? escapeHtml(reconciliation.checkedBy) : '—'}</strong>
        </div>
        <div>
          <span>Thời gian</span>
          <strong>${reconciliation ? formatDateTime(reconciliation.updatedAt || reconciliation.checkedAt) : '—'}</strong>
        </div>
        <div>
          <span>Ghi chú</span>
          <strong title="${escapeAttribute(reconciliation?.note)}">${reconciliation?.note ? escapeHtml(reconciliation.note) : '—'}</strong>
        </div>
        <div>
          <span>Chốt sổ</span>
          <strong>${closedMeta || (reconciliation ? 'Chưa chốt' : '—')}</strong>
        </div>
      </div>
      ${
        systemChanged
          ? `<p class="cashbook-reconciliation-warning">${
              reconciliation?.isClosed
                ? 'Ngày này đã chốt sổ nhưng số dư hệ thống đã thay đổi. Cần kiểm tra lại trước khi dùng số liệu.'
                : 'Số dư hệ thống hiện tại đã khác với lúc đối soát. Cần kiểm tra lại giao dịch Thu chi.'
            }</p>`
          : ''
      }
      <div class="cashbook-reconciliation-card-actions">
        <button type="button" data-cashbook-action="open-reconciliation">
          ${actionLabel}
        </button>
        ${
          reconciliation && !reconciliation.isClosed
            ? '<button type="button" data-cashbook-action="close-day">Chốt sổ ngày này</button>'
            : ''
        }
      </div>
    </section>
  `
}

function renderCashbookReconciliationHistory(reconciliations, transactions, settings, selectedDate) {
  const sortedReconciliations = [...(reconciliations ?? [])].sort((firstItem, secondItem) =>
    secondItem.date.localeCompare(firstItem.date),
  )

  return `
    <section class="cashbook-history" aria-label="Lịch sử đối soát">
      <div class="cashbook-history-header">
        <div>
          <h4>Lịch sử đối soát</h4>
          <p>${sortedReconciliations.length} ngày đã đối soát</p>
        </div>
      </div>
      ${
        sortedReconciliations.length
          ? `
            <div class="cashbook-history-list">
              ${sortedReconciliations
                .map((reconciliation) =>
                  renderCashbookHistoryItem(
                    reconciliation,
                    getCashbookBalanceStats(transactions, reconciliation.date, settings).closingBalance,
                    reconciliation.date === selectedDate,
                  ),
                )
                .join('')}
            </div>
          `
          : `
            <div class="cashbook-history-empty">
              <strong>Chưa có lịch sử đối soát.</strong>
              <p>Sau khi lưu đối soát, ngày đó sẽ xuất hiện tại đây.</p>
            </div>
          `
      }
    </section>
  `
}

function renderCashbookHistoryItem(reconciliation, currentSystemClosingBalance, isSelected) {
  const systemChanged = reconciliation.systemClosingBalance !== currentSystemClosingBalance

  return `
    <button
      class="cashbook-history-item ${isSelected ? 'is-selected' : ''} ${systemChanged ? 'has-warning' : ''}"
      type="button"
      data-cashbook-history-date="${escapeAttribute(reconciliation.date)}"
    >
      <span class="cashbook-history-topline">
        <span class="cashbook-history-date">${formatDate(reconciliation.date)}</span>
        <span class="cashbook-reconciliation-status is-${reconciliation.status}">
          ${getReconciliationStatusLabel(reconciliation.status)}
        </span>
        <span class="cashbook-close-state ${reconciliation.isClosed ? 'is-closed' : ''}">
          ${reconciliation.isClosed ? 'Đã chốt' : 'Chưa chốt'}
        </span>
      </span>
      <span class="cashbook-history-values">
        <span><small>Hệ thống</small><strong>${formatMoney(reconciliation.systemClosingBalance)}</strong></span>
        <span><small>Thực tế</small><strong>${formatMoney(reconciliation.actualCash)}</strong></span>
        <span><small>Chênh lệch</small><strong class="${getDifferenceTone(reconciliation.difference)}">${formatSignedMoney(reconciliation.difference)}</strong></span>
      </span>
      <span class="cashbook-history-meta">
        <span title="${escapeAttribute(reconciliation.checkedBy)}">${escapeHtml(reconciliation.checkedBy)}</span>
        <span>${formatDateTime(reconciliation.updatedAt || reconciliation.checkedAt)}</span>
      </span>
      <span class="cashbook-history-note" title="${escapeAttribute(reconciliation.note)}">
        ${reconciliation.note ? escapeHtml(reconciliation.note) : '—'}
      </span>
      ${
        systemChanged
          ? `<span class="cashbook-history-warning">${
              reconciliation.isClosed
                ? 'Đã chốt, số hệ thống đã đổi'
                : 'Số hệ thống đã đổi'
            }</span>`
          : '<span></span>'
      }
    </button>
  `
}

function renderCashbookReconciliationPanel(formState) {
  const currentDifference =
    parseMoneyInput(formState.values.actualCash) - Number(formState.values.systemClosingBalance || 0)

  return `
    <div class="cashbook-reconciliation-backdrop" role="presentation">
      <form class="cashbook-reconciliation-panel" data-cashbook-reconciliation-form>
        <div class="cashbook-reconciliation-form-header">
          <div>
            <h4>Đối soát quỹ cuối ngày</h4>
            <p>Nhập số tiền thực tế trong quỹ để so với số dư hệ thống.</p>
          </div>
          <button type="button" data-cashbook-action="cancel-reconciliation" aria-label="Đóng form">×</button>
        </div>
        <div class="cashbook-reconciliation-form-grid">
          ${renderReadonlyReconciliationField('Ngày', formatDate(formState.values.date))}
          ${renderReadonlyReconciliationField('Số dư cuối ngày hệ thống', formatMoney(formState.values.systemClosingBalance))}
          ${renderReconciliationInputField('Tiền thực tế trong quỹ', 'actualCash', formState, 'text', 'Ví dụ: 3.570.000')}
          ${renderReconciliationInputField('Người đối soát', 'checkedBy', formState)}
          <label class="cashbook-reconciliation-field span-full">
            <span>Ghi chú</span>
            <textarea data-cashbook-reconciliation-field="note">${escapeHtml(formState.values.note ?? '')}</textarea>
          </label>
        </div>
        <div class="cashbook-reconciliation-preview">
          <span>Chênh lệch tạm tính</span>
          <strong class="${getDifferenceTone(currentDifference)}">${formatSignedMoney(currentDifference)}</strong>
        </div>
        ${renderFormErrors(formState.errors)}
        <div class="cashbook-reconciliation-actions">
          <button type="button" data-cashbook-action="cancel-reconciliation">Hủy</button>
          <button type="submit">Lưu đối soát</button>
        </div>
      </form>
    </div>
  `
}

function renderReadonlyReconciliationField(label, value) {
  return `
    <div class="cashbook-reconciliation-field is-readonly">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `
}

function renderReconciliationInputField(label, name, formState, type = 'text', placeholder = '') {
  return `
    <label class="cashbook-reconciliation-field">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        placeholder="${escapeAttribute(placeholder)}"
        data-cashbook-reconciliation-field="${name}"
      />
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderSettingsInputField(label, name, formState, type = 'text', placeholder = '') {
  return `
    <label class="cashbook-settings-field">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        placeholder="${escapeAttribute(placeholder)}"
        data-cashbook-settings-field="${name}"
      />
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderFormErrors(errors) {
  const errorMessages = Object.values(errors ?? {}).filter(Boolean)

  if (!errorMessages.length) {
    return ''
  }

  return `
    <div class="cashbook-settings-errors">
      ${errorMessages.map((error) => `<p>${escapeHtml(error)}</p>`).join('')}
    </div>
  `
}

function renderCashbookTransactionList(transactions) {
  return `
    <div class="cashbook-table-wrap">
      <table class="cashbook-table">
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
          ${transactions.map(renderCashbookTransactionRow).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderCashbookTransactionRow(transaction) {
  return `
    <tr class="cashbook-row">
      <td>${formatDate(transaction.transactionDate)}</td>
      <td><span class="cashbook-type-badge is-${transaction.type}">${getTypeLabel(transaction.type)}</span></td>
      <td title="${escapeAttribute(transaction.category)}">${escapeHtml(transaction.category || 'Khác')}</td>
      <td title="${escapeAttribute(transaction.personName)}">${transaction.personName ? escapeHtml(transaction.personName) : '—'}</td>
      <td title="${escapeAttribute(transaction.method)}">${escapeHtml(transaction.method || 'Khác')}</td>
      <td class="cashbook-amount is-${transaction.type}">${formatMoney(transaction.amount)}</td>
      <td title="${escapeAttribute(transaction.recordedBy)}">${escapeHtml(getRecordedByDisplayName(transaction.recordedBy))}</td>
      <td title="${escapeAttribute(transaction.note)}">${renderCashbookNote(transaction)}</td>
    </tr>
  `
}

function renderCashbookNote(transaction) {
  const noteText = transaction.note ? escapeHtml(transaction.note) : '—'
  const sourceLabel = getCashbookSourceLabel(transaction.sourceModule)

  if (!sourceLabel) {
    return noteText
  }

  return `
    <span class="cashbook-source-badge">${sourceLabel}</span>
    <span>${noteText}</span>
  `
}

function getCashbookSourceLabel(sourceModule) {
  const labels = {
    'hoc-phi': 'Từ Học phí',
    'kho-hang': 'Từ Kho hàng',
  }

  return labels[sourceModule] ?? ''
}

function renderCashbookStat(label, value, tone) {
  return `
    <div class="cashbook-stat-card is-${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `
}

function getTypeLabel(type) {
  return type === 'expense' ? 'Chi' : 'Thu'
}

function getReconciliationStatusLabel(status) {
  const labels = {
    pending: 'Chưa đối soát',
    matched: 'Khớp quỹ',
    mismatched: 'Lệch quỹ',
  }

  return labels[status] ?? labels.pending
}

function getDifferenceTone(difference) {
  if (difference > 0) {
    return 'is-positive'
  }

  if (difference < 0) {
    return 'is-negative'
  }

  return 'is-zero'
}

function getRecordedByDisplayName(recordedBy) {
  const text = String(recordedBy ?? '').trim()
  return text === 'Admin DreamHome' ? 'Admin' : text || '—'
}

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('vi-VN')} VNĐ`
}

function formatSignedMoney(amount) {
  if (amount > 0) {
    return `+${formatMoney(amount)}`
  }

  if (amount < 0) {
    return `-${formatMoney(Math.abs(amount))}`
  }

  return formatMoney(0)
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

function getEarliestTransactionDate(transactions) {
  return getValidCashflowTransactions(transactions)
    .map((transaction) => transaction.transactionDate)
    .sort((firstDate, secondDate) => firstDate.localeCompare(secondDate))[0]
}

function parseMoneyInput(value) {
  const text = String(value ?? '').trim()

  if (text.startsWith('-')) {
    return -1
  }

  const amount = Number(text.replace(/[^\d]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function hasMoneyDigits(value) {
  return /\d/.test(String(value ?? ''))
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
