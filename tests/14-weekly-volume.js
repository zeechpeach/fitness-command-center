// Journey: the Workout tab leads with what the week still owes.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

// A session that logs `sets` hard sets of one named exercise.
function session(id, date, day, exercise, sets) {
  return {
    id, date, day, programId: 'prog-real', timestamp: date + 'T10:00:00.000Z',
    exercises: {
      0: {
        exercise, trackingType: 'weight_reps',
        sets: Array.from({ length: sets }, () => ({ weight: '100', reps: '8' }))
      }
    }
  };
}

// Monday of the current week, so the seeded sessions always land inside it.
function sundayOffset() {
  const d = new Date();
  return -d.getDay();   // the week starts on SUNDAY - anchoring on Monday put
                        // "this week's" seeds into last week every Sunday
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const sun = sundayOffset();
  const { browser, page, errors } = await boot({
    seed: {
      programs: [realProgram()],
      workouts: [
        // 6 chest sets and 9 back sets already done this week.
        session('w1', dayStr(sun), 'Upper A', 'Incline Dumbbell Press', 6),
        session('w2', dayStr(sun), 'Upper A', 'Barbell Row', 9),
        // Last week's work must NOT count toward this week.
        session('w0', dayStr(sun - 3), 'Lower A', 'Back Squat', 12)
      ]
    }
  });
  await page.waitForTimeout(600);

  const panel = await page.evaluate(() => {
    const el = document.getElementById('weekly-volume-panel');
    if (!el) return { found: false };
    const rows = [...el.querySelectorAll('.week-row')].map(r => ({
      group: r.querySelector('.week-row-name').innerText.trim(),
      count: r.querySelector('.week-row-count').innerText.replace(/\s+/g, ''),
      state: r.className.replace('week-row', '').trim()
    }));
    return {
      found: true,
      visible: el.getBoundingClientRect().height > 20,
      score: el.querySelector('.week-score')?.innerText.trim(),
      sub: el.querySelector('.week-sub')?.innerText.replace(/\s+/g, ' ').trim(),
      rows
    };
  });

  console.log('week panel: ' + JSON.stringify(panel, null, 1));
  F('the week panel renders on the Workout tab', panel.found && panel.visible, JSON.stringify(panel.found));
  F('it shows a percentage', /^\d+%$/.test(panel.score || ''), JSON.stringify(panel.score));
  F('it says how many days are left', /left this week|Last day/.test(panel.sub || ''), JSON.stringify(panel.sub));

  const chest = panel.rows.find(r => r.group === 'Chest');
  const back = panel.rows.find(r => r.group === 'Back');
  const quads = panel.rows.find(r => r.group === 'Quads');

  // Fractional credit: 6 incline presses = chest 6 + shoulders 3 + triceps 3;
  // 9 rows = back 9 + biceps 4.5.
  F('chest counts this week only', chest && chest.count === '6/16', JSON.stringify(chest));
  F('back counts this week only', back && back.count === '9/16', JSON.stringify(back));
  const biceps = panel.rows.find(r => r.group === 'Biceps');
  const shoulders = panel.rows.find(r => r.group === 'Shoulders');
  F('rows credit biceps half a set each', biceps && biceps.count === '4.5/12', JSON.stringify(biceps));
  F('presses credit shoulders half a set each', shoulders && shoulders.count === '3/16', JSON.stringify(shoulders));
  F('last week does NOT leak into this week', quads && quads.count === '0/7', JSON.stringify(quads));

  // The least-touched groups should lead the list; back, the most trained, sits low.
  console.log('order: ' + JSON.stringify(panel.rows.map(r => r.group)));
  const orderIdx = (g) => panel.rows.findIndex(r => r.group === g);
  F('the most-owed group leads the list', panel.rows[0].group === 'Shoulders',
    JSON.stringify(panel.rows.map(r => r.group)));
  F('the most trained group sinks below less-trained ones',
    orderIdx('Back') > orderIdx('Chest') && orderIdx('Back') > orderIdx('Triceps'),
    JSON.stringify(panel.rows.map(r => r.group)));

  // Score should reflect credited sets, capped per group.
  const expected = await page.evaluate(() => {
    const el = document.getElementById('weekly-volume-panel');
    return el.querySelector('.week-sub').innerText;
  });
  console.log('summary line: ' + expected);
  F('the summary counts fractional sets done', /25.5 of \d+ sets/.test(expected), expected);

  await browser.close();

  // Overshooting one group must not mask another: 30 chest sets, nothing else.
  const s2 = await boot({
    seed: {
      programs: [realProgram()],
      workouts: [session('w9', dayStr(sun), 'Upper B', 'Cable Fly', 30)]
    }
  });
  await s2.page.waitForTimeout(600);
  const after = await s2.page.evaluate(() => {
    const el = document.getElementById('weekly-volume-panel');
    const row = (name) => [...el.querySelectorAll('.week-row')]
      .find(r => r.querySelector('.week-row-name').innerText.trim() === name)
      ?.querySelector('.week-row-count').innerText.replace(/\s+/g, '');
    return { score: el.querySelector('.week-score').innerText.trim(), chest: row('Chest'), back: row('Back') };
  });
  console.log('after 30 chest sets and nothing else: ' + JSON.stringify(after));
  F('the overshoot is shown honestly', after.chest === '30/16', JSON.stringify(after.chest));
  F('but credit is capped, so untouched groups still drag the score',
    parseInt(after.score) < 20, JSON.stringify(after.score));
  F('untouched groups read zero', after.back === '0/16', JSON.stringify(after.back));
  await s2.browser.close();

  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
  finish(fails);
})();
