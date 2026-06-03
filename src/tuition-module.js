export const initialTuitionFilters = {
  query: '',
  status: 'all',
  package: 'all',
}

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'remaining-2', label: 'Còn 2 buổi' },
  { value: 'remaining-1', label: 'Còn 1 buổi' },
  { value: 'due', label: 'Đến hạn' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'no-package', label: 'Chưa có gói' },
  { value: 'debt', label: 'Còn nợ' },
]

const packageOptions = [
  { value: 'all', label: 'Tất cả gói' },
  { value: '8', label: '8 buổi' },
  { value: '16', label: '16 buổi' },
  { value: '32', label: '32 buổi' },
  { value: 'other', label: 'Gói khác' },
  { value: 'no-package', label: 'Chưa có gói' },
]

const paymentMethodOptions = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' },
  { value: 'other', label: 'Khác' },
]

export function createEmptyTuitionFormState(student) {
  return {
    mode: 'create',
    studentId: student.id,
    values: {
      packageName: 'Gói 8 buổi',
      totalSessions: '8',
      usedSessions: '0',
      totalAmount: '',
      discountAmount: '0',
      paidAmount: '',
      dueDate: '',
      note: '',
    },
    errors: {},
  }
}

export function createEditTuitionFormState(student, tuitionRecord) {
  return {
    mode: 'edit',
    studentId: student.id,
    tuitionId: tuitionRecord.id,
    record: tuitionRecord,
    values: {
      packageName: tuitionRecord.packageName,
      totalSessions: String(tuitionRecord.totalSessions),
      usedSessions: String(tuitionRecord.usedSessions),
      totalAmount: formatMoneyInput(tuitionRecord.totalAmount),
      discountAmount: formatMoneyInput(tuitionRecord.discountAmount ?? 0),
      paidAmount: formatMoneyInput(tuitionRecord.paidAmount),
      dueDate: tuitionRecord.dueDate,
      note: tuitionRecord.note,
    },
    errors: {},
  }
}

export function createRenewTuitionFormState(student, tuitionRecord) {
  return {
    mode: 'renew',
    studentId: student.id,
    tuitionId: tuitionRecord.id,
    record: tuitionRecord,
    values: {
      packageName: tuitionRecord.packageName,
      totalSessions: String(tuitionRecord.totalSessions || 8),
      usedSessions: '0',
      totalAmount: formatMoneyInput(tuitionRecord.totalAmount),
      discountAmount: formatMoneyInput(tuitionRecord.discountAmount ?? 0),
      paidAmount: '0',
      dueDate: '',
      note: '',
    },
    errors: {},
  }
}

export function createPaymentFormState(student, tuitionRecord, mode = 'collect') {
  return {
    mode,
    studentId: student.id,
    tuitionId: tuitionRecord.id,
    values: {
      amount: '',
      paidAt: getTodayInputValue(),
      method: 'cash',
      collectorName: 'Admin DreamHome',
      note: '',
    },
    errors: {},
  }
}

export function renderTuitionModule(
  students,
  tuitionRecords,
  filters,
  formState = null,
  paymentFormState = null,
  detailState = null,
) {
  const rows = buildTuitionRows(students, tuitionRecords)
  const visibleRows = filterTuitionRows(rows, filters)
  const stats = getTuitionStats(rows)
  const formStudent = formState ? students.find((student) => student.id === formState.studentId) : null
  const paymentStudent = paymentFormState
    ? students.find((student) => student.id === paymentFormState.studentId)
    : null
  const paymentTuition = paymentFormState
    ? tuitionRecords.find((record) => record.id === paymentFormState.tuitionId)
    : null
  const detailStudent = detailState
    ? students.find((student) => student.id === detailState.studentId)
    : null
  const detailTuition = detailState
    ? tuitionRecords.find((record) => record.studentId === detailState.studentId)
    : null
  const hasPanel = Boolean(formState || paymentFormState || detailState)

  return `
    <section class="tuition-module ${hasPanel ? 'form-open' : ''}">
      <div class="tuition-module-content">
        <div class="tuition-overview">
          <div class="tuition-filter-row">
            <label>
              <span>Tìm kiếm</span>
              <input
                type="search"
                value="${escapeHtml(filters.query)}"
                data-tuition-filter="query"
                placeholder="Tên học viên, phụ huynh, SĐT, ghi chú"
              />
            </label>
            <label>
              <span>Trạng thái</span>
              <select data-tuition-filter="status">
                ${renderOptions(statusOptions, filters.status)}
              </select>
            </label>
            <label>
              <span>Gói buổi</span>
              <select data-tuition-filter="package">
                ${renderOptions(packageOptions, filters.package)}
              </select>
            </label>
          </div>
          <div class="tuition-stats" aria-label="Thống kê học phí">
            ${renderStat('Tổng học viên', stats.total)}
            ${renderStat('Đã có gói', stats.withPackage)}
            ${renderStat('Chưa có gói', stats.noPackage)}
            ${renderStat('Còn 2/1 buổi', stats.lowSessions)}
            ${renderStat('Đến hạn', stats.due)}
            ${renderStat('Quá hạn', stats.overdue)}
            ${renderStat('Còn nợ', stats.debt)}
          </div>
        </div>
        <div class="tuition-table-wrap">
          <table class="tuition-table">
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Phụ huynh</th>
                <th>Gói</th>
                <th>Buổi đã học</th>
                <th>Học phí</th>
                <th>Ưu đãi</th>
                <th>Thanh toán</th>
                <th>Còn nợ</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${
                visibleRows.length
                  ? visibleRows.map((row) => renderTuitionRow(row)).join('')
                  : '<tr><td class="tuition-empty" colspan="10">Không có học viên phù hợp.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
      ${formState && formStudent ? renderTuitionForm(formStudent, formState) : ''}
      ${
        paymentFormState && paymentStudent && paymentTuition
          ? renderPaymentForm(paymentStudent, paymentTuition, paymentFormState)
          : ''
      }
      ${detailState && detailStudent ? renderTuitionDetailPanel(detailStudent, detailTuition) : ''}
    </section>
  `
}

