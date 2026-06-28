import { sanitizeCloudPayload } from './cloud-db-entities.js'
import { buildOnlineAccessState, getOnlineAccessMessage } from './online-access-control.js'

export const TUITION_RECORD_PACKAGE_ENTITY_TYPE = 'tuition_record_package'
export const C52_TUITION_SOURCE_VERSION = 'c5-2c-tuition-record-package-v1'
export const C52_TEACHER_CONSULTANT_WRITE_HOLD =
  'teacher/consultant direct write HOLD - tuition_record_package needs approved scoped policy'

const C52_WRITE_ROLES = new Set(['owner', 'qtv', 'center_admin', 'admin'])
const CLOUD_ENTITY_SELECT_FIELDS =
  'center_id, entity_type, local_id, payload, source_module, source_version, updated_at, deleted_at'

export function canWriteC52TuitionRecordPackageEntity(accessState = {}) {
  const state = buildOnlineAccessState(accessState)
  const canWrite = Boolean(state.canWrite && C52_WRITE_ROLES.has(state.role))

  return {
    ok: canWrite,
    canWrite,
    role: state.role,
    reason: canWrite ? 'write-allowed-c5-2c-admin-style' : state.reason,
    message: canWrite ? '' : getOnlineAccessMessage(state),
    teacherConsultantHold:
      state.role === 'teacher' || state.role === 'consultant'
        ? C52_TEACHER_CONSULTANT_WRITE_HOLD
        : '',
    accessState: state,
  }
}

