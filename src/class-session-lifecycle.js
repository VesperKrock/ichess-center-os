export function getClassSessionDependencyState({
  classSessionId,
  students = [],
  enrollmentSets = [],
  scheduleSessions = [],
  attendanceRecords = [],
  sessionReports = [],
} = {}) {
  const targetId = cleanText(classSessionId)
  if (!targetId) {
    return blockedState('Không xác định được ca học cần xóa.')
  }

  const studentIds = new Set()
  for (const student of array(students)) {
    const hasLegacyAssignment = array(student?.classSessionIds).some((id) => cleanText(id) === targetId)
    const hasRecurringAssignment = array(student?.recurringEnrollments)
      .some((entry) => cleanText(entry?.classSessionId || entry?.class_session_id) === targetId)
    if (hasLegacyAssignment || hasRecurringAssignment) {
      studentIds.add(cleanText(student?.id) || `student-${studentIds.size + 1}`)
    }
  }
  for (const set of array(enrollmentSets)) {
    const assigned = array(set?.enrollments)
      .some((entry) => cleanText(entry?.classSessionId || entry?.class_session_id) === targetId)
    if (assigned) studentIds.add(cleanText(set?.studentId || set?.student_id) || `enrollment-${studentIds.size + 1}`)
  }

  const matchingScheduleSessions = array(scheduleSessions).filter((session) => (
    cleanText(session?.classSessionId) === targetId
  ))
  const scheduleIds = new Set(
    matchingScheduleSessions
      .flatMap((session) => [session?.id, session?.sessionId])
      .map(cleanText)
      .filter(Boolean),
  )
  const referencesClass = (item) => {
    if (!item) return false
    if (cleanText(item.classSessionId) === targetId) return true
    return [item.scheduleSessionId, item.sessionId]
      .map(cleanText)
      .some((id) => id && scheduleIds.has(id))
  }
  const matchingAttendanceRecords = array(attendanceRecords).filter(referencesClass)
  const matchingSessionReports = array(sessionReports).filter(referencesClass)
  const counts = {
    studentAssignments: studentIds.size,
    scheduleSessions: uniqueCount(matchingScheduleSessions),
    attendanceRecords: uniqueCount(matchingAttendanceRecords),
    sessionReports: uniqueCount(matchingSessionReports),
  }
  const totalReferences = Object.values(counts).reduce((total, count) => total + count, 0)

  if (!totalReferences) {
    return {
      ok: true,
      canDelete: true,
      referenced: false,
      totalReferences: 0,
      counts,
      reason: '',
      message: 'Ca học chưa được sử dụng và có thể xóa vĩnh viễn.',
    }
  }

  const detail = [
    counts.studentAssignments ? `${counts.studentAssignments} học viên` : '',
    counts.scheduleSessions ? `${counts.scheduleSessions} lịch học` : '',
    counts.attendanceRecords ? `${counts.attendanceRecords} bản ghi điểm danh` : '',
    counts.sessionReports ? `${counts.sessionReports} báo cáo buổi học` : '',
  ].filter(Boolean).join(', ')

  return {
    ok: true,
    canDelete: false,
    referenced: true,
    totalReferences,
    counts,
    reason: 'CLASS_SESSION_REFERENCED',
    message: `Không thể xóa vĩnh viễn vì ca học có dữ liệu liên quan: ${detail}. Hãy dùng “Ngưng dùng” để giữ lịch sử.`,
  }
}

export async function inspectAuthoritativeClassSessionDependencies({
  supabase,
  centerId,
  classSessionId,
  enrollmentSets = [],
} = {}) {
  const normalizedCenterId = cleanText(centerId)
  const targetId = cleanText(classSessionId)
  if (!supabase || typeof supabase.from !== 'function') {
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error: 'Thiếu Supabase client.' }
  }
  if (!normalizedCenterId || !targetId) {
    return { ok: false, outcome_code: 'INVALID_TARGET', error: 'Thiếu center_id hoặc Class Session id.' }
  }

  const entityTypes = ['student', 'schedule_session', 'attendance_record', 'session_report']
  const { data, error } = await supabase
    .from('center_cloud_entities')
    .select('center_id,entity_type,local_id,payload,entity_version,deleted_at')
    .eq('center_id', normalizedCenterId)
    .in('entity_type', entityTypes)

  if (error) {
    return {
      ok: false,
      outcome_code: 'DEPENDENCY_READ_FAILED',
      error: String(error?.message || error),
      detail: error,
    }
  }
  if (!Array.isArray(data) || data.some((record) => (
    cleanText(record?.center_id) !== normalizedCenterId
    || !entityTypes.includes(record?.entity_type)
    || !record?.payload
    || typeof record.payload !== 'object'
    || Array.isArray(record.payload)
  ))) {
    return {
      ok: false,
      outcome_code: 'INVALID_SERVER_RESULT',
      error: 'Snapshot phụ thuộc Class Session không hợp lệ.',
    }
  }

  const projected = (entityType) => data
    .filter((record) => record.entity_type === entityType)
    .map((record) => ({
      ...record.payload,
      id: cleanText(record.payload.id) || cleanText(record.local_id),
      cloudVersion: Number(record.entity_version) || 0,
      isDeleted: Boolean(record.deleted_at),
    }))
  const dependencies = {
    students: projected('student'),
    enrollmentSets: array(enrollmentSets),
    scheduleSessions: projected('schedule_session'),
    attendanceRecords: projected('attendance_record'),
    sessionReports: projected('session_report'),
  }

  return {
    ok: true,
    centerId: normalizedCenterId,
    classSessionId: targetId,
    dependencies,
    dependencyState: getClassSessionDependencyState({
      classSessionId: targetId,
      ...dependencies,
    }),
  }
}

export function getClassSessionDeletePolicyMap(classSessions = [], dependencies = {}) {
  return Object.fromEntries(
    array(classSessions)
      .map((classSession) => cleanText(classSession?.id))
      .filter(Boolean)
      .map((classSessionId) => [
        classSessionId,
        getClassSessionDependencyState({ ...dependencies, classSessionId }),
      ]),
  )
}

function blockedState(message) {
  return {
    ok: false,
    canDelete: false,
    referenced: false,
    totalReferences: 0,
    counts: {
      studentAssignments: 0,
      scheduleSessions: 0,
      attendanceRecords: 0,
      sessionReports: 0,
    },
    reason: 'DEPENDENCY_CHECK_FAILED',
    message,
  }
}

function uniqueCount(items) {
  return new Set(items.map((item, index) => cleanText(item?.id) || cleanText(item?.localId) || `item-${index}`)).size
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function cleanText(value) {
  return String(value ?? '').trim()
}
