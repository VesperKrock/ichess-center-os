# Roadmap kỹ thuật trước PRR-0 — lưu trữ ngày 05/09/2026

> Đây là snapshot nguyên trạng của `RoadmapRealTime.txt` trước khi PRR-0 viết lại bản roadmap dành cho con người.
> Tài liệu này giữ lịch sử gate, chi tiết kỹ thuật và bằng chứng triển khai để tra cứu; không phải danh sách ưu tiên hiện hành.

---
ICHESS CENTER OS — CURRENT OPERATIONAL ROADMAP (reconciled 29/08/2026)

SOURCE OF CURRENT TRUTH
- Current production/frontend checkpoint: main = origin/main = 4fbd2f4d90393c24ad70dc439f5051de0e9f56e3 (`Enable Staff HR privacy and capability contracts`). Parent CRM, Inventory, C5.7 and C5.5 Staff/HR are READY in production.
- Production truth override: Parent-first CRM remains live for all six active centers; C5.6 `202608140009`, C5.7 `202608140010/011`, C5.5 `202608140007/008` and HR-1 `202608290001` are applied exactly. P3D/P4B remain excluded. Launcher contract is 12 visible / 12 actionable / 0 unavailable; Staff/HR is exposed under Giáo viên, not as a 13th tile.
- C5 DONE means code, local authoritative contracts and independent checkpoints are complete; it does NOT mean every C5 migration is deployed to production.
- Production evidence inherited from the OV1.5 final checkpoint: Core C5.1 + Attendance/Tuition C5.2 + Finance/Cashbook C5.4 + tuition-payment void + DreamHome/DreamHome_prod Schedule identity repairs are applied. PH-4C superseded C5.3/Parent-first status; INV-2 supersedes C5.6 status; OPS-1 supersedes C5.7 status; HR-2 supersedes C5.5 status. P3D/P4B remain absent.
- This dashboard overrides any older NEXT/PARTIAL/DEFER wording in the historical ledger below. The ledger remains for evidence, not active prioritization.

POST-V1 / PARENT-FIRST CRM — 25/08/2026
- PH-0: DONE / parent-first CRM rollout path proven.
- PH-1: DEPLOYED / migration 202608250001 applied; authoritative Parent CRM Contact <-> existing C5.1 Student link and protected Contact identity-update contract are present but production capability remains fail-closed.
- PH-2: DEPLOYED / capability-driven frontend live at 6e639e027027309f28fadaec30f31f7bb9a394fd.
- PH-3: ROLLOUT PACKAGE FROZEN / read-only production preflight complete; exact 14-migration allowlist, frontend-first safety, Vault prerequisite, exact-center activation, acceptance and containment gates locked.
- PH-4: DONE / the original 14 reviewed migrations, Vault prerequisite, exact-center control roots and PH-1 contracts are applied. The prior hosted Vault incompatibility was contained without partial activation or business residue and is superseded by PH-4A/PH-4C evidence.
- PH-4A: PRODUCTION APPLIED / hosted-compatible append-only migration `202608250002` removes the private Vault encrypt/nonce dependency from the active Parent-first path while preserving protected evidence, context binding, RLS and RPC boundaries.
- PH-4B: PREFLIGHT PASS / migration hash `EB5A10A649B0C28FFD89310486B4A0A44E87D66EDC5544548EAA420095E67C3B`; commit `b0d08fe16507d39424c43cffadecf95b43f9e2a7` pushed and Pages healthy. Production remains contained with PH-4A ledger/object absent. The unusable prior PH-4 VHD is not relied upon; backup gate was restored with a new owner-protected DPAPI logical archive whose hashes and independent restore/read digest comparison PASS.
- PH-4C: PRODUCTION PASS / exact PH-4A hash applied; objects verified before its sole ledger record; private Vault dependency remains zero; all six centers atomically moved SUSPENDED/DISABLED/v3 -> ACTIVE/ENABLED/v4. DreamHome and Phong Tester live Parent READY; Owner/Admin convergence, explicit Parent-Student link, protected Contact update, stale/idempotency, cross-center denial and direct-DML denial PASS. Synthetic QA active residue = 0; historical ARCHIVED/ENDED/tombstoned audit evidence retained; existing Student/Tuition/Finance digests unchanged.
- P3D: EXCLUDED. P4B: FROZEN / EXCLUDED. Blind `supabase db push`: FORBIDDEN.
- CURRENT: PARENT-FIRST CRM 100% DONE / LIVE FOR ALL SIX ACTIVE PRODUCTION CENTERS.
- NEXT OVERRIDE: Product Owner selects the next bounded POST-V1 backlog gate; do not automatically enable conversion/P4B or another undeployed domain.
- NEXT: POST-V1 PRODUCT OWNER DECISION.

POST-V1 / INVENTORY — 29/08/2026
- INV-0: DONE / C5.6 direct rollout path proven; no database forward-fix required.
- INV-1: DONE / capability-driven runtime deployed at `14e7b70495833565a6cfd3a77e6bf9b6ecf61d9d`; IDLE/LOADING/READY/UNAVAILABLE/FAILED boundary, center/account reset, Core-optional Student-link guard and Notification READY gating verified.
- INV-2: PRODUCTION PASS / exact migration `202608140009` with SHA-256 `4D7BD90677E3B3237514A1D684C472ECEEF22F9BCCE562E5B90082D9E92B24B1` applied through controlled SQL and recorded as the only new ledger entry after object/security verification.
- C5.6: APPLIED / five FORCE-RLS tables, two authenticated RPCs and one non-exposed helper verified; browser direct DML denied.
- INVENTORY: 100% LIVE / launcher 12 visible / 12 actionable / 0 unavailable.
- PRODUCTION ACCEPTANCE: item create/edit, stock IN/OUT, negative-stock denial, movement history, request workflow, expected-version/currentness, exact retry/idempotency, Owner/Admin convergence and refresh/fresh context PASS.
- CROSS-CENTER LEAK: 0 / cross-center write denied.
- ACTIVE QA RESIDUE: 0 / two synthetic items archived and one synthetic request cancelled; immutable movement/audit evidence retained.
- INTEGRITY: Student/Tuition/Finance/Parent CRM counts and SHA-256 digests unchanged.
- NEXT: NEXT POST-V1 PRIORITY.

POST-V1 / C5.7 OPERATIONS — 29/08/2026
- OPS-0: DONE / direct C5.7 rollout path proven and launcher capability-state residue removed locally without weakening fail-closed open behavior.
- OPS-1: PRODUCTION PASS / launcher cleanup deployed at `179bb6e603a81e6a28a9ea78da1db9c41bbe2bce`; Pages and live bundle HTTP 200.
- MIGRATIONS: exact `202608140010` SHA-256 `C1C9EACF39548E977CB2C09165CA6AC9DFCD156C4A3EACD4C1951F92933F8167` and `202608140011` SHA-256 `DB628B00196EAAEA4DBB864DAFE9D6B0B1A8E47D2115AF865A387940EB9F7129` applied one-by-one through controlled SQL and recorded individually only after object/security verification.
- SECURITY: all five C5.7 tables use RLS + FORCE RLS; browser direct DML denied; authenticated RPC-only authority, exact-center checks, version/currentness and idempotency preserved.
- ACCEPTANCE: custom Calendar tag/item, recurrence, Schedule action, Attendance Board note and Tuition monthly advisory note PASS; Owner/Admin convergence, fresh context, stale rejection, exact retry, changed-intent conflict and cross-center denial PASS.
- ACTIVE QA RESIDUE: 0 / exact synthetic active rows cleaned through a guarded allowlist; append-only audit/idempotency evidence retained without plaintext note leakage.
- INTEGRITY: Student/Class/Schedule core, Attendance, Tuition, Finance, Parent CRM and Inventory counts/digests unchanged against the verified protected preflight snapshot.
- EXCLUDED: P3D/P4B/C5.5 remain absent; no blind `supabase db push` and no unrelated migration applied.
- CURRENT: C5.7 LIVE / OPERATIONAL NOTES 100% DONE / LAUNCHER READY RESIDUE CLEAN.
- NEXT: NEXT POST-V1 PRODUCT OWNER PRIORITY.

