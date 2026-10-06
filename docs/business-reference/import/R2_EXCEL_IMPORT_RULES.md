# iChess Center — Canonical R2 Excel Intake & Import Rules

**CANONICAL DOCUMENTATION CONTRACT — v1, 07/10/2026.**

Workbook nguồn: `iChess_R2_Simple_2Tabs.xlsx`.

Workbook này là artifact do ChatGPT tạo, user giữ ngoài repo/workspace; task documentation không cần file để hoàn thiện policy và không stage workbook. Không tự tạo hoặc invent thêm columns ngoài policy đã cung cấp. R3A khi thực sự normalize dữ liệu vẫn phải nhận/mở file thật và kiểm tra theo mục 1.

Frozen core được đối chiếu: `6708ef8615c2a02bca1fac30a98924172d9ad649` — `fix: harden center switching before final freeze`.

**Mọi task R3/import phải đọc toàn bộ file này trước khi normalize Excel và đọc lại trước khi ghi Supabase.** Import plan phải ghi path và Git revision của policy đã dùng. Đây là source of truth cho bố cục R2, interpretation, normalization, matching và approval gate; không dùng prompt cũ/sample data/importer có sẵn để bỏ qua contract.

Evidence R1 tại `artifacts/R1/REPORT.md`, `artifacts/R1/FIELD-MAPPING.md` và `artifacts/R1/POLICIES.md` lưu kết quả audit frozen authorities trong workspace, không được commit cùng policy này. Contract trong file này tự chứa các quy tắc bắt buộc; source references ở mục 43 nằm trong Git. Blueprint nhiều sheet trong R1 không còn là bố cục workbook canonical. Sáu approved defaults ở mục 5 là quyết định intake R2 rõ ràng; không áp default khác từ UI/R1.

Policy không mở rộng frozen backend. Facts nghiệp vụ hợp lệ nhưng current authority không nhận được phải được phân loại `PRODUCT_ALIGNMENT_REQUIRED`, giữ operation phụ thuộc ngoài mutation và báo riêng. Không sửa source/migration, raw-write bảng, bypass validator hoặc fabricate để ép import. Task import không tự sửa policy để hợp thức hóa dữ liệu của chính task đó; thay đổi contract cần quyết định được duyệt và docs revision riêng.

Đây là tài liệu contract, không phải importer/lệnh import. Commit/push policy không cho phép business write, migration hoặc deploy.

## 0. Purpose

Đây là canonical contract cho mọi lần dùng Excel để đưa dữ liệu một cơ sở vào iChess.

Mục tiêu:

Admin điền dữ liệu theo cách tự nhiên nhất.

CodeX chịu trách nhiệm:

1. đọc Excel;
2. hiểu và chuẩn hóa cách viết;
3. chỉ ra ambiguity thật sự;
4. tạo normalized preview;
5. tạo import plan;
6. chờ user duyệt;
7. sau đó mới được mutation vào target center.

Không yêu cầu Admin hiểu database, UUID, RPC, schema hoặc internal IDs.

---

## 1. Canonical workbook

Workbook R2 hiện hành có đúng hai sheet:

1. `1. CÀI ĐẶT CƠ SỞ`
2. `2. DỮ LIỆU HỌC VIÊN`

Không yêu cầu workbook phải mirror database tables.

Không tự phát minh thêm business sheet chỉ vì backend có nhiều entity.

R3A phải mở file thật, ghi SHA-256 và kiểm tra **đúng hai sheet, kể cả sheet ẩn**, các vùng dữ liệu và headers. Đúng tên file không chứng minh đúng schema. File thiếu/hỏng hoặc không resolve được sheet/header/vùng dữ liệu → HOLD/QUESTION trước khi diễn giải vùng đó; không tuyên bố đã đọc workbook khi chỉ biết tên. Alias header chỉ được nhận nếu map duy nhất, không đổi nghĩa và được ghi trong preview.

Preview kỹ thuật R3 là file riêng, có thể có nhiều sheet review; không thay workbook Admin hai sheet. Giữ original file unchanged.

---

## 2. STT 0 — Example row

Ở mọi khu vực có STT:

STT = 0

luôn có nghĩa:

EXAMPLE_ONLY

Dòng STT 0:

- không bao giờ được import;
- không được dùng để suy target data;
- không được tạo Student, Parent, Ca, Package, Tuition hoặc record khác;
- không được dùng để kết luận một field bắt buộc phải giống ví dụ.

Dữ liệu thật bắt đầu từ:

STT >= 1

Guard này là bắt buộc.

Áp guard **trước defaults, matching và mọi operation**. Numeric `0` và chuỗi biểu diễn chính xác `0` sau trim đều EXAMPLE_ONLY, kể cả đánh dấu dùng import. STT là locator trong từng vùng nguồn, không identity/Student ID. Không join các vùng chỉ vì cùng STT.

Dòng hoàn toàn trống SKIP. Dòng có dữ liệu nhưng STT blank/âm/phân số/không parse được hoặc trùng trong cùng vùng → QUESTION; không `Number(blank) → 0`, tự đánh số hoặc merge. Vùng key–value cài đặt không có STT được đọc theo nhãn rõ, không áp guard STT lên mọi ô của sheet.

---

## 3. Core philosophy

Excel không cần hoàn chỉnh.

Import plan phải trung thực.

Missing optional information:

