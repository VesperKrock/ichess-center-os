import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const designRelative = 'docs/f23-3e-p2-identity-duplicate-review-mutex-reservation-design.md'
const smokeRelative = 'tests/f23-3e-p2-identity-duplicate-review-mutex-reservation-design-smoke.js'
const designPath = join(root, designRelative)
const smokePath = join(root, smokeRelative)
const migrationsPath = join(root, 'supabase', 'migrations')
const canonicalRoadmapPath = join(root, 'docs', 'f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const localRoadmapPath = join(root, 'RoadmapRealTime.txt')

for (const path of [designPath, smokePath, canonicalRoadmapPath, localRoadmapPath]) {
  assert(existsSync(path), `Missing required file: ${path}`)
}

const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8')
const design = read(designRelative)
const smoke = read(smokeRelative)
const canonicalRoadmap = readFileSync(canonicalRoadmapPath, 'utf8')
const localRoadmap = readFileSync(localRoadmapPath, 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()

const includesAll = (content, values, label) => {
  for (const value of values) assert(content.includes(value), `${label}: missing ${value}`)
}

const section = (startMarker, endMarker) => {
  const start = design.indexOf(startMarker)
  const end = endMarker ? design.indexOf(endMarker, start + startMarker.length) : design.length
  assert(start >= 0 && end > start, `Missing design section: ${startMarker}`)
  return design.slice(start, end)
}

const assertOrdered = (content, markers, label) => {
  let cursor = -1
  for (const marker of markers) {
    const position = content.indexOf(marker, cursor + 1)
    assert(position > cursor, `${label}: missing/out-of-order ${marker}`)
    cursor = position
  }
}

const assertMatrix = ({ start, end, prefix, count, columns }) => {
  const content = section(start, end)
  const pattern = new RegExp(`^\\| P2-${prefix}(\\d+)\\b`)
  const rows = content.split(/\r?\n/).filter((line) => pattern.test(line))
  const ids = rows.map((line) => Number(line.match(pattern)[1]))
  assert.equal(rows.length, count, `P2-${prefix} matrix count drift`)
  assert.deepEqual(ids, Array.from({ length: count }, (_, index) => index + 1), `P2-${prefix} IDs drift`)
  for (const row of rows) {
    const values = row.split('|').slice(1, -1).map((value) => value.trim())
    assert.equal(values.length, columns, `P2-${prefix} column drift: ${row}`)
    for (const value of values.slice(1)) assert(value.length >= 12, `P2-${prefix} row is not substantive: ${row}`)
  }
}

const statusPrefix = [
  'F23_3E_P2_STATUS: DESIGN IMPLEMENTED IN REPO',
  'F23_3E_P2_FINAL_TECHNICAL_AUDIT: PASS',
  '',
  'F23_3E_P2_DESIGN: COMPLETE',
  'F23_3E_P2_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P2_MIGRATION_CREATED: NO',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
].join('\n')
assert(design.startsWith(statusPrefix), 'P2 design status prefix drift')
assert(!design.includes('F23_3E_P2_FINAL_TECHNICAL_AUDIT: NOT RUN'), 'P2 external-audit closeout is missing')
includesAll(design, [
  'F23_3E_P2_EXTERNAL_TECHNICAL_AUDIT_VERDICT: PASS',
  'F23_3E_P2_EXTERNAL_TECHNICAL_AUDIT_BLOCKERS: NONE',
  'External technical audit: PASS.',
  'F23_3E_P2_IMPLEMENTATION_READINESS: SAFE TO REQUEST EXPLICIT P2A IMPLEMENTATION APPROVAL',
  'F23_3E_P2_PRODUCTION_READINESS: NOT CLAIMED',
  'F23_3E_P2_SQL_CHANGE: NO',
  'F23_3E_P2_SRC_RUNTIME_CHANGE: NO',
  'F23_3E_P2_SUPABASE_LOCAL_ACTION: NOT RUN',
  'F23_3E_P2_REMOTE_APPLY: NOT RUN',
  'F23_3E_P2_AUTH_CHANGE: NO',
  'F23_3E_P2_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P2_DEPLOY: NOT RUN',
  'F23_3E_P2_BROWSER_UI_WIRING: NOT STARTED',
  'F23_3E_P2_REAL_IMPORT: NOT RUN',
  'F23_3E_P2_REAL_DATA_CHANGE: NO',
  'F23_3E_P2_FULL_CONTACT_REVEAL: NOT IMPLEMENTED',
  'F23_3E_P2_CONVERSION_APPROVAL: NOT IMPLEMENTED',
  'F23_3E_P2_PROFILE_CREATION: NOT IMPLEMENTED',
  'F23_3E_P2_RELATIONSHIP_CREATION: NOT IMPLEMENTED',
], 'P2 design/execution boundary')
includesAll(design, [
  'repo-truth Guardian, Student, and',
  'the six canonical match outcomes',
  '`NO_MATCH` not being',
  'current `EXACT_REVIEWED_MATCH`-only reuse',
  'versioned',
  'stable byte-sorted identity mutex',
  'exact-center',
  'masked `NO_STORE` projections',
  'immutable reviewed evidence',
  'create-new reservation without create authority',
  'fail-closed normalization and',
  'canonical lock order',
  'P2/P3 authority separation',
  'idempotency',
  'Audit/Outbox PII minimization',
  'P2-R1–P2-R16',
  'P2-N1–P2-N24',
  'physical proposal',
  'typed operation proposal',
  'P2A–P2D implementation sequence',
], 'External technical audit verification note')
includesAll(design, [
  'CURRENT_PHYSICAL_CONVERSION_ACTION_AGGREGATE: NOT ESTABLISHED AS A SEPARATE TABLE BY P1',
  'P2A MUST NOT invent a foreign key to a nonexistent action table.',
  'current canonical Request/action-graph representation actually present at P2A implementation time',
  'opaque action identity/action-intent digest and version binding',
  'If satisfying exact action binding requires a new canonical action aggregate beyond approved P2A scope:',
  'STOP NEEDS REVIEW.',
  'implementation clarification, not a new physical aggregate',
], 'P2A current action-binding handoff')

const migrationCheckpoints = new Map([
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
])
const migrationFiles = readdirSync(migrationsPath).filter((name) => name.endsWith('.sql')).sort()
assert.equal(migrationFiles.length, 11, 'Migration inventory changed during P2 design')
for (const [name, expectedHash] of migrationCheckpoints) {
  assert(migrationFiles.includes(name), `Missing migration checkpoint: ${name}`)
  assert.equal(sha256(join(migrationsPath, name)), expectedHash, `Immutable migration changed: ${name}`)
  includesAll(design, [name, expectedHash], `P2 checkpoint inventory ${name}`)
}
assert.equal(migrationFiles.filter((name) => /f23_3e_p2/i.test(name)).length, 0, 'P2 SQL migration exists')

const exactArtifacts = [designRelative, smokeRelative].sort()
const discoveredArtifacts = [
  ...readdirSync(join(root, 'docs')).filter((name) => name.includes('f23-3e-p2-identity')).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.includes('f23-3e-p2-identity')).map((name) => `tests/${name}`),
  ...migrationFiles.filter((name) => /f23_3e_p2/i.test(name)).map((name) => `supabase/migrations/${name}`),
].sort()
assert.deepEqual(discoveredArtifacts, exactArtifacts, 'P2 must contain exactly two named artifacts')

const migrationSource = migrationFiles.map((name) => read(`supabase/migrations/${name}`)).join('\n')
const storageSource = read('src/storage.js')
const parentSource = read('src/parent-consultation-module.js')
const studentModule = read('src/student-module.js')
const studentData = read('src/student-data.js')
const cloudSync = read('src/cloud-db-sync.js')
const cloudEntities = read('src/cloud-db-entities.js')
const tuitionLinks = read('src/student-tuition-links.js')
const p1aReport = read('docs/f23-3e-p1a-canonical-crm-schema-and-control-root.md')
const p1fReport = read('docs/f23-3e-p1f-integrated-qa-and-rollout-gates.md')

includesAll(migrationSource, [
  'create table public.center_crm_control',
  'create table public.crm_contact',
  'create table public.consultation_case',
  'create table public.consultation_case_candidate_student',
  'create table public.crm_conversion_request',
  'create table public.crm_idempotency_registry',
  'create table public.crm_audit_event',
  'create table public.crm_outbox_event',
  'CREATE TABLE public.center_cloud_entities',
  'CREATE TABLE public.center_members',
], 'Current schema truth')
assert(!/create\s+table(?:\s+if\s+not\s+exists)?\s+public\.(?:guardian_profile|student_profile|guardian_student_relationship)\b/i.test(migrationSource), 'Design invented a current canonical person/relationship table')
includesAll(storageSource, [
  "createCenterScopedStorageKey('students')",
  "createCenterScopedStorageKey('parentConsultations')",
  'export function getStoredStudents',
  'export function saveStoredStudents',
  'export function getStoredParentConsultations',
  'export function saveStoredParentConsultations',
], 'Local legacy repository truth')
includesAll(parentSource, ['buildParentConvertPreview', 'getParentConvertCandidates'], 'Parent preview repository truth')
includesAll(studentModule, ['parentName', 'fatherPhone', 'motherPhone'], 'Embedded Student guardian fields')
includesAll(studentData, ['sampleStudents', 'studentStatuses'], 'Student data repository truth')
includesAll(cloudEntities, ["STUDENT: 'student'", 'buildCloudEntityRecord'], 'Generic Student cloud entity truth')
includesAll(cloudSync, ['RESERVED_CANONICAL_CRM_ENTITY_TYPES', "CLOUD_ENTITY_TYPES.STUDENT", "from('center_cloud_entities')"], 'Cloud adapter and CRM deny truth')
includesAll(tuitionLinks, ['buildStudentTuitionLink', 'studentId'], 'Student tuition-link truth')
includesAll(p1aReport, ['No Guardian profile, canonical Student profile, Guardian–Student Relationship'], 'P1A absent-target truth')
includesAll(p1fReport, ['F23_3E_P2_ENTRY_TECHNICAL_GATE: PASS', 'F23_3E_P1F_PRODUCTION_READINESS: NOT CLAIMED'], 'P1F entry/boundary truth')

includesAll(design, [
  'CURRENT_GUARDIAN_CANONICAL_RUNTIME: ABSENT',
  'CURRENT_STUDENT_CANONICAL_RUNTIME: PARTIAL/NOT PROTECTED CANONICAL',
  'CURRENT_GUARDIAN_STUDENT_RELATIONSHIP_RUNTIME: ABSENT',
  'Guardian: BLOCKED, adapter absent',
  'Student: BLOCKED until the local/generic cloud model has an approved protected server adapter',
  '`EXISTING_PROFILE_REUSE`',
  '`NEW_PROFILE_CREATE`',
  '`RELATIONSHIP_TARGET`',
], 'Repo-truth and adapter boundary')

const exactOutcomes = [
  'NO_MATCH',
  'POSSIBLE_MATCH',
  'PROBABLE_MATCH',
  'EXACT_REVIEWED_MATCH',
  'CONFLICT',
  'INSUFFICIENT_EVIDENCE',
]
includesAll(design, exactOutcomes, 'Canonical match outcomes')
includesAll(design, [
  'ONLY_CURRENT_EXACT_REVIEWED_MATCH_MAY_REUSE: YES',
  'NO_MATCH_IS_AUTOMATIC_CREATE_AUTHORITY: NO',
  'POSSIBLE_MATCH_MAY_AUTO_REUSE: NO',
  'PROBABLE_MATCH_MAY_AUTO_REUSE: NO',
  'NAME_ONLY_MATCH_MAY_REUSE_PROFILE: NO',
  'INSUFFICIENT_EVIDENCE_COERCED_TO_NO_MATCH: NO',
  'CROSS_CENTER_MATCH_RESULT_MAY_BE_DISCLOSED: NO',
  'MATCH_SCOPE = EXACT_CENTER_ONLY',
  'CROSS_CENTER_STUDENT_SEARCH_INITIAL_ROLLOUT: NO',
], 'Match authority and exact-center contract')

const normalization = section('## 5. Versioned normalization contract', '## 6. Minimum-evidence')
includesAll(normalization, [
  'normalization_algorithm',
  'normalization_version',
  'identity_kind',
  'evidence_kind',
  'canonical_normalized_identity_digest',
  'policy_version',
  'Guardian/Contact',
  'Student',
  'Existing canonical ID',
  'Legacy link',
  'RAW_NORMALIZED_VALUE_PERSISTED_AS_MUTEX_KEY: NO',
  'RAW_NORMALIZED_VALUE_WRITTEN_TO_AUDIT_OUTBOX: NO',
], 'Versioned normalization contract')

const candidateSearch = section('## 6. Minimum-evidence', '## 7. Stable identity mutex')
includesAll(candidateSearch, [
  'the exact-center search completed',
  'minimum evidence is satisfied',
  'no unresolved candidate/search page remains',
  'all relevant identity mutexes are locked',
  'SEARCH_UNAVAILABLE_OUTCOME: MATCH_SEARCH_UNAVAILABLE',
  'POLICY_STALE_OUTCOME: MATCH_POLICY_STALE',
  'NORMALIZER_STALE_OUTCOME: NORMALIZER_STALE',
  'MULTIPLE_CANDIDATES_OUTCOME: MATCH_REVIEW_REQUIRED',
  'INSUFFICIENT_EVIDENCE_OUTCOME: INSUFFICIENT_IDENTITY_EVIDENCE',
], 'Candidate-search fail-closed contract')

const mutex = section('## 7. Stable identity mutex', '## 8. Normalization and policy drift')
includesAll(mutex, [
  'identity_match_mutex_key =',
  'environment_fingerprint',
  'center_id',
  'identity_kind',
  'canonical_normalized_identity_digest',
  'removes byte-identical duplicates',
  'sorts the bytes ascending',
  'ALL_RELEVANT_IDENTITY_MUTEX_KEYS_LOCKED_BEFORE_MATCH_RECHECK: YES',
  'MATCH_REVIEW_RESULT_WITHOUT_MUTEX_RECHECK_CAN_EXECUTE: NO',
  'IDENTITY_UNIQUE_INDEX_REPLACES_MUTEX: NO',
  'RAW_CONTACT_OR_BIRTH_USED_AS_MUTEX_KEY: NO',
], 'Stable mutex contract')
includesAll(section('## 8. Normalization and policy drift', '## 9. Masked candidate projection'), [
  'drain/expire plus re-review',
  'NORMALIZATION_VERSION_DRIFT_CAN_CREATE_PARALLEL_PROFILE_AUTHORITY: NO',
], 'Normalization drift contract')

const projection = section('## 9. Masked candidate projection', '## 10. Reviewed-match evidence')
includesAll(projection, [
  'candidate_projection_version',
  'identity_kind',
  'opaque_candidate_id',
  'opaque_target_id',
  'masked_attributes[]',
  'safe_attributes[]',
  'target_version',
  'evidence_summary_codes[]',
  'match_reason_codes[]',
  'normalizer_version',
  'match_policy_version',
  'projection_cache_policy = NO_STORE',
  'never contains raw phone',
  'protected Contact ciphertext',
  'lookup digests',
  'raw identity digests',
], 'Masked candidate projection')

const review = section('## 10. Reviewed-match evidence', '## 11. Profile-creation reservation')
includesAll(review, [
  'source Contact, Case, candidate, Request, and action versions',
  'reviewer attribution',
  'authority-decision version',
  'PENDING',
  'EXACT_REVIEWED_MATCH',
  'CREATE_NEW_REVIEWED',
  'REJECTED_MATCH',
  'CONFLICT',
  'EXPIRED',
  'SUPERSEDED',
  'REUSE_EXISTING',
  'PREPARE_CREATE_NEW',
  'REJECT_IDENTITY_ACTION',
  'ESCALATE_IDENTITY_CONFLICT',
  'All six',
  'destinations are terminal',
  'immutable',
  'CURRENT_REVIEWED_NO_MATCH_MAY_SUPPORT_RESERVATION_RECHECK: YES',
  'CREATE_NEW_REVIEWED_IS_PROFILE_CREATE_AUTHORITY: NO',
  'MATCH_REVIEW_STALE',
  'MATCH_REVIEW_REQUIRED',
], 'Reviewed-match evidence/lifecycle')

const reservation = section('## 11. Profile-creation reservation', '## 12. Absent-row serialization')
includesAll(reservation, [
  'profile_creation_reservation',
  'conversion_request_id',
  'action_id',
  'preallocated_target_id',
  'identity_mutex_keys_digest',
  'source_evidence_digest',
  'reservation_version',
  'ACTIVE',
  'CONSUMED',
  'EXPIRED',
  'CANCELLED',
  'SUPERSEDED',
  'PROFILE_CREATION_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO',
  'PREALLOCATED_TARGET_ID_MAY_BE_REUSED_BY_DIFFERENT_INTENT: NO',
  'PROFILE_UNIQUE_CONSTRAINT_REPLACES_CREATION_PROTOCOL: NO',
], 'Profile-creation reservation contract')
includesAll(section('## 12. Absent-row serialization', '## 13. Canonical lock order'), [
  'NEW_PROFILE_CREATION_LOCKS_EMPTY_PROFILE_SET: NO',
  'EMPTY_PROFILE_SET_PROVIDES_DUPLICATE_SERIALIZATION: NO',
  'complete sorted identity mutex',
], 'Absent-row race contract')

const lockOrder = section('## 13. Canonical lock order', '## 14. P2 authority boundary')
assertOrdered(lockOrder, [
  'CENTER_CRM_CONTROL_ROW',
  'SORTED_IDENTITY_MUTEX_ROWS',
  'ACCOUNT_SECURITY_CONTROL_ROWS when that protected runtime exists',
  'IDEMPOTENCY/REQUEST',
  'CONTACT/CASE/SOURCE_EVIDENCE',
  'ASSIGNMENT when relevant',
  'EXISTING_TARGET_PROFILE_ROWS in stable type+ID order',
  'MATCH_REVIEW_ROWS',
  'PROFILE_CREATION_RESERVATION_ROWS',
  'AUDIT_OUTBOX',
  'COMMIT',
], 'Canonical P2 lock order')
includesAll(lockOrder, [
  'reservation-first',
  'target-before-mutex',
  'review-before-mutex-',
  'unique-index-only serialization',
  'Request remains before Contact/Case/Assignment',
], 'Forbidden inversion proof')

includesAll(section('## 14. P2 authority boundary', '## 15. Idempotency'), [
  'P2_REVIEW_DECISION_IS_CONVERSION_APPROVAL: NO',
  'P2_RESERVATION_IS_PROFILE_CREATE_AUTHORITY: NO',
  'P2_EXECUTES_REAL_CONVERSION: NO',
  'mark a Case',
  '`CONVERTED`',
  'mark a Request `COMPLETED`',
  'not call LocalStorage',
], 'P2/P3 authority separation')

const idempotency = section('## 15. Idempotency and replay', '## 16. Audit, Outbox')
includesAll(idempotency, [
  'Persisted candidate-search snapshot',
  'Submit/create review decision',
  'Create reservation',
  'Cancel/expire/supersede',
  'same intent',
  'different intent',
  '`IDEMPOTENCY_CONFLICT`',
  'terminal result using a current row',
], 'P2 idempotency semantics')

const eventsAndErrors = section('## 16. Audit, Outbox', '## 17. Concurrency race matrix')
includesAll(eventsAndErrors, [
  'one immutable Audit event',
  'one durable Outbox event',
  'same server correlation ID',
  'Same-intent replay creates no second event',
  'raw normalized identity',
  'raw identity/evidence digests',
  'P2 makes no network guarantee',
  'MATCH_REVIEW_REQUIRED',
  'INSUFFICIENT_IDENTITY_EVIDENCE',
  'MATCH_POLICY_STALE',
  'NORMALIZER_STALE',
  'SOURCE_VERSION_STALE',
  'TARGET_VERSION_STALE',
  'MATCH_SEARCH_UNAVAILABLE',
  'RESERVATION_STALE',
  'RESERVATION_EXPIRED',
  'RESERVATION_CONFLICT',
  'RESOURCE_NOT_AVAILABLE',
  'IDEMPOTENCY_CONFLICT',
], 'Audit/Outbox and safe errors')

assertMatrix({
  start: '## 17. Concurrency race matrix P2-R1–P2-R16',
  end: '## 18. Negative matrix',
  prefix: 'R',
  count: 16,
  columns: 7,
})
assertMatrix({
  start: '## 18. Negative matrix P2-N1–P2-N24',
  end: '## 19. Threat model',
  prefix: 'N',
  count: 24,
  columns: 3,
})
const races = section('## 17. Concurrency race matrix', '## 18. Negative matrix')
includesAll(races, [
  'two Cases evaluate same Guardian evidence',
  'two Cases evaluate same Student evidence',
  'review vs source Contact update',
  'review vs Student/Guardian target update',
  'review vs normalization-version rollout',
  'create-reservation vs create-reservation same logical identity',
  'reservation expiry vs P3 future approval attempt',
  'request cancel vs reservation create',
  'same idempotency key same intent',
  'same idempotency key different intent',
  'old reviewed reuse vs target-version change',
  'two identities share one phone/email evidence',
  'Guardian create-new vs canonical Guardian editor',
  'Student create-new vs Student editor',
  'center suspend vs review/reservation mutation',
  'reassignment/security revoke while reviewer acts',
], 'Required race inventory')

const negatives = section('## 18. Negative matrix', '## 19. Threat model')
for (const phrase of [
  'phone exact match auto-reuses', 'email exact match auto-reuses', 'name-only match reuses',
  'birth/name-only Student reuses', 'NO_MATCH directly authorizes create',
  'INSUFFICIENT_EVIDENCE treated as NO_MATCH', 'candidate-search outage treated as NO_MATCH',
  'cross-center candidate existence leaks', 'stale review reused', 'stale target version reused',
  'stale normalizer review reused', 'stale match-policy review reused', 'raw PII used as mutex key',
  'unsorted mutex acquisition', 'unique constraint used instead of mutex',
  'reservation created before mutex recheck', 'reservation grants create authority',
  'reservation target ID rebound', 'reservation moved between requests', 'expired reservation accepted',
  'terminal review edited in place', 'same idempotency key different intent overwrites',
  'raw candidate data enters Audit/Outbox', 'P2 marks conversion Request COMPLETED',
]) assert(negatives.includes(phrase), `Missing negative case: ${phrase}`)

const threats = section('## 19. Threat model', '## 20. Future physical-schema proposal')
for (const phrase of [
  'Identity takeover via shared contact', 'False-positive merge', 'Duplicate-profile race',
  'Cross-center privacy oracle', 'Stale-review replay', 'Normalizer downgrade/drift',
  'Reservation hijack', 'Preallocated-ID reuse', 'Reviewer authority confusion',
  'Candidate-enumeration attack', 'Child identity overexposure', 'Idempotency overwrite',
  'Lock-order deadlock', 'Audit PII leakage',
]) assert(threats.includes(phrase), `Missing threat: ${phrase}`)

const physical = section('## 20. Future physical-schema proposal', '## 21. Future protected typed operation proposal')
for (const table of [
  'crm_identity_policy_registry',
  'crm_identity_match_mutex',
  'crm_identity_match_review',
  'crm_profile_creation_reservation',
]) includesAll(physical, [table], `Physical proposal ${table}`)
includesAll(physical, [
  'Primary key', 'Center binding', 'Versions/status', 'Timestamps',
  'Constraints/indexes', 'Ownership/retention', 'RLS enabled and forced',
  '`anon` or `authenticated` table privileges', 'no Realtime publication',
  'No Guardian, Student, or Guardian–Student table is proposed as current truth',
], 'Physical schema controls')

const operations = section('## 21. Future protected typed operation proposal', '## 22. Future implementation sequence')
for (const operation of [
  'crm.identity.search_masked_candidates',
  'crm.identity.get_masked_candidate_review_detail',
  'crm.identity.create_match_review',
  'crm.identity.decide_match_review',
  'crm.identity.supersede_match_review',
  'crm.identity.expire_match_review',
  'crm.identity.reserve_create_target',
  'crm.identity.cancel_creation_reservation',
  'crm.identity.expire_creation_reservation',
  'crm.identity.read_creation_reservation_status',
]) includesAll(operations, [operation], `Typed operation ${operation}`)
includesAll(operations, [
  'Actor/center and input versions', 'Idempotency and locks', 'Safe result/failure',
  'Audit/Outbox', 'Browser policy', 'Direct execute denied',
  'P2_ACTOR_ATTRIBUTION_GRANTS_END_USER_AUTHORITY: NO',
  'P2_FINAL_F23_13D_CAPABILITY_RESOLVER_IMPLEMENTED: NO',
], 'Typed operation authority contract')

const future = section('## 22. Future implementation sequence', '## 23. Immutable migration')
assertOrdered(future, [
  'P2A — Physical identity/review/mutex/reservation schema foundation',
  'P2B — Versioned normalization and exact-center masked candidate search',
  'P2C — Reviewed decision and create-new reservation typed runtime',
  'P2D — Integrated duplicate/concurrency/security/fault QA and P3-entry gate',
], 'P2A–P2D dependency order')
includesAll(future, [
  'Allowed files and implementation expectation', 'Local QA and audit gate',
  'Still blocked after phase', 'separate explicit user approval',
  'No phase may self-close external audit',
], 'Future implementation gates')

const currentP2Line = 'F23.3E-P2 DONE design / Identity matching, exact-center duplicate review, versioned normalization, stable sorted identity mutex, masked candidate projection và profile-creation reservation; runtime implementation chưa bắt đầu'
const p2ImplementationChildren = [
  'F23.3E-P2A TODO backend / Physical identity-policy, mutex, review và profile-creation reservation schema foundation',
  'F23.3E-P2B TODO backend / Versioned normalization và exact-center masked candidate search',
  'F23.3E-P2C TODO backend / Reviewed-match decision và create-new reservation typed runtime',
  'F23.3E-P2D TODO QA / Integrated duplicate, concurrency, security, fault QA và P3-entry gate',
]
const currentP3Line = 'F23.3E-P3 TODO backend / Fresh step-up approval, single-use authority và real conversion executor atomic'
const currentP4Line = 'F23.3E-P4 TODO public/QA / Nối UI conversion thật, legacy projection và manual QA end-to-end'
const historicalP2TodoLiteral = 'F23.3E-P2 TODO backend/design'
const historicalP2Marker = `* Historical checkpoint compatibility note — non-current P1-era marker: ${historicalP2TodoLiteral}`
const historicalP2CompatibilityLine = `${historicalP2Marker} / Identity matching, duplicate review, identity mutex và profile-creation reservation`

for (const roadmap of [canonicalRoadmap, localRoadmap]) {
  assert(/^\s*F23\.3E-P1 DONE backend\/local foundation verified\b/m.test(roadmap), 'P1 current status changed')
  includesAll(roadmap, [currentP2Line, ...p2ImplementationChildren, currentP3Line, currentP4Line, historicalP2CompatibilityLine], 'Post-audit P2 roadmap state')
  const trimmedLines = roadmap.split(/\r?\n/).map((line) => line.trim())
  const currentP2Lines = trimmedLines.filter((line) => line.startsWith('F23.3E-P2 '))
  assert.equal(currentP2Lines.length, 1, 'Roadmap must have exactly one current P2 status')
  assert.deepEqual(currentP2Lines, [currentP2Line], 'P2 current status must be DONE design')
  for (const child of p2ImplementationChildren) {
    assert.deepEqual(trimmedLines.filter((line) => line.startsWith(`${child.split(' ')[0]} `)), [child], `P2 implementation child drift: ${child}`)
  }
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P3 ')), [currentP3Line], 'P3 current status changed')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P4 ')), [currentP4Line], 'P4 current status changed')
  assert.equal(roadmap.split(historicalP2TodoLiteral).length - 1, 1, 'Historical P2 TODO literal count drift')
  assert.equal(roadmap.split(historicalP2Marker).length - 1, 1, 'Historical P2 compatibility marker count drift')
  assert.equal(roadmap.split(historicalP2CompatibilityLine).length - 1, 1, 'Historical P2 compatibility line drift')
}

