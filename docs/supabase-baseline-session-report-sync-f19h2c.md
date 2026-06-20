# F19H.2c - Cloud Dry-Run cho Baseline State và Session Report

## 1. Mục Tiêu

Chuẩn bị helper validate/dry-run/readiness cho 2 entity cloud qua `center_cloud_entities`:

- `attendance_baseline_state`
- `session_report`

Phase này không real push/pull, không chạy SQL lên Supabase, không auto sync và không sửa UI vận hành.

## 2. Local Source Keys

Baseline state:

```txt
ichessCenterOS.attendanceBaselineState.dreamhome
```

Session reports:

```txt
ichessCenterOS.sessionReports.dreamhome
```

## 3. Payload Validation

### `attendance_baseline_state`

Validate tối thiểu:

- payload là object;
- `status` thuộc `notStarted`, `draft`, `locked`, `unlocked`, hoặc fallback an toàn về `notStarted`;
- `auditLog` được normalize thành array;
- preserve `lockedAt`, `lockedBy`, `unlockedAt`, `unlockedBy`, `lastActionAt`, `lastActionBy`, `unlockReason`, `note`.

Unique cloud local id:

```txt
attendance_baseline_state::<centerId>
```

### `session_report`

Validate tối thiểu:

- payload là object;
- có `id`, hoặc tạo deterministic id từ `sessionId + occurrenceDate`;
- `occurrenceDate` hợp lệ nếu có;
- report có content meaningful: learning groups, guest participants, notes, class situation, suggestions, legacy attendance, import/demo marker;
- preserve demo/import/source fields;
- `attendance` trong report chỉ là legacy payload.

Unique cloud local id:

```txt
session_report::<reportId>
```

Nếu thiếu report id nhưng có session/date:

```txt
session_report::<sessionId>::<occurrenceDate>
```

## 4. Session Report Attendance Rule

Canonical attendance source vẫn là:

```txt
attendance_record
```

`session_report.attendance` chỉ được preserve như legacy/report payload để không mất dữ liệu cũ. F19H.2c không dùng `session_report.attendance` làm canonical attendance, không tạo duplicate với `attendance_record`, và không làm Module 13 đọc trực tiếp cloud session report attendance.

Payload session report có marker:

```txt
attendanceIsCanonical: false
canonicalAttendanceEntity: attendance_record
```

## 5. Dry-Run Output

Dry-run helper trả về theo từng entity:

- `entityType`;
- `total`;
- `valid`;
- `invalid`;
- `skipped`;
- `invalidSamples`;
- `estimatedCloudEntityCount`;
- `appAllowlistReady`;
- `remoteAllowlistReady`;
- `readyForRealPush`;
- `realPushStatus`;
- `validEntities`.

Dry-run không ghi localStorage và không ghi cloud.

## 6. Readiness Gate

Real sync sau này chỉ được mở nếu:

- Cloud DB ready;
- user signed in;
- membership/center access pass;
- centerId rõ;
- app allowlist có `attendance_baseline_state` và `session_report`;
- SQL/remote allowlist đã apply;
- dry-run preview sạch;
- user action explicit.

Hiện tại remote chưa apply patch, nên trạng thái phải là:

```txt
NEEDS SQL/ALLOWLIST PATCH
```

## 7. SQL / Allowlist Patch Status

Patch file trong repo:

```txt
docs/supabase-f19h2c-baseline-session-report-allowlist.sql
```

Patch chỉ mở thêm:

- `attendance_baseline_state`
- `session_report`

và giữ:

- `student`
- `teacher`
- `class_session`
- `attendance_record`

Patch chưa được chạy lên Supabase. Remote chưa được coi là ready cho real sync.

## 8. Conflict Strategy

### Baseline state

- Một entity state theo center.
- Cùng local id: newer `updatedAt` hoặc `lastActionAt` thắng trong phase merge sau.
- Không downgrade `locked` thành `draft` nếu cloud/local không rõ thứ tự.
- Preserve audit log.

### Session report

- Cùng report id: newer `updatedAt` thắng nếu payload valid.
- Nếu không chắc conflict, phase real pull sau phải skip và báo preview.
- Không destructive delete.
- Không xóa local report không có trên cloud.

F19H.2c chưa real pull merge.

## 9. Non-Scope

- Chưa sync thật.
- Chưa chạy SQL.
- Chưa auto sync.
- Chưa realtime.
- Chưa auth/role thật.
- Chưa sync `attendance_record` thật.
- Chưa sync `schedule_session`.
- Chưa sync Học phí/TBHP.
- Chưa sync deadline state.
- Chưa sửa Module 13 UI.
- Chưa sửa Module 7/TKB behavior.

## 10. Next Phase

Sau khi patch allowlist được review/apply thủ công và readiness pass, phase sau có thể chuẩn bị real push/pull thủ công cho baseline/session report. Trước đó vẫn phải giữ dry-run, backup trước pull, preview count/diff và explicit user action.
