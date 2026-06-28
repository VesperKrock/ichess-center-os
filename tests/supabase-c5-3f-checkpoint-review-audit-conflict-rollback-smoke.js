import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docsPath = path.join(root, 'docs', 'supabase-c5-3f-checkpoint-review-audit-conflict-rollback.md');
const testPath = __filename;
const helperPaths = [
  path.join(root, 'src', 'cloud-audit-log.js'),
  path.join(root, 'src', 'cloud-conflict-markers.js'),
  path.join(root, 'src', 'cloud-rollback-preview.js'),
];

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`);
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath);
  const forbidden = [
    String.fromCharCode(0x00c2),
    String.fromCharCode(0x00c3),
    String.fromCharCode(0x0102),
    String.fromCharCode(0xfffd),
  ];

  for (const marker of forbidden) {
    assert(
      !content.includes(marker),
      `Unexpected mojibake marker U+${marker.charCodeAt(0).toString(16).toUpperCase()} in ${path.relative(root, filePath)}`
    );
  }
}

assert(fs.existsSync(docsPath), 'Docs C5.3F must exist');
helperPaths.forEach((helperPath) => assert(fs.existsSync(helperPath), `${path.basename(helperPath)} must exist`));

const docs = readUtf8(docsPath);

assertIncludes(docs, '# C5.3F - Checkpoint review audit log / conflict marker / rollback preview');
assertIncludes(docs, 'C5.3F STATUS: CHECKPOINT REVIEW ONLY');

['C5.3A', 'C5.3B', 'C5.3C', 'C5.3D', 'C5.3E'].forEach((phase) => assertIncludes(docs, phase));
assertIncludes(docs, 'C5.3B Apply/Verify');
assertIncludes(docs, 'allowlist_has_audit_log_entry: true');
assertIncludes(docs, 'realtime_has_center_cloud_entities: true');
assertIncludes(docs, 'replica_identity_full: true');
assertIncludes(docs, 'has_can_write_center: true');
assertIncludes(docs, 'has_is_center_member: true');
assertIncludes(docs, 'audit_log_entry');
assertIncludes(docs, 'tuition_record_package');
assertIncludes(docs, 'src/cloud-audit-log.js');
assertIncludes(docs, 'src/cloud-conflict-markers.js');
assertIncludes(docs, 'src/cloud-rollback-preview.js');
assertIncludes(docs, 'C5.3C manual QA: PASS WITH NON-BLOCKING CONSOLE WARNING.');
assertIncludes(docs, 'C5.3E manual QA: PASS.');
assertIncludes(docs, 'console 400/WebSocket warning');
assertIncludes(docs, 'NOT TESTED / accepted limitation');
assertIncludes(docs, 'GO for C5.3G - Commit local C5.3 checkpoint');
assertIncludes(docs, 'No push unless user explicitly requests');
assertIncludes(docs, 'Không rollback apply');
assertIncludes(docs, 'Không conflict resolution');
assertIncludes(docs, 'ATTENDANCE_TO_TUITION_AUTO_LINK: NO');
assertIncludes(docs, 'Không tự cập nhật `usedSessions`/`remainingSessions` từ attendance');
assertIncludes(docs, 'TEACHER_CONSULTANT_DIRECT_WRITE: HOLD');
assertIncludes(docs, 'SQL: NOT CREATED / NOT RUN');
assertIncludes(docs, 'RUNTIME CHANGE: NO');
assertIncludes(docs, 'COMMIT: NOT RUN');
assertIncludes(docs, 'PUSH: NOT RUN');

[
  '## 1. Mục tiêu C5.3F',
  '## 2. Trạng thái trước C5.3F',
  '## 3. Tóm tắt C5.3A',
  '## 4. Tóm tắt C5.3B',
  '## 5. Tóm tắt C5.3B Apply/Verify',
  '## 6. Tóm tắt C5.3C',
  '## 7. Tóm tắt C5.3C manual QA',
  '## 8. Tóm tắt C5.3D',
  '## 9. Tóm tắt C5.3E',
  '## 10. Tóm tắt C5.3E manual QA',
  '## 11. Runtime hiện tại',
  '## 12. Data model / entity',
  '## 13. Audit log behavior',
  '## 14. Conflict marker behavior',
  '## 15. Rollback preview behavior',
  '## 16. Role guard',
  '## 17. Những gì C5.3 không làm',
  '## 18. Accepted limitations',
  '## 19. Risks còn lại',
  '## 20. PASS / NEEDS REVIEW criteria',
  '## 21. Recommendation',
  '## 22. Next roadmap',
].forEach((heading) => assertIncludes(docs, heading));

assertNoMojibake(docsPath);
assertNoMojibake(testPath);

console.log('C5.3F smoke: PASS');
