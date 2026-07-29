# F23.12D — Protected Platform Owner bootstrap và revoke runbook

```text
RUNBOOK_CLASSIFICATION: PROTECTED PROCEDURAL CONTRACT
RUNBOOK_EXECUTABLE: NO
REAL_TARGET_ID_INCLUDED: NO
REAL_TARGET_EMAIL_INCLUDED: NO
EXECUTABLE_SQL_INCLUDED: NO
SECRET_OR_TOKEN_INCLUDED: NO
FIRST_BOOTSTRAP_REQUIRES_TWO_PERSON_REVIEW: YES
REVOKE_DRILL_REQUIRED_BEFORE_HIGH_RISK_RELEASE: YES
GLOBAL_AUTHORITY_CONTROL_SINGLETON_REQUIRED: YES
GLOBAL_AUTHORITY_CONTROL_LOCK_PRECEDES_ASSIGNMENT_LOCKS: YES
EMPTY_ASSIGNMENT_SET_IS_MUTEX: NO
ENVIRONMENT_BOUND_EXECUTION_ENVELOPE_REQUIRED: YES
CROSS_ENVIRONMENT_OR_SCHEMA_REPLAY_ALLOWED: NO
```

Tài liệu này mô tả ceremony/evidence/gates cho một execution window tương lai đã được phê duyệt. Nó không cấp quyền chạy production, không chứa command, executable SQL, account fixture hoặc credential. Mọi giá trị thực chỉ tồn tại trong protected change system/operator environment và không được copy về repo.

## 1. Vai trò và separation

| Vai trò | Trách nhiệm | Không được làm |
| --- | --- | --- |
| Change requester | Mở ticket, nêu business need, target ownership contact | Tự approve |
| Change reviewer | Xác minh identity, environment, payload digest, rollback và evidence | Trùng executor/target |
| Execution operator | Thực thi exact approved payload bằng protected server/operator tool | Đổi payload, tự review, là target |
| Target account owner | Xác nhận ownership qua second channel | Là reviewer/executor của chính grant |
| Observer | Quan sát post-check/revoke drill | Thay reviewer hoặc executor |

Reviewer và executor bắt buộc là hai người khác nhau. Target khác reviewer/executor. Requester có thể là target hoặc executor theo approved policy, nhưng không làm mất hai-person control.

## 2. Protected evidence bundle

Evidence bundle nằm ngoài repo, access-controlled và có retention đã duyệt. Tối thiểu:

```text
change_ticket_reference
approved_environment_fingerprint
approved_authority_schema_version
expected_global_control_version
expected_bootstrap_epoch
execution_contract_version
checkpoint_and_worktree_evidence
canonical_migration_hash_evidence
preflight_snapshot_reference
identity_verification_reference
canonical_payload_digest
reviewer_attestation
executor_attestation
safe_result_reference
post_verification_reference
revoke_or_recovery_reference
closure_outcome
```

`approved_environment_fingerprint`, `approved_authority_schema_version`, `expected_global_control_version`, `expected_bootstrap_epoch`, `execution_contract_version` và `canonical_payload_digest` bắt buộc đến từ cùng một reviewed execution envelope; không trộn evidence giữa review windows hoặc environments.

Không lưu raw contact identity, password, token, privileged credential, signed URL hoặc full private evidence trong audit/repo.

## 3. Universal preflight — mọi bootstrap/grant

Reviewer và executor đánh dấu từng gate `PASS` hoặc `ABORT`; không có trạng thái “bỏ qua”.

