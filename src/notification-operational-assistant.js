import { buildCanonicalAttendanceLedger, isAttendanceLedgerOccurrenceFuture } from './attendance-ledger.js'
import { normalizeTuitionCyclePresentation } from './tuition-module.js'

const text = value => String(value ?? '').trim()
const operationalSignals = new Set(['attendance-incomplete', 'tuition-n2', 'payment-check'])

export function getNotificationAttentionRange(now = new Date()) {
  const toDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)
  const fromDate = new Date(Date.parse(`${toDate}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
  return { fromDate, toDate, classSessionId: 'all', teacherId: 'all', query: '' }
}

export function notificationBusinessKey(centerId, studentId, cycleId, signal) {
  return `attention:${text(centerId)}:${text(studentId)}:${text(cycleId)}:${text(signal)}`
}

export function buildIncompleteAttendanceCandidates(source = {}, { centerId, now = new Date() } = {}) {
  if (source.status !== 'ready' || source.centerId !== centerId) return []
  const filters = getNotificationAttentionRange(now)
  const fullRosters = new Set((source.occurrences || []).filter(fact => fact.center_id === centerId
    && fact.context_origin === 'CURRENT_SCHEDULE' && Array.isArray(fact.roster_student_ids))
    .map(fact => `${fact.schedule_session_local_id}|${fact.occurrence_date}`))
  const model = buildCanonicalAttendanceLedger({
    students: source.students, classSessions: source.classSessions, scheduleSessions: source.scheduleSessions,
    occurrences: (source.occurrences || []).filter(fact => fact.center_id === centerId),
    attendanceRecords: (source.attendanceRecords || []).filter(record => !record.centerId || record.centerId === centerId), filters, now,
  })
  return model.columns.flatMap((occurrence, index) => {
    const end = /^\d{2}:\d{2}$/.test(occurrence.endTime)
      ? Date.parse(`${occurrence.date}T${occurrence.endTime}:00+07:00`) : NaN
    if (!fullRosters.has(occurrence.key) || !occurrence.materialized || occurrence.partialHistoricalRoster || !occurrence.studentIds.length
      || occurrence.lifecycleState === 'CANCELLED' || isAttendanceLedgerOccurrenceFuture(occurrence, now)
      || !Number.isFinite(end) || end >= now.getTime()) return []
    const missing = model.rows.filter(row => row.cells[index].state === 'unmarked').length
    if (!missing) return []
    return [{
      dedupeKey: `attention:${centerId}:${occurrence.key}:attendance-incomplete`,
      sourceModule: 'thoi-khoa-bieu', sourceLabel: 'Thời khóa biểu', type: 'attendance-operation',
      severity: 'warning', title: `${occurrence.classLabel} · ${occurrence.startTime} chưa hoàn tất điểm danh`,
      message: `Còn ${missing} học viên chưa điểm danh · ${occurrence.date.split('-').reverse().join('/')}`,
      entityId: occurrence.scheduleSessionId, entityType: 'scheduleOccurrence', entityLabel: occurrence.classLabel,
      createdAt: new Date(end).toISOString(), updatedAt: now.toISOString(),
      meta: { centerId, providerId: 'attendance-attention', operational: true, signal: 'attendance-incomplete',
        sessionId: occurrence.scheduleSessionId, occurrenceDate: occurrence.date,
        missingStudents: missing, expectedStudents: occurrence.studentIds.length, actionLabel: 'Mở ca học' },
    }]
  })
}

export function buildTuitionN2Candidates(source = {}, operations = {}, { centerId, now = new Date() } = {}) {
  if (source.status !== 'ready' || source.centerId !== centerId
    || operations.status !== 'ready' || operations.centerId !== centerId) return []
  const students = new Map((source.students || []).map(student => [text(student.id), student]))
  const sent = new Set((operations.tbhpCheckpoints || [])
    .filter(checkpoint => checkpoint.centerId === centerId && checkpoint.sentAt)
    .map(checkpoint => `${checkpoint.studentId}|${checkpoint.cycleId}`))
  return (source.cycleStates || []).flatMap(state => {
    if (state.centerId !== centerId || state.readiness !== 'READY') return []
    const student = students.get(text(state.studentId))
    const p = normalizeTuitionCyclePresentation({ packageCycleState: state, packageCycleReady: true })
    if (!student || !p.hasKnownPackage || p.ended || !p.reminderLabel
      || sent.has(`${state.studentId}|${p.cycleId}`)) return []
    return [{
      dedupeKey: notificationBusinessKey(centerId, student.id, p.cycleId, 'tuition-n2'),
      sourceModule: 'hoc-phi', sourceLabel: 'Học phí', type: 'tuition', severity: p.remainingSessions <= 0 ? 'danger' : 'warning',
      title: `${student.fullName} · ${p.termLabel} · ${p.progressLabel}`,
      message: `Còn ${p.remainingSessions} buổi — nên gửi TBHP`, entityId: student.id, entityType: 'student', entityLabel: student.fullName,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
      meta: { centerId, providerId: 'tuition-n2', operational: true, signal: 'tuition-n2', studentId: student.id,
        cycleId: p.cycleId, cycleNumber: p.cycle.cycleNumber, remainingSessions: p.remainingSessions, actionLabel: 'Mở học phí' },
    }]
  })
}

export function buildPaymentAttentionCandidates(operations = {}, tuition = {}, { centerId, now = new Date() } = {}) {
  if (operations.status !== 'ready' || operations.centerId !== centerId
    || tuition.status !== 'ready' || tuition.centerId !== centerId) return []
  const students = new Map((tuition.students || []).map(student => [text(student.id), student]))
  return (operations.reminders || []).flatMap(reminder => {
    const student = students.get(text(reminder.studentId))
    if (reminder.centerId !== centerId || reminder.signal !== 'PAYMENT_CHECK_DUE' || !student) return []
    return [{
      dedupeKey: notificationBusinessKey(centerId, reminder.studentId, reminder.cycleId, 'payment-check'),
      sourceModule: 'hoc-phi', sourceLabel: 'Học phí', type: 'attendance-operation', severity: 'danger',
      title: `${student.fullName} · Kỳ ${reminder.cycleNumber}`, message: 'Học phí cần kiểm tra',
      entityId: student.id, entityType: 'student', entityLabel: student.fullName,
      createdAt: `${reminder.triggerDate}T00:00:00.000Z`, updatedAt: now.toISOString(),
      meta: { centerId, providerId: 'payment-attention', operational: true, signal: 'payment-check',
        studentId: student.id, cycleId: reminder.cycleId, cycleNumber: reminder.cycleNumber, actionLabel: 'Mở học phí' },
    }]
  })
}

// Only recognized old providers are coalesced. Other cached records remain
// available in All; they cannot become canonical attention by having a title.
export function normalizeCachedOperationalNotification(item, centerId) {
  const meta = item.meta || {}
  if (meta.centerId && meta.centerId !== centerId) return item
  let signal = meta.signal
  if (item.dedupeKey === `v2-4:${meta.cycleId}:tuition-due`
    || item.dedupeKey === `v2-8a:${meta.cycleId}:TBHP_SEND_DUE`) signal = 'tuition-n2'
  if (item.dedupeKey === `v2-8a:${meta.cycleId}:PAYMENT_CHECK_DUE`) signal = 'payment-check'
  const recognized = item.dedupeKey === `v2-4:${meta.cycleId}:tuition-due`
    || item.dedupeKey === `v2-8a:${meta.cycleId}:TBHP_SEND_DUE`
    || item.dedupeKey === `v2-8a:${meta.cycleId}:PAYMENT_CHECK_DUE`
    || item.dedupeKey === notificationBusinessKey(centerId, meta.studentId, meta.cycleId, signal)
  if (!recognized || !['tuition-n2', 'payment-check'].includes(signal) || !meta.studentId || !meta.cycleId) return item
  return { ...item, dedupeKey: notificationBusinessKey(centerId, meta.studentId, meta.cycleId, signal),
    sourceModule: 'hoc-phi', sourceLabel: 'Học phí', type: signal === 'tuition-n2' ? 'tuition' : 'attendance-operation',
    meta: { ...meta, centerId, signal, operational: true,
      providerId: signal === 'tuition-n2' ? 'tuition-n2' : 'payment-attention', actionLabel: 'Mở học phí' } }
}

export function isOperationalNotification(item) {
  return item.meta?.operational === true && Boolean(item.meta?.providerId)
}

export function getNotificationRoute(item, centerId) {
  const meta = item?.meta || {}
  if (!operationalSignals.has(meta.signal) || meta.centerId !== centerId) return null
  if (meta.signal === 'attendance-incomplete' && meta.sessionId && /^\d{4}-\d{2}-\d{2}$/.test(meta.occurrenceDate)) {
    return { moduleId: 'thoi-khoa-bieu', sessionId: meta.sessionId, occurrenceDate: meta.occurrenceDate }
  }
  if (meta.studentId && meta.cycleId) return { moduleId: 'hoc-phi', studentId: meta.studentId, cycleId: meta.cycleId }
  return null
}
