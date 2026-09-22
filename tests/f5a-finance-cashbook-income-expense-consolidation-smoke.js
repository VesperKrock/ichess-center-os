import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildCashflowCsvExport,
  getCashflowStats,
  getFilteredCashflowTransactions,
  initialCashflowFilters,
  renderCashflowModule,
} from '../src/cashflow-module.js'
import { renderCashbookModule } from '../src/cashbook-module.js'
import {
  FINANCE_WORKSPACE_VIEWS,
  normalizeFinanceWorkspaceView,
  renderFinanceWorkspaceModule,
} from '../src/finance-workspace-module.js'
import {
  buildC54SaveTransactionCommand,
  buildC54VoidTransactionCommand,
} from '../src/cloud-authoritative-finance.js'

const read = (path) => readFileSync(path, 'utf8')
const mainSource = read('src/main.js')
const modulesSource = read('src/modules.js')
const financeThemeSource = read('src/finance-theme.css')
const migrationSource = read('supabase/migrations/202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql')

const categories = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Học phí', type: 'income', isArchived: false },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Vận hành', type: 'expense', isArchived: false },
]
const transactions = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    type: 'income',
    categoryId: categories[0].id,
    category: categories[0].name,
    amount: 1200000,
    transactionDate: '2026-09-22',
    method: 'Chuyển khoản',
    personName: 'Phụ huynh Nguyễn An',
    recordedBy: 'Owner A',
    note: 'Học phí tháng 9',
    sourceModule: 'manual',
    status: 'posted',
    cloudVersion: 1,
    createdAt: '2026-09-22T01:00:00.000Z',
    updatedAt: '2026-09-22T01:00:00.000Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    type: 'expense',
    categoryId: categories[1].id,
    category: categories[1].name,
    amount: 350000,
    transactionDate: '2026-09-21',
    method: 'Tiền mặt',
    personName: 'Nhà cung cấp bàn cờ',
    recordedBy: 'Admin A',
    note: 'Mua vật tư lớp học',
    sourceModule: 'manual',
    status: 'posted',
    cloudVersion: 2,
    createdAt: '2026-09-21T01:00:00.000Z',
    updatedAt: '2026-09-21T02:00:00.000Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    type: 'income',
    categoryId: '66666666-6666-4666-8666-666666666666',
    category: '',
    amount: 50000,
    transactionDate: '2026-09-20',
    method: 'Tiền mặt',
    personName: '',
    recordedBy: 'Owner A',
    note: 'Bản ghi lịch sử thiếu hạng mục',
    sourceModule: 'manual',
    status: 'posted',
    cloudVersion: 1,
    createdAt: '2026-09-20T01:00:00.000Z',
    updatedAt: '2026-09-20T01:00:00.000Z',
  },
]

const transactionHtml = renderCashflowModule(
  transactions,
  initialCashflowFilters,
  null,
  categories,
)

for (const copy of [
  'Sổ quỹ Thu chi',
  '<th>Hạng mục</th>',
  '<th>Nội dung chi tiết</th>',
  'data-finance-workspace-view="cashbook"',
  'Phụ huynh Nguyễn An',
  'Học phí',
  'Chưa phân loại',
  'Chưa có nội dung chi tiết',
  '22/09/2026',
]) {
  assert(transactionHtml.includes(copy), `Missing consolidated Finance UI contract: ${copy}`)
}
assert(!transactionHtml.includes('Nội dung / Người liên quan'))
assert(!transactionHtml.includes('<span>Người liên quan</span>'))

const cashbookHtml = renderCashbookModule(transactions)
assert(cashbookHtml.includes('Sổ quỹ Thu chi / Đối soát quỹ'))
assert(cashbookHtml.includes('data-finance-workspace-view="transactions"'))
assert(cashbookHtml.includes('<th>Hạng mục</th>'))
assert(cashbookHtml.includes('<th>Nội dung chi tiết</th>'))
assert(!cashbookHtml.includes('Nội dung / Người liên quan'))

assert.equal(
  renderFinanceWorkspaceModule(
    FINANCE_WORKSPACE_VIEWS.TRANSACTIONS,
    () => 'TRANSACTION_VIEW',
    () => 'CASHBOOK_VIEW',
  ),
  'TRANSACTION_VIEW',
)
assert.equal(
  renderFinanceWorkspaceModule(
    FINANCE_WORKSPACE_VIEWS.CASHBOOK,
    () => 'TRANSACTION_VIEW',
    () => 'CASHBOOK_VIEW',
  ),
  'CASHBOOK_VIEW',
)
assert.equal(normalizeFinanceWorkspaceView('unexpected'), FINANCE_WORKSPACE_VIEWS.TRANSACTIONS)

const categoryFiltered = getFilteredCashflowTransactions(transactions, {
  ...initialCashflowFilters,
  category: 'Vận hành',
})
assert.deepEqual(categoryFiltered.map((item) => item.id), [transactions[1].id])
const combinedFiltered = getFilteredCashflowTransactions(transactions, {
  ...initialCashflowFilters,
  type: 'income',
  category: 'Học phí',
})
assert.deepEqual(combinedFiltered.map((item) => item.id), [transactions[0].id])
assert.deepEqual(getCashflowStats(transactions), {
  totalIncome: 1250000,
  totalExpense: 350000,
  balance: 900000,
  count: 3,
})

const csv = buildCashflowCsvExport(transactions, initialCashflowFilters).csvContent
assert(csv.includes('Hạng mục'))
assert(csv.includes('Nội dung chi tiết'))
assert(!csv.includes('Nội dung / Người liên quan'))

const createCommand = buildC54SaveTransactionCommand({
  ...transactions[0],
  id: 'local-new',
  cloudVersion: 0,
}, { category: categories[0] })
assert.equal(createCommand.operation, 'CREATE_TRANSACTION')
assert.equal(createCommand.category_id, categories[0].id)
assert.equal(createCommand.person_name, 'Phụ huynh Nguyễn An')
const updateCommand = buildC54SaveTransactionCommand(transactions[1], { category: categories[1] })
assert.equal(updateCommand.operation, 'UPDATE_TRANSACTION')
assert.equal(updateCommand.expected_version, 2)
assert.equal(buildC54VoidTransactionCommand(transactions[1]).operation, 'VOID_TRANSACTION')

assert(modulesSource.includes("name: 'Sổ quỹ Thu chi'"))
assert(mainSource.includes("['so-quy', 'thu-chi'].includes(moduleId) ? 'nhom-tai-chinh'"))
assert(mainSource.includes("document.querySelectorAll('[data-finance-workspace-view]')"))
assert(!mainSource.includes("document.querySelectorAll('[data-finance-open-module]')"))
assert(financeThemeSource.includes(".desktop-window.is-finance-cashflow-window .cashflow-category-cell"))
assert(financeThemeSource.includes("overflow: auto;"))
assert(financeThemeSource.includes(":root[data-ui-theme='dark'] .desktop-window.is-finance-cashflow-window"))
assert(financeThemeSource.includes('@media (max-width: 1180px), (max-height: 680px)'))

for (const token of [
  'create table public.finance_transaction',
  'create table public.finance_category',
  "and t.status = 'POSTED'",
  'c5_4_list_finance_shared_truth',
  'c5_4_mutate_finance_shared_truth',
]) {
  assert(migrationSource.includes(token), `Canonical C5.4 authority drifted: ${token}`)
}

console.log('F5A_FINANCE_CASHBOOK_INCOME_EXPENSE_CONSOLIDATION_SMOKE: PASS')