for (const forbiddenClaim of [
  'F23_3E_P2_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_3E_P2_RUNTIME_IMPLEMENTATION: DONE',
  'F23_3E_P2_MIGRATION_CREATED: YES',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: YES',
  'NO_MATCH_IS_AUTOMATIC_CREATE_AUTHORITY: YES',
  'POSSIBLE_MATCH_MAY_AUTO_REUSE: YES',
  'PROBABLE_MATCH_MAY_AUTO_REUSE: YES',
  'NAME_ONLY_MATCH_MAY_REUSE_PROFILE: YES',
  'INSUFFICIENT_EVIDENCE_COERCED_TO_NO_MATCH: YES',
  'CROSS_CENTER_MATCH_RESULT_MAY_BE_DISCLOSED: YES',
  'IDENTITY_UNIQUE_INDEX_REPLACES_MUTEX: YES',
  'RAW_CONTACT_OR_BIRTH_USED_AS_MUTEX_KEY: YES',
  'NORMALIZATION_VERSION_DRIFT_CAN_CREATE_PARALLEL_PROFILE_AUTHORITY: YES',
  'PROFILE_CREATION_RESERVATION_GRANTS_PROFILE_AUTHORITY: YES',
  'PREALLOCATED_TARGET_ID_MAY_BE_REUSED_BY_DIFFERENT_INTENT: YES',
  'PROFILE_UNIQUE_CONSTRAINT_REPLACES_CREATION_PROTOCOL: YES',
  'NEW_PROFILE_CREATION_LOCKS_EMPTY_PROFILE_SET: YES',
  'EMPTY_PROFILE_SET_PROVIDES_DUPLICATE_SERIALIZATION: YES',
  'P2_REVIEW_DECISION_IS_CONVERSION_APPROVAL: YES',
  'P2_RESERVATION_IS_PROFILE_CREATE_AUTHORITY: YES',
  'P2_EXECUTES_REAL_CONVERSION: YES',
]) assert(!design.includes(forbiddenClaim), `Forbidden P2 claim: ${forbiddenClaim}`)