| # | Gate | Required evidence | Fail action |
| --- | --- | --- | --- |
| 1 | Approved branch/checkpoint | Exact reviewed checkpoint | `ABORT` |
| 2 | Clean execution worktree | No unreviewed diff | `ABORT` |
| 3 | Immutable applied migrations | Six canonical filenames + matching SHA-256 evidence | `ABORT` |
| 4 | Exact remote environment | Approved stable `environment_fingerprint`, independently verified | `ABORT` |
| 5 | Backup/snapshot | Restorable preflight reference | `ABORT` |
| 6 | Authority schema/version | Exact approved `authority_schema_version` | `ABORT` |
| 7 | Global authority singleton | Exactly one `platform_owner_authority` control row exists | `ABORT` |
| 8 | Bootstrap state/epoch | Exact expected state and `expected_bootstrap_epoch` | `ABORT` |
| 9 | Global control version | Exact `expected_global_control_version` | `ABORT` |
| 10 | Canonical account lifecycle | Healthy/available | `ABORT` |
| 11 | Audit/outbox | Write/readiness healthy | `ABORT` |
| 12 | Revoke/invalidation path | Ready and observed | `ABORT` |
| 13 | Approved ticket | Current, exact scope/window | `ABORT` |
| 14 | Reviewer/executor separation | Distinct protected identities | `ABORT` |
| 15 | Identity ceremony | Exact-one target + second channel | `ABORT` |
| 16 | Assignment state/count | Expected active count and target state/version; no malformed rows | `ABORT` |
| 17 | Term/review policy | Explicit term, expiry semantics and review deadline | `ABORT` |
| 18 | Execution/canonicalization contract | Approved versioned serializer and exact field set | `ABORT` |
| 19 | Payload digest | Reviewer-approved exact canonical digest | `ABORT` |
| 20 | Idempotency/expected outcome | Key unused or exact same completed outcome; no conflict | `ABORT` |

Không sửa nhanh schema, migration, identity hoặc audit rồi tiếp tục trong cùng window. Đóng window, tạo change mới và review lại.

## 4. Identity-resolution ceremony

1. Requester cung cấp business identity và ticket qua protected channel.
2. Executor chọn đúng approved environment; reviewer xác nhận độc lập.
3. Protected server/operator tool tìm Auth account.
4. Exact-one match bắt buộc; zero/multiple/alias ambiguity là `ABORT`.
5. Kiểm account không anonymous, banned, disabled, deleted, security-locked hoặc app-terminated.
6. Target owner xác nhận account ownership qua second channel.
7. Reviewer đối chiếu Auth identity với ticket.
8. Payload bind immutable `target_user_id`; contact identity không làm authority.
9. Không copy resolved ID/contact identity vào repo, chat log hoặc smoke fixture.

## 5. First Platform Owner bootstrap procedure

### 5.1 Entry conditions

- canonical query xác nhận zero active Platform Owner;
- ticket ghi `FIRST_PLATFORM_OWNER`;
- executive/security approval hiện diện;
- reviewer/executor/target separation PASS;
- universal preflight PASS;
- high-risk acting/features vẫn disabled.

### 5.2 Review ceremony

Reviewer kiểm versioned execution envelope bind chính xác `execution_contract_version`, `environment_fingerprint`, `authority_schema_version`, `global_control_key`, `expected_control_version`, `expected_bootstrap_epoch`, `bootstrap_type`, `activation_mode`, `target_user_id`, `canonical_machine_role`, `assignment_term`, `expires_at`, `review_due_at`, `reason_code`, `change_ticket_id`, `idempotency_key`, `expected_active_operator_count`, `expected_target_assignment_state`, `expected_target_assignment_version` và `canonicalization_version`.

Approved serializer có stable field/type/null/order semantics và protected digest; SHA-256 là default proposal. Không dùng raw UI/`JSON.stringify`, browser digest authority hoặc visual-only environment label. Reviewer approve exact digest; executor không đổi environment/schema/control/epoch/target/role/term/review/mode/ticket/idempotency/expected state sau review. Envelope không chứa contact identity, credential, token, signed URL hoặc private evidence.

### 5.3 Controlled execution contract

Execution operator dùng approved server-only operator environment và:

1. authenticate/authorize executor; bind exact ticket/window;
2. load exactly one `platform_owner_authority` global control row;
3. acquire global control lock **before** assignment rows;
4. re-read and require first-bootstrap state `NOT_COMPLETED`;
5. compare exact environment/schema/control-version/bootstrap-epoch from approved envelope;
6. query real assignments under lock and require zero effective-active operators;
7. re-check idempotency/concurrent outcome;
8. acquire involved assignment locks by sorted immutable user ID; empty target set is not the mutex;
9. re-resolve target and fail-closed lifecycle;
10. re-check expected target state/version and no conflicting history;
11. verify exact versioned canonical payload digest;
12. create exact `platform_owner` role with `FIRST_BOOTSTRAP_EXCEPTION` mode;
13. set term, expiry/null semantics, review deadline and authority version;
14. change first state irreversibly to `COMPLETED`;
15. increment bootstrap epoch and global control version;
16. append ticket/idempotency/digest-bound audit or transactional outbox;
17. atomically commit assignment + global control + audit/outbox and return safe outcome only.

