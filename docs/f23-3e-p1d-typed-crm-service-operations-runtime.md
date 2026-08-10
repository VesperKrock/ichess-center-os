F23_3E_P1D_STATUS: IMPLEMENTED IN REPO
F23_3E_P1D_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1D_MIGRATION_CREATED: YES
F23_3E_P1D_LOCAL_SQL_APPLY: PASS
F23_3E_P1D_LOCAL_DB_BEHAVIOR_QA: PASS
F23_3E_P1D_REMOTE_APPLY: NOT RUN
F23_3E_P1D_BROWSER_RUNTIME_WIRING: NOT STARTED
F23_3E_P1D_FINAL_CAPABILITY_ENFORCEMENT: NOT STARTED
F23_3E_P1D_RLS_READ_PATH_REMEDIATION: NOT STARTED
F23_3E_P1D_LOCALSTORAGE_IMPORT: NOT STARTED
F23_3E_P1D_APPROVAL_EXECUTOR: NOT STARTED
F23_3E_P1D_REAL_CONVERSION: NOT IMPLEMENTED
F23_3E_P1D_AUTH_CHANGE: NO
F23_3E_P1D_EDGE_FUNCTION_CHANGE: NO
F23_3E_P1D_DEPLOY: NOT RUN
F23_3E_P1D_REAL_DATA_CHANGE: NO

# F23.3E-P1D typed CRM service operations runtime

## Baseline and approval boundary

Implementation started from clean `main` at checkpoint `32e96fd` with no tracked or untracked changes. P1D adds one forward migration and three verification/report artifacts. The implementation phase did not alter a prior migration, `src`, either roadmap, Auth data, remote state, browser wiring, Edge Functions, workers, deployment, or real data. Final closeout updates only this report, its semantic checkpoint guard, and the canonical/local roadmap status.

Remote action: NOT RUN

The runtime is a protected backend/local primitive. `service_role` is the only direct application-RPC grantee. It is not an end-user authorization endpoint and does not implement the future capability resolver.

## Immutable migration inventory

The nine inherited checkpoint migrations were verified byte-for-byte:

| Migration | SHA-256 |
| --- | --- |
| `20260722000000_remote_schema.sql` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100_transaction_images_bucket_prerequisite.sql` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001_f23_11e_staff_document_private_attachments.sql` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |
| `202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql` | `81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6` |
| `202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql` | `BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F` |
| `202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql` | `210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA` |

The forward migration is:

| Migration | SHA-256 |
| --- | --- |
| `202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql` | `BAE3968BF042C880865D17CAD1D8369F46E366CD990D5194361E0DF043A63722` |

External technical audit passed. This digest is now the immutable P1D checkpoint guard; migration bytes remain unchanged through closeout.

## Final technical audit closeout

External verdict: `F23_3E_P1D_FINAL_TECHNICAL_AUDIT: PASS`.

The canonical roadmap and ignored/local-only `RoadmapRealTime.txt` now contain exactly one current P1D status: `DONE backend/local verified`. One explicitly historical, non-current `F23.3E-P1D TODO backend` marker remains only for inherited P1A/P1C checkpoint-smoke compatibility. P1E, P1F, and P2-P4 remain TODO.

Tracked closeout files are this report, the P1D semantic smoke, and the canonical roadmap. `RoadmapRealTime.txt` is synchronized locally and remains ignored. The P1D migration, local DB QA runner, prior migrations, and `src` are unchanged.

## Prerequisite catalog and forward compatibility

The migration fails closed unless the P1A CRM root, Contact, Case, Assignment, Care Log, Audit and Outbox tables, `center_members`, P1C runtime, UUID generator, and `service_role` exist. It validates the physical `center_members.center_id`, `user_id`, `role`, and `status` types/nullability before creating operations.

P1A's two Case/Assignment invariant checks are deferred constraint triggers. A service-role call reaches those triggers after the application SECURITY DEFINER frame returns. P1D therefore alters only the live metadata of the exact inherited functions `f23_3e_p1a_assert_case_active_assignment()` and `f23_3e_p1a_assert_assignment_case_root()` to SECURITY DEFINER. Their P1A source and migration remain unchanged, their empty search path remains, and they receive no application grant. This preserves invariant enforcement without granting generic table SELECT to `service_role`.

