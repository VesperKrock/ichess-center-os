import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const reportRelative = 'docs/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze.md'
const smokeRelative = 'tests/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze-smoke.js'
const artifacts = [reportRelative, smokeRelative]
const migrationDirectory = join(root, 'supabase', 'migrations')

for (const relative of artifacts) {
  assert(existsSync(join(root, relative)), `Missing required P3A artifact: ${relative}`)
}

const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256')
  .update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const includesAll = (content, values, label) => {
  for (const value of values) assert(content.includes(value), `${label}: missing ${value}`)
}
const sectionBetween = (content, start, end, label) => {
  const startIndex = content.indexOf(start)
  const endIndex = content.indexOf(end, startIndex + start.length)
  assert(startIndex >= 0 && endIndex > startIndex, `${label}: section boundary missing`)
  return content.slice(startIndex, endIndex)
}
const assertOrdered = (content, values, label) => {
  let cursor = 0
  for (const value of values) {
    const index = content.indexOf(value, cursor)
    assert(index >= cursor, `${label}: missing or out of order: ${value}`)
    cursor = index + value.length
  }
}
const count = (content, pattern) => [...content.matchAll(pattern)].length
const report = read(reportRelative)
const smoke = read(smokeRelative)
const canonicalRoadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const localRoadmap = read('RoadmapRealTime.txt')

const p3aPhaseToken = /f23[-_]3e[-_]p3a(?![a-z0-9])/i
assert(p3aPhaseToken.test('f23_3e_p3a_design'))
for (const phase of ['p2d', 'p3', 'p3aa', 'p3a2', 'p3b', 'p3c', 'p3d', 'p4']) {
  assert(!p3aPhaseToken.test(`f23_3e_${phase}_future`), `P3A ownership captures ${phase}`)
}
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'docs'))
    .filter((name) => p3aPhaseToken.test(name)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests'))
    .filter((name) => p3aPhaseToken.test(name)).map((name) => `tests/${name}`),
  ...readdirSync(migrationDirectory)
    .filter((name) => p3aPhaseToken.test(name)).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...artifacts].sort(), 'P3A must own exactly two artifacts')

const migrationFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()
const checkpointHashes = new Map([
  ['20260722000000_remote_schema.sql', '55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31'],
  ['20260722000100_transaction_images_bucket_prerequisite.sql', 'B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62'],
  ['202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql', '0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD'],
  ['202607280001_f23_11e_staff_document_private_attachments.sql', 'E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C'],
  ['202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql', 'CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8'],
  ['202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql', '2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984'],
  ['202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql', '81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6'],
  ['202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql', 'BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F'],
  ['202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql', '210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA'],
  ['202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql', 'BAE3968BF042C880865D17CAD1D8369F46E366CD990D5194361E0DF043A63722'],
  ['202608100003_f23_3e_p1e_rls_read_masking_and_import_readiness.sql', '33B502519901449AD9661C4F54579C7667399775B9CF9859E1832F5B5E4D0F19'],
  ['202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql', '55BBEB5B3500E41E7658EFC2FCE0A63E4D2CB7F6C32AE619A55E5D464FB37773'],
  ['202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql', 'F9CE4F514DCCAD17B0BAF476C709E8E8005A91E06B81C93F4800C484F61F989B'],
  ['202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql', '7334E762FFE21DE2880BF5E3E29196CE66D4CB0B265E86D74EEDC43D4334BA46'],
])
assert.equal(checkpointHashes.size, 14)
for (const [name, expectedHash] of checkpointHashes) {
  assert(migrationFiles.includes(name), `Missing checkpoint migration ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Checkpoint hash drift: ${name}`)
}
assert.deepEqual(migrationFiles.filter((name) => p3aPhaseToken.test(name)), [], 'P3A must own zero migrations')

