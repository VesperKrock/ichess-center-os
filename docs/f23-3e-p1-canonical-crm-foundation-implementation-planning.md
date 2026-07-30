# F23.3E-P1 — Canonical CRM Foundation Implementation Planning

```text
F23_3E_P1_STATUS: DONE IMPLEMENTATION PLANNING
F23_3E_P1_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1_IMPLEMENTATION_READINESS: BLOCKED
F23_3E_P1_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_P1_SQL_CHANGE: NO
F23_3E_P1_MIGRATION_CHANGE: NO
F23_3E_P1_RLS_CHANGE: NO
F23_3E_P1_AUTH_CHANGE: NO
F23_3E_P1_SUPABASE_ACTION: NOT RUN
F23_3E_P1_REAL_DATA_CHANGE: NO
```

## 1. Scope, evidence vocabulary and inherited authority

This document is implementation planning only. It specifies a future canonical, center-scoped CRM foundation; it does not create a schema, migration, endpoint, policy, worker or real record.

Evidence labels:

- **REPO FACT** — observable in the current repository.
- **PARTIAL FOUNDATION** — reusable idea or adjacent mechanism, but not canonical CRM authority.
- **DESIGN PROPOSAL** — required future implementation contract, not current runtime.
- **DEFERRED** — explicitly outside Package 1 or awaiting approval.

```text
F23_2_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_FINAL_TECHNICAL_AUDIT: PASS
F23_13C_FINAL_TECHNICAL_AUDIT: PASS
F23_13D_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P1_INHERITS_F23_2_WITHOUT_RELAXATION: YES
F23_3E_P1_INHERITS_F23_3E_WITHOUT_RELAXATION: YES
F23_3E_P1_CHANGES_DOMAIN_MODEL: NO
F23_3E_P1_CHANGES_CONVERSION_EXECUTOR_CONTRACT: NO
```

Contact, consultation case, Guardian, Student and Guardian–Student Relationship remain separate entities and lifecycles. Guardian–Student remains M:N. Consultant assignment belongs to a case/resource and never conveys ownership of a person. Exact-center, assigned-only, server-derived capability, server-side masking, no generic CRM read/write, no auto-link/merge and F23.3E single-use action-graph approval remain mandatory. A conflict with an audited contract is `FAIL / NEEDS REVIEW`, never a silent override.

## 2. Repo-truth audit

| # | Audit subject | Classification | Exact evidence and conclusion |
|---|---|---|---|
| 1 | CRM stages | REPO FACT | `src/parent-consultation-module.js:15-21` defines `lead`, `consulting`, `converted`; these are client presentation stages, not the canonical case lifecycle. |
| 2 | New-contact form | REPO FACT | `src/parent-consultation-module.js:54-59,141-190,237-252,300-321` implements a four-step browser form with client validation. |
| 3 | Current contact object | REPO FACT | `src/parent-consultation-module.js:549-621` builds one mixed object containing contact, candidate-child, consultant, care-log, appointment and enrollment-draft fields. |
| 4 | Timestamp IDs | REPO FACT | `src/parent-consultation-module.js:570,582,628` creates care/contact IDs from `Date.now()`; `src/student-module.js:415-440` likewise creates `stu-${Date.now()}`. These are not canonical IDs. |
| 5 | Center-scoped local key | PARTIAL FOUNDATION | `src/storage.js:29-59,88,1107-1129` derives `ichessCenterOS.parentConsultations.<currentStorageCenterId>` and reads/writes localStorage. A client namespace is neither exact-center authority nor multi-user locking. |
| 6 | Care logs | REPO FACT | `src/parent-consultation-module.js:624-644` prepends logs inside the contact object; `src/storage.js:2285-2311` normalizes them. There is no canonical append transaction or assignment recheck. |
| 7 | Appointments | REPO FACT | `src/parent-consultation-module.js:454-501,702-724` mutates embedded appointments; `src/storage.js:2313-2358` normalizes/sorts them. Canonical appointment schema is deferred. |
| 8 | Enrollment draft | REPO FACT | `src/parent-consultation-module.js:170-190,215-234,413-450` stores an embedded draft and can mark it ready; it is not canonical enrollment authority. |
| 9 | `studentId` and `linkedStudentIds` | REPO FACT | `src/parent-consultation-module.js:549-618,819-856` derives the converted presentation stage from string links; `src/storage.js:2191-2197,2240-2251` normalizes/deduplicates them. They do not prove Guardian/Relationship identity. |
| 10 | F23.3D preview builder | REPO FACT | `src/parent-consultation-module.js:2492-2516` builds temporary preview rows; no request/version/approval is persisted. |
| 11 | Candidate scoring | REPO FACT | `src/parent-consultation-module.js:2613-2679` rates phone overlap high, child-name/birth evidence medium and name-only evidence low. These hints are not identity authority. |
| 12 | Confirm disabled | REPO FACT | `src/parent-consultation-module.js:1308-1390` says preview is local-safe and renders `Xác nhận chuyển đổi - chưa mở` disabled. |
| 13 | Student ID/status | REPO FACT | `src/student-module.js:415-440` creates timestamp IDs; `src/student-data.js:3` has only `Đang theo học`, `Bảo lưu`, `Ngưng học`. Package 1 creates no Student and must not infer enrollment. |
| 14 | Embedded parent fields | REPO FACT | `src/student-module.js:79-104,127-159,388-440,538-563` embeds parent name/phones in Student and requires parent contact fields in the current form. They remain legacy projection/evidence, not Guardian authority. |
| 15 | Student–Tuition link | REPO FACT | `src/student-tuition-links.js:3-49,127-150` finds Tuition by `record.studentId` and rebuilds parent display from Student fields; `src/tuition-module.js:72-145` creates Tuition/payment state separately. Conversion must not create either. |
| 16 | Generic cloud list/upsert | PARTIAL FOUNDATION | `src/cloud-db-sync.js:135-180,214-252` lists payloads and upserts `center_cloud_entities`; `src/cloud-db-entities.js:15-81` accepts an allowlisted entity type plus object payload. This is not a typed CRM service. |
| 17 | Current generic audit | PARTIAL FOUNDATION | `src/cloud-audit-log.js:39-88,90-175` builds an audit payload and performs a separate `center_cloud_entities` upsert. It is not transactional proof for a CRM mutation. |
| 18 | Broad RLS snapshot | REPO FACT | `supabase/migrations/20260722000000_remote_schema.sql:365-400` contains role-aware policies alongside broad center-member SELECT/INSERT/UPDATE/DELETE policies. OR-policy behavior is a production blocker. |
| 19 | Membership/role checks | PARTIAL FOUNDATION | `src/cloud-db-sync.js:29-82` loads a center membership; `src/online-access-control.js:66-119,145-157` derives broad role-level read/write. It lacks canonical CRM capability, Staff eligibility, assignment and masking resolution. |
| 20 | Consultant security contract | REPO FACT | `docs/f23-13d-consultant-provisioning-capability-matrix-va-server-enforcement.md:111-147,231-295,311-337,360-425` requires exact-center, assigned-only capability resolution, one exclusive assignment and server masking. |
| 21 | F23.3E request/idempotency | REPO FACT | `docs/f23-3e-convert-that-phu-huynh-hoc-vien-idempotency-rollback-chong-trung.md:143-269,668-681` defines version-bound request lifecycle, action-graph digest, scoped idempotency and typed operations; Package 1 only plans its draft foundation. |
| 22 | Created/updated/version conventions | PARTIAL FOUNDATION | CRM uses timestamps without integer concurrency versions (`src/parent-consultation-module.js:549-621`). Adjacent HR records increment `revision` (`src/staff-documents-module.js:404-430`), proving a pattern but not a CRM contract. |
| 23 | Center-scoped entity patterns | PARTIAL FOUNDATION | Local keys are center-scoped (`src/storage.js:48-95`), while cloud rows carry `center_id` (`src/cloud-db-entities.js:44-56`). Both still accept client context and do not replace server-derived exact-center enforcement. |
| 24 | Transactional audit/outbox | DEFERRED | Current cloud audit is a separate upsert and local HR audit is separate localStorage append (`src/storage.js:724-813`). No canonical CRM transaction or durable outbox exists in repo truth. |
| 25 | Import/export/migration helpers | PARTIAL FOUNDATION | `src/storage.js:321-401` backs up selected local keys before cloud pulls and `src/main.js:14384-14460` applies snapshots locally. There is no controlled CRM export bundle, server import preview or approved exact-center importer. |

```text
CURRENT_CRM_LOCALSTORAGE_IS_CANONICAL_BACKEND: NO
CURRENT_GENERIC_CLOUD_ENTITY_API_IS_CANONICAL_CRM_SERVICE: NO
CURRENT_CRM_AUDIT_IS_TRANSACTIONAL_OUTBOX: NO
F23_3D_PREVIEW_IS_CANONICAL_REQUEST: NO
```

## 3. Package boundary

Package 1 plans these canonical aggregates/resources:

```text
center_crm_control
crm_contact
consultation_case
consultation_case_candidate_student
consultation_case_assignment
crm_care_log
crm_conversion_request
crm_idempotency_registry
crm_audit_event
crm_outbox_event
```

`crm_case_appointment` and `crm_case_enrollment_draft` are **DEFERRED** until their typed lifecycle and data-owner approvals exist. Arbitrary JSON on contact/case is not an acceptable substitute.

Package 1 does not implement or create `guardian_profile`, canonical `student_profile`, `guardian_student_relationship`, identity-match service/mutex, profile-creation reservation, conversion approval/executor, or legacy projection adapter. Those remain Package 2–4 concerns.

```text
F23_3E_P1_CREATES_GUARDIAN_RUNTIME: NO
F23_3E_P1_CREATES_STUDENT_RUNTIME: NO
F23_3E_P1_CREATES_RELATIONSHIP_RUNTIME: NO
F23_3E_P1_EXECUTES_REAL_CONVERSION: NO
F23_3E_P1_AUTO_CREATES_AUTH_ACCOUNT: NO
F23_3E_P1_AUTO_CREATES_MEMBERSHIP: NO
F23_3E_P1_AUTO_CREATES_TUITION_OR_PAYMENT: NO
F23_3E_P1_AUTO_CREATES_CLASS_SCHEDULE_ATTENDANCE: NO
```

## 4. Canonical source of truth and server derivation

