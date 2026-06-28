import { buildOnlineAccessState, getOnlineAccessMessage } from './online-access-control.js'

export const ROLLBACK_PREVIEW_SOURCE = 'c5.3e'
export const ROLLBACK_PREVIEW_AUDIT_ENTITY_TYPE = 'audit_log_entry'

const ROLLBACK_PREVIEW_ROLES = new Set(['owner', 'qtv', 'center_admin', 'admin'])
const AUDIT_SELECT_FIELDS = 'center_id, entity_type, local_id, payload, source_module, source_version, created_at, updated_at'

export function canPreviewRollback(accessState = {}) {
  const state = buildOnlineAccessState(accessState)
  const rawRole = String(accessState?.role || accessState?.membership?.role || '').trim().toLowerCase()
  const role = rawRole === 'admin' ? 'admin' : state.role
  const canPreview = Boolean(state.canRead && (ROLLBACK_PREVIEW_ROLES.has(role) || ROLLBACK_PREVIEW_ROLES.has(state.role)))

  return {
    ok: canPreview,
    canPreview,
    role,
    reason: canPreview ? 'preview-allowed-c5-3e-admin-style' : state.reason,
    message: canPreview ? '' : getOnlineAccessMessage(state),
    teacherConsultantHold:
      state.role === 'teacher' || state.role === 'consultant'
        ? 'teacher/consultant direct write HOLD - rollback preview restricted to admin-style roles'
        : '',
    accessState: state,
  }
}

export async function loadAuditEntriesForEntity({
  supabase,
  centerId,
  entityType,
  entityLocalId,
  accessState,
  limit = 12,
} = {}) {
  const access = canPreviewRollback({
    ...accessState,
    centerId: accessState?.centerId || centerId,
  })

  if (!access.canPreview) {
    return {
      ok: false,
      skipped: true,
      entries: [],
      error: access.teacherConsultantHold || access.message,
      access,
    }
  }

  if (!supabase) {
    return { ok: false, skipped: true, entries: [], error: 'Missing Supabase client.' }
  }

  const normalizedCenterId = normalizeText(centerId)
  const normalizedEntityType = normalizeText(entityType)
  const normalizedEntityLocalId = normalizeText(entityLocalId)

  if (!normalizedCenterId || !normalizedEntityType || !normalizedEntityLocalId) {
    return { ok: false, skipped: true, entries: [], error: 'Missing rollback preview target.' }
  }

  const { data, error } = await supabase
    .from('center_cloud_entities')
    .select(AUDIT_SELECT_FIELDS)
    .eq('center_id', normalizedCenterId)
    .eq('entity_type', ROLLBACK_PREVIEW_AUDIT_ENTITY_TYPE)
    .order('updated_at', { ascending: false })
    .limit(Math.max(1, Math.min(Number(limit) || 12, 50)))

  if (error) {
    return {
      ok: false,
      entries: [],
      error: String(error?.message || error || 'Cannot read audit_log_entry rollback preview.'),
      detail: error,
    }
  }

  const entries = (Array.isArray(data) ? data : [])
    .map(normalizeAuditEntry)
    .filter((entry) => (
      entry &&
      entry.entityType === normalizedEntityType &&
      entry.entityLocalId === normalizedEntityLocalId
    ))

  return {
    ok: true,
    entries,
    empty: entries.length === 0,
    previewOnly: true,
  }
}

export function buildRollbackPreviewFromAuditEntry(auditEntry = {}) {
  const normalizedEntry = normalizeAuditEntry(auditEntry)

  if (!normalizedEntry) {
    return {
      canPreview: false,
      previewOnly: true,
      source: ROLLBACK_PREVIEW_SOURCE,
      error: 'Audit entry is not valid.',
    }
  }

  return normalizeRollbackPreview({
    canPreview: true,
    entityType: normalizedEntry.entityType,
    entityLocalId: normalizedEntry.entityLocalId,
    auditEntryId: normalizedEntry.id || normalizedEntry.localId,
    action: normalizedEntry.action,
    actorRole: normalizedEntry.actorRole,
    auditCreatedAt: normalizedEntry.createdAt,
    beforePayload: normalizedEntry.beforePayload,
    afterPayload: normalizedEntry.afterPayload,
    changedFields: normalizedEntry.changedFields,
    diffSummary: formatRollbackPreviewDiff(normalizedEntry.beforePayload, normalizedEntry.afterPayload, normalizedEntry.changedFields),
    previewOnly: true,
    source: ROLLBACK_PREVIEW_SOURCE,
  })
}

export function normalizeRollbackPreview(preview = {}) {
  return {
    canPreview: Boolean(preview.canPreview),
    entityType: normalizeText(preview.entityType),
    entityLocalId: normalizeText(preview.entityLocalId),
    auditEntryId: normalizeText(preview.auditEntryId),
    action: normalizeText(preview.action) || 'unknown_update',
    actorRole: normalizeText(preview.actorRole) || 'unknown',
    auditCreatedAt: normalizeText(preview.auditCreatedAt),
    beforePayload: normalizePayload(preview.beforePayload),
    afterPayload: normalizePayload(preview.afterPayload),
    changedFields: Array.isArray(preview.changedFields)
      ? preview.changedFields.map(normalizeText).filter(Boolean)
      : [],
    diffSummary: Array.isArray(preview.diffSummary) ? preview.diffSummary : [],
    previewOnly: true,
    source: ROLLBACK_PREVIEW_SOURCE,
    error: normalizeText(preview.error),
  }
}

export function formatRollbackPreviewDiff(beforePayload = null, afterPayload = null, changedFields = []) {
  const before = normalizePayload(beforePayload)
  const after = normalizePayload(afterPayload)

  if (!before && !after) {
    return []
  }

  const fields = Array.isArray(changedFields) && changedFields.length
    ? changedFields
    : Array.from(new Set([
        ...Object.keys(before || {}),
        ...Object.keys(after || {}),
      ])).filter((field) => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null))

  return fields.map((field) => ({
    field,
    before: summarizePreviewValue(before?.[field]),
    after: summarizePreviewValue(after?.[field]),
  }))
}

function normalizeAuditEntry(row = {}) {
  const payload = normalizePayload(row.payload) || row

  if (!payload || typeof payload !== 'object') {
    return null
  }

  return {
    id: normalizeText(payload.id),
    localId: normalizeText(row.local_id || payload.localId),
    entityType: normalizeText(payload.entityType),
    entityLocalId: normalizeText(payload.entityLocalId),
    action: normalizeText(payload.action),
    actorRole: normalizeText(payload.actorRole),
    createdAt: normalizeText(payload.createdAt || row.updated_at || row.created_at),
    beforePayload: normalizePayload(payload.beforePayload),
    afterPayload: normalizePayload(payload.afterPayload),
    changedFields: Array.isArray(payload.changedFields)
      ? payload.changedFields.map(normalizeText).filter(Boolean)
      : [],
    previewOnly: true,
  }
}

function summarizePreviewValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Chưa có dữ liệu'
  }

  if (Array.isArray(value)) {
    return `${value.length} mục`
  }

  if (typeof value === 'object') {
    return `${Object.keys(value).length} trường`
  }

  return String(value)
}

function normalizePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeText(value) {
  return String(value ?? '').trim()
}
