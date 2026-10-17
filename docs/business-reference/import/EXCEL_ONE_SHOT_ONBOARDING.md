# Nhập Excel cơ sở — một yêu cầu, một manifest duyệt

Owner chỉ cần gửi Excel và tên cơ sở, rồi dùng câu này:

> CodeX, import file Excel này vào cơ sở <TÊN CƠ SỞ>. Hãy đối chiếu, preview và trình một manifest tổng hợp để tôi duyệt; sau đó tự thực thi đúng phần đã duyệt, kiểm tra website production và báo những ngoại lệ còn thiếu. Không tự ghi production hoặc release trước khi tôi duyệt manifest.

CodeX tự làm toàn bộ read-only, chuẩn bị local và kiểm thử cần thiết. Chỉ gom các dữ liệu nguồn còn thiếu thành một yêu cầu bổ sung; không yêu cầu Owner nhập UUID, RPC, chạy dev server hoặc duyệt từng bước kỹ thuật. Có thể giữ một học viên chủ động chưa gán gói mà vẫn hoàn tất những dòng khác.

## 1. Đối chiếu trước khi lập manifest

Đọc toàn bộ [canonical R2 policy và R3C addendum](R2_EXCEL_IMPORT_RULES.md), ghi Git revision và checksum. Mở **file thật**, giữ nguyên bản gốc và SHA-256; không lấy cache/normalized artifact khác thay nguồn. Kiểm tra hai sheet, kể cả sheet ẩn, headers, vùng dữ liệu, cell types, công thức/cached values và date system. Không thực thi macro, công thức hoặc external link. Ghi sheet/row/STT và raw → normalized → provenance cho mỗi fact.

Resolve tên cơ sở thành đúng canonical center và website/project thật; xác minh tài khoản Admin cùng active membership bằng session đăng nhập chính thức. Thiếu quyền/provisioning là prerequisite, không tạo center, membership, teacher hoặc dùng service role để nhập nghiệp vụ. Không suy target từ cơ sở mặc định đang mở.

Fresh-read settings, packages, Ca, Students, full enrollment snapshots, tuition/baselines/policies, Contacts/PH1 khi có intent thật và các counters liên quan. Ghi IDs, versions, schema/function preimages, trước/sau dự kiến và snapshot checksum. Cơ sở đã có dữ liệu phải reconcile, không yêu cầu làm rỗng.

Loại STT0/example, excluded và dòng trống **trước** defaults/matching. STT là locator nguồn, không identity. Giữ nguyên dấu tên, phone leading zero và precision DOB/năm; không tạo 01/01/năm. Chỉ dùng sáu approved defaults trong R2 cho bản ghi mới; không overwrite existing bằng blank/default. Marker “Thiếu” là missing được ghi provenance, không tên/phone thật. Cột không có không là yêu cầu xóa dữ liệu.

Dedup theo center + danh tính có nhiều fact phù hợp, gồm tên/DOB hoặc năm/liên hệ/lịch và bằng chứng nguồn. Không merge chỉ theo tên, STT hoặc phone; shared parent/sibling cần bằng chứng hoặc quyết định Owner đã có. Owner correction được ghi nguyên văn kèm raw source; không sửa workbook. Collision/ambiguity HOLD đúng domain, không chọn candidate đầu.

Chuẩn hóa Ca theo giờ 24h và weekday subset, so cả workbook và server. Reuse Ca/package exact duy nhất; tạo mới chỉ khi đủ facts và được liệt kê trong manifest. Teacher optional; không fake teacher/auth identity, room, lịch sử đi học hay PH1 parent. V2.2 ghi Student + **toàn bộ** enrollment snapshot đã merge, kiểm tra cả hai expected versions. Student không guardian hợp lệ nếu current backend và form nhận được; liên hệ nhập dở phải xử lý thật hoặc HOLD liên hệ, không bịa phần còn lại.

## 2. Học phí theo dữ liệu nguồn

| Nguồn và live contract | Cách lập plan |
| --- | --- |
| Thiếu package/giá/A-B/payment facts | Nhập phần Student/lịch đủ nguồn; Tuition HOLD hoặc chủ động chưa gán gói. “Đã trả đủ” không đủ để suy gói. |
| Package + giá + A/B + cutoff + financial facts đã xác minh | Verified `IMPORT_INITIAL_BASELINE`, readback đúng baseline rồi `ADOPT_INITIAL_BASELINE`. Không gọi mutation production để thử validate. |
| A=B | Giữ số liệu hết buổi; không reset A hoặc tự mở kỳ khác. |
| A>B | Chỉ khi capability R3C đã live và được kiểm chứng; explicit excess=A−B, giữ A/B và cảnh báo chưa tính tiền. Nếu chưa hỗ trợ thì HOLD Tuition hoặc gộp release tối thiểu đã test vào manifest. |
| Ưu đãi “lần đầu/một lần” | Chỉ financial facts kỳ nguồn, recurring policy null. Không tự lặp. |
| Ưu đãi định kỳ có nguồn rõ | Typed recurring policy riêng, kỳ hợp lệ tiếp theo kế thừa; Admin sửa/dừng trong Chi tiết Học phí. Không tạo kỳ chỉ để gán policy. |

Cutoff phải gắn mốc số liệu nguồn và ngày Việt Nam, kiểm tra Attendance sau mốc. Không tự chọn hôm qua cho snapshot cũ. Các ngoại lệ cutoff Owner đã duyệt giữ nguyên. Nhánh legacy setup có contract riêng, không thay verified import để lách source facts. Source partial/unknown payment chỉ nhập nếu current canonical contract nhận chính xác; nếu không, HOLD. Không tạo Finance, Receipt, payment date hoặc Attendance lịch sử để thể hiện opening paid. Không tạo khoản thu, chuyển buổi vượt hay bù buổi thiếu quy tắc được duyệt.

