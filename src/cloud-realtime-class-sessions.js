import { CLOUD_ENTITY_TYPES } from './cloud-db-entities.js'
import {
  getAuthoritativeCoreVersion,
  projectAuthoritativeCoreRecord,
} from './cloud-authoritative-core.js'
import {
  buildOnlineAccessState,
  getOnlineAccessMessage,
} from './online-access-control.js'

export const CLASS_SESSION_REALTIME_ENTITY_TYPE = CLOUD_ENTITY_TYPES.CLASS_SESSION
export const CLASS_SESSION_REALTIME_PATCH_MESSAGE = 'NEEDS SUPABASE REALTIME PATCH'

export function subscribeToClassSessionCloudRealtime({
  supabase,
  centerId,
  accessState,
  onClassSessionRecord,
  onStatusChange,
} = {}) {
  const access = buildOnlineAccessState(accessState)

  if (!access.canRead) {
    return unavailable(getOnlineAccessMessage(access), false)
  }

  if (!supabase || typeof supabase.channel !== 'function') {
    return unavailable(
      `${CLASS_SESSION_REALTIME_PATCH_MESSAGE}: Supabase Realtime client is not available.`,
      true,
    )
  }

  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) {
    return unavailable('Thiếu centerId nên không subscribe realtime.', false)
  }

  const channel = supabase.channel(`ichess-center-class-sessions:${normalizedCenterId}`)
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'center_cloud_entities',
      filter: `center_id=eq.${normalizedCenterId}`,
    },
    (event) => {
      const record = getClassSessionRealtimeRecord(event, normalizedCenterId)
      if (record) onClassSessionRecord?.(record, event)
    },
  )
  channel.subscribe((status) => {
    const failed = status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
    onStatusChange?.({
      ok: status === 'SUBSCRIBED',
      status,
      needsRealtimePatch: failed,
      message: failed
        ? CLASS_SESSION_REALTIME_PATCH_MESSAGE
        : status === 'SUBSCRIBED'
          ? 'Online Ca học / Lớp đã kết nối.'
          : '',
    })
  })

  return {
    ok: true,
    channel,
    centerId: normalizedCenterId,
    cleanup: () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel)
      } else {
        channel.unsubscribe?.()
      }
    },
  }
}

export function getClassSessionRealtimeRecord(event = {}, expectedCenterId = '') {
  const newRecord = event.new || event.record || null
  const oldRecord = event.old || null
  const candidate = newRecord || oldRecord
  const normalizedCenterId = cleanText(expectedCenterId)

  if (
    !candidate
    || candidate.entity_type !== CLASS_SESSION_REALTIME_ENTITY_TYPE
    || (normalizedCenterId && cleanText(candidate.center_id) !== normalizedCenterId)
  ) {
    return null
  }

  const deleted = Boolean(newRecord?.deleted_at || event.eventType === 'DELETE')
  if (!deleted && (!newRecord?.payload || typeof newRecord.payload !== 'object' || Array.isArray(newRecord.payload))) {
    return null
  }

  return {
    ...candidate,
    is_realtime_delete: deleted,
  }
}

export function mergeRealtimeClassSessionIntoList(classSessions = [], record = {}) {
  const source = Array.isArray(classSessions) ? classSessions : []
  const localId = cleanText(record.local_id || record.payload?.id)
  const incomingVersion = Number(record.entity_version)
  const deleted = Boolean(record.is_realtime_delete || record.deleted_at)

  if (!localId || !Number.isSafeInteger(incomingVersion) || incomingVersion < 1) {
    return invalid(source, 'Class Session realtime record thiếu id/version hợp lệ.')
  }

  const existingIndex = source.findIndex((item) => cleanText(item?.id) === localId)
  const currentVersion = existingIndex < 0
    ? 0
    : getAuthoritativeCoreVersion(source[existingIndex])

  if (existingIndex >= 0 && incomingVersion <= currentVersion) {
    return {
      ok: true,
      changed: false,
      stale: true,
      classSessions: source,
      classSession: source[existingIndex],
    }
  }

  if (deleted) {
    if (existingIndex < 0) {
      return { ok: true, changed: false, stale: false, classSessions: source, classSession: null }
    }
    return {
      ok: true,
      changed: true,
      stale: false,
      classSessions: source.filter((_, index) => index !== existingIndex),
      classSession: null,
    }
  }

  const projected = projectAuthoritativeCoreRecord(record)
  if (!projected || cleanText(projected.id) !== localId) {
    return invalid(source, 'Class Session realtime payload không khớp authoritative local_id.')
  }

  if (existingIndex < 0) {
    return {
      ok: true,
      changed: true,
      stale: false,
      classSessions: [projected, ...source],
      classSession: projected,
    }
  }

  const merged = { ...source[existingIndex], ...projected }
  return {
    ok: true,
    changed: JSON.stringify(source[existingIndex]) !== JSON.stringify(merged),
    stale: false,
    classSessions: source.map((item, index) => index === existingIndex ? merged : item),
    classSession: merged,
  }
}

function unavailable(message, needsRealtimePatch) {
  return {
    ok: false,
    message,
    needsRealtimePatch,
    cleanup: () => {},
  }
}

function invalid(classSessions, error) {
  return { ok: false, changed: false, classSessions, error }
}

function cleanText(value) {
  return String(value ?? '').trim()
}
