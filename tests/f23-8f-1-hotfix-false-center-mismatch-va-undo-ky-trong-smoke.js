import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderTuitionModule } from '../src/tuition-module.js'

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const tuitionSource = fs.readFileSync('src/tuition-module.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')
const docsSource = fs.readFileSync(
  'docs/f23-8f-1-hotfix-false-center-mismatch-va-undo-ky-trong.md',
  'utf8',
)

const eligibleUndoHtml = renderTuitionModule(
  [{ id: 'student-1', fullName: 'Nguyễn An', parentName: 'Phụ huynh An' }],
  [],
  { query: '', status: 'all', package: 'all' },
  null,
  null,
  null,
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  [],
  'current-center',
  {
    action: 'undo-empty-period',
    tuitionId: 'tuition-1',
    studentName: 'Nguyễn An',
    periodLabel: 'Kỳ 2',
    periodId: 'term-tuition-1-2',
    centerId: 'current-center',
    reasons: [],
    isSaving: false,
  },
)

assert(eligibleUndoHtml.includes('Hoàn tác kỳ mới?'))
assert(eligibleUndoHtml.includes('Hoàn tác kỳ mới'))
assert(!eligibleUndoHtml.includes('Chưa thể thực hiện:'), 'Eligible modal must not show blockers.')
assert(!eligibleUndoHtml.includes('data-tuition-period-confirm-action="confirm" disabled'))

const blockedUndoHtml = renderTuitionModule(
  [{ id: 'student-1', fullName: 'Nguyễn An', parentName: 'Phụ huynh An' }],
  [],
  { query: '', status: 'all', package: 'all' },
  null,
  null,
  null,
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  [],
  'current-center',
  {
    action: 'undo-empty-period',
    tuitionId: 'tuition-1',
    studentName: 'Nguyễn An',
    periodLabel: 'Kỳ 2',
    periodId: 'term-tuition-1-2',
    centerId: 'current-center',
    reasons: ['Kỳ hiện tại đã có giao dịch thanh toán.'],
    isSaving: false,
  },
)

assert(blockedUndoHtml.includes('Chưa thể thực hiện:'))
assert(blockedUndoHtml.includes('Kỳ hiện tại đã có giao dịch thanh toán.'))
assert(blockedUndoHtml.includes('data-tuition-period-confirm-action="confirm" disabled'))

for (const marker of [
  'function getTuitionRecordCenterOwnership',
  'function normalizeRuntimeCenterId',
  'fromCurrentCenterCollection',
  'current-center-collection-missing-center-id',
  'current-center-collection-legacy-center-id',
  'getTuitionRecordCenterOwnership(tuitionRecord, centerId, {',
  'fromCurrentCenterCollection: true',
]) {
  assert(mainSource.includes(marker), `Main missing center ownership marker: ${marker}`)
}

assert(
  !mainSource.includes('tuitionRecord?.centerId && String(tuitionRecord.centerId) !== String(centerId)'),
  'F23.8F.1 must not use direct centerId string mismatch guard.',
)

const eligibilityBlock = mainSource.slice(
  mainSource.indexOf('function getTuitionEmptyPeriodUndoEligibility'),
  mainSource.indexOf('function getTuitionPeriodDependencyTransactions'),
)
assert(eligibilityBlock.includes('centerOwnership.reason'))
assert(eligibilityBlock.includes('fromCurrentCenterCollection'))

const confirmBlock = mainSource.slice(
  mainSource.indexOf('async function undoEmptyTuitionPeriodFromConfirmation'),
  mainSource.indexOf('function bindNotificationOutsidePointer'),
)
assert(confirmBlock.includes('const latestTuitionRecords = getStoredTuition([])'))
assert(confirmBlock.includes('expectedPeriodId: confirmation.periodId'))
assert(confirmBlock.includes('fromCurrentCenterCollection: true'))
assert(confirmBlock.includes('restorePreviousTuitionPeriod('))
for (const forbidden of [
  'saveStoredCashflow',
  'saveStoredAttendanceRecords',
  'deleteTransactionImage',
  'deleteTransactionAttachment',
  'Kỳ 2',
  'dreamhome_prod',
]) {
  assert(!confirmBlock.includes(forbidden), `Confirm restore must not contain forbidden marker: ${forbidden}`)
}

for (const marker of [
  '.tuition-form-actions button:disabled',
  '.tuition-form-actions button:last-child:disabled',
  'cursor: not-allowed',
]) {
  assert(stylesSource.includes(marker), `Disabled button style missing: ${marker}`)
}

for (const marker of [
  'Root Cause',
  'Center Ownership Helper',
  'Legacy Provenance Rule',
  'Shared Guard',
  'Latest Revalidation',
  'Blocked Button',
  'Restore',
  'Manual QA',
]) {
  assert(docsSource.includes(marker), `Docs missing marker: ${marker}`)
}

const combined = [mainSource, tuitionSource, stylesSource, docsSource, eligibleUndoHtml, blockedUndoHtml].join('\n')
const mojibakeMarkers = [
  `C${'Ă¡'}Âº`,
  `Ä‚${'Æ’'}`,
  `Ä‚${'â€ '}Â°`,
  `H${'Ă¡'}Âº`,
  `Ä‚${'Â¡'}Â»`,
  `Bu${'Ä‚'}Â¡Ă‚Â»Ă¢â‚¬Â¢i h${'Ä‚'}Â¡Ă‚Â»Ă‚Âc m${'Ä‚'}Â¡Ă‚Â»Ă¢â‚¬Âºi`,
]
for (const marker of mojibakeMarkers) {
  assert(!combined.includes(marker), `Mojibake marker found: ${marker}`)
}

console.log('F23.8F.1 false center mismatch empty-period undo hotfix smoke passed')
