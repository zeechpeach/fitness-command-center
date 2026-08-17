// Journey: build a combo from library foods, then log it in one tap.
const { boot, ok, tap, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

const LIBRARY = [
  { id: 'f1', name: 'Greek Yogurt', calories: 120, protein: 17, carbs: 7, fats: 0, servingSize: 170, servingUnit: 'g', useCount: 9 },
  { id: 'f2', name: 'Frozen Fruit', calories: 60, protein: 1, carbs: 14, fats: 0, servingSize: 100, servingUnit: 'g', useCount: 7 },
  { id: 'f3', name: 'Fairlife Milk', calories: 80, protein: 13, carbs: 6, fats: 2.5, servingSize: 240, servingUnit: 'ml', useCount: 6 },
  { id: 'f4', name: 'Whey Protein', calories: 120, protein: 24, carbs: 3, fats: 1, servingSize: 1, servingUnit: 'serving', useCount: 5 },
  { id: 'f5', name: 'Chicken Breast (cooked)', calories: 195, protein: 37, carbs: 0, fats: 4, servingSize: 100, servingUnit: 'g', useCount: 4 }
];

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const { browser, page, errors } = await boot({
    seed: { programs: [realProgram()], savedFoods: JSON.parse(JSON.stringify(LIBRARY)), nutrition: [] }
  });

  await page.click('#nutrition-tab-btn');
  await page.waitForTimeout(900);

  // --- quick add appears for existing foods, before any combo exists ---
  const strip = await page.evaluate(() => {
    const el = document.getElementById('quick-add-strip');
    return {
      exists: !!el,
      buttons: [...el.querySelectorAll('.quick-add-btn')].map(b => b.innerText.replace(/\s+/g, ' ').trim()),
      label: el.querySelector('.quick-add-label')?.innerText || null
    };
  });
  console.log('quick add: ' + JSON.stringify(strip));
  F('quick-add strip renders the library', strip.buttons.length === 5, JSON.stringify(strip.buttons));
  F('quick-add says which meal it will use', /goes to (breakfast|lunch|dinner|snack)/i.test(strip.label || ''),
    JSON.stringify(strip.label));

  // --- build a combo ---
  await page.evaluate(() => window.openComboBuilder());
  await page.waitForTimeout(600);

  const builderOpen = await page.evaluate(() => {
    const m = document.getElementById('combo-builder-modal');
    const r = m.getBoundingClientRect();
    return { visible: getComputedStyle(m).display !== 'none' && r.height > 40, h: Math.round(r.height), top: Math.round(r.top) };
  });
  F('combo builder opens and is on screen', builderOpen.visible, JSON.stringify(builderOpen));

  // The Save button must be visible without scrolling, or the sheet looks like
  // it has no way to finish.
  const saveVisible = await page.evaluate(() => {
    const b = document.getElementById('combo-save-btn');
    const r = b.getBoundingClientRect();
    return { top: Math.round(r.top), inViewport: r.top < innerHeight && r.bottom > 0 };
  });
  F('the Save button is on screen without scrolling', saveVisible.inViewport, JSON.stringify(saveVisible));

  // only plain foods are offered as ingredients
  const options = await page.evaluate(() =>
    [...document.querySelectorAll('#combo-ingredient-list .combo-ingredient-name')].map(e => e.innerText));
  F('all library foods are offered as ingredients', options.length === 5, JSON.stringify(options));

  await page.fill('#combo-name-input', 'Yogurt bowl');
  await page.evaluate(() => {
    const pick = (name) => {
      const el = [...document.querySelectorAll('#combo-ingredient-list .combo-ingredient')]
        .find(n => n.innerText.includes(name));
      el.querySelector('[data-combo-toggle]').click();
    };
    pick('Greek Yogurt');
    pick('Frozen Fruit');
  });
  await page.waitForTimeout(400);

  const preview = await page.evaluate(() =>
    document.getElementById('combo-preview').innerText.replace(/\s+/g, ' ').trim());
  console.log('preview: ' + preview);
  F('preview lists both ingredients', /Greek Yogurt \+ Frozen Fruit/.test(preview), preview);
  F('preview totals the macros', /180 kcal/.test(preview) && /18g protein/.test(preview), preview);

  // bump the fruit to 1.5 servings
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('#combo-ingredient-list .combo-ingredient')]
      .find(n => n.innerText.includes('Frozen Fruit'));
    const plus = [...el.querySelectorAll('[data-combo-step]')].find(b => b.getAttribute('data-combo-step').endsWith('|1'));
    plus.click(); plus.click();
  });
  await page.waitForTimeout(400);
  const preview2 = await page.evaluate(() =>
    document.getElementById('combo-preview').innerText.replace(/\s+/g, ' ').trim());
  console.log('preview after +0.5 fruit: ' + preview2);
  F('quantity steps in half-servings', /Frozen Fruit ×1\.5/.test(preview2), preview2);
  F('totals follow the quantity', /210 kcal/.test(preview2), preview2);

  await page.evaluate(() => window.saveCombo());
  await page.waitForTimeout(1200);

  const saved = await page.evaluate(() => (window.__seed.savedFoods || [])
    .filter(f => f.isCombo)
    .map(f => ({ name: f.name, calories: f.calories, protein: f.protein, components: f.components })));
  console.log('\nsaved combo: ' + JSON.stringify(saved, null, 1));
  F('the combo is saved', saved.length === 1, JSON.stringify(saved));
  F('it stores its ingredients', saved[0] && saved[0].components.length === 2, JSON.stringify(saved[0] && saved[0].components));
  F('its totals are the sum of the parts', saved[0] && Math.round(saved[0].calories) === 210,
    JSON.stringify(saved[0] && saved[0].calories));

  // --- it appears in quick add, first ---
  await page.waitForTimeout(400);
  const strip2 = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll('.quick-add-btn')].map(b => ({
      text: b.innerText.replace(/\s+/g, ' ').trim(), combo: b.classList.contains('is-combo')
    }))
  }));
  console.log('quick add now: ' + JSON.stringify(strip2.buttons.map(b => b.text)));
  F('the combo is first in quick add', strip2.buttons[0] && /Yogurt bowl/.test(strip2.buttons[0].text),
    JSON.stringify(strip2.buttons[0]));
  F('it is marked as a combo', strip2.buttons[0] && strip2.buttons[0].combo === true, '');

  // --- one tap logs it, expanded into its ingredients ---
  await page.evaluate(() => { window.__writes = []; });
  await tap(page, '.quick-add-btn.is-combo');
  await page.waitForTimeout(1500);

  const writes = await page.evaluate(() => window.__writes.filter(w => w.collection === 'nutrition'));
  console.log('\nnutrition writes: ' + JSON.stringify(writes.map(w => w.op)));
  F('one tap writes exactly one entry', writes.filter(w => w.op === 'addDoc').length === 1,
    JSON.stringify(writes.map(w => w.op)));

  const entry = writes.find(w => w.op === 'addDoc');
  console.log('logged entry: ' + JSON.stringify(entry && entry.data, null, 1));
  F('the entry holds both ingredients, not the combo name',
    entry && entry.data.foods.length === 2, JSON.stringify(entry && entry.data.foods.map(f => f.name)));
  F('ingredient quantities carry through',
    entry && entry.data.foods.find(f => f.name === 'Frozen Fruit').quantity === 1.5,
    JSON.stringify(entry && entry.data.foods));
  F('the meal type was guessed, not asked for',
    entry && ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(entry.data.mealType),
    JSON.stringify(entry && entry.data.mealType));

  // --- and it shows on screen with the right totals ---
  // The meal card renders each food name as an editable input, so read values.
  const onScreen = await page.evaluate(() => ({
    names: [...document.querySelectorAll('#meals-container .food-input')].map(i => i.value),
    heading: document.querySelector('#meals-container .meal-header')?.innerText.replace(/\s+/g, ' ').trim()
  }));
  console.log('meals on screen: ' + JSON.stringify(onScreen));
  F('both ingredients appear in the day',
    onScreen.names.includes('Greek Yogurt') && onScreen.names.includes('Frozen Fruit'),
    JSON.stringify(onScreen.names));
  F('they land in one meal group, listed as two foods',
    /2 foods/.test(onScreen.heading || ''), JSON.stringify(onScreen.heading));

  const totals = await page.evaluate(() => ({
    cal: document.getElementById('total-calories').innerText,
    protein: document.getElementById('total-protein').innerText
  }));
  console.log('day totals: ' + JSON.stringify(totals));
  F('day total matches the combo', totals.cal === '210', JSON.stringify(totals));
  F('protein total matches the combo', totals.protein === '19g' || totals.protein === '18g', JSON.stringify(totals));

  const dialogs = await page.evaluate(() => window.__dialogs);
  F('no pop-ups anywhere in this flow', dialogs.length === 0, JSON.stringify(dialogs));

  console.log('\npage errors: ' + errors.length);
  errors.slice(0, 8).forEach(e => console.log('  ' + e.message));
  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));

  await browser.close();
  finish(fails);
})();
