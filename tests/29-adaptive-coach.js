// Journey: the generator behaves like a trainer. A session rated exhausted
// yesterday trims today; a lift stalled three sessions running gets swapped
// for a fresh stimulus with the reason stated.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function session(id, dayOffset, exercises, intensity) {
  const ex = {};
  exercises.forEach(([name, sets, weight, reps], i) => {
    ex[i] = { exercise: name, trackingType: 'weight_reps',
      sets: Array.from({ length: sets }, () => ({ weight: String(weight), reps: String(reps) })) };
  });
  return { id, date: dayStr(dayOffset), day: 'gen ' + id, programId: 'prog-real',
           timestamp: dayStr(dayOffset) + 'T10:00:00.000Z', exercises: ex,
           ...(intensity ? { intensity } : {}) };
}

const build = (page, minutes) => page.evaluate(m => {
  window.dismissSuggestion();
  window.suggestSessionFor(m);
  window.suggestPlaceFor('full');
  const el = document.getElementById('today-panel');
  return {
    sets: Number((el.querySelector('.today-plan-meta')?.innerText.match(/(\d+) sets/) || [])[1]) || 0,
    names: [...el.querySelectorAll('.today-ex')].map(e => e.innerText.replace(/^[A-Z]\d\s*/, '').trim()),
    text: el.innerText.replace(/\s+/g, ' ').trim()
  };
}, minutes);

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. An exhausted rating yesterday trims today ----------
  {
    const fresh = await boot({ seed: { programs: [realProgram()], workouts: [] } });
    await fresh.page.waitForTimeout(600);
    const base = await build(fresh.page, 45);
    await fresh.browser.close();

    const tired = await boot({
      seed: { programs: [realProgram()], workouts: [
        session('y', -1, [['Hammer Curl', 3, 40, 10]], { fatigue: 1, satisfaction: 2 })
      ] }
    });
    await tired.page.waitForTimeout(600);
    const trimmed = await build(tired.page, 45);
    console.log(`fresh=${base.sets} sets, after exhausted rating=${trimmed.sets} sets`);
    console.log('note: ' + (trimmed.text.match(/trimmed[^.]*\./i) || [''])[0]);
    F('an exhausted rating yesterday trims today',
      trimmed.sets > 0 && trimmed.sets < base.sets, `${trimmed.sets} vs ${base.sets}`);
    F('and it says so', /trimmed|consistency beats heroics/i.test(trimmed.text), trimmed.text.slice(0, 220));
    F('no page errors', tired.errors.length === 0, JSON.stringify(tired.errors.map(e => e.message)));
    await tired.browser.close();
  }

  // ---------- 2. Three stalled sessions swap the movement, with the reason ----------
  {
    // Incline DB Press ground out at 95x8 three times, 6-16 days back (outside
    // the 4-day variation window, inside the 21-day stall window). The token
    // fly session two days ago keeps chest from reading "essentially
    // untouched": without it, late in the week (3 or fewer days left) the
    // catch-up volume day fires first and leads with the most familiar chest
    // movement regardless of stalls - defensible coaching (10x10 at ~60% IS a
    // changed stimulus), but it made this test fail every Thursday to
    // Saturday. The stall swap is what is under test here.
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [
        session('s1', -16, [['Incline Dumbbell Press', 3, 95, 8]]),
        session('s2', -11, [['Incline Dumbbell Press', 3, 95, 8]]),
        session('s3', -6,  [['Incline Dumbbell Press', 3, 95, 8]]),
        session('s0', -2,  [['Cable Fly', 2, 25, 12]])
      ] }
    });
    await page.waitForTimeout(700);

    const panel = await page.evaluate(() =>
      document.getElementById('program-panel')?.innerText.replace(/\s+/g, ' ').trim() || '');
    const s = await build(page, 45);
    console.log('\nchest day after a 3-session stall -> ' + JSON.stringify(s.names));
    console.log('coach: ' + (s.text.match(/stalled[^.]*\./i) || [''])[0]);
    const chestLead = s.names.find(n =>
      /Press|Dip|Fly|Push-Up|Pec/i.test(n) && !/Pulldown|Lat|Row/i.test(n));
    F('the stalled lift does not lead its muscle',
      chestLead !== undefined && chestLead !== 'Incline Dumbbell Press', JSON.stringify(chestLead));
    F('the swap is explained, trainer-style', /stalled/i.test(s.text), s.text.slice(0, 260));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
