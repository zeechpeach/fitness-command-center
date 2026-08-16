// Journey: miss a scheduled session; it must be offered again the next day,
// not skipped. This is the queue behaviour, not a calendar rotation.
const { boot, ok } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function dayStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function offered(page) {
  return page.evaluate(() => {
    const sel = document.getElementById('workout-day-selector');
    const active = sel && sel.querySelector('.day-btn.active');
    const header = document.querySelector('#workout-content h2, #workout-content .workout-title, .current-workout-title');
    return {
      pill: active ? active.innerText.replace(/\s+/g, ' ').trim() : null,
      header: header ? header.innerText.replace(/\s+/g, ' ').trim() : null
    };
  });
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const prog = realProgram();
  prog.activatedAt = dayStr(-10) + 'T08:00:00.000Z';
  prog.createdAt = prog.activatedAt;

  // --- Baseline: nothing logged at all. Should offer day 1. ---
  {
    const { browser, page } = await boot({ seed: { programs: [prog], workouts: [] } });
    const o = await offered(page);
    console.log('\n[baseline] nothing ever logged -> ' + JSON.stringify(o));
    F('with nothing logged, day 1 is offered', /Upper A/.test(o.pill || ''), JSON.stringify(o));
    await browser.close();
  }

  // --- Logged Upper A three days ago, nothing since. ---
  const workoutsSeed = [{
    id: 'w1', date: dayStr(-3), day: 'Upper A', programId: 'prog-real',
    timestamp: dayStr(-3) + 'T10:00:00.000Z',
    exercises: { 0: { exercise: 'Incline Dumbbell Press', trackingType: 'weight_reps', sets: [{ weight: '95', reps: '8' }] } }
  }];

  {
    const { browser, page, errors } = await boot({ seed: { programs: [prog], workouts: workoutsSeed } });
    const o = await offered(page);
    console.log('[missed] Upper A done 3 days ago, nothing since -> ' + JSON.stringify(o));
    F('the missed next session is still offered today (not skipped)',
      /Lower A/.test(o.pill || ''), JSON.stringify(o));

    // The queue must not have run ahead by calendar days. Three days passed,
    // so a calendar rotation would be showing Upper B by now.
    F('the queue did NOT advance by calendar days',
      !/Upper B|Lower B|Skill/.test(o.pill || ''), JSON.stringify(o));

    // Forward days must progress, not freeze on one session.
    const forward = await page.evaluate(() => {
      // The calendar is the app's own forward projection.
      const btn = document.getElementById('calendar-tab-btn');
      if (btn) btn.click();
      return null;
    });
    await page.waitForTimeout(1200);
    const cal = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.calendar-day, .calendar-cell, [class*="calendar-day"]')];
      return cells.map(c => (c.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 45);
    });
    const labelled = cal.filter(t => /Upper|Lower|Skill|Walk|Restoration/.test(t));
    const distinctFuture = new Set(labelled.map(t => (t.match(/Upper A|Upper B|Lower A|Lower B|Skill and Arms|Walk|Restoration/) || [])[0]));
    console.log('calendar session labels seen: ' + JSON.stringify([...distinctFuture]));
    F('the forward schedule does not freeze on one session',
      distinctFuture.size >= 3, JSON.stringify([...distinctFuture]));

    console.log('page errors: ' + errors.length);
    errors.slice(0, 8).forEach(e => console.log('  ' + e.message));
    await browser.close();
  }

  // --- Now log Lower A today; tomorrow should move on to Restoration. ---
  {
    const seed2 = {
      programs: [prog],
      workouts: [...workoutsSeed, {
        id: 'w2', date: dayStr(0), day: 'Lower A', programId: 'prog-real',
        timestamp: dayStr(0) + 'T10:00:00.000Z',
        exercises: { 0: { exercise: 'Trap Bar Deadlift', trackingType: 'weight_reps', sets: [{ weight: '185', reps: '5' }] } }
      }]
    };
    const { browser, page } = await boot({ seed: seed2 });
    const o = await offered(page);
    console.log('\n[after logging] Lower A logged today -> ' + JSON.stringify(o));
    F('after logging, the logger stays on the session just logged (so it can be added to)',
      /Lower A/.test(o.pill || ''), JSON.stringify(o));
    await browser.close();
  }

  // --- A session logged out of order should resume the cycle after it. ---
  {
    const seed3 = {
      programs: [prog],
      workouts: [{
        id: 'w3', date: dayStr(-1), day: 'Skill and Arms', programId: 'prog-real',
        timestamp: dayStr(-1) + 'T10:00:00.000Z',
        exercises: { 0: { exercise: 'Barbell Curl', trackingType: 'weight_reps', sets: [{ weight: '45', reps: '10' }] } }
      }]
    };
    const { browser, page } = await boot({ seed: seed3 });
    const o = await offered(page);
    console.log('[out of order] Skill and Arms (day 6) logged yesterday -> ' + JSON.stringify(o));
    F('an out-of-order session resumes the cycle after it', /Walk/.test(o.pill || ''), JSON.stringify(o));
    await browser.close();
  }

  console.log(`\nRESULT: ${fails} failed assertions`);
})();
