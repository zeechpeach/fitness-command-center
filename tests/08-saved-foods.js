// Journey: tap "Saved Foods" on Nutrition at phone width.
// The panel must actually be visible, not just grey the screen.
const { boot, ok } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  const { browser, page, errors } = await boot({
    seed: {
      programs: [realProgram()],
      savedFoods: [
        { id: 'f1', name: 'Greek Yogurt', calories: 120, protein: 17, carbs: 7, fat: 0 },
        { id: 'f2', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6 }
      ]
    }
  });
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };

  await page.click('#nutrition-tab-btn');
  await page.waitForTimeout(800);

  // Find the control the user would tap.
  const btn = await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, .btn, [onclick]')];
    const hit = all.find(b => /saved\s*foods/i.test(b.innerText || ''));
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { text: hit.innerText.trim(), onclick: hit.getAttribute('onclick'), w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log('Saved Foods control: ' + JSON.stringify(btn));
  F('a "Saved Foods" control exists on Nutrition', !!btn, JSON.stringify(btn));

  await page.locator('button', { hasText: /^Saved Foods/i }).first().scrollIntoViewIfNeeded().catch(() => { });
  const clicked = await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, .btn, [onclick]')];
    const hit = all.find(b => /saved\s*foods/i.test(b.innerText || ''));
    if (!hit) return false;
    hit.click();
    return true;
  });
  await page.waitForTimeout(800);

  const modal = await page.evaluate(() => {
    const m = document.getElementById('saved-foods-modal');
    const bd = document.getElementById('saved-foods-backdrop');
    const info = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        display: s.display, visibility: s.visibility, opacity: s.opacity, z: s.zIndex,
        w: Math.round(r.width), h: Math.round(r.height),
        top: Math.round(r.top), inViewport: r.height > 0 && r.top < innerHeight && r.bottom > 0
      };
    };
    return {
      modal: info(m),
      backdrop: info(bd),
      bodyOverflow: getComputedStyle(document.body).overflow,
      modalText: m ? (m.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140) : null
    };
  });
  console.log('\n--- saved foods modal state ---');
  console.log(JSON.stringify(modal, null, 2));

  F('modal element is displayed', modal.modal && modal.modal.display !== 'none',
    JSON.stringify(modal.modal && modal.modal.display));
  F('modal has real size on screen', modal.modal && modal.modal.h > 40 && modal.modal.w > 40,
    JSON.stringify(modal.modal && { w: modal.modal.w, h: modal.modal.h }));
  F('modal is inside the viewport', modal.modal && modal.modal.inViewport === true,
    JSON.stringify(modal.modal && { top: modal.modal.top, h: modal.modal.h }));
  F('modal shows the saved foods', /Greek Yogurt|Chicken Breast/i.test(modal.modalText || ''),
    JSON.stringify(modal.modalText));

  // What does a finger actually hit in the middle of the screen now?
  const hits = await page.evaluate(() => {
    const m = document.getElementById('saved-foods-modal');
    const r = m.getBoundingClientRect();
    const probe = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el ? { tag: el.tagName, cls: String(el.className).slice(0, 40), inModal: !!el.closest('#saved-foods-modal') } : null;
    };
    // Points a finger would actually land on inside the sheet.
    return {
      sheetCentre: probe(r.left + r.width / 2, r.top + r.height / 2),
      firstRow: probe(r.left + r.width / 2, r.top + 60),
      screenCentre: probe(innerWidth / 2, innerHeight / 2)
    };
  });
  console.log('hit tests: ' + JSON.stringify(hits, null, 2));
  F('taps inside the sheet reach the sheet', hits.sheetCentre && hits.sheetCentre.inModal === true,
    JSON.stringify(hits.sheetCentre));
  F('the sheet content is reachable, not covered', hits.firstRow && hits.firstRow.inModal === true,
    JSON.stringify(hits.firstRow));

  // Its buttons must actually work.
  const btnWorks = await page.evaluate(() => {
    const m = document.getElementById('saved-foods-modal');
    const b = [...m.querySelectorAll('button')].find(x => /add/i.test(x.innerText));
    if (!b) return 'no Add button';
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { label: b.innerText.trim(), reachable: top === b || b.contains(top) };
  });
  console.log('Add button hit test: ' + JSON.stringify(btnWorks));
  F('buttons inside the sheet are tappable', btnWorks && btnWorks.reachable === true, JSON.stringify(btnWorks));

  // The search box filters via an inline oninput; it must not throw.
  const searchErrsBefore = errors.length;
  const searchInput = await page.evaluate(() => {
    const m = document.getElementById('saved-foods-modal');
    const inp = m.querySelector('input[oninput], input[type="text"], input[type="search"]');
    return inp ? { id: inp.id, oninput: inp.getAttribute('oninput') } : null;
  });
  console.log('search box: ' + JSON.stringify(searchInput));
  if (searchInput && searchInput.id) {
    await page.fill('#' + searchInput.id, 'Greek');
    await page.waitForTimeout(500);
    const filtered = await page.evaluate(() =>
      document.getElementById('saved-foods-modal').innerText.replace(/\s+/g, ' '));
    const newErrs = errors.slice(searchErrsBefore);
    console.log('after typing "Greek": ' + JSON.stringify(filtered.slice(0, 120)));
    F('searching raises no error', newErrs.length === 0, JSON.stringify(newErrs.map(e => e.message)));
    F('searching filters the list',
      /Greek Yogurt/.test(filtered) && !/Chicken Breast/.test(filtered), JSON.stringify(filtered.slice(0, 120)));
  }

  // Close it and confirm the screen is usable again.
  await page.evaluate(() => window.closeSavedFoodsModal && window.closeSavedFoodsModal());
  await page.waitForTimeout(500);
  const afterClose = await page.evaluate(() => {
    const m = document.getElementById('saved-foods-modal');
    const bd = document.getElementById('saved-foods-backdrop');
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return {
      modalDisplay: m ? getComputedStyle(m).display : null,
      backdropDisplay: bd ? getComputedStyle(bd).display : null,
      bodyOverflow: getComputedStyle(document.body).overflow,
      centre: el ? `${el.tagName}.${el.className}` : null
    };
  });
  console.log('after close: ' + JSON.stringify(afterClose));
  F('closing hides the modal', afterClose.modalDisplay === 'none', JSON.stringify(afterClose.modalDisplay));
  F('closing restores page scrolling', afterClose.bodyOverflow !== 'hidden', JSON.stringify(afterClose.bodyOverflow));
  F('page is tappable again after close', !/backdrop/i.test(afterClose.centre || ''), JSON.stringify(afterClose.centre));

  console.log('\n--- page errors (' + errors.length + ') ---');
  errors.slice(0, 15).forEach(e => console.log(`  [${e.type}] ${e.message}`));
  console.log(`\nRESULT: ${fails} failed assertions`);
  await browser.close();
})();
