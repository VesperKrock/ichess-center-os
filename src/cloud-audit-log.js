import { sanitizeCloudPayload } from './cloud-db-entities.js'
import { buildOnlineAccessState, getOnlineAccessMessage } from './online-access-control.js'

export const AUDIT_LOG_ENTRY_ENTITY_TYPE = 'audit_log_entry'
export const C53_AUDIT_LOG_SOURCE_VERSION = 'c5-3c-audit-log-v1'
export const C53_TEACHER_CONSULTANT_WRITE_HOLD =
  'teacher/consultant direct write HOLD - audit_log_entry needs admin-style policy'

const C53_AUDIT_WRITE_ROLES = new Set(['owner', 'qtv', 'center_admin', 'admin'])
const C53_AUDIT_ENTITY_ALLOWLIST = new Set([
  'tuition_record_package',
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'schedule_session',
  'student',
  'teacher',
])

export function canWriteC53AuditLogEntry(accessState = {}) {
  const state = buildOnlineAccessState(accessState)
  const rawRole = String(accessState?.role || accessState?.membership?.role || '').trim().toLowerCase()
  const canWrite = Boolean(state.canWrite && (C53_AUDIT_WRITE_ROLES.has(state.role) || rawRole === 'admin'))

  return {
    ok: canWrite,
    canWrite,
    role: rawRole === 'admin' ? 'admin' : state.role,
    reason: canWrite ? 'write-allowed-c5-3c-audit-admin-style' : state.reason,
    message: canWrite ? '' : getOnlineAccessMessage(state),
    teacherConsultantHold:
      state.role === 'teacher' || state.role === 'consultant'
        ? C53_TEACHER_CONSULTANT_WRITE_HOLD
        : '',
    accessState: state,
  }
}

export async function writeC53AuditLogEntry({
  supabase,
  centerId,
  userId = null,
  accessState,
  entry = {},
} = {}) {
  try {
    const recordResult = buildC53AuditLogCloudEntity({
      centerId,
      userId,
      accessState,
      entry,
    })

    if (!recordResult.ok) {
      return recordResult
    }

    if (!supabase) {
      return { ok: false, skipped: true, error: 'Missing Supabase client.' }
    }

    const { error } = await supabase
      .from('center_cloud_entities')
      .upsert([recordResult.data], { onConflict: 'center_id,entity_type,local_id' })

    if (error) {
      return {
        ok: false,
        error: String(error?.message || error || 'Cannot upsert audit_log_entry.'),
        detail: error,
      }
    }

    return {
      ok: true,
      count: 1,
      entityType: AUDIT_LOG_ENTRY_ENTITY_TYPE,
      localId: recordResult.localId,
      payload: recordResult.payload,
    }
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || 'Audit log write failed.'),
      detail: error,
    }
  }
}

