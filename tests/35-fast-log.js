// Journey: one sentence becomes one logged meal. Amounts and units are parsed
// in code, foods match against the saved library (brand quirks included),
// portions are converted against each food's own serving, unmatched items are
// flagged instead of dropped, and nothing logs before the preview.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

const library = [
  { id: 'f1', name: 'Eggs (3)', calories: 210, protein: 18, carbs: 2, fats: 15, useCount: 10, lastUsed: dayStr(-1) + 'T08:00:00.000Z' },
  { id: 'f2', name: 'Fairlife 2% Milk (16 oz)', calories: 240, protein: 26, carbs: 12, fats: 9, useCount: 8, lastUsed: dayStr(-1) + 'T21:00:00.000Z' },
  { id: 'f3', name: 'Fairlife 2% Milk (8 oz)', calories: 120, protein: 13, carbs: 6, fats: 5, useCount: 2, lastUsed: dayStr(-5) + 'T21:00:00.000Z' },
  { id: 'f4', name: 'ON Whey (1 scoop)', calories: 120, protein: 24, carbs: 3, fats: 2, useCount: 9, lastUsed: dayStr(-1) + 'T21:05:00.000Z' }
];

const preview = (page, text) => page.evaluate((t) => {
  document.getElementById('fastlog-input').value = t;
  window.runFastLogPreview();
  const el = document.getElementById('fastlog-preview');
  return {
    items: [...el.querySelectorAll('.fastlog-item')].map(r => r.innerText.replace(/\s+/g, ' ').trim()),
    totals: el.querySelector('.fastlog-totals')?.innerText || '',
    text: el.innerText.replace(/\s+/g, ' ')
  };
}, text);

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const { browser, page, errors } = await boot({
    seed: { programs: [realProgram()], workouts: [], savedFoods: library }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('nutrition-tab-btn')?.click());
  await page.waitForTimeout(1000);

  // ---------- 1. The exact sentence from the brief ----------
  {
    const p = await preview(page,
      '3 hard-boiled eggs and a shake with 16 oz Fairlife milk and 1 scoop Optimum Nutrition whey');
    console.log('parsed: ' + JSON.stringify(p.items));
    F('three foods match, the filler "a shake" is dropped', p.items.length === 3, JSON.stringify(p.items));
    F('"3 hard-boiled eggs" finds Eggs (3) at ONE serving - its serving IS three eggs',
      /Eggs \(3\).*210 kcal/.test(p.items[0] || ''), p.items[0]);
    F('"16 oz fairlife milk" finds the 16 oz food at one serving',
      /Fairlife 2% Milk \(16 oz\).*240 kcal/.test(p.items[1] || ''), p.items[1]);
    F('"Optimum Nutrition whey" finds ON Whey through the brand alias',
      /ON Whey.*120 kcal/.test(p.items[2] || ''), p.items[2]);
    F('the preview totals are code arithmetic: 570 kcal, 68g',
      /570 kcal/.test(p.totals) && /68g/.test(p.totals), p.totals);
  }

  // ---------- 2. Portion math against the food's own serving ----------
  {
    const p = await preview(page, '8 oz fairlife milk');
    console.log('8 oz -> ' + JSON.stringify(p.items));
    F('8 oz of the 16 oz food logs as half a serving: 120 kcal',
      p.items.length === 1 && /120 kcal/.test(p.items[0]), JSON.stringify(p.items));
  }

  // ---------- 3. One tap logs ONE meal and bumps usage ----------
  {
    await preview(page, '3 eggs and 16 oz fairlife milk');
    const logged = await page.evaluate(async () => {
      window.__writes.length = 0;
      await window.logFastLog();
      await new Promise(r => setTimeout(r, 300));
      return {
        meals: window.__writes.filter(w => w.collection === 'nutrition' && w.op === 'addDoc'),
        bumps: window.__writes.filter(w => w.collection === 'savedFoods' && w.op === 'updateDoc').length,
        input: document.getElementById('fastlog-input').value
      };
    });
    const foods = logged.meals[0] && logged.meals[0].data.foods;
    console.log('logged: ' + JSON.stringify(foods && foods.map(f => `${f.name} x${f.quantity}`)));
    F('everything lands in ONE nutrition document', logged.meals.length === 1 && foods.length === 2,
      JSON.stringify(logged.meals.length));
    F('the sentence rides along for the record', !!logged.meals[0].data.fastLog,
      String(logged.meals[0] && logged.meals[0].data.fastLog));
    F('both foods get their usage bumped for the quick-add strip', logged.bumps === 2, String(logged.bumps));
    F('the box clears after logging', logged.input === '', String(logged.input));
  }

  // ---------- 4. Unmatched food is flagged, never silently dropped ----------
  {
    const p = await preview(page, '1 cup cottage cheese and 3 eggs');
    console.log('with a stranger: ' + JSON.stringify(p.items));
    F('the unknown food is flagged as not in the library',
      p.items.some(t => /cottage cheese/.test(t) && /not in your library/.test(t)), JSON.stringify(p.items));
    F('the known food still matches alongside it',
      p.items.some(t => /Eggs \(3\)/.test(t)), JSON.stringify(p.items));

    const modal = await page.evaluate(async () => {
      document.querySelectorAll('.fastlog-mini')[0].click();
      await new Promise(r => setTimeout(r, 150));   // the sheet animates in
      return {
        open: document.getElementById('create-food-modal')?.classList.contains('active'),
        lookupPrefill: document.getElementById('create-food-lookup-input')?.value,
        namePrefill: document.getElementById('create-food-name')?.value
      };
    });
    F('"Add it" opens the new-food flow with the name carried over',
      modal.open && /cottage cheese/.test(modal.lookupPrefill) && /cottage cheese/.test(modal.namePrefill),
      JSON.stringify(modal));
  }

  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
  await browser.close();
  finish(fails);
})();