export function buildTuitionRows(students, tuitionRecords) {
  const tuitionByStudentId = new Map(tuitionRecords.map((record) => [record.studentId, record]))

  return students.map((student) => {
    const tuition = tuitionByStudentId.get(student.id)

    if (!tuition) {
      return {
        student,
        tuition: null,
        packageKind: 'no-package',
        status: {
          key: 'no-package',
          label: 'Chưa có gói',
          level: 'muted',
        },
        remainingSessions: null,
        debtAmount: null,
        searchableText: normalizeSearchText(
          `${student.fullName} ${student.parentName} ${student.parentPhone} Cần gán gói học phí`,
        ),
      }
    }

    const remainingSessions = tuition.totalSessions - tuition.usedSessions
    const debtAmount = getTuitionDebtAmount(tuition)
    const status = getTuitionWarningStatus(remainingSessions)
    const packageKind = getPackageKind(tuition.totalSessions)

    return {
      student,
      tuition,
      packageKind,
      status,
      remainingSessions,
      debtAmount,
      searchableText: normalizeSearchText(
        `${student.fullName} ${student.parentName} ${student.parentPhone} ${tuition.note}`,
      ),
    }
  })
}

export function getTuitionWarningStatus(remainingSessions) {
  if (remainingSessions < 0) {
    return { key: 'overdue', label: 'Quá hạn', level: 'danger' }
  }

  if (remainingSessions === 0) {
    return { key: 'due', label: 'Đến hạn', level: 'due' }
  }

  if (remainingSessions === 1) {
    return { key: 'remaining-1', label: 'Còn 1 buổi', level: 'warning' }
  }

  if (remainingSessions === 2) {
    return { key: 'remaining-2', label: 'Còn 2 buổi', level: 'info' }
  }

  return { key: 'normal', label: 'Bình thường', level: 'normal' }
}

export function createTuitionWarningNotification(row) {
  if (!row.tuition || !['remaining-2', 'remaining-1', 'due', 'overdue'].includes(row.status.key)) {
    return null
  }

  const notificationByStatus = {
    'remaining-2': {
      warningKey: 'remaining-2',
      title: 'Học phí: còn 2 buổi',
      message: `${row.student.fullName} còn 2 buổi. Nên nhắc phụ huynh chuẩn bị tái đăng ký.`,
      level: 'info',
    },
    'remaining-1': {
      warningKey: 'remaining-1',
      title: 'Học phí: còn 1 buổi',
      message: `${row.student.fullName} còn 1 buổi. Cần nhắc phụ huynh sớm.`,
      level: 'warning',
    },
    due: {
      warningKey: 'due-0',
      title: 'Học phí: đến hạn',
      message: `${row.student.fullName} đã hết số buổi trong gói. Cần xử lý học phí/tái đăng ký.`,
      level: 'warning',
    },
    overdue: {
      warningKey: 'overdue',
      title: 'Học phí: quá hạn',
      message: `${row.student.fullName} đã học vượt số buổi đã đăng ký. Cần xử lý ngay.`,
      level: 'danger',
    },
  }
  const notification = notificationByStatus[row.status.key]

  return {
    id: `tuition-warning-${row.tuition.id}-${row.tuition.currentTermId || `term-${row.tuition.currentTermNumber || 1}`}-${notification.warningKey}`,
    type: 'tuition',
    level: notification.level,
    title: notification.title,
    message: notification.message,
    sourceModule: 'hoc-phi',
    createdAt: new Date().toISOString(),
    read: false,
  }
}

