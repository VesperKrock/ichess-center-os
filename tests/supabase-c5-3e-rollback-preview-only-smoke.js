import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docsPath = path.join(root, 'docs', 'supabase-c5-3e-rollback-preview-only.md');
const helperPath = path.join(root, 'src', 'cloud-rollback-preview.js');
const tuitionModulePath = path.join(root, 'src', 'tuition-module.js');
const mainPath = path.join(root, 'src', 'main.js');
const testPath = __filename;

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

assert(fs.existsSync(docsPath), 'Docs C5.3E must exist');
assert(fs.existsSync(helperPath), 'Runtime rollback preview helper must exist');

const docs = readUtf8(docsPath);
const helper = readUtf8(helperPath);
const tuitionModule = readUtf8(tuitionModulePath);
const main = readUtf8(mainPath);
const combined = `${docs}\n${helper}\n${tuitionModule}\n${main}`;

assertIncludes(docs, '# C5.3E - Rollback preview only cho nghiệp vụ realtime nhạy cảm');
assertIncludes(combined, 'audit_log_entry');
assertIncludes(combined, 'tuition_record_package');
assertIncludes(combined, 'beforePayload');
assertIncludes(combined, 'afterPayload');
assertIncludes(combined, 'previewOnly');
assertIncludes(docs, 'chỉ đọc');

[
  'owner',
  'qtv',
  'center_admin',
  'admin',
].forEach((role) => assertIncludes(combined, role));

assertIncludes(combined, 'teacher/consultant direct write HOLD');
assertIncludes(tuitionModule, 'Xem lịch sử');
assertIncludes(tuitionModule, 'Lịch sử thay đổi');
assertIncludes(tuitionModule, 'Chỉ xem trước, chưa khôi phục dữ liệu');
assertIncludes(tuitionModule, 'Trước thay đổi');
assertIncludes(tuitionModule, 'Sau thay đổi');
assertIncludes(main, 'loadAuditEntriesForEntity');
assertIncludes(main, 'buildRollbackPreviewFromAuditEntry');

assertIncludes(docs, 'SQL: NOT CREATED / NOT RUN');
assertIncludes(docs, 'SUPABASE ACTION: NOT RUN OUTSIDE RUNTIME APP CODE');
assertIncludes(docs, 'RUNTIME CHANGE: YES, ROLLBACK PREVIEW ONLY');
assertIncludes(docs, 'COMMIT: NOT RUN');
assertIncludes(docs, 'PUSH: NOT RUN');
assertIncludes(docs, 'ROLLBACK_EXECUTION: NO');
assertIncludes(docs, 'ROLLBACK_APPLY: NO');
assertIncludes(docs, 'CONFLICT_RESOLUTION: NO');
assertIncludes(docs, 'DATA_MUTATION: NO');
assertIncludes(docs, 'ATTENDANCE_TO_TUITION_AUTO_LINK: NO');
assertIncludes(docs, 'TEACHER_CONSULTANT_DIRECT_WRITE: HOLD');
assertIncludes(docs, 'không tự cập nhật `usedSessions` từ attendance');
assertIncludes(docs, 'không tự cập nhật `remainingSessions` từ attendance');

const helperExecutable = helper.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

[
  /\bapplyRollback\b/i,
  /\brestoreRecord\b/i,
  /\bcommitRollback\b/i,
  /\brollbackMutation\b/i,
  /\bupsert\s*\(/i,
  /\binsert\s*\(/i,
  /\bupdate\s*\(/i,
  /\bdelete\s*\(/i,
  /\.remove\s*\(/i,
  /\.delete\s*\(/i,
].forEach((pattern) => {
  assert(!pattern.test(helperExecutable), `Rollback preview helper contains forbidden pattern: ${pattern}`);
});

const forbiddenRuntimePatterns = [
  /attendance_record[\s\S]{0,180}usedSessions/i,
  /attendance_record[\s\S]{0,180}remainingSessions/i,
  /session_report[\s\S]{0,180}usedSessions/i,
  /session_report[\s\S]{0,180}remainingSessions/i,
  /attendance.*tuition.*auto/i,
  /chooseCloud/i,
  /chooseLocal/i,
];

for (const pattern of forbiddenRuntimePatterns) {
  assert(!pattern.test(`${helper}\n${tuitionModule}\n${main}`), `Forbidden C5.3E runtime pattern: ${pattern}`);
}

assertNoMojibake(docsPath);
assertNoMojibake(helperPath);
assertNoMojibake(testPath);

console.log('C5.3E smoke: PASS');
