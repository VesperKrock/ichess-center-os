import { CLOUD_ENTITY_TYPES } from './cloud-db-entities.js'
import { upsertCloudEntities } from './cloud-db-sync.js'
import {
  NEEDS_MEMBERSHIP_SQL_PATCH,
  buildOnlineAccessState,
  canReadModule,
  canWriteEntity,
  getOnlineAccessMessage,
} from './online-access-control.js'

export const STUDENT_REALTIME_ENTITY_TYPE = CLOUD_ENTITY_TYPES.STUDENT
export const NEEDS_SUPABASE_REALTIME_PATCH = 'NEEDS SUPABASE REALTIME PATCH'

const STUDENT_MODULE_ID = 'hoc-vien'

export async function upsertStudentCloudEntity({
  supabase,
  centerId,
  student,
  userId = null,
  accessState,
} = {}) {
  const normalizedAccessState = buildOnlineAccessState(accessState)

  if (!canWriteEntity(normalizedAccessState, STUDENT_REALTIME_ENTITY_TYPE)) {
    return {
      ok: false,
      skipped: true,
      error: getOnlineAccessMessage(normalizedAccessState),
      detail: {
        category: 'student-cloud-write-read-only',
        reason: normalizedAccessState.reason,
        role: normalizedAccessState.role,
        needsMembershipPatch: normalizedAccessState.needsMembershipPatch,
      },
    }
  }

  const normalizedStudent = normalizeRealtimeStudentPayload(student)

  if (!normalizedStudent.ok) {
    return normalizedStudent
  }

  return upsertCloudEntities({
    supabase,
    centerId,
    entityType: STUDENT_REALTIME_ENTITY_TYPE,
    items: [normalizedStudent.student],
    userId,
  })
}

export function subscribeToStudentCloudRealtime({
  supabase,
  centerId,
  accessState,
  onStudentRecord,
  onStatusChange,
} = {}) {
  const normalizedAccessState = buildOnlineAccessState(accessState)

  if (!canReadModule(normalizedAccessState, STUDENT_MODULE_ID)) {
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

  const channel = supabase.channel(`ichess-center-students:${normalizedCenterId}`)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'center_cloud_entities',
      filter: `center_id=eq.${normalizedCenterId}`,
    },
    (event) => {
      const record = getStudentRealtimeRecord(event)

      if (!record) {
        return
      }

      onStudentRecord?.(record, event)
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
      message: status === 'SUBSCRIBED' ? 'Online Hoc vien da ket noi.' : '',
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

export function getStudentRealtimeRecord(event = {}) {
  const record = event.new || event.record || null
  const oldRecord = event.old || null
  const candidate = record || oldRecord

  if (!candidate || candidate.entity_type !== STUDENT_REALTIME_ENTITY_TYPE) {
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

export function mergeRealtimeStudentIntoList(students = [], record = {}) {
  const normalizedStudent = normalizeRealtimeStudentPayload(record.payload)

  if (!normalizedStudent.ok) {
    return {
      ok: false,
      changed: false,
      students,
      error: normalizedStudent.error,
    }
  }

  const incomingStudent = normalizedStudent.student
  const incomingUpdatedAt = getTimestamp(incomingStudent.updatedAt)
  let changed = false
  let found = false
  const nextStudents = (Array.isArray(students) ? students : []).map((student) => {
    if (String(student?.id ?? '') !== incomingStudent.id) {
      return student
    }

    found = true
    const currentUpdatedAt = getTimestamp(student.updatedAt)

    if (currentUpdatedAt && incomingUpdatedAt && incomingUpdatedAt < currentUpdatedAt) {
      return student
    }

    changed = JSON.stringify(student) !== JSON.stringify({ ...student, ...incomingStudent })
    return { ...student, ...incomingStudent }
  })

  if (!found) {
    changed = true
    nextStudents.unshift(incomingStudent)
  }

  return {
    ok: true,
    changed,
    students: nextStudents,
    student: incomingStudent,
  }
}

export function normalizeRealtimeStudentPayload(student) {
  if (!student || typeof student !== 'object' || Array.isArray(student)) {
    return { ok: false, error: 'Payload student khong hop le.' }
  }

  const id = String(student.id ?? student.localId ?? '').trim()

  if (!id) {
    return { ok: false, error: 'Thieu student id.' }
  }

  return {
    ok: true,
    student: {
      ...student,
      id,
      classSessionIds: Array.isArray(student.classSessionIds)
        ? Array.from(new Set(student.classSessionIds.map((item) => String(item ?? '').trim()).filter(Boolean)))
        : [],
      isDeleted: Boolean(student.isDeleted),
      deletedAt: student.isDeleted ? String(student.deletedAt || '') : '',
      updatedAt: student.updatedAt || new Date().toISOString(),
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

function getTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}
