# Tests

These do not affect the app. `index.html` does not load anything in this folder;
it is inert unless you deliberately run it.

Each file opens Unison in a real browser sized like an iPhone (390px), taps the
actual buttons, types into the actual boxes, and checks what happened on screen.
Firebase is replaced with an in-memory stand-in, so **nothing here ever touches
the real database**.

## Running them

```
npm install -g playwright
npx playwright install chromium

node tests/run-all.js          # everything, with a tally
node tests/03-day-name-editor.js   # just one
```

`run-all.js` exits non-zero if anything fails. If Chromium lives somewhere
Playwright will not find on its own, point at it with `PW_CHROMIUM=/path/to/chrome`.

## What each one covers

| File | Checks |
| --- | --- |
| `01-app-loads.js` | Boots, all six tabs render, no page errors, no invisible overlay swallowing taps |
| `02-create-program.js` | Build a program: add days, an apostrophe in a name, two exercises, rename a day and confirm the exercises follow |
| `03-day-name-editor.js` | Naming a day: Save and Cancel actually close the box, typing is not wiped, Enter works |
| `04-import-program.js` | Paste the real 49-exercise program in; all five tracking types survive, day pills render, rubbish input does not crash |
| `05-holds-and-cardio.js` | A session of only holds and walks saves, in seconds and minutes, with no weight boxes |
| `06-split-session.js` | Start a suggested session, log at lunch, add to it in the evening: one saved session, not two |
| `07-no-assigned-day.js` | Nothing is pre-assigned: no scheduled pills, an honest empty logger; the calendar shows history only, and the discipline score counts fencing days, skips sick days, and never says missed |
| `08-saved-foods.js` | The Saved Foods sheet is genuinely visible at phone width, its buttons are tappable, its search filters |
| `09-sets-survive-backgrounding.js` | A number typed but not tabbed away from survives the phone locking, Complete Session, and switching days |
| `10-all-tabs.js` | Six weeks of realistic history across every tab: no page errors, no `NaN` on screen, no sideways scrolling |
| `11-substitute-session.js` | The Tournament Circuit is selectable, saves under its own name, and does not consume the day the queue owes |
| `12-substitute-draft.js` | A draft typed on a substitute day survives leaving, returning and reloading |
| `13-combos.js` | Building a combo from saved foods, its Save button reachable at 390x844, and one tap logging every component |
| `14-weekly-volume.js` | The week panel: sets done against sets owed, credit capped per group, ordering by what is furthest behind |
| `15-session-suggestion.js` | "How long have you got" builds a session from debt and recovery, is willing to say rest, and Start this loads it as a loggable session |
| `16-fencing.js` | Two-tap fencing logging; a coaching night pushes the next day to upper body, a tournament day trims the session, and fencing credit quiets a leg bar without filling it |
| `18-calorie-target.js` | Maintenance is baseline plus the last 7 days of logged fencing and lifting; the notice says how much activity added |
| `19-rep-history.js` | Last-session hints follow the exercise across session names, a 10x10 never pollutes the 3x8 reference, and GVT only leads late in the week |
| `17-equipment.js` | The suggestion asks where you are and never prescribes a machine that is not in the room; the main gym gets rack and dumbbell alternatives, home gets bodyweight |
| `20-generated-persistence.js` | The day's generated session survives a refresh mid-workout with its pill, panel and typed sets; a save that failed reaches Firestore from the device backup on the next load |
| `21-nothing-hidden.js` | Sessions count and display whatever programId stamped them; two programs marked active resolve deterministically and the duplicate is repaired |
| `22-data-health.js` | The Settings Data health card reads live state - version, sign-in, counts, today's save state, stranded backups - and Sync now delivers a stranded session |
| `23-variation.js` | The week's second session is not a replay - fresh movements lead, at most one repeat rides along - and no axial barbell lift is prescribed within two days of heavy squats |
| `24-library-supersets.js` | The library gives a third session of the week fresh movements; 30-minute sessions pair A1/A2 antagonist supersets with a tighter set budget, 60-minute sessions keep straight sets |
| `sweep-inline-handlers.js` | Every inline `onclick`/`oninput` in the app resolves to a function that actually exists |
| `sweep-dead-code.js` | No unreferenced functions, handlers or variables; no `getElementById` pointing at an element that is not there |
| `sweep-unused-css.js` | No CSS rules for classes nothing uses |

The two sweeps are cheap and catch a specific, repeated failure in this codebase:
`app.js` is an ES module, so a function declared `function foo()` is **not**
reachable from an inline `onclick="foo()"` — only `window.foo = ...` is. That
mistake produces a button that silently does nothing, and it has happened more
than once.

## Adding one

Copy the shape of an existing file:

```js
const { boot, ok, tap, dayStr, finish } = require('./harness/drive');
const { realProgram } = require('./harness/seed');

(async () => {
  let fails = 0;
  const F = (n, cond, detail) => { if (!ok(n, cond, detail)) fails++; };

  const { browser, page, errors } = await boot({
    seed: { programs: [realProgram()], workouts: [] }
  });

  await tap(page, '#some-button');
  F('something happened', await page.locator('.result').isVisible());

  await browser.close();
  finish(fails);          // run-all.js reads the tally this prints
})();
```

Name it `NN-what-it-checks.js` and `run-all.js` will pick it up automatically.

### The important part: assert on what was saved

`window.__writes` is a log of every write the app attempted, so a test can check
what *would* have reached Firestore rather than guessing:

```js
const writes = await page.evaluate(() => window.__writes);
const saved = writes.filter(w => w.op === 'addDoc' && w.collection === 'workouts');
F('exactly one session was saved', saved.length === 1);
```

`window.__seed` is the fake database itself, so you can read back what a write
produced. `window.__dialogs` records any `alert`/`confirm`/`prompt` the app
raised, which is how a test asserts that a flow is free of pop-ups.

## Known limitations

- This is Chromium pretending to be an iPhone, not Safari on an iPhone. Anything
  Safari-specific — particularly keyboard and backgrounding behaviour — will not
  show up here.
- Firebase is a stand-in. It emulates `where`/`orderBy`/`limit` and will reject a
  query that would need a composite index (set `indexEnforcement: true`), but it
  is not the real thing. Security rules are not exercised at all.
- `seed.js` reads `my-program.txt` from the repo root. If that file changes, the
  counts in `04-import-program.js` change with it.