## Exact application RPC inventory

All eleven return the common typed row:

`ok boolean, outcome_code text, resource_id uuid, resource_version integer, case_id uuid, case_version integer, assignment_id uuid, assignment_version integer, correlation_id uuid`

Exact signatures:

1. `f23_3e_p1d_create_crm_contact(uuid, text, uuid, text, bytea, integer, bytea[], integer)`
2. `f23_3e_p1d_update_crm_contact(uuid, uuid, integer, text, bytea, integer, bytea[], integer)`
3. `f23_3e_p1d_transition_crm_contact_status(uuid, uuid, integer, text, text)`
4. `f23_3e_p1d_create_consultation_case(uuid, uuid, uuid, integer)`
5. `f23_3e_p1d_transition_consultation_case_status(uuid, uuid, integer, text, text)`
6. `f23_3e_p1d_assign_consultation_case(uuid, uuid, uuid, uuid, integer)`
7. `f23_3e_p1d_reassign_consultation_case(uuid, uuid, uuid, uuid, integer, uuid, integer, text)`
8. `f23_3e_p1d_end_consultation_case_assignment(uuid, uuid, integer, uuid, integer, text)`
9. `f23_3e_p1d_revoke_consultation_case_assignment(uuid, uuid, integer, uuid, integer, text)`
10. `f23_3e_p1d_append_crm_care_log(uuid, uuid, uuid, text, text)`
11. `f23_3e_p1d_correct_crm_care_log(uuid, uuid, uuid, uuid, text)`

Every application RPC is SECURITY DEFINER with `search_path=''`. PUBLIC, `anon`, `authenticated`, and the default `service_role` grant are revoked before the exact service grant is added. Internal validators/event appenders have no direct service/browser grant. No CRM table receives generic service/browser CRUD.

## Trust and authority boundaries

P1D_ACTOR_IS_PROTECTED_SERVICE_ATTRIBUTION_ONLY: YES
P1D_CASE_ASSIGNMENT_GRANTS_GLOBAL_CONTACT_AUTHORITY: NO

`p_actor_user_id` must reference an existing `auth.users` row and is locked for attribution integrity. It is not interpreted as end-user authority, membership authority, a JWT claim, or a final capability decision.

Contact update/status RPCs accept no center parameter. Case, Assignment, and Care Log RPCs accept no center parameter. Their center is selected from the business root, the center control root is locked first, and the business row is locked/rechecked after that root. The initial selector read is non-authoritative and never authorizes mutation. A Case assignment grants authority only over the exact Case operation implemented here; it is never converted into global Contact authority.

## Contact operations

Create requires a protected-service-preallocated opaque UUID, nonempty exact center, safe source token, nonempty ciphertext, positive crypto/normalization versions, a nonempty digest array, and exactly 32-byte digests. It creates canonical `NEW/version 1` only.

Update is expected-version protected, cannot rewrite identity/center/lifecycle, and rejects archived Contact mutation. Status transition implements the exact inherited lifecycle and does not permit same-state mutation or restore from `ARCHIVED`.

P1D_CREATE_CONTACT_PREALLOCATED_ID_RETRY_SAFE: YES

All preallocated resource paths take a transaction advisory lock derived only from the opaque UUID before checking the physical row. This makes absent-row retries deterministic even if the same global UUID is raced through different center roots; an existing ID returns `RESOURCE_ALREADY_EXISTS` without overwrite or generic unique failure.

## Consultation Case operations

Create derives center from a locked, exact-version, non-archived Contact and creates canonical `OPEN`, `NOT_STARTED`, no active Assignment, version 1.

Status transition implements the P1A graph, increments Case version exactly once, owns closure/archive time in the database, does not mutate contact, conversion state, or assignment pointer, and rejects a terminal business transition while an active Assignment exists.

P1D_CASE_CONVERTED_STATUS_REACHABLE: NO

`CONVERTED` is rejected as invalid input and P1D never sets `conversion_state`. Real conversion remains reserved for the later P3 executor.

