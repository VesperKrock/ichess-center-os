import { excelSha256 } from './excel-workbook-reader.js'
import { normalizeParentFullName, canonicalParentPhone, aggregateStudentParentIdentities } from './parent-identity.js'
import { buildSettingsClassSessionFromForm } from './settings-module.js'
import { buildStudentFromForm } from './student-module.js'
import { buildV21UpsertTuitionPackageCommand, buildV21UpdateCenterProfileCommand } from './cloud-authoritative-center-settings.js'
import { buildV24ImportInitialBaselineCommand } from './excel-initial-baseline.js'
import { sanitizeCloudPayload } from './cloud-db-entities.js'
export const stableExcelJson = value => JSON.stringify(sort(value))
function sort(v) { return Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v }
const equal = (a, b) => stableExcelJson(a) === stableExcelJson(b)
const name = normalizeParentFullName
export const excelUuid = async text => { const h = (await excelSha256(text)).slice(0, 32).split(''); h[12] = '5'; h[16] = '8'; const s = h.join(''); return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}` }
const schedule = entries => (entries || []).map(e => ({ classSessionId: e.classSessionId, weekdays: [...e.weekdays].sort() })).sort((a, b) => a.classSessionId.localeCompare(b.classSessionId))
const slot = c => stableExcelJson({ days: [...c.daysOfWeek].sort(), start: c.startTime, end: c.endTime })
const parents = v => ['father', 'mother'].map(role => ({ name: name(v[role + 'Name']), phone: canonicalParentPhone(v[role + 'Phone']) })).filter(p => p.name && p.phone)
const birth = v => v.birthDate || String(v.birthYear || '')
export function matchExcelStudent(values, existing) {
  const sourceParents = parents(values)
  const exact = existing.filter(s => name(s.fullName) === name(values.fullName) && birth(s) === birth(values)
    && sourceParents.some(a => parents(s).some(b => a.name === b.name && a.phone === b.phone)))
  if (exact.length === 1) return { status: 'EXACT', student: exact[0] }
  if (exact.length > 1) return { status: 'QUESTION', reason: 'Nhiều Student cùng hồ sơ và liên hệ; cần chọn đúng ID.' }
  const possible = existing.some(s => name(s.fullName) === name(values.fullName)
    || sourceParents.some(a => parents(s).some(b => a.phone === b.phone)) && birth(s) === birth(values))
  return possible ? { status: 'QUESTION', reason: 'Tên/ngày sinh/liên hệ chỉ khớp một phần; cần đối chiếu Student.' } : { status: 'NEW' }
}
export async function createExcelImportManifest(facts, target, options = {}) {
  if (!target.centerId || !target.actorId || !target.backend || target.status !== 'active') throw Error('TARGET_NOT_VERIFIED')
  const manifest = { contract: 'excel-two-step-v1', sourceSha256: facts.sourceSha256, target: { centerId: target.centerId, actorId: target.actorId, backend: target.backend }, createdAt: options.createdAt || new Date().toISOString(), sourceCutoff: facts.cutoff, coverageConfirmed: options.coverageConfirmed === true, commands: [], holds: [...facts.questions], records: [], parentMode: 'STUDENT_DISPLAY_ONLY_NO_CRM_OR_PH1_WRITES', previousSourceSha256: options.previous?.sourceSha256 !== facts.sourceSha256 ? options.previous?.sourceSha256 || null : options.previous?.previousSourceSha256 || null, schemaCapability: target.baselineCapability || '', sourceFacts: facts }
  const identity = token => `${facts.sourceSha256}|${target.centerId}|${token}`
  const add = async item => { const id = `${item.domain}:${item.ref}`, key = await excelUuid(identity(id)); const command = { ...item, id, key }; if (command.args) command.args.p_idempotency_key = key; command.intentSha256 = await excelSha256(stableExcelJson(command.args || command.expected)); manifest.commands.push(command); return command }
  const hold = (domain, ref, reason) => manifest.holds.push({ domain, ref, reason })
  if (options.applyCenterSettings) {
    const command = buildV21UpdateCenterProfileCommand({ ...facts.center, initialStudentSetupEnabled: target.centerProfile.initialStudentSetupEnabled }, target.centerProfile)
    await add({ domain: 'CENTER', ref: 'profile', rpc: 'v2_1_mutate_center_settings', args: { p_center_id: target.centerId, p_command: command }, expected: { profile: command } })
  }
  const caMap = new Map(), packageMap = new Map(), studentMap = new Map()
  for (const c of facts.ca) {
    const matches = target.ca.filter(current => slot(current) === slot(c))
    const previous = options.previous?.records?.find(r => r.domain === 'CA' && r.ref === c.ref)
    if (matches.length > 1 || !matches.length && previous && options.previous?.sourceSha256 !== facts.sourceSha256) { hold('CA', c.ref, 'Ca không còn khớp duy nhất; cần duyệt delta ngày/giờ.'); continue }
    const existing = matches[0], id = existing?.id || `excel-ca-${await excelUuid(identity('CA-ID:' + c.ref))}`
    caMap.set(c.ref, id); manifest.records.push({ domain: 'CA', ref: c.ref, id })
    const expected = { id, teacherDisplayName: c.teacherDisplayName, daysOfWeek: c.daysOfWeek, startTime: c.startTime, endTime: c.endTime }
    if (existing && (existing.teacherDisplayName || '') === c.teacherDisplayName) { await add({ domain: 'CA', ref: c.ref, status: 'REUSE', expected }); continue }
    const built = existing ? { ...sanitizeCloudPayload(existing), teacherDisplayName: c.teacherDisplayName } : { ...buildSettingsClassSessionFromForm(c), id, createdAt: manifest.createdAt }
    delete built.updatedAt
    await add({ domain: 'CA', ref: c.ref, rpc: 'c5_1_mutate_core_entity', args: { p_center_id: target.centerId, p_entity_type: 'class_session', p_local_id: id, p_expected_version: Number(existing?.cloudVersion || 0), p_payload: built, p_operation: 'UPSERT' }, expected })
  }
  for (const p of facts.packages) {
    const matches = target.packages.filter(current => name(current.packageName) === name(p.packageName))
    if (matches.length > 1 || matches[0] && (matches[0].totalSessions !== p.totalSessions || matches[0].defaultAmount !== p.defaultAmount || (matches[0].programName || '') !== p.programName || matches[0].isActive === false)) { hold('PACKAGE', p.ref, 'Gói cùng tên khác giá/số buổi/chương trình/trạng thái; cần duyệt delta.'); continue }
    const existing = matches[0], id = existing?.id || await excelUuid(identity('PACKAGE-ID:' + p.ref)), catalog = existing || { ...p, id, version: 1 }
    packageMap.set(p.ref, catalog); manifest.records.push({ domain: 'PACKAGE', ref: p.ref, id })
    const expected = { id, totalSessions: p.totalSessions, defaultAmount: p.defaultAmount }
    if (existing) { await add({ domain: 'PACKAGE', ref: p.ref, status: 'REUSE', expected }); continue }
    const command = buildV21UpsertTuitionPackageCommand({ ...p, maxCompletionWeeks: p.maxCompletionWeeks ?? '' }); command.package_id = id
    await add({ domain: 'PACKAGE', ref: p.ref, rpc: 'v2_1_mutate_center_settings', args: { p_center_id: target.centerId, p_command: command }, expected })
  }
  const seen = new Set()
  for (const s of facts.students) {
    if (!s.values || facts.questions.some(q => q.domain === 'STUDENT' && q.ref === s.ref)) continue
    const fingerprint = stableExcelJson({ name: name(s.values.fullName), birth: birth(s.values), parents: parents(s.values) })
    if (seen.has(fingerprint)) { hold('STUDENT', s.ref, 'Nguồn có hai dòng cùng hồ sơ; chưa tự tạo thêm Student.'); continue } seen.add(fingerprint)
    const match = matchExcelStudent(s.values, target.students)
    if (match.status === 'QUESTION') { hold('STUDENT', s.ref, match.reason); continue }
    const existing = match.student, id = existing?.id || `excel-student-${await excelUuid(identity('STUDENT-ID:' + s.ref))}`
    const enrollments = s.values.recurringEnrollments.map(e => ({ ...e, classSessionId: caMap.get(e.classSessionId) }))
    if (enrollments.some(e => !e.classSessionId)) { hold('STUDENT', s.ref, 'Ca phụ thuộc đang HOLD.'); continue }
    const desired = { ...buildStudentFromForm(s.values), id, createdAt: existing?.createdAt || manifest.createdAt }; delete desired.updatedAt
    const fields = ['fullName', 'birthYear', 'birthDate', 'schoolName', 'schoolGrade', 'level', 'homeName', 'gender', 'registrationDate', 'priorChessKnowledge', 'hobbies', 'personality', 'parentGoal', 'hometown', 'nationality', 'currentStatus', 'highestBotMilestone', 'parentArea', 'fatherName', 'motherName']
    const changed = existing ? fields.filter(k => (existing[k] ?? '') !== (desired[k] ?? '')) : []
    if (existing) for (const k of ['fatherPhone', 'motherPhone']) if (canonicalParentPhone(existing[k]) !== canonicalParentPhone(desired[k])) changed.push(k)
    const set = target.enrollmentSets.find(e => e.studentId === id)
    if (existing && (changed.length || !equal(schedule(set?.enrollments), schedule(enrollments)))) { hold('STUDENT', s.ref, `Cần duyệt delta hồ sơ/lịch: ${changed.join(', ') || 'weekday subsets'}. Student hiện có được giữ nguyên.`); continue }
    studentMap.set(s.ref, id); manifest.records.push({ domain: 'STUDENT', ref: s.ref, id })
    const expected = { id, sourceSTT: s.stt, enrollments: schedule(enrollments), profile: Object.fromEntries(fields.map(k => [k, desired[k] ?? ''])), parentPhones: { father: canonicalParentPhone(desired.fatherPhone), mother: canonicalParentPhone(desired.motherPhone) } }
    if (existing) await add({ domain: 'STUDENT', ref: s.ref, status: 'REUSE', expected })
    else await add({ domain: 'STUDENT', ref: s.ref, rpc: 'v2_2_mutate_student_with_enrollments', dependsOn: s.values.recurringEnrollments.map(e => 'CA:' + e.classSessionId), args: { p_center_id: target.centerId, p_student_local_id: id, p_expected_student_version: 0, p_student_payload: sanitizeCloudPayload(desired), p_expected_enrollment_version: 0, p_enrollments: enrollments.map(e => ({ class_session_id: e.classSessionId, weekdays: e.weekdays })), p_operation: 'UPSERT' }, expected })
  }
  for (const s of facts.students.filter(s => s.tuition && !s.tuition.held)) {
    const tuition = s.tuition, studentId = studentMap.get(s.ref), catalog = packageMap.get(tuition.packageRef)
    if (!studentId || !catalog) { hold('TUITION', s.ref, 'Student hoặc gói phụ thuộc đang HOLD.'); continue }
    const baseline = target.cycleStates.find(r => r.studentId === studentId)?.verifiedInitialBaseline
    const sourceKey = await excelSha256(identity('BASELINE:' + s.ref))
    const expected = { studentId, packageId: catalog.id, total: tuition.total, used: tuition.used, cutoff: tuition.cutoff, financialFacts: tuition.financialFacts }
    if (baseline) {
      if (baseline.packageCatalogId === catalog.id && baseline.totalSessions === tuition.total && baseline.baselineUsed === tuition.used && baseline.baselineCutoffDate === tuition.cutoff && equal(baseline.financialFacts, tuition.financialFacts)) await add({ domain: 'TUITION', ref: s.ref, status: 'REUSE', expected })
      else hold('TUITION', s.ref, 'Đã có baseline khác nguồn; cần reconciliation, không mở cycle mới.')
      continue
    }
    if (!options.coverageConfirmed) { hold('TUITION', s.ref, 'Cần xác nhận A đã bao gồm đến hết ngày cutoff nguồn.'); continue }
    if (target.baselineCapability !== 'verified-initial-baseline-v1' || !target.serverCutoff) { hold('TUITION', s.ref, 'Backend chưa xác nhận capability/cutoff baseline.'); continue }
    if (tuition.cutoff > target.serverCutoff) { hold('TUITION', s.ref, `Cutoff server ${target.serverCutoff} chưa cho phép nguồn ${tuition.cutoff}.`); continue }
    if (target.cycleStates.find(r => r.studentId === studentId)?.cycles?.length) { hold('TUITION', s.ref, 'Student đã có cycle; cần đối chiếu riêng.'); continue }
    const command = buildV24ImportInitialBaselineCommand({ studentId, packageCatalog: catalog, used: tuition.used, total: tuition.total, cutoff: tuition.cutoff, sourceSha256: facts.sourceSha256, sourceKey, reviewNote: options.coverageNote || `Admin confirmed source covers through end of ${tuition.cutoff} Asia/Ho_Chi_Minh`, financialFacts: tuition.financialFacts })
    await add({ domain: 'TUITION', ref: s.ref, rpc: 'v2_4_mutate_package_cycle', dependsOn: ['STUDENT:' + s.ref, 'PACKAGE:' + tuition.packageRef], args: { p_center_id: target.centerId, p_command: command }, expected })
  }
  const sourceStudents = facts.students.filter(s => s.values).map(s => ({ ...s.values, id: studentMap.get(s.ref) || s.ref, centerId: target.centerId }))
  manifest.parentIdentities = aggregateStudentParentIdentities(sourceStudents, { centerId: target.centerId }).map(g => ({ id: g.id, status: g.identityStatus, students: g.relatedStudents.map(s => s.id), occurrences: g.occurrences.map(({ student, ...o }) => o) }))
  const ambiguous = manifest.parentIdentities.filter(g => g.status === 'QUESTION')
  manifest.parentIdentityQuestions = ambiguous.map(g => ({ id: g.id, status: 'QUESTION', reason: 'NAME_OR_PHONE_ONLY_NO_CONTACT_MUTATION' }))
  manifest.summary = { expectedStudents: facts.students.length, ca: facts.ca.length, packages: facts.packages.length, sourcePackageBaselines: facts.students.filter(s => s.tuition).length, parentOccurrences: manifest.parentIdentities.reduce((n, g) => n + g.occurrences.length, 0), parentIdentities: manifest.parentIdentities.length, writes: manifest.commands.filter(c => c.rpc).length, reuses: manifest.commands.filter(c => c.status === 'REUSE').length, held: manifest.holds.length, enrollmentPairs: sourceStudents.reduce((n, s) => n + s.recurringEnrollments.length, 0), weekdaySelections: sourceStudents.reduce((n, s) => n + s.recurringEnrollments.reduce((a, e) => a + e.weekdays.length, 0), 0) }
  manifest.sha256 = await excelSha256(stableExcelJson(manifest))
  return manifest
}
