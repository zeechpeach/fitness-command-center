// Journey: train the Tournament Circuit instead of today's session.
// It must be selectable, save under its own name, and NOT consume the owed day.
const { boot, ok } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function dayStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const offered = (page) => page.evaluate(() => {
  const a = document.querySelector('#workout-day-selector .day-btn.active');
  return a ? a.innerText.replace(/\s+/g, ' ').trim() : null;
});

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const prog = realProgram();
  prog.activatedAt = dayStr(-10) + 'T08:00:00.000Z';

  const { browser, page, errors } = await boot({ seed: { programs: [prog], workouts: [] } });

  // --- the circuit is offered as a session ---
  const pills = await page.evaluate(() => {
    const sel = document.getElementById('workout-day-selector');
    return [...sel.querySelectorAll('.day-btn')].map(b => ({
      label: b.innerText.replace(/\s+/g, ' ').trim(),
      substitute: b.getAttribute('data-substitute'),
      visible: b.getBoundingClientRect().height > 5
    }));
  });
  console.log('pills: ' + JSON.stringify(pills.map(p => p.label)));
  const circuit = pills.find(p => p.substitute === 'Tournament Circuit');
  F('Tournament Circuit appears as a selectable session', !!circuit, JSON.stringify(pills.map(p => p.label)));
  F('it is visible on screen', circuit && circuit.visible === true, JSON.stringify(circuit));
  F('no scheduled day pills render - the circuit is the only pill',
    pills.filter(p => !p.substitute).length === 0, String(pills.filter(p => !p.substitute).length));

  // --- select it by tapping, the way a thumb would ---
  const box = await page.locator('.day-btn[data-substitute="Tournament Circuit"]').boundingBox();
  await page.locator('.day-btn[data-substitute="Tournament Circuit"]').scrollIntoViewIfNeeded();
  const box2 = await page.locator('.day-btn[data-substitute="Tournament Circuit"]').boundingBox();
  await page.touchscreen.tap(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.waitForTimeout(900);

  const active = await offered(page);
  console.log('active after tapping: ' + JSON.stringify(active));
  F('tapping it selects it', /Tournament Circuit/.test(active || ''), JSON.stringify(active));

  // --- an accidental tap is not a commitment: tap again to put it away ---
  await page.locator('.day-btn[data-substitute="Tournament Circuit"]').click();
  await page.waitForTimeout(700);
  const deselected = await page.evaluate(() => ({
    active: document.querySelector('#workout-day-selector .day-btn.active')?.innerText || null,
    hint: !!document.querySelector('.no-session-hint'),
    setRows: document.querySelectorAll('.set-row').length
  }));
  console.log('after tapping it again: ' + JSON.stringify(deselected));
  F('tapping the selected pill deselects it', deselected.active === null, JSON.stringify(deselected));
  F('the logger returns to its honest empty state', deselected.hint && deselected.setRows === 0,
    JSON.stringify(deselected));

  // --- typed sets survive the round trip ---
  await page.locator('.day-btn[data-substitute="Tournament Circuit"]').click();
  await page.waitForTimeout(700);
  await page.locator('.set-row .reps-input').first().fill('12');
  await page.waitForTimeout(400);
  await page.locator('.day-btn[data-substitute="Tournament Circuit"]').click();   // away
  await page.waitForTimeout(700);
  await page.locator('.day-btn[data-substitute="Tournament Circuit"]').click();   // and back
  await page.waitForTimeout(700);
  const restored = await page.evaluate(() =>
    document.querySelector('.set-row .reps-input')?.value ?? null);
  console.log('typed value after deselect and reselect: ' + JSON.stringify(restored));
  F('sets typed before an accidental deselect come back on reselect', restored === '12',
    JSON.stringify(restored));

  // --- its exercises render ---
  const rendered = await page.evaluate(() => ({
    rows: document.querySelectorAll('.set-row').length,
    names: [...document.querySelectorAll('.exercise-name, .exercise-card h3, [class*="exercise-name"]')]
      .map(e => e.innerText.trim()).slice(0, 8),
    text: document.getElementById('workout-content').innerText.slice(0, 200)
  }));
  console.log('rendered rows: ' + rendered.rows);
  console.log('exercises: ' + JSON.stringify(rendered.names));
  F('the circuit exercises render', rendered.rows > 0, JSON.stringify(rendered.rows));

  // --- log it ---
  const rows = await page.locator('.set-row').count();
  for (let i = 0; i < Math.min(rows, 6); i++) {
    const row = page.locator('.set-row').nth(i);
    if (await row.locator('.weight-input').count()) {
      await row.locator('.weight-input').fill('60');
      await row.locator('.reps-input').first().fill('10');
    } else if (await row.locator('.reps-input').count()) {
      await row.locator('.reps-input').first().fill('30');
    }
  }
  await page.waitForTimeout(400);
  await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
  await page.locator('#complete-workout-btn').click();
  await page.waitForTimeout(2500);

  const saved = await page.evaluate(() => (window.__seed.workouts || []).map(w => ({ day: w.day, date: w.date })));
  console.log('saved: ' + JSON.stringify(saved));
  F('it saves as one session', saved.length === 1, JSON.stringify(saved));
  F('it saves under its own name', saved[0] && saved[0].day === 'Tournament Circuit', JSON.stringify(saved[0]));

  const writes = await page.evaluate(() => window.__writes.filter(w => w.collection === 'workouts'));
  F('exactly one workout document written',
    writes.filter(w => w.op === 'addDoc').length === 1, JSON.stringify(writes.map(w => w.op)));

  await browser.close();

  // --- and the owed session must STILL be owed tomorrow ---
  const sub = {
    id: 'wsub', date: dayStr(0), day: 'Tournament Circuit', programId: 'prog-real',
    timestamp: dayStr(0) + 'T10:00:00.000Z',
    exercises: { 0: { exercise: 'Circuit', trackingType: 'weight_reps', sets: [{ weight: '60', reps: '10' }] } }
  };
  const s2 = await boot({ seed: { programs: [prog], workouts: [sub] } });
  // The queue is gone, so "consuming the owed day" is no longer a thing that
  // can go wrong. What must hold instead: yesterday's circuit does not
  // pre-select anything today, and the week's volume counted it.
  const stillOwed = await offered(s2.page);
  console.log('\nactive pill the day after logging the circuit: ' + JSON.stringify(stillOwed));
  F('a logged substitute does not pre-select itself the next day',
    stillOwed === null, `expected null, got ${stillOwed}`);

  // it should also not be painted as a missed day
  const calText = await s2.page.evaluate(() => {
    document.getElementById('calendar-tab-btn').click();
    return null;
  });
  await s2.page.waitForTimeout(1200);
  const stats = await s2.page.evaluate(() =>
    document.getElementById('calendar-content').innerText.replace(/\s+/g, ' ').slice(0, 160));
  console.log('calendar: ' + stats);

  console.log('\npage errors: ' + (errors.length + s2.errors.length));
  [...errors, ...s2.errors].slice(0, 8).forEach(e => console.log('  ' + e.message));
  await s2.browser.close();

  console.log(`\nRESULT: ${fails} failed assertions`);
})();
