import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'feedback-f23a-audit-feedback-anh-hai-2706-thiet-ke-pham-vi.md');
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

assert(fs.existsSync(docPath), 'F23A docs must exist');

const docs = readUtf8(docPath);

assertIncludes(docs, '# F23A - Audit feedback anh Hải 27/06 và thiết kế phạm vi F23');
assertIncludes(docs, 'feedback anh Hải ngày 27/06');

['F23B', 'F23C', 'F23D', 'F23E', 'F23F'].forEach((phase) => assertIncludes(docs, phase));
['C6.1', 'C6.2', 'C6.3', 'C6.4', 'C6.5'].forEach((phase) => assertIncludes(docs, phase));

assertIncludes(docs, 'Còn lại');
assertIncludes(docs, 'VIỆC CHƯA THỰC HIỆN');

[
  'Điểm danh',
  'TBHP',
  'Nhắc thu HP',
  'Chăm sóc phụ huynh định kỳ',
  'Đưa đón bé',
  'Trực nhật vệ sinh',
  'Đăng bài đưa tin',
].forEach((item) => assertIncludes(docs, item));

assertIncludes(docs, 'Nhóm Tài chính');
assertIncludes(docs, 'Sổ quỹ trước Thu chi');
assertIncludes(docs, 'wrapper UI');
assertIncludes(docs, 'không merge logic Thu chi/Sổ quỹ');
assertIncludes(docs, 'không đổi data model');
assertIncludes(docs, 'không đổi localStorage key');
assertIncludes(docs, 'UI readiness');
assertIncludes(docs, 'designer');
assertIncludes(docs, 'image slots');
assertIncludes(docs, 'theme hooks');

[
  'F23A STATUS: DESIGN ONLY',
  'SQL: NOT CREATED / NOT RUN',
  'SUPABASE ACTION: NOT RUN',
  'RUNTIME CHANGE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'DATA_MODEL_CHANGE: NO',
  'LOCAL_STORAGE_KEY_CHANGE: NO',
  'MERGE_THU_CHI_SO_QUY_LOGIC: NO',
  'C6_STARTED: NO',
].forEach((marker) => assertIncludes(docs, marker));

[
  '## 1. Mục tiêu F23A',
  '## 2. Trạng thái trước F23A',
  '## 3. Feedback gốc anh Hải 27/06',
  '## 4. Phân loại feedback',
  '## 5. Nhận định rủi ro',
  '## 6. Nguyên tắc an toàn F23',
  '## 7. F23B scope — Báo cáo ngày',
  '## 8. F23C scope — Nhóm Tài chính',
  '## 9. F23D scope — UI readiness cho designer',
  '## 10. Những gì F23 không làm',
  '## 11. Không merge logic Thu chi/Sổ quỹ',
  '## 12. Không đổi data model/localStorage',
  '## 13. Không SQL/Supabase/cloud/realtime',
  '## 14. Manual QA plan cho F23B',
  '## 15. Manual QA plan cho F23C',
  '## 16. Manual QA plan cho F23D',
  '## 17. Risks / blockers',
  '## 18. Open questions',
  '## 19. Roadmap sau F23',
  '## 20. Recommendation',
].forEach((heading) => assertIncludes(docs, heading));

assertNoMojibake(docPath);
assertNoMojibake(testPath);

console.log('F23A smoke: PASS');