## 3. Một manifest tổng hợp để duyệt

Xuất một bản Markdown cho Owner và một JSON cùng revision, checksum bất biến; normalized preview XLSX/questions/plan là phụ lục của chính manifest. Chưa chạy production business commands. Manifest phải có:

1. File/SHA, policy revision/SHA, target website/project/center/Admin và thời điểm read-only; scope, source overrides/defaults và nguồn từng quyết định.
2. Bảng từng dòng/domain: create/reuse/update/skip/hold, ID/version, identity/matching evidence, Ca/weekday, package/giá/A-B/cutoff, discount một lần/định kỳ, paid facts. Tổng hợp counts và phần còn thiếu, không dùng một READY chung che HOLD.
3. **RELEASE riêng nếu thật sự cần:** exact file allowlist + SHA, migration SHA/preimages/postimages, quyền/RLS không đổi, checks/build/UI QA PASS, thứ tự deploy/migration, recovery. Không có nhu cầu thì ghi release=0. Không xây importer UI/framework mới.
4. **IMPORT riêng:** exact canonical RPC/operation/key/payload, expected versions, dependencies và readback selectors. ID backend sinh sau lệnh trước là reference có điều kiện, chỉ bind từ result+readback đã khớp. Phân biệt command budget, số business rows và legitimate audit/metadata side effects.
5. Protected existing records/cutoffs/centers; bảng cấm chạm; preflight trước từng giai đoạn, stop conditions, same-key retry/readback và kế hoạch xử lý partial completion. Không compensation delete/reset tự động.
6. QA website thật: center đúng, danh sách và Chi tiết Học phí từng dòng nhập, A/B/giá/paid/policy, Student create/edit khả dụng, source year-only/blank contacts đúng; không bấm Save/Payment/Attendance giả để QA.

Chỉ xin **một quyết định production cho manifest cụ thể**, nêu rõ release và import. Phê duyệt batch trước không bao phủ batch mới. Nếu Owner đã duyệt đúng manifest trong phiên thì tiếp tục các bước kỹ thuật thuộc scope, không hỏi lại. Một thay đổi material về nguồn/target/identity/facts/phạm vi cần revision và quyết định phù hợp; không coi im lặng là đồng ý.

## 4. Sau phê duyệt: thực thi và nghiệm thu

Fresh-check checksum nguồn/file allowlist, remote head/CI, Admin/target, schema/capability, versions/dedup và protected snapshot trước mỗi giai đoạn. Dừng nếu drift hoặc không đủ quyền. Release tối thiểu theo manifest nếu có; backend transaction/preimages phải PASS, frontend phải build/deploy thành công, readback live capability trước commands phụ thuộc. Pages deploy thành công không chứng minh migration đã áp. Không dùng wildcard migration push gồm file ngoài allowlist.

Đi theo dependency đã duyệt: settings/packages/Ca nếu cần → Contacts/PH1 có facts thật nếu cần → Student+full enrollments V2.2 → verified baseline IMPORT → readback → ADOPT → readback. Reuse records đã đúng, không làm lại batch PASS. Mỗi intent dùng một idempotency key cố định; timeout phải đọc command result và state trước retry **cùng key/cùng payload**, không đổi key để thử lại. Version conflict dừng dòng phụ thuộc, không overwrite. Dòng độc lập chỉ tiếp tục nếu preconditions và approval vẫn đúng.

Lưu ledger chỉ gồm request/result/version/hash và readbacks, không tokens/password/service keys. Backup/evidence có dữ liệu học viên giữ local được bảo vệ, không commit hoặc gửi ra ngoài. Auth refresh kỹ thuật dùng SDK/session thật; business writes chỉ qua canonical Admin routes, không raw bảng bằng SQL admin.

Mở Chrome production đúng website/center, kiểm tra các dòng vừa nhập và regression records được bảo vệ. Chụp bằng chứng cần thiết, so counts/versions/facts trước–sau và xác nhận không có thêm Attendance/Finance/Receipt ngoài scope. QA form trên production chỉ mở/xem/hủy nếu không có chỉnh sửa nghiệp vụ thật được duyệt. Ghi rõ PASS, partial hoặc HOLD; không gọi “hoàn tất toàn bộ” khi còn ngoại lệ.

Trước khi có business writes, migration lỗi phải rollback atomic; frontend lỗi theo recovery đã duyệt, giữ import chưa chạy. Sau business writes, giữ ledger của phần đã thành công và dừng dependencies; không tự drop cột, xóa kỳ/học viên, sửa cutoff hay rollback dữ liệu nguồn để làm đẹp kết quả.

## 5. Mẫu báo cáo ngắn để Owner gửi anh Hải

> Cơ sở **<tên>** đã nhập và kiểm tra trên **<website>** lúc **<thời gian VN>**: <số> học viên, <số> lịch học, <số> kỳ học phí được tiếp quản đúng nguồn. Ưu đãi một lần/định kỳ và số buổi nguồn đã đối chiếu. Không tạo giao dịch tài chính hoặc điểm danh giả. Còn <số> ngoại lệ: <tên + facts còn thiếu/quyết định giữ chưa gán gói>. Cần cơ sở bổ sung <dữ liệu thật cần thiết>. Bằng chứng/manifest: <link>.

Đây là bản nháp để Owner gửi; CodeX không tự nhắn anh Hải. Chỉ ghi kết quả production sau execution + readback + website QA thực tế, không dùng kết quả local làm nghiệm thu production.
