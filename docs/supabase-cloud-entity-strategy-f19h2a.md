# F19H.2a - Decision Record: Cloud Entity Strategy cho Attendance / TKB / Học phí

## 1. Context

Cloud DB C2/C2.3 hiện dùng `center_cloud_entities` để sync thủ công và auto-pull sau sign-in cho 3 entity lõi:

- `student`
- `teacher`
- `class_session`

Runtime hiện có:

- Allowlist trong `src/cloud-db-entities.js`.
- Readiness gate trong `src/cloud-db-sync.js`: Supabase configured, signed-in user, `center_members`, bảng `center_cloud_entities`, RLS/permission.
- Upsert theo unique cloud key `(center_id, entity_type, local_id)`.
- Pull chỉ lấy payload còn sống `deleted_at is null`.
- Backup trước pull core bằng `ichessCenterOS.backup.beforeCloudPull.<timestamp>`.
- Settings panel đang block push/pull nếu Cloud DB chưa ready hoặc local chưa đủ marker Angel Wings.
- C2.3 hiện cảnh báo rõ là chưa đẩy học phí, điểm danh, Thu chi, Sổ quỹ, notification hoặc ảnh.

F19H.1 đã thiết kế cloud tổng thể trong `docs/supabase-attendance-tkb-tuition-design.md`. F19H.2a chốt chiến lược entity cloud cho alpha, chưa triển khai sync thật.

## 2. Decision

Quyết định alpha: tiếp tục mở rộng `center_cloud_entities` cho Attendance / TKB / Học phí theo từng phase nhỏ, nhưng chỉ sau khi có migration/allowlist riêng ở phase triển khai sau. F19H.2a không sửa allowlist runtime và không tạo SQL.

Bảng riêng là direction production tương lai, chưa dùng ngay cho alpha.

Lý do:

- `center_cloud_entities` đã chạy được cho C2/C2.3 với Angel Wings staging.
- Mô hình local F19 vẫn đang ổn định dần, đặc biệt attendance canonical, report legacy, và tuition term/current term.
- Alpha cần rollback dễ, payload nguyên bản, manual push/pull, dry-run và backup hơn là query SQL sâu.
- Tách bảng riêng ngay sẽ kéo theo nhiều SQL migration, RLS, unique constraint, conflict UI và testing cùng lúc.
- Dùng generic table cho alpha không khóa đường production; khi model ổn định, có thể migrate payload sang bảng riêng.

Điều kiện chuyển hướng sang bảng riêng:

- Cần query/report server-side thường xuyên theo student/date/session/source.
- Có app Giáo viên/QTV/Phụ huynh thật với RLS chi tiết theo role.
- Attendance/Học phí cần aggregate cloud-side, không chỉ pull về client rồi tính.
- Tuition term/payment/current term đã chốt schema.
- Conflict handling nhiều người dùng cần audit/correction table chuẩn.
- Dữ liệu vượt mức mà JSONB payload bridge khó kiểm soát hiệu năng hoặc tính toàn vẹn.

## 3. Option Comparison

| Tiêu chí | Option A: mở rộng `center_cloud_entities` | Option B: tách bảng riêng ngay |
| --- | --- | --- |
| Phù hợp alpha | Cao | Trung bình/thấp |
| SQL migration | Ít hơn, chỉ mở entity type/check constraint ở phase sau | Nhiều bảng, index, trigger, RLS |
| Rollback | Dễ hơn vì payload local gần như nguyên bản | Khó hơn vì cần migration ngược/mapper |
| RLS chi tiết | Center-scoped tốt, field-level khó | Tốt hơn |
| Query/report SQL | Hạn chế vì JSONB | Tốt |
| Unique constraint sâu | Dựa vào `local_id`/app validation | Có thể enforce trực tiếp |
| Rủi ro phá runtime C2 | Thấp nếu mở rộng theo allowlist tách bạch | Cao hơn |
| Production dài hạn | Bridge/migration layer | Đích đến tốt hơn |

Kết luận: alpha chọn Option A. Production nên đi về Option B hoặc hybrid sau khi local model và workflow role ổn định.

## 4. Entity Plan

Entity allowlist đề xuất cho alpha, theo thứ tự:

1. `attendance_record`
2. `attendance_baseline_state`
3. `session_report`
4. `schedule_session`
5. `tuition_record`
6. `tuition_package`
7. `tuition_term`
8. `tuition_payment`
9. `session_followup_status`

### F19H.2b - Attendance first

Entity: `attendance_record`

Scope:

- Canonical `attendanceRecords` only.
- Dev/advanced data tools gate.
- Serializer/deserializer + validation.
- Dry-run export and count/diff preview first.
- Manual push only, manual pull only.
- No auto push/pull.
- No write to `sessionReports`.
- No tuition `usedSessions` automation.

