import { sanitizeCloudPayload } from './cloud-db-entities.js'

export const SCHEDULE_SESSION_CLOUD_ENTITY_TYPE = 'schedule_session'
export const SCHEDULE_SESSION_CLOUD_SOURCE_VERSION = 'f19h-schedule-session-alpha-v1'
export const SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH = 'NEEDS SQL/ALLOWLIST PATCH'
export const SCHEDULE_STORAGE_KEY = 'ichessCenterOS.schedule.dreamhome'

const DEFAULT_CENTER_ID = 'dreamhome'
const VALID_SCHEDULE_TYPES = new Set(['recurring', 'oneOff'])
const VALID_SCHEDULE_DAYS = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])
const VALID_SCHEDULE_STATUSES = new Set(['scheduled', 'done', 'cancelled'])
const VALID_SCHEDULE_OCCURRENCE_REASONS = new Set(['makeup', 'trial', 'extra', 'event', 'other'])
const VALID_SCHEDULE_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'mixed'])
const LEGACY_RECURRING_TYPES = new Set(['weekly', 'repeat', 'repeating'])
const LEGACY_ONE_OFF_TYPES = new Set(['one-off', 'oneoff', 'single', 'adHoc', 'adhoc'])
const ALLOWED_SCHEDULE_SESSION_CLOUD_ENTITY_TYPES = new Set([
  SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
])

export function isAllowedScheduleSessionCloudEntityType(entityType) {
  return ALLOWED_SCHEDULE_SESSION_CLOUD_ENTITY_TYPES.has(String(entityType || ''))
}

