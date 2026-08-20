import {
  ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
  buildAttendanceRecordCloudEntity,
  createAttendanceRecordCloudLocalId,
  validateAttendanceRecordCloudPayload,
} from './cloud-attendance-records.js'
import {
  ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE,
  SESSION_REPORT_CLOUD_ENTITY_TYPE,
  buildAttendanceBaselineStateCloudEntity,
  buildSessionReportCloudEntity,
  createAttendanceBaselineStateCloudLocalId,
  createSessionReportCloudLocalId,
  validateAttendanceBaselineStateCloudPayload,
  validateSessionReportCloudPayload,
} from './cloud-session-reports.js'
import {
  loadStoredAttendanceRecords,
  normalizeStoredAttendanceRecords,
} from './attendance-records.js'
import { getStoredSessionReports } from './storage.js'
import { buildOnlineAccessState, getOnlineAccessMessage } from './online-access-control.js'
import {
  getAuthoritativeAttendanceTuitionVersion,
  mutateAuthoritativeAttendanceTuitionEntities,
} from './cloud-authoritative-attendance-tuition.js'

export const C51_ATTENDANCE_REALTIME_ENTITY_TYPES = Object.freeze([
  // C5.1C entity allowlist: attendance_record, attendance_baseline_state, session_report.
  ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
  ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE,
  SESSION_REPORT_CLOUD_ENTITY_TYPE,
])
export const C51_TEACHER_CONSULTANT_WRITE_HOLD =
  'teacher/consultant direct write HOLD - needs approved scoped policy'
export const C51_ATTENDANCE_REALTIME_SOURCE_VERSION = 'c5-1c-guarded-realtime-v1'

const C51_WRITE_ROLES = new Set(['owner', 'qtv', 'center_admin'])
const CLOUD_ENTITY_SELECT_FIELDS =
  'center_id, entity_type, local_id, payload, source_module, source_version, entity_version, updated_at, deleted_at'

export function canWriteC51AttendanceEntity(accessState = {}) {
  const state = buildOnlineAccessState(accessState)
  const canWrite = Boolean(state.canWrite && C51_WRITE_ROLES.has(state.role))

  return {
    ok: canWrite,
    canWrite,
    role: state.role,
    reason: canWrite ? 'write-allowed-c5-1c-admin-center-admin' : state.reason,
    message: canWrite ? '' : getOnlineAccessMessage(state),
    teacherConsultantHold:
      state.role === 'teacher' || state.role === 'consultant'
        ? C51_TEACHER_CONSULTANT_WRITE_HOLD
        : '',
    accessState: state,
  }
}

export async function pullC51AttendanceSessionReportCloudEntities({
  supabase,
  centerId,
} = {}) {
  if (!supabase) {
    return { ok: false, error: 'Missing Supabase client.' }
  }

  const { data, error } = await supabase
    .from('center_cloud_entities')
    .select(CLOUD_ENTITY_SELECT_FIELDS)
    .eq('center_id', centerId)
    .in('entity_type', C51_ATTENDANCE_REALTIME_ENTITY_TYPES)
    .is('deleted_at', null)
    .order('updated_at', { ascending: true })

  if (error) {
    return {
      ok: false,
      error: String(error?.message || error || 'Cannot pull C5.1 attendance/session report cloud entities.'),
      detail: error,
    }
  }

  if (!Array.isArray(data)) {
    return { ok: false, outcome_code: 'INVALID_SERVER_RESULT', error: 'Attendance authoritative snapshot không phải array.' }
  }
  const invalidRecord = data.find((record) => !isValidC51AuthoritativeSnapshotRecord(record, centerId))
  if (invalidRecord) {
    return {
      ok: false,
      outcome_code: 'INVALID_SERVER_RESULT',
      error: 'Attendance authoritative snapshot chứa row sai center/type/version/payload; không áp dụng partial truth.',
    }
  }

  return {
    ok: true,
    records: data,
    empty: data.length === 0,
  }
}

