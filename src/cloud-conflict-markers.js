export const TUITION_CONFLICT_SOURCE = 'c5.3d'
export const TUITION_CONFLICT_SEVERITY = 'A'

export const SENSITIVE_TUITION_FIELDS = Object.freeze([
  'totalSessions',
  'usedSessions',
  'remainingSessions',
  'tuitionAmount',
  'totalAmount',
  'discountAmount',
  'paidAmount',
  'debtAmount',
  'paymentStatus',
  'payments',
  'currentTermId',
  'currentTermNumber',
  'termHistory',
  'status',
])

export function getSensitiveTuitionFields() {
  return [...SENSITIVE_TUITION_FIELDS]
}

export function hasSensitiveTuitionConflict(localRecord = {}, cloudRecord = {}) {
  return getTuitionSensitiveConflictFields(localRecord, cloudRecord).length > 0
}

export function getTuitionSensitiveConflictFields(localRecord = {}, cloudRecord = {}) {
  return SENSITIVE_TUITION_FIELDS.filter((field) => {
    const localValue = normalizeComparableValue(localRecord?.[field])
    const cloudValue = normalizeComparableValue(cloudRecord?.[field])
    return JSON.stringify(localValue) !== JSON.stringify(cloudValue)
  })
}

export function buildTuitionConflictMarker({
  localRecord = {},
  cloudRecord = {},
  cloudUpdatedAt = '',
  reason = 'sensitive_fields_changed_on_both_sides',
} = {}) {
  const conflictFields = getTuitionSensitiveConflictFields(localRecord, cloudRecord)

  if (!conflictFields.length) {
    return null
  }

  return {
    syncConflict: true,
    conflictType: 'tuition_record_package',
    conflictSeverity: TUITION_CONFLICT_SEVERITY,
    conflictReason: reason,
    conflictFields,
    localUpdatedAt: normalizeNullableText(localRecord?.updatedAt || localRecord?.createdAt),
    cloudUpdatedAt: normalizeNullableText(cloudUpdatedAt || cloudRecord?.updatedAt || cloudRecord?.createdAt),
    localSnapshot: sanitizeConflictSnapshot(localRecord),
    cloudSnapshot: sanitizeConflictSnapshot(cloudRecord),
    detectedAt: new Date().toISOString(),
    source: TUITION_CONFLICT_SOURCE,
  }
}

export function mergeTuitionRecordWithConflictGuard({
  localRecord = {},
  cloudRecord = {},
  cloudUpdatedAt = '',
} = {}) {
  const conflictMarker = buildTuitionConflictMarker({
    localRecord,
    cloudRecord,
    cloudUpdatedAt,
  })

  if (!conflictMarker) {
    return {
      record: { ...localRecord, ...cloudRecord },
      conflict: null,
      changed: JSON.stringify(localRecord) !== JSON.stringify({ ...localRecord, ...cloudRecord }),
    }
  }

  const record = {
    ...localRecord,
    syncConflict: true,
    conflictMarker,
  }

  return {
    record,
    conflict: conflictMarker,
    changed: JSON.stringify(localRecord) !== JSON.stringify(record),
  }
}

export function normalizeConflictMarker(marker = null) {
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)) {
    return null
  }

  return {
    syncConflict: true,
    conflictType: normalizeNullableText(marker.conflictType) || 'tuition_record_package',
    conflictSeverity: normalizeNullableText(marker.conflictSeverity) || TUITION_CONFLICT_SEVERITY,
    conflictReason: normalizeNullableText(marker.conflictReason) || 'sensitive_fields_changed_on_both_sides',
    conflictFields: Array.isArray(marker.conflictFields)
      ? marker.conflictFields.map(normalizeNullableText).filter(Boolean)
      : [],
    localUpdatedAt: normalizeNullableText(marker.localUpdatedAt),
    cloudUpdatedAt: normalizeNullableText(marker.cloudUpdatedAt),
    localSnapshot: sanitizeConflictSnapshot(marker.localSnapshot),
    cloudSnapshot: sanitizeConflictSnapshot(marker.cloudSnapshot),
    detectedAt: normalizeNullableText(marker.detectedAt) || new Date().toISOString(),
    source: normalizeNullableText(marker.source) || TUITION_CONFLICT_SOURCE,
  }
}

function sanitizeConflictSnapshot(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null
  }

  return JSON.parse(JSON.stringify(record))
}

function normalizeComparableValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeComparableValue)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalizeComparableValue(value[key])
        return result
      }, {})
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  return value ?? null
}

function normalizeNullableText(value) {
  const text = String(value ?? '').trim()
  return text || ''
}
