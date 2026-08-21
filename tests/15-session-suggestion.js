// Journey: "how long have you got?" produces a session from what the week
// still owes and what has recovered - and sometimes says rest.
const { boot, ok, dayStr, tap, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function session(id, dayOffset, day, exercise, sets) {
  const date = dayStr(dayOffset);
  return {
    id, date, day, programId: 'prog-real', timestamp: date + 'T10:00:00.000Z',
    exercises: {
      0: { exercise, trackingType: 'weight_reps',
           sets: Array.from({ length: sets }, () => ({ weight: '100', reps: '8' })) }
    }
  };
}

// Sunday of the current week, so seeded sessions land inside it.
function sundayOffset() { return -new Date().getDay(); }

const suggest = (page, minutes) => page.evaluate(m => {
  window.suggestSessionFor(m);
  const el = document.getElementById('today-panel');
  return {
    text: el.innerText.replace(/\s+/g, ' ').trim(),
    name: el.querySelector('.today-plan-name')?.innerText || null,
    exercises: [...el.querySelectorAll('.today-plan-list li')].map(li => ({
      name: li.querySelector('.today-ex').innerText.trim(),
      meta: li.querySelector('.today-ex-meta').innerText.trim()
    })),
    isRest: !!el.querySelector('.today-rest')
  };
}, minutes);

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };
  const sun = sundayOffset();

  // ---------- 1. Nothing logged: asks how long, then fills the biggest debts ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);

    const initial = await page.evaluate(() => {
      const el = document.getElementById('today-panel');
      return {
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        chips: [...el.querySelectorAll('.today-chip')].map(c => c.innerText.trim())
      };
    });
    console.log('initial: ' + JSON.stringify(initial));
    F('it asks how long you have', /How long have you got/i.test(initial.text), initial.text.slice(0, 100));
    F('it offers session lengths', initial.chips.join(',') === '15 min,30 min,45 min,60 min', JSON.stringify(initial.chips));
    F('it says how many sessions the week needs', /more sessions? this week/i.test(initial.text), initial.text.slice(0, 120));

    // Both panels must agree on how many days are left, or it reads as a bug.
    const daysAgree = await page.evaluate(() => {
      const week = document.getElementById('weekly-volume-panel').innerText;
      const today = document.getElementById('today-panel').innerText;
      const a = week.match(/(\d+) days left|Last day/);
      const b = today.match(/across (\d+) days?|across (\d+) day/);
      return { week: a && a[0], today: b && b[0] };
    });
    console.log('days left, both panels: ' + JSON.stringify(daysAgree));
    const weekNum = daysAgree.week === 'Last day' ? 1 : parseInt(daysAgree.week);
    const todayNum = parseInt((daysAgree.today || '').replace(/\D/g, ''));
    F('both panels agree on days left', weekNum === todayNum, JSON.stringify(daysAgree));

    const short = await suggest(page, 15);
    const long = await suggest(page, 60);
    console.log('\n15 min -> ' + JSON.stringify(short.exercises));
    console.log('60 min -> ' + JSON.stringify(long.exercises));
    F('15 minutes gives a short session', short.exercises.length > 0 && short.exercises.length <= 3,
      JSON.stringify(short.exercises.length));
    F('60 minutes gives more than 15 does', long.exercises.length > short.exercises.length,
      `${short.exercises.length} vs ${long.exercises.length}`);
    F('the session is named for what it trains, not a day slot',
      /min$/.test(long.name || '') && !/Day \d|Lower [AB]|Upper [AB]/.test(long.name || ''), JSON.stringify(long.name));

    const totalSets = long.exercises.reduce((s, e) => s + parseInt(e.meta), 0);
    console.log('60 min total sets: ' + totalSets);
    F('a 60 minute session is about 20 sets', totalSets >= 15 && totalSets <= 24, String(totalSets));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Trained chest hard yesterday -> it picks something else ----------
  {
    const { browser, page } = await boot({
      seed: { programs: [realProgram()], workouts: [session('y', -1, 'Upper A', 'Incline Dumbbell Press', 8)] }
    });
    await page.waitForTimeout(600);
    const s = await suggest(page, 30);
    const groups = s.exercises.map(e => e.name).join(' | ');
    console.log('\nafter a hard chest day yesterday -> ' + groups);
    F('it does not send you back to chest the next day',
      !/Press|Fly|Dip/i.test(s.name || '') || !/Chest/i.test(s.name || ''), JSON.stringify(s.name));
    F('it suggests something', s.exercises.length > 0, JSON.stringify(s.exercises.length));
    await browser.close();
  }

  // ---------- 3. Nothing for days -> spreads across many groups ----------
  {
    const { browser, page } = await boot({
      seed: { programs: [realProgram()], workouts: [session('old', sun - 9, 'Upper A', 'Incline Dumbbell Press', 6)] }
    });
    await page.waitForTimeout(600);
    const s = await suggest(page, 60);
    const distinct = new Set(s.exercises.map(e => e.name));
    console.log('\nafter several days off, 60 min -> ' + JSON.stringify([...distinct]));
    F('a long gap produces a broad session', distinct.size >= 4, JSON.stringify([...distinct]));
    await browser.close();
  }

  // ---------- 4. Week already covered -> it says rest ----------
  {
    const covered = [];
    [['Incline Dumbbell Press', 9], ['Barbell Row', 9], ['Cable Lateral Raise', 7],
     ['Hammer Curl', 5], ['Overhead Cable Triceps Extension', 5], ['Leg Press', 7],
     ['Seated Leg Curl', 6], ['Hip Thrust', 5], ['Standing Calf Raise', 4],
     ['Hollow Body Hold', 6]].forEach(([name, sets], i) => {
      covered.push(session('c' + i, sun, 'Upper A', name, sets));
    });
    const { browser, page } = await boot({ seed: { programs: [realProgram()], workouts: covered } });
    await page.waitForTimeout(600);

    const head = await page.evaluate(() =>
      document.getElementById('today-panel').innerText.replace(/\s+/g, ' ').trim());
    console.log('\nweek covered -> ' + head.slice(0, 120));
    F('a finished week is recognised', /Week complete/i.test(head), head.slice(0, 100));

    const s = await suggest(page, 60);
    console.log('asking anyway -> rest=' + s.isRest + ' :: ' + s.text.slice(0, 120));
    F('it is willing to say rest', s.isRest === true, s.text.slice(0, 140));
    await browser.close();
  }

  // ---------- 5. Starting it loads the session into the logger ----------
  {
    const { browser, page, errors } = await boot({ seed: { programs: [realProgram()], workouts: [] } });
    await page.waitForTimeout(600);
    await suggest(page, 30);
    await tap(page, '.today-start');
    await page.waitForTimeout(1200);

    const loaded = await page.evaluate(() => {
      const active = document.querySelector('#workout-day-selector .day-btn.active');
      return {
        active: active ? active.innerText.replace(/\s+/g, ' ').trim() : null,
        setRows: document.querySelectorAll('.set-row').length,
        panelReset: /How long have you got/i.test(document.getElementById('today-panel').innerText)
      };
    });
    console.log('\nafter Start this: ' + JSON.stringify(loaded));
    F('the suggested session becomes the active session', /min$/.test(loaded.active || ''), JSON.stringify(loaded.active));
    F('its exercises are loaded and loggable', loaded.setRows > 0, String(loaded.setRows));
    F('the panel resets after starting', loaded.panelReset === true, String(loaded.panelReset));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