function isValidC51AuthoritativeSnapshotRecord(record, centerId) {
  if (
    !record
    || String(record.center_id || '') !== String(centerId || '')
    || !C51_ATTENDANCE_REALTIME_ENTITY_TYPES.includes(record.entity_type)
    || !String(record.local_id || '').trim()
    || !Number.isSafeInteger(Number(record.entity_version))
    || Number(record.entity_version) < 1
  ) return false

  if (record.entity_type === ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE) {
    const validation = validateAttendanceRecordCloudPayload(record.payload)
    return validation.ok
      && record.local_id === createAttendanceRecordCloudLocalId(validation.record)
  }
  if (record.entity_type === ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE) {
    return validateAttendanceBaselineStateCloudPayload(record.payload).ok
      && record.local_id === createAttendanceBaselineStateCloudLocalId(centerId)
  }
  const validation = validateSessionReportCloudPayload(record.payload)
  return validation.ok
    && record.local_id === createSessionReportCloudLocalId(validation.report)
}

export async function upsertC51AttendanceSessionReportCloudEntities({
  supabase,
  centerId,
  attendanceRecords = [],
  baselineState = null,
  sessionReports = [],
  previousAttendanceRecords = [],
  replaceBaselineRecords = false,
  userId = null,
  accessState,
  idempotencyKey,
} = {}) {
  const access = canWriteC51AttendanceEntity(accessState)

  if (!access.canWrite) {
    return {
      ok: false,
      skipped: true,
      error: access.teacherConsultantHold || access.message,
      access,
    }
  }

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase client.' }
  }

  const mutations = []
  const skipped = []

  for (const record of Array.isArray(attendanceRecords) ? attendanceRecords : []) {
    const result = buildAttendanceRecordCloudEntity({ centerId, record, userId })
    pushBuildResult(mutations, skipped, result, record)
  }

  if (baselineState && typeof baselineState === 'object') {
    const result = buildAttendanceBaselineStateCloudEntity({ centerId, state: baselineState, userId })
    pushBuildResult(mutations, skipped, result, baselineState)
  }

  for (const report of Array.isArray(sessionReports) ? sessionReports : []) {
    const result = buildSessionReportCloudEntity({ centerId, report, userId })
    pushBuildResult(mutations, skipped, result, report)
  }

  if (replaceBaselineRecords) {
    const desiredLocalIds = new Set(
      (Array.isArray(attendanceRecords) ? attendanceRecords : [])
        .filter((record) => record?.source === 'initialBaseline')
        .map((record) => createAttendanceRecordCloudLocalId(record))
        .filter(Boolean),
    )

    for (const previousRecord of Array.isArray(previousAttendanceRecords) ? previousAttendanceRecords : []) {
      if (previousRecord?.source !== 'initialBaseline') continue
      const localId = createAttendanceRecordCloudLocalId(previousRecord)
      if (!localId || desiredLocalIds.has(localId)) continue
      mutations.push({
        entityType: ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
        localId,
        entity: previousRecord,
        expectedVersion: getAuthoritativeAttendanceTuitionVersion(previousRecord),
        operation: 'DELETE',
      })
    }
  }

  if (skipped.length) {
    return {
      ok: false,
      outcome_code: 'INVALID_PAYLOAD',
      error: skipped[0].reason || 'Invalid C5.2 attendance/session report payload.',
      skippedItems: skipped,
    }
  }

  return mutateAuthoritativeAttendanceTuitionEntities({
    supabase,
    centerId,
    mutations,
    idempotencyKey,
  })
}

export function subscribeToC51AttendanceSessionReportRealtime({
  supabase,
  centerId,
  accessState,
  onCloudRecord,
  onStatusChange,
} = {}) {
  const access = buildOnlineAccessState(accessState)

  if (!access.canRead) {
    return createRealtimeUnavailableResult(getOnlineAccessMessage(access), false, false)
  }

  if (!supabase || typeof supabase.channel !== 'function') {
    return createRealtimeUnavailableResult('C5.1 realtime degraded: Supabase client unavailable.', true, false)
  }

  const normalizedCenterId = String(centerId ?? '').trim()

  if (!normalizedCenterId) {
    return createRealtimeUnavailableResult('C5.1 realtime degraded: missing center guard.', false, true)
  }

  const channel = supabase.channel(`ichess-center-attendance-session-report:${normalizedCenterId}`)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'center_cloud_entities',
      filter: `center_id=eq.${normalizedCenterId}`,
    },
    (event) => {
      const record = getC51RealtimeRecord(event, normalizedCenterId)

      if (!record) {
        return
      }

      onCloudRecord?.(record, event)
    },
  )

  channel.subscribe((status) => {
    onStatusChange?.({
      ok: status === 'SUBSCRIBED',
      status,
      message: status === 'SUBSCRIBED' ? 'C5.1 realtime ready.' : 'C5.1 realtime degraded.',
      needsRealtimePatch: status === 'CHANNEL_ERROR' || status === 'TIMED_OUT',
    })
  })

  return {
    ok: true,
    centerId: normalizedCenterId,
    channel,
    cleanup: () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel)
        return
      }

      channel.unsubscribe?.()
    },
  }
}

