import {
  advisoryCareStatusLabels,
  buildAttendanceAdvisoryRows,
  getCurrentMonthKey,
} from './attendance-advisory.js'
import { buildStudentTuitionLink } from './student-tuition-links.js'

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

const discountPresetOptions = [
  { value: 'none', label: 'Không ưu đãi' },
  { value: 'percent-5', label: 'Theo % · 5%' },
  { value: 'percent-10', label: 'Theo % · 10%' },
  { value: 'percent-15', label: 'Theo % · 15%' },
  { value: 'percent-20', label: 'Theo % · 20%' },
  { value: 'percent-30', label: 'Theo % · 30%' },
  { value: 'fixed-100000', label: 'Theo số tiền · 100.000 VNĐ' },
  { value: 'fixed-200000', label: 'Theo số tiền · 200.000 VNĐ' },
  { value: 'fixed-300000', label: 'Theo số tiền · 300.000 VNĐ' },
  { value: 'fixed-500000', label: 'Theo số tiền · 500.000 VNĐ' },
  { value: 'custom-percent', label: 'Theo % · Tùy chọn' },
  { value: 'custom-fixed', label: 'Theo số tiền · Tùy chọn' },
]

const percentDiscountPresets = [5, 10, 15, 20, 30]
const fixedDiscountPresets = [100000, 200000, 300000, 500000]

export function createEmptyTuitionFormState(student) {
  return {
    mode: 'create',
    studentId: student.id,
    values: {
      packageName: 'Gói 8 buổi',
      totalSessions: '8',
      usedSessions: '0',
      totalAmount: '',
      discountPreset: 'none',
      discountCustomValue: '',
      discountAmount: '0',
      paidAmount: '',
      dueDate: '',
      note: '',
    },
    errors: {},
  }
}

export function createEditTuitionFormState(student, tuitionRecord) {
  const discountFormValues = createDiscountFormValues(tuitionRecord)

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
      ...discountFormValues,
      discountAmount: formatMoneyInput(tuitionRecord.discountAmount ?? 0),
      paidAmount: formatMoneyInput(tuitionRecord.paidAmount),
      dueDate: tuitionRecord.dueDate,
      note: tuitionRecord.note,
    },
    errors: {},
  }
}

