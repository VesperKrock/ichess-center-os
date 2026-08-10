F23_3E_P1C_STATUS: IMPLEMENTED IN REPO
F23_3E_P1C_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1C_MIGRATION_CREATED: YES
F23_3E_P1C_LOCAL_SQL_APPLY: PASS
F23_3E_P1C_LOCAL_DB_BEHAVIOR_QA: PASS
F23_3E_P1C_REMOTE_APPLY: NOT RUN
F23_3E_P1C_NETWORK_DELIVERY: NOT IMPLEMENTED
F23_3E_P1C_WORKER_DEPLOY: NOT RUN
F23_3E_P1C_BROWSER_RUNTIME_WIRING: NOT STARTED
F23_3E_P1C_FINAL_CAPABILITY_ENFORCEMENT: NOT STARTED
F23_3E_P1C_AUTH_CHANGE: NO
F23_3E_P1C_EDGE_FUNCTION_CHANGE: NO
F23_3E_P1C_DEPLOY: NOT RUN
F23_3E_P1C_REAL_DATA_CHANGE: NO

# F23.3E-P1C — Transactional Audit and durable Outbox runtime

## 1. Boundary and clean baseline

P1C implements protected database primitives for typed Audit reads and durable
Outbox delivery state. It does not change the P1B producer transaction, send a
message, run a worker, expose a browser path, change Auth, change an Edge
Function, wire UI, mutate a real record, or apply a migration remotely.

The repository baseline was checked before the first edit:

```text
Branch: main
Tracking: origin/main
HEAD: 49d207a Complete F23.3E P1B conversion request runtime
Initial worktree: clean
Stash applied: NO
Branch switched: NO
```

Inherited audited contracts remain unchanged:

```text
F23_3E_P1_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1A_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1B_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_FINAL_TECHNICAL_AUDIT: PASS
F23_13C_FINAL_TECHNICAL_AUDIT: PASS
F23_13D_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P1C_BROWSER_CALLABLE: NO
F23_3E_P1C_AUTHENTICATED_DIRECT_EXECUTE_ALLOWED: NO
F23_3E_P1C_ANON_DIRECT_EXECUTE_ALLOWED: NO
F23_3E_P1C_SERVICE_ROLE_ONLY_INTERNAL_RUNTIME: YES
P1C_CENTER_PARAMETER_IS_END_USER_AUTHORITY: NO
P1C_FINAL_CAPABILITY_ENFORCEMENT_IMPLEMENTED: NO
P1C_NETWORK_WORKER_IMPLEMENTED: NO
```

## 2. Immutable checkpoints and P1C migration

All eight inherited migrations were SHA-256 verified before implementation and
again by the P1C semantic smoke:

| Migration | SHA-256 |
|---|---|
| `20260722000000_remote_schema.sql` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100_transaction_images_bucket_prerequisite.sql` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001_f23_11e_staff_document_private_attachments.sql` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |
| `202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql` | `81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6` |
| `202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql` | `BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F` |

Exactly one forward migration was created:

```text
supabase/migrations/202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql
SHA-256: 210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA
```

The semantic inventory uses `^([0-9]+)_[a-z0-9_]+\.sql$` and `BigInt`. It
requires every checkpoint through P1C, resolves version `202608100001` to the
one canonical filename, rejects an unknown migration at or below that version,
and permits a later forward migration.

## 3. Live local prerequisites

The clean local reset applied P1A, P1B, and P1C from migration history. The P1C
migration fails closed unless the live catalog contains:

- `public.center_crm_control`, `public.crm_audit_event`, and
  `public.crm_outbox_event`;
- P1B's positive non-null `delivery_version` column and both P1B Outbox helper
  functions;
- exact `pg_catalog.gen_random_uuid()`;
- role `service_role`.

The local catalog check also verified all four application functions exist,
are security definers with an empty search path, have exact service-role
execution access, and have no `PUBLIC`, `anon`, or `authenticated` execution
access. Both P1C internal trigger helpers have no direct application-role
execution access. Audit and Outbox remain RLS-enabled, RLS-forced, and without
browser table CRUD privileges.

## 4. Typed Audit read

Exact signature:

```text
public.f23_3e_p1c_list_crm_audit_events(
  p_center_id text,
  p_after_created_at timestamptz default null,
  p_after_audit_event_id uuid default null,
  p_limit integer default 50
)
```