const newArtifacts = `${design}\n${smoke}`
const mojibakeMarkers = [
  '\u0043\u0102\u00A1\u00C2\u00BA',
  '\u0102\u0192',
  '\u0102\u2020\u00C2\u00B0',
  '\u0048\u0102\u00A1\u00C2\u00BA',
  '\u0102\u00A1\u00C2\u00BB',
  '\u0042\u0075\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00A2\u0069\u0020\u0068\u0102\u00A1\u00C2\u00BB\u00C2\u008D\u0063\u0020\u006D\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00BA\u0069',
]
for (const marker of mojibakeMarkers) assert(!newArtifacts.includes(marker), `Mojibake marker present: ${marker}`)
assert(!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(design), 'Design contains a real-looking email fixture')
assert(!/\b(?:\+?84|0)\d{8,10}\b/.test(design), 'Design contains a raw phone fixture')
assert(!/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/.test(design), 'Design contains a birth-date-shaped fixture')
assert(!/(?:eyJ[a-zA-Z0-9_-]{10,}|password\s*[:=]\s*\S+|secret[_-]?key\s*[:=]\s*\S+)/i.test(newArtifacts), 'P2 artifacts contain credential-like material')
assert(!/https?:\/\//i.test(newArtifacts), 'P2 artifacts contain an external locator')

const forbiddenCommandPatterns = [
  new RegExp(`\\b${['supabase', 'db', 'push'].join('\\s+')}\\b`, 'i'),
  new RegExp(`\\b${['supabase', 'db', 'pull'].join('\\s+')}\\b`, 'i'),
  new RegExp(`\\b${['migration', 'repair'].join('\\s+')}\\b`, 'i'),
  new RegExp(`${['-', '-', 'linked'].join('')}`, 'i'),
]
for (const pattern of forbiddenCommandPatterns) assert(!pattern.test(newArtifacts), `Forbidden command present: ${pattern}`)

assert(design.trimEnd().endsWith('F23.3E-P2 FINAL CLOSEOUT COMPLETE — EXTERNAL TECHNICAL AUDIT PASS'), 'P2 final closeout marker missing')
console.log('P2_NEW_MIGRATION_COUNT: 0')
console.log('P2_EXISTING_MIGRATION_CHANGED: NO')
console.log('F23.3E-P2 identity duplicate review mutex reservation design smoke passed')
