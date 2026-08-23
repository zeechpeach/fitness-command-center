// Find declarations in app.js that nothing references.
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const js = fs.readFileSync(ROOT + '/src/js/app.js', 'utf8');
const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
const all = js + '\n' + html;

function report(label, names) {
  const dead = [];
  for (const name of names) {
    // count references anywhere (declaration included)
    const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g');
    const hits = (all.match(re) || []).length;
    if (hits <= 1) dead.push({ name, hits });
  }
  console.log(`\n=== ${label}: ${dead.length} unreferenced of ${names.length} ===`);
  dead.forEach(d => console.log(`  ${d.name}  (${d.hits} occurrence)`));
  return dead;
}

// Conflict markers that survive a bad merge resolution render as literal text
// on the page ("<<<<<<< HEAD"). This shipped once; never again.
const cssSrc = fs.readFileSync(ROOT + '/src/css/styles.css', 'utf8');
const markerHits = [];
[['src/js/app.js', js], ['index.html', html], ['src/css/styles.css', cssSrc]].forEach(([name, text]) => {
  text.split('\n').forEach((line, i) => {
    if (/^(<{7}|={7}|>{7})([ \t]|$)/.test(line)) markerHits.push(`${name}:${i + 1}  ${line.slice(0, 40)}`);
  });
});
console.log(`\n=== merge conflict markers: ${markerHits.length} ===`);
markerHits.forEach(h => console.log('  ' + h));
if (markerHits.length) process.exitCode = 1;

// module-scoped function declarations
const fns = [...js.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]);
report('module functions', [...new Set(fns)]);

// Two `window.foo = ...` assignments mean the later one silently wins and the
// earlier one is unreachable, with no error anywhere. This has bitten twice.
const winAssignments = [...js.matchAll(/^window\.([A-Za-z_$][\w$]*)\s*=/gm)].map(m => m[1]);
const seenWin = new Map();
winAssignments.forEach(n => seenWin.set(n, (seenWin.get(n) || 0) + 1));
const shadowed = [...seenWin].filter(([, count]) => count > 1);
console.log(`\n=== window.* assigned more than once (later one wins): ${shadowed.length} ===`);
shadowed.forEach(([name, count]) => console.log(`  window.${name}  (${count} assignments)`));

// Same for module functions declared twice.
const seenFn = new Map();
fns.forEach(n => seenFn.set(n, (seenFn.get(n) || 0) + 1));
const dupeFns = [...seenFn].filter(([, count]) => count > 1);
console.log(`=== module functions declared more than once: ${dupeFns.length} ===`);
dupeFns.forEach(([name, count]) => console.log(`  ${name}()  (${count} declarations)`));

if (shadowed.length || dupeFns.length) process.exitCode = 1;

// window.* assignments
const wins = [...js.matchAll(/^window\.([A-Za-z_$][\w$]*)\s*=/gm)].map(m => m[1]);
const deadWin = [];
for (const name of [...new Set(wins)]) {
  const inJs = (js.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
  const inHtml = (html.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
  if (inJs <= 1 && inHtml === 0) deadWin.push(name);
}
console.log(`\n=== window.* never referenced anywhere: ${deadWin.length} ===`);
deadWin.forEach(n => console.log('  window.' + n));

// top-level let/const
const vars = [...js.matchAll(/^(?:let|const)\s+([A-Za-z_$][\w$]*)\s*[=;]/gm)].map(m => m[1]);
report('module variables', [...new Set(vars)]);

// ids referenced in JS but absent from the HTML (broken getElementById)
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const used = new Set([...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
const missing = [...used].filter(i => !ids.has(i));
console.log(`\n=== getElementById targets with no element in index.html: ${missing.length} ===`);
missing.forEach(i => console.log('  #' + i));