export function createScheduleSessionCloudDryRun({
  centerId = DEFAULT_CENTER_ID,
  scheduleSessions = null,
  storage = getLocalStorage(),
  remoteAllowlistReady = false,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const sourceSessions = Array.isArray(scheduleSessions)
    ? scheduleSessions
    : parseJsonArray(storage?.getItem?.(getScheduleStorageKey(normalizedCenterId)))
  const summary = createEmptyScheduleSessionDryRunSummary(normalizedCenterId, sourceSessions.length)

  sourceSessions.forEach((session, index) => {
    const result = buildScheduleSessionCloudEntity({
      centerId: normalizedCenterId,
      session,
    })

    if (result.ok) {
      summary.valid += 1
      summary.validEntities.push(result.data)
      summary.countByScheduleType[result.scheduleType] += 1

      if (!result.session.teacherId) {
        summary.sessionsMissingTeacher += 1
      }
      if (!result.session.studentIds.length) {
        summary.sessionsMissingStudents += 1
      }
      return
    }

    summary.invalid += 1
    summary.skipped += 1

    if (result.scheduleType === 'legacyUnknown') {
      summary.countByScheduleType.legacyUnknown += 1
    }

    if (summary.invalidSamples.length < 5) {
      summary.invalidSamples.push({
        index,
        id: normalizeText(session?.id),
        scheduleType: result.scheduleType || normalizeText(session?.scheduleType),
        reason: result.error,
      })
    }
  })

  summary.estimatedCloudEntityCount = summary.validEntities.length
  summary.appAllowlistReady = isAllowedScheduleSessionCloudEntityType(SCHEDULE_SESSION_CLOUD_ENTITY_TYPE)
  summary.remoteAllowlistReady = Boolean(remoteAllowlistReady)
  summary.readyForRealPush =
    summary.appAllowlistReady &&
    summary.remoteAllowlistReady &&
    summary.valid > 0 &&
    summary.invalid === 0
  summary.realPushStatus = summary.remoteAllowlistReady
    ? (summary.readyForRealPush ? 'ready' : 'blocked')
    : SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH

  return summary
}

export function buildScheduleSessionCloudEntity({
  centerId = DEFAULT_CENTER_ID,
  session = {},
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const validation = validateScheduleSessionCloudPayload(session)

  if (!validation.ok) {
    return validation
  }

  const localId = createScheduleSessionCloudLocalId(validation.session)

  return {
    ok: true,
    scheduleType: validation.session.scheduleType,
    session: validation.session,
    localId,
    data: {
      center_id: normalizedCenterId,
      entity_type: SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload({
        ...validation.session,
        centerId: normalizedCenterId,
        payloadVersion: validation.session.payloadVersion || SCHEDULE_SESSION_CLOUD_SOURCE_VERSION,
        classSessionEntity: 'class_session',
        scheduleSessionEntity: SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
      }),
      source_module: 'schedule',
      source_version: SCHEDULE_SESSION_CLOUD_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
    },
  }
}

export function validateScheduleSessionCloudPayload(session = {}) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    return {
      ok: false,
      scheduleType: 'legacyUnknown',
      error: 'Schedule session khong phai object hop le.',
    }
  }

  const scheduleTypeInfo = normalizeScheduleType(session.scheduleType)
  const scheduleType = scheduleTypeInfo.type
  const id = normalizeText(session.id) || createDeterministicScheduleSessionId(session, scheduleType)

  if (!id) {
    return {
      ok: false,
      scheduleType: scheduleTypeInfo.group,
      error: 'Thieu schedule id hoac deterministic id.',
    }
  }

  if (!scheduleType) {
    return {
      ok: false,
      id,
      scheduleType: 'legacyUnknown',
      error: `scheduleType khong hop le: ${normalizeText(session.scheduleType) || 'trong'}.`,
    }
  }

  const dayOfWeek = normalizeText(session.dayOfWeek)
  const date = normalizeNullableDate(session.date)
  const startDate = normalizeNullableDate(session.startDate)
  const endDate = normalizeNullableDate(session.endDate)
  const startTime = normalizeTime(session.startTime)
  const endTime = normalizeTime(session.endTime)

  if (scheduleType === 'recurring' && !VALID_SCHEDULE_DAYS.has(dayOfWeek)) {
    return {
      ok: false,
      id,
      scheduleType,
      error: 'Recurring schedule thieu dayOfWeek hop le.',
    }
  }

  if (scheduleType === 'oneOff' && !date) {
    return {
      ok: false,
      id,
      scheduleType,
      error: 'One-off schedule thieu date hop le.',
    }
  }

  if (!startTime || !endTime) {
    return {
      ok: false,
      id,
      scheduleType,
      error: 'Thieu startTime hoac endTime hop le.',
    }
  }

  if (endTime <= startTime) {
    return {
      ok: false,
      id,
      scheduleType,
      error: 'endTime phai lon hon startTime.',
    }
  }

  return {
    ok: true,
    session: {
      id,
      scheduleType,
      originalScheduleType: scheduleTypeInfo.original,
      scheduleTypeWasNormalized: scheduleTypeInfo.wasNormalized,
      title: String(session.title || ''),
      classSessionId: normalizeText(session.classSessionId),
      dayOfWeek: scheduleType === 'oneOff'
        ? normalizeText(dayOfWeek || getDayOfWeekFromDate(date))
        : dayOfWeek,
      startDate: scheduleType === 'recurring' ? startDate : null,
      endDate: scheduleType === 'recurring' ? endDate : null,
      date: scheduleType === 'oneOff' ? date : null,
      occurrenceReason: scheduleType === 'oneOff'
        ? normalizeOccurrenceReason(session.occurrenceReason)
        : '',
      startTime,
      endTime,
      room: String(session.room || ''),
      teacherId: normalizeNullableText(session.teacherId),
      teacherName: String(session.teacherName || ''),
      studentIds: normalizeStringArray(session.studentIds),
      groupName: String(session.groupName || ''),
      level: VALID_SCHEDULE_LEVELS.has(session.level) ? session.level : 'mixed',
      status: VALID_SCHEDULE_STATUSES.has(session.status) ? session.status : 'scheduled',
      note: String(session.note || ''),
      sourceModule: String(session.sourceModule || ''),
      sourceTag: String(session.sourceTag || ''),
      importBatchId: String(session.importBatchId || ''),
      datasetId: String(session.datasetId || ''),
      datasetVersion: String(session.datasetVersion || ''),
      isControlledFixture: Boolean(session.isControlledFixture),
      conflictMetadata: normalizeConflictMetadata(session.conflictMetadata || session.conflicts),
      createdAt: normalizeNullableText(session.createdAt),
      updatedAt: normalizeNullableText(session.updatedAt || session.createdAt),
    },
  }
}

export function createScheduleSessionCloudLocalId(session = {}) {
  const validation = validateScheduleSessionCloudPayload(session)

  if (!validation.ok) {
    return ''
  }

  return [
    SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
    validation.session.id,
  ].map(slugifyIdPart).join('::')
}

