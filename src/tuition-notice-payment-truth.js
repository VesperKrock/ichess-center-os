// A printable TBHP is read separately from the Tuition operator snapshot.
// Match both authoritative reads before presenting a payment state on the PDF.
export function bindTuitionNoticePaymentTruth(document, operatorSnapshot, centerId) {
  const notice = document?.snapshot
  const studentId = document?.studentId
  const cycleId = document?.targetCycleId
  const invalid = () => new Error('Không xác định được trạng thái thanh toán của kỳ học phí. Vui lòng làm mới và thử lại.')
  if (!centerId || operatorSnapshot?.centerId !== centerId || document?.centerId !== centerId
    || notice?.center?.id !== centerId || notice?.student?.id !== studentId
    || notice?.tuition?.targetCycleId !== cycleId) throw invalid()

  const studentState = operatorSnapshot.cycleStates?.find(item => item.studentId === studentId)
  if (!operatorSnapshot.students?.some(item => item.id === studentId) || !studentState) throw invalid()
  const cycle = [studentState.currentCycle, studentState.preparedNextCycle, ...(studentState.cycles || [])]
    .find(item => item?.id === cycleId)
  if (!cycle || cycle.centerId !== centerId || cycle.studentId !== studentId
    || cycle.cycleNumber !== document.targetTermNumber
    || cycle.totalSessions !== document.totalSessions
    || !['PAID', 'UNPAID'].includes(cycle.paymentStatus)) throw invalid()

  return {
    ...document,
    snapshot: {
      ...notice,
      paymentTruth: {
        status: cycle.paymentStatus,
        paidBeforeIChess: cycle.paymentStatus === 'PAID'
          && cycle.openingPaymentState === 'PAID_BEFORE_ICHESS',
      },
    },
  }
}
