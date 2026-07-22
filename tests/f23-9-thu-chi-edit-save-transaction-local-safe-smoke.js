import assert from 'node:assert/strict'
import fs from 'node:fs'

const storageData = new Map()
let setItemCount = 0

globalThis.localStorage = {
  getItem(key) {
    return storageData.has(String(key)) ? storageData.get(String(key)) : null
  },
  setItem(key, value) {
    setItemCount += 1
    storageData.set(String(key), String(value))
  },
  removeItem(key) {
    storageData.delete(String(key))
  },
}

const cashflowModule = await import('../src/cashflow-module.js')
const reportModule = await import('../src/report-module.js')
const storageModule = await import('../src/storage.js')

const {
  buildCashflowTransactionFromForm,
  createEditCashflowFormState,
  getCashflowStats,
  renderCashflowModule,
  validateCashflowForm,
} = cashflowModule
const { buildReportData } = reportModule
const {
  readStoredCashflow,
  saveStoredCashflow,
  setCurrentStorageCenterId,
} = storageModule

setCurrentStorageCenterId('center-a')

const originalTransactions = [
  {
    id: 'txn-income-1',
    type: 'income',
    category: 'Học phí',
    amount: 1000000,
    transactionDate: '2026-07-20',
    method: 'Tiền mặt',
    personName: 'Phụ huynh A',
    recordedBy: 'Admin A',
    note: 'Thu học phí',
    sourceModule: 'manual',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    preservedLegacyField: 'keep-me',
  },
  {
    id: 'txn-expense-1',
    type: 'expense',
    category: 'Lương',
    amount: 300000,
    transactionDate: '2026-07-21',
    method: 'Chuyển khoản',
    personName: 'Giáo viên B',
    recordedBy: 'Admin A',
    note: 'Chi lương',
    sourceModule: 'manual',
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
  },
]

storageData.set('ichessCenterOS.cashflow.center-a', JSON.stringify(originalTransactions))
storageData.set('ichessCenterOS.cashflow.center-b', JSON.stringify([
  {
    ...originalTransactions[0],
    id: 'txn-center-b',
    amount: 777,
  },
]))

const writesBeforeRead = setItemCount
const readOnlySnapshot = readStoredCashflow([])
assert.equal(setItemCount, writesBeforeRead, 'readStoredCashflow must not write storage.')
assert.equal(readOnlySnapshot.length, 2)

const editState = createEditCashflowFormState(readOnlySnapshot[0], 'center-a')
assert.equal(editState.mode, 'edit')
assert.equal(editState.transactionId, 'txn-income-1')
assert.equal(editState.centerId, 'center-a')
assert.equal(editState.values.type, 'income')
assert.equal(editState.values.amount, '1.000.000')

const draftValues = {
  ...editState.values,
  type: 'expense',
  category: 'Mua vật tư',
  amount: '800.000',
  transactionDate: '2026-07-28',
  method: 'Chuyển khoản',
  personName: 'Nhà cung cấp <A>',
  recordedBy: 'Admin B',
  note: 'Đổi từ thu sang chi & kiểm tra',
}
assert.deepEqual(validateCashflowForm(draftValues), {}, 'Edited values should reuse create-compatible validation.')

const latestBeforeSave = readStoredCashflow([])
const existing = latestBeforeSave.find((transaction) => transaction.id === editState.transactionId)
const updatedTransaction = buildCashflowTransactionFromForm(draftValues, existing)
const replacedTransactions = latestBeforeSave.map((transaction) =>
  transaction.id === updatedTransaction.id ? updatedTransaction : transaction,
)
saveStoredCashflow(replacedTransactions)

const afterSave = readStoredCashflow([])
assert.equal(afterSave.length, 2, 'Edit save must not append duplicate transaction.')
assert.equal(afterSave.filter((transaction) => transaction.id === 'txn-income-1').length, 1)
const edited = afterSave.find((transaction) => transaction.id === 'txn-income-1')
assert.equal(edited.id, 'txn-income-1', 'Edit save must preserve id.')
assert.equal(edited.createdAt, '2026-07-01T00:00:00.000Z', 'Edit save must preserve createdAt.')
assert.notEqual(edited.updatedAt, '2026-07-01T00:00:00.000Z', 'Edit save must update updatedAt.')
assert.equal(edited.type, 'expense')
assert.equal(edited.amount, 800000)
assert.equal(edited.transactionDate, '2026-07-28')
assert.equal(edited.category, 'Mua vật tư')
assert.equal(edited.preservedLegacyField, 'keep-me', 'Unknown backward-compatible fields must be preserved.')
assert.equal(edited.attachment, undefined, 'F23.9 must not add a new attachment schema when form has none.')

const stats = getCashflowStats(afterSave)
assert.equal(stats.totalIncome, 0, 'Income total must remove edited transaction after Thu to Chi change.')
assert.equal(stats.totalExpense, 1100000, 'Expense total must include edited amount exactly once.')
assert.equal(stats.balance, -1100000)

