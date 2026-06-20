# F19H.2d - Cloud Dry-Run cho Schedule Session / TKB

## 1. Muc Tieu

F19H.2d chuan bi nen dry-run cho entity:

```txt
schedule_session
```

qua bang generic:

```txt
center_cloud_entities
```

Phase nay chi tao helper validate payload, dry-run preview, readiness gate, docs, smoke test va SQL allowlist patch plan. Khong real push/pull, khong chay SQL len Supabase, khong auto sync va khong sua UI van hanh.

## 2. Entity Type

Entity moi:

```txt
schedule_session
```

F19H.2d khong doi nghia cac entity da co:

- `student`
- `teacher`
- `class_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

## 3. Local Source Key

Local source key thuc te cua Module 7 / TKB:

```txt
ichessCenterOS.schedule.dreamhome
```

Helper cung ho tro centerId khac bang pattern:

```txt
ichessCenterOS.schedule.<centerId>
```

Dry-run chi doc key nay hoac input `scheduleSessions` duoc truyen truc tiep. Helper khong goi `saveStoredSchedule`, khong ghi `localStorage`, va khong ghi cloud.

## 4. class_session vs schedule_session

`class_session` la lop/ca hoc nen da thuoc C2/C2.3. Entity nay dai dien cho khai niem lop/ca hoc co the duoc cloud sync tu truoc.

`schedule_session` la lich/TKB chi tiet, gom recurring/one-off, ngay/gio, phong, giao vien, hoc vien va quan he neu co voi `class_session`.

Neu local schedule item co:

```txt
classSessionId
```

payload `schedule_session` preserve relation do. F19H.2d khong merge `class_session` va `schedule_session`, khong doi y nghia C2/C2.3, va khong bien lich TKB thanh class/session nen.

## 5. Payload Validation

Helper validate toi thieu:

- payload la object;
- co `id`, hoac tao deterministic id tu `classSessionId + scheduleType + date/dayOfWeek + startTime + endTime`;
- `scheduleType` hop le:
  - `recurring`;
  - `oneOff`;
  - legacy `weekly`, `repeat`, `repeating` normalize ve `recurring`;
  - legacy `one-off`, `oneoff`, `single`, `adHoc`, `adhoc` normalize ve `oneOff`;
- recurring can `dayOfWeek` hop le;
- one-off can `date` hop le;
- can `startTime` va `endTime` dang `HH:mm`;
- `endTime` phai lon hon `startTime`;
- `studentIds` normalize thanh array;
- `teacherId` co the null;
- preserve `room`, `teacherName`, `groupName`, `level`, `status`, `note`, source/import/dataset fields;
- preserve conflict metadata neu co, nhung khong tinh conflict moi trong phase nay.

Invalid item bi skip trong dry-run va ghi reason. Helper khong sua local schedule data.

## 6. Dry-Run Output

Dry-run cho `schedule_session` tra ve:

- `entityType`;
- `total`;
- `valid`;
- `invalid`;
- `skipped`;
- `countByScheduleType.recurring`;
- `countByScheduleType.oneOff`;
- `countByScheduleType.legacyUnknown`;
- `sessionsMissingTeacher`;
- `sessionsMissingStudents`;
- `invalidSamples`;
- `estimatedCloudEntityCount`;
- `appAllowlistReady`;
- `remoteAllowlistReady`;
- `readyForRealPush`;
- `realPushStatus`;
- `validEntities`.

Dry-run khong ghi local va khong ghi cloud.

## 7. Unique Key / Conflict Strategy

Unique key de xuat:

```txt
centerId + scheduleSessionId
```

Trong payload cloud helper tao `local_id`:

```txt
schedule_session::<scheduleSessionId>
```

Neu item thieu `id`, deterministic id duoc tao tu:

```txt
classSessionId + scheduleType + date/dayOfWeek + startTime + endTime
```

Conflict strategy cho phase real pull/push sau:

- cung id: newer `updatedAt` thang neu payload valid va safe;
- neu conflict khong resolve an toan: skip va bao trong preview;
- khong destructive delete;
- khong xoa local session chi vi cloud khong co;
- pull merge sau nay phai non-destructive va co backup/preview rieng.

F19H.2d chua real pull merge.

## 8. Readiness Gate

Readiness chi pass trong phase sau neu:

- Cloud DB ready;
- user signed in;
- membership/center access ready;
- centerId ro;
- app allowlist co `schedule_session`;
- remote SQL/check constraint da apply;
- dry-run preview sach;
- co thao tac user explicit.

Hien tai remote allowlist chua duoc apply, nen trang thai mac dinh phai la:

```txt
NEEDS SQL/ALLOWLIST PATCH
```

Khong fake ready va khong co real sync trong F19H.2d.

## 9. SQL / Allowlist Patch Status

Patch file trong repo:

```txt
docs/supabase-f19h2d-schedule-session-allowlist.sql
```

Patch chi them:

```txt
schedule_session
```

va giu cac entity cu:

- `student`
- `teacher`
- `class_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

Patch nay chua duoc chay len Supabase. Remote chua duoc coi la ready cho real sync.

## 10. Non-Scope

- Chua sync that.
- Chua real push/pull.
- Chua auto sync.
- Chua chay SQL.
- Chua realtime.
- Chua auth/role that.
- Chua sync attendance/sessionReports.
- Chua sync Hoc phi/TBHP.
- Chua sync deadline state.
- Chua sua Module 7/TKB behavior.
- Chua sua Module 13/Bang diem danh UI.
- Chua sua Hoc phi/TBHP behavior.
- Chua thay doi du lieu local/cloud.

## 11. Next Phase

Phase de xuat tiep theo:

```txt
F19H.2e - Cloud dry-run cho tuition_record va tuition_package
```

Truoc khi real sync bat ky entity F19H nao, can review/apply SQL allowlist thu cong, verify readiness bang runtime that, co dry-run diff ro rang, backup truoc pull va user action explicit.