includesAll(report, [
  'F23_3E_P3A_STATUS: DESIGN COMPLETE IN REPO',
  'F23_3E_P3A_FINAL_TECHNICAL_AUDIT: PASS',
  'P3A_P1B_ACTION_GRAPH_DIGEST_PROVENANCE: CALLER_SUPPLIED_OPAQUE_32_BYTE_BINDING',
  'F23_3E_P3A_MIGRATION_CREATED: NO',
  'F23_3E_P3A_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'P3A_P2_FOUNDATION_ACCEPTED: YES',
  'P3A_REAL_CONVERSION_CURRENTLY_READY: NO',
  'P3A_P3_BLOCKER_INPUT_COUNT: 7',
  'P3A_P3_BLOCKER_DISPOSITION_COUNT: 7',
  'P3A_STEP_UP_AUTHORITY_DESIGN: COMPLETE',
  'P3A_FINAL_CAPABILITY_DESIGN: COMPLETE',
  'P3A_SINGLE_USE_AUTHORITY_DESIGN: COMPLETE',
  'P3A_STUDENT_TARGET_RUNTIME_DESIGN: COMPLETE',
  'P3A_GUARDIAN_TARGET_RUNTIME_DESIGN: COMPLETE',
  'P3A_RELATIONSHIP_RUNTIME_DESIGN: COMPLETE',
  'P3A_ATOMIC_EXECUTOR_DESIGN: COMPLETE',
  'P3A_P3B_IMPLEMENTATION_APPROVAL: SAFE_TO_REQUEST',
  'P3A_P3C_IMPLEMENTATION_APPROVAL: BLOCKED',
  'P3A_P3D_IMPLEMENTATION_APPROVAL: BLOCKED',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
  'F23_3E_P3_REMOTE_APPLY: NOT RUN',
  'F23_3E_P3_AUTH_CHANGE: NO',
  'F23_3E_P3_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P3_DEPLOY: NOT RUN',
  'P3A_CHECKPOINT_MIGRATION_HASH_COUNT: 14',
  'P3A_OWNED_MIGRATION_COUNT: 0',
  'P3A_ARTIFACT_COUNT: 2',
], 'P3A status and ownership')
assert(report.includes('External technical audit closeout on 2026-08-12: PASS'), 'P3A external audit closeout note missing')

const currentP3Line = 'F23.3E-P3 PARTIAL backend/design / Real-conversion architecture đã freeze ở P3A; P3B–P3D runtime chưa implement'
const currentP3Marker = `CURRENT CHECKPOINT — ${currentP3Line}`
const currentP3aLine = 'F23.3E-P3A DONE design/local verified / Dependency closure, canonical target model, fresh step-up/final capability/single-use authority, typed action aggregate, atomic executor design, dual digest binding và action-version lifecycle ordering đã external audit PASS'
const currentP3aMarker = `CURRENT CHECKPOINT — ${currentP3aLine}`
const currentP3bLine = 'F23.3E-P3B TODO backend / Fresh step-up, final conversion capability resolver và single-use conversion authority runtime'
const currentP3cLine = 'F23.3E-P3C TODO backend / Canonical Student, Guardian, source-target binding và Guardian–Student Relationship protected target runtime; sequentially blocked until P3B PASS'
const currentP3dLine = 'F23.3E-P3D TODO backend/QA / Atomic real-conversion executor, reservation/authority consume và integrated execution QA; sequentially blocked until P3B + P3C PASS'
const currentP4Line = 'F23.3E-P4 TODO public/QA / Nối UI conversion thật, legacy projection và manual QA end-to-end'
const historicalP3Heading = '* Historical checkpoint compatibility note — non-current P2-era P3 marker; the indented literal below is not a current status:'
const historicalP3Line = 'F23.3E-P3 TODO backend / Fresh step-up approval, single-use authority và real conversion executor atomic'