POST-V1 / STAFF-HR — HR-2 PRODUCTION CLOSEOUT — 05/09/2026
- HR-0: DONE / C5.5 contract, dependency, Storage privacy and product-entry strategy audited.
- HR-1: DONE / privacy + capability forward-fix committed and deployed at `4fbd2f4d90393c24ad70dc439f5051de0e9f56e3`.
- HR-2: PRODUCTION PASS / exact migrations `202608140007`, `202608140008`, `202608290001` applied and ledger recorded in order; ledger 33 -> 36 exactly.
- C5.5: 100% LIVE / Staff capability READY at Giáo viên -> Nhân sự & hồ sơ; no 13th launcher tile; launcher remains 12 visible / 12 actionable / 0 unavailable.
- PRIVACY/GOVERNANCE: Owner/center_admin ordinary parity PASS; raw admin contract/local DB PASS with no safe live session; Owner-only retention/legal-hold governance preserved; ordinary snapshot PII and sensitive document metadata = 0; audited sensitive read and memory purge PASS.
- ISOLATION/AUTHORITY: cross-center leak = 0; cross-center write/sensitive read/attachment read denied; browser business authority = 0; legacy silent import/delete = 0.
- QA CLEANUP: operator-active QA residue = 0. Archived synthetic Staff/profile/document/attachment versions and immutable mutation/access/idempotency history are retained intentionally as audit evidence.
- INTEGRITY: pre-existing archived attachment metadata and objects unchanged; Teacher, Student, Class/Schedule, Attendance, Tuition, Finance, Parent CRM, Inventory and C5.7 unchanged outside explicitly classified synthetic Staff/attachment/audit evidence.
- P3D/P4B: ABSENT. No unrelated migration or 13th launcher tile introduced.
- CURRENT: C5.5 / STAFF-HR 100% LIVE.
- NEXT: POST-V1 ROADMAP RECONCILIATION.

ADMIN INPUT READINESS RECONCILIATION — 24/08/2026
STATUS: FUNCTIONAL PASS / AIR-1 DONE / DEPLOYED / AR-1 DONE / LIVE PASS / FPW-1 DONE / LIVE PASS / V1 PRODUCT HANDOFF READY.
- Primary finish-line `login → correct center → Student → Schedule → Attendance → Tuition/package → payment → Report → refresh/reload`: PASS by OV1.4 production acceptance, OV1.5 handoff and current targeted regressions.
- BLOCKS ADMIN INPUT: 0.
- BLOCKS DAILY OPERATION: 0 inside the accepted Operational V1 journey.
- FIX BEFORE REVIEW: 0. AR-1A/AR-1B now pass the real `calendarNotesAvailable` boundary into Schedule; `Quản lý nhãn` and `+ Thêm hoạt động` remain visible but disabled/non-focusable/non-actionable while C5.7 is absent, with zero request caused by their activation attempts.
- Admin review does NOT require deploying CRM/P4B, Staff/HR, Inventory, Calendar/Notes, Teacher account, Owner Recovery or another painted page.

AIR-1A CAPABILITY TRUTH AUDIT — READ-ONLY — 24/08/2026
- Production ledger and authenticated schema-cache probes agree: C5.3 (`202608140003/004` plus its canonical CRM prerequisites), C5.6 (`202608140009`) and C5.7 (`202608140010/011`) are not deployed; their list RPCs and principal tables return schema-cache missing.
- Phụ huynh / Tư vấn: recommendation `SHOW UNAVAILABLE`. The runtime has real CRM list/create/edit/archive/care-log/appointment/assignment/enrollment-draft capability and does not require P4B for ordinary CRM, but production lacks the canonical CRM/C5.3 read-write surface. Deployed direct-open currently shows an empty view plus raw missing-RPC failure while active actions remain visible; current AIR-1 local guard correctly blocks entry but hiding the whole product surface is not the only truthful option.
- Kho hàng: recommendation `SHOW UNAVAILABLE`. The runtime has real catalog/item/archive, stock movement/history and request workflow capability, but production lacks C5.6 tables/RPCs. Deployed direct-open currently shows zero data plus missing-RPC failure while create actions remain visible; current AIR-1 local guard correctly blocks entry.
- Tuition warning classification: `BACKEND-NOT-DEPLOYED`, specifically C5.7 monthly Attendance advisory/board notes. Student Care/Notes and the Tuition embedded Care/Notes panel remain shared through the authoritative C5.1 Student payload and are production-available; Report is unaffected. The current warning copy is broader than the failed capability.
- Smallest next action was executed as AIR-1B local-only: Parent/Consulting + Inventory are visible with `Chưa khả dụng`, disabled on Desktop/Start/notification/deep-open paths, and the Tuition warning is scoped to monthly-care/Attendance notes. No domain rollout is implied.

AIR-1B TRUTHFUL UNAVAILABLE MODULES + CARE/NOTES COPY — DONE — 24/08/2026
- PRODUCT OWNER QA PASS / INCORPORATED INTO AIR-1 DEPLOY: 12 visible product tiles = 10 actionable core + Parent/Consulting unavailable + Inventory unavailable; `Đang cập nhật` and Staff/HR absent.
- Unavailable activation is disabled for mouse/keyboard on Desktop and Start; notification/deep-open remains fail-closed before window creation or refresh; authenticated browser QA measured CRM/Inventory request delta = 0.
- Tuition preserves LOADING != FAILED and now states precisely that monthly-care/Attendance notes are unavailable while Student Care/Notes remains usable.
- AIR-1B remained local until the combined AIR-1C checkpoint; no backend/domain mutation was performed.

AIR-1C OPTIONAL CAPABILITY COPY HYGIENE + AIR-1 FINAL FREEZE — DONE — 24/08/2026
- C5.7 production absence is distinguished from a transient read failure: loading is neutral; settled absent says `hiện chưa khả dụng`; a genuine deployed-capability failure says `chưa tải được`.
- Schedule and Attendance retain usable core state and an informational/warning optional notice; Tuition retains the precise monthly-care/Attendance-note limitation while embedded Student Care/Notes remains usable.
- Commit `672ff0e9f116f9759d18455a189a3c7c19879b6c` pushed to main. GitHub Pages workflow `32741879164` completed successfully; live page and deployed JS returned HTTP 200 and contained the AIR-1C capability tokens.
- No migration, Supabase/Auth/Edge/Storage or production business-data mutation.

AR-1 LIVE ADMIN REVIEW REHEARSAL — DONE / LIVE PASS — 24/08/2026
- AR-1B checkpoint `8706ccfc516ba0d5e02bffa70752002944cce7b1` deployed by Pages workflow `32752002444` SUCCESS; live index/JS/CSS HTTP 200 and the served bundle contains the new Schedule capability boundary.
- Fresh live `DreamHome staging` reload and logout/login PASS. Launcher remains 12 visible / 10 actionable / 2 unavailable; placeholder and Staff/HR are absent; no raw RPC/schema/PGRST error is shown.
- Schedule core, week navigation, existing sessions, Add Session open/cancel and manual refresh PASS. When C5.7 is absent, `Quản lý nhãn` and `+ Thêm hoạt động` are disabled, non-focusable, expose no action selector, open no modal and produce zero action-triggered C5.7 request.
- Attendance core remains usable with precise optional-unavailable copy; Tuition retains the accepted monthly-care/Attendance-note wording; Student Care/Notes remains available. Light/Dark and persisted reload PASS.
- BLOCKER A = 0. FIX BEFORE ADMIN REVIEW B = 0. Teacher Staff/HR copy remains a non-blocking backlog item.
- No production business record/payment/attendance mutation, migration, Supabase/Auth/Edge/Storage configuration change or C5.7 deployment. Login/logout changed only the requested browser session.

