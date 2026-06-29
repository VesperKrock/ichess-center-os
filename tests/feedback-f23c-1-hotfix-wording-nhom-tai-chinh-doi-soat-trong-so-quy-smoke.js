import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'feedback-f23c-1-hotfix-wording-nhom-tai-chinh-doi-soat-trong-so-quy.md');
const wrapperPath = path.join(root, 'src', 'finance-workspace-module.js');
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

assert(fs.existsSync(docPath), 'F23C.1 docs must exist');
assert(fs.existsSync(wrapperPath), 'Finance wrapper must exist');

const docs = readUtf8(docPath);
const wrapper = readUtf8(wrapperPath);

assertIncludes(docs, '# F23C.1 - Hotfix wording Nhóm Tài chính: Đối soát nằm trong Sổ quỹ');
assertIncludes(docs, 'Nhóm Tài chính');
assertIncludes(docs, 'Đối soát nằm trong Sổ quỹ');
assertIncludes(docs, 'không tạo module/window Đối soát riêng');
assertIncludes(docs, 'không merge logic Thu chi/Sổ quỹ');
assertIncludes(docs, 'không đổi storage/localStorage key');
assertIncludes(docs, 'không đổi công thức tài chính');
assertIncludes(docs, 'không SQL/Supabase/cloud/realtime');
assertIncludes(docs, 'CREATE_RECONCILIATION_MODULE: NO');
assertIncludes(docs, 'F23D_STARTED: NO');

assertIncludes(wrapper, 'Sổ quỹ');
assertIncludes(wrapper, 'Thu chi');
assertIncludes(wrapper, 'Đối soát nằm trong Sổ quỹ');
assert(
  wrapper.indexOf('Sổ quỹ') >= 0 && wrapper.indexOf('Sổ quỹ') < wrapper.indexOf('Thu chi'),
  'Sổ quỹ must appear before Thu chi'
);
assert(!wrapper.includes('Mở đối soát'), 'Wrapper must not keep misleading Mở đối soát button');
assert(!/id:\s*['"]doi-soat|moduleId:\s*['"]doi-soat|data-finance-open-module="doi-soat"/i.test(wrapper), 'Wrapper must not create a doi-soat module/window id');
assert(!/localStorage|saveStored|migrate|migration|mergeStorage|mergeLogic/i.test(wrapper), 'Wrapper must not add storage migration/merge logic');
assert(!/supabase|channel\(|postgres_changes|cloud sync/i.test(wrapper), 'Wrapper must not add cloud/realtime runtime');

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
});

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
  'src/main.js',
  'src/report-module.js',
  'src/styles.css',
]);

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/');
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F23C.1 scope: ${changedPath}`);
  assert(!/\.sql$/i.test(changedPath), `F23C.1 must not change SQL files: ${changedPath}`);
  assert(!/cloud-|supabase|tuition|attendance|schedule/i.test(changedPath), `F23C.1 must not touch cloud/tuition/attendance/schedule file: ${changedPath}`);
  assert(!/cashflow-module|cashbook-module|storage\.js/i.test(changedPath), `F23C.1 must not edit finance logic/storage file: ${changedPath}`);
}

assertNoMojibake(docPath);
assertNoMojibake(testPath);
assertNoMojibake(wrapperPath);

console.log('F23C.1 smoke: PASS');
