import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildV27ACancelCycleCountCommand,
  buildV27AReconcileCycleCountCommand,
  buildV27AStartCycleCountCommand,
  buildV27ASubmitCycleCountCommand,
  createV27AInventoryCycleCountRetryFingerprint,
  projectV27AInventoryCycleCount,
  pullV27AInventoryCycleCounts,
} from '../src/cloud-authoritative-inventory-cycle-count.js'
import { renderInventoryCycleCountPanel } from '../src/inventory-module.js'
import {
  buildInventoryDueNotificationCandidates,
  markNotificationReadById,
  upsertNotificationCandidates,
} from '../src/notification-center.js'

const centerId = 'center-v2-7a'
const otherCenterId = 'center-other'
const countId = '10000000-0000-4000-8000-000000000001'
const lineId = '10000000-0000-4000-8000-000000000002'
const itemId = '10000000-0000-4000-8000-000000000003'
const movementId = '10000000-0000-4000-8000-000000000004'
const baseCount = {
  center_id: centerId,
  id: countId,
  count_code: 'KKK-20260913-0001',
  due_date: '2026-09-13',
  due_state: 'DUE',
  status: 'DRAFT',
  item_count: 1,
  version: 1,
  created_at: '2026-09-13T01:00:00.000Z',
  updated_at: '2026-09-13T01:00:00.000Z',
  submitted_at: '',
  reconciled_at: '',
  cancelled_at: '',
  lines: [{
    center_id: centerId,
    id: lineId,
    item_id: itemId,
    item_name: 'Bộ cờ thi đấu',
    item_category: 'Bàn cờ / quân cờ',
    item_unit: 'Bộ',
    item_location: 'Kho A',
  }],
}

const blindCount = projectV27AInventoryCycleCount(baseCount, centerId)
assert(blindCount)
assert.equal(blindCount.isBlind, true)
assert.equal(blindCount.lines[0].observedQuantity, undefined)
assert.equal(blindCount.lines[0].expectedQuantity, undefined)
assert.equal(blindCount.lines[0].variance, undefined)
assert(!JSON.stringify(blindCount).includes('expectedQuantity'))
assert(!JSON.stringify(blindCount).includes('variance'))

const maliciousBlind = structuredClone(baseCount)
maliciousBlind.lines[0].expected_quantity = 17
maliciousBlind.lines[0].variance = 0
assert.equal(projectV27AInventoryCycleCount(maliciousBlind, centerId), null)
assert.equal(projectV27AInventoryCycleCount(baseCount, otherCenterId), null)

const fakeSupabase = {
  rpc: async (name) => ({
    data: name === 'v2_7a_list_inventory_cycle_counts'
      ? { ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: centerId, counts: [baseCount] }
      : null,
    error: null,
  }),
}
const pulled = await pullV27AInventoryCycleCounts({ supabase: fakeSupabase, centerId })
assert.equal(pulled.ok, true)
assert.equal(pulled.counts[0].isBlind, true)

const blindHtml = renderInventoryCycleCountPanel({
  counts: [blindCount],
  isPanelOpen: true,
  selectedCountId: countId,
  observedByLineId: {},
  canWrite: true,
})
assert(blindHtml.includes('data-inventory-cycle-count-observed'))
assert(blindHtml.includes('value=""'))
assert(!blindHtml.includes('Hệ thống'))
assert(!blindHtml.includes('Chênh lệch'))
assert(!blindHtml.includes('>17<'))

assert.throws(
  () => buildV27ASubmitCycleCountCommand(blindCount, {}),
  /Vui lòng nhập số lượng đã đếm/,
)
const submitCommand = buildV27ASubmitCycleCountCommand(blindCount, { [lineId]: '19' })
assert.equal(submitCommand.lines[0].observed_quantity, 19)
assert.equal(submitCommand.expected_version, 1)

const submittedRaw = {
  ...baseCount,
  status: 'SUBMITTED',
  version: 2,
  submitted_at: '2026-09-13T02:00:00.000Z',
  lines: [{
    ...baseCount.lines[0],
    expected_quantity: 17,
    observed_quantity: 19,
    variance: 2,
    explanation: '',
    reconciliation_movement_id: '',
  }],
}
const submittedCount = projectV27AInventoryCycleCount(submittedRaw, centerId)
assert(submittedCount)
assert.equal(submittedCount.isBlind, false)
assert.equal(submittedCount.lines[0].expectedQuantity, 17)
assert.equal(submittedCount.lines[0].variance, 2)
const revealedHtml = renderInventoryCycleCountPanel({
  counts: [submittedCount],
  isPanelOpen: true,
  selectedCountId: countId,
  explanationByLineId: {},
  canWrite: true,
})
assert(revealedHtml.includes('Hệ thống'))
assert(revealedHtml.includes('Chênh lệch'))
assert(revealedHtml.includes('Nhập giải thích bắt buộc'))

