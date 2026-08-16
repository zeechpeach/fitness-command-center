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

// module-scoped function declarations
const fns = [...js.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]);
report('module functions', [...new Set(fns)]);

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
