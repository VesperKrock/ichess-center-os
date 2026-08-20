const LEGACY_SOURCE_MODULE = 'angel-wings-import'
const LEGACY_SOURCE_TAG = 'angel-wings-2026-06'
const LEGACY_DATASET_ID = 'angel-wings-2026-06'
const LEGACY_IMPORT_BATCH_IDS = new Set([
  'angel-wings-2026-06-f15k5',
  'angel-wings-2026-06-attendance',
])

const CENTER_SCOPED_COLLECTIONS = Object.freeze([
  'students',
  'teachers',
  'parentConsultations',
  'classSessions',
  'tuitionPackages',
  'tuition',
  'schedule',
  'sessionReports',
])

export function cleanupLegacyDatasetLocalResidue(storage = globalThis.localStorage, centerId = '') {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return { ok: true, centerId: normalizeCenterId(centerId), removedCount: 0, changedKeys: [] }
  }

  const normalizedCenterId = normalizeCenterId(centerId)
  let removedCount = 0
  const changedKeys = []

  for (const scope of CENTER_SCOPED_COLLECTIONS) {
    const key = `ichessCenterOS.${scope}.${normalizedCenterId}`
    const storedValue = storage.getItem(key)

    if (storedValue === null) {
      continue
    }

    let collection
    try {
      collection = JSON.parse(storedValue)
    } catch {
      continue
    }

    if (!Array.isArray(collection)) {
      continue
    }

    const retained = collection.filter((record) => !hasExactLegacyDatasetIdentity(record))
    const removedFromKey = collection.length - retained.length

    if (!removedFromKey) {
      continue
    }

    storage.setItem(key, JSON.stringify(retained))
    removedCount += removedFromKey
    changedKeys.push(key)
  }

  return { ok: true, centerId: normalizedCenterId, removedCount, changedKeys }
}

export function hasExactLegacyDatasetIdentity(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return false
  }

  return (
    record.sourceModule === LEGACY_SOURCE_MODULE ||
    record.sourceTag === LEGACY_SOURCE_TAG ||
    record.datasetId === LEGACY_DATASET_ID ||
    LEGACY_IMPORT_BATCH_IDS.has(record.importBatchId)
  )
}

function normalizeCenterId(centerId) {
  const normalized = String(centerId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || 'dreamhome'
}
