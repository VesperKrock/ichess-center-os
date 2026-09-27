const ATTENDANCE_RECORDS_PREFIX = 'ichessCenterOS.attendanceRecords.'
const ATTENDANCE_BASELINE_PREFIX = 'ichessCenterOS.attendanceBaselineState.'
const SESSION_REPORTS_PREFIX = 'ichessCenterOS.sessionReports.'

const DEMO_MARKERS = new Set([
  'attendance-board-demo-foundation',
  'bang-diem-danh-demo',
  'angel-wings-2026-06-attendance',
])

/**
 * Read-only inventory of legacy browser Attendance data.
 *
 * This is intentionally isolated from the live Attendance projection. Its
 * result is suitable for a human-reviewed export only; callers must never use
 * it as an application fallback or write it to canonical Supabase authority.
 */
export function inventoryLegacyAttendanceBrowserData({
  storage = null,
  centerId = '',
  canonicalRecords = [],
} = {}) {
  const normalizedCenterId = normalizeCenterId(centerId)
  const keys = listRelevantKeys(storage, normalizedCenterId)
  const canonicalByIdentity = buildCanonicalIdentityMap(canonicalRecords)
  const records = []
  const malformedKeys = []
  const baselineStates = []
  const sessionReports = []

  for (const key of keys) {
    const result = readJson(storage, key)
    if (!result.ok) {
      malformedKeys.push({ key, reason: result.reason })
      continue
    }

    if (key.startsWith(ATTENDANCE_RECORDS_PREFIX)) {
      if (!Array.isArray(result.value)) {
        malformedKeys.push({ key, reason: 'expected-array' })
        continue
      }
      result.value.forEach((record, index) => {
        records.push(classifyLegacyRecord(record, key, index, canonicalByIdentity))
      })
      continue
    }

    if (key.startsWith(ATTENDANCE_BASELINE_PREFIX)) {
      if (!isPlainObject(result.value)) {
        malformedKeys.push({ key, reason: 'expected-object' })
        continue
      }
      baselineStates.push({
        key,
        status: String(result.value.status || 'notStarted'),
        lastActionAt: nullableText(result.value.lastActionAt),
        auditEntryCount: Array.isArray(result.value.auditLog) ? result.value.auditLog.length : 0,
      })
      continue
    }

    if (key.startsWith(SESSION_REPORTS_PREFIX)) {
      if (!Array.isArray(result.value)) {
        malformedKeys.push({ key, reason: 'expected-array' })
        continue
      }
      sessionReports.push({ key, count: result.value.length })
    }
  }

  const validRecords = records.filter((record) => !['MALFORMED', 'UNKNOWN'].includes(record.classification))
  const dateValues = validRecords.map((record) => record.date).filter(Boolean).sort()
  const sourceTypes = Array.from(new Set(validRecords.map((record) => record.source).filter(Boolean))).sort()
  const studentIds = Array.from(new Set(validRecords.map((record) => record.studentId).filter(Boolean))).sort()
  const classificationCounts = records.reduce((counts, record) => {
    counts[record.classification] = (counts[record.classification] || 0) + 1
    return counts
  }, {})

  return {
    ok: true,
    readOnly: true,
    authority: false,
    autoImport: false,
    autoMerge: false,
    autoDelete: false,
    centerId: normalizedCenterId,
    keys,
    recordCount: records.length,
    baselineStates,
    sessionReports,
    malformedKeys,
    dateRange: {
      from: dateValues[0] || '',
      to: dateValues.at(-1) || '',
    },
    sourceTypes,
    studentIds,
    classificationCounts,
    records,
  }
}

