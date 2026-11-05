// The whole build and all checks with a short report: one line per step, and only the failures in detail.
// The full output of each step stays in build/shots/check-<step>.log.
//   npm run check               build + all three test suites
//   npm run check -- app page   only these steps (book, pwa-build, page-build, app, pwa, page)
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..'), LOGS = path.join(__dirname, 'shots');
const STEPS = {
  book: ['python', ['build/parse_book.py'], ROOT],
  'pwa-build': ['python', ['build/build_pwa.py'], ROOT],
  'page-build': ['python', ['build/build_page.py'], ROOT],
  app: ['npm', ['run', '-s', 'test:app'], __dirname],
  pwa: ['npm', ['run', '-s', 'test:pwa'], __dirname],
  page: ['npm', ['run', '-s', 'test:page'], __dirname],
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STEPS);
const unknown = names.filter(n => !STEPS[n]);
if (unknown.length) { console.log('unknown step: ' + unknown.join(', ') + ' (' + Object.keys(STEPS).join(', ') + ')'); process.exit(2); }
fs.mkdirSync(LOGS, { recursive: true });

let failed = 0;
for (const name of names) {
  const [cmd, args, cwd] = STEPS[name], t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 1 << 28,
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) });
  const text = (r.stdout || '') + (r.stderr || ''), log = path.join(LOGS, `check-${name}.log`);
  fs.writeFileSync(log, text);
  const secs = Math.round((Date.now() - t0) / 1000);
  // the test scripts end with a JSON report whose `errors` lists what went wrong
  const at = text.startsWith('{\n') ? 0 : text.lastIndexOf('\n{\n');
  let errors = null;
  if (at >= 0) { try { errors = JSON.parse(text.slice(at).trim()).errors; } catch (e) { errors = null; } }
  const isTest = ['app', 'pwa', 'page'].includes(name); // a test without a readable report has not passed
  if (r.status === 0 && (!isTest || (errors && !errors.length))) {
    const last = text.trim().split('\n').pop();
    console.log(`ok   ${name} (${secs}s)${errors ? '' : ' ' + last.slice(0, 100)}`);
    continue;
  }
  failed++;
  console.log(`FAIL ${name} (${secs}s, exit ${r.status}), full log: build/shots/check-${name}.log`);
  console.log((errors && errors.length ? errors.map(String) : text.trim().split('\n').slice(-20)).join('\n').slice(0, 3000));
}
process.exit(failed ? 1 : 0);