## Assignment target eligibility source

The applied repository catalog contains `center_members` but no separate canonical Staff/employment/account-link eligibility table. The repository's exact consultant role token is `consultant`; active membership status is `active`. P1D therefore locks and rechecks:

1. target `auth.users` existence;
2. one exact-center `center_members` row;
3. exact `status='active'`;
4. exact `role='consultant'`.

Actor and target auth rows are locked in UUID order. Membership is locked with `FOR SHARE`, so a concurrent eligibility update either commits first and causes `TARGET_NOT_ELIGIBLE`, or waits behind a validity snapshot locked through Assignment commit. Missing eligibility catalog is a fail-closed migration prerequisite and has the reserved typed outcome `TARGET_ELIGIBILITY_UNAVAILABLE` in both assignment operations.

P1D_ASSIGNMENT_TARGET_EXACT_CENTER_MEMBERSHIP_RECHECK: YES
P1D_ASSIGNMENT_TARGET_ELIGIBILITY_RECHECKED_UNDER_LOCK: YES
P1D_ASSIGNMENT_TARGET_ROLE_ACCEPTED_FROM_CALLER: NO

This minimum protected-runtime gate is not the final F13D capability resolver and does not claim Staff employment/link enforcement that is absent from the applied schema.

## Assignment operations

Assign requires a nonterminal, exact-version Case with no active Assignment, a preallocated Assignment ID, and a locked eligible target. It inserts `ACTIVE/version 1`, then advances the exact Case pointer/version.

Reassign verifies Case version, current pointer identity, current Assignment version/status, and target eligibility. In one transaction it changes old `ACTIVE` to `SUPERSEDED/version+1` with server end time/reason, inserts the new `ACTIVE/version 1` row, advances the Case pointer/version, then appends two Audit/Outbox pairs under one correlation ID.

P1D_REASSIGN_ALL_OR_NOTHING: YES

End and Revoke verify Case version, current pointer identity, and Assignment version/status. They create terminal Assignment history (`ENDED` or `REVOKED`), clear the pointer, and advance Case version. No path reopens a terminal Assignment.

## Care Log operations

The exact P1A physical schema contains `safe_content text`, not a protected bytea content column. P1D uses that existing field and repeats the inherited length and raw contact-pattern rejection before insert. Append accepts only canonical non-correction entry types. Case must be nonterminal.

Correction locks the exact original, rejects a different center/Case, and appends a new `CORRECTION/version 1` row referencing the original. P1A contains no rule forbidding a correction reference to a prior correction, so P1D does not invent such a restriction.

P1D_CARE_LOG_CORRECTION_UPDATES_ORIGINAL_ROW: NO
P1D_CARE_LOG_CORRECTION_IS_APPEND_ONLY: YES

## P1B Request inheritance

P1D creates no Request wrapper and duplicates none of the P1B create/update/submit/cancel/status functions. The P1B Request mutation set remains the canonical Request runtime without source or grant changes.

## Root gate, lock order, version and server values

Every mutation locks the exact `center_crm_control` row `FOR UPDATE` and requires `crm_state='ACTIVE'` plus `feature_flag_state='ENABLED'`. The actor auth row follows. Target auth rows and membership precede the Case lock for assignment operations. Aggregate rows and existing Assignment/original Care Log rows follow in the documented deterministic order. Preallocated global ID advisory/row checks precede business insert. Audit then Outbox are always last.

Expected business conflicts return typed outcomes, including Contact/Case/Assignment stale versions, identity stale, state conflict, active-assignment conflict, target ineligible, duplicate resource, and cross-center conflict. Internal invariant corruption still raises and rolls back.

Mutable aggregate versions increase exactly by one. Caller input cannot provide timestamps, correlation IDs, Audit/Outbox IDs, event version, or delivery version. Server correlation uses `gen_random_uuid()` and operational timestamps use database time.

## Audit and Outbox mapping

