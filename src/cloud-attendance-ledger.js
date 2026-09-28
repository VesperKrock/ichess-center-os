import { attendanceOccurrenceKey, getCanonicalLedgerAttendance, normalizeAttendanceLedgerFilters } from './attendance-ledger.js'

const nextDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

// A3 already exposes the A2 facts and actual-teacher snapshots. These are stable
// read RPCs. Split longer ranges at the existing 63-day contract, never RESOLVE.
export async function pullCanonicalAttendanceLedgerContext({ supabase, centerId, filters, attendanceRecords = [] } = {}) {
  const range = normalizeAttendanceLedgerFilters(filters)
  if (!centerId || !supabase?.rpc || range.error) {
    return { ok: false, error: range.error || 'Chưa thể tải các buổi học.' }
  }
  const ranges = []
  for (let start = range.fromDate; start <= range.toDate; start = nextDate(start, 63)) {
    ranges.push([start, [nextDate(start, 62), range.toDate].sort()[0]])
  }
  const records = getCanonicalLedgerAttendance(attendanceRecords)
  const byLocalId = new Map(records.map(record => [record.authorityLocalId, record]))
  const targetDates = [...new Set(records.filter(record => record.attendanceStatus === 'makeup'
    && record.date >= range.fromDate && record.date <= range.toDate)
    .map(record => byLocalId.get(record.makeupForAttendanceLocalId)?.date)
    .filter(date => date && (date < range.fromDate || date > range.toDate)))].sort()
  // Merge nearby original absence dates into bounded read batches.
  for (let index = 0; index < targetDates.length;) {
    const start = targetDates[index++]
    let end = start
    while (index < targetDates.length && targetDates[index] <= nextDate(start, 62)) end = targetDates[index++]
    ranges.push([start, end])
  }
  const results = await Promise.allSettled(ranges.map(async ([fromDate, toDate]) => {
    const { data, error } = await supabase.rpc('a3_list_teacher_context', {
      p_center_id: centerId, p_from_date: fromDate, p_to_date: toDate,
    })
    if (error || data?.ok !== true || data.center_id !== centerId
      || !Array.isArray(data.occurrences) || !Array.isArray(data.assignments)) return { ok: false }
    return { ok: true, occurrences: data.occurrences, assignments: data.assignments }
  }))
  const occurrences = new Map()
  let assignments = []
  for (let index = 0; index < results.length; index++) {
    const result = results[index]
    if (result.status !== 'fulfilled' || !result.value.ok) {
      return { ok: false, error: 'Chưa tải được các buổi học. Vui lòng làm mới.' }
    }
    const context = result.value
    const [start, end] = ranges[index]
    if (context.occurrences.some(fact => fact.center_id !== centerId
      || !fact.schedule_session_local_id || fact.occurrence_date < start || fact.occurrence_date > end
      || !Array.isArray(fact.roster_student_ids) || !['PLANNED', 'HELD', 'CANCELLED'].includes(fact.lifecycle_state))) {
      return { ok: false, error: 'Dữ liệu buổi học chưa hợp lệ. Vui lòng làm mới.' }
    }
    for (const fact of context.occurrences) {
      occurrences.set(attendanceOccurrenceKey(fact.schedule_session_local_id, fact.occurrence_date), fact)
    }
    assignments = context.assignments
  }
  return { ok: true, centerId, fromDate: range.fromDate, toDate: range.toDate,
    assignments, occurrences: [...occurrences.values()] }
}
