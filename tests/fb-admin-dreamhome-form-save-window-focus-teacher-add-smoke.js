import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'fb-admin-dreamhome-form-save-window-focus-teacher-add.md');
const mainPath = path.join(root, 'src', 'main.js');
const studentModulePath = path.join(root, 'src', 'student-module.js');
const teacherModulePath = path.join(root, 'src', 'teacher-module.js');
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

assert(fs.existsSync(docPath), 'Feedback docs must exist');

const docs = readUtf8(docPath);
const main = readUtf8(mainPath);
const studentModule = readUtf8(studentModulePath);
const teacherModule = readUtf8(teacherModulePath);
const styles = readUtf8(stylesPath);

[
  'FB ADMIN DREAMHOME STATUS: FORM SAVE WINDOW FOCUS TEACHER ADD',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_HOANG_VAN',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'STUDENT_SAVE_DISABLED_REASON_ADDED: YES',
  'STUDENT_PARENT_INFO_REQUIRED_HINT_ADDED: YES',
  'STUDENT_PROFILE_WINDOW_BRING_TO_FRONT_FIXED: YES',
  'WINDOW_LAYER_PRIORITY_NOTED: YES',
  'TEACHER_ADD_FORM_SUBMIT_FIXED: YES',
  'BUTTON_AFFORDANCE_POLISHED: YES',
  'RUNTIME_CHANGED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((needle) => assertIncludes(docs, needle, `docs marker ${needle}`));

assertIncludes(studentModule, 'Cần nhập thông tin phụ huynh/chăm sóc');
assertIncludes(studentModule, 'getStudentFormSaveDisabledReason');
assertIncludes(studentModule, 'isStudentParentCareInfoIncomplete');
assertIncludes(studentModule, 'needs-attention');
assertIncludes(main, 'getStudentFormSaveDisabledReason');
assertNotIncludes(studentModule, 'Thiếu thông tin bắt buộc', 'verbose student required banner');
assertNotIncludes(studentModule, 'Còn thiếu thông tin phụ huynh/chăm sóc để lưu học viên.', 'verbose parent/care hint');
assertNotIncludes(studentModule, 'Điền thông tin phụ huynh', 'extra parent/care CTA');

assertIncludes(main, 'function openStudentDetailWindow(studentId)');
assertIncludes(main, 'const nextWindowId = `window-${nextWindowNumber}`');
assertIncludes(main, 'focusWindow(nextWindowId)');
assertIncludes(main, 'focusWindow(existingWindow.id)');

assertIncludes(main, 'function handleTeacherFormSave(event = null)');
assertIncludes(main, 'event?.preventDefault?.()');
assertIncludes(main, 'data-teacher-action="save-form"');
assertIncludes(teacherModule, 'class="teacher-save-button" type="button" data-teacher-action="save-form"');
assertNotIncludes(teacherModule, 'class="teacher-save-button" type="submit"', 'teacher native submit save button');

[
  '.student-save-button:not(:disabled):hover',
  '.student-save-button:not(:disabled):active',
  '.student-save-button:disabled',
  '.student-form-steps button.needs-attention',
  '.teacher-add-button:focus-visible',
  '.teacher-form-actions button:not(:disabled):focus-visible',
  '.teacher-form-actions button:not(:disabled):active',
  '.teacher-form-actions button:disabled',
].forEach((needle) => assertIncludes(styles, needle, `CSS affordance ${needle}`));

const changedFiles = readGitChangedFiles();
const allowedChangedPaths = new Set([
  'docs/fb-admin-dreamhome-form-save-window-focus-teacher-add.md',
  'docs/fb-admin-dreamhome-followup-window-focus-student-form-smoothness.md',
  'tests/fb-admin-dreamhome-form-save-window-focus-teacher-add-smoke.js',
  'tests/fb-admin-dreamhome-followup-window-focus-student-form-smoothness-smoke.js',
  'src/main.js',
  'src/student-module.js',
  'src/teacher-module.js',
  'src/styles.css',
]);

for (const changedPath of changedFiles) {
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in feedback scope: ${changedPath}`);
  assert(!/^docs\/c8-/i.test(changedPath), `C8 docs must not be modified: ${changedPath}`);
  assert(!/^tests\/c8-/i.test(changedPath), `C8 tests must not be modified: ${changedPath}`);
  assert(!/^supabase\//i.test(changedPath), `Supabase files must not be changed: ${changedPath}`);
  assert(!/\.sql$/i.test(changedPath), `SQL files must not be changed: ${changedPath}`);
}

[docPath, testPath].forEach(assertNoMojibakeInFile);

console.log('FB admin DreamHome form-save/window-focus/teacher-add smoke: PASS');

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