FPW-1 FINAL PRODUCT WALKTHROUGH — DONE / LIVE PASS — 25/08/2026
- FPW-1 found one user-copy defect in Nhóm Tài chính: developer terms were visible to Admin. FPW-1A replaced them with plain Vietnamese without changing Finance authority, currentness, handlers or data.
- Commit `9cd689d213bec1f7ec59c83ee04a1554ef88556d` pushed to main. GitHub Pages workflow `32758245167` completed SUCCESS; live HTML and asset returned HTTP 200 and served the new Finance/Teacher copy.
- Mandatory live recheck PASS: Finance jargon = 0; Thu chi and Sổ quỹ open fresh; Teacher Staff/HR copy says `chưa khả dụng`; launcher remains 12 visible / 10 actionable / 2 unavailable; Schedule/Attendance/Tuition optional-capability semantics remain truthful; Light/Dark, reload and logout/login PASS.
- BLOCKER = 0. FIX BEFORE HANDOFF = 0. V1 PRODUCT HANDOFF = READY.
- No production business-data, migration, Supabase/Auth/Edge/Storage or backend mutation. Login/logout changed only the requested browser session.

ADMIN INPUT READINESS — CURRENT CORE SURFACES
- Giáo viên: FUNCTIONALLY READY for the minimum admin profile/teaching-data path; C5.1 Teacher authority is deployed and basic CRUD/reload/same-center/cross-center acceptance passed. Missing Teacher account/portal and certified paint are POST-V1, not input blockers.
- Bảng Điểm Danh: FUNCTIONALLY READY; Core + Attendance required, Tuition + Calendar/Notes optional; C5.2 production acceptance passed. Remaining F23.7 is presentation polish only.
- Học phí: FUNCTIONALLY READY and U4 PAINT-FROZEN; package CRUD, payment exactly-once, current collected balance, audited `Hủy khoản thu`, stale/idempotency/failure semantics and reload convergence passed.
- Finance/Thu chi/Sổ quỹ: FUNCTIONALLY READY at the C5.4 foundation used by payment and Report; advanced refund/bank reconciliation/arbitrary protected-transaction editing remains POST-V1.
- Báo cáo: FUNCTIONALLY READY and U3 PAINT-FROZEN; derived Core + Attendance + Finance refresh contract remains required and no new authority was created.

CLASSIFICATION OF EVERY REMAINING ROADMAP ITEM
Marker/group | Original meaning | Current truth / supersession | Operator impact + reason | Classification | Before Admin review? / smallest next gate
`Đang cập nhật` placeholder | Hold space for unknown future modules | AIR-1 removes it from the production launcher; it owns no business state | No longer distracts or misleads the reviewer | SUPERSEDED BY AIR-1 DEPLOYED | DONE; no domain rollout
Launcher status for CRM/Staff/Inventory | Present registered modules according to real capability | Parent/Consulting and Inventory are actionable from their deployed authorities; Staff/HR remains hidden because C5.5 is absent | Launcher is truthful at 12 visible / 12 actionable / 0 unavailable | DONE / DEPLOYED | No additional launcher/domain work
C5.3 + PH-1 Parent-first / P3D-P4B conversion | Canonical CRM, explicit Parent<->existing Student relationship, and separately verified lead conversion | Parent-first CRM CRUD/link is production DONE for all six active centers; no silent import/backfill. P3D/P4B conversion remains absent/frozen and received zero live requests | Ordinary Parent management is available; conversion is still intentionally unavailable | PARENT-FIRST DONE / CONVERSION POST-V1 IMPORTANT | Parent-first DONE; conversion only by a new explicit reviewed gate
C5.5 + Staff/HR production rollout | Shared Staff/HR authority, documents and derived attendance | HR-2 applied C5.5 + HR-1 exactly; Staff/HR is production LIVE under Giáo viên | Ordinary Staff operations are available with audited sensitive reads and Owner-only governance preserved | DONE / PRODUCTION APPLIED | DONE; no additional rollout gate
C5.6 Inventory production rollout | Shared inventory/item/movement/request authority | INV-2 applied C5.6 exactly; Inventory is production LIVE with capability-driven activation and acceptance PASS | Inventory CRUD/stock/request workflows are available with exact-center authority | DONE / PRODUCTION APPLIED | DONE; no additional rollout gate
C5.7 Calendar + Operational Notes production rollout | Custom non-class calendar items/tags and shared manual care/board notes | OPS-1 applied C5.7 exactly; Schedule custom activities/tags, Attendance Board notes and Tuition monthly advisory notes are production LIVE | Optional operational surfaces now converge without changing C5.1 Class/Schedule authority | DONE / PRODUCTION APPLIED | DONE; no additional rollout gate
F23.3E-P4B old “highest priority after C5” rule | Resume conversion immediately after C5 | Explicitly superseded by Operational V1 reconciliation; P4B stays frozen | Starting it now would widen security/rollout scope without helping the review path | SUPERSEDED | NO — Product Owner must explicitly open the later CRM/P4B gate
Attendance → Tuition auto-apply with Admin confirmation | Convert attendance-derived usage into Tuition automatically | Not implemented by design; Attendance and Tuition authoritative saves already work independently | Admin still records/updates the supported Tuition contract; no false automation exists | POST-V1 IMPORTANT | NO — separate design → preview → confirmed apply gate
C6.5/C6.6 + C7.4–C7.8 | Internal Console, provisioning, revoke/restore, acting mode and broader Access & Recovery Governance | Foundations/design and current Owner/Admin identities exist; full governance expansion is not complete | Does not block existing operators; matters for onboarding, compromise, replacement and support operations | POST-V1 IMPORTANT | NO — one Access & Recovery Governance gate after review
C7.10/C7.11 | Provision Teacher login accounts and separate Teacher profile from login identity | Admin Teacher profile is already separate enough for core scheduling; Teacher account provisioning is not complete | Teachers cannot receive the future dedicated login/workspace through this path | POST-V1 IMPORTANT | NO — Teacher account/provisioning gate only after governance prerequisites
C8.1/C8.7–C8.9 + T.7–T.11 | Secret Teacher Workspace, Teacher Auth, check-in and later public app/route | Secret branch is paused at T.7; not part of public Admin OS acceptance | No impact on Admin entry; touching it risks mixing secret work into main | POLISH / LATER | NO — keep paused until explicit secret-work resume
F22.8 + F23.8G | Advanced Tuition/Finance edit, cancel, refund and reconciliation flows | Package/payment are done; dedicated tuition-payment `POSTED → VOIDED` now supersedes the old generic “hủy” gap. Refund/bank refund/advanced reconciliation remain absent | Ordinary payment correction is supported; real refund/bank reconciliation still requires escalation | POST-V1 IMPORTANT | NO — narrowly specify refund/reconciliation; do not unlock arbitrary protected edits
F23.5E3/F23.5E4 | Calendar conflict by participant/staff and single-occurrence exceptions | Basic class conflict plus weekly-series behavior exists; advanced custom-calendar domain is not deployed | Edge scheduling convenience only; no effect on ordinary Class/Schedule input | POLISH / LATER | NO — calendar advanced-behavior gate after C5.7 rollout
F23.6C | Advanced Schedule export/document polish | Weekly print/PDF MVP already works | Optional export controls only | POLISH / LATER | NO — targeted export polish
F23.7 | Repaint standalone Attendance Board | Functional production path is accepted; no certified page paint has been frozen | Usable but visually older than U0–U4 | POLISH / LATER | NO — paint only after Product Owner explicitly selects the page
F22.5 + F23.15 + C9.0–C9.5 | Whole-system visual refresh, dashboard/icons/responsive/package polish | U0 Theme, U1 Student, U2 Schedule, U3 Report and U4 Tuition are DONE/deployed; the blanket “paint all” scope is partially superseded | Remaining pages (Teacher, Attendance Board, Finance/Cashbook, Settings, CRM, Staff, Inventory and dashboard) may look older but core inputs work | POLISH / LATER | NO — return to roadmap and select only a functionally ready page
Old Report drill-down and Tuition modal polish markers under F23.8 | Improve modal scroll, history/detail affordances and package save UX | U3/U4 certified paint and final U4 reconciliation now cover these concrete surfaces | No remaining operator gap proven by the old wording | SUPERSEDED | NO — new issue only if fresh Admin evidence reproduces it
F23.10C2 + Staff unlink confirm polish | Advanced Teacher↔Staff link lifecycle and replace native confirmation | Base relationship/lifecycle and C5.5 production authority are live; this marker remains optional interaction polish | No impact on ordinary Teacher/Staff operations | POLISH / LATER | NO — open only from new operator evidence
F23.11E.2B | Permanent private staff-document deletion executor | Soft removal/request/legal-hold foundation exists; permanent lifecycle is incomplete | Governance/retention risk for future HR operations, not current core input | POST-V1 IMPORTANT | NO — security-reviewed deletion/retention gate
F23.14 | Three-to-five-year retention/storage capacity | Not implemented as a complete operational policy | No daily input blocker, but material compliance/recovery planning remains | POST-V1 IMPORTANT | NO — retention, capacity and restore-test plan
C10.0/C10.2–C10.5 | Rollout, feedback, maintenance docs, backup export and multi-center scale-up | DreamHome pilot and operator runbook are done; broad rollout/feedback/maintenance/export/scale are not | Current designated centers can operate; expansion and recovery maturity are incomplete | POST-V1 IMPORTANT | NO — start with post-review feedback, then backup/maintenance/scale gates
Result page `2:4054` | Reserve a future learning-results surface | Hard-excluded and has no approved runtime capability | Making it actionable would invent unsupported business behavior | OBSOLETE | NO — DO NOT IMPLEMENT until a new product contract explicitly opens it
Cloud DB C2.2 generic readiness gate | Generic legacy pre-C5 cloud readiness | Removed/superseded by per-domain authoritative readiness | Reintroducing it would falsely block healthy core saves | OBSOLETE | NO — retain only as historical regression evidence
C3.2/C3.3/C3.4D + C4.6/C4.8/C4.9 + WAVE 2 CRITICAL + F23.16 | Old realtime, approval, checkpoint and return-to-secret phases | Absorbed by C5/OV1 or no longer scoped; C4.6 survives only as a standing safety rule | Re-running them adds no operator capability and risks historical churn | SUPERSEDED | NO — keep docs/tests as evidence; do not reopen as phases