export function buildC53AuditLogCloudEntity({
  centerId = 'dreamhome',
  userId = null,
  accessState,
  entry = {},
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || 'dreamhome'
  const access = canWriteC53AuditLogEntry({
    ...accessState,
    centerId: accessState?.centerId || normalizedCenterId,
  })

  if (!access.canWrite) {
    return {
      ok: false,
      skipped: true,
      error: access.teacherConsultantHold || access.message,
      access,
    }
  }

  const entityType = normalizeText(entry.entityType)

  if (!entityType) {
    return { ok: false, skipped: true, error: 'Missing audited entityType.' }
  }

  if (entityType === AUDIT_LOG_ENTRY_ENTITY_TYPE) {
    return { ok: false, skipped: true, error: 'Loop guard: audit_log_entry is not audited.' }
  }

  if (!C53_AUDIT_ENTITY_ALLOWLIST.has(entityType)) {
    return { ok: false, skipped: true, error: `Entity ${entityType} is not in C5.3C audit allowlist.` }
  }

  const entityLocalId = normalizeText(entry.entityLocalId)

  if (!entityLocalId) {
    return { ok: false, skipped: true, error: 'Missing audited entityLocalId.' }
  }

  const createdAt = normalizeIsoDate(entry.createdAt) || new Date().toISOString()
  const action = normalizeText(entry.action) || 'unknown_update'
  const actorRole = access.role || normalizeText(entry.actorRole)
  const payload = sanitizeCloudPayload({
    id: normalizeText(entry.id) || createAuditEntryId({ entityType, entityLocalId, createdAt }),
    centerId: normalizedCenterId,
    entityType,
    entityLocalId,
    action,
    actorUserId: normalizeText(entry.actorUserId || userId) || null,
    actorRole: actorRole || null,
    beforePayload: normalizeSnapshot(entry.beforePayload),
    afterPayload: normalizeSnapshot(entry.afterPayload),
    changedFields: normalizeChangedFields(entry.changedFields),
    reason: normalizeText(entry.reason),
    source: 'runtime/c5.3c',
    createdAt,
    correlationId: normalizeText(entry.correlationId) || createCorrelationId({ entityType, entityLocalId, createdAt }),
    clientId: normalizeText(entry.clientId) || getRuntimeClientId(),
    schemaVersion: 1,
  })
  const localId = createAuditLogEntryLocalId({
    centerId: normalizedCenterId,
    entityType,
    entityLocalId,
    createdAt,
  })

  return {
    ok: true,
    localId,
    payload,
    data: {
      center_id: normalizedCenterId,
      entity_type: AUDIT_LOG_ENTRY_ENTITY_TYPE,
      local_id: localId,
      payload,
      source_module: 'audit_log',
      source_version: C53_AUDIT_LOG_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
      updated_at: createdAt,
    },
  }
}

export function createAuditLogEntryLocalId({
  centerId = 'dreamhome',
  entityType = '',
  entityLocalId = '',
  createdAt = new Date().toISOString(),
} = {}) {
  return [
    'audit-log-entry',
    slugifyIdPart(centerId),
    slugifyIdPart(entityType),
    slugifyIdPart(entityLocalId),
    slugifyIdPart(createdAt),
    createShortRandomId(),
  ].join('::')
}

export function getChangedFields(beforePayload = null, afterPayload = null) {
  if (!beforePayload || !afterPayload || typeof beforePayload !== 'object' || typeof afterPayload !== 'object') {
    return []
  }

  const keys = new Set([...Object.keys(beforePayload), ...Object.keys(afterPayload)])
  const changed = []

  for (const key of keys) {
    if (JSON.stringify(beforePayload[key] ?? null) !== JSON.stringify(afterPayload[key] ?? null)) {
      changed.push(key)
    }
  }

  return changed.sort()
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return sanitizeCloudPayload(value)
}

function normalizeChangedFields(value) {
  return Array.isArray(value)
    ? value.map((field) => normalizeText(field)).filter(Boolean).sort()
    : []
}

function normalizeIsoDate(value) {
  const text = normalizeText(value)

  if (!text) {
    return ''
  }

  const date = new Date(text)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function createAuditEntryId({ entityType, entityLocalId, createdAt }) {
  return `audit-${slugifyIdPart(entityType)}-${slugifyIdPart(entityLocalId)}-${slugifyIdPart(createdAt)}-${createShortRandomId()}`
}

function createCorrelationId({ entityType, entityLocalId, createdAt }) {
  return `c5-3c-${slugifyIdPart(entityType)}-${slugifyIdPart(entityLocalId)}-${slugifyIdPart(createdAt)}`
}

function getRuntimeClientId() {
  if (typeof window === 'undefined' || !window.navigator) {
    return 'runtime-client-unknown'
  }

  return `runtime-client-${slugifyIdPart(window.navigator.userAgent || 'browser')}`.slice(0, 160)
}

function createShortRandomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return Math.random().toString(36).slice(2, 10)
}

function normalizeText(value) {
  return String(value ?? '').trim()
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
