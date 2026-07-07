# FB Admin DreamHome Vong 1-3 Settings Parent Wiring

## Boi canh

QA DreamHome Vong 1-3 sau hotfix render/input caret PASS can xu ly tiep Cài đặt cơ sở va Phụ huynh / Tư vấn. Prompt nay khong xu ly logic Bang diem danh.

## Root Cause

- Ca học / Lớp da luu chung qua `saveStoredClassSessions` va student form doc cung `classSessions`, nhung bootstrap cloud phu chi keo `student`, `teacher`, `schedule_session`, nen reload/cross-environment co the thieu `class_session`.
- Settings module chi render panel Ca học / Lớp va panel trang thai, chua co lai 3 tab product-facing.
- Parent module lay tu `parentConsultations`; neu chua tao CRM contact rieng thi module trong du hoc vien da co `parentName`, `fatherPhone`, `motherPhone`, `parentPhone`, `careNotes`.

## Patch Summary

- Them `class_session` vao cloud bootstrap counts va pull path; apply snapshot cloud vao local `classSessions` khi co du lieu.
- Giu write-through hien co: save/toggle Ca học / Lớp van goi `queueCoreCloudSync('class-session-save/status')`, va core sync push `classSessions` vao entity `class_session`.
- Settings co 4 tab: Thông tin cơ sở, Ca học / Lớp, Gói học phí, Dữ liệu mẫu. UI khong hien dev/debug/manual restore copy.
- Gói học phí doc danh muc tu `tuitionRecords` hien co, gom theo ten goi/so buoi/hoc phi.
- Phụ huynh / Tư vấn merge contact da luu voi danh ba derive tu Hoc vien, group theo phone hoac fallback parent+student, co detail va link mo ho so hoc vien.

## Data Mapping

- Class session storage: `CLASS_SESSIONS_KEY`, `getStoredClassSessions`, `saveStoredClassSessions`.
- Cloud entity: `CLOUD_ENTITY_TYPES.CLASS_SESSION` = `class_session` trong `center_cloud_entities`.
- Student parent fields: `parentName`, `fatherPhone`, `motherPhone`, `parentPhone`, `parentNotes`, `careNotes`.
- Parent derived fields: `parentName`, `phone`, `secondaryPhone`, `studentNames`, `relatedStudents`, `sourceLabel = Từ hồ sơ học viên`.

## Manual QA

- Mo Cài đặt cơ sở va kiem tra du 4 tab product-facing.
- Them/sua/ngung dung Ca học / Lớp, sau do mo Sua hoc vien de thay cung danh sach.
- Test cross local/GitHub Pages neu co tai khoan online: tao ca tren mot moi truong, reload moi truong kia va kiem tra bootstrap keo ve.
- Mo Phụ huynh / Tư vấn khi Hoc vien co phu huynh; tim theo ten phu huynh, SĐT, ten hoc vien; click Chi tiết; bam hoc vien lien quan.

## Deferred

- Bang diem danh baseline/nhap nen/check-in se xu ly o prompt rieng.
- Cloud sync gói học phí trong Settings chi doc tu hoc phi hien co; chua them CRUD danh muc goi doc lap trong prompt nay.

## Safety

- SQL: khong chay.
- Deploy/Edge Functions: khong chay.
- C8 Teacher: khong dung.
- Commit/push: khong chay.
- Schema cloud: khong doi, chi noi vao entity co san.

```txt
FB ADMIN DREAMHOME STATUS: VONG 1 3 SETTINGS PARENT WIRING
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
CENTER_CLASS_SETTINGS_CLOUD_WIRED: YES
CENTER_CLASS_SETTINGS_SHARED_WITH_STUDENTS: YES
CENTER_SETTINGS_INFO_TAB_ENABLED: YES
CENTER_SETTINGS_TUITION_PACKAGE_TAB_ENABLED: YES
CENTER_SETTINGS_SAMPLE_DATA_TAB_ENABLED: YES
CENTER_SETTINGS_DEV_COPY_HIDDEN: YES
PARENT_MODULE_DERIVED_FROM_STUDENTS: YES
PARENT_CONTACTS_GROUPED_BY_PHONE: YES
PARENT_CONTACT_DETAIL_LINKS_STUDENTS: YES
PARENT_SEARCH_FILTER_WORKS: YES
ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN
```