export function getTuitionPayableAmount(tuitionRecord) {
  return Math.max(
    Number(tuitionRecord.totalAmount || 0) - Number(tuitionRecord.discountAmount || 0),
    0,
  )
}

export function getTuitionDebtAmount(tuitionRecord) {
  return Math.max(getTuitionPayableAmount(tuitionRecord) - Number(tuitionRecord.paidAmount || 0), 0)
}

export function getTuitionOverpaidAmount(tuitionRecord) {
  return Math.max(Number(tuitionRecord.paidAmount || 0) - getTuitionPayableAmount(tuitionRecord), 0)
}

export function normalizeTuitionFormValues(values) {
  return {
    packageName: String(values.packageName || '').trim(),
    totalSessions: normalizeInteger(values.totalSessions),
    usedSessions: normalizeInteger(values.usedSessions),
    totalAmount: normalizeMoney(values.totalAmount),
    discountAmount: normalizeMoney(values.discountAmount),
    paidAmount: normalizeMoney(values.paidAmount),
    dueDate: String(values.dueDate || '').trim(),
    note: String(values.note || '').trim(),
  }
}

export function validateTuitionForm(values) {
  const normalizedValues = normalizeTuitionFormValues(values)
  const errors = {}

  if (!normalizedValues.packageName) {
    errors.packageName = 'Cần nhập tên gói học phí.'
  }

  if (!Number.isInteger(normalizedValues.totalSessions) || normalizedValues.totalSessions <= 0) {
    errors.totalSessions = 'Tổng số buổi phải lớn hơn 0.'
  }

  if (!Number.isInteger(normalizedValues.usedSessions) || normalizedValues.usedSessions < 0) {
    errors.usedSessions = 'Số buổi đã học không được âm.'
  }

  if (!Number.isFinite(normalizedValues.totalAmount) || normalizedValues.totalAmount < 0) {
    errors.totalAmount = 'Học phí không hợp lệ.'
  }

  if (!Number.isFinite(normalizedValues.discountAmount) || normalizedValues.discountAmount < 0) {
    errors.discountAmount = 'Ưu đãi không hợp lệ.'
  }

  if (
    Number.isFinite(normalizedValues.discountAmount) &&
    Number.isFinite(normalizedValues.totalAmount) &&
    normalizedValues.discountAmount > normalizedValues.totalAmount
  ) {
    errors.discountAmount = 'Ưu đãi không được lớn hơn học phí.'
  }

  if (!Number.isFinite(normalizedValues.paidAmount) || normalizedValues.paidAmount < 0) {
    errors.paidAmount = 'Số tiền đã đóng không hợp lệ.'
  }

  return errors
}

export function validateRenewTuitionForm(values) {
  const errors = validateTuitionForm(values)
  const normalizedValues = normalizeTuitionFormValues(values)

  if (
    Number.isInteger(normalizedValues.usedSessions) &&
    Number.isInteger(normalizedValues.totalSessions) &&
    normalizedValues.usedSessions > normalizedValues.totalSessions
  ) {
    errors.usedSessions = 'Kỳ mới không nên có số buổi đã học lớn hơn tổng số buổi.'
  }

  return errors
}

export function normalizePaymentFormValues(values) {
  return {
    amount: normalizeMoney(values.amount),
    paidAt: String(values.paidAt || '').trim(),
    method: ['cash', 'transfer', 'other'].includes(values.method) ? values.method : 'other',
    collectorName: String(values.collectorName || '').trim(),
    note: String(values.note || '').trim(),
  }
}

export function validatePaymentForm(values) {
  const normalizedValues = normalizePaymentFormValues(values)
  const errors = {}

  if (!Number.isFinite(normalizedValues.amount) || normalizedValues.amount <= 0) {
    errors.amount = 'Số tiền đóng phải lớn hơn 0.'
  }

  if (!normalizedValues.paidAt || Number.isNaN(new Date(normalizedValues.paidAt).getTime())) {
    errors.paidAt = 'Ngày đóng không hợp lệ.'
  }

  if (!normalizedValues.collectorName) {
    errors.collectorName = 'Cần nhập người thu.'
  }

  return errors
}

