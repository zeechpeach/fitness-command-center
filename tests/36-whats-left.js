// Journey: the remaining number becomes a picture. Remaining calories and
// protein divide across the meals still to come, snap to a size tier, and
// show as real plates - the owner's own foods first - all computed in code.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

const goalsDoc = {
  id: 'bg1', bodyGoal: 'recomp', targetWeight: 165, goalStartDate: dayStr(-30),
  targets: {
    training: { calories: 2200, protein: 170, carbs: 220, fats: 60 },
    rest: { calories: 2000, protein: 170, carbs: 170, fats: 60 }
  }
};

const meal = (cals, protein) => ({
  id: 'm1', date: dayStr(0), mealType: 'Lunch', time: '12:00',
  foods: [{ name: 'Big Lunch', calories: cals, protein, carbs: 10, fats: 10, quantity: 1 }]
});

const readCard = (page) => page.evaluate(() => {
  const el = document.getElementById('whats-left-card');
  return {
    text: el.innerText.replace(/\s+/g, ' ').trim(),
    plates: [...el.querySelectorAll('.whatsleft-plate')].map(p => p.innerText.replace(/\s+/g, ' ').trim()),
    chips: [...el.querySelectorAll('.whatsleft-chip')].map(c => c.className.includes('active') ? `[${c.innerText}]` : c.innerText)
  };
});

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. The remainder, divided and illustrated ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [], bodyGoals: [goalsDoc],
              weight: [{ id: 'wt1', date: dayStr(0), weight: 172 }],
              nutrition: [meal(1400, 100)],
              savedFoods: [{ id: 'sf1', name: 'Chipotle Half Bowl', calories: 420, protein: 38, carbs: 40, fats: 12, useCount: 5 }] },
      localStorage: { ['fcc:daytype:' + dayStr(0)]: 'training' }
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('nutrition-tab-btn')?.click());
    await page.waitForTimeout(1000);

    let c = await readCard(page);
    console.log('2 meals left: ' + JSON.stringify(c));
    F('remaining calories and protein lead the card', /800 kcal/.test(c.text) && /70g protein left/.test(c.text),
      c.text.slice(0, 140));
    F('the default split is 2 meals at ~400 kcal and 35g each',
      /400 kcal/.test(c.text) && /35g protein each/.test(c.text), c.text.slice(0, 220));
    F('two or three example plates render', c.plates.length >= 2 && c.plates.length <= 3,
      JSON.stringify(c.plates));
    F("the owner's own saved food fits and comes first, marked",
      /Chipotle Half Bowl/.test(c.plates[0] || '') && /yours/.test(c.plates[0] || ''),
      JSON.stringify(c.plates));
    F('it is framed as a ballpark, not a menu', /ballpark/i.test(c.text), c.text.slice(-120));

    await page.evaluate(() => window.setMealsLeft(1));
    c = await readCard(page);
    console.log('1 meal left: ' + JSON.stringify(c.plates));
    F('one meal left means one 800-sized plate tier',
      /800 kcal/.test(c.text) && c.plates.every(p => /(78\d|8[0-2]\d) kcal/.test(p)), JSON.stringify(c.plates));
    F('the chip choice is marked and persists per day', c.chips.join(',') === '[1],2,3', JSON.stringify(c.chips));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Done and over states say so instead of prescribing ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [], bodyGoals: [goalsDoc],
              weight: [{ id: 'wt1', date: dayStr(0), weight: 172 }],
              nutrition: [meal(2150, 168)] },
      localStorage: { ['fcc:daytype:' + dayStr(0)]: 'training' }
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('nutrition-tab-btn')?.click());
    await page.waitForTimeout(1000);

    let c = await readCard(page);
    F('within 100 kcal of target reads as done, no plates', /essentially done/i.test(c.text) && c.plates.length === 0,
      c.text.slice(0, 160));

    await page.evaluate(async () => {
      // eat past the target
      window.nutritionData[0].foods[0].calories = 2500;
      window.setMealsLeft(2);
    });
    c = await readCard(page);
    F('over target is stated without drama', /Over today's target by 300/.test(c.text), c.text.slice(0, 160));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