for (const roadmap of [canonicalRoadmap, localRoadmap]) {
  includesAll(roadmap, [
    currentP3Marker,
    currentP3aMarker,
    currentP3bLine,
    currentP3cLine,
    currentP3dLine,
    currentP4Line,
    historicalP3Heading,
    historicalP3Line,
  ], 'P3A post-audit roadmap closeout')
  const trimmedLines = roadmap.split(/\r?\n/).map((line) => line.trim())
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('CURRENT CHECKPOINT — F23.3E-P3 ')), [currentP3Marker], 'Roadmap must have exactly one current P3 PARTIAL status')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('CURRENT CHECKPOINT — F23.3E-P3A ')), [currentP3aMarker], 'Roadmap must have exactly one current P3A DONE status')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P3B ')), [currentP3bLine], 'P3B current TODO status drift')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P3C ')), [currentP3cLine], 'P3C sequential gate drift')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P3D ')), [currentP3dLine], 'P3D sequential gate drift')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P4 ')), [currentP4Line], 'P4 must remain TODO')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P3 ')), [historicalP3Line], 'P3 TODO literal must exist only as historical compatibility')
  assert.equal(roadmap.split('F23.3E-P3 PARTIAL backend/design').length - 1, 1, 'Current P3 PARTIAL literal count drift')
  assert.equal(roadmap.split('F23.3E-P3 TODO backend').length - 1, 1, 'Historical P3 TODO literal count drift')
  assert.equal(roadmap.split(historicalP3Heading).length - 1, 1, 'Historical P3 compatibility heading count drift')
  assert(!roadmap.includes('F23.3E-P3 DONE'), 'P3 parent must not be marked DONE')
}

const blockerInputs = [
  'P3_STEP_UP_AUTHORITY_RUNTIME: BLOCKED_PREREQUISITE',
  'P3_FINAL_CAPABILITY_RUNTIME: BLOCKED_PREREQUISITE',
  'P3_STUDENT_CREATE_TARGET_WRITE: BLOCKED_PREREQUISITE',
  'P3_STUDENT_REUSE: BLOCKED_PREREQUISITE',
  'P3_GUARDIAN_CREATE: BLOCKED_PREREQUISITE',
  'P3_GUARDIAN_REUSE: BLOCKED_PREREQUISITE',
  'P3_GUARDIAN_STUDENT_RELATIONSHIP_WRITE: BLOCKED_PREREQUISITE',
]
includesAll(report, blockerInputs, 'Seven P2D blocker inputs')
assert.equal(count(report, /^\| `P3_(?:STEP_UP_AUTHORITY_RUNTIME|FINAL_CAPABILITY_RUNTIME|STUDENT_CREATE_TARGET_WRITE|STUDENT_REUSE|GUARDIAN_CREATE|GUARDIAN_REUSE|GUARDIAN_STUDENT_RELATIONSHIP_WRITE): BLOCKED_PREREQUISITE` \|/gm), 7, 'Seven blocker disposition rows required')

includesAll(report, [
  'P3_STUDENT_CANONICAL_RESOURCE: NEW_PROTECTED_CANONICAL_RESOURCE_REQUIRED',
  'P3_STUDENT_CREATE_WRITER_PLAN: P3C_INTERNAL_RESERVATION_BOUND_MUTEX_PARTICIPATING_WRITER',
  'P3_STUDENT_REUSE_AUTHORITY_PLAN: EXACT_REVIEW_PLUS_CURRENT_COMMITTED_SOURCE_BINDING',
  'P3_GUARDIAN_CANONICAL_RESOURCE: NEW_PROTECTED_CANONICAL_RESOURCE_REQUIRED',
  'P3_GUARDIAN_CREATE_WRITER_PLAN: P3C_INTERNAL_RESERVATION_BOUND_MUTEX_PARTICIPATING_WRITER',
  'P3_GUARDIAN_REUSE_PLAN: EXACT_REVIEW_PLUS_CURRENT_COMMITTED_SOURCE_BINDING',
  'P3_GUARDIAN_STUDENT_RELATIONSHIP_RESOURCE: NEW_PROTECTED_CANONICAL_RESOURCE_REQUIRED',
  'P3_SEPARATE_ACTION_AGGREGATE_REQUIRED: YES',
  'P3_SEPARATE_ACTION_PLAN_AGGREGATE_REQUIRED: NO',
  'P3_STUDENT_TARGET_ADAPTER_NAMESPACE: canonical.student_profile.v1',
  'P3_GUARDIAN_TARGET_ADAPTER_NAMESPACE: canonical.guardian_profile.v1',
  'P3_RELATIONSHIP_ADAPTER_NAMESPACE: canonical.guardian_student_relationship.v1',
  'P3_PRE_P3C_FUTURE_NAMESPACE_RESERVATION_EXECUTABLE: NO',
  'P3_LEGACY_STUDENT_ADAPTER_REUSE_ELIGIBLE: NO',
  'P3_LEGACY_REQUEST_ACTION_GRAPH_DIGEST_IS_CANONICAL_GRAPH: NO',
  'P3_CANONICAL_ACTION_SET_DIGEST_IS_SERVER_DERIVED: YES',
  'P3_CANONICAL_ACTION_SET_DIGEST_MUST_EQUAL_LEGACY_REQUEST_DIGEST: NO',
  'P3_ACTION_SET_ENCODING_VERSION: 1',
  'P3_ACTION_SET_DIGEST_BINDS_ACTION_VERSION: YES',
  'P3_AUTHORITY_BINDS_ACTION_SET_LIFECYCLE_STATE: APPROVED',
  'P3_FINALIZE_DIGEST_COMPUTED_AFTER_REVIEWED_VERSION_INCREMENT: YES',
  'P3_AUTHORITY_DIGEST_COMPUTED_AFTER_APPROVED_VERSION_INCREMENT: YES',
  'P3_AUTHORITY_BINDS_PRE_APPROVAL_ACTION_DIGEST: NO',
  'P3_ACTION_APPROVAL_TRANSITION_OWNER: SECURITY_ISSUE_CONVERSION_AUTHORITY',
  'P3_EXECUTOR_RECHECKS_APPROVED_ACTION_SET_DIGEST: YES',
  'P3_EXECUTED_ACTION_VERSION_CHANGE_INVALIDATES_LIVE_AUTHORITY_DIGEST_MATCH: EXPECTED',
  'P3_EXACT_REPLAY_REHASHES_EXECUTED_ACTIONS_AGAINST_APPROVED_AUTHORITY_DIGEST: NO',
  '`center_cloud_entities` is not canonical Student',
  '`crm_contact` may be incomplete or represent a third party',
], 'Canonical target decisions')

