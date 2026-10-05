
export const V23_ATTENDANCE_CONTRACT = 'v2.3-occurrence-v1'

export function getV23OccurrenceAttendanceRecords(records = [], occurrence = {}, studentId = '') {
  const scheduleSessionId = normalizeText(occurrence?.id || occurrence?.scheduleSessionId || occurrence?.sessionId)
  const occurrenceDate = normalizeText(occurrence?.occurrenceDate || occurrence?.date)
  const normalizedStudentId = normalizeText(studentId)
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.source !== 'initialBaseline'
      && normalizeText(record?.studentId) === normalizedStudentId
      && normalizeText(record?.date || record?.occurrenceDate) === occurrenceDate
      && normalizeText(record?.scheduleSessionId || record?.sessionId) === scheduleSessionId,
    )
    .sort(compareOccurrenceRecords)
}

export function selectCurrentV23OccurrenceAttendanceRecord(records = [], occurrence = {}, studentId = '') {
  const matches = getV23OccurrenceAttendanceRecords(records, occurrence, studentId)
  return matches.find((record) => record?.attendanceAuthority === V23_ATTENDANCE_CONTRACT)
    || matches[0]
    || null
}

export async function pullA4EligibleMissedOccurrences({ supabase, centerId, studentId, makeupDate } = {}) {
  if (!supabase?.rpc || !normalizeText(centerId) || !normalizeText(studentId)
    || !isDateKey(normalizeText(makeupDate))) {
    return { ok: false, error: 'Chưa thể tìm buổi Vắng gốc.' }
  }
  try {
    const { data, error } = await supabase.rpc('a4_list_eligible_missed_occurrences', {
      p_center_id: normalizeText(centerId),
      p_student_id: normalizeText(studentId),
      p_makeup_date: normalizeText(makeupDate),
    })
    if (error || data?.ok !== true || data.center_id !== normalizeText(centerId)
      || data.student_id !== normalizeText(studentId) || !Array.isArray(data.candidates)) {
      return { ok: false, error: 'Chưa thể tải các buổi Vắng có thể học bù.' }
    }
    return { ok: true, candidates: data.candidates }
  } catch {
    return { ok: false, error: 'Chưa thể tải các buổi Vắng có thể học bù.' }
  }
}

function compareOccurrenceRecords(a = {}, b = {}) {
  const aCanonical = a?.attendanceAuthority === V23_ATTENDANCE_CONTRACT ? 1 : 0
  const bCanonical = b?.attendanceAuthority === V23_ATTENDANCE_CONTRACT ? 1 : 0
  if (aCanonical !== bCanonical) return bCanonical - aCanonical
  const priority = { correction: 3, admin: 2, teacher: 1 }
  const sourceDelta = (priority[b?.source] || 0) - (priority[a?.source] || 0)
  if (sourceDelta) return sourceDelta
  const versionDelta = (Number(b?.cloudVersion) || 0) - (Number(a?.cloudVersion) || 0)
  if (versionDelta) return versionDelta
  return normalizeText(a?.id).localeCompare(normalizeText(b?.id))
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
