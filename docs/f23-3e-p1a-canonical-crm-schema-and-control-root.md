F23_3E_P1A_STATUS: IMPLEMENTED IN REPO
F23_3E_P1A_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1A_MIGRATION_CREATED: YES
F23_3E_P1A_LOCAL_SQL_APPLY: PASS
F23_3E_P1A_LOCAL_DB_BEHAVIOR_QA: PASS
F23_3E_P1A_REMOTE_APPLY: NOT RUN
F23_3E_P1A_RUNTIME_WIRING: NOT STARTED
F23_3E_P1A_RLS_RUNTIME_POLICIES: NOT STARTED
F23_3E_P1A_REAL_DATA_CHANGE: NO
F23_3E_P1A_AUTH_CHANGE: NO
F23_3E_P1A_EDGE_FUNCTION_CHANGE: NO
F23_3E_P1A_DEPLOY: NOT RUN

# F23.3E-P1A — Canonical CRM physical schema and center control root

## 1. Implementation boundary

F23.3E-P1A implements the approved physical database foundation in the repository. The migration has been applied and behaviorally verified only against the local Docker Supabase database. It does not wire a browser, API, RPC, worker, conversion executor, import process, Auth flow, Edge Function, or deployment.

Inherited audited contracts remain unchanged:

```text
F23_2_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1_FINAL_TECHNICAL_AUDIT: PASS
F23_13C_FINAL_TECHNICAL_AUDIT: PASS
F23_13D_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1A_CHANGES_DOMAIN_MODEL: NO
F23_3E_P1A_CHANGES_CONVERSION_EXECUTOR_CONTRACT: NO
```

The schema separates Contact, Case, candidate-student evidence, Assignment, Care Log, Conversion Request, Idempotency, Audit, and Outbox. It does not treat Contact as Guardian, candidate evidence as Student, or a Case as a person.

## 2. Repo truth and prerequisites

The applied baseline establishes these exact physical references:

- `public.centers(id text not null primary key)` is the canonical center table.
- `auth.users(id uuid not null)` is the only applied user/account FK target demonstrated by `public.center_members.user_id` and other applied tables.
- `gen_random_uuid()` is already used by the applied baseline for database-generated UUID identifiers.

The new migration checks `public.centers`, `public.centers.id`, `auth.users`, and `auth.users.id` before creating CRM objects. A missing table or type/nullability drift raises an exception. The canonical `center_id` remains `text` because changing the existing center identity is outside scope; every new aggregate/event identifier is an opaque, database-generated UUID.

The six applied migrations were not edited. Their expected and locally verified SHA-256 values are:

| Applied migration | SHA-256 |
|---|---|
| `20260722000000_remote_schema.sql` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100_transaction_images_bucket_prerequisite.sql` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001_f23_11e_staff_document_private_attachments.sql` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |

## 3. Migration

Exact path:

```text
supabase/migrations/202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql
```

The migration is one explicit transaction. It does not use `CREATE ... IF NOT EXISTS` to hide an object conflict. It schema-qualifies persistent objects, hardens every trigger/security-definer function with an empty `search_path`, and revokes direct function execution from `PUBLIC`, `anon`, and `authenticated`.

## 4. Physical tables

The migration creates exactly these Package 1A tables:

1. `public.center_crm_control`
2. `public.crm_contact`
3. `public.consultation_case`
4. `public.consultation_case_candidate_student`
5. `public.consultation_case_assignment`
6. `public.crm_care_log`
7. `public.crm_conversion_request`
8. `public.crm_idempotency_registry`
9. `public.crm_audit_event`
10. `public.crm_outbox_event`

No Guardian profile, canonical Student profile, Guardian–Student Relationship, appointment, enrollment draft, identity mutex, match evidence, profile-creation reservation, approval, executor, or import-runtime table is created.

## 5. Exactly-one center CRM root

`public.center_crm_control.center_id` is both the primary key and an exact FK to `public.centers(id)`. The root carries positive schema/policy versions, `control_version`, CRM state, feature-flag state, and timestamps.

```text
CENTER_CRM_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE
CENTER_CRM_CONTROL_ROW_IS_MUTATION_ROOT: YES
CENTER_CRM_CONTROL_MISSING_FAILS_CLOSED: YES
CENTER_CRM_CONTROL_DUPLICATE_FAILS_CLOSED: YES
FUTURE_CENTER_CREATION_PROVISIONS_ONE_CRM_ROOT: YES
CLIENT_MAY_PROVISION_CENTER_CRM_ROOT: NO
CENTER_ROOT_PROVISIONING_SECURITY_DEFINER_HARDENED: YES
```

Provisioning has no race window:

- the migration locks `public.centers` against concurrent row mutation;
- it installs an `AFTER INSERT` trigger for future centers;
- it backfills one row for every existing center;
- it verifies every center joins to exactly one root before commit;
- the primary key rejects duplicates;
- the trigger function is `SECURITY DEFINER SET search_path = ''` and has no browser execute grant.

Every root defaults to `crm_state = PLANNED` and `feature_flag_state = DISABLED`. Root existence therefore does not enable CRM mutation or conversion. `ACTIVE` also requires an `ENABLED` flag, but no P1A operation can perform that activation.

## 6. Exact-center FK strategy

Every CRM table has both a direct canonical-center FK and a FK to `center_crm_control(center_id)`. A missing control root therefore rejects new CRM rows even through a privileged future path. Every child-to-parent relationship also uses a composite key containing `center_id`; application checks are not the integrity boundary.

| Relationship | Physical protection |
|---|---|
| Case → Contact | `(center_id, primary_contact_id)` composite FK |
| Candidate → Case | `(center_id, consultation_case_id)` composite FK |
| Assignment → Case | `(center_id, consultation_case_id)` composite FK |
| Care Log → Case | `(center_id, consultation_case_id)` composite FK |
| Care Log correction → prior log | `(center_id, consultation_case_id, correction_of_care_log_id)` self-FK |
| Request → Case | `(center_id, consultation_case_id)` composite FK |
| Request → Contact | `(center_id, source_contact_id)` plus a three-column FK proving it is the Case primary Contact |
| Idempotency → Case/Request | nullable exact-center composite FKs, while its generic resource scope is always non-null |
| Audit → Request/Assignment | nullable exact-center composite FKs |
| Case → active Assignment | deferred `(center_id, consultation_case_id, active_assignment_id)` FK |

Case↔Assignment uses deferred FK and deferred constraint triggers. At commit, either a Case has no active pointer and no active assignment, or it points to the one `ACTIVE` assignment for that exact Case and center. This permits an atomic assign/reassign/end transaction without permitting a final mismatched pointer.

## 7. IDs, protected data, and versions

All new canonical resource/event IDs use `uuid default gen_random_uuid()`. Legacy IDs remain typed provenance only and are bound to an exact center/import batch. Raw contact methods use `bytea` ciphertext, carry a positive crypto version, and have binary normalized lookup digests plus a positive normalization version. Candidate birth evidence is protected `bytea`.

Audit has no payload/before/after column. The outbox uses a flat allowlisted safe JSON envelope validated by a restricted function; nested objects/arrays, unrecognized keys, and contact-like plaintext are rejected. Care Log text has physical phone/email-pattern backstops, no attachment column, and no birth-evidence column.

The following versions start at `1` and are physically positive:

```text
control_version
contact_version
case_version
candidate_version
assignment_version
care_log_version
request_version
idempotency_version
event_version
```

Every updateable aggregate has a table-allowlisted trigger requiring exactly `old_version + 1`; care logs and audit events are immutable. Server timestamps use `timestamptz`, and mutable rows with `updated_at` are stamped by the version trigger.

## 8. Lifecycle and one-active backstops

CHECK constraints contain the complete approved vocabularies. Lifecycle triggers implement the P1A-safe subset:

- Contact cannot restore from `ARCHIVED` and follows the approved P1 transitions.
- Case starts `OPEN`; terminal Cases cannot silently reopen; `CONVERTED` is rejected until a future protected executor replaces the reserved guard.
- Candidate starts `DRAFT`; `CONVERTED` is reserved for the future executor.
- Assignment starts `ACTIVE`; identity/history fields are immutable and it can only terminalize as `ENDED`, `REVOKED`, or `SUPERSEDED`.
- Conversion Request starts `DRAFT`; P1A permits draft/review/reject/cancel/supersede only. Protected approval/execution/completion states are present in vocabulary but not reachable through this migration's lifecycle path.
- Idempotency scope, key digest, intent, and request binding cannot be rewritten; terminal records cannot reopen.
- Delivered/dead-letter/cancelled outbox events cannot return to pending.

Physical one-active backstops:

```text
ONE_ACTIVE_EXCLUSIVE_ASSIGNMENT_PER_CASE: YES
ONE_ACTIVE_REVIEWABLE_CONVERSION_REQUEST_PER_CASE: YES
ASSIGNMENT_UNIQUENESS_REPLACES_CASE_ROOT_LOCK: NO
IDEMPOTENCY_UNIQUE_CONSTRAINT_REPLACES_ROOT_LOCK: NO
```