export function getC51RealtimeRecord(event = {}, centerId = '') {
  const record = event.new || event.record || null
  const oldRecord = event.old || null
  const candidate = record || oldRecord

  if (!candidate || !C51_ATTENDANCE_REALTIME_ENTITY_TYPES.includes(candidate.entity_type)) {
    return null
  }

  if (centerId && String(candidate.center_id || '') !== String(centerId)) {
    return null
  }

  return {
    ...candidate,
    deleted_at: record?.deleted_at || oldRecord?.deleted_at || null,
    isDeleted: Boolean(record?.deleted_at || oldRecord?.deleted_at || event.eventType === 'DELETE'),
  }
}

export function mergeC51CloudRecordsIntoLocal({
  attendanceRecords = [],
  baselineState = {},
  sessionReports = [],
  cloudRecords = [],
  authoritativeSnapshot = false,
} = {}) {
  const previousAttendanceRecords = normalizeStoredAttendanceRecords(attendanceRecords)
  const previousBaselineState = baselineState && typeof baselineState === 'object' ? { ...baselineState } : {}
  const previousSessionReports = Array.isArray(sessionReports) ? [...sessionReports] : []
  let nextAttendanceRecords = authoritativeSnapshot ? [] : previousAttendanceRecords
  let nextBaselineState = authoritativeSnapshot ? {} : previousBaselineState
  let nextSessionReports = authoritativeSnapshot ? [] : previousSessionReports
  const skipped = []
  const conflicts = []
  let changed = false

  for (const record of Array.isArray(cloudRecords) ? cloudRecords : []) {
    if (!record || !C51_ATTENDANCE_REALTIME_ENTITY_TYPES.includes(record.entity_type)) {
      continue
    }

    if (record.entity_type === ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE) {
      const result = mergeAttendanceRecordCloudRecord(nextAttendanceRecords, record)
      nextAttendanceRecords = result.records
      changed = changed || result.changed
      skipped.push(...result.skipped)
      conflicts.push(...result.conflicts)
      continue
    }

    if (record.entity_type === ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE) {
      const result = mergeBaselineStateCloudRecord(nextBaselineState, record)
      nextBaselineState = result.state
      changed = changed || result.changed
      skipped.push(...result.skipped)
      continue
    }

    if (record.entity_type === SESSION_REPORT_CLOUD_ENTITY_TYPE) {
      const result = mergeSessionReportCloudRecord(nextSessionReports, record)
      nextSessionReports = result.reports
      changed = changed || result.changed
      skipped.push(...result.skipped)
    }
  }

  return {
    ok: true,
    changed: authoritativeSnapshot
      ? JSON.stringify({
          attendanceRecords: previousAttendanceRecords,
          baselineState: previousBaselineState,
          sessionReports: previousSessionReports,
        }) !== JSON.stringify({
          attendanceRecords: nextAttendanceRecords,
          baselineState: nextBaselineState,
          sessionReports: nextSessionReports,
        })
      : changed,
    attendanceRecords: nextAttendanceRecords,
    baselineState: nextBaselineState,
    sessionReports: nextSessionReports,
    skipped,
    conflicts,
  }
}

export function createC51LocalSnapshot({
  centerId = 'dreamhome',
  attendanceRecords = loadStoredAttendanceRecords(centerId),
  baselineState = {},
  sessionReports = getStoredSessionReports(),
} = {}) {
  return {
    attendanceRecords,
    baselineState,
    sessionReports,
  }
}

