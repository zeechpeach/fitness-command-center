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
- Previous-session numbers beside every set, with a one-tap Copy
- Exercise approach variations (Standard, Heavy, Form Focus)
- Skill progression ladders for front lever, handstand and L-sit
- Pre- and post-session intensity ratings
- A session can be logged in parts: log at lunch, add to it in the evening, and
  it stays one saved session
- Sets autosave to the device as you type and survive backgrounding the tab

### The week
- **Weekly volume targets** per muscle group, shown at the top of the Workout
  tab: sets done against sets owed, ordered by what is furthest behind for the
  days remaining. The week is the unit, not the day - hit the volume across
  whatever days open up and the week is a success.
- Credit is capped per group, so a big day on one muscle cannot paper over
  another that was never trained.

### Schedule
- Custom programs of any length, built in Settings or pasted in as JSON
- **The schedule is a queue, not a calendar rotation.** A slot is consumed only
  when that session is actually completed, so a missed session rolls to
  tomorrow and everything behind it slides. Rest slots are consumed by time.
- A session done out of order resumes the cycle after it
- Calendar view with completed, scheduled and missed days
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
- Calorie and protein targets scaled to bodyweight and goal
- Training-day vs rest-day comparison over the last 14 days

### Body metrics
- Daily weight logging with a 7-day moving average
- Weight progress chart
- Body goal (cutting, bulking, maintaining) with a projected completion date

### Analytics
- Estimated 1RM (Epley) per lift, so extra reps at the same load count
- Hard sets per muscle group per week, which counts bodyweight and skill work
  that volume-in-pounds scores as zero
- Workout streak and adherence, measured against the pace the program
  prescribes over the days actually available
- Strength progression and plateau detection
- Session comparison by exercise type

### Travel and sick days
Both pause the schedule without counting as missed workouts or breaking the
streak, and are removed from the adherence denominator.

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

Export everything as JSON from Settings.

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
