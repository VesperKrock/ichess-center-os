const missingValue = '—'

export function buildStudentTuitionLink(student = {}, tuitionRecords = [], classSessions = []) {
  const tuition = findStudentTuitionRecord(student, tuitionRecords)
  const amounts = tuition ? calculateTuitionAmounts(tuition) : null
  const totalSessions = normalizeSafeNumber(tuition?.totalSessions)
  const usedSessions = normalizeSafeNumber(tuition?.usedSessions)
  const hasSessionData = tuition && Number.isFinite(totalSessions) && Number.isFinite(usedSessions)
  const remainingSessions = hasSessionData ? totalSessions - usedSessions : null
  const parent = buildParentContact(student)
  const classSummary = buildClassSummary(student, classSessions)
  const tuitionSummary = tuition
    ? {
        hasTuition: true,
        packageName: displayValue(tuition.packageName),
        totalSessions,
        usedSessions,
        remainingSessions,
        payableAmount: amounts.payableAmount,
        paidAmount: amounts.paidAmount,
        debtAmount: amounts.remainingDebt,
        dueDate: displayValue(formatDate(tuition.dueDate)),
        statusLabel: getTuitionStatusLabel(remainingSessions, amounts.remainingDebt),
        label: `${displayValue(tuition.packageName)} · ${formatMoney(amounts.remainingDebt)} còn nợ`,
      }
    : {
        hasTuition: false,
        packageName: missingValue,
        totalSessions: null,
        usedSessions: null,
        remainingSessions: null,
        payableAmount: null,
        paidAmount: null,
        debtAmount: null,
        dueDate: missingValue,
        statusLabel: 'Chưa có học phí',
        label: 'Chưa có dữ liệu học phí liên kết cho học viên này.',
      }
  const warnings = buildStudentCareWarnings(student, parent, tuitionSummary, classSummary)

  return {
    studentId: student?.id ?? '',
    studentName: displayValue(student?.fullName),
    studentStatus: displayValue(student?.currentStatus),
    parent,
    classSummary,
    tuition: tuitionSummary,
    warnings,
    hasWarnings: warnings.length > 0,
  }
}

export function buildStudentCareWarnings(student = {}, parent = buildParentContact(student), tuition = null, classSummary = null) {
  const warnings = []
  const resolvedClassSummary = classSummary ?? buildClassSummary(student)
  const resolvedTuition =
    tuition ??
    {
      hasTuition: false,
      debtAmount: null,
      remainingSessions: null,
    }

  if (!parent.primaryPhone && !parent.fatherPhone && !parent.motherPhone) {
    warnings.push({
      key: 'missing-parent-phone',
      label: 'Thiếu SĐT phụ huynh',
      tone: 'warning',
    })
  }

  if (!String(student?.parentName ?? '').trim()) {
    warnings.push({
      key: 'missing-parent-name',
      label: 'Thiếu tên phụ huynh/người chăm sóc',
      tone: 'warning',
    })
  }

  if (!resolvedTuition.hasTuition) {
    warnings.push({
      key: 'missing-tuition',
      label: 'Chưa có dữ liệu học phí',
      tone: 'info',
    })
  } else if (resolvedTuition.debtAmount > 0) {
    warnings.push({
      key: 'tuition-debt',
      label: 'Cần kiểm tra học phí',
      tone: 'danger',
    })
  } else if (Number.isFinite(resolvedTuition.remainingSessions) && resolvedTuition.remainingSessions <= 2) {
    warnings.push({
      key: 'tuition-low-session',
      label: 'Sắp hết buổi học',
      tone: 'warning',
    })
  }

  if (!resolvedClassSummary.classSessionIds.length) {
    warnings.push({
      key: 'missing-class-session',
      label: 'Chưa phân lớp',
      tone: 'info',
    })
  }

  if (!String(student?.assignedTeacherId ?? '').trim()) {
    warnings.push({
      key: 'missing-teacher',
      label: 'Thiếu giáo viên phụ trách',
      tone: 'info',
    })
  }

  if (String(student?.careNotes?.[0]?.content ?? student?.parentNotes ?? '').trim()) {
    warnings.push({
      key: 'care-note',
      label: 'Có ghi chú cần chăm sóc',
      tone: 'info',
    })
  }

  return warnings
}

function findStudentTuitionRecord(student, tuitionRecords) {
  const studentId = String(student?.id ?? '').trim()

  if (!studentId) {
    return null
  }

  return tuitionRecords.find((record) => String(record?.studentId ?? '').trim() === studentId) ?? null
}

function buildParentContact(student) {
  const fatherPhone = normalizeText(student?.fatherPhone)
  const motherPhone = normalizeText(student?.motherPhone)
  const parentPhone = normalizeText(student?.parentPhone)
  const primaryPhone = motherPhone || fatherPhone || parentPhone

  return {
    parentName: displayValue(student?.parentName),
    primaryPhone,
    fatherPhone,
    motherPhone,
    parentPhone,
    hasContact: Boolean(normalizeText(student?.parentName) || primaryPhone || fatherPhone || motherPhone),
    note: normalizeText(student?.parentNotes),
  }
}

function buildClassSummary(student, classSessions = []) {
  const classSessionIds = Array.isArray(student?.classSessionIds)
    ? Array.from(new Set(student.classSessionIds.map((id) => String(id ?? '').trim()).filter(Boolean)))
    : []
  const classLookup = new Map(
    classSessions
      .filter((classSession) => classSession?.id)
      .map((classSession) => [String(classSession.id), classSession]),
  )
  const labels = classSessionIds.map((classSessionId) => {
    const classSession = classLookup.get(classSessionId)
    return classSession?.displayLabel || classSession?.name || classSessionId
  })

  return {
    classSessionIds,
    labels,
    label: labels.length ? labels.join(', ') : 'Chưa phân lớp',
  }
}

function calculateTuitionAmounts(tuitionRecord = {}) {
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
  const discountAmount =
    discountType === 'percent'
      ? Math.round((tuitionAmount * discountValue) / 100)
      : discountValue
  const payableAmount = Math.max(tuitionAmount - Math.min(discountAmount, tuitionAmount), 0)
  const paymentTotal = Array.isArray(tuitionRecord.payments)
    ? tuitionRecord.payments.reduce(
        (total, payment) => total + normalizeSafeNumber(payment?.amount),
        0,
      )
    : 0
  const paidAmount = Math.max(normalizeSafeNumber(tuitionRecord.paidAmount), paymentTotal)

  return {
    payableAmount,
    paidAmount,
    remainingDebt: Math.max(payableAmount - paidAmount, 0),
  }
}

function getTuitionStatusLabel(remainingSessions, debtAmount) {
  if (debtAmount > 0) {
    return 'Còn nợ học phí'
  }

  if (!Number.isFinite(remainingSessions)) {
    return 'Đã có gói'
  }

  if (remainingSessions < 0) {
    return 'Học vượt gói'
  }

  if (remainingSessions === 0) {
    return 'Đến hạn gia hạn'
  }

  if (remainingSessions <= 2) {
    return `Còn ${remainingSessions} buổi`
  }

  return 'Bình thường'
}

function normalizeDiscountType(discountType, discountAmount) {
  if (discountType === 'percent' || discountType === 'amount') {
    return discountType
  }

  return normalizeSafeNumber(discountAmount) > 0 ? 'amount' : 'none'
}

function normalizeSafeNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function displayValue(value) {
  const text = normalizeText(value)
  return text || missingValue
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(normalizeSafeNumber(value))
}
