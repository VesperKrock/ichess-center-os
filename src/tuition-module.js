import {
  advisoryCareStatusLabels,
  buildAttendanceAdvisoryRows,
  getCurrentMonthKey,
} from './attendance-advisory.js'
import { CASHFLOW_EVIDENCE_ACCEPT, formatFileSize } from './cashflow-module.js'
import { getStudentAttendanceCredits } from './attendance-records.js'
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
const tuitionCareNoteSuggestions = [
  'Phụ huynh cần được nhắc học phí',
  'Sắp hết buổi',
  'Còn nợ học phí',
  'Đã nhắc lần 1',
  'Đã hẹn ngày thanh toán',
  'Cần gửi bảng phí',
  'Phụ huynh muốn đổi lịch học',
  'Cần gọi lại phụ huynh',
  'Đã trao đổi với phụ huynh',
  'Cần tư vấn gói mới',
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
  const amounts = calculateTuitionAmounts(tuitionRecord)
  const paymentId = `payment-${tuitionRecord.id}-${getCurrentTuitionPeriodId(tuitionRecord)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    mode,
    studentId: student.id,
    tuitionId: tuitionRecord.id,
    centerId: '',
    periodId: getCurrentTuitionPeriodId(tuitionRecord),
    sourcePaymentId: paymentId,
    isSaving: false,
    attachmentDraft: createEmptyTuitionPaymentAttachmentDraft(),
    values: {
      amount: mode === 'history' ? '' : formatMoneyInput(amounts.remainingDebt),
      paidAt: getTodayInputValue(),
      method: 'cash',
      payerName: student.parentName || '',
      collectorName: 'Admin',
      note: '',
    },
    errors: {},
  }
}

export function createEmptyTuitionPaymentAttachmentDraft() {
  return {
    mode: 'none',
    fileName: '',
    mimeType: '',
    sizeBytes: 0,
    objectUrl: '',
    error: '',
    isUploading: false,
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
  attendanceRecords = [],
  careNoteState = null,
  advisoryWindowState = null,
  cashflowTransactions = [],
  centerId = '',
) {
  const rows = buildTuitionRows(students, tuitionRecords, attendanceRecords, cashflowTransactions)
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
  const detailRow = detailState
    ? rows.find((row) => row.student.id === detailState.studentId)
    : null
  const careNoteStudent = careNoteState
    ? students.find((student) => String(student.id) === String(careNoteState.studentId))
    : null
  const hasAdvisoryWindow = Boolean(advisoryWindowState?.isOpen)
  const hasPanel = Boolean(
    formState || paymentFormState || detailState || rollbackPreviewState || careNoteStudent || hasAdvisoryWindow,
  )
  const advisoryRows = buildAttendanceAdvisoryRows(
    students,
    tuitionRecords,
    sessionReports,
    advisoryNotes,
    advisoryMonthKey,
  )

  return `
    <section class="tuition-module ${hasPanel ? 'form-open' : ''}" data-tuition-scroll-region="module">
      <div class="tuition-module-content" data-tuition-scroll-region="content">
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
        <div class="tuition-table-wrap" data-tuition-scroll-region="table">
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
        ${renderAttendanceAdvisoryEntry(advisoryRows, advisoryMonthKey)}
      </div>
      ${formState && formStudent ? renderTuitionForm(formStudent, formState, cashflowTransactions, centerId) : ''}
      ${
        paymentFormState && paymentStudent && paymentTuition
          ? renderPaymentForm(paymentStudent, paymentTuition, paymentFormState, cashflowTransactions, centerId)
          : ''
      }
      ${detailState && detailStudent ? renderTuitionDetailPanel(detailStudent, detailTuition, detailRow?.attendanceTuitionPreview, cashflowTransactions, centerId) : ''}
      ${rollbackPreviewState ? renderRollbackPreviewPanel(rollbackPreviewState) : ''}
      ${careNoteStudent ? renderTuitionCareNotePanel(careNoteStudent, careNoteState) : ''}
      ${hasAdvisoryWindow ? renderAttendanceAdvisoryWindow(advisoryRows, advisoryMonthKey) : ''}
    </section>
  `
}

function renderAttendanceAdvisoryEntry(rows, monthKey) {
  const [year, month] = monthKey.split('-')

  return `
    <section class="tuition-advisory-entry" aria-label="Chăm sóc cuối tháng">
      <div class="tuition-advisory-header">
        <div>
          <h3>Chăm sóc cuối tháng</h3>
          <p>Tháng ${month}/${year} · ${rows.length} học viên cần theo dõi.</p>
        </div>
        <button type="button" data-tuition-action="open-advisory-window">Mở bảng chăm sóc</button>
      </div>
    </section>
  `
}

function renderAttendanceAdvisoryWindow(rows, monthKey) {
  const [year, month] = monthKey.split('-')

  return `
    <div class="tuition-form-backdrop" data-tuition-advisory-window-action="close"></div>
    <section class="tuition-form-panel tuition-full-window-panel tuition-advisory-window-panel" aria-label="Bảng chăm sóc cuối tháng">
      <div class="tuition-form-header">
        <div>
          <h4>Bảng chăm sóc cuối tháng</h4>
          <p>Tháng ${month}/${year} · Tự tổng hợp từ điểm danh và học phí, không ghi ngược vào gói học phí.</p>
        </div>
        <button type="button" data-tuition-advisory-window-action="close" aria-label="Đóng bảng chăm sóc cuối tháng">X</button>
      </div>
      <div class="tuition-full-window-body tuition-advisory-window-body" data-tuition-scroll-region="advisory-window">
      <div class="tuition-advisory-table-wrap" data-tuition-scroll-region="advisory-table">
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

export function buildTuitionRows(
  students,
  tuitionRecords,
  attendanceRecords = [],
  cashflowTransactions = [],
) {
  const tuitionByStudentId = new Map(tuitionRecords.map((record) => [record.studentId, record]))
  const attendancePreviewByStudentId = buildTuitionAttendancePreviewMap(attendanceRecords)

  return students.map((student) => {
    const tuition = tuitionByStudentId.get(student.id)
    const familyTuitionLink = buildStudentTuitionLink(student, tuitionRecords)
    const attendanceTuitionPreview = buildStudentTuitionAttendancePreview(
      student.id,
      tuition,
      attendancePreviewByStudentId.get(String(student.id)) || null,
    )

    if (!tuition) {
      const careNotes = getStudentCareNotes(student)
      return {
        student,
        tuition: null,
        careNotes,
        familyTuitionLink,
        attendanceTuitionPreview,
        packageKind: 'no-package',
        status: {
          key: 'no-package',
          label: 'Chưa có gói',
          level: 'muted',
        },
        remainingSessions: null,
        debtAmount: null,
        searchableText: normalizeSearchText(
          `${student.fullName} ${student.parentName} ${student.parentPhone} ${student.fatherPhone} ${student.motherPhone} ${familyTuitionLink.warnings.map((warning) => warning.label).join(' ')} ${getCareNotesSearchText(careNotes)} Cần gán gói học phí`,
        ),
      }
    }

    const remainingSessions = tuition.totalSessions - tuition.usedSessions
    const amounts = calculateTuitionAmounts(tuition, cashflowTransactions)
    const debtAmount = amounts.remainingDebt
    const status = getTuitionWarningStatus(remainingSessions)
    const packageKind = getPackageKind(tuition.totalSessions)

    return {
      student,
      tuition,
      careNotes: getStudentCareNotes(student),
      packageKind,
      amounts,
      status,
      remainingSessions,
      debtAmount,
      familyTuitionLink,
      attendanceTuitionPreview,
      searchableText: normalizeSearchText(
        `${student.fullName} ${student.parentName} ${student.parentPhone} ${student.fatherPhone} ${student.motherPhone} ${familyTuitionLink.warnings.map((warning) => warning.label).join(' ')} ${tuition.note} ${getCareNotesSearchText(getStudentCareNotes(student))}`,
      ),
    }
  })
}

function getStudentCareNotes(student) {
  return (Array.isArray(student?.careNotes) ? student.careNotes : [])
    .filter((note) => note && typeof note === 'object')
    .slice()
    .sort((firstNote, secondNote) => new Date(secondNote.createdAt) - new Date(firstNote.createdAt))
}

function getCareNotesSearchText(careNotes = []) {
  return careNotes
    .map((note) => {
      const tags = Array.isArray(note.tags) ? note.tags.join(' ') : ''
      return `${note.content || ''} ${tags}`
    })
    .join(' ')
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Chưa có thời gian'
  }

  return date.toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function buildTuitionAttendancePreviewMap(attendanceRecords = []) {
  const recordsByStudentId = new Map()

  ;(Array.isArray(attendanceRecords) ? attendanceRecords : []).forEach((record) => {
    const studentId = String(record?.studentId || '').trim()

    if (!studentId) {
      return
    }

    if (!recordsByStudentId.has(studentId)) {
      recordsByStudentId.set(studentId, [])
    }

    recordsByStudentId.get(studentId).push(record)
  })

  const previewByStudentId = new Map()

  recordsByStudentId.forEach((studentRecords, studentId) => {
    const credits = getStudentAttendanceCredits(studentRecords, studentId)
    const sourceLabels = Array.from(new Set(
      studentRecords
        .map((record) => getAttendanceTuitionSourceLabel(record?.source))
        .filter(Boolean),
    ))
    const dateValues = studentRecords
      .map((record) => String(record?.date || '').trim())
      .filter(Boolean)
      .sort()

    previewByStudentId.set(studentId, {
      studentId,
      attendanceRecordCount: studentRecords.length,
      attendanceCreditCount: credits.length,
      lastAttendanceDate: dateValues.length ? dateValues[dateValues.length - 1] : '',
      sourceSummary: sourceLabels.length ? sourceLabels.join(', ') : 'Điểm danh',
      hasAttendanceData: studentRecords.length > 0,
    })
  })

  return previewByStudentId
}

function buildStudentTuitionAttendancePreview(studentId, tuition, attendancePreview) {
  const storedUsedSessions = Number(tuition?.usedSessions)
  const hasStoredUsedSessions = tuition &&
    tuition.hasUsedSessionsData !== false &&
    Number.isFinite(storedUsedSessions)
  const normalizedStoredUsedSessions = hasStoredUsedSessions ? Math.max(0, storedUsedSessions) : null
  const hasAttendanceData = Boolean(attendancePreview?.hasAttendanceData)
  const attendanceCreditCount = hasAttendanceData ? Number(attendancePreview.attendanceCreditCount) || 0 : null
  const difference =
    hasAttendanceData && normalizedStoredUsedSessions !== null
      ? attendanceCreditCount - normalizedStoredUsedSessions
      : null
  const isMismatch = difference !== null && difference !== 0

  return {
    studentId: String(studentId || ''),
    hasAttendanceData,
    storedUsedSessions: normalizedStoredUsedSessions,
    attendanceCreditCount,
    attendanceRecordCount: hasAttendanceData ? Number(attendancePreview.attendanceRecordCount) || 0 : 0,
    lastAttendanceDate: attendancePreview?.lastAttendanceDate || '',
    sourceSummary: attendancePreview?.sourceSummary || '',
    difference,
    isMismatch,
    statusLabel: !hasAttendanceData
      ? 'Chưa có dữ liệu điểm danh'
      : isMismatch
        ? 'Cần kiểm tra'
        : 'Khớp điểm danh',
  }
}

function getAttendanceTuitionSourceLabel(source) {
  if (source === 'initialBaseline') {
    return 'Dữ liệu nền'
  }

  if (source === 'teacher') {
    return 'Giáo viên'
  }

  if (source === 'admin') {
    return 'Admin'
  }

  return source ? 'Điểm danh' : ''
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

export function getTuitionDebtAmount(tuitionRecord, cashflowTransactions = null, centerId = '') {
  return calculateTuitionAmounts(tuitionRecord, cashflowTransactions, centerId).remainingDebt
}

export function getTuitionOverpaidAmount(tuitionRecord) {
  const amounts = calculateTuitionAmounts(tuitionRecord)
  return Math.max(amounts.paidAmount - amounts.payableAmount, 0)
}

export function calculateTuitionAmounts(tuitionRecord = {}, cashflowTransactions = null, centerId = '') {
  const baseAmounts = calculateTuitionPeriodBaseAmounts(tuitionRecord)
  const hasLedgerSource = Array.isArray(cashflowTransactions)
  const paymentTotal = hasLedgerSource
    ? buildTuitionPaymentSummary({
        tuitionRecord,
        cashflowTransactions,
        centerId,
      }).paidAmount
    : Array.isArray(tuitionRecord.payments)
      ? tuitionRecord.payments.reduce(
          (total, payment) => total + normalizeSafeNumber(payment?.amount),
          0,
        )
      : 0
  const paidAmount = hasLedgerSource
    ? paymentTotal
    : Math.max(normalizeSafeNumber(tuitionRecord.paidAmount), paymentTotal)
  const remainingDebt = Math.max(baseAmounts.payableAmount - paidAmount, 0)
  const legacyPaidAmount = normalizeSafeNumber(tuitionRecord.paidAmount)

  return {
    ...baseAmounts,
    paidAmount,
    remainingDebt,
    legacyPaidAmount,
    hasLedgerSource,
  }
}

function calculateTuitionPeriodBaseAmounts(tuitionRecord = {}) {
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

  return {
    tuitionAmount,
    discountType,
    discountValue,
    discountAmount,
    payableAmount,
  }
}

export function getCurrentTuitionPeriodId(tuitionRecord = {}) {
  return String(
    tuitionRecord.currentTermId ||
      `term-${tuitionRecord.id || tuitionRecord.studentId || 'unknown'}-${tuitionRecord.currentTermNumber || 1}`,
  )
}

export function getTuitionPeriodIdentity(periodRecord = {}, tuitionRecord = {}) {
  return String(
    periodRecord.currentTermId ||
      periodRecord.id ||
      (periodRecord.termNumber
        ? `term-${tuitionRecord.id || periodRecord.tuitionId || periodRecord.studentId || 'unknown'}-${periodRecord.termNumber}`
        : ''),
  )
}

export function isTuitionPaymentTransaction(transaction, tuitionId, periodId, centerId = '') {
  if (!transaction || transaction.type !== 'income') {
    return false
  }

  if (
    centerId &&
    transaction.centerId &&
    String(transaction.centerId || '') !== String(centerId)
  ) {
    return false
  }

  if (String(transaction.category || '').trim() !== 'Học phí') {
    return false
  }

  if (String(transaction.sourceModule || '') !== 'hoc-phi') {
    return false
  }

  if (String(transaction.sourceType || '') !== 'tuition-payment') {
    return false
  }

  if (String(transaction.sourceTuitionId || '') !== String(tuitionId || '')) {
    return false
  }

  const transactionPeriodId = String(transaction.sourcePeriodId || transaction.sourceTermId || '')
  if (!periodId || transactionPeriodId !== String(periodId || '')) {
    return false
  }

  if (['voided', 'refunded', 'reversed'].includes(String(transaction.status || ''))) {
    return false
  }

  return normalizeSafeNumber(transaction.amount) > 0
}

export function getLinkedTuitionPaymentTransactions(
  cashflowTransactions = [],
  tuitionId,
  periodId,
  centerId = '',
) {
  return (Array.isArray(cashflowTransactions) ? cashflowTransactions : []).filter((transaction) =>
    isTuitionPaymentTransaction(transaction, tuitionId, periodId, centerId),
  )
}

export function sortTuitionPaymentTransactions(transactions = []) {
  return [...(Array.isArray(transactions) ? transactions : [])].sort(
    (first, second) =>
      getTimeValue(second.transactionDate) - getTimeValue(first.transactionDate) ||
      getTimeValue(second.createdAt) - getTimeValue(first.createdAt) ||
      String(second.transactionCode || second.id || '').localeCompare(
        String(first.transactionCode || first.id || ''),
      ),
  )
}

export function buildTuitionPaymentSummary({
  tuitionRecord = {},
  periodRecord = tuitionRecord,
  cashflowTransactions = [],
  centerId = '',
} = {}) {
  const periodId =
    periodRecord === tuitionRecord
      ? getCurrentTuitionPeriodId(tuitionRecord)
      : getTuitionPeriodIdentity(periodRecord, tuitionRecord)
  const linkedPayments = sortTuitionPaymentTransactions(
    getLinkedTuitionPaymentTransactions(
      cashflowTransactions,
      tuitionRecord.id,
      periodId,
      centerId,
    ),
  )
  const paidAmount = linkedPayments.reduce(
    (total, transaction) => total + normalizeSafeNumber(transaction.amount),
    0,
  )
  const periodAmounts = calculateTuitionPeriodBaseAmounts(periodRecord)
  const remainingDebt = Math.max(periodAmounts.payableAmount - paidAmount, 0)
  const legacyPaidAmount = normalizeSafeNumber(periodRecord.paidAmount)
  const legacyUnreconciledAmount = Math.max(legacyPaidAmount - paidAmount, 0)
  const hasLegacyUnreconciled = legacyPaidAmount > 0 && legacyUnreconciledAmount > 0
  const hasOverpayment = paidAmount > periodAmounts.payableAmount
  const statusKey = hasLegacyUnreconciled
    ? 'unreconciled'
    : hasOverpayment
      ? 'overpaid'
      : paidAmount <= 0
        ? 'unpaid'
        : paidAmount < periodAmounts.payableAmount
          ? 'partial'
          : 'paid'

  return {
    ...periodAmounts,
    periodId,
    payments: linkedPayments,
    paymentCount: linkedPayments.length,
    paidAmount,
    remainingDebt,
    legacyPaidAmount,
    legacyUnreconciledAmount,
    hasLegacyUnreconciled,
    hasOverpayment,
    statusKey,
    statusLabel: getTuitionPaymentStatusLabel(statusKey),
  }
}

export function hasUnreconciledLegacyTuitionPaidAmount(
  tuitionRecord = {},
  cashflowTransactions = [],
) {
  return buildTuitionPaymentSummary({ tuitionRecord, cashflowTransactions }).hasLegacyUnreconciled
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
    paidAmount: 0,
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
    payerName: String(values.payerName || '').trim(),
    collectorName: String(values.collectorName || '').trim(),
    note: String(values.note || '').trim(),
  }
}

export function validatePaymentForm(values) {
  const normalizedValues = normalizePaymentFormValues(values)
  const errors = {}
  const rawAmount = String(values.amount ?? '').trim()

  if (/^-/.test(rawAmount) || !Number.isFinite(normalizedValues.amount) || normalizedValues.amount <= 0) {
    errors.amount = 'Số tiền đóng phải lớn hơn 0.'
  }

  if (!normalizedValues.paidAt || Number.isNaN(new Date(normalizedValues.paidAt).getTime())) {
    errors.paidAt = 'Ngày đóng không hợp lệ.'
  }

  if (!normalizedValues.collectorName) {
    errors.collectorName = 'Cần nhập người thu.'
  }

  if (!normalizedValues.payerName) {
    errors.payerName = 'Cần nhập người nộp.'
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
  const careNotes = Array.isArray(row.careNotes) ? row.careNotes : []
  const hasOverpayment = tuition ? Math.max((row.amounts?.paidAmount || 0) - (row.amounts?.payableAmount || 0), 0) > 0 : false
  const conflictMarker = tuition?.conflictMarker || null
  const hasSyncConflict = Boolean(tuition?.syncConflict || conflictMarker?.syncConflict)
  const rowTitle = tuition ? 'Bấm để cập nhật gói học phí' : 'Bấm để gán gói học phí'
  const termNumber = tuition?.currentTermNumber || 1
  const amounts = tuition ? row.amounts || calculateTuitionAmounts(tuition) : null
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
            ? `
              <div class="tuition-session-cell">
                <strong>${tuition.usedSessions}/${tuition.totalSessions}${termNumber > 1 ? ` <small class="tuition-term-chip">· Kỳ ${termNumber}</small>` : ''}</strong>
                ${renderTuitionAttendancePreview(row.attendanceTuitionPreview)}
              </div>
            `
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
      <td>
        ${renderTuitionCareNoteButton(row.student, careNotes)}
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

function renderTuitionCareNoteButton(student, careNotes = []) {
  const noteCount = careNotes.length
  const latestNote = careNotes[0]
  const label = noteCount ? `Có ghi chú (${noteCount})` : 'Chưa có ghi chú'
  const title = latestNote?.content || label

  return `
    <button
      class="tuition-care-note-button ${noteCount ? 'has-note' : 'is-empty'}"
      type="button"
      data-tuition-action="open-care-notes"
      data-tuition-student-id="${escapeHtml(student.id)}"
      title="${escapeAttribute(title)}"
    >
      ${escapeHtml(label)}
    </button>
  `
}

function renderTuitionCareNotePanel(student, state = {}) {
  const draft = {
    tag: String(state?.values?.tag || ''),
    content: String(state?.values?.content || ''),
    error: String(state?.error || ''),
    saveState: String(state?.saveState || ''),
  }

  return `
    <div class="tuition-form-backdrop" data-tuition-care-note-action="close"></div>
    <section class="tuition-form-panel tuition-full-window-panel tuition-care-note-panel" aria-label="Chăm sóc / Ghi chú - ${escapeAttribute(student.fullName)}">
      <div class="tuition-form-header">
        <div>
          <h4>Chăm sóc / Ghi chú - ${escapeHtml(student.fullName)}</h4>
          <p>Ghi chú lưu chung theo học viên để Module Học phí và Module Học viên cùng đọc được.</p>
        </div>
        <button type="button" data-tuition-care-note-action="close" aria-label="Đóng ghi chú chăm sóc">X</button>
      </div>
      <section class="student-care-notes student-care-window tuition-care-note-window tuition-full-window-body" data-tuition-scroll-region="care-note-window">
        <div class="student-care-layout">
          <div class="student-care-history-panel">
            <h4>Lịch sử ghi chú chăm sóc</h4>
            ${renderTuitionCareNoteHistory(student)}
          </div>
          <div class="student-care-form">
            <h4>Thêm ghi chú chăm sóc</h4>
            <label>
              <span>Tag / chủ đề</span>
              <input
                type="text"
                value="${escapeAttribute(draft.tag)}"
                data-tuition-care-note-field="tag"
                placeholder="Ví dụ: Học phí, Tư vấn gói mới"
              />
            </label>
            <label>
              <span>Nội dung ghi chú</span>
              <textarea
                data-tuition-care-note-field="content"
                placeholder="Nhập nội dung đã trao đổi hoặc việc cần theo dõi..."
              >${escapeHtml(draft.content)}</textarea>
            </label>
            ${draft.error ? `<p class="care-note-error">${escapeHtml(draft.error)}</p>` : ''}
            ${draft.saveState === 'saved' ? '<p class="tuition-care-note-success">Đã lưu ghi chú chăm sóc.</p>' : ''}
            <div class="care-note-suggestions" aria-label="Gợi ý nhanh ghi chú học phí">
              ${tuitionCareNoteSuggestions
                .map(
                  (suggestion) => `
                    <button type="button" data-tuition-care-note-suggestion="${escapeAttribute(suggestion)}">
                      ${escapeHtml(suggestion)}
                    </button>
                  `,
                )
                .join('')}
            </div>
            <div class="care-note-actions">
              <button type="button" data-tuition-care-note-action="save" data-student-id="${escapeHtml(student.id)}">Lưu ghi chú</button>
              <button type="button" data-tuition-care-note-action="clear">Hủy nhập</button>
            </div>
          </div>
        </div>
      </section>
    </section>
  `
}

function renderTuitionCareNoteHistory(student) {
  const careNotes = getStudentCareNotes(student)

  if (!careNotes.length) {
    return '<p class="care-note-empty">Chưa có ghi chú chăm sóc.</p>'
  }

  return `
    <div class="care-note-list">
      ${careNotes
        .map((note) => {
          const sourceLabel = note.sourceModule === 'tuition' ? 'Học phí' : 'Học viên'
          const tags = Array.isArray(note.tags) ? note.tags : []

          return `
            <article class="care-note-item">
              <div>
                <strong>${escapeHtml(note.author || 'Admin DreamHome')}</strong>
                <time datetime="${escapeAttribute(note.createdAt || '')}">${escapeHtml(formatDateTime(note.createdAt))}</time>
              </div>
              <p>${escapeHtml(note.content || '')}</p>
              <div class="care-note-tags">
                <span>${escapeHtml(sourceLabel)}</span>
                ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
              </div>
            </article>
          `
        })
        .join('')}
    </div>
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

function renderTuitionAttendancePreview(preview) {
  if (!preview) {
    return ''
  }

  if (!preview.hasAttendanceData) {
    return `
      <span class="tuition-attendance-compare is-muted">Chưa có dữ liệu điểm danh</span>
    `
  }

  const mismatchText = preview.isMismatch
    ? `Lệch ${Math.abs(preview.difference)} buổi`
    : 'Khớp điểm danh'
  const statusClass = preview.isMismatch ? 'is-warning' : 'is-match'
  const detailText = [
    `Đang lưu học phí: ${preview.storedUsedSessions ?? '—'}`,
    `Theo điểm danh: ${preview.attendanceCreditCount}`,
    `${preview.attendanceRecordCount} bản ghi`,
    preview.lastAttendanceDate ? `Gần nhất ${formatPaymentDate(preview.lastAttendanceDate)}` : '',
  ].filter(Boolean).join(' · ')

  return `
    <span
      class="tuition-attendance-compare ${statusClass}"
      title="${escapeHtml(detailText)}"
    >
      Theo điểm danh: ${preview.attendanceCreditCount} · ${mismatchText}
    </span>
    ${
      preview.isMismatch
        ? '<small class="tuition-attendance-warning">Cần kiểm tra: số buổi học phí đang lưu khác dữ liệu điểm danh.</small>'
        : ''
    }
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

function renderTuitionForm(student, formState, cashflowTransactions = [], centerId = '') {
  const isEdit = formState.mode === 'edit'
  const isRenew = formState.mode === 'renew'
  const { values, errors } = formState
  const baseDiscountPreview = getDiscountPreview(values)
  const ledgerPaidAmount =
    (isEdit || isRenew) && formState.record
      ? calculateTuitionAmounts(formState.record, cashflowTransactions).paidAmount
      : 0
  const discountPreview =
    isEdit || isRenew
      ? {
          ...baseDiscountPreview,
          paidAmount: ledgerPaidAmount,
          remainingDebt: Math.max(baseDiscountPreview.payableAmount - ledgerPaidAmount, 0),
        }
      : baseDiscountPreview

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
      ${isEdit || isRenew ? renderCurrentTermSummary(formState.record, cashflowTransactions, centerId) : ''}
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
        ${isEdit || isRenew ? renderReadOnlyPaidAmountNote(formState.record, cashflowTransactions, centerId) : ''}
        ${renderTextField('dueDate', 'Hạn đóng / ngày nhắc', values.dueDate, errors.dueDate, 'date')}
        <label class="span-full ${errors.note ? 'has-error' : ''}">
          <span>Ghi chú</span>
          <textarea data-tuition-form-field="note">${escapeHtml(values.note)}</textarea>
          ${errors.note ? `<small>${errors.note}</small>` : ''}
        </label>
      </div>
      ${isEdit || isRenew ? renderTermHistory(formState.record, cashflowTransactions, centerId) : ''}
      <div class="tuition-form-actions">
        <button type="button" data-tuition-action="cancel-form">Hủy</button>
        ${
          isEdit
            ? '<button type="button" data-tuition-action="open-renew" data-tuition-id="' +
              formState.tuitionId +
              '">Gia hạn / Tạo kỳ mới</button>'
            : ''
        }
        <button type="button" data-tuition-action="save-form">${isRenew ? 'Tạo kỳ mới' : 'Lưu gói'}</button>
      </div>
    </form>
  `
}

function renderCurrentTermSummary(tuitionRecord, cashflowTransactions = [], centerId = '') {
  if (!tuitionRecord) {
    return ''
  }

  const amounts = calculateTuitionAmounts(tuitionRecord, cashflowTransactions, centerId)
  const paymentSummary = buildTuitionPaymentSummary({
    tuitionRecord,
    cashflowTransactions,
    centerId,
  })

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
        <span>Số lần thanh toán</span>
        <strong>${paymentSummary.paymentCount}</strong>
        <small>${escapeHtml(paymentSummary.statusLabel)}</small>
      </div>
      ${renderTuitionFormula(amounts)}
    </section>
  `
}

function renderReadOnlyPaidAmountNote(tuitionRecord, cashflowTransactions = [], centerId = '') {
  const amounts = calculateTuitionAmounts(tuitionRecord, cashflowTransactions, centerId)

  return `
    <div class="tuition-paid-readonly">
      <span>Đã thanh toán</span>
      <strong>${formatMoney(amounts.paidAmount)}</strong>
      <small>Tính từ các lần ghi nhận thanh toán trong Thu chi.</small>
    </div>
  `
}

function renderTermHistory(tuitionRecord = {}, cashflowTransactions = [], centerId = '') {
  const termHistory = tuitionRecord?.termHistory ?? []

  return `
    <section class="tuition-term-history" aria-label="Lịch sử kỳ học">
      <h5>Lịch sử kỳ học</h5>
      ${
        termHistory.length
          ? `
            <div class="tuition-term-history-list">
              ${[...termHistory]
                .sort((firstTerm, secondTerm) => Number(secondTerm.termNumber) - Number(firstTerm.termNumber))
                .map((term) => renderTermHistoryItem(term, tuitionRecord, cashflowTransactions, centerId))
                .join('')}
            </div>
          `
          : '<p class="tuition-payment-empty">Chưa có kỳ học cũ.</p>'
      }
    </section>
  `
}

function renderTermHistoryItem(term, tuitionRecord = {}, cashflowTransactions = [], centerId = '') {
  const summary = buildTuitionPaymentSummary({
    tuitionRecord,
    periodRecord: term,
    cashflowTransactions,
    centerId,
  })
  const statusLabel = term.status === 'completed' ? 'Đã hoàn tất' : 'Đã lưu lịch sử'
  const dateText = [formatCompactDate(term.startedAt), formatCompactDate(term.endedAt)]
    .filter(Boolean)
    .join(' - ')

  return `
    <article class="tuition-term-history-item">
      <div>
        <strong>Kỳ ${term.termNumber || ''} · ${escapeHtml(term.packageName)}</strong>
        <span>${statusLabel} · ${escapeHtml(summary.statusLabel)}</span>
      </div>
      <p>Buổi: ${term.usedSessions}/${term.totalSessions} · Học phí gốc: ${formatMoney(summary.tuitionAmount)} · Ưu đãi: ${getDiscountFormulaLabel(summary)} · Cần thanh toán: ${formatMoney(summary.payableAmount)} · Đã thanh toán: ${formatMoney(summary.paidAmount)} · Còn nợ: ${formatMoney(summary.remainingDebt)} · Số lần thanh toán: ${summary.paymentCount}</p>
      <small>${dateText || 'Chưa có ngày bắt đầu/kết thúc'}</small>
      ${renderLegacyUnreconciledPanel(summary)}
      ${renderTuitionOverpaymentWarning(summary)}
      ${renderLedgerPaymentTimeline(summary, {
        title: 'Lịch sử thanh toán',
        emptyMessage: 'Chưa có lần thanh toán nào',
        isHistorical: true,
      })}
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

function renderPaymentForm(student, tuitionRecord, formState, cashflowTransactions = [], centerId = '') {
  const { values, errors } = formState
  const amounts = calculateTuitionAmounts(tuitionRecord, cashflowTransactions, centerId)
  const debtAmount = amounts.remainingDebt
  const overpaidAmount = Math.max(amounts.paidAmount - amounts.payableAmount, 0)
  const isHistoryOnly = formState.mode === 'history'
  const normalizedPayment = normalizePaymentFormValues(values)
  const isOverDebt = Number.isFinite(normalizedPayment.amount) && normalizedPayment.amount > debtAmount
  const paymentSummary = buildTuitionPaymentSummary({
    tuitionRecord,
    cashflowTransactions,
    centerId,
  })
  const hasLegacyUnreconciled = paymentSummary.hasLegacyUnreconciled
  const disableSave = Boolean(formState.isSaving || debtAmount <= 0 || hasLegacyUnreconciled)

  return `
    <div class="tuition-form-backdrop" data-tuition-payment-action="cancel-payment"></div>
    <form class="tuition-form-panel tuition-payment-panel" ${isHistoryOnly ? '' : 'data-tuition-payment-form'}>
      <div class="tuition-form-header">
        <div>
          <h4>${isHistoryOnly ? 'Thông tin thanh toán học phí' : 'Ghi nhận thanh toán học phí'}</h4>
          <p>${escapeHtml(student.fullName)} · ${escapeHtml(student.parentName || 'Chưa có phụ huynh')} · ${escapeHtml(tuitionRecord.packageName)} · Kỳ ${tuitionRecord.currentTermNumber || 1}</p>
        </div>
        <button type="button" data-tuition-payment-action="cancel-payment" aria-label="Đóng form">X</button>
      </div>
      ${renderTuitionFormula(amounts)}
      <p class="tuition-ledger-note">Đã thanh toán và Còn nợ được tính từ giao dịch Thu chi liên kết.</p>
      ${
        overpaidAmount > 0
          ? `<p class="tuition-payment-warning">Khoản dư ${formatMoney(overpaidAmount)} cần xử lý khi tái đăng ký/gia hạn gói ở phase sau.</p>`
          : ''
      }
      ${
        hasLegacyUnreconciled
          ? '<p class="tuition-payment-warning">Kỳ này có số tiền đã thanh toán cũ chưa được đối soát với Thu chi. F23.8D sẽ xử lý lịch sử/backfill trước khi ghi nhận thêm.</p>'
          : ''
      }
      ${
        isOverDebt
          ? '<p class="tuition-payment-warning">Số tiền thanh toán lớn hơn khoản còn nợ. Vui lòng nhập lại, F23.8C chưa hỗ trợ đóng dư.</p>'
          : ''
      }
      ${
        isHistoryOnly
          ? '<p class="tuition-payment-empty">Học viên không còn nợ. Panel này chỉ hiển thị trạng thái thanh toán từ Thu chi.</p>'
          : `
            <div class="tuition-form-grid">
              ${renderTextField('amount', 'Số tiền', values.amount, errors.amount, 'text', 'payment')}
              ${renderTextField('paidAt', 'Ngày thanh toán', values.paidAt, errors.paidAt, 'date', 'payment')}
              <label class="${errors.method ? 'has-error' : ''}">
                <span>Phương thức</span>
                <select data-tuition-payment-field="method">
                  ${renderOptions(paymentMethodOptions, values.method)}
                </select>
                ${errors.method ? `<small>${errors.method}</small>` : ''}
              </label>
              ${renderTextField('payerName', 'Người nộp', values.payerName, errors.payerName, 'text', 'payment')}
              ${renderTextField('collectorName', 'Người ghi nhận', values.collectorName, errors.collectorName, 'text', 'payment')}
              ${renderTuitionPaymentEvidenceField(formState)}
              <label class="span-full ${errors.note ? 'has-error' : ''}">
                <span>Ghi chú</span>
                <textarea data-tuition-payment-field="note">${escapeHtml(values.note)}</textarea>
                ${errors.note ? `<small>${errors.note}</small>` : ''}
              </label>
            </div>
          `
      }
      <section class="tuition-payment-history" aria-label="Thanh toán đã ghi nhận từ Thu chi">
        <h5>Thanh toán đã ghi nhận từ Thu chi</h5>
        ${renderLedgerPaymentTimeline(paymentSummary, {
          title: '',
          emptyMessage: 'Chưa có lần thanh toán nào',
        })}
      </section>
      ${renderTermHistory(tuitionRecord, cashflowTransactions, centerId)}
      <div class="tuition-form-actions">
        <button type="button" data-tuition-payment-action="cancel-payment">${isHistoryOnly ? 'Đóng' : 'Hủy'}</button>
        ${isHistoryOnly ? '' : `<button type="submit" data-tuition-payment-action="save-payment" ${disableSave ? 'disabled' : ''}>${formState.isSaving ? 'Đang lưu...' : 'Lưu thanh toán'}</button>`}
      </div>
    </form>
  `
}

function renderTuitionDetailPanel(
  student,
  tuitionRecord,
  attendanceTuitionPreview = null,
  cashflowTransactions = [],
  centerId = '',
) {
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
          ? renderTuitionDetailContent(tuitionRecord, attendanceTuitionPreview, cashflowTransactions, centerId)
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

function renderTuitionDetailContent(
  tuitionRecord,
  attendanceTuitionPreview = null,
  cashflowTransactions = [],
  centerId = '',
) {
  const remainingSessions = tuitionRecord.totalSessions - tuitionRecord.usedSessions
  const amounts = calculateTuitionAmounts(tuitionRecord, cashflowTransactions, centerId)
  const paymentSummary = buildTuitionPaymentSummary({
    tuitionRecord,
    cashflowTransactions,
    centerId,
  })
  const status = getTuitionWarningStatus(remainingSessions)
  const hasLegacyUnreconciled = paymentSummary.hasLegacyUnreconciled
  const canCollectPayment = amounts.remainingDebt > 0 && !hasLegacyUnreconciled

  return `
    <section class="tuition-detail-overview" aria-label="Tổng quan kỳ hiện tại">
      ${renderDetailMetric('Gói hiện tại', escapeHtml(tuitionRecord.packageName))}
      ${renderDetailMetric('Kỳ', `Kỳ ${tuitionRecord.currentTermNumber || 1}`)}
      ${renderDetailMetric('Tổng số buổi', tuitionRecord.totalSessions)}
      ${renderDetailMetric('Đã học', tuitionRecord.usedSessions)}
      ${renderDetailMetric('Theo điểm danh', renderTuitionAttendancePreview(attendanceTuitionPreview), true)}
      ${renderDetailMetric('Còn lại', remainingSessions)}
      ${renderDetailMetric('Hạn đóng / ngày nhắc', tuitionRecord.dueDate || 'Chưa đặt')}
      ${renderDetailMetric('Trạng thái', status.label)}
      ${renderDetailMetric('Thanh toán', paymentSummary.statusLabel)}
      ${renderDetailMetric('Số lần thanh toán', paymentSummary.paymentCount)}
      ${renderDetailMetric('Ghi chú', escapeHtml(tuitionRecord.note || 'Không có ghi chú'), true)}
    </section>
    ${renderTuitionFormula(amounts)}
    <div class="tuition-payment-action-row">
      <button
        type="button"
        data-tuition-action="open-debt"
        data-tuition-student-id="${escapeHtml(tuitionRecord.studentId)}"
        ${canCollectPayment ? '' : 'disabled'}
        title="${canCollectPayment ? 'Ghi nhận thanh toán học phí' : hasLegacyUnreconciled ? 'Kỳ có paidAmount legacy chưa đối soát' : 'Đã thanh toán đủ'}"
      >
        Ghi nhận thanh toán
      </button>
      <small>${canCollectPayment ? 'Tạo một giao dịch Thu chi liên kết.' : hasLegacyUnreconciled ? 'Cần đối soát legacy ở F23.8D trước khi ghi nhận thêm.' : 'Đã thanh toán đủ.'}</small>
    </div>
    <p class="tuition-ledger-note">Đã thanh toán và Còn nợ được tính từ các giao dịch Thu chi liên kết.</p>
    ${renderLegacyUnreconciledPanel(paymentSummary)}
    ${renderTuitionOverpaymentWarning(paymentSummary)}
    <section class="tuition-payment-history" aria-label="Lịch sử thanh toán kỳ hiện tại">
      ${renderLedgerPaymentTimeline(paymentSummary, {
        title: 'Lịch sử thanh toán',
        emptyMessage: 'Chưa có lần thanh toán nào',
      })}
    </section>
    ${renderTermHistory(tuitionRecord, cashflowTransactions, centerId)}
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

function renderLedgerPaymentList(transactions = []) {
  return renderLedgerPaymentTimeline(
    {
      payments: sortTuitionPaymentTransactions(transactions),
      paymentCount: transactions.length,
      paidAmount: transactions.reduce(
        (total, transaction) => total + normalizeSafeNumber(transaction.amount),
        0,
      ),
      statusLabel: transactions.length ? 'Thanh toán một phần' : 'Chưa thanh toán',
      statusKey: transactions.length ? 'partial' : 'unpaid',
    },
    {
      title: '',
      emptyMessage: 'Chưa có lần thanh toán nào',
    },
  )
}

function renderLedgerPaymentTimeline(summary = {}, options = {}) {
  const payments = sortTuitionPaymentTransactions(summary.payments ?? [])
  const title = options.title ?? 'Lịch sử thanh toán'
  const emptyMessage = options.emptyMessage || 'Chưa có lần thanh toán nào'

  return `
    <div class="tuition-payment-timeline" data-tuition-payment-timeline>
      ${
        title
          ? `
            <div class="tuition-payment-timeline-header">
              <div>
                <h5>${escapeHtml(title)}</h5>
                <p>${summary.paymentCount || 0} lần thanh toán · ${formatMoney(summary.paidAmount || 0)} · ${escapeHtml(summary.statusLabel || 'Chưa thanh toán')}</p>
              </div>
            </div>
          `
          : `
            <div class="tuition-payment-timeline-header is-compact">
              <p>${summary.paymentCount || 0} lần thanh toán · ${formatMoney(summary.paidAmount || 0)} · ${escapeHtml(summary.statusLabel || 'Chưa thanh toán')}</p>
            </div>
          `
      }
      ${
        payments.length
          ? `
            <div class="tuition-payment-history-list">
              ${payments.map((transaction) => renderLedgerPaymentTimelineItem(transaction)).join('')}
            </div>
          `
          : `<p class="tuition-payment-empty">${escapeHtml(emptyMessage)}</p>`
      }
    </div>
  `
}

function renderLedgerPaymentTimelineItem(transaction) {
  const evidenceLabel = hasTransactionEvidence(transaction) ? 'Có chứng từ' : 'Không có chứng từ'
  const displayCode = getSafeTransactionDisplayCode(transaction)

  return `
    <article class="tuition-payment-item tuition-ledger-payment-item">
      <div class="tuition-ledger-payment-main">
        <div>
          <strong>${formatMoney(transaction.amount)}</strong>
          <time datetime="${escapeHtml(transaction.transactionDate)}">${formatPaymentDate(transaction.transactionDate)}</time>
        </div>
        <span class="tuition-payment-source-badge">Đồng bộ từ Học phí</span>
      </div>
      <dl class="tuition-ledger-payment-meta">
        <div><dt>Phương thức</dt><dd>${escapeHtml(transaction.method || 'Khác')}</dd></div>
        <div><dt>Người nộp</dt><dd>${escapeHtml(transaction.personName || 'Chưa rõ')}</dd></div>
        <div><dt>Người ghi nhận</dt><dd>${escapeHtml(transaction.recordedBy || 'Chưa rõ')}</dd></div>
        <div><dt>Chứng từ</dt><dd>${evidenceLabel}</dd></div>
        <div><dt>Mã giao dịch</dt><dd>${escapeHtml(displayCode)}</dd></div>
      </dl>
      ${transaction.note ? `<p>${escapeHtml(transaction.note)}</p>` : ''}
      <div class="tuition-ledger-payment-actions">
        <button type="button" data-tuition-payment-open-transaction="${escapeAttribute(transaction.id)}">
          Mở giao dịch Thu chi
        </button>
      </div>
    </article>
  `
}

function renderLegacyUnreconciledPanel(summary = {}) {
  if (!summary.hasLegacyUnreconciled) {
    return ''
  }

  return `
    <section class="tuition-legacy-unreconciled" aria-label="Số đã thanh toán cũ chưa được đối soát">
      <strong>Số đã thanh toán cũ chưa được đối soát</strong>
      <p>Dữ liệu này chưa có lịch sử giao dịch tương ứng trong Thu chi.</p>
      <dl>
        <div><dt>Số legacy</dt><dd>${formatMoney(summary.legacyPaidAmount || 0)}</dd></div>
        <div><dt>Đã liên kết qua Thu chi</dt><dd>${formatMoney(summary.paidAmount || 0)}</dd></div>
        <div><dt>Chưa đối soát</dt><dd>${formatMoney(summary.legacyUnreconciledAmount || 0)}</dd></div>
      </dl>
    </section>
  `
}

function renderTuitionOverpaymentWarning(summary = {}) {
  return summary.hasOverpayment
    ? '<p class="tuition-payment-warning">Số tiền đã ghi nhận vượt khoản cần thanh toán. Vui lòng kiểm tra giao dịch nguồn trong Thu chi.</p>'
    : ''
}

function hasTransactionEvidence(transaction = {}) {
  return Boolean(
    transaction.attachment ||
      (Array.isArray(transaction.attachments) && transaction.attachments.length) ||
      transaction.attachmentMetadataId ||
      transaction.storagePath,
  )
}

function getSafeTransactionDisplayCode(transaction = {}) {
  return String(transaction.transactionCode || transaction.code || 'Giao dịch Thu chi')
}

function renderTuitionPaymentEvidenceField(formState) {
  const draft = formState.attachmentDraft || createEmptyTuitionPaymentAttachmentDraft()
  const fieldError = formState.errors.attachment || draft.error
  const hasStaged = draft.mode === 'staged-new' && draft.objectUrl

  return `
    <div class="tuition-payment-evidence-field ${fieldError ? 'has-error' : ''}" data-tuition-payment-evidence-field>
      <span>Chứng từ</span>
      <input
        type="file"
        accept="${escapeHtml(CASHFLOW_EVIDENCE_ACCEPT)}"
        data-tuition-payment-evidence-input
        tabindex="-1"
        ${formState.isSaving ? 'disabled' : ''}
      />
      ${
        hasStaged
          ? `
            <div class="cashflow-evidence-preview" data-tuition-payment-evidence-preview>
              <img src="${escapeHtml(draft.objectUrl)}" alt="${escapeHtml(draft.fileName || 'Ảnh chứng từ')}" />
              <div>
                <strong title="${escapeHtml(draft.fileName)}">${escapeHtml(draft.fileName || 'Ảnh chứng từ')}</strong>
                <small>${escapeHtml(draft.mimeType || 'image/*')} · ${formatFileSize(draft.sizeBytes)}</small>
                <small>Ảnh mới, sẽ tải lên khi lưu</small>
              </div>
              <div class="cashflow-evidence-actions">
                <button type="button" data-tuition-payment-evidence-action="preview">Xem trước</button>
                <button type="button" data-tuition-payment-evidence-action="replace">Thay ảnh</button>
                <button type="button" data-tuition-payment-evidence-action="remove">Gỡ</button>
              </div>
            </div>
          `
          : `
            <div class="cashflow-evidence-empty" data-tuition-payment-evidence-preview>
              <button type="button" data-tuition-payment-evidence-action="insert" ${formState.isSaving ? 'disabled' : ''}>Chèn ảnh</button>
              <small>Không có chứng từ</small>
            </div>
          `
      }
      ${fieldError ? `<small>${escapeHtml(fieldError)}</small>` : ''}
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
    <div class="tuition-discount-preview" data-tuition-discount-preview aria-label="Công thức học phí">
      ${renderTuitionFormula(preview)}
    </div>
  `
}

export function renderTuitionDiscountPreviewFromValues(values) {
  return renderDiscountPreview(getDiscountPreview(values))
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

function getTimeValue(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function getTuitionPaymentStatusLabel(statusKey) {
  const labels = {
    unpaid: 'Chưa thanh toán',
    partial: 'Thanh toán một phần',
    paid: 'Đã thanh toán đủ',
    overpaid: 'Số tiền đã ghi nhận vượt khoản cần thanh toán',
    unreconciled: 'Chưa đối soát',
  }

  return labels[statusKey] || labels.unpaid
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

function escapeAttribute(value) {
  return escapeHtml(value)
}
