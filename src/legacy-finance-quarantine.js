import { sampleCashflowCategories, sampleCashflowTransactions } from './cashflow-data.js'

export const C54_LEGACY_FINANCE_SCOPES = Object.freeze([
  'cashflow',
  'cashflowCategories',
  'cashbookSettings',
  'cashbookReconciliations',
])
export const C54_LEGACY_SNAPSHOT_SCHEMA = 'c5.4-legacy-finance-quarantine-v1'

export function getC54LegacyFinanceSourceKey(scope, centerId) {
  if (!C54_LEGACY_FINANCE_SCOPES.includes(scope)) throw new Error('Legacy Finance scope không hợp lệ.')
  return `ichessCenterOS.${scope}.${normalizeCenterId(centerId)}`
}

export function getC54LegacyFinanceSnapshotKey(centerId) {
  return `ichessCenterOS.c5_4.legacyFinanceSnapshot.${normalizeCenterId(centerId)}.v1`
}

export async function inspectAndQuarantineC54LegacyFinance({ storage, centerId, now } = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return { ok: false, migrationRequired: true, error: 'Không truy cập được storage để bảo toàn legacy Finance.' }
  }
  const normalizedCenterId = normalizeCenterId(centerId)
  const snapshotKey = getC54LegacyFinanceSnapshotKey(normalizedCenterId)

  try {
    const existingRaw = storage.getItem(snapshotKey)
    if (existingRaw) {
      const existing = JSON.parse(existingRaw)
      if (existing?.schema !== C54_LEGACY_SNAPSHOT_SCHEMA
        || existing?.centerId !== normalizedCenterId
        || !existing?.checksum) {
        return { ok: false, migrationRequired: true, error: 'Legacy Finance snapshot hiện hữu không hợp lệ; khóa authoritative replacement.' }
      }
      const expectedChecksum = `SHA-256:${await sha256Hex(JSON.stringify({
        centerId: normalizedCenterId,
        sources: existing.sources,
      }))}`
      if (existing.checksum !== expectedChecksum) {
        return { ok: false, migrationRequired: true, error: 'Legacy Finance snapshot checksum không hợp lệ; khóa authoritative replacement.' }
      }
      return { ok: true, migrationRequired: true, snapshotKey, snapshot: existing, classifications: existing.classifications, preserved: true }
    }

    const sources = Object.fromEntries(C54_LEGACY_FINANCE_SCOPES.map((scope) => {
      const key = getC54LegacyFinanceSourceKey(scope, normalizedCenterId)
      return [scope, { key, raw: storage.getItem(key) }]
    }))
    const classifications = classifyLegacyFinanceSources(sources)
    const migrationRequired = Object.values(classifications).some((entry) =>
      ['REAL_LOCAL_ONLY', 'UNCERTAIN'].includes(entry.classification),
    )

    if (!migrationRequired) {
      return { ok: true, migrationRequired: false, snapshotKey: '', snapshot: null, classifications, preserved: false }
    }

    const capturedAt = typeof now === 'function' ? now() : new Date().toISOString()
    const checksumPayload = JSON.stringify({ centerId: normalizedCenterId, sources })
    const checksum = await sha256Hex(checksumPayload)
    const snapshot = {
      schema: C54_LEGACY_SNAPSHOT_SCHEMA,
      centerId: normalizedCenterId,
      capturedAt,
      sourceKeys: Object.values(sources).map((entry) => entry.key),
      classifications,
      summary: summarizeLegacyFinanceSources(sources),
      checksum: `SHA-256:${checksum}`,
      sources,
      authorityStatus: 'QUARANTINED_NOT_ACTIVE',
      migrationStatus: 'MIGRATION_REQUIRED',
    }
    const concurrentRaw = storage.getItem(snapshotKey)
    if (concurrentRaw) {
      const concurrent = JSON.parse(concurrentRaw)
      if (concurrent?.schema !== C54_LEGACY_SNAPSHOT_SCHEMA
        || concurrent?.centerId !== normalizedCenterId
        || !concurrent?.checksum) {
        return { ok: false, migrationRequired: true, error: 'Legacy Finance snapshot concurrent không hợp lệ.' }
      }
      const concurrentChecksum = `SHA-256:${await sha256Hex(JSON.stringify({
        centerId: normalizedCenterId,
        sources: concurrent.sources,
      }))}`
      if (concurrent.checksum !== concurrentChecksum) {
        return { ok: false, migrationRequired: true, error: 'Legacy Finance snapshot concurrent checksum không hợp lệ.' }
      }
      return { ok: true, migrationRequired: true, snapshotKey, snapshot: concurrent, classifications: concurrent.classifications, preserved: true }
    }
    storage.setItem(snapshotKey, JSON.stringify(snapshot))
    const persistedRaw = storage.getItem(snapshotKey)
    if (!persistedRaw || JSON.parse(persistedRaw)?.checksum !== snapshot.checksum) {
      return { ok: false, migrationRequired: true, error: 'Không xác nhận được legacy Finance snapshot sau khi ghi.' }
    }
    return { ok: true, migrationRequired: true, snapshotKey, snapshot, classifications, preserved: true }
  } catch (error) {
    return {
      ok: false,
      migrationRequired: true,
      error: `Không thể bảo toàn legacy Finance: ${String(error?.message || error)}`,
    }
  }
}

