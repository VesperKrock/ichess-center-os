const WEEKDAYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
const WEEKDAY_SET = new Set(WEEKDAYS)
const ACTIVE_STUDENT_STATUS = 'đang theo học'

export const V22_WEEKDAY_LABELS = Object.freeze({
  mon: 'T2',
  tue: 'T3',
  wed: 'T4',
  thu: 'T5',
  fri: 'T6',
  sat: 'T7',
  sun: 'CN',
})

export function normalizeV22Weekday(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ({
    mon: 'mon', monday: 'mon', t2: 'mon',
    tue: 'tue', tuesday: 'tue', t3: 'tue',
    wed: 'wed', wednesday: 'wed', t4: 'wed',
    thu: 'thu', thursday: 'thu', t5: 'thu',
    fri: 'fri', friday: 'fri', t6: 'fri',
    sat: 'sat', saturday: 'sat', t7: 'sat',
    sun: 'sun', sunday: 'sun', cn: 'sun',
  })[normalized] || ''
}

export function getV22ClassSessionWeekdays(classSession = {}) {
  const explicit = Array.isArray(classSession.daysOfWeek) ? classSession.daysOfWeek : []
  const fromLabel = String(classSession.daysLabel || classSession.dayLabel || '')
    .split(/[^\p{L}\p{N}]+/u)
  return normalizeWeekdays(explicit.length ? explicit : fromLabel)
}

export function normalizeV22Enrollments(enrollments = []) {
  if (!Array.isArray(enrollments)) return []
  const byClass = new Map()
  enrollments.forEach((entry) => {
    const classSessionId = String(entry?.classSessionId || entry?.class_session_id || '').trim()
    if (!classSessionId) return
    const weekdays = normalizeWeekdays(entry?.weekdays)
    const current = byClass.get(classSessionId)
    if (!current) {
      byClass.set(classSessionId, {
        classSessionId,
        weekdays,
        legacyReviewRequired: entry?.legacyReviewRequired === true,
      })
      return
    }
    current.weekdays = normalizeWeekdays([...current.weekdays, ...weekdays])
    current.legacyReviewRequired ||= entry?.legacyReviewRequired === true
  })
  return [...byClass.values()].sort((a, b) => a.classSessionId.localeCompare(b.classSessionId))
}

