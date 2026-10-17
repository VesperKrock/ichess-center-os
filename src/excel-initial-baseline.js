// Typed initial-import facts. This module never writes Attendance/Finance or
// creates a cycle; commands use the existing canonical V2.4 boundary.
const integer = (value, name, min = 0) => {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`INVALID_${name}`)
  return value
}
const paymentStates = new Set(['PAID_BEFORE_ICHESS', 'UNPAID', 'PARTIAL', 'UNKNOWN'])
const discountKinds = new Set(['EXPLICIT_NONE', 'PERCENT', 'FIXED', 'PERCENT_THEN_SIBLING_VOUCHER', 'UNKNOWN'])
// A future-term entitlement is separate from this term's financial snapshot.
// Omission means legacy contract; explicit null ends a recurring entitlement.
export function validateRecurringDiscountPolicy(policy) {
  if (policy === null) return null
  const keys = ['schemaVersion', 'discountKind', 'percent', 'fixedMinor', 'siblingVoucherMinor']
  if (!policy || Array.isArray(policy) || typeof policy !== 'object'
    || Object.keys(policy).length !== keys.length || keys.some(key => !Object.hasOwn(policy, key))
    || policy.schemaVersion !== 1
    || !['PERCENT', 'FIXED', 'PERCENT_THEN_SIBLING_VOUCHER'].includes(policy.discountKind)) {
    throw new Error('INVALID_RECURRING_DISCOUNT_POLICY')
  }
  integer(policy.percent, 'RECURRING_PERCENT')
  integer(policy.fixedMinor, 'RECURRING_FIXED')
  integer(policy.siblingVoucherMinor, 'RECURRING_VOUCHER')
  const valid = policy.percent <= 100 && (policy.discountKind === 'PERCENT'
    ? policy.fixedMinor === 0 && policy.siblingVoucherMinor === 0
    : policy.discountKind === 'FIXED' ? policy.percent === 0 && policy.siblingVoucherMinor === 0
      : policy.fixedMinor === 0 && policy.siblingVoucherMinor === 100000)
  if (!valid) throw new Error('INVALID_RECURRING_DISCOUNT_POLICY')
  return Object.fromEntries(keys.map(key => [key, policy[key]]))
}
export function validateInitialFinancialFacts(facts = {}, listedPrice) {
  integer(listedPrice, 'LISTED_PRICE')
  const keys = ['discountKind', 'percent', 'fixedMinor', 'siblingVoucherMinor', 'paymentState', 'sourceDueMinor', 'collectedMinor', 'remainingMinor']
  if (!facts || Object.keys(facts).length !== keys.length || keys.some(key => !Object.hasOwn(facts, key))) throw new Error('INVALID_FINANCIAL_FACT_SHAPE')
  if (!paymentStates.has(facts.paymentState) || !discountKinds.has(facts.discountKind)) throw new Error('INVALID_SOURCE_FINANCIAL_STATE')
  let due = null
  if (facts.discountKind === 'UNKNOWN') {
    for (const key of ['percent', 'fixedMinor', 'siblingVoucherMinor']) if (facts[key] !== null) throw new Error('UNKNOWN_DISCOUNT_MUST_STAY_NULL')
  } else {
    integer(facts.percent, 'DISCOUNT_PERCENT'); integer(facts.fixedMinor, 'FIXED_DISCOUNT'); integer(facts.siblingVoucherMinor, 'SIBLING_VOUCHER')
    if (facts.percent > 100) throw new Error('INVALID_DISCOUNT_PERCENT')
    const shape = facts.discountKind === 'EXPLICIT_NONE' ? facts.percent === 0 && facts.fixedMinor === 0 && facts.siblingVoucherMinor === 0
      : facts.discountKind === 'PERCENT' ? facts.fixedMinor === 0 && facts.siblingVoucherMinor === 0
        : facts.discountKind === 'FIXED' ? facts.percent === 0 && facts.siblingVoucherMinor === 0
          : facts.fixedMinor === 0 && facts.siblingVoucherMinor === 100000
    if (!shape) throw new Error('DISCOUNT_COMPONENT_CONFLICT')
    due = integer(listedPrice * (100 - facts.percent) / 100 - facts.fixedMinor - facts.siblingVoucherMinor, 'SOURCE_DUE')
  }
  if (facts.sourceDueMinor !== due) throw new Error('SOURCE_DUE_MISMATCH')
  for (const key of ['collectedMinor', 'remainingMinor']) if (facts[key] !== null) integer(facts[key], key)
  if (facts.paymentState === 'UNKNOWN') {
    if (facts.collectedMinor !== null || facts.remainingMinor !== null) throw new Error('UNKNOWN_PAYMENT_MUST_STAY_NULL')
  } else if (facts.paymentState === 'PARTIAL') {
    if (due === null || !(facts.collectedMinor > 0) || !(facts.remainingMinor > 0)
      || facts.collectedMinor + facts.remainingMinor !== due) throw new Error('PARTIAL_PAYMENT_FACTS_REQUIRED')
  } else if (facts.paymentState === 'PAID_BEFORE_ICHESS') {
    if (due === null || facts.collectedMinor !== due || facts.remainingMinor !== 0) throw new Error('PAID_SOURCE_FACT_CONFLICT')
  } else if (facts.collectedMinor !== 0 || facts.remainingMinor !== due) throw new Error('UNPAID_SOURCE_FACT_CONFLICT')
  return { ...facts }
}

