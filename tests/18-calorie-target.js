// Journey: the calorie target follows the life actually logged. A flat
// weight x 14.5 ignored fifteen hours a week of coaching; the target now adds
// the last 7 days of logged fencing and training, averaged per day.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

const weightWeek = () => {
  const out = [];
  for (let back = 7; back >= 1; back--) {
    out.push({ id: 'wt' + back, date: dayStr(-back), weight: 165 });
  }
  return out;
};
const goal = { id: 'g1', bodyGoal: 'cutting', targetWeight: 150, goalStartDate: dayStr(-30) };

async function readCard(page) {
  await page.evaluate(() => document.getElementById('nutrition-tab-btn')?.click());
  await page.waitForTimeout(1200);
  return page.evaluate(() => ({
    visible: document.getElementById('calorie-target-card').style.display !== 'none',
    maintenance: Number(document.getElementById('maintenance-calories').textContent),
    target: Number(document.getElementById('target-calories').textContent),
    protein: document.getElementById('protein-target').textContent,
    notice: document.getElementById('calorie-update-notice').textContent
  }));
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. No activity logged: sedentary baseline ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [], weight: weightWeek(), bodyGoals: [goal] }
    });
    const card = await readCard(page);
    console.log('no activity: ' + JSON.stringify(card));
    F('the card shows', card.visible === true, JSON.stringify(card));
    F('sedentary maintenance is 13 x bodyweight', card.maintenance === Math.round(165 * 13),
      `${card.maintenance} vs ${Math.round(165 * 13)}`);
    F('cutting takes 500 off maintenance', card.target === card.maintenance - 500, JSON.stringify(card));
    F('protein stays 1g per lb on a cut', card.protein === '165g', JSON.stringify(card.protein));
    F('the notice invites logging activity', /Log training and fencing/i.test(card.notice), card.notice);
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. A real week: coaching nights and a lifting session raise it ----------
  {
    const seed = {
      programs: [realProgram()], weight: weightWeek(), bodyGoals: [goal],
      // Two 3h coaching nights this week: 2 x 3 x 350 x 0.6 = 1260 kcal.
      fencing: [
        { id: 'f1', date: dayStr(-1), kind: 'Coaching', hours: 3, createdAt: dayStr(-1) + 'T21:00:00.000Z' },
        { id: 'f2', date: dayStr(-3), kind: 'Coaching', hours: 3, createdAt: dayStr(-3) + 'T21:00:00.000Z' }
      ],
      // One 20-set session: 20 x 7 = 140 kcal.
      workouts: [{
        id: 'w1', date: dayStr(-2), day: 'Upper A', programId: 'prog-real',
        timestamp: dayStr(-2) + 'T10:00:00.000Z',
        exercises: {
          0: { exercise: 'Incline Dumbbell Press', trackingType: 'weight_reps',
               sets: Array.from({ length: 20 }, () => ({ weight: '95', reps: '8' })) }
        }
      }]
    };
    const { browser, page, errors } = await boot({ seed });
    const card = await readCard(page);
    const expectedActivity = Math.round((2 * 3 * 350 * 0.6 + 20 * 7) / 7);
    const expectedMaintenance = Math.round(165 * 13) + expectedActivity;
    console.log('active week: ' + JSON.stringify(card) + ' expecting +' + expectedActivity + '/day');
    F('logged fencing and lifting raise maintenance', card.maintenance === expectedMaintenance,
      `${card.maintenance} vs ${expectedMaintenance}`);
    F('the target moves with it', card.target === expectedMaintenance - 500, JSON.stringify(card));
    F('the notice says how much activity added', card.notice.includes(`${expectedActivity} kcal/day`),
      card.notice);
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