The RPC requires both cursor members to be null or both non-null and accepts a
limit from `1` through `100`. A mixed cursor returns typed `INVALID_CURSOR`; an
invalid center/limit returns typed `INVALID_INPUT`.

The predicate is always exact-center. Ordering and continuation are stable on
`created_at ASC, audit_event_id ASC`; no position-based pagination or dynamic
sort/filter expression exists. The projection contains only:

```text
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
```

It returns no raw contact data, protected evidence, digest, action graph,
arbitrary JSON, membership, account, or MFA field. Reading Audit creates no new
Audit row.

```text
P1C_AUDIT_READ_STABLE_KEYSET_CURSOR: YES
P1C_AUDIT_READ_EXACT_CENTER: YES
P1C_AUDIT_READ_RETURNS_RAW_PII: NO
P1C_AUDIT_READ_USES_OFFSET_PAGINATION: NO
```

Local fixtures with three equal timestamps in center A and one row in center B
proved first page, UUID tie-break, next page without overlap, exact-center
isolation, exact safe keys, invalid-cursor rejection, bounds, and browser
execution denial.

## 5. Outbox forward schema and immutable event identity

P1C adds these nullable operational fields to `public.crm_outbox_event`:

```text
last_attempt_at timestamptz
last_failure_code text
dead_lettered_at timestamptz
```

Physical checks enforce:

- `0 <= attempt_count <= 5`;
- attempt zero has no attempt timestamp and every positive attempt has one;
- a failure code, when present, is a lower-case safe token matching
  `^[a-z0-9][a-z0-9._-]{0,63}$` and has positive attempt history;
- `DEAD_LETTER` has a dead-letter timestamp and every other status does not;
- attempt/dead-letter timestamps cannot precede event creation.

P1C forward-replaces the two P1B Outbox triggers. The replacement lifecycle
guard permits bounded expired-lease reclaim while keeping all event identity
and content immutable:

```text
outbox_event_id
center_id
aggregate_kind
aggregate_id
event_type
event_version
safe_payload
created_at
```

Every delivery-state mutation must increment `delivery_version` by exactly one.
Claims increment `attempt_count`; acknowledgement and failure transitions do
not. Local QA also attempted a direct `event_version` rewrite and the lifecycle
guard rejected it.

```text
P1C_OUTBOX_EVENT_VERSION_MUTABLE_DURING_DELIVERY: NO
P1C_OUTBOX_SAFE_PAYLOAD_MUTABLE_DURING_DELIVERY: NO
P1C_OUTBOX_DELIVERY_VERSION_USED_FOR_CAS: YES
P1C_OUTBOX_MAX_DELIVERY_ATTEMPTS: 5
```

## 6. Claim primitive

Exact signature:

```text
public.f23_3e_p1c_claim_outbox_batch(
  p_center_id text,
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
```

Worker labels must match `^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$`; labels are
attribution, not authentication. Batch size is `1..100`, lease duration is
`5..300` seconds, and the caller supplies no claim UUID or absolute timestamp.

The function takes a shared lock on the exact center control root, requires
`ACTIVE + ENABLED`, and never activates it. It selects due `PENDING`/`RETRY`
rows plus expired `CLAIMED` rows in this order:

```text
available_at ASC, created_at ASC, outbox_event_id ASC
```

The selection and update form one function call and use `FOR UPDATE SKIP
LOCKED`. Each selected row receives a fresh database UUID, the protected worker
label, a server-time lease, `attempt_count + 1`, server `last_attempt_at`, and
`delivery_version + 1`. An unexpired lease is ineligible.

An expired fifth attempt is terminalized with safe code
`lease_expired_after_max_attempts` and is not returned. No sixth claim is
possible.

```text
P1C_CALLER_CONTROLS_ABSOLUTE_SERVER_TIME: NO
P1C_LEASE_USES_SERVER_TIME: YES
P1C_RETRY_AVAILABLE_AT_USES_SERVER_TIME: YES
P1C_OUTBOX_CLAIM_USES_SKIP_LOCKED: YES
P1C_OUTBOX_TWO_WORKERS_CAN_CLAIM_DISJOINT_ROWS: YES
P1C_OUTBOX_UNEXPIRED_CLAIM_RECLAIM_ALLOWED: NO
P1C_OUTBOX_ATTEMPT_SIX_ALLOWED: NO
```