assert.throws(
  () => buildV27AReconcileCycleCountCommand(submittedCount, {}),
  /Vui lòng giải thích chênh lệch/,
)
const reconcileCommand = buildV27AReconcileCycleCountCommand(submittedCount, {
  [lineId]: 'Phát hiện thêm hai bộ tại khu thi đấu.',
})
assert.equal(reconcileCommand.explanations.length, 1)
assert.equal(reconcileCommand.explanations[0].line_id, lineId)
assert.deepEqual(buildV27ACancelCycleCountCommand(submittedCount), {
  operation: 'CANCEL_COUNT', count_id: countId, expected_version: 2,
})

const startA = { ...buildV27AStartCycleCountCommand('2026-09-14'), count_id: countId }
const startB = { ...startA, count_id: movementId }
assert.equal(
  createV27AInventoryCycleCountRetryFingerprint(startA),
  createV27AInventoryCycleCountRetryFingerprint(startB),
)

const reconciledCount = projectV27AInventoryCycleCount({
  ...submittedRaw,
  id: '10000000-0000-4000-8000-000000000006',
  status: 'RECONCILED',
  due_state: '',
  version: 3,
  reconciled_at: '2026-09-13T03:00:00.000Z',
  lines: [{
    ...submittedRaw.lines[0],
    explanation: 'Phát hiện thêm hai bộ tại khu thi đấu.',
    reconciliation_movement_id: movementId,
  }],
}, centerId)
assert(reconciledCount)
assert.equal(reconciledCount.lines[0].reconciliationMovementId, movementId)

const notifications = buildInventoryDueNotificationCandidates([
  blindCount,
  { ...blindCount, id: movementId, dueState: 'overdue', countCode: 'KKK-20260912-0001' },
  reconciledCount,
  { ...blindCount, id: '10000000-0000-4000-8000-000000000005', centerId: otherCenterId },
], { centerId, today: '2026-09-13' })
assert.equal(notifications.length, 2)
assert.equal(notifications.filter((item) => item.severity === 'danger').length, 1)
assert(notifications.every((item) => item.meta.cycleCountId === item.entityId))
assert(!notifications.some((item) => item.entityId === reconciledCount.id))
assert.deepEqual(buildInventoryDueNotificationCandidates([blindCount], { centerId: otherCenterId }), [])
const firstNotificationSync = upsertNotificationCandidates([], [notifications[0]])
const readNotification = markNotificationReadById(
  firstNotificationSync,
  firstNotificationSync[0].id,
  '2026-09-13T04:00:00.000Z',
)
const overdueUpdate = buildInventoryDueNotificationCandidates([
  { ...blindCount, dueState: 'overdue' },
], { centerId })
const unreadIndependent = upsertNotificationCandidates(readNotification, overdueUpdate)
assert.equal(unreadIndependent[0].readAt, '2026-09-13T04:00:00.000Z')
assert.equal(unreadIndependent[0].severity, 'danger')
assert.deepEqual(upsertNotificationCandidates(unreadIndependent, []), [])

const migration = fs.readFileSync(
  new URL('../supabase/migrations/202609130001_v2_7a_inventory_blind_cycle_count.sql', import.meta.url),
  'utf8',
)
for (const required of [
  'create table public.center_inventory_cycle_counts',
  'create table public.center_inventory_cycle_count_lines',
  'create table public.center_inventory_cycle_count_audit_events',
  'create table public.center_inventory_cycle_count_command_results',
  'create or replace function public.v2_7a_list_inventory_cycle_counts',
  'create or replace function public.v2_7a_mutate_inventory_cycle_count',
  "when c.status = 'DRAFT' or (c.status = 'CANCELLED' and c.submitted_at is null)",
  'insert into public.center_inventory_movements',
  'update public.center_inventory_items',
  "return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE')",
  "return jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT')",
  'force row level security',
  'revoke all on table public.center_inventory_cycle_counts from public, anon, authenticated, service_role',
]) assert(migration.includes(required), `Missing migration contract: ${required}`)
assert(!/insert\s+into\s+public\.finance_/i.test(migration))
assert(!/update\s+public\.finance_/i.test(migration))

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
for (const required of [
  "from './cloud-authoritative-inventory-cycle-count.js'",
  'refreshInventoryAuthoritativeTruth',
  'buildInventoryDueNotificationCandidates(inventoryCycleCounts',
  'notification.meta?.cycleCountId',
  'selectedInventoryCycleCountId = cycleCountId',
  'resetC56InventoryRuntimeForAccessBoundary',
]) assert(mainSource.includes(required), `Missing runtime wiring: ${required}`)

console.log('V2_7A_INVENTORY_BLIND_CYCLE_COUNT_SMOKE: PASS')
