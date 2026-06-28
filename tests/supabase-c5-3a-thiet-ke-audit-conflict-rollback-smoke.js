import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const docsPath = path.join(root, 'docs', 'supabase-c5-3a-thiet-ke-audit-conflict-rollback.md');
const testPath = __filename;

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, needle) {
  assert(content.includes(needle), `Expected docs to include: ${needle}`);
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

assert(fs.existsSync(docsPath), 'Docs C5.3A must exist');

const docs = readUtf8(docsPath);

assertIncludes(docs, '# C5.3A - Thiết kế audit log / conflict / rollback cho nghiệp vụ realtime nhạy cảm');
assertIncludes(docs, 'C5.3A STATUS: DESIGN ONLY');
assertIncludes(docs, 'audit log');
assertIncludes(docs, 'conflict');
assertIncludes(docs, 'rollback');

[
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'schedule_session',
  'tuition_record_package',
  'student',
  'teacher',
].forEach((entity) => assertIncludes(docs, entity));

assertIncludes(
  docs,
  'class_session có cloud/core sync, nhưng không có dedicated realtime subscription riêng được xác nhận trong workspace hiện tại.'
);
assertIncludes(docs, 'Risk matrix theo entity');
assertIncludes(docs, 'Đề xuất audit log model');
assertIncludes(docs, 'Đề xuất conflict model');
assertIncludes(docs, 'Đề xuất rollback model');

[
  'owner',
  'qtv',
  'center_admin',
  'admin',
].forEach((role) => assertIncludes(docs, role));

assertIncludes(docs, 'Teacher/consultant direct write HOLD');
assertIncludes(docs, 'SQL: NOT CREATED / NOT RUN');
assertIncludes(docs, 'SUPABASE ACTION: NOT RUN');
assertIncludes(docs, 'RUNTIME CHANGE: NO');
assertIncludes(docs, 'COMMIT: NOT RUN');
assertIncludes(docs, 'PUSH: NOT RUN');
assertIncludes(docs, 'ROLLBACK_EXECUTION: NO');
assertIncludes(docs, 'DATA_MUTATION: NO');
assertIncludes(docs, 'C5.3B - Manual SQL/readiness pack cho audit log/conflict metadata');
assertIncludes(docs, 'GO for C5.3B manual SQL/readiness pack cho audit/conflict/rollback');

[
  '## 1. Mục tiêu C5.3A',
  '## 2. Trạng thái trước C5.3A',
  '## 3. Phạm vi entity cần audit',
  '## 4. Những gì C5.3A không làm',
  '## 5. Audit hiện trạng audit log',
  '## 6. Audit hiện trạng conflict',
  '## 7. Audit hiện trạng rollback',
  '## 8. Risk matrix theo entity',
  '## 9. Đề xuất audit log model',
  '## 10. Đề xuất conflict model',
  '## 11. Đề xuất rollback model',
  '## 12. Đề xuất UI/UX conflict tối thiểu',
  '## 13. Đề xuất quyền/role guard',
  '## 14. Đề xuất storage strategy',
  '## 15. Đề xuất SQL/manual pack cho phase sau nếu cần',
  '## 16. Đề xuất runtime phase sau',
  '## 17. Manual QA plan tương lai',
  '## 18. Risks / blockers',
  '## 19. Open questions',
  '## 20. Next recommendation',
].forEach((heading) => assertIncludes(docs, heading));

assertNoMojibake(docsPath);
assertNoMojibake(testPath);

console.log('C5.3A smoke: PASS');
