// Clean run: guarantee a blank form before each scenario.
const { boot, ok, finish, startSuggested } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

async function freshForm(page) {
  // Nothing is pre-assigned any more: get a loggable form from the suggestion.
  await startSuggested(page, 45, 'full');
  const wIdx = await page.evaluate(() => [...document.querySelectorAll('.set-row')].findIndex(r => r.querySelector('.weight-input')));
  const blank = await page.evaluate((i) => {
    const r = document.querySelectorAll('.set-row')[i];
    return { w: r.querySelector('.weight-input').value, reps: r.querySelector('.reps-input').value };
  }, wIdx);
  if (blank.w !== '' || blank.reps !== '') throw new Error('form not blank: ' + JSON.stringify(blank));
  return wIdx;
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const SEED = () => ({ seed: { programs: [realProgram()], workouts: [] } });
  let s1 = await boot(SEED());
  let { browser, page, errors } = s1;

  // ---------- 1. caret still in the reps box, then background ----------
  let wIdx = await freshForm(page);
  let row = page.locator('.set-row').nth(wIdx);
  await row.locator('.weight-input').click();
  await page.keyboard.type('115', { delay: 60 });
  await row.locator('.reps-input').first().click();
  await page.keyboard.type('5', { delay: 60 });

  let onScreen = await page.evaluate((i) => {
    const r = document.querySelectorAll('.set-row')[i];
    return { w: r.querySelector('.weight-input').value, reps: r.querySelector('.reps-input').value };
  }, wIdx);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
  });
  await page.waitForTimeout(300);
  let draft = JSON.parse(await page.evaluate(() => localStorage.getItem('fcc:draft:v2')) || 'null');
  let sets = [];
  Object.values((draft && draft.days) || {}).forEach(v =>
    Object.values(v.workout || v.currentWorkout || v || {}).forEach(e => {
      if (e && e.sets) e.sets.forEach(s => { if (s.weight || s.reps) sets.push(s); });
    }));
  console.log('\n[1] phone locks with the caret still in the reps box');
  console.log('    on screen: ' + JSON.stringify(onScreen));
  console.log('    in draft:  ' + JSON.stringify(sets));
  F('a number still being typed survives the phone locking',
    sets.some(s => s.reps === '5'), JSON.stringify(sets));

  // ---------- 2. tap Complete straight from the focused reps box ----------
  await browser.close();
  const s2 = await boot(SEED()); page = s2.page; browser = s2.browser; errors = s2.errors;
  wIdx = await freshForm(page);
  row = page.locator('.set-row').nth(wIdx);
  await row.locator('.weight-input').click();
  await page.keyboard.type('135', { delay: 60 });
  await row.locator('.reps-input').first().click();
  await page.keyboard.type('7', { delay: 60 });
  onScreen = await page.evaluate((i) => {
    const r = document.querySelectorAll('.set-row')[i];
    return { w: r.querySelector('.weight-input').value, reps: r.querySelector('.reps-input').value };
  }, wIdx);
  await page.evaluate(() => { window.__seed.workouts = []; window.__writes = []; });
  await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
  await page.locator('#complete-workout-btn').click();
  await page.waitForTimeout(2500);
  const saved = await page.evaluate(() => (window.__seed.workouts || []).map(w =>
    Object.values(w.exercises || {}).flatMap(e => (e.sets || []).filter(s => s.weight || s.reps))));
  console.log('\n[2] tap Complete Session straight from the focused reps box');
  console.log('    on screen: ' + JSON.stringify(onScreen));
  console.log('    saved:     ' + JSON.stringify(saved));
  const flat = saved.flat();
  F('Complete Session saves a number typed but not tabbed away from',
    flat.some(s => s.reps === '7') && flat.some(s => s.weight === '135'), JSON.stringify(flat));

  // ---------- 3. tap a different day pill straight from the focused box ----------
  await browser.close();
  const s3 = await boot(SEED()); page = s3.page; browser = s3.browser; errors = s3.errors;
  wIdx = await freshForm(page);
  row = page.locator('.set-row').nth(wIdx);
  await row.locator('.weight-input').click();
  await page.keyboard.type('145', { delay: 60 });
  await row.locator('.reps-input').first().click();
  await page.keyboard.type('9', { delay: 60 });
  // Switch away to the Tournament Circuit pill and come back to the
  // generated session's pill.
  const activeLabel = await page.evaluate(() => {
    const a = document.querySelector('#workout-day-selector .day-btn.active');
    return a ? a.getAttribute('data-substitute') : null;
  });
  await page.locator('.day-btn[data-substitute="Tournament Circuit"]').click();
  await page.waitForTimeout(900);
  await page.locator(`.day-btn[data-substitute="${activeLabel}"]`).click();
  await page.waitForTimeout(900);
  const afterSwitch = await page.evaluate((i) => {
    const r = document.querySelectorAll('.set-row')[i];
    return r ? { w: r.querySelector('.weight-input')?.value, reps: r.querySelector('.reps-input')?.value } : null;
  }, wIdx);
  console.log('\n[3] switch day pill and come back, straight from the focused box');
  console.log('    back on the original day: ' + JSON.stringify(afterSwitch));
  F('switching day and back keeps a number typed but not tabbed away from',
    afterSwitch && afterSwitch.reps === '9' && afterSwitch.w === '145', JSON.stringify(afterSwitch));

  console.log('\nerrors: ' + errors.length);
  errors.slice(0, 8).forEach(e => console.log('  ' + e.message));
  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
  await browser.close();
  finish(fails);
})();