- không phải lỗi toàn workbook;
- không biến thành zero;
- không biến thành fake default trừ những default được contract này cho phép;
- không tự delete;
- không chặn Student creation chỉ vì một nghiệp vụ phụ chưa setup.

Chỉ HOLD khi:

- không thể xác định record một cách an toàn;
- dữ liệu mâu thuẫn;
- hoặc current backend authority thực sự không thể tiếp nhận fact đó mà không fabricate.

---

## 4. Blank semantics

Blank != 0

Blank != false

Blank != delete

Blank != fake date

Blank != fake phone

Blank != fake level

Blank != fake school

Blank có thể chỉ có nghĩa:

“chưa biết / chưa cập nhật”.

Nếu field optional:

giữ blank.

Nếu field thiếu nhưng business record vẫn có thể tồn tại:

import phần an toàn trước.

Nếu current production validator chặn một business-valid blank:

không fabricate.

Classify:

PRODUCT_ALIGNMENT_REQUIRED

và report rõ blocker.

---

## 5. Approved intake defaults

Chỉ các default sau được phép áp dụng khi Excel để blank:

Tỉnh/Thành phố:
TP.HCM

Quốc tịch:
Việt Nam

Trạng thái hiện tại:
Đang theo học

Bé đã biết về cờ vua chưa:
Chưa cập nhật

Mốc bot đã vượt qua:
Chưa có

Giới tính:
blank = Chưa cập nhật

Không tự tạo default khác ngoài danh sách này.

Defaults chỉ áp cho candidate **mới** có ô blank, sau khi loại example/excluded rows và xác định server chưa có fact đúng. Blank/cột thiếu trên existing record không CLEAR; default không overwrite server hoặc explicit value. Preview ghi `raw blank → default`, provenance `POLICY_DEFAULT`, khác `ADMIN_SUPPLIED` và `SERVER_REUSED`. User duyệt plan bao gồm defaults được dùng; default không chứng minh Admin đã xác nhận fact.

`Chưa cập nhật` của prior chess knowledge/giới tính map empty enum, không “Chưa biết cờ” hoặc Nam/Nữ. Tỉnh/Thành phố map `hometown`, không parent address. Không copy toàn bộ empty-form defaults vào payload. Default kỹ thuật khác của backend nếu có phải được chỉ ra trong plan, không coi là human fact.

Đặc biệt không default:

- Level;
- trường học;
- ngày sinh;
- lịch học;
- phụ huynh;
- phone;
- gói học phí;
- số buổi đã học;
- payment state;
- teacher.

---

## 6. Student-first import principle

Một Student không cần mọi nghiệp vụ hoàn chỉnh ngay ngày import.

Ví dụ được phép:

Student tồn tại
+
Tuition chưa setup

UI có thể hiển thị:

“Chưa thiết lập học phí”

và Admin bổ sung sau bằng app.

Tương tự:

- chưa có lịch học;
- chưa biết DOB;
- chưa có dữ liệu sở thích;
- chưa có một số thông tin profile;
- chưa setup Tuition.

Không block toàn Student vì các domain độc lập này.

---

## 7. Student fields

Sheet:

`2. DỮ LIỆU HỌC VIÊN`

Một dòng từ STT >= 1 là một Student candidate.

Human columns hiện hành gồm:

- Họ và tên học viên
- Tên ở nhà
- Tên trường
- Đang học lớp
- Ngày sinh / Năm sinh
- Giới tính
- Ngày đăng ký
- Bé đã biết về cờ vua chưa
- Sở thích
- Nhận xét của phụ huynh về tính cách của bé
- Mong muốn của phụ huynh khi cho bé học cờ Vua tại IC
- Tỉnh/Thành phố
- Quốc tịch
- Trạng thái hiện tại
- Cấp độ học
- Mốc bot đã vượt qua
- Lịch học định kỳ
- Họ và tên Ba
- SĐT Ba
- Họ và tên Mẹ
- SĐT Mẹ
- Nơi ở hiện tại
- Gói học phí
- Đã học trước khi dùng iChess
- Học phí kỳ hiện tại

Không yêu cầu Admin nhập internal IDs.

Mapping human columns/current targets nằm ở mục 41. Cột `Học phí kỳ hiện tại` là **tình trạng thanh toán** theo mục 24, không một ô số tiền để ghi Finance. Numeric amount/nhãn không rõ nghĩa → QUESTION, không âm thầm reinterpret.

---

## 8. Birth-date normalization

Column:

`Ngày sinh / Năm sinh`

Accepted examples include:

2018

5/3/2018

05/3/2018

5/03/2018

05/03/2018

Equivalent separators may be normalized when unambiguous.

Rules:

`2018`
→ birth year only.

`5/3/2018`
→ full DOB 2018-03-05.

Blank
→ unknown.

Never create:

01/01/<year>

as a placeholder.

Never increase birth-date precision beyond what Admin actually supplied.

Invalid/impossible dates:

QUESTION

not guessed.

Contract này dùng dd/MM/yyyy cho text dates nêu trên; ISO YYYY-MM-DD cũng được nhận nếu calendar-valid. Không tự parse theo locale Mỹ. Dấu phân cách tương đương chỉ normalize khi rõ nghĩa. Native Excel date/serial phải biết loại ô và workbook date system 1900/1904; numeric bốn chữ số có thể là năm, không convert mọi số thành date. Value/date-format mâu thuẫn → QUESTION. Không shift ngày do UTC/timezone hoặc nhận fictitious Excel leap day.

