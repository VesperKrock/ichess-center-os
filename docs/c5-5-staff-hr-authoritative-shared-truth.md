# C5.5 Staff / HR authoritative shared truth

Status: local QA PASS; ready for independent technical review/checkpoint. No remote Supabase/Auth/Edge/Storage/app apply/deploy and no Git commit/push were performed in this implementation turn.

## Physical root cause removed

Before C5.5, Staff roster, departments, administrative profiles, document catalog, retention policy, deletion requests, and administrative audit were durable browser-local collections. Mutations committed to center-scoped `localStorage`, so two accounts in the same center could own different HR truth even though attachment bytes/metadata already used protected Supabase Storage.

C5.5 starts every Staff/HR projection empty and makes the authenticated server RPCs the only active authority. Sign-in, Owner center switch, module open/reopen, and the compact `Làm mới` action perform an exact-center pull. Every durable mutation commits server-side first, then replaces memory only after a successful authoritative pull; a failed command cannot project the proposed mutation or report local success.

## Server contract and authority boundaries

The additive migration creates typed, versioned tables for:

- department and staff roster/member;
- sensitive administrative profile fields;
- staff document metadata;
- deletion/governance requests;
- server-generated administrative audit events;
- actor + center + UUID idempotency command results.

It reuses and versions `center_staff_document_attachment_retention_policies` instead of creating a second retention authority. Document `attachmentIds` are derived only from available rows in the existing private `center_staff_document_attachments` foundation whose center/staff/profile/document parent chain matches exactly. Orphan or wrong-parent metadata is not projected as HR evidence.

`teacher_local_id` is only an explicit exact-center reference to the canonical C5.1 `teacher` entity. `account_user_id` + `membership_id` is only an explicit reference to one active exact-center `center_members` row. C5.5 never inserts into Auth, `center_members`, or the Teacher authority and never copies/merges those identities.

All C5.5 tables use forced RLS with direct table privileges revoked from public, anon, authenticated, and service role. Authenticated clients can use only `c5_5_list_staff_hr_shared_truth` and `c5_5_mutate_staff_hr_shared_truth`. Active `owner` and `center_admin` can read/write Staff/HR; Teacher and unrelated roles fail closed. Retention configuration and deletion approval are Owner-only, with separation-of-duties on deletion approval. Deletion approval moves evidence to `execution-pending`; it does not hard-delete profiles, documents, or private files.

Commands serialize per center, require expected versions, reject stale updates and wrong-center payload/references, and bind one idempotency key to one intent. Audit actor, membership, role, action, entity, version, and server time are generated inside the same server transaction; sensitive profile/document payload is not copied into audit summaries.

Independent review added `202608140008_c5_5_independent_review_access_projection_attachment_hardening.sql` without changing the accepted base migration. It adds an exact authoritative parent-chain trigger to every new/rebound private Staff attachment, an authenticated/idempotent server audit gate for profile open and sensitive-field reveal, and a snapshot wrapper that returns those server-authored access events. Runtime now clears roster, sensitive projections, drafts, viewers, signed URLs, and pending retry state at logout/account-resolution boundaries. Every external refresh withholds the previous projection before authorization/pull, so role downgrade, network denial, or a malformed response cannot leave old protected HR as active rendered truth.

## Legacy Staff/HR safety

The inventory covers the seven exact-center keys for members, departments, administrative profiles, documents, client-authored audit events, retention policies, and deletion requests.

- Absent/empty well-formed values are classified `RECONSTRUCTABLE_CACHE`.
- No exact safe fixture signature exists in the current Staff implementation, so non-empty data is never retired under a broad sample heuristic.
- Non-empty durable collections are `REAL_LOCAL_ONLY`; malformed shapes and non-empty client-authored audit are `UNCERTAIN`.
- Real/uncertain sources remain at their original exact-center keys and are marked `QUARANTINED_NOT_ACTIVE` / `MIGRATION_REQUIRED`.

