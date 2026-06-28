import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docsPath = path.join(root, 'docs', 'supabase-c5-3d-conflict-marker-ui-toi-thieu.md');
const helperPath = path.join(root, 'src', 'cloud-conflict-markers.js');
const bridgePath = path.join(root, 'src', 'cloud-tuition-record-package-bridge.js');
const tuitionModulePath = path.join(root, 'src', 'tuition-module.js');
const stylesPath = path.join(root, 'src', 'styles.css');
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

assert(fs.existsSync(docsPath), 'Docs C5.3D must exist');
assert(fs.existsSync(helperPath), 'Runtime conflict helper must exist');

const docs = readUtf8(docsPath);
const helper = readUtf8(helperPath);
const bridge = readUtf8(bridgePath);
const tuitionModule = readUtf8(tuitionModulePath);
const styles = readUtf8(stylesPath);
const combined = `${docs}\n${helper}\n${bridge}\n${tuitionModule}\n${styles}`;

assertIncludes(docs, '# C5.3D - Conflict marker/UI tối thiểu cho nghiệp vụ realtime nhạy cảm');
assertIncludes(combined, 'tuition_record_package');
assertIncludes(combined, 'usedSessions');
assertIncludes(combined, 'paidAmount');
assertIncludes(combined, 'payments');
assertIncludes(combined, 'syncConflict');
assertIncludes(combined, 'conflictMarker');
assertIncludes(combined, "conflictSeverity: TUITION_CONFLICT_SEVERITY");
assertIncludes(helper, "export const TUITION_CONFLICT_SEVERITY = 'A'");
assertIncludes(docs, 'không overwrite sensitive fields bừa');
assertIncludes(docs, 'Có xung đột dữ liệu');
assertIncludes(tuitionModule, 'tuition-conflict-badge');
assertIncludes(styles, '.tuition-conflict-badge');
assertIncludes(bridge, 'mergeTuitionRecordWithConflictGuard');
assertIncludes(bridge, 'normalizeConflictMarker');

assertIncludes(docs, 'SQL: NOT CREATED / NOT RUN');
assertIncludes(docs, 'SUPABASE ACTION: NOT RUN OUTSIDE RUNTIME APP CODE');
assertIncludes(docs, 'RUNTIME CHANGE: YES, CONFLICT MARKER ONLY');
assertIncludes(docs, 'COMMIT: NOT RUN');
assertIncludes(docs, 'PUSH: NOT RUN');
assertIncludes(docs, 'ROLLBACK_EXECUTION: NO');
assertIncludes(docs, 'CONFLICT_RESOLUTION: NO');
assertIncludes(docs, 'DATA_MUTATION: CONFLICT_MARKER_ONLY');
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
  /rollback_apply[\s\S]{0,160}/i,
  /resolveConflict/i,
  /chooseCloud/i,
  /chooseLocal/i,
];

for (const pattern of forbiddenRuntimePatterns) {
  assert(!pattern.test(`${helper}\n${bridge}\n${tuitionModule}`), `Forbidden C5.3D runtime pattern: ${pattern}`);
}

assertNoMojibake(docsPath);
assertNoMojibake(helperPath);
assertNoMojibake(testPath);

console.log('C5.3D smoke: PASS');
