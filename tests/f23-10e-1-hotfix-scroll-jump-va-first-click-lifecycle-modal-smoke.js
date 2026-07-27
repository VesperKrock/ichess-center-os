import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createEditStaffFormState, renderStaffModule } from '../src/staff-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const main = read('src/main.js')
const staffSource = read('src/staff-module.js')
const styles = read('src/styles.css')
const docs = read('docs/f23-10e-1-hotfix-scroll-jump-va-first-click-lifecycle-modal.md')
const testSource = read('tests/f23-10e-1-hotfix-scroll-jump-va-first-click-lifecycle-modal-smoke.js')

const staff = {
  id: 'staff-gv001',
  centerId: 'center-a',
  employeeCode: 'GV001',
  fullName: 'Nguyen Truong Thinh',
  employmentType: 'full-time',
  employmentStatus: 'active',
  startDate: '2026-06-01',
  endDate: '',
  teacherId: 'teacher-thinh',
  teacherLinkedAt: '2026-07-01T00:00:00.000Z',
  accountUserId: '',
  membershipId: '',
  employmentLifecycleEvents: [{
    id: 'staff-lifecycle-existing',
    fromStatus: 'on-leave',
    toStatus: 'active',
    effectiveDate: '2026-07-01',
    createdAt: '2026-07-01T01:00:00.000Z',
  }],
}
const teacher = {
  id: staff.teacherId,
  fullName: staff.fullName,
  displayName: staff.fullName,
  status: 'active',
}
const staffSnapshot = structuredClone(staff)
const teacherSnapshot = structuredClone(teacher)

const html = renderStaffModule({
  staffMembers: [staff],
  teachers: [teacher],
  filters: { employmentStatus: 'all' },
  formState: createEditStaffFormState(staff),
  accountDirectoryState: { status: 'loaded', centerId: staff.centerId, memberships: [] },
  lifecycleState: {
    mode: 'termination',
    staffId: staff.id,
    centerId: staff.centerId,
    values: {
      toStatus: 'terminated',
      effectiveDate: '2026-07-27',
      note: 'Keep current lifecycle state',
      followUp: 'teacher',
      confirmed: true,
    },
    errors: { confirmed: 'stale error for targeted clearing' },
    message: 'validation message',
    isSaving: false,
  },
})

assert(html.includes('data-preserve-scroll-key="center-a:staff-gv001:edit"'))
assert(html.includes('data-preserve-scroll-key="center-a:staff-gv001:termination"'))
assert(html.includes('data-staff-lifecycle-preview="new-status"'))
assert(html.includes('data-staff-lifecycle-preview="effective-date"'))
assert(html.includes('data-staff-lifecycle-preview="end-date"'))
assert(html.includes('data-staff-lifecycle-error-for="confirmed"'))
assert(html.includes('data-staff-lifecycle-message'))

const nativeControlIds = [
  'staff-lifecycle-follow-up-none',
  'staff-lifecycle-follow-up-teacher',
  'staff-lifecycle-follow-up-account',
  'staff-lifecycle-confirmed',
]
for (const id of nativeControlIds) {
  assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `Unique native input id: ${id}`)
  assert.equal((html.match(new RegExp(`for="${id}"`, 'g')) || []).length, 1, `Explicit label wiring: ${id}`)
}
assert.equal((html.match(/name="staff-lifecycle-follow-up"/g) || []).length, 3)
assert.match(html, /id="staff-lifecycle-confirmed"[^>]*type="checkbox"[^>]*checked/)
assert.match(html, /id="staff-lifecycle-follow-up-teacher"[^>]*type="radio"[^>]*checked/)
assert.deepEqual(staff, staffSnapshot, 'Rendering the lifecycle modal must not mutate Staff or append history.')
assert.deepEqual(teacher, teacherSnapshot, 'Rendering the lifecycle modal must not mutate Teacher state or links.')

const fieldBindingStart = main.indexOf("document.querySelectorAll('[data-staff-lifecycle-field]')")
const fieldBindingEnd = main.indexOf("document.querySelector('[data-staff-lifecycle-form]')", fieldBindingStart)
assert(fieldBindingStart >= 0 && fieldBindingEnd > fieldBindingStart)
const fieldBinding = main.slice(fieldBindingStart, fieldBindingEnd)
assert(fieldBinding.includes('updateStaffLifecycleField('))
assert(fieldBinding.includes('syncStaffLifecycleDraftDom('))
assert(fieldBinding.includes("control.addEventListener('keydown'"))
assert(fieldBinding.includes("event.key === 'Enter'"))
assert(fieldBinding.includes('event.preventDefault()'))
for (const forbidden of [
  'render()',
  'stopPropagation',
  '.click(',
  'dispatchEvent',
  '.checked =',
  'setTimeout',
  'pointerdown',
]) {
  assert(!fieldBinding.includes(forbidden), `Lifecycle field handler must keep native semantics: ${forbidden}`)
}
const nativeChangeHandler = fieldBinding.slice(fieldBinding.indexOf('control.addEventListener(eventName'))
assert(!nativeChangeHandler.includes('preventDefault'), 'Native click/change must not be prevented.')

const draftSyncStart = main.indexOf('function syncStaffLifecycleDraftDom')
const draftSyncEnd = main.indexOf('function collectStaffLifecycleValues', draftSyncStart)
const draftSync = main.slice(draftSyncStart, draftSyncEnd)
assert(draftSync.includes('.textContent = previewValue'))
assert(draftSync.includes("data-staff-lifecycle-error-for"))
assert(!draftSync.includes('render()'))
assert(!draftSync.includes('setTimeout'))

assert(main.includes("['.staff-form', 'staff-form']"))
assert(main.includes("['.staff-lifecycle-window', 'staff-lifecycle-window']"))
assert(main.includes('element.dataset.preserveScrollKey'))
assert(main.includes('pendingTextEditingRender = false'))
assert(main.includes("firstError?.dataset.staffLifecycleErrorFor"))
assert(staffSource.includes('data-preserve-scroll-key='))
assert(styles.includes('overscroll-behavior: contain'))
assert(styles.includes('.staff-lifecycle-choice input:focus-visible'))

for (const forbidden of ['setTimeout', 'dispatchEvent', 'fake click', 'pointer hack']) {
  assert(!docs.includes(`\`${forbidden}\``), `Docs must not prescribe interaction hacks: ${forbidden}`)
}

for (const forbidden of [
  'auth.signUp(',
  'auth.admin',
  ".from('center_members').update",
  'create table',
  'alter table',
  'drop table',
  ['teacher', '-workspace-secret'].join(''),
]) {
  assert(
    ![main, staffSource, styles, docs].join('\n').toLowerCase().includes(forbidden.toLowerCase()),
    `Forbidden write/secret marker: ${forbidden}`,
  )
}

for (const source of [main, staffSource, styles, docs, testSource]) {
  for (const marker of createMojibakeMarkers()) {
    assert(!source.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.10E.1 lifecycle modal interaction smoke passed')

function createMojibakeMarkers() {
  return [
    [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
    [0x0102, 0x0192],
    [0x0102, 0x2020, 0x00c2, 0x00b0],
    [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
    [0x0102, 0x00a1, 0x00c2, 0x00bb],
    [0xfffd],
  ].map((codes) => String.fromCodePoint(...codes))
}