export async function pullC52TuitionRecordPackageCloudEntities({
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
    .eq('entity_type', TUITION_RECORD_PACKAGE_ENTITY_TYPE)
    .is('deleted_at', null)
    .order('updated_at', { ascending: true })

  if (error) {
    return {
      ok: false,
      error: String(error?.message || error || 'Cannot pull tuition_record_package cloud entities.'),
      detail: error,
    }
  }

  return {
    ok: true,
    records: Array.isArray(data) ? data : [],
    empty: !Array.isArray(data) || data.length === 0,
  }
}

export async function upsertC52TuitionRecordPackageCloudEntities({
  supabase,
  centerId,
  tuitionRecords = [],
  userId = null,
  accessState,
} = {}) {
  const access = canWriteC52TuitionRecordPackageEntity(accessState)

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

  const records = []
  const skipped = []

  for (const tuitionRecord of Array.isArray(tuitionRecords) ? tuitionRecords : []) {
    const result = buildTuitionRecordPackageCloudEntity({
      centerId,
      tuitionRecord,
      userId,
    })

    if (result.ok) {
      records.push(prepareCloudRecordForUpsert(result.data))
    } else {
      skipped.push({
        id: String(tuitionRecord?.id || ''),
        reason: result.error,
      })
    }
  }

  if (!records.length) {
    return { ok: true, skipped: skipped.length > 0, count: 0, skippedItems: skipped }
  }

  const { error } = await supabase
    .from('center_cloud_entities')
    .upsert(records, { onConflict: 'center_id,entity_type,local_id' })

  if (error) {
    return {
      ok: false,
      error: String(error?.message || error || 'Cannot upsert tuition_record_package cloud entities.'),
      detail: error,
      skippedItems: skipped,
    }
  }

  return {
    ok: true,
    count: records.length,
    skippedItems: skipped,
  }
}

export function subscribeToC52TuitionRecordPackageRealtime({
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
    return createRealtimeUnavailableResult('C5.2C tuition realtime degraded: Supabase client unavailable.', true, false)
  }

  const normalizedCenterId = String(centerId ?? '').trim()

  if (!normalizedCenterId) {
    return createRealtimeUnavailableResult('C5.2C tuition realtime degraded: missing center guard.', false, true)
  }

  const channel = supabase.channel(`ichess-center-tuition-record-package:${normalizedCenterId}`)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'center_cloud_entities',
      filter: `center_id=eq.${normalizedCenterId}`,
    },
    (event) => {
      const record = getC52TuitionRealtimeRecord(event, normalizedCenterId)

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
      message: status === 'SUBSCRIBED' ? 'C5.2C tuition realtime ready.' : 'C5.2C tuition realtime degraded.',
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

export function getC52TuitionRealtimeRecord(event = {}, centerId = '') {
  const record = event.new || event.record || null
  const oldRecord = event.old || null
  const candidate = record || oldRecord

  if (!candidate || candidate.entity_type !== TUITION_RECORD_PACKAGE_ENTITY_TYPE) {
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

export function mergeC52TuitionCloudRecordsIntoLocal({
  tuitionRecords = [],
  cloudRecords = [],
} = {}) {
  let nextTuitionRecords = normalizeTuitionRecordPackageList(tuitionRecords)
  const skipped = []
  const conflicts = []
  let changed = false

  for (const cloudRecord of Array.isArray(cloudRecords) ? cloudRecords : []) {
    const result = mergeTuitionRecordPackageCloudRecord(nextTuitionRecords, cloudRecord)
    nextTuitionRecords = result.records
    changed = changed || result.changed
    skipped.push(...result.skipped)
    conflicts.push(...result.conflicts)
  }

  return {
    ok: true,
    changed,
    tuitionRecords: nextTuitionRecords,
    skipped,
    conflicts,
  }
}

export function buildTuitionRecordPackageCloudEntity({
  centerId = 'dreamhome',
  tuitionRecord = {},
  userId = null,
} = {}) {
  const validation = normalizeTuitionRecordPackagePayload(tuitionRecord, { centerId })

  if (!validation.ok) {
    return validation
  }

  const localId = createTuitionRecordPackageLocalId(validation.record)

  return {
    ok: true,
    localId,
    record: validation.record,
    data: {
      center_id: String(centerId || '').trim(),
      entity_type: TUITION_RECORD_PACKAGE_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload(validation.record),
      source_module: 'tuition',
      source_version: C52_TUITION_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: validation.record.deletedAt || null,
    },
  }
}

export function createTuitionRecordPackageLocalId(tuitionRecord = {}) {
  const id = String(tuitionRecord.id || '').trim()
  return id ? `${TUITION_RECORD_PACKAGE_ENTITY_TYPE}::${slugifyIdPart(id)}` : ''
}

export function normalizeTuitionRecordPackagePayload(tuitionRecord = {}, { centerId = 'dreamhome' } = {}) {
  if (!tuitionRecord || typeof tuitionRecord !== 'object' || Array.isArray(tuitionRecord)) {
    return { ok: false, error: 'Tuition record package payload is not a valid object.' }
  }

  const id = String(tuitionRecord.id || '').trim()
  const studentId = String(tuitionRecord.studentId || '').trim()

  if (!id) {
    return { ok: false, error: 'Missing stable tuition record id.' }
  }

  if (!studentId) {
    return { ok: false, id, error: 'Missing studentId.' }
  }

  const updatedAt = normalizeNullableText(tuitionRecord.updatedAt) || new Date().toISOString()

  return {
    ok: true,
    record: {
      ...tuitionRecord,
      id,
      studentId,
      localId: createTuitionRecordPackageLocalId({ id }),
      centerId: String(centerId || '').trim() || 'dreamhome',
      packageName: String(tuitionRecord.packageName || ''),
      totalSessions: normalizeNonNegativeNumber(tuitionRecord.totalSessions),
      usedSessions: normalizeNonNegativeNumber(tuitionRecord.usedSessions),
      hasTotalSessionsData: tuitionRecord.hasTotalSessionsData !== false,
      hasUsedSessionsData: tuitionRecord.hasUsedSessionsData !== false,
      totalAmount: normalizeNonNegativeNumber(tuitionRecord.totalAmount),
      discountType: String(tuitionRecord.discountType || ''),
      discountValue: normalizeNonNegativeNumber(tuitionRecord.discountValue),
      discountAmount: normalizeNonNegativeNumber(tuitionRecord.discountAmount),
      paidAmount: normalizeNonNegativeNumber(tuitionRecord.paidAmount),
      dueDate: String(tuitionRecord.dueDate || ''),
      note: String(tuitionRecord.note || ''),
      payments: normalizeTuitionPayments(tuitionRecord.payments),
      currentTermNumber: Math.max(1, Math.trunc(normalizeNonNegativeNumber(tuitionRecord.currentTermNumber) || 1)),
      currentTermId: String(tuitionRecord.currentTermId || ''),
      startedAt: normalizeNullableText(tuitionRecord.startedAt) || '',
      termHistory: Array.isArray(tuitionRecord.termHistory) ? tuitionRecord.termHistory : [],
      createdAt: normalizeNullableText(tuitionRecord.createdAt) || updatedAt,
      updatedAt,
      deletedAt: normalizeNullableText(tuitionRecord.deletedAt) || null,
      source: 'tuition_record_package',
      schemaVersion: C52_TUITION_SOURCE_VERSION,
      attendanceLinked: false,
      attendanceAutoUpdateEnabled: false,
      usedSessionsAutoUpdateFromAttendance: false,
      remainingSessionsAutoUpdateFromAttendance: false,
    },
  }
}

function mergeTuitionRecordPackageCloudRecord(tuitionRecords = [], cloudRecord = {}) {
  if (!cloudRecord || cloudRecord.entity_type !== TUITION_RECORD_PACKAGE_ENTITY_TYPE) {
    return createMergeResult(tuitionRecords, false, [{
      entityType: cloudRecord?.entity_type || '',
      reason: 'Ignored non tuition_record_package cloud record.',
    }])
  }

  const payload = cloudRecord.payload
  const validation = normalizeTuitionRecordPackagePayload(payload, {
    centerId: cloudRecord.center_id || payload?.centerId || 'dreamhome',
  })

  if (!validation.ok) {
    return createMergeResult(tuitionRecords, false, [{ entityType: cloudRecord.entity_type, reason: validation.error }])
  }

  const incoming = validation.record
  const localId = cloudRecord.local_id || createTuitionRecordPackageLocalId(incoming)
  const currentRecords = normalizeTuitionRecordPackageList(tuitionRecords)
  const byLocalIdIndex = currentRecords.findIndex((record) => createTuitionRecordPackageLocalId(record) === localId)
  const incomingUpdatedAt = getTimestamp(cloudRecord.updated_at || incoming.updatedAt || incoming.createdAt)

  if (cloudRecord.isDeleted || cloudRecord.deleted_at || incoming.deletedAt) {
    return createMergeResult(currentRecords, false, [{
      entityType: cloudRecord.entity_type,
      localId,
      reason: 'Cloud soft delete observed; local tuition record preserved for safety.',
    }])
  }

  if (byLocalIdIndex >= 0) {
    const current = currentRecords[byLocalIdIndex]
    const currentUpdatedAt = getTimestamp(current.updatedAt || current.createdAt)

    if (currentUpdatedAt && incomingUpdatedAt && incomingUpdatedAt <= currentUpdatedAt) {
      return createMergeResult(currentRecords, false)
    }

    const nextRecords = [...currentRecords]
    nextRecords[byLocalIdIndex] = { ...current, ...incoming }
    return createMergeResult(nextRecords, JSON.stringify(current) !== JSON.stringify(nextRecords[byLocalIdIndex]))
  }

  return createMergeResult([incoming, ...currentRecords], true)
}

function normalizeTuitionRecordPackageList(tuitionRecords = []) {
  return (Array.isArray(tuitionRecords) ? tuitionRecords : [])
    .filter((record) => record && typeof record === 'object' && !Array.isArray(record))
    .map((record) => normalizeTuitionRecordPackagePayload(record).record)
    .filter(Boolean)
}

function normalizeTuitionPayments(payments) {
  return (Array.isArray(payments) ? payments : [])
    .filter((payment) => payment && typeof payment === 'object' && !Array.isArray(payment))
    .map((payment, index) => ({
      ...payment,
      id: String(payment.id || `payment-${index + 1}`),
      amount: normalizeNonNegativeNumber(payment.amount),
      paidAt: String(payment.paidAt || payment.date || ''),
      method: String(payment.method || ''),
      collectorName: String(payment.collectorName || ''),
      note: String(payment.note || ''),
      createdAt: normalizeNullableText(payment.createdAt) || '',
    }))
}

function prepareCloudRecordForUpsert(record = {}) {
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : {}
  const updatedAt = payload.updatedAt || payload.createdAt || new Date().toISOString()

  return {
    ...record,
    source_version: C52_TUITION_SOURCE_VERSION,
    updated_at: updatedAt,
    deleted_at: payload.deletedAt || record.deleted_at || null,
  }
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
    records: normalizeTuitionRecordPackageList(records),
    changed,
    skipped,
    conflicts: [],
  }
}

function normalizeNonNegativeNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0
}

function normalizeNullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function getTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
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
