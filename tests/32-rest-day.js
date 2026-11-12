// Journey: a planned rest day is a decision, not a lapse. It logs in two
// taps, shows on the calendar, keeps the streak alive and leaves the
// discipline score's denominator - while the weekly show-up counter and the
// training tallies ignore it completely.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

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

function restDoc(id, dayOffset) {
  const date = dayStr(dayOffset);
  return { id, date, day: 'Rest Day', restDay: true, exercises: {},
           programId: 'prog-real', timestamp: date + 'T10:00:00.000Z' };
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Two-tap log, the record, and the guards ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(700);

    const logged = await page.evaluate(async () => {
      await window.logRestDay();
      await new Promise(r => setTimeout(r, 400));
      return {
        writes: window.__writes.filter(x => x.collection === 'workouts'),
        activity: document.getElementById('fencing-panel').innerText.replace(/\s+/g, ' '),
        today: document.getElementById('today-panel').innerText.replace(/\s+/g, ' ')
      };
    });
    const doc = logged.writes.find(w => w.op === 'addDoc');
    console.log('rest write: ' + JSON.stringify(doc && { day: doc.data.day, restDay: doc.data.restDay }));
    F('logging rest writes a Rest Day document with no exercises',
      !!doc && doc.data.day === 'Rest Day' && doc.data.restDay === true
        && Object.keys(doc.data.exercises).length === 0,
      JSON.stringify(doc && doc.data));
    F('the activity panel shows it, removable', /Rest day logged/.test(logged.activity),
      logged.activity.slice(0, 160));
    F('the today panel records the decision',
      /Rest day logged\. The streak runs through it\./.test(logged.today), logged.today.slice(0, 200));
    F('rest is not treated as training - the panel still offers a session',
      /How long have you got today\?/.test(logged.today) && !/Logged today:/.test(logged.today),
      logged.today.slice(0, 220));

    const again = await page.evaluate(async () => {
      window.__writes.length = 0;
      await window.logRestDay();
      return window.__writes.filter(x => x.collection === 'workouts').length;
    });
    F('logging rest twice does not duplicate', again === 0, String(again));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. A trained day refuses a rest log ----------
  {
    const { browser, page } = await boot({
      seed: { programs: [realProgram()], workouts: [session('t', 0, 'gen t', 'Barbell Row', 8)] }
    });
    await page.waitForTimeout(700);
    const refused = await page.evaluate(async () => {
      window.__writes.length = 0;
      await window.logRestDay();
      return window.__writes.filter(x => x.collection === 'workouts').length;
    });
    F('a day already trained cannot also be logged as rest', refused === 0, String(refused));
    await browser.close();
  }

  // ---------- 3. The streak runs through rest; the score leaves it out ----------
  {
    // 29 straight days: training every day except four logged rest days.
    const workouts = [];
    const restOffsets = [-3, -10, -17, -24];
    for (let back = 1; back <= 29; back++) {
      if (restOffsets.includes(-back)) workouts.push(restDoc('r' + back, -back));
      else workouts.push(session('w' + back, -back, 'gen ' + back, 'Barbell Row', 8));
    }

    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts }
    });
    await page.waitForTimeout(900);

    const stats = await page.evaluate(() => ({
      streak: document.getElementById('workout-streak')?.textContent,
      adherence: document.getElementById('adherence-score')?.textContent,
      restCells: document.querySelectorAll('.calendar-day.restday').length
    }));
    console.log('month of 25 training days + 4 logged rests: ' + JSON.stringify(stats));
    F('the streak runs through all four rest days: 25, not 2',
      stats.streak === '25', String(stats.streak));
    F('declared rest leaves the denominator: discipline reads 100%',
      stats.adherence === '100%', String(stats.adherence));
    if (new Date().getDate() > 3) {
      F('the calendar shows rest days as a record', stats.restCells >= 1, String(stats.restCells));
    } else {
      F('the calendar shows rest days as a record (skipped: rest days fall in last month)', true, '');
    }

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 4. Removing a rest day cleans up completely ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(700);

    const removed = await page.evaluate(async () => {
      await window.logRestDay();
      await new Promise(r => setTimeout(r, 400));
      window.__writes.length = 0;
      await window.removeRestDay();
      await new Promise(r => setTimeout(r, 400));
      let backups = {};
      try { backups = JSON.parse(localStorage.getItem('fitnessData') || '{}'); } catch (e) { }
      return {
        deletes: window.__writes.filter(x => x.op === 'deleteDoc' && x.collection === 'workouts').length,
        staleBackups: Object.values(backups).filter(d => d && d.restDay === true).length,
        activity: document.getElementById('fencing-panel').innerText.replace(/\s+/g, ' ')
      };
    });
    console.log('after remove: ' + JSON.stringify(removed));
    F('removing deletes the document', removed.deletes === 1, String(removed.deletes));
    F('the local backup is purged too, so it cannot resurrect',
      removed.staleBackups === 0, String(removed.staleBackups));
    F('the panel no longer shows it', !/Rest day logged/.test(removed.activity),
      removed.activity.slice(0, 160));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
