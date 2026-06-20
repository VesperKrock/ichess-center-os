import {
  loadStoredAttendanceRecords,
  normalizeStoredAttendanceRecord,
  normalizeStoredAttendanceRecords,
} from './attendance-records.js'
import { sanitizeCloudPayload } from './cloud-db-entities.js'

export const ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE = 'attendance_record'
export const ATTENDANCE_RECORD_CLOUD_SOURCE_VERSION = 'f19h-attendance-alpha-v1'
export const ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH = 'NEEDS SQL/ALLOWLIST PATCH'
export const ATTENDANCE_RECORD_STORAGE_KEY = 'ichessCenterOS.attendanceRecords.dreamhome'

const DEFAULT_CENTER_ID = 'dreamhome'
const ALLOWED_ATTENDANCE_RECORD_CLOUD_ENTITY_TYPES = new Set([
  ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
])
const ALLOWED_ATTENDANCE_RECORD_CLOUD_SOURCES = new Set([
  'initialBaseline',
  'admin',
  'teacher',
  'consultant',
  'correction',
])
const ATTENDANCE_RECORD_DRY_RUN_SOURCE_KEYS = [
  'initialBaseline',
  'admin',
  'teacher',
  'consultant',
  'correction',
]

export function isAllowedAttendanceRecordCloudEntityType(entityType) {
  return ALLOWED_ATTENDANCE_RECORD_CLOUD_ENTITY_TYPES.has(String(entityType || ''))
}

export function isAllowedAttendanceRecordCloudSource(source) {
  return ALLOWED_ATTENDANCE_RECORD_CLOUD_SOURCES.has(String(source || ''))
}