includesAll(report, [
  'F23.13C design exists != step-up runtime exists',
  'F23.13D design exists != capability resolver exists',
  'F23.2 design exists != Guardian–Student relationship runtime exists',
  'P3_CONVERSION_AUTHORITY_PURPOSE: crm.real_conversion.execute',
  'P3_STEP_UP_ASSERTION_SINGLE_USE: YES',
  'P3_CONVERSION_AUTHORITY_SINGLE_USE: YES',
  'P3_RAW_STEP_UP_REUSED_BY_EXECUTOR: NO',
  'BROWSER_SUPPLIES_ROLE: NO',
  'BROWSER_SUPPLIES_CENTER_AUTHORITY: NO',
  'BROWSER_SUPPLIES_STEP_UP_TRUTH: NO',
  'BROWSER_SUPPLIES_MATCH_DECISION_AS_AUTHORITY: NO',
  'BROWSER_SUPPLIES_TARGET_REUSE_AUTHORITY: NO',
  'P3_CALLER_ROLE_STRING_IS_AUTHORITY: NO',
  'P3_CALLER_CENTER_ID_IS_AUTHORITY: NO',
  'P3_SERVICE_ROLE_ITSELF_IS_END_USER_AUTHORITY: NO',
], 'Authority and browser boundaries')

