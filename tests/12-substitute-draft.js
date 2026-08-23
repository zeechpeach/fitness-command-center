const { boot, ok, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');
(async () => {
  const { browser, page, errors } = await boot({ seed: { programs: [realProgram()], workouts: [] } });
  const sel = '.day-btn[data-substitute="Tournament Circuit"]';
  await page.locator(sel).scrollIntoViewIfNeeded();
  const b = await page.locator(sel).boundingBox();
  await page.touchscreen.tap(b.x+b.width/2, b.y+b.height/2);
  await page.waitForTimeout(900);

  await page.locator('.set-row').first().locator('.reps-input').first().fill('17');
  await page.waitForTimeout(600);

  await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
  await page.waitForTimeout(300);
  const draftKeys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('fcc:draft:v2')||'{}').days||{}));
  console.log('draft day keys: ' + JSON.stringify(draftKeys));

  // leave and return: with scheduled pills gone, leaving is deselecting -
  // tap the active pill to put it away, then tap it again to come back.
  const b2 = await page.locator(sel).boundingBox();
  await page.touchscreen.tap(b2.x+b2.width/2, b2.y+b2.height/2);   // away
  await page.waitForTimeout(900);
  const b3 = await page.locator(sel).boundingBox();
  await page.touchscreen.tap(b3.x+b3.width/2, b3.y+b3.height/2);   // back
  await page.waitForTimeout(900);
  const back = await page.locator('.set-row').first().locator('.reps-input').first().inputValue();
  console.log('value after leaving and returning: ' + JSON.stringify(back));
  let fails = 0;
  const F = (n, c, d) => { if (!ok(n, c, d)) fails++; };
  F('a draft typed on a substitute day survives leaving and returning',
    back === '17', JSON.stringify(back));
  F('the draft is filed under the substitute day key',
    draftKeys.includes('sub:Tournament Circuit'), JSON.stringify(draftKeys));

  // reload
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2000);
  const activeAfter = await page.evaluate(()=>{const a=document.querySelector('#workout-day-selector .day-btn.active');return a?a.innerText.trim():null;});
  console.log('active day after reload: ' + JSON.stringify(activeAfter));
  console.log('errors: ' + errors.length);
  errors.slice(0,5).forEach(e=>console.log('  '+e.message));
  F('no page errors', errors.length === 0, JSON.stringify(errors.map(e => e.message)));
  await browser.close();
  finish(fails);
})();
