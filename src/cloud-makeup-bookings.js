import { createOperationalCommandIdempotencyKey } from './cloud-authoritative-attendance-tuition.js'

export async function pullMakeupBookingContext({supabase, centerId, fromDate, toDate} = {}) {
  try {
    const {data, error} = await supabase.rpc('n3_list_makeup_booking_context', {
      p_center_id: centerId, p_from_date: fromDate, p_to_date: toDate,
    })
    if (error || data?.ok !== true || data.center_id !== centerId
      || !Array.isArray(data.bookings) || !Array.isArray(data.destinations)
      || data.bookings.some(b => b.center_id !== centerId || !['PLANNED','COMPLETED'].includes(b.state)
        || !b.id || !b.student_local_id || !b.source_attendance_local_id || !b.destination_schedule_local_id
        || !Number.isSafeInteger(Number(b.version)) || Number(b.version) < 1)
      || data.destinations.some(o => o.center_id !== centerId || o.lifecycle_state === 'CANCELLED')) {
      return {ok: false, error: 'Chưa tải được lịch học bù. Vui lòng làm mới.'}
    }
    return {ok: true, bookings: data.bookings, destinations: data.destinations}
  } catch { return {ok: false, error: 'Chưa tải được lịch học bù. Vui lòng làm mới.'} }
}

export async function mutateMakeupBooking({supabase, centerId, command,
  idempotencyKey = createOperationalCommandIdempotencyKey()} = {}) {
  try {
    const {data, error} = await supabase.rpc('n3_mutate_makeup_booking', {
      p_center_id: centerId, p_command: command, p_idempotency_key: idempotencyKey,
    })
    if (!error && data?.ok === true && data.center_id === centerId && data.outcome_code === 'COMMITTED'
      && data.results?.length === 1 && data.results[0].student_local_id === command.studentId
      && data.results[0].source_attendance_local_id === command.sourceAttendanceLocalId) return {...data, ok: true}
    const message = String(error?.message || '')
    const labels = {
      n3_booking_version_conflict: 'Lịch học bù vừa thay đổi. Vui lòng làm mới rồi chọn lại.',
      n3_booking_already_planned: 'Buổi vắng đã có lịch học bù. Vui lòng làm mới.',
      n3_booking_already_completed: 'Buổi vắng đã được học bù.',
      n3_booking_destination_already_marked: 'Học viên đã có điểm danh ở buổi này.',
      n3_booking_source_not_absent: 'Buổi vắng không còn phù hợp. Vui lòng làm mới.',
      n3_booking_destination_invalid: 'Buổi được chọn không còn phù hợp. Vui lòng làm mới.',
      n3_booking_access_denied: 'Bạn không có quyền xếp học bù tại cơ sở này.',
      n3_booking_source_ineligible: 'Chọn buổi học diễn ra sau buổi vắng gốc.',
      n3_booking_idempotency_conflict: 'Yêu cầu này đã được dùng. Vui lòng làm mới.',
    }
    const code = message.includes('n3_makeup_destination_student_active') ? 'n3_booking_destination_already_marked'
      : Object.keys(labels).find(key => message.includes(key))
    return {ok: false, uncertain: !code, error: labels[code] || 'Chưa xác nhận được lịch học bù. Bấm thử lại.'}
  } catch { return {ok: false, uncertain: true, error: 'Chưa xác nhận được lịch học bù. Bấm thử lại.'} }
}

export function currentClassMainTeacher(assignments = [], classId, now = new Date()) {
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'}).format(now)
  const current = assignments.filter(a => a.class_session_local_id === classId
    && a.effective_from <= today && (!a.effective_to || a.effective_to >= today))
  return current.length === 1 ? current[0].teacher_name || 'Chưa rõ' : 'Chưa rõ'
}