includesAll(report, [
  '`legacy_request_action_graph_digest` is the exact current',
  '`p3_canonical_action_set_digest` is a P3 server-derived, deterministic,',
  'legacy_request_action_graph_digest bytea(32)',
  'p3_action_set_encoding_version integer',
  'p3_action_set_digest bytea(32)',
  '`f23_3e_p3b_internal_action_set_digest`',
  'encoding version, Request ID,',
  'action rows ordered by',
  'action-intent digest, identity kind, review and reservation bindings',
  'target namespace/ID/version',
  'relationship endpoint IDs and finite relationship',
  'safe reason codes, and all relevant policy versions',
  'current Request.action_graph_digest ==',
  'authority.legacy_request_action_graph_digest',
  'recomputed APPROVED action-set digest V1 == authority.p3_action_set_digest',
  'REQUEST_ACTION_BINDING_STALE',
  'ACTION_SET_STALE',
  'finalized_action_set_digest, action_set_encoding_version',
  'No extra action-plan aggregate is needed',
  'after its bound legacy `Request.action_graph_digest` changes',
  'after canonical action rows change',
  'one digest domain substituted for the other',
  'caller-supplied legacy Request digest is treated as proof of the P3 plan',
], 'Independent legacy Request and canonical P3 action-set bindings')
assert(!report.includes('f23_3e_p3b_internal_action_graph_digest'), 'Old same-domain digest helper must not survive')
assert(!report.includes('crm_conversion_authority_one_issued_graph_idx'), 'Old legacy-digest authority index must not survive')
assert(!report.includes('finalized_action_graph_digest'), 'Finalization must return the P3 action-set digest')
assert(!report.includes('exact equality to Request digest'), 'P3 action-set digest must not equal the legacy Request digest by contract')
assert(!report.includes('ordered digest must equal the immutable Request digest'), 'No same-class digest assumption may survive')
assert(!report.includes('\naction_graph_digest bytea(32)\n'), 'Authority shape must not use ambiguous action_graph_digest')
assert(!report.includes('P3 action-set digest V1 before transitioning every row to `REVIEWED`'), 'Old P3C digest-before-transition wording must not survive')
assert(!report.includes('computes/stores the independent canonical P3 action-set digest V1, then moves actions to `REVIEWED`'), 'Old P3C finalization order must not survive')
includesAll(report, [
  'with each action ID, action version, action kind',
  'current PROPOSED rows. It is not the finalized REVIEWED digest',
  'no half-REVIEWED plan',
  'no standalone public action-approval RPC',
  'post-transition persisted APPROVED version set',
  'leaves the step-up unconsumed',
  'PROPOSED → REVIEWED +1\n→ compute REVIEWED digest',
  'REVIEWED → APPROVED +1\n→ compute APPROVED digest\n→ issue authority',
  'verify APPROVED digest\n→ execute\n→ APPROVED → EXECUTED +1\n→ consume authority\n→ commit',
], 'Lifecycle-state digest semantics and exact ownership chains')

const p3cFinalization = sectionBetween(
  report,
  '### P3C finalization lifecycle ordering',
  '`crm_conversion_authority` has this exact shape:',
  'P3C finalization lifecycle ordering',
)
assertOrdered(p3cFinalization, [
  'lock the complete PROPOSED action rows',
  'transition every eligible action PROPOSED → REVIEWED +1',
  're-read or reuse RETURNING post-transition persisted REVIEWED rows',
  'compute P3 action-set digest V1 from post-transition REVIEWED rows',
  'append any required finalization Audit/Outbox',
  'return finalized_action_set_digest, action_set_encoding_version,',
  'post-transition max_action_version',
  'commit',
], 'P3C must increment/persist REVIEWED versions before authoritative digest')
assert.doesNotMatch(
  p3cFinalization,
  /compute P3 action-set digest[\s\S]{0,500}transition every eligible action PROPOSED → REVIEWED/i,
  'P3C must reject digest-before-REVIEWED-transition ordering',
)

const p3bIssuance = sectionBetween(
  report,
  '### Issuance transaction',
  '## Canonical target and binding models',
  'P3B authority issuance lifecycle ordering',
)
assertOrdered(p3bIssuance, [
  'lock CONVERSION_ACTION_ROWS',
  'complete REVIEWED action rows',
  'consume step-up assertion',
  'transition Request READY_FOR_REVIEW → APPROVED, version +1',
  'transition every current action REVIEWED → APPROVED, action_version +1',
  're-read or reuse RETURNING persisted APPROVED action rows',
  'compute P3 action-set digest V1 from post-transition APPROVED rows',
  'insert ISSUED conversion authority',
  'store exact authority idempotency result',
  'COMMIT',
], 'P3B must increment/persist APPROVED versions before authority digest and insert')
assert.doesNotMatch(
  p3bIssuance,
  /compute P3 action-set digest[\s\S]{0,500}transition every current action REVIEWED → APPROVED/i,
  'P3B must reject digest-before-APPROVED-transition ordering',
)