BOUNDED OPERATOR FINISH PLAN
A. MUST BEFORE ADMIN REVIEW
- NONE. AR-1 live rehearsal and the focused Schedule capability recheck both pass with BLOCKER=0 and FIX BEFORE ADMIN REVIEW=0.

B. SHOULD IF TIME
- Run one short non-destructive Admin rehearsal from `docs/operational-v1-operator-runbook.md`: login, verify center, open/reopen and refresh Student/Schedule/Attendance/Tuition/Report, distinguish save failure from saved-but-refresh-failed, and rehearse the escalation checklist. No synthetic business mutation is required before the review.

C. AFTER REVIEW
- Capture Admin feedback first. Product Owner then chooses among CRM/P4B; C5.5 Staff/HR; C5.6 Inventory; C5.7 Calendar/Notes; Access & Recovery/Teacher provisioning; advanced Finance/refund; retention/backup/scale-up. Each remains an independent reviewed rollout gate.
- Remaining UI pages are optional paint gates only after their functional/deployment state is explicit.

D. DO NOT DO / SUPERSEDED / OBSOLETE
- Do not reopen old C3/C4/Wave-2/F23.16 phases, the generic C2.2 gate or the old automatic-P4B priority.
- Do not start Teacher secret work, arbitrary protected Finance edits or the excluded Result page.
- Do not run a full historical smoke sweep merely because its tests remain in the repository; keep those tests/docs as evidence and run targeted checks for the selected gate.

NEXT EXACT GATE
POST-V1 BACKLOG / OPTIONAL UI PAINT. Product Owner selects the next bounded gate; do not automatically start another backend/domain/UI rollout.

OPERATIONAL V1
STATUS: PASS — OPERATIONAL V1 COMPLETE.
DEFINITION: Owner/Admin đăng nhập đúng cơ sở → Học viên → Giáo viên tối thiểu phục vụ xếp lịch → Ca học/Lớp + TKB → Điểm danh → Học phí; server giữ truth; tài khoản cùng cơ sở hội tụ; reload/fresh browser dựng lại; khác cơ sở leak=0; lỗi không báo thành công giả và dùng tiếng Việt dễ hiểu.

DONE
- C5.0–C5.7 code/local contracts + C5 Closeout: DONE; ACTIVE_AUTHORITY trong browser-local = 0; legacy real/uncertain data được preserve, không upload/xóa ngầm.
- Login, canonical active center, exact-center isolation và Owner/Admin parity nền: DONE cho core path.
- Production Student/Class/Schedule save + reload/fresh context + same-center convergence + cross-center isolation: PASS.
- Production Core C5.1, Finance/Cashbook C5.4 và DreamHome Schedule identity repair: PASS.
- OV1.3: C5.2 migrations 202608140001/202608140002 applied qua controlled SQL; schema/RPC/RLS/grants/singleton/ledger/denylist verify PASS; OV1.2 frontend ccd823a4 deployed PASS.
- OV1.4: full authenticated production journey, Owner/Admin parity, cross-center isolation, payment + audited void, Schedule repairs và active QA residue=0 PASS.
- OV1.5: operator runbook, production evidence checkpoint, compact read-only verification và independent final review PASS.
- Cloud DB C2.2 readiness blocker cũ: OBSOLETE/CLEARED; không được dùng lại làm gate chung.

REMAINING OPERATIONAL-V1 BLOCKERS — 0
NONE. Mọi blocker thuộc định nghĩa Operational V1 đã đóng.

CORE MODULE AUDIT — CURRENT CLASSIFICATION
- Học viên: FUNCTIONALLY READY / production PASS; form density hoặc paint chỉ là polish.
- Ca học/Lớp + TKB: save path production PASS; Attendance/Calendar tùy chọn đã degrade an toàn ở OV1.2.
- Giáo viên: C5.1 Teacher authority đã có trên production; Core bắt buộc, Attendance/Staff tùy chọn đã tách ở OV1.2; basic CRUD production acceptance PASS ở OV1.4. Teacher account/portal và HR nâng cao không thuộc V1.
- Bảng Điểm Danh: Core + Attendance bắt buộc, Tuition + Calendar/Notes tùy chọn đã tách ở OV1.2; C5.2 production schema/RPC đã deploy ở OV1.3; authenticated production acceptance PASS ở OV1.4. Tân trang layout F23.7 chỉ là UI/POLISH.
- Học Phí: Core + Tuition bắt buộc, Attendance + Calendar/Notes tùy chọn, Finance chỉ khóa payment/current collected-balance khi unavailable; payment exactly-once + audited void + convergence production PASS ở OV1.4. Refund/bank refund/advanced reconciliation và modal polish không chặn V1.
- Nhóm Tài chính/Thu chi/Sổ quỹ: production C5.4 foundation PASS; flow nâng cao là POST-V1.
- Báo cáo/Cài đặt cơ sở: derived convergence và canonical center DONE; Báo cáo Core + Attendance + Finance đã production-accepted ở OV1.4 và U3 paint đã deploy; không mở authority mới.
- Phụ huynh/Tư vấn CRM: PRODUCTION READY through C5.3 + PH-1 + PH-4A for all six active centers. Nhân viên/HR, Kho hàng and custom Calendar/Notes remain code/local-only and must not become optional dependencies that break core modules.
- Đang cập nhật: non-business placeholder; OBSOLETE/REMOVE FROM ACTIVE V1.

