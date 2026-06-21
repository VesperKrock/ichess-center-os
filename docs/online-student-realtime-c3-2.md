# C3.2 - Online Hoc vien Realtime MVP

## 1. Muc tieu C3.2

C3.2 them duong online toi thieu cho Module Hoc vien: khi user co quyen trong cung center them/sua/ngung/an ho so Hoc vien, app van luu local nhu hien tai va se upsert cloud entity `student` neu access-control C3.1 cho phep. Tab/may khac cung center co the nhan event Supabase Realtime gan realtime va merge vao local cache.

Phase nay khong lam realtime toan app va khong mo online runtime cho Giao vien, TKB, Hoc phi, attendance hay sessionReports.

## 2. Entity

Entity cloud duy nhat trong scope:

- `student`

Bang bridge hien co:

- `center_cloud_entities`

Record cloud dung `center_id`, `entity_type = 'student'`, `local_id = student.id`, va `payload` giu shape Hoc vien hien co.

## 3. Local source

Local source hien tai:

- `ichessCenterOS.students.dreamhome`

C3.2 giu nguyen shape local, bao gom:

- custom level F19A;
- `assignedTeacherId`;
- `currentStatus`;
- parent/contact fields;
- `createdAt`/`updatedAt`;
- care notes/tags;
- `isDeleted`/`deletedAt` cho soft delete.

## 4. Access-control/write guard

C3.2 bat buoc dung helper C3.1 trong `src/online-access-control.js`.

Role duoc ghi `student` khi Cloud DB ready:

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

Add student:

1. Validate form nhu hien tai.
2. Build/save local student nhu hien tai.
3. Goi `writeStudentThroughCloud(savedStudent, 'student-save')`.
4. Neu cloud fail, local data da luu duoc giu nguyen.

Edit student:

1. Update local/cache nhu hien tai.
2. Upsert dung `student` vua sua neu user co quyen.
3. Realtime echo ve sau do merge theo `student.id`, khong duplicate.

Status/soft-delete/avatar/care note:

1. Giu logic hien co.
2. Upsert lai payload `student`.
3. Khong hard delete cloud trong C3.2.

## 6. Realtime subscription

Runtime helper:

- `src/cloud-realtime-students.js`
- `subscribeToStudentCloudRealtime(...)`

Subscribe chi khoi dong khi:

- Supabase configured;
- signed-in;
- co `centerId`;
- membership doc duoc;
- access read pass;
- Supabase client co Realtime channel.

Channel loc theo `center_id = dreamhome` va app tiep tuc filter `entity_type = 'student'` truoc khi merge. Neu backend Realtime chua bat publication/filter cho `center_cloud_entities`, helper degrade an toan va bao:

`NEEDS SUPABASE REALTIME PATCH`

## 7. Merge/duplicate strategy

Realtime event duoc xu ly boi:

- `getStudentRealtimeRecord(event)`
- `mergeRealtimeStudentIntoList(students, record)`

Rule:

- `student.id` la identity chinh.
- Missing/invalid id thi skip.
- Same id thi update existing.
- New id thi them vao dau list.
- Older `updatedAt` bi skip neu local dang moi hon.
- Delete event bi skip; C3.2 khong hard delete cloud.
- Echo cua chinh local save khong tao duplicate.

Neu form edit dang mo, C3.2 merge vao cache/list nhung khong ghi de `studentFormState.values`, nen input dang go khong bi overwrite truc tiep.

## 8. Cloud not ready behavior

Khi cloud/auth/membership/readiness chua san sang:

- local flow khong crash;
- khong cloud write;
- khong retry vo han;
- Cloud DB status bao ly do ngan gon;
- docs/report ghi ro limitation.

Neu membership backend/RLS/table/function thieu:

`NEEDS MEMBERSHIP SQL PATCH`

Neu Supabase Realtime publication/filter chua san sang:

`NEEDS SUPABASE REALTIME PATCH`

## 9. Manual QA hai tab/hai may

Neu backend that da san sang:

1. Mo tab A va tab B cung app/cung center.
2. Dang nhap user co role `owner`, `qtv`, hoac `center_admin`.
3. Tab A them Hoc vien test.
4. Tab B thay Hoc vien xuat hien gan realtime, khong can bam pull.
5. Tab A sua status/ghi chu Hoc vien.
6. Tab B thay update, khong duplicate.

Read-only/no membership:

1. Dang nhap viewer/no membership.
2. Thu them/sua Hoc vien.
3. Local flow khong crash.
4. Khong co cloud write.

Neu backend chua bat Realtime, manual QA realtime la NOT RUN va can patch Supabase Realtime.

## 10. Non-scope

- Chua realtime toan app.
- Chua realtime Giao vien.
- Chua realtime TKB.
- Chua realtime Hoc phi.
- Chua realtime attendance/sessionReports.
- Chua auth UI day du.
- Chua SQL.
- Chua reset data.
- Chua production center.
