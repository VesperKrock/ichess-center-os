# POST-C5 Core Save and Cloud Readiness Recovery

Date: 2026-08-20
Branch: `main`
Reviewed baseline: `5a9a5383c33ae84f185a8efbf0f01ac8ccc9ed13`
Remote production: **NOT APPLIED / NOT DEPLOYED**

## Outcome

Local recovery and targeted QA: **PASS**.
Production acceptance: **BLOCKED — remote apply approval is required**.

No remote mutation, Supabase/Auth/Edge/Storage apply, app deploy, commit, or push was performed.

## Root cause

There are two independent causes, both proven from repository/runtime evidence.

1. The Student, Class/Schedule and Finance/Cashbook paths were incorrectly coupled to the historical global `center_cloud_entities` readiness probe before contacting their authoritative domain command/read contract. A stale or incompatible generic HEAD response could therefore disable or reject a valid Owner/Admin write without calling `c5_1_mutate_core_entity` or the C5.4 RPCs.
2. The configured remote database is genuinely behind the C5 client contract. The exact generic readiness request returns HTTP 400; a read-only zero-row request identifies PostgreSQL `42703`: `column center_cloud_entities.entity_version does not exist`. The linked migration ledger stops at `202607280003`, while the C5.1 core contract begins at `202608130003` and C5.4 Finance/Cashbook begins at `202608140005`.

The former was a local orchestration/UX defect. The latter is a production schema gate and cannot be fixed safely in the client.

## End-to-end save trace

### Student

The form creates one stable idempotency key, calls `commitStudentProjection`, then invokes the authoritative `c5_1_mutate_core_entity` RPC through `upsertStudentCloudEntity`. The command verifies the current canonical center and freshly reads the signed-in user's membership before the RPC. Only a confirmed server result is installed as a local cache projection. An exact-center server pull then replaces that projection.

### Class and Schedule

Class uses the same C5.1 RPC as `class_session`. Schedule validates its bridge contract, then uses the same C5.1 RPC as `schedule_session`. Both now perform a fresh canonical-center/membership check, wait for a confirmed server result, install only the returned server entity, and refresh only the exact C5.1 upstream.

Owner, `center_admin`, and the supported `admin` alias have direct operational write parity. No approval queue is involved. The server migration independently allows `owner`, `qtv`, `center_admin`, and `admin`; cross-center and non-write roles fail closed.

## Save and refresh semantics

- A pre-commit network, permission, schema, validation, or version failure returns failure, performs no cache write, and keeps the form values and idempotency key intact.
- A confirmed commit is never reported as an uncommitted save failure.
- If the post-commit pull fails, the UI reports: the data was saved, the newest snapshot could not be loaded, and the user must not press Save again. The server-returned entity remains a cache projection, not browser-local authority.
- If the center changes after the commit, the old-center entity is not installed in the new-center projection.
- Create forms retain a stable semantic fingerprint, idempotency key, local ID and `createdAt`. Retrying the same ambiguous intent replays the command result; editing the retained draft rotates the key but keeps the local ID so it cannot create a duplicate.

## `center_cloud_entities` readiness disposition

**PARTIAL, not obsolete.** C5.1 still deliberately uses `center_cloud_entities` for Student, Teacher, Class and Schedule authority, and its `entity_version` column and `c5_1_mutate_core_entity` RPC are required. What was obsolete was treating one generic HEAD probe and the internal label “Cloud DB C2.2 readiness” as a global prerequisite for every C5 domain.

The recovery therefore does not remove the C5.1 table. It removes that global pre-gate from Student/Class/Schedule commands and exact-domain bootstrap, and from the unrelated C5.4 Finance/Cashbook command/read paths. The actual domain read/RPC now proves whether its own schema is usable. User-facing messages no longer expose C2.2/RLS implementation terminology.

No localStorage business authority was introduced or restored.

## Remote evidence

