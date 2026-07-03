import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'fb-admin-dreamhome-settings-online-ui-polish.md');
const settingsPath = path.join(root, 'src', 'settings-module.js');
const stylesPath = path.join(root, 'src', 'styles.css');
const testPath = __filename;

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`);
}

function assertNotIncludes(content, needle, label = needle) {
  assert(!content.includes(needle), `Unexpected ${label}`);
}

function assertNoMojibakeInFile(filePath) {
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

assert(fs.existsSync(docPath), 'Settings feedback docs must exist');

const docs = readUtf8(docPath);
const settings = readUtf8(settingsPath);
const styles = readUtf8(stylesPath);

[
  'FB ADMIN DREAMHOME STATUS: SETTINGS ONLINE UI POLISH',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_HOANG_VAN',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'SETTINGS_DEV_COPY_REMOVED: YES',
  'CLOUD_DEBUG_PANEL_HIDDEN_FROM_ADMIN: YES',
  'ANGEL_WINGS_RESTORE_HIDDEN_FROM_ADMIN: YES',
  'LOCAL_CLOUD_PUSH_PULL_HIDDEN_FROM_ADMIN: YES',
  'SETTINGS_TABS_PRODUCT_FACING: YES',
  'CENTER_CLASS_SETTINGS_PRESERVED: YES',
  'DATA_STATUS_PRODUCT_FACING: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'RUNTIME_CHANGED: YES',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((needle) => assertIncludes(docs, needle, `docs marker ${needle}`));

[
  'Cài đặt cơ sở',
  'Quản lý các thiết lập vận hành của cơ sở.',
  'Ca học / Lớp',
  'Danh mục ca học dùng khi phân lớp học viên và lập thời khóa biểu.',
  'Trạng thái dữ liệu',
  'Dữ liệu cloud:',
  'Đồng bộ:',
  'Cơ sở:',
  'Chưa có ca học nào. Hãy thêm ca học/lớp để dùng khi nhập học viên và lập thời khóa biểu.',
].forEach((needle) => assertIncludes(settings, needle, `settings product copy ${needle}`));

[
  'Cloud DB online core',
  'C2 đọc/ghi',
  'Supabase:',
  'Đăng nhập:',
  'DreamHome: center_admin',
  'Cloud DB:',
  'Angel Wings local',
  'marker',
  'C5.2C',
  'cache Học phí local',
  'Làm mới số liệu',
  'Khôi phục dữ liệu Angel Wings',
  'Đẩy local lên cloud',
  'Tải cloud về local',
  'localStorage',
  'đã lên kế hoạch',
  'settings-cloud-db',
  'data-cloud-db-action',
].forEach((needle) => assertNotIncludes(settings, needle, `admin-facing dev copy ${needle}`));

assertIncludes(styles, '.settings-data-status-panel');
assertIncludes(styles, '.settings-data-status-badge.is-ready');
assertIncludes(styles, '.settings-data-status-grid');
assertNotIncludes(styles, '.settings-cloud-db-panel', 'old cloud debug panel CSS');

const changedFiles = readGitChangedFiles();
const allowedChangedPaths = new Set([
  'docs/fb-admin-dreamhome-form-save-window-focus-teacher-add.md',
  'docs/fb-admin-dreamhome-followup-window-focus-student-form-smoothness.md',
  'docs/fb-admin-dreamhome-settings-online-ui-polish.md',
  'tests/fb-admin-dreamhome-form-save-window-focus-teacher-add-smoke.js',
  'tests/fb-admin-dreamhome-followup-window-focus-student-form-smoothness-smoke.js',
  'tests/fb-admin-dreamhome-settings-online-ui-polish-smoke.js',
  'src/main.js',
  'src/settings-module.js',
  'src/student-module.js',
  'src/teacher-module.js',
  'src/styles.css',
]);

for (const changedPath of changedFiles) {
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in settings feedback scope: ${changedPath}`);
  assert(!/^docs\/c8-/i.test(changedPath), `C8 docs must not be modified: ${changedPath}`);
  assert(!/^tests\/c8-/i.test(changedPath), `C8 tests must not be modified: ${changedPath}`);
  assert(!/^supabase\//i.test(changedPath), `Supabase files must not be changed: ${changedPath}`);
  assert(!/\.sql$/i.test(changedPath), `SQL files must not be changed: ${changedPath}`);
}

const diffSource = execFileSync('git', ['diff', '--', 'src', 'docs/fb-admin-dreamhome-settings-online-ui-polish.md'], {
  cwd: root,
  encoding: 'utf8',
});

assert(!/service[_-]?role|SUPABASE_SERVICE_ROLE/i.test(diffSource), 'Feedback must not add service role material.');

[docPath, testPath].forEach(assertNoMojibakeInFile);

console.log('FB admin DreamHome settings online UI polish smoke: PASS');

function readGitChangedFiles() {
  const output = execFileSync('git', ['diff', '--name-only'], {
    cwd: root,
    encoding: 'utf8',
  });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  });

  return new Set(
    `${output}\n${untracked}`
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\\/g, '/'))
      .filter((line) => line.startsWith('docs/fb-admin-dreamhome-') || line.startsWith('tests/fb-admin-dreamhome-') || line.startsWith('src/'))
  );
}
