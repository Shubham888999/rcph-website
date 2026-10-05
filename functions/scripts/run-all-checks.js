'use strict';

// Runs every verify-*.js script and the lib unit tests as separate processes,
// keeps going after failures, prints a summary, and exits 1 if anything failed.
// firestore-emulator-security-test.js is not a verify-* script and is excluded
// because it needs the Firestore emulator (Java); run `npm run test:firestore-emulator` for it.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const functionsDir = path.join(__dirname, '..');
const libDir = path.join(functionsDir, 'lib');

const checks = fs.readdirSync(__dirname)
  .filter(name => /^verify-.*\.js$/.test(name))
  .sort()
  .map(name => ({ label: name, args: [path.join('scripts', name)] }));

const libTests = fs.readdirSync(libDir)
  .filter(name => name.endsWith('.test.js'))
  .sort()
  .map(name => path.join('lib', name));
checks.push({ label: `lib unit tests (${libTests.length} files)`, args: ['--test', ...libTests] });

const results = [];
for (const check of checks) {
  const started = Date.now();
  const run = spawnSync(process.execPath, check.args, { cwd: functionsDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const passed = run.status === 0;
  results.push({ label: check.label, passed, seconds: (Date.now() - started) / 1000 });
  if (!passed) {
    console.log(`\n--- ${check.label} failed (exit ${run.status ?? run.signal}) ---`);
    console.log(`${run.stdout || ''}${run.stderr || ''}`.trim().split('\n').slice(-40).join('\n'));
  }
}

const width = Math.max(...results.map(result => result.label.length), 'Check'.length);
console.log(`\n${'Check'.padEnd(width)} | Result | Duration`);
console.log(`${'-'.repeat(width)}-|--------|---------`);
for (const result of results) {
  console.log(`${result.label.padEnd(width)} | ${(result.passed ? 'pass' : 'FAIL').padEnd(6)} | ${result.seconds.toFixed(1)}s`);
}
const failed = results.filter(result => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
