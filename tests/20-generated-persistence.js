// Journey: the day's generated session is a commitment the APP keeps, not one
// it forgets. It survives a page refresh mid-workout, and a session that
// failed to save reaches Firestore on the next load from its device backup.
const { boot, ok, startSuggested, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Refresh mid-workout: everything comes back ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await startSuggested(page, 45, 'full');

    const before = await page.evaluate(() => ({
      panelName: document.querySelector('.today-plan-name')?.innerText || null,
      status: document.querySelector('.today-status')?.innerText || null
    }));
    console.log('after starting: ' + JSON.stringify(before));
    F('the panel keeps showing the session after Start, not the chips',
      /min$/.test(before.panelName || ''), JSON.stringify(before));
    F('it says the session is started', /Started/i.test(before.status || ''), JSON.stringify(before));

    // type a set, then refresh the page
    await page.locator('.set-row .weight-input').first().fill('95');
    await page.locator('.set-row .reps-input').first().fill('8');
    await page.waitForTimeout(700);   // let the draft debounce write
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const after = await page.evaluate(() => ({
      panelName: document.querySelector('.today-plan-name')?.innerText || null,
      activePill: document.querySelector('#workout-day-selector .day-btn.active')?.innerText.replace(/\s+/g, ' ').trim() || null,
      askedAgain: /How long have you got/i.test(document.getElementById('today-panel').innerText),
      weight: document.querySelector('.set-row .weight-input')?.value ?? null,
      reps: document.querySelector('.set-row .reps-input')?.value ?? null
    }));
    console.log('after refresh: ' + JSON.stringify(after));
    F('the generated session survives a refresh on the panel',
      /min$/.test(after.panelName || '') && after.askedAgain === false, JSON.stringify(after));
    F('its pill is back and active', /min$/.test(after.activePill || ''), JSON.stringify(after.activePill));
    F('the typed set survives the refresh', after.weight === '95' && after.reps === '8', JSON.stringify(after));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. A failed save is recovered from the device backup ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await startSuggested(page, 30, 'full');
    await page.locator('.set-row .weight-input').first().fill('105');
    await page.locator('.set-row .reps-input').first().fill('6');
    await page.waitForTimeout(500);

    // The connection dies exactly when Complete is tapped.
    await page.evaluate(() => { window.__failWrites = true; });
    await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
    await page.locator('#complete-workout-btn').click();
    await page.waitForTimeout(2000);

    const failState = await page.evaluate(() => ({
      cloudWrites: (window.__writes || []).filter(w => w.op === 'addDoc' && w.collection === 'workouts').length,
      backupKeys: Object.keys(JSON.parse(localStorage.getItem('fitnessData') || '{}')).length,
      toast: document.getElementById('app-toast')?.innerText || document.body.innerText.match(/Could not save[^.]*/)?.[0] || null
    }));
    console.log('after failed save: ' + JSON.stringify(failState));
    F('nothing reached the cloud', failState.cloudWrites === 0, JSON.stringify(failState));
    F('the session is in the device backup', failState.backupKeys >= 1, JSON.stringify(failState));

    // Hours later: connection is back, the page reloads.
    await page.evaluate(() => { window.__failWrites = false; });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const recovered = await page.evaluate(() => ({
      cloudRows: (window.__seed.workouts || []).map(w => ({ day: w.day, date: w.date })),
      backupKeys: Object.keys(JSON.parse(localStorage.getItem('fitnessData') || '{}')).length,
      bodyText: document.body.innerText.match(/Recovered[^.]*\./)?.[0] || null
    }));
    console.log('after reload: ' + JSON.stringify(recovered));
    F('the backup reaches Firestore on the next load', recovered.cloudRows.length === 1,
      JSON.stringify(recovered.cloudRows));
    F('the backup is cleared once safe', recovered.backupKeys === 0, JSON.stringify(recovered));

    // The simulated outage logs its own console.error - that is the failure
    // path working, not a bug. Anything else is a real error.
    const unexpected = errors.filter(e => !/simulated write failure/.test(e.message));
    F('no page errors beyond the simulated outage', unexpected.length === 0,
      JSON.stringify(unexpected.map(e => e.message)));
    await browser.close();
  }

  // ---------- 3. Scrapping it brings the chips back ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.suggestSessionFor(30); window.suggestPlaceFor('full'); });
    await page.waitForTimeout(300);
    await page.locator('.today-back').click();   // "Scrap it and suggest something else"
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => ({
      askedAgain: /How long have you got/i.test(document.getElementById('today-panel').innerText),
      stored: localStorage.getItem('fcc:generated:v1')
    }));
    console.log('after scrapping: ' + JSON.stringify(state));
    F('scrapping returns to the chips', state.askedAgain === true, JSON.stringify(state));
    F('the stored generation is gone', state.stored === null, JSON.stringify(state.stored));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
