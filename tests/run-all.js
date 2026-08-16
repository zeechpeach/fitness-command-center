// Runs every scenario and every sweep, one after another, and reports a tally.
//
//     node tests/run-all.js
//
// Exits non-zero if anything failed, so it can gate a change.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;

const files = fs.readdirSync(HERE)
  .filter(f => /^\d\d-.*\.js$/.test(f) || /^sweep-.*\.js$/.test(f))
  .sort();

let failedFiles = 0;
let totalAssertionFailures = 0;
const results = [];

for (const file of files) {
  process.stdout.write(`${file.padEnd(38)} `);
  let out = '';
  let crashed = false;
  try {
    out = execFileSync(process.execPath, [path.join(HERE, file)], {
      encoding: 'utf8',
      timeout: 180000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (e) {
    crashed = true;
    out = (e.stdout || '') + (e.stderr || '');
  }

  const match = out.match(/RESULT:\s*(\d+) failed assertions/);
  const sweepBroken = out.match(/DO NOT resolve:\s*(\d+)/);
  const deadCount = [...out.matchAll(/(\d+) unreferenced of/g)].map(m => Number(m[1]));

  let failures = null;
  if (match) failures = Number(match[1]);
  else if (sweepBroken) failures = Number(sweepBroken[1]);
  else if (deadCount.length) failures = deadCount.reduce((a, b) => a + b, 0);

  if (crashed && failures === null) {
    console.log('CRASHED');
    failedFiles++;
    results.push({ file, status: 'crashed', out });
  } else if (failures === null) {
    console.log('ok (no tally)');
    results.push({ file, status: 'untallied' });
  } else if (failures > 0) {
    console.log(`${failures} FAILED`);
    failedFiles++;
    totalAssertionFailures += failures;
    results.push({ file, status: 'failed', out });
  } else {
    console.log('pass');
    results.push({ file, status: 'pass' });
  }
}

console.log('\n' + '-'.repeat(56));
console.log(`${files.length} files, ${failedFiles} with failures, ` +
  `${totalAssertionFailures} failed assertions`);

// Print the detail for anything that went wrong, so a failure is actionable
// without re-running by hand.
for (const r of results.filter(r => r.status === 'failed' || r.status === 'crashed')) {
  console.log(`\n===== ${r.file} (${r.status}) =====`);
  const lines = r.out.split('\n').filter(l => /^FAIL|Error|CRASH|not defined|=====/.test(l));
  console.log(lines.slice(0, 25).join('\n') || r.out.slice(-1500));
}

process.exit(failedFiles === 0 ? 0 : 1);
