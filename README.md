# Unison

Body in unison.

A personal training log built for one person and one phone. Plain HTML, CSS and
JavaScript with no build step and no framework: `index.html` is the whole
interface, `src/js/app.js` is all the logic, `src/css/styles.css` is all the
styling. Data lives in Firebase Firestore, reached directly from the browser
with anonymous auth. GitHub Pages serves it straight from `main`, so whatever is
committed is live within about two minutes.

## Features

### Workout tracking
- Five tracking types per exercise, so a hold, a walk and a bench press are each
  logged in the units that make sense:
  - **Weight & reps** - barbell, dumbbell, machine and cable work
  - **Reps only** - bodyweight work where load is not the variable
  - **Time (seconds)** - holds, planks, balance, levers, hangs
  - **Duration (minutes)** - walking, cycling, rowing, steady cardio
  - **Check it off** - stretches, mobility and primer work
- Previous-session numbers beside every set, with a one-tap Copy. History
  follows the exercise, not the session name - a generated session inherits
  the numbers logged under "Upper A" - and matches by rep scheme, so a light
  10x10 volume day never becomes the reference for a normal 3x8 day.
- Exercise approach variations (Standard, Heavy, Form Focus)
- Skill progression ladders for front lever, handstand and L-sit
- Pre- and post-session intensity ratings
- A session can be logged in parts: log at lunch, add to it in the evening, and
  it stays one saved session
- Sets autosave to the device as you type and survive backgrounding the tab
- **Every completed session is backed up on the device before the network is
  tried.** If the save fails - dead connection, auth lapse - the session is
  re-saved automatically on the next load, with a toast saying so. A failed
  save can inconvenience you; it can no longer lose a workout.

### The week
- **Weekly volume targets** per muscle group, shown at the top of the Workout
  tab: sets done against sets owed, ordered by what is furthest behind for the
  days remaining. The week is the unit, not the day - hit the volume across
  whatever days open up and the week is a success. The week runs Sunday to
  Saturday.
- **Counting is fractional.** An exercise credits its primary muscle a full
  set and each meaningfully-worked secondary half a set: dips are chest 1.0 +
  triceps 0.5 + front delts 0.5, rows are back 1.0 + biceps 0.5, squats are
  quads 1.0 + glutes 0.5. Because the units are fractional, targets are too:
  Chest 16, Back 16, Shoulders 16, arms 12 - calibrated so one focused 8-set
  day covers about half a muscle's week, and every big muscle genuinely needs
  two days. Lower-body targets stay low on purpose - fencing already loads
  legs, and
  fencing credit lands on those bars too. Recovery uses the same fractions, so
  a heavy press day part-fatigues triceps even with no pushdown logged.
- Credit is capped per group, so a big day on one muscle cannot paper over
  another that was never trained.
- **How many sessions are left**, rather than a grid of named days. A named
  weekly plan is an assignment you can fail; a session count is something you
  can plan around.

### Fencing
Fifteen hours a week of coaching and twelve-hour tournament days used to be
invisible to this app, which made the week look like a week of sitting still and
let the generator prescribe squats the morning after a night on the strip.

- Logged in two taps: the kind of day (coaching, training, tournament) and the
  hours. No keyboard, no date picker - it assumes today.
- Converted into an equivalent-set load for the muscles fencing actually taxes -
  quads, calves, glutes, hamstrings, core - weighted by kind, since coaching is
  not the same as competing.
- **It counts toward the week, capped at half of each target.** Footwork keeps
  legs busy but it is not loaded work, and loaded work is what holds muscle
  through a deficit, so fencing can quiet a leg bar and never fill it. The
  fencing share is drawn as a separate hatched segment so the two never read as
  the same thing.
- It feeds the recovery side of the suggestion, so a heavy coaching night pushes
  the next day toward upper body rather than toward nothing.
- A long day shrinks the whole session rather than dropping exercises from it,
  and the panel says why it was trimmed.

### Today's suggestion
Tap how long you have - 15, 30, 45 or 60 minutes - then where you are, and the
app builds a session from what the week still owes, what was trained in the
last 48 hours, the time available, and the equipment actually in the room.
Nothing is assigned in advance, so there is nothing to fall behind on - but
**once generated, the session is the day's plan and it stays**: previewed,
started or completed, it survives page refreshes and hours away, until it is
scrapped or the day ends.

Exercises come in training order: big multi-joint lifts first, isolation work
after them, core last - so a press is never run pre-exhausted after laterals
and logged as false regression.

The location is asked fresh every time, deliberately: which gym today is the
one fact that changes day to day.

- **Main gym** - squat rack, barbell, dumbbells, bench, cable stack, pull-up
  bar. No leg machines and no back-extension bench, so leg work comes as
  squats, Romanian deadlifts, good mornings, lunges and cable back extensions
  instead of leg press and leg curls.
- **Full gym** - everything, machines included.
- **Home** - a pull-up bar, dumbbells (one to 50 lb, two 25s), a flat bench,
  a bike, a treadmill and a Vitruvian, which covers cable-style loading. No
  barbell, no rack, no incline bench, no machines. Home is also the only
  place with a floor clean enough to touch, so floor work - push-ups,
  handstands, planks, anything lying down - is suggested at home only.

When the program's own exercises for a muscle all need kit today's location
does not have, built-in fallbacks stand in, so a session is never blank and
never impossible.

- Trained chest hard yesterday? It picks back and legs today.
- Four hours of fencing last night? Legs drop down the order and it leads with
  upper body.
- Nothing logged for three days? Everything has recovered, so the biggest debts
  win and you get a full-body session.
- Capped at 8 hard sets per muscle group in one session: past roughly that,
  extra sets cost full fatigue for progressively less return, so it spreads
  across more groups rather than cramming.
