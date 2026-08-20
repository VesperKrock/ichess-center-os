# POST-C5 Core Save Independent Technical Review and Remote Apply Plan Freeze

Date: 2026-08-20
Branch: `main`
Reviewed baseline: `5a9a5383c33ae84f185a8efbf0f01ac8ccc9ed13`
Remote project: `zahcfnpaprbnuqpegdmo.supabase.co`
Remote mutation/apply/deploy during review: **NONE**

## Verdict

**PASS after two minimal remediations.**

| Severity | Open findings |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 0 |
| Blocking MEDIUM | 0 |
| LOW | 0 |

The local recovery is safe to checkpoint. Production remains blocked until the exact three-migration allowlist in this document receives explicit approval and the post-apply acceptance passes.

## Independent findings and remediation

| Finding | Initial severity | Remediation | Re-review |
| --- | --- | --- | --- |
| A denied Teacher/Consultant attempt could surface the access layer's internal C3.1 wording in a Student/Class/Schedule form. | MEDIUM / blocking | The authoritative core command context now emits a product-only read-only-role message. Server role/RLS behavior is unchanged. | PASS |
| Create retry retained its idempotency key and local ID but rebuilt `createdAt`. A response-lost-after-commit retry could therefore produce `IDEMPOTENCY_CONFLICT` instead of replaying the committed result. | MEDIUM / blocking | Form command state now retains a stable semantic fingerprint, idempotency key, local ID, and `createdAt`. Same-intent retry replays exactly. Editing the retained draft rotates the key but keeps the local ID, so an ambiguous earlier commit becomes a version conflict rather than a duplicate. | PASS |

One no-op change to the legacy generic push readiness helper was removed during review. The generic manual snapshot path retains its historical readiness requirement and is not part of the operational save path.

## Local diff classification

| File | Classification | Verdict |
| --- | --- | --- |
| `src/core-save-recovery.js` | REQUIRED FIX | Server-commit/refresh outcomes and stable form-command identity |
| `src/cloud-db-sync.js` | REQUIRED FIX | Direct exact-domain context/read plus product-safe readiness messages |
| `src/main.js` | REQUIRED FIX | Student/Class/Schedule and C5.4 orchestration |
| `tests/post-c5-core-save-cloud-readiness-smoke.js` | TEST/EVIDENCE | Failure, retry, role, form-state and call-graph contracts |
| `tests/post-c5-core-save-minimal-migration-closure-local-db-qa.js` | TEST/EVIDENCE | Remote-baseline closure, P4B exclusion and compact multi-account acceptance |
| `tests/c5-1-authoritative-core-contract-and-multi-account-harness-smoke.js` | TEST/EVIDENCE | Current server-before-cache contract and current C5.2 RLS marker |
| `tests/c5-1-authoritative-core-contract-and-multi-account-harness-local-db-qa.js` | TEST/EVIDENCE | Corrects a stale pre-C5.2 expectation: direct Attendance writes are denied after C5.2 |
| `docs/post-c5-core-save-cloud-readiness-recovery.md` | DOCUMENTATION | Implementation evidence and apply boundary |
| `docs/post-c5-core-save-independent-technical-review.md` | DOCUMENTATION | Independent verdict and frozen plan |

`UNRELATED = 0`. No migration, Figma/UI redesign, P4B, Teacher secret, or Owner checkpoint file changed.

## Root-cause verdict

**VERIFIED.** The old Student/Class/Schedule and C5.4 flows called the generic `checkCloudDbReadiness`, which issued a HEAD against `center_cloud_entities` before the domain RPC. The probe selected `entity_version`; a failure could therefore reject an otherwise legitimate operation before the authoritative domain contract was contacted.

The configured remote independently returned:

- HEAD: HTTP `400`;
- zero-row GET: HTTP `400`, PostgreSQL `42703`;
- message: `column center_cloud_entities.entity_version does not exist`.