| Operation | Event type | Resource/version |
| --- | --- | --- |
| Contact create | `crm.contact.created` | Contact 1 |
| Contact update | `crm.contact.updated` | Contact previous+1 |
| Contact status | `crm.contact.status_changed` | Contact previous+1 |
| Case create | `crm.case.created` | Case 1 |
| Case status | `crm.case.status_changed` | Case previous+1 |
| Assign | `crm.assignment.assigned` | Assignment 1 |
| Reassign old | `crm.assignment.superseded` | old Assignment previous+1 |
| Reassign new | `crm.assignment.assigned` | new Assignment 1 |
| End | `crm.assignment.ended` | Assignment previous+1 |
| Revoke | `crm.assignment.revoked` | Assignment previous+1 |
| Care Log append | `crm.care_log.appended` | Care Log 1 |
| Care Log correction | `crm.care_log.corrected` | correction Care Log 1 |

Audit stores only typed safe metadata. Outbox uses the existing flat allowlist, starts `PENDING`, `attempt_count=0`, `delivery_version=1`, and uses the business aggregate's new immutable version as `event_version`. No Contact ciphertext/digest or Care Log content enters Audit or Outbox.

P1D_BUSINESS_AUDIT_OUTBOX_ATOMIC: YES
P1D_AUDIT_FAILURE_ALLOWS_BUSINESS_COMMIT: NO
P1D_OUTBOX_FAILURE_ALLOWS_BUSINESS_COMMIT: NO

P1D produces durable events only; it does not claim, acknowledge, fail, deliver, or perform network I/O.

## Local behavioral, fault and concurrency QA

The guarded Node-built-ins-only runner requires `ICHESS_P1D_LOCAL_QA_ALLOW_RESET=YES`, rejects arguments/linked state/non-loopback locators, discovers the exact labeled local Docker Postgres container, uses only `npx --no-install supabase db reset`, and always performs a final reset.

Behavioral QA passed for catalog/grants, inactive roots, Contact create/retry/update/version/lifecycle, Case create/contact-version/lifecycle/terminal guards, exact-center target eligibility, Assign/Reassign/End/Revoke invariants, append-only correction, exact event pairing, and safe event payloads.

Fault injection passed:

- forced Audit insert failure rolled back Contact update;
- forced Outbox insert failure rolled back Contact update and Audit;
- forced second Reassign event failure rolled back old Assignment, new Assignment, Case pointer, and both event pairs.

Real separate PostgreSQL sessions with advisory barriers passed:

- C1 concurrent Contact update: one winner;
- C2 concurrent Case status: one winner;
- C3 concurrent initial Assignment: one winner/one active row;
- C4 Reassign versus Revoke: one winner and exact pointer invariant;
- C5 double Reassign: one winner/one new active row;
- C6 duplicate preallocated Care Log ID: one row/one event;
- eligibility revoke race: Assignment waited on the membership lock, rechecked after revoke commit, and returned `TARGET_NOT_ELIGIBLE` without inserting.

## Final reset and regression

P1D_QA_FINAL_LOCAL_RESET: PASS
P1D_QA_LEFTOVER_FIXTURE_COUNT: 0
P1D_QA_NONDEFAULT_ROOT_COUNT: 0

After final reset, the P1D migration history count is exactly one and no QA helper remains. P1D semantic smoke, P1C/P1B/P1A and inherited smoke suites, Node syntax checks, whitespace checks, and hygiene checks are recorded only from actual commands in the handoff.

## Deferred and prohibited scope

- Remote apply: NOT RUN
- Browser/UI runtime wiring: NOT STARTED
- Auth change: NO
- Edge Function change: NO
- Worker/network delivery: NOT IMPLEMENTED / NOT RUN
- Final capability enforcement: NOT STARTED
- RLS read remediation: NOT STARTED
- localStorage import: NOT STARTED
- Approval/conversion executor: NOT STARTED
- Deploy: NOT RUN
- Real-data mutation: NO

## Exact P1D implementation artifacts

- `supabase/migrations/202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql`
- `docs/f23-3e-p1d-typed-crm-service-operations-runtime.md`
- `tests/f23-3e-p1d-typed-crm-service-operations-runtime-smoke.js`
- `tests/f23-3e-p1d-typed-crm-service-operations-local-db-qa.js`