The future system of record is a protected server transaction boundary. Browser state is a compatibility cache/import source only. Server derives `canonical_user_id`, exact `center_id`, active membership and Staff eligibility, capability, assignment, security/session versions, server time and current policy versions. Client IDs are selectors; expected versions are concurrency claims, not authority. Email, phone, display name, consultant label and UI role are evidence/display only.

```text
CRM_BROWSER_LOCALSTORAGE_IS_MULTI_USER_AUTHORITY: NO
CRM_CLIENT_CENTER_ID_IS_AUTHORITY: NO
CRM_CLIENT_ROLE_IS_AUTHORITY: NO
CRM_CLIENT_ASSIGNMENT_IS_AUTHORITY: NO
P1_SERVER_DERIVES_CANONICAL_USER_AND_CENTER: YES
P1_SERVER_DERIVES_CAPABILITY_AND_ASSIGNMENT: YES
```

Source-of-truth precedence:

1. protected canonical rows and their locked versions;
2. immutable audit/outbox as evidence of committed mutations, never as mutable authority;
3. server-generated masked projections;
4. imported legacy claims retained with provenance;
5. localStorage/UI values, which never override 1–3.

## 5. Exactly-one `center_crm_control`

Conceptual fields:

```text
center_crm_control
  center_id
  crm_schema_version
  identity_policy_version
  conversion_policy_version
  relationship_policy_version
  student_profile_policy_version
  crm_state
  feature_flag_state
  control_version
  created_at
  updated_at
```

Allowed `crm_state`: `PLANNED`, `MIGRATING`, `READ_ONLY`, `ACTIVE`, `SUSPENDED`. `ACTIVE` means Package 1 CRM operations may be enabled by exact server flag; it does not enable conversion approval/execution. `feature_flag_state` is server-authoritative center allowlist/kill-switch state, separately versioned through `control_version`.

Provisioning plan:

1. protected bootstrap inventories centers and creates exactly one row per approved center in a reviewed future migration/operation;
2. physical uniqueness on `center_id` is an integrity backstop;
3. activation reads and locks the row, validates count exactly one and approved versions, then changes state with expected `control_version`;
4. missing or duplicate rows fail closed; there is no contact/case empty-set fallback;
5. every Package 1 business mutation takes this root first and rechecks state/flags/policy versions under lock.

```text
CENTER_CRM_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE
CENTER_CRM_CONTROL_ROW_IS_MUTATION_ROOT: YES
CENTER_CRM_CONTROL_MISSING_FAILS_CLOSED: YES
CENTER_CRM_CONTROL_DUPLICATE_FAILS_CLOSED: YES
CENTER_CRM_ACTIVE_IMPLIES_CONVERSION_RUNTIME_ENABLED: NO
EMPTY_CONTACT_OR_CASE_SET_PROVIDES_SERIALIZATION: NO
```

## 6. Identifier, legacy provenance and version policy

Canonical IDs are opaque, non-reusable and server-generated, or preallocated by the same protected service before a lock-sensitive create. Recommended format is a database-native opaque UUID-family identifier chosen at approval gate AG2. IDs never contain PII, browser time, center labels or mutable policy versions.

```text
crm_contact_id
consultation_case_id
candidate_student_id
assignment_id
care_log_id
conversion_request_id
idempotency_record_id
audit_event_id
outbox_event_id
```

Legacy provenance is typed: `legacy_source_kind`, `legacy_source_id`, `legacy_source_center_id`, `import_batch_id`, `import_version`. A reviewed per-entity exact-center uniqueness rule rejects duplicate live mappings; the tuple is trace evidence, not global person identity.

```text
CLIENT_TIMESTAMP_ID_IS_CANONICAL_ID: NO
LEGACY_CONTACT_ID_IS_GLOBAL_PERSON_ID: NO
CANONICAL_ID_MAY_CONTAIN_RAW_PII: NO
CANONICAL_ID_REUSE_ALLOWED: NO
```

Mutable roots use integer monotonic versions: `contact_version`, `case_version`, `candidate_version`, `assignment_version`, `care_log_version`, `request_version`, `idempotency_version`, `control_version`. Audit/outbox events are immutable; outbox delivery metadata changes under its own `event_version`/lease rules.

```text
SUCCESSFUL_MUTATION_INCREMENTS_VERSION_BY_ONE: YES
CLIENT_MAY_SET_TARGET_VERSION: NO
EXPECTED_VERSION_REQUIRED_FOR_MUTATION: YES
STALE_VERSION_MUTATION_ALLOWED: NO
UPDATED_AT_ALONE_IS_CONCURRENCY_CONTROL: NO
```

Every successful mutation returns opaque entity ID, previous/new versions, safe outcome code and audit correlation ID. A no-op idempotent replay returns the prior result without incrementing the business version.

## 7. `crm_contact` model and lifecycle

Conceptual fields:

```text
crm_contact
  crm_contact_id
  center_id
  display_name
  contact_status
  source_category
  initial_interest
  safe_location_area
  protected_contact_methods
  normalized_lookup_digests
  contact_version
  legacy_source_kind
  legacy_source_id
  legacy_source_center_id
  import_batch_id
  created_by_user_id
  created_at
  updated_at
  archived_at
```

Contact methods are separated into keyed/versioned lookup digest, protected raw value and server-masked projection. Normalization version is recorded beside the digest; raw phone/email never appears in an ID, idempotency key/digest input exposed to client, audit, outbox routing key, log or error.

Statuses: `NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `ARCHIVED`.

| From | Allowed to | Guard/outcome |
|---|---|---|
| create | `NEW` | Server-derived center/actor; protected ID; optional reviewed import provenance. |
| `NEW` | `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `ARCHIVED` | Expected version and typed reason; case is not silently created. |
| `CONTACTED` | `QUALIFIED`, `UNQUALIFIED`, `ARCHIVED` | Current capability; no implicit Guardian/Auth mutation. |
| `QUALIFIED` | `UNQUALIFIED`, `ARCHIVED` | Existing open cases remain separately governed. |
| `UNQUALIFIED` | `CONTACTED`, `ARCHIVED` | Requalification is explicit and audited. |
| `ARCHIVED` | none in initial rollout | Restore needs a separately approved operation; no silent reopen. |

```text
CRM_CONTACT_IS_GUARDIAN_PROFILE: NO
CRM_CONTACT_IS_AUTH_ACCOUNT: NO
RAW_CONTACT_METHOD_IS_AUDIT_FIELD: NO
CONTACT_TRANSITION_CREATES_CASE_IMPLICITLY: NO
```

## 8. `consultation_case` and candidate-student evidence

Conceptual case fields:

```text
consultation_case
  consultation_case_id
  center_id
  primary_contact_id
  status
  interest_summary
  safe_case_summary
  case_version
  active_assignment_id
  conversion_state
  opened_at
  closed_at
  archived_at
  created_by_user_id
  created_at
  updated_at
```

Status vocabulary: `OPEN`, `CONSULTING`, `PAUSED`, `READY_FOR_CONVERSION`, `CONVERTED`, `LOST`, `CANCELLED`, `ARCHIVED`. Package 1 may create/update through `OPEN`, `CONSULTING`, `PAUSED`, `READY_FOR_CONVERSION`, `LOST`, `CANCELLED`, `ARCHIVED`; only Package 3 executor may set `CONVERTED` atomically with a completed canonical request.

| From | Allowed to in Package 1 | Guard/outcome |
|---|---|---|
| create | `OPEN` | Exact-center current contact; optional server-authorized assignment. |
| `OPEN` | `CONSULTING`, `PAUSED`, `LOST`, `CANCELLED`, `ARCHIVED` | Expected case/contact versions; assignment required where capability says assigned-only. |
| `CONSULTING` | `PAUSED`, `READY_FOR_CONVERSION`, `LOST`, `CANCELLED`, `ARCHIVED` | Candidate/source completeness; ready does not approve conversion. |
| `PAUSED` | `CONSULTING`, `LOST`, `CANCELLED`, `ARCHIVED` | Explicit reason and current policy. |
| `READY_FOR_CONVERSION` | `CONSULTING`, `LOST`, `CANCELLED` | Active request overlap checked; no client `CONVERTED`. |
| terminal | none | No silent reopen; protected future workflow required. |

`conversion_state` is a read projection/checkpoint only. It cannot substitute for `crm_conversion_request.status`.

```text
CASE_PRIMARY_CONTACT_EXACT_CENTER_REQUIRED: YES
CASE_STATUS_CLIENT_AUTHORITY: NO
CASE_CONVERTED_WITHOUT_COMPLETED_CONVERSION_REQUEST_ALLOWED: NO
CASE_TERMINAL_REOPEN_WITHOUT_PROTECTED_OPERATION_ALLOWED: NO
```

Candidate evidence fields:

```text
consultation_case_candidate_student
  candidate_student_id
  center_id
  consultation_case_id
  display_name_evidence
  birth_evidence_protected
  learning_need_summary
  preferred_schedule_summary
  candidate_status
  candidate_version
  created_at
  updated_at
```

Statuses: `DRAFT`, `ACTIVE`, `REVIEW_REQUIRED`, `CONVERTED`, `DISCARDED`. Package 1 can use the first, second, third and fifth states. `CONVERTED` is reserved for the later committed conversion outcome. Birth evidence is protected and excluded from default projections/audit/outbox.

```text
CANDIDATE_STUDENT_IS_CANONICAL_STUDENT: NO
CANDIDATE_STATUS_MAY_CREATE_STUDENT: NO
CANDIDATE_BIRTH_EVIDENCE_MAY_BE_RETURNED_RAW_BY_DEFAULT: NO
```

## 9. Care log and deferred supporting resources

Canonical baseline:

```text
crm_care_log
  care_log_id
  center_id
  consultation_case_id
  author_user_id
  entry_type
  safe_content
  care_log_version
  created_at
```

Care logs are append-only initially, belong to a case, and are read/appended only under current exact assignment/capability. A correction is a new typed entry referencing an opaque prior ID; edit/delete is unavailable. Append does not change contact/case status, create an appointment, copy to Student notes or expand assignment scope. Credentials, raw contact methods, child birth evidence and arbitrary attachments are rejected.

`crm_case_appointment` and `crm_case_enrollment_draft` remain **DEFERRED**. Current embedded local records can be inventoried/exported as legacy claims but cannot be stuffed into arbitrary case JSON or auto-finalize Student/Tuition/enrollment.

## 10. Assignment model and authority invalidation

```text
consultation_case_assignment
  assignment_id
  center_id
  consultation_case_id
  assigned_consultant_user_id
  assignment_status
  assignment_version
  assigned_by_user_id
  assigned_at
  ended_at
  end_reason
```

