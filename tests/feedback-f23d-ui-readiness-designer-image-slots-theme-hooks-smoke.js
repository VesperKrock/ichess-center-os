import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'feedback-f23d-ui-readiness-designer-image-slots-theme-hooks.md');
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

assert(fs.existsSync(docPath), 'F23D docs must exist');

const docs = readUtf8(docPath);
const main = readUtf8(mainPath);
const styles = readUtf8(stylesPath);

assertIncludes(docs, '# F23D - UI readiness cho designer: image slots / theme hooks');
assertIncludes(docs, 'UI readiness');
assertIncludes(docs, 'designer');
assertIncludes(docs, 'image slots');
assertIncludes(docs, 'visual slots');
assertIncludes(docs, 'theme hooks');
assertIncludes(docs, 'design tokens');
assertIncludes(docs, 'không đổi logic/chức năng');
assertIncludes(docs, 'không thêm ảnh thật/asset thật');
assertIncludes(docs, 'không SQL/Supabase/cloud/realtime');
assertIncludes(docs, 'F23D STATUS: UI READINESS ONLY');
assertIncludes(docs, 'LOGIC_CHANGE: NO');
assertIncludes(docs, 'REAL_IMAGE_ASSET_ADDED: NO');
assertIncludes(docs, 'DESIGNER_READY_HOOKS: YES');

[
  '--ichess-bg',
  '--ichess-surface',
  '--ichess-accent',
  'designer-theme-hook',
  'designer-image-slot',
  'center-brand-slot',
  'center-logo-slot',
  'center-banner-slot',
  'module-card-icon-slot',
  'module-card-visual-slot',
  'module-window-hero-slot',
  'module-visual-placeholder',
].forEach((needle) => assertIncludes(styles, needle, `styles ${needle}`));

[
  'data-designer-hook="center-brand"',
  'data-designer-hook="module-card"',
  'data-designer-hook="module-window"',
  'data-module-title',
  'designer-theme-hook',
  'designer-image-slot',
].forEach((needle) => assertIncludes(main, needle, `main ${needle}`));

assert(!/from ['"](?!\.{1,2}\/)(.*)?(antd|mui|chakra|tailwind|bootstrap|lucide-react|framer-motion)/i.test(main), 'F23D must not import a new UI library');
assert(!/supabase|channel\(|postgres_changes|cloud sync/i.test(styles), 'F23D styles must not add cloud/realtime runtime');

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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F23D scope: ${changedPath}`);
  assert(!/\.sql$/i.test(changedPath), `F23D must not change SQL files: ${changedPath}`);
  assert(!/cloud-|supabase/i.test(changedPath), `F23D must not touch cloud files: ${changedPath}`);
  assert(!/\.(png|jpe?g|webp|svg|gif)$/i.test(changedPath), `F23D must not add image asset: ${changedPath}`);
}

assertNoMojibake(docPath);
assertNoMojibake(testPath);

console.log('F23D smoke: PASS');
