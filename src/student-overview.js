import {
  getV22ClassSessionWeekdays,
  normalizeV22Enrollments,
} from './student-recurring-enrollment.js'
import { buildV24TuitionNotificationCandidates } from './notification-center.js'
import { getStudentStatusPresentation } from './student-status-presentation.js'

// Presentation only. Tuition rows and reminder signals come from their existing
// owners; this module never allocates money, sessions, packages or workflows.
export function getStudentNextAction(student, classSessions = [], tuitionRow = null) {
  const action = (key, title, description, label = '', target = '', tone = 'info') => ({
    key, title, description, label, target, tone,
  })
  if (student.currentStatus !== 'Đang theo học') {
    if (tuitionRow?.financeAvailable && tuitionRow?.debtAmount > 0) {
      return action('settlement-review', 'Học phí còn phải thanh toán',
        'Mở Học phí để kiểm tra khoản cần thanh toán của học viên.',
        'Kiểm tra học phí', 'tuition', 'warning')
    }
    return action('not-studying', getStudentStatusPresentation(student),
      'Hồ sơ và lịch sử học tập vẫn được giữ nguyên.')
  }

  const classIds = [...new Set(student.classSessionIds || [])]
  const classes = new Map(classSessions.map((item) => [String(item.id), item]))
  const active = classIds.map((id) => classes.get(String(id)))
    .filter((item) => item && item.status !== 'inactive')
  if (!active.length) {
    return action('assign-class', 'Chưa có ca học hiện tại',
      classIds.length ? 'Ca học trước đây không còn hoạt động. Hãy chọn ca phù hợp.'
        : 'Học viên đang theo học nhưng chưa có ca hoạt động.',
      'Gán ca học', 'edit', 'warning')
  }
  if (active.length < classIds.length) {
    return action('review-class', 'Cần kiểm tra ca học',
      'Một ca học trước đây không còn hoạt động. Hãy kiểm tra lại ca của bé.',
      'Gán ca học', 'edit', 'warning')
  }
  const enrollments = new Map(normalizeV22Enrollments(student.recurringEnrollments)
    .map((item) => [item.classSessionId, item]))
  const needsDays = active.some((item) => {
    const enrollment = enrollments.get(String(item.id))
    const days = getV22ClassSessionWeekdays(item)
    return enrollment ? !enrollment.weekdays.some((day) => days.includes(day))
      : student.useAuthoritativeEnrollment === true
  })
  if (needsDays) {
    return action('choose-days', 'Cần chọn ngày học', 'Ca học đã có; hãy kiểm tra ngày học của bé.',
      'Chọn ngày học', 'edit', 'warning')
  }
  if (!tuitionRow) {
    return action('tuition-unavailable', 'Chưa có thông tin học phí mới nhất',
      'Mở Học phí để tải và kiểm tra kỳ học hiện tại.', 'Mở chi tiết học phí', 'tuition')
  }
  const state = tuitionRow.packageCycleState
  const cycle = state?.currentCycle
  if (!tuitionRow.tuition && !cycle && (tuitionRow.tuitionAvailable !== false
    || state?.readiness === 'NO_TUITION_PACKAGE')) {
    return action('assign-package', 'Chưa có gói học', 'Chọn gói học trong Học phí.',
      'Gán gói học', 'tuition', 'warning')
  }
  if (state?.readiness === 'LEGACY_REVIEW_REQUIRED') {
    return action('review-package', 'Cần kiểm tra kỳ học hiện tại',
      'Mở Học phí để đối chiếu gói học và số buổi.', 'Mở chi tiết học phí', 'tuition', 'warning')
  }
  const signals = state ? buildV24TuitionNotificationCandidates([state], [student]) : []
  // Same blocking order as getPackageCycleWarningStatus: missing package,
  // unpaid/due renewal, then BCHT. At N-2 the existing renewal document is TBHP.
  if (signals.some((item) => item.meta.signal === 'needs-package-selection')) {
    return action('assign-package', 'Cần chọn gói mới', 'Mở Học phí để chọn gói tiếp theo.',
      'Gán gói học', 'tuition', 'warning')
  }
  if (cycle?.paymentStatus !== 'PAID'
    && (cycle?.lifecycleStatus === 'PROVISIONAL_UNPAID'
      || ['UNPAID', 'PARTIAL'].includes(cycle?.paymentStatus) || tuitionRow.debtAmount > 0)) {
    return action('record-payment', 'Học phí chưa thanh toán đủ',
      'Kiểm tra khoản cần thanh toán; chỉ ghi nhận khi đã nhận tiền.',
      'Ghi nhận thanh toán', 'tuition', 'warning')
  }
  const due = signals.find((item) => item.meta.signal === 'tuition-due')
  if (due) {
    const atN2 = Number(due.meta.remainingSessions) === 2
    return action(atN2 ? 'tuition-notice' : 'renewal-payment',
      atN2 ? 'Còn 2 buổi' : 'Học phí kỳ tiếp theo cần xử lý',
      atN2 ? 'Kỳ hiện tại sắp kết thúc. Chuẩn bị thông báo học phí tái đăng ký.'
        : 'Liên hệ phụ huynh; chỉ ghi nhận thanh toán khi đã nhận tiền.',
      atN2 ? 'Thông báo học phí' : 'Ghi nhận thanh toán', 'tuition', atN2 ? 'info' : 'warning')
  }
  if (signals.some((item) => item.meta.signal === 'bcht-due')) {
    return action('complete-report', 'Cần hoàn thành BCHT',
      'Nhắc giáo viên hoàn tất Báo cáo học tập của kỳ đến hạn.',
      'Hoàn thành BCHT', 'tuition')
  }
  if (state?.preparedNextCycle?.paymentStatus === 'PAID') {
    return action('next-paid', 'Đã thanh toán kỳ tiếp theo',
      'Chờ hoàn tất kỳ hiện tại. Không cần xử lý.')
  }
  if (!tuitionRow.financeAvailable || !cycle) {
    return action('tuition-unavailable', 'Cần kiểm tra thông tin học phí',
      'Chưa có đủ thông tin kỳ học và thanh toán mới nhất.', 'Mở chi tiết học phí', 'tuition')
  }
  return action('none', 'Không cần xử lý', 'Tiếp tục theo dõi việc học của bé.')
}

export function renderStudentOverviewAction(student, nextAction, className = '') {
  if (!nextAction.target || student.readOnlyProjection && nextAction.target === 'edit') return ''
  const escapedId = escapeHtml(student.id)
  return `<button type="button" class="${className}" data-student-overview-action="${nextAction.target}" data-student-id="${escapedId}">${escapeHtml(nextAction.label)}</button>`
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