Statuses: `ACTIVE`, `ENDED`, `REVOKED`, `SUPERSEDED`.

```text
ONE_ACTIVE_EXCLUSIVE_ASSIGNMENT_PER_CASE: YES
ASSIGNMENT_HISTORY_REWRITTEN_ON_REASSIGN: NO
ASSIGNMENT_CHANGE_TRANSFERS_PERSON_OWNERSHIP: NO
CLIENT_MAY_SELF_ASSIGN: NO
ASSIGNMENT_UNIQUENESS_REPLACES_CASE_ROOT_LOCK: NO
```

Assign/reassign authority is Owner, Center Admin or exact server-derived CRM supervisor capability. The server verifies target consultant canonical account, exact-center active membership, same-center active Staff link/employment and current account-security/capability policy through F23.13D. Under the security composition detailed in §14, reassignment marks the old row `SUPERSEDED`, creates the new `ACTIVE` row, changes `case.active_assignment_id`, bumps versions, appends audit/outbox and commits once. Prior consultant authority ends at commit; care-log history remains.

All case/care-log mutations re-read `active_assignment_id` and `assignment_version` under the case/root locks. Stale cached assignment, UI consultant name or client claim never grants access.

Package 1 has only `consultation_case_assignment`; it has no `crm_contact_assignment`. A shared canonical Contact may have several cases assigned to different consultants, so assignment to one case grants only that case, its care log and its permitted conversion draft/request. It never grants global Contact mutation or ownership. Canonical Contact update/status/archive initially requires Owner, Center Admin, an exact server-derived contact-governance capability, or the protected import service within its approved import transaction. Contact create may remain available to an approved consultant under `crm.lead.create`, but creation neither creates an assignment nor grants durable update authority.

```text
P1_CONSULTANT_CASE_ASSIGNMENT_GRANTS_GLOBAL_CONTACT_MUTATION: NO
P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_UPDATE_ALLOWED: NO
P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_STATUS_TRANSITION_ALLOWED: NO
P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_ARCHIVE_ALLOWED: NO
CONTACT_AUTHORITY_MAY_BE_INFERRED_FROM_ANY_LINKED_CASE: NO
```

If consultant-level Contact mutation is later required, it needs an explicitly designed `crm_contact_assignment` or contact-resource capability. The implementation must not choose an arbitrary linked case as authority evidence.

Assign/reassign is itself an access grant. The transaction therefore locks actor and target `ACCOUNT_SECURITY_CONTROL_ROWS` in sorted `canonical_user_id` order, locks target exact-center membership and Staff eligibility, and rechecks account/security/session, membership, employment and capability before it locks the case and creates authority. An unlocked eligibility/security-version read is not proof. `crm.assignment.end` locks actor account-security, case and current assignment; target eligibility is additionally locked only when ending changes or regrants eligibility-dependent authority.

```text
ASSIGNMENT_TARGET_SECURITY_READ_WITHOUT_LOCK_IS_SUFFICIENT: NO
ASSIGNMENT_TARGET_MEMBERSHIP_STAFF_READ_WITHOUT_LOCK_IS_SUFFICIENT: NO
ASSIGNMENT_CREATION_ATOMIC_WITH_TARGET_ELIGIBILITY_RECHECK: YES
```

A security-only account revoke may lock and commit the `ACCOUNT_SECURITY_CONTROL_ROW` without a CRM business root; it never waits for case/assignment rows or then acquires the center root. A waiting assignment transaction locks that row and rechecks after acquisition. If revoke committed first, assignment fails closed; if assignment holds the security row first, revoke waits until that atomic grant ends and invalidates subsequent authority immediately after its own commit. Thus there is no account-security → center-root inversion and no concurrent revoke gap.

```text
SECURITY_ONLY_REVOKE_WAITS_FOR_CRM_CASE_LOCK: NO
WAITING_ASSIGNMENT_RECHECKS_SECURITY_AFTER_ACCOUNT_LOCK: YES
CONCURRENT_TARGET_REVOKE_CAN_BE_MISSED_BY_ASSIGNMENT: NO
ACCOUNT_SECURITY_TO_CENTER_ROOT_LOCK_INVERSION_ALLOWED: NO
```

## 11. Conversion request foundation

```text
crm_conversion_request
  conversion_request_id
  center_id
  consultation_case_id
  source_contact_id
  source_case_version
  source_contact_version
  source_assignment_version
  identity_policy_version
  conversion_policy_version
  relationship_policy_version
  student_profile_policy_version
  action_graph_digest
  request_version
  idempotency_scope
  idempotency_key_reference
  intent_digest
  status
  requested_by_user_id
  requested_at
  updated_at
  terminal_outcome_digest
```

Package 1 mutable statuses: `DRAFT`, `READY_FOR_REVIEW`, `REJECTED`, `CANCELLED`, `SUPERSEDED`. Reserved but not P1-mutable: `APPROVED`, `EXECUTING`, `COMPLETED`, `COMPENSATION_REQUIRED`.

| From | Package 1 transition | Required evidence |
|---|---|---|
| create | `DRAFT` | Assigned requester, current root/case/contact/assignment/policies, scoped idempotency and typed graph draft. |
| `DRAFT` | `DRAFT` | Expected request/source versions; server recomputes `intent_digest` and `action_graph_digest`. |
| `DRAFT` | `READY_FOR_REVIEW` | Complete graph structure, current source/policies and exact assignment. Submission is not approval. |
| `DRAFT`, `READY_FOR_REVIEW` | `CANCELLED` | Requester before approval or protected cancel authority; reason and versions. |
| `READY_FOR_REVIEW` | `REJECTED` | Independent review capability; reason and current version. No approval is created. |
| nonterminal | `SUPERSEDED` | Protected operation when source/policy/request becomes obsolete; never client overwrite. |

One active reviewable request per case is planned as an integrity constraint plus center-root → registry/request → source Contact/Case lock protocol. Historical terminal rows remain immutable. Package 1 never consumes approval or touches target profiles.

```text
P1_CLIENT_MAY_SET_APPROVED: NO
P1_CLIENT_MAY_SET_EXECUTING: NO
P1_CLIENT_MAY_SET_COMPLETED: NO
P1_REQUEST_FOUNDATION_IS_CONVERSION_EXECUTOR: NO
ONE_ACTIVE_REVIEWABLE_CONVERSION_REQUEST_PER_CASE: YES
```

## 12. Scoped idempotency registry

```text
crm_idempotency_registry
  idempotency_record_id
  environment_fingerprint
  center_id
  consultation_case_id
  operation
  idempotency_key_digest
  intent_digest
  action_graph_digest
  request_id
  status
  terminal_outcome_digest
  idempotency_version
  created_at
  expires_at
  completed_at
```

Canonical scope is `environment_fingerprint + center_id + consultation_case_id + operation + idempotency_key`. Contact/case creation uses the same pattern with its stable resource scope placeholder/preallocation instead of inventing a client timestamp ID. Raw client keys are not retained when a keyed digest suffices; secret/key version is server metadata and never logged.

Statuses: `RESERVED`, `IN_PROGRESS`, `COMPLETED`, `CONFLICT`, `EXPIRED`. Terminal outcomes survive at least the approved business/audit retention; expiry prevents new authority and never erases a committed outcome early.

```text
SAME_KEY_SAME_INTENT_RETURNS_PRIOR_RESULT: YES
SAME_KEY_DIFFERENT_INTENT_CONFLICTS: YES
IDEMPOTENCY_KEY_GRANTS_BUSINESS_AUTHORITY: NO
IDEMPOTENCY_UNIQUE_CONSTRAINT_REPLACES_ROOT_LOCK: NO
IDEMPOTENCY_RECORD_MAY_BE_OVERWRITTEN_BY_DIFFERENT_INTENT: NO
```

Under the business root, first use reserves/preallocates one row and binds operation/intent/action/source versions. Same intent returns pending or exact prior safe result without a second mutation. Different intent returns `crm_idempotency_conflict`; it cannot overwrite the record. Timeout retry resolves the registry under the same lock order before deciding whether work may start.

## 13. Transactional audit and durable outbox

```text
crm_audit_event
  audit_event_id
  center_id
  event_type
  actor_user_id
  resource_kind
  resource_id
  request_id
  assignment_id
  previous_version
  new_version
  safe_reason_code
  correlation_id
  created_at

crm_outbox_event
  outbox_event_id
  center_id
  aggregate_kind
  aggregate_id
  event_type
  event_version
  safe_payload
  delivery_status
  attempt_count
  available_at
  claim_id
  claimed_by
  claim_expires_at
  delivered_at
  created_at
```

Audit is immutable and server-authored. Every successful business mutation, its audit row and required outbox row are inserted in one database transaction. Failure to insert either rolls back business/idempotency changes. Audit/outbox carry opaque IDs, versions, safe reason and correlation only—never raw phone/email/address, candidate birth evidence, child-sensitive notes, credentials, assertions or SQL/RLS internals.

```text
CRM_AUDIT_INSERT_FAILURE_ALLOWS_BUSINESS_COMMIT: NO
CRM_AUDIT_CONTAINS_RAW_PHONE_EMAIL: NO
CRM_AUDIT_CONTAINS_CHILD_BIRTH_DATA: NO
CRM_AUDIT_IS_CLIENT_AUTHORED: NO
OUTBOX_ROW_INSERT_FAILURE_ALLOWS_BUSINESS_COMMIT: NO
OUTBOX_DELIVERY_FAILURE_ROLLS_BACK_COMMITTED_BUSINESS_MUTATION: NO
OUTBOX_DELIVERY_IS_EXACTLY_ONCE_NETWORK_GUARANTEE: NO
OUTBOX_DELIVERY_IS_IDEMPOTENT_AT_LEAST_ONCE: YES
```

Delivery begins only after commit. Workers atomically claim `PENDING/RETRY` rows with a unique claim ID, claimant, lease expiry, incremented attempt count and stable consumer key. A second worker cannot deliver during a current lease. Consumer effects are idempotent on `outbox_event_id + event_version`; retry uses capped backoff, and exhausted/poison events enter `DEAD_LETTER` for reviewed replay or `CANCELLED`. Delivery failure never rewrites the committed business transaction.

Delivery statuses: `PENDING`, `CLAIMED`, `DELIVERED`, `RETRY`, `DEAD_LETTER`, `CANCELLED`.

## 14. Canonical lock orders and atomicity

