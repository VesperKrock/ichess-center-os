import assert from 'node:assert/strict'
import { validateRecurringDiscountPolicy, validateInitialFinancialFacts,
  buildV24AdoptInitialBaselineCommand } from '../src/excel-initial-baseline.js'
import { buildV24SetRecurringDiscountPolicyCommand, parseV24PackageCycleSnapshot } from '../src/cloud-authoritative-tuition-cycles.js'
import { renderTuitionModule } from '../src/tuition-module.js'

const policy = (kind = 'PERCENT', percent = 5, fixed = 0, voucher = 0) => ({
  schemaVersion: 1, discountKind: kind, percent, fixedMinor: fixed, siblingVoucherMinor: voucher,
})
const pct = policy(), fixed = policy('FIXED', 0, 100000), mixed = policy('PERCENT_THEN_SIBLING_VOUCHER', 20, 0, 100000)
for (const p of [pct, fixed, mixed, policy('PERCENT', 10)]) assert.deepEqual(validateRecurringDiscountPolicy(p), p)
assert.equal(validateRecurringDiscountPolicy(null), null)
for (const p of [undefined, {}, [], { ...pct, percent: '5' }, { ...pct, percent: 101 },
  { ...pct, fixedMinor: -1 }, { ...pct, fixedMinor: 1 }, { ...pct, schemaVersion: 2 },
  { ...pct, siblingVoucherMinor: 100000 }, { ...pct, extra: true }, { ...fixed, percent: 5 },
  { ...fixed, fixedMinor: Number.MAX_SAFE_INTEGER + 1 }, { ...mixed, siblingVoucherMinor: 99999 },
  { ...pct, percent: 0.5 }, { ...pct, discountKind: '<script>unsafe</script>' }]) {
  assert.throws(() => validateRecurringDiscountPolicy(p))
}
const cycle = { id: '17101700-0000-4000-8000-000000000001', centerId: 'local', studentId: 'local-student', version: 3 }
const next = { ...cycle, id: '17101700-0000-4000-8000-000000000002', version: 2 }
const set = buildV24SetRecurringDiscountPolicyCommand(cycle, pct, next)
assert.equal(set.expected_version, 3)
assert.equal(set.expected_successor_version, 2)
assert.equal(set.successor_cycle_id, next.id)
assert.deepEqual(set.recurring_discount_policy, pct)
assert.equal(buildV24SetRecurringDiscountPolicyCommand(cycle, null).recurring_discount_policy, null)
assert.throws(() => buildV24SetRecurringDiscountPolicyCommand(cycle, undefined))
assert.throws(() => buildV24SetRecurringDiscountPolicyCommand(cycle, pct, { ...next, centerId: 'other' }))
assert.throws(() => buildV24SetRecurringDiscountPolicyCommand(cycle, pct, { ...next, studentId: 'other' }))
const input = { studentId: cycle.studentId, baselineId: '17101700-0000-4000-8000-000000000010',
  baselineVersion: 1, packageVersion: 1, reviewNote: 'Verified local source facts' }
const legacy = buildV24AdoptInitialBaselineCommand(input)
assert(!Object.hasOwn(legacy, 'recurring_discount_policy'))
assert.deepEqual(buildV24AdoptInitialBaselineCommand({ ...input, recurringDiscountPolicy: pct }),
  { ...legacy, recurring_discount_policy: pct })
assert.equal(buildV24AdoptInitialBaselineCommand({ ...input, recurringDiscountPolicy: null }).recurring_discount_policy, null)

const raw = { id: cycle.id, version: 3, cycle_number: 1, package_catalog_id: '17101700-0000-4000-8000-000000000016',
  package_name: 'Gói 16 buổi', total_sessions: 16, used_sessions: 1, remaining_sessions: 15, pending_sessions: 0,
  contributed_sessions: 1, baseline_used: 0, lifecycle_status: 'ACTIVE', price: 2750000, discount_amount: 137500,
  material_fee: 0, amount_due: 2612500, paid_amount: 0, payment_status: 'UNPAID', payment_period_id: 'local-period',
  tuition_local_id: 'local-tuition' }
