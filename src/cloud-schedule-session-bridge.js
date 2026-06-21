import {
  SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
  SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH,
  buildScheduleSessionCloudEntity,
  createScheduleSessionCloudDryRun,
  evaluateScheduleSessionCloudReadiness,
  validateScheduleSessionCloudPayload,
} from './cloud-schedule-sessions.js'
import {
  NEEDS_MEMBERSHIP_SQL_PATCH,
  buildOnlineAccessState,
  canWriteEntity,
  getOnlineAccessMessage,
} from './online-access-control.js'

export const SCHEDULE_SESSION_BRIDGE_ENTITY_TYPE = SCHEDULE_SESSION_CLOUD_ENTITY_TYPE
export const NEEDS_SCHEDULE_SESSION_SQL_PATCH = 'NEEDS SCHEDULE_SESSION SQL PATCH'
export const NEEDS_SUPABASE_REALTIME_PATCH = 'NEEDS SUPABASE REALTIME PATCH'

const CLASS_SESSION_ENTITY_TYPE = 'class_session'

export function normalizeScheduleSessionForCloud(input = {}) {
  const result = validateScheduleSessionPayload(input)

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    payload: result.payload,
  }
}

export function validateScheduleSessionPayload(payload = {}) {
  const validation = validateScheduleSessionCloudPayload(payload)

  if (!validation.ok) {
    return validation
  }

  return {
    ok: true,
    payload: validation.session,
  }
}

export function buildScheduleSessionCloudPayload(scheduleSession = {}, context = {}) {
  const entity = buildScheduleSessionCloudEntity({
    centerId: context.centerId,
    session: scheduleSession,
    userId: context.userId,
  })

  if (!entity.ok) {
    return entity
  }

  const softDeleteFields = {}

  if (scheduleSession?.isDeleted) {
    softDeleteFields.isDeleted = true
    softDeleteFields.deletedAt = String(scheduleSession.deletedAt || '')
  }

  const payload = {
    ...entity.data.payload,
    ...softDeleteFields,
  }
  const record = {
    ...entity.data,
    payload,
  }

  return {
    ok: true,
    entityType: SCHEDULE_SESSION_BRIDGE_ENTITY_TYPE,
    localId: entity.localId,
    payload,
    record,
  }
}

export function buildScheduleSessionBridgePreview(scheduleSessions = [], context = {}) {
  const classSessionIds = new Set(
    (Array.isArray(context.classSessions) ? context.classSessions : [])
      .map((classSession) => String(classSession?.id ?? '').trim())
      .filter(Boolean),
  )
  const dryRun = createScheduleSessionCloudDryRun({
    centerId: context.centerId,
    scheduleSessions,
    remoteAllowlistReady: Boolean(context.scheduleSessionSqlReady),
  })
  const summary = {
    total: dryRun.total,
    valid: dryRun.valid,
    invalid: dryRun.invalid,
    missingClassSessionId: 0,
    validClassSessionId: 0,
    missingReferencedClassSession: 0,
    missingTeacherId: dryRun.sessionsMissingTeacher,
    emptyStudentIds: dryRun.sessionsMissingStudents,
    recurring: dryRun.countByScheduleType.recurring,
    oneOff: dryRun.countByScheduleType.oneOff,
    legacyUnknown: dryRun.countByScheduleType.legacyUnknown,
  }

  for (const record of dryRun.validEntities) {
    const classSessionId = String(record?.payload?.classSessionId ?? '').trim()

    if (!classSessionId) {
      summary.missingClassSessionId += 1
      continue
    }

    if (classSessionIds.has(classSessionId)) {
      summary.validClassSessionId += 1
      continue
    }

    summary.missingReferencedClassSession += 1
  }

  const access = canWriteScheduleSession(context.accessState)
  const readiness = getScheduleSessionBridgeReadiness({
    ...context,
    dryRunPreview: dryRun,
    accessState: context.accessState,
  })

  return {
    ok: true,
    entityType: SCHEDULE_SESSION_BRIDGE_ENTITY_TYPE,
    classSessionBridge: 'schedule_session.classSessionId -> class_session.id',
    summary,
    dryRun,
    access,
    readiness,
  }
}

export function canWriteScheduleSession(accessState = {}) {
  const state = buildOnlineAccessState(accessState)
  const canWriteCoreSchedule = canWriteEntity(state, CLASS_SESSION_ENTITY_TYPE)

  return {
    ok: canWriteCoreSchedule,
    canWrite: canWriteCoreSchedule,
    role: state.role,
    reason: canWriteCoreSchedule ? 'write-allowed-by-c3-1-guard' : state.reason,
    message: canWriteCoreSchedule ? '' : getOnlineAccessMessage(state),
    needsMembershipSqlPatch: state.needsMembershipPatch,
  }
}

export function getScheduleSessionBridgeReadiness(context = {}) {
  const access = canWriteScheduleSession(context.accessState)
  const scheduleSessionSqlReady = Boolean(context.scheduleSessionSqlReady)
  const realtimeReady = Boolean(context.realtimeReady)
  const membershipSqlReady = Boolean(context.membershipSqlReady)
  const dryRunReadiness = evaluateScheduleSessionCloudReadiness({
    cloudReady: Boolean(context.cloudReady),
    signedIn: Boolean(context.signedIn ?? context.accessState?.isSignedIn),
    membershipReady: Boolean(context.membershipReady ?? context.accessState?.hasMembership),
    centerId: context.centerId,
    remoteAllowlistReady: scheduleSessionSqlReady,
    dryRunPreview: context.dryRunPreview,
    explicitUserAction: Boolean(context.explicitUserAction),
  })
  const blockers = [...dryRunReadiness.blockers]

  if (!access.canWrite) {
    blockers.push(access.message || 'Access-control C3.1 chua cho phep ghi schedule_session.')
  }
  if (!membershipSqlReady || access.needsMembershipSqlPatch) {
    blockers.push(NEEDS_MEMBERSHIP_SQL_PATCH)
  }
  if (!scheduleSessionSqlReady) {
    blockers.push(NEEDS_SCHEDULE_SESSION_SQL_PATCH)
  }
  if (!realtimeReady) {
    blockers.push(NEEDS_SUPABASE_REALTIME_PATCH)
  }

  const uniqueBlockers = Array.from(new Set(blockers.filter(Boolean)))

  return {
    ok: uniqueBlockers.length === 0,
    status: uniqueBlockers.length ? 'blocked' : 'ready',
    entityType: SCHEDULE_SESSION_BRIDGE_ENTITY_TYPE,
    needsScheduleSessionSqlPatch: !scheduleSessionSqlReady,
    needsMembershipSqlPatch: !membershipSqlReady || access.needsMembershipSqlPatch,
    needsRealtimePatch: !realtimeReady,
    readyForRuntimeWrite:
      access.canWrite &&
      dryRunReadiness.ok &&
      membershipSqlReady &&
      scheduleSessionSqlReady &&
      realtimeReady,
    blockers: uniqueBlockers,
    dryRunStatus: dryRunReadiness.status,
    dryRunNeedsAllowlistPatch: dryRunReadiness.status === SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH,
  }
}