All same-tier rows sort by stable opaque ID. Structural validation happens before the transaction; authority, center, assignment, lifecycle, versions, feature flag and policy are rechecked under locks. No external call or human wait occurs while locks are held. A flow never takes a child then returns to the center root.

Package 1 inherits the immutable F23.3E executor-relative order. `IDENTITY_MATCH_MUTEX_ROWS` apply only when an approved operation actually performs identity matching; P1 does not implement that service. Center root being first never permits a different order among request, source and assignment children.

```text
CENTER_CRM_CONTROL_ROW
IDENTITY_MATCH_MUTEX_ROWS, when identity matching is required
ACCOUNT_SECURITY_CONTROL_ROWS
CONVERSION_REQUEST_AND_APPROVAL_ROWS
CONSULTATION_CASE_AND_CONTACT_ROWS
GUARDIAN_PROFILE_ROWS
STUDENT_PROFILE_ROWS
GUARDIAN_STUDENT_RELATIONSHIP_ROWS
CONSULTANT_ASSIGNMENT_AND_CARE_LOG_ROWS
PROFILE_CREATION_RESERVATION_ROWS
AUDIT_OUTBOX_ROWS

F23_3E_P1_REQUEST_LOCK_ORDER_COMPOSES_WITH_F23_3E_EXECUTOR: YES
P1_CASE_OR_ASSIGNMENT_LOCK_PRECEDES_OVERLAPPING_REQUEST_LOCK: NO
P1_REQUEST_LOCK_ORDER_INVERSION_ALLOWED: NO
```

```text
CONTACT_CREATE_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. CONTACT_IDEMPOTENCY_OR_PREALLOCATED_CONTACT_ROW
2. CRM_CONTACT_ROW
3. AUDIT_OUTBOX_ROWS
4. COMMIT_ATOMIC
CONTACT_CREATE_ATOMIC_END

CONTACT_GOVERNANCE_MUTATION_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROW, actor
2. CRM_CONTACT_ROW
3. RELATED_OPEN_CASE_ROWS_IF_SEMANTICALLY_MUTATED
4. AUDIT_OUTBOX_ROWS
5. COMMIT_ATOMIC
CONTACT_GOVERNANCE_MUTATION_ATOMIC_END

CONTACT_GOVERNANCE_WITH_REQUEST_MUTATION_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROW, actor
2. IDEMPOTENCY_REGISTRY_AND_OVERLAPPING_CONVERSION_REQUEST_ROWS
3. CRM_CONTACT_ROW
4. RELATED_OPEN_CASE_ROWS_IF_SEMANTICALLY_MUTATED
5. AUDIT_OUTBOX_ROWS
6. COMMIT_ATOMIC
CONTACT_GOVERNANCE_WITH_REQUEST_MUTATION_ATOMIC_END

CASE_CREATE_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROWS, actor and optional target consultant sorted by canonical_user_id
2. TARGET_CENTER_MEMBERSHIP_AND_STAFF_ELIGIBILITY_ROWS_IF_INITIAL_ASSIGNMENT
3. CRM_CONTACT_ROW
4. CASE_IDEMPOTENCY_OR_PREALLOCATED_CASE_ROW
5. CONSULTATION_CASE_ROW
6. INITIAL_ASSIGNMENT_ROW_IF_ANY
7. AUDIT_OUTBOX_ROWS
8. COMMIT_ATOMIC
CASE_CREATE_ATOMIC_END

CASE_WITH_REQUEST_MUTATION_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROW, actor
2. OVERLAPPING_CONVERSION_REQUEST_ROWS
3. CONSULTATION_CASE_ROW
4. CURRENT_ASSIGNMENT_ROW_IF_REQUIRED
5. AUDIT_OUTBOX_ROWS
6. COMMIT_ATOMIC
CASE_WITH_REQUEST_MUTATION_ATOMIC_END

CASE_ASSIGNMENT_SECURITY_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROWS, actor and target consultant sorted by canonical_user_id
2. TARGET_CENTER_MEMBERSHIP_AND_STAFF_ELIGIBILITY_ROWS
3. CONSULTATION_CASE_ROW
4. CURRENT_ASSIGNMENT_ROW_IF_ANY
5. PREALLOCATED_NEW_ASSIGNMENT_ROW_IF_ANY
6. AUDIT_OUTBOX_ROWS
7. COMMIT_ATOMIC
CASE_ASSIGNMENT_SECURITY_ATOMIC_END

CASE_ASSIGNMENT_WITH_REQUEST_SECURITY_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROWS, actor and target consultant sorted by canonical_user_id
2. TARGET_CENTER_MEMBERSHIP_AND_STAFF_ELIGIBILITY_ROWS
3. IDEMPOTENCY_REGISTRY_AND_OVERLAPPING_CONVERSION_REQUEST_ROWS
4. CONSULTATION_CASE_ROW
5. CURRENT_ASSIGNMENT_ROW_IF_ANY
6. PREALLOCATED_NEW_ASSIGNMENT_ROW_IF_ANY
7. AUDIT_OUTBOX_ROWS
8. COMMIT_ATOMIC
CASE_ASSIGNMENT_WITH_REQUEST_SECURITY_ATOMIC_END

CASE_ASSIGNMENT_END_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROW, actor
2. CONSULTATION_CASE_ROW
3. CURRENT_ASSIGNMENT_ROW
4. AUDIT_OUTBOX_ROWS
5. COMMIT_ATOMIC
CASE_ASSIGNMENT_END_ATOMIC_END

CASE_ASSIGNMENT_END_WITH_REQUEST_SECURITY_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROW, actor
2. IDEMPOTENCY_REGISTRY_AND_OVERLAPPING_CONVERSION_REQUEST_ROWS
3. CONSULTATION_CASE_ROW
4. CURRENT_ASSIGNMENT_ROW
5. AUDIT_OUTBOX_ROWS
6. COMMIT_ATOMIC
CASE_ASSIGNMENT_END_WITH_REQUEST_SECURITY_ATOMIC_END

CARE_LOG_APPEND_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. CONSULTATION_CASE_ROW
2. CURRENT_ASSIGNMENT_ROW
3. PREALLOCATED_CARE_LOG_ROW
4. AUDIT_OUTBOX_ROWS
5. COMMIT_ATOMIC
CARE_LOG_APPEND_ATOMIC_END

CONVERSION_DRAFT_CREATE_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROW, requester
2. IDEMPOTENCY_REGISTRY_AND_PREALLOCATED_CONVERSION_REQUEST_ROW
3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS, stable canonical order
4. CURRENT_ASSIGNMENT_ROW
5. AUDIT_OUTBOX_ROWS
6. COMMIT_ATOMIC
CONVERSION_DRAFT_CREATE_ATOMIC_END

CONVERSION_REQUEST_MUTATION_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROWS, relevant actor subjects sorted by canonical_user_id
2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_ROWS
3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS, stable canonical order
4. CURRENT_ASSIGNMENT_ROW_IF_REQUIRED
5. AUDIT_OUTBOX_ROWS
6. COMMIT_ATOMIC
CONVERSION_REQUEST_MUTATION_ATOMIC_END

LOCK_CASE_THEN_RETURN_TO_CENTER_ROOT: NO
P1_REQUEST_ROW_LOCK_PRECEDES_SOURCE_CASE_CONTACT_LOCKS: YES
P1_SOURCE_CASE_CONTACT_LOCKS_PRECEDE_ASSIGNMENT_LOCK: YES
```

Draft creation locks/rechecks requester account/security/session state, derives exact center/capability, binds idempotency and the preallocated request, then rechecks current contact/case/source versions and assignment before one request/audit/outbox commit. Draft update, submit, cancel and protected P1 supersede/reject use `CONVERSION_REQUEST_MUTATION_ATOMIC`; request rows always precede Contact/Case/Assignment rows. Case status/archive/cancel, or a case-field mutation that semantically invalidates an active request, uses `CASE_WITH_REQUEST_MUTATION_ATOMIC`. If overlapping request IDs cannot be safely selected before the transaction, the locked center root and indexed active-request selector identify them, but final row locks remain Request → Case → Assignment.

Assign/reassign without a request overlap uses `CASE_ASSIGNMENT_SECURITY_ATOMIC`. If it overlaps a conversion request, it uses the composed variant so account-security and target eligibility are locked first, then idempotency/request, then Case/Assignment. The old child-first order is forbidden. Security-only revoke never waits for the center root or Case/Assignment; assignment always rechecks after acquiring the security lock. Initial assignment during case creation must use the same actor/target security and eligibility prefix, or the case must be created unassigned and followed by `crm.assignment.assign`.

Contact update/status/archive uses `CONTACT_GOVERNANCE_MUTATION_ATOMIC`; a case assignment is not Contact authority. If the Contact mutation overlaps or invalidates a conversion request, its composed block locks idempotency/request before Contact and any related Case. Assignment end similarly uses its request-aware block when overlap exists. Outbox claim locks only eligible outbox rows in stable order after commit; it does not take a business root or call back into business mutation while holding delivery locks.

Contact matching/identity mutex is Package 2. Until that service is approved, any P1 contact creation that would rely on duplicate identity matching stays restricted to approved cohort/import review; no-match cannot be used as create authority.

## 15. Typed service operation plan

No operation accepts `entityType + arbitrary payload`. `C0/C1/C1R/C2/C3/C4/C4R/C4E/C4ER/C5/C6/C7` below abbreviate the exact blocks in §14; implementations must use the full documented order. `C1` is Contact governance, `C1R` composes it with an overlapping request, `C3` is request-aware Case mutation, `C4` is assignment security, `C4R` composes assignment with overlapping request order, `C4ER` is request-aware assignment end, and `C7` is request mutation.