P4B
CLASSIFICATION: POST-V1 IMPORTANT — NOT AN OPERATIONAL-V1 BLOCKER.
- Student create/manage đã production PASS độc lập với CRM conversion.
- Attendance và Tuition không phụ thuộc P4B.
- P4B kéo theo CRM migration/step-up/conversion rollout đang frozen và làm tăng security/rollout surface trước khi core flow ổn định.
- Sau V1, P4B là workflow kinh doanh quan trọng để nối lead/guardian/student; phải quay lại bằng gate riêng, không tự apply migration.

UI / POLISH
- UI PAINT: POST-V1 POLISH / U0–U4 CURRENT PAINT FREEZE COMPLETE; không chặn Operational V1.
- U0 Theme Foundation: DONE.
- U1 HỌC VIÊN: DONE / PAINT FREEZE / DEPLOYED.
- U2 THỜI KHÓA BIỂU: DONE / PAINT FREEZE / DEPLOYED.
- U3 BÁO CÁO: DONE / PAINT FREEZE / DEPLOYED.
- U4 HỌC PHÍ: DONE / PAINT FREEZE / DEPLOYED.
- NEXT: AR-1 Schedule optional-capability visibility remediation + focused live recheck; do not automatically open another UI Page.
- Figma Paint chỉ áp dụng cho page/module đã DONE; unfinished module không paint để che functional gap.
- Dự phòng: KẾT QUẢ HỌC TẬP — HARD EXCLUDE.
- Mọi thay đổi UI/paint tiếp theo là quyết định hậu V1; không tự mở từ checkpoint này.

SECRET / PAUSED
- Teacher Workspace secret local/teacher-workspace-secret: PAUSED tại T.7, OUTSIDE V1; không touch branch/stash/feature.
- Teacher account provisioning C7.10/C7.11: LATER, không đồng nhất với hồ sơ Giáo viên admin cần cho lịch.
- Owner/Admin Access & Recovery Governance (revoke/replace, immutable activity, daily checkpoint, Owner restore): POST-V1 IMPORTANT; basic login/parity và operator runbook đã đủ cho V1.

PRIOR NEXT GATE — SUPERSEDED
SUPERSEDED BY THE 24/08/2026 ADMIN INPUT DASHBOARD ABOVE. NEXT = AIR-1 launcher truthfulness; không tự động bắt đầu P4B, UI/Figma, Teacher secret hay module rollout mới.

SHORTEST SAFE FINISH PATH — 5 GATES, NOT A CALENDAR ESTIMATE
Gate 1/5 — DONE / OV1.1 REVIEW PASS: dependency/capability review + exact C5.2 apply-plan freeze; blocker topology, mandatory/optional refresh contract và immutable allowlist independently PASS; repo + production diagnostics chỉ đọc, không mutation.
Gate 2/5 — DONE / OV1.2 PASS: mandatory/optional/action-required freshness đã tách; optional stale bị giữ lại; global Attendance/Tuition/Finance bootstrap đã bỏ; plain Vietnamese copy + targeted QA + independent review PASS; local checkpoint only.
Gate 3/5 — DONE / OV1.3 PASS: chỉ 202608140001 → 202608140002 đã apply; backup recovery verified, 37 C5.2 rows preserved, ledger/schema/RPC/RLS/grants/singleton/denylist PASS; frontend ccd823a4 push + GitHub Pages deploy PASS.
Gate 4/5 — DONE / OV1.4 PASS: DreamHome_prod Schedule identity normalized fail-closed 4/4; full synthetic production flow, Owner/Admin A↔B, fresh context, reload, payment + audited void, cross-center leak=0, retry/stale/failure semantics và cleanup active residue=0 PASS.
Gate 5/5 — DONE / OV1.5 PASS: operator runbook/checklist, backup/recovery references, production checkpoint, exclusions và independent final review PASS; OPERATIONAL V1 COMPLETE.

ACTIVE MARKER RECONCILIATION
- C3.2/C3.3/C3.4A/B/D: operational realtime/core goals SUPERSEDED by C5.1/C5 Closeout; Teacher minimum production acceptance PASS ở OV1.4.
- C4.3: DONE for V1. C4.6 is a standing remote-approval rule, not a deferred feature. C4.7 multi-account full-flow DONE. C4.8/C4.9: OBSOLETE/UNSCOPED.
- F22.1 Kho quick polish and F22.2 Report day/week MVP: DONE by repo docs/commits; old TODO markers were stale. F22.4 is POST-V1 IMPORTANT with CRM/P4B; F22.5 is UI/POLISH.
- C6: core production foundation, domain closure, full-flow acceptance và C6.7 handoff are DONE for V1. Internal console/provisioning expansion is POST-V1.
- C7: basic login, Owner/Admin membership/parity and existing account operations are sufficient for V1; broader Access & Recovery Governance is POST-V1; Teacher account is LATER.
- C8/T: SECRET/PAUSED, outside public V1.
- F23.3/P4B: old command “return as highest priority after C5” is SUPERSEDED by this reconciliation; classification is POST-V1 IMPORTANT.
- F23.7: UI/POLISH pending spec, not a functional BLOCKED state. F23.14 is POST-V1 IMPORTANT; remaining F23.15/C9 work is UI/POLISH; F23.16 is SUPERSEDED.
- C10.1 DreamHome core pilot và full Attendance/Tuition Operational V1 acceptance đều DONE. Minimum handoff/recovery evidence DONE ở OV1.5; C10 rollout/feedback/maintenance/backup-export/scale-up are POST-V1 IMPORTANT and begin only after Admin feedback.

HISTORICAL EVIDENCE LEDGER — retained below; conflicting priority words are superseded by the dashboard above

C3.0  DONE / đã có nền online-cloud strategy
C3.1  DONE / access gate foundation đã có
C3.2  SUPERSEDED / Học viên authoritative refresh + realtime hiện thuộc C5.1
C3.3  SUPERSEDED / Giáo viên authoritative core + realtime hiện thuộc C5.1; production acceptance nằm trong OV1
C3.4A DONE / class_session authoritative qua C5.1
C3.4B DONE / schedule_session authoritative qua C5.1 + DreamHome repair
C3.4C DONE / realtime TKB guarded đã có
C3.4D SUPERSEDED / C5 Closeout và reconciliation hiện tại đã thay audit dự kiến

C4.0  DONE / định hướng login-cloud đã rõ
C4.1  DONE / login không còn phụ thuộc Thu Chi
C4.2  DONE / login gate trước dashboard
C4.3  DONE / canonical center binding qua membership/current center đã production-accepted cho core
C4.4  DONE / staging Angel Wings đã có
C4.5  DONE / cloud bootstrap tối thiểu
C4.6  SUPERSEDED AS PHASE / explicit approval + exact allowlist là standing remote-mutation rule
C4.7  DONE V1 / core multi-account + compact full-flow Attendance/Tuition production acceptance PASS ở OV1.4
C4.8  OBSOLETE / không còn scope độc lập trong active roadmap
C4.9  OBSOLETE / không còn scope độc lập trong active roadmap

F22.0  DONE / nhiều đợt feedback Admin đã xử lý qua QA
F22.1  DONE / Kho hàng quick polish + unit combobox có repo docs/commit evidence
F22.2  DONE / Báo cáo ngày-tuần MVP có repo docs/commit evidence; C5 Closeout đã hội tụ nguồn derived
F22.3  DONE qua F23.10 / Module Nhân viên, liên kết Giáo viên, lifecycle và chấm công theo lịch đã có nền
F22.4  POST-V1 IMPORTANT / Nối dây Học viên ↔ Phụ huynh ↔ Học phí thuộc CRM/P4B sau V1
F22.5  UI/POLISH / tân trang UI-icon-bố trí sau functional closure, bám spec chặt
F22.6  DONE public / TKB Admin attendance compact đã push
F22.7  DONE public / Bảng điểm danh compact laptop UI
F22.8  LATER / còn có thể quay lại Học phí để hoàn thiện các flow nâng cao

