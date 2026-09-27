import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  parseTuitionOperatorSnapshot,
  pullTuitionOperatorSnapshot,
} from '../src/cloud-tuition-operator.js'
import {
  normalizeTuitionCyclePresentation,
  renderTuitionModule,
  validateInitialTuitionSetup,
  validateFullTuitionPayment,
} from '../src/tuition-module.js'
import {
  createTuitionOperatorController,
  createTuitionOperatorState,
} from '../src/tuition-operator-controller.js'
const report = JSON.parse(
  fs.readFileSync(
    'artifacts/tuition-definitive/dreamhome-real-app-report.json',
  ),
)
const actual = report.requests
  .filter((r) => r.url.endsWith('/rpc/tuition_operator_read'))
  .at(-1).body
const snapshot = parseTuitionOperatorSnapshot(actual, 'dreamhome')
assert(snapshot.ok)
assert(!parseTuitionOperatorSnapshot(actual, 'phongtrong_prod').ok)
assert(
  !parseTuitionOperatorSnapshot({ ...actual, students: [null] }, 'dreamhome')
    .ok,
)
const failed = await pullTuitionOperatorSnapshot({
  centerId: 'dreamhome',
  timeoutMs: 5,
  supabase: { rpc: () => ({ abortSignal: () => new Promise(() => {}) }) },
})
assert(!failed.ok)
const context = { ...snapshot, readStatus: 'ready', receiptStatus: 'ready' }
const unpaid = snapshot.cycleStates.find(
    (s) => s.currentCycle?.paymentStatus === 'UNPAID',
  ),
  cycle = unpaid.currentCycle
const p = normalizeTuitionCyclePresentation({
  packageCycleState: unpaid,
  receiptReady: true,
  receipts: snapshot.receipts,
})
assert(
  p.hasKnownPackage &&
    p.canPrintTbhp &&
    p.canCollectPayment &&
    !p.canPrintReceipt,
)
// Cycle terms continue to enable documents without a live catalog item.
const markup = renderTuitionModule(
  { ...context, catalog: [] },
  createTuitionOperatorState(),
)
assert(markup.includes(`data-tu-cycle-id="${cycle.id}"`))
assert(markup.includes('TBHP'))
const errorMarkup = renderTuitionModule(
  { ...context, students: [], cycleStates: [], readStatus: 'failed' },
  createTuitionOperatorState(),
)
assert(
  errorMarkup.includes('Không tải được học phí.') &&
    errorMarkup.includes('Làm mới') &&
    !errorMarkup.includes('Đang tải'),
)
const empty = snapshot.cycleStates.find(
  (s) => s.readiness === 'NO_TUITION_PACKAGE',
)
assert(
  normalizeTuitionCyclePresentation({ packageCycleState: empty }).noPackage,
)
const legacy = snapshot.cycleStates.find((s) => s.initialSetupRequired)
assert(
  normalizeTuitionCyclePresentation({ packageCycleState: legacy })
    .needsInitialSetup,
)
const receipt = snapshot.receipts.find((r) => r.status === 'ISSUED')
const paid = snapshot.cycleStates.find(
  (s) => s.currentCycle?.id === receipt.targetCycleId,
)
assert(
  normalizeTuitionCyclePresentation({
    packageCycleState: paid,
    receiptReady: true,
    receipts: snapshot.receipts,
  }).canPrintReceipt,
)
const other = {
  ...cycle,
  id: crypto.randomUUID(),
  cycleNumber: 2,
  usedSessions: 2,
  totalSessions: 16,
  remainingSessions: 14,
  lifecycleStatus: 'PROVISIONAL_UNPAID',
}
const debt = normalizeTuitionCyclePresentation({
  packageCycleState: { currentCycle: other, cycles: [cycle] },
})
assert.equal(debt.debtSessions, 2)
assert.equal(debt.usedSessions, 2)
const selected = normalizeTuitionCyclePresentation({
  packageCycleState: {
    currentCycle: other,
    cycles: [
      {
        ...cycle,
        usedSessions: 13,
        totalSessions: 16,
        remainingSessions: 0,
        manuallyEndedAt: '2026-09-27T00:00:00Z',
        expiredSessions: 3,
      },
    ],
  },
  selectedCycleId: cycle.id,
})
assert(
  selected.ended &&
    selected.usedSessions === 13 &&
    selected.expiredSessions === 3 &&
    selected.canPrintTbhp,
)
const package16 = { id: 'package16', totalSessions: 16, isActive: true }
assert(
  validateInitialTuitionSetup(
    {
      packageCatalogId: package16.id,
      usedSessions: '17',
      openingPaymentState: 'PAID_BEFORE_ICHESS',
    },
    [package16],
    true,
  ),
)
assert(
  validateInitialTuitionSetup(
    {
      packageCatalogId: package16.id,
      usedSessions: '6',
      openingPaymentState: '',
    },
    [package16],
    true,
  ),
)
assert.equal(
  validateInitialTuitionSetup(
    { packageCatalogId: package16.id },
    [package16],
    false,
  ),
  '',
)
assert(
  validateFullTuitionPayment({ amount: cycle.amountDue - 1 }, cycle.amountDue),
)
function controllerCase({
  freshVersion = cycle.version,
  failFirst = false,
} = {}) {
  const state = createTuitionOperatorState(),
    writes = []
  let current = structuredClone(context),
    count = 0
  const ctrl = createTuitionOperatorController({
    state,
    getContext: () => current,
    render: () => {},
    refresh: async () => {
      await new Promise((r) => setTimeout(r, 5))
      return { ok: true }
    },
    writeCycle: async () => ({ ok: true }),
    preparePayment: (_s, c, form) => ({
      cycle: c.id,
      source: form.sourcePaymentId,
      amount: form.values.amount,
      version: c.version,
    }),
    writePayment: async (cmd, key) => {
      writes.push({ cmd: structuredClone(cmd), key })
      if (failFirst && ++count === 1) throw Error('response lost')
      return { ok: true, receipt_id: crypto.randomUUID() }
    },
    printTbhp: () => {},
    printReceipt: () => {},
  })
  return {
    state,
    writes,
    ctrl,
    update: () => {
      current = {
        ...current,
        cycleStates: current.cycleStates.map((s) =>
          s.studentId === unpaid.studentId
            ? {
                ...s,
                currentCycle: { ...s.currentCycle, version: freshVersion },
              }
            : s,
        ),
      }
    },
  }
}
const clean = controllerCase()
await clean.ctrl.open('payment', unpaid.studentId, cycle.id)
assert.equal(clean.state.panel.error, '')
await Promise.all([clean.ctrl.submit(), clean.ctrl.submit()])
assert.equal(clean.writes.length, 1)
assert(clean.state.success.receiptId)
const stale = controllerCase({ freshVersion: cycle.version + 1 })
await stale.ctrl.open('payment', unpaid.studentId, cycle.id)
stale.update()
await stale.ctrl.submit()
assert.equal(stale.writes.length, 0)
assert(stale.state.panel.error.includes('vừa được cập nhật'))
const retry = controllerCase({ failFirst: true })
await retry.ctrl.open('payment', unpaid.studentId, cycle.id)
await retry.ctrl.submit()
await retry.ctrl.submit()
assert.equal(retry.writes.length, 2)
assert.deepEqual(retry.writes[0], retry.writes[1])
assert(retry.writes[0].cmd.source.length <= 200)
console.log(
  'TUITION_DEFINITIVE_REGRESSION: PASS (actual remote parser, bounded errors, one cycle model, documents, full payment, genuine stale, double submit, lost-response idempotency)',
)
