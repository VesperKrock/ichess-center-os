# F23.2 — Phụ huynh, Tư vấn, Học viên: Relationship & Lifecycle Design

```text
F23_2_STATUS: DONE DESIGN
F23_2_FINAL_TECHNICAL_AUDIT: PASS
F23_2_IMPLEMENTATION_READINESS: BLOCKED
F23_2_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_2_SQL_CHANGE: NO
F23_2_MIGRATION_CHANGE: NO
F23_2_RLS_CHANGE: NO
F23_2_AUTH_CHANGE: NO
F23_2_SUPABASE_ACTION: NOT RUN
F23_2_REAL_DATA_CHANGE: NO
```

## 1. Phạm vi, cách đọc và kết luận

F23.2 là **design-only**. Tài liệu chốt domain boundary và handoff contract cho F23.3E; nó không chứng minh backend CRM, guardian service, relationship service hoặc conversion runtime đã tồn tại. Không có thay đổi `src/`, SQL, migration, RLS, Auth, Supabase, Storage hoặc dữ liệu thật; closeout chỉ đồng bộ audit status và canonical roadmap sau external final technical audit `PASS`.

Bốn nhãn bằng chứng được dùng nhất quán:

- **REPO FACT**: hành vi hoặc cấu trúc đang tồn tại và có file/line làm bằng chứng.
- **PARTIAL FOUNDATION**: nền hiện hữu có thể tái sử dụng sau review nhưng chưa đủ canonical/security contract.
- **DESIGN PROPOSAL**: contract tương lai F23.3E phải implement; không phải repo fact.
- **DEFERRED**: quyết định hoặc runtime nằm ngoài F23.2 và cần phase/approval riêng.

Kết luận domain:

```text
CONTACT_OR_LEAD_IS_PARENT_PROFILE: NO
CONTACT_OR_LEAD_IS_STUDENT_PROFILE: NO
CONSULTATION_CASE_IS_A_PERSON: NO
CONSULTANT_ASSIGNMENT_IS_PERSON_OWNERSHIP: NO
PARENT_PROFILE_IS_AUTH_ACCOUNT: NO
STUDENT_PROFILE_IS_AUTH_ACCOUNT: NO

CRM_LOCALSTORAGE_IS_CANONICAL_MULTI_USER_SOURCE: NO
F23_2_CANONICAL_BACKEND_IMPLEMENTED: NO
F23_2_REAL_CONVERSION_IMPLEMENTED: NO
```

## 2. Repo truth audit

### 2.1 Bảng bằng chứng

| # | Khu vực | Phân loại | Bằng chứng và kết luận |
|---|---|---|---|
| 1 | Module Phụ huynh–Tư vấn CRM | REPO FACT | `src/main.js:639-646` nạp `parentConsultations`; `src/parent-consultation-module.js:989-1062` render module gắn nhãn local-safe. Đây là một mảng contact phía browser, chưa phải contact/case backend tách riêng. |
| 2 | Ba stage CRM | REPO FACT | `src/parent-consultation-module.js:15-21` định nghĩa chính xác `lead`, `consulting`, `converted`; `:819-856` có thể derive stage từ field/linked student/care activity. Stage hiện là presentation/workflow field trên cùng contact record. |
| 3 | Form thêm khách mới | REPO FACT | `src/parent-consultation-module.js:54-58` có wizard bốn bước; `:141-168` cho phép nhập contact, student candidate, stage/status và consultant name; `:300-322` validate ở client. Form chưa tạo consultation case riêng. |
| 4 | Detail và care logs | REPO FACT | `src/parent-consultation-module.js:1188-1260` render detail/history; `:627-680` tạo care log trong contact object và có thể đẩy stage `lead` sang `consulting`; `src/main.js:20798-20828` ghi lại toàn mảng vào localStorage. |
| 5 | F23.3D convert preview | REPO FACT | `src/parent-consultation-module.js:1308-1390` chỉ render preview, ghi rõ chưa tạo parent/student/tuition/class/attendance và disable confirm; `:2492-2516` chỉ build view model; `src/main.js:20653-20712` chỉ đổi temporary UI state. |
| 6 | CRM keys/IDs hiện tại | REPO FACT | `src/parent-consultation-module.js:549-620` dùng `contact-${Date.now()}`, `studentId`, `linkedStudentIds`, `consultantId`, timestamps; `src/storage.js:2174-2231` normalize các field đó. Không có `center_id` trong record, `contact_version`, `consultation_case_id` hoặc `case_version`. |
| 7 | CRM namespace theo center | PARTIAL FOUNDATION | `src/storage.js:21-59,88` tạo key `ichessCenterOS.parentConsultations.<currentStorageCenterId>` và `:1107-1129` đọc/ghi localStorage. Namespace giảm va chạm browser nhưng selector phía client, không phải row authority, transaction hoặc multi-user source. |
| 8 | Module Học viên và student ID | REPO FACT | `src/student-data.js:3` khóa vocabulary `Đang theo học`, `Bảo lưu`, `Ngưng học`; seed dùng `student.id` (`:18-20`), create dùng `stu-${Date.now()}` (`src/student-module.js:415-440`). Form create hiện default `Đang theo học` (`:79-104`), nên F23.3E không được gọi form hiện tại như một conversion shortcut cho student chưa enrolled. Cloud bridge dùng `local_id = student.id` và payload giữ shape (`docs/online-student-realtime-c3-2.md:15-35`; `src/cloud-realtime-students.js:209-230`). Identity hiện phải hiểu theo tuple exact-center, entity type và `student.id`, không phải global person ID. |
| 9 | Parent-like data | REPO FACT | Student đang nhúng `parentName`, `fatherPhone`, `motherPhone`, `parentPhone`, notes (`src/student-module.js:79-104,127-159`); validation hiện bắt buộc parent name và ít nhất một phone (`:331-353`). `src/parent-consultation-module.js:904-965` dựng contact hiển thị từ student và group theo phone/fallback; repo không có guardian profile canonical. Current student form vì vậy không phải guardian/relationship service và không thể được F23.3E tái dùng mù quáng. |
| 10 | Học viên ↔ Học phí | REPO FACT | `src/student-tuition-links.js:127-151` tìm tuition bằng equality `record.studentId === student.id` và đọc parent fields từ student. Tuition cloud bridge dùng entity `tuition_record_package`, stable record id riêng và bắt buộc `studentId` (`src/cloud-tuition-record-package-bridge.js:277-307`). |
| 11 | Parent/student relationship hiện tại | PARTIAL FOUNDATION | CRM có `studentId`/`linkedStudentIds` (`src/storage.js:2191-2197,2240-2251`) và student nhúng một nhóm parent fields; không có relationship row, type, status, version hay M:N integrity. F22.4 xác nhận đây chỉ là read-only wiring và chưa có bảng parent (`docs/noi-hoc-vien-phu-huynh-hoc-phi-f22-4.md:8-24`). |
| 12 | Generic cloud/localStorage | REPO FACT | Student và tuition vẫn local-first/cache (`src/storage.js:266-285,471-490`) nhưng có cloud/realtime bridge; CRM chỉ localStorage. `src/cloud-db-sync.js:135-179` có generic center/entity list trả payload; `:214-251` có generic upsert. |
| 13 | Consultant role hiện tại | REPO FACT | `src/online-access-control.js:1-36` có machine role `consultant`, cho generic cloud read và chặn app-level write. Đây chỉ là client/app policy, không cấp assigned-resource authority. |
| 14 | F23.13D contract | REPO FACT | Audited design `docs/f23-13d-consultant-provisioning-capability-matrix-va-server-enforcement.md:111-147,277-350,360-455,845-904` chốt exact-center, assigned-only, server-derived capabilities, server masking, MFA/step-up cho reveal, allowlisted PII write và cấm generic read/write. Runtime resolver/masking/MFA vẫn chưa implement (`:57-83`). |
| 15 | Direct bypass paths | REPO FACT | Browser code gọi trực tiếp `center_cloud_entities.select/upsert` (`src/cloud-db-sync.js:135-160,214-251`; tuition bridge `:35-64,66-125`). Snapshot schema có broad active-member SELECT/INSERT/UPDATE (`supabase/migrations/20260722000000_remote_schema.sql:365-400`). Vì policy cùng command được OR, F23.13D coi read inventory và broad write remediation là blocker; UI guard không đủ. |

### 2.2 Những gì preview hiện tại không chứng minh

F23.3D có candidate scoring phone/name/birth evidence (`src/parent-consultation-module.js:2613-2738`) và nói rõ không auto merge (`:1338-1349`), nhưng candidate UI:

