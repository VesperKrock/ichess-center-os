import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docsPath = path.join(root, 'docs', 'supabase-c5-3b-goi-sql-readiness-audit-conflict-rollback.md');
const readonlySqlPath = path.join(root, 'docs', 'supabase-c5-3b-readonly-verify-audit-conflict-rollback.sql');
const finalApplySqlPath = path.join(root, 'docs', 'supabase-c5-3b-final-apply-audit-conflict-rollback.sql');
const testPath = __filename;

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`);
}

function stripSqlComments(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
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

assert(fs.existsSync(docsPath), 'Docs C5.3B must exist');
assert(fs.existsSync(readonlySqlPath), 'Read-only verification SQL must exist');
assert(fs.existsSync(finalApplySqlPath), 'Manual final apply SQL must exist for audit_log_entry readiness');

const docs = readUtf8(docsPath);
const readonlySql = readUtf8(readonlySqlPath);
const finalApplySql = readUtf8(finalApplySqlPath);

assertIncludes(docs, '# C5.3B - Gói SQL/readiness cho audit log / conflict / rollback');
assertIncludes(docs, 'audit_log_entry');
assertIncludes(docs, 'center_cloud_entities');
assertIncludes(docs, 'audit log');
assertIncludes(docs, 'conflict');
assertIncludes(docs, 'rollback');
assertIncludes(docs, 'SQL APPLY: NO');
assertIncludes(docs, 'SUPABASE ACTION: NO');
assertIncludes(docs, 'SUPABASE DATA CHANGE BY CODEX: NO');
assertIncludes(docs, 'RUNTIME CHANGE: NO');
assertIncludes(docs, 'COMMIT: NO');
assertIncludes(docs, 'PUSH: NO');
assertIncludes(docs, 'ROLLBACK_EXECUTION: NO');
assertIncludes(docs, 'DATA_MUTATION: NO');
assertIncludes(docs, 'WAITING USER CONFIRMATION BEFORE ANY APPLY');
assertIncludes(docs, 'C5.3C runtime audit log write-through');
assertIncludes(docs, 'Teacher/consultant direct write HOLD');

[
  'owner',
  'qtv',
  'center_admin',
  'admin',
].forEach((role) => assertIncludes(docs, role));

[
  '## 1. Mục tiêu C5.3B',
  '## 2. Trạng thái trước C5.3B',
  '## 3. Kết quả C5.3A liên quan SQL/readiness',
  '## 4. C5.3B không làm gì',
  '## 5. Readiness cần kiểm tra',
  '## 6. Entity/readiness đề xuất',
  '## 7. Read-only verification SQL',
  '## 8. Expected result',
  '## 9. Có cần final apply SQL không?',
  '## 10. Nếu cần final apply SQL thì user apply thế nào',
  '## 11. Mục đích SQL',
  '## 12. Môi trường',
  '## 13. Có phá dữ liệu không',
  '## 14. Có cần backup không',
  '## 15. Thứ tự chạy',
  '## 16. Verification sau apply',
  '## 17. Rollback plan',
  '## 18. RLS/helper function readiness',
  '## 19. Realtime readiness',
  '## 20. Replica identity readiness',
  '## 21. Role guard policy',
  '## 22. Không runtime trong C5.3B',
  '## 23. Không rollback execution trong C5.3B',
  '## 24. Risks / blockers',
  '## 25. Next recommendation',
].forEach((heading) => assertIncludes(docs, heading));

assertIncludes(readonlySql, 'C5.3B READ-ONLY VERIFY');
assertIncludes(readonlySql, 'SQL APPLY: NO');
assertIncludes(readonlySql, 'center_cloud_entities');
assertIncludes(readonlySql, 'audit_log_entry');
assertIncludes(readonlySql, 'pg_publication_tables');
assertIncludes(readonlySql, 'replica_identity_full');
assertIncludes(readonlySql, 'can_write_center');
assertIncludes(readonlySql, 'is_center_member');

const readonlyExecutableSql = stripSqlComments(readonlySql).toLowerCase();
[
  'insert',
  'update',
  'delete',
  'alter',
  'create',
  'drop',
  'truncate',
  'grant',
  'revoke',
  'do',
  'call',
].forEach((keyword) => {
  assert(
    !new RegExp(`\\b${keyword}\\b`, 'i').test(readonlyExecutableSql),
    `Read-only SQL must not contain executable ${keyword}`
  );
});

assertIncludes(finalApplySql, 'MANUAL ONLY');
assertIncludes(finalApplySql, 'SQL APPLY: NO in Codex');
assertIncludes(finalApplySql, 'WAITING USER CONFIRMATION BEFORE APPLYING SQL');
assertIncludes(finalApplySql, 'audit_log_entry');
[
  'student',
  'teacher',
  'class_session',
  'schedule_session',
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'tuition_record_package',
].forEach((entity) => assertIncludes(finalApplySql, entity));

const finalExecutableSql = stripSqlComments(finalApplySql).toLowerCase();
[
  /\binsert\s+into\b/i,
  /\bupdate\s+public\./i,
  /\bdelete\s+from\b/i,
  /\bdrop\s+table\b/i,
  /\bdrop\s+schema\b/i,
  /\btruncate\b/i,
  /\bcreate\s+table\b/i,
].forEach((pattern) => {
  assert(!pattern.test(finalExecutableSql), `Final apply SQL contains forbidden pattern: ${pattern}`);
});

assertNoMojibake(docsPath);
assertNoMojibake(readonlySqlPath);
assertNoMojibake(finalApplySqlPath);
assertNoMojibake(testPath);

console.log('C5.3B smoke: PASS');
