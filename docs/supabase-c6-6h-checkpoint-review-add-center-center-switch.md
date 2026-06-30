# C6.6H - Checkpoint review Add Center + Center Switch

C6.6H STATUS: CHECKPOINT REVIEW ADD CENTER CENTER SWITCH
C6_6A_STATUS: PASS
C6_6B_STATUS: PASS
C6_6C_STATUS: PASS
C6_6D_STATUS: PASS
C6_6D_1_STATUS: PASS
C6_6E_STATUS: PASS
C6_6F_STATUS: PASS
C6_6G_STATUS: PASS
C6_6E_MANUAL_QA: PASS
C6_6G_MANUAL_QA: PASS
ADD_CENTER_FLOW_WORKING: YES
OWNER_CENTER_SWITCH_WORKING: YES
PHONG_TRONG_CREATED_BY_USER: YES
PHONG_TRONG_OPENED_BY_OWNER: YES
PHONG_TRONG_CENTER_ID: phongtrong_prod
PHONG_TRONG_SLUG: phongtrong
PHONG_TRONG_ENVIRONMENT: production
PHONG_TRONG_STATUS: active
DREAMHOME_STILL_AVAILABLE: YES
PRODUCTION_STAGING_SEPARATION_PRESERVED: YES
ANGEL_WINGS_CLONED_TO_PHONG_TRONG: NO
STAGING_STUDENTS_COPIED_TO_PHONG_TRONG: NO
OWNER_ONLY_INTERNAL_CONSOLE: YES
CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO
SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO
CENTER_SWITCH_IS_ACTING_MODE: NO
ACTING_MODE_IMPLEMENTED: NO
ACTING_MODE_DEFERRED_TO_C7_4: YES
ADMIN_ACCOUNT_CREATION_IMPLEMENTED: NO
TEACHER_ACCOUNT_CREATION_IMPLEMENTED: NO
ACCOUNT_MANAGEMENT_DEFERRED_TO_C7: YES
MODULE_6_TEACHER_BUTTON_REUSE_RECOMMENDED: YES
INTERNAL_CONSOLE_WIDTH_POLISH_REQUESTED: YES
INTERNAL_CONSOLE_WIDTH_POLISH_BLOCKER: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
RPC_CALLED_BY_CODEX: NO
AUTH_USER_CREATED_BY_CODEX: NO
CENTER_CREATED_BY_CODEX: NO
MEMBERSHIP_CREATED_BY_CODEX: NO
RUNTIME_CHANGE_NEW_IN_C6_6H: NO
READY_FOR_C6_6I_COMMIT_PUSH: YES
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.6H

C6.6H là checkpoint review cho toàn bộ Add Center + Owner Center Switch sau C6.6A đến C6.6G PASS. Phase này chỉ tổng hợp docs/test, xác nhận manual QA và chuẩn bị C6.6I commit/push.

## 2. Trạng thái trước checkpoint

Latest commit vẫn là `059d666 C6.5 internal center console checkpoint`. C6.6 chưa commit/push. Worktree hiện có docs/tests/sql của C6.6A-G và runtime thay đổi đã được kiểm ở C6.6E/F/G.

## 3. Tổng hợp C6.6A

C6.6A chốt thiết kế owner chỉ nhập một field `Tên cơ sở`; hệ thống tự sinh slug compact không dấu không gạch ngang, center_id `<slug>_prod`, environment `production`, status `active`. Empty center không clone DreamHome, không clone Angel Wings, không copy staging students.

## 4. Tổng hợp C6.6B

C6.6B chuẩn bị read-only inspection SQL và manual apply RPC template cho `provision_center_for_owner(p_center_name)`. RPC design dùng helper slug compact và guard owner qua session/membership, không frontend direct insert vào `centers` hoặc `center_members`.

## 5. Tổng hợp C6.6C

C6.6C đưa RPC template vào trạng thái decision READY. User apply thủ công trong Supabase; CodeX không chạy SQL. Verify helper slug PASS với các case Gò Vấp, Phú Nhuận, Thủ Đức, Quận 12, Bình Thạnh, iChess Gò Vấp 2.

## 6. Tổng hợp C6.6D

C6.6D tạo post-apply verification và controlled RPC test pack. SQL Editor auth.uid() limitation được ghi rõ; nếu SQL Editor không có session owner thì không bỏ owner guard để test.

## 7. Tổng hợp C6.6D.1

C6.6D.1 đổi target controlled test từ Gò Vấp sang Phòng Trống để tránh chiếm slug/cơ sở thật trong tương lai. Target chuẩn: Phòng Trống / `phongtrong` / `phongtrong_prod`.

## 8. Tổng hợp C6.6E

C6.6E implement runtime form Thêm cơ sở trong Internal Center Console: owner-only, một field visible `Tên cơ sở`, preview slug/center_id/environment/status, gọi `supabase.rpc('provision_center_for_owner', { p_center_name })` khi user bấm, có loading/success/error và refresh centers list sau success.

## 9. Tổng hợp C6.6F

