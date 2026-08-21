# Operational V1 final checkpoint

Ngày review: 21/08/2026

Branch: `main`

Production project: `zahcfnpaprbnuqpegdmo` / `ichess-center-os` / `ap-southeast-1`

## Verdict

**PASS.** Operational V1 đáp ứng hành trình vận hành lõi đã khóa. Không còn finding mở ở ngưỡng chặn.

| Mức độ | Finding mở |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 0 |
| Blocking MEDIUM | 0 |

Review cuối chỉ dùng kiểm tra đọc-only. Không tạo dữ liệu nghiệp vụ, không chạy lại acceptance có mutation, không apply migration, không deploy Auth/Edge/Storage và không mở công việc hậu V1.

## Exact production checkpoints

| Thành phần | Bằng chứng đã xác minh |
| --- | --- |
| Git runtime checkpoint | `main = origin/main = 68e089e5aa6596fa15b024c833366499ef6bcb62` trước commit tài liệu OV1.5; commit này là checkpoint cuối có thay đổi migration/test và không có worktree drift. |
| GitHub Pages | `https://vesperkrock.github.io/ichess-center-os/`; workflow `Deploy iChess Center OS to GitHub Pages`, run `32447228814`, source SHA `68e089e5aa6596fa15b024c833366499ef6bcb62`, kết quả `success`. |
| Live HTTP/browser | HTTP `200`; `Last-Modified: Fri, 21 Aug 2026 04:31:23 GMT`; trang hoàn tất tải, title `iChess Center OS - DreamHome`, form `Đăng nhập hệ thống` hiển thị; asset chính `/ichess-center-os/assets/index-B12WW3Sr.js`. |
| Supabase | Linked project khớp `zahcfnpaprbnuqpegdmo`, tên `ichess-center-os`, trạng thái `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.155`. |

Commit OV1.5 chỉ chứa hai tài liệu bàn giao/checkpoint; vì vậy source checkpoint làm thay đổi runtime vẫn là `68e089e…`. Pages được kiểm tra lại sau khi push tài liệu để xác nhận deploy vẫn khỏe.

## Exact applied migration ledger

Remote ledger có đúng 15 version dưới đây; thiếu expected `0`, unexpected applied `0`.

| Version | Name | Local immutable SHA-256 |
| --- | --- | --- |
| `20260722000000` | `remote_schema` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100` | `transaction_images_bucket_prerequisite` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001` | `sup_cf_1_transaction_attachment_owner_center_admin_policies` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001` | `f23_11e_staff_document_private_attachments` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002` | `f23_11e_1_staff_document_attachment_replace_version_history` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003` | `f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |
| `202608130003` | `c5_1_authoritative_core_contract_and_multi_account_harness` | `2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754` |
| `202608140001` | `c5_2_attendance_tuition_authoritative_shared_truth` | `3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414` |
| `202608140002` | `c5_2_baseline_singleton_review_hardening` | `76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7` |
| `202608140005` | `c5_4_finance_cashbook_authoritative_shared_truth` | `60E0B7114231172738E037F50A4EECB9C6345786E4D6CEF91A5DADD6B5C71F27` |
| `202608140006` | `c5_4_reconciliation_currentness_hardening` | `EA0C398D79B16B798A2BF8AD9C857B96B223DFB26202DCA2B9165D871BA97993` |
| `202608210001` | `c5_1_dreamhome_schedule_identity_normalization` | `870AD8FE26AA7119175F597640FAE07443BE7DC0B0FD130E8D489A1F9DA9965D` |
| `202608210002` | `ov1_4_tuition_payment_finance_void` | `A2F3FB07BCA748A9304CB32B2332D8A03E9BA57FA19A5862E1B50E9BF5CCBA8F` |
| `202608210003` | `ov1_4_tuition_payment_identity_compatibility_hardening` | `4696DC9E9DCAB5258C6DEE474FF8BAF6EFB4631AB7E388F86F4A3FD2F691A54E` |
| `202608210004` | `c5_1_dreamhome_prod_schedule_identity_normalization` | `696830AFE0BB700BA7200896211361D5D1575B7B8F60FFBEEE3D610E3CE9F955` |

