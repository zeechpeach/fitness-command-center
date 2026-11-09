// Journey: the built-in program's content changed after install. The installed
// copy upgrades in place on load - new sessions and targets, same start date,
// same history, no reinstall.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

// A v1 copy as it exists in the user's Firestore: old sessions, old targets,
// started last week so the plan is mid-flight.
function installedV1(startDate) {
  return {
    id: 'prog-recomp-v1',
    name: '8-Week Recomp (Shoulders & Abs First)',
    active: true,
    createdAt: '2026-10-12T08:00:00.000Z',
    activatedAt: '2026-10-12T08:00:00.000Z',
    schedule: {},
    weeklyTargets: { Shoulders: 16, Core: 12, Chest: 10, Back: 12, Biceps: 8, Triceps: 8,
                     Quads: 4, Hamstrings: 3, Glutes: 3, Calves: 2 },
    plan: {
      weeks: 8, startDate,
      sessions: [
        { day: 'Mon', name: 'Shoulders · Abs · Biceps (A)', home: 'Home: Shoulders · Abs · Biceps (A)' },
        { day: 'Sat', name: 'Legs (Short)', home: 'Home: Legs (Short)' }
      ],
      testSession: 'Test Day (Week 1 & 8)'
    },
    workouts: {
      'Shoulders · Abs · Biceps (A)': [{ name: 'Seated Dumbbell Shoulder Press', sets: 3, reps: '6-10' }],
      'Legs (Short)': [{ name: 'Leg Press', sets: 2, reps: '10-12' }]
    },
    exerciseVariations: {}
  };
}

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  const startDate = dayStr(-7);   // plan began last week -> this is week 2
  const { browser, page, errors } = await boot({
    seed: { programs: [installedV1(startDate)], workouts: [] }
  });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => ({
    upgraded: (window.__writes || []).filter(w =>
      w.op === 'updateDoc' && w.collection === 'programs').map(w => ({
        id: w.id, planVersion: w.data.planVersion,
        mode: w.data.plan && w.data.plan.mode,
        quads: w.data.weeklyTargets && w.data.weeklyTargets.Quads,
        shoulders: w.data.weeklyTargets && w.data.weeklyTargets.Shoulders,
        workoutKeys: Object.keys(w.data.workouts || {}),
        excluded: w.data.excludedExercises || []
      })),
    panel: document.getElementById('program-panel').innerText.replace(/\s+/g, ' ').trim(),
    pills: [...document.querySelectorAll('#workout-day-selector .day-btn')]
      .map(b => b.innerText.replace(/\s+/g, ' ').trim())
  }));
  console.log('upgrade write: ' + JSON.stringify(state.upgraded));
  console.log('panel: ' + state.panel.slice(0, 120));

  F('the installed copy upgrades in place to adaptive mode', state.upgraded.length === 1
    && state.upgraded[0].id === 'prog-recomp-v1' && state.upgraded[0].planVersion === 4
    && state.upgraded[0].mode === 'adaptive', JSON.stringify(state.upgraded));
  F('the panel becomes a show-up counter', /Show up · \d\/6 this week/.test(state.panel), state.panel.slice(0, 80));
  F('named sessions are retired - only the Test Day remains',
    state.upgraded[0].workoutKeys.length === 1 && /Test Day/.test(state.upgraded[0].workoutKeys[0]),
    JSON.stringify(state.upgraded[0].workoutKeys));
  F('aesthetics targets land - shoulders 16, quads 8',
    state.upgraded[0].shoulders === 16 && state.upgraded[0].quads === 8, JSON.stringify(state.upgraded[0]));
  F('the injury exclusions ride along',
    state.upgraded[0].excluded.includes('Back Squat') && state.upgraded[0].excluded.includes('Overhead Press'),
    JSON.stringify(state.upgraded[0].excluded));
  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
  await browser.close();
  finish(fails);
})();