function filterTuitionRows(rows, filters) {
  const query = normalizeSearchText(filters.query)

  return rows.filter((row) => {
    const matchesQuery = !query || row.searchableText.includes(query)
    const matchesStatus =
      filters.status === 'all' ||
      row.status.key === filters.status ||
      (filters.status === 'debt' && Number(row.debtAmount) > 0)
    const matchesPackage = filters.package === 'all' || row.packageKind === filters.package
    return matchesQuery && matchesStatus && matchesPackage
  })
}

function renderTuitionRow(row) {
  const tuition = row.tuition
  const compactStudentName = getCompactStudentName(row.student.fullName)
  const note = tuition?.note || 'Cần gán gói học phí'
  const hasOverpayment = tuition ? getTuitionOverpaidAmount(tuition) > 0 : false
  const rowTitle = tuition ? 'Bấm để cập nhật gói học phí' : 'Bấm để gán gói học phí'
  const termNumber = tuition?.currentTermNumber || 1

  return `
    <tr
      class="tuition-clickable-row"
      data-tuition-row-student-id="${row.student.id}"
      tabindex="0"
      title="${rowTitle}"
    >
      <td title="${escapeHtml(row.student.fullName)}"><strong>${escapeHtml(compactStudentName)}</strong></td>
      <td title="${escapeHtml(row.student.parentPhone || '')}">${escapeHtml(row.student.parentName || '—')}</td>
      <td>
        ${
          tuition
            ? escapeHtml(tuition.packageName)
            : '<span class="tuition-muted">Chưa có gói</span>'
        }
      </td>
      <td>
        ${
          tuition
            ? `${tuition.usedSessions}/${tuition.totalSessions}${termNumber > 1 ? ` <small class="tuition-term-chip">· Kỳ ${termNumber}</small>` : ''}`
            : '—'
        }
      </td>
      <td title="${tuition ? formatMoney(tuition.totalAmount) : ''}">${tuition ? formatMoney(tuition.totalAmount) : '—'}</td>
      <td title="${tuition ? formatMoney(tuition.discountAmount || 0) : ''}">${tuition ? formatMoney(tuition.discountAmount || 0) : '—'}</td>
      <td title="${tuition ? formatMoney(tuition.paidAmount) : ''}">${tuition ? formatMoney(tuition.paidAmount) : '—'}</td>
      <td>
        ${
          tuition
            ? `
              <button
                class="tuition-debt-button ${row.debtAmount > 0 ? 'has-debt' : 'is-paid'}"
                type="button"
                data-tuition-action="open-debt"
                data-tuition-student-id="${row.student.id}"
                title="${row.debtAmount > 0 ? 'Ghi nhận đóng tiền' : 'Xem lịch sử thanh toán'}"
              >
                ${formatMoney(row.debtAmount)}
              </button>
              ${hasOverpayment ? '<span class="tuition-overpaid-badge">Có đóng dư</span>' : ''}
            `
            : '—'
        }
      </td>
      <td>
        <button
          class="tuition-status tuition-status-${row.status.level}"
          type="button"
          data-tuition-action="open-detail"
          data-tuition-student-id="${row.student.id}"
          title="Xem chi tiết học phí"
        >
          ${row.status.label}
        </button>
      </td>
      <td title="${escapeHtml(note)}">
        <span class="tuition-note-text">${escapeHtml(note)}</span>
      </td>
    </tr>
  `
}

