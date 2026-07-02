# C7.8 hotfix - Mat focus input toan app

C7.8 HOTFIX STATUS: INPUT FOCUS LOSS FIX
INPUT_FOCUS_LOSS_CONFIRMED: YES
ROOT_CAUSE_IDENTIFIED: YES
FULL_RENDER_LOOP_FIXED_OR_GUARDED: YES
TEXT_EDITING_FOCUS_PROTECTED: YES
CLOCK_TASKBAR_REGRESSION: NO
ACCOUNT_MANAGEMENT_REGRESSION: NO
RESET_PASSWORD_FLOW_REGRESSION: NO
CREATE_ADMIN_GUARD_REGRESSION: NO
SCROLL_JUMP_FIX_PRESERVED: YES
SUPABASE_MUTATION_ADDED: NO
EDGE_FUNCTION_CHANGED: NO
RUNTIME_UI_CHANGE: YES
COMMIT: NOT RUN
PUSH: NOT RUN

## Boi canh

Sau C7.8 owner account management UI, QA phat hien khi mo form trong module Hoc vien va click vao input, caret chi hien mot nhip roi mat. Trieu chung xay ra tren nhieu module co form, khong rieng Hoc vien.

## Root cause found

`src/main.js` dung `render()` de thay toan bo `app.innerHTML`. Clock/taskbar khong phai thu pham truc tiep vi `setInterval(updateClock, 1000)` chi cap nhat `#taskbar-clock.textContent`.

Root cause la cac callback nen nhu Supabase auth/cloud/realtime/status va C7.8 account status cung goi `render()`. Khi mot callback hoan tat trong luc nguoi dung dang focus `input`, `textarea`, `select` hoac `contenteditable`, DOM cua form bi replace, active element cu bi huy va caret bien mat.

## Patch summary

- Them `isTextEditingElement()` de nhan dien `input`, `textarea`, `select`, va `contenteditable`.
- Them guard o dau `render()` de defer full render khi user dang edit text.
- Them `pendingTextEditingRender` de khong mat render nen; render bi hoan se duoc flush sau `focusout` hoac `change`.
- Giu nguyen `updateClock()` cap nhat rieng bang `textContent`, khong goi full render moi giay.
- Khong sua business logic Hoc vien, Giao vien, TKB, Thu chi.
- Khong sua Edge Functions, SQL, Supabase mutate, deploy, commit, push.

## Vi sao khong pha C7.8

Internal Center Console va account management van dung cung state/render hien co. Khi khong focus field nhap lieu, render van chay binh thuong. Khi dang focus field, render nen chi bi hoan den luc roi field, nen reset password handoff, create admin guard, account status panel, va scroll preservation khong bi tat.

Scroll jump fix C7.8C.1 van duoc giu vi `rememberPreservedScrollPositions()` va `restorePreservedScrollPositions()` khong doi. Account action buttons van `preventDefault()` va `stopPropagation()`.

## Manual QA checklist

- Hoc vien: mo `+ Them hoc vien`, click input ho ten, go it nhat 10 ky tu, doi 5 giay, caret va text van con.
- Date input: click ngay sinh, nhap/chon ngay, focus khong bien mat ngay.
- Textarea/select: go textarea va mo select, khong mat focus bat thuong.
- Module khac: test nhanh Giao vien, Thoi khoa bieu hoac Thu chi co input.
- Internal Center Console: mo `#/internal/centers`, account panel van hien, reset confirm van mo, create admin guard van dung, scroll khong nhay.

## Test/build result

- Hotfix smoke: PASS.
- C7.8D smoke: PASS.
- C7.8C.1 smoke: PASS.
- C7.8C smoke: PASS.
- C7.8B smoke: PASS.
- C7.8A smoke: PASS.
- `npm run build`: PASS, chi co warning chunk lon san co cua Vite.
- `git diff --check`: PASS.
- Mojibake targeted scan: PASS, khong co match.

## Known limitation

Neu co realtime/cloud update den dung luc user dang go trong form, UI nen se doi den khi user roi field moi ve lai. Du lieu state van duoc cap nhat; muc tieu la khong replace DOM form khi caret dang nam trong field nhap lieu.