export function evaluateScheduleSessionCloudReadiness({
  cloudReady = false,
  signedIn = false,
  membershipReady = false,
  centerId = DEFAULT_CENTER_ID,
  appAllowlistReady = isAllowedScheduleSessionCloudEntityType(SCHEDULE_SESSION_CLOUD_ENTITY_TYPE),
  remoteAllowlistReady = false,
  dryRunPreview = null,
  explicitUserAction = false,
} = {}) {
  const blockers = []

  if (!cloudReady) {
    blockers.push('Cloud DB chua ready.')
  }
  if (!signedIn) {
    blockers.push('Chua dang nhap Supabase.')
  }
  if (!membershipReady) {
    blockers.push('Chua co quyen center.')
  }
  if (!normalizeText(centerId)) {
    blockers.push('Thieu centerId.')
  }
  if (!appAllowlistReady) {
    blockers.push('App allowlist chua co schedule_session.')
  }
  if (!remoteAllowlistReady) {
    blockers.push(SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH)
  }
  if (!explicitUserAction) {
    blockers.push('Thieu thao tac nguoi dung explicit.')
  }
  if (!dryRunPreview || dryRunPreview.valid <= 0) {
    blockers.push('Dry-run chua co schedule_session hop le.')
  }
  if (dryRunPreview?.invalid > 0) {
    blockers.push('Dry-run con schedule_session invalid/skipped.')
  }

  return {
    ok: blockers.length === 0,
    status: blockers.includes(SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH)
      ? SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH
      : blockers.length
        ? 'blocked'
        : 'ready',
    blockers,
  }
}

function createEmptyScheduleSessionDryRunSummary(centerId, total) {
  return {
    entityType: SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
    centerId,
    sourceVersion: SCHEDULE_SESSION_CLOUD_SOURCE_VERSION,
    total,
    valid: 0,
    invalid: 0,
    skipped: 0,
    countByScheduleType: {
      recurring: 0,
      oneOff: 0,
      legacyUnknown: 0,
    },
    sessionsMissingTeacher: 0,
    sessionsMissingStudents: 0,
    invalidSamples: [],
    estimatedCloudEntityCount: 0,
    appAllowlistReady: false,
    remoteAllowlistReady: false,
    readyForRealPush: false,
    realPushStatus: SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH,
    validEntities: [],
  }
}

function normalizeScheduleType(value) {
  const original = normalizeText(value)

  if (VALID_SCHEDULE_TYPES.has(original)) {
    return { type: original, group: original, original, wasNormalized: false }
  }
  if (LEGACY_RECURRING_TYPES.has(original)) {
    return { type: 'recurring', group: 'recurring', original, wasNormalized: true }
  }
  if (LEGACY_ONE_OFF_TYPES.has(original)) {
    return { type: 'oneOff', group: 'oneOff', original, wasNormalized: true }
  }

  return { type: '', group: 'legacyUnknown', original, wasNormalized: false }
}

function createDeterministicScheduleSessionId(session = {}, scheduleType = '') {
  const classSessionId = normalizeText(session.classSessionId)
  const type = normalizeText(scheduleType)
  const dateKey = type === 'oneOff'
    ? normalizeText(session.date)
    : normalizeText(session.dayOfWeek)
  const startTime = normalizeText(session.startTime)
  const endTime = normalizeText(session.endTime)

  if (!classSessionId || !type || !dateKey || !startTime || !endTime) {
    return ''
  }

  return [
    'schedule',
    classSessionId,
    type,
    dateKey,
    startTime,
    endTime,
  ].map(slugifyIdPart).join('-')
}

function normalizeOccurrenceReason(value) {
  const reason = normalizeText(value)
  return VALID_SCHEDULE_OCCURRENCE_REASONS.has(reason) ? reason : 'other'
}

function normalizeConflictMetadata(value) {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => ({
        id: normalizeText(item.id) || `conflict-${index + 1}`,
        type: normalizeText(item.type),
        message: String(item.message || item.note || ''),
        relatedSessionId: normalizeText(item.relatedSessionId || item.sessionId),
      }))
  }

  if (typeof value === 'object') {
    return sanitizeCloudPayload(value)
  }

  return String(value)
}

function parseJsonArray(rawValue) {
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean)))
    : []
}

function normalizeNullableDate(value) {
  const text = normalizeText(value)
  return isValidDateKey(text) ? text : null
}

function normalizeTime(value) {
  const text = normalizeText(value)
  return /^\d{2}:\d{2}$/.test(text) ? text : ''
}

function normalizeNullableText(value) {
  const text = normalizeText(value)
  return text || null
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function isValidDateKey(value) {
  const text = normalizeText(value)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false
  }

  const date = new Date(text)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

function getDayOfWeekFromDate(value) {
  const date = new Date(`${normalizeText(value)}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][date.getDay()]
}

function getScheduleStorageKey(centerId = DEFAULT_CENTER_ID) {
  return `ichessCenterOS.schedule.${slugifyIdPart(centerId || DEFAULT_CENTER_ID)}`
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
