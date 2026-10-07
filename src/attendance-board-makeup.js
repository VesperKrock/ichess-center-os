import { pullA4EligibleMissedOccurrences } from './cloud-authoritative-occurrence-attendance.js'
import { pullMakeupBookingContext, mutateMakeupBooking } from './cloud-makeup-bookings.js'
import { createOperationalCommandIdempotencyKey } from './cloud-authoritative-attendance-tuition.js'

export const NO_MAKEUP_SOURCE = 'Không có buổi Vắng hợp lệ để học bù.'
export const SAVE_ABSENCE_FIRST = 'Hãy lưu buổi Vắng trước khi xếp Học bù.'
export const MAKEUP_PARTIAL_SAVE = 'Lịch học bù đã được tạo nhưng điểm danh chưa lưu được. Hãy thử Lưu điểm danh lại.'
const contextError = 'Cơ sở hoặc quyền thao tác đã thay đổi. Vui lòng làm mới.'
const sameDestination = (booking, studentId, scheduleId, date) => booking.student_local_id === studentId
  && booking.destination_schedule_local_id === scheduleId && booking.destination_date === date

// Eligibility comes from A4. N3 reads only narrow those candidates against
// frozen source facts, active bookings and locally reserved source identities.
export async function pullAttendanceBoardMakeupSources({ supabase, centerId, studentId,
  scheduleSessionId, occurrenceDate, occurrence, draft, resolveDestination = false,
  isContextCurrent = () => true } = {}) {
  const [sources, target] = await Promise.all([
    pullA4EligibleMissedOccurrences({ supabase, centerId, studentId, makeupDate: occurrenceDate }),
    pullMakeupBookingContext({ supabase, centerId, fromDate: occurrenceDate, toDate: occurrenceDate }),
  ])
  if (!sources.ok || !target.ok) return {ok:false, error:sources.error || target.error}
  let destination = target.destinations.find(o => o.schedule_session_local_id === scheduleSessionId
    && o.occurrence_date === occurrenceDate)
  if (!destination && resolveDestination) {
    if (!isContextCurrent()) return {ok:false, error:contextError}
    // N3 requires a frozen destination. A2's existing public RESOLVE is
    // idempotent by occurrence identity and never enrolls the Student.
    // Materialize only on Save, keeping source selection read-only.
    let resolved
    try {
      resolved = await supabase.rpc('a2_manage_occurrence', {
        p_center_id:centerId, p_schedule_session_id:scheduleSessionId,
        p_occurrence_date:occurrenceDate, p_action:'RESOLVE',
      })
    } catch { return {ok:false, error:'Chưa xác nhận được buổi học bù. Hãy thử Lưu điểm danh lại.'} }
    if (!isContextCurrent()) return {ok:false, error:contextError}
    const fact = resolved.data?.occurrence
    if (resolved.error || resolved.data?.ok !== true || resolved.data.center_id !== centerId
      || fact?.center_id !== centerId || fact.schedule_session_local_id !== scheduleSessionId
      || fact.occurrence_date !== occurrenceDate) {
      return {ok:false, error:'Buổi học bù không còn hợp lệ hoặc bạn không có quyền thao tác.'}
    }
    if (fact.lifecycle_state === 'CANCELLED') return {ok:false, error:'Buổi học bù đã bị hủy.'}
    const fresh = await pullMakeupBookingContext({supabase, centerId, fromDate:occurrenceDate, toDate:occurrenceDate})
    if (!isContextCurrent()) return {ok:false, error:contextError}
    if (!fresh.ok) return fresh
    target.bookings = fresh.bookings
    destination = fresh.destinations.find(o => o.schedule_session_local_id === scheduleSessionId
      && o.occurrence_date === occurrenceDate)
  }
  // Monthly Board projects valid, not-yet-materialized Schedule slots. Roster
  // membership and N3's persisted destination snapshot are separate facts.
  const projected = !resolveDestination && occurrence?.materialized === false
    && occurrence.scheduleSessionId === scheduleSessionId && occurrence.date === occurrenceDate
    && ['PLANNED','HELD'].includes(occurrence.lifecycleState)
  if (!destination && !projected) return {ok:false, error:'Buổi học bù không còn hợp lệ. Hãy chọn buổi khác.'}
  const booking = target.bookings.find(b => sameDestination(b, studentId, scheduleSessionId, occurrenceDate))
  const dates = [...new Set(sources.candidates.map(c => c.occurrence_date))]
  const reads = await Promise.all(dates.map(date => pullMakeupBookingContext({
    supabase, centerId, fromDate:date, toDate:date,
  })))
  if (reads.some(r => !r.ok)) return {ok:false, error:'Chưa tải được lịch học bù. Vui lòng làm mới.'}
  const bookings = [...target.bookings, ...reads.flatMap(r => r.bookings)]
  const facts = reads.flatMap(r => r.destinations)
  const candidates = sources.candidates.filter(c => {
    if (!facts.some(o => o.lifecycle_state === 'HELD' && o.schedule_session_local_id === c.schedule_session_id
      && o.occurrence_date === c.occurrence_date)) return false
    if (bookings.some(b => b.source_attendance_local_id === c.attendance_local_id
      && (b.state !== 'PLANNED' || !sameDestination(b, studentId, scheduleSessionId, occurrenceDate)))) return false
    return !Object.values(draft?.changes || {}).some(change => change.studentId === studentId
      && (change.scheduleSessionId === c.schedule_session_id && change.occurrenceDate === c.occurrence_date
        || change.value.makeupTarget === c.attendance_local_id
          && (change.scheduleSessionId !== scheduleSessionId || change.occurrenceDate !== occurrenceDate)))
  }).map(c => ({...c, end_time:facts.find(o => o.schedule_session_local_id === c.schedule_session_id
    && o.occurrence_date === c.occurrence_date)?.planned_end_time}))
  const hasDraftAbsence = Object.values(draft?.changes || {}).some(c => c.studentId === studentId
    && c.value.status === 'absent')
  return {ok:true, candidates, booking, error:candidates.length ? '' : hasDraftAbsence ? SAVE_ABSENCE_FIRST : NO_MAKEUP_SOURCE}
}

