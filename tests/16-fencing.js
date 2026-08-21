// Journey: fifteen hours a week of coaching is training. Log it in two taps,
// and have it change what the generator suggests and what the week says.
const { boot, ok, dayStr, tap, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function fencing(id, dayOffset, kind, hours) {
  return { id, date: dayStr(dayOffset), kind, hours, createdAt: dayStr(dayOffset) + 'T21:00:00.000Z' };
}

function sundayOffset() { return -new Date().getDay(); }

const suggest = (page, minutes) => page.evaluate(m => {
  window.suggestSessionFor(m);
  window.suggestPlaceFor('full');   // the location step; tests default to everything available
  const el = document.getElementById('today-panel');
  return {
    text: el.innerText.replace(/\s+/g, ' ').trim(),
    name: el.querySelector('.today-plan-name')?.innerText || null,
    exercises: [...el.querySelectorAll('.today-plan-list li')].map(li => ({
      name: li.querySelector('.today-ex').innerText.trim(),
      meta: li.querySelector('.today-ex-meta').innerText.trim()
    })),
    fatigue: el.querySelector('.today-fatigue')?.innerText.trim() || null,
    isRest: !!el.querySelector('.today-rest')
  };
}, minutes);

const setsIn = s => s.exercises.reduce((sum, e) => sum + parseInt(e.meta), 0);

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };
  const sun = sundayOffset();

  // ---------- 1. Logging it takes two taps and writes one row ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [], fencing: [] }
    });
    await page.waitForTimeout(600);

    const initial = await page.evaluate(() => {
      const el = document.getElementById('fencing-panel');
      return {
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        kinds: [...el.querySelectorAll('.fencing-kind')].map(b => b.innerText.trim()),
        hoursShown: el.querySelectorAll('.fencing-hour').length
      };
    });
    console.log('fencing panel: ' + JSON.stringify(initial));
    F('the panel offers the three kinds of fencing day',
      initial.kinds.join(',') === 'Coaching,Training / lesson,Tournament', JSON.stringify(initial.kinds));
    F('hours stay hidden until a kind is picked', initial.hoursShown === 0, String(initial.hoursShown));
    F('it shows the week total', /this week/i.test(initial.text), initial.text.slice(0, 80));

    // Tap 1: the kind. Tap 2: the hours. Nothing else.
    await tap(page, '.fencing-kind[data-kind="Coaching"]');
    await page.waitForTimeout(200);
    const hours = await page.evaluate(() =>
      [...document.querySelectorAll('.fencing-hour')].map(b => b.innerText.trim()));
    console.log('hour chips: ' + JSON.stringify(hours));
    F('picking a kind reveals hour chips', hours.length > 0, JSON.stringify(hours));
    F('no keyboard is needed - every real answer is a chip',
      hours.includes('3h') && hours.includes('12h'), JSON.stringify(hours));

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.fencing-hour')].find(b => b.innerText.trim() === '3h');
      btn.click();
    });
    await page.waitForTimeout(800);

    const write = await page.evaluate(() =>
      (window.__writes || []).filter(w => w.collection === 'fencing'));
    console.log('writes: ' + JSON.stringify(write));
    F('two taps write exactly one fencing row', write.length === 1, JSON.stringify(write.length));
    F('it records hours and kind', write[0] && write[0].data.hours === 3 && write[0].data.kind === 'Coaching',
      JSON.stringify(write[0] && write[0].data));
    F('it is dated today', write[0] && write[0].data.date === dayStr(0),
      JSON.stringify(write[0] && write[0].data.date));

    const after = await page.evaluate(() =>
      document.getElementById('fencing-panel').innerText.replace(/\s+/g, ' ').trim());
    console.log('after logging: ' + after.slice(0, 120));
    F('the entry shows immediately', /3h Coaching/i.test(after), after.slice(0, 120));
    F('the week total updates', /3h this week/i.test(after), after.slice(0, 120));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. A coaching night pushes the next day toward upper body ----------
  {
    const { browser, page } = await boot({
      seed: {
        programs: [realProgram()], workouts: [],
        // Three hours on the strip last night: legs are loaded, the pull and
        // press muscles are untouched.
        fencing: [fencing('f1', -1, 'Training', 4)]
      }
    });
    await page.waitForTimeout(700);
    const s = await suggest(page, 45);
    const names = s.exercises.map(e => e.name);
    console.log('\nafter 4h fencing last night, 45 min -> ' + JSON.stringify(names));

    const legWork = names.filter(n => /Leg Press|Leg Curl|Squat|Calf|Hip Thrust|Lunge/i.test(n));
    F('it does not lead with legs the morning after fencing',
      !/Quads|Calves/i.test((s.name || '').split(' - ')[0]), JSON.stringify(s.name));
    F('legs are not the bulk of the session', legWork.length <= 1, JSON.stringify(legWork));
    F('it still suggests something to do', s.exercises.length > 0, String(s.exercises.length));
    await browser.close();
  }

  // ---------- 3. A tournament day shrinks the session, and says why ----------
  {
    const { browser, page } = await boot({
      seed: {
        programs: [realProgram()], workouts: [],
        fencing: [fencing('f2', 0, 'Tournament', 12)]
      }
    });
    await page.waitForTimeout(700);
    const s = await suggest(page, 60);
    console.log('\ntwelve-hour tournament today, asked for 60 min -> rest=' + s.isRest +
      ' sets=' + (s.isRest ? 0 : setsIn(s)));
    console.log('fatigue note: ' + s.fatigue);

    if (!s.isRest) {
      F('an hour on a tournament day is cut down', setsIn(s) <= 12, String(setsIn(s)));
      F('it says why it was cut', /trimmed/i.test(s.fatigue || ''), JSON.stringify(s.fatigue));
    } else {
      F('rest on a tournament day names fencing as the reason',
        /fencing/i.test(s.text), s.text.slice(0, 160));
    }
    await browser.close();
  }

  // ---------- 4. Fencing quiets the leg bars but can never fill them ----------
  {
    const { browser, page } = await boot({
      seed: {
        programs: [realProgram()], workouts: [],
        // Three coaching nights and a tournament: far more than any leg target.
        fencing: [
          fencing('a', sun, 'Coaching', 3), fencing('b', sun + 1, 'Coaching', 3),
          fencing('c', sun + 2, 'Coaching', 3), fencing('d', sun + 3, 'Tournament', 12)
        ]
      }
    });
    await page.waitForTimeout(700);

    const week = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#weekly-volume-panel .week-row')].map(r => ({
        group: r.querySelector('.week-row-name').innerText.trim(),
        count: r.querySelector('.week-row-count').innerText.replace(/\s+/g, ' ').trim(),
        fenced: !!r.querySelector('.week-row-fenced')
      }));
      return {
        rows,
        note: document.querySelector('.week-fencing-note')?.innerText.replace(/\s+/g, ' ').trim() || null
      };
    });
    console.log('\nweek rows: ' + JSON.stringify(week.rows.filter(r => r.fenced)));
    console.log('note: ' + week.note);

    const quads = week.rows.find(r => r.group === 'Quads');
    const chest = week.rows.find(r => r.group === 'Chest');
    F('legs show a fencing segment', quads && quads.fenced === true, JSON.stringify(quads));
    F('chest does not - fencing is not a press', chest && chest.fenced === false, JSON.stringify(chest));
    F('the credit is labelled, not silent', /capped at half/i.test(week.note || ''), JSON.stringify(week.note));
    F('fencing credit never fills a bar', quads && !/^7\/7|^[7-9]\+/.test(quads.count),
      JSON.stringify(quads && quads.count));

    // Even buried in fencing, direct leg work is still owed.
    const stillOwed = await page.evaluate(() => {
      const el = document.getElementById('today-panel');
      window.suggestSessionFor(60);
      window.suggestPlaceFor('full');
      return {
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        names: [...el.querySelectorAll('.today-ex')].map(n => n.innerText.trim())
      };
    });
    console.log('still suggests: ' + JSON.stringify(stillOwed.names));
    F('a week of fencing does not mark the week complete',
      !/Week complete/i.test(stillOwed.text), stillOwed.text.slice(0, 120));
    await browser.close();
  }

  // ---------- 5. It survives a reload, and can be removed ----------
  {
    const { browser, page, errors } = await boot({
      seed: {
        programs: [realProgram()], workouts: [],
        fencing: [fencing('keep', 0, 'Coaching', 3)]
      }
    });
    await page.waitForTimeout(700);

    const before = await page.evaluate(() =>
      document.getElementById('fencing-panel').innerText.replace(/\s+/g, ' ').trim());
    F('a stored entry shows on load', /3h Coaching/i.test(before), before.slice(0, 100));

    await tap(page, '.fencing-remove');
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({
      text: document.getElementById('fencing-panel').innerText.replace(/\s+/g, ' ').trim(),
      deletes: (window.__writes || []).filter(w => w.op === 'deleteDoc' && w.collection === 'fencing').length
    }));
    console.log('\nafter remove: ' + JSON.stringify(after));
    F('removing it deletes the row', after.deletes === 1, String(after.deletes));
    F('the panel drops it', !/3h Coaching/i.test(after.text), after.text.slice(0, 100));
    F('the week total goes back to zero', /0h this week/i.test(after.text), after.text.slice(0, 100));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
