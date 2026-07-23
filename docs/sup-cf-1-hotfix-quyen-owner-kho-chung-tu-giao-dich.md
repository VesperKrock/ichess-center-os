# SUP-CF.1 - Hotfix quyen owner kho chung tu giao dich

Date: 2026-07-23

Status: policy/app patch prepared only. No remote SQL was applied. No commit/push.

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
- `public.center_members` must have the same `center_id`.
- membership `status` must be active.
- membership `role` must be `owner` or `center_admin`.

Metadata table:

- `public.transaction_attachments` RLS remains enabled.
- SELECT/INSERT/UPDATE/DELETE are scoped by `center_id`.
- `storage_bucket` must be `transaction-images`.
- `storage_path` must start with `<center_id>/transaction-images/`.
- INSERT requires `uploaded_by = auth.uid()`.

Storage:

- Bucket `transaction-images` is kept private with `public = false`.
- `storage.objects` SELECT/INSERT/UPDATE/DELETE policies require bucket `transaction-images`.
- Path is parsed through `storage.foldername(name)`.
- First path segment is treated as canonical `center_id`.
- Second path segment must be `transaction-images`.
- The parsed center id must pass the same active owner/center_admin membership helper.

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

The current repo has a metadata table helper for `transaction_attachments`, but no Supabase cashflow transaction table/migration in this scope. Therefore this patch enforces center linkage through metadata `center_id` plus private storage path prefix. A future cloud cashflow table should add a foreign-key/transaction-center check when that table becomes the source of truth.

## Review/Apply Step

After review, apply only to project `zahcfnpaprbnuqpegdmo`:

```bash
supabase db push --project-ref zahcfnpaprbnuqpegdmo
```

Alternative review path: open the migration SQL in Supabase SQL Editor for project `zahcfnpaprbnuqpegdmo`, review the policies, then run it manually.

Do not apply to another project. Do not provision membership blindly. If QA still fails after apply, first run readonly inspection for the signed-in `auth.uid()`, current `cloudStatus.centerId`, `center_members.center_id`, `role`, and `status`.

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
