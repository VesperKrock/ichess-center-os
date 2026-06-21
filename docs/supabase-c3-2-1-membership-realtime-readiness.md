# C3.2.1 - Membership / Realtime Readiness

## 1. Summary

C3.2 code guarded da san sang o muc runtime: `src/cloud-realtime-students.js` chi upsert va subscribe entity `student`, dung access-control C3.1, merge theo `student.id`, va degrade an toan khi cloud/realtime chua san sang.

Live realtime can xac minh Supabase membership/RLS/realtime truoc khi claim production-ready:

- NEEDS MEMBERSHIP SQL PATCH: YES
- NEEDS SUPABASE REALTIME PATCH: YES

Ly do: repo co code/doc tham chieu `center_members`, nhung cac SQL docs hien co chua tao/verify day du bang membership voi field `status`, RLS rieng cho membership, va policy role-aware. Repo cung chua co patch bat publication Supabase Realtime cho `center_cloud_entities`.

## 2. Audit scope

Da inspect:

- `src/cloud-realtime-students.js`
- `src/online-access-control.js`
- `src/cloud-db-sync.js`
- `src/cloud-db-entities.js`
- `src/supabase-auth.js`
- `src/main.js`
- `docs/online-collaboration-architecture-c3-0.md`
- `docs/online-access-control-c3-1.md`
- `docs/online-student-realtime-c3-2.md`
- `docs/supabase-c1-cloud-db-foundation.sql`
- `docs/supabase-c2-2-cloud-db-permissions-fix.sql`
- F19H.2 allowlist SQL docs

Ghi chu: `src/cloud-db.js` khong ton tai trong repo hien tai; runtime cloud nam o `src/cloud-db-sync.js` va `src/cloud-db-entities.js`.

## 3. Required backend pieces

C3.2 Online Hoc vien realtime MVP can:

1. Supabase Auth configured.
2. Current user session.
3. Current centerId, hien runtime dang dung `dreamhome`.
4. Membership source: `center_members`.
5. Membership fields toi thieu:
   - `user_id`
   - `center_id`
   - `role`
   - `status`
   - `created_at`
   - `updated_at`
6. RLS policy de user chi doc membership cua minh.
7. RLS policy de user chi doc/ghi `center_cloud_entities` thuoc center minh co quyen.
8. Entity allowlist co `student`.
9. Realtime enabled cho table bridge `center_cloud_entities`.
10. Runtime filter theo center va `entity_type = student`.

## 4. Membership readiness

NEEDS MEMBERSHIP SQL PATCH: YES

Bang chung trong repo:

- `src/supabase-auth.js` doc `center_members` bang `center_id`, `user_id`, `role`.
- `src/cloud-db-sync.js` dung `getCurrentCenterMembership` truoc khi Cloud DB ready.
- `docs/supabase-c1-cloud-db-foundation.sql` va `docs/supabase-c2-2-cloud-db-permissions-fix.sql` tham chieu `center_members`.
- Chua thay SQL tao/verify `public.center_members` voi role/status/index/RLS day du.
- `docs/supabase-s5-user-profiles.sql` co `alter table public.center_members`, nen no cung phu thuoc bang nay da ton tai.

Patch plan can:

- Tao/verify `public.center_members`.
- Them field `role`, `status`, `created_at`, `updated_at` neu thieu.
- Tao unique/index theo `(center_id, user_id)` va index theo `user_id`.
- Enable RLS.
- Policy read membership cua chinh user.
- Helper `public.is_center_member(center_id)` chi tinh active membership.
- Helper `public.can_write_center(center_id)` chi cho `owner`, `qtv`, `center_admin`.
- RLS `center_cloud_entities` doc theo active membership, ghi theo write role.
- Khong hardcode email ca nhan.
- Khong pha data hien co.

## 5. Realtime readiness

NEEDS SUPABASE REALTIME PATCH: YES

Bang chung trong repo:

- `src/cloud-realtime-students.js` da subscribe `postgres_changes` tren `center_cloud_entities` va filter `center_id=eq.<centerId>`.
- Runtime tiep tuc validate `entity_type = 'student'`.
- Chua thay SQL/doc nao bat publication `supabase_realtime` cho `public.center_cloud_entities`.
- Chua thay `replica identity` plan cho UPDATE payload trong realtime.

Patch plan can:

- Enable Realtime publication cho `public.center_cloud_entities`.
- Dat replica identity neu can de UPDATE/old row support tot hon.
- Giu RLS la lop bao ve chinh.
- Giu client filter theo center va app-level filter `entity_type = student`.
- Khong expose cross-center data.

## 6. Entity allowlist

Entity allowlist student: READY IN REPO

Bang chung:

- `src/cloud-db-entities.js` co `CLOUD_ENTITY_TYPES.STUDENT = 'student'`.
- `docs/supabase-c1-cloud-db-foundation.sql` co check constraint `entity_type in ('student', 'teacher', 'class_session')`.
- `docs/supabase-c2-2-cloud-db-permissions-fix.sql` cung co `student`.
- C3.2.1 khong mo them entity nao khac.

## 7. RLS / cross-center isolation

RLS/cross-center isolation: PARTIAL / NEEDS LIVE VERIFY

Da co trong repo:

- `center_cloud_entities` policy dung membership theo `center_id`.
- C2.2 co helper `public.is_center_member(requested_center_id)`.

Can patch/verify:

- `center_members` phai co RLS doc membership cua chinh user.
- Helper membership nen loc `status = 'active'`.
- Write policy nen gioi han role `owner`, `qtv`, `center_admin`, khong chi la bat ky member.
- Manual QA Test D phai xac minh center A khong thay data center B.

## 8. Manual QA plan

### Test A - Hai tab cung user

1. Dang nhap user co role `center_admin`, `owner`, hoac `qtv`.
2. Mo tab A va tab B cung app/cung center.
3. Tab A them Hoc vien test.
4. Tab B thay Hoc vien moi khong can bam pull.
5. Console khong co runtime crash.
6. Khong duplicate khi realtime echo ve.

### Test B - Hai tai khoan

1. Tai khoan A co quyen ghi center.
2. Tai khoan B co quyen doc/ghi cung center.
3. A them/sua Hoc vien.
4. B thay update realtime.
5. B sua lai mot field khac va A thay update.

### Test C - Viewer/read-only

1. Dang nhap tai khoan `viewer` hoac no membership.
2. Thu them/sua Hoc vien.
3. Khong cloud write.
4. App khong crash.
5. Co ly do read-only trong Cloud DB/status hoac report.

### Test D - Cross-center isolation

1. User center A them Hoc vien.
2. User center B khong thay Hoc vien center A.
3. QTV neu co nhieu center chi thay data khi chon dung center.
4. Realtime event center A khong lam thay doi local cache center B.

## 9. Go / no-go for C3.3

C3.3 nen lam sau khi C3.2 live readiness duoc xu ly hoac it nhat patch plan ro.

Co the lam C3.3 guarded song song ve mat code, nhung rui ro la role/RLS/realtime live chua du se lam ket qua test online bi nhieu false negative. Neu lam song song, phai tiep tuc giu scope guarded va khong claim production realtime pass khi manual QA chua chay.

## 10. Non-scope C3.2.1

- Khong chay SQL.
- Khong apply SQL patch.
- Khong sua data Supabase.
- Khong sua localStorage.
- Khong tao production center.
- Khong reset Angel Wings.
- Khong mo realtime sang Giao vien/TKB/Hoc phi/attendance.
- Khong hardcode email thanh quyen.
- Khong commit/push.
