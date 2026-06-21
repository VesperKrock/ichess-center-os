# C3.4A - Audit/Bridge class_session vs schedule_session

## 1. Summary

C3.4A chi audit/bridge truoc khi bat TKB realtime. Phase nay chua bat TKB realtime runtime, chua tao helper realtime schedule, khong chay SQL, khong apply SQL patch va khong sua du lieu local/cloud.

Muc tieu la chon dung day du lieu cho C3.4B: `class_session` la ca/lop hoc core C2 da sync cloud, con `schedule_session` moi la lich/TKB van hanh chi tiet nhung hien van la dry-run/design F19H.2d.

## 2. Current Module 7/TKB local model

Module 7/TKB doc/ghi local source:

```txt
ichessCenterOS.schedule.dreamhome
```

Repo source:

- `src/storage.js`: `SCHEDULE_KEY`, `getStoredSchedule`, `saveStoredSchedule`, `normalizeScheduleSessions`.
- `src/main.js`: `scheduleSessions = getStoredSchedule(sampleScheduleSessions)`.
- `src/schedule-module.js`: form add/edit/delete build va render `scheduleSessions`.

Fields chinh cua schedule item hien tai:

- `id`
- `scheduleType`: `recurring` hoac `oneOff`
- `title`
- `dayOfWeek`
- `startDate`
- `endDate`
- `date`
- `occurrenceReason`
- `startTime`
- `endTime`
- `room`
- `classSessionId`
- `teacherId`
- `teacherName`
- `studentIds`
- `groupName`
- `level`
- `status`: `scheduled`, `done`, `cancelled`
- `note`
- `sourceModule`
- `sourceTag`
- `importBatchId`
- `datasetId`
- `datasetVersion`
- `isControlledFixture`
- `createdAt`
- `updatedAt`

Hanh vi hien tai:

- Them/sua TKB goi `saveStoredSchedule(scheduleSessions)`.
- Xoa TKB filter khoi `scheduleSessions` roi `saveStoredSchedule(scheduleSessions)`.
- Chua co write-through cloud/realtime cho Module 7 trong C3.4A.

## 3. Current class_session cloud model

`class_session` la entity core C2/C2.3.

Local source:

```txt
ichessCenterOS.classSessions.dreamhome
```

Repo source:

- `src/cloud-db-entities.js`: `CLOUD_ENTITY_TYPES.CLASS_SESSION = 'class_session'`.
- `src/cloud-db-sync.js`: push/pull core groups gom `student`, `teacher`, `class_session`.
- `src/storage.js`: `getStoredClassSessions`, `saveStoredClassSessions`, `normalizeClassSessions`.
- `src/class-session-data.js`: sample core class/session catalog.

Payload/local id:

- Cloud record dung `entity_type = 'class_session'`.
- `local_id` lay tu `classSession.id`.
- Payload giu shape local cua class session.

Fields chinh:

- `id`
- `name`
- `daysOfWeek`
- `daysLabel`
- `dayLabel`
- `startTime`
- `endTime`
- `displayLabel`
- `status`: `active`/`inactive`
- `note`
- `createdAt`
- `updatedAt`

Y nghia:

- `class_session` la ca/lop hoc nen, dung lam catalog/core.
- Co ngay trong tuan va khung gio, nhung khong phai toan bo TKB van hanh.
- Khong du de render day du Module 7 vi thieu `scheduleType`, one-off date, `teacherId`, `studentIds`, room theo lich, status buoi hoc va conflict metadata.

## 4. Current schedule_session dry-run model

`schedule_session` den tu F19H.2d va hien la dry-run/design.

Local source:

```txt
ichessCenterOS.schedule.dreamhome
```

Repo source:

- `src/cloud-schedule-sessions.js`
- `docs/supabase-schedule-session-sync-f19h2d.md`
- `docs/supabase-f19h2d-schedule-session-allowlist.sql`

Entity type:

```txt
schedule_session
```

Payload:

- Preserve Module 7 schedule item.
- Them `centerId`, `payloadVersion`.
- Ghi ro relation:
  - `classSessionEntity: 'class_session'`
  - `scheduleSessionEntity: 'schedule_session'`

Validate rules:

- Session phai la object.
- `scheduleType` hop le: `recurring` hoac `oneOff`, co normalize legacy `weekly/repeat/repeating`, `one-off/oneoff/single/adHoc/adhoc`.
- Recurring can `dayOfWeek` hop le.
- One-off can `date` hop le.
- Can `startTime`, `endTime`, va `endTime > startTime`.
- `studentIds` normalize thanh array.
- `teacherId` co the null.

Unique key/local id:

```txt
schedule_session::<scheduleSessionId>
```

Neu item thieu `id`, helper co the tao deterministic id tu:

```txt
classSessionId + scheduleType + date/dayOfWeek + startTime + endTime
```

Readiness:

- App dry-run helper co allowlist noi bo cho `schedule_session`.
- Remote SQL allowlist patch chua apply.
- `evaluateScheduleSessionCloudReadiness` mac dinh tra blocker `NEEDS SQL/ALLOWLIST PATCH` khi `remoteAllowlistReady = false`.

Ket luan:

```txt
schedule_session hien la dry-run/design, chua real sync neu SQL allowlist patch chua apply.
```

## 5. Difference table

