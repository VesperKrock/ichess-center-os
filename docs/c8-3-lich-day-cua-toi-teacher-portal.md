# C8.3 - Teacher Portal - Lich day cua toi

## Status

```txt
C8.3 STATUS: TEACHER_PORTAL_MY_SCHEDULE_DETAIL_READ_ONLY
TEACHER_CONTEXT_SOURCE: PROFILE_PREVIEW
TEACHER_SCHEDULE_FILTER_BY_TEACHER_ID: YES
LEGACY_NAME_ONLY_AUTO_MATCH: NO
MY_SESSION_DETAIL_READ_ONLY: YES
TEACHER_AUTH_REAL_CREATED: NO
CHECKIN_CHECKOUT_IMAGE_CREATED: NO
SQL_SUPABASE_DEPLOY: NO
ATTENDANCE_TO_TUITION_AUTOMATION: NO
TUITION_USED_SESSIONS_UPDATE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
```

## Audit C8.2

- Teacher Portal shell nam trong `src/teacher-module.js`, ham `renderTeacherPortalShell`.
- Portal duoc mo tu modal ho so giao vien khi admin chon giao vien dang preview.
- Teacher hien tai la teacher object cua ho so dang mo, khong phai Auth user.
- Schedule hien co dung `teacherId`, `teacherName`, `studentIds`, `date/dayOfWeek`, `startTime/endTime`, `room`, `status`.
- C8.2 da co preview lich va detail bang `<details>`, nhung logic name-only fallback co rui ro map nham du lieu legacy.

## C8.3 implementation

- `getTeacherScheduleSessions` chi tra ve ca co `session.teacherId === teacher.id`.
- Ca legacy chi co `teacherName` khong duoc tu dong dua vao "Lich day cua toi".
- Portal hien notice neu co ca legacy name-only hoac ca thieu `teacherId`.
- Card ca day van read-only, hien ngay/gio, ten ca, phong/co so, so hoc vien va trang thai.
- Detail ca trong Teacher Portal hien thong tin ca, hoc vien, ghi chu/trang thai va canh bao du lieu thieu.
- Empty state giu an toan khi giao vien khong co ca.

## Scope guard

- Khong tao Auth/login that cho giao vien.
- Khong check-in/check-out.
- Khong upload anh hay Supabase Storage.
- Khong SQL, Supabase action, Edge Function, deploy.
- Khong tao attendance record, session report moi, hay attendance-to-tuition automation.
- Khong update `tuition.usedSessions`.
- Khong mutate schedule/teacher/attendance/tuition khi chi render lich.

## Manual QA

1. Mo module Giao vien.
2. Mo ho so mot giao vien co ca TKB gan `teacherId`.
3. Mo Teacher Portal preview va kiem tra "Lich day cua toi" chi co ca cua giao vien do.
4. Mo chi tiet ca, kiem tra thong tin read-only va khong co hanh dong check-in/check-out/anh.
5. Mo giao vien khong co ca, kiem tra empty state.
6. Neu co ca legacy chi co `teacherName`, kiem tra notice hien ra va ca do khong tu dong chen vao lich.