function classifyLegacyRecord(record, key, index, canonicalByIdentity) {
  if (!isPlainObject(record)) {
    return baseResult('MALFORMED', record, key, index)
  }

  const studentId = nullableText(record.studentId)
  const date = nullableText(record.date || record.occurrenceDate)
  if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return baseResult('MALFORMED', record, key, index)
  }

  if (isDemoRecord(record)) {
    return baseResult('DEMO_OR_TEST', record, key, index)
  }

  const identity = getAttendanceIdentity(record)
  const canonical = canonicalByIdentity.get(identity)
  if (!canonical) {
    return baseResult('LOCAL_ONLY', record, key, index)
  }

  const same = stableComparable(record) === stableComparable(canonical)
  return baseResult(same ? 'EXACT_DUPLICATE' : 'CONFLICT', record, key, index)
}

function baseResult(classification, record, key, index) {
  return {
    classification,
    key,
    index,
    id: nullableText(record?.id),
    studentId: nullableText(record?.studentId),
    date: nullableText(record?.date || record?.occurrenceDate),
    source: nullableText(record?.source || record?.sourceModule) || 'unknown',
  }
}

function buildCanonicalIdentityMap(records) {
  return new Map(
    (Array.isArray(records) ? records : [])
      .filter(isPlainObject)
      .map((record) => [getAttendanceIdentity(record), record]),
  )
}

function getAttendanceIdentity(record) {
  return [
    nullableText(record?.id),
    nullableText(record?.studentId),
    nullableText(record?.date || record?.occurrenceDate),
    nullableText(record?.classSessionId),
    nullableText(record?.scheduleSessionId || record?.sessionId),
    nullableText(record?.source),
  ].join('|')
}

function stableComparable(record) {
  const ignored = new Set(['cloudVersion', 'cloudUpdatedAt', 'cloudDeletedAt'])
  return JSON.stringify(sortValue(record, ignored))
}

function sortValue(value, ignored) {
  if (Array.isArray(value)) return value.map((item) => sortValue(item, ignored))
  if (!isPlainObject(value)) return value
  return Object.keys(value)
    .filter((key) => !ignored.has(key))
    .sort()
    .reduce((result, key) => {
      result[key] = sortValue(value[key], ignored)
      return result
    }, {})
}

function isDemoRecord(record) {
  return Boolean(
    record?.isDemoAttendance
    || DEMO_MARKERS.has(String(record?.sourceModule || ''))
    || DEMO_MARKERS.has(String(record?.demoBatchId || ''))
    || DEMO_MARKERS.has(String(record?.importBatchId || '')),
  )
}

function listRelevantKeys(storage, centerId) {
  if (!storage || typeof storage.getItem !== 'function') return []
  const keys = new Set()
  if (Number.isSafeInteger(Number(storage.length)) && typeof storage.key === 'function') {
    for (let index = 0; index < Number(storage.length); index += 1) {
      const key = String(storage.key(index) || '')
      if (isRelevantKey(key, centerId)) keys.add(key)
    }
  }
  if (centerId) {
    for (const prefix of [ATTENDANCE_RECORDS_PREFIX, ATTENDANCE_BASELINE_PREFIX, SESSION_REPORTS_PREFIX]) {
      const key = `${prefix}${centerId}`
      try {
        if (storage.getItem(key) !== null) keys.add(key)
      } catch {
        // Inventory is best-effort and must never interrupt canonical loading.
      }
    }
  }
  return Array.from(keys).sort()
}

function isRelevantKey(key, centerId) {
  const matchesPrefix = [ATTENDANCE_RECORDS_PREFIX, ATTENDANCE_BASELINE_PREFIX, SESSION_REPORTS_PREFIX]
    .some((prefix) => key.startsWith(prefix))
  return matchesPrefix && (!centerId || key.endsWith(`.${centerId}`))
}

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return { ok: false, reason: 'missing' }
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false, reason: 'malformed-json' }
  }
}

function normalizeCenterId(value) {
  const text = String(value || '').trim().toLowerCase()
  return text && text.length <= 160 && /^[a-z0-9_-]+$/.test(text) ? text : ''
}

function nullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
