// Boots index.html in a real browser at iPhone width, with Firebase replaced by
// the in-memory stand-in in firebase-stub.js. Shared by every test.
const fs = require('fs');
const path = require('path');
const { start: startServer, ROOT } = require('./server');

// Playwright is a dev-only dependency and is not vendored into this repo.
// Resolve it from wherever it is installed rather than assuming a location.
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    try {
      // Common global install location.
      const { execSync } = require('child_process');
      const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
      return require(path.join(root, 'playwright'));
    } catch (e2) {
      console.error(
        '\nPlaywright is not installed. These tests need it:\n' +
        '    npm install -g playwright\n' +
        '    npx playwright install chromium\n'
      );
      process.exit(1);
    }
  }
}

const { chromium } = loadPlaywright();
const STUB = fs.readFileSync(path.join(__dirname, 'firebase-stub.js'), 'utf8');

// Chart.js is injected on demand by the app; stand in for it so chart code
// paths run without reaching the network.
const CHART_STUB = `
  window.__charts = [];
  window.Chart = function (ctx, cfg) {
    window.__charts.push({ type: cfg && cfg.type, cfg: cfg });
    this.destroy = function () {};
    this.update = function () {};
    this.resize = function () {};
    this.data = (cfg && cfg.data) || {};
  };
  window.Chart.register = function () {};
  window.Chart.defaults = { font: {}, plugins: { legend: {} }, scale: {}, scales: {} };
  window.Chart.registerables = [];
`;

async function boot(opts = {}) {
  const {
    seed = {},
    width = 390,
    height = 844,
    localStorage: ls = {},
    indexEnforcement = false
  } = opts;

  const base = await startServer();

  const browser = await chromium.launch({
    // PW_CHROMIUM lets a sandbox point at a preinstalled binary; otherwise
    // Playwright uses whatever `playwright install chromium` put down.
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const isPhone = width < 768;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 3,
    isMobile: isPhone,
    hasTouch: isPhone,
    userAgent: isPhone
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined
  });

  const errors = [];
  const consoleLogs = [];

  // Serve the fake Firebase in place of the three gstatic modules.
  await context.route('**/www.gstatic.com/firebasejs/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
  // Neutralise remaining third parties so nothing hangs on the network.
  await context.route('**/fonts.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await context.route('**/fonts.gstatic.com/**', route =>
    route.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));
  await context.route('**/cdnjs.cloudflare.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: CHART_STUB }));
  await context.route('**/cdn.jsdelivr.net/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__chartAdapter=true;' }));

  const page = await context.newPage();

  await page.addInitScript(({ seed, ls, indexEnforcement }) => {
    window.__seed = seed;
    window.__writes = [];
    window.__queries = [];
    window.__indexEnforcement = indexEnforcement;
    window.__dialogs = [];
    try {
      for (const [k, v] of Object.entries(ls)) window.localStorage.setItem(k, v);
    } catch (e) { /* storage unavailable */ }

    // Record native dialogs instead of letting them block the run.
    ['alert', 'confirm', 'prompt'].forEach(fn => {
      window[fn] = function (msg, def) {
        window.__dialogs.push({ fn, msg: String(msg) });
        if (fn === 'confirm') return window.__confirmAnswer !== false;
        if (fn === 'prompt') return window.__promptAnswer !== undefined ? window.__promptAnswer : (def || '');
        return undefined;
      };
    });
  }, { seed, ls, indexEnforcement });

  page.on('pageerror', e => errors.push({ type: 'pageerror', message: e.message }));
  page.on('console', m => {
    consoleLogs.push({ type: m.type(), text: m.text() });
    if (m.type() === 'error') errors.push({ type: 'console.error', message: m.text() });
  });
  page.on('dialog', d => d.dismiss().catch(() => { }));

  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
  // Let the auth callback and the concurrent startup loads settle.
  await page.waitForTimeout(1500);

  return { browser, context, page, errors, consoleLogs, base };
}

// Tap the centre of an element the way a finger would.
async function tap(page, selector) {
  const el = page.locator(selector);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const box = await el.boundingBox();
  if (!box) throw new Error(`nothing to tap for ${selector}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
}

// A date N days from today, in the YYYY-MM-DD form the app stores.
function dayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ok(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
  return !!cond;
}

// Every test ends by reporting its failure count, which run-all.js reads.
function finish(fails) {
  console.log(`\nRESULT: ${fails} failed assertions`);
  if (fails > 0) process.exitCode = 1;
}

// Drive the suggestion panel end to end: length, location, Start this. The
// scheduled day pills are gone, so this is how most tests get a loggable form.
async function startSuggested(page, minutes = 45, place = 'full') {
  await page.evaluate(({ m, p }) => {
    window.suggestSessionFor(m);
    window.suggestPlaceFor(p);
  }, { m: minutes, p: place });
  await page.waitForTimeout(200);
  await page.locator('.today-start').click();
  await page.waitForTimeout(1200);
}

module.exports = { boot, ok, tap, dayStr, finish, startSuggested, ROOT };