### F19H.2c - Baseline state / sessionReports

Entities:

- `attendance_baseline_state`
- `session_report`

Scope:

- Baseline lock/audit state.
- Report content/Trello/learningGroups/guestParticipants/classSituation/suggestions.
- `sessionReports.attendance` is legacy snapshot only.
- Avoid duplicate attendance source by keeping `attendance_record` as canonical.

### F19H.2d - Schedule/TKB

Entity: `schedule_session`

Scope:

- Recurring and one-off schedule sessions.
- `studentIds`, `teacherId`, `classSessionId`, room/time/status.
- Keep relationship with existing C2 `class_session`.
- Do not create occurrence table yet.

### F19H.2e - Tuition payload

Entities:

- `tuition_record`
- `tuition_package`

Scope:

- Sync payload first.
- Keep current manual Học phí/TBHP behavior.
- Do not auto-update `usedSessions`.
- Do not infer current term from attendance.

### F19H.2f - Tuition terms/payment/linkage

Entities:

- `tuition_term`
- `tuition_payment`

Scope:

- Normalize current term and term history.
- Normalize payment history.
- Define attendance to current-term linkage after business rules are approved.
- Still no hidden automation without preview/audit.

### Future only - deadline/status

Entity: `session_followup_status`

Recommendation:

- Do not persist deadline/status in early alpha.
- Compute runtime from schedule + attendance records + session reports.
- Persist only when QTV/anh Hải workflow, assignment, acknowledgement, or notification becomes real.

## 5. Proposed Entity Metadata

For every future `center_cloud_entities` row:

```txt
center_id
entity_type
local_id
payload
source_module
source_version
created_by
updated_by
created_at
updated_at
deleted_at
```

Recommended source versions:

- Existing core: `c2-online-core-v1`
- F19 attendance alpha: `f19h-attendance-alpha-v1`
- F19 report/schedule alpha: `f19h-schedule-report-alpha-v1`
- F19 tuition alpha: `f19h-tuition-alpha-v1`

F19H.2b should not reuse `c2-online-core-v1` for attendance because payload semantics and rollback risk are different from student/teacher/class_session.

## 6. Unique Key And Conflict Strategy

### `attendance_record`

Recommended `local_id`:

```txt
attendance_record::<studentId>::<date>::<sessionKey>::<source>::<sourceCreditIndex>
```

Where `sessionKey` is:

```txt
sessionId || scheduleSessionId || classSessionId || "baseline"
```

Baseline exception:

```txt
attendance_record::<studentId>::<date>::initialBaseline
```

Conflict rules:

- `initialBaseline`, `admin`, `teacher`, `consultant`, `correction` are separate sources, not one merged row.
- Same `local_id`: newer `updatedAt` wins only after payload validation.
- Teacher canonical must dedupe with `sessionReports.attendance` adapter using `sourceReportId + sourceAttendanceIndex + sourceCreditIndex`.
- Cloud pull must not create duplicates that make Module 13 count one attendance credit twice.
- Soft delete only through `deleted_at`.

### `attendance_baseline_state`

Recommended `local_id`:

```txt
attendance_baseline_state::<centerId>
```

Conflict rules:

- Do not downgrade `locked` to `draft` from an older cloud payload.
- Preserve audit log entries.
- Pull only after backup and preview.

### `session_report`

Recommended `local_id`:

```txt
session_report::<sessionId>::<occurrenceDate>
```

Conflict rules:

- Use report `updatedAt` for same report.
- `attendance` inside report is legacy snapshot, not canonical cloud attendance.
- If report has no content and only old attendance, keep it for backward compatibility but do not generate duplicate `attendance_record` if canonical exists.

### `schedule_session`

Recommended `local_id`:

```txt
schedule_session::<scheduleSessionId>
```

Conflict rules:

- Same schedule id: newer `updatedAt` wins.
- Recurring sessions remain config rows; occurrences are runtime.
- One-off sessions use concrete `date`.

### `tuition_record`

Recommended `local_id` for payload alpha:

```txt
tuition_record::<tuitionRecordId>
```

Secondary logical unique:

```txt
centerId + studentId + currentTermId
```

Conflict rules:

- Same record id: newer `updatedAt` wins after validation.
- Payment arrays are high-risk; dry-run must flag changed payment count and total.
- Do not recompute `usedSessions` from attendance.

### `tuition_package`

Recommended `local_id`:

```txt
tuition_package::<packageId>
```

Conflict rules:

- Catalog rows are not destructive.
- If local has custom package not in cloud, preview before pull must show it.

### `tuition_term` and `tuition_payment`

Recommended future ids:

```txt
tuition_term::<studentId>::<termId>
tuition_payment::<tuitionId>::<paymentId>
```