P4B `202608130002` không có trong ledger và object `crm_conversion_bridge_session` không tồn tại. Toàn bộ migration repo còn lại ngoài bảng trên vẫn absent, gồm CRM/P4B, C5.3, C5.5, C5.6 và C5.7. Không dùng `supabase db push` trong OV1.

## Read-only schema/RPC verification

- `center_cloud_entities.entity_version`, `center_core_command_result` và `center_operational_command_result`: PRESENT.
- `c5_1_mutate_core_entity`, `c5_2_mutate_attendance_tuition_entities`, `c5_4_list_finance_shared_truth`, `c5_4_mutate_finance_shared_truth`, `c5_4_void_tuition_payment`: PRESENT với đúng identity arguments đã review.
- C5.2 baseline singleton index: PRESENT.
- Finance category, transaction, settings, reconciliation, audit và command-result tables: PRESENT.
- Finance reconciliation currentness trigger: PRESENT.
- DreamHome Schedule: active `9`, identity match `9`.
- DreamHome_prod Schedule: active `4`, identity match `4`, version `2` count `4`.

## OV1.1–OV1.4 evidence summary

| Gate | Evidence | Verdict |
| --- | --- | --- |
| OV1.1 | Read-only dependency review locked C5.2 exact apply closure, mandatory/optional module-refresh matrix, stop conditions and compact acceptance scope. | PASS |
| OV1.2 | Commit `ccd823a4c2bfa17df598bce32b0cbf9116030a21`; targeted refresh runtime, failure freshness and plain Vietnamese copy; build and targeted regressions PASS. | PASS |
| OV1.3 | C5.2 `202608140001` then `202608140002` applied through controlled SQL after verified encrypted recovery backup; Pages deployment run `32440634490` for `ccd823a4…` succeeded; no unrelated migration applied. | PASS |
| OV1.4 | Commits `f5190722d19e73cb1b405da609a584ca2c6bb930`, `6b658d74c786fa76e2dc3130e211e85d0f2f1fb9`, `68e089e5aa6596fa15b024c833366499ef6bcb62`; audited tuition-payment void and two exact-center Schedule identity repairs; full authenticated production acceptance and supported cleanup PASS. | PASS |

## Accepted Operational V1 journey

The live production journey passed end to end:

`Login/context → Student → Teacher minimum → Class/Schedule → Attendance → Tuition → payment/Finance → audited void → reload/fresh context → cleanup`

Accepted invariants:

- Owner and Admin in the same center have ordinary operational write parity; no Owner approval queue.
- A and B in the same center converge after targeted refresh; a fresh browser reconstructs the committed state.
- Different-center C reads zero QA records and cannot write to the QA center.
- Create/save retry does not duplicate; stale versions are rejected.
- A pre-commit failure retains the form/draft and does not report success.
- A successful commit followed by refresh failure is reported as committed and does not invite a duplicate Save.
- Required-domain failure clears fresh state and fails visibly; unavailable optional domains do not break the core module and their stale data is withheld.
- Attendance and Tuition converge through their production contracts.
- A Tuition payment creates the supported Finance result exactly once.
- Protected tuition-linked Finance rows cannot be edited arbitrarily. The dedicated exact-center operation changes `POSTED → VOIDED`, preserves audit/provenance, supports safe retry, rejects stale/cross-center calls and restores Tuition totals consistently.

## Synthetic QA residue classification

Final read-only inventory:

| Classification | Count | Meaning |
| --- | ---: | --- |
| Active synthetic entity residue | `0` | No synthetic Student/Teacher/Class/Schedule/Attendance/Tuition row remains active. |
| Active synthetic Finance `POSTED` | `0` | No synthetic payment contributes to current money totals. |
| Tombstoned synthetic entity history | `16` | Supported soft-delete history from guarded QA runs; inactive and not business truth. |
| Historical synthetic Finance `VOIDED` | `2` | Two protected QA payments were voided rather than hard-deleted. |
| Matching `VOID_TUITION_PAYMENT` audit events | `2` | Exact one-to-one audit evidence for the two historical voids. |

The tombstoned/voided rows are intentional recovery/audit evidence, not active residue. Hard deletion would violate the accepted preservation contract.

## Backup and recovery evidence

No secret, credential or backup content is stored in this document.

