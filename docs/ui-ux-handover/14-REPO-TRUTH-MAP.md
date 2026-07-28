# Repo truth map

Mục đích: giúp New GPT hoặc chat kỹ thuật truy ngược fact mà không dump source code vào Figma.

| Chủ đề | Nguồn chính trong repo | Fact nên lấy |
| --- | --- | --- |
| Module public | `src/modules.js` | Tên, mô tả và metadata status; phải đối chiếu renderer |
| Desktop/window/taskbar/Start | `src/main.js`, `src/styles.css` | Launcher, multi-window lifecycle, window controls, taskbar/notification |
| Login và center binding | `src/app-auth.js`, `src/app-login-gate.js`, `src/app-center-binding.js`, `src/supabase-auth.js` | Auth gate, membership/center states, display name |
| Generic online role | `src/online-access-control.js` | Role aliases, read/write floor và fail states |
| Local/cache data | `src/storage.js`, `docs/cloud-bootstrap-c4-5-core-entities.md` | Center namespace, cache/fallback và entity boundaries |
| Học viên | `src/student-module.js`, `src/student-detail.js` | List, form, detail, care/learning child views |
| Giáo viên | `src/teacher-module.js` | List, profile, form, staff link, teaching schedule |
| Nhân viên | `src/staff-module.js` | Staff/department/account/lifecycle/attendance surfaces |
| Schedule | `src/schedule-module.js` | Week grid, activity, tags, conflicts, reports, attendance |
| Attendance | `src/attendance-board-module.js` | Sheet, baseline, detail/note, locked state |
| Học phí | `src/tuition-module.js` | List, package/term, payment, history, evidence |
| Thu chi/Sổ quỹ | `src/cashflow-module.js`, `src/cashbook-module.js`, `src/finance-workspace-module.js` | Ledger, evidence, categories, detail, reconciliation |
| CRM/Kho/Báo cáo/Cài đặt | Module renderer tương ứng trong `src/` | Screen inventory và actual state |
| Hồ sơ hành chính | `src/staff-administrative-profile-module.js`, `src/staff-administrative-governance-module.js`, `src/staff-documents-module.js` | Role/action, sections, masking, documents, governance states |
| Tệp nhân sự private | `src/staff-document-attachments-supabase.js`, docs F23.11E/E.1/E.2 | Readiness, validation, private view/download, version/soft remove boundary |
| F23.11 canonical status | `docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md` | E.2A DONE, E.2B LATER, QA và migration immutability |

## Quy tắc sử dụng nguồn

1. Renderer/runtime thắng mô tả module cũ khi hai bên lệch về screen hiện có.
2. Docs phase cũ là historical context; status canonical lấy từ checkpoint mới nhất.
3. Test chứng minh marker/contract tự động, không thay manual visual QA.
4. CSS chứng minh property/breakpoint tồn tại, không chứng minh cảm nhận hoặc screenshot.
5. Không copy identifier, dữ liệu hoặc chi tiết security không cần thiết sang Figma.