function mergeAttendanceRecordCloudRecord(records = [], cloudRecord = {}) {
  const payload = cloudRecord.payload
  const validation = validateAttendanceRecordCloudPayload(payload)

  if (!validation.ok) {
    return createMergeResult(records, false, [{ entityType: cloudRecord.entity_type, reason: validation.error }])
  }

  const incoming = {
    ...validation.record,
    cloudVersion: Number(cloudRecord.entity_version) || 0,
    cloudUpdatedAt: String(cloudRecord.updated_at || ''),
    cloudDeletedAt: String(cloudRecord.deleted_at || ''),
  }
  const localId = cloudRecord.local_id || createAttendanceRecordCloudLocalId(incoming)
  const incomingUpdatedAt = getTimestamp(
    cloudRecord.updated_at || incoming.updatedAt || incoming.createdAt,
  )
  const currentRecords = normalizeStoredAttendanceRecords(records)
  const byIdIndex = currentRecords.findIndex((record) => createAttendanceRecordCloudLocalId(record) === localId)

  if (cloudRecord.isDeleted || cloudRecord.deleted_at || incoming.deletedAt) {
    if (byIdIndex < 0) {
      return createMergeResult(currentRecords, false)
    }
    const currentVersion = getAuthoritativeAttendanceTuitionVersion(currentRecords[byIdIndex])
    const incomingVersion = getAuthoritativeAttendanceTuitionVersion(incoming)
    if (currentVersion && incomingVersion && incomingVersion <= currentVersion) {
      return createMergeResult(currentRecords, false)
    }

    return createMergeResult(currentRecords.filter((_, index) => index !== byIdIndex), true)
  }

  if (byIdIndex >= 0) {
    const current = currentRecords[byIdIndex]
    const currentVersion = getAuthoritativeAttendanceTuitionVersion(current)
    const incomingVersion = getAuthoritativeAttendanceTuitionVersion(incoming)
    const currentUpdatedAt = getTimestamp(current.updatedAt || current.createdAt)

    if (
      incomingVersion && currentVersion && incomingVersion <= currentVersion
      || (!incomingVersion && currentUpdatedAt && incomingUpdatedAt && incomingUpdatedAt <= currentUpdatedAt)
    ) {
      return createMergeResult(currentRecords, false)
    }

    const nextRecords = [...currentRecords]
    nextRecords[byIdIndex] = incoming
    return createMergeResult(nextRecords, JSON.stringify(current) !== JSON.stringify(incoming))
  }

  const conflictIndex = currentRecords.findIndex((record) => hasAttendanceNaturalKeyConflict(record, incoming))

  if (conflictIndex >= 0) {
    const current = currentRecords[conflictIndex]
    const conflictRecord = {
      ...incoming,
      raw: {
        ...(incoming.raw || {}),
        syncConflict: true,
        conflictReason: 'same natural key with different attendance value/source',
        lastCloudUpdatedAt: cloudRecord.updated_at || incoming.updatedAt || '',
      },
    }

    return {
      records: [conflictRecord, ...currentRecords],
      changed: true,
      skipped: [],
      conflicts: [{
        entityType: ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
        localId,
        currentId: current.id,
        incomingId: incoming.id,
      }],
    }
  }

  return createMergeResult([incoming, ...currentRecords], true)
}

function mergeBaselineStateCloudRecord(state = {}, cloudRecord = {}) {
  const payload = cloudRecord.payload
  const validation = validateAttendanceBaselineStateCloudPayload(payload)

  if (!validation.ok) {
    return {
      state,
      changed: false,
      skipped: [{ entityType: cloudRecord.entity_type, reason: validation.error }],
    }
  }

  if (cloudRecord.isDeleted || cloudRecord.deleted_at || payload?.deletedAt) {
    return {
      state,
      changed: false,
      skipped: [],
    }
  }

  const incoming = {
    ...validation.state,
    cloudVersion: Number(cloudRecord.entity_version) || 0,
    cloudUpdatedAt: String(cloudRecord.updated_at || ''),
    cloudDeletedAt: String(cloudRecord.deleted_at || ''),
  }
  const incomingUpdatedAt = getTimestamp(cloudRecord.updated_at || incoming.updatedAt || incoming.lastActionAt)
  const localUpdatedAt = getTimestamp(state?.updatedAt || state?.lastActionAt)
  const currentVersion = getAuthoritativeAttendanceTuitionVersion(state)
  const incomingVersion = getAuthoritativeAttendanceTuitionVersion(incoming)

  if (
    incomingVersion && currentVersion && incomingVersion <= currentVersion
    || (!incomingVersion && localUpdatedAt && incomingUpdatedAt && incomingUpdatedAt <= localUpdatedAt)
  ) {
    return { state, changed: false, skipped: [] }
  }

  return {
    state: incoming,
    changed: JSON.stringify(state || {}) !== JSON.stringify(incoming),
    skipped: [],
  }
}

