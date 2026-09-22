import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderFinanceWorkspaceModule } from '../src/finance-workspace-module.js'
import { renderCashflowModule } from '../src/cashflow-module.js'
import { renderCashbookModule } from '../src/cashbook-module.js'

const __filename = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(__filename), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const financeSource = read('src/finance-workspace-module.js')
const modulesSource = read('src/modules.js')
const mainSource = read('src/main.js')
const renderedFinance = renderFinanceWorkspaceModule(
  'transactions',
  () => renderCashflowModule([]),
  () => renderCashbookModule([]),
)
const financeRegistryBlock = modulesSource.slice(
  modulesSource.indexOf("id: 'nhom-tai-chinh'"),
  modulesSource.indexOf("id: 'thu-chi'"),
)

const forbiddenOperatorJargon = /\b(?:wrapper|merge|storage|aggregation|phase|rpc|schema|projection)\b/i

assert(!forbiddenOperatorJargon.test(financeSource), 'Finance workspace must not expose developer terminology')
assert(!forbiddenOperatorJargon.test(renderedFinance), 'Rendered Finance workspace must be operator-facing')
assert(!forbiddenOperatorJargon.test(financeRegistryBlock), 'Finance registry copy must be operator-facing')

for (const expectedCopy of [
  'Sổ quỹ Thu chi',
  'Hạng mục',
  'Nội dung chi tiết',
  'Đối soát quỹ',
]) {
  assert(renderedFinance.includes(expectedCopy), `Missing Finance operator copy: ${expectedCopy}`)
}

assert(renderedFinance.includes('data-finance-workspace-view="cashbook"'))
assert(mainSource.includes("document.querySelectorAll('[data-finance-workspace-view]')"))
assert(mainSource.includes('normalizeFinanceWorkspaceView(button.dataset.financeWorkspaceView)'))
assert(!mainSource.includes("document.querySelectorAll('[data-finance-open-module]')"))

console.log('FPW-1A finance copy hygiene smoke: PASS')