The linked migration ledger independently shows remote versions only through `202607280003`; all 25 repository migrations from `202607310001` through `202608140011` are absent. A schema-only linked dump confirmed the base tables/functions and `pgcrypto` extension exist, while `entity_version`, the C5.1 RPC/result table and C5.4 tables/RPCs do not.

No credential, JWT, password, refresh token or service-role key was printed. The environment did not provide a reusable authenticated end-user session, so current remote exact-center membership reads and authenticated RLS behavior are **UNPROVEN** until post-apply guarded acceptance. They are mandatory stop/acceptance checks, not inferred PASS results.

## Generic readiness and security verdict

**PASS.** The recovery removes only the over-broad generic HEAD prerequisite.

The operational path remains:

```text
UI action
→ canonical nonblank center
→ current Supabase session
→ fresh exact-center active membership read
→ Owner/Admin client role check
→ domain RPC
→ server auth.uid()/membership/role check
→ RLS/security-definer boundary
→ expected-version + idempotency enforcement
→ committed result
→ exact-domain exact-center refresh
```

C5.1 still legitimately uses `center_cloud_entities`; its schema and RPC are not bypassed. C5.4 uses its dedicated Finance/Cashbook RPCs and no longer depends on the unrelated generic core HEAD. RPC absence, incompatible schema, permission denial or malformed snapshots still fail closed.

## Student and Class/Schedule verdict

| Contract | Verdict |
| --- | --- |
| Student create/edit | PASS |
| Physical Class authority | `class_session` through C5.1 RPC — PASS |
| Physical Schedule/Ca dạy authority | `schedule_session` through C5.1 RPC — PASS |
| Second Schedule authority introduced | NO |
| Server-first / no pre-commit cache write | PASS |
| Owner and same-center Admin direct write | PASS |
| Owner approval queue | NONE |
| Fresh exact-center membership before RPC | PASS |
| Stale version rejected | PASS |
| Same-center A↔B and fresh context | PASS |
| Cross-center read leak / write | `0` / DENIED |
| Pre-commit failure | Form values and command identity retained; no local success |
| Commit succeeded, refresh failed | Explicit committed warning; user told not to Save again |
| Ambiguous retry | Same intent/key replays once; changed retained draft cannot duplicate |
| Browser-local business authority | NONE; stored Student/Class/Schedule values remain cache projections |

Calendar custom events remain C5.7 authority and are not used as a second Schedule/Class source.

## Cashbook/readiness verdict

**PASS locally.** `refreshC54FinanceSharedTruth` and `writeC54FinanceCommand` now acquire direct authenticated exact-center context and then call `c5_4_list_finance_shared_truth` or `c5_4_mutate_finance_shared_truth`. They no longer fail because the generic core HEAD is stale. C5.4's own access checks, RPC access checks, forced RLS, version/currentness, idempotency and authoritative post-commit pull remain intact.

The ordinary UI no longer displays `Cloud DB C2.2 readiness`, `PostgREST`, `42703`, or `center_cloud_entities.entity_version`. Technical classification remains only in diagnostics/log metadata.

## Remote migration ledger and dependency graph

### Already applied remotely

