// Journey: one source of truth for "how much should I eat today". Editable
// training/rest targets live on the goals document; the target card, the meal
// plan header and the day type all read the same numbers, and tournament days
// ride on top of training automatically.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

const goalsDoc = (extra = {}) => ({
  id: 'bg1', bodyGoal: 'recomp', targetWeight: 165, goalStartDate: dayStr(-30),
  targets: {
    training: { calories: 2200, protein: 170, carbs: 220, fats: 60 },
    rest: { calories: 2000, protein: 170, carbs: 170, fats: 60 }
  },
  ...extra
});
const weightDoc = { id: 'wt1', date: dayStr(0), weight: 172 };

const readCard = (page) => page.evaluate(() => ({
  target: document.getElementById('target-calories')?.textContent,
  label: document.getElementById('target-calories-label')?.textContent,
  protein: document.getElementById('protein-target')?.textContent,
  planHead: document.querySelector('.mealplan-target')?.innerText || '',
  notice: document.getElementById('calorie-update-notice')?.textContent || ''
}));

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Saved targets drive everything, by day type ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [], bodyGoals: [goalsDoc()], weight: [weightDoc] },
      localStorage: { ['fcc:daytype:' + dayStr(0)]: 'rest' }
    });
    await page.waitForTimeout(800);

    await page.evaluate(() => window.setMealPlanDayType('rest'));
    let c = await readCard(page);
    console.log('rest day: ' + JSON.stringify(c));
    F('a rest day shows the rest target', c.target === '2000', JSON.stringify(c));
    F('the label names the goal and the day type', /Recomp.*Rest day/.test(c.label || ''), String(c.label));
    F('protein target comes from the setup', c.protein === '170g', String(c.protein));
    F('the meal plan header reads the SAME number', /2000 kcal/.test(c.planHead), c.planHead);

    await page.evaluate(() => window.setMealPlanDayType('training'));
    c = await readCard(page);
    F('flipping to training flips the target everywhere', c.target === '2200' && /2200 kcal/.test(c.planHead),
      JSON.stringify(c));

    await page.evaluate(() => window.setMealPlanDayType('tournament'));
    c = await readCard(page);
    F('tournament rides on training: 2200 + 450', c.target === '2650', String(c.target));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. The editor on the Body tab edits and persists ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [], bodyGoals: [goalsDoc()], weight: [weightDoc] }
    });
    await page.waitForTimeout(800);

    const edited = await page.evaluate(async () => {
      window.setMealPlanDayType('training');   // judge the card on the edited day type
      const el = document.getElementById('target-training-calories');
      const present = !!el && !!document.getElementById('target-rest-protein');
      if (el) el.value = '2350';
      window.__writes.length = 0;
      await window.saveMacroTargets();
      await new Promise(r => setTimeout(r, 300));
      return {
        present,
        write: window.__writes.find(w => w.collection === 'bodyGoals' && w.op === 'updateDoc'),
        shown: document.getElementById('target-calories')?.textContent
      };
    });
    console.log('after editing training kcal to 2350: ' + JSON.stringify({
      saved: edited.write && edited.write.data.targets.training.calories, shown: edited.shown }));
    F('the editor renders editable training/rest numbers', edited.present, String(edited.present));
    F('a hand edit saves to the goals document',
      !!edited.write && edited.write.data.targets.training.calories === 2350,
      JSON.stringify(edited.write && edited.write.data.targets));
    F('the card updates to the edited number immediately', edited.shown === '2350', String(edited.shown));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 3. No targets saved yet: the old computed target still works ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [],
              bodyGoals: [{ id: 'bg1', bodyGoal: 'cutting', targetWeight: 165, goalStartDate: dayStr(-30) }],
              weight: [weightDoc] }
    });
    await page.waitForTimeout(800);
    const c = await readCard(page);
    console.log('legacy (no saved targets): ' + JSON.stringify(c));
    F('the computed target still shows before setup', Number(c.target) > 1000, String(c.target));
    F('the notice points at the new setup', /training\/rest targets on the Body tab/.test(c.notice), c.notice);
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