- không phải reviewed identity decision;
- không exact-center server-authorized;
- không khóa identity race;
- không có source version/idempotency;
- có thể hiển thị raw phone trong browser;
- không tạo guardian, student, relationship hoặc conversion request.

`mergeParentContactsWithStudents` dùng phone làm group key (`src/parent-consultation-module.js:859-895,2279-2287`). Đó chỉ là **PARTIAL FOUNDATION** cho presentation. F23.3E không được dùng grouping này để auto-link, merge hoặc reuse identity.

## 3. Canonical entity boundary

### 3.1 Contact / khách mới

Contact là dữ liệu tiếp cận ban đầu, không phải người đã được xác nhận:

```text
crm_contact
  crm_contact_id
  center_id
  display_name
  contact_methods
  initial_interest
  source
  contact_status
  contact_version
  created_at
  updated_at
```

Contact có thể thiếu tên nếu có contact method hợp lệ, có thể chứa alias hoặc thông tin do người khác cung cấp. Nó không mặc nhiên là guardian, student, Auth account, membership, enrollment hoặc tuition profile.

### 3.2 Consultation case / hồ sơ tư vấn

Case là tiến trình nghiệp vụ, không phải person identity:

```text
consultation_case
  consultation_case_id
  center_id
  primary_contact_id
  status
  interest_summary
  case_version
  opened_at
  closed_at

consultation_case_candidate_student
  candidate_id
  center_id
  consultation_case_id
  display_name_evidence
  birth_evidence
  learning_need_evidence
  candidate_version
```

Một contact có nhiều case theo thời gian; một case có nhiều candidate students. Appointment, enrollment draft và care log thuộc case/resource, không thuộc person profile.

### 3.3 Guardian profile / phụ huynh thật

Thuật ngữ model là `guardian`; UI có thể hiển thị “Phụ huynh/người giám hộ” theo F2-AG1.

```text
guardian_profile
  guardian_id
  center_id
  display_name
  contact_methods
  guardian_status
  guardian_version
  created_from_case_id
  created_at
  updated_at
```

Guardian là center-scoped business profile đã được xác nhận. Guardian không phải Auth user và conversion không tạo/link account.

### 3.4 Student profile / học viên thật

```text
student_profile
  student_id
  center_id
  display_name
  student_status
  student_version
  created_from_case_id
  created_at
  updated_at
```

F23.3E phải preserve canonical student ID strategy của Module Học viên: current source identity là exact tuple `(center_id, student.id)`. Migration/adapter có thể expose tên field `student_id`, nhưng không silently re-key record. Student lifecycle giữ vocabulary đang có:

```text
Đang theo học
Bảo lưu
Ngưng học
```

Tạo student từ conversion không được tự chọn `Đang theo học` nếu chưa có enrollment. F23.3E cần một approved mapping cho “canonical profile tồn tại nhưng chưa enrolled”; nếu current vocabulary chưa biểu đạt an toàn thì creation phải block hoặc một student-profile lifecycle phase riêng phải được duyệt, không được silently thêm status trong F23.2.

### 3.5 Guardian–student relationship

```text
guardian_student_relationship
  relationship_id
  center_id
  guardian_id
  student_id
  relationship_type
  is_primary_contact
  financial_contact_role
  academic_contact_role
  status
  relationship_version
  created_at
  ended_at
```

Relationship là entity riêng, versioned và auditable. Cùng phone/email, cùng địa chỉ hoặc cùng surname không tạo relationship.

```text
ONE_GUARDIAN_CAN_LINK_MULTIPLE_STUDENTS: YES
ONE_STUDENT_CAN_LINK_MULTIPLE_GUARDIANS: YES
ONE_STUDENT_MUST_HAVE_EXACTLY_ONE_PRIMARY_CONTACT: APPROVAL_REQUIRED
ONE_GUARDIAN_CAN_HAVE_MULTIPLE_CONSULTATION_CASES: YES
ONE_CONSULTATION_CASE_CAN_DESCRIBE_MULTIPLE_CANDIDATE_STUDENTS: YES
```

Baseline đề xuất là M:N. `relationship_type` không hardcode tất cả thành Bố/Mẹ; catalog đầu gồm `PARENT`, `LEGAL_GUARDIAN`, `CAREGIVER`, `EMERGENCY_CONTACT`, `OTHER_REVIEWED`. Legal role, primary academic contact và payment contact là các chiều khác nhau. `financial_contact_role` chỉ là metadata, không cấp quyền ghi tài chính.

### 3.6 Auth và membership

Guardian/student profile có thể được link tới Auth account trong workflow protected tương lai, nhưng F23.2/F23.3E không tạo, tìm hoặc link Auth account bằng phone/email. Person profile, account, center membership và relationship là các entity/lifecycle khác nhau.

## 4. Cardinality và ownership

| Source | Quan hệ | Target | Invariant |
|---|---:|---|---|
| Center | 1:N | Contact, case, guardian, student, relationship | Mọi row có cùng exact `center_id`; foreign key cross-center bị từ chối. |
| Contact | 1:N | Consultation case | Case có đúng một primary contact; additional contact participants **DEFERRED**. |
| Case | 1:N | Candidate student | Mỗi candidate là evidence trong case, chưa phải student. |
| Case/resource | 0..1 active, N history | Consultant assignment | Tối đa một exclusive active assignee theo default; assignment history không bị rewrite. |
| Guardian | M:N | Student | Chỉ qua explicit relationship row. |
| Student | 0..N | Tuition record/package | Tuition có identity riêng và `studentId`; conversion không tạo record. |
| Case | 1:N attempts | Conversion request | Có thể retry/review nhiều request, nhưng tối đa một completed canonical conversion outcome. |
| Conversion request | 0..N | Guardian/student/relationship actions | Mỗi action có explicit decision, target và version. |

Consultant assignment thuộc case, queue item hoặc approved CRM resource. Nó không sở hữu guardian/student identity:

```text
CONSULTANT_ASSIGNMENT_TARGET_IS_CASE_OR_RESOURCE: YES
CONSULTANT_ASSIGNMENT_TARGET_IS_GUARDIAN_IDENTITY: NO
CONSULTANT_ASSIGNMENT_TARGET_IS_STUDENT_IDENTITY: NO
CONSULTANT_UNASSIGN_DELETES_PERSON_DATA: NO
```

Reassign làm thay đổi current case/care-log authority và bump assignment version; guardian/student/relationship không đổi owner, lịch sử giữ actor cũ, prior consultant mất authority ngay theo current server decision.

## 5. Source → target mapping

### 5.1 Legacy/local CRM sang canonical CRM foundation

Đây là migration/adaptation map tương lai, không phải conversion implementation.

| Current source | Canonical target | Rule |
|---|---|---|
| Storage namespace center | `center_id` | Server derive exact center; client value chỉ selector, không copy như authority. |
| `contact.id` | `crm_contact.legacy_source_id` hoặc preserved `crm_contact_id` sau migration review | Không coi Date.now ID là global; uniqueness luôn exact-center. |
| `parentName` | `crm_contact.display_name` | Contact evidence; không tự ghi `guardian_profile.display_name`. |
| `phone`, `secondaryPhone`, `email` | `crm_contact.contact_methods` | Normalize/version để search candidate; raw value không là identity/lock/audit key. |
| `source`, `interestedProgram`, `locationArea` | Contact metadata/case interest | Field allowlist và classification; coarse location cho consultant projection. |
| `customerStage`, `consultationStatus` | Reviewed initial contact/case status | Không 1:1 silent rename; dùng mapping ở §6.2 và flag conflict nếu inconsistent. |
| `leadNeed`, `preferredSchedule`, `parentFeedbackAboutChild` | Case/candidate summaries | Không copy vào canonical student private note tự động. |
| `leadStudentName`, `leadStudentAge`, `studentBirthYear` | Candidate student evidence | Chưa tạo student; birth evidence được tối thiểu hóa và masked. |
| `consultantId`, `consultantName`, `advisorName` | Assignment candidate/display evidence | Server resolve approved consultant ID và assignment; name không là authority. |
| `careLogs[]` | Case care logs | Preserve ordering/history/opaque IDs; content classification review; không copy sang `student.careNotes`. |
| `appointments[]` | Case appointment resources | Gắn case, center, version; không tạo class/schedule session. |
| `enrollmentDraft` | Case enrollment draft | Draft only; không finalize student/enrollment/tuition/payment. |
| `studentId`, `linkedStudentIds` | Reviewed existing-student reference evidence | Recheck exact-center student ID/version; không tự tạo relationship. |
| `lastNote`, `lastContactAt`, `nextAction` | Derived case projection | Canonical source là care log/case fields; không dùng denormalized value làm identity. |