function renderTuitionForm(student, formState) {
  const isEdit = formState.mode === 'edit'
  const isRenew = formState.mode === 'renew'
  const { values, errors } = formState

  return `
    <div class="tuition-form-backdrop" data-tuition-action="cancel-form"></div>
    <form class="tuition-form-panel" data-tuition-form>
      <div class="tuition-form-header">
        <div>
          <h4>${isRenew ? 'Gia hạn / Tạo kỳ mới' : isEdit ? 'Cập nhật gói học phí' : 'Gán gói học phí'}</h4>
          <p>${escapeHtml(student.fullName)} · ${escapeHtml(student.parentName || 'Chưa có phụ huynh')} · ${escapeHtml(student.parentPhone || 'Chưa có SĐT')}</p>
        </div>
        <button type="button" data-tuition-action="cancel-form" aria-label="Đóng form">X</button>
      </div>
      ${isEdit || isRenew ? renderCurrentTermSummary(formState.record) : ''}
      ${
        isRenew && formState.record && getTuitionOverpaidAmount(formState.record) > 0
          ? '<p class="tuition-payment-warning">Kỳ hiện tại có khoản đóng dư. Vui lòng nhập thủ công số tiền muốn ghi nhận cho kỳ mới.</p>'
          : ''
      }
      <div class="tuition-package-suggestions" aria-label="Gợi ý gói buổi">
        ${[8, 16, 32]
          .map(
            (sessionCount) => `
              <button
                class="${String(values.totalSessions) === String(sessionCount) ? 'active' : ''}"
                type="button"
                data-tuition-package-suggestion="${sessionCount}"
              >
                ${sessionCount} buổi
              </button>
            `,
          )
          .join('')}
      </div>
      <div class="tuition-form-grid">
        ${renderTextField('packageName', 'Tên gói', values.packageName, errors.packageName)}
        ${renderTextField('totalSessions', 'Tổng số buổi', values.totalSessions, errors.totalSessions, 'number')}
        ${renderTextField('usedSessions', 'Số buổi đã học', values.usedSessions, errors.usedSessions, 'number')}
        ${renderTextField('totalAmount', 'Học phí', values.totalAmount, errors.totalAmount)}
        ${renderTextField('discountAmount', 'Ưu đãi', values.discountAmount, errors.discountAmount)}
        ${renderTextField('paidAmount', isRenew ? 'Thanh toán ban đầu' : 'Thanh toán', values.paidAmount, errors.paidAmount)}
        ${renderTextField('dueDate', 'Hạn đóng / ngày nhắc', values.dueDate, errors.dueDate, 'date')}
        <label class="span-full ${errors.note ? 'has-error' : ''}">
          <span>Ghi chú</span>
          <textarea data-tuition-form-field="note">${escapeHtml(values.note)}</textarea>
          ${errors.note ? `<small>${errors.note}</small>` : ''}
        </label>
      </div>
      ${isEdit || isRenew ? renderTermHistory(formState.record?.termHistory ?? []) : ''}
      <div class="tuition-form-actions">
        <button type="button" data-tuition-action="cancel-form">Hủy</button>
        ${
          isEdit
            ? '<button type="button" data-tuition-action="open-renew" data-tuition-id="' +
              formState.tuitionId +
              '">Gia hạn / Tạo kỳ mới</button>'
            : ''
        }
        <button type="submit" data-tuition-action="save-form">${isRenew ? 'Tạo kỳ mới' : 'Lưu gói'}</button>
      </div>
    </form>
  `
}

function renderCurrentTermSummary(tuitionRecord) {
  if (!tuitionRecord) {
    return ''
  }

  const debtAmount = getTuitionDebtAmount(tuitionRecord)
  const payableAmount = getTuitionPayableAmount(tuitionRecord)

  return `
    <section class="tuition-term-summary" aria-label="Kỳ hiện tại">
      <div>
        <span>Kỳ hiện tại</span>
        <strong>Kỳ ${tuitionRecord.currentTermNumber || 1} · ${escapeHtml(tuitionRecord.packageName)}</strong>
      </div>
      <div>
        <span>Buổi</span>
        <strong>${tuitionRecord.usedSessions}/${tuitionRecord.totalSessions}</strong>
      </div>
      <div>
        <span>Học phí</span>
        <strong>${formatMoney(tuitionRecord.totalAmount)}</strong>
      </div>
      <div>
        <span>Ưu đãi</span>
        <strong>${formatMoney(tuitionRecord.discountAmount || 0)}</strong>
      </div>
      <div>
        <span>Số phải đóng</span>
        <strong>${formatMoney(payableAmount)}</strong>
      </div>
      <div>
        <span>Thanh toán</span>
        <strong>${formatMoney(tuitionRecord.paidAmount)}</strong>
      </div>
      <div>
        <span>Còn nợ</span>
        <strong>${formatMoney(debtAmount)}</strong>
      </div>
    </section>
  `
}

function renderTermHistory(termHistory) {
  return `
    <section class="tuition-term-history" aria-label="Lịch sử kỳ học">
      <h5>Lịch sử kỳ học</h5>
      ${
        termHistory.length
          ? `
            <div class="tuition-term-history-list">
              ${[...termHistory]
                .sort((firstTerm, secondTerm) => Number(secondTerm.termNumber) - Number(firstTerm.termNumber))
                .map((term) => renderTermHistoryItem(term))
                .join('')}
            </div>
          `
          : '<p class="tuition-payment-empty">Chưa có kỳ học cũ.</p>'
      }
    </section>
  `
}

