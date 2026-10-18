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
        startDate: w.data.plan && w.data.plan.startDate,
        quads: w.data.weeklyTargets && w.data.weeklyTargets.Quads,
        slots: w.data.plan && w.data.plan.sessions.map(s => s.name)
      })),
    panel: document.getElementById('program-panel').innerText.replace(/\s+/g, ' ').trim(),
    pills: [...document.querySelectorAll('#workout-day-selector .day-btn')]
      .map(b => b.innerText.replace(/\s+/g, ' ').trim())
  }));
  console.log('upgrade write: ' + JSON.stringify(state.upgraded));
  console.log('panel: ' + state.panel.slice(0, 140));

  F('the installed copy is upgraded in place', state.upgraded.length === 1
    && state.upgraded[0].id === 'prog-recomp-v1' && state.upgraded[0].planVersion === 3,
    JSON.stringify(state.upgraded));
  // v3 explicitly restarts: the leg days made it a new program, so it begins
  // as one - week 1, stamped to the current week.
  const expectStart = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  F('v3 restarts the clock at week 1 of the current week',
    state.upgraded[0].startDate === expectStart && /Week 1 of 8/.test(state.panel),
    JSON.stringify({ wrote: state.upgraded[0].startDate, expected: expectStart, panel: state.panel.slice(0, 40) }));
  F('leg targets are raised', state.upgraded[0].quads === 10, JSON.stringify(state.upgraded[0]));
  F('both new leg days are in the plan',
    state.upgraded[0].slots.includes('Legs A (Quads)') && state.upgraded[0].slots.includes('Legs B (Posterior)'),
    JSON.stringify(state.upgraded[0].slots));
  F('the new leg sessions render as pills',
    state.pills.some(p => /Legs A \(Quads\)/.test(p)) && state.pills.some(p => /Home: Legs B/.test(p)),
    JSON.stringify(state.pills));
  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
  await browser.close();
  finish(fails);
})();