const p3dExecutor = sectionBetween(
  report,
  '## Atomic executor contract',
  '## Idempotency, events and privacy',
  'P3D executor lifecycle ordering',
)
assertOrdered(p3dExecutor, [
  'verify complete canonical typed APPROVED action rows',
  'recompute APPROVED action-set digest from persisted rows',
  'verify recomputed APPROVED action-set digest V1 == authority.p3_action_set_digest;',
  'for each approved Student action:',
  'transition every executed action APPROVED → EXECUTED, action_version +1',
  'mark conversion authority CONSUMED',
  'store exact safe P3 idempotency result',
  'COMMIT',
], 'P3D must verify APPROVED digest before execution and terminalize afterward')
includesAll(p3dExecutor, [
  'do not lock or rehash live EXECUTED action rows',
  'consumed authority keeps its immutable APPROVED action-set digest',
  'never rewritten to an EXECUTED',
  'rollback restores all actions to APPROVED',
], 'P3D exact replay and rollback lifecycle')

includesAll(report, [
  '`account_security_control`',
  '`account_step_up_assertion`',
  '`crm_conversion_action`',
  '`crm_conversion_authority`',
  '`student_profile`',
  '`guardian_profile`',
  '`crm_identity_target_binding`',
  '`guardian_student_relationship`',
  '`crm_idempotency_registry`',
  'center_members_conversion_version_binding_key',
  'account_step_up_assertion_one_issued_request_purpose_idx',
  'crm_conversion_authority_one_issued_action_set_idx',
  'student_profile_identity_detection_idx',
  'guardian_student_relationship_one_active_equivalent_idx',
  'f23_3e_p3c_internal_protect_target_evidence',
  'forced-RLS',
  'from Realtime',
  '`SECURITY DEFINER`',
  'empty safe',
  'grants only `service_role`',
  'internal helper is revoked from',
], 'Physical resource and privilege freeze')

includesAll(report, [
  '`security.evaluate_conversion_capability`',
  '`security.register_or_sync_account_security_control`',
  '`security.record_verified_conversion_step_up`',
  '`security.issue_conversion_authority`',
  '`security.read_conversion_authority_status`',
  '`security.revoke_or_expire_conversion_authority`',
  '`identity.create_student_target`',
  '`identity.resolve_reusable_student`',
  '`identity.create_guardian_target`',
  '`identity.resolve_reusable_guardian`',
  '`identity.upsert_guardian_student_relationship`',
  '`conversion.execute`',
  '`conversion.read_result_status`',
  '`conversion.finalize_reviewed_action_plan`',
], 'Typed conceptual operation inventory')

includesAll(report, [
  'GUARDIAN_DISPLAY_NAME',
  'GUARDIAN_CONTACT_LOOKUP_DIGEST',
  'GUARDIAN_SOURCE_BINDING',
  '`STUDENT_DISPLAY_NAME`',
  '`STUDENT_BIRTH_DATE`',
  'deduplicated and byte-sorted',
], 'Identity mutex domain freeze')

includesAll(report, [
  '0. CENTER_CRM_CONTROL_ROW',
  '1. SORTED_IDENTITY_MUTEX_ROWS',
  '2. ACCOUNT_SECURITY_CONTROL_ROW',
  '3. STEP_UP_ASSERTION_ROW',
  '4. MEMBERSHIP_AND_CAPABILITY_SUPPORT_ROWS',
  '5. SINGLE_USE_CONVERSION_AUTHORITY_ROW',
  '6. IDEMPOTENCY_REGISTRY_ROW',
  '7. CONVERSION_REQUEST_ROW',
  '8. CONVERSION_ACTION_ROWS',
  '9. CRM_CONTACT_ROW',
  '10. CONSULTATION_CASE_ROW',
  '11. CANDIDATE_STUDENT_ROWS',
  '12. ASSIGNMENT_ROW',
  '13. EXISTING_TARGET_PROFILE_ROWS',
  '14. MATCH_REVIEW_ROWS',
  '15. PROFILE_CREATION_RESERVATION_ROWS',
  '16. GUARDIAN_STUDENT_RELATIONSHIP_ROWS',
  '17. AUDIT_ROWS',
  '18. OUTBOX_ROWS',
  '19. COMMIT',
], 'Canonical P3 lock order')

