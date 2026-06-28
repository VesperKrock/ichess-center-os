import {
  checkCloudDbReadiness,
  getCloudDbErrorMessage,
} from './cloud-db-sync.js'
import { buildScheduleSessionCloudPayload } from './cloud-schedule-session-bridge.js'
import { SCHEDULE_SESSION_CLOUD_ENTITY_TYPE } from './cloud-schedule-sessions.js'

export const SCHEDULE_SESSION_BACKFILL_CONFIRM_TOKEN = 'BACKFILL_SCHEDULE_SESSION'

const DEFAULT_CENTER_ID = 'dreamhome'
const ADMIN_BACKFILL_ROLES = new Set(['owner', 'qtv', 'center_admin', 'admin'])

export async function backfillLocalScheduleSessionsToCloud({
  scheduleSessions = [],
  visibleScheduleSessions = null,
  centerId = DEFAULT_CENTER_ID,
  dryRun = true,
  confirm = '',
  overwrite = false,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const sourceSessions = Array.isArray(scheduleSessions) ? scheduleSessions : []
  const shouldWrite = dryRun === false
  const readiness = await checkCloudDbReadiness(normalizedCenterId)

  if (!readiness.ok) {
    return createBlockedResult({
      centerId: normalizedCenterId,
      dryRun: !shouldWrite,
      reason: readiness.error || 'Cloud schedule_session chua san sang.',
      detail: readiness.detail || null,
      localScheduleSessionCount: sourceSessions.length,
    })
  }

  const role = normalizeRole(readiness.membership?.role)

  if (!ADMIN_BACKFILL_ROLES.has(role)) {
    return createBlockedResult({
      centerId: readiness.centerId || normalizedCenterId,
      dryRun: !shouldWrite,
      reason: `Role ${role || 'unknown'} khong duoc backfill schedule_session.`,
      role,
      localScheduleSessionCount: sourceSessions.length,
    })
  }

  const cloudResult = await listScheduleSessionCloudEntities({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
  })

  if (!cloudResult.ok) {
    return createBlockedResult({
      centerId: readiness.centerId || normalizedCenterId,
      dryRun: !shouldWrite,
      reason: cloudResult.error || 'Khong doc duoc cloud schedule_session.',
      detail: cloudResult.detail || null,
      role,
      localScheduleSessionCount: sourceSessions.length,
    })
  }

  const preview = buildBackfillPreview({
    scheduleSessions: sourceSessions,
    visibleScheduleSessions,
    centerId: readiness.centerId,
    userId: readiness.user?.id,
    cloudRecords: cloudResult.data,
    role,
    overwrite,
  })

  if (!shouldWrite) {
    return {
      ok: true,
      dryRun: true,
      mode: 'preview',
      ...preview,
    }
  }

  if (confirm !== SCHEDULE_SESSION_BACKFILL_CONFIRM_TOKEN) {
    return {
      ok: false,
      blocked: true,
      dryRun: false,
      mode: 'apply',
      reason: `Thieu confirm token ${SCHEDULE_SESSION_BACKFILL_CONFIRM_TOKEN}.`,
      ...preview,
    }
  }

  if (!preview.upsertRecords.length) {
    return {
      ok: true,
      dryRun: false,
      mode: 'apply',
      upserted: 0,
      errors: 0,
      ...stripRecords(preview),
    }
  }

  const { error } = await readiness.supabase
    .from('center_cloud_entities')
    .upsert(preview.upsertRecords, { onConflict: 'center_id,entity_type,local_id' })

  if (error) {
    return {
      ok: false,
      dryRun: false,
      mode: 'apply',
      reason: getCloudDbErrorMessage(error),
      errors: 1,
      ...stripRecords(preview),
    }
  }

  return {
    ok: true,
    dryRun: false,
    mode: 'apply',
    upserted: preview.upsertRecords.length,
    errors: 0,
    ...stripRecords(preview),
  }
}

function buildBackfillPreview({
  scheduleSessions,
  visibleScheduleSessions,
  centerId,
  userId,
  cloudRecords,
  role,
  overwrite,
}) {
  const hasVisibleSource = Array.isArray(visibleScheduleSessions)
  const candidateSource = hasVisibleSource ? visibleScheduleSessions : scheduleSessions
  const existingByLocalId = new Map(
    (Array.isArray(cloudRecords) ? cloudRecords : [])
      .map((record) => [normalizeText(record.local_id), record])
      .filter(([localId]) => localId),
  )
  const skipped = []
  const skippedReasons = {}
  const validCandidates = []
  const upsertRecords = []
  const seenLocalIds = new Set()
  let wouldOverwrite = 0
  let wouldSkipCloudNewer = 0

  candidateSource.forEach((session, index) => {
    if (session?.isDeleted || session?.deletedAt) {
      pushSkipped(skipped, skippedReasons, {
        index,
        id: normalizeText(session?.id),
        reason: 'schedule_session da bi danh dau deleted.',
      })
      return
    }

    const payloadResult = buildScheduleSessionCloudPayload(session, {
      centerId,
      userId,
    })

    if (!payloadResult.ok) {
      pushSkipped(skipped, skippedReasons, {
        index,
        id: normalizeText(session?.id),
        reason: payloadResult.error || 'schedule_session invalid.',
      })
      return
    }

    if (seenLocalIds.has(payloadResult.localId)) {
      pushSkipped(skipped, skippedReasons, {
        index,
        id: payloadResult.payload.id,
        localId: payloadResult.localId,
        reason: 'Duplicate schedule_session local_id trong source dang preview.',
      })
      return
    }

    seenLocalIds.add(payloadResult.localId)

    const existingRecord = existingByLocalId.get(payloadResult.localId)
    const localUpdatedAt = getTimestamp(payloadResult.payload.updatedAt)
    const cloudUpdatedAt = getTimestamp(
      existingRecord?.payload?.updatedAt || existingRecord?.updated_at,
    )
    const cloudIsNewer = Boolean(existingRecord && cloudUpdatedAt && localUpdatedAt && cloudUpdatedAt > localUpdatedAt)

    if (existingRecord) {
      wouldOverwrite += 1
    }

    const shouldUpsert = !existingRecord || overwrite || !cloudIsNewer

    validCandidates.push({
      localId: payloadResult.localId,
      id: payloadResult.payload.id,
      title: payloadResult.payload.title || payloadResult.payload.groupName || '',
      classSessionId: payloadResult.payload.classSessionId || '',
      scheduleType: payloadResult.payload.scheduleType,
      updatedAt: payloadResult.payload.updatedAt || '',
      existsInCloud: Boolean(existingRecord),
      cloudUpdatedAt: existingRecord?.updated_at || existingRecord?.payload?.updatedAt || '',
      action: shouldUpsert ? 'upsert' : 'skip-cloud-newer',
    })

    if (!shouldUpsert) {
      wouldSkipCloudNewer += 1
      pushSkipped(skipped, skippedReasons, {
        index,
        id: payloadResult.payload.id,
        localId: payloadResult.localId,
        reason: 'Cloud schedule_session moi hon local; can overwrite: true neu user chap nhan.',
      })
      return
    }

    upsertRecords.push({
      ...payloadResult.record,
      updated_at: payloadResult.payload.updatedAt || new Date().toISOString(),
    })
  })

  const sampleTitles = validCandidates
    .slice(0, 8)
    .map((candidate) => candidate.title || candidate.classSessionId || candidate.id)
    .filter(Boolean)
  const angelWingsSignal = hasAngelWingsSignal(candidateSource, sampleTitles)
  const warnings = []

  if (!hasVisibleSource) {
    warnings.push('Helper chua nhan visible TKB source; dang preview tu toan bo local schedule.')
  }
  if (hasVisibleSource && scheduleSessions.length > candidateSource.length) {
    warnings.push(
      `Local co ${scheduleSessions.length} schedule_session, preview chi lay ${candidateSource.length} card TKB dang render.`,
    )
  }
  if (!angelWingsSignal) {
    warnings.push('Khong thay Angel Wings trong sample; kiem tra lai nguon truoc khi apply.')
  }

  return {
    centerId,
    center_id: centerId,
    entityType: SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
    role,
    adminOnly: true,
    localScheduleSessionCount: scheduleSessions.length,
    visibleWeekCandidateCount: hasVisibleSource ? candidateSource.length : null,
    eligibleCandidateCount: validCandidates.length,
    candidateCount: validCandidates.length,
    cloudExistingCount: existingByLocalId.size,
    sampleTitles,
    sampleIds: validCandidates.slice(0, 8).map((candidate) => candidate.id),
    candidates: validCandidates,
    skippedCount: skipped.length,
    skipped,
    skippedReasons,
    wouldUpsert: upsertRecords.length,
    wouldOverwrite,
    wouldSkipCloudNewer,
    overwrite: Boolean(overwrite),
    warnings,
    upsertRecords,
  }
}

async function listScheduleSessionCloudEntities({ supabase, centerId = DEFAULT_CENTER_ID } = {}) {
  if (!supabase) {
    return { ok: false, error: 'Thieu Supabase client.' }
  }

  const { data, error } = await supabase
    .from('center_cloud_entities')
    .select('center_id, entity_type, local_id, payload, source_module, source_version, updated_at, deleted_at')
    .eq('center_id', centerId)
    .eq('entity_type', SCHEDULE_SESSION_CLOUD_ENTITY_TYPE)
    .is('deleted_at', null)
    .order('updated_at', { ascending: true })

  if (error) {
    return { ok: false, error: getCloudDbErrorMessage(error), detail: error }
  }

  return { ok: true, data: data || [] }
}

function pushSkipped(skipped, skippedReasons, item) {
  skipped.push(item)
  const reason = item.reason || 'unknown'
  skippedReasons[reason] = (skippedReasons[reason] || 0) + 1
}

function stripRecords(preview) {
  const { upsertRecords, ...safePreview } = preview
  return safePreview
}

function createBlockedResult({
  centerId,
  dryRun,
  reason,
  detail = null,
  role = '',
  localScheduleSessionCount = 0,
}) {
  return {
    ok: false,
    blocked: true,
    dryRun,
    centerId,
    center_id: centerId,
    entityType: SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
    role,
    localScheduleSessionCount,
    candidateCount: 0,
    wouldUpsert: 0,
    wouldOverwrite: 0,
    skippedCount: localScheduleSessionCount,
    reason,
    detail,
  }
}

function hasAngelWingsSignal(scheduleSessions, sampleTitles) {
  const combined = [
    ...sampleTitles,
    ...scheduleSessions.flatMap((session) => [
      session?.title,
      session?.groupName,
      session?.sourceTag,
      session?.datasetId,
      session?.importBatchId,
    ]),
  ].join(' ').toLowerCase()

  return combined.includes('angel') || combined.includes('wings')
}

function normalizeRole(role) {
  return normalizeText(role).toLowerCase().replace(/[\s-]+/g, '_')
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function getTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}
