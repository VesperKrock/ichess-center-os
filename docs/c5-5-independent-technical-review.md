# C5.5 independent technical review

Review date: 2026-08-14

Verdict: **PASS after targeted remediation**. Remaining findings are `CRITICAL 0`, `HIGH 0`, `blocking MEDIUM 0`. C5.6 was not started and no remote Supabase/Auth/Edge/Storage/app apply/deploy was performed.

## Migration identity and inherited integrity

- Accepted base: `202608140007_c5_5_staff_hr_authoritative_shared_truth.sql`
- Accepted SHA-256: `63642029F0C6FA298EFCD9577C50F8FB4FD7F93F44190A24EEC602AE064D992C`
- Review hardening: `202608140008_c5_5_independent_review_access_projection_attachment_hardening.sql`
- Hardening SHA-256: `932CB8B12F25465D0CA685F303BD24B2F5B4A665CD1C5D493C10E6EDBE55D34F`
- The accepted base migration was not edited during review.
- SHA-256 verification passed for all 26 inherited/frozen migrations through C5.4.

## Findings and remediation

1. **HIGH — resolved: protected Staff/HR projection survived an auth boundary in memory.** Logout changed `cloudStatus` but did not clear roster/departments or sensitive Staff projection arrays and drafts. A lower-role account reusing the browser could therefore inherit stale active state before its membership bootstrap settled. Runtime now clears the complete C5.5 projection, administrative windows/drafts, attachment viewer/signed URL state, retry state, and account directory before signed-out render and before any new account membership resolution. External refresh also withholds the prior projection before server authorization/pull. Same-token role downgrade is denied by DB authority and the failed refresh leaves no active old projection.
2. **MEDIUM (blocking) — resolved: profile open/reveal audit was a browser compatibility no-op.** Mutation audit was server-authored, but security-relevant profile open and sensitive-field reveal were not durable server evidence. The additive audit RPC now verifies current active exact-center owner/admin membership, validates exact Staff/Profile references and an allowlist of non-secret field identifiers, assigns actor/role/time server-side, and commits an idempotent event before access succeeds. The authoritative snapshot includes those events.
3. **MEDIUM (blocking) — resolved: inherited attachment prepare RPC accepted syntactically valid but non-authoritative parent IDs.** Attachment identity was immutable after insert and projection excluded orphans, but a same-center caller could still create new orphan/wrong-parent protected metadata. An additive trigger now requires the exact `(center, staff, administrative profile, document)` chain in C5.5 authority on every insert or attempted rebind. Inherited orphans remain recoverable and non-projected; no destructive cleanup was added.
4. **MEDIUM (blocking) — resolved: malformed/denied refresh could retain old HR truth.** The adapter already rejected partial rows, but runtime retained the prior projection for some read failures. Refresh now clears/withholds first and installs arrays only after the entire exact-center response validates. The review also corrected two undefined-scope checks in profile create/edit and moved inherited C5.3 open/reopen refresh calls from an invalid Staff scope to `openModuleWindow`.

## Adversarial verdict matrix

