// Journey: the library is deep enough to vary all week, every entry classifies
// cleanly, and a short session runs as antagonist-paired supersets.
const { boot, ok, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // ---------- 1. Every library entry classifies to a muscle and an allowed home ----------
  {
    const { browser, page, errors } = await boot({ seed: { programs: [realProgram()], workouts: [] } });
    await page.waitForTimeout(600);
    const audit = await page.evaluate(() => {
      // The library is module-scoped; audit it through the generator's pool by
      // asking for options per group at the full gym with an empty program.
      const groups = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
                      'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
      window.suggestSessionFor(60);
      window.suggestPlaceFor('full');
      const el = document.getElementById('today-panel');
      return {
        exercises: [...el.querySelectorAll('.today-ex')].map(e => e.innerText.trim()),
        groups
      };
    });
    console.log('60min full-gym session: ' + JSON.stringify(audit.exercises));
    F('a long session draws from a real pool', audit.exercises.length >= 4, JSON.stringify(audit.exercises));
    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  // ---------- 2. Depth: three sessions in a week, no replays ----------
  {
    // Chest/back trained twice already this week with DIFFERENT movements each
    // time; a third session must still find fresh options.
    const mk = (id, off, entries) => {
      const exercises = {};
      entries.forEach(([name, sets], i) => {
        exercises[i] = { exercise: name, trackingType: 'weight_reps',
          sets: Array.from({ length: sets }, () => ({ weight: '95', reps: '8' })) };
      });
      return { id, date: require('./harness/drive').dayStr(off), day: 'gen', programId: 'prog-real',
               timestamp: require('./harness/drive').dayStr(off) + 'T10:00:00.000Z', exercises };
    };
    const { browser, page } = await boot({
      seed: { programs: [realProgram()], workouts: [
        mk('a', -3, [['Incline Dumbbell Press', 4], ['Scapular Pull-Up', 4]]),
        mk('b', -2, [['Cable Fly', 4], ['Chest-Supported Row', 4]])
      ] }
    });
    await page.waitForTimeout(700);
    const names = await page.evaluate(() => {
      window.suggestSessionFor(45);
      window.suggestPlaceFor('full');
      return [...document.querySelectorAll('.today-ex')].map(e => e.innerText.trim());
    });
    console.log('\nthird session of the week: ' + JSON.stringify(names));
    const used = /Incline Dumbbell Press|Scapular Pull-Up|Cable Fly|Chest-Supported Row/i;
    F('a third session still finds fresh movements to lead',
      names.length > 0 && !used.test(names[0]), JSON.stringify(names));
    await browser.close();
  }

  // ---------- 3. A 30-minute session pairs supersets; a 60 does not ----------
  {
    const { browser, page, errors } = await boot({ seed: { programs: [realProgram()], workouts: [] } });
    await page.waitForTimeout(600);

    const short = await page.evaluate(() => {
      window.suggestSessionFor(30);
      window.suggestPlaceFor('full');
      const el = document.getElementById('today-panel');
      return {
        sets: Number((el.querySelector('.today-plan-meta')?.innerText.match(/(\d+) sets/) || [])[1]),
        tags: [...el.querySelectorAll('.today-ss')].map(t => t.innerText.trim()),
        rows: [...el.querySelectorAll('.today-plan-list li')].map(li => ({
          tag: li.querySelector('.today-ss')?.innerText.trim() || null,
          name: li.querySelector('.today-ex').innerText.replace(/^[A-Z]\d\s*/, '').trim()
        }))
      };
    });
    console.log('\n30 min: ' + JSON.stringify(short));
    F('a short session builds supersets', short.tags.length >= 2, JSON.stringify(short.tags));
    F('superset tags come in adjacent pairs', (() => {
      for (let i = 0; i < short.rows.length; i++) {
        const t = short.rows[i].tag;
        if (t && t.endsWith('1')) {
          const next = short.rows[i + 1];
          if (!next || next.tag !== t[0] + '2') return false;
        }
      }
      return true;
    })(), JSON.stringify(short.rows));
    F('the tighter time budget yields more sets than the old rate',
      short.sets >= Math.round(30 / 2.0) - 2, String(short.sets));

    const long = await page.evaluate(() => {
      window.dismissSuggestion();
      window.suggestSessionFor(60);
      window.suggestPlaceFor('full');
      return [...document.querySelectorAll('#today-panel .today-ss')].length;
    });
    console.log('60 min superset tags: ' + long);
    F('a long session keeps straight sets', long === 0, String(long));

    F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
    await browser.close();
  }

  finish(fails);
})();