### 5.2 Current student/tuition sang canonical relationship view

| Current source | Target/decision | Rule |
|---|---|---|
| `student.id` | `student_id` | Preserve within exact center; cloud key is `(center_id, student, local_id)`. |
| `student.currentStatus` | `student_status` | Preserve existing vocabulary; CRM stage không mutate. |
| `student.parentName/phones` | Guardian match evidence | Không tự tạo/reuse guardian và không chứng minh relationship. |
| `student.classSessionIds` | Enrollment/class domain | Ngoài conversion; không fill từ preferred schedule. |
| `tuition_record_package.studentId` | Student reference | Read-only downstream link; conversion does not create/update tuition. |
| `tuition.id` / cloud `local_id` | Tuition identity | Giữ độc lập với `studentId`; một student có nhiều kỳ/gói. |

### 5.3 Conversion request sang targets

| Request decision | Canonical effect khi F23.3E implement | Required evidence |
|---|---|---|
| `CREATE_NEW_GUARDIAN` | Insert one exact-center guardian | Approved no-reviewed-match outcome, current source versions. |
| `REUSE_REVIEWED_GUARDIAN` | Reference existing guardian, never merge | `EXACT_REVIEWED_MATCH`, target ID/version, reviewer/policy evidence. |
| `REQUIRE_DUPLICATE_REVIEW` | No target write; request → `CONFLICT`/review | Candidate set and safe reason. |
| `DO_NOT_CREATE_GUARDIAN` | Explicit no guardian target | Approved exception/reason; never inferred from blank field. |
| `CREATE_NEW_STUDENT` | Insert one student profile only | Approved status mapping; no enrollment side effect. |
| `REUSE_REVIEWED_STUDENT` | Reference exact existing student | Exact-center reviewed match plus target version. |
| `REQUIRE_DUPLICATE_REVIEW` | No student write | Review required. |
| `DO_NOT_CREATE_STUDENT` | Explicit no student target | If guardian would otherwise be created without a student outcome, request is denied by atomicity policy. |
| `CREATE_RELATIONSHIP` | Insert versioned explicit row | Both target IDs exact-center and role/primary policy valid. |
| `REUSE_EXISTING_RELATIONSHIP` | No duplicate insert | Existing relationship ID/version and identical active semantics. |
| `UPDATE_APPROVED_RELATIONSHIP_ROLE` | Versioned allowlisted role update | Reviewer approval, current relationship version. |
| `REQUIRE_RELATIONSHIP_REVIEW` | No relationship mutation | Conflict or primary-contact policy review. |
| `DO_NOT_CREATE_RELATIONSHIP` | No relationship row is created or reused | Explicit approved exception/reason, current endpoints/policy versions and no primary-contact/safeguarding violation; never inferred from omission. |

Không có `AUTO_MERGE_EVERYTHING`.

Mọi proposed guardian–student pair phải có đúng một relationship decision. Empty/missing relationship actions are invalid input, not a business outcome. Nếu cả guardian và student đều được create/reuse, default bắt buộc `CREATE_RELATIONSHIP`, `REUSE_EXISTING_RELATIONSHIP`, `UPDATE_APPROVED_RELATIONSHIP_ROLE` hoặc `REQUIRE_RELATIONSHIP_REVIEW`; `DO_NOT_CREATE_RELATIONSHIP` chỉ hợp lệ theo exceptional policy được approve rõ ràng.

## 6. Lifecycle models và mappings

### 6.1 Canonical lifecycle vocabularies

```text
Contact: NEW | CONTACTED | QUALIFIED | UNQUALIFIED | ARCHIVED
Case: OPEN | CONSULTING | PAUSED | READY_FOR_CONVERSION | CONVERTED | LOST | CANCELLED | ARCHIVED
Guardian: ACTIVE | INACTIVE | MERGE_REVIEW | ARCHIVED
Student: Đang theo học | Bảo lưu | Ngưng học (preserve repo vocabulary)
Relationship: ACTIVE | INACTIVE | ENDED | MERGE_REVIEW
```

```text
CRM_STAGE_DIRECTLY_MUTATES_STUDENT_STATUS: NO
CRM_STAGE_DIRECTLY_MUTATES_GUARDIAN_STATUS: NO
CONVERTED_CASE_CAN_RETURN_TO_OPEN_WITHOUT_REVERSAL_FLOW: NO
```

### 6.2 Mapping ba stage/status hiện tại

| Current value | Canonical interpretation | Migration rule |
|---|---|---|
| `customerStage=lead` | Contact `NEW` hoặc `CONTACTED`; case có thể chưa tồn tại | Dựa audit events/evidence; không tự đoán chỉ từ absence. |
| `customerStage=consulting` | Contact thường `QUALIFIED`; case `OPEN`, `CONSULTING` hoặc `PAUSED` | Require case creation/migration review. |
| `customerStage=converted` | Legacy presentation claim | Chỉ map case `CONVERTED` nếu có committed target outcome; nếu thiếu thì conflict, không bịa conversion. |
| `newLead` | Contact `NEW` | Case optional. |
| `waitingResponse`, `activeCare` | Case `CONSULTING` hoặc `PAUSED` tùy evidence | Review follow-up state. |
| `trialScheduled`, `pendingEnrollment` | Case `CONSULTING` hoặc `READY_FOR_CONVERSION` | Trial/draft không tự chứng minh readiness. |
| `converted` | Candidate case `CONVERTED` | Require target IDs + completed request. |
| `paused` | Case `PAUSED` | Non-terminal. |
| `closed` | Case `LOST`, `CANCELLED` hoặc `ARCHIVED` | Reason required; no silent choice. |

### 6.3 Required transitions

Mọi mutation là narrow server operation; browser không set arbitrary status. `source_version` phải bằng current row version; success bump `target_version = source_version + 1` và ghi audit/outbox trong cùng database transaction.

| Transition | Caller authority / capability | Preconditions + assignment | Version/audit | Retry, terminal và reversal |
|---|---|---|---|---|
| Contact `NEW → CONTACTED` | Assigned consultant: `crm.lead.update_assigned`; approved CRM operator equivalent | Exact center, contact active, current assignment/resource scope, allowlisted interaction evidence | Recheck source contact + assignment versions; target contact version +1; `crm.contact_updated`, and `crm.case_status_changed` only if case also changed | Same idempotency key returns prior result; non-terminal; correction is new audited transition. |
| Contact `CONTACTED → QUALIFIED` | Assigned consultant: `crm.lead.update_assigned`, or exact approver policy | Exact center/current assignment, contact requirements met, no unresolved scope conflict | Recheck source contact/assignment versions; target contact version +1; `crm.contact_updated` with safe reason | Retry idempotent; can later become `UNQUALIFIED`, never erase evidence. |
| Contact `CONTACTED/QUALIFIED → UNQUALIFIED` | Assigned consultant: `crm.lead.update_assigned`, or supervisor equivalent | Exact center/current assignment, reason code, no executing conversion | Recheck source contact/assignment versions; target contact version +1; safe status audit | Terminal for active lead work; reopen requires protected explicit flow. |
| Contact `UNQUALIFIED → ARCHIVED` | `crm.contact.archive` (new capability to approve) | Exact center, retention policy, no open case; assignment check is not applicable to the retention service | Recheck source contact/policy versions; target contact version +1; archive audit | Terminal; restore is separate protected action. |
| Qualified contact → case `OPEN` | `crm.case.create` (new capability to approve) | Exact center; caller has current contact assignment or approved queue authority; contact `QUALIFIED` and current; at least one interest/candidate summary | Recheck source contact/assignment versions; new target case version 1; `crm.case_opened`; assignment set server-side | Idempotency by request key; no duplicate case for same approved intent. |
| Case `OPEN → CONSULTING` | Assigned consultant: `crm.case.update_assigned` (new exact capability) | Exact center, active current assignment, case/contact current, eligible status | Recheck source case/assignment versions; target case version +1; `crm.case_status_changed` | Safe retry; non-terminal. |
| Case `OPEN/CONSULTING → READY_FOR_CONVERSION` | Assigned consultant: `crm.conversion.request_assigned` (new capability); approval policy controls readiness | Exact center/current assignment, required source fields and drafted actions, no unresolved match conflict | Recheck source case/contact/assignment/policy versions; target case version +1; `crm.conversion_requested` | Retry same intent; not terminal; edits invalidate preview/readiness. |
| Case `READY_FOR_CONVERSION → CONVERTED` | Protected server `crm.conversion.execute` after independent `crm.conversion.approve`; consultant cannot self-approve by client claim | Exact center, current assignment or approved handoff, approved request, source versions current, reviewed match decisions, locks and audit ready | Recheck all source/target versions; atomically bump case/request/target versions; `crm.conversion_completed` | Same key returns same completed output; terminal; never reopen silently. |
| Case `OPEN/CONSULTING → LOST` | Assigned consultant: `crm.case.update_assigned`, or supervisor equivalent | Exact center/current assignment, reason code, no executing/completed conversion | Recheck source case/assignment versions; target case version +1; `crm.case_status_changed` | Terminal for case; new demand opens a new case. |
| Case `OPEN/CONSULTING → CANCELLED` | Assigned operator: `crm.case.update_assigned`, or supervisor cancellation capability | Exact center/current assignment or approved supervisor scope, cancellation reason, no executing conversion | Recheck source case/assignment versions; target case version +1; status audit | Terminal; reversal requires protected new case or approved reversal. |
| Case `CONSULTING → PAUSED` | Assigned consultant: `crm.case.update_assigned` | Exact center/current assignment, pause reason/follow-up time | Recheck source case/assignment versions; target case version +1; status audit | Safe retry; non-terminal. |
| Case `PAUSED → CONSULTING` | Assigned consultant: `crm.case.update_assigned` | Exact center/current assignment, current source versions, resume reason | Recheck source case/assignment versions; target case version +1; status audit | Safe retry; non-terminal. |
| Case `PAUSED → CANCELLED` | Assigned consultant `crm.case.update_assigned` or supervisor cancellation capability | Exact center/current assignment or supervisor scope, reason, no conversion execution | Recheck source case/assignment versions; target case version +1; status audit | Terminal; reversal is protected. |
| Case terminal → `ARCHIVED` | `crm.case.archive` retention capability | Exact center, retention policy, immutable history retained; assignment check is not applicable to retention service | Recheck source case/policy versions; target case version +1; archive audit | Terminal visibility transition, no hard delete; restore is protected. |