C6.6F ghi nhận Phòng Trống được tạo thành công, polish bỏ các dòng mô tả dài trong Internal Console/Add Center form, giữ form/list và thiết kế đường vào cơ sở cho C6.6G. Account/admin/teacher panel tiếp tục defer.

## 10. Tổng hợp C6.6G

C6.6G implement action `Mở OS cơ sở` trên centers list, owner-only + active membership guard, switch active center context, cập nhật `cloudStatus`, đổi namespace localStorage, reload empty production fallback, reset bootstrap/realtime cũ và pull/start lại theo center mới. `isProductionCenter` nhận production center mới dạng `*_prod`.

## 11. Manual QA C6.6E PASS

Manual QA C6.6E PASS theo user: Phòng Trống đã được tạo thành công với `center_id = phongtrong_prod`, `slug = phongtrong`, `environment = production`, `status = active`. Internal Console list có DreamHome và Phòng Trống.

## 12. Manual QA C6.6G PASS

Manual QA C6.6G PASS theo user: owner switch được sang Phòng Trống, Phòng Trống là current center, Internal Console hiển thị DreamHome có action `Mở OS cơ sở` và Phòng Trống hiển thị `Đang mở`.

## 13. Add Center flow current behavior

Add Center hiện là owner-only trong Internal Center Console. Runtime không direct insert; chỉ gọi RPC khi owner submit form. CodeX không gọi RPC, không tạo center, không tạo membership.

## 14. Owner center switch current behavior

Owner center switch yêu cầu chính user có active membership của center production/active. Center switch không giả lập người khác, không đổi vai trò sang center_admin và không bypass permission.

## 15. Phòng Trống current state

Phòng Trống hiện được ghi nhận là `phongtrong_prod` / `phongtrong` / `production` / `active`, tạo bởi user manual QA và mở được bởi owner. Expected data là production empty center, không lẫn Angel Wings hoặc staging students.

## 16. DreamHome current state

DreamHome / `dreamhome_prod` vẫn available trong production/active list và vẫn là cơ sở production hiện hữu. Owner có thể mở lại DreamHome bằng action `Mở OS cơ sở`.

## 17. Production/staging separation

Internal Console mặc định chỉ list `environment = production` và `status = active`, nên staging `dreamhome` ẩn mặc định. Phòng Trống không clone DreamHome staging, không copy Angel Wings, không copy 29 học viên staging.

## 18. Data safety / no clone / no Angel Wings copy

CodeX không chạy SQL, không gọi Supabase action, không gọi RPC, không tạo center/user/membership. Runtime C6.6G reload production empty fallback để tránh sample seed cho `phongtrong_prod`.

## 19. Account/admin/teacher model deferred C7

Admin cơ sở không nên tạo giáo viên global. Owner/anh Hải tạo giáo viên; giáo viên có thể được phân vào nhiều cơ sở; mỗi cơ sở chỉ thấy giáo viên được phân vào cơ sở đó; center_admin chỉ thuộc một cơ sở. Teacher/admin account management defer C7.

## 20. Module 6 teacher button future note

Nút tạo giáo viên hiện tại trong Module 6 không xóa ngay ở C6. Tương lai C7 nên tái chế theo quyền: owner tạo giáo viên global và phân giáo viên vào cơ sở; center_admin xem giáo viên được phân vào cơ sở, không tạo giáo viên global.

## 21. UI width polish follow-up

User muốn Internal Console/table rộng hơn. Đây là UI polish follow-up, không phải blocker logic cho C6.6H. Có thể làm ở C6.6J polish hoặc C8 product polish.

## 22. Risk list

- Owner thiếu active membership ở center mới thì switch phải bị chặn.
- Production empty center có seed/demo data thì cần NEEDS REVIEW/hotfix.
- Nếu table hẹp gây khó dùng thì xử lý polish sau, không chặn checkpoint.
- Account/admin/teacher model chưa mở; cần giữ defer C7 để tránh lẫn scope.

## 23. Recommendation C6.6I commit/push

C6.6H sẵn sàng đề xuất sang C6.6I commit/push nếu full smoke/build/diff pass và user xác nhận scope C6.6A-H. Sau C6.6I, C6.6 có thể coi là DONE.

## 24. PASS / NEEDS REVIEW criteria

PASS khi C6.6A-G được tổng hợp đầy đủ, manual QA C6.6E/G PASS được ghi nhận, Phòng Trống created/opened đúng, DreamHome vẫn available, production/staging separation preserved, không clone Angel Wings/staging students, Internal Console owner-only preserved, center switch không phải acting mode, account/admin/teacher defer C7, Module 6 future note rõ, UI width polish noted not blocker, không SQL/Supabase/RPC/user/center/membership bởi CodeX, không runtime mới trong C6.6H, smokes/build/diff pass, không commit/push.

NEEDS REVIEW nếu phát hiện runtime blocker, scope lẫn C7/account/acting mode, hoặc không chứng minh được trạng thái Phòng Trống/manual QA.
