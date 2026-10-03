// Preserve the Customer action until the exact current-center Tuition read can resolve it.
export async function openConvertedStudentTuition({
  studentId, centerId, forceRefresh = false, getSnapshot, refresh, isCurrent, openPanel, showMessage,
}) {
  const missing = 'Không tìm thấy học viên này trong dữ liệu Học phí của cơ sở hiện tại.'
  const failed = 'Không tải được học phí. Vui lòng làm mới.'
  if (!studentId || !centerId || !isCurrent()) return false
  let snapshot = getSnapshot()
  if (forceRefresh || snapshot?.status !== 'ready' || snapshot.centerId !== centerId
    || !snapshot.students?.some(item => item.id === studentId)) {
    let result
    try { result = await refresh() } catch { result = { ok: false } }
    if (!isCurrent()) return false
    snapshot = getSnapshot()
    if (!result?.ok || snapshot?.status !== 'ready' || snapshot.centerId !== centerId) {
      showMessage(failed)
      return false
    }
  }
  if (!isCurrent()) return false
  if (!snapshot.students.some(item => item.id === studentId)) {
    showMessage(missing)
    return false
  }
  const cycleState = snapshot.cycleStates.find(item => item.studentId === studentId)
  const kind = cycleState?.currentCycle ? 'detail'
    : cycleState?.initialSetupRequired ? 'initial' : 'assign'
  try { await openPanel(kind, studentId) } catch {
    if (isCurrent()) showMessage(failed)
    return false
  }
  return isCurrent()
}
