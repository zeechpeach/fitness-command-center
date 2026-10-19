// Journey: a session made only of holds and cardio must save.
const { boot, ok } = require('./harness/drive');
const { holdsAndCardioProgram } = require('./harness/seed');

// A strength movement with a cardio word in its name must not be logged in
// minutes: "Walking Lunge" is sets of reps, "Incline Treadmill Walk" is not.
function lungeProgram() {
  return {
    id: 'prog-lunge', name: 'Lunge Check', active: true,
    createdAt: '2026-06-01T08:00:00.000Z', activatedAt: '2026-06-01T08:00:00.000Z',
    schedule: { day1: { workoutType: 'Rest', customName: 'Rest' } },
    workouts: {
      'Mixed Walks': [
        { name: 'Walking Lunge', sets: 3, reps: '10-12' },
        { name: 'Lateral Walk', sets: 2, reps: '12-15' },
        { name: 'Incline Treadmill Walk', sets: 1, reps: '20 min', trackingType: 'duration' }
      ],
      'Rest': []
    },
    exerciseVariations: {}
  };
}

(async () => {
  const { browser, page, errors } = await boot({
    seed: { programs: [holdsAndCardioProgram()], workouts: [] }
  });
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // Holds Day is unscheduled, so it renders as a pill - tap it.
  await page.locator('.day-btn[data-substitute="Holds Day"]').click();
  await page.waitForTimeout(600);

  const rendered = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.exercise-card, .workout-exercise, [class*="exercise-card"]')];
    return {
      cardCount: cards.length,
      units: [...document.querySelectorAll('.set-unit')].map(u => u.textContent.trim()),
      weightInputs: document.querySelectorAll('.weight-input').length,
      repsInputs: document.querySelectorAll('.reps-input').length,
      setRows: document.querySelectorAll('.set-row').length
    };
  });
  console.log('rendered logger: ' + JSON.stringify(rendered));
  F('holds/cardio day renders set rows', rendered.setRows > 0, JSON.stringify(rendered));
  F('no weight boxes on a holds/cardio day', rendered.weightInputs === 0, `weightInputs=${rendered.weightInputs}`);
  F('units are sec/min, not lbs',
    rendered.units.length > 0 && rendered.units.every(u => u === 'sec' || u === 'min'),
    JSON.stringify(rendered.units));

  // Type into every set row: seconds for the holds, minutes for the walk.
  const rows = await page.locator('.set-row').count();
  for (let i = 0; i < rows; i++) {
    const row = page.locator('.set-row').nth(i);
    const input = row.locator('.reps-input').first();
    const unit = (await row.locator('.set-unit').first().textContent()).trim();
    await input.fill(unit === 'min' ? '22' : '30');
  }
  await page.waitForTimeout(400);

  // Does the app consider this session to have data?
  const hasData = await page.evaluate(() =>
    typeof window.currentWorkoutHasData === 'function' ? window.currentWorkoutHasData() : 'not exposed');
  console.log('currentWorkoutHasData(): ' + hasData);

  // Complete the session.
  const before = await page.evaluate(() => window.__writes.length);
  await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded(); await page.locator('#complete-workout-btn').click();
  await page.waitForTimeout(2500);

  const writes = await page.evaluate(() => window.__writes.slice());
  const newWrites = writes.slice(before);
  console.log('\n--- writes on Complete ---');
  newWrites.forEach(w => console.log(`  ${w.op} ${w.collection} ${w.id || ''}`));

  const workoutAdds = newWrites.filter(w => w.op === 'addDoc' && w.collection === 'workouts');
  F('holds+cardio session saved', workoutAdds.length === 1, `workout addDoc count=${workoutAdds.length}`);

  if (workoutAdds.length) {
    const doc = workoutAdds[0].data;
    console.log('\n--- saved document ---');
    console.log(JSON.stringify({ day: doc.day, date: doc.date, exercises: doc.exercises }, null, 2).slice(0, 1400));
    const ex = Object.values(doc.exercises || {});
    const secSets = ex.flatMap(e => (e.sets || []).filter(s => s.seconds));
    const minSets = ex.flatMap(e => (e.sets || []).filter(s => s.minutes));
    F('seconds values persisted', secSets.length >= 5, `secondsSets=${secSets.length}`);
    F('minutes values persisted', minSets.length >= 1, `minutesSets=${minSets.length}`);
    F('tracking types persisted on the row',
      ex.every(e => ['time', 'duration'].includes(e.trackingType)),
      JSON.stringify(ex.map(e => ({ n: e.name, t: e.trackingType }))));
  }

  // Draft must not have been destroyed on the way through.
  const draft = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('fcc:draft')) out[k] = localStorage.getItem(k).slice(0, 200);
    }
    return out;
  });
  console.log('\ndraft keys after complete: ' + JSON.stringify(Object.keys(draft)));

  const dialogs = await page.evaluate(() => window.__dialogs);
  console.log('native dialogs during this journey: ' + JSON.stringify(dialogs));

  console.log('\n--- page errors (' + errors.length + ') ---');
  errors.slice(0, 15).forEach(e => console.log(`  [${e.type}] ${e.message}`));
  await browser.close();

  // ---------- Walking Lunge is reps, not minutes ----------
  {
    const s2 = await boot({ seed: { programs: [lungeProgram()], workouts: [] } });
    await s2.page.locator('.day-btn[data-substitute="Mixed Walks"]').click();
    await s2.page.waitForTimeout(800);
    const types = await s2.page.evaluate(() => {
      const cards = [...document.querySelectorAll('.exercise-card')];
      return cards.map(c => ({
        name: c.querySelector('.exercise-name')?.innerText.trim(),
        weightInputs: c.querySelectorAll('.weight-input').length,
        units: [...c.querySelectorAll('.set-unit')].map(u => u.textContent.trim())
      }));
    });
    console.log('\nwalk-named movements: ' + JSON.stringify(types));
    const lunge = types.find(t => /Walking Lunge/.test(t.name || ''));
    const lateral = types.find(t => /Lateral Walk/.test(t.name || ''));
    const treadmill = types.find(t => /Treadmill/.test(t.name || ''));
    F('Walking Lunge logs weight and reps, not minutes',
      lunge && lunge.weightInputs > 0 && !lunge.units.includes('min'), JSON.stringify(lunge));
    F('Lateral Walk logs reps, not minutes',
      lateral && !lateral.units.includes('min'), JSON.stringify(lateral));
    F('a real treadmill walk still logs minutes',
      treadmill && treadmill.units.includes('min'), JSON.stringify(treadmill));
    await s2.browser.close();
  }

  console.log(`\nRESULT: ${fails} failed assertions`);
})();