Năm sinh: bốn chữ số 1900..năm hiện tại. Full DOB: current birthday validator, không tương lai. Ngày đăng ký optional phải là ngày thật; blank không lấy ngày import/T0/created_at thay thế. Business cutover theo ngày Việt Nam (`Asia/Ho_Chi_Minh`).

---

## 9. Human time normalization

CodeX must understand common Vietnamese time notation.

Equivalent when unambiguous:

10:30
10h30
10g30

→ 10:30

20h
20:00
20g

→ 20:00

Spaces may vary.

For example:

18g30 - 20h

→ 18:30–20:00

But CodeX must not guess AM/PM.

Example:

T3 6:30

may mean morning or evening.

If target cannot be resolved uniquely:

QUESTION

Do not silently convert to 18:30.

---

## 10. Weekday normalization

Recognize common Vietnamese weekday forms:

T2
T3
T4
T5
T6
T7
CN

Also reasonable spelling/spacing variants may be normalized.

Do not change weekday meaning.

`T3-T5` trong grammar lịch này là tập `{tue, thu}`, không tất cả ngày thứ Ba đến thứ Năm; range/cách viết khác chưa rõ cần QUESTION. Validate giờ 00:00–23:59, start < end; không tự lấp giờ kết thúc hoặc biến lịch qua đêm không hỗ trợ thành một Ca hợp lệ.

---

## 11. Schedule field

Column:

`Lịch học định kỳ`

This is intentionally human-readable.

Examples:

T3-T5 18:30-20:00

or:

T3 18g30-20h; T7 10h30-12h

The normalizer must parse the field into explicit candidate schedule facts.

One Student may have:

- one Ca;
- multiple weekdays in one Ca;
- multiple different Ca.

Do not assume:

a Student attends every weekday of a multi-day Ca.

---

## 12. Matching Student schedule to Ca

Read `1. CÀI ĐẶT CƠ SỞ` first.

Normalize all Ca rows with:

STT >= 1

and marked for import.

Then match Student schedule against the normalized Ca catalog.

Lịch học định kỳ của Student phải normalize trước, rồi đối chiếu **cả Ca khai trong workbook và Ca hiện có trên server đúng target**. Không chỉ tìm trong một catalog rồi tạo trùng Ca ở catalog còn lại.

| Kết quả đối chiếu | R3A: không mutation | R3B: sau approval đúng plan |
| --- | --- | --- |
| Có exact Ca hiện có trên server, resolve duy nhất | `REUSE_CA`; map Student về Ca đó, kể cả workbook cũng khai cùng definition. | Reuse, không tạo duplicate; enrollment/assignment riêng theo approved intent. |
| Khớp Ca khai trong workbook nhưng chưa có trên server, lịch đủ rõ | `PROPOSE_CREATE_CA`; gom các Student cùng confirmed Ca candidate để không propose duplicate. | Chỉ tạo Ca sau user approval của definition/plan đó; resolve ID rồi mới chạy dependencies. |
| Chưa có Ca khớp trong cả hai catalog, nhưng lịch đủ rõ | `PROPOSE_CREATE_CA` với definition suy từ schedule facts rõ; ghi mọi required fact còn thiếu và phạm vi cần duyệt. Đây chỉ là đề xuất, không tự thêm dòng/cột/sheet vào workbook. | Chỉ tạo khi user duyệt proposal và current required facts/capability đã đủ; không mutation trong R3A. |
| Ca/lịch/matching ambiguous hoặc dữ liệu mâu thuẫn | `QUESTION`; giữ raw/candidates, không đoán hoặc chọn candidate đầu. | Operation phụ thuộc chưa chạy cho tới khi resolve và plan được duyệt. |

`PROPOSE_CREATE_CA` không là business write, không automatic approval và không bypass current Ca/Schedule validators. Lịch đủ rõ có weekday/timeband và đủ căn cứ phân biệt candidate; nếu thiếu room để gán operational Schedule thì Ca proposal vẫn được review, nhưng bước assignment phụ thuộc giữ HOLD, không bịa room.

Catalog matching gồm server records đúng target được reuse và settings candidates trong plan, sau example/exclusion guards. Dòng bị skip không đóng góp catalog mới; một record server độc lập đã được xác nhận đúng vẫn có thể reuse. Exact Ca phải resolve duy nhất theo definition/scope thực, không tên đơn độc; Student dùng đúng weekday subset trong Ca. Room/alias/teacher facts đã biết có thể giúp phân biệt nhiều candidates trùng giờ, nhưng blank teacher không làm Ca không exact hoặc là lý do tạo Ca mới. Assignment teacher khác là intent riêng, không tự duplicate Ca để đổi teacher.

Student mới lịch blank → Schedule SKIP_NOT_SETUP; existing Student lịch blank → giữ lịch server. Lịch có phần rõ/phần mơ hồ được giữ nguyên raw và phân loại theo phần; chỉ plan phần được duyệt, không âm thầm discard phần còn lại.

V2.2 lưu Student + **full enrollment snapshot** với expected versions, mỗi enrollment là Ca + subset weekday. Fresh-read và merge approved changes vào toàn bộ state; file partial không full replacement. Student/enrollment có atomic boundary, không gửi payload enrollment HOLD/hỏng rồi mong partial save. Không historical effective_from/effective_to/ended_at giả; metadata không ngày đi học đầu/cuối. Makeup-only student không permanent roster đích.

---

## 13. Center Settings sheet

