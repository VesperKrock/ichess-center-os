# F19H.2b - Attendance Record Cloud Sync Dry-Run

## Scope

F19H.2b chuẩn bị nền sync tối thiểu cho entity `attendance_record` qua `center_cloud_entities`.

Phase này chỉ mở helper/validator/dry-run, chưa bật real push/pull vì SQL production C1/C2.2 hiện vẫn chỉ allow:

- `student`
- `teacher`
- `class_session`

Trạng thái real sync hiện tại:

```txt
NEEDS SQL/ALLOWLIST PATCH
```

## Local Source

Local source duy nhất:

```txt
ichessCenterOS.attendanceRecords.dreamhome
```

Không sync:

- `sessionReports`
- `schedule_session`
- Học phí/TBHP
- deadline state

## Entity

Entity type:

```txt
attendance_record
```

Source version:

```txt
f19h-attendance-alpha-v1
```

Allowed sources trong F19H.2b:

- `initialBaseline`
- `admin`
- `teacher`
- `consultant`
- `correction`

Các source khác như `legacyReport`, `imported`, `unknown` bị skip trong preview và không được push.

## Dry-Run Preview

Helper `createAttendanceRecordCloudDryRun` trả về:

- tổng record local;
- số valid;
- số invalid/skipped;
- count theo source;
- sample invalid reason;
- estimated cloud entity count;
- trạng thái app allowlist;
- trạng thái SQL/remote allowlist;
- `readyForRealPush`;
- `realPushStatus`.

Dry-run không ghi localStorage và không ghi cloud.

## Readiness

Real push/pull chỉ được mở khi tất cả điều kiện đều pass:

1. Cloud DB ready.
2. User signed in.
3. Membership/center access ready.
4. Center ID rõ.
5. App allowlist có `attendance_record`.
6. SQL/backend allowlist có `attendance_record`.
7. Dry-run có record hợp lệ và không còn invalid.
8. User action explicit.

Nếu thiếu SQL/backend allowlist, helper trả trạng thái:

```txt
NEEDS SQL/ALLOWLIST PATCH
```

## Conflict Rule

`local_id` cloud được tạo theo dạng:

```txt
attendance_record::<studentId>::<date>::<sessionKey>::<source>::<creditKey>
```

Với `initialBaseline`:

```txt
attendance_record::<studentId>::<date>::initialBaseline::<creditKey>
```

Không merge các source khác nhau:

- `admin` không ghi đè `teacher`;
- `teacher` không ghi đè `admin`;
- `initialBaseline` không ghi đè record vận hành;
- `correction` là fact riêng.

Pull merge nếu triển khai sau phải non-destructive: validate payload, backup trước pull, merge theo `local_id`, không xóa local record không có trên cloud.

## Non-Scope

- Không tạo bảng Supabase.
- Không sửa SQL production.
- Không push/pull cloud thật.
- Không auto push/pull.
- Không sửa Module 13 UI.
- Không sửa Module 7/TKB behavior.
- Không sửa Học phí/TBHP behavior.
- Không thay đổi localStorage ngoài thao tác người dùng explicit trong phase sau.
