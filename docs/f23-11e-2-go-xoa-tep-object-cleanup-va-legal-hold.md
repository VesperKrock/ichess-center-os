# F23.11E.2 — Gỡ mềm, deletion request, review và legal hold

Ngày chốt canonical: 2026-07-29

## Trạng thái cuối

```text
F23.11E.2A DONE backend/public / Gỡ mềm, deletion request, review và legal hold
F23.11E.2B LATER backend / Permanent object deletion bằng server-side executor và lifecycle canonical
```

F23.11E.2A đã hoàn tất trong phạm vi được QA. Không có permanent Storage deletion trong runtime/browser và không được ghi F23.11E.2B DONE.

Hai cảnh báo trust-boundary dưới đây tiếp tục là blocker canonical cho E.2B, không phải blocker đóng E.2A:

- `NEEDS REVIEW - F23.11E.2 PERMANENT DELETE REQUIRES APPROVED SERVER-SIDE EXECUTION`
- `NEEDS REVIEW - CANONICAL SERVER-SIDE EMPLOYMENT LIFECYCLE REQUIRED`

## Sáu applied migrations bất biến

Sáu migration đã apply remote, Local/Remote history đã đồng bộ và là bất biến tuyệt đối. Không sửa, format, đổi encoding/line ending có chủ đích, rename, xóa, squash, repair hoặc apply lại.

| Migration | SHA-256 trước finalization | SHA-256 sau finalization |
| --- | --- | --- |
| `20260722000000_remote_schema.sql` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100_transaction_images_bucket_prerequisite.sql` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001_f23_11e_staff_document_private_attachments.sql` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |

## E.2A đã triển khai

### Soft removal

`Gỡ khỏi tài liệu` dành cho active Owner hoặc Center Admin đúng center:

- chuyển current `available/primary` thành `archived/non-primary` với reason removed;
- không xóa Storage object hoặc metadata;
- history vẫn private và vẫn xem/tải bằng access URL ngắn hạn;
- upload slot trở lại sau removal;
- stale/double-submit không làm mất current ngoài transaction hợp lệ.

### Deletion request và review

Owner/Center Admin đúng center có thể tạo/hủy request append-only. Owner khác requester mới có thể review. Request/approval không tự cấp quyền xóa Storage object và `eligible_after = NULL` tiếp tục thể hiện chưa đủ điều kiện execution.

Manual QA phê duyệt bằng Owner thứ hai vẫn `DEFERRED`, vì chưa có fixture Owner thứ hai. Không ghi nhánh đó PASS từ automated smoke.

### Legal hold

Owner có thể đặt/gỡ legal hold theo policy. Hold dùng cùng lock domain với attachment/request; release không tự resume execution, không khôi phục capability cũ và không xóa object.

### Readiness và UI boundary

Governance readiness xác nhận soft removal và deletion request ready, còn permanent execution false với blocker cần server executor + lifecycle canonical. UI có history, badge `Đã gỡ`, xem/tải, deletion request/review/legal hold và thông báo unavailable; không render execution button.

## E.2B LATER — permanent deletion

Browser không có Storage DELETE capability và runtime không gọi đường xóa object. E.2B chỉ được mở lại bằng phase duyệt riêng có đủ:

1. employment lifecycle canonical server-side, không cho browser tự khai/backdate nguồn retention;
2. server-side executor hoặc Edge Function với authorization và secret boundary được review;
3. lock/capability protocol bao trùm hold, exact object deletion và finalize;
4. replay/stale capability, hold/delete race, cross-center và RLS regression;
5. readiness chỉ bật khi lifecycle và executor thật sự tồn tại.

Cho đến lúc đó, object archived/removed vẫn private và review-safe; `approved` không đồng nghĩa `executed`.

## Manual QA finalization

`PASS`:

- readiness;
- upload private;
- xem;
- tải xuống;
- reload persistence;
- validation MIME/10 MiB;
- replace attachment;
- version history;
- xem/tải phiên bản cũ;
- soft removal;
- object/history vẫn private và truy cập được sau soft removal;
- upload slot trở lại sau removal.

`DEFERRED`:

- Owner thứ hai phê duyệt request: chưa có fixture Owner thứ hai;
- permanent Storage deletion: chủ động khóa.

Known UX deferred: đóng attachment viewer đôi lúc làm vùng Hồ sơ hành chính nhảy scroll lên trên.

## Canonical roadmap

