import {
  NEEDS_SCHEDULE_SESSION_SQL_PATCH,
  NEEDS_SUPABASE_REALTIME_PATCH,
  SCHEDULE_SESSION_BRIDGE_ENTITY_TYPE,
  buildScheduleSessionCloudPayload,
  getScheduleSessionBridgeReadiness,
  validateScheduleSessionPayload,
} from './cloud-schedule-session-bridge.js'
import {
  NEEDS_MEMBERSHIP_SQL_PATCH,
  buildOnlineAccessState,
  canReadModule,
  getOnlineAccessMessage,
} from './online-access-control.js'

export const SCHEDULE_SESSION_REALTIME_ENTITY_TYPE = SCHEDULE_SESSION_BRIDGE_ENTITY_TYPE

const SCHEDULE_MODULE_ID = 'thoi-khoa-bieu'

export async function upsertScheduleSessionCloudEntity({
  supabase,
  centerId,
  scheduleSession,
  userId = null,
  accessState,
  readiness = {},
} = {}) {
  const bridgeReadiness = getScheduleSessionBridgeReadiness({
    ...readiness,
    accessState,
    centerId,
    dryRunPreview: readiness.dryRunPreview,
    explicitUserAction: true,
  })

  if (!bridgeReadiness.readyForRuntimeWrite) {
    return {
      ok: false,
      skipped: true,
      error: bridgeReadiness.blockers[0] || NEEDS_SCHEDULE_SESSION_SQL_PATCH,
      readiness: bridgeReadiness,
    }
  }

  if (!supabase) {
    return { ok: false, error: 'Thieu Supabase client.' }
  }

  const payloadResult = buildScheduleSessionCloudPayload(scheduleSession, {
    centerId,
    userId,
  })

  if (!payloadResult.ok) {
    return payloadResult
  }

  const { error } = await supabase
    .from('center_cloud_entities')
    .upsert([payloadResult.record], { onConflict: 'center_id,entity_type,local_id' })

  if (error) {
    return {
      ok: false,
      error: String(error?.message || error || 'Khong the upsert schedule_session.'),
      detail: error,
    }
  }

  return {
    ok: true,
    count: 1,
    entityType: SCHEDULE_SESSION_REALTIME_ENTITY_TYPE,
    localId: payloadResult.localId,
  }
}

export function subscribeToScheduleSessionCloudRealtime({
  supabase,
  centerId,
  accessState,
  readiness = {},
  onScheduleSessionRecord,
  onStatusChange,
} = {}) {
  const normalizedAccessState = buildOnlineAccessState(accessState)

  if (!canReadModule(normalizedAccessState, SCHEDULE_MODULE_ID)) {
    return createRealtimeUnavailableResult(
      normalizedAccessState.needsMembershipPatch
        ? NEEDS_MEMBERSHIP_SQL_PATCH
        : getOnlineAccessMessage(normalizedAccessState),
      normalizedAccessState.needsMembershipPatch,
      false,
      true,
    )
  }

  const bridgeReadiness = getScheduleSessionBridgeReadiness({
    ...readiness,
    accessState: normalizedAccessState,
    centerId,
    explicitUserAction: true,
  })

  if (bridgeReadiness.needsScheduleSessionSqlPatch || bridgeReadiness.needsRealtimePatch) {
    return createRealtimeUnavailableResult(
      bridgeReadiness.needsScheduleSessionSqlPatch
        ? NEEDS_SCHEDULE_SESSION_SQL_PATCH
        : NEEDS_SUPABASE_REALTIME_PATCH,
      bridgeReadiness.needsMembershipSqlPatch,
      bridgeReadiness.needsRealtimePatch,
      true,
      bridgeReadiness,
    )
  }

  if (!supabase || typeof supabase.channel !== 'function') {
    return createRealtimeUnavailableResult(
      `${NEEDS_SUPABASE_REALTIME_PATCH}: Supabase Realtime client is not available.`,
      false,
      true,
      true,
      bridgeReadiness,
    )
  }

  const normalizedCenterId = String(centerId ?? '').trim()

  if (!normalizedCenterId) {
    return createRealtimeUnavailableResult('Thieu centerId nen khong subscribe realtime.', false, false, true)
  }

  const channel = supabase.channel(`ichess-center-schedule-sessions:${normalizedCenterId}`)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'center_cloud_entities',
      filter: `center_id=eq.${normalizedCenterId}`,
    },
    (event) => {
      const record = getScheduleSessionRealtimeRecord(event)

      if (!record) {
        return
      }

      onScheduleSessionRecord?.(record, event)
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
      message: status === 'SUBSCRIBED' ? 'Online TKB da ket noi.' : '',
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

export function getScheduleSessionRealtimeRecord(event = {}) {
  const record = event.new || event.record || null
  const oldRecord = event.old || null
  const candidate = record || oldRecord

  if (!candidate || candidate.entity_type !== SCHEDULE_SESSION_REALTIME_ENTITY_TYPE) {
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

export function mergeScheduleSessionRealtimePayload(scheduleSessions = [], record = {}) {
  const normalized = validateScheduleSessionPayload(record.payload)

  if (!normalized.ok) {
    return {
      ok: false,
      changed: false,
      scheduleSessions,
      error: normalized.error,
    }
  }

  const incomingSession = normalized.payload
  const incomingUpdatedAt = getTimestamp(incomingSession.updatedAt)
  let changed = false
  let found = false
  const nextScheduleSessions = (Array.isArray(scheduleSessions) ? scheduleSessions : []).map((session) => {
    if (String(session?.id ?? '') !== incomingSession.id) {
      return session
    }

    found = true
    const currentUpdatedAt = getTimestamp(session.updatedAt)

    if (currentUpdatedAt && incomingUpdatedAt && incomingUpdatedAt < currentUpdatedAt) {
      return session
    }

    const mergedSession = { ...session, ...incomingSession }
    changed = JSON.stringify(session) !== JSON.stringify(mergedSession)
    return mergedSession
  })

  if (!found) {
    changed = true
    nextScheduleSessions.unshift(incomingSession)
  }

  return {
    ok: true,
    changed,
    scheduleSessions: nextScheduleSessions,
    scheduleSession: incomingSession,
  }
}

function createRealtimeUnavailableResult(
  message,
  needsMembershipPatch,
  needsRealtimePatch,
  needsScheduleSessionSqlPatch,
  readiness = null,
) {
  return {
    ok: false,
    message,
    needsMembershipPatch,
    needsRealtimePatch,
    needsScheduleSessionSqlPatch,
    readiness,
    cleanup: () => {},
  }
}

function getTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}