## 7. Acknowledge primitive

Exact signature:

```text
public.f23_3e_p1c_ack_outbox_delivered(
  p_outbox_event_id uuid,
  p_claim_id uuid,
  p_worker_id text,
  p_expected_delivery_version integer
)
```

The function accepts no center or timestamp. It derives center from the Outbox
selector, takes the center control lock before the Outbox row lock, and rechecks
active runtime, exact current delivery revision, `CLAIMED` state, claim UUID,
worker label, and an unexpired lease.

Success sets `DELIVERED`, uses server time for `delivered_at`, and increments
only `delivery_version`. It preserves claim provenance required by the P1A
physical shape and does not change attempt count, event version, or payload.
Double/stale/wrong actions return typed failure without a second transition.

Typed outcomes are:

```text
DELIVERED
RESOURCE_NOT_FOUND
CLAIM_MISMATCH
CLAIM_EXPIRED
DELIVERY_VERSION_STALE
OUTBOX_STATE_CONFLICT
CRM_RUNTIME_NOT_ACTIVE
INVALID_INPUT
```

## 8. Failure, retry, reclaim, and dead letter

Exact signature:

```text
public.f23_3e_p1c_fail_outbox_delivery(
  p_outbox_event_id uuid,
  p_claim_id uuid,
  p_worker_id text,
  p_expected_delivery_version integer,
  p_failure_code text,
  p_retry_after_seconds integer
)
```

The same center-root/Outbox lock order and claim CAS rechecks apply. Failure code
is a safe token only; relative retry delay is `1..86400` seconds. There is no
free-form failure body or caller-owned absolute time.

Attempts one through four transition to `RETRY`, schedule `available_at` from
server time, clear the active claim, record the safe code, and increment only
`delivery_version`. A failure on attempt five transitions directly to
`DEAD_LETTER`, records server time and the safe code, and cannot schedule a
retry. Claiming is the only operation that increments attempt count.

Expired reclaim creates a different server claim UUID, replaces the worker
label, and increments attempt count and delivery revision once. An old worker's
subsequent action is rejected as stale without mutation.

```text
P1C_OUTBOX_RETRY_AFTER_ATTEMPT_4_ALLOWED: YES
P1C_OUTBOX_RETRY_AFTER_ATTEMPT_5_ALLOWED: NO
P1C_OUTBOX_DEAD_LETTER_AFTER_FAILED_ATTEMPT_5: YES
```

## 9. Behavioral, fault, and concurrency QA

The built-in-only Node runner requires exact
`ICHESS_P1C_LOCAL_QA_ALLOW_RESET=YES`, accepts no arguments, rejects a linked
project reference, validates loopback-only environment locators, reads local
Supabase status, and verifies the exact database container plus both local
project labels. Database assertions run through `docker exec ... psql`.

It performed a clean local reset before fixtures and exited `0`. Results:

| Area | Result |
|---|---|
| P1A/P1B/P1C local migration history | PASS |
| Exact RPC grants, hidden helpers, forced RLS, browser table denial | PASS |
| Audit exact-center/safe projection/keyset/tie-break/bounds | PASS |
| Claim order/bounds/future/unexpired/version/root gate | PASS |
| ACK success/wrong claim/wrong worker/stale revision/expired/double | PASS |
| Retry schedule/claim clear/not-early/safe code | PASS |
| Failed attempt five to dead letter; no attempt six | PASS |
| Expired reclaim and stale old-worker rejection | PASS |
| Expired fifth lease deterministic dead letter | PASS |
| Batch trigger fault rolls back every claim update | PASS |

Six multi-connection cases used real PostgreSQL sessions and deterministic
coordination:

```text
C1 two batch workers: disjoint claim sets, complete union, one lease per event — PASS
C2 one event/two workers: exactly one winner, one attempt increment — PASS
C3 one expired event/two reclaimers: exactly one winner and one revision increment — PASS
C4 ACK versus failure: one transition, loser typed stale/state conflict — PASS
C5 reclaim committed before stale ACK: new worker wins, old claim cannot deliver — PASS
C6 injected row-trigger failure: entire batch claim statement rolled back — PASS
```

## 10. At-least-once and privilege boundary