- Configured project host: `zahcfnpaprbnuqpegdmo.supabase.co` (credential values were not printed).
- Exact historical readiness HEAD: HTTP 400.
- Read-only zero-row diagnosis: PostgreSQL `42703`, missing `center_cloud_entities.entity_version`.
- Linked remote migration ledger: present through `202607280003`; absent from `202607310001` onward.
- Required C5.1 migration: `202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql`.
- Required C5.1 SHA-256: `2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754`.
- That migration adds the positive `entity_version` contract, `center_core_command_result`, optimistic-version/idempotency behavior, C5.1 RLS, `c5_1_mutate_core_entity`, and authenticated execution grant.
- Cashbook/Finance also requires `202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql` and its currentness hardening `202608140006_c5_4_reconciliation_currentness_hardening.sql`.
- C5.4 SHA-256: `60E0B7114231172738E037F50A4EECB9C6345786E4D6CEF91A5DADD6B5C71F27`.
- C5.4 hardening SHA-256: `EA0C398D79B16B798A2BF8AD9C857B96B223DFB26202DCA2B9165D871BA97993`.
- A read-only `supabase db push --linked --dry-run` reports 25 pending migrations and includes the frozen `202608130002_f23_3e_p4b_safe_server_bridge_auth_step_up_conversion_ui_legacy_projection.sql`. A blind normal push is therefore explicitly prohibited.

## Exact remote apply plan — approval required

The independent review froze one explicit allowlist. P4B and every other pending migration are denied for this apply.

1. Confirm the linked project ref, current remote migration ledger, backup/PITR availability, and repository migration hashes. Redact all credentials from logs.
2. Run `npx --no-install supabase migration list --linked` and `npx --no-install supabase db push --linked --dry-run` again as read-only preflight.
3. Treat the wider dry-run as proof that blind push is prohibited; it is not the execution set. Stop if the controlled SQL channel cannot isolate the exact allowlist, if any hash differs, if the ledger/schema changed unexpectedly, or if backup/recovery is unavailable.
4. After explicit approval, execute exact immutable migration bytes in this order only: `202608130003`, `202608140005`, `202608140006`. Validate each transaction before recording only that exact version in migration history.
5. Post-apply, verify read-only that `entity_version` exists and is positive, `center_core_command_result` exists, `c5_1_mutate_core_entity` resolves with the expected signature/grant, and the exact readiness shape no longer returns `42703`.
6. Run guarded authenticated production acceptance using designated test accounts: Owner A and Admin B in the same center, C in another center, fresh context, Student/Class/Schedule create-edit-reload, stale-version rejection, ambiguous retry, and cross-center leak/command denial. Do not use real business records.
7. Apply/deploy the app only under a separate explicit approval after the schema and guarded acceptance pass.

Until that plan is approved and completed, `REMOTE APPLY REQUIRED = YES` and `PRODUCTION READY = NO`.

## Targeted QA evidence

- `node tests/post-c5-core-save-cloud-readiness-smoke.js`: PASS.
- `node tests/c5-1-authoritative-core-contract-and-multi-account-harness-smoke.js`: PASS; inherited migration hashes PASS.
- Focused guarded C5.1 local DB acceptance: PASS for Student/Teacher/Class/Schedule create, edit, reload/fresh context, same-center A/B convergence, stale edit, cross-center denial/leak=0, Owner switch, membership currentness, retry idempotency, RLS, realtime, failure/no false local success, and final synthetic-data cleanup.
- Guarded minimal migration closure from exact remote boundary `202607280003`: PASS with only `202608130003`, `202608140005`, and `202608140006`; P4B objects remained absent; compact Core and Finance multi-account acceptance PASS.
- `node tests/c5-closeout-derived-convergence-smoke.js`: PASS.
- The form handlers retain Student/Class/Schedule state on `!result.ok`; they close only after a confirmed commit.
- Build and final diff checks are recorded in the implementation handoff.

No full historical smoke sweep or repeated Docker reset loop was run.