| Gate | Protected reference | Verification |
| --- | --- | --- |
| OV1.3 pre-C5.2 | `C:\Users\HP\AppData\Local\iChessCenterOS\protected-backups\ov1-3-pre-c5-2-20260821-092823\pre-c5-2-logical-recovery.zip.dpapi` | DPAPI CurrentUser; encrypted SHA-256 `DE684B3B381FB109498F9BD87E7BD2E835225B1DC147CE4B824404EF881EE0D3`; decrypt and member hashes verified by colocated receipt. |
| OV1.4 pre-void | `C:\Users\HP\AppData\Local\Temp\ichess-ov1-4-preapply-20260821-104609.dpapi` | Encrypted SHA-256 `17143C2B45D2C9D2A4879328054C52449C3204C299F3416C9A440423C55C41C7`; round-trip verified at creation. |
| OV1.4 pre-hardening | `C:\Users\HP\AppData\Local\Temp\ichess-ov1-4-pre210003-20260821-105953.dpapi` | Encrypted SHA-256 `8ABBDA28BEB22CB36135EC57B31A78579BFAEBA218493839BF14C04E4265842A`; round-trip verified at creation. |
| OV1.4 pre-DreamHome_prod repair | `C:\Users\HP\AppData\Local\Temp\ichess-ov1-4-dreamhome-prod-schedule-preapply-20260821-112445.dpapi` | Encrypted SHA-256 `EC56F413EA023C2815FFDAAF6BC8EC55E81BC900EAEF706B29A89FAAB9AEFB02`; decrypted payload SHA-256 `021A3494E547437792FC7C099A01EDAC79785C1430D58627A9D40078FA76B32A`; exact four-row round-trip verified. |

Recovery is a controlled technical operation. A center operator must preserve evidence and escalate; the runbook does not authorize self-restore, mass recreation or deletion.

## Auth, Edge and Storage boundary

- No OV1.1–OV1.5 step changed Auth configuration, created Auth users or deployed Auth changes. Production acceptance reused three designated existing identities.
- No `supabase/functions` or `supabase/config.toml` diff exists from the OV1.3 runtime checkpoint through `68e089e…`.
- Read-only Edge inventory remains five existing active functions: `provision-center-admin-account` v3, `reset-center-admin-password` v1, `list-center-admin-accounts` v3, `revoke-center-admin-access` v2, `restore-center-admin-access` v2. OV1 did not deploy them.
- No OV1.1–OV1.5 operation changed Storage buckets, objects or policies. The applied OV1 migrations affect only the reviewed database contracts; existing storage prerequisites remain inherited.

## Explicitly outside Operational V1

- P4B and CRM production rollout: **POST-V1 IMPORTANT / FROZEN / NOT DEPLOYED**.
- C5.3 CRM, C5.5 Staff/HR, C5.6 Inventory, C5.7 Calendar/Operational Notes production migrations: **NOT DEPLOYED**; optional absence must not break the V1 core journey.
- Teacher Workspace secret/T.7 and Teacher account provisioning: **PAUSED/LATER**.
- Figma Paint, global UI redesign and Light/Dark Start toggle: **POST-V1 UI/POLISH**.
- Owner/Admin Access & Recovery Governance expansion: **POST-V1 IMPORTANT**.
- Refund, bank refund, advanced reconciliation and arbitrary protected-Finance edits: **NOT INCLUDED**.
- Full historical smoke sweep, broad rollout, scale-up, long-term retention and backup export: **LATER**.
- `KẾT QUẢ HỌC TẬP`: **HARD EXCLUDED**.

No item above is silently started by this checkpoint. The next action is a Product Owner decision over the post-V1 backlog.

## Final independent review

- Physical Roadmap, repo history/diff and immutable migration bytes reconciled.
- Live Pages, linked Supabase project, ledger, schema/RPC objects, Schedule repairs and QA residue independently checked read-only.
- Operator runbook audited for ordinary Vietnamese wording; it requires no knowledge of database architecture or internal engineering phase names.
- No code, migration, production business data, Auth, Edge or Storage mutation in OV1.5.
- `CRITICAL=0`, `HIGH=0`, `blocking MEDIUM=0`.

Decision: **OPERATIONAL V1 PASS**. OV1.1–OV1.5 are complete; the system is ready for the defined core production operations and operator handoff.