```text
F23.2 DONE design / Nối dây Phụ huynh ↔ Tư vấn ↔ Học viên: entity, relationship và lifecycle canonical

F23.3 PARTIAL public / Module Phụ huynh-Tư vấn CRM nhẹ
    F23.3A DONE design / Thiết kế Module Phụ huynh-Tư vấn CRM nhẹ
    F23.3B DONE public / CRM shell local-safe
    F23.3C DONE qua F23.3B / Form khách mới local-safe
    F23.3D DONE public / Convert preview, chưa ghi dữ liệu thật
    F23.3E DONE design / Convert thật có idempotency, rollback, chống trùng và atomic action graph
        F23.3E-P1 DONE backend/local foundation verified / P1A-P1F hoàn tất local: canonical CRM schema/control root, request-idempotency, transactional Audit-Outbox, typed CRM mutations, masked reads/import readiness và integrated rollout-gate QA; chưa apply remote, chưa browser/final capability/full reveal/real import
            F23.3E-P1A DONE backend/local verified / Physical CRM schema và exactly-one center_crm_control; migration trong repo, local Docker apply và behavioral QA PASS; chưa apply remote
            F23.3E-P1B DONE backend/local verified / Protected conversion draft RPCs, scoped idempotency, exact prior-result replay, transactional Audit-Outbox và concurrency QA PASS; chưa apply remote, chưa browser wiring
            F23.3E-P1C DONE backend/local verified / Typed exact-center Audit read và durable Outbox claim-lease-ACK-retry-reclaim-dead-letter runtime; fault/concurrency QA PASS; chưa apply remote, chưa network worker
            F23.3E-P1D DONE backend/local verified / Typed Contact, Case, Assignment và Care Log service operations; exact-center, expected-version, target eligibility lock-recheck, Audit-Outbox atomic và fault/concurrency QA PASS; chưa apply remote, chưa browser/final capability wiring
            F23.3E-P1E DONE backend/local verified / Fail-closed CRM read path, service-only masked projections, generic cloud CRM deny guard và deterministic prototype-safe LocalStorage import-preview readiness; multi-account/security/fault QA PASS; chưa apply remote, chưa browser/final capability/full reveal/real import
            F23.3E-P1F DONE QA/local verified / Integrated P1A-P1E direct API, multi-account/multi-center, exact-center, stale/concurrency/deadlock, Audit-Outbox fault, import replay/conflict, READ_ONLY và deterministic kill-switch QA PASS; P2 entry technical gate PASS; active/remote rollout vẫn BLOCKED
        CURRENT CHECKPOINT — F23.3E-P2 DONE backend/local verified / Identity matching, duplicate review, versioned normalization, exact-center masked search, reviewed decisions, create-new reservation và integrated P3-entry gate hoàn tất local; P2 foundation ready for P3, chưa real conversion
            CURRENT CHECKPOINT — F23.3E-P2A DONE backend/local verified / Physical identity-policy, opaque identity mutex, immutable match review và profile-creation reservation schema foundation; RLS/direct-access fail-closed, exact-center/lifecycle/lock-order local QA PASS; chưa apply remote
            CURRENT CHECKPOINT — F23.3E-P2B DONE backend/local verified / Versioned Student identity normalization, protected keyed digests, sorted identity mutex và exact-center masked candidate search PASS; same-name + exact-birth strong duplicate signal yêu cầu review; Guardian target adapter và create authority vẫn BLOCKED
            CURRENT CHECKPOINT — F23.3E-P2C DONE backend/local verified / Protected reviewed-match decisions và create-new reservation runtime PASS; scoped idempotency, transactional Audit-Outbox, exact-center/stale/concurrency/fault QA PASS; reservation vẫn không cấp profile/create/conversion authority và không CONSUMED trước P3
            CURRENT CHECKPOINT — F23.3E-P2D DONE QA/local verified / Integrated duplicate, concurrency, security và fault QA PASS; P2 foundation cleared for P3 implementation; real conversion vẫn chưa ready và còn 7 P3 prerequisites
        CURRENT CHECKPOINT — F23.3E-P3 PARTIAL backend/design / Real-conversion architecture đã freeze ở P3A; P3B–P3D runtime chưa implement
            CURRENT CHECKPOINT — F23.3E-P3A DONE design/local verified / Dependency closure, canonical target model, fresh step-up/final capability/single-use authority, typed action aggregate, atomic executor design, dual digest binding và action-version lifecycle ordering đã external audit PASS
            F23.3E-P3B TODO backend / Fresh step-up, final conversion capability resolver và single-use conversion authority runtime
            F23.3E-P3C TODO backend / Canonical Student, Guardian, source-target binding và Guardian–Student Relationship protected target runtime; sequentially blocked until P3B PASS
            F23.3E-P3D TODO backend/QA / Atomic real-conversion executor, reservation/authority consume và integrated execution QA; sequentially blocked until P3B + P3C PASS
        F23.3E-P4 TODO public/QA / Nối UI conversion thật, legacy projection và manual QA end-to-end
* Historical checkpoint compatibility note — non-current P2-era P3 marker; the indented literal below is not a current status:
        F23.3E-P3 TODO backend / Fresh step-up approval, single-use authority và real conversion executor atomic
* Historical checkpoint compatibility note — non-current P1A-era parent marker: F23.3E-P1 DONE implementation planning / Canonical CRM foundation: center root, Contact, Case, Assignment, conversion request, idempotency, transactional audit/outbox
* Historical checkpoint compatibility note — non-current P1A-era marker: F23.3E-P1C TODO backend
* Historical checkpoint compatibility note — non-current P1A/P1C-era marker: F23.3E-P1D TODO backend
* Historical checkpoint compatibility note — non-current P1D-era marker: F23.3E-P1E TODO backend / RLS-read path remediation, server masking và LocalStorage import readiness
* Historical checkpoint compatibility note — non-current P1D/P1E-era marker: F23.3E-P1F TODO QA / Direct API, multi-account, exact-center, concurrency, fault injection và rollout gates
* Historical checkpoint compatibility note — non-current P1-era marker: F23.3E-P2 TODO backend/design / Identity matching, duplicate review, identity mutex và profile-creation reservation
* Historical checkpoint compatibility note — non-current P2-design-era P2A marker; the indented literal below is not a current status:
            F23.3E-P2A TODO backend / Physical identity-policy, mutex, review và profile-creation reservation schema foundation
* Historical checkpoint compatibility note — non-current P2A-era P2B marker; the indented literal below is not a current status:
            F23.3E-P2B TODO backend / Versioned normalization và exact-center masked candidate search
* Historical checkpoint compatibility note — non-current P2B-era marker; the indented literal below is not a current status:
            F23.3E-P2C TODO backend / Reviewed-match decision và create-new reservation typed runtime
* Historical checkpoint compatibility note — non-current P2-design parent marker; the indented literal below is not a current status:
        F23.3E-P2 DONE design / Identity matching, exact-center duplicate review, versioned normalization, stable sorted identity mutex, masked candidate projection và profile-creation reservation; runtime implementation chưa bắt đầu
* Historical checkpoint compatibility note — non-current P2C-era marker; the indented literal below is not a current status:
            F23.3E-P2D TODO QA / Integrated duplicate, concurrency, security, fault QA và P3-entry gate

F23.11 DONE public/backend / Hồ sơ hành chính Nhân viên, tài liệu nhân sự và attachment private
    F23.11A DONE design / Kiến trúc Hồ sơ hành chính, dữ liệu nhạy cảm và tài liệu nhân sự
    F23.11B DONE public / Hồ sơ hành chính center-scoped, local-safe, masking-reveal và cửa sổ riêng
        F23.11B.1 DONE hotfix / Default filter, empty state và mojibake
        F23.11B.2 DONE hotfix / Hiện-Ẩn dữ liệu nhạy cảm
    F23.11C DONE public / Danh mục tài liệu, hạn hiệu lực và attachment metadata private-ready
    F23.11D DONE public / Quyền theo action, audit append-only, retention và deletion-request local-safe
    F23.11E DONE backend/public / Upload ảnh-PDF tài liệu nhân sự bằng Supabase Storage private
        F23.11E.1 DONE backend/public / Thay tệp, lịch sử phiên bản và lưu trữ bản cũ
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
    F23.13D DONE design / Quyền Tư vấn, provisioning, capability matrix và server enforcement
```

F23.12A–D và F23.13A–D/parent đã final technical audit `PASS`, nhưng toàn bộ F23.12/F23.13 implementation vẫn `BLOCKED`; runtime vẫn `NOT STARTED`, chưa có route, authority service hoặc gán tài khoản thật. Design closeout không mở implementation F23.12 hoặc F23.13.

F23.13 FINAL TECHNICAL AUDIT: PASS
F23.13 IMPLEMENTATION: BLOCKED
F23.13 RUNTIME IMPLEMENTATION: NOT STARTED