| Operation | Caller authority | Center derivation | Assignment | Expected version | Policy/version guard | Typed input allowlist | Idempotency scope | Lock order | Audit / outbox | Safe response | Safe errors | Rate limit | Package |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `crm.contact.create` | `crm.lead.create` | Server membership/session → exact center | Server assigns or leaves unassigned by approved policy; client cannot self-assign | Control + idempotency/preallocation | CRM schema/contact method/feature versions | Display name, source, safe interest/location, protected contact-method envelope | Environment+center+operation+key+intent | C0 contact create | created + contact-created event | Opaque ID/version, masked label, correlation | root unavailable, feature suspended, invalid field, idempotency conflict, P2 review required | actor/center create bucket | P1-D after P1-A/C |
| `crm.contact.update` | Owner/Admin or exact `crm.contact.govern`; protected import service in approved import | Server exact center | None; case assignment is never Contact authority | Actor security + request if overlap + Contact | Control/masking/contact-governance/request policy | Safe interest/source/location and protected contact method with purpose | Resource+operation+key+intent | C1; C1R Request → Contact/Case if overlap | updated + contact/request-invalidated events as required | New version, masked projection | stale request/contact, governance denied, masking unavailable | actor/resource | P1-D/E |
| `crm.contact.transition_status` | Owner/Admin or exact `crm.contact.govern_status` | Server exact center | None; no arbitrary linked-case proof | Actor security + request if overlap + Contact; related cases only if semantically changed | Lifecycle + contact-governance + request + feature version | Target status, expected version, safe reason | Resource+transition intent | C1; C1R Request → Contact/Case if overlap | status-changed/request-invalidated events as required | Prior/new status/version | invalid transition, governance denied, request/contact stale, active-case conflict | actor/resource | P1-D |
| `crm.contact.archive` | Owner/Admin or exact `crm.contact.govern_archive`; protected import policy if applicable | Server exact center | None; consultant direct archive denied | Actor security + active request + Contact + related open cases | Archive/retention/contact-governance/request policy | Expected version, safe reason | Resource+archive intent | C1R Request → Contact/Case | archived/request-cancelled-or-superseded events by policy | Archived status/version | open request/case conflict, stale, governance denied | privileged actor | P1-D/E |
| `crm.case.create` | `crm.case.create` | Server from current center context | Initial assignee server-side only under C2 security/eligibility prefix | Actor/optional target security + Contact + control + preallocation | Case/assignment policies and target eligibility | Contact ID, safe summaries, optional approved assignee selector | Environment+center+contact+operation+key | C2 case create; otherwise create unassigned then C4 | case-created/assigned events | Opaque case/assignment versions | contact stale/cross-center, security or assignee ineligible, idempotency conflict | actor/contact | P1-D |
| `crm.case.update` | Owner/Admin or assigned case update | Server exact center | Required for consultant | Actor security + Case + assignment; request if semantically overlapping | Case field/masking/request policy | Interest and safe summary only | Case+operation+key+intent | Case-only order; C3 Request → Case → Assignment if overlap | case-updated/request-superseded if required | Case version, safe projection | stale, assignment/request stale, field denied | actor/case | P1-D |
| `crm.case.transition_status` | Exact lifecycle capability | Server exact center | Assigned for consultant | Actor security + request + Case + assignment | Lifecycle/conversion/feature versions | Target state, expected versions, reason | Case+transition intent | C3 Request → Case → Assignment | status-changed/checkpoint events | Prior/new status/version | invalid transition, request overlap, stale | actor/case | P1-D |
| `crm.case.archive` | Owner/Admin or archive capability | Server exact center | Consultant default deny | Actor security + active request + Case + assignment | Retention/lifecycle | Expected versions, reason | Case+archive intent | C3 Request → Case → Assignment | archived events | Archived version | active request, stale, denied | privileged actor | P1-D/E |
| `crm.assignment.assign` | Owner/Admin/CRM supervisor | Server exact center | Target security, exact-center membership and Staff eligibility locked/rechecked | Actor/target security + eligibility + Case + replacement preallocation | F23.13D capability/Staff/security/session versions | Case, opaque consultant selector, reason | Case+assign intent | C4; C4R Request → Case → Assignment if overlap | assignment-created | Assignment/case versions | security unavailable/revoked, active assignment exists, target ineligible | privileged actor/case | P1-D/E |
| `crm.assignment.reassign` | Owner/Admin/CRM supervisor | Server exact center | Never target/self claim; target security/eligibility locked | Actor/target security + eligibility + Case + current/replacement assignment | F23.13D eligibility/capability/security/session versions | Case, expected assignment version, target selector, reason | Case+reassign intent | C4; C4R Request → Case → Assignment if overlap | old-superseded/new-active events | New assignment/case versions | stale assignment, concurrent revoke, target ineligible | privileged actor/case | P1-D/E |
| `crm.assignment.end` | Owner/Admin/CRM supervisor | Server exact center | Current assignment required; target eligibility only if authority is regranted/changed | Actor security + request if overlap + Case + current assignment | Assignment/lifecycle/security/request policy | Expected versions, end reason | Case+end intent | C4E; C4ER Request → Case → Assignment if overlap | assignment-ended/request-invalidated as required | Ended status/versions | stale, security denied, case/request conflict | privileged actor/case | P1-D |
| `crm.care_log.append` | Assigned `crm.care_log.create_assigned` | Server exact center | Current assigned consultant or supervisor | Case + assignment | Content classification/retention | Entry type, safe content, optional opaque correction ref | Case+operation+key+content digest | C5 care append | care-log-appended | Opaque log ID/version/time | assignment stale, unsafe content, rate limit | actor/case burst | P1-D/E |
| `crm.conversion.create_draft` | Assigned conversion requester | Server exact center | Current assignment mandatory and locked after source | Requester security + idempotency/preallocated request + source + assignment | All source/policy/security/session versions | Source IDs/versions, typed draft actions, scoped key | Canonical request-create scope | C6 Account security → idempotency/request → Contact/Case → Assignment | draft-created | Request ID/version/status/digests, masked checklist | security/source stale, graph invalid, idempotency conflict | actor/case | P1-B/D |
| `crm.conversion.update_draft` | Current requester while `DRAFT` | Server exact center | Current assignment rechecked after source | Actor security + request + source + assignment | Source/action/policy/security versions | Typed action changes, evidence refs, reasons | Request+version+intent | C7 Request → Contact/Case → Assignment | draft-updated | New request version/digest | security/request/source stale, policy changed, invalid graph | actor/request | P1-B/D |
| `crm.conversion.submit_review` | Current assigned requester | Server exact center | Current assignment rechecked after source | Actor security + request + source + assignment | Current graph, source, security and policies | Request version + exact server graph digest | Request+submit intent | C7 Request → Contact/Case → Assignment | review-submitted | `READY_FOR_REVIEW`, version/checklist | incomplete, security/request/source stale, policy changed | actor/case | P1-B/D |
| `crm.conversion.cancel` | Requester before approval or protected cancel capability | Server exact center | Rechecked after request/source when required | Actor security + request + source + assignment if required | Status/security/source/policy versions | Request/version, safe reason | Request+cancel intent | C7 Request → Contact/Case → Assignment | request-cancelled | Terminal status/version | already terminal, security/request/source stale, denied | actor/request | P1-B/D |
| `crm.conversion.get_status` | Assigned requester or exact status reader | Server exact center | Current or approved terminal-history rule | Selector; server reads current | Masking/assignment policy | Opaque request/case ID | Read correlation only | Read transaction; no mutation locks claimed as proof | access/status-read audit if policy requires; no business outbox | Status/version/safe reason only | not-found-safe, assignment denied | read bucket | P1-D/E |
| `crm.outbox.claim` | Protected worker identity only | Row center, worker scope server-configured | None | Event/lease version | Worker/queue policy | Batch limit, queue selector, claimant ID | Worker+event version | Sorted eligible outbox rows only | delivery audit metadata; no new business event loop | Claimed IDs/leases/safe payload | lease conflict, queue suspended | worker/queue | P1-C |
| `crm.outbox.mark_delivered` | Same protected claimant/worker | Locked row center | None | Claim/event version | Current lease/consumer policy | Event ID/version, claim ID, delivery receipt digest | Event+delivery intent | Outbox row only | mark delivered; operational audit | Delivered/version | lease lost, stale, receipt conflict | worker/queue | P1-C |
| `crm.outbox.mark_retry` | Same protected claimant/worker | Locked row center | None | Claim/event version | Retry/dead-letter policy | Event/version, claim ID, safe error code | Event+retry intent | Outbox row only | retry/dead-letter operational event | Retry time/status/version | lease lost, capped/dead-letter | worker/queue | P1-C |

## 16. PII classification and read projections

| Classification | Fields/examples | Response rule |
|---|---|---|
| Authorized resource-safe | Opaque IDs, status, masked display label, safe interest summary, versions, timestamps | Only exact-center authorized resource projection. |
| Protected PII | Raw phone/email/full address, guardian identity evidence, candidate birth evidence, child-sensitive notes | Protected storage; excluded by default; purpose-bound typed reveal only after F23.13D MFA/fresh step-up where approved. |
| Forbidden by default | Cross-center candidates, full raw contact list, unnecessary security versions, RLS/audit internals, credentials, step-up assertion payload | Never serialize in standard response, log, audit, outbox, cache or error. |

Consultants receive exact assigned-case projections and server-masked contact methods. Full reveal, if implemented later, is a separate exact-purpose resource-bound operation with MFA met, fresh step-up, short TTL, audit, rate limit and `no-store`; P1 standard endpoints do not send raw PII for browser masking or persistent cache.

```text
P1_SERVER_SIDE_MASKING_REQUIRED: YES
P1_RAW_PII_SENT_FOR_CLIENT_MASKING: NO
P1_GENERIC_CENTER_WIDE_CONSULTANT_READ_ALLOWED: NO
P1_REVEALED_PII_PERSISTENT_BROWSER_CACHE_ALLOWED: NO
```

## 17. RLS and complete read-path prerequisites

No policy is written here. Before any P1 runtime activation, implementation must inventory and remediate:

- generic `center_cloud_entities` SELECT and broad INSERT/UPDATE/DELETE policies;
- direct browser REST/table calls and generic upsert/delete helpers;
- realtime subscriptions and payload hydration;
- export/search/report endpoints and restored local cache;
- service worker/offline/persistent browser caches;
- audit write paths, errors, traces and debug tools;
- Owner/Admin bypasses and service identities;
- capability-aware assigned projections and masked serialization.

Required architecture: browser calls typed server operations; server derives center/actor/capability/assignment, queries only the allowed resource, masks before serialization and commits typed mutations with audit/outbox. Direct API/RLS tests cover anonymous, stale membership, every role, assigned/unassigned, same/cross-center, raw/masked fields and alternate generic routes.

```text
P1_RUNTIME_WITH_BROAD_ACTIVE_MEMBER_WRITE_ALLOWED: NO
P1_RUNTIME_WITH_GENERIC_RAW_SELECT_ALLOWED: NO
P1_UI_GUARD_REPLACES_RLS: NO
P1_TYPED_ENDPOINT_REPLACES_ALL_DIRECT_TABLE_WRITES: YES
P1_RUNTIME_REQUIRES_DIRECT_API_RLS_TESTS: YES
```

## 18. LocalStorage migration/import strategy