export function classifyLegacyFinanceSources(sources = {}) {
  return {
    cashflow: classifyCollection(sources.cashflow?.raw, isExactSampleTransactions),
    cashflowCategories: classifyCollection(sources.cashflowCategories?.raw, isExactSampleCategories),
    cashbookSettings: classifySettings(sources.cashbookSettings?.raw),
    cashbookReconciliations: classifyCollection(
      sources.cashbookReconciliations?.raw,
      (value) => Array.isArray(value) && value.length === 0,
      'RECONSTRUCTABLE_CACHE',
    ),
  }
}

function classifyCollection(raw, isFixture, emptyClassification = 'RECONSTRUCTABLE_CACHE') {
  if (raw === null) return { classification: emptyClassification, reason: 'KEY_ABSENT' }
  const parsed = parseJson(raw)
  if (!parsed.ok || !Array.isArray(parsed.value)) {
    return { classification: 'UNCERTAIN', reason: 'INVALID_OR_NON_ARRAY' }
  }
  if (!parsed.value.length) return { classification: emptyClassification, reason: 'EMPTY_COLLECTION' }
  if (isFixture(parsed.value)) return { classification: 'FIXTURE_SAMPLE', reason: 'EXACT_KNOWN_SAMPLE' }
  return { classification: 'UNCERTAIN', reason: 'NONEMPTY_NOT_EXACT_FIXTURE' }
}

function classifySettings(raw) {
  if (raw === null) return { classification: 'RECONSTRUCTABLE_CACHE', reason: 'KEY_ABSENT' }
  const parsed = parseJson(raw)
  if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    return { classification: 'UNCERTAIN', reason: 'INVALID_OR_NON_OBJECT' }
  }
  const value = parsed.value
  if (!value.isConfigured && Number(value.openingBalance || 0) === 0) {
    return { classification: 'FIXTURE_SAMPLE', reason: 'UNCONFIGURED_ZERO_DEFAULT' }
  }
  return { classification: 'REAL_LOCAL_ONLY', reason: 'CONFIGURED_OR_NONZERO_OPENING_BALANCE' }
}

function isExactSampleTransactions(value) {
  if (value.length !== sampleCashflowTransactions.length) return false
  return JSON.stringify(value.map(transactionSignature))
    === JSON.stringify(sampleCashflowTransactions.map(transactionSignature))
}

function transactionSignature(transaction = {}) {
  return {
    id: String(transaction.id || ''),
    type: String(transaction.type || ''),
    category: String(transaction.category || ''),
    amount: Number(transaction.amount || 0),
    transactionDate: String(transaction.transactionDate || ''),
    method: String(transaction.method || ''),
    personName: String(transaction.personName || ''),
    recordedBy: String(transaction.recordedBy || ''),
    note: String(transaction.note || ''),
    sourceModule: String(transaction.sourceModule || 'manual'),
    createdAt: String(transaction.createdAt || ''),
    attachment: transaction.attachment || null,
  }
}

function isExactSampleCategories(value) {
  if (value.length !== sampleCashflowCategories.length) return false
  return JSON.stringify(value.map(categorySignature))
    === JSON.stringify(sampleCashflowCategories.map(categorySignature))
}

function categorySignature(category = {}) {
  return {
    id: String(category.id || ''),
    name: String(category.name || ''),
    type: String(category.type || ''),
    isArchived: Boolean(category.isArchived),
    createdAt: String(category.createdAt || ''),
  }
}

function summarizeLegacyFinanceSources(sources) {
  const transactions = parseJson(sources.cashflow?.raw).value
  const categories = parseJson(sources.cashflowCategories?.raw).value
  const settings = parseJson(sources.cashbookSettings?.raw).value
  const reconciliations = parseJson(sources.cashbookReconciliations?.raw).value
  const transactionList = Array.isArray(transactions) ? transactions : []
  return {
    transactionCount: transactionList.length,
    incomeTotalMinor: sumSafeMoney(transactionList.filter((item) => item?.type !== 'expense')),
    expenseTotalMinor: sumSafeMoney(transactionList.filter((item) => item?.type === 'expense')),
    categoryCount: Array.isArray(categories) ? categories.length : 0,
    reconciliationCount: Array.isArray(reconciliations) ? reconciliations.length : 0,
    openingBalanceMinor: Number.isSafeInteger(Number(settings?.openingBalance))
      ? Number(settings.openingBalance)
      : null,
  }
}

function sumSafeMoney(items) {
  return items.reduce((sum, item) => {
    const amount = Number(item?.amount)
    return Number.isSafeInteger(amount) && amount >= 0 && Number.isSafeInteger(sum + amount)
      ? sum + amount
      : sum
  }, 0)
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 không sẵn sàng.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('').toUpperCase()
}

function parseJson(raw) {
  if (raw === null || raw === undefined) return { ok: true, value: null }
  try { return { ok: true, value: JSON.parse(raw) } } catch { return { ok: false, value: null } }
}

function normalizeCenterId(value) {
  const centerId = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  if (!centerId) throw new Error('Thiếu center_id cho legacy Finance inventory.')
  return centerId
}