P1C supplies a database lease/state machine only. A later worker may complete an
external side effect and stop before acknowledgement; after lease expiry the
same event can be offered again. Consumers must therefore deduplicate by stable
event identity/version and be idempotent. This implementation makes no
single-delivery guarantee for an external system.

```text
P1C_OUTBOX_DATABASE_CLAIM_AT_MOST_ONE_ACTIVE_LEASE_PER_EVENT: YES
P1C_NETWORK_DELIVERY_EXACTLY_ONCE: NO
P1C_DELIVERY_MODEL: AT_LEAST_ONCE
P1C_CONSUMER_MUST_BE_IDEMPOTENT: YES
```

Only the four named application RPCs are granted to `service_role`. No browser
role receives execution or Audit/Outbox table CRUD. No generic policy, table
operation, center-membership shortcut, external sender, scheduler, or worker is
created.

## 11. Final cleanup and regression

The runner's `finally` block performed the required final clean reset even for
the earlier intentionally failing C5 test-orchestration iteration. The final
successful run reapplied P1C and verified:

```text
P1C_QA_FINAL_LOCAL_RESET: PASS
P1C_QA_LEFTOVER_FIXTURE_COUNT: 0
P1C_QA_NONDEFAULT_ROOT_COUNT: 0
P1C migration history count: 1
```

The final closeout checks cover P1C syntax/semantic smoke, P1B and P1A semantic
smokes, the inherited P1 planning/design/F23.2/F23.13C/F23.13D smokes,
repository whitespace checks, and hygiene scans. Migration inventory remains
forward-compatible, so P1A and P1B accept this later P1C migration without
weakening either checkpoint.

## 12. Remote and deployment status

```text
QA target: local Docker Supabase only
Remote action: NOT RUN
Network delivery: NOT IMPLEMENTED
Worker deploy: NOT RUN
Auth change: NO
Edge Function change: NO
UI wiring: NOT STARTED
Real-data change: NO
Commit: NOT RUN
Push: NOT RUN
```

## 13. Exact P1C files

```text
supabase/migrations/202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql
docs/f23-3e-p1c-transactional-audit-and-durable-outbox-runtime.md
tests/f23-3e-p1c-transactional-audit-and-durable-outbox-runtime-smoke.js
tests/f23-3e-p1c-transactional-audit-and-durable-outbox-local-db-qa.js
```

These are the only P1C implementation artifacts. The later audit closeout is
limited to the three tracked checkpoint files listed in section 14 plus the
ignored local roadmap mirror. No migration, local DB QA runner, source file,
package manifest, Auth configuration, Storage configuration, or Edge Function
was edited by closeout.

## 14. External final technical audit closeout

External technical audit passed with no SQL or runtime blocker. The P1C
migration remains byte-for-byte fixed at the checkpoint SHA-256 recorded in
section 2, and the full local behavioral, concurrency, fault-injection, cleanup,
semantic, and inherited regression suites passed again during closeout.

```text
F23_3E_P1C_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1C_LOCAL_SQL_APPLY: PASS
F23_3E_P1C_LOCAL_DB_BEHAVIOR_QA: PASS
F23_3E_P1C_REMOTE_APPLY: NOT RUN
F23_3E_P1C_NETWORK_DELIVERY: NOT IMPLEMENTED
F23_3E_P1C_WORKER_DEPLOY: NOT RUN
F23_3E_P1C_BROWSER_RUNTIME_WIRING: NOT STARTED
F23_3E_P1C_FINAL_CAPABILITY_ENFORCEMENT: NOT STARTED
F23_3E_P1C_AUTH_CHANGE: NO
F23_3E_P1C_EDGE_FUNCTION_CHANGE: NO
F23_3E_P1C_DEPLOY: NOT RUN
F23_3E_P1C_REAL_DATA_CHANGE: NO
```

The tracked checkpoint-verification closeout files are:

```text
docs/f23-3e-p1c-transactional-audit-and-durable-outbox-runtime.md
tests/f23-3e-p1c-transactional-audit-and-durable-outbox-runtime-smoke.js
docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md
```

`RoadmapRealTime.txt` mirrors the canonical roadmap locally and remains ignored
and untracked. P1D-P1F and P2-P4 remain pending; this closeout does not authorize
or imply any remote, delivery-worker, browser, Auth, Edge, deployment, or
production-readiness action.
