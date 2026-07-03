import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docPath = path.join(root, 'docs', 'fb-admin-dreamhome-followup-window-focus-student-form-smoothness.md');
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

assert(fs.existsSync(docPath), 'Follow-up docs must exist');

const docs = readUtf8(docPath);
const main = readUtf8(mainPath);
const studentModule = readUtf8(studentModulePath);
const teacherModule = readUtf8(teacherModulePath);
const styles = readUtf8(stylesPath);

[
  'FB ADMIN DREAMHOME FOLLOWUP STATUS: WINDOW FOCUS STUDENT FORM SMOOTHNESS',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_HOANG_VAN',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'STUDENT_PROFILE_BRING_TO_FRONT_REALLY_FIXED: YES',
  'STUDENT_MODULE_NO_LONGER_PRIORITIZED_OVER_PROFILE: YES',
  'STUDENT_FORM_VERBOSE_REQUIRED_BANNER_REMOVED: YES',
  'STUDENT_PARENT_TAB_WARNING_ICON_PRESERVED: YES',
  'STUDENT_FORM_EXTRA_CTA_REMOVED: YES',
  'STUDENT_INPUT_SINGLE_CLICK_FOCUS_FIXED: YES',
  'STUDENT_FORM_BLUR_RERENDER_REDUCED: YES',
  'ADD_STUDENT_MODAL_HEIGHT_RESPONSIVE_POLISHED: YES',
  'TEACHER_ADD_FORM_FIX_PRESERVED: YES',
  'BUTTON_AFFORDANCE_PRESERVED: YES',
  'RUNTIME_CHANGED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((needle) => assertIncludes(docs, needle, `docs marker ${needle}`));

assertIncludes(main, 'function bringWindowToFront(windowId)');
assertIncludes(main, 'focusWindow(windowId) {\n  bringWindowToFront(windowId)');
assertIncludes(main, '...openWindows.filter((windowItem) => windowItem.id !== windowId)');
assertIncludes(main, 'focusWindow(nextWindowId)');
assertIncludes(main, "row.addEventListener('pointerdown'");
assertIncludes(main, 'event.stopPropagation()');

assertIncludes(studentModule, 'needs-attention');
assertIncludes(studentModule, 'Cần nhập thông tin phụ huynh/chăm sóc');
assertIncludes(studentModule, '<span aria-label="Cần nhập thông tin phụ huynh/chăm sóc">!</span>');
[
  'Thiếu thông tin bắt buộc',
  'Còn thiếu thông tin phụ huynh/chăm sóc để lưu học viên.',
  'Điền thông tin phụ huynh',
  'Thông tin phụ huynh →',
  '← Thông tin học viên',
].forEach((needle) => assertNotIncludes(studentModule, needle, `verbose student form UI ${needle}`));

const studentBlurHandlerMatch = main.match(/control\.addEventListener\('blur'[\s\S]*?\n    \}\)/);
assert(studentBlurHandlerMatch, 'Student form blur handler should exist for phone formatting');
assertNotIncludes(studentBlurHandlerMatch[0], 'render()', 'student form blur render');
assertIncludes(studentBlurHandlerMatch[0], 'updateStudentFormSaveButton()');
assertIncludes(main, 'validateStudentForm(studentFormState.values)', 'student validation remains on save');

assertIncludes(styles, 'height: min(92dvh, calc(100dvh - 76px), 780px);');
assertIncludes(styles, 'max-height: calc(100dvh - 76px);');
assertIncludes(styles, '.student-form-steps button.needs-attention');
assertNotIncludes(styles, '.student-form-hint', 'verbose student form hint CSS');
assertNotIncludes(styles, '.student-hint-step-button', 'extra student CTA CSS');

assertIncludes(main, 'function handleTeacherFormSave(event = null)');
assertIncludes(main, 'event?.preventDefault?.()');
assertIncludes(teacherModule, 'class="teacher-save-button" type="button" data-teacher-action="save-form"');

[
  '.student-save-button:not(:disabled):hover',
  '.student-save-button:not(:disabled):active',
  '.teacher-form-actions button:not(:disabled):focus-visible',
  '.teacher-form-actions button:not(:disabled):active',
].forEach((needle) => assertIncludes(styles, needle, `button affordance ${needle}`));

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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in follow-up scope: ${changedPath}`);
  assert(!/^docs\/c8-/i.test(changedPath), `C8 docs must not be modified: ${changedPath}`);
  assert(!/^tests\/c8-/i.test(changedPath), `C8 tests must not be modified: ${changedPath}`);
  assert(!/^supabase\//i.test(changedPath), `Supabase files must not be changed: ${changedPath}`);
  assert(!/\.sql$/i.test(changedPath), `SQL files must not be changed: ${changedPath}`);
}

[docPath, testPath].forEach(assertNoMojibakeInFile);

console.log('FB admin DreamHome follow-up window-focus/student-form-smoothness smoke: PASS');

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
