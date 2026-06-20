import { sanitizeCloudPayload } from './cloud-db-entities.js'

export const ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE = 'attendance_baseline_state'
export const SESSION_REPORT_CLOUD_ENTITY_TYPE = 'session_report'
export const BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH = 'NEEDS SQL/ALLOWLIST PATCH'
export const BASELINE_SESSION_REPORT_CLOUD_SOURCE_VERSION = 'f19h-baseline-session-report-alpha-v1'
export const ATTENDANCE_BASELINE_STATE_STORAGE_KEY = 'ichessCenterOS.attendanceBaselineState.dreamhome'
export const SESSION_REPORTS_STORAGE_KEY = 'ichessCenterOS.sessionReports.dreamhome'

const DEFAULT_CENTER_ID = 'dreamhome'
const ALLOWED_BASELINE_SESSION_REPORT_ENTITY_TYPES = new Set([
  ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE,
  SESSION_REPORT_CLOUD_ENTITY_TYPE,
])
const BASELINE_STATE_STATUSES = new Set(['notStarted', 'draft', 'locked', 'unlocked'])

export function isAllowedBaselineSessionReportCloudEntityType(entityType) {
  return ALLOWED_BASELINE_SESSION_REPORT_ENTITY_TYPES.has(String(entityType || ''))
}

export function createBaselineSessionReportCloudDryRun({
  centerId = DEFAULT_CENTER_ID,
  baselineState = null,
  sessionReports = null,
  storage = getLocalStorage(),
  remoteAllowlistReady = false,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const baselineInput = baselineState === null
    ? parseJsonObject(storage?.getItem?.(getBaselineStateStorageKey(normalizedCenterId)))
    : baselineState
  const reportInputs = Array.isArray(sessionReports)
    ? sessionReports
    : parseJsonArray(storage?.getItem?.(SESSION_REPORTS_STORAGE_KEY))
  const baselineSummary = createEntityDryRunSummary({
    centerId: normalizedCenterId,
    entityType: ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE,
    total: baselineInput && Object.keys(baselineInput).length ? 1 : 0,
    remoteAllowlistReady,
  })
  const sessionReportSummary = createEntityDryRunSummary({
    centerId: normalizedCenterId,
    entityType: SESSION_REPORT_CLOUD_ENTITY_TYPE,
    total: reportInputs.length,
    remoteAllowlistReady,
  })

  if (baselineSummary.total) {
    const baselineResult = buildAttendanceBaselineStateCloudEntity({
      centerId: normalizedCenterId,
      state: baselineInput,
    })
    applyEntityDryRunResult(baselineSummary, baselineResult, 0)
  }

  reportInputs.forEach((report, index) => {
    const reportResult = buildSessionReportCloudEntity({
      centerId: normalizedCenterId,
      report,
    })
    applyEntityDryRunResult(sessionReportSummary, reportResult, index)
  })

  finalizeEntityDryRunSummary(baselineSummary)
  finalizeEntityDryRunSummary(sessionReportSummary)

  return {
    centerId: normalizedCenterId,
    sourceVersion: BASELINE_SESSION_REPORT_CLOUD_SOURCE_VERSION,
    entities: {
      [ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE]: baselineSummary,
      [SESSION_REPORT_CLOUD_ENTITY_TYPE]: sessionReportSummary,
    },
    total: baselineSummary.total + sessionReportSummary.total,
    valid: baselineSummary.valid + sessionReportSummary.valid,
    invalid: baselineSummary.invalid + sessionReportSummary.invalid,
    skipped: baselineSummary.skipped + sessionReportSummary.skipped,
    readyForRealPush: baselineSummary.readyForRealPush && sessionReportSummary.readyForRealPush,
    realPushStatus: remoteAllowlistReady
      ? (baselineSummary.readyForRealPush && sessionReportSummary.readyForRealPush ? 'ready' : 'blocked')
      : BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH,
  }
}

export function buildAttendanceBaselineStateCloudEntity({
  centerId = DEFAULT_CENTER_ID,
  state = {},
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const validation = validateAttendanceBaselineStateCloudPayload(state)

  if (!validation.ok) {
    return validation
  }

  const localId = createAttendanceBaselineStateCloudLocalId(normalizedCenterId)

  return {
    ok: true,
    localId,
    data: {
      center_id: normalizedCenterId,
      entity_type: ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload({
        ...validation.state,
        centerId: normalizedCenterId,
        payloadVersion: validation.state.payloadVersion || BASELINE_SESSION_REPORT_CLOUD_SOURCE_VERSION,
      }),
      source_module: 'attendanceBaselineState',
      source_version: BASELINE_SESSION_REPORT_CLOUD_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
    },
  }
}

export function validateAttendanceBaselineStateCloudPayload(state = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, error: 'Baseline state không phải object hợp lệ.' }
  }

  const status = BASELINE_STATE_STATUSES.has(state.status) ? state.status : 'notStarted'
  const auditLog = Array.isArray(state.auditLog)
    ? state.auditLog.map((entry, index) => normalizeBaselineAuditEntry(entry, index)).filter(Boolean)
    : []

  return {
    ok: true,
    state: {
      status,
      lockedAt: normalizeNullableText(state.lockedAt),
      lockedBy: normalizeNullableText(state.lockedBy),
      unlockedAt: normalizeNullableText(state.unlockedAt),
      unlockedBy: normalizeNullableText(state.unlockedBy),
      lastActionAt: normalizeNullableText(state.lastActionAt),
      lastActionBy: normalizeNullableText(state.lastActionBy),
      unlockReason: String(state.unlockReason || ''),
      note: String(state.note || ''),
      auditLog,
      updatedAt: normalizeNullableText(state.updatedAt || state.lastActionAt),
    },
  }
}