function renderTermHistoryItem(term) {
  const debtAmount = getTuitionDebtAmount(term)
  const payableAmount = getTuitionPayableAmount(term)
  const statusLabel = term.status === 'completed' ? 'Đã hoàn tất' : 'Đã lưu lịch sử'
  const dateText = [formatCompactDate(term.startedAt), formatCompactDate(term.endedAt)]
    .filter(Boolean)
    .join(' - ')

  return `
    <article class="tuition-term-history-item">
      <div>
        <strong>Kỳ ${term.termNumber || ''} · ${escapeHtml(term.packageName)}</strong>
        <span>${statusLabel}</span>
      </div>
      <p>Buổi: ${term.usedSessions}/${term.totalSessions} · Học phí: ${formatMoney(term.totalAmount)} · Ưu đãi: ${formatMoney(term.discountAmount || 0)} · Phải đóng: ${formatMoney(payableAmount)} · Thanh toán: ${formatMoney(term.paidAmount)} · Còn nợ: ${formatMoney(debtAmount)}</p>
      <small>${dateText || 'Chưa có ngày bắt đầu/kết thúc'}${term.payments?.length ? ` · ${term.payments.length} thanh toán` : ''}</small>
      ${renderTermPayments(term.payments ?? [])}
    </article>
  `
}

function renderTermPayments(payments) {
  if (!payments.length) {
    return ''
  }

  return `
    <ul class="tuition-term-payment-list">
      ${[...payments]
        .sort((firstPayment, secondPayment) => new Date(secondPayment.paidAt) - new Date(firstPayment.paidAt))
        .map(
          (payment) => `
            <li>
              ${formatMoney(payment.amount)} · ${formatPaymentDate(payment.paidAt)} · ${escapeHtml(payment.collectorName || 'Chưa rõ người thu')}
            </li>
          `,
        )
        .join('')}
    </ul>
  `
}

function renderPaymentForm(student, tuitionRecord, formState) {
  const { values, errors } = formState
  const debtAmount = getTuitionDebtAmount(tuitionRecord)
  const overpaidAmount = getTuitionOverpaidAmount(tuitionRecord)
  const payableAmount = getTuitionPayableAmount(tuitionRecord)
  const isHistoryOnly = formState.mode === 'history'
  const normalizedPayment = normalizePaymentFormValues(values)
  const isOverDebt = Number.isFinite(normalizedPayment.amount) && normalizedPayment.amount > debtAmount

  return `
    <div class="tuition-form-backdrop" data-tuition-payment-action="cancel-payment"></div>
    <form class="tuition-form-panel tuition-payment-panel" ${isHistoryOnly ? '' : 'data-tuition-payment-form'}>
      <div class="tuition-form-header">
        <div>
          <h4>${isHistoryOnly ? 'Lịch sử thanh toán' : 'Ghi nhận đóng tiền'}</h4>
          <p>${escapeHtml(student.fullName)} · ${escapeHtml(tuitionRecord.packageName)} · ${escapeHtml(student.parentPhone || 'Chưa có SĐT')}</p>
        </div>
        <button type="button" data-tuition-payment-action="cancel-payment" aria-label="Đóng form">X</button>
      </div>
      <div class="tuition-payment-summary">
        ${renderPaymentSummary('Học phí', formatMoney(tuitionRecord.totalAmount))}
        ${renderPaymentSummary('Ưu đãi', formatMoney(tuitionRecord.discountAmount || 0))}
        ${renderPaymentSummary('Số phải đóng', formatMoney(payableAmount))}
        ${renderPaymentSummary('Thanh toán', formatMoney(tuitionRecord.paidAmount))}
        ${renderPaymentSummary('Còn nợ', formatMoney(debtAmount))}
      </div>
      ${
        overpaidAmount > 0
          ? `<p class="tuition-payment-warning">Khoản dư ${formatMoney(overpaidAmount)} cần xử lý khi tái đăng ký/gia hạn gói ở phase sau.</p>`
          : ''
      }
      ${
        isOverDebt
          ? '<p class="tuition-payment-warning">Số tiền đóng lớn hơn khoản còn nợ. Khoản dư nên được xử lý bằng tái đăng ký/gia hạn gói ở phase sau.</p>'
          : ''
      }
      ${
        isHistoryOnly
          ? '<p class="tuition-payment-empty">Học viên không còn nợ. Panel này chỉ hiển thị lịch sử thanh toán.</p>'
          : `
            <div class="tuition-form-grid">
              ${renderTextField('amount', 'Số tiền đóng lần này', values.amount, errors.amount, 'text', 'payment')}
              ${renderTextField('paidAt', 'Ngày đóng', values.paidAt, errors.paidAt, 'date', 'payment')}
              <label class="${errors.method ? 'has-error' : ''}">
                <span>Hình thức thanh toán</span>
                <select data-tuition-payment-field="method">
                  ${renderOptions(paymentMethodOptions, values.method)}
                </select>
                ${errors.method ? `<small>${errors.method}</small>` : ''}
              </label>
              ${renderTextField('collectorName', 'Người thu', values.collectorName, errors.collectorName, 'text', 'payment')}
              <label class="span-full ${errors.note ? 'has-error' : ''}">
                <span>Ghi chú</span>
                <textarea data-tuition-payment-field="note">${escapeHtml(values.note)}</textarea>
                ${errors.note ? `<small>${errors.note}</small>` : ''}
              </label>
            </div>
          `
      }
      <section class="tuition-payment-history" aria-label="Lịch sử thanh toán">
        <h5>Lịch sử thanh toán</h5>
        ${renderPaymentHistory(tuitionRecord.payments ?? [])}
      </section>
      ${renderTermHistory(tuitionRecord.termHistory ?? [])}
      <div class="tuition-form-actions">
        <button type="button" data-tuition-payment-action="cancel-payment">${isHistoryOnly ? 'Đóng' : 'Hủy'}</button>
        ${isHistoryOnly ? '' : '<button type="submit" data-tuition-payment-action="save-payment">Lưu thanh toán</button>'}
      </div>
    </form>
  `
}

