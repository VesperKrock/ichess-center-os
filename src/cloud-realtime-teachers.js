import { CLOUD_ENTITY_TYPES } from './cloud-db-entities.js'
import { upsertCloudEntities } from './cloud-db-sync.js'
import {
  NEEDS_MEMBERSHIP_SQL_PATCH,
  buildOnlineAccessState,
  canReadModule,
  canWriteEntity,
  getOnlineAccessMessage,
} from './online-access-control.js'

export const TEACHER_REALTIME_ENTITY_TYPE = CLOUD_ENTITY_TYPES.TEACHER
export const NEEDS_SUPABASE_REALTIME_PATCH = 'NEEDS SUPABASE REALTIME PATCH'

const TEACHER_MODULE_ID = 'giao-vien'
const VALID_TEACHER_STATUSES = Object.freeze(['active', 'paused', 'inactive'])
const VALID_TEACHER_TYPES = Object.freeze(['fulltime', 'parttime', 'collaborator'])

export async function upsertTeacherCloudEntity({
  supabase,
  centerId,
  teacher,
  userId = null,
  accessState,
} = {}) {
  const normalizedAccessState = buildOnlineAccessState(accessState)

  if (!canWriteEntity(normalizedAccessState, TEACHER_REALTIME_ENTITY_TYPE)) {
    return {
      ok: false,
      skipped: true,
      error: getOnlineAccessMessage(normalizedAccessState),
      detail: {
        category: 'teacher-cloud-write-read-only',
        reason: normalizedAccessState.reason,
        role: normalizedAccessState.role,
        needsMembershipPatch: normalizedAccessState.needsMembershipPatch,
      },
    }
  }

  const normalizedTeacher = normalizeRealtimeTeacherPayload(teacher)

  if (!normalizedTeacher.ok) {
    return normalizedTeacher
  }

  return upsertCloudEntities({
    supabase,
    centerId,
    entityType: TEACHER_REALTIME_ENTITY_TYPE,
    items: [normalizedTeacher.teacher],
    userId,
  })
}

export function subscribeToTeacherCloudRealtime({
  supabase,
  centerId,
  accessState,
  onTeacherRecord,
  onStatusChange,
} = {}) {
  const normalizedAccessState = buildOnlineAccessState(accessState)

  if (!canReadModule(normalizedAccessState, TEACHER_MODULE_ID)) {
    return createRealtimeUnavailableResult(
      normalizedAccessState.needsMembershipPatch
        ? NEEDS_MEMBERSHIP_SQL_PATCH
        : getOnlineAccessMessage(normalizedAccessState),
      normalizedAccessState.needsMembershipPatch,
      false,
    )
  }

  if (!supabase || typeof supabase.channel !== 'function') {
    return createRealtimeUnavailableResult(
      `${NEEDS_SUPABASE_REALTIME_PATCH}: Supabase Realtime client is not available.`,
      false,
      true,
    )
  }

  const normalizedCenterId = String(centerId ?? '').trim()

  if (!normalizedCenterId) {
    return createRealtimeUnavailableResult('Thieu centerId nen khong subscribe realtime.', false, false)
  }

  const channel = supabase.channel(`ichess-center-teachers:${normalizedCenterId}`)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'center_cloud_entities',
      filter: `center_id=eq.${normalizedCenterId}`,
    },
    (event) => {
      const record = getTeacherRealtimeRecord(event)

      if (!record) {
        return
      }

      onTeacherRecord?.(record, event)
    },
  )

  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      onStatusChange?.({
        ok: false,
        status,
        needsRealtimePatch: true,
        message: NEEDS_SUPABASE_REALTIME_PATCH,
      })
      return
    }

    onStatusChange?.({
      ok: status === 'SUBSCRIBED',
      status,
      needsRealtimePatch: false,
      message: status === 'SUBSCRIBED' ? 'Online Giao vien da ket noi.' : '',
    })
  })

  return {
    ok: true,
    channel,
    centerId: normalizedCenterId,
    cleanup: () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel)
        return
      }

      channel.unsubscribe?.()
    },
  }
}

