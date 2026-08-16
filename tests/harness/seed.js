// Canned Firestore data for the tests, in the exact document shapes the app
// itself writes. Getting these shapes wrong produces tests that pass against
// data the app would never actually store.
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./server');

// The owner's real program, read from the file in the repo root.
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'my-program.txt'), 'utf8'));

function realProgram(overrides = {}) {
  const schedule = {};
  Object.entries(src.schedule).forEach(([key, name]) => {
    schedule[key] = { workoutType: name, customName: name };
  });
  return {
    id: 'prog-real',
    name: src.name,
    active: true,
    createdAt: '2026-06-01T08:00:00.000Z',
    activatedAt: '2026-06-01T08:00:00.000Z',
    schedule,
    workouts: JSON.parse(JSON.stringify(src.workouts)),
    exerciseVariations: {},
    ...overrides
  };
}

// A deliberately awkward program: one day that is nothing but holds and cardio,
// which is the shape that used to be impossible to save.
function holdsAndCardioProgram() {
  return {
    id: 'prog-holds',
    name: 'Holds And Cardio',
    active: true,
    createdAt: '2026-06-01T08:00:00.000Z',
    activatedAt: '2026-06-01T08:00:00.000Z',
    schedule: {
      day1: { workoutType: 'Holds Day', customName: 'Holds Day' },
      day2: { workoutType: 'Rest', customName: 'Rest' }
    },
    workouts: {
      'Holds Day': [
        { name: 'Hollow Body Hold', sets: 3, reps: '20-30 sec', trackingType: 'time' },
        { name: 'Wall Handstand Hold', sets: 2, reps: '30-45 sec', trackingType: 'time' },
        { name: 'Incline Treadmill Walk', sets: 1, reps: '20 min', trackingType: 'duration' }
      ],
      'Rest': []
    },
    exerciseVariations: {}
  };
}

function dayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Six weeks of plausible history covering all five tracking types, with a few
// days missed so the adherence and streak numbers have something to chew on.
function workoutHistory() {
  const days = Object.values(src.schedule);
  const out = [];
  let n = 0;
  for (let back = 42; back >= 1; back--) {
    if (back % 8 === 0) continue;                 // some missed days
    const day = days[n % days.length];
    const exercises = {};
    (src.workouts[day] || []).slice(0, 4).forEach((exercise, i) => {
      const type = exercise.trackingType;
      const sets = [];
      for (let s = 0; s < Math.min(exercise.sets || 3, 3); s++) {
        if (type === 'weight_reps') sets.push({ weight: String(95 + n), reps: String(8 - (s % 3)), notes: '' });
        else if (type === 'time') sets.push({ seconds: String(25 + n % 15), notes: '' });
        else if (type === 'duration') sets.push({ minutes: String(20 + n % 10), notes: '' });
        else if (type === 'reps') sets.push({ reps: String(10 + n % 5), notes: '' });
        else sets.push({ completed: true });
      }
      exercises[i] = { exercise: exercise.name, trackingType: type, sets };
    });
    out.push({
      id: 'w' + n, date: dayStr(-back), day, programId: 'prog-real',
      timestamp: dayStr(-back) + 'T10:00:00.000Z', exercises
    });
    n++;
  }
  return out;
}

// Note the shape: mealType (not meal), and a nested foods[] using `fats`.
function nutritionHistory(days = 20) {
  const out = [];
  for (let back = days; back >= 0; back--) {
    ['breakfast', 'lunch', 'dinner'].forEach((mealType, i) => {
      out.push({
        id: `n${back}-${i}`, date: dayStr(-back), mealType, time: '08:00',
        foods: [{
          name: ['Oats', 'Chicken and rice', 'Salmon and potatoes'][i],
          calories: [520, 780, 690][i],
          protein: [28, 55, 45][i],
          carbs: [70, 85, 55][i],
          fats: [12, 18, 24][i],
          quantity: 1
        }]
      });
    });
  }
  return out;
}

function weightHistory() {
  const out = [];
  for (let back = 40; back >= 0; back -= 2) {
    out.push({ id: 'wt' + back, date: dayStr(-back), weight: 178 - (40 - back) * 0.12 });
  }
  return out;
}

module.exports = {
  src, realProgram, holdsAndCardioProgram,
  workoutHistory, nutritionHistory, weightHistory
};