Sheet:

`1. CÀI ĐẶT CƠ SỞ`

Contains four logical sections:

1. Thông tin cơ sở
2. Ca học / Lớp
3. Gói học phí
4. Danh mục nhập liệu / Nhật ký thay đổi

Only STT >= 1 rows are real data.

Rows explicitly marked:

`Dùng cho import? = Không`

must be ignored.

Nếu vùng có cột `Dùng cho import?` nhưng blank/không rõ → QUESTION, không tự coi là Có. Nếu vùng không có cột đó, dùng scope đã duyệt. Danh mục nhập liệu chỉ reference/dropdown: đối chiếu current enums, không tạo Student/Level/Teacher/catalog từ sample chips. Nhật ký thay đổi không business input.

---

## 14. Center information

Center information may include:

- Mã cơ sở
- Tên cơ sở
- Địa chỉ
- Hotline
- Phí giáo trình tái đăng ký
- Tiền tố Phiếu Thu
- Tên người thu mặc định
- Ghi chú

R3 must still resolve exact target center through trusted environment/Owner context.

Workbook center code/name is business input, not permission to mutate an arbitrary center.

Current center profile: display name 1–120 ký tự; address ≤300, hotline ≤40, note ≤500; default collector optional ≤120. Phí giáo trình là số nguyên VND không âm theo policy thật; không default 80.000 từ schema/QA. Prefix 2–6 A–Z/0–9, normalize uppercase; không receipt number cũ. Missing settings facts required chỉ HOLD operation phụ thuộc.

Giữ frozen company TBHP bank/account/QR; không dùng tài khoản cá nhân trong Excel để thay payment profile. Center provisioning/access thiếu là prerequisite governance riêng, không tạo center/membership từ mã Excel.

---

## 15. Ca / Lớp

One row = one current Ca definition.

Human data may contain:

- Tên Ca / Lớp
- Ngày học
- Giờ học
- Phòng
- Giáo viên if known
- trạng thái
- note

Level does not belong to Ca.

Student Level remains Student authority.

Teacher may be blank.

Do not create fake teacher.

**Teacher là optional. Blank teacher không block Ca hoặc Student import**, không HOLD hai domain đó và không clear A3 assignment đã có. Nếu Teacher được cung cấp và resolve duy nhất về registry/center assignment hợp lệ, R3A plan **current A3 teacher assignment sau khi Ca tồn tại**; R3B chỉ thực hiện đúng approved intent. Không ghi legacy `instructorName`. Nếu teacher chưa resolve/ambiguous, QUESTION/HOLD teacher assignment riêng; phần Ca/Student đủ điều kiện vẫn có thể nằm trong plan được duyệt, không mất teacher fact trong evidence.

Ca mới qua current Settings builder có 1–2 weekday, một timeband chung và active/inactive rõ (`Đang dùng/Đã ngưng`); không tự default active. Tên lưu được sinh từ ngày/giờ, tên sổ là alias. Existing Ca thật >2 days giữ authority, không rebuild cap 2 làm mất ngày.

Room thật required khi gán/chỉnh operational Schedule slot; bare Ca có thể chưa gán. Không bịa Phòng 1. Ca sinh planning slots không là persisted Schedule/Attendance; dùng current assign/edit flow, resolve lineage/identity, không manual-create recurring bị chặn/persist virtual IDs/duplicate master mỗi ngày.

Teacher thật cần registry/center assignment đúng và A3 dated assignment theo quyền hiện hành; không legacy instructorName write vào Ca mới hoặc tạo account từ tên. Today/future theo current guard, không backdate teacher history. Missing room chỉ HOLD operational Schedule assignment cần room; teacher fact/authority unresolved chỉ HOLD teacher assignment, không Ca/Student vì blank teacher.

---

## 16. Tuition package catalog

One row = one package.

Expected facts:

- package name;
- session count N;
- price;
- optional program;
- optional max weeks;
- active/inactive.

Do not invent package price or N.

Package names alone are not enough to resolve conflicting packages.

Tên gói 1–120 ký tự; N nguyên 1–1000; giá nguyên VND không âm; program ≤120 optional, max weeks 1–5200 hoặc null, note ≤500. Active/inactive phải rõ, không default chưa được duyệt. Giá 0 chỉ thỏa thuận thật. Normalize tên + resolve đúng center/catalog record + N/giá/active state; conflict QUESTION, không chỉnh shared catalog để vừa một bé. Current cycles giữ terms snapshots, không recalc theo catalog mới. Opener chỉ active package.

---

## 17. Parent / Customer handling

Parent information lives directly on each Student row for Admin simplicity.

Possible fields:

- Họ và tên Ba
- SĐT Ba
- Họ và tên Mẹ
- SĐT Mẹ
- Nơi ở hiện tại

R3 normalizer must internally resolve Parent/Contact candidates.

Customer/Contact should be linked automatically from confirmed parent facts.

Do not require Admin to create separate Parent IDs.

---

## 18. Parent appearing on multiple Students

If the same normalized parent identity appears on two or more Student rows:

do not blindly merge.

Create a question such as:

“Nguyễn Thị Hoa / 09xx... xuất hiện ở Học viên A và Học viên B.
Đây là hai anh/chị/em dùng chung một phụ huynh hay là hai người khác nhau?”

Candidate indicators may include:

- same normalized phone;
- same parent name;
- same address;
- other consistent facts.

They are evidence for matching, not automatic proof.