Any mismatch, timeout/deadlock, audit/outbox failure or version conflict is full `rollback / ABORT`. Không được để assignment active với state `NOT_COMPLETED`, hoặc control state/version/epoch đổi mà assignment/audit không commit. Hai first bootstraps khác target vẫn tranh cùng global row; winner duy nhất commit, loser deny `first_bootstrap_already_completed`, không second exception/duplicate audit. Không fallback browser, membership, email hoặc unreviewed tool.

### 5.4 Immediate post-verification

Observer + reviewer verify read-only:

- exactly one active assignment for target;
- exact role, term, expiry/review and authority version;
- bootstrap audit/outbox event and ticket/digest linkage;
- global first state `COMPLETED`, exact incremented control version/bootstrap epoch;
- no center membership, client allowlist/config or persistent bootstrap path created;
- legacy route unchanged; proposed Global route not magically implemented;
- emergency revoke path ready.

Failure after commit triggers protected `SUSPEND`/`REVOKE`, not deletion/history rewrite.

## 6. Second Platform Owner enrollment

### 6.1 Readiness

- first operator active/valid;
- normal protected grant service ready;
- canonical lifecycle, audit/outbox, approval and revoke services healthy;
- second target completes independent identity ceremony;
- requester, approver and target relationships satisfy design contract;
- revoke drill plan approved.

### 6.2 Normal grant

1. Requester submits exact target/term/review/reason intent; submission alone creates no authority state.
2. Proposal service loads/locks global control first, then sorted involved assignments; re-checks its proposal envelope and creates `PROPOSED` + bumped control version + audit/outbox atomically.
3. Distinct active Platform Owner re-authenticates and reviews a new exact activation envelope bound to the resulting proposal/control state.
4. Activation service re-loads and locks exact global control singleton first; require state `COMPLETED` and approved environment/schema/control-version/bootstrap-epoch.
5. Server locks requester/approver/target assignment rows by canonical `sorted user_id` order; target mới không có row vẫn đã serialize ở global tier.
6. Re-check active count, requester/approver/target lifecycle, authority versions và expected target state/version.
7. Consume exact single-use grant approval.
8. Activate independent assignment with `SECOND_OPERATOR_APPROVAL` mode and bump global control version.
9. Commit mutation + approval consumption + global control + audit/outbox atomically.
10. Verify two distinct active IDs/assignments/review deadlines and exact control outcome.

Proposal và activation mỗi phase dùng own reviewed envelope/idempotency/expected version; stale proposal digest không authorize activation. First-bootstrap exception is forbidden here. Two grants cùng target mới serialize trên global row; loser returns exact idempotent outcome hoặc conflict/deny, không duplicate assignment/audit. Unique/index chỉ là integrity backstop. Two active operators do not automatically release write/sensitive features.

## 7. Revoke drill procedure

### 7.1 Preconditions

- staging/test by default, or separately approved production-safe rehearsal;
- known non-business-critical test assignment;
- observer and recovery plan;
- healthy authority/audit/outbox/invalidation services;
- no unplanned business interruption.

### 7.2 Steps and expected evidence

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read-only verify assignment active | Current authority version captured |
| 2 | Verify Global authority | Authorized before revoke only |
| 3 | Optionally start bounded low-risk acting | Exact session/version captured |
| 4 | Protected suspend/revoke | Assignment terminal/inactive; version increases |
| 5 | Check acting | Session terminal/inactive |
| 6 | Check pending approvals | Revoked/invalid |
| 7 | Repeat protected request | Immediate deny; no wait for token expiry |
| 8 | Focus/reload old tab | Revalidation deny; inventory/viewers/cache clear |
| 9 | Check membership independence | Existing membership unchanged and not global authority |
| 10 | Inspect audit/outbox | Complete ordered events, no duplicate |
| 11 | Attempt row reuse conceptually/read-only verify | Revoked row remains terminal |
| 12 | Recover only if plan requires | New linked proposal/assignment, never revive/delete |

