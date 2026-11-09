// Journey: a comeback session that buried the athlete must never repeat. The
// next session is sized from the best session actually COMPLETED recently,
// plus two sets - not from what fits the clock.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function session(id, dayOffset, totalSets) {
  const ex = {};
  // spread sets across a few exercises so it reads like a real session
  const names = ['Incline Dumbbell Press', 'Barbell Row', 'Cable Lateral Raise', 'Hammer Curl'];
  let remaining = totalSets;
  names.forEach((name, i) => {
    const take = Math.min(Math.ceil(totalSets / names.length), remaining);
    if (take <= 0) return;
    remaining -= take;
    ex[i] = { exercise: name, trackingType: 'weight_reps',
      sets: Array.from({ length: take }, () => ({ weight: '60', reps: '10' })) };
  });
  return { id, date: dayStr(dayOffset), day: 'gen ' + id, programId: 'prog-real',
           timestamp: dayStr(dayOffset) + 'T10:00:00.000Z', exercises: ex };
}

const build = (page, minutes) => page.evaluate(m => {
  window.dismissSuggestion();
  window.suggestSessionFor(m);
  window.suggestPlaceFor('full');
  const el = document.getElementById('today-panel');
  return {
    sets: Number((el.querySelector('.today-plan-meta')?.innerText.match(/(\d+) sets/) || [])[1]) || 0,
    text: el.innerText.replace(/\s+/g, ' ').trim()
  };
}, minutes);

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Yesterday he managed 10 sets before dying: today asks for 12 ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [session('y', -1, 10)] }
    });
    await page.waitForTimeout(700);
    const s = await build(page, 45);
    console.log(`after a 10-set day, 45 min asks for: ${s.sets} sets`);
    console.log('note: ' + (s.text.match(/Sized to your current capacity[^.]*\./) || [''])[0]);
    F('the session is capped at best-recent + 2, not the 20+ the clock allows',
      s.sets === 12, String(s.sets));
    F('it explains the sizing and the deal', /Sized to your current capacity: 12 sets/.test(s.text)
      && /Finish it and the next one grows/.test(s.text), s.text.slice(0, 260));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Capacity grows as sessions get finished ----------
  {
    const { browser, page } = await boot({
      seed: { programs: [realProgram()], workouts: [
        session('d3', -3, 10), session('d2', -2, 12), session('d1', -1, 14)
      ] }
    });
    await page.waitForTimeout(700);
    const s = await build(page, 45);
    console.log(`\nafter 10 -> 12 -> 14 completed: ${s.sets} sets`);
    F('the ask climbs with completion: 14 + 2 = 16', s.sets === 16, String(s.sets));
    await browser.close();
  }

  // ---------- 3. A tiny drop-in does not crush capacity; no history = clock rules ----------
  {
    const { browser, page } = await boot({
      seed: { programs: [realProgram()], workouts: [
        session('big', -5, 18),
        // a 3-set lunchtime top-up must not redefine him as a 3-set athlete
        session('tiny', -1, 3)
      ] }
    });
    await page.waitForTimeout(700);
    const s = await build(page, 45);
    console.log(`\n18-set day plus a 3-set drop-in: ${s.sets} sets`);
    F('a tiny session does not define capacity - the 18-set day does',
      s.sets === 20, String(s.sets));
    await browser.close();

    const fresh = await boot({ seed: { programs: [realProgram()], workouts: [] } });
    await fresh.page.waitForTimeout(700);
    const f = await build(fresh.page, 45);
    console.log(`no history at all: ${f.sets} sets (clock-ruled)`);
    F('with no recent history the clock still rules', f.sets >= 15, String(f.sets));
    await fresh.browser.close();
  }

  finish(fails);
})();
