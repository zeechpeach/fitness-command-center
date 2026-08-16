const { boot, ok } = require('./harness/drive');

(async () => {
  const { browser, page, errors } = await boot({ seed: {} });
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  // --- loading overlay gone ---
  const loadingVisible = await page.evaluate(() => {
    const el = document.getElementById('app-loading');
    if (!el) return 'absent';
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.opacity !== '0' ? 'VISIBLE' : 'hidden';
  });
  F('loading overlay clears', loadingVisible !== 'VISIBLE', `state=${loadingVisible}`);

  // --- a program was auto-created ---
  // Observed through the UI, not through internals: the day selector is what
  // the user actually sees when a program is live.
  const progInfo = await page.evaluate(() => {
    const sel = document.getElementById('workout-day-selector');
    const btns = sel ? [...sel.querySelectorAll('.day-btn')] : [];
    return { pills: btns.length, labels: btns.map(b => b.innerText.trim()).slice(0, 8) };
  });
  F('default program bootstrapped', progInfo.pills > 0, JSON.stringify(progInfo));

  // --- centre of screen is real content, not a backdrop ---
  const hit = await page.evaluate(() => {
    const pts = [[0.5, 0.5], [0.5, 0.25], [0.5, 0.75], [0.5, 0.12]];
    return pts.map(([fx, fy]) => {
      const el = document.elementFromPoint(innerWidth * fx, innerHeight * fy);
      if (!el) return 'null';
      return `${el.tagName}.${el.className || '(none)'}`;
    });
  });
  const backdropHit = hit.filter(h => /backdrop|modal/i.test(h));
  F('no overlay intercepts taps at 390px', backdropHit.length === 0, JSON.stringify(hit));

  // --- backdrop computed styles ---
  const backdrops = await page.evaluate(() =>
    [...document.querySelectorAll('.modal-backdrop')].map(el => {
      const s = getComputedStyle(el);
      return { id: el.id || '(no id)', display: s.display, pointerEvents: s.pointerEvents, z: s.zIndex };
    })
  );
  const showing = backdrops.filter(b => b.display !== 'none' && b.pointerEvents !== 'none');
  F('all inactive backdrops inert', showing.length === 0, JSON.stringify(backdrops.slice(0, 8)));

  // --- six tabs ---
  const tabs = [
    ['workout-tab-btn', 'workout-content'],
    ['calendar-tab-btn', 'calendar-content'],
    ['nutrition-tab-btn', 'nutrition-content'],
    ['body-metrics-tab-btn', 'body-metrics-content'],
    ['analytics-tab-btn', 'analytics-content'],
    ['progress-tab-btn', 'progress-content']
  ];
  for (const [btn, panel] of tabs) {
    const before = errors.length;
    await page.click(`#${btn}`).catch(e => { });
    await page.waitForTimeout(700);
    const info = await page.evaluate((p) => {
      const el = document.getElementById(p);
      if (!el) return { found: false };
      const s = getComputedStyle(el);
      return {
        found: true,
        visible: s.display !== 'none',
        textLen: (el.innerText || '').trim().length,
        height: el.getBoundingClientRect().height
      };
    }, panel);
    F(`tab renders: ${panel}`, info.found && info.visible && info.textLen > 20,
      JSON.stringify(info) + (errors.length > before ? ` NEW_ERRORS=${errors.length - before}` : ''));
  }

  // --- horizontal overflow at phone width ---
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth
  }));
  F('no horizontal overflow', overflow.scrollW <= overflow.clientW + 2, JSON.stringify(overflow));

  console.log('\n--- page errors (' + errors.length + ') ---');
  errors.slice(0, 25).forEach(e => console.log(`  [${e.type}] ${e.message}`));

  const writes = await page.evaluate(() => window.__writes);
  console.log('\n--- writes during boot (' + writes.length + ') ---');
  writes.forEach(w => console.log(`  ${w.op} ${w.collection} ${w.id || ''}`));

  console.log(`\nRESULT: ${fails} failed assertions`);
  await browser.close();
})();