After user confirms siblings/shared parent:

reuse one canonical Contact and link multiple Students.

If they are different people:

keep separate.

Names alone never prove identity.

Confirmation đã có đúng scope trong approved plan được reuse, không hỏi lại. Server identity protection/withheld field không là missing fact để Admin chép lại. Student match cần đúng center + tên + confirmed parent/link + DOB/year hoặc evidence khác; collision/no DOB phải review, STT/tên/DOB đơn độc không identity. Shared phone giữa hai người khác cần current workflow review, không đổi số/create identity giả để lách constraints.

Confirmed Ba/Mẹ → PARENT + FATHER/MOTHER; generic parent chưa rõ Ba/Mẹ → neutral UNSPECIFIED. Relationship type khác cần confirmation; unknown không auto OTHER_REVIEWED. Nếu hai cột Ba/Mẹ không thể hiện đúng người giám hộ/liên hệ khác, thu clarification trong QUESTIONS/plan, không nhét fact sai cột hoặc thêm business sheet.

Chỉ một active general primary Contact/Student; hai người liên hệ không tự xác định primary. Giữ existing primary hoặc hỏi, không default Mẹ/Ba. Financial/academic roles khác account permissions. Current Student builder ưu tiên Mẹ rồi Ba trong compatibility parentName/parentPhone, không PH1 primary authority. PH1 frontend helper bỏ optional guardian-role/occupation args nhưng server có; preserve/map confirmed roles qua current protected contract và read-back, không mất fact vì default UNSPECIFIED.

---

## 19. Missing parent data

Do not invent:

- parent name;
- phone;
- father/mother identity.

If current Student authority technically requires a contact route and none exists:

classify clearly.

Do not fabricate a phone number to bypass validation.

Direct Student form require fullName/schoolName/level và ít nhất một usable contact name+phone; không require cả Ba/Mẹ. Pair có name thiếu phone hoặc ngược lại phải được báo; không discard facts âm thầm để form pass. DOB full/year-only/unknown được direct route hỗ trợ. CRM F4B CREATE_NEW stricter: full DOB thật + school + level. Unknown DOB có thể Student/V2.2 rồi PH1 linkage, không fake CRM consultation history.

Thiếu school/level/contact hoặc business-valid blank mà route không nhận → PRODUCT_ALIGNMENT_REQUIRED cho operation phụ thuộc. Student-first không hứa mọi Student đều create được. Existing record đúng reuse trước; update vẫn qua current guards. Không ghi “Khác”/Dolphin 1/phone giả hoặc bypass raw table write.

---

## 20. Tuition columns

Student row may contain:

- Gói học phí
- Đã học trước khi dùng iChess
- Học phí kỳ hiện tại

These fields belong to Tuition setup, not Student identity.

---

## 21. Missing Tuition

If all Tuition fields are blank:

Student import may continue.

Tuition operation:

SKIP_NOT_SETUP

Expected app result may be:

“Chưa thiết lập học phí”.

Do not create:

- empty cycle;
- fake package;
- fake Payment;
- fake Finance;
- fake Receipt.

---

## 22. Partially filled Tuition

Example:

package known
but X blank

or:

X known
but payment state blank

Student may still import.

Tuition portion becomes:

HOLD_TUITION

Do not block unrelated Student/Profile/Parent import.

Normalized preview must show exactly which Tuition facts are missing.

---

## 23. Complete legacy Tuition

When all required legacy facts are known:

- correct package;
- pre-iChess used sessions X;
- payment state;

then plan current supported opening Tuition flow.

X is sessions used in the current package before iChess.

Do not reconstruct old Attendance rows.

X nguyên 0..N (kể cả N), không lifetime total, buổi bù mới hứa/booked hoặc counter sau go-live. Explicit 0 phải fact thật; legacy blank không 0. Progress = baseline X + canonical Attendance contributions: P +1, V +0, actual makeup destination B +1, booking riêng +0; không monthly reset.

Frozen SETUP_INITIAL_CYCLE chỉ khi **chưa có cycle bất kỳ**, Student/active package/capability đúng và initial setup setting cho legacy. Existing closed/no-current cycle cũng không cho phép re-init; reuse/reconcile hoặc HOLD_TUITION. Opener tạo **Kỳ 1**, catalog price, discount=0; không custom old cycle number, riêng price/discount/fees/partial payment. Old numbering/thỏa thuận riêng cần bảo toàn giữ reference/exception, không dựng kỳ rỗng hoặc đổi shared catalog âm thầm.

Cutoff server = **ngày Việt Nam thực thi setup − 1**, không custom ngày Excel/T0. Plan ghi ngày chốt X/execution date, check lại R3B. Execution trễ/snapshot cũ/canonical Attendance sau cutover mà chưa có cycle → HOLD để resolve đúng; không backdate/đẩy sessions iChess vào pre-iChess X. Setup trước countable Attendance/Payment actions liên quan. Unpaid là cùng kỳ bàn giao, không xóa nợ bằng kỳ mới.

NEW_ICHESS chỉ khi ý định bắt đầu gói mới thật được xác nhận: X=0/UNPAID là rule của nhánh mới, không default legacy blank. No-package đúng intent giữ no-package.

---

## 24. Tuition payment state

Accept human labels and normalize them conservatively.

Canonical meanings include:

Đã thanh toán đủ trước iChess

Chưa thanh toán khoản nào

Đã thanh toán một phần