export async function ensureAttendanceBoardMakeupBookings(draft, {supabase, centerId,
  isContextCurrent = () => true} = {}) {
  let prepared = false
  const contextValid = () => draft.centerId === centerId && isContextCurrent()
  for (const change of Object.values(draft.changes).filter(c => c.offRosterMakeup && c.value.status === 'makeup')) {
    if (!contextValid()) return {ok:false, bookingPrepared:prepared, error:contextError}
    const current = await pullAttendanceBoardMakeupSources({supabase, centerId, draft,
      studentId:change.studentId, scheduleSessionId:change.scheduleSessionId, occurrenceDate:change.occurrenceDate,
      resolveDestination:true, isContextCurrent:contextValid})
    if (!contextValid()) return {ok:false, bookingPrepared:prepared, error:contextError}
    if (!current.ok) return {...current, bookingPrepared:prepared}
    const exact = current.booking?.source_attendance_local_id === change.value.makeupTarget ? current.booking : null
    // A lost N2 response can have already completed this booking. Retry the
    // same captured N2 intent/key, rather than creating another booking.
    if (exact?.state === 'COMPLETED' && draft.uncertain && draft.attempt) {
      prepared = true; continue
    }
    if (!current.candidates.some(c => c.attendance_local_id === change.value.makeupTarget)) {
      return {ok:false, bookingPrepared:prepared, error:current.error || 'Buổi Vắng đã thay đổi. Vui lòng chọn lại.'}
    }
    if (exact?.state === 'PLANNED') {
      prepared = true
      if (draft.bookingAttempt?.command.sourceAttendanceLocalId === change.value.makeupTarget) draft.bookingAttempt = null
      continue
    }
    const command = {operation:'BOOK', studentId:change.studentId, sourceAttendanceLocalId:change.value.makeupTarget,
      destinationScheduleId:change.scheduleSessionId, destinationDate:change.occurrenceDate}
    if (draft.bookingAttempt && JSON.stringify(draft.bookingAttempt.command) !== JSON.stringify(command)) {
      return {ok:false, bookingPrepared:prepared, error:'Chưa xác nhận được lịch học bù trước đó. Vui lòng thử lưu lại.'}
    }
    draft.bookingAttempt ||= {boardMakeup:true, command, idempotencyKey:createOperationalCommandIdempotencyKey()}
    if (!contextValid()) return {ok:false, bookingPrepared:prepared, error:contextError}
    const result = await mutateMakeupBooking({supabase, centerId, ...draft.bookingAttempt})
    if (result.ok) {prepared = true; draft.bookingAttempt = null}
    else if (!result.uncertain) draft.bookingAttempt = null
    if (!contextValid()) return {ok:false, bookingPrepared:prepared, error:contextError}
    if (!result.ok) return {...result, bookingPrepared:prepared}
  }
  return {ok:true, bookingPrepared:prepared}
}