const reportOldWeek = buildReportData({
  filters: { reportDate: '2026-07-20', weekStartDate: '2026-07-20' },
  cashflowTransactions: afterSave,
})
assert.equal(reportOldWeek.weeklyIncome, 0)
assert.equal(reportOldWeek.weeklyExpense, 300000, 'Old week should no longer include moved transaction.')

const reportNewWeek = buildReportData({
  filters: { reportDate: '2026-07-28', weekStartDate: '2026-07-27' },
  cashflowTransactions: afterSave,
})
assert.equal(reportNewWeek.dailyExpense, 800000)
assert.equal(reportNewWeek.weeklyExpense, 800000, 'New week should include moved transaction exactly once.')

storageData.set('ichessCenterOS.cashflow.center-a', JSON.stringify(originalTransactions))
const writesBeforeCancelDraft = setItemCount
const cancelDraft = {
  ...createEditCashflowFormState(readStoredCashflow([])[0], 'center-a'),
  values: { ...draftValues, amount: '123' },
}
assert.equal(cancelDraft.values.amount, '123')
assert.equal(setItemCount, writesBeforeCancelDraft, 'Cancel/draft mutation must not write storage.')
assert.deepEqual(
  JSON.parse(storageData.get('ichessCenterOS.cashflow.center-a')),
  originalTransactions,
  'Cancel/draft mutation must not save source data.',
)

const missingList = readStoredCashflow([]).filter((transaction) => transaction.id !== 'txn-income-1')
const missingExisting = missingList.find((transaction) => transaction.id === 'txn-income-1')
assert.equal(missingExisting, undefined, 'Missing record should stay missing.')
assert.equal(missingList.length, 1, 'Missing record flow must not recreate from edit draft.')

setCurrentStorageCenterId('center-b')
assert.equal(readStoredCashflow([]).some((transaction) => transaction.id === 'txn-income-1'), false, 'Center B must not see Center A transaction.')

const unsafeHtml = renderCashflowModule([
  {
    ...originalTransactions[0],
    category: '<script>alert(1)</script>',
    personName: 'A & B',
    note: '"quote" and <tag>',
  },
])
assert(unsafeHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
assert(unsafeHtml.includes('A &amp; B'))
assert(!unsafeHtml.includes('<script>alert(1)</script>'))

assert(validateCashflowForm({ ...draftValues, amount: '0' }).amount)
assert(validateCashflowForm({ ...draftValues, amount: '-100' }).amount)
assert(validateCashflowForm({ ...draftValues, transactionDate: 'not-a-date' }).transactionDate)
assert(validateCashflowForm({ ...draftValues, category: '   ' }).category)
assert(validateCashflowForm({ ...draftValues, recordedBy: '   ' }).recordedBy)

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const cashflowSource = fs.readFileSync('src/cashflow-module.js', 'utf8')
const storageSource = fs.readFileSync('src/storage.js', 'utf8')
const reportSource = fs.readFileSync('src/report-module.js', 'utf8')

assert(mainSource.includes('collectCashflowFormValues(event.currentTarget'), 'Save must collect latest DOM values.')
assert(mainSource.includes('readLatestCashflowTransactionsForCurrentCenter'), 'Save must reload latest current-center snapshot.')
assert(mainSource.includes('replacedCount !== 1'), 'Edit save must guard exact one-record replacement.')
assert(mainSource.includes('cashflowFormState.isSaving'), 'Save must guard double submit.')
assert(mainSource.includes('formCenterId !== currentCenterId'), 'Save must guard center switch.')
assert(!mainSource.includes('data-cashflow-action="open-create"][data-module-id]'), 'Cashflow actions must not use generic module launcher.')
assert(cashflowSource.includes('data-cashflow-form-mode'), 'Form must expose create/edit mode.')
assert(cashflowSource.includes('isSaving ? \'Đang lưu...\''), 'Save button must reflect saving state.')
assert(storageSource.includes('export function readStoredCashflow'), 'Storage must expose read-only cashflow snapshot helper.')
assert(storageSource.includes('...transaction,'), 'Storage normalization must preserve unknown fields.')
assert(reportSource.includes('cashflowTransactions'), 'Report must continue reading cashflowTransactions source.')

for (const forbidden of [
  'attachmentUrl',
  'attachmentFileId',
  'Supabase SQL',
  'Teacher Workspace',
]) {
  assert(!mainSource.includes(forbidden), `F23.9 must not add forbidden boundary: ${forbidden}`)
}

for (const [label, text] of [
  ['test output fixture', JSON.stringify(afterSave)],
]) {
  for (const marker of ['\u00c3', '\u00c2', '\ufffd']) {
    assert(!text.includes(marker), `${label} contains mojibake marker ${marker}`)
  }
}

console.log('F23.9 Thu chi edit/save transaction local-safe smoke passed')