Chưa biết

Paid-before-iChess is opening truth only.

It must not create historical:

- Payment;
- Finance transaction;
- Receipt;
- cashier;
- bank reference.

Partial or unknown:

HOLD_TUITION

unless a later approved product flow explicitly supports it.

“Đã đóng/đã thanh toán” chỉ map paid đủ khi ý nghĩa đủ được xác nhận; “còn nợ/chưa đủ” không unpaid zero. Numeric amount/nhãn chưa rõ → QUESTION. Opening PAID có thể không Receipt; money Reports đọc Finance thật, không opening paid label. Không payment date/allocation/Receipt giả. Real later Payment là current workflow trong scope riêng được duyệt.

---

## 25. Smart normalization vs guessing

CodeX should be flexible about FORMAT.

CodeX must be conservative about FACTS.

Allowed smart normalization examples:

10h30 → 10:30

05/3/2018 → 2018-03-05

“ tp hcm ” → TP.HCM where meaning is unambiguous

Extra spaces/case/punctuation → normalize safely.

Not allowed:

6:30 → 18:30 without proof

blank level → Dolphin 1

blank school → “Khác”

blank phone → fake number

blank Tuition X → 0

blank payment → UNPAID

unknown parent → invent Ba/Mẹ

unknown DOB → 01/01/year

Phone là chuỗi, giữ leading 0; Canonical Contact v1 nhận mobile VN `0[35789]` + 8 số hoặc 84/+84 tương đương, server +84, Student Ba/Mẹ domestic 10 digits. Numeric phone mất 0 hoặc số bàn/quốc tế khác → QUESTION nếu không có bằng chứng/current authority nhận được, không tự prefix fake.

N/X/max weeks/tiền là integer theo domain, tiền VND; blank không 0, không round/nhân nghìn. `1.600`/`1,600` mơ hồ phải hỏi. Unicode NFC/trim giữ dấu và display names; case/punctuation chỉ normalize khi không đổi nghĩa. Giữ raw/normalized/provenance, không fuzzy identity merge/truncate.

---

## 26. R3 must be two-stage

No direct Excel → Supabase mutation.

Mandatory workflow:

Excel
→ R3A Normalize / Audit
→ User approval
→ R3B Import

---

## 27. R3A outputs

Before any business mutation, generate:

`R3-NORMALIZED-PREVIEW.xlsx`

`QUESTIONS.md`

`IMPORT-PLAN.md`

Optional machine-readable normalized artifact may also be generated.

Các artifacts phải cùng revision. Plan ghi workbook SHA-256, policy path/Git revision, exact target/environment/actor scope, current snapshot/versions, approved defaults/answers và expected operations/side effects. R3A business writes = 0; không gọi mutation để “thử validate”, không provisioning/migration/deploy.

---

## 28. R3-NORMALIZED-PREVIEW.xlsx

This is a technical review workbook.

It is NOT the Admin intake workbook.

It must show how CodeX interpreted the original data.

Useful fields include:

- source STT;
- normalized Student name;
- normalized birth precision;
- normalized DOB/year;
- normalized parent contacts;
- normalized schedules;
- matched Ca;
- normalized package;
- Tuition state;
- intended operation;
- READY / WARNING / QUESTION / SKIP.

Do not hide transformations from the user.

Giữ sheet/vùng/Excel row/STT, raw values/type, normalized values/precision, defaults/provenance, matching evidence, domain status/reasons và create/reuse/update/skip/defer intent. Một READY chung không được che HOLD của domain khác. Technical preview không giới hạn hai sheet và không thành approval tự động.

---

## 29. QUESTIONS.md

Only ask questions that materially affect safe import.

Do not ask Admin to re-enter optional data merely because it is blank.

Prioritize:

- identity ambiguity;
- parent duplicate ambiguity;
- ambiguous time/date;
- unresolved Ca;
- conflicting package;
- dangerous Tuition mismatch;
- target-center uncertainty.

Keep questions in plain Vietnamese.

---

## 30. IMPORT-PLAN.md

Must summarize in business language:

- Center Settings to create/update;
- number of Ca;
- number of packages;
- Students to create;
- Contacts to create/reuse;
- Student-parent links;
- enrollments to create;
- Students with no schedule;
- Tuition setups;
- Students remaining “Chưa thiết lập học phí”;
- Tuition rows held;
- skipped/example rows;
- unresolved questions;
- expected write counts.

No mutation during R3A.

Tách command count khỏi business row writes và legitimate history side effects; một command có thể ghi nhiều rows. Nêu dates/cutover, expected before state, dependencies/atomic boundaries, retry/partial completion và read-back checks. Kho/quỹ/account/provisioning/Payment ngoài workbook không tự trở thành scope.

---

## 31. Approval gate

R3B is forbidden until user explicitly approves the normalized preview/import plan.

No interpretation of:

“looks okay”

from an earlier unrelated message.

Require explicit approval for that import plan.

Approval R2 workbook/policy/docs commit/audit PASS không là approval import. Nếu authorization cho đúng plan/scope đã có trong session, dùng lại, không hỏi lần nữa chỉ vì đổi turn. Input/identity/target/facts/writes thay đổi materially cần revision và approval scope mới. Policy không tự tạo một approval flow lặp vô ích.

---

## 32. R3B target safety

Before mutation:

- resolve exact target center;
- verify user authorization;
- verify expected environment;
- fresh-read center state;
- confirm the intended new-center target is business-empty or reconcile unexpected rows;
- do not use DreamHome/Phòng Trống/another center merely because it is first/default.