export function buildSessionReportCloudEntity({
  centerId = DEFAULT_CENTER_ID,
  report = {},
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const validation = validateSessionReportCloudPayload(report)

  if (!validation.ok) {
    return validation
  }

  const localId = createSessionReportCloudLocalId(validation.report)

  return {
    ok: true,
    localId,
    data: {
      center_id: normalizedCenterId,
      entity_type: SESSION_REPORT_CLOUD_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload({
        ...validation.report,
        centerId: normalizedCenterId,
        payloadVersion: validation.report.payloadVersion || BASELINE_SESSION_REPORT_CLOUD_SOURCE_VERSION,
        attendanceIsCanonical: false,
        canonicalAttendanceEntity: 'attendance_record',
      }),
      source_module: 'sessionReports',
      source_version: BASELINE_SESSION_REPORT_CLOUD_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
    },
  }
}

export function validateSessionReportCloudPayload(report = {}) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { ok: false, error: 'Session report không phải object hợp lệ.' }
  }

  const sessionId = normalizeText(report.sessionId)
  const occurrenceDate = normalizeText(report.occurrenceDate || report.date)
  const id = normalizeText(report.id) || createSessionReportId(sessionId, occurrenceDate)

  if (!id) {
    return { ok: false, error: 'Thiếu report id hoặc sessionId + occurrenceDate.' }
  }

  if (occurrenceDate && !isValidDateKey(occurrenceDate)) {
    return { ok: false, error: 'occurrenceDate không hợp lệ.' }
  }

  const normalizedReport = {
    id,
    sessionId,
    classSessionId: normalizeText(report.classSessionId),
    scheduleSessionId: normalizeText(report.scheduleSessionId),
    occurrenceDate,
    teacherId: normalizeText(report.teacherId),
    teacherName: String(report.teacherName || ''),
    learningGroups: normalizeLearningGroups(report.learningGroups),
    guestParticipants: normalizeGuestParticipants(report.guestParticipants),
    teachingAssistantNotes: String(report.teachingAssistantNotes || ''),
    classSituation: String(report.classSituation || ''),
    suggestions: String(report.suggestions || ''),
    attendance: normalizeLegacyReportAttendance(report.attendance),
    attendanceIsCanonical: false,
    canonicalAttendanceEntity: 'attendance_record',
    isDemoAttendance: Boolean(report.isDemoAttendance),
    isImportedAttendance: Boolean(report.isImportedAttendance),
    sourceModule: String(report.sourceModule || ''),
    sourceTag: String(report.sourceTag || ''),
    importBatchId: String(report.importBatchId || ''),
    demoBatchId: String(report.demoBatchId || ''),
    createdAt: normalizeNullableText(report.createdAt),
    updatedAt: normalizeNullableText(report.updatedAt || report.createdAt),
  }

  if (!hasMeaningfulSessionReportContent(normalizedReport)) {
    return { ok: false, error: 'Session report không có nội dung meaningful.' }
  }

  return {
    ok: true,
    report: normalizedReport,
  }
}

export function createAttendanceBaselineStateCloudLocalId(centerId = DEFAULT_CENTER_ID) {
  return [
    ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE,
    normalizeText(centerId) || DEFAULT_CENTER_ID,
  ].map(slugifyIdPart).join('::')
}

export function createSessionReportCloudLocalId(report = {}) {
  const id = normalizeText(report.id)

  if (id) {
    return [SESSION_REPORT_CLOUD_ENTITY_TYPE, id].map(slugifyIdPart).join('::')
  }

  return [
    SESSION_REPORT_CLOUD_ENTITY_TYPE,
    report.sessionId,
    report.occurrenceDate,
  ].map(slugifyIdPart).join('::')
}

export function evaluateBaselineSessionReportCloudReadiness({
  cloudReady = false,
  signedIn = false,
  membershipReady = false,
  centerId = DEFAULT_CENTER_ID,
  appAllowlistReady = true,
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
    blockers.push('App allowlist chưa có attendance_baseline_state/session_report.')
  }
  if (!remoteAllowlistReady) {
    blockers.push(BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH)
  }
  if (!explicitUserAction) {
    blockers.push('Thiếu thao tác người dùng explicit.')
  }
  if (!dryRunPreview || dryRunPreview.valid <= 0) {
    blockers.push('Dry-run chưa có entity hợp lệ.')
  }
  if (dryRunPreview?.invalid > 0) {
    blockers.push('Dry-run còn entity invalid/skipped.')
  }

  return {
    ok: blockers.length === 0,
    status: blockers.includes(BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH)
      ? BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH
      : blockers.length
        ? 'blocked'
        : 'ready',
    blockers,
  }
}