function mergeSessionReportCloudRecord(reports = [], cloudRecord = {}) {
  const payload = cloudRecord.payload
  const validation = validateSessionReportCloudPayload(payload)

  if (!validation.ok) {
    return {
      reports,
      changed: false,
      skipped: [{ entityType: cloudRecord.entity_type, reason: validation.error }],
    }
  }

  const incoming = {
    ...validation.report,
    cloudVersion: Number(cloudRecord.entity_version) || 0,
    cloudUpdatedAt: String(cloudRecord.updated_at || ''),
    cloudDeletedAt: String(cloudRecord.deleted_at || ''),
  }
  const localId = cloudRecord.local_id || createSessionReportCloudLocalId(incoming)
  const incomingUpdatedAt = getTimestamp(cloudRecord.updated_at || incoming.updatedAt || incoming.createdAt)
  const currentReports = Array.isArray(reports) ? [...reports] : []
  const byIdIndex = currentReports.findIndex((report) => createSessionReportCloudLocalId(report) === localId)

  if (cloudRecord.isDeleted || cloudRecord.deleted_at || incoming.deletedAt) {
    if (byIdIndex < 0) {
      return { reports: currentReports, changed: false, skipped: [] }
    }
    const currentVersion = getAuthoritativeAttendanceTuitionVersion(currentReports[byIdIndex])
    const incomingVersion = getAuthoritativeAttendanceTuitionVersion(incoming)
    if (currentVersion && incomingVersion && incomingVersion <= currentVersion) {
      return { reports: currentReports, changed: false, skipped: [] }
    }

    return {
      reports: currentReports.filter((_, index) => index !== byIdIndex),
      changed: true,
      skipped: [],
    }
  }

  if (byIdIndex >= 0) {
    const current = currentReports[byIdIndex]
    const currentVersion = getAuthoritativeAttendanceTuitionVersion(current)
    const incomingVersion = getAuthoritativeAttendanceTuitionVersion(incoming)
    const currentUpdatedAt = getTimestamp(current.updatedAt || current.createdAt)

    if (
      incomingVersion && currentVersion && incomingVersion <= currentVersion
      || (!incomingVersion && currentUpdatedAt && incomingUpdatedAt && incomingUpdatedAt <= currentUpdatedAt)
    ) {
      return { reports: currentReports, changed: false, skipped: [] }
    }

    const nextReports = [...currentReports]
    nextReports[byIdIndex] = incoming
    return {
      reports: nextReports,
      changed: JSON.stringify(current) !== JSON.stringify(incoming),
      skipped: [],
    }
  }

  return {
    reports: [incoming, ...currentReports],
    changed: true,
    skipped: [],
  }
}

function pushBuildResult(records, skipped, result, source) {
  if (result.ok) {
    records.push({
      entityType: result.data.entity_type,
      localId: result.data.local_id,
      entity: {
        ...result.data.payload,
        cloudVersion: getAuthoritativeAttendanceTuitionVersion(source),
      },
      expectedVersion: getAuthoritativeAttendanceTuitionVersion(source),
      operation: 'UPSERT',
    })
    return
  }

  skipped.push({
    id: source?.id || '',
    reason: result.error,
  })
}

function createRealtimeUnavailableResult(message, needsRealtimePatch, missingCenter) {
  return {
    ok: false,
    message,
    needsRealtimePatch,
    missingCenter,
    cleanup: () => {},
  }
}

function createMergeResult(records, changed, skipped = []) {
  return {
    records: normalizeStoredAttendanceRecords(records),
    changed,
    skipped,
    conflicts: [],
  }
}

function hasAttendanceNaturalKeyConflict(current = {}, incoming = {}) {
  const sameNaturalKey = [
    current.studentId,
    current.date,
    current.sessionId || current.scheduleSessionId || current.classSessionId || '',
    current.sourceReportId || '',
    current.sourceAttendanceIndex ?? '',
  ].join('::') === [
    incoming.studentId,
    incoming.date,
    incoming.sessionId || incoming.scheduleSessionId || incoming.classSessionId || '',
    incoming.sourceReportId || '',
    incoming.sourceAttendanceIndex ?? '',
  ].join('::')

  if (!sameNaturalKey) {
    return false
  }

  return (
    String(current.attendanceStatus || current.status || '') !== String(incoming.attendanceStatus || incoming.status || '') ||
    String(current.creditLabel || '') !== String(incoming.creditLabel || '') ||
    String(current.source || '') !== String(incoming.source || '')
  )
}

function getTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}
