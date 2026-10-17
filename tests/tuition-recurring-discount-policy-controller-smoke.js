import assert from 'node:assert/strict'
import { createTuitionOperatorController, createTuitionOperatorState } from '../src/tuition-operator-controller.js'
import { renderTuitionModule, parseTuitionRecurringValues } from '../src/tuition-module.js'
import { mutateV24PackageCycle } from '../src/cloud-authoritative-tuition-cycles.js'

const policy = { schemaVersion: 1, discountKind: 'PERCENT', percent: 5, fixedMinor: 0, siblingVoucherMinor: 0 }
const cycle = { id: '17101700-0000-4000-8000-000000000001', version: 3, studentId: 's', centerId: 'local',
  cycleNumber: 1, lifecycleStatus: 'ACTIVE', totalSessions: 16, usedSessions: 1, remainingSessions: 15,
  paymentStatus: 'PAID', paidAmount: 2612500, price: 2750000, amountDue: 2612500, recurringDiscountPolicy: policy }
const successor = { ...cycle, id: '17101700-0000-4000-8000-000000000002', cycleNumber: 2, version: 2,
  lifecycleStatus: 'PREPARED', usedSessions: 0, remainingSessions: 16, paymentStatus: 'UNPAID', paidAmount: 0 }
function fixture({ next = null, failFirst = false, readbackFail = false } = {}) {
  const state = createTuitionOperatorState()
  state.panel = { kind: 'detail', studentId: 's', cycleId: '', busy: false }
  const context = { centerId: 'local', students: [{ id: 's', fullName: 'Local fixture' }],
    cycleStates: [{ studentId: 's', currentCycle: structuredClone(cycle), preparedNextCycle: next ? structuredClone(next) : null, cycles: [] }],
    readStatus: 'ready', receiptStatus: 'ready', receipts: [], catalog: [] }
  const writes = [], money = structuredClone(context.cycleStates[0].currentCycle)
  let hook = () => {}, written = false
  const controller = createTuitionOperatorController({ state, getContext: () => context, render: () => {},
    refresh: async () => { hook(); return { ok: !(readbackFail && written) } },
    writeCycle: async (command, key) => {
      writes.push({ command: structuredClone(command), key })
      if (!written) {
        for (const c of [context.cycleStates[0].currentCycle, context.cycleStates[0].preparedNextCycle].filter(Boolean)) {
          c.recurringDiscountPolicy = command.recurring_discount_policy
          c.version++
        }
        written = true
        if (failFirst) throw Error('response lost after COMMIT')
      }
      return { ok: true }
    } })
  return { state, context, controller, writes, money, hook: fn => { hook = fn } }
}
const begin = f => f.controller.openRecurring('s', cycle.id)
const markup = f => renderTuitionModule(f.context, f.state)
for (const values of [{ discountKind: 'PERCENT', percent: '' }, { discountKind: 'PERCENT', percent: '101' },
  { discountKind: 'PERCENT', percent: '5.5' }, { discountKind: 'FIXED', fixedMinor: '-1' },
  { discountKind: 'FIXED', fixedMinor: '9007199254740992' }]) assert.throws(() => parseTuitionRecurringValues(values))
assert.deepEqual(parseTuitionRecurringValues({ discountKind: 'PERCENT_THEN_SIBLING_VOUCHER', percent: '20' }),
  { ...policy, discountKind: 'PERCENT_THEN_SIBLING_VOUCHER', percent: 20, siblingVoucherMinor: 100000 })

for (const next of [null, successor]) {
  const f = fixture({ next }); await begin(f)
  assert(f.state.panel.recurringEdit)
  assert(markup(f).includes('data-tu-recurring-field="percent"'))
  f.state.panel.recurringEdit.values.percent = '10'
  await f.controller.saveRecurring()
  assert.equal(f.writes.length, 1)
  assert.equal(f.writes[0].command.operation, 'SET_RECURRING_DISCOUNT_POLICY')
  assert.equal(f.writes[0].command.recurring_discount_policy.percent, 10)
  assert.equal(f.writes[0].command.expected_successor_version, next?.version)
  assert.equal(f.context.cycleStates[0].currentCycle.amountDue, f.money.amountDue)
  assert.equal(f.context.cycleStates[0].currentCycle.usedSessions, f.money.usedSessions)
  assert(f.state.success && !f.state.panel.recurringEdit)
}
const stopped = fixture({ next: successor }); await begin(stopped); await stopped.controller.saveRecurring(true)
assert.equal(stopped.writes[0].command.recurring_discount_policy, null)
assert(stopped.state.success)
assert(!markup(stopped).includes('data-tu-action="recurring-edit"'))

for (const update of [f => { f.context.centerId = 'other' }, f => { f.context.cycleStates[0].currentCycle.version++ },
  f => { f.context.cycleStates[0].preparedNextCycle = structuredClone(successor) },
  f => { f.context.readStatus = 'failed' }]) {
  const f = fixture(); await begin(f); update(f); await f.controller.saveRecurring()
  assert.equal(f.writes.length, 0, 'Drift is rejected before write')
  assert(f.state.panel.error)
}
for (const next of [{ ...successor, paymentStatus: 'PAID' }, { ...successor, usedSessions: 1 }, { ...successor, paidAmount: 1 }]) {
  const f = fixture({ next }); await begin(f)
  assert(!f.state.panel.recurringEdit)
  assert.equal(f.writes.length, 0)
  assert(!markup(f).includes('data-tu-action="recurring-edit"'))
}
const historical = fixture(); historical.context.cycleStates[0].cycles.push({ ...cycle, id: successor.id, cycleNumber: 0 })
historical.state.panel.cycleId = successor.id
assert(!markup(historical).includes('data-tu-action="recurring-edit"'))
const lost = fixture({ failFirst: true }); await begin(lost); await lost.controller.saveRecurring(true)
assert(lost.state.panel.recurringEdit.pendingCommand)
assert(!lost.state.success)
assert(markup(lost).includes('data-tu-action="recurring-save"'), 'Retry remains visible after committed stop with lost response')
await lost.controller.saveRecurring()
assert.deepEqual(lost.writes[0], lost.writes[1], 'Retry uses identical command and key despite changed versions')
assert(lost.state.success)
const failedRead = fixture({ readbackFail: true }); await begin(failedRead); await failedRead.controller.saveRecurring()
assert(!failedRead.state.success && failedRead.state.panel.recurringEdit.pendingCommand)
const duplicate = fixture(); await begin(duplicate)
await Promise.all([duplicate.controller.saveRecurring(), duplicate.controller.saveRecurring()])
assert.equal(duplicate.writes.length, 1)
for (const code of ['RECURRING_POLICY_SUCCESSOR_LOCKED', 'RECURRING_POLICY_SUCCESSOR_VERSION_CONFLICT', 'RECURRING_DISCOUNT_AMOUNT_INVALID']) {
  const result = await mutateV24PackageCycle({ centerId: 'local', command: { operation: 'SET_RECURRING_DISCOUNT_POLICY', student_id: 's' },
    idempotencyKey: cycle.id, supabase: { rpc: async () => ({ error: { message: code } }) } })
  assert.equal(result.outcome_code, code)
}
console.log('RECURRING_POLICY_CONTROLLER_PASS: edit/stop/readback,prepared versions,history/paid locks,center/version drift,retry after committed stop,double-click,no money commands')
