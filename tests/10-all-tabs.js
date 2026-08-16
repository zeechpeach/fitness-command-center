// Broad pass: six tabs with realistic history, watching for page errors,
// wrong numbers and unreachable controls.
const { boot, ok } = require('./harness/drive');
const { realProgram, src } = require('./harness/seed');

function dayStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Six weeks of plausible history across all five tracking types.
function history() {
  const days = ['Upper A', 'Lower A', 'Restoration', 'Upper B', 'Lower B', 'Skill and Arms', 'Walk'];
  const out = [];
  let n = 0;
  for (let back = 42; back >= 1; back--) {
    if (back % 8 === 0) continue;              // some missed days
    const day = days[n % days.length];
    const list = src.workouts[day] || [];
    const exercises = {};
    list.slice(0, 4).forEach((e, i) => {
      const t = e.trackingType;
      const sets = [];
      for (let s = 0; s < Math.min(e.sets || 3, 3); s++) {
        if (t === 'weight_reps') sets.push({ weight: String(95 + n), reps: String(8 - (s % 3)), notes: '' });
        else if (t === 'time') sets.push({ seconds: String(25 + n % 15), notes: '' });
        else if (t === 'duration') sets.push({ minutes: String(20 + n % 10), notes: '' });
        else if (t === 'reps') sets.push({ reps: String(10 + n % 5), notes: '' });
        else sets.push({ completed: true });
      }
      exercises[i] = { exercise: e.name, trackingType: t, sets };
    });
    out.push({
      id: 'w' + n, date: dayStr(-back), day, programId: 'prog-real',
      timestamp: dayStr(-back) + 'T10:00:00.000Z', exercises
    });
    n++;
  }
  return out;
}

// Shape the app itself writes: mealType + a nested foods[] with `fats`.
function nutrition() {
  const out = [];
  for (let back = 20; back >= 0; back--) {
    ['breakfast', 'lunch', 'dinner'].forEach((mealType, i) => {
      out.push({
        id: `n${back}-${i}`, date: dayStr(-back), mealType, time: '08:00',
        foods: [{
          name: ['Oats', 'Chicken and rice', 'Salmon and potatoes'][i],
          calories: [520, 780, 690][i], protein: [28, 55, 45][i],
          carbs: [70, 85, 55][i], fats: [12, 18, 24][i], quantity: 1
        }]
      });
    });
  }
  return out;
}

function weights() {
  const out = [];
  for (let back = 40; back >= 0; back -= 2) {
    out.push({ id: 'wt' + back, date: dayStr(-back), weight: 178 - (40 - back) * 0.12 });
  }
  return out;
}

(async () => {
  const { browser, page, errors, consoleLogs } = await boot({
    seed: {
      programs: [realProgram()],
      workouts: history(),
      nutrition: nutrition(),
      weight: weights(),
      savedFoods: [{ id: 'f1', name: 'Greek Yogurt', calories: 120, protein: 17, carbs: 7, fat: 0 }],
      bodyGoals: [{ id: 'g1', goalType: 'cut', targetWeight: 168, startWeight: 180, startDate: dayStr(-40), targetDate: dayStr(60) }],
      dailyRoutines: [], travelMode: [], sickDays: [], photos: [], alternativeExercises: []
    }
  });
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const tabs = ['workout', 'calendar', 'nutrition', 'body-metrics', 'analytics', 'progress'];
  for (const t of tabs) {
    const before = errors.length;
    await page.click(`#${t}-tab-btn`);
    await page.waitForTimeout(1400);

    const info = await page.evaluate((id) => {
      const el = document.getElementById(id + '-content');
      const txt = (el.innerText || '').replace(/\s+/g, ' ').trim();
      return {
        len: txt.length,
        nan: (txt.match(/NaN|undefined|Infinity|\[object/g) || []).length,
        snippet: txt.slice(0, 260)
      };
    }, t);

    const newErr = errors.slice(before);
    F(`${t}: renders with content`, info.len > 30, `len=${info.len}`);
    F(`${t}: no NaN/undefined on screen`, info.nan === 0, `count=${info.nan} :: ${info.snippet}`);
    F(`${t}: no page errors`, newErr.length === 0, JSON.stringify(newErr.slice(0, 3)));
    console.log(`  [${t}] ${info.snippet.slice(0, 190)}`);
  }

  // Horizontal overflow anywhere at 390px?
  const overflow = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 2 && getComputedStyle(el).position !== 'fixed') {
        bad.push(`${el.tagName}.${String(el.className).slice(0, 30)} right=${Math.round(r.right)}`);
      }
    });
    return { docScroll: document.documentElement.scrollWidth, win: window.innerWidth, bad: bad.slice(0, 6) };
  });
  console.log('\noverflow check: ' + JSON.stringify(overflow));
  F('nothing overflows the phone screen', overflow.docScroll <= overflow.win + 2, JSON.stringify(overflow));

  // Tap targets: anything interactive smaller than 44px?
  const small = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, .btn, [onclick], input, select').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.height < 32) out.push(`${el.tagName}.${String(el.className).slice(0, 28)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return out.slice(0, 10);
  });
  console.log('controls under 32px tall: ' + JSON.stringify(small));

  // Overlay check again, with data loaded.
  const centre = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return el ? `${el.tagName}.${el.className}` : null;
  });
  F('still no invisible overlay after using every tab', !/backdrop/i.test(centre || ''), String(centre));

  console.log('\n--- all page errors (' + errors.length + ') ---');
  errors.slice(0, 20).forEach(e => console.log(`  [${e.type}] ${e.message}`));

  const warns = consoleLogs.filter(l => l.type === 'warning');
  console.log('\nconsole warnings: ' + warns.length);
  warns.slice(0, 6).forEach(w => console.log('  ' + w.text.slice(0, 140)));

  console.log(`\nRESULT: ${fails} failed assertions`);
  await browser.close();
})();