The manifest stores only key names, byte lengths, record/schema counts, and SHA-256 checksums; it explicitly contains no raw HR payload. The originals are neither uploaded nor deleted and never enter the active server projection. Source or manifest drift fails closed. Controlled import is deferred and, if product needs it, must add preview, explicit confirmation, exact-center scope, and idempotency.

## Runtime and data-handling boundaries

- Active Staff/HR arrays are memory projections only; legacy storage helpers remain solely to preserve recoverable historical keys and are not called by the runtime authority path.
- Sensitive administrative profiles are not written to a new plaintext disk cache or quarantine copy.
- Create/edit/archive/restore/lifecycle, departments, Teacher/account binding, profiles, documents, retention, and deletion workflows all use the C5.5 command RPC.
- Existing private attachment upload/replace/removal governance is retained and its access helpers are hardened to require an active exact-center role.
- Profile open and sensitive reveal succeed only after the dedicated server access-audit RPC commits; client code cannot dictate actor, membership, role, or timestamp.
- C5.5 uses authoritative refresh-on-open/reopen/manual refresh; it does not add a new Realtime publication or rebuild the Staff UI.
- Inventory, Calendar, Notes, Auth provisioning, and Teacher authority remain outside C5.5.

## Targeted evidence

Executed commands:

- `node tests/c5-5-staff-hr-authoritative-shared-truth-smoke.js`
- `$env:ICHESS_C5_5_LOCAL_QA_ALLOW_RESET='YES'; node tests/c5-5-staff-hr-authoritative-shared-truth-local-db-qa.js`
- `npm run build`

Acceptance evidence:

| Invariant | Evidence |
| --- | --- |
| Same-center A/B shared roster/profile/document/governance | Independent authenticated clients mutate/pull the same exact-center RPC snapshot |
| Fresh empty context | Fresh authenticated client reconstructs staff, profile, document binding, and deletion state without browser storage |
| Different-center and Owner A→B→A | Unauthorized center read/write denied; Owner sees empty B then unchanged A |
| Teacher/Auth are references only | Valid explicit links succeed; nonexistent Teacher and other-center membership fail; membership/Teacher row counts do not change |
| Version/conflict/idempotency | Stale write rejected; exact retry replays; changed intent conflicts; no duplicate staff row |
| Cloud failure no false success | Adapter offline case plus server-commit-before-memory runtime ordering |
| Protected attachment binding | Only exact parent-chain available private attachment is projected; orphan metadata is excluded |
| Governance/audit/no hard deletion | Center admin retention write denied; Owner policy/approval succeeds; server actor/access audit exists; legal hold, attachment, profile and document remain |
| Role downgrade/browser reuse | Same token loses role server-side and is denied; logout/new-account boundaries erase all in-memory Staff/HR projection and sensitive drafts |
| Malformed projection | Any invalid/wrong-center row rejects the whole pull; runtime withholds the prior projection before replacement |
| Legacy preservation/privacy | Exact-center source retained, manifest excludes sensitive marker, source mutation fails closed, no upload/remove path |
| ACL/RLS fail closed | Forced RLS, revoked direct grants, authenticated-RPC-only, wrong-role and paused-center denial |
| Inherited migrations immutable | SHA-256 verification for all 26 inherited migration files |

Final outputs:

- Migration SHA-256: `63642029F0C6FA298EFCD9577C50F8FB4FD7F93F44190A24EEC602AE064D992C`
- Independent-review hardening SHA-256: `932CB8B12F25465D0CA685F303BD24B2F5B4A665CD1C5D493C10E6EDBE55D34F`
- `C5_5_STAFF_HR_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS`
- `C5_5_STAFF_HR_AUTHORITATIVE_SHARED_TRUTH_LOCAL_DB_QA: PASS`
- Guarded DB cleanup: `C5_5_QA_FINAL_LOCAL_RESET: PASS`
- `npm run build`: PASS; only the inherited Vite bundle-size advisory remains.

One historical C6.6G smoke still flags `src/staff-module.js` as outside its frozen file allowlist. That assertion predates the authorized C5.5 Staff-module change; it is recorded as stale/out-of-scope and was not weakened or mass-fixed.