function renderTuitionDetailPanel(student, tuitionRecord) {
  return `
    <div class="tuition-form-backdrop" data-tuition-detail-action="close-detail"></div>
    <section class="tuition-form-panel tuition-detail-panel" aria-label="Chi tiết học phí">
      <div class="tuition-form-header">
        <div>
          <h4>Chi tiết học phí</h4>
          <p>${escapeHtml(student.fullName)} · ${escapeHtml(student.parentName || 'Chưa có phụ huynh')} · ${escapeHtml(student.parentPhone || 'Chưa có SĐT')}</p>
        </div>
        <button type="button" data-tuition-detail-action="close-detail" aria-label="Đóng panel">X</button>
      </div>
      ${
        tuitionRecord
          ? renderTuitionDetailContent(tuitionRecord)
          : `
            <div class="tuition-detail-empty">
              <strong>Học viên này chưa có gói học phí.</strong>
              <p>Bấm vào dòng học viên trong bảng để gán gói.</p>
            </div>
          `
      }
      <div class="tuition-form-actions">
        <button type="button" data-tuition-detail-action="close-detail">Đóng</button>
      </div>
    </section>
  `
}

function renderTuitionDetailContent(tuitionRecord) {
  const remainingSessions = tuitionRecord.totalSessions - tuitionRecord.usedSessions
  const debtAmount = getTuitionDebtAmount(tuitionRecord)
  const overpaidAmount = getTuitionOverpaidAmount(tuitionRecord)
  const payableAmount = getTuitionPayableAmount(tuitionRecord)
  const status = getTuitionWarningStatus(remainingSessions)

  return `
    <section class="tuition-detail-overview" aria-label="Tổng quan kỳ hiện tại">
      ${renderDetailMetric('Gói hiện tại', escapeHtml(tuitionRecord.packageName))}
      ${renderDetailMetric('Kỳ', `Kỳ ${tuitionRecord.currentTermNumber || 1}`)}
      ${renderDetailMetric('Tổng số buổi', tuitionRecord.totalSessions)}
      ${renderDetailMetric('Đã học', tuitionRecord.usedSessions)}
      ${renderDetailMetric('Còn lại', remainingSessions)}
      ${renderDetailMetric('Học phí', formatMoney(tuitionRecord.totalAmount))}
      ${renderDetailMetric('Ưu đãi', formatMoney(tuitionRecord.discountAmount || 0))}
      ${renderDetailMetric('Số phải đóng', formatMoney(payableAmount))}
      ${renderDetailMetric('Thanh toán', formatMoney(tuitionRecord.paidAmount))}
      ${renderDetailMetric('Còn nợ', formatMoney(debtAmount))}
      ${renderDetailMetric('Hạn đóng / ngày nhắc', tuitionRecord.dueDate || 'Chưa đặt')}
      ${renderDetailMetric('Trạng thái', status.label)}
      ${renderDetailMetric('Ghi chú', escapeHtml(tuitionRecord.note || 'Không có ghi chú'), true)}
    </section>
    ${
      overpaidAmount > 0
        ? `<p class="tuition-payment-warning">Có đóng dư ${formatMoney(overpaidAmount)}. Khoản dư nên xử lý khi gia hạn/tạo kỳ mới.</p>`
        : ''
    }
    <section class="tuition-payment-history" aria-label="Lịch sử thanh toán kỳ hiện tại">
      <h5>Lịch sử thanh toán kỳ hiện tại</h5>
      ${renderPaymentHistory(tuitionRecord.payments ?? [], 'Chưa có thanh toán nào trong kỳ hiện tại.')}
    </section>
    ${renderTermHistory(tuitionRecord.termHistory ?? [])}
  `
}