- It will say **rest** when everything owed was trained too recently, or when
  the week is already covered.
- Exercise choice favours movements already logged often, so the same lifts
  recur and progressive overload still has something to track - but a
  movement used in the last few days is demoted, so the week's second session
  for a muscle reaches for a different variation instead of replaying the
  first, and the exercise that led last session does not lead again.
- **CNS cost is respected**: heavy axial barbell lifts (squats, deadlifts,
  RDLs, good mornings) trained in the last two days rule axial lifts out of
  today's suggestion - the same muscles come back through leg presses, split
  squats, leg curls and hip thrusts instead.
- **Catch-up volume day**: when one muscle is essentially untouched with three
  or fewer days left in the week, a 45+ minute session leads with a 10x10 at
  ~60% - a light German-volume scheme, deliberately gated to late week so a
  catch-up tool never becomes the default.

### Sessions
- Custom programs of any length, built in Settings or pasted in as JSON
- **Nothing is assigned.** The scheduled day pills are gone: a queue that
  picked a day and marked it active was a daily assignment you could fail.
  The suggestion above is the way into a session; sessions the program
  defines but never schedules (the Tournament Circuit) stay one tap away.
- Calendar view of completed sessions
- Delete a mis-logged session from the calendar

### Nutrition
- **Combos** - several foods you always eat together (yogurt + frozen fruit,
  milk + protein powder) saved as one item and logged in a single tap. Built
  from foods already in your library. Not tied to a meal: the same combo can be
  breakfast one day and a late snack the next.
- **Quick add** - the eight things you log most, one tap each, no modal and no
  keyboard. Combos come first, and each remembers the amount you logged last.
- The meal (breakfast / lunch / dinner / snack) is guessed from the time of day
  and stays overridable
- Meals by type (breakfast, lunch, dinner, snack) with per-food macros
- Daily totals, a saved-foods library, and measured or serving-based portions
- **Calorie target that follows your real week.** Maintenance is a sedentary
  baseline (13 kcal/lb of the 7-day average weight) plus the last 7 days of
  logged activity - fencing hours by kind, hard sets at ~7 kcal each -
  averaged per day. A tournament weekend raises the target; a quiet week
  lowers it. Cutting takes 500 off; protein holds at 1 g/lb on a cut.
- Training-day vs rest-day comparison over the last 14 days

### Body metrics
- Daily weight logging with a 7-day moving average
- Weight progress chart
- Body goal (cutting, bulking, maintaining) with a projected completion date

### Nothing is ever hidden
A logged session counts and displays whatever program stamped it. Workouts
used to be filtered against the active program's id - and with two program
documents accidentally marked active, which one won could change between
loads, silently hiding real history. The filter is gone, and a duplicate
"active" program is now detected and repaired automatically.

### Analytics
- Estimated 1RM (Epley) per lift, so extra reps at the same load count
- Hard sets per muscle group per week, which counts bodyweight and skill work
  that volume-in-pounds scores as zero
- **Discipline score: did you show up at all.** A lifted session counts, a
  logged fencing night counts; which session it was does not matter. Scored
  over the last 30 days as active days out of available days, with rest days
  reported plainly rather than as failures. The streak works the same way,
  and fencing-only days paint on the calendar in their own shade. The
  calendar is a record of what happened - it projects nothing forward and
  never paints a day as missed.
- Strength progression and plateau detection
- Session comparison by exercise type

### Travel and sick days
Both leave the discipline score's denominator entirely and are transparent to
the streak - they neither count nor break it.

## Data storage

Firestore collections:

| Collection | Contents |
| --- | --- |
| `workouts` | Sessions: exercises, sets, tracking type, intensity ratings |
| `nutrition` | Meals, foods, macros |
| `weight` | Daily weight entries |
| `programs` | Program definitions and which one is active |
| `savedFoods` | The saved-foods library |
| `bodyGoals` | Goal type, target weight, start date |
| `dailyRoutines` | Morning primer and pre-bed routine completions |
| `travelMode` | Travel period date ranges |
| `sickDays` | Individual sick days |
| `fencing` | Coaching, training and tournament hours |

Export everything as JSON from Settings.

**Settings -> Data health** shows what the device actually has, live: app
version, sign-in state, how many workouts loaded, whether today's session is
saved, and any session stranded in the on-device backup - with a Sync now
button that loads, reconciles and re-renders on the spot. Asset URLs carry a
version query that is bumped on every release, so a phone cannot quietly run
last week's code.

### Security rules

`firestore.rules` requires an authenticated session for every collection and
denies anything not listed. **Pushing to GitHub does not deploy these rules** -
GitHub Pages only serves the site. Apply them with:

```
firebase deploy --only firestore:rules
```

## Tests

`tests/` holds a browser-driven suite that opens the app at iPhone width, taps
real buttons, and asserts on what the app would have written to Firestore. It
never touches the real database. Nothing in that folder is loaded by the app.

```
node tests/run-all.js
```

See `tests/README.md` for what each one covers and how to add another.

## Dependencies

- Firebase 10.12.0 (Firestore + anonymous auth), loaded from gstatic
- Chart.js 3.9.1 and `chartjs-adapter-date-fns`, injected on demand the first
  time a chart is drawn rather than on every page load

## Privacy

All data is stored in a personal Firebase project. Nothing is shared with third
parties.

## Not built

- Rest timer
- Warm-up set marking, so warm-ups stop inflating weekly set counts
- Per-side logging for left/right asymmetry
- Progress photos. Removed: an iPhone photo base64s to several MB inside a
  Firestore document, against a hard limit of 1MB, so it failed every time.
  Restoring it needs canvas downscaling or Firebase Storage.