The server cannot discover browser-local records. Import is optional and controlled, never automatic harvesting.

### Phase A — read-only inventory

A local tool counts/validates records per current local center namespace without upload. It reports schema variants, missing IDs, embedded children, stage counts and risky fields using safe counts only.

### Phase B — controlled export bundle

A deliberate user action exports typed JSON containing `export_version`, source center selector, record counts, checksums, local legacy IDs and safe validation report. Sensitive content is protected according to the approved export policy; credentials/tokens are never included. Partial/quota/read errors mark the bundle incomplete and block import approval.

### Phase C — server import preview

Server derives the exact target center, validates schema/checksums, allocates canonical IDs, validates legacy tuples, detects duplicate/conflict rows, maps contact/case/candidate/care evidence, and returns a masked review summary. It never auto-converts or trusts local assignment/role/stage.

### Phase D — approved import

Owner, Center Admin or exact import capability submits a typed, versioned request with idempotency. Each approved batch uses center root → import idempotency/preallocation → sorted target rows → audit/outbox and either commits its declared atomic unit or returns a reviewed resumable outcome. Imported `customerStage=converted` becomes a legacy claim requiring review; without a completed canonical conversion request, case cannot be `CONVERTED`.

### Phase E — local freeze/backup

After server-confirmed import result, matching local rows may be marked imported/read-only with canonical opaque references and retained backup. They are not immediately deleted. Local edits after import are divergent legacy changes requiring a new reviewed delta import; they never overwrite canonical rows.

```text
SERVER_CAN_AUTOMATICALLY_BACKFILL_ALL_BROWSER_LOCALSTORAGE: NO
LOCALSTORAGE_CONTACT_IS_TRUSTED_CANONICAL_IMPORT: NO
LOCALSTORAGE_IMPORT_MAY_BYPASS_REVIEW: NO
LOCALSTORAGE_IMPORT_AUTO_CREATES_GUARDIAN_STUDENT: NO
LEGACY_CONVERTED_STAGE_CREATES_CANONICAL_CONVERSION: NO
```

## 19. Failure outcomes

| Failure | Business rows committed? | Audit committed? | Outbox committed? | Client-visible status | Retry behavior |
|---|---|---|---|---|---|
| Center root missing | No | Optional separate safe security audit only | No business outbox | `crm_control_unavailable` | Retry only after controlled provisioning. |
| Center root duplicate | No | Separate protected incident audit | No | `crm_control_conflict` | Manual database review; never choose first row. |
| Stale expected version | No | Optional stale-attempt event without PII | No business event | `crm_stale_version` with current opaque version if authorized | Reload masked projection and intentionally retry with new key/version. |
| Invalid lifecycle transition | No | Safe denied-transition audit | No | `crm_invalid_transition` | Correct intent; blind retry unchanged is rejected. |
| Assignment stale | No | Safe access-denied/stale audit | No | `crm_assignment_stale` | Re-resolve current assignment; old assignee cannot retry as authority. |
| Same key/different intent | No new business row | Existing audit/outbox remain; conflict audit optional in its own transaction | No duplicate business event | `crm_idempotency_conflict` | New reviewed intent requires a new key; registry immutable. |
| Audit insert failure | No; transaction rolls back | No | No | `crm_atomic_commit_failed` | Retry same key resolves rolled-back/in-progress state under root. |
| Outbox insert failure | No; transaction rolls back | No because same transaction | No | `crm_atomic_commit_failed` | Same-key retry; no unaudited business success. |
| Outbox delivery failure | Yes, prior transaction remains | Yes | Yes, row becomes `RETRY`/`DEAD_LETTER` | Mutation result remains committed; delivery health not exposed as business failure | Worker retries idempotently with lease/backoff; reviewed dead letter. |
| PII protection unavailable | No protected-field mutation | Safe subsystem-unavailable audit only | No business event | `crm_pii_protection_unavailable` | Retry after service recovery; never store plaintext fallback. |
| Capability resolver unavailable | No | Safe dependency-denied audit if available | No | `crm_authorization_unavailable` | Fail closed; retry after resolver recovery. |
| Server masking unavailable | No read response and no PII mutation dependent on projection | Safe dependency audit | No | `crm_masking_unavailable` | Retry after service recovery; never return raw. |
| RLS/read path incomplete | Runtime activation blocked | Planning/rollout audit only | No | `crm_feature_not_available` | Remediate and pass direct API tests before enabling. |
| Import malformed | No | Import-rejected audit with counts/checksum only | Optional safe review event | `crm_import_invalid` plus safe row counts | Fix/export new bundle; never partial trust. |
| Import center mismatch | No | Cross-center denial audit | No | `crm_center_scope_denied` without target existence | Re-export/select correct authorized center; client selector cannot override. |
| Duplicate legacy ID | No for conflicting atomic unit | Conflict audit with opaque legacy digest | Review-required event if transaction can safely commit only review state | `crm_import_conflict` | Human resolves mapping; no last-write-wins. |
| Browser retry after timeout | Prior outcome only, or one eventual commit | Exactly one mutation audit | Exactly one business outbox | Pending/prior opaque result | Resolve same scoped key; never replay blindly. |
| Partial local export | No server mutation | Local validation report only | No | `crm_export_incomplete` | Correct storage/read issue and export a new complete version. |
| Policy version change | No stale mutation | Safe policy-stale audit | No | `crm_policy_stale` | Reload policy/masked draft; new approval/review where required. |
| Feature flag suspended | No new mutation | Safe suspended-attempt audit | No business event | `crm_feature_suspended` | Operator waits for explicit server reactivation; queued browser retries do not bypass. |

## 20. Race matrix F3E-P1-R1–F3E-P1-R20

| ID / Race | Actor A | Actor B | Shared root | Lock order | Winner | Loser outcome | Audit/outbox result |
|---|---|---|---|---|---|---|---|
| F3E-P1-R1 Two contact creates same idempotency key | Browser retry A | Browser retry B | Center root + idempotency/preallocated contact | Root → idempotency → contact → audit/outbox | First valid intent or prior reservation | Same intent receives pending/prior opaque result; no second contact/version bump | Exactly one create audit/outbox; retries correlated. |
| F3E-P1-R2 Same key different contact intent | Create intent A | Create intent B | Center root + same scoped registry row | Root → idempotency before contact | First registered intent | `crm_idempotency_conflict`; cannot overwrite record or contact | One create path; optional safe conflict audit, no duplicate business event. |
| F3E-P1-R3 Contact update vs archive | Contact-governance actor | Privileged archiver | Center root + actor security + overlapping request + contact/open cases | Root → account security → Request if overlap → Contact → related Cases → audit/outbox | First committed expected request/contact version | Stale request/contact or archived conflict; no field write after archive and no case assignment authority accepted | Winner event only plus optional safe stale attempt. |
| F3E-P1-R4 Contact status vs case create | Contact-governance status actor | Case creator | Center root + actor/optional target security + request if overlap + contact/case | Status uses Request → Contact/Case; create uses security/eligibility → Contact → preallocation/Case | First commit under shared center root | Rechecks request/contact status/version and optional assignee eligibility; invalid create/transition rolls back | One coherent contact/case event set, never orphan case or stale request. |
| F3E-P1-R5 Two case creates same contact | Creator A | Creator B | Center root + contact + scoped keys | Root → contact → sorted preallocations/cases | Policy permits first or both distinct cases | Duplicate intent returns prior/conflict; distinct permitted cases remain explicit | Per-case audit/outbox, no hidden overwrite. |
| F3E-P1-R6 Case status vs reassignment with request overlap | Assigned consultant | CRM supervisor | Center root + actor/target security + overlapping request + case + assignment | Root → account security/eligibility → Request → Case → Assignment | First valid versioned mutation under shared request-first order | Other sees request/case/assignment stale and re-resolves authority; no Case → Assignment → Request inversion | Winner status/reassign event; no stale-authority write. |
| F3E-P1-R7 Two reassignments / assign versus target account-security disable | CRM supervisor(s) | Security operator revoking/disabling target | Target account-security row; assignment side also uses center root, target membership/Staff, case/assignments | Assignment: root → target account security → target eligibility → case → assignments; security-only revoke: account row only, never root | Account-security row serialization decides grant/revoke order | Revoke-first makes target stale/ineligible and no assignment is created; assignment-first completes atomically, then revoke invalidates subsequent authority | One valid assignment outcome at most; revoke and assignment audits preserve order without second active row. |
| F3E-P1-R8 Reassign vs care-log append | Supervisor | Current consultant | Center root + actor/target security/eligibility + case + assignment | Reassign takes security/eligibility before Case/Assignment; care append skips those tiers but shares root then Case/Assignment | Center-root serialization and first valid assignment version | If reassign wins, old consultant append denied; if append wins, log commits under prior valid assignment before the grant changes | Ordered audit/outbox shows append/reassign sequence. |
| F3E-P1-R9 Reassign vs conversion submit | Supervisor | Requester | Center root + account security/target eligibility + request + case + assignment | Root → account security/eligibility → Request → Case → Assignment | First commit under the shared request-first order | Other sees assignment/request/source version stale; no review under old authority and no child-order inversion | One winner event and safe stale attempt. |
| F3E-P1-R10 Case cancel vs draft create | Case closer | Assigned requester | Center root + actor security + registry/preallocated request + source contact/case + assignment | Root → account security → idempotency/Request → Contact/Case → Assignment | First commit under the common request-first order | Cancelled case blocks draft; existing draft blocks/coordinates cancel per lifecycle without locking Case before Request | Atomic case/request audit/outbox, no active draft on cancelled case. |
| F3E-P1-R11 Draft update vs submit review | Requester tab A | Requester tab B | Center root + requester security + idempotency/request + source contact/case + assignment | Root → account security → idempotency/Request → Contact/Case → Assignment | First expected request version | Stale request/source; cannot submit a different graph digest or reuse stale assignment | One request version/event; graph remains coherent. |
| F3E-P1-R12 Two active requests same case | Requester A | Requester B | Center root + requester security + scoped registry/preallocated request + source case/contact + assignment | Root → account security → registry/Request → Contact/Case → Assignment | First reviewable request reservation | Same intent prior result or explicit conflict/supersede flow; never two active and never lock Case before Request | One creation event; conflict safe and opaque. |
| F3E-P1-R13 Policy version change vs mutation | Policy operator | CRM mutator | Center root | Root first for both | First control-version commit or business commit under old current version | Stale control/policy version; no mutation under mixed policy | Ordered policy/business audit; outbox matches winner. |
| F3E-P1-R14 Feature suspension vs mutation | Kill-switch operator | CRM mutator | Center root | Root first for both | First center-root commit | If suspension wins mutation denies; if mutation wins it completes before suspension | No mutation after committed suspend; both events ordered. |
| F3E-P1-R15 Audit insert failure | Business mutation | Database audit insert fault | Same transaction | Business locks → audit/outbox → commit | No business winner when audit fails | Whole transaction rolls back; same key may retry | No partial business/audit/outbox state. |
| F3E-P1-R16 Outbox insert failure | Business mutation | Database outbox insert fault | Same transaction | Business locks → audit/outbox → commit | No business winner when outbox row fails | Whole transaction rolls back | No business/audit commit without required outbox. |
| F3E-P1-R17 Outbox double claim | Worker A | Worker B | Outbox row/lease | Sorted eligible event rows only | First active lease | Claim conflict/skip; cannot deliver during valid lease | One delivery attempt record; consumer idempotency backstop. |
| F3E-P1-R18 Import retry after timeout | Import submit A | Same browser retry | Center root + batch idempotency | Root → registry/preallocations → targets | Existing in-progress/completed batch | Returns pending/prior result, no second target writes | One batch audit/outbox; retry correlation only. |
| F3E-P1-R19 Two imports same legacy contact | Import batch A | Import batch B | Center root + legacy mapping/contact | Root → sorted import registry/mappings/contacts | First reviewed mapping | Second conflict/review; never last-write-wins or identity merge | One canonical mapping; conflict event uses opaque digest. |
| F3E-P1-R20 Local edit after import | Canonical server editor | Offline legacy editor | Canonical contact root; local has no authority | Server locks canonical root; later delta import follows import order | Canonical committed version | Local edit becomes divergent reviewed delta, never overwrites automatically | Canonical event preserved; optional import-conflict event. |