export function createRenewTuitionFormState(student, tuitionRecord) {
  const discountFormValues = createDiscountFormValues(tuitionRecord)

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
      ...discountFormValues,
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
  sessionReports = [],
  advisoryNotes = [],
  advisoryMonthKey = getCurrentMonthKey(),
  rollbackPreviewState = null,
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
  const hasPanel = Boolean(formState || paymentFormState || detailState || rollbackPreviewState)
  const advisoryRows = buildAttendanceAdvisoryRows(
    students,
    tuitionRecords,
    sessionReports,
    advisoryNotes,
    advisoryMonthKey,
  )

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
                <th>Học phí gốc</th>
                <th>Ưu đãi</th>
                <th>Cần thanh toán</th>
                <th>Đã thanh toán</th>
                <th>Còn nợ</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${
                visibleRows.length
                  ? visibleRows.map((row) => renderTuitionRow(row)).join('')
                  : '<tr><td class="tuition-empty" colspan="11">Không có học viên phù hợp.</td></tr>'
              }
            </tbody>
          </table>
        </div>
        ${renderAttendanceAdvisory(advisoryRows, advisoryMonthKey)}
      </div>
      ${formState && formStudent ? renderTuitionForm(formStudent, formState) : ''}
      ${
        paymentFormState && paymentStudent && paymentTuition
          ? renderPaymentForm(paymentStudent, paymentTuition, paymentFormState)
          : ''
      }
      ${detailState && detailStudent ? renderTuitionDetailPanel(detailStudent, detailTuition) : ''}
      ${rollbackPreviewState ? renderRollbackPreviewPanel(rollbackPreviewState) : ''}
    </section>
  `
}

function renderAttendanceAdvisory(rows, monthKey) {
  const [year, month] = monthKey.split('-')

  return `
    <section class="tuition-attendance-advisory" aria-label="Bảng chăm sóc cuối tháng">
      <div class="tuition-advisory-header">
        <div>
          <h3>Bảng chăm sóc cuối tháng</h3>
          <p>Tháng ${month}/${year} · Tự tổng hợp từ điểm danh và học phí, không ghi ngược vào gói học phí.</p>
        </div>
        <span>${rows.length} học viên</span>
      </div>
      <div class="tuition-advisory-table-wrap">
        <table class="tuition-advisory-table">
          <thead>
            <tr>
              <th>Học viên</th>
              <th>Gói</th>
              <th>Đã học</th>
              <th>Còn lại</th>
              <th>Cảnh báo</th>
              <th>Chăm sóc</th>
              <th>Ghi chú</th>
              <th>Nguồn tính</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => renderAttendanceAdvisoryRow(row)).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderAttendanceAdvisoryRow(row) {
  const studentId = escapeHtml(row.student.id)
  const remainingLabel =
    row.remainingSessions === null ? '—' : String(row.remainingSessions)

  return `
    <tr data-tuition-advisory-row="${studentId}" data-advisory-month-key="${escapeHtml(row.monthKey)}">
      <td>
        <strong>${escapeHtml(row.student.fullName)}</strong>
        <small>PH: ${escapeHtml(row.student.parentName || 'Chưa cập nhật')}</small>
      </td>
      <td>
        <strong>${escapeHtml(row.tuition?.packageName || 'Chưa có gói')}</strong>
        <small>${row.totalSessions === null ? 'Chưa rõ tổng buổi' : `${row.totalSessions} buổi`}</small>
      </td>
      <td>${row.learnedSessions}</td>
      <td class="${Number(row.remainingSessions) < 0 ? 'is-overdue' : ''}">${remainingLabel}</td>
      <td>
        <span class="tuition-advisory-badge is-${escapeHtml(row.warning.tone)}">
          ${escapeHtml(row.warning.label)}
        </span>
      </td>
      <td>
        <select data-tuition-advisory-care-status="${studentId}" aria-label="Tình trạng chăm sóc ${escapeHtml(row.student.fullName)}">
          ${Object.entries(advisoryCareStatusLabels)
            .map(
              ([value, label]) => `
                <option value="${value}" ${row.careStatus === value ? 'selected' : ''}>${escapeHtml(label)}</option>
              `,
            )
            .join('')}
        </select>
        <small>${escapeHtml(row.careStatusLabel)}</small>
      </td>
      <td>
        <textarea
          class="tuition-advisory-note"
          data-tuition-advisory-note="${studentId}"
          placeholder="Ghi chú chăm sóc theo tháng..."
        >${escapeHtml(row.note)}</textarea>
        <button
          type="button"
          class="tuition-advisory-save"
          data-tuition-advisory-action="save"
          data-student-id="${studentId}"
          data-month-key="${escapeHtml(row.monthKey)}"
        >
          Lưu ghi chú
        </button>
      </td>
      <td><span class="tuition-advisory-source">${escapeHtml(row.source)}</span></td>
    </tr>
  `
}