Guardian lifecycle không dùng CRM stage. `ACTIVE → INACTIVE/MERGE_REVIEW/ARCHIVED` và mọi reversal là profile-governance flow riêng. Student lifecycle chỉ đổi qua Module Học viên/enrollment authority, không qua CRM conversion.

## 7. Identity evidence, duplicate review và no-auto-merge

```text
PHONE_MATCH_AUTO_MERGES_GUARDIAN: NO
EMAIL_MATCH_AUTO_MERGES_GUARDIAN: NO
NAME_MATCH_AUTO_MERGES_PERSON: NO
CONTACT_MATCH_AUTO_LINKS_AUTH_ACCOUNT: NO
CROSS_CENTER_PERSON_AUTO_MERGE_ALLOWED: NO
```

Normalized phone/email/name, candidate student name và birth evidence chỉ tạo candidate. Match service trả một trong:

```text
NO_MATCH
POSSIBLE_MATCH
PROBABLE_MATCH
EXACT_REVIEWED_MATCH
CONFLICT
```

Chỉ `EXACT_REVIEWED_MATCH` được reuse. Nó phải bind exact center, identity kind, opaque target ID + version, source contact/case versions, normalization/policy versions, evidence digests, reviewer/authority, decision time, reason và expiry/review validity. Không ghi raw phone/email/full birth data vào mutex, idempotency hoặc audit.

`NO_MATCH` cho phép proposal create-new sau khi mutex/recheck; `POSSIBLE_MATCH`/`PROBABLE_MATCH` bắt buộc review; nhiều candidates hoặc evidence bất nhất trả `CONFLICT`. Name-only không bao giờ được reuse. Match không link Auth.

### 7.1 Exact-center boundary

```text
F23_2_RELATIONSHIP_SCOPE: EXACT_CENTER
F23_2_CROSS_CENTER_PROFILE_REUSE_ALLOWED: NO
F23_2_CROSS_CENTER_DUPLICATE_LOOKUP_ALLOWED: NO
```

Server derive center từ session/membership/resource. Request `center_id` chỉ selector và phải khớp. Không query, disclose candidate count, reuse hoặc merge profile center khác. Cùng người có thể có hai center-scoped profiles; cross-center resolution là **DEFERRED** cho protected central authority riêng.

## 8. Stable roots, mutex và canonical lock order

### 8.1 Stable center CRM root

```text
center_crm_control
  center_id
  crm_schema_version
  identity_policy_version
  conversion_policy_version
  updated_at
```

```text
CENTER_CRM_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE
CENTER_CRM_MUTATION_ROOT: CENTER_CRM_CONTROL_ROW
EMPTY_CONTACT_SET_PROVIDES_SERIALIZATION: NO
EMPTY_GUARDIAN_SET_PROVIDES_SERIALIZATION: NO
EMPTY_STUDENT_SET_PROVIDES_SERIALIZATION: NO
```

Mọi mutation CRM/conversion khóa exactly-one root trước. Missing/duplicate root trả `crm_policy_stale` hoặc `crm_conversion_conflict` theo operation và không mutate.

### 8.2 Identity-match mutex

```text
identity_match_mutex_key =
  versioned_digest(
    environment_fingerprint,
    center_id,
    identity_kind,
    canonical_normalized_identity_digest
  )
```

`identity_kind`: `GUARDIAN_PHONE`, `GUARDIAN_EMAIL`, `STUDENT_BIRTH_IDENTITY`. Multiple keys được dedupe rồi lock theo bytewise stable-key order.

```text
RAW_PHONE_OR_EMAIL_USED_AS_MUTEX_VALUE: NO
IDENTITY_MATCH_UNIQUENESS_REPLACES_MUTEX: NO
SAME_MATCH_EVIDENCE_SHARES_ONE_MUTEX: YES
```

Mutex serialize review/conversion ceremony nhưng không chứng minh same person. Normalization version đổi khi review pending phải dừng policy, hoặc dùng reviewed dual-key equivalence/barrier; không đổi algorithm giữa transaction.

### 8.3 Canonical future conversion lock order

F23.3E executor-only, chạy sau một independent approval đã commit, phải acquire theo đúng thứ tự dưới đây; các row cùng tier theo stable opaque ID/key. Executor-only không consume lại raw step-up assertion:

```text
0. CENTER_CRM_CONTROL_ROW
1. IDENTITY_MATCH_MUTEX_ROWS
2. CONSULTATION_CASE_AND_CONTACT_ROWS
3. GUARDIAN_PROFILE_ROWS
4. STUDENT_PROFILE_ROWS
5. GUARDIAN_STUDENT_RELATIONSHIP_ROWS
6. CONSULTANT_ASSIGNMENT_AND_CARE_LOG_ROWS
7. CONVERSION_REQUEST_ROWS
8. AUDIT_OUTBOX_ROWS
```

```text
F23_2_CONVERSION_LOCK_ORDER_DEFINED: YES
CENTER_CRM_ROOT_PRECEDES_IDENTITY_MATCH_MUTEX: YES
IDENTITY_MATCH_MUTEX_PRECEDES_PROFILE_ROWS: YES
F23_2_LOCK_ORDER_INVERSION_ALLOWED: NO
```

Không khóa contact rồi quay lại root, guardian rồi quay lại mutex, gọi external service hoặc chờ human reviewer khi giữ DB lock.

## 9. F23.3E handoff contract

### 9.1 Request envelope

```text
crm_conversion_request
  conversion_request_id
  center_id
  consultation_case_id
  source_case_version
  source_contact_version
  source_assignment_version
  identity_policy_version
  conversion_policy_version
  requested_guardian_actions
  requested_student_actions
  requested_relationship_actions
  match_decisions
  action_graph_digest
  idempotency_key
  status
  created_by
  created_at
  updated_at
```

Approval evidence có thể nằm cùng request hoặc một exact linked row:

```text
crm_conversion_approval
  approval_id
  conversion_request_id
  center_id
  approval_status
  approved_by_user_id
  approved_at
  approval_expires_at
  approval_version
  approved_action
  approved_purpose
  approved_action_graph_digest
  approved_source_case_version
  approved_source_contact_version
  approved_assignment_version
  approved_identity_policy_version
  approved_conversion_policy_version
  approved_match_decision_versions
  approver_security_version
  approver_session_version
  step_up_assertion_id
```