| Boundary | Verdict and physical evidence |
| --- | --- |
| Staff roster | PASS — typed exact-center table and authenticated command/list RPCs; all active create/edit/archive/restore/lifecycle flows are server-first; no Staff local-storage mutation remains. |
| Department | PASS — exact-center versioned create/update/archive/restore, normalized uniqueness, composite Staff FK, preserved archived history, stale writes rejected. |
| Administrative profile | PASS — one typed protected row per exact-center Staff record; no generic sensitive JSON authority; full-response structural validation; server-first mutation and access audit. |
| Documents | PASS — metadata is typed/versioned and exact Staff/Profile referenced. `attachmentIds` derive only from available private rows matching the complete authoritative parent chain. |
| Protected attachment | PASS — existing private bucket is reused; active exact-center role required; wrong-center prepare and signed download denied; new orphan/wrong-parent insert and identity rebind rejected; inherited orphan excluded; no duplicate bytes model. |
| Teacher boundary | PASS — only `teacher_local_id` reference to exact-center non-deleted C5.1 Teacher; invalid/cross-center link denied; C5.1 Teacher row count and migration behavior unchanged. |
| Auth/membership boundary | PASS — Staff create/archive never creates, copies, revokes, or deletes Auth/`center_members`; account link requires an existing active exact-center membership and stores only explicit IDs. |
| Sensitive disk cache | PASS — active HR projections and profile/document data are memory-only. Runtime has no Staff durable storage getters/savers. Quarantine manifest contains hashes/shape only, never raw sensitive payload. |
| Role downgrade/browser reuse | PASS — same authenticated token is denied immediately after DB role downgrade; logout/new-account paths clear projection and all sensitive transient state before render/membership resolution. |
| Retention/deletion | PASS — policy is versioned and Owner-only; request is versioned; approval is Owner-only with separation of duties and stops at `execution-pending`. Legal hold remains active, private attachment stays `available`, and browser permanent-execution readiness remains false. |
| Audit | PASS — mutations and protected access record center, server actor/membership/role, operation, resource, result and server time. Sensitive values are excluded; reveal audit accepts only field identifiers. Exact replay is idempotent and changed intent conflicts. |
| Same-center A↔B | PASS — distinct authenticated Owner/Admin clients share department, Staff, profile, document, attachment binding, policy and deletion state. |
| Fresh context | PASS — separate authenticated client reconstructs the full exact-center snapshot with empty browser persistence. |
| Cross-center | PASS — read/write, attachment prepare/binding and signed download are denied; leak count is zero. |
| Owner A→B→A | PASS — B snapshot is empty and returning to A reconstructs unchanged A truth with no merge/copy/fallback. |
| Refresh | PASS — signed-in bootstrap, center switch, module open/reopen and manual `Làm mới` pull authority. Failed/denied/malformed refresh remains visibly failed with old projection withheld. |
| Failure safety | PASS — network/server command failure cannot mutate memory or report success. Committed-but-refresh-failed is distinct and leaves the projection withheld rather than fabricating local success. |
| Conflict/idempotency | PASS — expected versions reject stale writes; exact command/access-audit replay returns the stored result; changed intent conflicts; retry does not duplicate Staff or audit evidence. |
| Malformed projection | PASS — a response containing one wrong-center/malformed row returns `INVALID_SERVER_RESULT`, exposes no partial collection, and cannot advance projection health. |

## Legacy Staff verdict

- Classification: absent/empty well-formed state is `RECONSTRUCTABLE_CACHE`; no current exact fixture signature is broad-retired; non-empty durable data is `REAL_LOCAL_ONLY`; malformed/non-empty client audit is `UNCERTAIN`.
- Recoverability: real/uncertain values remain at their original exact-center keys. The manifest is idempotent, checksum-protected, `QUARANTINED_NOT_ACTIVE`, and `MIGRATION_REQUIRED`.
- Manifest privacy: only source key, presence, byte length, SHA-256, shape/count and schema versions are stored; `containsRawHrPayload` is physically false and a sensitive-marker regression proves no plaintext copy.
- Silent auto-upload: **NO**. The quarantine module has no Supabase client/RPC/upload path and server empty/nonempty snapshots never merge legacy rows.
- Silent real-data deletion: **NO**. Source keys are retained; the module has no `removeItem` path. Source drift fails closed.
- Controlled import: **DEFERRED / MIGRATION REQUIRED**. A future import must provide preview, explicit authorized confirmation, exact-center scope, idempotency, duplicate/conflict handling, and authoritative refresh.

## Targeted evidence

- `C5_5_STAFF_HR_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS`
- `C5_5_STAFF_HR_AUTHORITATIVE_SHARED_TRUTH_LOCAL_DB_QA: PASS`
- `C5_5_QA_SERVER_ACCESS_AUDIT_IDEMPOTENCY: PASS`
- `C5_5_QA_PROFILE_DOCUMENT_PRIVATE_BINDING_DOWNLOAD_REBIND: PASS`
- `C5_5_QA_GOVERNANCE_SERVER_AUDIT_LEGAL_HOLD_NO_DELETE: PASS`
- `C5_5_QA_SAME_TOKEN_ROLE_DOWNGRADE_FAIL_CLOSED: PASS`
- `C5_5_QA_FINAL_LOCAL_RESET: PASS`
- F23.11E private upload, replace/version history, retention/legal-hold/delete-execution smokes: PASS
- C5.1 Teacher/core, C5.3 CRM and C5.4 Finance targeted smokes: PASS
- Changed JavaScript `node --check`: PASS
- Production build: PASS; only the inherited bundle-size advisory remains.
- `git diff --check`: PASS

The historical F23.11B.2 smoke still requires reset statements to be textually embedded inside `resetTransientStateForCenterSwitch`; C5.5 review moved that same behavior into the stricter access-boundary helper and current regressions prove it. The historical C6.6G file allowlist also predates the authorized Staff module change. Both are stale structural assertions and were recorded without weakening or mass-editing them.
