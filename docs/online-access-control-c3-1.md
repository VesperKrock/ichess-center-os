# C3.1 - Auth + Membership + Read-only Gate

## 1. Muc tieu C3.1

C3.1 tao nen access-control toi thieu cho Online Collaboration: biet Supabase da cau hinh chua, user da dang nhap chua, dang o center nao, membership/role la gi, co duoc doc/ghi cloud hay khong, va ly do read-only.

Phase nay khong trien khai realtime, khong write-through Hoc vien moi, khong chay SQL, khong sua du lieu local/cloud, khong tao production center that.

## 2. Auth state

Auth source hien tai la Supabase Auth trong `src/supabase-auth.js`.

Trang thai chinh:

- Supabase chua cau hinh: app chay local-only, cloud write bi chan.
- Chua dang nhap: local van dung duoc, cloud write bi chan.
- Da dang nhap: doc membership theo center hien tai truoc khi cho phep cloud action.
- Auth error hoac token het han: cloud action ve read-only, khong xoa draft/local data.

## 3. Membership source

Membership source hien tai la bang `center_members`, doc qua:

- `getCurrentCenterMembership(userId, centerId)` trong `src/supabase-auth.js`.
- C2 readiness trong `src/cloud-db-sync.js` cung doc `center_members` truoc khi thao tac `center_cloud_entities`.

Repo co dau vet SQL/RLS C1/C2.2 cho `center_members` va `center_cloud_entities`, nhung C3.1 khong chay SQL va khong tao patch SQL moi. Neu moi truong thieu bang/policy/function membership de xac thuc quyen that, client phai bao:

`NEEDS MEMBERSHIP SQL PATCH`

Khong fake quyen ghi bang email, metadata, hoac role hard-code.

## 4. Role model

Role toi thieu duoc chuan hoa trong `src/online-access-control.js`:

- `owner`
- `qtv`
- `center_admin`
- `teacher`
- `consultant`
- `viewer`
- `none`
- `unknown`

Alias nho nhu `admin`, `center-admin`, `center admin` duoc normalize ve `center_admin`; role khong nam trong danh sach ve `unknown`.

## 5. Read-only/write gate

Helper C3.1:

- `normalizeOnlineRole(role)`
- `buildOnlineAccessState(input)`
- `canReadModule(accessState, moduleId)`
- `canWriteModule(accessState, moduleId)`
- `canWriteEntity(accessState, entityType)`
- `getReadOnlyReason(accessState)`
- `isOnlineWriteAllowed(accessState, scope)`

Access state chuan:

- `ok`
- `isSignedIn`
- `centerId`
- `hasMembership`
- `role`
- `canRead`
- `canWrite`
- `readOnly`
- `reason`
- `needsMembershipPatch`

Write guard hien duoc dung trong:

- `src/main.js`: chan auto/manual core cloud push neu access state read-only.
- `src/cloud-db-sync.js`: chan `pushLocalCoreEntitiesToCloud` o lop gan Supabase de caller khac khong vo tinh ghi cloud.

## 6. Permission matrix rut gon

| Role | Cloud read | Cloud write core entity C3.1 |
| --- | --- | --- |
| `owner` | Yes | Yes |
| `qtv` | Yes | Yes |
| `center_admin` | Yes | Yes |
| `teacher` | Yes | No, cho scope rieng ve sau |
| `consultant` | Yes | No, cho scope rieng ve sau |
| `viewer` | Yes | No |
| `none` | No | No |
| `unknown` | No | No |

Core entity C3.1 chi giu nen cho `student`, `teacher`, `class_session` theo C2. Khong mo allowlist online cho attendance, TKB, Hoc phi.

## 7. Behavior theo tinh huong

- Chua dang nhap: `canWrite = false`, ly do `signed-out`.
- Chua co center: `canWrite = false`, ly do `missing-center`.
- Khong co membership: `canWrite = false`, `needsMembershipPatch = true` neu da signed-in va co center nhung khong doc/khong co membership that.
- `viewer`: doc duoc khi membership hop le, nhung `canWrite = false`.
- `center_admin`: ghi core cloud entity neu Supabase configured, signed-in, co center, membership hop le va Cloud DB ready.
- `owner`/`qtv`: ghi core cloud entity neu membership hop le va Cloud DB ready.
- `teacher`/`consultant`: doc duoc, nhung C3.1 khong cap quyen ghi rong; scope own-only se la phase sau.

## 8. NEEDS MEMBERSHIP SQL PATCH

C3.1 phai bao `NEEDS MEMBERSHIP SQL PATCH` khi backend membership/RLS/table/function chua du de xac thuc quyen that.

Dieu nay co nghia:

- Khong suy dien role tu email.
- Khong coi user signed-in la admin.
- Khong cho viewer/no membership ghi cloud.
- Khong tao cam giac cloud write thanh cong neu thuc ra chi local.

## 9. C3.2 se dung nhu the nao

C3.2 co the goi `buildOnlineAccessState` va `canWriteEntity(accessState, 'student')` truoc moi duong write-through Hoc vien. Neu helper tra read-only, C3.2 phai giu local/draft an toan va hien ly do thay vi upsert cloud.

Khi C3.2 them realtime/manual refresh cho Hoc vien, subscription hoac write phai chi bat sau khi co:

- Supabase configured.
- User signed-in.
- Membership hop le cho selected center.
- `centerId` ro rang.
- Role duoc phep theo scope.

## 10. Non-scope

- Chua realtime.
- Chua subscribe Supabase realtime.
- Chua write-through Hoc vien moi.
- Chua SQL.
- Chua tao bang Supabase.
- Chua sua du lieu local/cloud.
- Chua tao production center.
- Chua center switcher lon.