`step_up_assertion_id` là opaque reference; approval không lưu TOTP, recovery code, factor secret, challenge answer hoặc sensitive assertion payload.

Statuses:

```text
DRAFT
READY_FOR_REVIEW
APPROVED
EXECUTING
COMPLETED
CONFLICT
COMPENSATION_REQUIRED
CANCELLED
```

Allowed request transitions are versioned: `DRAFT → READY_FOR_REVIEW → APPROVED → EXECUTING → COMPLETED`; review can send `READY_FOR_REVIEW → DRAFT/CONFLICT/CANCELLED`; execution failure returns `CONFLICT` or, only for a genuine cross-domain saga, `COMPENSATION_REQUIRED`. Client cannot set `EXECUTING`/`COMPLETED`.

```text
F23_2_CONVERSION_EXECUTES_REAL_MUTATION: NO
F23_3E_MUST_USE_IDEMPOTENCY_KEY: YES
F23_3E_MUST_RECHECK_SOURCE_VERSIONS: YES
F23_3E_MUST_NOT_AUTO_MERGE_POSSIBLE_MATCH: YES
```

### 9.2 Conversion action graph và relationship completeness

Mỗi guardian, student và relationship action có envelope:

```text
action_id
source_candidate_id
decision
target_id
target_version
reason_code
review_evidence_id
policy_version
```

Mọi proposed guardian–student pair có đúng một decision trong catalog:

```text
CREATE_RELATIONSHIP
REUSE_EXISTING_RELATIONSHIP
UPDATE_APPROVED_RELATIONSHIP_ROLE
REQUIRE_RELATIONSHIP_REVIEW
DO_NOT_CREATE_RELATIONSHIP
```

Rules:

- Khi guardian và student đều create/reuse, không được silently omit relationship. Bốn outcome create/reuse/update/review là default; explicit no-relationship cần exceptional approval.
- Khi guardian action là `DO_NOT_CREATE_GUARDIAN`, planned pair vẫn phải có `DO_NOT_CREATE_RELATIONSHIP`, hoặc graph bị từ chối inconsistent; missing target không được tạo FK giả.
- Khi student action là `DO_NOT_CREATE_STUDENT`, áp dụng cùng rule: explicit no-relationship hoặc reject.
- Duplicate decisions cho cùng normalized pair là conflict; relationship endpoint phải trỏ đúng approved guardian/student actions cùng exact center.
- Server structurally validates completeness, endpoint references and pair uniqueness before acquiring mutation locks; under canonical locks it rechecks exact-center targets, current versions/policy and approval coverage before mutation. Empty list hoặc omitted payload không có authority.

Evidence bắt buộc cho mỗi `DO_NOT_CREATE_RELATIONSHIP`: exact guardian/student action IDs và decisions; approved exception/reason code; relationship policy version; review evidence cùng reviewer/approver identity; proof không vi phạm primary-contact/safeguarding invariant; current source versions và endpoint target versions. Thiếu bất kỳ evidence nào thì decision chưa được approve và graph không executable.

```text
MISSING_RELATIONSHIP_ACTION_IS_APPROVED_NO_RELATIONSHIP: NO
DO_NOT_CREATE_RELATIONSHIP_REQUIRES_EXPLICIT_APPROVAL: YES
EMPTY_RELATIONSHIP_ACTION_LIST_IS_BUSINESS_DECISION: NO
EXISTING_GUARDIAN_AND_STUDENT_MAY_SILENTLY_OMIT_RELATIONSHIP: NO
CONVERSION_ACTION_GRAPH_MUST_BE_INTERNALLY_CONSISTENT: YES
CONVERSION_APPROVAL_BINDS_EXACT_ACTION_GRAPH_DIGEST: YES
EXECUTOR_ACCEPTS_ACTION_GRAPH_DIFFERENT_FROM_APPROVAL: NO
```

### 9.3 Conversion approval là protected security mutation

Independent `crm.conversion.approve` yêu cầu approver MFA policy met và một fresh, single-use F23.13C assertion bound exact resource/action/purpose. Step-up không thay capability/approval; approval cũng không thay step-up.

```text
F23_2_CONVERSION_APPROVAL_REQUIRES_MFA_POLICY_MET: YES
F23_2_CONVERSION_APPROVAL_REQUIRES_FRESH_STEP_UP: YES
F23_2_CONVERSION_APPROVAL_CLIENT_CLAIM_IS_AUTHORITY: NO
F23_2_STEP_UP_CONSUMPTION_MUST_BE_ATOMIC_WITH_APPROVAL: YES
CONVERSION_APPROVAL_BINDS_SOURCE_AND_POLICY_VERSIONS: YES
CONVERSION_APPROVAL_BINDS_APPROVER_SECURITY_SESSION_VERSIONS: YES
EXPIRED_OR_STALE_CONVERSION_APPROVAL_CAN_EXECUTE: NO
```

Approval binds exact:

```text
approver canonical_user_id
approver eligible account/security state
center_id
consultation_case_id
conversion_request_id
action = crm.conversion.approve
purpose
source case/contact/assignment versions
identity/conversion policy versions
match-decision versions
exact action-graph digest
step-up assertion ID/version
security_version
session_version
server time
```

Client role, client MFA flag, `approved=true`, UI confirmation, stale assertion hoặc assertion của action/purpose/resource khác không có authority.

### 9.4 Independent approval atomic protocol

```text
CONVERSION_APPROVAL_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROW, approver
2. STEP_UP_ASSERTION_ROW
3. CONVERSION_REQUEST_AND_APPROVAL_ROWS
4. AUDIT_OUTBOX_ROWS
5. COMMIT_ATOMIC
CONVERSION_APPROVAL_ATOMIC_END
```

Trong cùng transaction, server rechecks canonical account, membership, role/capability, MFA policy, security/session versions; rechecks request/case/source/assignment/policy/match-decision versions và exact action-graph digest; validates assertion exact account/session/center/action/purpose/request/resource and freshness; consumes assertion; transitions approval/request; appends audit/outbox; then commits. Nếu approval mutation hoặc audit fail, assertion consumption rollback. Không chờ reviewer hoặc gọi external service khi giữ locks.

```text
CENTER_CRM_ROOT_PRECEDES_APPROVER_ACCOUNT_SECURITY_LOCK: YES
APPROVER_ACCOUNT_SECURITY_LOCK_PRECEDES_STEP_UP_ASSERTION_LOCK: YES
STEP_UP_ASSERTION_CONSUMED_BEFORE_APPROVAL_COMMIT_ONLY_WITHIN_ATOMIC_TRANSACTION: YES
CONSUME_STEP_UP_THEN_CALL_CONVERSION_APPROVAL_API_ALLOWED: NO
```

### 9.5 Protected executor semantics

Recommended split:

```text
assigned consultant
→ preview/request review

independent authorized approver
→ approve with MFA met + fresh resource-bound step-up

protected server executor
→ execute current approved request
```

Executor không tin browser approval và không consume lại assertion đã dùng cho approval. Nó rechecks current/non-expired/non-revoked approval evidence, exact approved action-graph digest, source case/contact/assignment versions, match-decision versions, target versions, identity/conversion/relationship policy versions, approver security/session versions and current eligible security state, plus target exact center. Nó chỉ execute exact approved actions; payload mới không được mở rộng target/decision. Nếu split executor không thể bảo đảm consistent current-version/invalidation check trong protected transaction, nó phải deny và dùng combined protocol; không được check ngoài transaction rồi fail open.

```text
PROTECTED_CONVERSION_EXECUTOR_REUSES_RAW_STEP_UP_ASSERTION: NO
PROTECTED_CONVERSION_EXECUTOR_RECHECKS_CURRENT_APPROVAL_EVIDENCE: YES
PROTECTED_CONVERSION_EXECUTOR_MAY_EXPAND_APPROVED_ACTIONS: NO
```

Nếu executor recheck phát hiện approval expired/revoked/stale, security/session drift, graph mismatch hoặc source/policy drift, conversion không chạy và request về safe conflict/review state. Executor-only transaction dùng order §8.3.

### 9.6 Combined approve-and-execute composition

Nếu policy yêu cầu fresh step-up tại execution và implementation gộp approve + execute, toàn bộ phải ở một protected transaction theo exact order:

