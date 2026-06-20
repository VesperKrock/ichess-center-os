# F19H.2f - Cloud Dry-Run cho Tuition Term / Tuition Payment va Linkage Attendance - Current Term

## 1. Muc Tieu

F19H.2f chuan bi dry-run cloud sync cho 2 entity:

```txt
tuition_term
tuition_payment
```

qua bang generic:

```txt
center_cloud_entities
```

Phase nay cung viet thiet ke linkage an toan giua:

```txt
attendance_record - current tuition term
```

F19H.2f chi tao helper validate payload, dry-run preview, readiness gate, docs, smoke test va SQL allowlist patch plan. Khong real push/pull, khong chay SQL len Supabase, khong auto sync va khong sua UI/runtime van hanh.

## 2. Entity Types

Entity moi:

- `tuition_term`
- `tuition_payment`

F19H.2f khong doi nghia cac entity da co:

- `student`
- `teacher`
- `class_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `schedule_session`
- `tuition_record`
- `tuition_package`

## 3. Local / Derived Source

Repo hien chua co storage rieng cho `tuition_term` hoac `tuition_payment`.

Dry-run derive tu local source thuc te:

```txt
ichessCenterOS.tuition.dreamhome
```

Mapping derive:

- Current term derive tu `tuition_record.currentTermId`, `currentTermNumber`, package/session/amount fields tren record.
- Archived terms derive tu `tuition_record.termHistory`.
- Current payments derive tu `tuition_record.payments`.
- Historical payments derive tu `termHistory[].payments`.

Helper khong ghi nguoc localStorage va khong tach storage local moi.

## 4. Payload Validation

### tuition_term

Validate toi thieu:

- payload la object;
- co `termId`, hoac tao deterministic id tu `tuitionRecordId + termNumber`;
- co `tuitionRecordId`;
- co `studentId`;
- normalize `termNumber`;
- preserve `totalSessions` va `usedSessions`, khong tinh lai tu attendance;
- preserve package/amount/discount/payment summary fields neu co;
- preserve `startedAt`, `endedAt`, `status`, `sourceKind`.

### tuition_payment

Validate toi thieu:

- payload la object;
- co `paymentId`, hoac tao deterministic id tu `tuitionRecordId + paymentIndex + amount + paidAt`;
- co `tuitionRecordId`;
- co `amount` hop le lon hon 0;
- preserve `paidAt`, `method`, `note`, `sourceKind`;
- link `tuitionTermId` neu derive duoc.

Invalid item bi skip trong dry-run va ghi reason. Helper khong sua local tuition data.

## 5. Dry-Run Output

Dry-run tra ve:

- `localSourceKey`;
- `tuitionRecordsInspected`;
- `termsDerived`;
- `paymentsDerived`;
- summary rieng cho `tuition_term`;
- summary rieng cho `tuition_payment`;
- `valid`, `invalid`, `skipped`;
- `invalidSamples`;
- `counts.missingCurrentTermId`;
- `counts.missingTermHistory`;
- `counts.missingPaymentId`;
- `counts.missingPaymentDate`;
- `counts.missingPaymentAmount`;
- `totalEstimatedPaymentAmount`;
- `appAllowlistReady`;
- `remoteAllowlistReady`;
- `readyForRealPush`;
- `realPushStatus`.

Dry-run khong ghi local va khong ghi cloud.

## 6. Attendance - Current Term Linkage

F19H.2f chi thiet ke linkage, chua implement runtime automation.

Rule de xuat:

1. `attendance_record` khong tu quyet ky/goi.
2. Current term source phai den tu Hoc phi/TBHP, cu the la `tuition_record.currentTermId/currentTermNumber` hoac entity `tuition_term` hop le.
3. Mot attendance chi duoc tinh vao Hoc phi neu map duoc:
   - `studentId`;
   - `date`;
   - `classSessionId/sessionId/scheduleSessionId` neu can;
   - `tuitionRecordId` hoac `currentTermId`;
   - term status hop le.
4. Khong dung rule:

```txt
max attendance credit toan lich su + 1
```

5. Neu hoc vien co nhieu ky/goi, attendance date phai roi vao range/rule cua current term.
6. Neu khong xac dinh duoc current term, attendance chi la attendance, khong tu tru buoi.
7. Moi auto update `usedSessions` sau nay phai co:
   - preview;
   - audit;
   - rollback;
   - conflict guard;
   - manual approval.

## 7. usedSessions Rule

F19H.2f preserve `usedSessions` trong `tuition_term` payload.

Khong tu dong:

- cap nhat `usedSessions`;
- tru buoi;
- tinh so buoi con lai tu attendance;
- sua `termHistory`;
- sua `payments`;
- chon current term tu attendance.

## 8. Unique Key / Conflict Strategy

### tuition_term

Unique key de xuat:

```txt
centerId + tuitionTermId
```

Cloud local id:

```txt
tuition_term::<tuitionTermId>
```

Neu thieu id, deterministic id:

```txt
tuitionRecordId + termNumber
```

Conflict sau nay:

- cung id: newer `updatedAt` thang neu safe;
- conflict khong resolve an toan thi skip va bao preview;
- khong destructive delete;
- pull merge sau nay phai non-destructive.

### tuition_payment

Unique key de xuat:

```txt
centerId + tuitionPaymentId
```

Cloud local id:

```txt
tuition_payment::<tuitionPaymentId>
```

Neu thieu id, deterministic id:

```txt
tuitionRecordId + paymentIndex + amount + paidAt
```

Payment thieu id/ngay/amount khong ro thi classify trong dry-run, khong crash.

## 9. Readiness Gate

Readiness chi pass trong phase sau neu:

- Cloud DB ready;
- user signed in;
- membership/center access ready;
- centerId ro;
- app allowlist co `tuition_term` va `tuition_payment`;
- remote SQL/check constraint da apply;
- dry-run preview sach;
- co thao tac user explicit.

Hien tai remote allowlist chua duoc apply, nen trang thai mac dinh phai la:

```txt
NEEDS SQL/ALLOWLIST PATCH
```

Khong fake ready va khong co real sync trong F19H.2f.

## 10. SQL / Allowlist Patch Status

Patch file trong repo:

```txt
docs/supabase-f19h2f-tuition-term-payment-allowlist.sql
```

Patch chi them:

- `tuition_term`
- `tuition_payment`

va giu:

- `student`
- `teacher`
- `class_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `schedule_session`
- `tuition_record`
- `tuition_package`

Patch nay chua duoc chay len Supabase. Remote chua duoc coi la ready cho real sync.

## 11. Non-Scope

- Chua sync that.
- Chua real push/pull.
- Chua auto sync.
- Chua chay SQL.
- Chua realtime.
- Chua auth/role that.
- Chua noi attendance vao Hoc phi runtime.
- Chua cap nhat `usedSessions`.
- Chua tru buoi.
- Chua sync attendance/sessionReports/TKB/deadline that.
- Chua sua Module Hoc phi/TBHP behavior.
- Chua sua Module 13/Bang diem danh UI.
- Chua sua Module 7/TKB behavior.
- Chua thay doi du lieu local/cloud.

## 12. Next Phase

Sau F19H.2f co the:

- tong nghiem thu F19H.2 truoc khi commit;
- review/apply allowlist patches thu cong;
- verify remote readiness that;
- chuan bi real push/pull thu cong sau khi dry-run sach, co backup truoc pull va user action explicit.