export function getTeacherRealtimeRecord(event = {}) {
  const record = event.new || event.record || null
  const oldRecord = event.old || null
  const candidate = record || oldRecord

  if (!candidate || candidate.entity_type !== TEACHER_REALTIME_ENTITY_TYPE) {
    return null
  }

  if (record?.deleted_at || event.eventType === 'DELETE') {
    return null
  }

  const payload = record.payload

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  return record
}

export function mergeRealtimeTeacherIntoList(teachers = [], record = {}) {
  const normalizedTeacher = normalizeRealtimeTeacherPayload(record.payload)

  if (!normalizedTeacher.ok) {
    return {
      ok: false,
      changed: false,
      teachers,
      error: normalizedTeacher.error,
    }
  }

  const incomingTeacher = normalizedTeacher.teacher
  const incomingUpdatedAt = getTimestamp(incomingTeacher.updatedAt)
  let changed = false
  let found = false
  const nextTeachers = (Array.isArray(teachers) ? teachers : []).map((teacher) => {
    if (String(teacher?.id ?? '') !== incomingTeacher.id) {
      return teacher
    }

    found = true
    const currentUpdatedAt = getTimestamp(teacher.updatedAt)

    if (currentUpdatedAt && incomingUpdatedAt && incomingUpdatedAt < currentUpdatedAt) {
      return teacher
    }

    const mergedTeacher = { ...teacher, ...incomingTeacher }
    changed = JSON.stringify(teacher) !== JSON.stringify(mergedTeacher)
    return mergedTeacher
  })

  if (!found) {
    changed = true
    nextTeachers.unshift(incomingTeacher)
  }

  return {
    ok: true,
    changed,
    teachers: nextTeachers,
    teacher: incomingTeacher,
  }
}

export function normalizeRealtimeTeacherPayload(teacher) {
  if (!teacher || typeof teacher !== 'object' || Array.isArray(teacher)) {
    return { ok: false, error: 'Payload teacher khong hop le.' }
  }

  const id = String(teacher.id ?? teacher.localId ?? '').trim()

  if (!id) {
    return { ok: false, error: 'Thieu teacher id.' }
  }

  return {
    ok: true,
    teacher: {
      ...teacher,
      id,
      status: normalizeAllowedValue(teacher.status, VALID_TEACHER_STATUSES, 'active'),
      teacherType: normalizeAllowedValue(teacher.teacherType, VALID_TEACHER_TYPES, 'fulltime'),
      specialties: normalizeStringArray(teacher.specialties),
      levels: normalizeStringArray(teacher.levels),
      teachingGroups: normalizeStringArray(teacher.teachingGroups),
      teachingModes: normalizeStringArray(teacher.teachingModes),
      strengths: normalizeStringArray(teacher.strengths),
      internalTags: normalizeStringArray(teacher.internalTags),
      assignedClassNames: normalizeStringArray(teacher.assignedClassNames),
      assignedStudentIds: normalizeStringArray(teacher.assignedStudentIds),
      availableDays: normalizeStringArray(teacher.availableDays),
      preferredTimeSlots: normalizeStringArray(teacher.preferredTimeSlots),
      availableClassSessionIds: normalizeStringArray(teacher.availableClassSessionIds),
      maxSessionsPerWeek: normalizeNullablePositiveNumber(teacher.maxSessionsPerWeek),
      currentStudentCount: Math.max(0, normalizeNumber(teacher.currentStudentCount)),
      canTakeNewClass: teacher.canTakeNewClass !== false,
      updatedAt: teacher.updatedAt || new Date().toISOString(),
    },
  }
}

function createRealtimeUnavailableResult(message, needsMembershipPatch, needsRealtimePatch) {
  return {
    ok: false,
    message,
    needsMembershipPatch,
    needsRealtimePatch,
    cleanup: () => {},
  }
}

function normalizeAllowedValue(value, allowedValues, fallback) {
  const normalizedValue = String(value ?? '').trim()
  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback
}

function normalizeStringArray(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item ?? '').trim())
        .filter(Boolean),
    ),
  )
}

function normalizeNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizeNullablePositiveNumber(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null
}

function getTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}
