# C4.4 - Shared Staging Dataset 29 + App Shell Polish

## 1. Summary

C4.4 thay default staging data path từ seed 8 sang gói 29. C4.4 không cloud bootstrap, không seed cloud, không SQL. localStorage vẫn là cache/fallback cho tới C4.5.

Phase này cũng polish app shell:

- signed-in ẩn box nổi "Cổng hệ thống";
- Start menu có "Đăng xuất";
- Start menu click outside closes;
- Start menu closes when opening module.

## 2. Seed 8 before

Seed 8 cũ nằm trong `src/student-data.js` dưới `legacyEightStudentSeed`. Trước C4.4, `sampleStudents` là mảng 8 học viên legacy và fresh localStorage có thể rơi về `ichessCenterOS.students.dreamhome` với 8 học viên này.

## 3. Dataset 29 after

Nguồn gói 29:

```txt
src/attendance-board-angel-wings-data.js
buildAngelWingsRealDataset().students
```

Count: 29 học viên.

Dataset 29 là Angel Wings 06/2026 controlled dataset, dùng cho staging T/P test. C4.4 chỉ dùng dataset này cho local/fresh staging path; không seed cloud và không claim cloud shared live đã pass.

## 4. Safe migration rule

Rule C4.4:

- Fresh/default student path dùng `sampleStudents` 29.
- Nếu localStorage hiện có đúng legacy seed 8 nguyên bản, app migrate sang gói 29 và save lại bằng `saveStoredStudents`.
- Không overwrite user data nếu dữ liệu không khớp chính xác legacy seed 8.
- Không hard reset localStorage.
- Không gọi `localStorage.clear()`.

Helper:

```txt
isLegacyEightStudentSeed(students)
shouldReplaceLegacyEightSeed(students)
```

## 5. App shell polish

- Signed-in không còn render box nổi "Cổng hệ thống" trên dashboard.
- Start menu có "Đăng xuất" và dùng signOut flow hiện có.
- Start menu click outside closes.
- Start menu closes when opening module.
- Dashboard/module windows/taskbar giữ nguyên sau signed-in.

## 6. Next phase

```txt
C4.5 - Cloud bootstrap: mở app là lấy student/teacher/schedule từ cloud
```
