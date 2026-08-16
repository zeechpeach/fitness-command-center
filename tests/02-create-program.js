// Journey: build a program from scratch in Settings.
const { boot, ok } = require('./harness/drive');

(async () => {
  const { browser, page, errors } = await boot({ seed: {} });
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const APOS = "Arm's Day";

  await page.evaluate(() => window.openSettings());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.createNewProgram());
  await page.waitForTimeout(400);

  const editorOpen = await page.evaluate(() => {
    const m = document.getElementById('program-editor-modal');
    return m ? getComputedStyle(m).display !== 'none' : false;
  });
  F('program editor opens', editorOpen);

  // --- add days ---
  const startLen = await page.evaluate(() => document.querySelectorAll('#schedule-pills .schedule-pill').length);
  await page.evaluate(() => { window.updateCycleLength(1); window.updateCycleLength(1); });
  await page.waitForTimeout(200);
  const afterLen = await page.evaluate(() => document.querySelectorAll('#schedule-pills .schedule-pill').length);
  F('adding days adds pills', afterLen === startLen + 2, `${startLen} -> ${afterLen}`);

  // --- name day 1 with an apostrophe, via the real inline editor ---
  await page.evaluate(() => window.editProgramDayName(1));
  await page.waitForTimeout(150);
  await page.fill('#pill-input-day1', APOS);
  await page.click('#schedule-pill-day1 .pill-edit-save');
  await page.waitForTimeout(250);

  const day1Name = await page.evaluate(() => {
    const pill = document.getElementById('schedule-pill-day1');
    const w = pill && pill.querySelector('.schedule-pill-workout');
    return { text: w ? w.textContent : null, pillHtml: pill ? pill.outerHTML.slice(0, 300) : 'NO PILL' };
  });
  console.log('   day1 pill debug: ' + JSON.stringify(day1Name).slice(0, 350));
  F('apostrophe day name saved & displayed', day1Name.text === APOS, JSON.stringify(day1Name.text));

  // Buttons inside that day's accordion must still be functional, not a syntax error.
  const apostropheBreakage = errors.filter(e => /Unexpected|SyntaxError|Invalid or unexpected/i.test(e.message));
  F('apostrophe does not break markup', apostropheBreakage.length === 0, JSON.stringify(apostropheBreakage.slice(0, 3)));

  // name day 2 so we have a second type
  await page.evaluate(() => window.editProgramDayName(2));
  await page.waitForTimeout(120);
  await page.fill('#pill-input-day2', 'Leg Day');
  await page.click('#schedule-pill-day2 .pill-edit-save');
  await page.waitForTimeout(250);

  // --- add two exercises to the apostrophe day, checking the panel does not collapse ---
  async function addExercise(type, name, exType, sets, reps) {
    await page.evaluate((t) => window.openAddExercisePanel(t), type);
    await page.waitForTimeout(200);
    await page.fill('#exercise-name-input', name);
    await page.selectOption('#exercise-type-input', exType).catch(() => { });
    await page.fill('#exercise-sets-input', String(sets));
    await page.fill('#exercise-reps-input', reps);
    await page.evaluate(() => window.saveExercise());
    await page.waitForTimeout(350);
  }

  const slug = await page.evaluate((t) => window.__slug ? window.__slug(t) : null, APOS);

  await addExercise(APOS, 'Barbell Curl', 'weight_reps', 3, '8-12');
  let state1 = await page.evaluate((t) => {
    const accs = [...document.querySelectorAll('.workout-accordion')];
    const acc = accs.find(a => a.textContent.includes(t));
    if (!acc) return { found: false };
    const content = acc.querySelector('.workout-accordion-content');
    const cs = getComputedStyle(content);
    return {
      found: true,
      open: acc.classList.contains('expanded') || cs.display !== 'none' && content.getBoundingClientRect().height > 5,
      height: content.getBoundingClientRect().height,
      badge: acc.querySelector('.workout-accordion-badge')?.textContent.trim(),
      rows: acc.querySelectorAll('.exercise-item, .exercise-row, [class*="exercise"]').length
    };
  }, APOS);
  F('exercise 1 added', /1 exercise/.test(state1.badge || ''), JSON.stringify(state1));
  F('panel stays open after add #1', state1.open === true, JSON.stringify(state1));

  await addExercise(APOS, 'Hammer Curl', 'weight_reps', 3, '10-12');
  let state2 = await page.evaluate((t) => {
    const acc = [...document.querySelectorAll('.workout-accordion')].find(a => a.textContent.includes(t));
    const content = acc?.querySelector('.workout-accordion-content');
    return {
      badge: acc?.querySelector('.workout-accordion-badge')?.textContent.trim(),
      open: content ? content.getBoundingClientRect().height > 5 : false,
      height: content ? content.getBoundingClientRect().height : 0
    };
  }, APOS);
  F('exercise 2 added', /2 exercises/.test(state2.badge || ''), JSON.stringify(state2));
  F('panel stays open after add #2', state2.open === true, JSON.stringify(state2));

  // --- rename the day; exercises must follow ---
  await page.evaluate(() => window.editProgramDayName(1));
  await page.waitForTimeout(150);
  await page.fill('#pill-input-day1', "Arm's Day A");
  await page.click('#schedule-pill-day1 .pill-edit-save');
  await page.waitForTimeout(350);

  const afterRename = await page.evaluate(() => {
    const accs = [...document.querySelectorAll('.workout-accordion')].map(a => ({
      name: a.querySelector('.workout-accordion-name')?.textContent.trim(),
      badge: a.querySelector('.workout-accordion-badge')?.textContent.trim()
    }));
    const pill = document.querySelector('#schedule-pill-day1 .schedule-pill-workout')?.textContent;
    return { accs, pill };
  });
  const renamedAcc = afterRename.accs.find(a => /Arm/.test(a.name || ''));
  F('day renamed', afterRename.pill === "Arm's Day A", JSON.stringify(afterRename.pill));
  F('exercises follow the rename', /2 exercises/.test(renamedAcc?.badge || ''), JSON.stringify(afterRename.accs));

  // --- close the editor and confirm exactly one program document was written ---
  // Tap Back IMMEDIATELY, inside the 1s autosave debounce. This is the case
  // that used to throw the whole program away behind a confirm.
  await page.evaluate(() => window.closeProgramEditor && window.closeProgramEditor());
  await page.waitForTimeout(2500);

  const writes = await page.evaluate(() => window.__writes);
  const progAdds = writes.filter(w => w.op === 'addDoc' && w.collection === 'programs');
  // one auto-created default + one we built
  F('no duplicate program documents', progAdds.length <= 2, `program addDoc count=${progAdds.length}`);

  const saved = await page.evaluate(() => (window.__seed.programs || []).map(p => ({
    name: p.name, active: p.active,
    days: Object.keys(p.schedule || {}).length,
    types: Object.keys(p.workouts || {}),
    counts: Object.fromEntries(Object.entries(p.workouts || {}).map(([k, v]) => [k, (v || []).length]))
  })));
  console.log('\n--- saved programs ---');
  console.log(JSON.stringify(saved, null, 2));

  const mine = saved.find(p => p.types.some(t => /Arm/.test(t)));
  F('built program persisted with exercises', mine && mine.counts["Arm's Day A"] === 2, JSON.stringify(mine));
  F('built program became active', mine && mine.active === true, JSON.stringify(mine && mine.active));

  const dialogs = await page.evaluate(() => window.__dialogs);
  F('no native dialogs during creation', dialogs.length === 0, JSON.stringify(dialogs));

  console.log('\n--- page errors (' + errors.length + ') ---');
  errors.slice(0, 20).forEach(e => console.log(`  [${e.type}] ${e.message}`));
  console.log(`\nRESULT: ${fails} failed assertions`);
  await browser.close();
})();