Drill outcome is `PASS`, `FAIL`, or `ABORT`. `FAIL` blocks high-risk release and opens incident/remediation; it is not hidden by manual data repair.

## 8. Emergency suspend/revoke

Use only for suspected compromise or integrity incident:

1. open incident/change reference;
2. resolve exact immutable target in correct environment;
3. acquire exact global control lock, then target assignment lock, sessions and approvals in canonical order;
4. re-check global/assignment expected versions and lifecycle;
5. suspend/revoke assignment;
6. invalidate acting sessions and pending approvals;
7. increment assignment authority version and global control version;
8. commit mutation + control + audit/outbox atomic;
9. verify next-request deny and cache/viewer cleanup;
10. schedule mandatory post-incident review.

Emergency path may permit one protected executor for containment if approved policy allows, but never grants/recover authority and never omits audit.

## 9. Zero-active-operator recovery

Only `RECOVERY_BOOTSTRAP` is allowed. Preconditions add incident + executive/security approval, two-person review and immediate second-owner recovery plan. The same identity, lifecycle, environment-bound envelope, digest, atomicity, post-verification and closure controls as first bootstrap apply.

Recovery loads exactly one global singleton, locks it before assignments, requires locked first-bootstrap state `COMPLETED`, exact expected version/epoch and canonical zero effective-active count. It creates a new recovery assignment, never revives a terminal row; keeps state `COMPLETED`; increments bootstrap epoch and control version; then commits assignment + control + audit/outbox atomically.

Recovery and normal grant race on the same global row. If normal grant wins and active count becomes non-zero, recovery denies or requires a separately reviewed normal-grant proposal/envelope; it never silently uses the exception. If recovery wins, a pending normal grant must re-review changed epoch/version. Grant cùng new target also follows global-first order.

Forbidden: center Owner escalation, contact allowlist, public endpoint, client-state override, shared credential or revived revoked row.

## 10. Rollback and compensation

| Moment | Response |
| --- | --- |
| Before commit | Transaction rollback; audit safe failure if contract supports it; close/redo change |
| Assignment active but post-check fails | New `SUSPEND`/`REVOKE` correction event; preserve original history |
| Notification delivery fails | Outbox retry; incident if exhausted; no silent history reversal |
| Invalid target discovered after activation | Emergency revoke + incident + new correct proposal after review |
| Duplicate/concurrency conflict | Losing transaction rollback; idempotent safe result; investigate invariant |

Never hard-delete assignment/audit or edit history to appear as if grant never occurred.

## 11. Closure checklist

- execution window closed;
- bootstrap capability/path disabled or inaccessible;
- evidence bundle complete and retained under approved policy;
- exact outcome, assignment authority version and resulting global control version recorded;
- resulting bootstrap epoch and irreversible first-bootstrap state recorded;
- execution path classification (`FIRST_PLATFORM_OWNER`, `RECOVERY_BOOTSTRAP` hoặc normal grant) recorded;
- approved environment-bound envelope/digest evidence linked;
- post-verification signed by reviewer/observer;
- revoke drill outcome linked;
- unresolved alerts/incidents assigned;
- high-risk features remain disabled unless separately approved;
- no real identity/credential copied into repo;
- no commit/push of execution evidence.

## 12. Stop conditions

Immediately `ABORT` on wrong environment/fingerprint, migration hash/schema mismatch, missing/multiple global control row, unexpected/reset bootstrap state, control-version/bootstrap-epoch mismatch, dirty/unreviewed execution tree, identity ambiguity, lifecycle dependency error, duplicate/malformed assignment, missing reviewer, payload digest mismatch, lock/version conflict, audit/outbox failure, unavailable revoke path or evidence leakage.

Do not improvise a browser action, public endpoint, email allowlist, membership grant, bootstrap backdoor or history deletion.

F23.12D PROTECTED RUNBOOK DESIGN COMPLETE - NOT AUTHORIZED FOR EXECUTION