export function createAttendanceRecordCloudDryRun({
  centerId = DEFAULT_CENTER_ID,
  records = null,
  storage = getLocalStorage(),
  remoteAllowlistReady = false,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const sourceRecords = Array.isArray(records)
    ? normalizeStoredAttendanceRecords(records)
    : loadStoredAttendanceRecords(normalizedCenterId, storage)
  const summary = createEmptyAttendanceRecordDryRunSummary(normalizedCenterId, sourceRecords.length)

  sourceRecords.forEach((record, index) => {
    const result = buildAttendanceRecordCloudEntity({
      centerId: normalizedCenterId,
      record,
    })

    if (result.ok) {
      summary.valid += 1
      summary.validEntities.push(result.data)
      summary.countBySource[result.source] += 1
      return
    }

    summary.invalid += 1
    summary.skipped += 1

    if (summary.invalidSamples.length < 5) {
      summary.invalidSamples.push({
        index,
        id: normalizeText(record?.id),
        source: normalizeText(record?.source),
        reason: result.error,
      })
    }
  })

  summary.estimatedCloudEntityCount = summary.validEntities.length
  summary.appAllowlistReady = isAllowedAttendanceRecordCloudEntityType(ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE)
  summary.remoteAllowlistReady = Boolean(remoteAllowlistReady)
  summary.readyForRealPush =
    summary.appAllowlistReady &&
    summary.remoteAllowlistReady &&
    summary.valid > 0 &&
    summary.invalid === 0
  summary.realPushStatus = summary.remoteAllowlistReady
    ? (summary.readyForRealPush ? 'ready' : 'blocked')
    : ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH

  return summary
}

export function buildAttendanceRecordCloudEntity({
  centerId = DEFAULT_CENTER_ID,
  record = {},
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const validation = validateAttendanceRecordCloudPayload(record)

  if (!validation.ok) {
    return validation
  }

  const localId = createAttendanceRecordCloudLocalId(validation.record)

  return {
    ok: true,
    source: validation.record.source,
    localId,
    data: {
      center_id: normalizedCenterId,
      entity_type: ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload({
        ...validation.record,
        centerId: normalizedCenterId,
        payloadVersion: validation.record.payloadVersion || ATTENDANCE_RECORD_CLOUD_SOURCE_VERSION,
      }),
      source_module: 'attendanceRecords',
      source_version: ATTENDANCE_RECORD_CLOUD_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
    },
  }
}

export function validateAttendanceRecordCloudPayload(record = {}) {
  const normalizedRecord = normalizeStoredAttendanceRecord(record)

  if (!normalizedRecord) {
    return { ok: false, error: 'Attendance record không hợp lệ.' }
  }

  if (!normalizeText(normalizedRecord.studentId)) {
    return { ok: false, error: 'Thiếu studentId.' }
  }

  if (!isValidDateKey(normalizedRecord.date)) {
    return { ok: false, error: 'Thiếu hoặc sai date.' }
  }

  if (!isAllowedAttendanceRecordCloudSource(normalizedRecord.source)) {
    return {
      ok: false,
      error: `Source không thuộc phạm vi F19H.2b: ${normalizeText(normalizedRecord.source) || 'trống'}.`,
    }
  }

  if (!normalizeText(normalizedRecord.attendanceStatus)) {
    return { ok: false, error: 'Thiếu attendanceStatus.' }
  }

  return {
    ok: true,
    record: normalizedRecord,
  }
}

export function createAttendanceRecordCloudLocalId(record = {}) {
  const normalizedRecord = normalizeStoredAttendanceRecord(record)

  if (!normalizedRecord) {
    return ''
  }

  const sessionKey = getAttendanceRecordCloudSessionKey(normalizedRecord)
  const creditKey = normalizedRecord.sourceCreditIndex ?? normalizedRecord.creditNumber ?? normalizedRecord.creditLabel ?? 'credit'
  const parts = normalizedRecord.source === 'initialBaseline'
    ? [
        ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
        normalizedRecord.studentId,
        normalizedRecord.date,
        normalizedRecord.source,
        creditKey,
      ]
    : [
        ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
        normalizedRecord.studentId,
        normalizedRecord.date,
        sessionKey,
        normalizedRecord.source,
        creditKey,
      ]

  return parts.map(slugifyIdPart).join('::')
}

export function getAttendanceRecordCloudSessionKey(record = {}) {
  return normalizeText(
    record.sessionId ||
      record.scheduleSessionId ||
      record.classSessionId ||
      (record.source === 'initialBaseline' ? 'baseline' : 'session'),
  )
}

export function evaluateAttendanceRecordCloudReadiness({
  cloudReady = false,
  signedIn = false,
  membershipReady = false,
  centerId = DEFAULT_CENTER_ID,
  appAllowlistReady = isAllowedAttendanceRecordCloudEntityType(ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE),
  remoteAllowlistReady = false,
  dryRunPreview = null,
  explicitUserAction = false,
} = {}) {
  const blockers = []

  if (!cloudReady) {
    blockers.push('Cloud DB chưa ready.')
  }
  if (!signedIn) {
    blockers.push('Chưa đăng nhập Supabase.')
  }
  if (!membershipReady) {
    blockers.push('Chưa có quyền center.')
  }
  if (!normalizeText(centerId)) {
    blockers.push('Thiếu centerId.')
  }
  if (!appAllowlistReady) {
    blockers.push('App allowlist chưa có attendance_record.')
  }
  if (!remoteAllowlistReady) {
    blockers.push(ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH)
  }
  if (!explicitUserAction) {
    blockers.push('Thiếu thao tác người dùng explicit.')
  }
  if (!dryRunPreview || dryRunPreview.valid <= 0) {
    blockers.push('Dry-run chưa có record hợp lệ.')
  }
  if (dryRunPreview?.invalid > 0) {
    blockers.push('Dry-run còn record invalid/skipped.')
  }

  return {
    ok: blockers.length === 0,
    status: blockers.includes(ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH)
      ? ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH
      : blockers.length
        ? 'blocked'
        : 'ready',
    blockers,
  }
}

export function mergeAttendanceRecordCloudPayloads({
  localRecords = [],
  cloudPayloads = [],
} = {}) {
  const mergedByLocalId = new Map()
  const skipped = []

  normalizeStoredAttendanceRecords(localRecords).forEach((record) => {
    mergedByLocalId.set(createAttendanceRecordCloudLocalId(record), record)
  })

  ;(Array.isArray(cloudPayloads) ? cloudPayloads : []).forEach((payload, index) => {
    const validation = validateAttendanceRecordCloudPayload(payload)

    if (!validation.ok) {
      skipped.push({
        index,
        id: normalizeText(payload?.id),
        source: normalizeText(payload?.source),
        reason: validation.error,
      })
      return
    }

    const cloudRecord = validation.record
    const localId = createAttendanceRecordCloudLocalId(cloudRecord)
    const localRecord = mergedByLocalId.get(localId)

    if (!localRecord || isCloudRecordNewer(cloudRecord, localRecord)) {
      mergedByLocalId.set(localId, cloudRecord)
    }
  })

  return {
    records: normalizeStoredAttendanceRecords(Array.from(mergedByLocalId.values())),
    skipped,
  }
}

export function createAttendanceRecordsPullBackup(
  storage = getLocalStorage(),
  centerId = DEFAULT_CENTER_ID,
) {
  if (!storage) {
    return null
  }

  const createdAt = new Date().toISOString()
  const backupKey = `ichessCenterOS.backup.beforeAttendanceRecordPull.${createdAt.replace(/[:.]/g, '-')}`
  const attendanceKey = `ichessCenterOS.attendanceRecords.${slugifyIdPart(centerId || DEFAULT_CENTER_ID)}`

  storage.setItem(
    backupKey,
    JSON.stringify({
      reason: 'before-attendance-record-cloud-pull-f19h2b',
      phase: 'f19h2b-attendance-record-dry-run',
      createdAt,
      keys: {
        attendanceRecords: storage.getItem(attendanceKey),
      },
    }),
  )

  return backupKey
}

function createEmptyAttendanceRecordDryRunSummary(centerId, total) {
  return {
    entityType: ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
    centerId,
    sourceVersion: ATTENDANCE_RECORD_CLOUD_SOURCE_VERSION,
    total,
    valid: 0,
    invalid: 0,
    skipped: 0,
    countBySource: ATTENDANCE_RECORD_DRY_RUN_SOURCE_KEYS.reduce((counts, source) => {
      counts[source] = 0
      return counts
    }, {}),
    invalidSamples: [],
    estimatedCloudEntityCount: 0,
    appAllowlistReady: false,
    remoteAllowlistReady: false,
    readyForRealPush: false,
    realPushStatus: ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH,
    validEntities: [],
  }
}

function isCloudRecordNewer(cloudRecord = {}, localRecord = {}) {
  const cloudTime = getComparableTime(cloudRecord.updatedAt || cloudRecord.createdAt)
  const localTime = getComparableTime(localRecord.updatedAt || localRecord.createdAt)

  return cloudTime >= localTime
}

function getComparableTime(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function isValidDateKey(value) {
  const text = normalizeText(value)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false
  }

  const date = new Date(text)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function getLocalStorage() {
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

function slugifyIdPart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'empty'
}