| Version | Relevant baseline contribution | Local SHA-256 |
| --- | --- | --- |
| `20260722000000` | `centers`, `center_members`, `center_cloud_entities`, `transaction_attachments`, `can_write_center`, base RLS | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100` | Private `transaction-images` bucket prerequisite | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001` | Attachment `uploaded_by_name`, exact path validator and Owner/Admin attachment policies | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001` | Staff-document storage; not a closure dependency | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002` | Staff-document version history; not a closure dependency | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003` | Staff-document removal/legal hold; remote ledger boundary | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |

The linked schema dump also confirms `pgcrypto` is installed in schema `extensions`, satisfying `extensions.digest(bytea,text)` for C5.1/C5.4.

### Required object dependency graph

| Migration | Depends on | Creates/changes required by runtime |
| --- | --- | --- |
| `202608130003` | Applied `20260722000000`; `extensions.digest` | `center_cloud_entities.entity_version`; `center_core_command_result`; C5.1 read/noncore RLS; `c5_1_mutate_core_entity`; authenticated execute grant |
| `202608140005` | Applied `20260722000000`, `20260722000100`, `202607230001`; `extensions.digest` | Finance category/transaction/settings/reconciliation/binding/audit/idempotency tables; attachment guard; C5.4 list/mutate RPCs; exact-center role checks and grants |
| `202608140006` | `202608140005` only | Reconciliation currentness trigger/function and close-time authoritative recomputation |

There is no object, function, table, type, policy or trigger dependency on migrations `202607310001`–`202608130002`. A guarded local database was reset to exactly `202607280003`, then only the three allowlisted files were executed in order. All C5.1/C5.4 objects and multi-account operations passed while the P4B-owned `crm_conversion_bridge_session` remained absent; static closure checks also reject any P4B table/RPC reference in the three files.

## Every post-boundary migration classification

| Version | Classification for this closure |
| --- | --- |
| `202607310001` | DEFERRED — CRM P1A, not required |
| `202607310002` | DEFERRED — CRM P1B, not required |
| `202608100001` | DEFERRED — CRM P1C, not required |
| `202608100002` | DEFERRED — CRM P1D, not required |
| `202608100003` | DEFERRED — CRM P1E, not required |
| `202608110001` | DEFERRED — CRM P2A, not required |
| `202608110002` | DEFERRED — CRM P2B, not required |
| `202608110003` | DEFERRED — CRM P2C, not required |
| `202608120001` | DEFERRED — CRM P3B, not required |
| `202608120002` | DEFERRED — CRM P3C, not required |
| `202608120003` | DEFERRED — CRM P3D, not required |
| `202608130001` | DEFERRED — CRM P4A, not required |
| `202608130002` | **FROZEN — MUST NOT APPLY (P4B)** |
| `202608130003` | **MUST APPLY FOR CORE SAVE** |
| `202608140001` | DEFERRED — C5.2, not required for this minimal closure |
| `202608140002` | DEFERRED — C5.2 hardening, not required |
| `202608140003` | DEFERRED — C5.3, not required |
| `202608140004` | DEFERRED — C5.3 hardening, not required |
| `202608140005` | **MUST APPLY FOR FINANCE/CASHBOOK** |
| `202608140006` | **DEPENDENCY OF MUST-APPLY / REQUIRED C5.4 HARDENING** |
| `202608140007` | DEFERRED — C5.5, not required |
| `202608140008` | DEFERRED — C5.5 hardening, not required |
| `202608140009` | DEFERRED — C5.6, not required |
| `202608140010` | DEFERRED — C5.7, not required |
| `202608140011` | DEFERRED — C5.7 hardening, not required |

C5.2-driven Tuition payment integration is not promoted by this closure. Only manual Finance/Cashbook and the explicitly tested C5.4 surface enter the production acceptance; the other missing C5 waves remain separate remote gates.

## Frozen exact apply allowlist

Apply in exactly this order and no other order:

1. `supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql`
   - SHA-256: `2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754`
2. `supabase/migrations/202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql`
   - SHA-256: `60E0B7114231172738E037F50A4EECB9C6345786E4D6CEF91A5DADD6B5C71F27`
3. `supabase/migrations/202608140006_c5_4_reconciliation_currentness_hardening.sql`
   - SHA-256: `EA0C398D79B16B798A2BF8AD9C857B96B223DFB26202DCA2B9165D871BA97993`

**Everything else is denied for this apply.** In particular, `202608130002` P4B is frozen and excluded. `supabase db push` and `supabase migration up --include-all` are prohibited because their candidate set is wider than the allowlist.

## Approved procedure after explicit user approval

1. Reconfirm exact project identity, backup/PITR, remote ledger and schema-only dump. Run `migration list --linked` and `db push --linked --dry-run` only as read-only diagnostics; do not accept the dry-run plan.
2. Recompute the three hashes and compare byte-for-byte with this document.
3. Through a controlled SQL channel connected to the exact approved project, execute the exact bytes of item 1 as its own transaction. No edits, concatenated wildcard or generated replacement SQL.
4. Validate item 1's column, positive constraint, result table, RPC signature, policies and authenticated grant. Only then record version `202608130003` as applied with the reviewed migration-history repair command.
5. Repeat exact-byte execution, validation and history recording for `202608140005`, then `202608140006`.
6. Verify the remote ledger contains the original six versions plus exactly the three allowlisted versions; every denylisted version, including P4B, must remain absent.
7. Run the guarded production acceptance below. App deploy is a separate approval.

Migration-history repair is allowed only after the corresponding exact bytes committed and validation passed. It must never be used to mark a skipped or failed SQL file as applied.

## Stop conditions

Stop before any mutation if:

- the project ref/host or authenticated target is ambiguous;
- the remote ledger differs from the six-version baseline recorded here;
- an allowlisted object already exists unexpectedly or has a different shape;
- an expected base dependency, `extensions.digest`, bucket/path guard or grant is missing;
- any allowlisted SHA-256 differs;
- the execution tool cannot guarantee exact file bytes and one transaction per migration;
- P4B or any other denylisted migration enters the execution set;
- backup/recovery prerequisites are unavailable;
- a migration or its post-apply validation fails.

Do not improvise, edit inherited migrations, continue to the next file, or mark history after a failed validation.

## Post-apply production acceptance plan

Run only after explicit approval and successful migration validation, using designated synthetic accounts/records:

- Student: Owner create → same-center Admin observes → Admin create/edit → Owner observes → reload → fresh browser → different-center leak `0` and write denied → injected failure shows no false success.
- Class and Schedule: repeat the same matrix separately for `class_session` and `schedule_session`; include stale edit and same-key ambiguous retry.
- Cashbook: Owner/Admin list authoritative categories/settings/transactions; Admin commits one manual transaction; Owner observes; reload/fresh browser reconstructs; different center is denied; reconciliation close uses current ledger; the old generic readiness banner cannot block the domain RPC.
- Roles: Owner and Admin commit directly; no Owner approval queue.
- Failure: pre-commit retains form/draft; committed-but-refresh-failed is labeled committed and does not invite another Save.

No real business record is used. C5.2 Tuition-originated Finance, other C5 waves and app deployment remain outside this acceptance.

## Targeted evidence

- Read-only remote HEAD/GET reproduction: HTTP 400 / PostgreSQL 42703 PASS.
- Linked migration ledger reproduction: stops at `202607280003`; 25 pending PASS.
- Linked schema-only dump: base dependencies and `pgcrypto` present; C5.1/C5.4 objects absent PASS.
- Guarded minimal-closure local DB QA from exact `202607280003`: dependency closure, P4B absence, Owner/Admin core parity, A/B convergence, fresh context, cross-center leak `0`, stale conflict, idempotent replay, C5.4 Admin commit/Owner observe and final reset PASS.
- The first closure run stopped during fixture setup because the accepted baseline intentionally denies `service_role` direct `centers` inserts; closure/P4B assertions and final reset passed. The harness was corrected to use the guarded local postgres fixture channel, then the single affected acceptance was rerun successfully.
- Recovery smoke: PASS.
- C5.1 authority smoke and 19 inherited hashes: PASS.
- C5.4 Finance/Cashbook smoke and accepted hashes: PASS.
- C5 Closeout convergence smoke: PASS.
- Changed JavaScript syntax checks: PASS.
- Production build: PASS; existing bundle-size advisory only.
- No full historical smoke sweep and no reset loop were run.

## Final decision

The local recovery meets the threshold: `CRITICAL=0`, `HIGH=0`, `blocking MEDIUM=0`. The local checkpoint may be committed and pushed. Remote apply remains **REQUIRED but NOT AUTHORIZED** until the user explicitly approves this frozen allowlist.