const snapshot = row => ({ ok: true, status: 'READY', contract: 'v2.4-package-cycle-v1', center_id: 'local',
  students: [{ student_id: cycle.studentId, readiness: 'READY', current_cycle: row, prepared_next_cycle: null, cycles: [row] }],
  package_catalog: [{ id: raw.package_catalog_id, version: 1, package_name: 'Gói 16 buổi', total_sessions: 16, default_amount: 2750000 }],
  contributions: [] })
const parse = row => parseV24PackageCycleSnapshot(snapshot(row), 'local')
const parsed = parse({ ...raw, recurring_discount_policy: pct })
assert(parsed.ok)
assert.deepEqual(parsed.students[0].currentCycle.recurringDiscountPolicy, pct)
assert.deepEqual(parsed.students[0].cycles[0].recurringDiscountPolicy, pct)
assert.deepEqual(parse({ ...raw, recurring_discount_policy: null }), parse(raw), 'NULL/old backend leaves old model unchanged')
assert(!parse({ ...raw, recurring_discount_policy: { ...pct, percent: '5' } }).ok, 'bad policy fails closed')
const context = parsed => ({ students: [{ id: cycle.studentId, fullName: 'Local fixture' }], cycleStates: parsed.students,
  catalog: parsed.packageCatalog, readStatus: 'ready', receiptStatus: 'ready', receipts: [] })
const state = { filters: { query: '', status: 'all', package: 'all' },
  panel: { kind: 'detail', studentId: cycle.studentId, cycleId: '', busy: false } }
const render = p => renderTuitionModule(context(p), state)
const html = render(parsed), oldHtml = render(parse(raw))
assert(html.includes('<span>Ưu đãi định kỳ: Giảm 5%</span>'))
assert(html.includes('data-tu-action="recurring-edit"'), 'Manage existing entitlement in tuition detail')
assert(!oldHtml.includes('data-tu-action="recurring-edit"'), 'One-off discount does not become a recurring rule')
assert.equal(render(parsed), html, 'rendering is repeatable and read-only')
assert(render(parse({ ...raw, recurring_discount_policy: fixed })).includes('100.000 VNĐ'))
assert(render(parse({ ...raw, recurring_discount_policy: mixed })).includes('20%, sau đó voucher 100.000 VNĐ'))

for (const [stt, N, A, amount, p, due] of [
  [5, 8, 6, 1375000, fixed, 1275000], [6, 8, 5, 1375000, fixed, 1275000],
  [7, 8, 7, 1375000, fixed, 1275000], [8, 8, 7, 1375000, fixed, 1275000],
  [12, 16, 1, 2750000, pct, 2612500], [14, 24, 2, 4125000, policy('PERCENT', 10), 3712500],
  [15, 16, 15, 2750000, pct, 2612500], [16, 48, 3, 8250000, policy('PERCENT', 10), 7425000],
  [18, 24, 14, 4125000, policy('PERCENT', 10), 3712500],
]) {
  const { schemaVersion, ...discount } = p
  const facts = validateInitialFinancialFacts({ ...discount, paymentState: 'PAID_BEFORE_ICHESS',
    sourceDueMinor: due, collectedMinor: due, remainingMinor: 0 }, amount)
  assert.equal(Object.keys(facts).length, 8)
  const projected = parse({ ...raw, total_sessions: N, used_sessions: A, remaining_sessions: N - A,
    recurring_discount_policy: p })
  assert(projected.ok, 'B2 parser STT ' + stt)
  assert.equal(projected.students[0].currentCycle.remainingSessions, N - A)
}
console.log('RECURRING_POLICY_SMOKE_PASS: strict typed contracts,9source cases,legacy compatibility,fail-closed projection,detail control')
