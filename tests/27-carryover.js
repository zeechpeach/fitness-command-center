// Journey: an appointment cuts a session short. The logged part counts, the
// rest rolls forward as a "Finish" session, and completing that ticks the
// original slot - no volume silently lost.
const { boot, ok, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const { browser, page, errors } = await boot({
    seed: { programs: [realProgram()], workouts: [] }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__confirmAnswer = true; window.installRecompProgram(); });
  await page.waitForTimeout(1200);

  // ---------- 1. Start the Monday session, log ONLY the first exercise ----------
  await page.locator('.day-btn[data-substitute="Home: Shoulders · Abs · Biceps (A)"]').click();
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) {
    await page.locator('.set-row .reps-input').nth(i).fill('10');
  }
  await page.waitForTimeout(400);
  await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
  await page.locator('#complete-workout-btn').click();
  await page.waitForTimeout(2500);

  const partial = await page.evaluate(() => ({
    panel: document.getElementById('program-panel').innerText.replace(/\s+/g, ' ').trim(),
    doneRows: document.querySelectorAll('#program-panel .plan-row.done').length
  }));
  console.log('after partial: ' + partial.panel.slice(0, 180));
  F('a cut-short session does NOT tick the slot', partial.doneRows === 0, String(partial.doneRows));
  F('the slot shows its true fraction and promises carry-over',
    /3\/\d+ sets - rest rolls forward/.test(partial.panel), partial.panel.slice(0, 200));

  // ---------- 2. The suggestion becomes "finish what's left" ----------
  await page.evaluate(() => window.dismissSuggestion());
  await page.waitForTimeout(400);
  const ask = await page.evaluate(() => ({
    text: document.getElementById('today-panel').innerText.replace(/\s+/g, ' ').trim(),
    items: [...document.querySelectorAll('#today-panel .today-plan-list li .today-ex')]
      .map(e => e.innerText.trim())
  }));
  console.log('\nfinish ask: ' + ask.text.slice(0, 160));
  F('the due session is the finish task', /Finish: Home: Shoulders · Abs · Biceps \(A\)/.test(ask.text),
    ask.text.slice(0, 140));
  F('it says nothing is lost', /carries forward|nothing is lost/i.test(ask.text), ask.text.slice(0, 200));
  F('the finished exercise is NOT in the leftovers', !ask.items.some(n => /Pike Push-Up$/.test(n)),
    JSON.stringify(ask.items));
  F('the untouched exercises are all there', ask.items.length >= 5, JSON.stringify(ask.items));

  // ---------- 3. Finishing it ticks the original slot ----------
  await page.evaluate(() => window.startPlanSession());
  await page.waitForTimeout(900);
  const rows = await page.locator('.set-row .reps-input').count();
  console.log('finish session set rows: ' + rows);
  F('the finish session holds only what is left', rows >= 10 && rows <= 20, String(rows));
  for (let i = 0; i < rows; i++) {
    await page.locator('.set-row .reps-input').nth(i).fill('10');
  }
  await page.waitForTimeout(400);
  await page.locator('#complete-workout-btn').scrollIntoViewIfNeeded();
  await page.locator('#complete-workout-btn').click();
  await page.waitForTimeout(2500);

  const after = await page.evaluate(() => ({
    doneRows: [...document.querySelectorAll('#program-panel .plan-row.done .plan-name')]
      .map(e => e.innerText.trim()),
    today: document.getElementById('today-panel').innerText.replace(/\s+/g, ' ').trim()
  }));
  console.log('\nafter finishing: ' + JSON.stringify(after.doneRows));
  F('completing the finish session ticks the ORIGINAL slot',
    after.doneRows.some(n => n.startsWith('Shoulders · Abs · Biceps (A)')), JSON.stringify(after.doneRows));

  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
  await browser.close();
  finish(fails);
})();
