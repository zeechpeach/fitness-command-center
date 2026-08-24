// Journey: a logged session can never vanish. Workouts used to be filtered by
// programId against the "active" program - and with two documents marked
// active, which one won could change between loads, hiding real history.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function session(id, dayOffset, day, programId, exercise, sets) {
  return {
    id, date: dayStr(dayOffset), day, programId,
    timestamp: dayStr(dayOffset) + 'T10:00:00.000Z',
    exercises: {
      0: { exercise, trackingType: 'weight_reps',
           sets: Array.from({ length: sets }, () => ({ weight: '100', reps: '8' })) }
    }
  };
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Sessions count whatever programId stamped them ----------
  {
    const { browser, page, errors } = await boot({
      seed: {
        programs: [realProgram()],
        workouts: [
          session('match', 0, 'Upper A', 'prog-real', 'Incline Dumbbell Press', 4),
          session('stale', 0, 'Chest & Back - 30 min', 'prog-OLD-id', 'Barbell Row', 5),
          session('none', 0, 'Tournament Circuit', null, 'Hammer Curl', 3)
        ]
      }
    });
    await page.waitForTimeout(800);

    const week = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#weekly-volume-panel .week-row')].map(r => ({
        group: r.querySelector('.week-row-name').innerText.trim(),
        count: r.querySelector('.week-row-count').innerText.replace(/\s+/g, ' ').trim()
      }));
      return rows.filter(r => /Chest|Back|Biceps/.test(r.group));
    });
    console.log('week rows: ' + JSON.stringify(week));
    const chest = week.find(r => r.group === 'Chest');
    const back = week.find(r => r.group === 'Back');
    const biceps = week.find(r => r.group === 'Biceps');
    F('a session with the matching programId counts', chest && /^4\//.test(chest.count), JSON.stringify(chest));
    F('a session stamped by another program STILL counts', back && /^5\//.test(back.count), JSON.stringify(back));
    // 3 direct curl sets plus half-credit from the other program's 5 rows.
    F('a session with no programId counts', biceps && /^5.5\//.test(biceps.count), JSON.stringify(biceps));

    // and all three appear on the calendar
    await page.evaluate(() => document.getElementById('calendar-tab-btn')?.click());
    await page.waitForTimeout(1200);
    const calText = await page.evaluate(() =>
      [...document.querySelectorAll('.calendar-day.has-workout')]
        .map(c => c.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
    console.log('calendar: ' + calText);
    // All three sessions share today's date and the calendar shows one label
    // per day, so the assertion is simply that the day is painted at all.
    F('the day is painted on the calendar', /Upper A/.test(calText), calText);
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Two programs marked active: deterministic pick, repair write ----------
  {
    const older = realProgram({ id: 'prog-old', name: 'Old Program', activatedAt: '2026-05-01T08:00:00.000Z' });
    const newer = realProgram();   // prog-real, activated 2026-06-01
    const { browser, page, errors } = await boot({
      seed: { programs: [older, newer], workouts: [
        session('w1', 0, 'Upper A', 'prog-old', 'Incline Dumbbell Press', 4)
      ] }
    });
    await page.waitForTimeout(800);

    const state = await page.evaluate(() => ({
      repairs: (window.__writes || []).filter(w =>
        w.op === 'updateDoc' && w.collection === 'programs' && w.data && w.data.active === false)
        .map(w => w.id),
      chest: [...document.querySelectorAll('#weekly-volume-panel .week-row')]
        .map(r => r.innerText.replace(/\s+/g, ' ').trim())
        .find(t => /Chest/.test(t)) || null
    }));
    console.log('duplicate-active state: ' + JSON.stringify(state));
    F('the older duplicate active program is repaired to inactive',
      state.repairs.includes('prog-old'), JSON.stringify(state.repairs));
    F('the session stamped by the older program still counts',
      /4\/9|4 \/ 9|Chest 4/.test(state.chest || ''), JSON.stringify(state.chest));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
