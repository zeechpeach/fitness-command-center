// Every inline on*="fn(...)" handler resolves fn against the GLOBAL scope.
// app.js is an ES module, so a function declared `function fn(){}` is NOT
// global - only `window.fn = function` is. Any inline handler naming a
// module-scoped function throws ReferenceError when tapped.
const fs = require('fs');
const path = require('path');

const ROOT = require('path').resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'src/js/app.js'), 'utf8');

// Names the app explicitly puts on window.
const globals = new Set();
for (const m of js.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) globals.add(m[1]);

// Browser built-ins / harmless expressions that legitimately appear inline.
const BUILTINS = new Set([
  'alert', 'confirm', 'prompt', 'event', 'this', 'location', 'history', 'window',
  'document', 'console', 'return', 'if', 'else', 'true', 'false', 'null', 'void',
  'setTimeout', 'clearTimeout', 'JSON', 'Math', 'Number', 'String', 'parseInt',
  'parseFloat', 'Array', 'Object', 'navigator',
  // Evaluated when the template literal is built, not when the attribute runs.
  'escapeJsArg', 'escapeHtml'
]);

// Pull every on*="..." attribute value out of both files (app.js builds markup
// in template literals, so the same regex finds those too).
const calls = new Map(); // fnName -> [{file, line, attr}]
function scan(src, file) {
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // Skip commented-out lines: a // comment quoting an onclick is not markup.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const m of line.matchAll(/\bon(?:click|change|input|submit|keydown|keyup|focus|blur|load)\s*=\s*(["'])([\s\S]*?)\1/g)) {
      const body = m[2];
      // identifiers that are immediately called: `foo(` , but not `a.foo(`
      for (const c of body.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
        const name = c[2];
        if (BUILTINS.has(name)) continue;
        if (!calls.has(name)) calls.set(name, []);
        calls.get(name).push({ file, line: i + 1, attr: body.trim().slice(0, 90) });
      }
    }
  });
}
scan(html, 'index.html');
scan(js, 'src/js/app.js');

const broken = [];
const okNames = [];
for (const [name, sites] of [...calls].sort()) {
  if (globals.has(name)) okNames.push(name);
  else broken.push({ name, sites });
}

console.log(`Inline handler function names referenced: ${calls.size}`);
console.log(`  resolve on window: ${okNames.length}`);
console.log(`  DO NOT resolve:    ${broken.length}\n`);

if (broken.length) {
  console.log('=== BROKEN: inline handler calls a function that is not global ===');
  for (const b of broken) {
    const declared = new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?function\\s+${b.name}\\s*\\(`).test(js);
    console.log(`\n  ${b.name}()  ${declared ? '[declared module-scoped in app.js]' : '[NOT DECLARED ANYWHERE]'}`);
    b.sites.slice(0, 6).forEach(s => console.log(`     ${s.file}:${s.line}  ${s.attr}`));
    if (b.sites.length > 6) console.log(`     ... and ${b.sites.length - 6} more sites`);
  }
}
