// Journey: logging anything, any way, updates EVERY panel immediately - no
// stale "2/6" after a Cindy score, no streak that waits for a reload, and no
// "enter at least one set first" when today's training is already saved.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

const adaptive = () => realProgram({ plan: { mode: 'adaptive', weeklySessions: 6 } });

function session(id, dayOffset, day, exercise, sets) {
  const date = dayStr(dayOffset);
  return {
    id, date, day, programId: 'prog-real', timestamp: date + 'T10:00:00.000Z',
    exercises: {
      0: { exercise, trackingType: 'weight_reps',
           sets: Array.from({ length: sets }, () => ({ weight: '60', reps: '10' })) }
    }
  };
}

const showUp = (page) => page.evaluate(() => {
  const m = (document.getElementById('program-panel')?.innerText || '').match(/(\d+)\s*\/\s*(\d+)/);
  return m ? Number(m[1]) : null;
});

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. A Cindy score moves the show-up counter the moment it lands ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [adaptive()], workouts: [
        session('a', -1, 'gen a', 'Barbell Row', 8),
        session('b', -2, 'gen b', 'Goblet Squat', 8)
      ] }
    });
    await page.waitForTimeout(700);

    const before = await showUp(page);
    await page.evaluate(async () => { await window.logCindy(12); await new Promise(r => setTimeout(r, 400)); });
    const after = await showUp(page);
    console.log(`show-up counter: ${before} -> ${after}`);
    F('the show-up counter ticks immediately, no reload needed',
      before !== null && after === before + 1, `${before} -> ${after}`);

    const health = await page.evaluate(() =>
      document.getElementById('data-health')?.innerText.replace(/\s+/g, ' ') || '');
    F('Data health lists the Cindy save by name and rounds',
      /Cindy - 12 rounds/.test(health), health.slice(0, 300));
    F('Data health shows the live show-up count',
      /Show up this week/.test(health), health.slice(0, 300));

    // The empty logger form must not read as "your workout did not save".
    const toast = await page.evaluate(async () => {
      document.getElementById('complete-workout-btn').click();
      await new Promise(r => setTimeout(r, 400));
      return document.getElementById('app-toast')?.textContent || '';
    });
    console.log('empty-form complete says: ' + toast);
    F('Complete with an empty form names what IS saved instead of implying loss',
      /nothing is missing/i.test(toast) && /Cindy, 12 rounds/.test(toast), toast);

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Fencing hours move the streak and the calendar immediately ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [adaptive()], workouts: [] }
    });
    await page.waitForTimeout(700);

    const result = await page.evaluate(async () => {
      const streakBefore = document.getElementById('workout-streak')?.textContent;
      await window.logFencing('Coaching', 2);
      await new Promise(r => setTimeout(r, 400));
      return {
        streakBefore,
        streakAfter: document.getElementById('workout-streak')?.textContent,
        todayCell: [...document.querySelectorAll('.calendar-day.today')].map(d =>
          d.innerText.replace(/\s+/g, ' ')).join(''),
        health: document.getElementById('data-health')?.innerText.replace(/\s+/g, ' ') || ''
      };
    });
    console.log('after 2h coaching: ' + JSON.stringify(result));
    F('coaching hours extend the streak immediately',
      result.streakBefore === '0' && result.streakAfter === '1',
      `${result.streakBefore} -> ${result.streakAfter}`);
    F('the calendar paints today as active immediately',
      /Fencing/.test(result.todayCell), result.todayCell);
    F('Data health shows the activity', /2h coaching/.test(result.health), result.health.slice(0, 300));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 3. A rest day is not a "session" in the analytics stat ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [adaptive()], workouts: [
        session('t', -2, 'gen t', 'Barbell Row', 8),
        { id: 'r', date: dayStr(-1), day: 'Rest Day', restDay: true, exercises: {},
          programId: 'prog-real', timestamp: dayStr(-1) + 'T10:00:00.000Z' }
      ] }
    });
    await page.waitForTimeout(700);
    const stat = await page.evaluate(() =>
      document.getElementById('sessions-this-week')?.textContent);
    F('the sessions-this-week stat counts training, not logged rest',
      stat === '1', String(stat));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
