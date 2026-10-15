import assert from 'node:assert/strict'
import { createEmptySettingsClassSessionFormState, createEditSettingsClassSessionFormState, buildSettingsClassSessionFromForm, validateSettingsClassSessionForm, renderSettingsModule } from '../src/settings-module.js'
import { normalizeClassSessions } from '../src/storage.js'
import { validateTeacherDisplayName } from '../src/class-session-teacher-display.js'
import { createEditStudentFormState, validateStudentForm } from '../src/student-module.js'
const form = createEmptySettingsClassSessionFormState(), values = { ...form.values, daysOfWeek: ['tue', 'thu'], startTime: '17:30', endTime: '19:00', teacherDisplayName: '  Fixture   Teacher ' }
assert.deepEqual(validateSettingsClassSessionForm(values), {})
const created = buildSettingsClassSessionFromForm(values)
assert.equal(created.teacherDisplayName, 'Fixture Teacher'); assert.equal(created.teacherId, undefined)
const edit = createEditSettingsClassSessionFormState(created); assert.equal(edit.values.teacherDisplayName, 'Fixture Teacher')
const cleared = buildSettingsClassSessionFromForm({ ...edit.values, teacherDisplayName: '' }, created)
assert.equal(cleared.teacherDisplayName, ''); assert.deepEqual(cleared.daysOfWeek, created.daysOfWeek); assert.equal(cleared.startTime, created.startTime)
const reloaded = normalizeClassSessions([{ ...created, teacherDisplayName: 'Fixture Teacher' }])[0]
assert.equal(reloaded.teacherDisplayName, 'Fixture Teacher')
for (const invalid of [42, {}, [], 'x'.repeat(161), 'A\nB', '<img src=x onerror=alert(1)>']) assert(validateTeacherDisplayName(invalid))
const html = renderSettingsModule([{ ...created, teacherDisplayName: '<img src=x onerror=alert(1)>' }], [])
assert(!html.includes('<img src=x')); assert(html.includes('&lt;img'))
const other = renderSettingsModule([{ ...created, id: 'other-center-ca', teacherDisplayName: 'Other Center' }], [])
assert(!other.includes('Fixture Teacher'))
const legacy = { id: 'legacy', fullName: 'Fixture Legacy', parentName: 'Fixture Guardian', parentPhone: '+84900000001', birthDate: '', birthYear: '' }, legacyForm = createEditStudentFormState(legacy)
assert.equal(validateStudentForm(legacyForm.values, [], { allowLegacyUnknownBirth: legacyForm.allowLegacyUnknownBirth }).birthDate, undefined)
assert(validateStudentForm(legacyForm.values).birthDate)
console.log('Ca teacher display: create/edit/clear/reload/center-isolation/malformed/XSS/non-A3 and legacy DOB PASS')