## 21. Negative matrix F3E-P1-N1–F3E-P1-N36

| ID | Negative case | Exact fail-closed outcome |
|---|---|---|
| F3E-P1-N1 | Browser changes `center_id` | Server-derived center mismatch returns opaque `crm_center_scope_denied`; no row lookup/write or cross-center existence disclosure. |
| F3E-P1-N2 | Client sends forged owner/consultant role | Role ignored; canonical membership/Staff/capability resolver decides and denies, with no business/audit-outbox success. |
| F3E-P1-N3 | Contact ID contains phone | Typed ID validation rejects before lookup; raw value is not logged/audited and no reservation is created. |
| F3E-P1-N4 | Browser uses `Date.now()` contact ID | Client ID is ignored/rejected; protected service preallocates opaque ID or operation fails without mutation. |
| F3E-P1-N5 | Missing `center_crm_control` | Fail `crm_control_unavailable`; no empty contact/case serialization fallback and no business rows commit. |
| F3E-P1-N6 | Duplicate `center_crm_control` | Fail `crm_control_conflict`; never select first row, activate feature or mutate CRM. |
| F3E-P1-N7 | Contact update stale version | Reject `crm_stale_version`; contact/cases/audit-outbox business event remain unchanged. |
| F3E-P1-N8 | Case create with contact from another center | Exact-center locked join fails opaquely; no case, assignment or target-center disclosure. |
| F3E-P1-N9 | Candidate row references case in another center | Constraint/service validation rejects; no candidate evidence or case data crosses center. |
| F3E-P1-N10 | Client sets case `CONVERTED` | Status allowlist denies; only later protected executor may set it with completed request in one transaction. |
| F3E-P1-N11 | Case converted without completed request | Invariant fails and transaction rolls back; no fabricated conversion checkpoint or target links. |
| F3E-P1-N12 | Client self-assigns consultant or supplies stale eligible target | Client claim is ignored; transaction locks actor/target account-security plus target exact-center membership/Staff rows and rechecks current eligibility before Case/Assignment, otherwise deny/audit attempt. |
| F3E-P1-N13 | Two active assignments | Case-root/version protocol permits one; conflicting transaction returns `crm_assignment_conflict`, uniqueness only backstops. |
| F3E-P1-N14 | Reassign deletes assignment history | Operation schema forbids delete/rewrite; old row becomes `SUPERSEDED` and remains auditable. |
| F3E-P1-N15 | Consultant uses one case assignment to read or mutate shared canonical Contact | Case assignment exposes only the exact assigned-case masked projection; direct Contact update/status/archive denies because no contact-resource assignment/governance capability exists, and other cases/contact PII do not leak. |
| F3E-P1-N16 | Raw contact PII returned for browser masking | Serialization security test fails closed; endpoint returns no payload and records a safe incident, never raw fallback. |
| F3E-P1-N17 | Raw phone written to audit | Audit schema/classifier rejects insert; same transaction rolls back business mutation rather than store PII. |
| F3E-P1-N18 | Birth evidence written to outbox | Outbox safe-payload validation rejects and rolls back the mutation; no child-sensitive delivery event. |
| F3E-P1-N19 | Same idempotency key, different intent | Immutable binding returns `crm_idempotency_conflict`; prior registry/result cannot be overwritten. |
| F3E-P1-N20 | Idempotency key treated as authority | Key only deduplicates; missing capability/assignment/version still denies with no business write. |
| F3E-P1-N21 | Unique constraint replaces root lock or child order locks Case/Assignment before Request | Design/test rejection; mutation takes center/business roots and canonical Request → Contact/Case → Assignment order before constraint backstop; unique-as-mutex and child-order inversion are both forbidden. |
| F3E-P1-N22 | Audit insert fails but business commits | Impossible by transaction contract; audit failure rolls back business/idempotency/outbox changes. |
| F3E-P1-N23 | Outbox insert fails but business commits | Impossible by transaction contract; all same-transaction rows roll back. |
| F3E-P1-N24 | Outbox retry duplicates side effect | Consumer deduplicates stable event/version; retry records attempt but cannot repeat effect. |
| F3E-P1-N25 | Generic cloud upsert creates canonical CRM | Entity/payload path is not canonical service and must be blocked; only typed endpoint may create CRM row. |
| F3E-P1-N26 | Broad active-member write remains enabled | Runtime feature activation remains blocked; UI guards cannot compensate for RLS OR-policy exposure. |
| F3E-P1-N27 | Client sends arbitrary JSON | Typed decoder rejects unknown/nested fields before transaction; no generic payload persistence. |
| F3E-P1-N28 | LocalStorage imported as trusted canonical data | Import preview classifies every row as untrusted legacy claim requiring validation/review. |
| F3E-P1-N29 | Legacy `converted` stage creates converted case | Imported claim is flagged for review; case cannot become `CONVERTED` without completed canonical request. |
| F3E-P1-N30 | Import center selector differs from server center | Server authority wins and mismatch denies entire atomic unit without cross-center probe. |
| F3E-P1-N31 | Import duplicate legacy ID | Exact-center legacy mapping conflict blocks affected atomic unit; human resolves, never overwrite/merge. |
| F3E-P1-N32 | Import creates Guardian/Student | Package boundary rejects target types; no profile, relationship, Auth, Tuition or enrollment side effect. |
| F3E-P1-N33 | Source/policy changes after draft | Under account-security → idempotency/Request → Contact/Case → Assignment locks, submit/update detects stale source/policy/request evidence, returns `crm_policy_stale`/`crm_source_stale` and requires deliberate revalidation. |
| F3E-P1-N34 | Feature suspended during mutation | Center-root serialization decides order; a mutation starting after suspension denies and no queued client retry bypasses it. |
| F3E-P1-N35 | Capability/masking unavailable or assignment target concurrently revoked | Account-security/eligibility locks and current recheck fail closed with a safe dependency/ineligible code; no raw fallback, stale target assignment, mutation or authority from cached UI state. |
| F3E-P1-N36 | Package 1 claims conversion runtime done | Contract test fails; planning stays blocked, runtime not started and executor/approval remain unimplemented. |

## 22. Threat model F3E-P1-T1–F3E-P1-T24

| ID / Threat | Likelihood | Impact | Mitigation | Residual risk | Implementation phase |
|---|---|---|---|---|---|
| F3E-P1-T1 Cross-center IDOR | High without joins | Critical PII exposure | Server-derived center, exact-center FK/join, opaque errors and direct API tests | Mapping/query regression | P1-A/D/E/F |
| F3E-P1-T2 Client role forgery | High | Critical privilege escalation | Canonical membership/Staff/capability resolver; ignore role claim | Resolver cache defect | P1-D/E/F |
| F3E-P1-T3 Client assignment forgery / shared Contact authority bleed | High | Critical resource and cross-case Contact access | Locked current case assignment/version, assigned-only case projection, and explicit deny of case-derived Contact mutation without contact-governance capability | Stale projection or capability-mapping bug | P1-A/D/E/F |
| F3E-P1-T4 Generic table write bypass | High while present | Critical mutation bypass | Remove/narrow broad RLS; disable generic CRM entity writes; typed endpoints | Alternate route drift | P1-E/F |
| F3E-P1-T5 Generic raw read/PII leak | High while present | Critical privacy breach | Complete SELECT/realtime/export/cache inventory and minimal masked projection | Missed consumer | P1-E/F |
| F3E-P1-T6 Browser-side masking | Medium | Critical raw PII leak | Mask before serialization; no raw payload/cache; response tests | Logging serializer drift | P1-D/E/F |
| F3E-P1-T7 Timestamp ID collision | Medium | High overwrite/confusion | Server opaque IDs and protected preallocation | Generator/config defect | P1-A/F |
| F3E-P1-T8 Legacy ID collision | High across browsers | High wrong mapping | Exact-center typed provenance, checksums, conflict review | Manual resolution error | P1-E/F |
| F3E-P1-T9 Stale/lost update | High | High integrity loss | Integer expected versions and row locks | Long retry contention | P1-A/D/F |
| F3E-P1-T10 Invalid lifecycle transition | Medium | High state corruption | Server transition tables and terminal-state guards | Vocabulary migration defect | P1-A/D/F |
| F3E-P1-T11 Duplicate active assignment / stale target eligibility | Medium | Critical unauthorized access | Root then locked actor/target account-security and target membership/Staff eligibility before Case/Assignment; versioned reassignment plus unique backstop | Eligibility resolver or lock-order defect | P1-A/D/E/F |
| F3E-P1-T12 Assignment authority linger / concurrent target revoke | High after reassign | Critical stale access | Account-security lock serializes grant/revoke; waiting assignment rechecks; every request rechecks current assignment and security with no-store projection | In-flight operation completes before later revoke commit | P1-D/E/F |
| F3E-P1-T13 Idempotency collision/misuse | Medium | High wrong prior result | Scoped keyed digest + intent/action/source bindings; root lock | Digest implementation bug | P1-B/F |
| F3E-P1-T14 Audit omitted | Medium | Critical untraceable mutation | Same transaction, audit insert required, failure rollback | Database outage | P1-C/F |
| F3E-P1-T15 Audit contains PII | Medium | Critical privacy retention | Strict typed safe fields/classifier; no before/after raw snapshots | Reason-text leakage | P1-C/E/F |
| F3E-P1-T16 Outbox lost event | Medium | High integration divergence | Same-transaction durable row and monitoring | Database/worker outage | P1-C/F |
| F3E-P1-T17 Outbox duplicate delivery | High at-least-once | High repeated side effect | Lease + stable consumer key + idempotent consumer | Noncompliant consumer | P1-C/F |
| F3E-P1-T18 Outbox poison/dead letter | Medium | Medium/High backlog | Capped retry, safe error code, dead-letter alert/review | Operational delay | P1-C/F |
| F3E-P1-T19 Local import tampering | High | High data corruption | Checksums, typed validation, exact-center review and provenance | Authorized malicious source | P1-E/F |
| F3E-P1-T20 Local import duplicate replay | High | High duplicate data | Batch/record scoped idempotency and legacy mapping conflicts | Cross-device ambiguity | P1-B/E/F |
| F3E-P1-T21 Legacy converted-stage falsification | Medium | Critical fake conversion | Treat as claim only; executor-completed request invariant | Review error | P1-E/F |
| F3E-P1-T22 Policy/feature drift | Medium | Critical stale authority | Center root/version bind, lock and recheck; server kill switch | Cache invalidation lag | P1-A/D/E/F |
| F3E-P1-T23 Alternate generic endpoint / cross-package request-order drift | Medium | Critical bypass or deadlock | Route inventory, deny generic CRM types, direct API/RLS regression, and assert inherited Request-before-Contact/Case/Assignment order in every overlapping mutation | Newly introduced route or untested composition | P1-B/D/E/F |
| F3E-P1-T24 Premature Package 2/3 coupling / Case-before-Request inversion | Medium | Critical contract bypass or deadlock | Package gates, reserved statuses immutable, inherited executor-order smoke and no Case/Assignment lock before overlapping Request | Schedule pressure or future operation drift | All phases/external audit |