function applyEntityDryRunResult(summary, result, index) {
  if (result.ok) {
    summary.valid += 1
    summary.validEntities.push(result.data)
    return
  }

  summary.invalid += 1
  summary.skipped += 1

  if (summary.invalidSamples.length < 5) {
    summary.invalidSamples.push({
      index,
      id: normalizeText(result.id),
      reason: result.error,
    })
  }
}

function finalizeEntityDryRunSummary(summary) {
  summary.estimatedCloudEntityCount = summary.validEntities.length
  summary.appAllowlistReady = isAllowedBaselineSessionReportCloudEntityType(summary.entityType)
  summary.readyForRealPush =
    summary.appAllowlistReady &&
    summary.remoteAllowlistReady &&
    summary.valid > 0 &&
    summary.invalid === 0
  summary.realPushStatus = summary.remoteAllowlistReady
    ? (summary.readyForRealPush ? 'ready' : 'blocked')
    : BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH
}

function createEntityDryRunSummary({
  centerId,
  entityType,
  total,
  remoteAllowlistReady = false,
}) {
  return {
    entityType,
    centerId,
    sourceVersion: BASELINE_SESSION_REPORT_CLOUD_SOURCE_VERSION,
    total,
    valid: 0,
    invalid: 0,
    skipped: 0,
    invalidSamples: [],
    estimatedCloudEntityCount: 0,
    appAllowlistReady: false,
    remoteAllowlistReady: Boolean(remoteAllowlistReady),
    readyForRealPush: false,
    realPushStatus: BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH,
    validEntities: [],
  }
}

function normalizeBaselineAuditEntry(entry = {}, index = 0) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null
  }

  return {
    id: normalizeText(entry.id) || `baseline-audit-${index + 1}`,
    action: normalizeText(entry.action) || 'updateBaselineRecord',
    at: normalizeNullableText(entry.at),
    byRole: normalizeNullableText(entry.byRole),
    byName: normalizeNullableText(entry.byName),
    studentId: normalizeNullableText(entry.studentId),
    recordId: normalizeNullableText(entry.recordId),
    reason: String(entry.reason || ''),
    note: String(entry.note || ''),
  }
}

function normalizeLearningGroups(groups) {
  return (Array.isArray(groups) ? groups : [])
    .filter((group) => group && typeof group === 'object')
    .map((group, index) => ({
      id: normalizeText(group.id) || `learning-group-${index + 1}`,
      title: String(group.title || ''),
      studentIds: normalizeStringArray(group.studentIds),
      contentLines: normalizeStringArray(group.contentLines),
      note: String(group.note || ''),
    }))
}

function normalizeGuestParticipants(guests) {
  return (Array.isArray(guests) ? guests : [])
    .filter((guest) => guest && typeof guest === 'object')
    .map((guest, index) => ({
      id: normalizeText(guest.id) || `guest-${index + 1}`,
      displayName: String(guest.displayName || ''),
      participationType: String(guest.participationType || ''),
      attendanceStatus: String(guest.attendanceStatus || guest.participationType || ''),
      note: String(guest.note || ''),
    }))
}

function normalizeLegacyReportAttendance(attendance) {
  return (Array.isArray(attendance) ? attendance : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      studentId: normalizeText(item.studentId),
      attendanceStatus: String(item.attendanceStatus || item.status || ''),
      note: String(item.note || ''),
      legacyOnly: true,
      canonicalEntity: 'attendance_record',
    }))
    .filter((item) => item.studentId)
}

function hasMeaningfulSessionReportContent(report = {}) {
  return Boolean(
    report.learningGroups?.length ||
      report.guestParticipants?.length ||
      normalizeText(report.teachingAssistantNotes) ||
      normalizeText(report.classSituation) ||
      normalizeText(report.suggestions) ||
      report.attendance?.length ||
      report.isImportedAttendance ||
      report.isDemoAttendance ||
      report.sourceModule ||
      report.importBatchId,
  )
}

function createSessionReportId(sessionId, occurrenceDate) {
  const normalizedSessionId = normalizeText(sessionId)
  const normalizedDate = normalizeText(occurrenceDate)

  if (!normalizedSessionId || !normalizedDate) {
    return ''
  }

  return `report-${slugifyIdPart(normalizedSessionId)}-${normalizedDate}`
}

function getBaselineStateStorageKey(centerId = DEFAULT_CENTER_ID) {
  return `ichessCenterOS.attendanceBaselineState.${slugifyIdPart(centerId || DEFAULT_CENTER_ID)}`
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

function parseJsonObject(rawValue) {
  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean)))
    : []
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
