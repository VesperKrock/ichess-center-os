# C7.8H - Owner account management final polish

C7.8H STATUS: OWNER ACCOUNT MANAGEMENT FINAL POLISH
DEV_COPY_REMOVED_FROM_OWNER_UI: YES
OWNER_FACING_COPY_ADDED: YES
BUTTON_HOVER_AFFORDANCE_POLISHED: YES
BUTTON_DISABLED_AFFORDANCE_POLISHED: YES
REVOKE_MODAL_COPY_POLISHED: YES
RESTORE_MODAL_COPY_POLISHED: YES
DREAMHOME_PRODUCT_COPY_PROTECTED: YES
PHONGTRONG_LIVE_REVOKE_RESTORE_PRESERVED: YES
DREAMHOME_LIVE_REVOKE_RESTORE_ENABLED: NO
RESET_PASSWORD_FLOW_PRESERVED: YES
CREATE_ADMIN_FLOW_PRESERVED: YES
COPY_EMAIL_FLOW_PRESERVED: YES
INPUT_FOCUS_FIX_PRESERVED: YES
SCROLL_JUMP_FIX_PRESERVED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
LIVE_REVOKE_INVOKED_BY_CODEX: NO
LIVE_RESTORE_INVOKED_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Context

C7.8H is the final owner-facing polish pass after C7.8G wired controlled live revoke/restore for Phong Trong. The revoke and restore logic stays intentionally narrow: only `phongtrong_prod` is enabled for live UI actions, while DreamHome and every other center remain protected.

## User-Reported Issue

The account management panel worked, but some visible copy still read like development notes: phase names, safety-gate wording, request internals, and implementation details. Those strings are not useful for anh Hai during real operation.

## Copy Polish

The Owner Account UI now uses product-facing language:

- `Đã bật cho cơ sở này`
- `Chưa bật thao tác thật`
- `Thao tác bảo mật đã được bật cho cơ sở này.`
- `Thao tác thu hồi quyền cho cơ sở này chưa được bật.`
- `Tài khoản đăng nhập vẫn tồn tại, chỉ quyền tại cơ sở này bị thu hồi.`
- `Khôi phục quyền sẽ cho admin truy cập lại cơ sở này.`

The UI no longer shows phase codes, safety-gate labels, request internals, or local snapshot wording in the owner-facing account management flow.

## Button Polish

Account action buttons and modal buttons now have clearer enabled, hover, focus-visible, active, and disabled states. Revoke has a danger treatment, restore has a success treatment, and secondary actions remain visually quieter.

## Logic Preserved

Preserved flows:

- List center admin account status.
- Create admin for active production centers without admin.
- Reset temporary password and one-time handoff.
- Copy admin email.
- Revoke access for `phongtrong_prod` only.
- Restore access for `phongtrong_prod` only.
- DreamHome protected from live revoke/restore.
- Input focus hotfix.
- Scroll jump fix.

## Manual QA Checklist

1. Reload app and login as owner.
2. Open Internal Center Console.
3. Confirm Owner Account UI does not show development copy such as phase names, safety gate wording, request internals, or snapshot wording.
4. Hover and click account buttons: create admin, reset password, revoke, restore, copy email, cancel, and confirm.
5. Confirm disabled buttons look disabled and do not imply they are clickable.
6. Test Phong Trong revoke with `REVOKE`.
7. Confirm card moves to `Đã thu hồi quyền` and shows `Khôi phục quyền`.
8. Test Phong Trong restore with `RESTORE`.
9. Confirm DreamHome remains protected and uses product-facing copy.
10. Confirm reset password, copy email, input focus, and scroll behavior still work.

## Recommendation

After final manual QA passes, commit and push the whole C7.8E-H checkpoint together.