function renderDetailMetric(label, value, wide = false) {
  return `
    <div class="${wide ? 'wide' : ''}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `
}

function renderPaymentSummary(label, value) {
  return `
    <div>
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `
}

function renderPaymentHistory(payments, emptyMessage = 'Chưa có lịch sử thanh toán.') {
  if (!payments.length) {
    return `<p class="tuition-payment-empty">${emptyMessage}</p>`
  }

  return `
    <div class="tuition-payment-history-list">
      ${[...payments]
        .sort((firstPayment, secondPayment) => new Date(secondPayment.paidAt) - new Date(firstPayment.paidAt))
        .map(
          (payment) => `
            <article class="tuition-payment-item">
              <div>
                <strong>${formatMoney(payment.amount)}</strong>
                <time datetime="${payment.paidAt}">${formatPaymentDate(payment.paidAt)}</time>
              </div>
              <p>${getPaymentMethodLabel(payment.method)} · ${escapeHtml(payment.collectorName || 'Chưa rõ người thu')}</p>
              ${payment.note ? `<small>${escapeHtml(payment.note)}</small>` : ''}
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderTextField(fieldName, label, value, error, type = 'text', scope = 'tuition') {
  const dataAttribute =
    scope === 'payment'
      ? `data-tuition-payment-field="${fieldName}"`
      : `data-tuition-form-field="${fieldName}"`

  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeHtml(value)}"
        ${dataAttribute}
        ${type === 'number' ? 'min="0" step="1"' : ''}
      />
      ${error ? `<small>${error}</small>` : ''}
    </label>
  `
}

function getTuitionStats(rows) {
  return rows.reduce(
    (stats, row) => ({
      total: stats.total + 1,
      withPackage: stats.withPackage + (row.tuition ? 1 : 0),
      noPackage: stats.noPackage + (!row.tuition ? 1 : 0),
      lowSessions:
        stats.lowSessions + (row.status.key === 'remaining-2' || row.status.key === 'remaining-1' ? 1 : 0),
      due: stats.due + (row.status.key === 'due' ? 1 : 0),
      overdue: stats.overdue + (row.status.key === 'overdue' ? 1 : 0),
      debt: stats.debt + (Number(row.debtAmount) > 0 ? 1 : 0),
    }),
    {
      total: 0,
      withPackage: 0,
      noPackage: 0,
      lowSessions: 0,
      due: 0,
      overdue: 0,
      debt: 0,
    },
  )
}

function renderStat(label, value) {
  return `
    <div class="tuition-stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `
}

function renderOptions(options, selectedValue) {
  return options
    .map(
      (option) => `
        <option value="${option.value}" ${option.value === selectedValue ? 'selected' : ''}>
          ${option.label}
        </option>
      `,
    )
    .join('')
}

function getPackageKind(totalSessions) {
  if ([8, 16, 32].includes(totalSessions)) {
    return String(totalSessions)
  }

  return 'other'
}

function formatMoney(amount) {
  return `${Number(amount).toLocaleString('vi-VN')} VNĐ`
}

function formatMoneyInput(amount) {
  return Number(amount).toLocaleString('vi-VN')
}

function normalizeInteger(value) {
  const numberValue = Number(String(value ?? '').replace(/[^\d-]/g, ''))
  return Number.isInteger(numberValue) ? numberValue : NaN
}

function normalizeMoney(value) {
  const numberValue = Number(String(value ?? '').replace(/[^\d]/g, ''))
  return Number.isFinite(numberValue) ? numberValue : NaN
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function getCompactStudentName(fullName) {
  const nameParts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)

  if (nameParts.length <= 2) {
    return nameParts.join(' ')
  }

  return nameParts.slice(-2).join(' ')
}

function getPaymentMethodLabel(method) {
  const methodLabels = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    other: 'Khác',
  }

  return methodLabels[method] ?? method
}

function formatPaymentDate(dateValue) {
  const paymentDate = new Date(dateValue)

  if (Number.isNaN(paymentDate.getTime())) {
    return dateValue
  }

  return paymentDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCompactDate(dateValue) {
  if (!dateValue) {
    return ''
  }

  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