If unexpected target data exists:

STOP and report.

Existing-center plan reconcile đúng records, không bắt center business-empty để reuse. Fresh-read IDs/versions/before state, no cross-center writes; stale snapshot không quyền overwrite. Actor đổi center/quyền, file/hash đổi hoặc facts conflict → dừng operation phụ thuộc. Missing bootstrap/access đi governance riêng, không service-role bypass/raw table write.

---

## 33. Import order

Preferred business order:

1. Center Settings
2. Packages
3. Ca
4. Parent/Contact
5. Students
6. Parent–Student links
7. recurring Student schedules/enrollments
8. Tuition opening when complete
9. read-back verification

Use current frozen authorities.

Do not raw-write tables merely for convenience.

Resolve current Schedule slots/room/dated teacher khi cần; không tạo recurring master giả. Đây là dependency order, không một bulk transaction toàn workbook. Contact/link/settings/Tuition là commands riêng; Student/enrollment có atomic boundary V2.2.

Retry cùng approved intent/idempotency theo authority, fresh-read/revalidate versions. Timeout chưa biết success phải read-back trước tạo lại, không duplicate. Failed command dừng descendants, giữ success evidence; không compensation delete/reset/void/history rewrite tự động. Báo rõ phần đã làm/chưa làm/held, không PASS che partial completion.

---

## 34. Missing operational domains

Do not import or fabricate:

- Attendance history;
- Makeup history without canonical source;
- Reports totals;
- Bell state;
- Checklist history;
- Audit history;
- Receipt history;
- historical Finance merely to represent old payments.

These should derive or begin from actual operation after go-live.

Kho/quỹ không có vùng nguồn canonical ở workbook hai sheet, mặc định ngoài scope, không zero vì không có sheet. Nếu cần dùng supported R1 opening flow thì task/plan riêng được duyệt với real facts, không tự thêm business sheets/fake purchase/income. Cam kết bù còn outstanding thiếu canonical source V giữ issue/việc bàn giao; không fake source/link/B/permanent roster. Không copy fixtures/QA centers thành real data.

---

## 35. Audit / change log

`Nhật ký thay đổi` in Settings is operational output.

Admin does not backfill immutable Audit events from Excel.

New real operations generate their own legitimate history according to current authority.

---

## 36. Error isolation

One incomplete Student should not automatically cancel every other valid Student.

R3A must classify at row/domain level.

Examples:

Student READY
Tuition HOLD

Student READY
Schedule MISSING

Parent QUESTION
Student HOLD_IDENTITY

Only mutation dependencies that truly require the unresolved fact are blocked.

Review statuses và operation codes phải được phân biệt:

| Review status | Nghĩa |
| --- | --- |
| READY | Operation đã resolve facts/matching/capability/dependencies; vẫn cần đúng approval. |
| WARNING | An toàn với limitation đã mô tả, không unresolved risky fact/identity. |
| QUESTION | Có câu hỏi material; operation phụ thuộc ngoài mutation. |
| HOLD | Chưa chạy được, nêu reason/capability/dependency cụ thể. |
| SKIP | Không operation; reason EXAMPLE_ONLY, SKIP_EXCLUDED, SERVER_REUSED, SKIP_NOT_SETUP hoặc ngoài scope. |

Domain codes gồm HOLD_IDENTITY/HOLD_SCHEDULE/HOLD_TUITION/PRODUCT_ALIGNMENT_REQUIRED/SKIP_NOT_SETUP. PRODUCT_ALIGNMENT_REQUIRED không WARNING để write. Global target/environment/schema uncertainty block phạm vi liên quan; optional blank không lỗi toàn workbook. No schedule khác unknown schedule, không lệnh xóa.

---

## 37. No silent deletion

Omitted rows do not mean DELETE.

Blank cells do not mean CLEAR.

Spreadsheet import is additive/setup-oriented unless an explicit later approved update/delete workflow says otherwise.

---

## 38. Formula/text safety

Treat Admin-provided text as literal text.

Do not execute spreadsheet formulas or external links as business instructions.

Normalize visible cell values only.

Giữ formula/cached value provenance; không tin cached formula result là fact chỉ vì visible, hỏi nếu ảnh hưởng business field. Không evaluate hoặc refresh external links. Export text bắt đầu =/+/-/@ dưới dạng text để không thành formula; không tự gửi workbook/PII ra dịch vụ ngoài scope được duyệt.

Never interpret workbook macros/scripts as permission to mutate data.

---

## 39. Evidence preservation

R3 should preserve:

- original uploaded Excel unchanged;
- normalized preview;
- questions;
- approved import plan;
- before/after counts;
- mutation result;
- post-import verification.

Do not overwrite the original intake file.

Giữ policy revision, original SHA-256, approval/answers, operation IDs/results/versions, read-back và skipped/held rows. Không secrets trong evidence. Real commands tự sinh legitimate Audit theo authority, không backfill change log. Nếu không mutation thì báo business writes = 0.

---

## 40. Final principle

The Admin operates the center.

The importer operates the data plumbing.

Therefore:

Do not make the Admin behave like a database operator.

Be flexible about human formatting.

Be strict about business truth.

Import what is safely known.

Leave what is unknown for the app.

Never fabricate missing facts.

---

## 41. Human column → current internal target

