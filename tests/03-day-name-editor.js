// Focused: does the day-name editor close when you tap Save or Cancel?
const { boot, ok } = require('./harness/drive');

(async () => {
  const { browser, page, errors } = await boot({ seed: {} });
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  await page.evaluate(() => { window.openSettings(); window.createNewProgram(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.updateCycleLength(1); window.updateCycleLength(1); });
  await page.waitForTimeout(250);

  const tap = async (sel) => {
    const b = await page.locator(sel).boundingBox();
    if (!b) throw new Error('no box for ' + sel);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(300);
  };
  // Tap the pill's NAME, not its centre: the remove "x" overlaps the centre.
  const tapPill = async (n) => {
    const b = await page.locator(`#schedule-pill-day${n} .schedule-pill-workout`).boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(300);
  };
  const pillState = (n = 1) => page.evaluate((i) => {
    const pill = document.getElementById('schedule-pill-day' + i);
    return {
      editing: !!pill.querySelector('.pill-edit-form'),
      label: pill.querySelector('.schedule-pill-workout')?.textContent || null
    };
  }, n);

  // --- open by tapping the pill ---
  await tapPill(1);
  let st = await pillState();
  console.log('after tapping the pill: ' + JSON.stringify(st));
  F('tapping the pill opens the name editor', st.editing === true, JSON.stringify(st));

  // --- tapping the input must NOT wipe what is being typed ---
  await page.fill('#pill-input-day1', 'Push');
  await tap('#pill-input-day1');
  const kept = await page.inputValue('#pill-input-day1');
  console.log('text after tapping into the field: ' + JSON.stringify(kept));
  F('tapping the field keeps what you typed', kept === 'Push', JSON.stringify(kept));

  // --- Save ---
  await tap('#schedule-pill-day1 .pill-edit-save');
  st = await pillState();
  console.log('after tapping Save: ' + JSON.stringify(st));
  F('tapping Save closes the name editor', st.editing === false, JSON.stringify(st));
  F('tapping Save shows the new name', st.label === 'Push', JSON.stringify(st.label));

  // --- Cancel, on a second day ---
  const errsBefore = errors.length;
  await tapPill(2);
  let st2 = await pillState(2);
  F('second day opens too', st2.editing === true, JSON.stringify(st2));
  await page.fill('#pill-input-day2', 'Legs');
  await tap('#schedule-pill-day2 .pill-edit-cancel');
  st2 = await pillState(2);
  const newErrs = errors.slice(errsBefore);
  console.log('after tapping Cancel: ' + JSON.stringify(st2));
  console.log('errors raised by Cancel: ' + JSON.stringify(newErrs.map(e => e.message)));
  F('tapping Cancel closes the name editor', st2.editing === false, JSON.stringify(st2));
  F('Cancel raises no error', newErrs.length === 0, JSON.stringify(newErrs.map(e => e.message)));
  F('Cancel discards the typed name', st2.label !== 'Legs', JSON.stringify(st2.label));

  // --- Enter key still works ---
  await tapPill(2);
  await page.fill('#pill-input-day2', 'Legs');
  await page.press('#pill-input-day2', 'Enter');
  await page.waitForTimeout(300);
  st2 = await pillState(2);
  console.log('after pressing Enter: ' + JSON.stringify(st2));
  F('pressing Enter closes the editor and saves', st2.editing === false && st2.label === 'Legs', JSON.stringify(st2));

  console.log('\ntotal page errors: ' + errors.length);
  errors.slice(0, 6).forEach(e => console.log('  ' + e.message));
  console.log(`RESULT: ${fails} failed assertions`);
  await browser.close();
})();
