# F19H.2e - Cloud Dry-Run cho Tuition Record / Tuition Package

## 1. Muc Tieu

F19H.2e chuan bi dry-run cloud sync cho 2 entity:

```txt
tuition_record
tuition_package
```

qua bang generic:

```txt
center_cloud_entities
```

Phase nay chi tao helper validate payload, dry-run preview, readiness gate, docs, smoke test va SQL allowlist patch plan. Khong real push/pull, khong chay SQL len Supabase, khong auto sync va khong sua UI van hanh.

## 2. Entity Types

Entity moi:

- `tuition_record`
- `tuition_package`

F19H.2e khong doi nghia cac entity da co:

- `student`
- `teacher`
- `class_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `schedule_session`

## 3. Local Source Keys

Tuition records:

```txt
ichessCenterOS.tuition.dreamhome
```

Tuition package catalog:

```txt
ichessCenterOS.tuitionPackages.dreamhome
```

`tuition_package` hien la catalog goi hoc phi, chu yeu tu Angel Wings controlled dataset. Helper chi doc key nay hoac input truyen truc tiep, khong ghi localStorage va khong ghi cloud.

## 4. Payload Validation

### tuition_record

Validate toi thieu:

- payload la object;
- co `id`, hoac tao deterministic id tu `studentId + package/currentTermId/currentTermNumber`;
- co `studentId`;
- preserve `packageName`;
- normalize `totalSessions`, `usedSessions`, `totalAmount`, `discountAmount`, `paidAmount`;
- preserve `usedSessions` nhu payload hien co, khong tinh lai tu attendance;
- preserve `currentTermId`, `currentTermNumber`, `startedAt`;
- preserve `payments` va `termHistory` nhu nested payload hien co;
- preserve source/import/dataset fields neu co.

`payments` va `termHistory` trong F19H.2e chi nam trong payload `tuition_record`. Phase nay khong tao/sync entity rieng `tuition_payment` hoac `tuition_term`.

### tuition_package

Validate toi thieu:

- payload la object;
- co `id`, hoac tao deterministic id tu package name;
- co `name`, `packageName`, `displayLabel`, hoac `label`;
- normalize `totalSessions/sessionCount`;
- normalize `price/amount/totalAmount`;
- preserve `displayLabel`, `description`, `isActive`;
- preserve source/import/dataset fields neu co.

Invalid item bi skip trong dry-run va ghi reason. Helper khong sua local tuition data.

## 5. Dry-Run Output

Dry-run tra ve summary theo tung entity:

- `entityType`;
- `localSourceKey`;
- `total`;
- `valid`;
- `invalid`;
- `skipped`;
- `counts.tuitionRecords`;
- `counts.tuitionPackages`;
- `counts.missingStudentId`;
- `counts.missingPackageIdentity`;
- `totalEstimatedAmount`;
- `invalidSamples`;
- `estimatedCloudEntityCount`;
- `appAllowlistReady`;
- `remoteAllowlistReady`;
- `readyForRealPush`;
- `realPushStatus`;
- `validEntities`.

Dry-run khong ghi local va khong ghi cloud.

## 6. Hoc Phi / Attendance Rule

F19H.2e khong noi attendance vao Hoc phi.

Khong tu dong:

- cap nhat `usedSessions`;
- tinh so buoi con lai tu attendance;
- chon current term theo attendance;
- sua `termHistory`;
- tao `tuition_term`;
- tao `tuition_payment`.

Quy tac nghiep vu:

```txt
F19H.2e chi sync payload Hoc phi hien co o muc dry-run.
Attendance - current term linkage de F19H.2f hoac phase sau.
```

Bang diem danh khong quyet dinh ky/goi. Logic "buoi gan nhat trong ky hien tai" phai dua vao Hoc phi/TBHP current term truoc khi tu dong hoa.

## 7. Unique Key / Conflict Strategy

### tuition_record

Unique key de xuat:

```txt
centerId + tuitionRecordId
```

Cloud local id:

```txt
tuition_record::<tuitionRecordId>
```

Neu thieu id, deterministic id duoc tao tu:

```txt
studentId + packageName/currentTermId + currentTermNumber
```

Conflict sau nay:

- cung id: newer `updatedAt` thang neu safe;
- neu conflict khong resolve an toan: skip va bao trong preview;
- khong destructive delete;
- pull merge sau nay phai non-destructive.

### tuition_package

Unique key de xuat:

```txt
centerId + packageId
```

Cloud local id:

```txt
tuition_package::<packageId>
```

Neu thieu id, deterministic id duoc tao tu normalized package name.

Conflict package name khong chac chan thi skip trong phase merge sau.

## 8. Readiness Gate

Readiness chi pass trong phase sau neu:

- Cloud DB ready;
- user signed in;
- membership/center access ready;
- centerId ro;
- app allowlist co `tuition_record` va `tuition_package`;
- remote SQL/check constraint da apply;
- dry-run preview sach;
- co thao tac user explicit.

Hien tai remote allowlist chua duoc apply, nen trang thai mac dinh phai la:

```txt
NEEDS SQL/ALLOWLIST PATCH
```

Khong fake ready va khong co real sync trong F19H.2e.

## 9. SQL / Allowlist Patch Status

Patch file trong repo:

```txt
docs/supabase-f19h2e-tuition-record-package-allowlist.sql
```

Patch chi them:

- `tuition_record`
- `tuition_package`

va giu:

- `student`
- `teacher`
- `class_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `schedule_session`

Patch nay chua duoc chay len Supabase. Remote chua duoc coi la ready cho real sync.

## 10. Non-Scope

- Chua sync that.
- Chua real push/pull.
- Chua auto sync.
- Chua chay SQL.
- Chua realtime.
- Chua auth/role that.
- Chua attendance linkage.
- Chua cap nhat `usedSessions`.
- Chua sync `tuition_term`.
- Chua sync `tuition_payment`.
- Chua sync attendance/sessionReports/TKB/deadline.
- Chua sua Module Hoc phi/TBHP behavior.
- Chua sua Module 13/Bang diem danh UI.
- Chua sua Module 7/TKB behavior.
- Chua thay doi du lieu local/cloud.

## 11. Next Phase

Phase de xuat tiep theo:

```txt
F19H.2f - Cloud dry-run cho tuition_term / tuition_payment va thiet ke linkage attendance-current term
```

Truoc khi real sync bat ky entity F19H nao, can review/apply SQL allowlist thu cong, verify readiness bang runtime that, co dry-run diff ro rang, backup truoc pull va user action explicit.
