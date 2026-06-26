# C4.6A - Final SQL Apply Checklist

SQL APPLIED: NO
WAITING USER CONFIRMATION BEFORE APPLYING SQL
LIVE QA T/P: NOT RUN

Use this checklist before C4.6B. Do not check items retroactively; check only when the operator has actually verified them.

## Project And Backup

- [ ] Đúng Supabase project.
- [ ] NEEDS SUPABASE PROJECT CONFIRMATION đã được xử lý.
- [ ] Environment là staging/dev, chưa claim production.
- [ ] Đã backup/export schema hoặc snapshot project nếu có.
- [ ] Đã snapshot `center_members` nếu bảng đã tồn tại.
- [ ] Đã snapshot `center_cloud_entities`.
- [ ] Đã lưu current policies và constraint allowlist.

## SQL Understanding

- [ ] Đã đọc preflight doc C4.6A.
- [ ] Đã hiểu SQL dùng cho membership / center binding.
- [ ] Đã hiểu SQL dùng cho RLS / policy.
- [ ] Đã hiểu SQL dùng cho entity allowlist `student`, `teacher`, `schedule_session`.
- [ ] Đã hiểu SQL dùng cho Supabase Realtime publication.
- [ ] Đã đọc destructive scan.
- [ ] Đã hiểu SQL không DROP TABLE / TRUNCATE / DELETE dữ liệu.
- [ ] Đã hiểu `drop policy`, `drop trigger`, `drop constraint` vẫn cần review vì có thể ảnh hưởng quyền/schema.

## Apply Order

- [ ] Step 0 - Backup / project confirmation.
- [ ] Step 1 - Preflight read-only verification.
- [ ] Step 2 - Membership table / center binding readiness.
- [ ] Step 3 - RLS/policies.
- [ ] Step 4 - Entity allowlist for `student`, `teacher`, `schedule_session`.
- [ ] Step 5 - Realtime publication / replica identity.
- [ ] Step 6 - Post-apply verification.
- [ ] Step 7 - App smoke/manual test.

## Verification Ready

- [ ] Đã chuẩn bị query verify table tồn tại.
- [ ] Đã chuẩn bị query verify columns.
- [ ] Đã chuẩn bị query verify policies.
- [ ] Đã chuẩn bị query verify allowlist.
- [ ] Đã chuẩn bị query verify realtime publication.
- [ ] Đã chuẩn bị query verify replica identity.
- [ ] Đã chuẩn bị query verify membership sample.
- [ ] Đã chuẩn bị test cross-center isolation.

## Stop Rules

- [ ] Nếu lỗi SQL thì dừng ngay.
- [ ] Không chạy step tiếp theo khi step hiện tại lỗi.
- [ ] Không tự rollback bằng `drop`, `truncate`, hoặc `delete`.
- [ ] Lưu error và hỏi review.
- [ ] Restore policies/constraint từ backup nếu cần.

## Scope Guard

- [ ] Không seed cloud 29.
- [ ] Không xóa seed 8.
- [ ] Không tạo account trong app.
- [ ] Không chạy C4.7 live QA trong C4.6B apply step.
- [ ] Không Teacher Portal.
- [ ] Không Super Admin.
- [ ] Không commit/push từ checklist này.