The assignment partial unique index covers `ACTIVE`. The request partial unique index covers `DRAFT`, `READY_FOR_REVIEW`, `APPROVED`, `EXECUTING`, and unresolved `COMPENSATION_REQUIRED`. These constraints are backstops only; later typed operations must still take the approved root/lock order.

The scoped idempotency uniqueness tuple is exactly:

```text
environment_fingerprint
center_id
resource_scope_kind
resource_scope_id
operation
idempotency_key_digest
```

`resource_scope_kind` and opaque UUID `resource_scope_id` are non-null, so a nullable Case selector cannot admit duplicate null scopes.

```text
IDEMPOTENCY_NULL_SCOPE_DUPLICATE_ALLOWED: NO
IDEMPOTENCY_UNIQUE_CONSTRAINT_REPLACES_ROOT_LOCK: NO
```

## 9. Audit and outbox safeguards

`crm_audit_event` is append-only. A trigger rejects `UPDATE` and `DELETE`, its schema contains only typed opaque IDs/version edges/safe codes, and it has no arbitrary JSON or raw PII field.

```text
CRM_AUDIT_EVENT_UPDATE_ALLOWED: NO
CRM_AUDIT_EVENT_DELETE_ALLOWED: NO
CRM_AUDIT_RAW_PII_COLUMN_EXISTS: NO
```

`crm_outbox_event` has positive monotonic event versions, nonnegative attempts, safe payload validation, explicit claim ID/claimant/lease expiry, delivered timestamp consistency, immutable event identity/payload, and guarded delivery transitions. Delivery remains at-least-once; no worker or claim RPC is created.

```text
OUTBOX_NETWORK_DELIVERY_EXACTLY_ONCE: NO
OUTBOX_AT_LEAST_ONCE_IDEMPOTENT_CONSUMER_REQUIRED: YES
```

## 10. RLS and privilege boundary

All ten tables have both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. All table privileges are explicitly revoked from `PUBLIC`, `anon`, and `authenticated`. P1A creates zero policies, including zero broad active-member policies, and grants no direct browser provisioning or CRUD path.

```text
F23_3E_P1A_RLS_DEFAULT: FAIL_CLOSED
F23_3E_P1A_BROAD_MEMBER_POLICY_CREATED: NO
F23_3E_P1A_BROWSER_DIRECT_TABLE_WRITE_ALLOWED: NO
```

Typed operations, exact capability/assignment-aware read policies, masking, and any worker privilege are separate reviewed phases. Existing broad policies on legacy `center_cloud_entities` are not changed by this migration and remain a runtime blocker inherited from F23.13D.

## 11. Functions, triggers, and indexes

The migration creates:

- protected future-center root provisioning;
- a flat safe-outbox-payload validator;
- one table-allowlisted monotonic-version trigger function;
- Contact, Case, candidate, Assignment, Request, Idempotency, and Outbox lifecycle guards;
- an append-only mutation rejection trigger for Care Log and Audit;
- two deferred Case↔Assignment consistency trigger functions;
- exact-center supporting indexes, legacy provenance uniqueness, one-active assignment/request indexes, audit indexes, and outbox queue/lease indexes.

Every trigger-only/protected function has execution revoked from browser roles. No function is an application RPC, approval service, conversion executor, importer, or delivery worker.

## 12. Intentionally deferred

The following remain not started by P1A:

- Guardian profile;
- canonical Student profile and unenrolled-status decision;
- Guardian–Student Relationship;
- identity-match service, mutex, review evidence, and normalization rotation runtime;
- profile-creation reservation;
- conversion approval, MFA/step-up composition, and executor;
- capability resolver, Staff/account/membership eligibility service, and server masking;
- LocalStorage inventory/export/import runtime and compatibility projection;
- typed API/RPC service operations and UI wiring;
- outbox claim/delivery worker;
- broad legacy read/write remediation and production direct-API QA.

No Tuition, payment, cashflow, class, schedule, attendance, grade, Auth account, membership, or realtime resource is created or changed.

## 13. Execution and verification status

```text
F23_3E_P1A_LOCAL_SQL_APPLY: PASS
F23_3E_P1A_LOCAL_DB_BEHAVIOR_QA: PASS
F23_3E_P1A_REMOTE_APPLY: NOT RUN
F23_3E_P1A_AUTH_CHANGE: NO
F23_3E_P1A_EDGE_FUNCTION_CHANGE: NO
F23_3E_P1A_DEPLOY: NOT RUN
F23_3E_P1A_REAL_DATA_CHANGE: NO
QA target: local Docker Supabase only
Remote action: NOT RUN
Fixture cleanup: PASS
```

