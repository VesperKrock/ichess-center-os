import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildCashflowCategoryFromForm,
  createEditCashflowCategoryFormState,
  createEmptyCashflowCategoryFormState,
  initialCashflowFilters,
  renderCashflowModule,
  validateCashflowCategoryForm,
} from '../src/cashflow-module.js'
import {
  buildC54ArchiveCategoryCommand,
  buildC54SaveCategoryCommand,
} from '../src/cloud-authoritative-finance.js'

const categories = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Thu lớp nhóm', type: 'income', isArchived: false, cloudVersion: 3 },
  { id: 'cat-both', name: 'Khác hiện hành', type: 'both', isArchived: false, version: 1 },
  { id: 'cat-expense-1', name: 'Vận hành', type: 'expense', isArchived: false, version: 2 },
  { id: 'cat-expense-2', name: 'Nhân sự', type: 'expense', isArchived: false, version: 4 },
  { id: 'cat-expense-3', name: 'Truyền thông', type: 'expense', isArchived: false, version: 1 },
  { id: 'cat-expense-4', name: 'Thiết bị', type: 'expense', isArchived: false, version: 5 },
  { id: 'cat-archived', name: 'Khoản cũ', type: 'both', isArchived: true, version: 8 },
]
const transactions = [{ id: 'txn-1', category: 'Thu lớp nhóm', type: 'income' }]

const createHtml = renderCashflowModule(
  transactions,
  initialCashflowFilters,
  null,
  categories,
  true,
  createEmptyCashflowCategoryFormState(),
)

for (const token of [
  'cashflow-form-backdrop cashflow-category-backdrop',
  'role="dialog"',
  'aria-modal="true"',
  'Danh mục thu chi',
  'Quản lý danh mục dùng cho form và bộ lọc Thu chi.',
  'Thêm danh mục',
  'placeholder="Nhập tên danh mục"',
  'Danh mục đang dùng',
  '7 danh mục',
  'cashflow-category-scrollbar',
  'Danh mục mới sẽ xuất hiện trong form và bộ lọc Thu chi.',
  'Thu · Đang dùng · 1 giao dịch',
  'Cả hai · Đã ẩn · 0 giao dịch',
  'data-cashflow-category-action="close"',
  'data-cashflow-category-action="edit"',
  'data-cashflow-category-action="archive"',
]) {
  assert(createHtml.includes(token), `Category modal is missing ${token}`)
}
assert.equal((createHtml.match(/class="cashflow-category-item/g) || []).length, categories.length)
assert(createHtml.includes('data-cashflow-category-action="archive" data-cashflow-category-id="cat-archived" disabled'))

const editState = createEditCashflowCategoryFormState(categories[0])
const editHtml = renderCashflowModule(
  transactions,
  initialCashflowFilters,
  null,
  categories,
  true,
  editState,
)
assert(editHtml.includes('Sửa danh mục'))
assert(editHtml.includes('Lưu danh mục'))
assert(editHtml.includes('data-cashflow-category-action="reset-form"'))
assert(editHtml.includes('value="Thu lớp nhóm"'))

const added = buildCashflowCategoryFromForm({ name: '  Thu khác  ', type: 'income' })
assert.equal(added.name, 'Thu khác')
assert.equal(added.type, 'income')
assert.equal(buildC54SaveCategoryCommand(added).operation, 'CREATE_CATEGORY')
const afterAddHtml = renderCashflowModule(
  transactions,
  initialCashflowFilters,
  null,
  [...categories, added],
  true,
  createEmptyCashflowCategoryFormState(),
)
assert(afterAddHtml.includes('8 danh mục'))
assert(afterAddHtml.includes('Thu khác'))

const edited = buildCashflowCategoryFromForm(
  { name: 'Thu lớp nhóm mới', type: 'both' },
  categories[0],
)
assert.equal(edited.id, categories[0].id)
assert.equal(edited.cloudVersion, categories[0].cloudVersion)
assert.equal(edited.name, 'Thu lớp nhóm mới')
assert.equal(edited.type, 'both')
assert.equal(buildC54SaveCategoryCommand(edited).operation, 'UPDATE_CATEGORY')
assert.equal(buildC54ArchiveCategoryCommand(categories[0]).operation, 'ARCHIVE_CATEGORY')
const afterEditHtml = renderCashflowModule(
  transactions,
  initialCashflowFilters,
  null,
  categories.map((category) => category.id === edited.id ? edited : category),
  true,
  createEmptyCashflowCategoryFormState(),
)
assert(afterEditHtml.includes('Thu lớp nhóm mới'))
assert(afterEditHtml.includes('Cả hai · Đang dùng · 0 giao dịch'))

const archivedCategories = categories.map((category) => category.id === categories[0].id
  ? { ...category, isArchived: true, cloudVersion: category.cloudVersion + 1 }
  : category)
const afterArchiveHtml = renderCashflowModule(
  transactions,
  initialCashflowFilters,
  null,
  archivedCategories,
  true,
  createEmptyCashflowCategoryFormState(),
)
assert(afterArchiveHtml.includes('Thu · Đã ẩn · 1 giao dịch'))
assert(afterArchiveHtml.includes(`data-cashflow-category-action="archive" data-cashflow-category-id="${categories[0].id}" disabled`))
assert(validateCashflowCategoryForm({ name: '', type: 'both' }, categories).name)
assert(validateCashflowCategoryForm({ name: 'Thu lớp nhóm', type: 'income' }, categories).name)

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
for (const authorityToken of [
  'cashflowCategories = result.categories',
  'buildC54SaveCategoryCommand(nextCategory)',
  'buildC54ArchiveCategoryCommand(category)',
  'createEditCashflowCategoryFormState(category)',
  "document.querySelectorAll('.cashflow-category-list')",
  "list.addEventListener('scroll', syncCategoryScrollbar, { passive: true })",
]) {
  assert(mainSource.includes(authorityToken), `Existing category authority/handler is missing ${authorityToken}`)
}

const moduleSource = readFileSync(new URL('../src/cashflow-module.js', import.meta.url), 'utf8')
for (const visualSampleName of ['Lệ phí giải đấu', 'Lương giáo viên', 'Mua dụng cụ']) {
  assert(!moduleSource.includes(visualSampleName), `Figma sample category leaked into product data: ${visualSampleName}`)
}

const css = readFileSync(new URL('../src/finance-theme.css', import.meta.url), 'utf8')
for (const cssContract of [
  '/* THU CHI — Danh mục: 530:2 / 531:2 */',
  'top: 76px;',
  'width: min(1040px, calc(100% - 48px));',
  'height: 512px;',
  'width: 320px;',
  'height: 384px;',
  'width: 648px;',
  'width: 628px;',
  'height: 52px;',
  'overflow-y: auto;',
  'width: 8px;',
  'background: #f0f1f3;',
  'background: #adb2bd;',
  'background: #202329;',
  'background: #6b7280;',
]) {
  assert(css.includes(cssContract), `Exact Figma CSS contract is missing ${cssContract}`)
}

console.log('V2-8P1 Thu Chi category modal Figma paint smoke PASS')
