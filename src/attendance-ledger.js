import { V23_ATTENDANCE_CONTRACT, selectCurrentV23OccurrenceAttendanceRecord } from './cloud-authoritative-occurrence-attendance.js'
import { normalizeTuitionCyclePresentation } from './tuition-module.js'

const text = value => String(value ?? '').trim()
const searchText = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
const dayMs = 86400000
export const attendanceOccurrenceKey = (scheduleId, date) => `${text(scheduleId)}|${text(date)}`
export const ATTENDANCE_LEDGER_STATES = Object.freeze({
  present: { label: 'Có mặt', mark: '✓' },
  absent: { label: 'Vắng', mark: 'V' },
  makeup: { label: 'Học bù', mark: 'B' },
  historicalTrial: { label: 'Học thử (lịch sử)', mark: 'T' },
  unmarked: { label: 'Chưa điểm danh', mark: '?' },
  today: { label: 'Chưa điểm danh hôm nay', mark: '' },
  future: { label: 'Chưa đến giờ học', mark: '◷' },
  cancelled: { label: 'Đã hủy', mark: '×' },
  notExpected: { label: 'Không thuộc lịch định kỳ', mark: '—' },
})

export function isAttendanceLedgerDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function getAttendanceLedgerMonthRange(month = '') {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  const safeMonth = isAttendanceLedgerDate(`${month}-01`) ? month : today.slice(0, 7)
  const start = `${safeMonth}-01`
  const end = new Date(`${start}T00:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 1)
  end.setUTCDate(0)
  return { fromDate: start, toDate: end.toISOString().slice(0, 10) }
}

export function normalizeAttendanceLedgerFilters(filters = {}) {
  const defaults = getAttendanceLedgerMonthRange(filters.month)
  const fromDate = filters.fromDate ?? defaults.fromDate
  const toDate = filters.toDate ?? defaults.toDate
  const validDates = isAttendanceLedgerDate(fromDate) && isAttendanceLedgerDate(toDate)
  const days = validDates ? (Date.parse(toDate) - Date.parse(fromDate)) / dayMs : -1
  return {
    fromDate, toDate,
    classSessionId: text(filters.classSessionId) || 'all',
    teacherId: text(filters.teacherId) || 'all',
    query: text(filters.query),
    error: !validDates ? 'Chọn ngày bắt đầu và ngày kết thúc.'
      : days < 0 ? 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'
        : days > 365 ? 'Chọn khoảng thời gian tối đa một năm.' : '',
  }
}

// Only the server/realtime V2.3 projection enters the operational ledger.
// Reports, initialBaseline and browser compatibility copies remain audit evidence.
export function getCanonicalLedgerAttendance(records = []) {
  return records.filter(record => record?.attendanceAuthority === V23_ATTENDANCE_CONTRACT
    && ['admin', 'teacher', 'correction'].includes(record.source)
    && Number.isSafeInteger(Number(record.cloudVersion)) && Number(record.cloudVersion) > 0
    && !record.cloudDeletedAt && !record.isDeleted
    && text(record.scheduleSessionId) && text(record.studentId)
    && isAttendanceLedgerDate(record.date))
}

export function isAttendanceLedgerOccurrenceFuture(occurrence, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]))
  const today = `${parts.year}-${parts.month}-${parts.day}`
  return occurrence.date > today || (!occurrence.dateReachedEditing && occurrence.date === today && occurrence.lifecycleState !== 'HELD'
    && (!occurrence.startTime || occurrence.startTime > `${parts.hour}:${parts.minute}`))
}

function projectFact(fact, classById, scheduleById) {
  const classSession = classById.get(text(fact.class_session_local_id))
  const schedule = scheduleById.get(text(fact.schedule_session_local_id))
  return {
    key: attendanceOccurrenceKey(fact.schedule_session_local_id, fact.occurrence_date),
    scheduleSessionId: text(fact.schedule_session_local_id), date: fact.occurrence_date,
    classSessionId: text(fact.class_session_local_id),
    classLabel: text(classSession?.displayLabel || classSession?.name || schedule?.title) || 'Buổi học',
    startTime: text(fact.planned_start_time).slice(0, 5),
    endTime: text(fact.planned_end_time).slice(0, 5), room: text(fact.room),
    studentIds: [...new Set((fact.roster_student_ids || []).map(text))],
    lifecycleState: fact.lifecycle_state,
    teacherId: text(fact.actual_teacher_override ? fact.actual_teacher_id : fact.planned_teacher_id),
    teacherName: text(fact.actual_teacher_override ? fact.actual_teacher_name : fact.planned_teacher_name),
    isSubstitute: fact.actual_teacher_override === true,
    partialHistoricalRoster: fact.context_origin === 'EXISTING_ATTENDANCE',
    materialized: true,
  }
}

function projectPlanned(session, classById) {
  const classSession = classById.get(text(session.classSessionId))
  return {
    key: attendanceOccurrenceKey(session.id, session.occurrenceDate),
    scheduleSessionId: text(session.id), date: session.occurrenceDate,
    classSessionId: text(session.classSessionId),
    classLabel: text(classSession?.displayLabel || classSession?.name || session.title) || 'Buổi học',
    startTime: text(session.startTime).slice(0, 5), endTime: text(session.endTime).slice(0, 5),
    room: text(session.room), studentIds: [...new Set((session.studentIds || []).map(text))],
    lifecycleState: session.status === 'cancelled' ? 'CANCELLED' : 'PLANNED',
    teacherId: text(session.teacherId), teacherName: text(session.teacherName),
    materialized: false, isSubstitute: false,
  }
}

function resolvePlannedClassSlotIdentity(session, scheduleSessions, occurrences) {
  if (!session.isClassSessionSlot || session.isEmptyClassSessionSlot || session.a3OccurrenceMaterialized) return session
  // Schedule's class-slot projection can reuse one assignment for every class
  // weekday. Resolve that alias through its canonical class/recurring lineage,
  // never through labels, teacher names or time text. Real one-offs keep their IDs.
  const assignments = scheduleSessions.filter(item => Number(item.cloudVersion) > 0
    && !item.cloudDeletedAt && !item.isDeleted && item.scheduleType === 'recurring'
    && text(item.classSessionId) === text(session.classSessionId))
  const weekdayAssignment = assignments.find(item => text(item.dayOfWeek) === text(session.dayOfWeek))
  const facts = occurrences.filter(fact => text(fact.class_session_local_id) === text(session.classSessionId)
    && fact.occurrence_date === session.occurrenceDate
    && (fact.schedule_type === 'recurring'
      || assignments.some(item => text(item.id) === text(fact.schedule_session_local_id))))
  const fact = facts.find(item => text(item.schedule_session_local_id) === text(weekdayAssignment?.id)) || facts[0]
  const id = text(fact?.schedule_session_local_id || weekdayAssignment?.id
    || (assignments.length === 1 ? assignments[0].id : session.id))
  return { ...session, id, assignmentId: id }
}

export function buildCanonicalAttendanceLedger({
  students = [], classSessions = [], scheduleSessions = [], occurrences = [], plannedOccurrences = [],
  attendanceRecords = [], makeupBookings = [], filters = {}, packageCycleStudentStates = [], packageCycleReady = false,
  now = new Date(), monthlyProjection = false,
} = {}) {
  const normalized = normalizeAttendanceLedgerFilters(filters)
  const classById = new Map(classSessions.map(item => [text(item.id), item]))
  const scheduleById = new Map(scheduleSessions.map(item => [text(item.id), item]))
  const occurrenceByKey = new Map(occurrences.map(fact => {
    const occurrence = projectFact(fact, classById, scheduleById)
    return [occurrence.key, occurrence]
  }))
  const canonicalRecords = getCanonicalLedgerAttendance(attendanceRecords)
  // A2's EXISTING_ATTENDANCE compatibility contract preserves only witnessed
  // students and the captured teacher when no snapshot exists yet. Read the
  // same V2.3 evidence without calling the mutating RESOLVE RPC from Board.
  const witnessedByKey = new Map()
  for (const record of canonicalRecords) {
    const key = attendanceOccurrenceKey(record.scheduleSessionId, record.date)
    if (occurrenceByKey.has(key)) continue
    const evidence = witnessedByKey.get(key) || []
    evidence.push(record)
    witnessedByKey.set(key, evidence)
  }
  for (const [key, evidence] of witnessedByKey) {
    const first = [...evidence].sort((a, b) => text(a.authorityLocalId).localeCompare(text(b.authorityLocalId)))[0]
    const classSession = classById.get(text(first.classSessionId))
    occurrenceByKey.set(key, {
      key, scheduleSessionId: text(first.scheduleSessionId), date: first.date,
      classSessionId: text(first.classSessionId),
      classLabel: text(classSession?.displayLabel || classSession?.name) || 'Buổi học lịch sử',
      startTime: '', endTime: '', room: '', lifecycleState: 'HELD',
      studentIds: [...new Set(evidence.map(record => text(record.studentId)))],
      teacherId: text(first.teacherId), teacherName: text(first.teacherName),
      materialized: false, isSubstitute: false, partialHistoricalRoster: true,
    })
  }
  // Existing facts keep their frozen roster. The monthly board also includes
  // unresolved past/current Schedule slots; N2 resolves only explicit saves.
  for (const planned of plannedOccurrences) {
    // Schedule already chooses the effective weekday assignment for monthly
    // slots. Keep its exact ID, including when assignments change mid-month.
    const session = monthlyProjection ? planned : resolvePlannedClassSlotIdentity(planned, scheduleSessions, occurrences)
    const occurrence = projectPlanned(session, classById)
    if (!occurrenceByKey.has(occurrence.key) && (monthlyProjection || isAttendanceLedgerOccurrenceFuture(occurrence, now))) {
      occurrenceByKey.set(occurrence.key, occurrence)
    }
  }
  if (monthlyProjection) for (const occurrence of occurrenceByKey.values()) {
    occurrence.dateReachedEditing = true
    occurrence.regularStudentIds = [...occurrence.studentIds]
  }
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'}).format(now)
  const bookingByDestination = new Map()
  const bookingBySource = new Map()
  for (const rawBooking of makeupBookings.filter(b => ['PLANNED', 'COMPLETED'].includes(b.state))) {
    const booking = {...rawBooking, destinationClassLabel: classById.get(rawBooking.destination_class_local_id)?.displayLabel
      || classById.get(rawBooking.destination_class_local_id)?.name || 'Ca học',
      sourceClassLabel: classById.get(rawBooking.source_class_local_id)?.displayLabel
        || classById.get(rawBooking.source_class_local_id)?.name || 'Ca học'}
    const key = attendanceOccurrenceKey(booking.destination_schedule_local_id, booking.destination_date)
    const occurrence = occurrenceByKey.get(key)
    if (occurrence) {
      // Additive participation only; the frozen regular roster stays separate.
      occurrence.regularStudentIds ||= [...occurrence.studentIds]
      if (!occurrence.studentIds.includes(booking.student_local_id)) occurrence.studentIds.push(booking.student_local_id)
      bookingByDestination.set(`${key}|${booking.student_local_id}`, booking)
    }
    bookingBySource.set(booking.source_attendance_local_id, booking)
  }
  const inRange = [...occurrenceByKey.values()].filter(item => !normalized.error
    && item.date >= normalized.fromDate && item.date <= normalized.toDate)
  const teacherOptions = [...new Map(inRange.filter(item => item.teacherId || item.teacherName)
    .map(item => [item.teacherId || `name:${item.teacherName}`, {
      id: item.teacherId || `name:${item.teacherName}`, name: item.teacherName || 'Giáo viên đã lưu',
    }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id))
  const columns = inRange.filter(item =>
    (normalized.classSessionId === 'all' || item.classSessionId === normalized.classSessionId)
    && (normalized.teacherId === 'all' || (item.teacherId || `name:${item.teacherName}`) === normalized.teacherId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
      || a.classLabel.localeCompare(b.classLabel, 'vi') || a.key.localeCompare(b.key))
  const recordsByOccurrence = new Map()
  for (const record of canonicalRecords) {
    const key = attendanceOccurrenceKey(record.scheduleSessionId, record.date)
    const records = recordsByOccurrence.get(key) || []
    records.push(record)
    recordsByOccurrence.set(key, records)
  }
  const recordByLocalId = new Map(canonicalRecords.map(record => [text(record.authorityLocalId), record]))
  const studentById = new Map(students.map(student => [text(student.id), student]))
  const cycleByStudentId = new Map(packageCycleStudentStates.map(state => [text(state.studentId), state]))
  const expectedIds = new Set(columns.flatMap(item => item.studentIds))
  const rows = [...expectedIds].map(studentId => {
    const student = studentById.get(studentId) || { id: studentId, fullName: 'Học viên lịch sử' }
    const cells = columns.map(occurrence => {
      const expected = occurrence.studentIds.includes(studentId)
      const offRoster = monthlyProjection && !occurrence.regularStudentIds.includes(studentId)
      const record = monthlyProjection || expected ? selectCurrentV23OccurrenceAttendanceRecord(
        recordsByOccurrence.get(occurrence.key) || [],
        { id: occurrence.scheduleSessionId, occurrenceDate: occurrence.date }, studentId,
      ) : null
      const rawStatus = text(record?.attendanceStatus || record?.status)
      const recordedState = rawStatus === 'makeup' ? 'makeup' : rawStatus === 'present' ? 'present'
        : rawStatus === 'trial' ? 'historicalTrial'
          : ['absent', 'excused', 'excusedAbsent', 'unexcusedAbsent'].includes(rawStatus) ? 'absent' : null
      const state = monthlyProjection ? occurrence.date > today ? 'future'
        : !expected && !record ? 'notExpected' : occurrence.lifecycleState === 'CANCELLED' ? 'cancelled'
          : recordedState || (offRoster ? 'notExpected' : occurrence.date === today ? 'today' : 'unmarked')
        : !expected ? 'notExpected' : occurrence.lifecycleState === 'CANCELLED' ? 'cancelled'
        : isAttendanceLedgerOccurrenceFuture(occurrence, now) ? 'future'
          : rawStatus === 'makeup' ? 'makeup'
          : rawStatus === 'present' ? 'present'
            : rawStatus === 'trial' ? 'historicalTrial'
              : ['absent', 'excused', 'excusedAbsent', 'unexcusedAbsent'].includes(rawStatus) ? 'absent' : 'unmarked'
      const target = state === 'makeup' ? recordByLocalId.get(text(record?.makeupForAttendanceLocalId)) : null
      const originalOccurrence = target && target.studentId === studentId
        && ['absent', 'excused', 'excusedAbsent', 'unexcusedAbsent'].includes(target.attendanceStatus || target.status)
        ? occurrenceByKey.get(attendanceOccurrenceKey(target.scheduleSessionId, target.date)) || null : null
      const makeupBooking = bookingByDestination.get(`${occurrence.key}|${studentId}`) || null
      const sourceBooking = bookingBySource.get(text(record?.authorityLocalId)) || null
      const completedMakeup = record?.authorityLocalId && canonicalRecords.find(r => r.attendanceStatus === 'makeup'
        && r.makeupForAttendanceLocalId === record?.authorityLocalId && r.studentId === studentId)
      return { occurrence, record, state, ...ATTENDANCE_LEDGER_STATES[state], originalOccurrence, makeupBooking, sourceBooking,
        offRoster,
        ...(monthlyProjection && state === 'future' ? {mark: '', label: 'Chưa tới ngày học'} : {}),
        ...(monthlyProjection && state === 'today' ? {mark: '?', label: 'Chưa điểm danh'} : {}),
        unmarkedState: offRoster ? 'notExpected' : monthlyProjection && occurrence.date === today ? 'today' : 'unmarked',
        isOverdueUnmarked: Boolean(monthlyProjection && expected && !record && state === 'unmarked' && occurrence.date < today),
        makeupOnly: Boolean(makeupBooking && !occurrence.regularStudentIds.includes(studentId)),
        completedMakeup,
        originalDate: originalOccurrence?.date || target?.date || '',
        isTrial: rawStatus === 'trial', isExcused: ['excused', 'excusedAbsent'].includes(rawStatus) }
    })
    const tuition = normalizeTuitionCyclePresentation({
      packageCycleState: packageCycleReady ? cycleByStudentId.get(studentId) || null : null,
      packageCycleReady, packageCycleStatus: packageCycleReady ? 'ready' : 'failed',
    })
    return { student, cells, tuition }
  }).filter(row => !normalized.query || searchText([
    row.student.fullName, row.student.studentCode, row.student.parentName, row.student.parentPhone,
  ].join(' ')).includes(searchText(normalized.query)))
    .sort((a, b) => text(a.student.fullName).localeCompare(text(b.student.fullName), 'vi')
      || text(a.student.studentCode).localeCompare(text(b.student.studentCode)) || text(a.student.id).localeCompare(text(b.student.id)))
  const model = { filters: normalized, columns, rows, teacherOptions, occurrenceByKey, monthlyProjection }
  return {...model, overdueUnmarkedCount: getAttendanceLedgerOverdueUnmarkedCount(model)}
}

// Read-only future N6 input: visible, participating, past, non-cancelled cells
// with no canonical mark. A dirty overlay never changes this canonical count.
export function getAttendanceLedgerOverdueUnmarkedCount(model) {
  return (model?.rows || []).reduce((count, row) => count + row.cells.filter(cell => cell.isOverdueUnmarked === true).length, 0)
}
