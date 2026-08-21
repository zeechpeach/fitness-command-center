// Journey: nothing is assigned. The scheduled day pills are gone by design -
// a queue that picked a day and marked it active was a daily assignment you
// could fail. The logger must open empty and honest, the suggestion panel is
// the way in, and the calendar's history view must still work.
//
// (This file replaces 07-missed-session.js: the queue no longer drives the
// logger, so "the missed session is offered again" is no longer a behaviour.)
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const prog = realProgram();
  prog.activatedAt = dayStr(-10) + 'T08:00:00.000Z';
  prog.createdAt = prog.activatedAt;

  // --- Boot with history: no pill is active, the logger is an honest blank ---
  {
    const workoutsSeed = [{
      id: 'w1', date: dayStr(-3), day: 'Upper A', programId: 'prog-real',
      timestamp: dayStr(-3) + 'T10:00:00.000Z',
      exercises: { 0: { exercise: 'Incline Dumbbell Press', trackingType: 'weight_reps', sets: [{ weight: '95', reps: '8' }] } }
    }];
    const { browser, page, errors } = await boot({ seed: { programs: [prog], workouts: workoutsSeed } });

    const state = await page.evaluate(() => {
      const sel = document.getElementById('workout-day-selector');
      const pills = [...sel.querySelectorAll('.day-btn')].map(b => b.innerText.replace(/\s+/g, ' ').trim());
      const active = sel.querySelector('.day-btn.active');
      const hint = document.querySelector('.no-session-hint');
      return {
        pills,
        active: active ? active.innerText.trim() : null,
        hint: hint ? hint.innerText.replace(/\s+/g, ' ').trim() : null,
        setRows: document.querySelectorAll('.set-row').length
      };
    });
    console.log('boot state: ' + JSON.stringify(state));
    F('no scheduled day pills render', !state.pills.some(l => /Upper|Lower|Restoration|Skill|Walk|^Day \d/.test(l)),
      JSON.stringify(state.pills));
    F('the Tournament Circuit is still offered', state.pills.includes('Tournament Circuit'),
      JSON.stringify(state.pills));
    F('nothing is pre-selected', state.active === null, JSON.stringify(state.active));
    F('the empty logger says what to do instead of erroring',
      !!state.hint && /panel above|saved session/i.test(state.hint), JSON.stringify(state.hint));
    F('no exercise form is loaded uninvited', state.setRows === 0, String(state.setRows));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // --- The calendar still knows history: logged days show, forward days vary ---
  {
    const workoutsSeed = [
      { id: 'w1', date: dayStr(-3), day: 'Upper A', programId: 'prog-real',
        timestamp: dayStr(-3) + 'T10:00:00.000Z',
        exercises: { 0: { exercise: 'Incline Dumbbell Press', trackingType: 'weight_reps', sets: [{ weight: '95', reps: '8' }] } } },
      { id: 'w2', date: dayStr(-1), day: 'Back & Quads - 30 min', programId: 'prog-real',
        timestamp: dayStr(-1) + 'T10:00:00.000Z',
        exercises: { 0: { exercise: 'Barbell Row', trackingType: 'weight_reps', sets: [{ weight: '135', reps: '8' }] } } }
    ];
    const { browser, page, errors } = await boot({ seed: { programs: [prog], workouts: workoutsSeed } });

    await page.evaluate(() => { const b = document.getElementById('calendar-tab-btn'); if (b) b.click(); });
    await page.waitForTimeout(1200);
    const cal = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.calendar-day, .calendar-cell, [class*="calendar-day"]')];
      return cells.map(c => (c.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 45);
    });
    const completed = cal.filter(t => /Upper A|Back & Quads/.test(t));
    console.log('calendar cells with logged sessions: ' + JSON.stringify(completed));
    F('logged sessions appear on the calendar, generated ones included',
      completed.length >= 2, JSON.stringify(completed));
    F('no page errors on the calendar', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
