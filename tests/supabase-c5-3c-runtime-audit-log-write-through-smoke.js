import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docsPath = path.join(root, 'docs', 'supabase-c5-3c-runtime-audit-log-write-through.md');
const helperPath = path.join(root, 'src', 'cloud-audit-log.js');
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

assert(fs.existsSync(docsPath), 'Docs C5.3C must exist');
assert(fs.existsSync(helperPath), 'Runtime audit helper must exist');

const docs = readUtf8(docsPath);
const helper = readUtf8(helperPath);
const main = readUtf8(mainPath);
const combined = `${docs}\n${helper}\n${main}`;

assertIncludes(docs, '# C5.3C - Runtime audit log write-through tối thiểu');
assertIncludes(combined, 'audit_log_entry');
assertIncludes(combined, 'center_cloud_entities');
assertIncludes(combined, 'audit-log-entry::');
assertIncludes(docs, 'append-only local_id');
assertIncludes(helper, "entityType === AUDIT_LOG_ENTRY_ENTITY_TYPE");
assertIncludes(helper, 'Loop guard: audit_log_entry is not audited.');

[
  'owner',
  'qtv',
  'center_admin',
  'admin',
].forEach((role) => assertIncludes(combined, role));

assertIncludes(combined, 'teacher/consultant direct write HOLD');
assertIncludes(helper, 'try {');
assertIncludes(helper, 'catch (error)');
assertIncludes(helper, 'skipped: true');
assertIncludes(main, 'console.warn');
assertIncludes(combined, 'tuition_record_package');
assertIncludes(main, 'writeC53TuitionAuditLogEntry');
assertIncludes(main, 'writeC52TuitionRecordPackageThroughCloud(nextRecord, \'tuition-package-save\'');
assertIncludes(main, 'writeC52TuitionRecordPackageThroughCloud(updatedTuitionRecord, \'tuition-payment-save\'');

assertIncludes(docs, 'SQL: NOT CREATED / NOT RUN');
assertIncludes(docs, 'SUPABASE ACTION: NOT RUN OUTSIDE RUNTIME APP CODE');
assertIncludes(docs, 'RUNTIME CHANGE: YES, AUDIT LOG ONLY');
assertIncludes(docs, 'COMMIT: NOT RUN');
assertIncludes(docs, 'PUSH: NOT RUN');
assertIncludes(docs, 'ROLLBACK_EXECUTION: NO');
assertIncludes(docs, 'CONFLICT_UI: NO');
assertIncludes(docs, 'DATA_MUTATION: AUDIT_LOG_ENTRY ONLY');
assertIncludes(docs, 'ATTENDANCE_TO_TUITION_AUTO_LINK: NO');
assertIncludes(docs, 'TEACHER_CONSULTANT_DIRECT_WRITE: HOLD');
assertIncludes(docs, 'không tự cập nhật `usedSessions` từ attendance');
assertIncludes(docs, 'không tự cập nhật `remainingSessions` từ attendance');

const forbiddenRuntimePatterns = [
  /attendance_record[\s\S]{0,180}usedSessions/i,
  /attendance_record[\s\S]{0,180}remainingSessions/i,
  /session_report[\s\S]{0,180}usedSessions/i,
  /session_report[\s\S]{0,180}remainingSessions/i,
  /attendance.*tuition.*auto/i,
  /teacher[\s\S]{0,80}consultant[\s\S]{0,80}write[\s\S]{0,80}allowed/i,
  /rollback_apply[\s\S]{0,120}\.from\('center_cloud_entities'\)/i,
];

for (const pattern of forbiddenRuntimePatterns) {
  assert(!pattern.test(`${helper}\n${main}`), `Forbidden C5.3C runtime pattern: ${pattern}`);
}

assertNoMojibake(docsPath);
assertNoMojibake(helperPath);
assertNoMojibake(testPath);

console.log('C5.3C smoke: PASS');
