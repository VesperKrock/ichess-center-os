import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const docsPath = path.join(root, 'docs', 'supabase-c5-2e-checkpoint-review-hoc-phi-tbhp.md');
const testPath = __filename;
const bridgePath = path.join(root, 'src', 'cloud-tuition-record-package-bridge.js');
const mainPath = path.join(root, 'src', 'main.js');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(haystack, needle, label = needle) {
  assert(
    haystack.includes(needle),
    `Expected ${label} in ${path.relative(root, docsPath)}`
  );
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath);
  const forbidden = [
    String.fromCharCode(0x00c2),
    String.fromCharCode(0x00c3),
    String.fromCharCode(0x0102),
    String.fromCharCode(0x00a2),
    String.fromCharCode(0xfffd),
  ];

  for (const marker of forbidden) {
    assert(
      !content.includes(marker),
      `Unexpected mojibake marker U+${marker.charCodeAt(0).toString(16).toUpperCase()} in ${path.relative(root, filePath)}`
    );
  }
}

assert(fs.existsSync(docsPath), 'C5.2E checkpoint docs must exist');
assert(fs.existsSync(bridgePath), 'C5.2C tuition bridge must exist');
assert(fs.existsSync(mainPath), 'main runtime file must exist');

const docs = readUtf8(docsPath);
const bridge = readUtf8(bridgePath);
const main = readUtf8(mainPath);

assertIncludes(docs, '# C5.2E - Checkpoint review Học phí / TBHP cloud source-of-truth', 'C5.2E title');
assertIncludes(docs, 'C5.2E STATUS: CHECKPOINT REVIEW ONLY');
assertIncludes(docs, 'C5.2A');
assertIncludes(docs, 'C5.2B');
assertIncludes(docs, 'C5.2C');
assertIncludes(docs, 'C5.2D');
assertIncludes(docs, 'C5.2B remote verification PASS');

[
  'tuition_record_package entity type exists: true',
  'tuition_record_package payload supported: true',
  'tuition_record_package center scope supported: true',
  'tuition_record_package local_id format supported: true',
  'tuition_record_package realtime/readiness accepted: true',
].forEach((line) => assertIncludes(docs, line));

[
  '## 1. Mục tiêu C5.2E',
  '## 2. Trạng thái trước C5.2E',
  '## 3. Tóm tắt C5.2A',
  '## 4. Tóm tắt C5.2B',
  '## 5. Tóm tắt C5.2B remote verification',
  '## 6. Tóm tắt C5.2C',
  '## 7. Tóm tắt C5.2D',
  '## 8. Manual QA của user',
  '## 9. Accepted limitations',
  '## 10. Những gì C5.2 không làm',
  '## 11. Runtime hiện tại',
  '## 12. Cloud/Supabase state',
  '## 13. Data model / entity',
  '## 14. Role guard',
  '## 15. Local fallback',
  '## 16. Realtime/parity',
  '## 17. TBHP behavior',
  '## 18. Attendance relation',
  '## 19. Risks còn lại',
  '## 20. PASS / NEEDS REVIEW criteria',
  '## 21. Recommendation',
  '## 22. Next roadmap',
].forEach((heading) => assertIncludes(docs, heading));

[
  'tuition_record_package',
  'src/cloud-tuition-record-package-bridge.js',
  'src/main.js',
  'ichessCenterOS.tuition.dreamhome',
  'tuition_record_package::<record.id>',
  'Manual QA: PASS WITH ACCEPTED LIMITATION',
  'Old local data mismatch: ACCEPTED LIMITATION',
  'Fallback/offline: NOT TESTED',
  'Không cần C5.2B-Apply',
  'GO for C5.2F - Commit local C5.2 checkpoint',
  'No push unless user explicitly requests',
  'ATTENDANCE_TO_TUITION_AUTO_LINK: NO',
  'TEACHER_CONSULTANT_DIRECT_WRITE: HOLD',
  'SQL: NOT CREATED / NOT RUN',
  'SUPABASE ACTION: NOT RUN',
  'RUNTIME CHANGE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'usedSessions',
  'remainingSessions',
].forEach((needle) => assertIncludes(docs, needle));

assert(
  bridge.includes("TUITION_RECORD_PACKAGE_ENTITY_TYPE = 'tuition_record_package'"),
  'Bridge must keep tuition_record_package entity type'
);
assert(
  bridge.includes('usedSessionsAutoUpdateFromAttendance: false'),
  'Bridge must mark usedSessions attendance auto update disabled'
);
assert(
  bridge.includes('remainingSessionsAutoUpdateFromAttendance: false'),
  'Bridge must mark remainingSessions attendance auto update disabled'
);
assert(
  bridge.includes('attendanceLinked: false'),
  'Bridge must mark attendance link disabled'
);
assert(
  main.includes('writeC52TuitionRecordPackageThroughCloud'),
  'main.js must keep C5.2C write-through hook'
);
assert(
  main.includes('subscribeToC52TuitionRecordPackageRealtime'),
  'main.js must keep C5.2C realtime subscription hook'
);

const dangerousPatterns = [
  /attendance_record[\s\S]{0,160}usedSessions/i,
  /attendance_record[\s\S]{0,160}remainingSessions/i,
  /session_report[\s\S]{0,160}usedSessions/i,
  /session_report[\s\S]{0,160}remainingSessions/i,
  /\.delete\s*\(/,
  /localStorage\.(?:removeItem|clear)\s*\(/,
];

for (const pattern of dangerousPatterns) {
  assert(
    !pattern.test(bridge),
    `Bridge contains forbidden runtime safety pattern: ${pattern}`
  );
}

assertNoMojibake(docsPath);
assertNoMojibake(testPath);

console.log('C5.2E checkpoint review smoke passed.');
