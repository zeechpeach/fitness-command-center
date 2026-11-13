// Journey: new-food numbers come from a real source or from the owner's own
// hands - never from a model's memory. The lookup explains itself without a
// key, serves label and USDA data with the source attached, and saves nothing
// until the confirm tap.
const { boot, ok, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

const FAKE_FDC = {
  foods: [
    { description: 'FAIRLIFE 2% REDUCED FAT ULTRAFILTERED MILK', dataType: 'Branded',
      brandName: 'Fairlife', fdcId: 12345, servingSize: 240, servingSizeUnit: 'ml',
      foodNutrients: [
        { nutrientId: 1008, value: 50 }, { nutrientId: 1003, value: 5.42 },
        { nutrientId: 1005, value: 2.5 }, { nutrientId: 1004, value: 1.88 }
      ] },
    { description: 'Egg, whole, cooked, hard-boiled', dataType: 'SR Legacy', fdcId: 999,
      foodNutrients: [
        { nutrientId: 1008, value: 155 }, { nutrientId: 1003, value: 12.6 },
        { nutrientId: 1005, value: 1.1 }, { nutrientId: 1004, value: 10.6 }
      ] }
  ]
};

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const { browser, page, errors } = await boot({
    seed: { programs: [realProgram()], workouts: [], savedFoods: [] }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('nutrition-tab-btn')?.click());
  await page.waitForTimeout(800);

  // ---------- 1. Without a key, the lookup explains itself ----------
  {
    const noKey = await page.evaluate(async () => {
      window.__fetchCalls = [];
      const realFetch = window.fetch;
      window.fetch = async (...args) => { window.__fetchCalls.push(String(args[0])); return realFetch(...args); };
      window.showCreateFoodModal('fairlife milk');
      await new Promise(r => setTimeout(r, 150));
      await window.runFoodLookup();
      return {
        note: document.getElementById('create-food-lookup-results').innerText,
        fetches: window.__fetchCalls.length
      };
    });
    console.log('no key: ' + noKey.note.slice(0, 120));
    F('without a key the lookup says exactly what to do, and calls nothing',
      /free USDA FoodData Central key/.test(noKey.note) && /Settings/.test(noKey.note) && noKey.fetches === 0,
      JSON.stringify(noKey));
  }

  // ---------- 2. With a key: real numbers, source attached, confirm before save ----------
  {
    const result = await page.evaluate(async (fake) => {
      try { localStorage.setItem('fcc:fdckey', 'TESTKEY'); } catch (e) { }
      window.__fetchCalls = [];
      window.fetch = async (url) => {
        window.__fetchCalls.push(String(url));
        return { ok: true, json: async () => fake };
      };
      await window.runFoodLookup();
      const resultsText = document.getElementById('create-food-lookup-results').innerText.replace(/\s+/g, ' ');
      const savedBeforeConfirm = (window.__writes || []).filter(w => w.collection === 'savedFoods').length;

      window.useLookupResult(0);
      const afterUse = {
        name: document.getElementById('create-food-name').value,
        calories: document.getElementById('create-food-calories').value,
        protein: document.getElementById('create-food-protein').value,
        badge: document.getElementById('create-food-source-badge').textContent,
        savedStill: (window.__writes || []).filter(w => w.collection === 'savedFoods').length
      };

      await window.confirmCreateFood();
      await new Promise(r => setTimeout(r, 300));
      const savedDoc = (window.__writes || []).find(w => w.collection === 'savedFoods' && w.op === 'addDoc');
      return { resultsText, savedBeforeConfirm, afterUse, savedDoc: savedDoc && savedDoc.data,
               url: window.__fetchCalls[0] };
    }, FAKE_FDC);

    console.log('results: ' + result.resultsText.slice(0, 200));
    console.log('saved: ' + JSON.stringify(result.savedDoc && {
      name: result.savedDoc.name, calories: result.savedDoc.calories, source: result.savedDoc.source, fdcId: result.savedDoc.fdcId }));
    F('the key rides the request', /api_key=TESTKEY/.test(result.url || ''), String(result.url));
    F('a branded result shows label numbers per ITS serving, computed in code (50/100g x 240ml = 120 kcal)',
      /120 kcal/.test(result.resultsText) && /per 240 ml/.test(result.resultsText), result.resultsText.slice(0, 160));
    F('the source is shown on both result types',
      /Product label - Fairlife/.test(result.resultsText) && /USDA FoodData Central/.test(result.resultsText),
      result.resultsText);
    F('the generic result stays per 100 g', /per 100 g: 155 kcal/.test(result.resultsText),
      result.resultsText);
    F('nothing is saved before the confirm tap',
      result.savedBeforeConfirm === 0 && result.afterUse.savedStill === 0,
      JSON.stringify({ before: result.savedBeforeConfirm, afterUse: result.afterUse.savedStill }));
    F('"Use" fills the form and states the source',
      /Fairlife/i.test(result.afterUse.name) && result.afterUse.calories === '120'
        && /Numbers from: Product label - Fairlife/.test(result.afterUse.badge),
      JSON.stringify(result.afterUse));
    F('the confirmed save carries the source and the FDC id',
      !!result.savedDoc && result.savedDoc.source === 'Product label - Fairlife' && result.savedDoc.fdcId === 12345,
      JSON.stringify(result.savedDoc && result.savedDoc.source));
  }

  // ---------- 3. Hand-typed foods are honestly marked manual ----------
  {
    const manual = await page.evaluate(async () => {
      window.showCreateFoodModal();
      await new Promise(r => setTimeout(r, 150));
      document.getElementById('create-food-name').value = 'Grandma Soup';
      document.getElementById('create-food-calories').value = '350';
      document.getElementById('create-food-protein').value = '20';
      window.__writes.length = 0;
      await window.confirmCreateFood();
      await new Promise(r => setTimeout(r, 300));
      const saved = (window.__writes || []).find(w => w.collection === 'savedFoods' && w.op === 'addDoc');
      return saved && { source: saved.data.source, fdcId: saved.data.fdcId };
    });
    F('a hand-entered food is marked manual, with no borrowed source',
      !!manual && manual.source === 'manual' && manual.fdcId === null, JSON.stringify(manual));
  }

  const unexpected = errors.filter(e => !/favicon/.test(e.message));
  F('no page errors', unexpected.length === 0, JSON.stringify(unexpected.map(e => e.message)));
  await browser.close();
  finish(fails);
})();