includesAll(report, [
  'Request READY_FOR_REVIEW → APPROVED',
  '`APPROVED → EXECUTING → COMPLETED`',
  '`READY_FOR_CONVERSION/REVIEW_PENDING → CONVERTED/COMPLETED`',
  '`ACTIVE → ENDED`',
  '`ACTIVE → CONSUMED`',
  'reservation.preallocated_target_id',
  'TARGET_VERSION_STALE',
  'ROLLBACK',
  '`COMPENSATION_REQUIRED` is not used',
], 'Lifecycle and transaction freeze')

includesAll(report, [
  'mfa.step_up.consumed',
  'crm.conversion.approved',
  'crm.conversion.authority_issued',
  'crm.student.created_from_conversion',
  'crm.student.reused_for_conversion',
  'crm.guardian.created_from_conversion',
  'crm.guardian.reused_for_conversion',
  'crm.guardian_student_relationship.created',
  'crm.conversion.authority_consumed',
  'crm.conversion.completed',
], 'Finite event set')

assert.equal(count(report, /^\| P3-R(?:[1-9]|1[0-9]|2[01])\b/gm), 21, 'P3 race matrix must contain 21 rows')
assert.equal(count(report, /^\| P3-N(?:[1-9]|1[0-9]|2[0-4])\b/gm), 24, 'P3 negative matrix must contain 24 rows')

const p2dReport = read('docs/f23-3e-p2d-integrated-duplicate-concurrency-security-fault-qa-and-p3-entry-gate.md')
const p2aMigration = read('supabase/migrations/202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql')
const p2bMigration = read('supabase/migrations/202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql')
const p2cMigration = read('supabase/migrations/202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql')
const p1aMigration = read('supabase/migrations/202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql')
const p1bMigration = read('supabase/migrations/202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql')
const f13c = read('docs/f23-13c-mfa-enrollment-enforcement-recovery-va-step-up.md')
const f13d = read('docs/f23-13d-consultant-provisioning-capability-matrix-va-server-enforcement.md')
const relationshipDesign = read('docs/f23-2-phu-huynh-tu-van-hoc-vien-relationship-lifecycle-design.md')
const remoteSchema = read('supabase/migrations/20260722000000_remote_schema.sql')
const studentWriter = read('src/cloud-realtime-students.js')
const cloudWriter = read('src/cloud-db-sync.js')

includesAll(p2dReport, [
  'P2D_P2_FOUNDATION_READY_FOR_P3_IMPLEMENTATION: YES',
  'P2D_REAL_CONVERSION_EXECUTION_READY: NO',
  'P2D_P3_BLOCKING_PREREQUISITE_COUNT: 7',
  ...blockerInputs,
], 'P2D inherited gate truth')
includesAll(p2aMigration, [
  "check (status in ('ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'))",
  "when 'CONSUMED' then 'CONSUMED_BY_FUTURE_EXECUTOR'",
  'preallocated_target_id uuid not null',
  'identity_match_mutex_key bytea primary key',
], 'P2A physical reservation/mutex truth')
includesAll(p2bMigration, [
  "'adapter_namespace', 'legacy.center_cloud_student.readonly.v1'",
  "'reuse_eligible', false",
  "return public.f23_3e_p2b_internal_safe_result('MATCH_SEARCH_UNAVAILABLE')",
], 'P2B detection-only truth')
includesAll(p2cMigration, [
  "'future.student.profile.v1'",
  "'profile_created', false",
  "'profile_reused', false",
  "'conversion_approved', false",
  "'request_completed', false",
], 'P2C non-authority truth')
assert(!/set\s+status\s*=\s*'CONSUMED'/i.test(p2cMigration), 'P2C must still own no reservation consume')

includesAll(p1aMigration, [
  "'DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'EXECUTING', 'COMPLETED'",
  "'READY_FOR_CONVERSION'",
  "'CONVERTED'",
  "'REVIEW_PENDING'",
  "'COMPLETED'",
  'action_graph_digest bytea not null',
], 'P1 Request/Case physical vocabulary')
assert(!/create table public\.crm_conversion_action\b/i.test(p1aMigration), 'P1A must not already have a physical action child')