```text
CONVERSION_APPROVE_EXECUTE_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. IDENTITY_MATCH_MUTEX_ROWS, stable sorted order
2. ACCOUNT_SECURITY_CONTROL_ROW, approver
3. STEP_UP_ASSERTION_ROW
4. CONSULTATION_CASE_AND_CONTACT_ROWS
5. GUARDIAN_PROFILE_ROWS
6. STUDENT_PROFILE_ROWS
7. GUARDIAN_STUDENT_RELATIONSHIP_ROWS
8. CONSULTANT_ASSIGNMENT_AND_CARE_LOG_ROWS
9. CONVERSION_REQUEST_AND_APPROVAL_ROWS
10. AUDIT_OUTBOX_ROWS
11. COMMIT_ATOMIC
CONVERSION_APPROVE_EXECUTE_ATOMIC_END
```

`CENTER_CRM_CONTROL_ROW` và stable-sorted identity mutexes là approved business-root tier trước F23.13C security overlay. Assertion consume, approval, exact target mutation, case/request terminalization và audit/outbox cùng commit/rollback.

```text
F23_2_STEP_UP_COMPOSITE_LOCK_ORDER_DEFINED: YES
BUSINESS_ROOTS_PRECEDE_CONVERSION_ACCOUNT_SECURITY_LOCK: YES
CONVERSION_ACCOUNT_SECURITY_LOCK_PRECEDES_ASSERTION_LOCK: YES
CONVERSION_ASSERTION_LOCK_PRECEDES_REMAINING_TARGET_ROWS: YES
F23_2_STEP_UP_LOCK_ORDER_INVERSION_ALLOWED: NO
CONSUME_ASSERTION_THEN_CALL_CONVERSION_EXECUTOR_ALLOWED: NO
```

Nếu assertion store và business database khác transaction domain, chỉ approved reservation/finalize protocol bind exact request/assertion/action/graph được phép: short TTL, single claim, idempotency, commit/finalize/cancel/expiry, immutable audit and recovery. Không được consume assertion rồi gọi business API riêng, không silently lose claim và không tuyên bố atomic giả.

### 9.7 Server preflight/capabilities

F23.3E server preflight must verify:

1. canonical account/session and server-derived exact center;
2. eligible membership/Staff/security state per F23.13D;
3. exact capability, assignment resource + version and immutable denies;
4. exactly-one CRM root and current schema/identity/conversion policy versions;
5. case `READY_FOR_CONVERSION`, source contact/case versions and no terminal outcome;
6. idempotency key uniqueness scoped to environment + center + operation;
7. reviewed match decisions and exact target versions;
8. complete internally consistent action graph, explicit relationship outcome and exact approval-covered graph digest;
9. relationship/primary-contact/safeguarding policy;
10. current independent approval evidence or valid combined approve/execute protocol;
11. audit/outbox availability and transaction boundary.

New conversion capabilities require approval/catalog work. Assigned consultant may `crm.conversion.preview_assigned` and request review; an independent authorized role uses `crm.conversion.approve` with MFA + fresh step-up; a protected server executor performs mutation. Consultant/client never self-claims approval or executor authority.

### 9.8 Response and idempotency

Success returns opaque request/case/guardian/student/relationship IDs, versions, decision codes and safe audit correlation only. Same idempotency key + identical intent returns the exact prior committed result; same key + different intent returns `crm_conversion_conflict`. No response reveals cross-center candidates, Auth existence, raw match values or private student/finance data.

## 10. Atomicity and failure outcomes

Future F23.3E database transaction has one commit boundary:

```text
guardian create/reuse decision
+ student create/reuse decision
+ guardian-student relationship decision
+ case CONVERTED state
+ conversion request terminal state
+ audit/outbox
```

```text
F23_3E_PARTIAL_PARENT_WITHOUT_STUDENT_OUTCOME_ALLOWED: NO
F23_3E_CASE_CONVERTED_WITHOUT_TARGET_OUTCOME_ALLOWED: NO
F23_3E_AUDIT_FAILURE_CAN_COMMIT_CONVERSION: NO
```

“Student outcome” có thể là explicit reuse/create/do-not-create decision per approved request; không được là missing/unknown. Nếu action tạo guardian nhưng student decision/write fail, toàn transaction rollback. Nếu mọi target cùng một database domain, phải atomic. Nếu tương lai thêm dependency ngoài domain, dùng protected reservation/saga/compensation và không tuyên bố rollback atomic giả.

| Failure | Canonical outcome |
|---|---|
| Root missing/duplicate hoặc policy stale | Không lock tiếp/không write; request giữ reviewable hoặc `CONFLICT`; safe error. |
| Approval thiếu MFA/fresh exact assertion | Deny `crm_step_up_required`; request không `APPROVED`, assertion mismatched không consumed, no target mutation. |
| Assertion consumed nhưng same-store approval/combined execution/audit fail | Atomic unit đang consume assertion rollback assertion + approval/business/audit. Executor-only chạy sau committed independent approval không consume/reuse assertion: it leaves no business mutation and returns retryable/conflict against the committed approval evidence. |
| Independent approval stale/expired/revoked khi executor chạy | Executor deny `crm_conversion_approval_stale`; không reuse assertion, không mutate target/case. |
| Approved action graph khác execution payload | Deny `crm_conversion_approval_mismatch`; no expanded action/target and no mutation. |
| Source contact/case/assignment version stale | Không target write; request `CONFLICT`; case không converted. |
| Possible/probable/multiple match | Không reuse/create under same evidence; `REQUIRE_DUPLICATE_REVIEW`; release locks before human review. |
| Two conversions same case | Root/case/request serialize; một commit, request còn lại returns same idempotent outcome or `crm_conversion_already_completed`; không duplicate. |
| Two cases same identity evidence | Shared identity mutex serialize; second re-runs match and requires review/reuse/create based on current state. |
| Guardian/student/relationship insert conflict | Rollback all conversion mutations; request `CONFLICT`; no partial person/link. |
| Audit/outbox insert fail | Rollback database transaction; no converted case. |
| Outbox delivery after committed outbox row fails | Conversion stays committed, delivery retries from durable outbox; audit record itself already committed. |
| External dependency introduced later | Keep saga pending/restricted; on irrecoverable partial side effect set `COMPENSATION_REQUIRED`; never hide partial state. |
| Security/capability service unavailable | Fail closed `crm_security_service_unavailable`; no write and no raw fallback. |

## 11. Forbidden automatic effects

Conversion must not automatically:

```text
CREATE_AUTH_ACCOUNT
CREATE_CENTER_MEMBERSHIP
CREATE_TUITION_PACKAGE
CREATE_PAYMENT
CREATE_CASHFLOW_TRANSACTION
CREATE_CLASS_ASSIGNMENT
CREATE_SCHEDULE_SESSION
CREATE_ATTENDANCE_RECORD
CREATE_GRADE_RECORD
```

```text
CRM_CONVERSION_AUTO_CREATES_AUTH_ACCOUNT: NO
CRM_CONVERSION_AUTO_CREATES_TUITION: NO
CRM_CONVERSION_AUTO_ENROLLS_CLASS: NO
CRM_CONVERSION_AUTO_CREATES_ATTENDANCE: NO
```

Student có thể tồn tại mà chưa enrolled, chưa có class/schedule/attendance/grade/tuition/payment/Auth. Mọi domain đó cần workflow, authority, version, audit và approval riêng.

## 12. Consultant security, masking và care logs

F23.2 kế thừa, không nới F23.13D:

```text
F23_2_CLIENT_ROLE_IS_AUTHORITY: NO
F23_2_CLIENT_ASSIGNMENT_IS_AUTHORITY: NO
F23_2_MASKING_MUST_BE_SERVER_SIDE: YES
F23_2_GENERIC_RAW_CRM_READ_ALLOWED: NO
F23_2_GENERIC_CRM_WRITE_ALLOWED: NO
```

Required server capabilities/projections:

- exact-center and current assigned-resource check on every read/write;
- server-derived capability with deny precedence and policy/assignment versions;
- masked minimal contact projection before response leaves trusted boundary;
- full contact reveal only for exact resource/purpose with MFA and fresh step-up, short TTL, audit/rate limit, no persistent cache;
- PII update only through exact field allowlist and optimistic version;
- no generic `center_cloud_entities`/table read returning raw/full records for browser filtering;
- no generic arbitrary payload write; broad RLS remediation and direct-API/read-path QA are production blockers;
- cached/revealed PII and stale JWT do not survive unassign/reassign current decision.

Care log model:

```text
care_log
  care_log_id
  center_id
  consultation_case_id
  author_user_id
  entry_type
  safe_content
  care_log_version
  created_at
```

