import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'feedback-f23e-checkpoint-review-feedback-anh-hai-2706.md');
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

assert(fs.existsSync(docPath), 'F23E docs must exist');

const docs = readUtf8(docPath);

assertIncludes(docs, '# F23E - Checkpoint review F23 feedback anh Hải 27/06');
assertIncludes(docs, 'feedback anh Hải 27/06');

['F23A', 'F23B', 'F23C', 'F23C.1', 'F23D'].forEach((phase) => assertIncludes(docs, phase));
['C6.1', 'C6.2', 'C6.3', 'C6.4', 'C6.5'].forEach((phase) => assertIncludes(docs, phase));

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
  'Nhóm Tài chính',
  'Sổ quỹ trước Thu chi',
  'Đối soát nằm trong Sổ quỹ',
  'không tạo module/window Đối soát riêng',
  'không merge logic Thu chi/Sổ quỹ',
  'không đổi localStorage key',
  'không đổi logic tài chính',
  'UI readiness',
  'designer',
  'image slots',
  'theme hooks',
  'không thêm ảnh thật/asset thật',
  'Checklist chưa persist qua reload',
  'Chưa dashboard tài chính nâng cao',
  'designer thật chưa nạp ảnh/theme',
  'GO for F23F',
  'No push unless user explicitly requests',
].forEach((needle) => assertIncludes(docs, needle));

[
  'F23E STATUS: CHECKPOINT REVIEW ONLY',
  'SQL: NOT CREATED / NOT RUN',
  'SUPABASE ACTION: NOT RUN',
  'CLOUD_SYNC: NO',
  'RUNTIME_CHANGE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'LOGIC_CHANGE: NO',
  'DATA_FLOW_CHANGE: NO',
  'LOCAL_STORAGE_KEY_CHANGE: NO',
  'MERGE_THU_CHI_SO_QUY_LOGIC: NO',
  'REAL_IMAGE_ASSET_ADDED: NO',
  'C6_STARTED: NO',
  'F23F_STARTED: NO',
].forEach((marker) => assertIncludes(docs, marker));

[
  '## 1. Mục tiêu F23E',
  '## 2. Trạng thái trước F23E',
  '## 3. Feedback gốc anh Hải 27/06',
  '## 4. Tóm tắt F23A',
  '## 5. Tóm tắt F23B',
  '## 6. F23B manual QA',
  '## 7. Tóm tắt F23C',
  '## 8. F23C manual QA',
  '## 9. Tóm tắt F23C.1',
  '## 10. F23C.1 manual QA',
  '## 11. Tóm tắt F23D',
  '## 12. F23D manual QA',
  '## 13. Files/runtime hiện tại',
  '## 14. Safety boundaries',
  '## 15. Những gì F23 không làm',
  '## 16. Accepted limitations',
  '## 17. Risks còn lại',
  '## 18. PASS / NEEDS REVIEW criteria',
  '## 19. Recommendation',
  '## 20. Next roadmap',
].forEach((heading) => assertIncludes(docs, heading));

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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F23E scope: ${changedPath}`);
  assert(!/\.sql$/i.test(changedPath), `F23E must not change SQL files: ${changedPath}`);
  assert(!/cloud-|supabase/i.test(changedPath), `F23E must not touch cloud files: ${changedPath}`);
  assert(!/\.(png|jpe?g|webp|svg|gif)$/i.test(changedPath), `F23E must not add image asset: ${changedPath}`);
}

assertNoMojibake(docPath);
assertNoMojibake(testPath);

console.log('F23E smoke: PASS');