## 23. Approval gates F3E-P1-AG1–F3E-P1-AG18

| ID / Gate | Recommended default | Lý do | Rủi ro | Approver | Implementation phase |
|---|---|---|---|---|---|
| F3E-P1-AG1 Database/storage target for canonical CRM? | Same protected relational transaction store as audit/outbox; exact physical target requires approval | Atomic locks/FKs/audit need one authority | Wrong target breaks atomicity | Architecture + Database owner + Security | Before P1-A |
| F3E-P1-AG2 ID format? | Server-generated opaque UUID-family IDs; no browser timestamp | Stable non-PII ordering/uniqueness | Index/order tradeoff | Architecture + Database owner | P1-A design |
| F3E-P1-AG3 Contact method protection? | Protected encrypted value + keyed/versioned lookup digest + masked projection | Separates lookup from disclosure | Key rotation/search complexity | Security + Privacy + Database owner | P1-A/E |
| F3E-P1-AG4 Exactly-one center root provisioning? | Controlled provisioning, exactly one row before activation | Stable serialization root | Missing/duplicate activation outage | Database owner + SRE + Security | P1-A |
| F3E-P1-AG5 CRM feature states? | `PLANNED/MIGRATING/READ_ONLY/ACTIVE/SUSPENDED` plus versioned server flag | Explicit migration/kill switch | Flag drift | Product + SRE + Security | P1-A/E |
| F3E-P1-AG6 Contact lifecycle? | `NEW/CONTACTED/QUALIFIED/UNQUALIFIED/ARCHIVED` | Separates lead contact from case/profile | Vocabulary mismatch | CRM owner + Product | P1-A |
| F3E-P1-AG7 Case lifecycle? | §8 vocabulary; `CONVERTED` executor-only | Preserves conversion proof | Legacy-stage mapping work | CRM owner + Product + Architecture | P1-A/B |
| F3E-P1-AG8 Active assignment model? | One exclusive active **case** assignee initially; no global Contact mutation authority | Matches assigned-only least privilege without authority bleed across a shared Contact's cases | Collaboration friction; later Contact workflow needs explicit resource design | CRM owner + Security + Privacy | P1-A/D |
| F3E-P1-AG9 Who can assign/reassign? | Owner/Center Admin or exact CRM supervisor capability; lock actor/target security and target eligibility | Prevents consultant self-claim and serializes concurrent target revoke; one case assignment never grants Contact governance | Admin bottleneck and eligibility dependency | Security + Operations + CRM owner | P1-D/E |
| F3E-P1-AG10 Care-log edit/delete? | Append-only initially; correction by new event | Keeps history/audit simple | Corrected content remains retained | CRM owner + Privacy + Legal | P1-A/C/D |
| F3E-P1-AG11 Idempotency retention? | Retain terminal outcome with business/audit retention; no premature expiry delete | Safe retries and dispute evidence | Storage growth | Data owner + Security + Legal | P1-B/C |
| F3E-P1-AG12 Audit retention? | Immutable, PII-minimized schedule approved by Legal/Data owner | Accountability without raw PII | Over/under-retention | Legal + Privacy + Security | P1-C |
| F3E-P1-AG13 Outbox retry/dead-letter? | Lease + idempotent delivery + capped exponential retry + reviewed dead letter | At-least-once safety | Backlog/ops load | SRE + Architecture + Data owner | P1-C |
| F3E-P1-AG14 Is local import mandatory? | Optional controlled import; no automatic browser harvesting | Server cannot discover all local stores safely | Legacy records remain local | Product + Data owner + Privacy | P1-E |
| F3E-P1-AG15 Import approval role? | Owner/Center Admin or exact import capability with audit | Center accountability | Privileged bad import | Security + Data owner + Operations | P1-E |
| F3E-P1-AG16 Legacy `converted` handling? | Import as legacy claim requiring review, never canonical conversion | Stage lacks completed request proof | Manual cleanup | CRM owner + Data owner | P1-E |
| F3E-P1-AG17 Rollout feature flag? | Server-authoritative center allowlist plus kill switch; initial read-only cohort | Limits blast radius | Inconsistent cohorts | Product + SRE + Security | P1-E/F |
| F3E-P1-AG18 Start implementation conditions? | External audit PASS plus explicit approval of Request → Contact/Case → Assignment composition and account-security/eligibility assignment locking, and all other blockers; no remote action automatically | Planning is not execution authority and parent/child lock drift is a release blocker | Premature SQL/runtime or deadlock/revoke race | Security + Architecture + Product + Database owner | Final gate |

## 24. Future implementation sequence

No package below is implemented by this task.

### P1-A — Schema and control root

- approve physical schema/migration order;
- provision exactly-one center root;
- define contact/case/candidate/care/assignment tables, IDs, versions, constraints and lifecycle checks.

### P1-B — Request and idempotency

- implement draft/reviewable request lifecycle only;
- implement scoped registry, one-active reviewable request and prior-result resolution;
- reserve approval/executor states against client mutation.

### P1-C — Transactional audit/outbox

- implement typed immutable audit and safe payload validation;
- insert business + audit + outbox atomically;
- implement worker lease/retry/dead-letter and idempotent consumer contract.

### P1-D — Typed service layer

- implement contact/case/assignment/care/request operations and allowlists;
- derive exact center/capability/assignment and enforce versions/locks;
- return safe masked projections/errors only.

### P1-E — Security and migration readiness

- integrate F23.13D resolver/server masking and F23.13C reveal prerequisites;
- remediate RLS and every read/realtime/export/cache/direct-write path;
- implement local inventory/export/import preview behind server flag.

### P1-F — QA and rollout

- direct API/RLS, multi-account/multi-center, concurrency/deadlock and stale-version tests;
- audit/outbox fault injection and import replay/conflict tests;
- read-only cohort, kill-switch drill and manual QA before any active mutation rollout.

Package 2 may start planning after P1 external audit, but implementation coupling begins only after P1-A/B/C contracts and security prerequisites are approved. Package 3 approval/executor cannot use P1 reserved status fields until its own protected runtime is implemented and reviewed.

## 25. Implementation blockers and readiness

Implementation remains blocked pending:

- approved physical database/schema and immutable migration naming/order;
- exactly-one center root provisioning/runbook;
- typed service/API architecture and exact capability catalog;
- F23.13D resolver/Staff/account/membership/assignment integration;
- approved F23.3E Request → Contact/Case → Assignment composition for every overlapping P1 mutation;
- exact Contact-governance capabilities or explicit future Contact-resource assignment design; case assignment is not sufficient;
- actor/target account-security and target membership/Staff eligibility locking for assignment grants and revoke races;
- F23.13C MFA/fresh step-up plan for any protected PII reveal;
- protected contact-method storage and key/normalization rotation strategy;
- RLS/direct read/realtime/export/cache/generic-write remediation plan;
- transactional audit/outbox design, retention and worker operations approval;
- idempotency retention/digest/key-rotation decisions;
- local import decision, review roles and safe fixture policy;
- concurrency/deadlock/fault-injection/direct-API test plan;
- server feature allowlist, kill switch and rollback runbook;
- explicit user approval before any SQL, migration or Supabase action.

```text
F23_3E_P1_IMPLEMENTATION_READINESS: BLOCKED
F23_3E_P1_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_P1_REMOTE_DATABASE_ACTION_ALLOWED: NO
F23_3E_IMPLEMENTATION_READINESS: BLOCKED
F23_3E_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO
```

## 26. Final technical audit closeout

External final technical audit đã `PASS`. Package 1 implementation planning is closed for checkpoint and the canonical roadmaps now record `F23.3E-P1 DONE implementation planning`. This does not mean implementation/runtime is done and grants no authority to run SQL, migration, RLS, Auth or Supabase actions.

```text
F23.3E-P1 IMPLEMENTATION DESIGN: SAFE TO START AFTER EXPLICIT APPROVAL
```

This semantic planning contract is not proof of a database schema, RLS policy, endpoint, transaction, worker, masking service, MFA/step-up integration or production readiness.

F23.3E-P1 FINAL CLOSEOUT COMPLETE - READY FOR CHECKPOINT
