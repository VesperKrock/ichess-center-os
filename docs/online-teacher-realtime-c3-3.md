# C3.3 - Online Giao vien Realtime MVP

## 1. Muc tieu C3.3

C3.3 them duong online toi thieu cho Module Giao vien theo pattern C3.2 Hoc vien: khi user co quyen trong cung center them/sua/ngung day giao vien, app van luu local nhu hien tai va se upsert cloud entity `teacher` neu access-control C3.1 cho phep. Tab/may khac cung center co the nhan event Supabase Realtime gan realtime va merge vao local cache khi backend da san sang.

Phase nay khong lam realtime toan app va khong mo online runtime cho TKB, Hoc phi, attendance hay sessionReports.

## 2. Entity

Entity cloud duy nhat trong scope:

- `teacher`

Bang bridge hien co:

- `center_cloud_entities`

Record cloud dung `center_id`, `entity_type = 'teacher'`, `local_id = teacher.id`, va `payload` giu shape Giao vien hien co.

## 3. Local source

Local source hien tai:

- `ichessCenterOS.teachers.dreamhome`

C3.3 giu nguyen shape local, bao gom:

- `teacherType`;
- `status`;
- full-time/part-time/collaborator;
- teaching groups/modes;
- availability;
- strengths/internal tags;
- assigned class/student fields;
- `createdAt`/`updatedAt`;
- inactive/paused logic.

C3.3 khong ghi nguoc student assignment va khong doi shape tuy tien.

## 4. Access-control/write guard

C3.3 bat buoc dung helper C3.1 trong `src/online-access-control.js`.

Role duoc ghi `teacher` khi Cloud DB ready:

- `owner`
- `qtv`
- `center_admin`

Role bi chan cloud write:

- signed-out/no user;
- missing center;
- missing membership;
- `viewer`;
- `teacher`;
- `consultant`;
- `none`;
- `unknown`.

Neu access fail, app chi luu local nhu cu, khong goi upsert cloud va khong fake quyen.

## 5. Add/edit/status write-through

Add teacher:

1. Validate form nhu hien tai.
2. Build/save local teacher nhu hien tai.
3. Goi `writeTeacherThroughCloud(savedTeacher, 'teacher-save')`.
4. Neu cloud fail, local data da luu duoc giu nguyen.

Edit teacher:

1. Update local/cache nhu hien tai.
2. Upsert dung `teacher` vua sua neu user co quyen.
3. Realtime echo ve sau do merge theo `teacher.id`, khong duplicate.

Status/ngung day:

1. Giu logic hien co: chuyen `status` sang `inactive`.
2. Upsert lai payload `teacher`.
3. Khong hard delete cloud trong C3.3.

## 6. Realtime subscription

Runtime helper:

- `src/cloud-realtime-teachers.js`
- `subscribeToTeacherCloudRealtime(...)`

Subscribe chi khoi dong khi:

- Supabase configured;
- signed-in;
- co `centerId`;
- membership doc duoc;
- access read pass;
- Supabase client co Realtime channel.

Channel loc theo current `center_id` va app tiep tuc filter `entity_type = 'teacher'` truoc khi merge. Neu backend Realtime chua bat publication/filter cho `center_cloud_entities`, helper degrade an toan va bao:

`NEEDS SUPABASE REALTIME PATCH`

## 7. Merge/duplicate strategy

Realtime event duoc xu ly boi:

- `getTeacherRealtimeRecord(event)`
- `mergeRealtimeTeacherIntoList(teachers, record)`

Rule:

- `teacher.id` la identity chinh.
- Missing/invalid id thi skip.
- Same id thi update existing.
- New id thi them vao dau list.
- Older `updatedAt` bi skip neu local dang moi hon.
- Delete event bi skip; C3.3 khong hard delete cloud.
- Echo cua chinh local save khong tao duplicate.

Neu form edit dang mo, C3.3 merge vao cache/list nhung khong ghi de `teacherFormState.values`, nen input dang go khong bi overwrite truc tiep.

## 8. Cloud not ready behavior

Khi cloud/auth/membership/readiness chua san sang:

- local flow khong crash;
- khong cloud write;
- khong retry vo han;
- Cloud DB status bao ly do ngan gon;
- docs/report ghi ro limitation.

Vi C3.2.2 van chua apply SQL va van can review/xac nhan live Supabase:

`NEEDS MEMBERSHIP SQL PATCH`

`NEEDS SUPABASE REALTIME PATCH`

`NEEDS SUPABASE CONFIRMATION`

## 9. Manual QA hai tab/hai may

Neu backend that da san sang:

1. Mo tab A va tab B cung app/cung center.
2. Dang nhap user co role `owner`, `qtv`, hoac `center_admin`.
3. Tab A them Giao vien test.
4. Tab B thay Giao vien xuat hien gan realtime, khong can bam pull.
5. Tab A sua thong tin hoac ngung day Giao vien.
6. Tab B thay update, khong duplicate.

Hai browser/tai khoan:

1. Browser A dang nhap tai khoan co quyen.
2. Browser B dang nhap tai khoan co quyen cung center.
3. A them/sua/ngung day Giao vien.
4. B thay update gan realtime.

Read-only/no membership:

1. Dang nhap viewer/no membership.
2. Thu them/sua Giao vien.
3. Local flow khong crash.
4. Khong co cloud write.

Neu backend chua bat Realtime, manual QA realtime la NOT RUN va can patch Supabase Realtime.

## 10. Non-scope

- Chua realtime toan app.
- Chua realtime TKB.
- Chua realtime Hoc phi.
- Chua realtime attendance/sessionReports.
- Chua auth UI day du.
- Chua SQL apply.
- Chua reset data.
- Chua production center.