C5.0  DONE / System-wide source-of-truth audit và remediation plan đã khóa
C5.1  DONE CODE/LOCAL + PRODUCTION APPLIED / Core Student-Teacher-Class-Schedule authoritative; legacy preserved
C5.2  DONE CODE/LOCAL + PRODUCTION APPLIED / 202608140001 + 202608140002 controlled apply, schema/RPC/RLS/grants/singleton/ledger + authenticated flow acceptance PASS
C5.3  DONE CODE/LOCAL + PRODUCTION APPLIED FOR PARENT-FIRST CRM / canonical CRM + PH-1 Parent<->existing Student link + PH-4A hosted crypto are live; P3D/P4B conversion remains FROZEN/ABSENT; legacy exact-center preservation unchanged
C5.4  DONE CODE/LOCAL + PRODUCTION APPLIED / Finance-Cashbook authoritative; production acceptance PASS
C5.5  DONE / PRODUCTION APPLIED / Staff-HR authoritative + HR-1 privacy/capability hardening LIVE under Giáo viên; Owner/Admin parity, audited sensitive read, attachment privacy and exact-center isolation PASS
C5.6  DONE / PRODUCTION APPLIED / Inventory authoritative shared truth LIVE
C5.7  DONE / PRODUCTION APPLIED / Calendar + Operational Notes authoritative; custom non-class Calendar/tags + shared manual Attendance Board/Tuition monthly advisory notes LIVE; C5.1 Class/Schedule authority unchanged
C5 CLOSEOUT  DONE CODE/LOCAL / INDEPENDENT TECHNICAL REVIEW + FINAL CHECKPOINT PASS
C5 DONE  YES AT CODE/LOCAL CONTRACT LEVEL
OPERATIONAL V1  PASS
OV1.1–OV1.5  DONE
CURRENT  HR-2 PRODUCTION PASS; C5.5 STAFF-HR 100% LIVE; C5.7 OPERATIONAL NOTES, INVENTORY + PARENT-FIRST CRM REMAIN 100% LIVE
CURRENT CHECKPOINT EVIDENCE  frontend main = origin/main = 4fbd2f4d90393c24ad70dc439f5051de0e9f56e3; C5.5 ledger 202608140007 + 202608140008 + 202608290001 exact; Staff capability READY under Giáo viên; launcher 12 visible / 12 actionable / 0 unavailable and no tile 13; privacy/governance/cross-center/cleanup PASS
REMOTE PRODUCTION  PARENT-FIRST CRM reviewed chain + PH-1 + PH-4A 202608250002, C5.6 202608140009, C5.7 202608140010/011, and C5.5/HR-1 202608140007/008 + 202608290001 applied exactly; P3D/P4B absent; non-Staff business-domain digests unchanged
POST-C5 KNOWN ISSUE  CLEARED / DreamHome legacy Schedule identity normalize fail-closed 9/9 và DreamHome_prod 4/4; payload/provenance cùng mọi real/uncertain row được preserve; obsolete optional-domain background bootstrap removed and C5.7 is now live
PRODUCTION ACCEPTANCE  OV1.4 full flow Login → Student → Teacher → Class/Schedule → Attendance → Tuition → payment/Finance → audited void PASS; Owner/Admin parity, reload/fresh context, retry/idempotency, stale rejection, required/optional failures, cross-center leak=0/write denied PASS; active QA residue=0
NEXT  POST-V1 ROADMAP RECONCILIATION
UI PAINT  U0 THEME FOUNDATION DONE; U1 HỌC VIÊN DONE / PAINT FREEZE / DEPLOYED; U2 THỜI KHÓA BIỂU DONE / PAINT FREEZE / DEPLOYED; U3 BÁO CÁO DONE / PAINT FREEZE / DEPLOYED; U4 HỌC PHÍ DONE / PAINT FREEZE / DEPLOYED
WAVE 2 CRITICAL  SUPERSEDED / absorbed into C5 checkpoints
LEGACY LOCAL  Không auto-upload; không silent-delete; real/uncertain exact-center được preserve/quarantine, recoverable, non-authoritative
F23.3E-P4B  POST-V1 IMPORTANT / FROZEN / NOT DONE
Attendance → Tuition automatic apply có Admin xác nhận: POST-V1 IMPORTANT / basic Attendance và Tuition save vẫn là V1

C6.0  DONE V1 / core production foundation + full-flow acceptance + operator handoff PASS
C6.1  DONE V1 / DreamHome core + C5.2 schema deploy + Attendance/Tuition authenticated production flow PASS
C6.2  DONE V1 / production-staging separation + exact-center cache safety
C6.3  DONE V1 / multi-center membership/switch + cross-center isolation core PASS
C6.4  DONE V1 BASIC / Owner/Admin operational parity; governance mở rộng là POST-V1
C6.5  POST-V1 IMPORTANT / Internal Center Console foundation không chặn boring core V1
C6.6  POST-V1 IMPORTANT / provisioning/switch foundation đã có; expansion không chặn V1
C6.7  DONE V1 / Production handoff checklist + operator runbook + final checkpoint PASS

C7.0  DONE / Account & permission architecture design nền
C7.1  DONE V1 BASIC / sign-in gate hoạt động; username convenience không chặn V1
C7.2  DONE V1 BASIC / account management nền đủ cho current Owner/Admin
C7.3  DONE V1 BASIC / role default + operational permission boundary
C7.4  POST-V1 IMPORTANT / Access & Recovery Governance design đã có, implementation mở rộng để sau V1
C7.5  POST-V1 IMPORTANT / server-side account provisioning readiness không chặn current test/operator identities
C7.6  POST-V1 IMPORTANT / create admin + credential handoff expansion
C7.7  POST-V1 IMPORTANT / controlled revoke + restore expansion
C7.8  POST-V1 IMPORTANT / acting mode - hỗ trợ cơ sở
C7.9  DONE / Account lifecycle checkpoint
C7.10 LATER / Teacher account provisioning trong Internal Console; ngoài V1 admin core
C7.11 LATER / Tách rõ hồ sơ Giáo viên và tài khoản đăng nhập; ngoài V1 admin core

C8.0  DONE / Teacher Portal scope, profile & roadmap design
C8.1  SECRET/PAUSED / hồ sơ Giáo viên public vẫn dùng cho admin core; teacher account model không vào V1
C8.2  DONE public / Teacher Portal shell preview + Lịch dạy của tôi preview nền
C8.3  DONE public / Lịch dạy của tôi preview + My session detail nền
C8.4  DONE public / Chi tiết ca dạy read-only
C8.5  DONE secret / Module 14 “Nhà của giáo viên” entry tạm trong Admin OS
C8.6  DONE secret / Tách Teacher Workspace sang T-roadmap
C8.7  PAUSED secret / Teacher Workspace MVP qua T-roadmap, đang dừng tại T.7
C8.8  LATER / Public reveal plan sau tháng 8 hoặc khi được phép
C8.9  LATER / Teacher task center + checkpoint MVP sau khi T-roadmap đủ ổn

T.0   DONE secret / Roadmap và nguyên tắc Teacher Workspace
T.1   DONE secret / Teacher Home Dashboard read-only
T.1.5 DONE secret / Teacher Desktop module grid + internal window shell
T.2   DONE secret / Lịch dạy của tôi bản riêng trong Nhà giáo viên
T.3   DONE secret / Design Báo cáo ca dạy
T.4A  DONE secret / Form Báo cáo ca dạy shell
T.4A.1 DONE secret / Báo cáo ca dạy giống ruột Trello/TKB cũ
T.4B  DONE secret / Lưu nháp Báo cáo ca dạy local-safe
T.4C  DONE secret / Gửi Báo cáo ca dạy local-safe
T.4D  DONE secret / Admin nhận-xem Báo cáo giáo viên read-only
T.5   DONE secret / Học viên của tôi read-only
T.6   DONE secret / Nhận xét học viên local-safe
T.7   PAUSED secret / Admin review-chốt báo cáo giáo viên, logic gần xong nhưng report window còn bug scroll cần debug riêng
T.8   LATER secret / Teacher Auth Foundation, dùng tài khoản giáo viên từ C7.10
T.9   LATER secret / Check-in-check-out không ảnh
T.10  LATER secret / Check-in-check-out có ảnh + media
T.11  LATER secret / Hoàn thiện và bỏ đồ tạm: bỏ Module 14, bỏ Teacher Portal cũ, chuyển sang app/route giáo viên thật

