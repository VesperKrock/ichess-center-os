export function computeAttendanceCycleState({
  packageTotalSessions,
  attendedPaidCredits,
  paidCycleCount,
  cellCredits = [],
  countsTowardTuition = true,
} = {}) {
  const totalSessions = Number(packageTotalSessions)
  const attendedCredits = Number(attendedPaidCredits)
  const normalizedPaidCycleCount = Number(paidCycleCount)
  const creditCount = Array.isArray(cellCredits) && cellCredits.length ? cellCredits.length : 1

  if (!countsTowardTuition) {
    return {
      countsTowardTuition: false,
      displayValue: '',
      sourceLabel: 'Học thử',
      countingStatus: 'trial',
      warning: 'Học thử không tính vào gói học phí.',
    }
  }

  if (!Number.isFinite(totalSessions) || totalSessions <= 0) {
    return {
      countsTowardTuition: true,
      displayValue: '',
      sourceLabel: 'Chưa đủ dữ liệu',
      countingStatus: 'warning',
      warning: 'Chưa đủ dữ liệu gói học phí.',
    }
  }

  if (!Number.isFinite(attendedCredits) || attendedCredits <= 0) {
    return {
      countsTowardTuition: true,
      displayValue: '',
      sourceLabel: 'Chưa đủ dữ liệu',
      countingStatus: 'warning',
      warning: 'Chưa đủ dữ liệu buổi học.',
    }
  }

  const cycleIndex = Math.floor((attendedCredits - 1) / totalSessions) + 1
  const sessionNumberInCycle = ((attendedCredits - 1) % totalSessions) + 1
  const remainingInCycle = Math.max(0, totalSessions - sessionNumberInCycle)
  const paidCycleAvailable =
    Number.isFinite(normalizedPaidCycleCount) && normalizedPaidCycleCount >= cycleIndex
  const startsNewCycle = sessionNumberInCycle === 1 && attendedCredits > totalSessions
  const countingStatus = startsNewCycle && !paidCycleAvailable ? 'unpaid' : 'paid'
  const warning =
    startsNewCycle && !paidCycleAvailable
      ? 'Chưa có kỳ mới đã đóng.'
      : startsNewCycle
        ? 'Đã có kỳ mới.'
        : ''

  return {
    countsTowardTuition: true,
    creditCount,
    cycleIndex,
    sessionNumberInCycle,
    remainingInCycle,
    startsNewCycle,
    paidCycleAvailable,
    countingStatus,
    warning,
    displayValue:
      cycleIndex > 1
        ? `Kỳ ${cycleIndex} · Buổi ${sessionNumberInCycle}/${totalSessions}`
        : `Buổi ${sessionNumberInCycle}/${totalSessions}`,
    remainingLabel: `Còn ${remainingInCycle}/${totalSessions}`,
  }
}

export function getPaidCycleCountFromTuition(tuition) {
  if (!tuition || typeof tuition !== 'object') {
    return 0
  }

  const termHistory = Array.isArray(tuition.termHistory) ? tuition.termHistory : []
  const paidTerms = termHistory.filter((term) => isPaidTuitionTerm(term))
  const currentTermNumber = Number(tuition.currentTermNumber)
  const hasPaidAmount = Number(tuition.paidAmount) > 0
  const hasNoDebt = Number(tuition.totalAmount || 0) - Number(tuition.discountAmount || 0) <= Number(tuition.paidAmount || 0)

  return Math.max(
    paidTerms.length,
    Number.isFinite(currentTermNumber) && (hasPaidAmount || hasNoDebt) ? currentTermNumber : 0,
    hasPaidAmount || hasNoDebt ? 1 : 0,
  )
}

function isPaidTuitionTerm(term) {
  if (!term || typeof term !== 'object') {
    return false
  }

  if (term.paymentStatus === 'paid' || term.status === 'paid' || term.isPaid === true) {
    return true
  }

  const totalAmount = Number(term.totalAmount || term.payableAmount || 0)
  const paidAmount = Number(term.paidAmount || 0)

  return totalAmount > 0 && paidAmount >= totalAmount
}
