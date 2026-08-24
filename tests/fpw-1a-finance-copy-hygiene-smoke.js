import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderFinanceWorkspaceModule } from '../src/finance-workspace-module.js'

const __filename = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(__filename), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const financeSource = read('src/finance-workspace-module.js')
const modulesSource = read('src/modules.js')
const teacherSource = read('src/teacher-module.js')
const mainSource = read('src/main.js')
const renderedFinance = renderFinanceWorkspaceModule()
const financeRegistryBlock = modulesSource.slice(
  modulesSource.indexOf("id: 'nhom-tai-chinh'"),
  modulesSource.indexOf("id: 'thu-chi'"),
)

const forbiddenOperatorJargon = /\b(?:wrapper|merge|storage|aggregation|phase|rpc|schema|projection)\b/i

assert(!forbiddenOperatorJargon.test(financeSource), 'Finance workspace must not expose developer terminology')
assert(!forbiddenOperatorJargon.test(renderedFinance), 'Rendered Finance workspace must be operator-facing')
assert(!forbiddenOperatorJargon.test(financeRegistryBlock), 'Finance registry copy must be operator-facing')

for (const expectedCopy of [
  'Xem nhanh và mở các khu vực tài chính đang dùng của cơ sở.',
  'Dữ liệu hiện tại',
  'Xem theo từng khu vực',
  'Xem Sổ quỹ',
  'Xem Thu chi',
]) {
  assert(renderedFinance.includes(expectedCopy), `Missing Finance operator copy: ${expectedCopy}`)
}

assert.equal((renderedFinance.match(/data-finance-open-module=/g) || []).length, 2)
assert(renderedFinance.includes('data-finance-open-module="so-quy"'))
assert(renderedFinance.includes('data-finance-open-module="thu-chi"'))
assert(mainSource.includes("document.querySelectorAll('[data-finance-open-module]')"))
assert(mainSource.includes('openModuleWindow(button.dataset.financeOpenModule)'))

assert(!teacherSource.includes('Thông tin nhân sự hiện chưa tải được'))
assert(teacherSource.includes('Thông tin nhân sự hiện chưa khả dụng'))

console.log('FPW-1A finance copy hygiene smoke: PASS')