F23.0  DONE/triaged public / Feedback anh Hải 21/07/2026 đã bóc thành ticket rõ, không làm all-in-one
F23.1  DONE public / Học phí: Ghi chú mở box/timeline giống Module Học viên, có gợi ý cho tư vấn
F23.2 DONE design / Nối dây Phụ huynh ↔ Tư vấn ↔ Học viên: entity, relationship và lifecycle canonical

F23.3 POST-V1 IMPORTANT / CRM shell + local backend evidence đã có; production rollout và P4B giữ frozen ngoài V1
    F23.3A DONE design / Thiết kế Module Phụ huynh-Tư vấn CRM nhẹ
    F23.3B DONE public / CRM shell local-safe: 3 stage, thêm khách mới, detail nhẹ, care logs
    F23.3C DONE qua F23.3B / Form khách mới local-safe đã được tích hợp vào CRM shell
    F23.3D DONE public / Convert preview khách tư vấn → phụ huynh/học viên, chưa ghi dữ liệu thật
    F23.3E POST-V1 IMPORTANT / P1-P4A local DONE; P4B frozen; remote CRM apply/deploy chưa chạy
        F23.3E-P1 DONE backend/local verified / Nền CRM canonical, Request-idempotency, Audit-Outbox, typed operations, masked reads và rollout-gate QA PASS
            F23.3E-P1A DONE backend/local verified / Schema CRM và center control root
            F23.3E-P1B DONE backend/local verified / Conversion Request và scoped idempotency
            F23.3E-P1C DONE backend/local verified / Transactional Audit và durable Outbox
            F23.3E-P1D DONE backend/local verified / Typed Contact, Case, Assignment và Care Log operations
            F23.3E-P1E DONE backend/local verified / RLS read, masking và import-readiness
            F23.3E-P1F DONE QA/local verified / Integrated P1 rollout-gate QA
        F23.3E-P2 DONE backend/local verified / Identity matching, duplicate review, normalization, masked search, reviewed decisions và P3-entry gate PASS
            F23.3E-P2A DONE backend/local verified / Identity-policy, mutex, immutable review và reservation foundation
            F23.3E-P2B DONE backend/local verified / Versioned normalization và exact-center masked search
            F23.3E-P2C DONE backend/local verified / Reviewed decision và create-new reservation runtime
            F23.3E-P2D DONE QA/local verified / Integrated duplicate, concurrency, security và fault QA
        F23.3E-P3 DONE backend/local verified / P3A-P3D hoàn tất real-conversion backend và technical acceptance local; remote Supabase apply/deploy chưa chạy
            F23.3E-P3A DONE design/local verified / Atomic executor và authority lifecycle design freeze
            F23.3E-P3B DONE backend/local verified / Step-up, capability và single-use conversion authority runtime
            F23.3E-P3C0 DONE design/local verified / Guardian source-evidence crypto contract
            F23.3E-P3C DONE backend/local verified / Canonical Student, Guardian, binding, relationship, protected evidence và reviewed action-plan runtime; atomic conversion hoàn tất ở P3D
            F23.3E-P3D DONE backend/local verified / Atomic real-conversion technical acceptance PASS; final migration SHA-256 F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3; remote Supabase apply/deploy chưa chạy
        F23.3E-P4 POST-V1 IMPORTANT / P4A DONE; P4B frozen; remote Supabase apply/deploy chưa chạy
            F23.3E-P4A DONE backend/local verified / Canonical Contact ingress, phone-email normalization, HMAC lookup digest, key epoch, rotation/re-ingestion và independent technical review PASS
            F23.3E-P4B POST-V1 IMPORTANT / FROZEN / NOT DONE / local automated QA có evidence; manual product E2E và remote rollout chưa làm
            SUPERSEDED PRIORITY RULE / Không tự quay lại P4B sau C5; chỉ mở sau Operational V1 bằng gate riêng

F23.4  DONE design / TKB đa loại nội dung và thẻ màu, khóa boundary với lớp học

F23.5  DONE public / TKB nội dung ngoài lớp học, thẻ màu, conflict và weekly recurrence MVP
    F23.5A DONE public / Data foundation centerCalendarItems + centerCalendarTags local-safe
    F23.5B DONE public / Render centerCalendarItems read-only trên TKB
    F23.5B.1 DONE public / Fix global form focus-dropdown regression do module window bị nhận nhầm là launcher
    F23.5C DONE public / CRUD hoạt động local-safe: tạo, xem, sửa, xóa; tách taxonomy buổi học/hoạt động; palette màu cơ bản kiểu Trello
    F23.5D DONE public / Nhãn có tên, quản lý nhãn, badge, filter và legend TKB local-safe
    F23.5E0 DONE design / Thiết kế conflict warning và recurrence weekly MVP
    F23.5E1 DONE public / Conflict foundation và cảnh báo trùng lịch cho hoạt động đơn lẻ
    F23.5E2A DONE public / Weekly recurrence foundation, tạo chuỗi và virtual occurrences
    F23.5E2B DONE public / Chỉnh sửa và xóa toàn bộ weekly recurrence series
    F23.5E3 LATER public / Conflict theo giáo viên, nhân sự và người tham gia
    F23.5E4 LATER public / Exception: sửa hoặc xóa một occurrence riêng

F23.6  DONE public / In và Lưu PDF TKB tuần MVP
    F23.6A DONE design / Thiết kế Browser Print và Save as PDF
    F23.6B DONE public / Direct print TKB tuần, snapshot data model, A4 landscape
    F23.6C LATER public / Tùy chọn xuất nâng cao và polish tài liệu

F23.7  UI/POLISH pending spec / Tân trang Bảng điểm danh không phải functional blocker

F23.8  DONE public / File đính kèm và dòng tiền thống nhất cho giao dịch
    F23.8A DONE design / Thiết kế dòng tiền thống nhất: giao dịch ↔ nguồn nghiệp vụ ↔ chứng từ ↔ Báo cáo
    F23.8B DONE public / Giao dịch thủ công: chèn ảnh trong form Tạo/Sửa, trạng thái chứng từ đồng nhất giữa cloud, row, form và gallery
    SUP-CF.1 DONE backend/public / App-side current-center authorization PASS; hardened owner/center_admin migration đã apply remote và bất biến
    F23.8C DONE public / Học phí: Ghi nhận thanh toán tự động tạo giao dịch Thu chi linked, idempotent và có chứng từ
    F23.8D DONE public / Lịch sử từng lần thanh toán theo kỳ; Đã thanh toán và Còn nợ tính từ cashflow ledger
    F23.8E DONE public / Xem và xuất chứng từ từ Thu chi và Module Báo cáo
        F23.8E1 DONE public / In-Xuất PDF từng giao dịch kèm chi tiết và hình ảnh chứng từ
        F23.8E2 DONE public / Báo cáo drill-down về giao dịch gốc, xem chứng từ và In-PDF từng khoản
    F23.8F DONE public / Tạo kỳ Học phí mới và hoàn tác kỳ trống an toàn
        F23.8F.1 DONE hotfix / Sửa canonical center guard khi hoàn tác và disable xác nhận khi có blocking reason
    F23.8G LATER public / Sửa, hủy, hoàn tiền và đối soát giao dịch liên kết
    POLISH LATER public / Báo cáo drill-down giữ scroll và mở modal gần full-screen, một scroll chính
    POLISH LATER public / Làm rõ UX modal Lưu gói và vùng bấm mở chi tiết Học phí

F23.9  DONE public / Sửa flow Chỉnh sửa giao dịch → Lưu giao dịch trong Thu chi

