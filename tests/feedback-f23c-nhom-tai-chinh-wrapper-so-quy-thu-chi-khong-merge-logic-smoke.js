import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'feedback-f23c-nhom-tai-chinh-wrapper-so-quy-thu-chi-khong-merge-logic.md');
const wrapperPath = path.join(root, 'src', 'finance-workspace-module.js');
const modulesPath = path.join(root, 'src', 'modules.js');
const mainPath = path.join(root, 'src', 'main.js');
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

assert(fs.existsSync(docPath), 'F23C docs must exist');
assert(fs.existsSync(wrapperPath), 'Finance wrapper module must exist');

const docs = readUtf8(docPath);
const wrapper = readUtf8(wrapperPath);
const modules = readUtf8(modulesPath);
const main = readUtf8(mainPath);
const styles = readUtf8(stylesPath);

assertIncludes(docs, '# F23C - Nhóm Tài chính wrapper UI cho Sổ quỹ + Thu chi');
assertIncludes(docs, 'F23C STATUS: FINANCE WRAPPER UI ONLY');
assertIncludes(docs, 'FINANCE_LOGIC_CHANGE: NO');
assertIncludes(docs, 'MERGE_THU_CHI_SO_QUY_LOGIC: NO');
assertIncludes(docs, 'LOCAL_STORAGE_KEY_CHANGE: NO');
assertIncludes(docs, 'COMMIT: NOT RUN');
assertIncludes(docs, 'PUSH: NOT RUN');

[
  'Nhóm Tài chính',
  'Sổ quỹ',
  'Thu chi',
  'Sổ quỹ đặt trước Thu chi',
  'wrapper UI',
  'navigation',
  'không merge logic Thu chi/Sổ quỹ',
  'không đổi storage/localStorage key',
  'không đổi công thức tài chính',
  'không SQL',
  'không Supabase',
  'không cloud sync',
  'không realtime',
].forEach((needle) => assertIncludes(docs, needle));

[
  'Nhóm Tài chính',
  'Tài chính',
  'Sổ quỹ',
  'Thu chi',
  'Đối soát',
  'Xem Sổ quỹ',
  'Xem Thu chi',
  'Dashboard nâng cao',
  'không merge logic',
  'data-finance-open-module="so-quy"',
  'data-finance-open-module="thu-chi"',
].forEach((needle) => assertIncludes(wrapper, needle, `wrapper ${needle}`));

assert(
  wrapper.indexOf('Sổ quỹ') >= 0 && wrapper.indexOf('Sổ quỹ') < wrapper.indexOf('Thu chi'),
  'Sổ quỹ must appear before Thu chi in finance wrapper'
);
assert(!wrapper.includes('Mở đối soát'), 'F23C.1 keeps Đối soát as a Sổ quỹ note, not a misleading button');

assertIncludes(modules, "id: 'nhom-tai-chinh'");
assertIncludes(modules, "name: 'Nhóm Tài chính'");
assertIncludes(main, "from './finance-workspace-module.js'");
assertIncludes(main, "moduleItem.id === 'nhom-tai-chinh'");
assertIncludes(main, "document.querySelectorAll('[data-finance-open-module]')");
assertIncludes(main, 'openModuleWindow(button.dataset.financeOpenModule)');
assertIncludes(styles, '.finance-workspace-module');

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
  'src/report-module.js',
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
  'src/styles.css',
]);

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/');
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F23C scope: ${changedPath}`);
  assert(!/\.sql$/i.test(changedPath), `F23C must not change SQL files: ${changedPath}`);
  assert(!/cloud-|supabase|tuition|attendance|schedule/i.test(changedPath), `F23C must not touch cloud/tuition/attendance/schedule file: ${changedPath}`);
  assert(!/cashflow-module|cashbook-module|storage\.js/i.test(changedPath), `F23C must not edit finance logic/storage file: ${changedPath}`);
}

assertNoMojibake(docPath);
assertNoMojibake(testPath);
assertNoMojibake(wrapperPath);

console.log('F23C smoke: PASS');
