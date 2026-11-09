// Journey: the adaptive program - install in one tap, show up N times a week,
// and the generator is the trainer. Plus the activity logger feeding the
// calorie target.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Install: adaptive mode, no named sessions ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.__confirmAnswer = true; window.installRecompProgram(); });
    await page.waitForTimeout(1500);

    const state = await page.evaluate(() => ({
      panel: document.getElementById('program-panel').innerText.replace(/\s+/g, ' ').trim(),
      pills: [...document.querySelectorAll('#workout-day-selector .day-btn')]
        .map(b => b.innerText.replace(/\s+/g, ' ').trim()),
      today: document.getElementById('today-panel').innerText.replace(/\s+/g, ' ').trim(),
      shoulderBar: [...document.querySelectorAll('#weekly-volume-panel .week-row')]
        .map(r => r.innerText.replace(/\s+/g, ' ').trim()).find(t => /Shoulders/.test(t)) || null,
      quadBar: [...document.querySelectorAll('#weekly-volume-panel .week-row')]
        .map(r => r.innerText.replace(/\s+/g, ' ').trim()).find(t => /Quads/.test(t)) || null
    }));
    console.log('panel: ' + state.panel);
    console.log('pills: ' + JSON.stringify(state.pills));
    F('the panel is a show-up counter, not a week-of-8 grid',
      /Show up · 0\/6 this week/.test(state.panel), state.panel);
    F('no named session pills - only the Test Day benchmark remains',
      state.pills.length === 1 && /Test Day/.test(state.pills[0]), JSON.stringify(state.pills));
    F('the generator leads the day', /How long have you got/i.test(state.today),
      state.today.slice(0, 120));
    F('aesthetics-weighted targets - shoulders 16', /\/16/.test(state.shoulderBar || ''),
      JSON.stringify(state.shoulderBar));
    F('legs honest but not dominant - quads 8', /\/8/.test(state.quadBar || ''),
      JSON.stringify(state.quadBar));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. A 45-minute session is supersetted and respects exclusions ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.__confirmAnswer = true; window.installRecompProgram(); });
    await page.waitForTimeout(1200);

    const s45 = await page.evaluate(() => {
      window.suggestSessionFor(45);
      window.suggestPlaceFor('main');
      const el = document.getElementById('today-panel');
      return {
        tags: [...el.querySelectorAll('.today-ss')].map(t => t.innerText.trim()),
        names: [...el.querySelectorAll('.today-ex')].map(e => e.innerText.replace(/^[A-Z]\d\s*/, '').trim())
      };
    });
    console.log('\n45 min: ' + JSON.stringify(s45.names));
    F('45 minutes runs as supersets now', s45.tags.length >= 2, JSON.stringify(s45.tags));
    F('the injury exclusions hold - no barbell squats, barbell hinges or standing OHP',
      !s45.names.some(n => /^Back Squat|^Front Squat|^Romanian Deadlift$|^Good Morning|^Overhead Press$/.test(n)),
      JSON.stringify(s45.names));
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
      write: (window.__writes || []).filter(w => w.collection === 'fencing').map(w => w.data)
    }));
    F('a half-hour incline walk logs in two taps',
      state.write.length === 1 && state.write[0].kind === 'Walk' && state.write[0].hours === 0.5,
      JSON.stringify(state.write));

    await page.evaluate(() => document.getElementById('nutrition-tab-btn')?.click());
    await page.waitForTimeout(1000);
    const notice = await page.evaluate(() =>
      document.getElementById('calorie-update-notice')?.textContent || '');
    F('the walk feeds the calorie target', /kcal\/day from logged training/.test(notice), notice);
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