| Hang muc | class_session | schedule_session |
| --- | --- | --- |
| Muc dich | Ca/lop hoc nen, catalog core | Lich/TKB van hanh chi tiet |
| Local source | `ichessCenterOS.classSessions.dreamhome` | `ichessCenterOS.schedule.dreamhome` |
| Cloud entity | `class_session` | `schedule_session` |
| Co trong C2 core | YES | NO, hien la F19H.2d dry-run |
| Cloud readiness | Cao hon, da co trong `CLOUD_ENTITY_TYPES` | Thap hon, can allowlist/readiness confirmation |
| Recurring | Co ngay/gio nen, khong co `scheduleType` | YES, `scheduleType = recurring` |
| One-off | NO | YES, `scheduleType = oneOff` |
| Date cu the | NO | YES cho one-off |
| Teacher/student | Khong co `teacherId`/`studentIds` theo buoi | Co `teacherId`, `teacherName`, `studentIds` |
| Room/status buoi hoc | Khong du | Co `room`, `status`, `note` |
| Phu hop render Module 7 | Khong du | Phu hop hon |
| Phu hop realtime MVP | An toan backend hon nhung khong dung TKB day du | Dung TKB hon nhung rui ro backend cao hon |
| Rui ro | Lech giua catalog va lich that | Can SQL allowlist/realtime patch, chua live verified |

## 6. Bridge options

### Option A - Realtime class_session truoc

Uu diem:

- Entity da trong C2 core.
- Backend readiness cao hon.
- It can SQL moi hon.

Nhuoc diem:

- Khong phan anh day du TKB van hanh.
- Module 7 hien add/edit/delete `scheduleSessions`, khong chi `classSessions`.
- De gay hieu nham rang TKB realtime da xong trong khi chi sync catalog ca/lop hoc.

### Option B - Realtime schedule_session truoc

Uu diem:

- Dung Module 7/TKB that hon.
- Bam local source `ichessCenterOS.schedule.dreamhome`.
- Co field can thiet cho recurring/oneOff, teacher, students, room, status.

Nhuoc diem:

- Can SQL allowlist/realtime patch cho `schedule_session`.
- Chua live verified.
- Can design conflict/merge/delete/active form behavior ky hon.

### Option C - Split bridge

Khuyen nghi:

```txt
C3.4B - schedule_session bridge/readiness guarded, khong runtime lon.
C3.4C - schedule_session realtime guarded sau khi bridge va backend da ro.
```

Ly do:

- `class_session` nen tiep tuc la reference/catalog core.
- `schedule_session.classSessionId` nen la link toi `class_session.id` khi co.
- C3.4B nen tap trung normalize bridge, validate data, readiness, merge/delete policy va smoke test truoc khi bat realtime.

## 7. Recommended path

Recommended next phase:

```txt
C3.4B - schedule_session bridge/readiness guarded, no realtime runtime.
```

Giai thich:

- Module 7/TKB thuc te dang doc/ghi `scheduleSessions`, nen runtime TKB dung nhat ve sau la `schedule_session`.
- `class_session` chi nen lam catalog/reference, khong nen thay the `schedule_session`.
- Truoc realtime, can C3.4B chot bridge: `schedule_session.classSessionId -> class_session.id`, localId, delete/soft-delete policy, conflict policy, active form behavior va SQL/readiness checklist.

SQL needed: PARTIAL/YES for future `schedule_session`.

- C3.4A khong chay SQL.
- C3.4B co the van chua chay SQL neu chi bridge/readiness.
- C3.4C realtime/live sync se can apply/xac nhan allowlist/realtime backend.

Test co the lam o C3.4B:

- Dry-run local schedule thanh `schedule_session`.
- Verify item co `classSessionId` map duoc sang `class_session`.
- Verify item khong co `classSessionId` van co deterministic/local id an toan.
- Verify viewer/teacher/consultant khong duoc write.
- Verify khong overwrite active TKB form.

Anh huong Module 7:

- C3.4B khong nen sua flow add/edit/delete TKB.
- C3.4C moi gan write-through/realtime sau khi bridge va backend ready.

## 8. Access-control impact

C3.4B/C sau nay van phai dung C3.1 guard.

Duoc ghi TKB MVP neu access pass va cloud ready:

- `owner`
- `qtv`
- `center_admin`

Bi chan write TKB MVP:

- `viewer`
- `teacher`
- `consultant`
- `none`
- `unknown`
- signed-out
- missing membership
- missing center

Teacher own-only la phase sau, khong fake quyen theo email.

## 9. SQL/readiness state

SQL applied: NO.

Membership SQL patch: still needed.

Realtime SQL patch: still needed.

schedule_session allowlist patch: not applied / needs confirmation.

NEEDS MEMBERSHIP SQL PATCH: YES.

NEEDS SUPABASE REALTIME PATCH: YES.

NEEDS SCHEDULE_SESSION SQL PATCH: YES.

NEEDS SUPABASE CONFIRMATION: YES.

`class_session` ready hon vi da thuoc C2 core allowlist/runtime. Tuy nhien `class_session` khong du de thay the TKB chi tiet.

## 10. Manual QA future plan

Cho C3.4B/C sau khi backend that san sang:

1. Hai tab cung user: tab A them/sua lich, tab B nhan update gan realtime, khong duplicate.
2. Hai tai khoan cung center: admin A them/sua/ngung lich, admin B thay update.
3. Viewer/no membership: local flow khong crash, cloud write bi chan.
4. Cross-center isolation: center A khong thay lich center B.
5. Conflict: hai tab cung sua mot `schedule_session`; local moi hon khong bi event cu overwrite.
6. Active form: realtime ve khi dang go form TKB khong ghi de input dang nhap.

## 11. Non-scope C3.4A

- Khong TKB realtime runtime.
- Khong helper realtime schedule runtime.
- Khong SQL.
- Khong apply patch.
- Khong data change.
- Khong commit/push.
