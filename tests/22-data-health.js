// Journey: "my bars are at 0%" must be diagnosable from inside the app.
// The Data health card reports what the device actually has, live.
const { boot, ok, dayStr, startSuggested, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

async function readHealth(page) {
  await page.evaluate(() => window.openSettings());
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const rows = {};
    document.querySelectorAll('#data-health .health-row').forEach(r => {
      rows[r.querySelector('.health-label').innerText.trim()] =
        r.querySelector('.health-value').innerText.trim();
    });
    return rows;
  });
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Healthy state reads healthy ----------
  {
    const { browser, page, errors } = await boot({
      seed: {
        programs: [realProgram()],
        workouts: [{
          id: 'w1', date: dayStr(0), day: 'Chest & Back - 45 min', programId: 'prog-real',
          timestamp: dayStr(0) + 'T10:00:00.000Z',
          exercises: { 0: { exercise: 'Incline Dumbbell Press', trackingType: 'weight_reps',
                            sets: [{ weight: '95', reps: '8' }] } }
        }]
      }
    });
    await page.waitForTimeout(700);
    const h = await readHealth(page);
    console.log('healthy: ' + JSON.stringify(h));
    F('the app version is shown', /^\d+$/.test(h['App version'] || ''), JSON.stringify(h));
    F('signed-in reads yes', h['Signed in'] === 'Yes', JSON.stringify(h));
    F('workout count is live', h['Workouts on this device'] === '1', JSON.stringify(h));
    F("today's generated-name session reads as saved",
      /Saved \(Chest & Back - 45 min\)/.test(h["Today's session"] || ''), JSON.stringify(h));
    F('no unsynced backups', h['Unsynced device backups'] === '0', JSON.stringify(h));
    F('one program, one active', h['Programs / marked active'] === '1 / 1', JSON.stringify(h));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. A stranded backup shows, and Sync now delivers it ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    await startSuggested(page, 30, 'full');
    await page.locator('.set-row .weight-input').first().fill('105');
    await page.locator('.set-row .reps-input').first().fill('6');
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__failWrites = true; });
    await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
    await page.locator('#complete-workout-btn').click();
    await page.waitForTimeout(2000);

    let h = await readHealth(page);
    console.log('after failed save: ' + JSON.stringify(h));
    F('the stranded session shows as an unsynced backup', h['Unsynced device backups'] === '1',
      JSON.stringify(h));
    F("today's session honestly reads not saved", h["Today's session"] === 'Not saved yet',
      JSON.stringify(h));

    // connection returns; the user taps Sync now instead of waiting for a reload
    await page.evaluate(() => { window.__failWrites = false; });
    await page.evaluate(() => window.runDataHealthSync());
    await page.waitForTimeout(2500);
    h = await page.evaluate(() => {
      const rows = {};
      document.querySelectorAll('#data-health .health-row').forEach(r => {
        rows[r.querySelector('.health-label').innerText.trim()] =
          r.querySelector('.health-value').innerText.trim();
      });
      return rows;
    });
    console.log('after Sync now: ' + JSON.stringify(h));
    F('Sync now delivers the backup', h['Unsynced device backups'] === '0', JSON.stringify(h));
    F("today's session now reads saved", /^Saved/.test(h["Today's session"] || ''), JSON.stringify(h));

    const unexpected = errors.filter(e => !/simulated write failure/.test(e.message));
    F('no page errors beyond the simulated outage', unexpected.length === 0,
      JSON.stringify(unexpected.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
