// Journey: strict nutrition by structure - the plan panel knows the day type,
// shows exactly what to eat and when, and one tap logs a whole meal.
const { boot, ok, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const { browser, page, errors } = await boot({
    seed: { programs: [realProgram()], workouts: [], nutrition: [] }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('nutrition-tab-btn')?.click());
  await page.waitForTimeout(1000);

  // ---------- 1. The panel renders today's day type with meals and times ----------
  const panel = await page.evaluate(() => {
    const el = document.getElementById('nutrition-plan-panel');
    return {
      text: el.innerText.replace(/\s+/g, ' ').trim(),
      rows: [...el.querySelectorAll('.mealplan-row')].map(r => ({
        time: r.querySelector('.mealplan-time')?.innerText.trim(),
        name: r.querySelector('.mealplan-name')?.innerText.trim()
      })),
      chips: [...el.querySelectorAll('.mealplan-chip')].map(c => c.innerText.trim())
    };
  });
  console.log('rows: ' + JSON.stringify(panel.rows));
  F('the panel lists timed meals', panel.rows.length >= 4, JSON.stringify(panel.rows.length));
  F('every meal has a clock time', panel.rows.every(r => /^\d{1,2}:\d{2}$/.test(r.time || '')),
    JSON.stringify(panel.rows));
  F('a day target is stated', /\d{4} kcal · \d+g protein/.test(panel.text), panel.text.slice(0, 120));
  F('day types are switchable', panel.chips.join(',') === 'Wk,Sat,Rest,Tourn', JSON.stringify(panel.chips));

  // ---------- 2. One tap logs the whole meal with its macros ----------
  await page.locator('.mealplan-log').first().click();
  await page.waitForTimeout(1000);
  const logged = await page.evaluate(() => ({
    writes: (window.__writes || []).filter(w => w.op === 'addDoc' && w.collection === 'nutrition')
      .map(w => ({ planMeal: w.data.planMeal, mealType: w.data.mealType, foods: (w.data.foods || []).length })),
    done: [...document.querySelectorAll('.mealplan-row.done .mealplan-name')].map(e => e.innerText.trim()),
    diary: [...document.querySelectorAll('#meals-container .food-input')].map(i => i.value).join(' | ')
  }));
  console.log('\nlogged: ' + JSON.stringify(logged.writes));
  F('one tap writes one diary entry with every food', 
    logged.writes.length === 1 && logged.writes[0].foods >= 2, JSON.stringify(logged.writes));
  F('the entry is tagged as a plan meal', !!logged.writes[0].planMeal, JSON.stringify(logged.writes));
  F('the meal ticks in the plan', logged.done.length === 1, JSON.stringify(logged.done));
  F('it appears in the diary', /Eggs|Fage|Chicken|Turkey|Fairlife/i.test(logged.diary), logged.diary.slice(0, 200));

  // ---------- 3. Tournament override changes the day ----------
  await page.evaluate(() => window.setMealPlanDayType('tournament'));
  await page.waitForTimeout(300);
  const tourn = await page.evaluate(() =>
    document.getElementById('nutrition-plan-panel').innerText.replace(/\s+/g, ' ').trim());
  console.log('\ntournament: ' + tourn.slice(0, 140));
  F('the tournament template takes over', /Tournament day/.test(tourn) && /on the CLOCK/i.test(tourn),
    tourn.slice(0, 140));
  F('venue meals are scheduled through the day', /Venue meal 1/.test(tourn) && /Venue meal 3/.test(tourn),
    tourn.slice(0, 200));

  // ---------- 4. The cortisol rule is structural: last weekday meal is light ----------
  await page.evaluate(() => window.setMealPlanDayType('weekday'));
  await page.waitForTimeout(300);
  const weekday = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.mealplan-row')];
    const last = rows[rows.length - 1];
    return {
      lastName: last.querySelector('.mealplan-name').innerText.trim(),
      lastMacros: last.querySelector('.mealplan-macros').innerText.trim(),
      keystone: rows.map(r => r.querySelector('.mealplan-name').innerText).join(' | ')
    };
  });
  console.log('\nlast weekday meal: ' + JSON.stringify(weekday.lastName) + ' @ ' + weekday.lastMacros);
  F('the pre-fencing keystone meal exists', /keystone/i.test(weekday.keystone), weekday.keystone);
  F('the post-fencing meal is light and protein-forward',
    /shake/i.test(weekday.lastName) && parseInt(weekday.lastMacros) < 450, JSON.stringify(weekday));

  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
  await browser.close();
  finish(fails);
})();