export function buildTuitionRows(students, tuitionRecords) {
  const tuitionByStudentId = new Map(tuitionRecords.map((record) => [record.studentId, record]))

  return students.map((student) => {
    const tuition = tuitionByStudentId.get(student.id)
    const familyTuitionLink = buildStudentTuitionLink(student, tuitionRecords)

    if (!tuition) {
      return {
        student,
        tuition: null,
        familyTuitionLink,
        packageKind: 'no-package',
        status: {
          key: 'no-package',
          label: 'Chưa có gói',
          level: 'muted',
        },
        remainingSessions: null,
        debtAmount: null,
        searchableText: normalizeSearchText(
          `${student.fullName} ${student.parentName} ${student.parentPhone} ${student.fatherPhone} ${student.motherPhone} ${familyTuitionLink.warnings.map((warning) => warning.label).join(' ')} Cần gán gói học phí`,
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
      familyTuitionLink,
      searchableText: normalizeSearchText(
        `${student.fullName} ${student.parentName} ${student.parentPhone} ${student.fatherPhone} ${student.motherPhone} ${familyTuitionLink.warnings.map((warning) => warning.label).join(' ')} ${tuition.note}`,
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
  return calculateTuitionAmounts(tuitionRecord).payableAmount
}

export function getTuitionDebtAmount(tuitionRecord) {
  return calculateTuitionAmounts(tuitionRecord).remainingDebt
}

export function getTuitionOverpaidAmount(tuitionRecord) {
  const amounts = calculateTuitionAmounts(tuitionRecord)
  return Math.max(amounts.paidAmount - amounts.payableAmount, 0)
}

export function calculateTuitionAmounts(tuitionRecord = {}) {
  const tuitionAmount = normalizeSafeNumber(tuitionRecord.totalAmount)
  const discountType = normalizeDiscountType(tuitionRecord.discountType, tuitionRecord.discountAmount)
  const rawDiscountValue =
    tuitionRecord.discountValue ??
    (discountType === 'amount' ? tuitionRecord.discountAmount : 0)
  const discountValue =
    discountType === 'percent'
      ? Math.min(Math.max(normalizeSafeNumber(rawDiscountValue), 0), 100)
      : discountType === 'amount'
        ? Math.max(normalizeSafeNumber(rawDiscountValue), 0)
        : 0
  const calculatedDiscount =
    discountType === 'percent'
      ? Math.round((tuitionAmount * discountValue) / 100)
      : discountValue
  const discountAmount = Math.min(Math.max(calculatedDiscount, 0), tuitionAmount)
  const payableAmount = Math.max(tuitionAmount - discountAmount, 0)
  const paymentTotal = Array.isArray(tuitionRecord.payments)
    ? tuitionRecord.payments.reduce(
        (total, payment) => total + normalizeSafeNumber(payment?.amount),
        0,
      )
    : 0
  const paidAmount = Math.max(normalizeSafeNumber(tuitionRecord.paidAmount), paymentTotal)
  const remainingDebt = Math.max(payableAmount - paidAmount, 0)

  return {
    tuitionAmount,
    discountType,
    discountValue,
    discountAmount,
    payableAmount,
    paidAmount,
    remainingDebt,
  }
}

export function normalizeTuitionFormValues(values) {
  const totalAmount = normalizeMoney(values.totalAmount)
  const discount = getDiscountCalculation(values, totalAmount)

  return {
    packageName: String(values.packageName || '').trim(),
    totalSessions: normalizeInteger(values.totalSessions),
    usedSessions: normalizeInteger(values.usedSessions),
    hasTotalSessionsData: true,
    hasUsedSessionsData: true,
    totalAmount,
    discountType: discount.type,
    discountValue: discount.value,
    discountAmount: discount.amount,
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

  const discount = getDiscountCalculation(values, normalizedValues.totalAmount)

  if (!discount.isValid) {
    errors.discountAmount = 'Ưu đãi không hợp lệ.'
  }

  if (discount.type === 'percent' && (discount.value < 0 || discount.value > 100)) {
    errors.discountAmount = 'Ưu đãi % cần từ 0 đến 100.'
  }

  if (
    Number.isFinite(normalizedValues.discountAmount) &&
    Number.isFinite(normalizedValues.totalAmount) &&
    normalizedValues.discountAmount > normalizedValues.totalAmount
  ) {
    errors.discountAmount = 'Ưu đãi không nên lớn hơn học phí.'
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
  const conflictMarker = tuition?.conflictMarker || null
  const hasSyncConflict = Boolean(tuition?.syncConflict || conflictMarker?.syncConflict)
  const rowTitle = tuition ? 'Bấm để cập nhật gói học phí' : 'Bấm để gán gói học phí'
  const termNumber = tuition?.currentTermNumber || 1
  const amounts = tuition ? calculateTuitionAmounts(tuition) : null
  const familyLink = row.familyTuitionLink

  return `
    <tr
      class="tuition-clickable-row ${hasSyncConflict ? 'has-sync-conflict' : ''}"
      data-tuition-row-student-id="${row.student.id}"
      tabindex="0"
      title="${rowTitle}"
    >
      <td title="${escapeHtml(row.student.fullName)}"><strong>${escapeHtml(compactStudentName)}</strong></td>
      <td title="${escapeHtml(familyLink.parent.primaryPhone || '')}">
        ${renderTuitionFamilyLink(familyLink)}
      </td>
      <td>
        ${
          tuition
            ? `
              <div class="tuition-package-cell">
                <span>${escapeHtml(tuition.packageName)}</span>
                ${hasSyncConflict ? renderTuitionConflictBadge(conflictMarker) : ''}
              </div>
            `
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
      <td title="${amounts ? formatMoney(amounts.tuitionAmount) : ''}">${amounts ? formatMoney(amounts.tuitionAmount) : '—'}</td>
      <td title="${amounts ? getDiscountFormulaLabel(amounts) : ''}">${amounts ? renderDiscountCell(amounts) : '—'}</td>
      <td title="${amounts ? formatMoney(amounts.payableAmount) : ''}">${amounts ? formatMoney(amounts.payableAmount) : '—'}</td>
      <td title="${amounts ? formatMoney(amounts.paidAmount) : ''}">${amounts ? formatMoney(amounts.paidAmount) : '—'}</td>
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
        ${
          tuition
            ? `
              <button
                class="tuition-history-button"
                type="button"
                data-tuition-action="open-rollback-preview"
                data-tuition-id="${escapeHtml(tuition.id)}"
                title="Xem lịch sử thay đổi"
              >
                Xem lịch sử
              </button>
            `
            : ''
        }
        ${renderTuitionCareBadges(familyLink)}
      </td>
    </tr>
  `
}

function renderRollbackPreviewPanel(state) {
  const previews = Array.isArray(state.previews) ? state.previews : []

  return `
    <div class="tuition-form-backdrop" data-tuition-rollback-preview-action="close"></div>
    <section class="tuition-form-panel tuition-rollback-preview-panel" aria-label="Lịch sử thay đổi học phí">
      <div class="tuition-form-header">
        <div>
          <h4>Lịch sử thay đổi</h4>
          <p>Chỉ xem trước, chưa khôi phục dữ liệu</p>
        </div>
        <button type="button" data-tuition-rollback-preview-action="close" aria-label="Đóng lịch sử thay đổi">X</button>
      </div>
      <div class="tuition-rollback-preview-note">
        <strong>Bản xem trước khôi phục</strong>
        <span>Không có nút khôi phục, không ghi ngược dữ liệu học phí.</span>
      </div>
      ${state.message ? `<p class="tuition-rollback-preview-message is-${escapeHtml(state.status || 'ready')}">${escapeHtml(state.message)}</p>` : ''}
      ${
        previews.length
          ? `
            <div class="tuition-rollback-preview-list">
              ${previews.map((preview) => renderRollbackPreviewItem(preview)).join('')}
            </div>
          `
          : '<p class="tuition-payment-empty">Không có bản ghi audit để xem trước.</p>'
      }
      <div class="tuition-form-actions">
        <button type="button" data-tuition-rollback-preview-action="close">Đóng</button>
      </div>
    </section>
  `
}

function renderRollbackPreviewItem(preview) {
  const diffSummary = Array.isArray(preview.diffSummary) ? preview.diffSummary.slice(0, 8) : []
  const changedFields = Array.isArray(preview.changedFields) ? preview.changedFields : []

  return `
    <article class="tuition-rollback-preview-item">
      <div class="tuition-rollback-preview-item-header">
        <strong>${escapeHtml(getRollbackActionLabel(preview.action))}</strong>
        <span>${escapeHtml(formatCompactDateTime(preview.auditCreatedAt))}</span>
      </div>
      <p>${escapeHtml(preview.actorRole || 'unknown')} · ${escapeHtml(preview.entityLocalId || '')}</p>
      <div class="tuition-rollback-preview-fields">
        ${
          changedFields.length
            ? changedFields.map((field) => `<span>${escapeHtml(field)}</span>`).join('')
            : '<span>Không có danh sách trường thay đổi</span>'
        }
      </div>
      ${
        diffSummary.length
          ? `
            <dl class="tuition-rollback-preview-diff">
              ${diffSummary.map((item) => `
                <div>
                  <dt>${escapeHtml(item.field)}</dt>
                  <dd><span>Trước thay đổi</span>${escapeHtml(item.before)}</dd>
                  <dd><span>Sau thay đổi</span>${escapeHtml(item.after)}</dd>
                </div>
              `).join('')}
            </dl>
          `
          : '<p class="tuition-payment-empty">Không có snapshot trước thay đổi hoặc sau thay đổi đủ để so sánh.</p>'
      }
    </article>
  `
}

function getRollbackActionLabel(action) {
  const labels = {
    create: 'Tạo bản ghi',
    update: 'Cập nhật',
    payment_update: 'Cập nhật thanh toán',
    unknown_update: 'Cập nhật',
  }

  return labels[action] || action || 'Cập nhật'
}

function renderTuitionConflictBadge(conflictMarker) {
  const fields = Array.isArray(conflictMarker?.conflictFields)
    ? conflictMarker.conflictFields.filter(Boolean)
    : []
  const title = fields.length
    ? `Dữ liệu cloud/local khác nhau ở trường nhạy cảm: ${fields.join(', ')}`
    : 'Dữ liệu cloud/local khác nhau ở trường nhạy cảm'

  return `
    <span class="tuition-conflict-badge" title="${escapeHtml(title)}">
      Có xung đột dữ liệu
    </span>
  `
}

function renderTuitionFamilyLink(link) {
  const parentLabel = link.parent.hasContact
    ? link.parent.parentName
    : 'Chưa có thông tin phụ huynh/người liên hệ.'
  const phoneLabel = link.parent.primaryPhone || 'Chưa có SĐT'

  return `
    <div class="tuition-family-link">
      <strong>Học viên & phụ huynh</strong>
      <span>${escapeHtml(parentLabel)}</span>
      <small>${escapeHtml(phoneLabel)} · ${escapeHtml(link.studentStatus)}</small>
    </div>
  `
}

function renderTuitionCareBadges(link) {
  const warnings = link.warnings.slice(0, 2)

  if (!warnings.length) {
    return ''
  }

  return `
    <div class="tuition-care-badges" aria-label="Cảnh báo chăm sóc">
      ${warnings
        .map(
          (warning) => `
            <span class="is-${escapeHtml(warning.tone)}">${escapeHtml(warning.label)}</span>
          `,
        )
        .join('')}
    </div>
  `
}

function renderTuitionForm(student, formState) {
  const isEdit = formState.mode === 'edit'
  const isRenew = formState.mode === 'renew'
  const { values, errors } = formState
  const discountPreview = getDiscountPreview(values)

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
        ${renderTextField('totalAmount', 'Học phí gốc', values.totalAmount, errors.totalAmount)}
        ${renderDiscountPresetField(values, errors)}
        ${renderDiscountCustomField(values, errors)}
        ${renderDiscountPreview(discountPreview)}
        ${renderTextField('paidAmount', isRenew ? 'Đã thanh toán ban đầu' : 'Đã thanh toán', values.paidAmount, errors.paidAmount)}
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

  const amounts = calculateTuitionAmounts(tuitionRecord)

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
      ${renderTuitionFormula(amounts)}
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
  const amounts = calculateTuitionAmounts(term)
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
      <p>Buổi: ${term.usedSessions}/${term.totalSessions} · Học phí gốc: ${formatMoney(amounts.tuitionAmount)} · Ưu đãi: ${getDiscountFormulaLabel(amounts)} · Cần thanh toán: ${formatMoney(amounts.payableAmount)} · Đã thanh toán: ${formatMoney(amounts.paidAmount)} · Còn nợ: ${formatMoney(amounts.remainingDebt)}</p>
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
  const amounts = calculateTuitionAmounts(tuitionRecord)
  const debtAmount = amounts.remainingDebt
  const overpaidAmount = getTuitionOverpaidAmount(tuitionRecord)
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
      ${renderTuitionFormula(amounts)}
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
  const amounts = calculateTuitionAmounts(tuitionRecord)
  const overpaidAmount = getTuitionOverpaidAmount(tuitionRecord)
  const status = getTuitionWarningStatus(remainingSessions)

  return `
    <section class="tuition-detail-overview" aria-label="Tổng quan kỳ hiện tại">
      ${renderDetailMetric('Gói hiện tại', escapeHtml(tuitionRecord.packageName))}
      ${renderDetailMetric('Kỳ', `Kỳ ${tuitionRecord.currentTermNumber || 1}`)}
      ${renderDetailMetric('Tổng số buổi', tuitionRecord.totalSessions)}
      ${renderDetailMetric('Đã học', tuitionRecord.usedSessions)}
      ${renderDetailMetric('Còn lại', remainingSessions)}
      ${renderDetailMetric('Hạn đóng / ngày nhắc', tuitionRecord.dueDate || 'Chưa đặt')}
      ${renderDetailMetric('Trạng thái', status.label)}
      ${renderDetailMetric('Ghi chú', escapeHtml(tuitionRecord.note || 'Không có ghi chú'), true)}
    </section>
    ${renderTuitionFormula(amounts)}
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

function renderDiscountPresetField(values, errors) {
  return `
    <label class="${errors.discountAmount ? 'has-error' : ''}">
      <span>Kiểu ưu đãi / Mức ưu đãi</span>
      <select data-tuition-form-field="discountPreset">
        ${discountPresetOptions
          .map(
            (option) => `
              <option value="${option.value}" ${option.value === getDiscountPresetValue(values) ? 'selected' : ''}>
                ${option.label}
              </option>
            `,
          )
          .join('')}
      </select>
      ${errors.discountAmount ? `<small>${errors.discountAmount}</small>` : ''}
    </label>
  `
}

function renderDiscountCustomField(values, errors) {
  const preset = getDiscountPresetValue(values)

  if (preset !== 'custom-percent' && preset !== 'custom-fixed') {
    return ''
  }

  return `
    <label class="${errors.discountAmount ? 'has-error' : ''}">
      <span>${preset === 'custom-percent' ? 'Ưu đãi (%)' : 'Ưu đãi (VNĐ)'}</span>
      <input
        type="text"
        value="${escapeHtml(values.discountCustomValue ?? '')}"
        data-tuition-form-field="discountCustomValue"
        placeholder="${preset === 'custom-percent' ? 'Ví dụ: 12.5' : 'Ví dụ: 100.000'}"
      />
      ${errors.discountAmount ? `<small>${errors.discountAmount}</small>` : ''}
    </label>
  `
}

function renderDiscountPreview(preview) {
  return `
    <div class="tuition-discount-preview" aria-label="Công thức học phí">
      ${renderTuitionFormula(preview)}
    </div>
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

function createDiscountFormValues(tuitionRecord) {
  const discountType = normalizeDiscountType(tuitionRecord.discountType, tuitionRecord.discountAmount)
  const discountValue =
    tuitionRecord.discountValue ?? (discountType === 'amount' ? tuitionRecord.discountAmount || 0 : 0)
  const discountPreset = getDiscountPresetFromTypeValue(discountType, discountValue)
  const isCustomPreset = discountPreset === 'custom-percent' || discountPreset === 'custom-fixed'

  return {
    discountPreset,
    discountCustomValue: isCustomPreset
      ? discountType === 'percent'
        ? formatPercentInput(discountValue)
        : formatMoneyInput(discountValue)
      : '',
  }
}

function getDiscountPresetFromTypeValue(type, value) {
  const numberValue = Number(value || 0)

  if (type === 'percent') {
    return percentDiscountPresets.includes(numberValue) ? `percent-${numberValue}` : 'custom-percent'
  }

  if (type === 'amount' || type === 'fixed') {
    return fixedDiscountPresets.includes(numberValue) ? `fixed-${numberValue}` : 'custom-fixed'
  }

  return 'none'
}

function getDiscountPresetValue(values) {
  const preset = String(values.discountPreset || '').trim()
  return discountPresetOptions.some((option) => option.value === preset) ? preset : 'none'
}

function getDiscountCalculation(values, totalAmount) {
  const preset = getDiscountPresetValue(values)
  const safeTotalAmount = Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : 0
  let type = 'none'
  let value = 0
  let isValid = true

  if (preset.startsWith('percent-')) {
    type = 'percent'
    value = Number(preset.replace('percent-', ''))
  } else if (preset.startsWith('fixed-')) {
    type = 'amount'
    value = Number(preset.replace('fixed-', ''))
  } else if (preset === 'custom-percent') {
    type = 'percent'
    value = normalizePercent(values.discountCustomValue)
    isValid = Number.isFinite(value)
  } else if (preset === 'custom-fixed') {
    type = 'amount'
    value = normalizeCustomMoney(values.discountCustomValue)
    isValid = Number.isFinite(value)
  }

  if (!Number.isFinite(value)) {
    value = 0
  }

  const amount = type === 'percent'
    ? Math.round((safeTotalAmount * value) / 100)
    : type === 'amount'
      ? value
      : 0

  return {
    type,
    value,
    amount: Math.max(0, Number.isFinite(amount) ? amount : 0),
    isValid,
  }
}

function getDiscountPreview(values) {
  const totalAmount = normalizeMoney(values.totalAmount)
  const paidAmount = normalizeMoney(values.paidAmount)
  const safeTotalAmount = Number.isFinite(totalAmount) ? totalAmount : 0
  const safePaidAmount = Number.isFinite(paidAmount) ? paidAmount : 0
  const discount = getDiscountCalculation(values, safeTotalAmount)
  const discountAmount = Math.min(discount.amount, safeTotalAmount)
  const payableAmount = Math.max(safeTotalAmount - discountAmount, 0)
  const debtAmount = Math.max(payableAmount - safePaidAmount, 0)
  const discountType = normalizeDiscountType(discount.type, discountAmount)

  return {
    tuitionAmount: safeTotalAmount,
    discountType,
    discountValue: discount.value,
    discountAmount,
    discountLabel: getDiscountFormulaLabel({
      discountType,
      discountValue: discount.value,
      discountAmount,
    }),
    payableAmount,
    paidAmount: safePaidAmount,
    debtAmount,
    remainingDebt: debtAmount,
  }
}

function normalizeDiscountType(type, discountAmount = 0) {
  if (type === 'percent') {
    return 'percent'
  }

  if (type === 'amount' || type === 'fixed') {
    return 'amount'
  }

  return normalizeSafeNumber(discountAmount) > 0 ? 'amount' : 'none'
}

function normalizeSafeNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(numberValue, 0) : 0
}

function getDiscountFormulaLabel(amounts) {
  if (amounts.discountType === 'percent') {
    return `-${formatMoney(amounts.discountAmount)} (${amounts.discountValue}%)`
  }

  if (amounts.discountAmount > 0) {
    return `-${formatMoney(amounts.discountAmount)}`
  }

  return formatMoney(0)
}

function renderDiscountCell(amounts) {
  return `
    <span class="tuition-discount-badge">${getDiscountFormulaLabel(amounts)}</span>
  `
}

function renderTuitionFormula(amounts) {
  const remainingDebt = amounts.remainingDebt ?? amounts.debtAmount
  const discountLabel =
    amounts.discountType === 'percent'
      ? `-${formatMoney(amounts.discountAmount)} (${amounts.discountValue}%)`
      : `-${formatMoney(amounts.discountAmount)}`

  return `
    <dl class="tuition-formula">
      <div><dt>Học phí gốc</dt><dd>${formatMoney(amounts.tuitionAmount)}</dd></div>
      <div><dt>Ưu đãi</dt><dd>${discountLabel}</dd></div>
      <div class="is-payable"><dt>Cần thanh toán</dt><dd>${formatMoney(amounts.payableAmount)}</dd></div>
      <div class="is-paid"><dt>Đã thanh toán</dt><dd>-${formatMoney(amounts.paidAmount)}</dd></div>
      <div class="is-debt"><dt>Còn nợ</dt><dd>${formatMoney(remainingDebt)}</dd></div>
    </dl>
  `
}

function formatMoney(amount) {
  return `${Number(amount).toLocaleString('vi-VN')} VNĐ`
}

function formatMoneyInput(amount) {
  return Number(amount).toLocaleString('vi-VN')
}

function formatPercentInput(value) {
  return String(Number(value || 0)).replace('.', ',')
}

function normalizeInteger(value) {
  const numberValue = Number(String(value ?? '').replace(/[^\d-]/g, ''))
  return Number.isInteger(numberValue) ? numberValue : NaN
}

function normalizeMoney(value) {
  const numberValue = Number(String(value ?? '').replace(/[^\d]/g, ''))
  return Number.isFinite(numberValue) ? numberValue : NaN
}

function normalizeCustomMoney(value) {
  const rawValue = String(value ?? '').trim()

  if (!/\d/.test(rawValue)) {
    return NaN
  }

  return normalizeMoney(rawValue)
}

function normalizePercent(value) {
  const rawValue = String(value ?? '').trim()

  if (!/\d/.test(rawValue)) {
    return NaN
  }

  const numberValue = Number(rawValue.replace(',', '.').replace(/[^\d.]/g, ''))
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

function formatCompactDateTime(dateValue) {
  if (!dateValue) {
    return 'Chưa rõ thời gian'
  }

  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa rõ thời gian'
  }

  return `${date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
