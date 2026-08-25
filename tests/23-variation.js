// Journey: the second session of the week must not be a replay of the first.
// Different movements for the same muscle, and heavy axial lifts are not
// prescribed again a day or two after they were last ground out.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function session(id, dayOffset, day, entries) {
  const exercises = {};
  entries.forEach(([name, sets], i) => {
    exercises[i] = { exercise: name, trackingType: 'weight_reps',
      sets: Array.from({ length: sets }, () => ({ weight: '100', reps: '8' })) };
  });
  return { id, date: dayStr(dayOffset), day, programId: 'prog-real',
           timestamp: dayStr(dayOffset) + 'T10:00:00.000Z', exercises };
}

const suggest = (page, minutes, place) => page.evaluate(({ m, p }) => {
  window.suggestSessionFor(m);
  window.suggestPlaceFor(p);
  const el = document.getElementById('today-panel');
  return [...el.querySelectorAll('.today-plan-list li')].map(li =>
    li.querySelector('.today-ex').innerText.trim());
}, { m: minutes, p: place });

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. The week's second chest/back day varies the movements ----------
  {
    const { browser, page, errors } = await boot({
      seed: {
        programs: [realProgram()],
        // The user's actual complaint: this exact session, three days ago.
        workouts: [session('w1', -3, 'Chest & Back - 45 min', [
          ['Incline Dumbbell Press', 8], ['Weighted Dip', 4],
          ['Scapular Pull-Up', 8], ['Straight-Arm Cable Pulldown', 4]
        ])]
      }
    });
    await page.waitForTimeout(700);
    const names = await suggest(page, 45, 'full');
    console.log('second session of the week -> ' + JSON.stringify(names));
    const repeats = names.filter(n =>
      /Incline Dumbbell Press|Weighted Dip|Scapular Pull-Up|Straight-Arm Cable Pulldown/i.test(n));
    // Small pools cannot promise zero overlap, but the session must not be a
    // replay: fresh movements lead, and at most one repeat rides along in a
    // demoted slot.
    F('fresh movements lead the session',
      !/Incline Dumbbell Press|Scapular Pull-Up/i.test(names[0] || ''), JSON.stringify(names));
    F('at most one movement repeats from last time', repeats.length <= 1, JSON.stringify(repeats));
    F('the majority of the session is different', repeats.length < names.length / 2, JSON.stringify(names));
    F('the same muscles still get trained', names.length >= 3, JSON.stringify(names));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Heavy squats two days ago: no axial lift today ----------
  {
    const { browser, page, errors } = await boot({
      seed: {
        programs: [realProgram()],
        workouts: [
          // Upper covered so legs are forced; squats ground out two days ago.
          session('u1', 0, 'Upper A', [
            ['Cable Fly', 16], ['Shrug', 16], ['Cable Lateral Raise', 16],
            ['Hammer Curl', 12], ['Overhead Cable Triceps Extension', 12],
            ['Hollow Body Hold', 6]
          ]),
          session('legs', -2, 'Lower A', [['Back Squat', 5]])
        ]
      }
    });
    await page.waitForTimeout(700);
    const names = await suggest(page, 45, 'main');
    console.log('\nlegs, squats ground out 2 days ago -> ' + JSON.stringify(names));
    const axial = names.filter(n => /Back Squat|Front Squat|Deadlift|Good Morning|RDL/i.test(n));
    F('no axial barbell lift so soon after heavy squats', axial.length === 0, JSON.stringify(axial));
    F('legs still get trained through non-axial work',
      names.some(n => /Squat|Lunge|Step-Up|Leg|Hip|Calf|Bridge/i.test(n)) || names.length >= 2,
      JSON.stringify(names));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
