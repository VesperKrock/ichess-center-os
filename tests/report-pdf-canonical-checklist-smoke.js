import assert from 'node:assert/strict'
import { buildReportData, getReportPdfSnapshotFingerprint } from '../src/report-module.js'
import { createReportPdfProjection } from '../src/report-pdf.js'
import { createDailyChecklistState } from '../src/report-daily-checklist.js'
const date = '2026-10-16', data = buildReportData({ filters: { reportDate: date, weekStartDate: '2026-10-12' } })
const state = { ...createDailyChecklistState('one'), businessDate: date, status: 'ready', items: [{ item_key: 'pt-01', completed: true, completed_by_name: 'Actual operator' }] }
const snapshot = { data, centerId: 'one', viewMode: 'day', checklistState: state, draft: { pendingTasks: { tbhp: true } } }
const p = createReportPdfProjection(snapshot)
assert(p.checklist.ready); assert.equal(p.checklist.rows.length, 5)
assert.equal(p.checklist.templateLabel, 'TVV Part-time')
assert.equal(p.checklist.rows.filter(row => row.completed).length, 1)
assert.equal(p.checklist.rows[0].completedBy, 'Actual operator')
assert(!p.checklist.rows.some(row => row.key === 'tbhp'), 'Legacy draft checkboxes must never become canonical N6.1 completion facts')
const before = getReportPdfSnapshotFingerprint(snapshot)
state.items[0].completed = false
assert.equal(p.checklist.rows[0].completed, true, 'PDF captures an immutable canonical snapshot')
assert.notEqual(getReportPdfSnapshotFingerprint(snapshot), before, 'Concurrent canonical completion changes invalidate an in-flight export')
assert.equal(createReportPdfProjection({ ...snapshot, checklistState: { ...state, centerId: 'other' } }).checklist.ready, false)
assert.equal(createReportPdfProjection({ ...snapshot, checklistState: { ...state, businessDate: '2026-10-15' } }).checklist.ready, false)
assert.equal(createReportPdfProjection({ ...snapshot, checklistState: { ...state, status: 'loading' } }).checklist.ready, false)
const full = createReportPdfProjection({ ...snapshot, checklistState: { ...state, templateKey: 'tvv-fulltime-v1' } })
assert.equal(full.checklist.rows.length, 10)
console.log('Report PDF canonical N6.1 checklist: PASS; correct template/completions, immutable snapshot, scope/date/freshness guards')
