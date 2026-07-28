# SUP-CF.1 - Hotfix quyen owner kho chung tu giao dich

Date: 2026-07-23

Status: policy/app patch prepared only; F23.11E.1 SQL hardening is migration-ready. No local reset, remote SQL, deploy, commit or push was performed.

## Target Trace

- Supabase project URL in local env: `https://zahcfnpaprbnuqpegdmo.supabase.co`.
- Supabase ref: `zahcfnpaprbnuqpegdmo`.
- Local Supabase project id: `ichess-center-os`.
- QA account from prior repo verification docs: `owner.duchai@ichess.vn`.
- Prior verified membership docs state this owner is active owner of `dreamhome_prod` and `phongtrong_prod`.
- Display name `DreamHome` maps in runtime to `dreamhome_prod`; `dreamhome` maps to `DreamHome staging`.
- Runtime auth resolver selects the first active membership ordered by `center_id`, then stores that center through `cloudStatus.centerId` and `setCurrentStorageCenterId`.

## Root Cause

The F23.8B app-side attachment helpers accepted a center parameter, but several call sites did not pass it:

- monthly attachment preload;
- gallery month list;
- signed URL generation;
- transaction image manager list;
- direct transaction-row upload;
- manager delete metadata/storage cleanup.

Those calls fell back to `CURRENT_CENTER_ID = dreamhome`. For a valid owner standing in the DreamHome production interface (`dreamhome_prod`), the helper queried membership for `dreamhome`, so the app reported that the account was not granted for `dreamhome`.

## App Patch

- Added one attachment access context in `src/main.js`.
- The context uses the current resolved binding center, not display name.
- It distinguishes signed out, membership loading, missing center membership, and role denied.
- It allows only `owner` and `center_admin` for transaction evidence.
- Every list/upload/signed-url/delete attachment path now passes the resolved current center id.
- Gallery and transaction manager stop when the current center changes while a modal is open.
- `src/transaction-attachments.js` and `src/supabase-storage.js` now enforce the same owner/center_admin role allowlist before hitting Supabase.

## RLS Patch

Migration path:

`supabase/migrations/202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql`

Policy helper:

`public.can_manage_transaction_attachments(requested_center_id text)`

Rule:

- `auth.uid()` must be present.
- requested center must be nonblank and match `public.center_members.center_id` exactly.
- membership user must equal `auth.uid()` exactly.
- normalized membership `status` must be exactly `active`; `NULL`, blank and malformed values deny.
- normalized membership `role` must be exactly `owner` or `center_admin`.
- authorization never uses email, display name, client role label or JWT user metadata.

Prerequisite gate:

- missing `public.transaction_attachments`, `public.center_members`, `storage.buckets` or `storage.objects` raises an explicit `SUP-CF.1 prerequisite missing` exception;
- missing policy columns raises an exception naming the table and missing columns;
- missing `transaction-images` bucket raises an explicit exception;
- migration no longer skips table RLS/policy creation through `IF EXISTS`.

Metadata table:

- `public.transaction_attachments` RLS remains enabled.
- SELECT/INSERT/UPDATE/DELETE are scoped by `center_id`.
- `storage_bucket` must be `transaction-images`.
- `storage_path` must match exactly `<center_id>/transaction-images/<YYYY>/<MM>/<fileName>` as five nonempty slash segments; center identity uses equality, never `LIKE`.
- INSERT requires `uploaded_by = auth.uid()`.
- UPDATE trigger rejects changes to `center_id`, `uploaded_by`, `storage_bucket` or `storage_path`; normal transaction code/date/month/amount/type/note edits remain valid.
- Browser runtime directly lists/inserts/updates/deletes metadata, so `authenticated` keeps exactly SELECT/INSERT/UPDATE/DELETE table privileges while RLS performs authorization; `public` and `anon` have no table grant.

Storage:

- Bucket `transaction-images` is kept private with `public = false`.
- `storage.objects` SELECT/INSERT/UPDATE/DELETE policies require bucket `transaction-images`.
- Path is parsed through `storage.foldername(name)` and the same exact five-segment helper.
- First path segment equals canonical `center_id` literally, including center IDs containing `_`.
- Second path segment is exactly `transaction-images`; year/month/filename segments must satisfy the runtime contract.
- The parsed center id must pass the same active owner/center_admin membership helper.
- UPDATE/DELETE policies remain because F23.8B replace/remove and cleanup use them; this does not change F23.11E's no-delete boundary.

All `SECURITY DEFINER` functions use `set search_path = ''` and schema-qualified sensitive relations. Execute is revoked from `public` and `anon`; only the membership helper needed by authenticated policies is granted to `authenticated`. No wildcard/public policy, email authorization or browser service role is introduced.

## Access Matrix

| Actor | Same center | Role/status | Metadata | Storage signed/read | Upload/replace/remove |
| --- | --- | --- | --- | --- | --- |
| Owner | Yes | `owner`, `active` | Allow | Allow | Allow |
| Center admin | Yes | `center_admin`, `active` | Allow | Allow | Allow |
| Teacher/consultant/viewer | Yes | active but non-finance role | Deny | Deny | Deny |
| Revoked/paused/inactive membership | Yes | non-active | Deny | Deny | Deny |
| User from other center | No | any role | Deny | Deny | Deny |
| Signed out | N/A | N/A | Deny | Deny | Deny |

Owner history access is center-wide, not restricted to rows uploaded by the owner. The app displays uploader/time from `uploaded_by_name`, `uploaded_by`, and `created_at` when available.

## Known Schema Boundary

The current repo has a metadata table helper for `transaction_attachments`, but no Supabase cashflow transaction table creation migration in this scope. Therefore the hardened migration intentionally fails local migration test until that prerequisite exists in the tested baseline/order; it must not report a false PASS. Center linkage is enforced through metadata `center_id` plus exact private Storage path. A future cloud cashflow table should add a foreign-key/transaction-center check when that table becomes the source of truth.

## Review/Apply Step

Required order, not executed in this patch:

```text
SUP-CF.1 hardened migration
→ F23.11E private staff attachment migration
→ local supabase db reset
→ static/security verification
→ migration list
→ remote dry-run
→ review
→ remote apply
```

The current checkpoint is before local reset. Do not provision membership blindly. A prerequisite failure is a migration-order/baseline review item, not permission to weaken the gate. Before any remote apply, use readonly inspection to verify the signed-in `auth.uid()`, current canonical center ID and exact `center_members.center_id`/`role`/`status` contract.

## Manual QA After Apply

1. Login as `owner.duchai@ichess.vn`.
2. Confirm runtime center id is `dreamhome_prod` when display name is `DreamHome`.
3. Open Thu chi, then `Kho anh giao dich cloud`.
4. Confirm no false deny for `dreamhome`.
5. Confirm owner can see metadata and signed images uploaded by center admin in `dreamhome_prod`.
6. Upload a staged F23.8B evidence image, save the transaction, and reopen gallery.
7. Replace/remove evidence and verify metadata/storage update only the same center.
8. Switch center and confirm previous center attachments disappear.
9. Verify teacher/consultant or revoked membership cannot list/upload/view/remove.

POLICY FIX PREPARED - AWAITING REMOTE APPLY APPROVAL

SUP-CF.1 HARDENED - READY FOR LOCAL MIGRATION TEST
