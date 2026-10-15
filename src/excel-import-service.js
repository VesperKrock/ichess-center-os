import { listCloudEntityPayloads } from './cloud-db-sync.js'
import { pullV21CenterSettings } from './cloud-authoritative-center-settings.js'
import { pullV22StudentEnrollments } from './cloud-authoritative-student-enrollments.js'
import { parseV24PackageCycleSnapshot } from './cloud-authoritative-tuition-cycles.js'
import { pullC53CrmSharedTruth } from './cloud-authoritative-crm.js'
import { canonicalParentPhone } from './parent-identity.js'
import { excelSha256 } from './excel-workbook-reader.js'
import { stableExcelJson } from './excel-import-plan.js'
const equal = (a, b) => stableExcelJson(a) === stableExcelJson(b)
const normalizedSchedule = entries => (entries || []).map(e => ({ classSessionId: e.classSessionId, weekdays: [...e.weekdays].sort() })).sort((a, b) => a.classSessionId.localeCompare(b.classSessionId))
export async function readExcelImportTarget({ supabase, centerId }) {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth?.user?.id) throw Error('Cần đăng nhập phiên Admin thực sự.')
  const actorId = auth.user.id
  const [centerResponse, memberResponse, students, ca, settings, enrollments, rawCycles, crm] = await Promise.all([
    supabase.from('centers').select('id,name,status,environment').eq('id', centerId).single(),
    supabase.from('center_members').select('center_id,user_id,role,status').eq('center_id', centerId).eq('user_id', actorId).single(),
    listCloudEntityPayloads({ supabase, centerId, entityType: 'student' }),
    listCloudEntityPayloads({ supabase, centerId, entityType: 'class_session' }),
    pullV21CenterSettings({ supabase, centerId }), pullV22StudentEnrollments({ supabase, centerId }),
    supabase.rpc('v2_4_list_package_cycle_state', { p_center_id: centerId }),
    pullC53CrmSharedTruth({ supabase, centerId }),
  ])
  const member = memberResponse.data
  if (centerResponse.error || centerResponse.data?.status !== 'active' || memberResponse.error || member?.status !== 'active'
      || !['owner', 'center_admin', 'admin', 'qtv'].includes(member.role)) throw Error('Cơ sở hoặc quyền Admin không còn hợp lệ.')
  for (const r of [students, ca, settings, enrollments]) if (!r.ok) throw Error('Không đọc được đầy đủ canonical snapshot; chưa được nhập.')
  const cycles = rawCycles.error ? null : parseV24PackageCycleSnapshot(rawCycles.data, centerId)
  if (!cycles?.ok) throw Error('Không kiểm chứng được trạng thái Tuition hiện có; chưa được nhập để tránh trùng dữ liệu.')
  return { centerId, actorId, backend: new URL(supabase.supabaseUrl).origin, status: centerResponse.data.status, centerName: centerResponse.data.name,
    students: students.data, ca: ca.data, packages: settings.tuitionPackages, centerProfile: settings.centerProfile, enrollmentSets: enrollments.enrollmentSets,
    cycleStates: cycles.students, baselineCapability: rawCycles.data.initial_import_capability || '', serverCutoff: rawCycles.data.initial_import_server_cutoff_date || '', serverObservedAt: rawCycles.data.observed_server_at || '',
    crmIdentityRead: crm.ok ? { available: true, masked: true, canonicalIds: [...new Set(crm.records.map(r => r.canonicalContactId).filter(Boolean))] } : { available: false, masked: true, canonicalIds: [] } }
}
export function verifyExcelImportCommand(snapshot, command) {
  const e = command.expected
  if (command.domain === 'CA') { const c = snapshot.ca.find(c => c.id === e.id); return !!c && (c.teacherDisplayName || '') === e.teacherDisplayName && c.startTime === e.startTime && c.endTime === e.endTime && equal([...c.daysOfWeek].sort(), [...e.daysOfWeek].sort()) }
  if (command.domain === 'PACKAGE') { const p = snapshot.packages.find(p => p.id === e.id); return !!p && p.totalSessions === e.totalSessions && p.defaultAmount === e.defaultAmount }
  if (command.domain === 'STUDENT') { const s = snapshot.students.find(s => s.id === e.id), set = snapshot.enrollmentSets.find(s => s.studentId === e.id); return !!s && Object.entries(e.profile).every(([k, v]) => (s[k] ?? '') === v) && canonicalParentPhone(s.fatherPhone) === e.parentPhones.father && canonicalParentPhone(s.motherPhone) === e.parentPhones.mother && equal(normalizedSchedule(set?.enrollments), e.enrollments) }
  if (command.domain === 'TUITION') { const b = snapshot.cycleStates.find(s => s.studentId === e.studentId)?.verifiedInitialBaseline; return !!b && b.packageCatalogId === e.packageId && b.totalSessions === e.total && b.baselineUsed === e.used && b.baselineCutoffDate === e.cutoff && equal(b.financialFacts, e.financialFacts) }
  if (command.domain === 'CENTER') { const p = snapshot.centerProfile, c = e.profile; return p.displayName === c.display_name && p.address === c.address && p.phone === c.phone && p.receiptPrefix === c.receipt_prefix && p.renewalMaterialFee === c.renewal_material_fee_minor && p.defaultReceiptCollectorName === c.default_receipt_collector_name && p.note === c.note && p.initialStudentSetupEnabled === c.initial_student_setup_enabled }
  return false
}
export async function executeExcelImport({ manifest, approvedSha256, readTarget, rpc, checkpoint, getCurrentCenterId, ledger = {}, onProgress = () => {} }) {
  const { sha256, ...intent } = manifest
  if (sha256 !== approvedSha256 || await excelSha256(stableExcelJson(intent)) !== sha256) throw Error('Manifest đã đổi sau khi duyệt; cần Audit lại.')
  const allowed = new Set(['c5_1_mutate_core_entity', 'v2_1_mutate_center_settings', 'v2_2_mutate_student_with_enrollments', 'v2_4_mutate_package_cycle'])
  const guard = snapshot => { if (getCurrentCenterId() !== manifest.target.centerId || snapshot.centerId !== manifest.target.centerId || snapshot.actorId !== manifest.target.actorId || snapshot.backend !== manifest.target.backend) throw Error('CENTER_OR_ACTOR_CHANGED_STOP_IMPORT') }
  let snapshot = await readTarget(); guard(snapshot)
  const result = { contract: manifest.contract, manifestSha256: sha256, sourceSha256: manifest.sourceSha256, centerId: manifest.target.centerId, commands: [], holds: [...manifest.holds], uiVerification: 'OUTSTANDING_REQUIRES_REAL_APP_BROWSER', financialFinalization: 'NOT_IMPLEMENTED_PENDING_ONLY' }
  for (const command of manifest.commands) {
    guard(snapshot)
    let entry = ledger[command.id]
    if (entry && entry.intentSha256 !== command.intentSha256) throw Error('PERSISTED_INTENT_CONFLICT')
    const dependencies = command.dependsOn || []
    if (dependencies.some(id => !['COMMITTED', 'REUSED', 'RECONCILED'].includes(ledger[id]?.status))) { result.commands.push({ id: command.id, status: 'HELD', reason: 'DEPENDENCY_HELD' }); continue }
    if (verifyExcelImportCommand(snapshot, command)) {
      entry = { id: command.id, key: command.key, intentSha256: command.intentSha256, status: command.status === 'REUSE' ? 'REUSED' : 'RECONCILED', readBack: true }
    } else if (['UNKNOWN', 'PENDING'].includes(entry?.status)) {
      result.commands.push({ id: command.id, status: 'HELD', reason: 'UNKNOWN_OUTCOME_REQUIRES_RECONCILIATION' }); continue
    } else if (command.status === 'REUSE') {
      result.commands.push({ id: command.id, status: 'HELD', reason: 'REUSE_SNAPSHOT_DRIFT' }); continue
    } else {
      if (!allowed.has(command.rpc) || command.args.p_center_id !== manifest.target.centerId) throw Error('UNAPPROVED_WRITER_OR_TARGET')
      if (command.rpc === 'c5_1_mutate_core_entity' && (command.args.p_entity_type !== 'class_session' || command.args.p_operation !== 'UPSERT')) throw Error('CA_WRITER_SCOPE_VIOLATION')
      if (command.rpc === 'v2_4_mutate_package_cycle' && command.args.p_command.operation !== 'IMPORT_INITIAL_BASELINE') throw Error('TUITION_WRITER_SCOPE_VIOLATION')
      if (command.rpc === 'v2_1_mutate_center_settings' && !['CREATE_TUITION_PACKAGE', 'UPDATE_CENTER_PROFILE'].includes(command.args.p_command.operation)) throw Error('SETTINGS_WRITER_SCOPE_VIOLATION')
      if (command.domain === 'TUITION' && (!manifest.coverageConfirmed || !snapshot.serverCutoff || command.expected.cutoff > snapshot.serverCutoff)) { result.commands.push({ id: command.id, status: 'HELD', reason: 'SOURCE_COVERAGE_OR_SERVER_CUTOFF' }); continue }
      entry = { id: command.id, key: command.key, intentSha256: command.intentSha256, status: 'PENDING', readBack: false }
      ledger[command.id] = entry; await checkpoint(ledger); onProgress(command.id)
      try { guard(snapshot) } catch (e) { entry.status = 'HELD'; entry.reason = 'CENTER_CHANGED_BEFORE_DISPATCH'; await checkpoint(ledger); throw e }
      let response
      try { response = await rpc(command.rpc, command.args) } catch { response = { error: { code: 'NETWORK_OUTCOME_UNKNOWN' } } }
      // Always read back before deciding whether a failed response may retry.
      try { snapshot = await readTarget(); guard(snapshot) } catch (e) { entry.status = 'UNKNOWN'; ledger[command.id] = entry; await checkpoint(ledger); throw e }
      if (verifyExcelImportCommand(snapshot, command)) { entry.status = response?.data?.ok ? 'COMMITTED' : 'RECONCILED'; entry.readBack = true }
      else { const definite = response?.data?.ok === false || ['P0001', '23514', '22P02', '42501'].includes(response?.error?.code); entry.status = definite ? 'HELD' : 'UNKNOWN'; entry.reason = response?.data?.outcome_code || response?.error?.code || 'READ_BACK_MISMATCH' }
    }
    ledger[command.id] = entry; await checkpoint(ledger); result.commands.push({ ...entry })
  }
  result.summary = { committed: result.commands.filter(c => c.status === 'COMMITTED').length, reused: result.commands.filter(c => c.status === 'REUSED').length, reconciled: result.commands.filter(c => c.status === 'RECONCILED').length, heldCommands: result.commands.filter(c => ['HELD', 'UNKNOWN'].includes(c.status)).length, heldFacts: result.holds.length }
  result.verifiedAt = new Date().toISOString(); return result
}
