// Journey: log part of a session, complete, add more, complete again.
// Must end as ONE saved session, not two.
const { boot, ok } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  const { browser, page, errors } = await boot({
    seed: { programs: [realProgram()], workouts: [] }
  });
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const day = await page.evaluate(() => {
    const active = document.querySelector('#workout-day-selector .day-btn.active, #workout-day-selector button.active');
    return active ? active.innerText.replace(/\s+/g, ' ').trim() : null;
  });
  console.log('logger opened on: ' + JSON.stringify(day));

  // ---- lunchtime: fill the first exercise only ----
  const firstRows = await page.locator('.set-row').count();
  console.log('set rows available: ' + firstRows);
  const r0 = page.locator('.set-row').nth(0);
  if (await r0.locator('.weight-input').count()) {
    await r0.locator('.weight-input').fill('95');
    await r0.locator('.reps-input').fill('8');
  } else {
    await r0.locator('.reps-input').first().fill('30');
  }
  await page.waitForTimeout(300);

  await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
  await page.locator('#complete-workout-btn').click();
  await page.waitForTimeout(2500);

  let writes = await page.evaluate(() => window.__writes.slice());
  const firstAdds = writes.filter(w => w.op === 'addDoc' && w.collection === 'workouts');
  F('first Complete creates one session', firstAdds.length === 1, `adds=${firstAdds.length}`);

  // A banner should tell the user the session is saved and can be added to.
  const banner = await page.evaluate(() => {
    const t = document.getElementById('workout-content').innerText;
    const m = t.match(/.{0,90}(saved|added to|add to).{0,90}/i);
    return m ? m[0].replace(/\s+/g, ' ').trim() : null;
  });
  console.log('banner after first save: ' + JSON.stringify(banner));
  F('a banner says the session is saved / can be added to', !!banner, String(banner));

  // ---- evening: the form must still hold what was saved ----
  const hydrated = await page.evaluate(() => {
    const vals = [...document.querySelectorAll('.set-row')].slice(0, 3).map(r => ({
      w: r.querySelector('.weight-input')?.value ?? null,
      r: r.querySelector('.reps-input')?.value ?? null
    }));
    return vals;
  });
  console.log('form after save (should still show set 1): ' + JSON.stringify(hydrated));
  F('completed sets reload into the form', hydrated.some(v => v.w === '95' || v.r === '8' || v.r === '30'),
    JSON.stringify(hydrated));

  // add a second exercise's set
  const rowCount = await page.locator('.set-row').count();
  let filled = false;
  for (let i = 1; i < rowCount && !filled; i++) {
    const row = page.locator('.set-row').nth(i);
    if (await row.locator('.weight-input').count()) {
      await row.locator('.weight-input').fill('135');
      await row.locator('.reps-input').fill('6');
      filled = true;
    }
  }
  console.log('added a second set: ' + filled);
  await page.waitForTimeout(300);

  await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
  await page.locator('#complete-workout-btn').click();
  await page.waitForTimeout(2500);

  writes = await page.evaluate(() => window.__writes.slice());
  const allAdds = writes.filter(w => w.op === 'addDoc' && w.collection === 'workouts');
  const updates = writes.filter(w => w.op === 'updateDoc' && w.collection === 'workouts');
  console.log('\n--- workout writes overall ---');
  writes.filter(w => w.collection === 'workouts').forEach(w => console.log(`  ${w.op} ${w.id}`));

  F('second Complete UPDATES rather than duplicating', allAdds.length === 1 && updates.length >= 1,
    `adds=${allAdds.length} updates=${updates.length}`);

  const stored = await page.evaluate(() => (window.__seed.workouts || []).map(w => ({
    id: w.id, date: w.date, day: w.day,
    exercises: Object.values(w.exercises || {}).map(e => ({
      n: e.exercise, sets: (e.sets || []).filter(s => s.weight || s.reps || s.seconds || s.minutes).length
    })).filter(e => e.sets > 0)
  })));
  console.log('\n--- stored workout documents ---');
  console.log(JSON.stringify(stored, null, 2));
  F('exactly one session document exists for today', stored.length === 1, `docs=${stored.length}`);
  F('the single session contains both parts',
    stored.length === 1 && stored[0].exercises.length >= (filled ? 2 : 1),
    JSON.stringify(stored[0] && stored[0].exercises));

  const dialogs = await page.evaluate(() => window.__dialogs);
  console.log('\nnative dialogs seen: ' + JSON.stringify(dialogs));
  F('no duplicate-session confirm was needed', !dialogs.some(d => /duplicate|already/i.test(d.msg)),
    JSON.stringify(dialogs));

  console.log('\n--- page errors (' + errors.length + ') ---');
  errors.slice(0, 15).forEach(e => console.log(`  [${e.type}] ${e.message}`));
  console.log(`\nRESULT: ${fails} failed assertions`);
  await browser.close();
})();
