# C3.4B - Schedule Session Bridge / Readiness Guarded

## 1. Summary

C3.4B la phase bridge/readiness cho `schedule_session`. Phase nay chua bat realtime runtime, chua subscribe Supabase Realtime cho TKB, chua apply SQL va chua claim live production pass.

Muc tieu la chuan hoa payload Module 7/TKB, tao preview readiness, va lam ro bridge:

```txt
schedule_session.classSessionId -> class_session.id
```

## 2. Local source

Module 7/TKB doc/ghi local source:

```txt
ichessCenterOS.schedule.dreamhome
```

Repo source:

- `src/storage.js`: `getStoredSchedule`, `saveStoredSchedule`, `normalizeScheduleSessions`.
- `src/schedule-module.js`: `buildScheduleSessionFromForm`.
- `src/main.js`: add/edit/delete TKB hien chi ghi local qua `saveStoredSchedule`.

## 3. Cloud entity

Entity bridge:

```txt
schedule_session
```

Helper C3.4B:

- `src/cloud-schedule-session-bridge.js`
- `normalizeScheduleSessionForCloud`
- `validateScheduleSessionPayload`
- `buildScheduleSessionCloudPayload`
- `buildScheduleSessionBridgePreview`
- `canWriteScheduleSession`
- `getScheduleSessionBridgeReadiness`

Helper nay khong push cloud, khong subscribe realtime, khong sua localStorage.

## 4. Payload mapping

| Local field | Cloud payload field | Required? | Notes |
| --- | --- | --- | --- |
| `id` | `id` | YES | Neu thieu, helper F19H.2d chi tao deterministic id khi du `classSessionId + scheduleType + date/dayOfWeek + startTime + endTime`. |
| `classSessionId` | `classSessionId` | NO | Reference toi `class_session.id` neu co; khong tu bia mapping. |
| `teacherId` | `teacherId` | NO | Nullable string; missing se duoc count trong preview. |
| `teacherName` | `teacherName` | NO | Preserve legacy display field. |
| `studentIds` | `studentIds` | YES as array shape | Normalize thanh unique string array; empty duoc count trong preview. |
| `scheduleType` | `scheduleType` | YES | `recurring` hoac `oneOff`; co normalize legacy type. |
| `date` | `date` | YES for oneOff | Dinh dang `YYYY-MM-DD`. |
| `dayOfWeek` | `dayOfWeek` | YES for recurring | One-off co the suy ra tu `date`. |
| `startDate` | `startDate` | NO | Chi preserve cho recurring. |
| `endDate` | `endDate` | NO | Chi preserve cho recurring. |
| `startTime` | `startTime` | YES | Dinh dang `HH:mm`. |
| `endTime` | `endTime` | YES | Phai lon hon `startTime`. |
| `room` | `room` | NO | Preserve phong hoc. |
| `groupName` | `groupName` | NO | Preserve ten nhom neu co. |
| `level` | `level` | NO | Fallback `mixed`. |
| `status` | `status` | YES | `scheduled`, `done`, `cancelled`; fallback `scheduled`. |
| `note` | `note` | NO | Preserve ghi chu. |
| `createdAt` | `createdAt` | NO | Preserve neu co. |
| `updatedAt` | `updatedAt` | NO | Preserve neu co, fallback tu `createdAt`. |

## 5. Bridge voi class_session

`class_session` la catalog/core. `schedule_session` la lich van hanh.

Bridge rule:

```txt
schedule_session.classSessionId -> class_session.id
```

Neu local schedule thieu `classSessionId`, C3.4B khong tu bia mapping va khong ghi nguoc data. Preview chi report:

- `missingClassSessionId`
- `validClassSessionId`
- `missingReferencedClassSession`

Phase sau co the tao migration/bridge UI neu can, nhung C3.4B chi audit/preview.

## 6. Readiness preview

`buildScheduleSessionBridgePreview(scheduleSessions, context)` tra ve:

- `total`
- `valid`
- `invalid`
- `missingClassSessionId`
- `validClassSessionId`
- `missingReferencedClassSession`
- `missingTeacherId`
- `emptyStudentIds`
- `recurring`
- `oneOff`
- `legacyUnknown`
- `needsScheduleSessionSqlPatch`
- `needsMembershipSqlPatch`
- `needsRealtimePatch`
- `readyForRuntimeWrite`

Default readiness hien tai la blocked vi backend live chua duoc apply/xac nhan.

## 7. Access-control C3.1

C3.4B dung C3.1 guard de xac dinh rule cho future runtime.

Duoc ghi `schedule_session` trong MVP tuong lai neu cloud + membership + SQL ready:

- `owner`
- `qtv`
- `center_admin`

Bi chan:

- `viewer`
- `teacher`
- `consultant`
- `none`
- `unknown`
- signed-out
- missing membership
- missing center

Teacher own-only la phase sau, khong lam trong C3.4B.

## 8. SQL/readiness state

SQL applied: NO.

NEEDS MEMBERSHIP SQL PATCH: YES.

NEEDS SUPABASE REALTIME PATCH: YES.

NEEDS SCHEDULE_SESSION SQL PATCH: YES.

NEEDS SUPABASE CONFIRMATION: YES.

`docs/supabase-f19h2d-schedule-session-allowlist.sql` da ton tai nhu patch plan/allowlist note, nhung C3.4B khong chay SQL va khong claim remote allowlist da ready.

## 9. Recommended next phase

Recommended next phase:

```txt
C3.4C - Schedule Session Realtime Guarded Runtime
```

Dieu kien truoc khi C3.4C claim live:

- Membership/RLS patch da duoc review/apply thu cong.
- `schedule_session` allowlist da duoc confirm tren Supabase live.
- Realtime publication/filter cho `center_cloud_entities` da duoc confirm.
- Manual QA hai tab/hai tai khoan/cross-center da chay.

Neu preview C3.4B cho thay nhieu missing `classSessionId` hoac referenced class missing, can chen mot phase bridge fix/migration plan truoc C3.4C runtime.

## 10. Mojibake check

Docs/source/tests C3.4B da duoc smoke test check khong co mojibake trong cac file moi:

- `src/cloud-schedule-session-bridge.js`
- `docs/online-schedule-session-bridge-c3-4b.md`
- `tests/c3-4b-schedule-session-bridge-readiness-guarded-smoke.js`

Smoke test dung cac signature mojibake prompt yeu cau thong qua escaped code points de tranh dua chinh chuoi loi vao source.

Mojibake found: NO trong scope C3.4B.

Neu phat hien mojibake cu ngoai scope: NEEDS MOJIBAKE REVIEW, khong sua tran lan trong phase nay.

## 11. Non-scope C3.4B

- Khong TKB realtime runtime.
- Khong Supabase subscription schedule.
- Khong write-through that vao form TKB.
- Khong SQL.
- Khong apply SQL patch.
- Khong data change.
- Khong commit/push.