Bảng dành cho R3 implementation; không cột IDs/RPC yêu cầu Admin nhập. Unknown ngoài contract được giữ ở review/provenance, không âm thầm bỏ hoặc thêm raw payload field.

| Human column | Internal target / rule |
| --- | --- |
| Họ và tên học viên | fullName; required cho current create, không identity key đơn độc. |
| Tên ở nhà | homeName; optional. |
| Tên trường | schoolName; không fake “Khác”, current guard mục 19. |
| Đang học lớp | schoolGrade; lớp phổ thông, không Ca/age-derived. |
| Ngày sinh / Năm sinh | birthDate hoặc birthYear hoặc unknown; không tăng precision. |
| Giới tính | gender: Nam→male, Nữ→female, Chưa cập nhật→empty. |
| Ngày đăng ký | registrationDate; ngày thật optional, không T0 substitute. |
| Bé đã biết về cờ vua chưa | priorChessKnowledge: Đã biết→known, Chưa biết→not_known, Chưa cập nhật→empty. |
| Sở thích | hobbies; optional text. |
| Nhận xét của phụ huynh về tính cách của bé | personality; optional, không care-log lịch sử giả. |
| Mong muốn của phụ huynh khi cho bé học cờ Vua tại IC | parentGoal; optional text nguyên nghĩa. |
| Tỉnh/Thành phố | hometown; mục 5 default policy. |
| Quốc tịch | nationality; mục 5 default policy. |
| Trạng thái hiện tại | currentStatus: Đang theo học/Bảo lưu/Ngưng học; approved default cho mới. |
| Cấp độ học | level; 19 current values: Dolphin 1–4, Turtle 1–3, Bee 1–3, Monkey 1–3, Elephant 1–3, Jaguar, Lion, Eagle. Không từ Ca/sample nhãn Nhập môn/Cơ bản/Trung cấp/Nâng cao. Alias legacy chỉ khi current mapping/meaning được kiểm tra và xác nhận. |
| Mốc bot đã vượt qua | highestBotMilestone; đối chiếu current botMilestones, khác level enum; không suy từ level. |
| Lịch học định kỳ | Ca + weekday subset → V2.2; independent schedule domain. |
| Họ và tên Ba / SĐT Ba | fatherName/fatherPhone + confirmed Contact/PH1 facts. |
| Họ và tên Mẹ / SĐT Mẹ | motherName/motherPhone + confirmed Contact/PH1 facts. |
| Nơi ở hiện tại | parentArea/contact area qua supported route; không auto-copy receipt address/CCCD. |
| Gói học phí | active package reference; không Student identity field. |
| Đã học trước khi dùng iChess | X của chính current opening cycle, integer 0..N. |
| Học phí kỳ hiện tại | payment opening intent, không Finance amount; mục 24. |

## 42. Acceptance gate cho mọi R3/import

Chỉ đề xuất/chạy mutation khi đúng scope được duyệt và:

- Đọc policy, ghi revision; physical workbook đúng hai sheet và original unchanged.
- Guard STT0/example/excluded áp trước defaults/matching; populated malformed rows có QUESTION.
- Raw→normalized/default provenance thấy rõ; unknown không fake facts.
- Target/identity/siblings/primary/Ca/package collisions resolve hoặc HOLD; correct server facts reuse, blank/omission không clear/delete.
- Student level độc lập Ca, subset days/multi-Ca đúng; route/capability/versions/atomic boundary hiện hành được tôn trọng.
- Student-first tách Tuition/Schedule; no-cycle legacy X/paid/cutoff hợp lệ; không fake Attendance/Finance/Receipt.
- Preview/questions/plan cùng revision và explicit approval đúng scope trước R3B.
- Expected side effects, retry/read-back, error isolation và partial completion evidence rõ; không source/migration/deploy/writes ngoài scope.

READY là một operation đủ điều kiện thực hiện theo approval, không nghĩa toàn workbook phải hoàn chỉnh. Phần thiếu được giữ rõ để bổ sung qua workflow phù hợp.

## 43. Frozen authority references

- `artifacts/R1/SOURCE-AUDIT.md` (local audit evidence): current domain/server evidence; không sửa historical test debt/core trong import task.
- [Student form](../../../src/student-module.js#L112), [birthday precision](../../../src/student-birth-information.js#L3), [status/bot enums](../../../src/student-data.js#L1): fields, required guards, defaults/builders.
- [Settings](../../../src/settings-module.js#L13), [Schedule](../../../src/schedule-module.js#L343), [weekday enrollment](../../../src/student-recurring-enrollment.js#L36), [V2.2 adapter](../../../src/cloud-authoritative-student-enrollments.js#L77): catalog/assignment/full snapshot.
- [PH1 adapter](../../../src/cloud-authoritative-parent-student-links.js#L183), [F4B contract](../../../supabase/migrations/202609220001_f4b_customer_student_handoff_authority.sql#L493): protected relationships/strict conversion route.
- [Definitive Tuition setup](../../../supabase/migrations/202609270005_tuition_definitive_initial_setup.sql#L24), [Tuition validator](../../../src/tuition-module.js#L293), [makeup authority](../../../src/cloud-makeup-bookings.js): no-cycle/cutoff/terms/no fake history.

Core thay đổi trong task riêng được duyệt thì import task phải kiểm tra current contracts còn tương thích. Mismatch báo PRODUCT_ALIGNMENT_REQUIRED/policy revision được duyệt, không bỏ safety gates.
