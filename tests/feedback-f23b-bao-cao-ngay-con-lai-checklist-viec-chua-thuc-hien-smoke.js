import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'feedback-f23b-bao-cao-ngay-con-lai-checklist-viec-chua-thuc-hien.md');
const reportModulePath = path.join(root, 'src', 'report-module.js');
const mainPath = path.join(root, 'src', 'main.js');
const stylesPath = path.join(root, 'src', 'styles.css');
const testPath = __filename;

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`);
}

function assertNoMojibakeInNewFile(filePath) {
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

assert(fs.existsSync(docPath), 'F23B docs must exist');
assert(fs.existsSync(reportModulePath), 'Report module must exist');

const docs = readUtf8(docPath);
const reportModule = readUtf8(reportModulePath);
const main = readUtf8(mainPath);
const styles = readUtf8(stylesPath);

assertIncludes(docs, '# F23B - Báo cáo ngày: Còn lại + checklist việc chưa thực hiện');
assertIncludes(docs, 'F23B STATUS: REPORT MODULE ONLY');
assertIncludes(docs, 'COMMIT: NOT RUN');
assertIncludes(docs, 'PUSH: NOT RUN');
assertIncludes(docs, 'SQL: NOT CREATED / NOT RUN');
assertIncludes(docs, 'SUPABASE ACTION: NOT RUN');
assertIncludes(docs, 'CLOUD_SYNC: NO');
assertIncludes(docs, 'RUNTIME CHANGE: YES, REPORT UI ONLY');
assertIncludes(docs, 'FINANCE_LOGIC_CHANGE: NO');
assertIncludes(docs, 'MERGE_THU_CHI_SO_QUY_LOGIC: NO');
assertIncludes(docs, 'C6_STARTED: NO');

[
  'Còn lại',
  'VIỆC CHƯA THỰC HIỆN',
  'Điểm danh',
  'TBHP',
  'Nhắc thu HP',
  'Chăm sóc phụ huynh định kỳ',
  'Đưa đón bé',
  'Trực nhật vệ sinh',
  'Đăng bài đưa tin',
  'Công việc khác',
  'không đụng Thu chi/Sổ quỹ',
  'không đổi logic tài chính',
  'không SQL',
  'không Supabase',
  'không cloud sync',
  'runtime state',
].forEach((needle) => assertIncludes(docs, needle));

[
  'Còn lại',
  'VIỆC CHƯA THỰC HIỆN',
  'Điểm danh',
  'TBHP',
  'Nhắc thu HP',
  'Chăm sóc phụ huynh định kỳ',
  'Đưa đón bé',
  'Trực nhật vệ sinh',
  'Đăng bài đưa tin',
  'Công việc khác',
  'reportPendingTaskItems',
  'pendingTasks',
  'otherPendingTasks',
  'data-report-pending-task',
].forEach((needle) => assertIncludes(reportModule, needle, `report module ${needle}`));

assertIncludes(main, "document.querySelectorAll('[data-report-pending-task]')");
assertIncludes(main, 'control.checked');
assertIncludes(styles, '.report-pending-tasks');
assertIncludes(styles, '.report-pending-task-item');

assert(!reportModule.includes('supabase'), 'F23B report module must not add Supabase runtime');
assert(!reportModule.includes('channel('), 'F23B report module must not add realtime channel');
assert(!reportModule.includes('localStorage'), 'F23B report module must not add report localStorage persistence');

const status = readGitStatus();
const allowedChangedPaths = new Set([
  'docs/feedback-f23a-audit-feedback-anh-hai-2706-thiet-ke-pham-vi.md',
  'tests/feedback-f23a-audit-feedback-anh-hai-2706-thiet-ke-pham-vi-smoke.js',
  'docs/feedback-f23b-bao-cao-ngay-con-lai-checklist-viec-chua-thuc-hien.md',
  'tests/feedback-f23b-bao-cao-ngay-con-lai-checklist-viec-chua-thuc-hien-smoke.js',
  'docs/feedback-f23c-nhom-tai-chinh-wrapper-so-quy-thu-chi-khong-merge-logic.md',
  'tests/feedback-f23c-nhom-tai-chinh-wrapper-so-quy-thu-chi-khong-merge-logic-smoke.js',
  'docs/feedback-f23c-1-hotfix-wording-nhom-tai-chinh-doi-soat-trong-so-quy.md',
  'tests/feedback-f23c-1-hotfix-wording-nhom-tai-chinh-doi-soat-trong-so-quy-smoke.js',
  'docs/feedback-f23d-ui-readiness-designer-image-slots-theme-hooks.md',
  'tests/feedback-f23d-ui-readiness-designer-image-slots-theme-hooks-smoke.js',
  'docs/feedback-f23e-checkpoint-review-feedback-anh-hai-2706.md',
  'tests/feedback-f23e-checkpoint-review-feedback-anh-hai-2706-smoke.js',
  'src/finance-workspace-module.js',
  'src/modules.js',
  'src/report-module.js',
  'src/main.js',
  'src/styles.css',
]);

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/');
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F23B scope: ${changedPath}`);
  assert(!/\.sql$/i.test(changedPath), `F23B must not change SQL files: ${changedPath}`);
  assert(!/cashflow|cashbook|tuition|cloud/i.test(changedPath), `F23B must not touch finance/cloud file: ${changedPath}`);
}

assertNoMojibakeInNewFile(docPath);
assertNoMojibakeInNewFile(testPath);

console.log('F23B smoke: PASS');

function readGitStatus() {
  const gitPath = path.join(root, '.git');
  assert(fs.existsSync(gitPath), 'Smoke must run inside git repo');

  return execFileSync('git', ['status', '--short'], {
    cwd: root,
    encoding: 'utf8',
  });
}