Care log belongs to case/resource. It cannot mutate guardian/student, initiate conversion, set terminal case status, contain credentials/secrets, copy automatically to student private notes or expand assignment. Reassign and care-log write lock the same resource root/version; stale writer fails. After conversion, logs remain historical on the converted case.

## 13. Audit and safe errors

Minimum safe events:

```text
crm.contact_created
crm.contact_updated
crm.case_opened
crm.case_assigned
crm.case_reassigned
crm.case_status_changed
crm.care_log_created
crm.conversion_previewed
crm.conversion_requested
crm.conversion_approved
crm.conversion_approval_denied
crm.match_candidate_found
crm.match_reviewed
crm.conversion_conflict
crm.conversion_completed
crm.relationship_created
crm.access_denied
```

Audit contains only opaque IDs, exact center, safe event/decision/reason, actor, assignment, versions and request/idempotency correlation. It excludes raw phone/email/address, child identity, credential, full payload and SQL/RLS internals.

Safe error catalog:

```text
crm_center_scope_denied
crm_assignment_required
crm_case_not_found
crm_case_stale
crm_case_status_conflict
crm_contact_match_review_required
crm_guardian_match_review_required
crm_student_match_review_required
crm_relationship_conflict
crm_conversion_not_ready
crm_step_up_required
crm_conversion_approval_stale
crm_conversion_approval_mismatch
crm_conversion_already_completed
crm_conversion_source_stale
crm_conversion_conflict
crm_policy_stale
crm_security_service_unavailable
```

Errors do not reveal another center, candidate details/count, raw contact, Auth existence, private student/finance state or internal implementation.

## 14. Negative matrix F2-N1–F2-N36

| ID | Negative case | Exact fail-closed outcome |
|---|---|---|
| F2-N1 | Browser đổi `center_id` | Server-derived center mismatch → `crm_center_scope_denied`; no lookup/write, safe audit. |
| F2-N2 | Consultant đọc case không assigned | `crm_assignment_required`; no case existence/detail disclosure. |
| F2-N3 | Consultant đọc guardian/student canonical ngoài assignment | Deny minimal/full projection; no generic fallback or raw record. |
| F2-N4 | Contact bị coi là Parent | Schema/type guard rejects profile mutation; contact remains contact; explicit conversion required. |
| F2-N5 | Case bị coi là person | Reject person link/merge; case ID cannot populate guardian/student FK. |
| F2-N6 | Một phone khớp hai guardian | `CONFLICT` + `crm_guardian_match_review_required`; no reuse/merge/create until review. |
| F2-N7 | Email khớp guardian center khác | No cross-center lookup/result disclosure/reuse; local-center decision only. |
| F2-N8 | Hai requests đồng thời convert cùng case | Center/case/request locks serialize; one outcome, other idempotent result or already-completed error. |
| F2-N9 | Hai cases đồng thời tạo cùng guardian candidate | Same identity mutex; second rechecks and enters duplicate review or reviewed reuse; no blind duplicate. |
| F2-N10 | Hai cases đồng thời tạo cùng student candidate | Student evidence mutex; second rechecks; no blind duplicate/reuse. |
| F2-N11 | Retry same case conversion | Same key/intent returns prior result; different intent conflicts; no second targets. |
| F2-N12 | Contact version đổi sau preview | `crm_conversion_source_stale`; invalidate preview/request approval; no write. |
| F2-N13 | Case status đổi sau preview | `crm_case_status_conflict`; no conversion; require fresh preview/review. |
| F2-N14 | Consultant unassign during care-log update | Shared resource lock/version makes stale writer rollback; `crm_assignment_required`. |
| F2-N15 | Reassign concurrent with conversion request | Resource/version serialization; stale requester denied; no inherited person ownership. |
| F2-N16 | Guardian reused, student create fails | Whole DB transaction rollback; reuse reference creates no partial outcome; case not converted. |
| F2-N17 | Student reused, relationship create fails | Whole transaction rollback; case/request not completed. |
| F2-N18 | Attempt mark case converted before targets commit | Constraint/service order rejects; no `CONVERTED` without target decisions/outcome. |
| F2-N19 | Audit/outbox insert fails | Rollback conversion; no unaudited commit. |
| F2-N20 | Possible match auto-merge | Contract violation; request `CONFLICT`, requires reviewed decision. |
| F2-N21 | Name-only match reused | Reject with match-review error; name evidence alone never `EXACT_REVIEWED_MATCH`. |
| F2-N22 | Client claims phone/email/capability authority | Ignore claims; server derives evidence/capability; deny if canonical proof absent. |
| F2-N23 | Relationship already exists | Lock/recheck; exact same semantics → explicit reuse; different roles/status → relationship review/conflict. |
| F2-N24 | Two active primary contacts violate policy | `crm_relationship_conflict`; no role update until approved primary policy resolution. |
| F2-N25 | Conversion creates tuition package | Operation allowlist rejects/transaction absent; no tuition row. |
| F2-N26 | Conversion records payment/cashflow | Immutable finance deny; no finance mutation. |
| F2-N27 | Conversion enrolls class/schedule | Reject side effect; student remains unassigned/unenrolled. |
| F2-N28 | Conversion creates/links Auth account | Reject Auth side effect and do not reveal account existence. |
| F2-N29 | Generic cloud/table read requests raw PII | Deny generic path or return reviewed capability-aware minimal projection only. |
| F2-N30 | Server sends raw fields for client masking | Security contract failure; endpoint cannot ship; no browser-side masking fallback. |
| F2-N31 | CRM control row missing/duplicate | Fail closed before identity locks; no mutation, safe conflict/policy error. |
| F2-N32 | Normalization version changes during pending review | Freeze via reviewed barrier/dual key or invalidate review; no conversion under mixed versions. |
| F2-N33 | Conversion approval không có fresh exact-purpose/resource step-up | Deny `crm_step_up_required`; request không `APPROVED`; assertion khác purpose/resource không consumed; no target mutation. |
| F2-N34 | Assertion consumed rồi approval/executor hoặc audit fail | Atomic unit đang consume dùng same-store rollback assertion + approval/business/audit; executor-only sau committed independent approval không consume/reuse assertion và không mutate khi fail; distributed store dùng reservation/finalize; không mất assertion thiếu committed approval/business outcome. |
| F2-N35 | `DO_NOT_CREATE_GUARDIAN` nhưng relationship action bị bỏ trống | Inconsistent action graph; require explicit approved `DO_NOT_CREATE_RELATIONSHIP`; no approval/conversion/relationship mutation. |
| F2-N36 | Guardian và student đều create/reuse nhưng request thiếu relationship decision | Deny `crm_relationship_conflict`; request/case không completed/converted; no orphan pair from omitted payload. |

## 15. Threat model F2-T1–F2-T26