export function classifyLegacyStudentEnrollments(student = {}, classSessions = []) {
  const classLookup = new Map(
    (Array.isArray(classSessions) ? classSessions : [])
      .filter((item) => item?.id)
      .map((item) => [String(item.id), item]),
  )
  const legacyIds = Array.isArray(student?.classSessionIds)
    ? [...new Set(student.classSessionIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    : []
  const enrollments = []
  const review = []

  legacyIds.forEach((classSessionId) => {
    const classSession = classLookup.get(classSessionId)
    if (!classSession) {
      review.push({ classSessionId, status: 'missing-class' })
      enrollments.push({ classSessionId, weekdays: [], legacyReviewRequired: true })
      return
    }
    const weekdays = getV22ClassSessionWeekdays(classSession)
    if (weekdays.length === 1) {
      enrollments.push({ classSessionId, weekdays, legacyReviewRequired: false })
      review.push({ classSessionId, status: 'deterministic-single-day', weekdays })
      return
    }
    enrollments.push({ classSessionId, weekdays: [], legacyReviewRequired: true })
    review.push({ classSessionId, status: 'review-required', availableWeekdays: weekdays })
  })

  return {
    status: legacyIds.length ? (review.some((item) => item.status !== 'deterministic-single-day') ? 'review-required' : 'deterministic') : 'empty',
    enrollments,
    review,
  }
}

export function projectStudentsWithV22Enrollments(
  students = [],
  enrollmentSets = [],
  classSessions = [],
  capabilityReady = false,
) {
  if (!capabilityReady) return Array.isArray(students) ? students : []
  const byStudent = new Map(
    (Array.isArray(enrollmentSets) ? enrollmentSets : [])
      .filter((set) => set?.studentId)
      .map((set) => [String(set.studentId), set]),
  )
  return (Array.isArray(students) ? students : []).map((student) => {
    const authoritativeSet = byStudent.get(String(student?.id || ''))
    const legacy = authoritativeSet ? null : classifyLegacyStudentEnrollments(student, classSessions)
    const recurringEnrollments = normalizeV22Enrollments(
      authoritativeSet?.enrollments || legacy?.enrollments || [],
    )
    return {
      ...student,
      classSessionIds: recurringEnrollments.map((entry) => entry.classSessionId),
      recurringEnrollments,
      enrollmentVersion: Number(authoritativeSet?.version) || 0,
      enrollmentAuthority: authoritativeSet ? 'authoritative' : 'legacy-review',
      enrollmentReview: legacy?.review || [],
      useAuthoritativeEnrollment: true,
    }
  })
}

export function reconcileV22StudentFormValues({
  values = {},
  rawStudent = null,
  projectedStudent = null,
  classSessions = [],
} = {}) {
  const currentLegacyIds = normalizeIds(values.classSessionIds)
  const loadedLegacyIds = normalizeIds(rawStudent?.classSessionIds)
  const hasPendingLegacySelection = currentLegacyIds.join('\u0000') !== loadedLegacyIds.join('\u0000')
  const legacy = !projectedStudent || hasPendingLegacySelection
    ? classifyLegacyStudentEnrollments(values, classSessions)
    : null
  const recurringEnrollments = legacy?.enrollments || projectedStudent?.recurringEnrollments || []

  return {
    ...values,
    classSessionIds: legacy ? values.classSessionIds || [] : projectedStudent?.classSessionIds || [],
    recurringEnrollments: normalizeV22Enrollments(recurringEnrollments),
    enrollmentVersion: Number(projectedStudent?.enrollmentVersion) || 0,
    useAuthoritativeEnrollment: true,
  }
}

export function validateV22EnrollmentSelection(enrollments = [], classSessions = []) {
  const errors = []
  const classLookup = new Map(
    (Array.isArray(classSessions) ? classSessions : [])
      .filter((item) => item?.id)
      .map((item) => [String(item.id), item]),
  )
  const normalized = normalizeV22Enrollments(enrollments)
  normalized.forEach((entry) => {
    const classSession = classLookup.get(entry.classSessionId)
    if (!classSession) {
      errors.push({ classSessionId: entry.classSessionId, code: 'CLASS_SESSION_NOT_FOUND' })
      return
    }
    const available = new Set(getV22ClassSessionWeekdays(classSession))
    if (!entry.weekdays.length) {
      errors.push({ classSessionId: entry.classSessionId, code: 'WEEKDAY_REQUIRED' })
      return
    }
    if (entry.weekdays.some((day) => !available.has(day))) {
      errors.push({ classSessionId: entry.classSessionId, code: 'WEEKDAY_NOT_IN_CLASS' })
    }
  })
  return { ok: errors.length === 0, enrollments: normalized, errors }
}

export function reconcileV22EnrollmentDayInput({
  currentEnrollments = [],
  checkedEnrollments = [],
  changedClassSessionId = '',
} = {}) {
  const changedId = String(changedClassSessionId || '').trim()
  const checked = normalizeV22Enrollments(checkedEnrollments)
  const checkedIds = new Set(checked.map((entry) => entry.classSessionId))
  const untouchedLegacyReview = normalizeV22Enrollments(currentEnrollments)
    .filter((entry) => entry.legacyReviewRequired && !entry.weekdays.length)
    .filter((entry) => entry.classSessionId !== changedId && !checkedIds.has(entry.classSessionId))

  return normalizeV22Enrollments([...checked, ...untouchedLegacyReview])
}

export function deriveV22ScheduleRosters({
  sessions = [],
  students = [],
  enrollmentSets = [],
  capabilityReady = false,
} = {}) {
  if (!capabilityReady) return Array.isArray(sessions) ? sessions : []
  const authoritativeStudentIds = new Set(
    (Array.isArray(enrollmentSets) ? enrollmentSets : [])
      .map((set) => String(set?.studentId || '').trim())
      .filter(Boolean),
  )
  const activeStudentIds = new Set(
    (Array.isArray(students) ? students : [])
      .filter((student) => !student?.isDeleted && normalizeText(student?.currentStatus) === ACTIVE_STUDENT_STATUS)
      .map((student) => String(student.id)),
  )
  const authoritativeRosterByClassDay = new Map()
  ;(Array.isArray(enrollmentSets) ? enrollmentSets : []).forEach((set) => {
    const studentId = String(set?.studentId || '').trim()
    if (!activeStudentIds.has(studentId)) return
    normalizeV22Enrollments(set.enrollments).forEach((entry) => {
      entry.weekdays.forEach((weekday) => {
        const key = `${entry.classSessionId}\u0000${weekday}`
        const roster = authoritativeRosterByClassDay.get(key) || []
        roster.push(studentId)
        authoritativeRosterByClassDay.set(key, roster)
      })
    })
  })

  const deterministicLegacyRosterByClassDay = new Map()
  const unresolvedLegacyClassIds = new Set()
  ;(Array.isArray(students) ? students : []).forEach((student) => {
    const studentId = String(student?.id || '').trim()
    if (!activeStudentIds.has(studentId) || authoritativeStudentIds.has(studentId)) return
    normalizeV22Enrollments(student?.recurringEnrollments).forEach((entry) => {
      if (entry.legacyReviewRequired || !entry.weekdays.length) {
        unresolvedLegacyClassIds.add(entry.classSessionId)
        return
      }
      entry.weekdays.forEach((weekday) => {
        const key = `${entry.classSessionId}\u0000${weekday}`
        const roster = deterministicLegacyRosterByClassDay.get(key) || []
        roster.push(studentId)
        deterministicLegacyRosterByClassDay.set(key, roster)
      })
    })
  })

  return (Array.isArray(sessions) ? sessions : []).map((session) => {
    if (String(session?.scheduleType || '').toLowerCase() === 'oneoff') return session
    const existingStudentIds = [...new Set(
      (Array.isArray(session?.studentIds) ? session.studentIds : [])
        .map((studentId) => String(studentId ?? '').trim())
        .filter(Boolean),
    )]
    const classSessionId = String(session?.classSessionId || '').trim()
    const weekday = normalizeV22Weekday(session?.dayOfWeek)
    if (!classSessionId || !weekday) {
      return {
        ...session,
        studentIds: existingStudentIds,
        rosterSource: 'v2.2-legacy-continuity',
        rosterReviewRequired: true,
      }
    }
    const key = `${classSessionId}\u0000${weekday}`
    const authoritativeStudentIdsForOccurrence = authoritativeRosterByClassDay.get(key) || []
    const deterministicLegacyStudentIds = deterministicLegacyRosterByClassDay.get(key) || []
    const deterministicLegacyStudentIdSet = new Set(deterministicLegacyStudentIds)
    const retainedExistingStudentIds = existingStudentIds
      .filter((studentId) => !authoritativeStudentIds.has(studentId))
    const unresolvedExistingStudentIds = retainedExistingStudentIds
      .filter((studentId) => !deterministicLegacyStudentIdSet.has(studentId))
    const hasLegacyContinuity = retainedExistingStudentIds.length > 0
      || deterministicLegacyStudentIds.length > 0
    const hasAuthoritativeContribution = authoritativeStudentIdsForOccurrence.length > 0
      || existingStudentIds.some((studentId) => authoritativeStudentIds.has(studentId))
    const rosterReviewRequired = unresolvedExistingStudentIds.length > 0
      || unresolvedLegacyClassIds.has(classSessionId)
    return {
      ...session,
      studentIds: [...new Set([
        ...authoritativeStudentIdsForOccurrence,
        ...retainedExistingStudentIds,
        ...deterministicLegacyStudentIds,
      ])].sort(),
      rosterSource: hasLegacyContinuity
        ? hasAuthoritativeContribution
          ? 'v2.2-mixed-cutover'
          : 'v2.2-legacy-continuity'
        : 'v2.2-authoritative-enrollment',
      rosterReviewRequired,
    }
  })
}

function normalizeWeekdays(values = []) {
  const list = Array.isArray(values) ? values : []
  return [...new Set(list.map(normalizeV22Weekday).filter((day) => WEEKDAY_SET.has(day)))]
    .sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
}

function normalizeIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))].sort()
}

function normalizeText(value) {
  return String(value ?? '').trim().toLocaleLowerCase('vi')
}
