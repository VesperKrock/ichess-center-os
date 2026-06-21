# C3.4C - Schedule Session Realtime Guarded Runtime

## 1. Muc tieu

C3.4C gan runtime guarded cho Module 7/TKB voi cloud entity `schedule_session`, dua tren bridge/readiness C3.4B. Local flow hien tai van duoc giu nguyen: form TKB validate, save localStorage va render nhu cu.

Phase nay khong chay SQL, khong apply SQL patch va khong claim live realtime production da pass.

## 2. Entity va local source

Cloud entity:

```txt
schedule_session
```

Local source:

```txt
ichessCenterOS.schedule.dreamhome
```

Bridge:

```txt
schedule_session.classSessionId -> class_session.id
```

Neu local schedule khong co `classSessionId`, runtime khong tu bia mapping.

## 3. Access-control/write guard

C3.4C bat buoc dung C3.1 access-control va C3.4B readiness.

Role duoc ghi future runtime neu cloud + membership + SQL/realtime ready:

- `owner`
- `qtv`
- `center_admin`

Role bi chan:

- `viewer`
- `teacher`
- `consultant`
- `none`
- `unknown`
- signed-out
- missing membership
- missing center

Teacher own-only chua lam trong C3.4C.

## 4. Readiness guard C3.4B

Runtime dung:

- `buildScheduleSessionBridgePreview`
- `getScheduleSessionBridgeReadiness`
- `upsertScheduleSessionCloudEntity`
- `subscribeToScheduleSessionCloudRealtime`

Default hien tai van blocked vi:

- SQL applied: NO
- NEEDS MEMBERSHIP SQL PATCH: YES
- NEEDS SUPABASE REALTIME PATCH: YES
- NEEDS SCHEDULE_SESSION SQL PATCH: YES
- NEEDS SUPABASE CONFIRMATION: YES

Neu readiness fail, app khong cloud write, khong subscribe realtime schedule va local flow khong crash.

## 5. Add/edit/delete write-through behavior

Add schedule:

1. Validate form nhu hien tai.
2. Save local `scheduleSessions` nhu hien tai.
3. Goi `writeScheduleSessionThroughCloud(savedScheduleSession, 'schedule-save')`.
4. Neu readiness fail thi skip cloud write.

Edit schedule:

1. Update local schedule item nhu hien tai.
2. Goi write-through guarded cho item vua sua.
3. Realtime echo sau nay merge theo `schedule_session.id`, khong duplicate.

Delete schedule:

1. Preserve local behavior hien tai: item bi remove khoi local list.
2. Cloud path khong hard delete.
3. Neu readiness future pass, upsert payload mem voi `status: 'cancelled'`, `isDeleted: true`, `deletedAt`, `updatedAt`.

## 6. Realtime subscription behavior

Helper:

```txt
src/cloud-realtime-schedule-sessions.js
```

Functions:

- `upsertScheduleSessionCloudEntity`
- `subscribeToScheduleSessionCloudRealtime`
- `getScheduleSessionRealtimeRecord`
- `mergeScheduleSessionRealtimePayload`

Subscription chi active khi:

- Supabase configured;
- signed-in;
- centerId exists;
- membership/access pass;
- schedule_session SQL/readiness pass;
- realtime ready.

Hien tai backend chua confirm nen subscription se skip an toan.

## 7. Merge/duplicate strategy

Identity:

```txt
schedule_session.id
```

Rule:

- Missing/invalid payload thi skip.
- Same id thi merge vao item cu.
- New id thi prepend vao list.
- Older `updatedAt` bi skip neu local moi hon.
- Delete event tu database bi skip; C3.4C khong hard delete cloud.
- Neu form TKB dang mo, realtime merge vao cache/list; limitation active input duoc ghi nhan cho QA sau.

## 8. Limitations

- SQL chua apply.
- Membership/realtime chua confirm.
- Live production realtime chua pass.
- Teacher own-only chua lam.
- Khong hard delete cloud.
- Khong Hoc phi/attendance/Module 13.

## 9. Manual QA future

Khi backend that san sang:

1. Hai tab cung user: tab A them/sua lich, tab B nhan update gan realtime, khong duplicate.
2. Hai tai khoan cung center: A sua lich, B thay update.
3. Viewer/read-only: khong cloud write, app khong crash.
4. Cross-center isolation: center B khong thay lich center A.
5. Conflict: event cu hon khong overwrite local moi hon.

Manual QA hien tai: NOT RUN vi SQL/realtime backend chua confirm.

## 10. Mojibake check

C3.4C smoke check cac file moi bang escaped/code-point signatures, khong nhung literal mojibake vao source moi.

Files checked:

- `src/cloud-realtime-schedule-sessions.js`
- `docs/online-schedule-session-realtime-c3-4c.md`
- `tests/c3-4c-schedule-session-realtime-guarded-runtime-smoke.js`

Mojibake found: NO trong scope C3.4C.

Neu phat hien mojibake cu ngoai scope: NEEDS MOJIBAKE REVIEW.
