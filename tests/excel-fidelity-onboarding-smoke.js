import assert from 'node:assert/strict'
import { aggregateStudentParentIdentities, classifyParentIdentityMatch } from '../src/parent-identity.js'
import { buildDerivedParentContactsFromStudents, mergeParentContactsWithStudents, collapseParentIdentityRows, getFilteredParentConsultations, initialParentConsultationFilters } from '../src/parent-consultation-module.js'
import { validateStudentForm, buildStudentFromForm, createEmptyStudentFormState } from '../src/student-module.js'
import { buildV24ImportInitialBaselineCommand, projectVerifiedInitialBaseline } from '../src/excel-initial-baseline.js'
import { normalizeTuitionCyclePresentation } from '../src/tuition-module.js'
const student = { id: 'one', centerId: 'A', fullName: 'Fixture One', motherName: 'Fixture Guardian', motherPhone: '0900000001', fatherName: 'Fixture Father', fatherPhone: '0900000002' }
const sibling = { ...student, id: 'two', motherName: ' FIXTURE  GUARDIAN ', motherPhone: '+84 900 000 001' }
const before = structuredClone([student, sibling])
const groups = buildDerivedParentContactsFromStudents([student, sibling])
assert.equal(groups.length, 2); assert(groups.every(g => g.relatedStudents.length === 2))
assert.equal(groups.flatMap(g => g.derivedParentOccurrences).length, 4)
assert(groups.flatMap(g => g.derivedParentOccurrences).every(o => o.isPrimaryContact === null && o.financialContactRole === null))
assert.deepEqual([student, sibling], before)
const identity = { centerId: 'A', name: 'Fixture Guardian', phone: '0900000001' }
assert.equal(classifyParentIdentityMatch(identity, { ...identity, phone: '+84900000001' }), 'EXACT')
assert.equal(classifyParentIdentityMatch(identity, { ...identity, name: 'Other Guardian' }), 'QUESTION')
assert.equal(classifyParentIdentityMatch(identity, { ...identity, phone: '0900000003' }), 'QUESTION')
assert.equal(classifyParentIdentityMatch(identity, { ...identity, centerId: 'B' }), 'DIFFERENT_CENTER')
assert.equal(classifyParentIdentityMatch({ ...identity, birthYear: 1980 }, { ...identity, birthYear: 1981 }), 'QUESTION_CONFLICT')
assert.equal(aggregateStudentParentIdentities([student, { ...sibling, centerId: 'B' }]).length, 4)
const conflicting = aggregateStudentParentIdentities([{ ...student, motherBirthYear: 1980 }, { ...sibling, motherBirthYear: 1981 }])
assert.equal(conflicting.length, 3)
assert.equal(conflicting.filter(g => g.identityStatus === 'QUESTION').length, 2)
const cases = [{ id: 'case-1', centerId: 'A', canonicalContactId: 'contact', careLogs: [{ id: 'care-1', content: 'Keep case one' }] }, { id: 'case-2', centerId: 'A', canonicalContactId: 'contact', careLogs: [{ id: 'care-2', content: 'Keep case two' }] }]
const frozen = structuredClone(cases), merged = mergeParentContactsWithStudents(cases, [], [])
const rows = collapseParentIdentityRows(merged)
assert.equal(rows.length, 1); assert.equal(rows[0].consultationCases.length, 2)
assert.deepEqual(rows[0].consultationCases.flatMap(c => c.careLogs).map(c => c.id).sort(), ['care-1', 'care-2'])
assert.deepEqual(cases, frozen)
assert.equal(getFilteredParentConsultations(rows, { ...initialParentConsultationFilters, query: 'Keep case two' })[0].id, 'case-2')
assert.equal(collapseParentIdentityRows([{ ...cases[0], canonicalContactId: 'distinct-1' }, { ...cases[1], canonicalContactId: 'distinct-2' }]).length, 2)
const values = { ...createEmptyStudentFormState().values, fullName: 'Fixture Student', birthYearOnly: true, birthYear: '2018', motherName: 'Fixture Parent', motherPhone: '+84 900 000 001', schoolName: '', level: '' }
assert.deepEqual(validateStudentForm(values), {}); assert.equal(buildStudentFromForm(values).motherPhone.replace(/\D/g, ''), '0900000001')
const financial = { discountKind: 'PERCENT_THEN_SIBLING_VOUCHER', percent: 10, fixedMinor: 0, siblingVoucherMinor: 100000, paymentState: 'PARTIAL', sourceDueMinor: 1340000, collectedMinor: 500000, remainingMinor: 840000 }
const command = buildV24ImportInitialBaselineCommand({ studentId: 'one', packageCatalog: { id: '10000000-0000-4000-8000-000000000001', version: 1, totalSessions: 16, defaultAmount: 1600000 }, used: 6, total: 16, cutoff: '2026-10-15', sourceSha256: 'a'.repeat(64), sourceKey: 'b'.repeat(64), reviewNote: 'Verified source coverage', financialFacts: financial })
assert.equal(command.operation, 'IMPORT_INITIAL_BASELINE'); assert.equal(command.financial_facts.sourceDueMinor, 1340000)
assert.throws(() => buildV24ImportInitialBaselineCommand({}), /INVALID/)
const baseline = projectVerifiedInitialBaseline({ id: '20000000-0000-4000-8000-000000000001', state: 'PENDING_FINANCIAL_REVIEW', version: 1, total_sessions: 16, baseline_used_sessions: 6, contributed_sessions: 2, used_sessions: 8, remaining_sessions: 8, financial_facts: financial, listed_price_minor: 1600000, package_name: 'Fixture 16', baseline_cutoff_date: '2026-10-15' })
const presentation = normalizeTuitionCyclePresentation({ packageCycleState: { currentCycle: null, cycles: [], verifiedInitialBaseline: baseline } })
assert.equal(presentation.hasKnownPackage, true); assert.equal(presentation.usedSessions, 8); assert.equal(presentation.remainingSessions, 8)
assert.equal(presentation.canCollectPayment, false); assert.equal(presentation.canPrintTbhp, false); assert.equal(presentation.amounts.discountAmount, null)
assert.match(presentation.paymentLabel, /thanh toán một phần/)
console.log('Excel fidelity onboarding: PASS (identity/siblings/ambiguity/cross-center/Case preservation/+84/financial pending)')