The user-provided local reset/apply result was `PASS`. The behavioral runner then discovered the single running `supabase_db_ichess-center-os` container from its Supabase and Docker Compose project labels and ran `psql` inside that container. It accepted no project, URL, credential, or mode arguments and used no network fallback.

The runner queried the live catalog and local migration history, then exercised the database constraints, triggers, RLS, policies, function/table privileges, lifecycle state machines, exact-center references, deferred Case/Assignment consistency, scoped idempotency, immutable events, and durable outbox transitions. All business fixtures used opaque random UUIDs inside one transaction. The final constraint resolution passed, the transaction rolled back, and a separate connection counted zero matching center, Auth-user, and CRM fixture rows.

Behavioral result summary:

| Area | Local database result |
|---|---|
| Dynamic inventory and local migration history | PASS; all 10 P1A tables and version `202607310001` present |
| Existing/future center control root and default `PLANNED` / `DISABLED` | PASS |
| RLS enabled/forced, zero P1A policies, browser table/function privileges | PASS; direct `authenticated` query denied |
| Exact-center composite foreign keys | PASS |
| One-active Assignment/Request and deferred Case/Assignment pointer | PASS |
| Contact, Case, candidate, Request, Idempotency, Assignment, and Outbox lifecycles | PASS |
| Exact `+1` versions and database-owned `updated_at` stamping | PASS |
| Append-only Care Log and Audit; typed Audit catalog | PASS |
| Scoped idempotency uniqueness and circular Request binding | PASS |
| Safe outbox payload, lease, retry, delivery, and terminal guards | PASS |
| Transaction rollback and separate leftover query | PASS; `P1A_QA_LEFTOVER_FIXTURE_COUNT: 0` |

The P1A migration was not edited during this QA task. Its post-QA SHA-256 remains `81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6`.

Repository check results:

| Check | Result |
|---|---|
| `node --check tests/f23-3e-p1a-canonical-crm-schema-and-control-root-local-db-qa.js` | PASS |
| P1A local-DB behavioral QA runner | PASS; every required marker emitted and fixture count `0` |
| `node --check tests/f23-3e-p1a-canonical-crm-schema-and-control-root-smoke.js` | PASS |
| P1A semantic SQL smoke | PASS |
| Six applied-migration SHA-256 guards | PASS, all six exact |
| F23.3E-P1 inherited planning smoke | PASS |
| F23.13C inherited smoke | PASS |
| F23.13D inherited smoke | PASS |
| F23.3E inherited smoke | PASS after canonical/local roadmap marker synchronization |
| F23.2 inherited smoke | PASS after canonical/local roadmap marker synchronization |
| `git diff --check` | PASS |
| Mojibake, credential/project/database locator, raw-PII fixture, broad-policy, remote-command, private-label, and readiness-claim scans in P1A smoke | PASS |

`RoadmapRealTime.txt` is synchronized locally with the canonical F23.2/F23.3E/P1A markers. It remains ignored and was not added to Git. The canonical roadmap mirror records P1A as backend/local verified while preserving P1B-P1F as pending phases.

## 14. External final technical audit closeout

The external final technical audit has passed. This closes P1A as `DONE backend/local verified`: the physical migration exists in the repository, local Docker SQL apply passed, live local-database behavioral QA passed, and every fixture was rolled back.

This closeout does not expand the implementation boundary:

```text
F23_3E_P1A_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1A_LOCAL_SQL_APPLY: PASS
F23_3E_P1A_LOCAL_DB_BEHAVIOR_QA: PASS
F23_3E_P1A_REMOTE_APPLY: NOT RUN
F23_3E_P1A_RUNTIME_WIRING: NOT STARTED
F23_3E_P1A_RLS_RUNTIME_POLICIES: NOT STARTED
F23_3E_P1A_REAL_DATA_CHANGE: NO
F23_3E_P1A_AUTH_CHANGE: NO
F23_3E_P1A_EDGE_FUNCTION_CHANGE: NO
F23_3E_P1A_DEPLOY: NOT RUN
```

P1B-P1F remain separate backend/runtime/QA phases. No remote schema, browser path, typed service operation, approval/executor, import runtime, or production capability is implied by this audit result.

## 15. Exact closeout files

```text
docs/f23-3e-p1a-canonical-crm-schema-and-control-root.md
tests/f23-3e-p1a-canonical-crm-schema-and-control-root-smoke.js
docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md
```

These are the three closeout artefacts for checkpoint verification. The ignored local `RoadmapRealTime.txt` mirror is synchronized but remains untracked. The P1A migration and local-database QA runner remain byte-for-byte unchanged. No source/runtime file, SQL migration, package manifest, Auth configuration, Storage configuration, or Edge Function is changed.
