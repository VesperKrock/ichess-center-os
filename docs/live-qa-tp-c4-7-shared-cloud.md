# C4.7 - Live QA T/P Shared Cloud Data

## Summary

C4.7 la manual live QA cho T/P shared cloud data sau khi user da chay C4.6B SQL trong Supabase SQL Editor va verify duoc ky vong pass.

LIVE QA T/P: READY TO RUN
LIVE QA T/P: NOT RUN YET
SQL APPLIED BY USER: YES, VERIFY EXPECTED PASS

C4.7 khong chay SQL, khong apply patch Supabase, khong seed cloud 29 bang script, khong commit/push. Live pass chi duoc claim sau khi checklist manual that su chay xong.

## Preconditions

- [ ] `npm run dev` dang chay.
- [ ] Mo app tai `http://localhost:5173/ichess-center-os/`.
- [ ] Supabase project dung: `ichess-center-os`.
- [ ] Supabase ref dung: `zahcfnpaprbnuqpegdmo`.
- [ ] C4.6B SQL da duoc user chay trong Supabase SQL Editor.
- [ ] C4.6B verify expected pass.
- [ ] Co it nhat 2 tai khoan Supabase thuoc center `dreamhome`.
- [ ] Khong chay SQL trong C4.7.
- [ ] Khong seed cloud 29 bang script.

## Expected Backend State

Sau C4.6B, ky vong backend:

| Area | Expected |
| --- | --- |
| Project | `ichess-center-os` |
| Ref | `zahcfnpaprbnuqpegdmo` |
| center | `dreamhome` |
| center_cloud_entities total | 39 |
| `student` | 29 |
| `teacher` | 6 |
| `class_session` | 4 |
| `schedule_session` | 0 |
| `center_members` | 3 |
| roles | owner / owner / admin |
| entity_type_check | student, teacher, class_session, schedule_session |
| realtime publication | `center_cloud_entities` present |
| replica identity | FULL |

## Data Change Rule

Neu can tao/sua du lieu de test, chi thao tac qua UI app.

- Bat buoc dung prefix `QA C4.7`.
- Khong dung script.
- Khong seed cloud 29.
- Khong xoa du lieu that.
- Khong sua role/member/Auth users.
- Neu khong muon tao record moi, ghi `NOT RUN` cho write test.

## Manual QA Checklist

### Test A - Signed-out gate

Chrome thuong hoac an danh:

- [ ] Mo `http://localhost:5173/ichess-center-os/`.
- [ ] Khi chua dang nhap chi thay Login Portal.
- [ ] Khong thay dashboard/module grid.
- [ ] Khong co Dang ky.

### Test B - T/P cung cloud data

- [ ] T dang nhap bang Chrome thuong.
- [ ] P dang nhap bang tab an danh hoac trinh duyet/may khac.
- [ ] Ca hai tai khoan thuoc center `dreamhome`.
- [ ] Ca hai vao `Co so: DreamHome`.
- [ ] Ca hai thay dashboard 13 module.
- [ ] Ca hai thay `Du lieu: Cloud` hoac trang thai cloud khong loi.
- [ ] Module Hoc vien: ca hai thay 29 hoc vien.
- [ ] Module Giao vien: ca hai thay 6 giao vien.
- [ ] Module Thoi khoa bieu khong crash khi `schedule_session` cloud dang 0.
- [ ] Khong ben nao roi ve seed 8.

### Test C - Student write-through / realtime nhe

Chi chay neu user dong y data change qua UI:

- [ ] T them hoc vien test ten `QA C4.7 Hoc vien`.
- [ ] P thay record moi qua realtime hoac sau reload.
- [ ] T/P xac nhan count tang dung.
- [ ] Khong duplicate.

Neu khong muon tao record moi:

- [ ] Chi edit mot ghi chu QA tren record test neu co.
- [ ] Hoac bo qua write test va ghi `NOT RUN`.

### Test D - Teacher write-through / realtime nhe

- [ ] Chi edit truong nhe/an toan hoac ghi chu neu UI co.
- [ ] Dung prefix `QA C4.7`.
- [ ] T/P thay update realtime hoac sau reload.
- [ ] Khong duplicate.
- [ ] Neu khong co record test phu hop, ghi `NOT RUN`.

### Test E - Schedule_session

Vi cloud dang co `schedule_session: 0` truoc khi test:

- [ ] Mo Module Thoi khoa bieu.
- [ ] App khong crash.
- [ ] Neu tao lich test qua UI, dung ten/ly do co prefix `QA C4.7`.
- [ ] P thay lich test realtime hoac sau reload neu write-through hoat dong.
- [ ] Neu khong tao lich test, ghi `NOT RUN`.

### Test F - Reload persistence

- [ ] Reload Chrome thuong.
- [ ] Reload an danh.
- [ ] Du lieu van giong nhau.
- [ ] Khong quay ve seed 8.
- [ ] Cloud/cache status khong claim sai neu backend mat ket noi.

### Test G - Logout

- [ ] T bam Start -> Dang xuat.
- [ ] App quay lai Login Portal.
- [ ] Dashboard an.
- [ ] P van dang dang nhap khong bi anh huong.

## Pass / Fail Table

| Test | Status | Evidence / Note |
| --- | --- | --- |
| A - Signed-out gate | NOT RUN | |
| B - T/P same cloud data | NOT RUN | |
| C - Student write/realtime | NOT RUN | |
| D - Teacher write/realtime | NOT RUN | |
| E - Schedule_session | NOT RUN | |
| F - Reload persistence | NOT RUN | |
| G - Logout | NOT RUN | |

Allowed statuses: `PASS`, `FAIL`, `NOT RUN`, `BLOCKED`.

## Known Limitations

- `schedule_session` cloud count is expected to be 0 before QA creates any schedule test record.
- Realtime may need reload if the browser subscription is not active yet.
- C5 will handle attendance/hoc phi; C4.7 does not test attendance or tuition cloud source of truth.
- C4.7 live pass cannot be claimed until the manual checklist is completed.

## C4.8 Handoff

After C4.7 manual QA:

- If all critical tests pass, C4.8 can document live QA result and cleanup QA notes.
- If write-through/realtime fails but reload works, C4.8 should triage realtime status before expanding scope.
- If counts diverge or seed 8 appears, stop and investigate bootstrap/cache before any C5 work.