export function buildV24ImportInitialBaselineCommand({ studentId, packageCatalog, used, total,
  cutoff, sourceSha256, sourceKey, reviewNote, financialFacts, sourceOverageSessions = 0 } = {}) {
  if (!String(studentId || '').trim() || !/^[a-f\d-]{36}$/i.test(packageCatalog?.id || '')
    || !/^[a-f\d]{64}$/i.test(sourceSha256 || '') || !/^[a-f\d]{64}$/i.test(sourceKey || '')
    || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff || '') || String(reviewNote || '').trim().length < 8) throw new Error('INVALID_INITIAL_IMPORT_IDENTITY')
  integer(used, 'USED'); integer(total, 'TOTAL', 1)
  integer(sourceOverageSessions, 'SOURCE_OVERAGE')
  if (sourceOverageSessions !== Math.max(used - total, 0) || total !== packageCatalog.totalSessions) throw new Error('PACKAGE_AB_MISMATCH')
  integer(packageCatalog.version, 'PACKAGE_VERSION', 1)
  const facts = validateInitialFinancialFacts(financialFacts, packageCatalog.defaultAmount)
  return { operation: 'IMPORT_INITIAL_BASELINE', student_id: studentId, package_catalog_id: packageCatalog.id,
    expected_package_version: packageCatalog.version, total_sessions: total, baseline_used_sessions: used,
    baseline_cutoff_date: cutoff, listed_price_minor: packageCatalog.defaultAmount,
    source_sha256: sourceSha256.toLowerCase(), source_key: sourceKey.toLowerCase(),
    review_note: String(reviewNote).trim(), financial_facts: facts,
    ...(sourceOverageSessions ? { source_overage_sessions: sourceOverageSessions } : {}) }
}

export function projectVerifiedInitialBaseline(row) {
  if (row == null) return null
  if (row.state !== 'PENDING_FINANCIAL_REVIEW' || !/^[a-f\d-]{36}$/i.test(row.id || '')) throw new Error('INVALID_IMPORT_BASELINE')
  const total = integer(row.total_sessions, 'TOTAL', 1), baseline = integer(row.baseline_used_sessions, 'BASELINE')
  const contributed = integer(row.contributed_sessions, 'CONTRIBUTED')
  const sourceOverage = integer(Object.hasOwn(row, 'source_overage_sessions') ? row.source_overage_sessions : 0, 'SOURCE_OVERAGE')
  if (sourceOverage !== Math.max(baseline - total, 0) || row.used_sessions !== baseline + contributed || row.remaining_sessions !== Math.max(total - baseline - contributed, 0)) throw new Error('INVALID_IMPORT_PROGRESS')
  const financialFacts = validateInitialFinancialFacts(row.financial_facts, row.listed_price_minor)
  return { id: row.id, packageCatalogId: row.package_catalog_id, packageName: row.package_name,
    totalSessions: total, baselineUsed: baseline, contributedSessions: contributed, listedPriceMinor: row.listed_price_minor,
    usedSessions: row.used_sessions, remainingSessions: row.remaining_sessions,
    baselineCutoffDate: row.baseline_cutoff_date, financialFacts, version: integer(row.version, 'VERSION', 1),
    sourceKey: row.source_key, financialState: 'PENDING_FINANCIAL_REVIEW', fullyConfigured: false,
    ...(sourceOverage ? { sourceOverageSessions: sourceOverage } : {}) }
}

// One-time handover command for Codex/Owner through the existing V2.4 boundary.
// No Admin import/setup UI. Omitted confirmation means missing input, not unpaid.
export function buildV24AdoptInitialBaselineCommand({ studentId, baselineId, baselineVersion,
  packageVersion, confirmedPaymentComplete, recurringDiscountPolicy, reviewNote } = {}) {
  if (!String(studentId || '').trim() || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(baselineId || '')
    || String(reviewNote || '').trim().length < 8) throw new Error('INVALID_INITIAL_ADOPTION')
  integer(baselineVersion, 'BASELINE_VERSION', 1); integer(packageVersion, 'PACKAGE_VERSION', 1)
  if (confirmedPaymentComplete !== undefined && typeof confirmedPaymentComplete !== 'boolean') throw new Error('INVALID_PAYMENT_CONFIRMATION')
  return { operation: 'ADOPT_INITIAL_BASELINE', student_id: studentId, baseline_id: baselineId,
    expected_baseline_version: baselineVersion, expected_package_version: packageVersion,
    ...(confirmedPaymentComplete === undefined ? {} : { confirmed_payment_complete: confirmedPaymentComplete }),
    ...(recurringDiscountPolicy === undefined ? {} : { recurring_discount_policy: validateRecurringDiscountPolicy(recurringDiscountPolicy) }),
    review_note: String(reviewNote).trim() }
}