These should wait until current term rules are stable.

## 7. Safety / Readiness Gate For F19H.2b

F19H.2b must implement these gates before any real attendance sync:

1. Cloud ready check passes.
2. Signed-in check passes.
3. Center ID is explicit and equals expected center for the workspace.
4. Entity type is in app allowlist and SQL allowlist.
5. Local payload validates before dry-run.
6. Cloud payload validates before pull.
7. Local backup is created before pull.
8. Local count preview before push.
9. Cloud count preview before pull.
10. Push is blocked if local count is suspicious.
11. Pull is blocked if cloud payload is empty while local has data, unless a recovery mode is explicitly added later.
12. No destructive cloud writes; use upsert and soft delete only.
13. No auto push on page load.
14. No auto pull for F19 entities after sign-in.
15. F19 sync tools live behind advanced/dev data tools, not normal operational UI.
16. Angel Wings remains staging dataset, not production truth.
17. Dry-run mode first.
18. Push/pull result summary records count by entity type and validation failures.
19. Existing C2 auto-pull for `student`/`teacher`/`class_session` must not include F19 entities.
20. Build/test/diff check must pass before enabling any manual sync action.

## 8. RLS / Security Direction

Alpha can stay with center-scoped generic entities:

- `center_id` gates all rows.
- `entity_type` gates allowed payload families.
- `local_id` identifies the local object.
- `created_by`, `updated_by`, `updated_at`, optional `deleted_at` support audit.
- Existing `center_members`/`is_center_member(center_id)` direction remains valid.

Future roles:

- `owner`/QTV/anh Hải: multi-center or full center operations, escalation view.
- `center_admin`: center data, Admin/Tư vấn attendance, schedule, tuition.
- `teacher`: own assigned schedule/report/teacher attendance only.
- `consultant`: consultant attendance/checking and parent/customer workflow.
- Parent/student: scoped read-only summaries.

F19H.2a does not implement real role policies. When splitting tables, each table should get role-specific RLS, especially for teacher-owned schedule/report access.

## 9. Migration / Rollout Plan

1. Keep F19H.2a as documentation only.
2. In F19H.2b, add entity constants and serializer tests for `attendance_record`.
3. Add dry-run export with validation and count preview.
4. Add local backup for `ichessCenterOS.attendanceRecords.dreamhome`.
5. Add manual push for attendance only behind advanced/dev gate.
6. Add manual pull only after cloud payload validation and backup.
7. Test with Angel Wings staging data in a clean profile.
8. Compare local count, cloud count, and unified attendance count after pull.
9. Roll back by restoring backup key if mismatch.
10. Repeat this pattern for baseline state, reports, schedule, tuition.
11. Defer production empty center until staging has stable push/pull and rollback.
12. Defer auto-sync until conflict UI and role boundaries are real.

## 10. Open Questions

- Khi nào chuyển từ `center_cloud_entities` sang bảng riêng?
- Có cần SQL unique index hoặc generated columns trên generic table cho `attendance_record` không?
- `sessionReports.attendance` sẽ giữ bao lâu trong cloud payload?
- `consultant` source UI nằm ở đâu và có khác Admin cơ sở không?
- Học phí current term chuẩn hóa lúc nào?
- Payment arrays trong `tuition_record` có được sync payload lâu dài không, hay phải tách `tuition_payment` sớm?
- App Giáo viên riêng khi nào tách khỏi Admin cơ sở?
- QTV/anh Hải workflow duyệt sửa/correction khi nào làm thật?
- Cloud conflict UI có cần ở Module 10/Công cụ dữ liệu nâng cao không?
- C2 core auto-pull sau sign-in có nên tắt dần khi dữ liệu nhiều nhóm hơn không?

## 11. Explicit Non-Scope For F19H.2a

- Không tạo bảng Supabase thật.
- Không tạo SQL migration.
- Không sửa SQL production.
- Không sửa `cloud-db-entities.js` allowlist runtime.
- Không bật sync attendance/TKB/Học phí.
- Không push/pull cloud.
- Không thêm nút UI.
- Không thay đổi localStorage data.
- Không sửa Module 7, Module 13, Học phí/TBHP behavior.
- Không commit/push.

## 12. Readiness For F19H.2b

F19H.2b nên làm duy nhất `attendance_record` và vẫn chưa chạm TKB/Học phí. Definition of ready:

- Decision này được chấp nhận.
- SQL/allowlist plan cho `attendance_record` được chốt trước khi viết migration thật.
- Serializer/deserializer có smoke test.
- Dry-run preview chạy được mà không ghi cloud.
- Backup trước pull có test.
- Không auto-sync.
- F19B/F19C/F19E/F19F/F19G/F19H.1 smoke vẫn pass.