| ID / Threat | Likelihood | Impact | Mitigation | Residual risk | Implementation phase |
|---|---|---|---|---|---|
| F2-T1 Cross-center IDOR | High | Critical | Server-derived exact center, FK equality, no cross-center lookup, RLS/direct-API tests | Policy drift | Backend/RLS QA |
| F2-T2 Assignment bypass | High | High | Resource root, current assignment/version per request | Stale cache defects | Assignment service |
| F2-T3 Client-forged role/capability | High | Critical | Canonical server resolver, deny precedence | Resolver defect | F23.13D runtime |
| F2-T4 Generic CRM read bypass | High | Critical | Purpose endpoint/minimal projection; disable generic consultant read | Forgotten export/realtime path | Read remediation |
| F2-T5 Client-side PII masking | Medium | Critical | Server serialization/masking, no raw payload | Log/cache serializer drift | Masking QA |
| F2-T6 Phone/email auto-merge takeover | Medium | Critical | Evidence-only matching, human reviewed exact match | Reviewer error | Match service |
| F2-T7 Name-only false match | High | High | Never reuse name-only; conflict/review | Homonyms | Match policy |
| F2-T8 Duplicate guardian race | Medium | High | Center root + stable evidence mutex + recheck | Missing evidence | Concurrency QA |
| F2-T9 Duplicate student race | Medium | High | Student evidence mutex + reviewed birth policy | Sparse child data | Concurrency QA |
| F2-T10 Duplicate relationship race | Medium | High | Relationship lock/unique business invariant + semantic recheck | Role conflict | Relationship service |
| F2-T11 Stale preview conversion | High | High | Source/policy/assignment version recheck | Long review latency | Conversion service |
| F2-T12 Double conversion retry | High | High | Scoped idempotency + case terminal invariant | Key misuse | Idempotency QA |
| F2-T13 Partial conversion commit | Medium | Critical | One DB transaction; saga only for genuine external domain | Future integration complexity | F23.3E |
| F2-T14 Audit failure | Medium | Critical | Transactional audit/outbox, fail mutation | Outbox delivery lag | Audit service |
| F2-T15 Case/profile lifecycle conflation | High | High | Separate tables/status catalogs/operations | Legacy migration ambiguity | Migration review |
| F2-T16 Consultant ownership conflation | Medium | High | Assignment only on case/resource; profiles center-owned | UI wording drift | CRM UX/service |
| F2-T17 Care-log private-data leak | Medium | High | Content schema/classification, assigned scope, no auto-copy | Free-text misuse | Care-log phase |
| F2-T18 Auto-create finance | Medium | Critical | Typed conversion allowlist; immutable finance deny | Integration shortcut | F23.3E QA |
| F2-T19 Auto-create enrollment/class | Medium | High | Separate workflow; no class/schedule ops in transaction | Product pressure | Enrollment phase |
| F2-T20 Auto-create Auth account | Low/Medium | Critical | No Auth calls/account lookup; separate protected identity flow | Future coupling | Auth phase |
| F2-T21 Cross-center profile reuse | Medium | Critical | No lookup/reuse, exact-center mutex/IDs | Manual duplicate workload | Scope gate |
| F2-T22 Mutex/normalization drift | Medium | High | Versioned digest, dual-key/barrier, pending-review invalidation | Algorithm migrations | Identity service |
| F2-T23 Center-root lock inversion | Medium | Critical | Canonical order and deadlock/concurrency tests | New endpoint violation | DB integration QA |
| F2-T24 Cached/revealed PII after unassign | Medium | Critical | Current version checks, no-store reveal, invalidation/outbox, server deny | Client screenshots | F23.13D runtime |
| F2-T25 Step-up/approval atomicity bypass | Medium | Critical | Business roots → account security → assertion → approval/targets; atomic consume; executor rechecks evidence | Alternate endpoint or distributed integration defect | Approval/security integration + concurrency QA |
| F2-T26 Implicit relationship omission | Medium | High | Exact action graph, explicit `DO_NOT_CREATE_RELATIONSHIP` and pair-completeness validation | Migration adapter omits legacy pair decision | F23.3E request/relationship QA |

## 16. Approval gates F2-AG1–F2-AG19

| ID / Gate | Recommended default | Lý do | Rủi ro | Approver | Implementation phase |
|---|---|---|---|---|---|
| F2-AG1 Canonical term | Model `Guardian`; UI “Phụ huynh/người giám hộ” | Bao quát legal guardian/caregiver | Wording/legal mismatch | Product + Legal/Operations | Schema/UX |
| F2-AG2 Contact nhiều cases? | YES | Tách từng nhu cầu/đợt theo thời gian | Duplicate case noise | Product + CRM owner | Case service |
| F2-AG3 Case nhiều candidate students? | YES | Gia đình có nhiều bé | Review phức tạp | Product + CRM owner | Case model |
| F2-AG4 Student nhiều guardians? | YES | Đúng thực tế chăm sóc | Privacy/notification scope | Product + Privacy | Relationship service |
| F2-AG5 Exactly one primary? | APPROVAL REQUIRED; đề xuất đúng một active primary khi case family conversion hoàn tất, trừ approved no-guardian exception | Deterministic contact | Gia đình đặc thù/conflict | Product + Operations + Privacy | Relationship policy |
| F2-AG6 Relationship types | `PARENT`, `LEGAL_GUARDIAN`, `CAREGIVER`, `EMERGENCY_CONTACT`, `OTHER_REVIEWED` | Không hardcode Bố/Mẹ | Catalog quá rộng | Product + Legal | Catalog |
| F2-AG7 Financial/academic contacts | TÁCH RIÊNG | Role giao tiếp khác nhau | UI phức tạp | Product + Finance + Academic | Relationship policy |
| F2-AG8 Consultant scope | `ASSIGNED_ONLY` | Least privilege, kế thừa F23.13D | Queue handling chậm | Security + CRM owner | Assignment runtime |
| F2-AG9 Ai reassign case? | Center Admin/approved CRM supervisor; consultant không client self-claim | Separation of duty | Operational bottleneck | Security + Operations | Assignment service |
| F2-AG10 Phone/email confidence | Candidate evidence only; never auto-merge | Chống takeover/false match | Manual review | Privacy + Security | Match policy |
| F2-AG11 Reuse guardian | Chỉ `EXACT_REVIEWED_MATCH` exact-center/current version | Identity safety | Review latency | Privacy + CRM owner | Match review |
| F2-AG12 Reuse student | Chỉ `EXACT_REVIEWED_MATCH` exact-center/current version | Child-data safety | Duplicate profiles | Privacy + Student owner | Match review |
| F2-AG13 Cross-center lookup | NO initial rollout | Ngăn lookup/merge làm lộ danh tính giữa các center | Duplicate person records | Security + Privacy | Future central authority |
| F2-AG14 Create guardian with only student candidate? | Không tự động; explicit `DO_NOT_CREATE_GUARDIAN` exception hoặc review | Không bịa guardian | Student thiếu contact | Product + Operations | Conversion policy |
| F2-AG15 Create unenrolled student? | YES, nếu approved student-status mapping exists; otherwise block | Profile khác enrollment | Vocabulary gap | Student owner + Product | Student integration |
| F2-AG16 Care logs after conversion | Giữ trên converted case, assigned/history projection; không auto-copy | Preserve audit context | Long-term PII retention | Privacy + CRM owner | Retention/read service |
| F2-AG17 Reversal | Không silent reopen; protected reversal/compensation | Giữ terminal integrity | Vận hành phức tạp | Architecture + Operations | Reversal phase |
| F2-AG18 Production conversion | Chỉ sau canonical backend/root/mutex/services, F23.13D resolver+MFA+masking, RLS/read remediation, idempotent conversion, audit/outbox và direct-API/concurrency/failure QA | End-to-end fail closed | Rollout chậm | Security + Architecture + Product | Production gate |
| F2-AG19 Step-up consume tại approval hay execution? | Independent approval consumes fresh resource-bound step-up atomically; executor rechecks current evidence/graph; combined flow only in one transaction | Separation of duty, deterministic input, no external assertion handoff hoặc double consumption | Approval expiry adds retry friction; distributed composition defects | Security + Architecture + Product | Conversion approval/executor design |

## 17. Implementation blockers and readiness

F23.3E implementation/runtime remains blocked on:

- canonical center-scoped CRM backend and exactly-one `center_crm_control` root;
- versioned contact/case/candidate schemas and transition service;
- stable identity registry/mutex plus versioned normalization and duplicate-review workflow;
- guardian canonical service and Module Học viên adapter preserving exact-center student IDs/status vocabulary;
- explicit M:N guardian–student relationship service and approved primary/role policy;
- case/resource assignment service with stable root/version;
- F23.13D capability resolver, Staff/account/membership eligibility, MFA/step-up, invalidation and server masking;
- broad active-member write RLS remediation and complete generic SELECT/realtime/export/cache/read-path remediation;
- narrow capability-aware read/write/conversion endpoints; no generic table payload API;
- immutable audit/outbox, scoped idempotency registry and safe error mapping;
- F23.13C MFA-met/fresh step-up approval integration, approval-evidence lifecycle and same-store atomic or reviewed reservation/finalize protocol;
- exact action-graph digest, explicit no-relationship decision and guardian–student pair completeness validator;
- direct API/RLS, cross-center, duplicate, concurrency/deadlock, stale-version, rollback/outbox and security fixtures/tests;
- approved student-unenrolled status mapping, relationship catalog, production rollout and rollback/compensation runbook.

```text
F23_2_IMPLEMENTATION_READINESS: BLOCKED
F23_2_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_2_REAL_CONVERSION_IMPLEMENTED: NO
```

## 18. F23.3E design readiness and closeout boundary

The handoff contract is internally complete enough for F23.3E detailed design/implementation planning:

```text
F23.3E DESIGN: SAFE TO START
```

This does **not** mean F23.3E runtime or production is ready. F23.2 remains `DONE DESIGN`, `FINAL_TECHNICAL_AUDIT: PASS`, and implementation `BLOCKED`; runtime remains `NOT STARTED`. External final technical audit đã approve design closeout và canonical-roadmap update, không cấp implementation authority.

F23.2 FINAL CLOSEOUT COMPLETE - READY FOR CHECKPOINT
