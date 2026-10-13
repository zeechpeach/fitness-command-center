// Journey: the 8-week recomp program - install in one tap, follow by the
// week-phase panel, log cardio in the activity logger.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Install: one tap replaces the active program ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.__confirmAnswer = true; window.installRecompProgram(); });
    await page.waitForTimeout(1500);

    const state = await page.evaluate(() => ({
      writes: (window.__writes || []).filter(w => w.collection === 'programs').map(w => w.op),
      deactivated: (window.__writes || []).some(w =>
        w.op === 'updateDoc' && w.collection === 'programs' && w.data && w.data.active === false),
      panel: document.getElementById('program-panel').innerText.replace(/\s+/g, ' ').trim(),
      pills: [...document.querySelectorAll('#workout-day-selector .day-btn')]
        .map(b => b.innerText.replace(/\s+/g, ' ').trim()),
      shoulderBar: [...document.querySelectorAll('#weekly-volume-panel .week-row')]
        .map(r => r.innerText.replace(/\s+/g, ' ').trim()).find(t => /Shoulders/.test(t)) || null,
      quadBar: [...document.querySelectorAll('#weekly-volume-panel .week-row')]
        .map(r => r.innerText.replace(/\s+/g, ' ').trim()).find(t => /Quads/.test(t)) || null
    }));
    console.log('panel: ' + state.panel.slice(0, 160));
    console.log('pills: ' + JSON.stringify(state.pills));
    F('the old program is deactivated, the new one saved',
      state.deactivated && state.writes.includes('addDoc'), JSON.stringify(state.writes));
    F('the plan panel shows week 1 and the base prescription',
      /Week 1 of 8/.test(state.panel) && /3 reps in reserve/i.test(state.panel), state.panel.slice(0, 140));
    F('week 1 is a test week', /TEST WEEK/i.test(state.panel), state.panel.slice(0, 160));
    F('all four slots plus the test day are listed',
      /Shoulders · Abs · Biceps \(A\)/.test(state.panel) && /Chest · Back/.test(state.panel)
      && /Legs \(Short\)/.test(state.panel) && /Test Day/.test(state.panel), state.panel),
    F('every session and its home twin render as pills',
      state.pills.length >= 9, JSON.stringify(state.pills.length));
    F('weekly targets follow the program priorities - shoulders 16',
      /\/16/.test(state.shoulderBar || ''), JSON.stringify(state.shoulderBar));
    F('legs are deliberately small - quads 4', /\/4/.test(state.quadBar || ''), JSON.stringify(state.quadBar));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. The checklist ticks for gym OR home versions ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.__confirmAnswer = true; window.installRecompProgram(); });
    await page.waitForTimeout(1200);

    // Do the FULL home version of Monday's session; the slot must tick.
    await page.locator('.day-btn[data-substitute="Home: Shoulders · Abs · Biceps (A)"]').click();
    await page.waitForTimeout(800);
    const inputs = await page.locator('.set-row .reps-input').count();
    for (let i = 0; i < inputs; i++) {
      await page.locator('.set-row .reps-input').nth(i).fill('10');
    }
    await page.waitForTimeout(400);
    await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
    await page.locator('#complete-workout-btn').click();
    await page.waitForTimeout(2500);

    const panel = await page.evaluate(() => ({
      text: document.getElementById('program-panel').innerText.replace(/\s+/g, ' ').trim(),
      doneRows: [...document.querySelectorAll('#program-panel .plan-row.done .plan-name')]
        .map(e => e.innerText.trim())
    }));
    console.log('\nafter home session: ' + JSON.stringify(panel.doneRows) + ' :: ' + panel.text.slice(0, 80));
    F('a full home session ticks the same slot as its gym twin',
      panel.doneRows.some(n => n.startsWith('Shoulders · Abs · Biceps (A)')), JSON.stringify(panel.doneRows));
    F('the count reflects it', /1\/5/.test(panel.text), panel.text.slice(0, 60));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 3. Cardio: incline walk logs in two taps, feeds the target ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [],
              weight: [{ id: 'wt1', date: dayStr(-1), weight: 165 }],
              bodyGoals: [{ id: 'g1', bodyGoal: 'cutting', targetWeight: 150, goalStartDate: dayStr(-30) }] }
    });
    await page.waitForTimeout(600);

    await page.locator('.fencing-kind[data-kind="Walk"]').click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.fencing-hour')].find(b => b.innerText.trim() === '0.5h');
      btn.click();
    });
    await page.waitForTimeout(800);

    const state = await page.evaluate(() => ({
      write: (window.__writes || []).filter(w => w.collection === 'fencing').map(w => w.data),
      panelText: document.getElementById('fencing-panel').innerText.replace(/\s+/g, ' ').trim()
    }));
    console.log('\nwalk logged: ' + JSON.stringify(state.write));
    F('a half-hour incline walk logs in two taps',
      state.write.length === 1 && state.write[0].kind === 'Walk' && state.write[0].hours === 0.5,
      JSON.stringify(state.write));
    F('the panel is an activity logger now', /Activity/.test(state.panelText), state.panelText.slice(0, 60));

    await page.evaluate(() => document.getElementById('nutrition-tab-btn')?.click());
    await page.waitForTimeout(1000);
    const notice = await page.evaluate(() =>
      document.getElementById('calorie-update-notice')?.textContent || '');
    console.log('calorie notice: ' + notice);
    // 0.5h x 330 / 7 days = ~24 kcal/day
    F('the walk feeds the calorie target', /kcal\/day from logged training/.test(notice), notice);
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 4. With the plan active, the suggestion IS the plan ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.__confirmAnswer = true; window.installRecompProgram(); });
    await page.waitForTimeout(1200);

    // Mirror the due-session rule for whatever real weekday this test runs on.
    const expected = await page.evaluate(() => {
      const dow = new Date().getDay();
      const slots = [
        { day: 1, name: 'Shoulders · Abs · Biceps (A)' },
        { day: 3, name: 'Chest · Back' },
        { day: 5, name: 'Shoulders · Abs · Triceps (B)' },
        { day: 6, name: 'Legs (Short)' }
      ];
      const effDow = dow === 0 ? 7 : dow;
      const due = slots.find(s => s.day <= effDow);
      return due ? due.name : 'Test Day (Week 1 & 8)';
    });

    const ask = await page.evaluate(() => ({
      text: document.getElementById('today-panel').innerText.replace(/\s+/g, ' ').trim(),
      planPlaces: [...document.querySelectorAll('[data-planplace]')].map(b => b.innerText.trim())
    }));
    console.log('\nplan-led ask: ' + ask.text.slice(0, 140));
    F('the suggestion leads with the due plan session, not a generated one',
      ask.text.includes("Today's plan:") && ask.text.includes(expected), 
      `expected "${expected}" in: ${ask.text.slice(0, 140)}`);
    F('it asks only where you are', ask.planPlaces.join(',') === 'Main gym,Full gym,Home',
      JSON.stringify(ask.planPlaces));
    F('freeform stays one tap away', /Generate something else/.test(ask.text), ask.text.slice(0, 200));

    // Home picks the bodyweight twin
    await page.evaluate(() => window.pickPlanPlace('home'));
    await page.waitForTimeout(300);
    const preview = await page.evaluate(() => ({
      name: document.querySelector('.today-plan-name')?.innerText || null,
      note: document.querySelector('.today-status')?.innerText || null,
      count: document.querySelectorAll('.today-plan-list li').length
    }));
    console.log('home preview: ' + JSON.stringify(preview));
    const expectHome = expected.startsWith('Test') ? expected : 'Home: ' + expected;
    F('home shows the bodyweight twin with the week prescription',
      preview.name === expectHome && /reps in reserve|TEST WEEK|set/i.test(preview.note || '')
      && preview.count >= 3, JSON.stringify(preview));

    // Start loads it into the logger
    await page.evaluate(() => window.startPlanSession());
    await page.waitForTimeout(900);
    const started = await page.evaluate(() => ({
      active: document.querySelector('#workout-day-selector .day-btn.active')?.innerText.replace(/\s+/g, ' ').trim() || null,
      rows: document.querySelectorAll('.set-row').length
    }));
    console.log('started: ' + JSON.stringify(started));
    F('Start loads the plan session into the logger', started.active === expectHome && started.rows > 0,
      JSON.stringify(started));

    // The freeform opt-out still works
    await page.evaluate(() => window.usePlanFreeform());
    await page.waitForTimeout(300);
    const freeform = await page.evaluate(() =>
      document.getElementById('today-panel').innerText.replace(/\s+/g, ' ').trim());
    F('the opt-out returns the freeform chips', /How long have you got/i.test(freeform),
      freeform.slice(0, 120));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