includesAll(p1bMigration, [
  'p_action_graph_digest bytea',
  'octet_length(p_action_graph_digest) <> 32',
  "p_action_graph_digest, 'consultation_case'",
  'p_new_action_graph_digest bytea',
  'octet_length(p_new_action_graph_digest) <> 32',
  'action_graph_digest = p_new_action_graph_digest',
  'v_request.action_graph_digest is distinct from p_expected_action_graph_digest',
], 'P1B caller-supplied opaque action-graph binding provenance')
assert(/insert into public\.crm_conversion_request\s*\([\s\S]*?action_graph_digest[\s\S]*?\) values \([\s\S]*?p_action_graph_digest/i.test(p1bMigration), 'P1B create must write the caller-supplied digest directly to Request')
assert(!/p_action_graph_digest\s*:=\s*(?:extensions\.)?digest/i.test(p1bMigration), 'P1B must not derive the caller-supplied digest with a serializer')

includesAll(f13c, [
  'SERVER_DERIVED_STEP_UP_IMPLEMENTED: NO',
  'STEP_UP_ASSERTION_SINGLE_USE: YES',
  'BUSINESS_DOMAIN_ROOT_PRECEDES_ACCOUNT_SECURITY_FOR_COMPOSITE_MUTATION: YES',
], 'F23.13C composition truth')
includesAll(f13d, [
  'CONSULTANT_CAPABILITY_RESOLVER_IMPLEMENTED: NO',
  'CONSULTANT_CAPABILITY_SERVER_DERIVED: YES',
  'CONSULTANT_CAPABILITY_CLIENT_IS_AUTHORITY: NO',
], 'F23.13D resolver truth')
includesAll(relationshipDesign, [
  'CONTACT_OR_LEAD_IS_PARENT_PROFILE: NO',
  'ONE_GUARDIAN_CAN_LINK_MULTIPLE_STUDENTS: YES',
  'ONE_STUDENT_CAN_LINK_MULTIPLE_GUARDIANS: YES',
  'MISSING_RELATIONSHIP_ACTION_IS_APPROVED_NO_RELATIONSHIP: NO',
], 'F23.2 relationship truth')

includesAll(remoteSchema, [
  'CREATE TABLE public.center_cloud_entities',
  'payload        jsonb',
  'CREATE TABLE public.center_members',
  'role       text',
  'status     text',
  'ALTER PUBLICATION supabase_realtime ADD TABLE public.center_cloud_entities',
], 'Current generic cloud/membership schema truth')
includesAll(studentWriter, ['upsertStudentCloudEntity', 'upsertCloudEntities'], 'Current Student writer truth')
includesAll(cloudWriter, [".from('center_cloud_entities')", '.upsert(records'], 'Generic cloud writer truth')
assert(!studentWriter.includes('crm_identity_match_mutex'))
assert(!cloudWriter.includes('crm_identity_match_mutex'))

const auditedContent = [report, smoke].join('\n')
for (const value of [
  'C\u0103\u00a1\u00c2\u00ba', '\u0103\u0192', '\u0103\u2020\u00b0',
  'H\u0103\u00a1\u00c2\u00ba', '\u0103\u00a1\u00c2\u00bb',
  'Bu\u0103\u00a1\u00c2\u00bb\u00e2\u20ac\u00a2i h\u0103\u00a1\u00c2\u00bb\u00c2\u008dc m\u0103\u00a1\u00c2\u00bb\u00e2\u20ac\u00bai',
]) assert(!auditedContent.includes(value), `Mojibake detected: ${value}`)
assert(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(auditedContent), 'JWT-like token found in P3A artifacts')
assert(!/(?:sk|sbp|ghp)_[A-Za-z0-9_-]{16,}/.test(auditedContent), 'Secret-like token found in P3A artifacts')
assert(!/[a-z0-9-]{10,}\.supabase\.co/i.test(auditedContent), 'Remote project locator found in P3A artifacts')

const totalInventoryExpression = ['migrationFiles', 'length'].join('.')
assert(!smoke.includes(`${totalInventoryExpression} ===`), 'P3A smoke must not freeze total migration inventory')
assert(!smoke.includes(`${totalInventoryExpression},`), 'P3A smoke must remain forward-compatible')

console.log('F23.3E-P3A real-conversion dependency closure and atomic executor design-freeze semantic smoke passed')
