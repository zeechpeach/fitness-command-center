// Journey: last-session numbers follow the exercise, not the session name,
// and a 10x10 volume day never becomes the reference for a normal 3x8 day.
const { boot, ok, dayStr, startSuggested, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function upperA(id, dayOffset, sets, weight, reps) {
  return {
    id, date: dayStr(dayOffset), day: 'Upper A', programId: 'prog-real',
    timestamp: dayStr(dayOffset) + 'T10:00:00.000Z',
    exercises: {
      0: { exercise: 'Incline Dumbbell Press', trackingType: 'weight_reps',
           sets: Array.from({ length: sets }, () => ({ weight: String(weight), reps: String(reps) })) }
    }
  };
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. A generated session inherits history logged under Upper A ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [upperA('w1', -5, 3, 95, 8)] }
    });
    await page.waitForTimeout(600);
    await startSuggested(page, 45, 'full');

    const card = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.exercise-card')];
      const target = cards.find(c => /Incline Dumbbell Press/i.test(c.innerText));
      return target ? {
        found: true,
        text: target.innerText.replace(/\s+/g, ' ').slice(0, 300),
        has95: /95/.test(target.innerText),
        copyButtons: target.querySelectorAll('[onclick*="copyPrevious"], .copy-previous, button').length
      } : { found: false };
    });
    console.log('generated session card: ' + JSON.stringify(card));
    F('the generated session includes the trained movement', card.found === true, JSON.stringify(card));
    F("last session's numbers show even though the day name differs",
      card.found && card.has95 === true, JSON.stringify(card && card.text));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. A 10x10 volume day does not pollute the 3x8 reference ----------
  {
    const { browser, page, errors } = await boot({
      seed: {
        programs: [realProgram()],
        workouts: [
          upperA('normal', -6, 3, 95, 8),     // the real strength reference
          upperA('gvt', -2, 10, 60, 10)       // a light 10x10 two days ago
        ]
      }
    });
    await page.waitForTimeout(600);
    await startSuggested(page, 45, 'full');

    const card = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.exercise-card')];
      const target = cards.find(c => /Incline Dumbbell Press/i.test(c.innerText));
      return target ? {
        found: true,
        text: target.innerText.replace(/\s+/g, ' ').slice(0, 300)
      } : { found: false };
    });
    console.log('card after a recent 10x10: ' + JSON.stringify(card));
    if (card.found) {
      F('the normal-day hint is the 3x8 at 95, not the 10x10 at 60',
        /95/.test(card.text) && !/\b60\b/.test(card.text), card.text);
    } else {
      // Recovery may have excluded chest from this generation; that is the
      // recovery model's call, not a history bug. Nothing to assert.
      console.log('chest not in this generation - skipping the hint assertion');
    }
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 3. Late in an empty week, a long session may lead with 10x10 ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => {
      window.suggestSessionFor(60);
      window.suggestPlaceFor('full');
      const el = document.getElementById('today-panel');
      return {
        exercises: [...el.querySelectorAll('.today-plan-list li')].map(li => ({
          name: li.querySelector('.today-ex').innerText.trim(),
          meta: li.querySelector('.today-ex-meta').innerText.trim()
        }))
      };
    });
    // The week starts on Sunday, so days left including today is 7 - weekday.
    s.daysLeft = 7 - new Date().getDay();
    const tenSetLead = s.exercises.length && /^10\b/.test(s.exercises[0].meta);
    console.log(`daysLeft=${s.daysLeft} lead=` + JSON.stringify(s.exercises[0]));
    if (s.daysLeft <= 3) {
      F('late week + untouched group leads with a light 10x10', tenSetLead && /60%/.test(s.exercises[0].meta),
        JSON.stringify(s.exercises[0]));
    } else {
      F('early in the week, no session leads with a 10x10 - GVT is a catch-up tool, not a default',
        !tenSetLead, JSON.stringify(s.exercises[0]));
    }
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
