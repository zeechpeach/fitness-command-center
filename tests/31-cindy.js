// Journey: Cindy - the 20-minute AMRAP of 5 pull-ups / 10 push-ups / 15
// squats - logs in two taps, counts honestly toward weekly volume (capped
// credit, not one hard set per round), and can open a longer home session.
// Also: the home Vitruvian anchors at the floor, so face pulls, pulldowns and
// pushdowns are never prescribed at home while cable lateral raises still are.
const { boot, ok, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

function session(id, dayOffset, day, exercise, sets) {
  const date = dayStr(dayOffset);
  return {
    id, date, day, programId: 'prog-real', timestamp: date + 'T10:00:00.000Z',
    exercises: {
      0: { exercise, trackingType: 'weight_reps',
           sets: Array.from({ length: sets }, () => ({ weight: '40', reps: '10' })) }
    }
  };
}
function sundayOffset() { return -new Date().getDay(); }

const readPanel = (page) => page.evaluate(() => {
  const el = document.getElementById('today-panel');
  return {
    text: el.innerText.replace(/\s+/g, ' ').trim(),
    name: el.querySelector('.today-plan-name')?.innerText || null,
    meta: el.querySelector('.today-plan-meta')?.innerText || '',
    exercises: [...el.querySelectorAll('.today-plan-list li')].map(li =>
      li.querySelector('.today-ex').innerText.trim()),
    hasStart: !!el.querySelector('[data-start]'),
    cindyToggle: el.querySelector('[data-cindytoggle]')?.innerText || null
  };
});

// Everything Cindy covers, name-level: the back, chest and quad movements the
// program and library can reach. Rear Delt Fly is shoulders, not chest.
const COVERED = /pull-?up|chin-?up|row\b|pulldown|shrug|bench|push-?up|\bdip\b|pec|chest|fly|squat|lunge|leg press|leg extension|step-?up|hack/i;
const coveredByCindy = (name) => !/rear delt/i.test(name) && COVERED.test(name);

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Two-tap logging, honest credit, same-day replace ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(700);

    const logged = await page.evaluate(async () => {
      await window.logCindy(12);
      await new Promise(r => setTimeout(r, 400));
      const w = window.__writes.filter(x => x.collection === 'workouts');
      const panel = document.getElementById('fencing-panel').innerText.replace(/\s+/g, ' ');
      return { writes: w, panel };
    });
    const doc12 = logged.writes.find(w => w.op === 'addDoc');
    console.log('cindy write: ' + JSON.stringify(doc12 && {
      day: doc12.data.day, cindy: doc12.data.cindy,
      ex: Object.values(doc12.data.exercises).map(e => `${e.exercise} x${e.sets.length}`)
    }));
    F('logging 12 rounds writes one real workout document',
      !!doc12 && doc12.data.day === 'Cindy (20-min AMRAP)' && doc12.data.cindy.rounds === 12,
      JSON.stringify(doc12 && doc12.data.day));
    F('credit is capped, not one set per round: 12 rounds = 4 hard sets per movement',
      !!doc12 && Object.values(doc12.data.exercises).every(e => e.sets.length === 4),
      JSON.stringify(doc12 && Object.values(doc12.data.exercises).map(e => e.sets.length)));
    F('the three movements are the real classified exercises',
      !!doc12 && Object.values(doc12.data.exercises).map(e => e.exercise).join(',')
        === 'Pull-Up,Push-Up,Bodyweight Squat',
      JSON.stringify(doc12 && Object.values(doc12.data.exercises).map(e => e.exercise)));
    F('the activity panel shows the score', /Cindy: 12 rounds today/.test(logged.panel),
      logged.panel.slice(0, 160));

    // The muscles Cindy just hit must not be prescribed again right away.
    const after = await page.evaluate(() => {
      window.suggestSessionFor(45);
      window.suggestPlaceFor('home');
      const el = document.getElementById('today-panel');
      return [...el.querySelectorAll('.today-plan-list li')].map(li =>
        li.querySelector('.today-ex').innerText.trim());
    });
    console.log('generated right after cindy -> ' + JSON.stringify(after));
    F('a session generated after Cindy avoids back, chest and quads',
      after.length === 0 || !after.some(coveredByCindy), JSON.stringify(after));

    // Logging again the same day replaces the score instead of duplicating.
    const replaced = await page.evaluate(async () => {
      window.__writes.length = 0;
      await window.logCindy(14);
      await new Promise(r => setTimeout(r, 400));
      return {
        writes: window.__writes.filter(x => x.collection === 'workouts'),
        dialogs: window.__dialogs.map(d => d.msg)
      };
    });
    const upd = replaced.writes.find(w => w.op === 'updateDoc');
    F('a second score the same day asks, then UPDATES the document',
      !!upd && upd.data.cindy.rounds === 14
        && !replaced.writes.some(w => w.op === 'addDoc')
        && replaced.dialogs.some(m => /already logged today \(12 rounds\)/.test(m)),
      JSON.stringify({ ops: replaced.writes.map(w => w.op), dialogs: replaced.dialogs }));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Cindy as the opening block of a longer home session ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(700);

    await page.evaluate(() => {
      window.suggestSessionFor(60);
      window.suggestPlaceFor('home');
    });
    let s = await readPanel(page);
    F('a home session offers to open with Cindy',
      /Open with Cindy/.test(s.cindyToggle || ''), String(s.cindyToggle));

    await page.evaluate(() => window.toggleCindyBlock());
    s = await readPanel(page);
    console.log('\ncindy + lifts -> ' + JSON.stringify({ name: s.name, meta: s.meta, ex: s.exercises }));
    F('the session renames itself around the block', /^Cindy \+ /.test(s.name || ''), String(s.name));
    F('the card explains the block and where to log the rounds',
      /Block 1/.test(s.text) && /5 pull-ups/.test(s.text) && /log your rounds with the Cindy button/i.test(s.text),
      s.text.slice(0, 300));
    F('the lifted part fills AROUND Cindy - no rows, presses or squats on top',
      s.exercises.length > 0 && !s.exercises.some(coveredByCindy), JSON.stringify(s.exercises));
    F('the meta line prices both parts', /Cindy \+ \d+ sets/.test(s.meta), s.meta);
    F('the block can be taken back out', /Take the Cindy block back out/.test(s.cindyToggle || ''),
      String(s.cindyToggle));

    await page.evaluate(() => window.toggleCindyBlock());
    s = await readPanel(page);
    F('toggling again removes the block', !/Cindy/.test(s.name || '') && !/Block 1/.test(s.text),
      String(s.name));

    // The gyms never offer it: their floors rule out the push-ups.
    await page.evaluate(() => {
      window.dismissSuggestion();
      window.suggestSessionFor(60);
      window.suggestPlaceFor('full');
    });
    s = await readPanel(page);
    F('a gym session never offers the Cindy block', s.cindyToggle === null, String(s.cindyToggle));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 3. Short home window: the session IS Cindy, and the score completes it ----------
  {
    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: [] }
    });
    await page.waitForTimeout(700);

    await page.evaluate(() => {
      window.suggestSessionFor(30);
      window.suggestPlaceFor('home');
      window.toggleCindyBlock();
    });
    let s = await readPanel(page);
    console.log('\n30 min with cindy -> ' + JSON.stringify({ name: s.name, meta: s.meta, ex: s.exercises }));
    F('30 minutes with Cindy leaves no room for lifts: Cindy IS the session',
      s.name === 'Cindy - 30 min' && s.exercises.length === 0 && /Cindy only/.test(s.meta),
      JSON.stringify({ name: s.name, meta: s.meta }));
    F('nothing to "start" - the Cindy button is the whole flow', s.hasStart === false, String(s.hasStart));
    F('the AMRAP gets its own effort prescription - pace, not failure',
      /pace the AMRAP/i.test(s.text) && /Break sets BEFORE failure/i.test(s.text), s.text.slice(0, 300));

    await page.evaluate(async () => { await window.logCindy(10); await new Promise(r => setTimeout(r, 400)); });
    s = await readPanel(page);
    F('logging the rounds completes the session on the card',
      /Cindy done: 10 rounds/.test(s.text) && /Completed/.test(s.text), s.text.slice(0, 220));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 4. The Vitruvian has no high pulley: face pulls stay at the gyms ----------
  {
    const sun = sundayOffset();
    // Everything except shoulders covered this week, so shoulders lead the
    // session. Face Pull is the most familiar shoulder movement in history,
    // Cable Lateral Raise second - at the full gym familiarity wins, at home
    // the high-pulley movement must vanish while the low-pulley one stays.
    const seed = [
      session('c1', sun, 'Upper A', 'Dumbbell Bench Press', 16),
      session('b1', sun, 'Upper A', 'One-Arm Dumbbell Row', 16),
      session('q1', sun, 'Legs A', 'Goblet Squat', 10),
      session('h1', sun, 'Legs A', 'Dumbbell Romanian Deadlift', 8),
      session('g1', sun, 'Legs A', 'Glute Bridge', 8),
      session('k1', sun, 'Legs A', 'Single-Leg Calf Raise', 8),
      session('a1', sun, 'Upper A', 'Hammer Curl', 12),
      session('t1', sun, 'Upper A', 'Overhead Dumbbell Triceps Extension', 12),
      session('x1', sun, 'Upper A', 'Hollow Body Hold', 12),
      session('f1', -9, 'Shoulders', 'Face Pull', 4),
      session('f2', -8, 'Shoulders', 'Face Pull', 4),
      session('l1', -9, 'Shoulders', 'Cable Lateral Raise', 3)
    ];

    const { browser, page, errors } = await boot({
      seed: { programs: [realProgram()], workouts: seed }
    });
    await page.waitForTimeout(700);

    const atFull = await page.evaluate(() => {
      window.suggestSessionFor(45);
      window.suggestPlaceFor('full');
      const el = document.getElementById('today-panel');
      return [...el.querySelectorAll('.today-plan-list li')].map(li =>
        li.querySelector('.today-ex').innerText.trim());
    });
    console.log('\nshoulders at the full gym -> ' + JSON.stringify(atFull));
    F('at the full gym the familiar face pull is still offered',
      atFull.some(e => /Face Pull/i.test(e)), JSON.stringify(atFull));

    const atHome = await page.evaluate(() => {
      window.dismissSuggestion();
      window.suggestSessionFor(45);
      window.suggestPlaceFor('home');
      const el = document.getElementById('today-panel');
      return [...el.querySelectorAll('.today-plan-list li')].map(li =>
        li.querySelector('.today-ex').innerText.trim());
    });
    console.log('shoulders at home -> ' + JSON.stringify(atHome));
    F('at home, nothing that needs a high pulley is ever prescribed',
      !atHome.some(e => /Face Pull|Pulldown|Pushdown/i.test(e)), JSON.stringify(atHome));
    F('low-pulley cable work still is - the Vitruvian is not banned, just understood',
      atHome.some(e => /Cable Lateral Raise/i.test(e)), JSON.stringify(atHome));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