F23.10 DONE public / Nhân viên ↔ Giáo viên ↔ Phòng ban ↔ Tài khoản-quyền và lifecycle an toàn
    F23.10A DONE design / Chốt kiến trúc Nhân viên ↔ Giáo viên ↔ Phòng ban ↔ Tài khoản và quyền
    F23.10B DONE public / Foundation dữ liệu và CRUD Module Nhân viên + Phòng ban
    F23.10C1 DONE public / Liên kết trực tiếp Giáo viên ↔ Nhân viên và tạo hồ sơ Nhân viên từ Giáo viên
        F23.10C1.1 DONE hotfix / Sửa save hồ sơ Nhân viên đã liên kết và làm rõ Ngày kết thúc theo trạng thái
    F23.10C2 LATER public / Polish liên kết, cảnh báo trùng và lifecycle gỡ liên kết nâng cao nếu cần
    F23.10D DONE public / Liên kết Nhân viên với tài khoản-membership và hiển thị quyền
    F23.10E DONE public / Lifecycle nghỉ việc, ngừng dạy, khóa tài khoản không làm mất lịch sử
        F23.10E.1 DONE hotfix / Sửa scroll jump và first-click trong modal lifecycle Nhân viên
    POLISH LATER public / Thay native confirm Gỡ liên kết bằng modal hệ thống với nút “Gỡ liên kết” rõ nghĩa

F23.11 DONE public/backend / Hồ sơ hành chính Nhân viên, tài liệu nhân sự và attachment private
    F23.11A DONE design / Kiến trúc Hồ sơ hành chính, dữ liệu nhạy cảm và tài liệu nhân sự
    F23.11B DONE public / Hồ sơ hành chính center-scoped, local-safe, masking-reveal và cửa sổ riêng
        F23.11B.1 DONE hotfix / Sửa default filter Nhân viên, empty state theo filter và mojibake Chấm công
        F23.11B.2 DONE hotfix / Sửa Hiện-Ẩn dữ liệu nhạy cảm, reset reveal và giữ số 0 đầu
    F23.11C DONE public / Danh mục tài liệu, hạn hiệu lực và attachment metadata private-ready
    F23.11D DONE public / Quyền theo action, audit append-only, retention và deletion-request local-safe
    F23.11E DONE backend / Upload ảnh-PDF tài liệu nhân sự bằng Supabase Storage private
        F23.11E.1 DONE backend / Replace attachment, version history và lưu trữ tệp
        F23.11E.2A DONE backend/public / Gỡ mềm, deletion request, review và legal hold
        F23.11E.2B LATER backend / Permanent object deletion bằng server-side executor và lifecycle canonical

F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở
    F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed
    F23.12B DONE design / Global Internal Console và center inventory
    F23.12C DONE design / Acting request-session, approval, expiry, revoke và safe exit
    F23.12D DONE design / Controlled Platform Owner bootstrap, assignment và revoke drill

F23.13 DONE design / Bảo mật tài khoản, liên kết Google identity, MFA và quyền Tư vấn
    F23.13A DONE design / Audit nền Auth-security và chốt boundary
    F23.13B DONE design / Liên kết Google identity và login-recovery semantics
    F23.13C DONE design / MFA-2FA enrollment, enforcement, step-up và recovery
    F23.13D DONE design / Quyền Tư vấn, provisioning và capability matrix

F23.14 LATER / Lưu trữ dữ liệu 3-5 năm: máy chủ-phần mềm-không gian lưu trữ, sau production readiness
F23.15 UI/POLISH / Tân trang giao diện toàn hệ thống theo ảnh designer, chỉ trên surface DONE
F23.16 SUPERSEDED / Checkpoint quay lại secret không còn phụ thuộc riêng F23.1; dùng quy tắc checkpoint chung cuối roadmap

C9.0  UI/POLISH / audit toàn hệ thống sau V1
C9.1  UI/POLISH / tân trang dashboard Admin sau V1
C9.2  UI/POLISH / paint module trọng điểm chỉ khi functional DONE
C9.3  UI/POLISH / icon-layout-design system
C9.4  UI/POLISH / responsive foundation đã có; hoàn thiện sau V1
C9.5  UI/POLISH / packaging-deploy polish

C10.0 LATER / Rollout plan
C10.1 DONE V1 / DreamHome core pilot + full Attendance/Tuition production acceptance PASS
C10.2 LATER / Feedback loop
C10.3 LATER / Maintenance docs
C10.4 LATER / Backup-export plan
C10.5 LATER / Scale-up multi-center

Quy tắc workflow:

* Teacher Workspace / Nhà của giáo viên làm trên branch local-only `local/teacher-workspace-secret`, chỉ commit local và tuyệt đối không push.
* T.7 đang được giữ ở `stash@{0}` với message `wip T7 teacher report review scroll unresolved`; chỉ apply lại khi thực sự quay về secret để debug scroll.
* Admin feedback và roadmap public như TKB, Học phí, Bảng điểm danh, Nhân viên và Hồ sơ hành chính làm trên `main`.
* Không cherry-pick hoặc merge nguyên commit secret sang `main`.
* Nếu cần đưa fix Admin/TKB từ branch secret ra public, phải port lại patch sạch trên `main`.
* Teacher Workspace hiện là “nhà để nhờ” trong Admin OS; khi tách app-route giáo viên thật thì bê nguyên layout-flow-nội thất đã chốt sang, không đập đi xây lại.
* Module `Giáo viên` trong cơ sở quản lý hồ sơ, chuyên môn và lớp phụ trách; không phải nơi tạo tài khoản đăng nhập thật về lâu dài.
* Internal Console / Owner Console là nơi tạo tài khoản giáo viên, cấp mật khẩu tạm, gán role, gán cơ sở, reset mật khẩu và khóa-mở tài khoản.
* Platform Owner ở F23.12 phải là quyền server-side đứng trên membership từng cơ sở; không hardcode quyền tối cao bằng email ở frontend.
* Không automation Attendance → Tuition nếu chưa có phase design-preview-apply riêng và Admin xác nhận.
* Không SQL, Supabase, Storage, migration remote hoặc deploy nếu chưa có approval rõ.
* Approval cụ thể 31/07/2026: F23.3E-P1A được tạo migration SQL và tests trong repo; chưa được apply Supabase remote, chưa Auth, Edge Function hoặc deploy.
* Với F23.11E, CodeX được tạo migration và runtime nhưng không tự apply remote; phải audit SQL-RLS-Storage policy trước khi chạy trên Supabase.
* SUP-CF.1 là prerequisite cần kiểm tra trước khi bật upload tài liệu nhân sự cho owner-center_admin.
* Không dùng service-role key trong browser, không public bucket và không dùng app-side role check thay cho RLS.
* Khi tân trang UI theo ảnh designer, phải bám layout, kích thước, spacing, màu, typography và state sát mẫu; chỉ sửa UI trong scope, không đổi logic-data-handler.
* Không dùng `git add .`, `git add -A` hoặc `git add -f`; chỉ stage danh sách file rõ ràng.
* Thư mục `prompts/` được ignore có chủ đích; không force-add prompt lên Git.
* Với feature-roadmap lớn, làm liên tục đến checkpoint hợp lý rồi mới commit-push; không “hở tí là push”.
* Trong quá trình làm vẫn chạy thường xuyên `node --check`, smoke tests mục tiêu, regression tests, mojibake scan và `git diff --check`.
* Manual QA là nguồn xác nhận cuối; CodeX automation PASS không tự đồng nghĩa với phase PASS.
* Trước khi bắt đầu phase backend-Supabase mới, `main` phải sạch hoặc đã checkpoint đầy đủ.
* Checkpoint quay lại secret: `main` sạch hoặc đã commit-push toàn bộ public đang làm; không có Teacher Workspace diff lẫn vào `main`; sau đó switch `local/teacher-workspace-secret`, kiểm tra stash và chỉ apply `stash@{0}` khi thực sự resume T.7.
