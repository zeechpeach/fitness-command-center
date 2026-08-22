// Journey: the suggestion never prescribes a machine that is not in the room.
// The main gym is a rack, barbell, dumbbells, bench, cable stack and pull-up
// bar; the leg machines and the back-extension bench live at the full gym;
// home is a pull-up bar and bodyweight.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function session(id, dayOffset, day, exercise, sets) {
  const date = dayStr(dayOffset);
  return {
    id, date, day, programId: 'prog-real', timestamp: date + 'T10:00:00.000Z',
    exercises: {
      0: { exercise, trackingType: 'weight_reps',
           sets: Array.from({ length: sets }, () => ({ weight: '100', reps: '8' })) }
    }
  };
}
function sundayOffset() { return -new Date().getDay(); }

const suggest = (page, minutes, place) => page.evaluate(({ m, p }) => {
  window.suggestSessionFor(m);
  window.suggestPlaceFor(p);
  const el = document.getElementById('today-panel');
  return {
    text: el.innerText.replace(/\s+/g, ' ').trim(),
    name: el.querySelector('.today-plan-name')?.innerText || null,
    exercises: [...el.querySelectorAll('.today-plan-list li')].map(li =>
      li.querySelector('.today-ex').innerText.trim()),
    isRest: !!el.querySelector('.today-rest')
  };
}, { m: minutes, p: place });

const MACHINE_ONLY = /Leg Press|Leg Extension|Leg Curl|Hack Squat|Pec Deck|Machine/i;

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };
  const sun = sundayOffset();

  // Upper body fully covered this week, so the generator is forced onto legs.
  const upperDone = [
    ['Incline Dumbbell Press', 9], ['Barbell Row', 9], ['Cable Lateral Raise', 7],
    ['Hammer Curl', 5], ['Overhead Cable Triceps Extension', 5], ['Hollow Body Hold', 6]
  ].map(([name, sets], i) => session('u' + i, sun, 'Upper A', name, sets));

  // ---------- 1. The flow asks where you are, every time ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);

    const step = await page.evaluate(() => {
      window.suggestSessionFor(30);
      const el = document.getElementById('today-panel');
      return {
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        places: [...el.querySelectorAll('[data-place]')].map(b => b.innerText.trim()),
        planShown: !!el.querySelector('.today-plan-name')
      };
    });
    console.log('after picking a length: ' + JSON.stringify(step));
    F('picking a length asks where you are', /Where are you/i.test(step.text), step.text.slice(0, 100));
    F('the three locations are offered', step.places.join(',') === 'Main gym,Full gym,Home',
      JSON.stringify(step.places));
    F('no session is built before the location is known', step.planShown === false, String(step.planShown));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Legs at the FULL gym: the machines are fine ----------
  {
    const { browser, page } = await boot({ seed: { programs: [realProgram()], workouts: upperDone } });
    await page.waitForTimeout(600);
    const s = await suggest(page, 45, 'full');
    console.log('\nlegs at the full gym -> ' + JSON.stringify(s.exercises));
    F('the full gym may use the leg machines', s.exercises.some(e => MACHINE_ONLY.test(e)),
      JSON.stringify(s.exercises));
    await browser.close();
  }

  // ---------- 3. Legs at the MAIN gym: no machines, real alternatives ----------
  {
    const { browser, page } = await boot({ seed: { programs: [realProgram()], workouts: upperDone } });
    await page.waitForTimeout(600);
    const s = await suggest(page, 45, 'main');
    console.log('legs at the main gym -> ' + JSON.stringify(s.exercises));
    F('the main gym is never told to use a machine it does not have',
      !s.exercises.some(e => MACHINE_ONLY.test(e)), JSON.stringify(s.exercises));
    F('legs are still trained, with rack and dumbbell work instead',
      s.exercises.some(e => /Squat|Deadlift|Good Morning|Lunge|Step-Up|Hip Thrust|Glute Bridge|Calf/i.test(e)),
      JSON.stringify(s.exercises));
    F('it is a real session, not a blank', !s.isRest && s.exercises.length >= 2,
      JSON.stringify({ rest: s.isRest, n: s.exercises.length }));
    await browser.close();
  }

  // ---------- 4. HOME: dumbbells and the Vitruvian, but no barbell, no machines ----------
  {
    const { browser, page } = await boot({ seed: { programs: [realProgram()], workouts: [] } });
    await page.waitForTimeout(600);
    const s = await suggest(page, 30, 'home');
    console.log('\nfresh week at home -> ' + JSON.stringify(s.exercises));
    F('home never asks for a barbell, a rack lift, an incline bench or a machine',
      !s.exercises.some(e => /Barbell|Machine|Leg Press|Leg Curl|Back Squat|Bench Press|Deadlift\b|Good Morning|Weighted Dip|Trap Bar|Incline/i.test(e)),
      JSON.stringify(s.exercises));
    F('home still gets loaded work, not just bodyweight - the Vitruvian and dumbbells count',
      s.exercises.some(e => /Dumbbell|Cable|Goblet/i.test(e)), JSON.stringify(s.exercises));
    F('home still gets a session', !s.isRest && s.exercises.length >= 2,
      JSON.stringify({ rest: s.isRest, n: s.exercises.length }));
    await browser.close();
  }

  // ---------- 5. Starting a fallback-built session loads a loggable form ----------
  {
    const { browser, page, errors } = await boot({ seed: { programs: [realProgram()], workouts: upperDone } });
    await page.waitForTimeout(600);
    await suggest(page, 30, 'main');
    await page.locator('.today-start').click();
    await page.waitForTimeout(1200);

    const loaded = await page.evaluate(() => ({
      active: document.querySelector('#workout-day-selector .day-btn.active')?.innerText.replace(/\s+/g, ' ').trim() || null,
      setRows: document.querySelectorAll('.set-row').length
    }));
    console.log('\nstarted a main-gym session: ' + JSON.stringify(loaded));
    F('a session built from fallbacks loads into the logger', /min$/.test(loaded.active || '') && loaded.setRows > 0,
      JSON.stringify(loaded));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
