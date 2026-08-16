// Journey: import the real 49-exercise program by pasting JSON.
const { boot, ok } = require('./harness/drive');
const fs = require('fs');

(async () => {
  const RAW = fs.readFileSync(require('path').join(require('./harness/server').ROOT, 'my-program.txt'), 'utf8');
  const src = JSON.parse(RAW);

  const { browser, page, errors } = await boot({ seed: {} });
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  await page.evaluate(() => window.openSettings());
  await page.waitForTimeout(250);
  await page.evaluate(() => window.openImportProgram());
  await page.waitForTimeout(250);

  const panelVisible = await page.evaluate(() => {
    const p = document.getElementById('import-program-panel');
    const r = p.getBoundingClientRect();
    return { active: p.classList.contains('active'), h: Math.round(r.height), display: getComputedStyle(p).display };
  });
  F('import panel opens', panelVisible.active && panelVisible.h > 10, JSON.stringify(panelVisible));

  await page.fill('#import-program-input', RAW);
  await page.evaluate(() => window.previewImportProgram());
  await page.waitForTimeout(300);

  const preview = await page.evaluate(() =>
    document.getElementById('import-program-result').innerText.trim());
  console.log('\n--- preview text ---\n' + preview + '\n');
  F('preview reports 7 days', /7\s*day/i.test(preview), JSON.stringify(preview.slice(0, 120)));
  F('preview reports 49 exercises', /49/.test(preview), JSON.stringify(preview.slice(0, 120)));

  await page.evaluate(() => window.confirmImportProgram());
  await page.waitForTimeout(1200);

  // What actually got written?
  const stored = await page.evaluate(() => {
    const progs = window.__seed.programs || [];
    const p = progs.find(x => x.active) || progs[progs.length - 1];
    if (!p) return null;
    const types = {};
    Object.entries(p.workouts || {}).forEach(([k, v]) => {
      types[k] = (v || []).map(e => ({ n: e.name, t: e.trackingType }));
    });
    return {
      name: p.name, active: p.active, activatedAt: !!p.activatedAt,
      schedule: p.schedule, workoutKeys: Object.keys(p.workouts || {}), types
    };
  });

  F('imported program saved', !!stored, '');
  F('imported program is active', stored && stored.active === true, String(stored && stored.active));
  F('activatedAt stamped', stored && stored.activatedAt === true, String(stored && stored.activatedAt));

  const dayNames = Object.keys(stored.schedule).sort((a, b) => +a.slice(3) - +b.slice(3))
    .map(k => stored.schedule[k].workoutType || stored.schedule[k].customName || stored.schedule[k]);
  console.log('stored day order: ' + JSON.stringify(dayNames));
  F('7 day slots, contiguous day1..day7',
    Object.keys(stored.schedule).length === 7 &&
    [1, 2, 3, 4, 5, 6, 7].every(i => stored.schedule['day' + i]),
    JSON.stringify(Object.keys(stored.schedule)));

  // --- tracking types survived, exercise for exercise ---
  const expected = [];
  Object.entries(src.workouts).forEach(([day, list]) =>
    list.forEach(e => expected.push({ day, name: e.name, type: e.trackingType })));

  const gotMap = new Map();
  Object.entries(stored.types).forEach(([day, list]) =>
    list.forEach(e => gotMap.set(day + '||' + e.n, e.t)));

  const mismatches = expected.filter(e => gotMap.get(e.day + '||' + e.name) !== e.type)
    .map(e => ({ day: e.day, name: e.name, want: e.type, got: gotMap.get(e.day + '||' + e.name) }));
  F(`all ${expected.length} tracking types survive import`, mismatches.length === 0,
    mismatches.length ? JSON.stringify(mismatches.slice(0, 8)) : '');

  const typeCounts = {};
  gotMap.forEach(v => typeCounts[v] = (typeCounts[v] || 0) + 1);
  console.log('stored tracking type counts: ' + JSON.stringify(typeCounts));
  F('all five tracking types present', Object.keys(typeCounts).length === 5, JSON.stringify(typeCounts));

  // --- day pills render in the logger ---
  await page.evaluate(() => { window.closeImportProgram && window.closeImportProgram(); window.closeSettings && window.closeSettings(); });
  await page.waitForTimeout(800);

  const pills = await page.evaluate(() => {
    const sel = document.getElementById('workout-day-selector');
    if (!sel) return { found: false };
    const btns = [...sel.querySelectorAll('button, .day-btn')];
    return {
      found: true,
      count: btns.length,
      labels: btns.map(b => b.innerText.replace(/\s+/g, ' ').trim()).slice(0, 10),
      visible: btns.filter(b => b.getBoundingClientRect().height > 5).length
    };
  });
  console.log('day pills: ' + JSON.stringify(pills));
  // 7 scheduled days + the Tournament Circuit, which the program defines but
  // never schedules and which is now offered as a substitute session.
  const scheduledPills = (pills.labels || []).filter(l => /^Day \d/.test(l));
  F('day pills render from the import', pills.found && scheduledPills.length === 7, JSON.stringify(pills));
  F('day pills are visible', pills.visible === pills.count, JSON.stringify(pills));

  const pillText = (pills.labels || []).join(' ');
  F('pills show the imported day names', /Upper A/.test(pillText), pillText.slice(0, 160));

  // --- Tournament Circuit: in the program, but reachable? ---
  F('Tournament Circuit is in the exercise lists',
    stored.workoutKeys.includes('Tournament Circuit'), JSON.stringify(stored.workoutKeys));
  F('Tournament Circuit is not one of the seven scheduled days',
    !dayNames.includes('Tournament Circuit'), JSON.stringify(dayNames));
  F('Tournament Circuit IS offered as a substitute session',
    (pills.labels || []).includes('Tournament Circuit'), JSON.stringify(pills.labels));

  // --- rubbish input does not crash ---
  await page.evaluate(() => window.openImportProgram());
  await page.waitForTimeout(200);
  const errsBefore = errors.length;
  await page.fill('#import-program-input', 'this is not json {{{');
  await page.evaluate(() => window.previewImportProgram());
  await page.waitForTimeout(300);
  const rubbish = await page.evaluate(() => document.getElementById('import-program-result').innerText.trim());
  console.log('rubbish input message: ' + JSON.stringify(rubbish.slice(0, 120)));
  F('rubbish input gives a plain message, not a crash',
    rubbish.length > 5 && errors.length === errsBefore, `newErrors=${errors.length - errsBefore}`);

  console.log('\n--- page errors (' + errors.length + ') ---');
  errors.slice(0, 15).forEach(e => console.log(`  [${e.type}] ${e.message}`));
  console.log(`\nRESULT: ${fails} failed assertions`);
  await browser.close();
})();
