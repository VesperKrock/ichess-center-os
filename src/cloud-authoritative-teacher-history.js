const text = (value) => String(value ?? '').trim()

export async function pullA3TeacherContext({ supabase, centerId, fromDate, toDate } = {}) {
  if (!supabase?.rpc || !text(centerId) || !text(fromDate) || !text(toDate)) {
    return { ok: false, error: 'Chưa thể tải lịch sử giáo viên.' }
  }
  const { data, error } = await supabase.rpc('a3_list_teacher_context', {
    p_center_id: centerId,
    p_from_date: fromDate,
    p_to_date: toDate,
  })
  if (error || data?.ok !== true || data.center_id !== centerId) {
    return { ok: false, error: error?.message || 'Chưa thể tải lịch sử giáo viên.' }
  }
  return {
    ok: true,
    centerId,
    fromDate,
    toDate,
    assignments: Array.isArray(data.assignments) ? data.assignments : [],
    occurrences: Array.isArray(data.occurrences) ? data.occurrences : [],
  }
}

export async function changeA3ClassTeacher({ supabase, centerId, classId, teacherId, effectiveFrom, idempotencyKey } = {}) {
  if (!supabase?.rpc || !text(centerId) || !text(classId) || !text(teacherId)
      || !text(effectiveFrom) || !text(idempotencyKey)) {
    return { ok: false, error: 'Chọn giáo viên và ngày áp dụng.' }
  }
  const { data, error } = await supabase.rpc('a3_change_class_teacher', {
    p_center_id: centerId,
    p_class_id: classId,
    p_teacher_id: teacherId,
    p_effective_from: effectiveFrom,
    p_idempotency_key: idempotencyKey,
  })
  return error || data?.ok !== true
    ? { ok: false, error: error?.message || 'Chưa lưu được giáo viên của lớp.' }
    : { ok: true, data }
}

export async function setA3OccurrenceTeacher({ supabase, centerId, scheduleId, occurrenceDate, teacherId, action, idempotencyKey } = {}) {
  if (!supabase?.rpc || !text(centerId) || !text(scheduleId) || !text(occurrenceDate)
      || !text(idempotencyKey) || !['SET', 'CLEAR'].includes(action)
      || (action === 'SET' && !text(teacherId))) {
    return { ok: false, error: 'Chọn giáo viên cho buổi học.' }
  }
  const { data, error } = await supabase.rpc('a3_set_occurrence_actual_teacher', {
    p_center_id: centerId,
    p_schedule_session_id: scheduleId,
    p_occurrence_date: occurrenceDate,
    p_action: action,
    p_teacher_id: action === 'SET' ? teacherId : null,
    p_idempotency_key: idempotencyKey,
  })
  return error || data?.ok !== true
    ? { ok: false, error: error?.message || 'Chưa lưu được giáo viên buổi này.' }
    : { ok: true, data }
}

export function resolveA3TeacherForDate(assignments = [], classId = '', date = '') {
  return assignments.find((item) => item.class_session_local_id === classId
    && item.effective_from <= date
    && (!item.effective_to || item.effective_to >= date)) || null
}

export function projectA3ScheduleSessions(sessions = [], context = {}, sources = {}) {
  const assignments = Array.isArray(context.assignments) ? context.assignments : []
  const occurrences = Array.isArray(context.occurrences) ? context.occurrences : []
  const facts = new Map(occurrences.map((item) => [
    `${item.schedule_session_local_id}|${item.occurrence_date}`, item,
  ]))
  const projected = sessions.map((session) => {
    const date = text(session.occurrenceDate || session.date)
    const fact = facts.get(`${session.id}|${date}`)
    if (fact) {
      return {
        ...session,
        classSessionId: fact.class_session_local_id || null,
        studentIds: fact.roster_student_ids || [],
        startTime: fact.planned_start_time?.slice(0, 5) || '',
        endTime: fact.planned_end_time?.slice(0, 5) || '',
        room: fact.room || '',
        a2LifecycleState: fact.lifecycle_state,
        teacherId: fact.actual_teacher_override ? fact.actual_teacher_id : fact.planned_teacher_id,
        teacherName: fact.actual_teacher_override ? fact.actual_teacher_name : fact.planned_teacher_name,
        a3OccurrenceMaterialized: true,
        a3ActualTeacherOverride: fact.actual_teacher_override === true,
      }
    }
    if (session.scheduleType !== 'recurring' || !session.classSessionId) return session
    const assignment = resolveA3TeacherForDate(assignments, session.classSessionId, date)
    return {
      ...session,
      teacherId: assignment?.teacher_id || null,
      teacherName: assignment?.teacher_name || '',
    }
  })
  const known = new Set(projected.map((item) => `${item.id}|${item.occurrenceDate}`))
  for (const fact of occurrences) {
    const key = `${fact.schedule_session_local_id}|${fact.occurrence_date}`
    if (known.has(key)) continue
    const schedule = (sources.scheduleSessions || []).find((item) => item.id === fact.schedule_session_local_id)
    const classSession = (sources.classSessions || []).find((item) => item.id === fact.class_session_local_id)
    projected.push({
      ...schedule,
      id: fact.schedule_session_local_id,
      assignmentId: fact.schedule_session_local_id,
      classSessionId: fact.class_session_local_id,
      scheduleType: fact.schedule_type === 'oneoff' ? 'oneOff' : 'recurring',
      occurrenceDate: fact.occurrence_date,
      startTime: fact.planned_start_time?.slice(0, 5) || '',
      endTime: fact.planned_end_time?.slice(0, 5) || '',
      room: fact.room || '',
      studentIds: fact.roster_student_ids || [],
      title: schedule?.title || classSession?.displayLabel || 'Buổi học',
      status: fact.lifecycle_state === 'CANCELLED' ? 'cancelled' : 'done',
      a2LifecycleState: fact.lifecycle_state,
      teacherId: fact.actual_teacher_override ? fact.actual_teacher_id : fact.planned_teacher_id,
      teacherName: fact.actual_teacher_override ? fact.actual_teacher_name : fact.planned_teacher_name,
      a3OccurrenceMaterialized: true,
      a3ActualTeacherOverride: fact.actual_teacher_override === true,
    })
    known.add(key)
  }
  return projected
}
