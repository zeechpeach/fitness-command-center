// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, limit, deleteDoc, doc, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBouZ7KMUMSf8RdBKudMW2qEXI_FHgchIU",
    authDomain: "fitness-command-center.firebaseapp.com",
    projectId: "fitness-command-center",
    storageBucket: "fitness-command-center.firebasestorage.app",
    messagingSenderId: "416632779679",
    appId: "1:416632779679:web:768ab3ec04da3aecac03aa",
    measurementId: "G-F06G7Y9V25"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Enable offline persistence for faster repeat visits
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.log('Persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.log('Persistence not available in this browser');
        } else {
            console.error('Persistence error:', err);
        }
    });

// Authentication state
let currentUser = null;

// Global state
let currentDay = '';    // empty until a session is chosen - nothing is assigned
let currentWorkout = {};
let allWorkouts = [];
let workoutIntensity = {
    preWorkout: { energy: null, motivation: null },
    postWorkout: { fatigue: null, satisfaction: null }
};
let charts = {};
let currentCalendarDate = new Date();
let selectedCalendarDay = null;
let nutritionData = [];
window.nutritionData = nutritionData;
// Deliberately empty. Initialising from toISOString() gave tomorrow's date
// after 5pm Pacific. bootUIFromCache() sets this via the timezone-aware
// getTodayDateString() before anything reads it.
let currentNutritionDate = '';
let currentEditingMealId = null; // Track which meal is currently being edited
let weightData = [];
window.weightData = weightData;
let programs = [];
let activeProgram = null;
let savedFoods = [];
// This module-scoped array was aliased to window.travelModeData at startup,
// but loadTravelModeData() REBINDS the window property to a brand new array,
// leaving this one permanently empty. getScheduleTimelineKey read this copy, so
// its travel component was always 0, the schedule cache was never invalidated
// when travel was enabled, and travel days stayed painted red as missed.
let travelModeData = [];
window.travelModeData = travelModeData;
let sickDayData = [];
window.sickDayData = sickDayData;
window.savedFoods = savedFoods;
let bodyGoalData = null;
window.bodyGoalData = bodyGoalData;

// Program Editor State
let currentEditingProgram = null; // Program being edited
let unsavedChanges = false; // Track if save needed
let saveTimeout = null; // For debounced saving
let currentExercisePanelContext = null; // { workoutType, exerciseIndex (null for new) }

// Program Editor Constants
const MAX_CYCLE_LENGTH = 14;
const MIN_CYCLE_LENGTH = 1;
const MAX_EXERCISE_SETS = 100;
const MAX_EXERCISE_REPS = 1000;

// Utility: Deep clone object safely
function deepClone(obj) {
    try {
        // Use structuredClone if available (modern browsers)
        if (typeof structuredClone === 'function') {
            return structuredClone(obj);
        }
    } catch (e) {
        console.warn('structuredClone failed, falling back to JSON:', e);
    }
    // Fallback to JSON with error handling
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error('Deep clone failed:', e);
        return obj; // Return original if all else fails
    }
}

const workoutPlans = {
    Upper: [
        { name: 'Incline Dumbbell Press', sets: 3, reps: 8 },
        { name: 'Seated Cable Fly', sets: 2, reps: 10 },
        { name: 'Weighted Pull-Ups', sets: 3, reps: 6 },
        { name: 'High Cable Lateral Raise', sets: 2, reps: 10 },
        { name: 'Deficit Pendlay Row', sets: 2, reps: 8 },
        { name: 'Cable Tricep Extension', sets: 2, reps: 10 },
        { name: 'Bayesian Cable Bicep Curl', sets: 2, reps: 10 }
    ],
    Lower: [
        { name: 'Lying Leg Curls', sets: 2, reps: '8+partial to failure' },
        { name: 'Barbell Squat', sets: 3, reps: 8 },
        { name: 'Romanian Deadlift', sets: 3, reps: 8 },
        { name: 'Leg Extension', sets: 2, reps: 10 },
        { name: 'Hip Abduction', sets: 2, reps: 10 },
        { name: 'Standing Calf Raise', sets: 3, reps: 10 }
    ],
    Rest: [
        { name: 'Rest Day Recovery', sets: 1, reps: 'Complete' }
    ],
    Push: [
        { name: 'Barbell Bench Press', sets: 1, reps: '3-5 with warmup ladder (15, 5, 3, 2, 1)' },
        { name: 'Dumbbell Larsen Press', sets: 2, reps: '10 (75% of bench press weight)' },
        { name: 'Standing Arnold Press', sets: 3, reps: '8-10' },
        { name: 'Cable Press-Around (Superset)', sets: 2, reps: '12-15' },
        { name: 'Pec Stretch (Superset)', sets: 2, reps: '30 seconds' },
        { name: 'Cross-Body Cable Y-Raise', sets: 3, reps: '12-15' },
        { name: 'Squeeze-Only Pressdown (Superset)', sets: 3, reps: 8 },
        { name: 'Overhead Extension - Extended Position (Superset)', sets: 3, reps: 8 },
        { name: 'Cross-Body Triceps Extension', sets: 2, reps: '10-12' }
    ],
    Pull: [
        { name: 'Lat Pulldown', sets: '4 feeder sets + 1-2 sets to failure + 1 dropset', reps: 'Varies' },
        { name: 'Machine Row/T-Bar Row/DB Helms Row', sets: 3, reps: '10-12' },
        { name: 'Bottom Half DB Lat Pullovers (Superset)', sets: 2, reps: '10-12' },
        { name: 'Static Lat Stretching (Superset)', sets: 2, reps: '30 seconds' },
        { name: 'Omni Directional Face Pulls', sets: 3, reps: '12-15' },
        { name: 'EZ Bar Bicep Curl', sets: 3, reps: '6-8' },
        { name: 'Bottom-Half DB Preacher Curl', sets: 2, reps: '10-12' }
    ],
    Legs: [
        { name: 'Squats - Warmup 20%', sets: 1, reps: 10 },
        { name: 'Squats - Warmup 35%', sets: 1, reps: 5 },
        { name: 'Squats - Warmup 55%', sets: 1, reps: 3 },
        { name: 'Squats - Warmup 70%', sets: 1, reps: 2 },
        { name: 'Squats - Warmup 80%', sets: 1, reps: 1 },
        { name: 'Squats - 85-90%', sets: 1, reps: '2-4' },
        { name: 'Paused Squats (75% of working weight)', sets: 2, reps: 5 },
        { name: 'Romanian Deadlift', sets: 3, reps: '8-10' },
        { name: 'Walking Lunges', sets: 2, reps: '10 per leg' },
        { name: 'Seated Leg Curl', sets: 3, reps: '10-12' },
        { name: 'Leg Press Toe Press', sets: 4, reps: '10-12' },
        { name: 'Decline Plate Crunch', sets: 3, reps: '10-12' },
    ]
};

// Firebase functions
// completeWorkout writes every session to localStorage BEFORE trying the
// network, but until now nothing ever read that backup back: a failed save
// left the session invisible on the device forever. On boot, any backup from
// the last 14 days with no matching Firestore row is re-saved automatically.
async function reconcileLocalBackups() {
    let backups;
    try { backups = JSON.parse(localStorage.getItem('fitnessData') || '{}'); }
    catch (e) { return; }
    const keys = Object.keys(backups);
    if (!keys.length) return;

    const cutoff = addDaysToDateString(getTodayDateString(), -14);
    // Several backups of the same session exist when Complete was pressed more
    // than once (a split session, or retries after an error). The LAST write
    // per (date, day) is the most complete form.
    const latest = new Map();
    let changed = false;

    keys.sort().forEach(key => {
        const data = backups[key];
        if (!data || !data.date || !data.day || data.date < cutoff) {
            delete backups[key];
            changed = true;
            return;
        }
        latest.set(data.date + '|' + normalizeLabel(data.day), { key, data });
    });

    let recovered = 0;
    for (const { key, data } of latest.values()) {
        const inCloud = allWorkouts.some(w =>
            w.date === data.date && normalizeLabel(w.day) === normalizeLabel(data.day));
        if (inCloud) {
            delete backups[key];
            changed = true;
            continue;
        }
        try {
            await saveWorkoutToFirebase(data);
            delete backups[key];
            changed = true;
            recovered++;
        } catch (e) {
            // Still offline or still failing - the backup stays for next boot.
            console.error('Backup recovery failed, will retry next load:', e);
        }
    }

    if (changed) {
        try { localStorage.setItem('fitnessData', JSON.stringify(backups)); } catch (e) { }
    }
    if (recovered > 0) {
        await loadWorkoutsFromFirebase();
        refreshStartupCache();
        renderWorkoutDaySelector();
        updateAnalytics();
        showToast(`Recovered ${recovered} unsaved session${recovered === 1 ? '' : 's'} from this device.`, 'success');
    }
}

async function saveWorkoutToFirebase(workoutData) {
    try {
        const docRef = await addDoc(collection(db, "workouts"), {
            ...workoutData,
            timestamp: new Date()
        });
        console.log("Workout saved with ID:", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding workout:", e);
        throw e;
    }
}

// Raw, unfiltered result of the last workouts query. Kept so the active
// program filter can be re-applied without another network round trip, which
// lets the programs and workouts queries run concurrently at startup.
// Shown in Settings -> Data health and bumped with the ?v= cache-buster in
// index.html, so "which code is this phone actually running" is answerable.
const APP_VERSION = '78';

let rawWorkouts = [];

// History is history. This used to filter out any workout whose programId did
// not match the active program - and because more than one program document
// can end up marked active (deactivating the old one is a separate write that
// can fail silently), WHICH program counted as active could differ between
// loads. A session saved under one pick was invisible under the other: still
// in Firestore, gone from every panel. That is how a logged workout "vanished"
// on Aug 18 and how a fresh session showed a week of 0% bars. Nothing is
// filtered any more; a logged session counts, whatever program stamped it.
function applyProgramFilterToWorkouts() {
    allWorkouts = rawWorkouts;
    return allWorkouts;
}

async function loadWorkoutsFromFirebase() {
    try {
        // Load only last 90 days of workouts for better performance
        // Use more robust date calculation
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setTime(ninetyDaysAgo.getTime() - NINETY_DAYS_IN_MS);
        const dateThreshold = ninetyDaysAgo.toISOString().split('T')[0];

        // Query with date filter - note: descending orderBy with where inequality
        // may require a Firestore index. Falls back to simpler query if needed.
        const q = query(
            collection(db, "workouts"),
            where("date", ">=", dateThreshold),
            orderBy("date", "desc"),
            limit(100)
        );
        const querySnapshot = await getDocs(q);
        const workouts = [];
        querySnapshot.forEach((doc) => {
            workouts.push({ id: doc.id, ...doc.data() });
        });
        rawWorkouts = workouts;
        // Filtering is a separate step so this query can start before the
        // programs query has resolved.
        applyProgramFilterToWorkouts();
        console.log(`Loaded ${rawWorkouts.length} workouts`);
        return allWorkouts;
    } catch (e) {
        console.error("Error loading workouts:", e);
        // Fallback to simpler query if date filtering fails
        try {
            const q = query(collection(db, "workouts"), orderBy("timestamp", "desc"), limit(50));
            const querySnapshot = await getDocs(q);
            const workouts = [];
            querySnapshot.forEach((doc) => {
                workouts.push({ id: doc.id, ...doc.data() });
            });
            rawWorkouts = workouts;
            applyProgramFilterToWorkouts();
            console.log(`Loaded ${rawWorkouts.length} workouts (fallback query)`);
            return allWorkouts;
        } catch (fallbackError) {
            console.error("Fallback query also failed:", fallbackError);
            // Silent failure here looked exactly like "all my workouts are
            // gone": 0% bars, an empty calendar, no explanation anywhere.
            showConnectionNotice('Could not load your workouts. Showing what is saved on this device.');
            return [];
        }
    }
}

async function loadNutritionData() {
    try {
        // Was limit(30) DOCUMENTS. Because every food is its own document, that
        // was roughly four days of history, so browsing back a week showed
        // false empties and the "past 7 days" averages covered a window that
        // mostly did not exist.
        const nutritionFrom = addDaysToDateString(getTodayDateString(), -30);
        const q = query(
            collection(db, "nutrition"),
            where("date", ">=", nutritionFrom),
            orderBy("date", "desc"),
            limit(600)
        );
        const querySnapshot = await getDocs(q);
        const nutrition = [];
        const seenIds = new Set();

        querySnapshot.forEach((doc) => {
            // Prevent duplicate IDs
            if (!seenIds.has(doc.id)) {
                seenIds.add(doc.id);
                nutrition.push({ id: doc.id, ...doc.data() });
            }
        });

        nutritionData = nutrition;
        window.nutritionData = nutrition;
        console.log("Loaded nutrition data:", nutrition.length, "entries");
        return nutrition;
    } catch (e) {
        console.error("Error loading nutrition:", e);
        return [];
    }
}

async function loadWeightData() {
    try {
        const q = query(collection(db, "weight"), orderBy("date", "desc"), limit(90));
        const querySnapshot = await getDocs(q);
        const weights = [];
        querySnapshot.forEach((doc) => {
            weights.push({ id: doc.id, ...doc.data() });
        });
        weightData = weights;
        window.weightData = weights;
        console.log("Loaded weight data:", weights.length);
        return weights;
    } catch (e) {
        console.error("Error loading weight:", e);
        return [];
    }
}

// Body Goal Functions
async function loadBodyGoalData() {
    try {
        const q = query(collection(db, "bodyGoals"), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            bodyGoalData = { id: doc.id, ...doc.data() };
            window.bodyGoalData = bodyGoalData;
            console.log("Loaded body goal data:", bodyGoalData);
            populateBodyGoalForm();
            updateBodyGoalDisplay();
            updateNutritionCalories();
            return bodyGoalData;
        }
        return null;
    } catch (e) {
        console.error("Error loading body goal:", e);
        return null;
    }
}

function populateBodyGoalForm() {
    if (!bodyGoalData) return;

    const goalSelect = document.getElementById('body-goal-select');
    const targetWeightInput = document.getElementById('target-weight-input');
    const goalStartDateInput = document.getElementById('goal-start-date-input');

    if (goalSelect && bodyGoalData.bodyGoal) {
        goalSelect.value = bodyGoalData.bodyGoal;
    }
    if (targetWeightInput && bodyGoalData.targetWeight) {
        targetWeightInput.value = bodyGoalData.targetWeight;
    }
    if (goalStartDateInput && bodyGoalData.goalStartDate) {
        goalStartDateInput.value = bodyGoalData.goalStartDate;
    }
}

window.saveBodyGoal = async function () {
    const bodyGoal = document.getElementById('body-goal-select').value;
    const targetWeight = parseFloat(document.getElementById('target-weight-input').value);
    const goalStartDate = document.getElementById('goal-start-date-input').value;

    if (!bodyGoal || !targetWeight || !goalStartDate) {
        console.log('Missing required fields for body goal');
        return;
    }

    // Validation
    if (isNaN(targetWeight)) {
        alert('Please enter a valid number for target weight');
        return;
    }

    if (targetWeight <= 0) {
        alert('Target weight must be greater than zero');
        return;
    }

    const goalData = {
        bodyGoal,
        targetWeight,
        goalStartDate,
        updatedAt: new Date().toISOString()
    };

    try {
        if (bodyGoalData && bodyGoalData.id) {
            // Update existing
            await updateDoc(doc(db, "bodyGoals", bodyGoalData.id), goalData);
            bodyGoalData = { id: bodyGoalData.id, ...goalData };
        } else {
            // Create new
            const docRef = await addDoc(collection(db, "bodyGoals"), goalData);
            bodyGoalData = { id: docRef.id, ...goalData };
        }
        window.bodyGoalData = bodyGoalData;
        console.log('Body goal saved:', bodyGoalData);
        updateBodyGoalDisplay();
        updateNutritionCalories();
    } catch (e) {
        console.error("Error saving body goal:", e);
        alert('Error saving body goal');
    }
};

// ---------------------------------------------------------------------------
// The calorie target, made honest.
//
// This was a flat weight x 14.5 - one multiplier standing in for every life.
// For someone coaching fencing fifteen hours a week it undershot badly, and an
// undershot target on a cut is how training quality and muscle go.
//
// Maintenance is now a sedentary baseline plus the activity actually logged in
// the last 7 days, averaged per day. A tournament weekend raises the target
// that week; a quiet week lowers it. Nothing is estimated from promises - only
// from what was logged.
// ---------------------------------------------------------------------------

const BASELINE_CALS_PER_LB = 13;      // sedentary maintenance, desk job
const FENCING_CALS_PER_HOUR = 350;    // scaled by kind: coaching 210, training 350, tournament 420
const CALS_PER_HARD_SET = 7;          // a set plus its rest, averaged

function getDailyActivityCalories() {
    const today = getTodayDateString();
    const from = addDaysToDateString(today, -6);
    let total = 0;

    fencingEntriesBetween(from, today).forEach(entry => {
        const hours = Math.min(Number(entry.hours) || 0, FENCING_HOURS_CAP);
        total += hours * FENCING_CALS_PER_HOUR * fencingKindWeight(entry.kind);
    });

    allWorkouts.forEach(workout => {
        if (!workout || workout.date < from || workout.date > today) return;
        if (isNonTrainingLabel(workout.day)) return;
        Object.values(workout.exercises || {}).forEach(exercise => {
            total += ((exercise && exercise.sets) || []).filter(isWorkingSet).length * CALS_PER_HARD_SET;
        });
    });

    return Math.round(total / 7);
}

function calculateMaintenanceCalories(weight) {
    return Math.round(weight * BASELINE_CALS_PER_LB) + getDailyActivityCalories();
}

function calculateTargetCalories(weight, bodyGoal) {
    const maintenance = calculateMaintenanceCalories(weight);

    switch (bodyGoal) {
        case 'cutting':
            return maintenance - 500;
        case 'bulking':
            return maintenance + 250;
        case 'maintaining':
            return maintenance;
        default:
            return maintenance;
    }
}

// Most recent weigh-in BY DATE rather than by insertion order.
function getLatestWeight() {
    if (!Array.isArray(weightData) || weightData.length === 0) return null;
    let best = null;
    weightData.forEach(w => {
        const value = parseFloat(w && w.weight);
        if (!w || !w.date || !Number.isFinite(value) || value <= 0) return;
        if (!best || w.date > best.date) best = { date: w.date, weight: value };
    });
    return best ? best.weight : null;
}

function calculate7DayMovingAverage(weightHistory) {
    if (!weightHistory || weightHistory.length === 0) return null;

    // Sort by date descending
    const sorted = [...weightHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Take entries from the last 7 DAYS. Taking the last 7 entries meant that
    // weighing in twice a week made the "7-day average" span three and a half
    // weeks.
    const cutoff = addDaysToDateString(getTodayDateString(), -6);
    let window = sorted.filter(w => w.date >= cutoff);
    if (window.length === 0) window = sorted.slice(0, Math.min(7, sorted.length));

    // One malformed document used to turn the whole average into NaN.
    const values = window
        .map(w => parseFloat(w.weight))
        .filter(v => Number.isFinite(v) && v > 0);
    if (values.length === 0) return null;

    return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function calculateGoalEndDate(currentWeight, targetWeight, goalStartDate, bodyGoal) {
    if (!currentWeight || !targetWeight || !goalStartDate || !bodyGoal) return null;

    if (bodyGoal === 'maintaining') return null;

    const weightDiff = Math.abs(targetWeight - currentWeight);
    let weeksToGoal;

    if (bodyGoal === 'cutting') {
        weeksToGoal = weightDiff / 1.0; // 1 lb per week
    } else if (bodyGoal === 'bulking') {
        weeksToGoal = weightDiff / 0.5; // 0.5 lb per week
    } else {
        return null;
    }

    // Anchor to TODAY. Anchoring to goalStartDate while measuring weight still
    // remaining made the projection move earlier every week and eventually
    // point at a date already past.
    return addDaysToDateString(getTodayDateString(), Math.ceil(weeksToGoal * 7));
}

// Change between the current 7-day average and the average of the 7 days before
// that. Returns null when there is not enough history to say anything.
function getWeightTrend() {
    if (!Array.isArray(weightData) || weightData.length < 4) return null;

    const sorted = weightData
        .filter(w => w && w.date && Number.isFinite(parseFloat(w.weight)))
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
    if (sorted.length < 4) return null;

    const today = getTodayDateString();
    const recentFrom = addDaysToDateString(today, -6);
    const priorFrom = addDaysToDateString(today, -13);

    const mean = (rows) => rows.length
        ? rows.reduce((sum, w) => sum + parseFloat(w.weight), 0) / rows.length
        : null;

    const recent = mean(sorted.filter(w => w.date >= recentFrom));
    const prior = mean(sorted.filter(w => w.date >= priorFrom && w.date < recentFrom));

    // Not enough spread by date, so fall back to comparing halves of the log.
    if (recent === null || prior === null) {
        const half = Math.floor(sorted.length / 2);
        const newHalf = mean(sorted.slice(0, half));
        const oldHalf = mean(sorted.slice(half));
        if (newHalf === null || oldHalf === null) return null;
        return newHalf - oldHalf;
    }

    return recent - prior;
}

function checkIfOnTrack(movingAverage, targetWeight, currentWeight, bodyGoal) {
    if (!movingAverage || !targetWeight || !bodyGoal) {
        return { isOnTrack: false, message: 'Set your goal to track progress' };
    }

    if (bodyGoal === 'maintaining') {
        const deviation = Math.abs(movingAverage - targetWeight);
        if (deviation <= 3) {
            return { isOnTrack: true, message: `On Track (within ±3 lbs of target)` };
        } else {
            return { isOnTrack: false, message: `Off Track (${deviation.toFixed(1)} lbs from target)` };
        }
    }

    // Compare the recent average against an older one. Comparing the average
    // against the latest weigh-in is circular, because that weigh-in is part of
    // the average, and it inverted the verdict.
    const trend = getWeightTrend();
    if (trend === null) {
        return { isOnTrack: false, message: 'Log a few more weigh-ins to see a trend' };
    }

    const magnitude = Math.abs(trend).toFixed(1);

    if (bodyGoal === 'cutting') {
        if (trend < -0.2) return { isOnTrack: true, message: `On Track (down ${magnitude} lbs)` };
        if (trend > 0.2) return { isOnTrack: false, message: `Off Track (up ${magnitude} lbs)` };
        return { isOnTrack: false, message: 'Holding steady, not yet trending down' };
    } else if (bodyGoal === 'bulking') {
        if (trend > 0.2) return { isOnTrack: true, message: `On Track (up ${magnitude} lbs)` };
        if (trend < -0.2) return { isOnTrack: false, message: `Off Track (down ${magnitude} lbs)` };
        return { isOnTrack: false, message: 'Holding steady, not yet trending up' };
    }

    return { isOnTrack: false, message: 'Unable to determine progress' };
}

function updateBodyGoalDisplay() {
    if (!bodyGoalData || !bodyGoalData.bodyGoal) {
        document.getElementById('goal-display-container').style.display = 'none';
        return;
    }

    document.getElementById('goal-display-container').style.display = 'block';

    // Latest weigh-in BY DATE. weightData[0] is whatever was logged most
    // recently, so entering a backdated weigh-in made a stale number the
    // "current weight" driving both this card and the calorie target.
    const currentWeight = getLatestWeight();

    // Calculate 7-day moving average
    const movingAvg = calculate7DayMovingAverage(weightData);

    // Calculate weight difference
    const weightDiff = currentWeight && bodyGoalData.targetWeight
        ? Math.abs(bodyGoalData.targetWeight - currentWeight)
        : null;

    // Calculate goal end date
    const goalEndDate = currentWeight
        ? calculateGoalEndDate(currentWeight, bodyGoalData.targetWeight, bodyGoalData.goalStartDate, bodyGoalData.bodyGoal)
        : null;

    // Update display
    document.getElementById('display-current-weight').textContent =
        currentWeight ? `${currentWeight.toFixed(1)} lbs` : '-- lbs';

    document.getElementById('display-moving-avg').textContent =
        movingAvg ? `${movingAvg.toFixed(1)} lbs` : '-- lbs (log weight first)';

    document.getElementById('display-weight-diff').textContent =
        weightDiff ? `${weightDiff.toFixed(1)} lbs` : '-- lbs';

    if (bodyGoalData.bodyGoal === 'maintaining') {
        document.getElementById('display-goal-date').textContent = 'Goal: Maintain current weight';
    } else {
        document.getElementById('display-goal-date').textContent =
            goalEndDate ? new Date(goalEndDate).toLocaleDateString() : '--';
    }

    // Update progress indicator
    const progressStatus = checkIfOnTrack(movingAvg, bodyGoalData.targetWeight, currentWeight, bodyGoalData.bodyGoal);
    const progressIndicator = document.getElementById('progress-indicator');
    const progressText = document.getElementById('progress-status-text');

    if (progressStatus.isOnTrack) {
        progressIndicator.className = 'progress-indicator on-track';
    } else {
        progressIndicator.className = 'progress-indicator off-track';
    }

    progressText.textContent = progressStatus.message;
}

// ---------------------------------------------------------------------------
// Protein target.
//
// The app had no macro targets at all. It only had a hardcoded absolute
// threshold buried in an insight string ("aim for 0.8-1g per lb") which was
// never scaled to the user's actual bodyweight. For a recomp, protein is the
// number that decides whether it works.
// ---------------------------------------------------------------------------
const PROTEIN_PER_LB = { cutting: 1.0, maintaining: 0.9, bulking: 0.8 };

function calculateProteinTarget(bodyWeight, bodyGoal) {
    const w = parseFloat(bodyWeight);
    if (!Number.isFinite(w) || w <= 0) return null;
    const perLb = PROTEIN_PER_LB[bodyGoal] || 0.9;
    return Math.round(w * perLb);
}

// Averages protein and calories on days a session was logged against days it
// was not. Moved here from the deleted Insights tab, which was the only card on
// it that computed anything.
function updateNutritionComparison() {
    const container = document.getElementById('nutrition-comparison');
    if (!container) return;

    const today = getTodayDateString();
    const from = addDaysToDateString(today, -13);

    const byDate = {};
    (nutritionData || []).forEach(meal => {
        if (!meal || !meal.date || meal.date < from || meal.date > today) return;
        if (!byDate[meal.date]) byDate[meal.date] = { calories: 0, protein: 0 };
        (meal.foods || []).forEach(food => {
            const qty = parseFloat(food.quantity) || 1;
            byDate[meal.date].calories += (parseFloat(food.calories) || 0) * qty;
            byDate[meal.date].protein += (parseFloat(food.protein) || 0) * qty;
        });
    });

    const trainingDates = new Set(
        allWorkouts.filter(w => normalizeLabel(w.day) !== 'rest').map(w => w.date));

    const split = { training: [], rest: [] };
    Object.entries(byDate).forEach(([date, totals]) => {
        split[trainingDates.has(date) ? 'training' : 'rest'].push(totals);
    });

    if (split.training.length + split.rest.length < 3) {
        container.textContent = 'Log nutrition for at least 3 days to see the comparison.';
        return;
    }

    const avg = (rows, key) => rows.length
        ? Math.round(rows.reduce((sum, r) => sum + r[key], 0) / rows.length) : null;

    const row = (label, rows) => {
        if (!rows.length) return `<div style="margin-bottom:0.375rem;">${label}: no days logged</div>`;
        return `<div style="margin-bottom:0.375rem;">
            <strong style="color: var(--color-text-primary);">${label}</strong>
            <span style="margin-left:0.5rem;">${avg(rows, 'calories')} kcal &middot; ${avg(rows, 'protein')}g protein</span>
            <span style="color: var(--color-text-secondary); font-size:0.8125rem;"> (${rows.length} day${rows.length === 1 ? '' : 's'})</span>
        </div>`;
    };

    let html = row('Training days', split.training) + row('Rest days', split.rest);

    const trainKcal = avg(split.training, 'calories');
    const restKcal = avg(split.rest, 'calories');
    if (trainKcal !== null && restKcal !== null) {
        const diff = trainKcal - restKcal;
        html += `<div style="margin-top:0.5rem; color: var(--color-text-secondary); font-size:0.8125rem;">
            You eat ${Math.abs(diff)} kcal ${diff >= 0 ? 'more' : 'less'} on training days.</div>`;
    }

    container.innerHTML = html;
}

function getTodaysProtein() {
    let total = 0;
    (nutritionData || [])
        .filter(meal => meal && meal.date === currentNutritionDate)
        .forEach(meal => {
            (meal.foods || []).forEach(food => {
                total += (parseFloat(food.protein) || 0) * (parseFloat(food.quantity) || 1);
            });
        });
    return total;
}

function updateNutritionCalories() {
    // The training-vs-rest comparison is independent of the calorie target, but
    // it used to be called only at the END of this function, behind both of the
    // early returns below. With no body goal or no weigh-in it therefore never
    // ran, and the panel sat on its placeholder ("log at least 3 days") forever
    // no matter how much food was logged.
    updateNutritionComparison();

    if (!bodyGoalData || !bodyGoalData.bodyGoal) {
        document.getElementById('calorie-target-card').style.display = 'none';
        return;
    }

    // The target follows the 7-day average rather than a single weigh-in, so a
    // 3 lb water swing stops moving the daily calorie goal by ~44 kcal.
    const averageWeight = calculate7DayMovingAverage(weightData);
    const currentWeight = Number.isFinite(averageWeight) && averageWeight > 0
        ? averageWeight
        : getLatestWeight();

    if (!currentWeight) {
        document.getElementById('calorie-target-card').style.display = 'none';
        return;
    }

    document.getElementById('calorie-target-card').style.display = 'block';

    const maintenanceCalories = calculateMaintenanceCalories(currentWeight);
    const targetCalories = calculateTargetCalories(currentWeight, bodyGoalData.bodyGoal);

    document.getElementById('maintenance-calories').textContent = maintenanceCalories;
    document.getElementById('target-calories').textContent = targetCalories;

    // Update label based on goal
    const labelMap = {
        'cutting': 'Cutting Goal',
        'bulking': 'Bulking Goal',
        'maintaining': 'Maintaining Goal'
    };
    document.getElementById('target-calories-label').textContent =
        labelMap[bodyGoalData.bodyGoal] || 'Your Goal';

    // Say where the number comes from. A target that visibly moves with logged
    // activity would otherwise look broken.
    const notice = document.getElementById('calorie-update-notice');
    if (notice) {
        const activity = getDailyActivityCalories();
        notice.textContent = activity > 0
            ? `Follows your 7-day average weight, plus ${activity} kcal/day from logged training and fencing`
            : 'Follows your 7-day average weight. Log training and fencing to raise it with your real week.';
    }

    // Calculate remaining calories
    const totalCalories = calculateTotalCalories();
    // Measured portions produce non-terminating quantities, so this rendered
    // values like 1706.5217391304348.
    const remaining = Math.round(targetCalories - totalCalories);
    document.getElementById('calories-remaining').textContent = remaining;

    const proteinTarget = calculateProteinTarget(currentWeight, bodyGoalData.bodyGoal);
    const proteinTargetEl = document.getElementById('protein-target');
    const proteinLeftEl = document.getElementById('protein-remaining');
    if (proteinTargetEl && proteinLeftEl) {
        if (proteinTarget) {
            proteinTargetEl.textContent = proteinTarget + 'g';
            proteinLeftEl.textContent = Math.round(proteinTarget - getTodaysProtein()) + 'g';
        } else {
            proteinTargetEl.textContent = '--';
            proteinLeftEl.textContent = '--';
        }
    }

    // Update remaining color
    const remainingElement = document.getElementById('calories-remaining');
    if (remaining < 0) {
        remainingElement.style.color = 'var(--color-error)'; // red
    } else if (remaining < 200) {
        remainingElement.style.color = 'var(--color-warning)'; // orange
    } else {
        remainingElement.style.color = 'var(--color-accent-primary)'; // cyan
    }
}

function calculateTotalCalories() {
    // Get current date nutrition
    const currentDateMeals = nutritionData.filter(m => m.date === currentNutritionDate);
    let total = 0;
    currentDateMeals.forEach(meal => {
        if (meal.foods) {
            meal.foods.forEach(food => {
                const quantity = food.quantity || 1;
                total += (parseFloat(food.calories) || 0) * quantity;
            });
        }
    });
    return total;
}

// Configuration for schedule calculation

// Timezone configuration - default to LA timezone, but respect device timezone when traveling
const DEFAULT_TIMEZONE = 'America/Los_Angeles';
let userTimezone = DEFAULT_TIMEZONE;
try {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Use detected timezone if different from LA (indicates user is traveling)
    if (detectedTimezone && detectedTimezone !== DEFAULT_TIMEZONE) {
        userTimezone = detectedTimezone;
        console.log('User appears to be traveling, using detected timezone:', userTimezone);
    } else {
        userTimezone = DEFAULT_TIMEZONE;
    }
} catch (e) {
    console.warn('Could not detect timezone, using default PST:', e);
}
console.log('Using timezone:', userTimezone);

// Timezone-aware date helper functions
function getTodayDateString() {
    // Get current date in the user's timezone (LA or device timezone)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(now); // Returns YYYY-MM-DD format
}

function getCurrentTimeString() {
    // Get current time in user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return formatter.format(now);
}

// ============================================
// PROGRAM BUILDER FUNCTIONS
// ============================================

// Settings Modal Functions
window.openSettings = function () {
    document.getElementById('settings-modal').classList.add('active');
    renderPrograms();
    renderDataHealth();
};

window.closeSettings = function () {
    document.getElementById('settings-modal').classList.remove('active');
};

// Load programs from Firestore
async function loadPrograms() {
    try {
        const q = query(collection(db, "programs"));
        const querySnapshot = await getDocs(q);
        programs = [];
        querySnapshot.forEach((doc) => {
            const program = { id: doc.id, ...doc.data() };
            // Migrate old schedule format to new format
            migrateScheduleFormat(program);
            programs.push(program);
        });

        console.log(`Loaded ${programs.length} programs`);

        // Find the active program. More than one document can be marked
        // active when a deactivation write failed; an unordered find() then
        // picked whichever came back first, and the pick could change between
        // loads. Take the most recently activated, deterministically, and
        // repair the stragglers in the background so the ambiguity heals.
        const activeCandidates = programs.filter(p => p.active);
        if (activeCandidates.length > 1) {
            activeCandidates.sort((a, b) =>
                String(b.activatedAt || '').localeCompare(String(a.activatedAt || '')));
            console.warn(`${activeCandidates.length} programs marked active; using "${activeCandidates[0].name}" (most recently activated) and repairing the rest.`);
            activeCandidates.slice(1).forEach(p => {
                p.active = false;
                updateDoc(doc(db, 'programs', p.id), { active: false })
                    .catch(err => console.error('Could not repair duplicate active program:', err));
            });
        }
        activeProgram = activeCandidates[0] || null;

        // If no programs exist, migrate hardcoded program
        if (programs.length === 0) {
            await migrateHardcodedProgram();
        }

        return programs;
    } catch (e) {
        // Returning [] used to leave activeProgram null, which made
        // getActiveWorkouts() fall back to the built-in ULPPL plan. A transient
        // network error therefore looked exactly like "my program was deleted"
        // and replaced it with a stranger's. Keep whatever we already have.
        console.error("Error loading programs:", e);
        showConnectionNotice('Could not reach your programs. Showing the last version saved on this device.');
        return programs;
    }
}

// ---------------------------------------------------------------------------
// Data health: what this device actually has, read live. Exists because "my
// bars are at 0%" arrived with no way to tell a failed save from a failed
// load from a stale cache from hidden data - four different problems with
// identical symptoms and only console.log to tell them apart.
// ---------------------------------------------------------------------------
function countUnsyncedBackups() {
    try {
        const backups = JSON.parse(localStorage.getItem('fitnessData') || '{}');
        const seen = new Set();
        Object.values(backups).forEach(b => {
            if (!b || !b.date || !b.day) return;
            const inCloud = allWorkouts.some(w =>
                w.date === b.date && normalizeLabel(w.day) === normalizeLabel(b.day));
            if (!inCloud) seen.add(b.date + '|' + normalizeLabel(b.day));
        });
        return seen.size;
    } catch (e) { return 0; }
}

function renderDataHealth() {
    const container = document.getElementById('data-health');
    if (!container) return;

    const today = getTodayDateString();
    const newest = allWorkouts.length
        ? allWorkouts.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0].date
        : null;
    const todaysWorkout = allWorkouts.find(w => w.date === today);
    const unsynced = countUnsyncedBackups();
    const activeCount = programs.filter(p => p.active).length;

    const row = (label, value, tone = '') =>
        `<div class="health-row${tone ? ' ' + tone : ''}">
            <span class="health-label">${label}</span>
            <span class="health-value">${value}</span>
         </div>`;

    container.innerHTML =
        row('App version', APP_VERSION) +
        row('Signed in', currentUser ? 'Yes' : 'NO - nothing can load or save', currentUser ? '' : 'bad') +
        row('Workouts on this device', String(allWorkouts.length), allWorkouts.length ? '' : 'bad') +
        row('Most recent session', newest || 'none') +
        row("Today's session", todaysWorkout
            ? `Saved (${escapeHtml(todaysWorkout.day)})`
            : 'Not saved yet', todaysWorkout ? 'good' : '') +
        row('Unsynced device backups', String(unsynced), unsynced ? 'bad' : '') +
        row('Programs / marked active', `${programs.length} / ${activeCount}`,
            activeCount > 1 ? 'bad' : '') +
        row('Active program', activeProgram ? escapeHtml(activeProgram.name) : 'none');
}

window.runDataHealthSync = async function () {
    const btn = document.getElementById('data-health-sync');
    if (btn) { btn.disabled = true; btn.textContent = 'Syncing...'; }
    try {
        await Promise.allSettled([loadPrograms(), loadWorkoutsFromFirebase()]);
        applyProgramFilterToWorkouts();
        await reconcileLocalBackups();
        refreshStartupCache();
        renderWorkoutDaySelector();
        renderCalendar();
        updateAnalytics();
        showToast('Sync finished.', 'success');
    } catch (e) {
        console.error('Manual sync failed:', e);
        showToast('Sync hit an error. The numbers below show where it stands.', 'error');
    }
    renderDataHealth();
    if (btn) { btn.disabled = false; btn.textContent = 'Sync now'; }
};

// One non-blocking banner for load failures, so a backend problem stops looking
// like data loss to someone who cannot open a console.
function showConnectionNotice(text) {
    let el = document.getElementById('connection-notice');
    if (!el) {
        el = document.createElement('div');
        el.id = 'connection-notice';
        el.className = 'connection-notice';
        el.innerHTML = `<span class="connection-notice-text"></span>
            <button type="button" class="connection-notice-retry" onclick="location.reload()">Retry</button>`;
        const container = document.querySelector('.container');
        if (container) container.insertBefore(el, container.firstChild);
        else document.body.appendChild(el);
    }
    el.querySelector('.connection-notice-text').textContent = text;
    el.classList.add('visible');
}

// Migrate old schedule format (string) to new format (object with customName)
function migrateScheduleFormat(program) {
    if (!program.schedule) return;
    
    let needsMigration = false;
    const migratedSchedule = {};
    
    Object.keys(program.schedule).forEach(dayKey => {
        const dayValue = program.schedule[dayKey];
        if (typeof dayValue === 'string') {
            // Old format: day1: "Upper"
            needsMigration = true;
            migratedSchedule[dayKey] = {
                workoutType: dayValue,
                customName: ''
            };
        } else {
            // Already new format or handle object format
            migratedSchedule[dayKey] = dayValue;
        }
    });
    
    if (needsMigration) {
        program.schedule = migratedSchedule;
        console.log(`Migrated schedule format for program: ${program.name}`);
    }
    
    // Ensure exerciseVariations exists
    if (!program.exerciseVariations) {
        program.exerciseVariations = {};
    }
}

// Helper: Get workout type for a day (handles both old and new formats)
function getWorkoutTypeForDay(program, dayKey) {
    if (!program || !program.schedule || !program.schedule[dayKey]) {
        return '';
    }
    const dayValue = program.schedule[dayKey];
    if (typeof dayValue === 'string') {
        return dayValue; // Old format
    }
    return dayValue.workoutType || ''; // New format - returns empty string if not set
}

// ---------------------------------------------------------------------------
// Substitute sessions.
//
// A program can define exercise lists that are not one of its scheduled days -
// a tournament circuit, a travel session, a pool day. There was no way to log
// those at all without editing the program, so they simply could not be
// trained.
//
// A substitute is addressed as `sub:<Workout Type>` wherever a day key is
// expected. It deliberately does NOT touch the schedule: buildScheduleTimeline
// only advances the queue for a logged session whose name matches a slot in the
// program, so a substitute consumes nothing and the session it displaced is
// still owed tomorrow. That is the behaviour we want - training a circuit
// instead of Lower A does not mean Lower A was done.
// ---------------------------------------------------------------------------
const SUBSTITUTE_DAY_PREFIX = 'sub:';

function isSubstituteDayKey(dayKey) {
    return typeof dayKey === 'string' && dayKey.startsWith(SUBSTITUTE_DAY_PREFIX);
}

function substituteDayKeyFor(workoutType) {
    return SUBSTITUTE_DAY_PREFIX + workoutType;
}

// The workout type a day key refers to, whether it is a scheduled day (day3) or
// a substitute (sub:Tournament Circuit).
function resolveWorkoutTypeForDayKey(dayKey) {
    if (isSubstituteDayKey(dayKey)) return dayKey.slice(SUBSTITUTE_DAY_PREFIX.length);
    if (activeProgram && activeProgram.schedule) return getWorkoutTypeForDay(activeProgram, dayKey);
    return dayKey;
}

// Exercise lists the program defines that are not on any scheduled day.
function getSubstituteWorkoutTypes() {
    if (!activeProgram || !activeProgram.workouts) return [];
    const scheduled = new Set(
        Object.keys(activeProgram.schedule || {})
            .map(k => normalizeLabel(getWorkoutTypeForDay(activeProgram, k)))
            .filter(Boolean)
    );
    return Object.keys(activeProgram.workouts).filter(type => {
        const list = activeProgram.workouts[type];
        return Array.isArray(list) && list.length > 0 && !scheduled.has(normalizeLabel(type));
    });
}

// Helper: Get custom name for a day
function getCustomNameForDay(program, dayKey) {
    if (!program || !program.schedule || !program.schedule[dayKey]) {
        return '';
    }
    const dayValue = program.schedule[dayKey];
    if (typeof dayValue === 'object') {
        return dayValue.customName || '';
    }
    return ''; // Old format has no custom names
}

// Helper: Get display name for a day (custom name or workout type)
function getDisplayNameForDay(program, dayKey) {
    const customName = getCustomNameForDay(program, dayKey);
    if (customName) return customName;
    const workoutType = getWorkoutTypeForDay(program, dayKey);
    if (workoutType) return workoutType;
    // If no name set yet, prompt user to set one
    return '(click to name)';
}

// Migrate hardcoded workoutPlans to new program structure
async function migrateHardcodedProgram() {
    console.log('Migrating hardcoded ULPPL program...');

    const ulpplProgram = {
        name: "ULPPL",
        active: true,
        createdAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(), // NEW: Track when program was activated
        schedule: {
            day1: { workoutType: "Upper", customName: "" },
            day2: { workoutType: "Lower", customName: "" },
            day3: { workoutType: "Rest", customName: "" },
            day4: { workoutType: "Push", customName: "" },
            day5: { workoutType: "Pull", customName: "" },
            day6: { workoutType: "Legs", customName: "" },
            day7: { workoutType: "Rest", customName: "" }
        },
        workouts: {
            Upper: workoutPlans.Upper,
            Lower: workoutPlans.Lower,
            Rest: workoutPlans.Rest,
            Push: workoutPlans.Push,
            Pull: workoutPlans.Pull,
            Legs: workoutPlans.Legs
        },
        exerciseVariations: {}
    };

    try {
        const docRef = await addDoc(collection(db, "programs"), ulpplProgram);
        const newProgram = { id: docRef.id, ...ulpplProgram };
        programs.push(newProgram);
        activeProgram = newProgram;
        console.log('Successfully migrated ULPPL program');
        return newProgram;
    } catch (e) {
        console.error("Error migrating program:", e);
        return null;
    }
}

// Get active workouts (replaces direct workoutPlans usage)
function getActiveWorkouts() {
    if (activeProgram && activeProgram.workouts) {
        return activeProgram.workouts;
    }
    // Fallback to hardcoded if no active program
    return workoutPlans;
}

// Render programs list in settings
function renderPrograms() {
    const container = document.getElementById('programs-list');
    if (!container) return;

    let html = '';
    if (programs.length === 0) {
        html = '<p style="color: var(--color-text-secondary);">No programs yet. Create your first program!</p>';
    } else {
        programs.forEach(program => {
            const isActive = program.active;
            const cycleLength = Object.keys(program.schedule || {}).length;
            const createdDate = new Date(program.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            // Generate schedule preview
            const schedulePreview = Object.keys(program.schedule).slice(0, 7).map(key => {
                const workoutType = getWorkoutTypeForDay(program, key);
                const abbrev = workoutType === 'Rest' ? 'R' : workoutType[0];
                return abbrev;
            }).join(' → ');

            html += `
                        <div class="program-card ${isActive ? 'active' : ''}">
                            <div class="program-card-header">
                                <div class="program-card-title">
                                    <span class="program-name">${program.name}</span>
                                    ${isActive ? '<span class="program-active-badge">Active</span>' : ''}
                                </div>
                                <div class="program-actions">
                                    ${!isActive ? `<button class="btn" onclick="setActiveProgram('${program.id}')" style="font-size: 0.875rem; padding: 0.5rem 0.75rem;">Activate</button>` : ''}
                                    <button class="btn" onclick="openProgramEditor('${program.id}')" style="font-size: 0.875rem; padding: 0.5rem 0.75rem;">Edit</button>
                                    <button class="btn" onclick="duplicateProgram('${program.id}')" style="font-size: 0.875rem; padding: 0.5rem 0.75rem;">Duplicate</button>
                                    ${!isActive ? `<button class="btn" onclick="deleteProgram('${program.id}')" style="font-size: 0.875rem; padding: 0.5rem 0.75rem; background: rgba(196, 115, 109, 0.15); color: var(--color-error); border-color: rgba(196, 115, 109, 0.3);">Delete</button>` : ''}
                                </div>
                            </div>
                            <div class="program-meta">${cycleLength}-day cycle • ${schedulePreview}</div>
                            <div class="program-meta" style="margin-top: 0.25rem;">Created ${createdDate}</div>
                        </div>
                    `;
        });
    }

    container.innerHTML = html;
}

// Set active program
window.setActiveProgram = async function (programId) {
    try {
        // Deactivate all programs
        for (const program of programs) {
            program.active = false;
            const docRef = doc(db, "programs", program.id);
            await updateDoc(docRef, { active: false });
        }

        // Activate selected program
        const program = programs.find(p => p.id === programId);
        if (program) {
            program.active = true;
            program.activatedAt = new Date().toISOString(); // NEW: Track when program was activated
            
            const docRef = doc(db, "programs", programId);
            await updateDoc(docRef, { 
                active: true,
                activatedAt: program.activatedAt
            });
            activeProgram = program;

            // Reset currentDay to first day of new program before initialization
            // Nothing is pre-selected. The suggestion panel is the way into a
            // session; activating a program only changes what it draws from.
            currentDay = '';

            alert(`${program.name} is now your active program!`);
            renderPrograms();

            // Reload workouts to show only workouts from this program
            await loadWorkoutsFromFirebase();
            refreshStartupCache();

            // Re-render day selector for new program
            renderWorkoutDaySelector();
            
            // Refresh workout view if on workout tab
            initializeWorkout();
            updateSuggestions();
            updateAnalytics();
        }
    } catch (e) {
        console.error("Error setting active program:", e);
        alert('Error activating program. Please try again.');
    }
};

// Delete program
window.deleteProgram = async function (programId) {
    const program = programs.find(p => p.id === programId);
    if (!program) return;

    if (!confirm(`Delete program "${program.name}"? This cannot be undone.`)) {
        return;
    }

    try {
        const docRef = doc(db, "programs", programId);
        await deleteDoc(docRef);
        programs = programs.filter(p => p.id !== programId);
        alert('Program deleted successfully');
        renderPrograms();
    } catch (e) {
        console.error("Error deleting program:", e);
        alert('Error deleting program. Please try again.');
    }
};

// ========================================
// PROGRAM EDITOR FUNCTIONS
// ========================================

// Open program editor for new or existing program
window.openProgramEditor = function (programId = null) {
    if (programId) {
        // Edit existing program
        const program = programs.find(p => p.id === programId);
        if (!program) {
            alert('Program not found');
            return;
        }
        // Deep clone to avoid modifying original until saved
        currentEditingProgram = deepClone(program);
    } else {
        // Create new program with completely blank slate
        // Users define their own workout days with custom names
        currentEditingProgram = {
            id: null, // Will be set when saved
            name: 'New Program',
            active: false,
            createdAt: new Date().toISOString(),
            schedule: {},
            workouts: {},
            exerciseVariations: {} // New: program-level exercise variations
        };
    }

    // Close settings modal, open editor
    closeSettings();
    renderProgramEditor();
    document.getElementById('program-editor-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

// Close program editor.
//
// This is an autosave editor: edits are written 1s after you stop typing. Back
// used to ask "you have unsaved changes?" and then DISCARD them, so tapping
// Back within a second of the last edit threw away the whole program. Nothing
// here needs the user's permission - just flush the pending save first.
window.closeProgramEditor = async function () {
    const backBtn = document.querySelector('.program-editor-back');
    if (backBtn) backBtn.disabled = true;

    try {
        await flushProgramSave();
    } finally {
        if (backBtn) backBtn.disabled = false;
    }

    // Only ask if the write genuinely failed, where closing really would lose
    // work and the user needs the choice.
    if (unsavedChanges) {
        if (!confirm('Your changes could not be saved. Close anyway and lose them?')) {
            return;
        }
    }

    document.getElementById('program-editor-modal').classList.remove('active');
    document.body.style.overflow = '';
    currentEditingProgram = null;
    unsavedChanges = false;
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }

    // Reopen settings modal
    openSettings();
};

// Render the entire program editor UI
function renderProgramEditor() {
    if (!currentEditingProgram) return;

    // Set program name
    const nameInput = document.getElementById('program-name-input');
    nameInput.value = currentEditingProgram.name;
    nameInput.disabled = false;

    // Show/hide delete button based on whether this is a new program
    const deleteBtn = document.getElementById('program-delete-btn');
    if (currentEditingProgram.id && !currentEditingProgram.active) {
        deleteBtn.style.display = 'block';
        deleteBtn.disabled = false;
    } else if (currentEditingProgram.active) {
        deleteBtn.style.display = 'block';
        deleteBtn.disabled = true;
        deleteBtn.title = 'Cannot delete active program';
    } else {
        deleteBtn.style.display = 'none';
    }

    // Render schedule and workouts
    renderSchedulePills();
    renderWorkoutsAccordion();
}

// Toggle program name editing
// The field is already editable when the editor opens, so toggling `disabled`
// meant the first tap on the pencil made the name UNeditable. Just focus it.
window.toggleProgramNameEdit = function () {
    const nameInput = document.getElementById('program-name-input');
    if (!nameInput) return;
    nameInput.disabled = false;
    nameInput.focus();
    nameInput.select();
};

// Handle program name change (initialize once)
let programNameInputListenerAdded = false;
function initializeProgramNameInput() {
    if (programNameInputListenerAdded) return;

    const nameInput = document.getElementById('program-name-input');
    if (nameInput) {
        nameInput.addEventListener('input', function () {
            if (currentEditingProgram) {
                currentEditingProgram.name = this.value;
                markUnsavedChanges();
            }
        });
        programNameInputListenerAdded = true;
    }
}

// Update cycle length (add or remove days)
window.updateCycleLength = function (delta) {
    if (!currentEditingProgram) return;

    const schedule = currentEditingProgram.schedule;
    const currentLength = Object.keys(schedule).length;
    const newLength = currentLength + delta;

    // Validate length using constants
    if (newLength < MIN_CYCLE_LENGTH || newLength > MAX_CYCLE_LENGTH) {
        showEditorMessage(`A cycle can be ${MIN_CYCLE_LENGTH} to ${MAX_CYCLE_LENGTH} days.`);
        return;
    }

    if (delta > 0) {
        // Add new day - user will define the name
        schedule[`day${newLength}`] = { workoutType: '', customName: '' };
    } else {
        // Remove last day
        delete schedule[`day${currentLength}`];
    }

    markUnsavedChanges();
    renderSchedulePills();
};

// Render schedule pills
function renderSchedulePills() {
    if (!currentEditingProgram) return;

    const container = document.getElementById('schedule-pills');
    const schedule = currentEditingProgram.schedule;
    const length = Object.keys(schedule).length;

    // Update cycle length display
    document.getElementById('cycle-length-display').textContent = `${length}-day cycle`;

    let html = '';
    
    if (length === 0) {
        html = '<div style="padding: 2rem; text-align: center; color: var(--color-text-secondary);">Click "+" below to add your first day</div>';
    } else {
        for (let i = 1; i <= length; i++) {
            const dayKey = `day${i}`;
            const displayName = getDisplayNameForDay(currentEditingProgram, dayKey);
            
            const named = Boolean(getWorkoutTypeForDay(currentEditingProgram, dayKey));
            const isRest = normalizeLabel(getWorkoutTypeForDay(currentEditingProgram, dayKey)) === 'rest';
            html += `
                        <div class="schedule-pill${named ? '' : ' unnamed'}${isRest ? ' rest' : ''}" id="schedule-pill-${dayKey}"
                             role="button" tabindex="0" onclick="editProgramDayName(${i})">
                            <span class="schedule-pill-day">Day ${i}</span>
                            <span class="schedule-pill-workout">${escapeHtml(named ? displayName : 'Tap to name')}</span>
                            <button type="button" class="schedule-pill-edit" aria-label="Edit day ${i} name"
                                    onclick="event.stopPropagation(); editProgramDayName(${i})">Edit</button>
                            <button type="button" class="schedule-pill-remove" aria-label="Remove day ${i}"
                                    onclick="event.stopPropagation(); removeProgramDay(${i})">&times;</button>
                        </div>
                    `;
        }
    }

    container.innerHTML = html;
}

// Values from user input are interpolated into markup and into onclick
// attributes. A day named "Arm's Day" used to break every button in its
// accordion into a JavaScript syntax error with no visible explanation.
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeJsArg(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;')
        .replace(/\n/g, ' ').replace(/</g, '&lt;');
}

// A stable DOM-safe id for a workout type, since names contain spaces,
// slashes and apostrophes.
function workoutTypeSlug(workoutType) {
    return 'wt-' + String(workoutType == null ? '' : workoutType)
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Edit day name for a program day
// Naming a day used to go through browser prompt(). On a phone that is a
// cramped one-line box, and once Safari or Chrome offers "prevent this page
// from creating additional dialogs" and the user accepts, prompt() returns
// null forever and days can never be named again. This renders an inline
// editor instead.
window.editProgramDayName = function (dayNumber) {
    if (!currentEditingProgram) return;

    const dayKey = `day${dayNumber}`;
    const pill = document.getElementById(`schedule-pill-${dayKey}`);
    if (!pill) return;

    // The pill itself carries onclick="editProgramDayName(n)", so every tap
    // INSIDE the open editor bubbles back here. Re-rendering then rebuilt the
    // input from the saved name, which reset whatever was being typed and, on
    // Save, re-opened the box the user had just closed. Once the editor is
    // open, leave it alone.
    if (pill.querySelector('.pill-edit-form')) {
        const open = document.getElementById(`pill-input-${dayKey}`);
        if (open) open.focus();
        return;
    }

    const currentName = getWorkoutTypeForDay(currentEditingProgram, dayKey) || '';

    pill.innerHTML = `
        <div class="pill-edit-form">
            <input type="text" class="pill-edit-input" id="pill-input-${dayKey}"
                   value="${escapeHtml(currentName)}" placeholder="e.g. Push, Legs, Rest"
                   maxlength="40" autocomplete="off">
            <div class="pill-edit-actions">
                <button type="button" class="pill-edit-save"
                        onclick="event.stopPropagation(); commitProgramDayName(${dayNumber})">Save</button>
                <button type="button" class="pill-edit-cancel"
                        onclick="event.stopPropagation(); cancelProgramDayName()">Cancel</button>
            </div>
            <div class="pill-edit-hint">Name it Rest to make it a rest day.</div>
        </div>`;

    const input = document.getElementById(`pill-input-${dayKey}`);
    if (input) {
        input.focus();
        input.select();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); window.commitProgramDayName(dayNumber); }
            if (e.key === 'Escape') { e.preventDefault(); renderSchedulePills(); }
        });
    }
};

// Cancel has to be reachable from an inline onclick, which resolves names
// against the GLOBAL scope. renderSchedulePills is module-scoped, so the old
// `onclick="renderSchedulePills()"` threw ReferenceError and the button did
// nothing at all.
window.cancelProgramDayName = function () {
    renderSchedulePills();
};

window.commitProgramDayName = function (dayNumber) {
    if (!currentEditingProgram) return;

    const dayKey = `day${dayNumber}`;
    const input = document.getElementById(`pill-input-${dayKey}`);
    if (!input) return;

    const trimmedName = input.value.trim();
    if (trimmedName === '') {
        showEditorMessage('Give the day a name, or tap Cancel.');
        input.focus();
        return;
    }

    const oldName = getWorkoutTypeForDay(currentEditingProgram, dayKey) || '';

    // Two days sharing a name share one exercise list, and the logger can only
    // ever open the first of them.
    const clash = Object.keys(currentEditingProgram.schedule).some(key => {
        if (key === dayKey) return false;
        return normalizeLabel(getWorkoutTypeForDay(currentEditingProgram, key)) === normalizeLabel(trimmedName);
    });
    if (clash) {
        showEditorMessage(`Another day is already called "${trimmedName}". Give this one a different name.`);
        input.focus();
        return;
    }

    currentEditingProgram.schedule[dayKey] = { workoutType: trimmedName, customName: trimmedName };

    if (!currentEditingProgram.workouts) currentEditingProgram.workouts = {};

    // Carry the exercises across on rename. Previously a rename created a fresh
    // empty list under the new name and stranded everything under the old one,
    // so renaming "Push" to "Push A" silently emptied the day.
    if (oldName && oldName !== trimmedName && currentEditingProgram.workouts[oldName]) {
        // Copy the list across. Only delete the old key if no OTHER day still
        // uses that name: the app's own default program has two days both
        // called "Rest", so renaming one used to delete the other's exercises.
        currentEditingProgram.workouts[trimmedName] =
            JSON.parse(JSON.stringify(currentEditingProgram.workouts[oldName]));

        const stillUsed = Object.keys(currentEditingProgram.schedule).some(key =>
            key !== dayKey &&
            normalizeLabel(getWorkoutTypeForDay(currentEditingProgram, key)) === normalizeLabel(oldName));
        if (!stillUsed) delete currentEditingProgram.workouts[oldName];
    } else if (!currentEditingProgram.workouts[trimmedName]) {
        currentEditingProgram.workouts[trimmedName] = [];
    }

    markUnsavedChanges();
    renderSchedulePills();
    renderWorkoutsAccordion();
};

// Non-blocking editor feedback, replacing alert() on routine paths.
function showEditorMessage(text, tone = 'warn') {
    let el = document.getElementById('program-editor-message');
    if (!el) {
        const host = document.getElementById('program-editor-modal') || document.body;
        el = document.createElement('div');
        el.id = 'program-editor-message';
        el.className = 'editor-message';
        host.appendChild(el);
    }
    el.textContent = text;
    el.dataset.tone = tone;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 3200);
}

// Removing a day used to be impossible without deleting the whole program.
window.removeProgramDay = function (dayNumber) {
    if (!currentEditingProgram || !currentEditingProgram.schedule) return;

    const keys = Object.keys(currentEditingProgram.schedule)
        .sort((a, b) => parseInt(a.replace('day', ''), 10) - parseInt(b.replace('day', ''), 10));
    if (keys.length <= 1) {
        showEditorMessage('A program needs at least one day.');
        return;
    }

    const removedType = getWorkoutTypeForDay(currentEditingProgram, `day${dayNumber}`);

    // The "x" sits in the middle of the pill, which at two or three days is
    // exactly where a thumb lands when aiming at the pill to rename it. This
    // deleted the day AND its exercise list silently, with no undo. Ask first
    // whenever there is something real to lose.
    const removedExercises = (removedType && currentEditingProgram.workouts &&
        Array.isArray(currentEditingProgram.workouts[removedType]))
        ? currentEditingProgram.workouts[removedType].length : 0;
    if (removedType) {
        const detail = removedExercises
            ? ` and its ${removedExercises} exercise${removedExercises === 1 ? '' : 's'}`
            : '';
        if (!confirm(`Remove Day ${dayNumber} (${removedType})${detail}?`)) return;
    }

    // Re-key the remaining days so they stay day1..dayN with no gaps.
    const remaining = keys
        .filter(k => k !== `day${dayNumber}`)
        .map(k => currentEditingProgram.schedule[k]);

    currentEditingProgram.schedule = {};
    remaining.forEach((value, idx) => { currentEditingProgram.schedule[`day${idx + 1}`] = value; });

    // Keep the exercise list only if no remaining day still uses that name.
    const stillUsed = Object.keys(currentEditingProgram.schedule).some(k =>
        normalizeLabel(getWorkoutTypeForDay(currentEditingProgram, k)) === normalizeLabel(removedType));
    if (removedType && !stillUsed && currentEditingProgram.workouts) {
        delete currentEditingProgram.workouts[removedType];
    }

    markUnsavedChanges();
    renderSchedulePills();
    renderWorkoutsAccordion();
};

// Render workouts accordion
function renderWorkoutsAccordion() {
    if (!currentEditingProgram) return;

    const container = document.getElementById('workouts-accordion');
    const workouts = currentEditingProgram.workouts;
    const schedule = currentEditingProgram.schedule;

    // Get sorted day keys (day1, day2, etc.)
    const dayKeys = Object.keys(schedule).sort((a, b) => {
        const numA = parseInt(a.replace('day', ''));
        const numB = parseInt(b.replace('day', ''));
        return numA - numB;
    });

    // Group days by workout type while preserving day order
    const workoutTypeMap = new Map(); // workoutType -> Array<{dayKey: string, dayNumber: number, displayName: string}>
    
    dayKeys.forEach(dayKey => {
        const dayNumber = parseInt(dayKey.replace('day', ''));
        const workoutType = getWorkoutTypeForDay(currentEditingProgram, dayKey);
        const displayName = getDisplayNameForDay(currentEditingProgram, dayKey);
        
        // Skip unnamed days or empty workout types
        if (!workoutType) return;
        
        if (!workoutTypeMap.has(workoutType)) {
            workoutTypeMap.set(workoutType, []);
        }
        
        workoutTypeMap.get(workoutType).push({ dayKey, dayNumber, displayName });
    });

    let html = '';
    
    // Get workout types in the order they first appear in the schedule
    const seenWorkoutTypes = new Set();
    const orderedWorkoutTypes = [];
    
    dayKeys.forEach(dayKey => {
        const workoutType = getWorkoutTypeForDay(currentEditingProgram, dayKey);
        if (workoutType && !seenWorkoutTypes.has(workoutType)) {
            seenWorkoutTypes.add(workoutType);
            orderedWorkoutTypes.push(workoutType);
        }
    });
    
    // Render accordion for each workout type in order of first appearance
    orderedWorkoutTypes.forEach(workoutType => {
        const days = workoutTypeMap.get(workoutType);
        const exercises = workouts[workoutType] || [];
        const exerciseCount = exercises.length;
        
        // Create header showing all days that use this workout type
        const dayLabels = days.map(d => {
            if (d.displayName !== workoutType) {
                return `Day ${d.dayNumber}: ${d.displayName}`;
            }
            return `Day ${d.dayNumber}`;
        }).join(', ');
        
        // Only show workout type in parentheses if no custom names are used for this workout type
        // Check that ALL days with this workout type use custom names, not just some
        const hasCustomNames = days.every(d => d.displayName !== workoutType);
        const headerName = hasCustomNames ? dayLabels : `${dayLabels} (${workoutType})`;
        
        const wtArg = escapeJsArg(workoutType);
        html += `
                    <div class="workout-accordion" id="${workoutTypeSlug(workoutType)}">
                        <div class="workout-accordion-header" role="button" tabindex="0"
                             onclick="toggleWorkoutAccordion('${wtArg}')">
                            <div class="workout-accordion-title">
                                <span class="workout-accordion-name">${escapeHtml(headerName)}</span>
                                <span class="workout-accordion-badge">${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}</span>
                            </div>
                            <span class="workout-accordion-toggle">&#9660;</span>
                        </div>
                        <div class="workout-accordion-content">
                            <div class="workout-accordion-body">
                                ${renderExercisesList(workoutType, exercises)}
                                <button type="button" class="add-exercise-btn" onclick="openAddExercisePanel('${wtArg}')">
                                    + Add Exercise
                                </button>
                            </div>
                        </div>
                    </div>
                `;
    });
    
    // Show helpful message if no workout types defined yet
    if (orderedWorkoutTypes.length === 0) {
        html = '<div style="padding: 2rem; text-align: center; color: var(--color-text-secondary);">Add days above and name them to define your workout types. Then you can add exercises here.</div>';
    }

    // Remember which panels were open BEFORE the rebuild. Without this the
    // accordion collapsed on every edit, so adding an exercise appeared to do
    // nothing and the move/delete buttons looked inert.
    const openSlugs = new Set(
        Array.prototype.slice.call(container.querySelectorAll('.workout-accordion.expanded'))
            .map(el => el.id));

    container.innerHTML = html;

    openSlugs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('expanded');
    });

    // With exactly one workout type, there is nothing to choose between, so
    // open it rather than making the user discover the tap.
    if (openSlugs.size === 0 && orderedWorkoutTypes.length === 1) {
        const only = container.querySelector('.workout-accordion');
        if (only) only.classList.add('expanded');
    }
}

// Render exercises list for a workout
function renderExercisesList(workoutType, exercises) {
    if (!exercises || exercises.length === 0) {
        return '<p style="color: var(--color-text-secondary); padding: 1rem 0;">No exercises yet. Add your first exercise!</p>';
    }

    const wt = escapeJsArg(workoutType);
    return exercises.map((exercise, index) => `
                <div class="exercise-row">
                    <div class="exercise-info">
                        <div class="exercise-name">${escapeHtml(exercise.name)}</div>
                        <div class="exercise-details">${escapeHtml(exercise.sets)} × ${escapeHtml(exercise.reps)}</div>
                    </div>
                    <div class="exercise-actions">
                        ${index > 0 ? `<button type="button" class="exercise-move-btn" onclick="moveExercise('${wt}', ${index}, -1)" aria-label="Move up">&#8593;</button>` : ''}
                        ${index < exercises.length - 1 ? `<button type="button" class="exercise-move-btn" onclick="moveExercise('${wt}', ${index}, 1)" aria-label="Move down">&#8595;</button>` : ''}
                        <button type="button" class="exercise-edit-btn" onclick="openEditExercisePanel('${wt}', ${index})" aria-label="Edit ${escapeHtml(exercise.name)}">Edit</button>
                        <button type="button" class="exercise-delete-btn" onclick="removeExercise('${wt}', ${index})" aria-label="Delete ${escapeHtml(exercise.name)}">Delete</button>
                    </div>
                </div>
            `).join('');
}

// Toggle workout accordion
window.toggleWorkoutAccordion = function (workoutType) {
    const accordion = document.getElementById(workoutTypeSlug(workoutType));
    if (accordion) {
        accordion.classList.toggle('expanded');
    }
};

// Open add exercise panel
window.openAddExercisePanel = function (workoutType) {
    currentExercisePanelContext = { workoutType, exerciseIndex: null };

    // Clear form
    const nameInput = document.getElementById('exercise-name-input');
    nameInput.value = '';
    document.getElementById('exercise-sets-input').value = '';
    document.getElementById('exercise-reps-input').value = '';
    document.getElementById('exercise-notes-input').value = '';

    const typeSelect = document.getElementById('exercise-type-input');
    if (typeSelect) {
        typeSelect.value = 'weight_reps';
        delete typeSelect.dataset.userChosen;
        typeSelect.addEventListener('change', () => { typeSelect.dataset.userChosen = 'true'; }, { once: true });
    }
    // Guess the tracking type from the name as it is typed, so a hold or a
    // walk does not silently default to asking for a weight.
    nameInput.oninput = window.maybeGuessExerciseType;
    window.updateExerciseTypeHint();

    // Update title and buttons
    document.getElementById('exercise-panel-title').textContent = `Add Exercise to ${workoutType}`;
    document.getElementById('exercise-delete-btn').style.display = 'none';

    // Show panel
    document.getElementById('exercise-panel').classList.add('active');
};

// Open edit exercise panel
window.openEditExercisePanel = function (workoutType, exerciseIndex) {
    if (!currentEditingProgram) return;

    const exercise = currentEditingProgram.workouts[workoutType][exerciseIndex];
    if (!exercise) return;

    currentExercisePanelContext = { workoutType, exerciseIndex };

    // Fill form with existing data
    const nameInput = document.getElementById('exercise-name-input');
    nameInput.value = exercise.name;
    document.getElementById('exercise-sets-input').value = exercise.sets;
    document.getElementById('exercise-reps-input').value = exercise.reps;
    document.getElementById('exercise-notes-input').value = exercise.notes || '';

    const typeSelect = document.getElementById('exercise-type-input');
    if (typeSelect) {
        // An exercise saved before tracking types existed has none, so fall
        // back to guessing from its name rather than defaulting to weights.
        typeSelect.value = exercise.trackingType && TRACKING_TYPES[exercise.trackingType]
            ? exercise.trackingType
            : guessTrackingType(exercise.name);
        typeSelect.dataset.userChosen = 'true';   // do not re-guess over a saved choice
    }
    nameInput.oninput = window.maybeGuessExerciseType;
    window.updateExerciseTypeHint();

    // Update title and buttons
    document.getElementById('exercise-panel-title').textContent = `Edit Exercise`;
    document.getElementById('exercise-delete-btn').style.display = 'block';

    // Show panel
    document.getElementById('exercise-panel').classList.add('active');
};

// Close exercise panel
window.closeExercisePanel = function () {
    document.getElementById('exercise-panel').classList.remove('active');
    currentExercisePanelContext = null;
};

// Save exercise (add or update)
// The type dropdown in the exercise panel, plus its hint line and the label on
// the target field, which reads "Reps" for lifts but "Hold (sec)" for a plank.
window.updateExerciseTypeHint = function () {
    const select = document.getElementById('exercise-type-input');
    const hint = document.getElementById('exercise-type-hint');
    const repsLabel = document.getElementById('exercise-reps-label');
    const repsInput = document.getElementById('exercise-reps-input');
    if (!select) return;

    const type = select.value;
    const meta = TRACKING_TYPES[type] || TRACKING_TYPES.weight_reps;
    if (hint) hint.textContent = meta.hint;

    const targets = {
        weight_reps: ['Reps', '8-12 or AMRAP'],
        reps:        ['Reps', '10-15'],
        time:        ['Target hold', '30 sec'],
        duration:    ['Target duration', '20 min'],
        checkoff:    ['Target', 'as prescribed']
    };
    const [label, placeholder] = targets[type] || targets.weight_reps;
    if (repsLabel) repsLabel.textContent = label;
    if (repsInput) repsInput.placeholder = placeholder;
};

// Guess the type as the name is typed, but stop guessing once the user has
// chosen for themselves.
window.maybeGuessExerciseType = function () {
    const select = document.getElementById('exercise-type-input');
    const nameInput = document.getElementById('exercise-name-input');
    if (!select || !nameInput || select.dataset.userChosen === 'true') return;
    select.value = guessTrackingType(nameInput.value);
    window.updateExerciseTypeHint();
};

window.saveExercise = function () {
    if (!currentEditingProgram || !currentExercisePanelContext) return;

    const { workoutType, exerciseIndex } = currentExercisePanelContext;

    // Get form values
    const name = document.getElementById('exercise-name-input').value.trim();
    const sets = document.getElementById('exercise-sets-input').value;
    const reps = document.getElementById('exercise-reps-input').value.trim();
    const notes = document.getElementById('exercise-notes-input').value.trim();

    // Validate
    if (!name) {
        showEditorMessage('Exercise name is required.');
        return;
    }
    if (!sets || sets < 1) {
        showEditorMessage('Sets must be at least 1.');
        return;
    }
    if (sets > MAX_EXERCISE_SETS) {
        showEditorMessage(`Sets cannot exceed ${MAX_EXERCISE_SETS}.`);
        return;
    }
    if (!reps) {
        showEditorMessage('Give it a target, for example 8-12 or 30 sec.');
        return;
    }
    // Validate reps: allow text like "8-12", "AMRAP", etc.
    // Only validate if it's a pure number (not a range or text)
    const repsNum = parseFloat(reps);
    if (!isNaN(repsNum) && reps.trim() === repsNum.toString()) {
        // Pure numeric value - validate against max
        if (repsNum > MAX_EXERCISE_REPS) {
            showEditorMessage(`Reps cannot exceed ${MAX_EXERCISE_REPS}.`);
            return;
        }
    }

    // Create exercise object
    const typeSelect = document.getElementById('exercise-type-input');
    const trackingType = typeSelect && TRACKING_TYPES[typeSelect.value]
        ? typeSelect.value
        : guessTrackingType(name);

    const exercise = { name, sets: parseInt(sets), reps, trackingType };
    if (notes) {
        exercise.notes = notes;
    }

    // Add or update
    if (exerciseIndex === null) {
        // Add new exercise
        if (!currentEditingProgram.workouts[workoutType]) {
            currentEditingProgram.workouts[workoutType] = [];
        }
        currentEditingProgram.workouts[workoutType].push(exercise);
    } else {
        // Update existing exercise
        currentEditingProgram.workouts[workoutType][exerciseIndex] = exercise;
    }

    markUnsavedChanges();
    renderWorkoutsAccordion();
    closeExercisePanel();
};

// Delete current exercise in panel
window.deleteCurrentExercise = function () {
    if (!currentExercisePanelContext || currentExercisePanelContext.exerciseIndex === null) return;

    const { workoutType, exerciseIndex } = currentExercisePanelContext;
    removeExercise(workoutType, exerciseIndex);
    closeExercisePanel();
};

// Remove exercise from workout
window.removeExercise = function (workoutType, exerciseIndex) {
    if (!currentEditingProgram) return;

    const exercise = currentEditingProgram.workouts[workoutType][exerciseIndex];
    if (!confirm(`Delete "${exercise.name}"?`)) return;

    currentEditingProgram.workouts[workoutType].splice(exerciseIndex, 1);

    markUnsavedChanges();
    renderWorkoutsAccordion();
};

// Move exercise up or down
window.moveExercise = function (workoutType, fromIndex, direction) {
    if (!currentEditingProgram) return;

    const exercises = currentEditingProgram.workouts[workoutType];
    const toIndex = fromIndex + direction;

    // Validate bounds
    if (toIndex < 0 || toIndex >= exercises.length) return;

    // Swap exercises
    [exercises[fromIndex], exercises[toIndex]] = [exercises[toIndex], exercises[fromIndex]];

    markUnsavedChanges();
    renderWorkoutsAccordion();
};

// Mark unsaved changes and trigger debounced save
function markUnsavedChanges() {
    unsavedChanges = true;

    // Clear existing timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    // Set new timeout for auto-save (1 second debounce)
    saveTimeout = setTimeout(() => {
        saveProgramToFirestore();
    }, 1000);
}

// Save program to Firestore
// ---------------------------------------------------------------------------
// Saving a program.
//
// Previously this was unserialized. Every edit scheduled a 1s debounced save
// with no in-flight guard, so on mobile latency a second save fired while `id`
// was still null and created a DUPLICATE program document. And because
// closeProgramEditor() nulls currentEditingProgram, tapping Back during a save
// threw a TypeError after the await, which surfaced as "Error saving program.
// Please try again." even though Firestore had accepted the write, while the
// program never made it into the local list.
// ---------------------------------------------------------------------------
let programSaveInFlight = false;
let programSaveQueued = false;

// Write any pending edit NOW instead of waiting out the 1s autosave debounce.
// Used when leaving the editor, so Back never races the timer.
async function flushProgramSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }

    // Let an in-flight write finish first, so this does not just get parked in
    // programSaveQueued and then dropped when currentEditingProgram is nulled.
    // Bounded so a dead connection cannot hang the Back button indefinitely.
    for (let i = 0; i < 60 && programSaveInFlight; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (unsavedChanges && currentEditingProgram) {
        await saveProgramToFirestore();
    }
}

async function saveProgramToFirestore() {
    if (!currentEditingProgram) return;

    // Serialize. A save already running will pick up the newest state when it
    // finishes rather than racing alongside this one.
    if (programSaveInFlight) {
        programSaveQueued = true;
        return;
    }

    if (!currentEditingProgram.name || currentEditingProgram.name.trim() === '') {
        // Was a blocking alert fired from the autosave timer, so clearing the
        // name to retype it stole focus mid-edit.
        showEditorMessage('Give the program a name to save it.');
        return;
    }

    programSaveInFlight = true;

    // Deep copy, because `programs[i] = {...currentEditingProgram}` is a shallow
    // spread: schedule and workouts stayed shared references with the object
    // still being edited, so unsaved edits leaked into the live program.
    // activatedAt was missing from this whitelist. Firestore kept it, but the
    // in-memory object and the boot cache were replaced WITHOUT it, so a single
    // program edit silently lost the schedule anchor and the adherence window
    // start, shifting the calendar and the score for reasons the user could not
    // connect to anything they did.
    const snapshot = {
        name: currentEditingProgram.name,
        active: currentEditingProgram.active,
        schedule: JSON.parse(JSON.stringify(currentEditingProgram.schedule || {})),
        workouts: JSON.parse(JSON.stringify(currentEditingProgram.workouts || {})),
        createdAt: currentEditingProgram.createdAt,
        activatedAt: currentEditingProgram.activatedAt || null,
        exerciseVariations: JSON.parse(JSON.stringify(currentEditingProgram.exerciseVariations || {}))
    };
    const existingId = currentEditingProgram.id;

    try {
        let savedId = existingId;

        if (existingId) {
            // A program created before it had content is not active yet. Once
            // it has days and exercises, it takes over.
            if (!snapshot.active && !programs.some(p => p.active && p.id !== existingId)) {
                const ready = Object.keys(snapshot.schedule).length > 0 &&
                    Object.values(snapshot.workouts || {}).some(l => Array.isArray(l) && l.length > 0);
                if (ready) {
                    snapshot.active = true;
                    snapshot.activatedAt = snapshot.activatedAt || new Date().toISOString();
                }
            }
            await updateDoc(doc(db, "programs", existingId), snapshot);
        } else {
            // Building a program is a signal you intend to use it, so it
            // becomes active. But autosave fires one second after the FIRST
            // KEYSTROKE of the name, and activating an empty program deactivated
            // the real one, emptied the day selector and stranded the user with
            // no workout at all. Only take over once it has something in it.
            const hasRealContent = Object.keys(snapshot.schedule).length > 0 &&
                Object.values(snapshot.workouts || {}).some(list => Array.isArray(list) && list.length > 0);
            snapshot.active = hasRealContent;
            if (snapshot.active) snapshot.activatedAt = new Date().toISOString();
            const docRef = await addDoc(collection(db, "programs"), snapshot);
            savedId = docRef.id;
            if (currentEditingProgram) currentEditingProgram.active = snapshot.active;
            // Re-check after the await. The editor may have been closed while
            // the write was in flight; that must not throw.
            if (currentEditingProgram) currentEditingProgram.id = savedId;
        }

        const saved = { id: savedId, ...snapshot };
        const index = programs.findIndex(p => p.id === savedId);
        if (index !== -1) programs[index] = saved;
        else programs.push(saved);

        // Deactivate the others in the background. Awaiting one updateDoc per
        // program sequentially is what made the Activate button appear dead on
        // a weak signal, because Firestore write promises settle on server ack.
        if (saved.active) {
            programs
                .filter(other => other.id && other.id !== savedId && other.active !== false)
                .forEach(other => {
                    other.active = false;
                    updateDoc(doc(db, "programs", other.id), { active: false })
                        .catch(err => console.error('Could not deactivate program:', err));
                });
        }

        if (saved.active) {
            activeProgram = saved;
            renderWorkoutDaySelector();
            initializeWorkout();
        }

        // The boot cache was never refreshed after a program save, so the next
        // launch painted the previous version until Firebase responded.
        refreshStartupCache();

        unsavedChanges = false;
        showSaveIndicator();
        if (!existingId && saved.active) {
            showToast(`"${saved.name}" is now your active program.`, 'success');
        }
        console.log('Program saved successfully');

    } catch (e) {
        console.error("Error saving program:", e);
        showEditorMessage('Could not save. Your changes are still here, and it will retry.', 'error');
        unsavedChanges = true;
    } finally {
        programSaveInFlight = false;
        if (programSaveQueued) {
            programSaveQueued = false;
            if (currentEditingProgram) saveProgramToFirestore();
        }
    }
}

// Show save indicator briefly
function showSaveIndicator() {
    const indicator = document.getElementById('save-indicator');
    indicator.classList.add('visible');
    setTimeout(() => {
        indicator.classList.remove('visible');
    }, 2000);
}

// Delete program with confirmation
window.deleteProgramWithConfirmation = function () {
    if (!currentEditingProgram || !currentEditingProgram.id) return;

    if (currentEditingProgram.active) {
        alert('Cannot delete the active program. Please activate a different program first.');
        return;
    }

    if (!confirm(`Delete program "${currentEditingProgram.name}"? This cannot be undone.`)) {
        return;
    }

    deleteProgram(currentEditingProgram.id);
    closeProgramEditor();
};

// Duplicate program
window.duplicateProgram = async function (programId) {
    const program = programs.find(p => p.id === programId);
    if (!program) return;

    try {
        const duplicatedProgram = {
            name: `Copy of ${program.name}`,
            active: false,
            schedule: { ...program.schedule },
            workouts: deepClone(program.workouts),
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "programs"), duplicatedProgram);
        const newProgram = { id: docRef.id, ...duplicatedProgram };
        programs.push(newProgram);

        renderPrograms();

        // Open editor for new program
        openProgramEditor(newProgram.id);

    } catch (e) {
        console.error("Error duplicating program:", e);
        alert('Error duplicating program. Please try again.');
    }
};

// Update createNewProgram to use editor
window.createNewProgram = function () {
    openProgramEditor(null);
};

// Helper function to get what workout would have been scheduled on a special day (travel/sick)
// This is used to show users what they're missing
// Helper function: Calculate calendar days between two dates (whole days)
// Returns positive number if date2 is after date1, negative if before
function daysBetween(date1Str, date2Str) {
    const d1 = new Date(date1Str + 'T00:00:00.000Z');
    const d2 = new Date(date2Str + 'T00:00:00.000Z');
    const diffMs = d2.getTime() - d1.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return diffDays;
}

// ---------------------------------------------------------------------------
// The scheduling engine is gone. It went through two lives - a calendar
// rotation, then a queue - and both answered a question the app no longer
// asks: "which session does the plan owe today?" The weekly volume model and
// the suggestion panel answer "what does TODAY need?" instead, and the
// discipline score below measures showing up rather than obeying.
// ---------------------------------------------------------------------------

// Day names that mean rest. An unnamed program day ('') counts as rest too.
const REST_SLOT_NAMES = ['rest', 'rest day', 'off', 'off day', 'recovery', 'recovery day', 'active recovery'];

// A saved session with one of these names is rest, not training, so it never
// counts as a working session anywhere sets are tallied.
function isRestSlot(slotName) {
    const n = normalizeLabel(slotName);
    return n === '' || REST_SLOT_NAMES.includes(n);
}

function addDaysToDateString(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00.000Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

function getWorkoutForDate(dateString) {
    return allWorkouts.find(w => w.date === dateString);
}

// ---------------------------------------------------------------------------
// Discipline score.
//
// Used to measure "did you do the workout the program prescribed", against the
// pace of a schedule that no longer assigns anything. It now measures the only
// thing the owner actually cares about: did you show up at all. A lifted
// session counts. A logged fencing night counts - three hours of coaching is
// not a day off. Which session it was, and whether a plan would have called it
// something else, does not matter.
//
// Sick and travel days leave the denominator entirely, and today is not
// counted until something is logged - a day cannot be failed while it is
// still happening.
// ---------------------------------------------------------------------------
function isActiveDay(dateStr) {
    const workout = getWorkoutForDate(dateStr);
    if (workout && !isNonTrainingLabel(workout.day)) return true;
    return fencingEntriesBetween(dateStr, dateStr).length > 0;
}

function calculateAdherence() {
    const today = getTodayDateString();
    const startDate = addDaysToDateString(today, -29);   // 30 days inclusive

    let available = 0;
    let active = 0;

    for (let dateStr = startDate; dateStr <= today; dateStr = addDaysToDateString(dateStr, 1)) {
        if (isActiveDay(dateStr)) {
            active++;
            available++;
            continue;
        }
        // Absences you declared do not count against you.
        if (isDateSickDay(dateStr) || isDateInTravelMode(dateStr)) continue;
        // Today has not been earned or lost yet.
        if (dateStr === today) continue;
        available++;
    }

    const score = available > 0 ? Math.round((active / available) * 100) : 0;
    return { score, active, available, restDays: available - active };
}
// Streak, redefined the same way as the discipline score: a day counts when
// you were active at all - a session or a fencing night - and sick and travel
// days are transparent rather than streak-breaking. Today not being logged yet
// does not end the streak; yesterday not being logged does.
function calculateWorkoutStreak() {
    const today = getTodayDateString();
    let streak = 0;
    let dateStr = today;

    for (let guard = 0; guard < 365; guard++) {
        if (isActiveDay(dateStr)) {
            streak++;
        } else if (isDateSickDay(dateStr) || isDateInTravelMode(dateStr)) {
            // transparent: neither counts nor breaks
        } else if (dateStr === today) {
            // today is still in play
        } else {
            break;
        }
        dateStr = addDaysToDateString(dateStr, -1);
    }
    return streak;
}
function detectPlateaus() {
    const plateaus = [];
    const workoutsByDay = {};

    // Group recent workouts by day
    allWorkouts.slice(0, 12).forEach(workout => {
        if (!workoutsByDay[workout.day]) workoutsByDay[workout.day] = [];
        workoutsByDay[workout.day].push(workout);
    });

    // Check each exercise for plateaus
    Object.keys(workoutsByDay).forEach(dayType => {
        const dayWorkouts = workoutsByDay[dayType].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (dayWorkouts.length < 3) return;

        const exerciseMap = {};

        // Track exercise progression
        dayWorkouts.forEach(workout => {
            Object.values(workout.exercises || {}).forEach(exercise => {
                if (exercise.exercise.toLowerCase().includes('stretch') || workout.day === 'Rest') return;

                if (!exerciseMap[exercise.exercise]) {
                    exerciseMap[exercise.exercise] = [];
                }

                const maxWeight = Math.max(...exercise.sets.map(set => parseFloat(set.weight) || 0));
                const maxReps = Math.max(...exercise.sets.map(set => parseInt(set.reps) || 0));
                const totalVolume = exercise.sets.reduce((sum, set) =>
                    sum + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0);

                exerciseMap[exercise.exercise].push({
                    date: workout.date,
                    maxWeight,
                    maxReps,
                    totalVolume
                });
            });
        });

        // Detect plateaus
        Object.keys(exerciseMap).forEach(exerciseName => {
            // maxWeight is 0 for holds, walks and mobility work, so
            // hasWeightProgression was permanently false and every one of them
            // was reported as a plateau forever, with a "+2.5lbs" suggestion.
            if (guessTrackingType(exerciseName) !== 'weight_reps') return;
            const progression = exerciseMap[exerciseName].slice(0, 3);

            if (progression.length < 3) return;

            // progression[] arrives newest-first. Reverse it so "increased"
            // means the newer session was heavier, not the older one.
            const chronological = progression.slice().reverse();

            const weights = chronological.map(p => p.maxWeight);
            const hasWeightProgression = weights.some((w, i) => i > 0 && w > weights[i - 1]);

            // Volume declining means the most recent session is the lighter one.
            const volumes = chronological.map(p => p.totalVolume);
            const hasVolumeDecline = volumes.length >= 2 && volumes[volumes.length - 1] < volumes[volumes.length - 2];

            if (!hasWeightProgression || hasVolumeDecline) {
                plateaus.push({
                    exercise: exerciseName,
                    sessions: progression.length,
                    lastWeight: weights[weights.length - 1],
                    suggestion: generatePlateauSuggestion(exerciseName, progression)
                });
            }
        });
    });

    return plateaus;
}

function generatePlateauSuggestion(exerciseName, progression) {
    const isCompound = ['squat', 'bench', 'deadlift', 'press'].some(compound =>
        exerciseName.toLowerCase().includes(compound));

    if (isCompound) {
        return `Try micro-loading (+2.5lbs) or add pause reps at 90% weight`;
    } else {
        return `Consider adding 1 set or trying drop sets for volume progression`;
    }
}
function generateAdvancedSuggestions() {
    if (allWorkouts.length === 0) {
        return [{
            type: 'motivation',
            text: 'Start logging workouts to get personalized AI suggestions!'
        }];
    }

    const suggestions = [];

    // Get plateaus
    const plateaus = detectPlateaus();

    // Plateau alerts
    plateaus.slice(0, 2).forEach(plateau => {
        suggestions.push({
            type: 'plateau',
            text: `${plateau.exercise} has plateaued for ${plateau.sessions} sessions. ${plateau.suggestion}`
        });
    });

    // Get last workout for current day
    const lastWorkout = allWorkouts.find(w => w.day === currentDay);

    if (lastWorkout) {
        const daysSince = Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / (1000 * 60 * 60 * 24));

        if (daysSince > 7) {
            suggestions.push({
                type: 'recovery',
                text: `It's been ${daysSince} days since your last ${currentDay} workout. You should feel strong today!`
            });
        } else if (daysSince === 0) {
            suggestions.push({
                type: 'warning',
                text: `You already trained ${currentDay} today. Consider rest or a different muscle group.`
            });
        }

        // Smart progression suggestions
        Object.values(lastWorkout.exercises || {}).forEach((exercise, idx) => {
            if (idx < 2 && !exercise.exercise.toLowerCase().includes('stretch') && lastWorkout.day !== 'Rest') {
                const maxWeight = Math.max(...exercise.sets.map(set => parseFloat(set.weight) || 0));
                const completedReps = exercise.sets.map(set => parseInt(set.reps) || 0);
                const avgReps = completedReps.reduce((a, b) => a + b, 0) / completedReps.length;

                if (maxWeight > 0) {
                    // If consistently hitting high reps, suggest weight increase
                    if (avgReps >= 10 && completedReps.every(r => r >= 8)) {
                        suggestions.push({
                            type: 'progression',
                            text: `${exercise.exercise}: Strong performance (${maxWeight}lbs × ${Math.round(avgReps)}). Try ${maxWeight + 5}lbs next time!`
                        });
                    }
                    // If struggling with reps, suggest technique focus
                    else if (avgReps < 6 && maxWeight > 0) {
                        suggestions.push({
                            type: 'technique',
                            text: `${exercise.exercise}: Focus on form at ${maxWeight - 5}lbs or add more warm-up sets`
                        });
                    }
                }
            }
        });
    }

    // Consistency suggestions
    // Previously this took the 7 most recent workouts REGARDLESS OF DATE, so
    // anyone with 7 rows in history saw "100% workout rate this week" forever,
    // including after months away. Count sessions in the actual last 7 days.
    const weekStart = addDaysToDateString(getTodayDateString(), -6);
    const todayStr = getTodayDateString();
    const recentWorkouts = allWorkouts.filter(w =>
        w.date >= weekStart && w.date <= todayStr && normalizeLabel(w.day) !== 'rest');
    if (recentWorkouts.length >= 3) {
        const consistency = Math.min(100, (recentWorkouts.length / 7) * 100);
        if (consistency >= 40) {
            suggestions.push({
                type: 'motivation',
                text: `${recentWorkouts.length} sessions in the last 7 days. Keep it going.`
            });
        }
    } else if (recentWorkouts.length === 1) {
        suggestions.push({
            type: 'consistency',
            text: 'Great job getting back to training! Aim for 3-4 sessions this week.'
        });
    }

    return suggestions.slice(0, 4);
}

// Volume in pounds is meaningless for holds, walks and bodyweight work, so
// those exercises are excluded rather than silently contributing zero.
function calculateWorkoutVolume(workout) {
    if (isRestSlot(workout.day)) return 0;

    return Object.values(workout.exercises || {}).reduce((total, exercise) => {
        // Only weight-and-reps work has a tonnage. Holds, walks and bodyweight
        // sets used to contribute a silent zero, which dragged every comparison
        // toward "Declining" for a session that had actually improved.
        const type = exercise.trackingType && TRACKING_TYPES[exercise.trackingType]
            ? exercise.trackingType
            : guessTrackingType(exercise.substitution || exercise.exercise);
        if (type !== 'weight_reps') return total;

        return total + (exercise.sets || []).reduce((setTotal, set) => {
            return setTotal + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0);
        }, 0);
    }, 0);
}

// Get all workouts of a specific type (e.g., all "Upper" workouts)
// Matched with strict === against a hardcoded list of five names, which meant
// every custom program compared "day1"-style keys or names like "Push/Pull"
// against 'Upper'/'Lower'/... and matched nothing. Normalised comparison plus
// newest-first ordering, which this function previously did not guarantee.
function getWorkoutsByType(workoutType) {
    const wanted = normalizeLabel(workoutType);
    if (!wanted) return [];
    return allWorkouts
        .filter(w => normalizeLabel(w.day) === wanted)
        .sort((a, b) => workoutRecency(b) - workoutRecency(a));
}

// Find exercises without progression
function getPlateauedExercises(sessionsBack) {
    const exerciseHistory = {};

    // Track last N sessions for each exercise
    allWorkouts.slice(0, sessionsBack * 2).forEach(workout => {
        if (workout.day === 'Rest') return;

        Object.values(workout.exercises || {}).forEach(exercise => {
            if (!exercise.exercise.toLowerCase().includes('stretch')) {
                const exerciseName = exercise.exercise;
                const maxWeight = Math.max(...exercise.sets.map(set => parseFloat(set.weight) || 0));

                if (maxWeight > 0) {
                    if (!exerciseHistory[exerciseName]) {
                        exerciseHistory[exerciseName] = [];
                    }
                    exerciseHistory[exerciseName].push(maxWeight);
                }
            }
        });
    });

    // Find exercises that haven't progressed
    const plateaued = [];
    Object.keys(exerciseHistory).forEach(exercise => {
        // Reverse to chronological order; the source array is newest-first.
        const weights = exerciseHistory[exercise].slice(0, sessionsBack).reverse();
        if (weights.length >= sessionsBack) {
            const hasProgress = weights.some((weight, idx) => idx > 0 && weight > weights[idx - 1]);
            if (!hasProgress) {
                plateaued.push({ exercise, weight: weights[0] });
            }
        }
    });

    return plateaued.slice(0, 3);
}

// Get exercise progression data for PR Timeline (specific exercise)
function getExerciseProgressionForTimeline(exerciseName) {
    const progression = [];

    allWorkouts.slice().reverse().forEach(workout => {
        if (workout.day === 'Rest') return;

        Object.values(workout.exercises || {}).forEach(exercise => {
            if (exercise.exercise === exerciseName) {
                const maxWeight = Math.max(...exercise.sets.map(set => parseFloat(set.weight) || 0));
                if (maxWeight > 0) {
                    progression.push({
                        x: workout.date,
                        y: maxWeight,
                        isPR: false
                    });
                }
            }
        });
    });

    // Mark PRs
    let currentPR = 0;
    progression.forEach(point => {
        if (point.y > currentPR) {
            point.isPR = true;
            currentPR = point.y;
        }
    });

    return progression;
}

// Get exercises showing consistent improvement
function getTrendingUpExercises() {
    const exerciseHistory = {};

    // Track recent sessions for each exercise
    allWorkouts.slice(0, 10).forEach(workout => {
        if (workout.day === 'Rest') return;

        Object.values(workout.exercises || {}).forEach(exercise => {
            if (!exercise.exercise.toLowerCase().includes('stretch')) {
                const exerciseName = exercise.exercise;
                const maxWeight = Math.max(...exercise.sets.map(set => parseFloat(set.weight) || 0));

                if (maxWeight > 0) {
                    if (!exerciseHistory[exerciseName]) {
                        exerciseHistory[exerciseName] = [];
                    }
                    exerciseHistory[exerciseName].push(maxWeight);
                }
            }
        });
    });

    // Find exercises trending up
    const trending = [];
    Object.keys(exerciseHistory).forEach(exercise => {
        // allWorkouts is newest-first, so reverse to chronological order before
        // comparing. Without this the check detects regression, not progress.
        const weights = exerciseHistory[exercise].slice(0, 4).reverse();
        if (weights.length >= 3) {
            // Check if generally increasing
            const increases = weights.filter((weight, idx) => idx > 0 && weight > weights[idx - 1]).length;
            if (increases >= 2) {
                trending.push(exercise);
            }
        }
    });

    return trending.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Tracking types
//
// The app decided between a checkbox and weight/reps entry using ONE rule:
// whether the exercise name contained the literal word "stretch". Everything
// else got a weight box and a reps box. For a program full of holds, balance
// work and walking that is actively wrong: a hollow body hold asked for a
// weight, and the only way to record 30 seconds was to type it in the reps box,
// which then poisoned every downstream number.
//
// Each exercise now carries an explicit tracking type, defaulted from its name
// and overridable in the program editor.
// ---------------------------------------------------------------------------

const TRACKING_TYPES = {
    weight_reps: { label: 'Weight & reps', unit: 'lbs',  hint: 'Barbell, dumbbell, machine and cable work.' },
    reps:        { label: 'Reps only',     unit: '',     hint: 'Bodyweight work where load is not the variable.' },
    time:        { label: 'Time (seconds)', unit: 'sec', hint: 'Holds, planks, balance, levers, hangs.' },
    duration:    { label: 'Duration (minutes)', unit: 'min', hint: 'Walking, cycling, rowing, any steady cardio.' },
    checkoff:    { label: 'Just check it off', unit: '', hint: 'Stretches, mobility and primer work.' }
};

const TRACKING_GUESS = [
    { type: 'checkoff', tokens: ['stretch', 'mobility', 'foam roll', 'roll the arch', 'breathing', 'cat-cow',
                                 'cat cow', 'controlled articular', 'toe spread', 'arch doming', 'short foot',
                                 'pull-apart', 'pull apart', 'legs up the wall', 'constructive rest'] },
    // 'swim' alone matched "prone swimmers", which is a back exercise. Tokens
    // here have to be specific enough not to swallow strength movements.
    { type: 'duration', tokens: ['treadmill', 'walk', 'jog', 'running', 'bike', 'cycling', 'elliptical',
                                 'swimming', 'cardio', 'zone 2', 'rowing machine', 'erg', 'stair climber'] },
    { type: 'time',     tokens: ['hold', 'plank', 'balance', 'hang', 'l-sit', 'l sit', 'lever', 'handstand',
                                 'carry', 'isometric', 'lean', 'wall sit', 'dead hang'] },
    { type: 'reps',     tokens: ['push-up', 'pushup', 'push up', 'air squat', 'bodyweight', 'swimmers',
                                 'glute bridge', 'dead bug', 'scapular', 'knee-to-wall', 'knee to wall',
                                 'toe raise', 'pogo', 'hop'] }
];

// Words that mean load is the variable, which outranks a bodyweight guess.
const LOADED_TOKENS = ['weighted', 'barbell', 'dumbbell', 'cable', 'machine', 'smith', 'trap bar',
                       'goblet', 'plate', 'banded', 'leg press', 'hack squat'];

function guessTrackingType(exerciseName) {
    const name = normalizeLabel(exerciseName);
    if (!name) return 'weight_reps';

    for (const rule of TRACKING_GUESS) {
        if (rule.tokens.some(t => name.includes(t))) {
            // A weighted hold is still a hold, but a weighted push-up is a
            // loaded rep scheme, so only the reps guess defers to load.
            if (rule.type === 'reps' && LOADED_TOKENS.some(t => name.includes(t))) return 'weight_reps';
            return rule.type;
        }
    }
    return 'weight_reps';
}

function getTrackingType(exercise, workoutExercise) {
    const explicit = (workoutExercise && workoutExercise.trackingType) ||
                     (exercise && exercise.trackingType);
    if (explicit && TRACKING_TYPES[explicit]) return explicit;
    return guessTrackingType((exercise && exercise.name) || (workoutExercise && workoutExercise.exercise));
}

// What one logged set looks like for each type.
function blankSetForType(type) {
    switch (type) {
        case 'time':     return { seconds: '', notes: '' };
        case 'duration': return { minutes: '', notes: '' };
        case 'reps':     return { reps: '', notes: '' };
        case 'checkoff': return { completed: false };
        default:         return { weight: '', reps: '', notes: '' };
    }
}

// Human-readable summary of a logged set, used by the "last session" line.
function formatSetForType(set, type) {
    if (!set) return '';
    switch (type) {
        case 'time':     return set.seconds ? `${set.seconds} sec` : '';
        case 'duration': return set.minutes ? `${set.minutes} min` : '';
        case 'reps':     return set.reps ? `${set.reps} reps` : '';
        case 'checkoff': return set.completed ? 'done' : '';
        default:         return (set.weight || set.reps) ? `${set.weight}×${set.reps}` : '';
    }
}

// ---------------------------------------------------------------------------
// Daily routines
//
// The morning primer and the pre-bed routine were reference panels with no
// logging at all, even though they happen at different times of day from the
// training session and are the part of the program most at risk of quietly
// being skipped. They are stored separately from workouts on purpose: a
// routine is not a session, and mixing them would corrupt volume, set counts
// and the training score.
// ---------------------------------------------------------------------------

const ROUTINE_CACHE_KEY = 'fcc:cache:routines:v1';
let dailyRoutines = [];

async function loadDailyRoutines() {
    try {
        const from = addDaysToDateString(getTodayDateString(), -90);
        const q = query(
            collection(db, "dailyRoutines"),
            where("date", ">=", from),
            orderBy("date", "desc"),
            limit(120)
        );
        const snapshot = await getDocs(q);
        const rows = [];
        snapshot.forEach(d => rows.push({ id: d.id, ...d.data() }));
        dailyRoutines = rows;
        writeCache(ROUTINE_CACHE_KEY, rows.slice(0, 90));
        renderRoutineState();
        return rows;
    } catch (e) {
        console.error('Failed to load daily routines:', e);
        const cached = readCache(ROUTINE_CACHE_KEY);
        if (Array.isArray(cached)) { dailyRoutines = cached; renderRoutineState(); }
        return dailyRoutines;
    }
}

function getRoutineRecord(dateStr) {
    return dailyRoutines.find(r => r.date === dateStr) || null;
}

function isRoutineDone(which, dateStr) {
    const record = getRoutineRecord(dateStr || getTodayDateString());
    return Boolean(record && record[which]);
}

// Consecutive days back from today, so the primer gets the streak the training
// side already has.
function getRoutineStreak(which) {
    let streak = 0;
    let cursor = getTodayDateString();
    // Today not being done yet should not break a streak mid-morning.
    if (!isRoutineDone(which, cursor)) cursor = addDaysToDateString(cursor, -1);
    while (isRoutineDone(which, cursor)) {
        streak++;
        cursor = addDaysToDateString(cursor, -1);
    }
    return streak;
}

function countRoutineDays(which, days) {
    const from = addDaysToDateString(getTodayDateString(), -(days - 1));
    return dailyRoutines.filter(r => r.date >= from && r[which]).length;
}

const routineWriteInFlight = { morning: false, evening: false };

window.toggleRoutineDone = async function (which, event) {
    if (event) event.preventDefault();   // the button sits inside a <summary>
    if (event) event.stopPropagation();  // so it must not also toggle the panel

    // record.id is only assigned after the await, so two quick taps both took
    // the "no id yet" branch and created two documents for the same day, which
    // permanently desynced the streak and the 30-day count.
    if (routineWriteInFlight[which]) return;
    routineWriteInFlight[which] = true;

    const today = getTodayDateString();
    const existing = getRoutineRecord(today);
    const nextValue = !(existing && existing[which]);

    // Update locally first so the tap feels instant and works offline.
    if (existing) {
        existing[which] = nextValue;
    } else {
        dailyRoutines.unshift({ id: null, date: today, morning: false, evening: false, [which]: nextValue });
    }
    renderRoutineState();
    writeCache(ROUTINE_CACHE_KEY, dailyRoutines.slice(0, 90));

    const record = getRoutineRecord(today);
    try {
        if (record.id) {
            await updateDoc(doc(db, "dailyRoutines", record.id), { [which]: nextValue });
        } else {
            const payload = {
                date: today,
                morning: Boolean(record.morning),
                evening: Boolean(record.evening),
                timestamp: new Date().toISOString()
            };
            const ref = await addDoc(collection(db, "dailyRoutines"), payload);
            record.id = ref.id;
        }
        writeCache(ROUTINE_CACHE_KEY, dailyRoutines.slice(0, 90));
    } catch (e) {
        // There is no retry queue, so claiming it would sync later was a lie
        // and the tick silently vanished on the next load. Revert instead.
        console.error('Could not save routine:', e);
        const revert = getRoutineRecord(today);
        if (revert) revert[which] = !nextValue;
        renderRoutineState();
        writeCache(ROUTINE_CACHE_KEY, dailyRoutines.slice(0, 90));
        showToast('Could not save that. Check your connection and tap again.', 'error');
    } finally {
        routineWriteInFlight[which] = false;
    }
};

function renderRoutineState() {
    [['morning'], ['evening']].forEach(([which]) => {
        const btn = document.getElementById('routine-done-' + which);
        const status = document.getElementById('routine-status-' + which);
        if (!btn) return;

        const done = isRoutineDone(which);
        btn.textContent = done ? 'Done today' : 'Mark done';
        btn.classList.toggle('done', done);
        btn.setAttribute('aria-pressed', String(done));

        if (status) {
            const streak = getRoutineStreak(which);
            const last30 = countRoutineDays(which, 30);
            status.textContent = streak > 0
                ? streak + ' day streak \u00b7 ' + last30 + ' of the last 30'
                : last30 + ' of the last 30 days';
        }
    });
}

// ---------------------------------------------------------------------------
// Skill progressions
//
// Calisthenics skills are not one exercise, they are a ladder. Logging "front
// lever" with no level makes progress invisible, so each skill carries its
// levels and the standard for moving up. The chosen level is stored on the
// exercise and saved with the session.
// ---------------------------------------------------------------------------

const SKILL_PROGRESSIONS = {
    'front lever': {
        label: 'Front lever',
        levels: [
            { name: 'Dead hang', target: '3 x 30-45 sec',
              cue: 'Straight arms, shoulders active, ribs down.',
              gate: 'Hold 45 sec before moving up.' },
            { name: 'Scapular pull-up', target: '3 x 8-10',
              cue: 'Arms stay straight. Only the shoulder blades move, down and together.',
              gate: '10 clean reps with a 2 sec hold at the top.' },
            { name: 'Straight-arm pulldown', target: '3 x 12-15',
              cue: 'Cable machine, arms locked straight, pull to the thighs.',
              gate: 'This runs alongside the bar work, not instead of it.' },
            { name: 'Tuck hang', target: '4 x 10-15 sec',
              cue: 'Hang, pull the knees to the chest, let the torso tip back. Arms straight.',
              gate: '3 sets of 15 sec with the lower back flat.' },
            { name: 'Tuck front lever', target: '4 x 10-20 sec',
              cue: 'Knees tight to chest, torso horizontal, pelvis tucked under.',
              gate: '3 sets of 15 sec before opening the knees.' },
            { name: 'Advanced tuck', target: '4 x 8-15 sec',
              cue: 'Open the knees toward 90 degrees. Keep the lower back flat against the tuck.',
              gate: '3 sets of 12 sec.' },
            { name: 'One-leg lever', target: '4 x 8-12 sec per side',
              cue: 'One leg extends, the other stays tucked. Alternate the extended leg.',
              gate: '10 sec per side, both sides equal.' },
            { name: 'Straddle lever', target: '4 x 5-10 sec',
              cue: 'Both legs straight and wide. The wider the straddle the easier it is.',
              gate: '3 sets of 8 sec.' },
            { name: 'Full front lever', target: '4 x 3-8 sec',
              cue: 'Legs together, body horizontal, straight arms throughout.',
              gate: 'The goal.' }
        ]
    },
    'handstand': {
        label: 'Handstand',
        levels: [
            { name: 'Wrist prep and plank', target: '2 min total',
              cue: 'Wrist circles, then a 30 sec plank with the shoulders stacked over the hands.',
              gate: 'Wrists comfortable under full bodyweight.' },
            { name: 'Pike push-up', target: '3 x 6-8',
              cue: 'Hips high, head travels toward the floor between the hands.',
              gate: '8 clean reps.' },
            { name: 'Back-to-wall hold', target: '3 x 30 sec',
              cue: 'Feet on the wall, hands close in. Easier, but it lets you cheat the line.',
              gate: '30 sec without the lower back arching.' },
            { name: 'Chest-to-wall hold', target: '3 x 30-45 sec',
              cue: 'Face the wall, walk the feet up, hands close. This is the honest version.',
              gate: '45 sec with ribs down and a stacked line.' },
            { name: 'Wall taps', target: '3 x 5-8 per side',
              cue: 'From chest-to-wall, shift the weight and lift one hand briefly.',
              gate: '8 taps per side under control.' },
            { name: 'Freestanding attempts', target: '10 min of short tries',
              cue: 'Kick up away from the wall. Many short attempts beat a few long ones.',
              gate: 'The goal.' }
        ]
    },
    'l-sit': {
        label: 'L-sit',
        levels: [
            { name: 'Foot-supported hold', target: '4 x 15-20 sec',
              cue: 'On parallel bars, press down hard, heels stay lightly on the floor.',
              gate: '20 sec with the shoulders pushed down away from the ears.' },
            { name: 'One-leg tuck', target: '4 x 10-15 sec per side',
              cue: 'One knee tucked up, the other foot lightly supporting.',
              gate: '15 sec per side.' },
            { name: 'Tuck L-sit', target: '4 x 10-20 sec',
              cue: 'Both knees tucked, feet off the floor. Watch the left hip and stop if it pinches.',
              gate: '3 sets of 15 sec, pain free.' },
            { name: 'One-leg extended', target: '4 x 8-12 sec per side',
              cue: 'One leg straight out, the other tucked.',
              gate: '10 sec per side.' },
            { name: 'Full L-sit', target: '4 x 5-15 sec',
              cue: 'Both legs straight and parallel to the floor.',
              gate: 'The goal.' }
        ]
    }
};

// Skills are matched loosely, so "Tuck Front Lever Hold" still finds the ladder.
function getSkillProgression(exerciseName) {
    const name = normalizeLabel(exerciseName);
    if (!name) return null;
    for (const key of Object.keys(SKILL_PROGRESSIONS)) {
        if (name.includes(key)) return { key, ...SKILL_PROGRESSIONS[key] };
    }
    return null;
}

// ---------------------------------------------------------------------------
// Previous-session lookup
//
// completeWorkout() saves `day` as the RESOLVED workout type name (e.g.
// "Push/Pull"), while the UI tracks `currentDay` as a schedule key (e.g.
// "day1"). Comparing those two strings directly never matched, so every
// "last session" label, per-set Copy button and suggested weight silently
// disappeared. These helpers compare against every label a day could have
// been saved under, including raw keys from older rows.
// ---------------------------------------------------------------------------

function normalizeLabel(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
}

function getDayLabelCandidates(day) {
    const candidates = new Set();
    const add = (value) => {
        const normalized = normalizeLabel(value);
        if (normalized) candidates.add(normalized);
    };

    // Raw key covers legacy rows and the default plans, whose keys ARE type names.
    add(day);

    if (activeProgram && activeProgram.schedule) {
        add(getWorkoutTypeForDay(activeProgram, day));
        add(getCustomNameForDay(activeProgram, day));
    }

    return candidates;
}

function workoutRecency(workout) {
    const ts = workout && workout.timestamp;
    if (ts) {
        if (typeof ts.seconds === 'number') return ts.seconds * 1000;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        const parsedTs = new Date(ts).getTime();
        if (!isNaN(parsedTs)) return parsedTs;
    }
    const parsedDate = new Date(workout && workout.date).getTime();
    return isNaN(parsedDate) ? 0 : parsedDate;
}

// Every past session logged under this day, most recent first. Sorted here
// rather than trusting the load order, since other code paths mutate
// allWorkouts in place.
function getWorkoutsForDay(day) {
    const candidates = getDayLabelCandidates(day);
    if (candidates.size === 0) return [];

    return allWorkouts
        .filter(workout => candidates.has(normalizeLabel(workout.day)))
        .sort((a, b) => workoutRecency(b) - workoutRecency(a));
}

// Every name a given slot could have been logged under, so a substituted or
// renamed exercise still finds its own history.
function getExerciseNameCandidates(workoutExercise, fallbackName) {
    const names = new Set();
    const add = (value) => {
        const normalized = normalizeLabel(value);
        if (normalized) names.add(normalized);
    };

    if (workoutExercise) {
        add(workoutExercise.exercise);
        // The alternative-exercise feature has been removed, so nothing writes
        // `substitution` / `originalExercise` any more. Sessions logged BEFORE
        // that removal still carry them, and history has to keep matching and
        // displaying those rows under the name they were actually trained as.
        // These reads are deliberate back-compatibility, not dead code.
        add(workoutExercise.substitution);
        add(workoutExercise.originalExercise);
    }
    add(fallbackName);

    return names;
}

// A 10x10 volume day and a 3x8 strength day are different exercises wearing
// the same name: the loads are deliberately far apart, and using one as the
// "previous" reference for the other corrupts progression in both directions.
// Set count is the honest tell - nobody does 8+ working sets of one movement
// except on a volume day.
const VOLUME_SCHEME_MIN_SETS = 8;

function schemeClassOfSetCount(count) {
    return count >= VOLUME_SCHEME_MIN_SETS ? 'volume' : 'standard';
}

// Matches by exercise NAME rather than by position, so reordering a program or
// inserting an exercise no longer compares bench press against rows.
//
// History is searched in widening circles: this day's sessions first, then ALL
// sessions. Day-scoped-only lookup meant a generated session ("Back & Quads -
// 30 min") never found the Barbell Row numbers logged under "Upper A", so the
// suggestion flow - the app's main path now - had no last-session hints and no
// Copy buttons at all. Within each circle, an instance with a comparable set
// scheme is preferred, so a 10x10 day never becomes the reference for a 3x8
// day or vice versa.
function findPreviousExercise(day, exerciseIndex, exerciseNames, approach = null, plannedSetCount = null) {
    const dayWorkouts = getWorkoutsForDay(day);
    const allSorted = allWorkouts.slice().sort((a, b) => workoutRecency(b) - workoutRecency(a));

    // Must recognise EVERY tracking type. Checking only weight and reps meant a
    // hold logged as {seconds:'30'} counted as no data, so time-based and
    // cardio exercises found no history, no "last session" line and no working
    // Copy button.
    const hasValue = (v) => v !== '' && v != null;
    const hasLoggedData = (ex) => Boolean(
        ex && Array.isArray(ex.sets) && ex.sets.some(set =>
            set && (
                hasValue(set.weight) || hasValue(set.reps) ||
                hasValue(set.seconds) || hasValue(set.minutes) ||
                set.completed === true
            ))
    );

    const matchesName = (ex) => Boolean(ex && (
        exerciseNames.has(normalizeLabel(ex.exercise)) ||
        exerciseNames.has(normalizeLabel(ex.substitution)) ||
        exerciseNames.has(normalizeLabel(ex.originalExercise))
    ));

    const approachOf = (ex) => normalizeLabel(ex && ex.approach ? ex.approach : 'standard');
    const wantedApproach = approach ? normalizeLabel(approach) : null;

    const loggedSetCount = (ex) => (ex.sets || []).filter(isWorkingSet).length;
    const wantedScheme = plannedSetCount != null ? schemeClassOfSetCount(plannedSetCount) : null;
    const matchesScheme = (ex) =>
        wantedScheme === null || schemeClassOfSetCount(loggedSetCount(ex)) === wantedScheme;

    const search = (workouts, wantApproach, wantScheme) => {
        for (const workout of workouts) {
            const match = Object.values(workout.exercises || {}).find(ex =>
                matchesName(ex) && hasLoggedData(ex)
                && (!wantApproach || approachOf(ex) === wantApproach)
                && (!wantScheme || matchesScheme(ex)));
            if (match) return { workout, exercise: match };
        }
        return null;
    };

    // Widening circles; the first hit wins. Scheme match is dropped last, so a
    // first-ever volume day still shows SOMETHING rather than a blank.
    const passes = [
        [dayWorkouts, wantedApproach, true],
        [dayWorkouts, null, true],
        [allSorted, wantedApproach, true],
        [allSorted, null, true],
        [dayWorkouts, null, false],
        [allSorted, null, false]
    ];
    for (const [workouts, wantApproach, wantScheme] of passes) {
        if (!workouts.length) continue;
        const found = search(workouts, wantApproach, wantScheme);
        if (found) return found;
    }

    // Legacy position fallback, most recent same-day session only, so rows
    // saved without usable names still show data.
    const mostRecent = dayWorkouts[0];
    const byIndex = mostRecent ? (mostRecent.exercises || {})[exerciseIndex] : null;
    if (hasLoggedData(byIndex)) return { workout: mostRecent, exercise: byIndex };

    return null;
}

function getPersonalRecords() {
    const prs = {};

    allWorkouts.forEach(workout => {
        if (workout.day === 'Rest') return;

        Object.values(workout.exercises || {}).forEach(exercise => {
            if (exercise.exercise.toLowerCase().includes('stretch')) return;

            exercise.sets.forEach(set => {
                const weight = parseFloat(set.weight);
                const reps = parseInt(set.reps);

                if (weight && reps) {
                    const exerciseName = exercise.exercise;
                    if (!prs[exerciseName] || weight > prs[exerciseName].weight) {
                        prs[exerciseName] = { weight, reps, date: workout.date };
                    }
                }
            });
        });
    });

    return prs;
}

function getExerciseProgression() {
    const progression = {};

    // Group workouts by exercise
    allWorkouts.forEach(workout => {
        if (workout.day === 'Rest') return;

        Object.values(workout.exercises || {}).forEach(exercise => {
            if (exercise.exercise.toLowerCase().includes('stretch')) return;

            if (!progression[exercise.exercise]) {
                progression[exercise.exercise] = [];
            }

            const maxWeight = Math.max(...exercise.sets.map(set => parseFloat(set.weight) || 0));
            const maxReps = Math.max(...exercise.sets.map(set => parseInt(set.reps) || 0));
            const totalVolume = exercise.sets.reduce((sum, set) =>
                sum + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0);

            progression[exercise.exercise].push({
                date: workout.date,
                maxWeight,
                maxReps,
                totalVolume,
                rawSets: exercise.sets
            });
        });
    });

    // Sort by date and analyze progression
    const progressionSummary = {};
    Object.keys(progression).forEach(exerciseName => {
        const sessions = progression[exerciseName].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sessions.length >= 2) {
            const latest = sessions[0];
            const previous = sessions[1];

            let progressionText = '';
            let progressionType = 'none';

            if (latest.maxWeight > previous.maxWeight) {
                progressionText = `${previous.maxWeight}lbs → ${latest.maxWeight}lbs (+${latest.maxWeight - previous.maxWeight}lbs)`;
                progressionType = 'strength';
            } else if (latest.maxWeight === previous.maxWeight && latest.maxReps > previous.maxReps) {
                progressionText = `${latest.maxWeight}lbs: ${previous.maxReps} → ${latest.maxReps} reps (+${latest.maxReps - previous.maxReps})`;
                progressionType = 'volume';
            } else if (latest.totalVolume > previous.totalVolume) {
                progressionText = `Volume: ${previous.totalVolume} → ${latest.totalVolume} lbs (+${Math.round(((latest.totalVolume - previous.totalVolume) / previous.totalVolume) * 100)}%)`;
                progressionType = 'total_volume';
            } else {
                progressionText = `${latest.maxWeight}lbs × ${latest.maxReps} (maintaining)`;
                progressionType = 'maintaining';
            }

            const daysSince = Math.floor((new Date() - new Date(latest.date)) / (1000 * 60 * 60 * 24));

            progressionSummary[exerciseName] = {
                progression: progressionText,
                type: progressionType,
                daysSince,
                sessions: sessions.length
            };
        }
    });

    return progressionSummary;
}

// Chart Functions
function createPRTimelineChart(exerciseName) {
    const ctx = document.getElementById('pr-timeline-chart');
    if (!ctx) return;

    // Wait for Chart.js to load if deferred
    if (!isChartJsReady()) {
        waitForChartJs(() => createPRTimelineChart(exerciseName));
        return;
    }

    if (charts.prTimeline) charts.prTimeline.destroy();

    if (!exerciseName) {
        // No exercise selected
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    const progression = getExerciseProgressionForTimeline(exerciseName);

    if (progression.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    const maxWeight = Math.max(...progression.map(p => p.y));

    // Separate PR points from regular points
    const prPoints = progression.filter(p => p.isPR);
    const regularPoints = progression.filter(p => !p.isPR);

    const datasets = [];

    // Regular progression line
    if (regularPoints.length > 0) {
        datasets.push({
            label: 'Weight',
            data: progression.map(p => ({ x: p.x, y: p.y })),
            borderColor: '#4A5D4A',
            backgroundColor: 'rgba(74, 93, 74, 0.15)',
            pointRadius: 4,
            pointBackgroundColor: '#4A5D4A',
            tension: 0.4,
            fill: true
        });
    }

    // PR points overlay
    if (prPoints.length > 0) {
        datasets.push({
            label: 'PRs',
            data: prPoints.map(p => ({ x: p.x, y: p.y })),
            borderColor: '#5D8A66',
            backgroundColor: '#5D8A66',
            pointRadius: 8,
            pointStyle: 'star',
            showLine: false
        });
    }

    charts.prTimeline = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: 'var(--color-text-secondary)' }
                },
                title: {
                    display: true,
                    text: `Max Weight: ${maxWeight} lbs`,
                    color: '#ffffff',
                    font: { size: 14, weight: 'bold' }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'day' },
                    ticks: { color: 'var(--color-text-secondary)' },
                    grid: { color: 'rgba(0, 0, 0, 0.08)' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Weight (lbs)', color: 'var(--color-text-secondary)' },
                    ticks: { color: 'var(--color-text-secondary)' },
                    grid: { color: 'rgba(0, 0, 0, 0.08)' }
                }
            }
        }
    });
}

function updateSessionComparison(workoutType) {
    const workouts = getWorkoutsByType(workoutType);
    const container = document.getElementById('session-comparison-content');

    if (workouts.length < 2) {
        container.innerHTML = '<p>Need at least 2 sessions to compare</p>';
        return;
    }

    const lastSession = workouts[0];
    const previousSession = workouts[1];

    const lastVolume = calculateWorkoutVolume(lastSession);
    const previousVolume = calculateWorkoutVolume(previousSession);

    const volumeChange = lastVolume - previousVolume;
    const volumeChangePercent = previousVolume > 0 ? Math.round((volumeChange / previousVolume) * 100) : 0;

    const isImproving = volumeChange > 0;
    const changeColor = isImproving ? 'var(--color-success)' : 'var(--color-error)';
    const changeIcon = isImproving ? '✓' : '✗';

    // Exercise-by-exercise comparison
    const exerciseChanges = { increased: [], decreased: [], plateaued: [] };

    // Get exercises from last session
    Object.values(lastSession.exercises || {}).forEach(lastExercise => {
        const exerciseName = lastExercise.exercise;

        // Find matching exercise in previous session
        const previousExercise = Object.values(previousSession.exercises || {})
            .find(ex => ex.exercise === exerciseName);

        if (previousExercise) {
            // Calculate max weight × reps for each session
            const lastMax = Math.max(...lastExercise.sets.map(set =>
                (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0)
            ));
            const previousMax = Math.max(...previousExercise.sets.map(set =>
                (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0)
            ));

            // Find the sets that correspond to those max values
            const lastBestSet = lastExercise.sets.find(set =>
                (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0) === lastMax
            );
            const previousBestSet = previousExercise.sets.find(set =>
                (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0) === previousMax
            );

            const lastWeight = parseFloat(lastBestSet?.weight) || 0;
            const lastReps = parseInt(lastBestSet?.reps) || 0;
            const previousWeight = parseFloat(previousBestSet?.weight) || 0;
            const previousReps = parseInt(previousBestSet?.reps) || 0;

            if (lastMax > previousMax) {
                exerciseChanges.increased.push({
                    name: exerciseName,
                    previous: `${previousWeight}×${previousReps}`,
                    current: `${lastWeight}×${lastReps}`
                });
            } else if (lastMax < previousMax) {
                exerciseChanges.decreased.push({
                    name: exerciseName,
                    previous: `${previousWeight}×${previousReps}`,
                    current: `${lastWeight}×${lastReps}`
                });
            }
            // Note: Plateaued detection requires 3+ sessions, handled separately
        }
    });

    // Build exercise breakdown HTML
    let exerciseBreakdownHTML = '';
    if (exerciseChanges.increased.length > 0) {
        exerciseBreakdownHTML += `
                    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(93, 138, 102, 0.1); border-radius: 8px; border-left: 3px solid #5D8A66;">
                        <div style="color: #5D8A66; font-weight: bold; margin-bottom: 0.5rem;">↑ Increased</div>
                        ${exerciseChanges.increased.map(ex =>
            `<div style="font-size: 0.9rem; margin: 0.25rem 0;">• ${ex.name}: ${ex.previous} → ${ex.current}</div>`
        ).join('')}
                    </div>
                `;
    }

    if (exerciseChanges.decreased.length > 0) {
        exerciseBreakdownHTML += `
                    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(196, 115, 109, 0.1); border-radius: 8px; border-left: 3px solid #C4736D;">
                        <div style="color: #C4736D; font-weight: bold; margin-bottom: 0.5rem;">↓ Decreased</div>
                        ${exerciseChanges.decreased.map(ex =>
            `<div style="font-size: 0.9rem; margin: 0.25rem 0;">• ${ex.name}: ${ex.previous} → ${ex.current}</div>`
        ).join('')}
                    </div>
                `;
    }

    // Check for plateaued exercises (need 3+ sessions)
    if (workouts.length >= 3) {
        const plateauedExercises = [];
        const thirdSession = workouts[2];

        Object.values(lastSession.exercises || {}).forEach(lastEx => {
            const exName = lastEx.exercise;
            const prevEx = Object.values(previousSession.exercises || {}).find(e => e.exercise === exName);
            const thirdEx = Object.values(thirdSession.exercises || {}).find(e => e.exercise === exName);

            if (prevEx && thirdEx) {
                const lastMax = Math.max(...lastEx.sets.map(s => (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)));
                const prevMax = Math.max(...prevEx.sets.map(s => (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)));
                const thirdMax = Math.max(...thirdEx.sets.map(s => (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)));

                if (lastMax === prevMax && prevMax === thirdMax && lastMax > 0) {
                    const bestSet = lastEx.sets.find(s => (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0) === lastMax);
                    plateauedExercises.push({
                        name: exName,
                        value: `${parseFloat(bestSet?.weight) || 0}×${parseInt(bestSet?.reps) || 0}`
                    });
                }
            }
        });

        if (plateauedExercises.length > 0) {
            exerciseBreakdownHTML += `
                        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(212, 168, 75, 0.1); border-radius: 8px; border-left: 3px solid #D4A84B;">
                            <div style="color: #D4A84B; font-weight: bold; margin-bottom: 0.5rem;">Plateaued (3+ sessions)</div>
                            ${plateauedExercises.map(ex =>
                `<div style="font-size: 0.9rem; margin: 0.25rem 0;">• ${ex.name}: ${ex.value}</div>`
            ).join('')}
                        </div>
                    `;
        }
    }

    container.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <strong style="color: white;">Last Session</strong>
                        <div style="margin-top: 0.5rem;">
                            <div>Volume: <strong>${lastVolume.toLocaleString()} lbs</strong></div>
                            <div style="font-size: 0.8rem; color: var(--color-text-secondary);">${new Date(lastSession.date).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div>
                        <strong style="color: white;">Previous Session</strong>
                        <div style="margin-top: 0.5rem;">
                            <div>Volume: <strong>${previousVolume.toLocaleString()} lbs</strong></div>
                            <div style="font-size: 0.8rem; color: var(--color-text-secondary);">${new Date(previousSession.date).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 1rem; padding: 1rem; background: ${isImproving ? 'rgba(93, 138, 102, 0.1)' : 'rgba(196, 115, 109, 0.1)'}; border-radius: 8px; border-left: 4px solid ${changeColor};">
                    <div style="color: ${changeColor}; font-weight: bold; font-size: 1.1rem;">
                        ${changeIcon} ${isImproving ? 'Improving' : 'Declining'}
                    </div>
                    <div style="margin-top: 0.5rem; color: var(--color-text-primary);">
                        Volume Change: <strong style="color: ${changeColor};">${volumeChange > 0 ? '+' : ''}${volumeChange.toLocaleString()} lbs (${volumeChangePercent > 0 ? '+' : ''}${volumeChangePercent}%)</strong>
                    </div>
                </div>
                ${exerciseBreakdownHTML}
            `;
}



// UI Functions
function updateSuggestions() {
    const suggestions = generateAdvancedSuggestions();
    const container = document.getElementById('suggestions-container');

    container.innerHTML = suggestions.map(suggestion => `
                <div class="suggestion-card">
                    <div class="suggestion-type">${suggestion.type}</div>
                    <div class="suggestion-text">${suggestion.text}</div>
                </div>
            `).join('');
}

function updateAnalytics() {
    const streakEl = document.getElementById('workout-streak');
    if (streakEl) streakEl.textContent = calculateWorkoutStreak();

    const weekEl = document.getElementById('sessions-this-week');
    if (weekEl) weekEl.textContent = countSessionsInLastDays(7);

    updateWeeklySets();
    updateEstimatedMaxes();
    updateProgressionSnapshot();
    updateFocusAreas();
    populateComparisonSelector();
}

// Sessions actually logged in a real date window, excluding rest days.
function countSessionsInLastDays(days) {
    const today = getTodayDateString();
    const from = addDaysToDateString(today, -(days - 1));
    return allWorkouts.filter(w =>
        w.date >= from && w.date <= today && normalizeLabel(w.day) !== 'rest'
    ).length;
}

// ---------------------------------------------------------------------------
// Hard sets per muscle group per week.
//
// Volume in pounds (weight x reps) was the app's headline training metric and
// it scores every bodyweight movement as ZERO: pull-ups, dips, hollow holds and
// every rung of the front lever ladder. Counting working sets is the standard
// currency for hypertrophy, it handles bodyweight work correctly, and it does
// not care what the program's days are named.
// ---------------------------------------------------------------------------

const MUSCLE_GROUP_PATTERNS = [
    { group: 'Chest',      match: ['bench press', 'chest press', 'incline press', 'incline dumbbell press',
                                   'decline press', 'chest fly', 'cable fly', 'pec deck', 'dip', 'push-up',
                                   'pushup', 'push up', 'chest', 'fly', 'press'] },
    { group: 'Back',       match: ['barbell row', 'dumbbell row', 'cable row', 'chest-supported row',
                                   'lat pulldown', 'pulldown', 'straight-arm pulldown', 'pull-up', 'pullup',
                                   'pull up', 'chin-up', 'chinup', 'front lever', 'scapular pull', 'row',
                                   'shrug', 'dead hang'] },
    { group: 'Shoulders',  match: ['overhead press', 'shoulder press', 'military press', 'lateral raise',
                                   'side raise', 'rear delt', 'face pull', 'handstand', 'pike push-up',
                                   'pike push up', 'upright row', 'delt'] },
    { group: 'Biceps',     match: ['bicep curl', 'incline curl', 'hammer curl', 'preacher curl', 'curl'] },
    { group: 'Triceps',    match: ['triceps extension', 'overhead extension', 'skull crusher', 'pushdown',
                                   'tricep', 'triceps'] },
    { group: 'Quads',      match: ['back squat', 'front squat', 'goblet squat', 'hack squat', 'split squat',
                                   'bulgarian split squat', 'leg press', 'leg extension', 'reverse lunge',
                                   'lunge', 'step-up', 'step up', 'squat'] },
    { group: 'Hamstrings', match: ['romanian deadlift', 'stiff leg deadlift', 'trap bar deadlift', 'deadlift',
                                   'rdl', 'seated leg curl', 'lying leg curl', 'leg curl', 'back extension',
                                   'good morning', 'nordic'] },
    { group: 'Glutes',     match: ['hip thrust', 'glute bridge', 'hip abduction', 'side-lying hip abduction',
                                   'lateral walk', 'abduction', 'glute'] },
    { group: 'Calves',     match: ['standing calf raise', 'seated calf raise', 'calf raise', 'calf',
                                   'tibialis raise', 'tibialis'] },
    { group: 'Core',       match: ['hollow body hold', 'hollow hold', 'hollow', 'ab wheel', 'dead bug',
                                   'pallof press', 'pallof', 'side plank', 'plank', 'l-sit', 'l sit',
                                   'hanging leg raise', 'leg raise', 'crunch'] }
];

// Longest match wins. A first-match-wins loop classified "Cable Lateral Raise"
// as Back (because 'lat' is a substring of 'lateral') and failed to classify
// "Incline Dumbbell Press" at all. Scoring by the length of the matched token
// makes 'lateral raise' beat 'lat', and 'overhead press' beat 'press'.
function classifyMuscleGroup(exerciseName) {
    const name = normalizeLabel(exerciseName);
    if (!name) return null;

    let best = null;
    let bestLength = 0;

    for (const entry of MUSCLE_GROUP_PATTERNS) {
        for (const token of entry.match) {
            if (name.includes(token) && token.length > bestLength) {
                bestLength = token.length;
                best = entry.group;
            }
        }
    }

    return best;
}

// ---------------------------------------------------------------------------
// Equipment.
//
// A session you cannot physically do is worse than no suggestion at all. The
// main gym has a rack, barbell, dumbbells, a bench, a cable stack and a pull-up
// bar - but no leg press, no leg curl or extension machines, and no back
// extension bench. Those live at the full gym. Home has a pull-up bar,
// dumbbells (one to 50 lb, two 25s), a flat bench, a bike, a treadmill and a
// Vitruvian - which covers cable-style loading, so 'cable' work is available
// at home too. What home lacks is a barbell with a rack, and the machines.
//
// Home is also the only place with a floor clean enough to touch: floor work
// (push-ups, handstands, planks, anything lying down) is home-only.
//
// Every exercise is classified by the one piece of kit it cannot happen
// without, using the same longest-match scoring as the muscle classifier, and
// the generator only offers what today's location can actually provide.
// ---------------------------------------------------------------------------

const LOCATIONS = {
    main: { label: 'Main gym', has: ['bodyweight', 'pullup', 'dipbars', 'dumbbell', 'barbell', 'cable', 'incline'] },
    full: { label: 'Full gym', has: ['bodyweight', 'pullup', 'dipbars', 'dumbbell', 'barbell', 'cable', 'incline', 'machine'] },
    home: { label: 'Home',     has: ['bodyweight', 'pullup', 'dumbbell', 'cable', 'floor'] }
};

// Longest match wins, so 'cable back extension' is cable work even though
// 'back extension' alone means the 45-degree bench the main gym does not have,
// and 'goblet squat' is a dumbbell even though a bare 'squat' needs the rack.
// A trap bar is filed under 'machine': not literally a machine, but the same
// class of kit - only the full gym has one.
const EQUIPMENT_PATTERNS = [
    { equipment: 'machine',   match: ['leg press', 'leg extension', 'seated leg curl', 'lying leg curl',
                                      'leg curl', 'hack squat', 'pec deck', 'smith', 'machine',
                                      'seated calf raise', 'back extension', 'hip abduction machine',
                                      'chest press machine', 'assisted', 'trap bar'] },
    { equipment: 'cable',     match: ['cable', 'pulldown', 'pushdown', 'face pull', 'pallof',
                                      'cable back extension', 'triceps rope', 'rope extension'] },
    { equipment: 'barbell',   match: ['barbell', 'back squat', 'front squat', 'deadlift', 'romanian deadlift',
                                      'rdl', 'good morning', 'hip thrust', 'bench press', 'overhead press',
                                      'military press', 'close-grip bench', 'skull crusher'] },
    { equipment: 'dumbbell',  match: ['dumbbell', 'goblet squat', 'goblet', 'hammer curl', 'lateral raise',
                                      'side raise', 'rear delt', 'incline curl', 'preacher curl', 'curl',
                                      'shoulder press', 'chest press', 'fly', 'row', 'shrug', 'step-up',
                                      'step up', 'lunge', 'split squat', 'weighted'] },
    { equipment: 'dipbars',   match: ['dip', 'weighted dip'] },
    // Anything with hands or body on the floor needs a floor you would touch.
    // The gyms' floors are not that; home's is. Standing bodyweight work
    // (squats, calf raises) is unaffected.
    { equipment: 'floor',     match: ['push-up', 'pushup', 'push up', 'handstand', 'plank',
                                      'hollow', 'dead bug', 'glute bridge', 'side-lying',
                                      'ab wheel', 'l-sit', 'l sit', 'nordic', 'swimmer',
                                      'bird dog', 'superman', 'crunch'] },
    // The home bench is flat, so anything on an incline stays at the gyms.
    // The full phrases outrank 'dumbbell' in longest-match scoring.
    { equipment: 'incline',   match: ['incline', 'incline press', 'incline dumbbell press',
                                      'incline curl', 'incline dumbbell curl', 'incline fly',
                                      'incline bench press', 'incline row'] },
    { equipment: 'pullup',    match: ['pull-up', 'pullup', 'pull up', 'chin-up', 'chinup', 'dead hang',
                                      'front lever', 'scapular pull', 'hanging leg raise', 'hanging knee raise',
                                      'inverted row'] }
];

// Anything unmatched is bodyweight: push-ups, planks, holds, handstands, walks.
function classifyEquipment(exerciseName) {
    const name = normalizeLabel(exerciseName);
    if (!name) return 'bodyweight';

    let best = 'bodyweight';
    let bestLength = 0;
    for (const entry of EQUIPMENT_PATTERNS) {
        for (const token of entry.match) {
            if (name.includes(token) && token.length > bestLength) {
                bestLength = token.length;
                best = entry.equipment;
            }
        }
    }
    return best;
}

function availableAt(exerciseName, locationKey) {
    const location = LOCATIONS[locationKey];
    if (!location) return true;
    return location.has.includes(classifyEquipment(exerciseName));
}

// When the program's own exercises for a group all need kit today's gym does
// not have, these stand in - rack, dumbbell, cable and bodyweight staples, so
// every group is coverable at the main gym and most of them at home. Seated
// Leg Curl at the full gym becomes a Romanian Deadlift at the main one, not a
// blank.
const FALLBACK_EXERCISES = {
    Chest:      [{ name: 'Barbell Bench Press', reps: '6-8' }, { name: 'Dumbbell Bench Press', reps: '8-10' },
                 { name: 'Push-Up', reps: '10-15', trackingType: 'reps' }],
    Back:       [{ name: 'Barbell Row', reps: '6-10' }, { name: 'One-Arm Dumbbell Row', reps: '8-12' },
                 { name: 'Pull-Up', reps: '5-8', trackingType: 'reps' }],
    Shoulders:  [{ name: 'Overhead Press', reps: '6-8' }, { name: 'Dumbbell Shoulder Press', reps: '8-10' },
                 { name: 'Pike Push-Up', reps: '8-12', trackingType: 'reps' }],
    Biceps:     [{ name: 'Dumbbell Curl', reps: '8-12' },
                 { name: 'Chin-Up', reps: '5-8', trackingType: 'reps' }],
    Triceps:    [{ name: 'Close-Grip Bench Press', reps: '6-10' },
                 { name: 'Overhead Dumbbell Triceps Extension', reps: '10-12' },
                 { name: 'Diamond Push-Up', reps: '8-12', trackingType: 'reps' }],
    Quads:      [{ name: 'Back Squat', reps: '5-8' }, { name: 'Goblet Squat', reps: '8-12' },
                 { name: 'Bulgarian Split Squat', reps: '8-10' },
                 { name: 'Bodyweight Squat', reps: '15-20', trackingType: 'reps' }],
    Hamstrings: [{ name: 'Romanian Deadlift', reps: '6-10' }, { name: 'Good Morning', reps: '8-10' },
                 { name: 'Cable Back Extension', reps: '10-15' }, { name: 'Dumbbell Romanian Deadlift', reps: '8-12' }],
    Glutes:     [{ name: 'Barbell Hip Thrust', reps: '8-12' }, { name: 'Dumbbell Step-Up', reps: '8-10' },
                 { name: 'Glute Bridge', reps: '15-20', trackingType: 'reps' }],
    Calves:     [{ name: 'Standing Calf Raise', reps: '12-15' }],
    Core:       [{ name: 'Hanging Knee Raise', reps: '8-12', trackingType: 'reps' },
                 { name: 'Hollow Body Hold', reps: '20-30s', trackingType: 'time' },
                 { name: 'Plank', reps: '30-45s', trackingType: 'time' }]
};

// The program's own exercises first (their history is what progressive overload
// tracks), the fallbacks only when the location rules everything out.
function usableOptionsFor(group, pool, locationKey) {
    const own = (pool[group] || []).filter(e => availableAt(e.name, locationKey));
    if (own.length > 0) return own;
    return (FALLBACK_EXERCISES[group] || [])
        .filter(e => availableAt(e.name, locationKey))
        .map(e => ({ name: e.name, reps: e.reps,
                     trackingType: e.trackingType || guessTrackingType(e.name) }));
}

// A set counts when it was actually performed: any reps logged, or a completed
// checkbox for a hold. Weight is deliberately not required.
function isWorkingSet(set) {
    if (!set) return false;
    if (set.completed === true) return true;
    const reps = parseInt(set.reps, 10);
    if (Number.isFinite(reps) && reps > 0) return true;
    // A 30 second hold is a working set even though it has no reps.
    const seconds = parseFloat(set.seconds);
    if (Number.isFinite(seconds) && seconds > 0) return true;
    // A logged walk is training too; it was counting as zero.
    const minutes = parseFloat(set.minutes);
    if (Number.isFinite(minutes) && minutes > 0) return true;
    return false;
}

function getWeeklySetCounts(days = 7) {
    const today = getTodayDateString();
    const from = addDaysToDateString(today, -(days - 1));
    const counts = {};

    allWorkouts.forEach(workout => {
        if (!workout || workout.date < from || workout.date > today) return;
        if (normalizeLabel(workout.day) === 'rest') return;

        Object.values(workout.exercises || {}).forEach(exercise => {
            if (!exercise || !exercise.exercise) return;
            const name = exercise.substitution || exercise.exercise;
            if (normalizeLabel(name).includes('stretch')) return;

            const group = classifyMuscleGroup(name);
            if (!group) return;

            // A ticked mobility drill is not a hard set. Counting check-offs
            // put stretches into the muscle-group totals alongside real work.
            const type = exercise.trackingType && TRACKING_TYPES[exercise.trackingType]
                ? exercise.trackingType
                : guessTrackingType(name);
            if (type === 'checkoff') return;

            const sets = (exercise.sets || []).filter(isWorkingSet).length;
            if (sets > 0) counts[group] = (counts[group] || 0) + sets;
        });
    });

    return counts;
}

// ---------------------------------------------------------------------------
// The week as the unit.
//
// The schedule queue answers "what do I owe today", which assumes training is
// the main event in the day. For someone working 7:30-4 and coaching fencing
// 5-9 three nights a week, that question has no good answer most days, and a
// score built on it punishes exactly the thing the schedule forces.
//
// Weekly volume is the honest measure: hit the sets across whatever days open
// up and the week is a success, whether that took two sessions or five.
//
// Targets are hard sets per muscle group per week. Roughly 4-6 maintains and
// ~10 grows, so these sit in the range that keeps muscle through a deficit
// without needing five gym days. Direct leg work is deliberately low: three
// hours a night of coaching is already loading them.
// ---------------------------------------------------------------------------

const DEFAULT_WEEKLY_TARGETS = {
    Chest: 9, Back: 9, Shoulders: 7, Biceps: 5, Triceps: 5,
    Quads: 7, Hamstrings: 6, Glutes: 5, Calves: 4, Core: 6
};

function getWeeklyTargets() {
    const custom = activeProgram && activeProgram.weeklyTargets;
    if (custom && typeof custom === 'object' && Object.keys(custom).length) {
        return { ...DEFAULT_WEEKLY_TARGETS, ...custom };
    }
    return { ...DEFAULT_WEEKLY_TARGETS };
}

// The training week runs Sunday to Saturday and resets on Saturday night, which
// is how the owner thinks about his week. A fixed week, rather than a rolling
// 7-day window, means "this week" says the same thing on Saturday night as it
// did on Monday morning; a rolling window quietly drops the earliest day's work
// partway through.
const WEEK_STARTS_ON = 0;   // 0 = Sunday

function getWeekStartDate(dateString = getTodayDateString()) {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const offset = (date.getDay() - WEEK_STARTS_ON + 7) % 7;
    return addDaysToDateString(dateString, -offset);
}

// Days remaining in the week INCLUDING today, so both panels say the same
// thing. Two different definitions of "days left" sitting next to each other
// read as a bug even when both are defensible.
function getDaysLeftInWeek(dateString = getTodayDateString()) {
    return 7 - daysBetween(getWeekStartDate(dateString), dateString);
}

function getSetsThisWeek() {
    const today = getTodayDateString();
    const from = getWeekStartDate(today);
    const counts = {};

    allWorkouts.forEach(workout => {
        if (!workout || workout.date < from || workout.date > today) return;
        if (isNonTrainingLabel(workout.day)) return;

        Object.values(workout.exercises || {}).forEach(exercise => {
            if (!exercise || !exercise.exercise) return;
            const name = exercise.substitution || exercise.exercise;
            if (normalizeLabel(name).includes('stretch')) return;

            const group = classifyMuscleGroup(name);
            if (!group) return;

            const type = exercise.trackingType && TRACKING_TYPES[exercise.trackingType]
                ? exercise.trackingType
                : guessTrackingType(name);
            if (type === 'checkoff') return;

            const sets = (exercise.sets || []).filter(isWorkingSet).length;
            if (sets > 0) counts[group] = (counts[group] || 0) + sets;
        });
    });

    return counts;
}

// What is still owed this week, per group, and how loudly. Shared by the week
// view and (later) the session generator, so both read one answer.
function getWeeklyDebt() {
    const targets = getWeeklyTargets();
    const done = getSetsThisWeek();
    // Capped per group: fencing can quiet a leg bar but never fill it, because
    // footwork is not loaded work and loaded work is what holds muscle through
    // a deficit. Without the cap, fifteen hours of coaching would report legs
    // as covered every week and direct leg work would never get suggested.
    const fenced = getFencingSetsThisWeek();

    return Object.keys(targets).map(group => {
        const target = targets[group];
        const doneSets = done[group] || 0;
        const fencingSets = Math.min(
            Math.round(fenced[group] || 0),
            Math.floor(target * FENCING_CREDIT_SHARE)
        );
        const credited = doneSets + fencingSets;
        const debt = Math.max(0, target - credited);
        const daysLeft = Math.max(1, getDaysLeftInWeek());
        const pct = target > 0 ? Math.min(100, Math.round((doneSets / target) * 100)) : 100;
        const fencingPct = target > 0
            ? Math.min(100 - pct, Math.round((fencingSets / target) * 100))
            : 0;
        return {
            group,
            target,
            done: doneSets,
            fencing: fencingSets,
            credited,
            debt,
            // Per remaining day: owing 8 sets on Sunday is louder than owing 8
            // on Tuesday, which is what makes the ordering useful.
            urgency: debt / daysLeft,
            // pct is lifted sets only; fencingPct is the segment stacked after
            // it, so the bar shows which part of the week was actually loaded.
            pct,
            fencingPct
        };
    }).sort((a, b) => b.urgency - a.urgency || b.debt - a.debt);
}

// One number for the week: how much of the prescribed volume actually landed.
// Capped at 100 per group so a big chest day cannot paper over untouched legs.
function getWeeklyVolumeScore() {
    const rows = getWeeklyDebt();
    if (rows.length === 0) return { score: 0, done: 0, target: 0, groupsHit: 0, groups: 0 };

    const totalTarget = rows.reduce((sum, r) => sum + r.target, 0);
    const credited = rows.reduce((sum, r) => sum + Math.min(r.credited, r.target), 0);

    return {
        score: totalTarget > 0 ? Math.round((credited / totalTarget) * 100) : 0,
        done: rows.reduce((sum, r) => sum + r.done, 0),
        fencing: rows.reduce((sum, r) => sum + r.fencing, 0),
        target: totalTarget,
        groupsHit: rows.filter(r => r.debt === 0).length,
        groups: rows.length
    };
}

// ---------------------------------------------------------------------------
// Fencing.
//
// Fifteen hours a week of coaching, plus twelve-hour tournament days, was
// invisible to this app. That made two things wrong at once: the week looked
// like a week of sitting still, and the generator happily prescribed squats the
// morning after eight hours on a strip.
//
// Fencing is logged as hours, not sets, because that is how it is actually
// experienced, and converted into an equivalent-set load for the muscles it
// really taxes. The conversion is deliberately conservative - coaching is not
// the same stimulus as a loaded set - but a nudge in the right direction beats
// a zero.
// ---------------------------------------------------------------------------

// What fencing actually loads. Legs and calves take the footwork, core takes
// the trunk position; the pull and press muscles are barely touched, which is
// why a heavy coaching night pushes the generator toward upper body rather than
// toward rest.
const FENCING_GROUP_LOAD = {
    Quads: 1, Calves: 0.9, Glutes: 0.6, Hamstrings: 0.5, Core: 0.4
};

// Hours are not equal. Coaching is mostly instructing on your feet; a lesson or
// a training night is you doing the work; a tournament is that plus a day of
// standing, waiting and adrenaline.
const FENCING_KINDS = {
    Coaching:   { weight: 0.6, label: 'Coaching' },
    Training:   { weight: 1.0, label: 'Training / lesson' },
    Tournament: { weight: 1.2, label: 'Tournament' }
};

// One hour of fencing is worth roughly this many hard sets to the legs before
// the kind weighting. Three hours of coaching lands near 2.7 quad-equivalent
// sets, so three coaching nights a week covers most of a maintenance dose.
const FENCING_SETS_PER_HOUR = 1.5;

// Hour twelve of a tournament is not hour one. Past this the day stops adding
// training stimulus and only adds fatigue, which the fatigue factor handles
// separately.
const FENCING_HOURS_CAP = 8;

// Fencing can cover at most this share of a group's weekly target. Footwork
// keeps legs busy but it is not loaded work, and loaded work is what protects
// muscle in a deficit - so it can quiet the bar, never fill it.
const FENCING_CREDIT_SHARE = 0.5;

function fencingEntries() {
    return Array.isArray(window.fencingData) ? window.fencingData : [];
}

function fencingEntriesBetween(fromDate, toDate) {
    return fencingEntries().filter(e => e && e.date >= fromDate && e.date <= toDate);
}

function fencingKindWeight(kind) {
    return (FENCING_KINDS[kind] || FENCING_KINDS.Coaching).weight;
}

// Raw hours, for the fatigue calculation and the week header.
function fencingHoursBetween(fromDate, toDate) {
    return fencingEntriesBetween(fromDate, toDate)
        .reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
}

// Equivalent hard sets per muscle group over a date range.
function fencingSetsByGroup(fromDate, toDate) {
    const counts = {};
    fencingEntriesBetween(fromDate, toDate).forEach(entry => {
        const hours = Math.min(Number(entry.hours) || 0, FENCING_HOURS_CAP);
        if (hours <= 0) return;
        const base = hours * FENCING_SETS_PER_HOUR * fencingKindWeight(entry.kind);
        Object.keys(FENCING_GROUP_LOAD).forEach(group => {
            counts[group] = (counts[group] || 0) + base * FENCING_GROUP_LOAD[group];
        });
    });
    Object.keys(counts).forEach(g => { counts[g] = Math.round(counts[g] * 10) / 10; });
    return counts;
}

// Equivalent sets over the same window getRecentSetsByGroup uses, so the two
// can simply be added together inside recoveryFactor.
function getRecentFencingSets(days = 2) {
    const today = getTodayDateString();
    return fencingSetsByGroup(addDaysToDateString(today, -(days - 1)), today);
}

function getFencingSetsThisWeek() {
    const today = getTodayDateString();
    return fencingSetsByGroup(getWeekStartDate(today), today);
}

// Whole-body tiredness, separate from any one muscle. A tournament Saturday
// does not make your chest sore, but it does mean Sunday is not the day for a
// full session. Yesterday counts half: you have slept since.
function fencingFatigueFactor() {
    const today = getTodayDateString();
    const yesterday = addDaysToDateString(today, -1);
    const load = fencingHoursBetween(today, today)
        + fencingHoursBetween(yesterday, yesterday) * 0.5;

    if (load >= 8) return { factor: 0.4, load, note: 'a long day on the strip' };
    if (load >= 5) return { factor: 0.6, load, note: 'a heavy fencing day' };
    if (load >= 3) return { factor: 0.8, load, note: 'a coaching night' };
    return { factor: 1, load, note: '' };
}

// ---- Logging ---------------------------------------------------------------

async function loadFencingData() {
    try {
        const snapshot = await getDocs(query(collection(db, 'fencing'), orderBy('date', 'desc')));
        window.fencingData = [];
        snapshot.forEach(document => {
            window.fencingData.push({ id: document.id, ...document.data() });
        });
    } catch (e) {
        console.error('Error loading fencing data:', e);
        if (!Array.isArray(window.fencingData)) window.fencingData = [];
    }
}

function refreshAfterFencingChange() {
    renderFencingPanel();
    renderWeeklyVolume();
    updateNutritionCalories();   // the activity component just changed
    // A logged session changes what today should be, so any suggestion already
    // on screen is stale the moment fencing is added.
    // A persisted session is a plan the user may be mid-way through - fencing
    // logged later in the day must not rewrite it. Only a transient rest
    // verdict gets recomputed.
    if (!generatedToday && suggestedMinutes !== null && suggestedLocation !== null) {
        suggestedSession = generateSession(suggestedMinutes, suggestedLocation);
    }
    renderTodayPanel();
}

window.logFencing = async function (kind, hours) {
    if (!FENCING_KINDS[kind]) return;
    const entry = {
        date: getTodayDateString(),
        kind,
        hours: Number(hours),
        createdAt: new Date().toISOString()
    };
    // Shown before the write lands. The panel is a tap target on a phone in a
    // gym car park; waiting on a round trip to redraw feels broken.
    if (!Array.isArray(window.fencingData)) window.fencingData = [];
    window.fencingData.unshift(entry);
    fencingKind = null;
    refreshAfterFencingChange();

    try {
        const ref = await addDoc(collection(db, 'fencing'), entry);
        entry.id = ref.id;
        showToast(`${hours}h ${FENCING_KINDS[kind].label.toLowerCase()} logged.`, 'success');
    } catch (e) {
        console.error('Error saving fencing:', e);
        window.fencingData = fencingEntries().filter(x => x !== entry);
        refreshAfterFencingChange();
        showToast('Could not save that. Check your connection.', 'error');
    }
};

window.removeFencing = async function (id) {
    const entry = fencingEntries().find(e => e.id === id);
    if (!entry) return;
    if (!confirm(`Remove ${entry.hours}h ${FENCING_KINDS[entry.kind]
        ? FENCING_KINDS[entry.kind].label.toLowerCase() : 'fencing'} on ${entry.date}?`)) return;

    window.fencingData = fencingEntries().filter(e => e.id !== id);
    refreshAfterFencingChange();
    try {
        await deleteDoc(doc(db, 'fencing', id));
    } catch (e) {
        console.error('Error removing fencing:', e);
        window.fencingData.unshift(entry);
        refreshAfterFencingChange();
        showToast('Could not remove that.', 'error');
    }
};

// ---- Panel -----------------------------------------------------------------

// Hours offered as chips rather than typed. Every real answer is on this list,
// and a number pad on a phone is three taps and a dismissed keyboard.
const FENCING_HOUR_CHIPS = [1, 1.5, 2, 3, 4, 6, 8, 12];

let fencingKind = null;     // null until a kind is picked, then hours show

window.pickFencingKind = function (kind) {
    fencingKind = fencingKind === kind ? null : kind;
    renderFencingPanel();
};

function renderFencingPanel() {
    const container = document.getElementById('fencing-panel');
    if (!container) return;

    const today = getTodayDateString();
    const weekHours = fencingHoursBetween(getWeekStartDate(today), today);
    const todayEntries = fencingEntriesBetween(today, today);

    let html = `
        <div class="fencing-head">
            <span class="fencing-title">Fencing</span>
            <span class="fencing-hours">${formatFencingHours(weekHours)} this week</span>
        </div>`;

    if (todayEntries.length) {
        html += '<div class="fencing-today">';
        todayEntries.forEach(entry => {
            const label = FENCING_KINDS[entry.kind] ? FENCING_KINDS[entry.kind].label : entry.kind;
            html += `<span class="fencing-entry">${formatFencingHours(entry.hours)} ${escapeHtml(label)}`;
            if (entry.id) {
                html += `<button type="button" class="fencing-remove" data-remove="${escapeHtml(entry.id)}"
                                 aria-label="Remove">&times;</button>`;
            }
            html += '</span>';
        });
        html += '</div>';
    }

    html += '<div class="fencing-kinds">';
    Object.keys(FENCING_KINDS).forEach(kind => {
        const active = fencingKind === kind ? ' active' : '';
        html += `<button type="button" class="fencing-kind${active}" data-kind="${kind}">${
            escapeHtml(FENCING_KINDS[kind].label)}</button>`;
    });
    html += '</div>';

    if (fencingKind) {
        html += '<div class="fencing-hour-chips">';
        FENCING_HOUR_CHIPS.forEach(h => {
            html += `<button type="button" class="fencing-hour" data-hours="${h}">${formatFencingHours(h)}</button>`;
        });
        html += '</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll('[data-kind]').forEach(btn => {
        btn.addEventListener('click', () => pickFencingKind(btn.getAttribute('data-kind')));
    });
    container.querySelectorAll('[data-hours]').forEach(btn => {
        btn.addEventListener('click', () => logFencing(fencingKind, Number(btn.getAttribute('data-hours'))));
    });
    container.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => removeFencing(btn.getAttribute('data-remove')));
    });
}

function formatFencingHours(hours) {
    const n = Number(hours) || 0;
    return `${Number.isInteger(n) ? n : n.toFixed(1)}h`;
}

// ---------------------------------------------------------------------------
// Today's suggestion.
//
// A named weekly grid - Lower B on Thursday - is an assignment you can fail. On
// a week that runs 7:30-4 at work and 5-9 coaching, you fail it most weeks, and
// the app turns into a list of your shortcomings.
//
// A suggestion is different: it is regenerated from today's facts every time you
// look, so there is nothing to fall behind on. What it offers depends on how
// much of the week's volume is still owed, what was trained in the last 48
// hours, and how long you say you have.
//
// The two behaviours this needs both fall out of the recovery factor:
//   - trained chest yesterday, back today  -> chest scores 0, so it picks others
//   - nothing logged for three days        -> everything recovered, biggest
//                                             debts win, which is a full body day
// ---------------------------------------------------------------------------

// A hard set plus its rest and setup runs about 2.7 minutes in practice.
const MINUTES_PER_SET = 2.7;

// Options offered as chips. "Whatever I've got" covers a session with no clock.
const SESSION_LENGTHS = [15, 30, 45, 60];

// Past roughly this many hard sets for one muscle in one session, extra sets
// cost full fatigue for progressively less return. Cramming a week of missed
// volume into one day does not work, so the generator spreads across more
// muscle groups instead of piling onto one.
const MAX_SETS_PER_GROUP_PER_SESSION = 8;

// The one sanctioned exception: when a single group is essentially untouched
// (8+ sets behind - the weekly targets top out at 9, so this means nothing
// happened all week) AND the week is nearly over, the session leads with a
// German-volume-style 10x10 on ONE movement at a deliberately light load. Ten
// sets at ~60% is a designed scheme, not ten maximal sets - the light load is
// what makes the volume survivable, and the per-scheme history matching keeps
// those light numbers from ever becoming the reference for a normal day.
//
// The late-week gate matters: without it, every fresh week's first long
// session would open with a 10x10, which is a catch-up tool promoted to a
// default.
const VOLUME_DAY_DEBT_THRESHOLD = 8;
const VOLUME_DAY_SETS = 10;
const VOLUME_DAY_MIN_MINUTES = 45;
const VOLUME_DAY_MAX_DAYS_LEFT = 3;

function setsForMinutes(minutes) {
    return Math.max(2, Math.round(minutes / MINUTES_PER_SET));
}

// Hard sets per muscle group over the last N days, used to back off anything
// that has not recovered yet.
function getRecentSetsByGroup(days = 2) {
    const today = getTodayDateString();
    const from = addDaysToDateString(today, -days);
    const counts = {};

    allWorkouts.forEach(workout => {
        if (!workout || workout.date <= from || workout.date > today) return;
        if (isNonTrainingLabel(workout.day)) return;
        Object.values(workout.exercises || {}).forEach(exercise => {
            if (!exercise || !exercise.exercise) return;
            const name = exercise.substitution || exercise.exercise;
            const group = classifyMuscleGroup(name);
            if (!group) return;
            const sets = (exercise.sets || []).filter(isWorkingSet).length;
            if (sets > 0) counts[group] = (counts[group] || 0) + sets;
        });
    });
    return counts;
}

// 1.0 = fresh, 0 = already worked hard today. Anything trained yesterday drops
// down the order without being banned outright, so a light touch is still
// possible if nothing else is owed.
//
// Fencing counts here at its equivalent-set value. Three hours of footwork on
// Thursday night is real quad work whether or not it came off a rack, and a
// generator that cannot see it will keep prescribing squats on Friday morning.
function recoveryFactor(group) {
    const todaySets = (getRecentSetsByGroup(1)[group] || 0)
        + (getRecentFencingSets(1)[group] || 0);
    const last48 = (getRecentSetsByGroup(2)[group] || 0)
        + (getRecentFencingSets(2)[group] || 0);
    if (todaySets >= 4) return 0;
    if (todaySets > 0) return 0.3;
    if (last48 >= 4) return 0.6;
    return 1;
}

// Every exercise the active program knows about, grouped by muscle. Includes
// sessions that are not on the schedule, so a circuit or a home session is
// available to draw from.
function getExercisePool() {
    const pool = {};
    const workouts = (activeProgram && activeProgram.workouts) || {};

    Object.values(workouts).forEach(list => {
        (Array.isArray(list) ? list : []).forEach(exercise => {
            if (!exercise || !exercise.name) return;
            const type = exercise.trackingType || guessTrackingType(exercise.name);
            if (type === 'checkoff') return;          // mobility is not a hard set
            const group = classifyMuscleGroup(exercise.name);
            if (!group) return;
            if (!pool[group]) pool[group] = [];
            if (!pool[group].some(e => normalizeLabel(e.name) === normalizeLabel(exercise.name))) {
                pool[group].push(exercise);
            }
        });
    });
    return pool;
}

// How often each exercise has actually been logged. Used to keep picking the
// SAME movement for a group session after session: varying the exercise every
// time would mean never repeating a lift enough to progress it, which costs the
// main thing that protects muscle in a deficit.
function getExerciseFrequency() {
    const freq = {};
    allWorkouts.forEach(workout => {
        Object.values(workout.exercises || {}).forEach(exercise => {
            if (!exercise || !exercise.exercise) return;
            const key = normalizeLabel(exercise.substitution || exercise.exercise);
            freq[key] = (freq[key] || 0) + 1;
        });
    });
    return freq;
}

// Returns { minutes, totalSets, groups, exercises, rest, reason, fatigueNote }
function generateSession(minutes, locationKey = 'full') {
    // A twelve-hour tournament Saturday does not make any one muscle sore, but
    // it does mean Sunday is not a full session. Scale the whole budget down
    // rather than dropping groups, so what is left is a real short session
    // instead of a truncated long one.
    const fatigue = fencingFatigueFactor();
    const budget = Math.max(2, Math.round(setsForMinutes(minutes) * fatigue.factor));
    const fatigueNote = fatigue.factor < 1
        ? `Trimmed for ${fatigue.note} - ${formatFencingHours(fatigue.load)} of fencing load behind you.`
        : '';
    const pool = getExercisePool();
    const freq = getExerciseFrequency();

    const candidates = getWeeklyDebt()
        .filter(row => row.debt > 0 && usableOptionsFor(row.group, pool, locationKey).length > 0)
        .map(row => ({ ...row, recovery: recoveryFactor(row.group) }))
        .map(row => ({ ...row, score: row.urgency * row.recovery }))
        .filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
        const anyDebt = getWeeklyDebt().some(r => r.debt > 0);
        let reason;
        if (!anyDebt) {
            reason = 'The week is done. Nothing is owed, so today is a rest day.';
        } else if (fatigue.load >= 3) {
            reason = `Everything still owed was worked in the last day or two, fencing included - ${
                formatFencingHours(fatigue.load)} of it. Let it recover; the primer is enough today.`;
        } else {
            reason = 'Everything still owed this week was trained in the last day or two. Let it recover - the primer is enough today.';
        }
        return {
            minutes, totalSets: 0, groups: [], exercises: [], rest: true,
            reason, fatigueNote
        };
    }

    const chosen = [];
    const exercisesPrefix = [];
    let remaining = budget;

    // Volume day: one group massively behind, enough time, fresh enough to
    // carry it (recovery 1 means nothing recent), and a loaded movement
    // available here. It claims 10 sets up front; the normal fill covers
    // whatever budget is left with other groups.
    let volumeDayGroup = null;
    const vdCandidate = candidates[0];
    if (minutes >= VOLUME_DAY_MIN_MINUTES
        && getDaysLeftInWeek() <= VOLUME_DAY_MAX_DAYS_LEFT
        && vdCandidate && vdCandidate.debt >= VOLUME_DAY_DEBT_THRESHOLD
        && vdCandidate.recovery === 1
        && budget >= VOLUME_DAY_SETS + 2) {
        const loaded = usableOptionsFor(vdCandidate.group, pool, locationKey)
            .filter(e => (e.trackingType || guessTrackingType(e.name)) === 'weight_reps');
        if (loaded.length > 0) {
            volumeDayGroup = vdCandidate.group;
            const freqSorted = loaded.slice().sort((a, b) =>
                (freq[normalizeLabel(b.name)] || 0) - (freq[normalizeLabel(a.name)] || 0));
            const movement = freqSorted[0];
            exercisesPrefix.push({
                name: movement.name,
                group: vdCandidate.group,
                sets: VOLUME_DAY_SETS,
                reps: '10 @ ~60%',
                trackingType: 'weight_reps',
                notes: 'Volume day: 10x10 light. About 60% of your usual 8-rep weight - it should feel easy until set 6.'
            });
            remaining -= VOLUME_DAY_SETS;
        }
    }

    for (const row of candidates) {
        if (remaining <= 0) break;
        if (row.group === volumeDayGroup) continue;
        const allocation = Math.min(row.debt, MAX_SETS_PER_GROUP_PER_SESSION, remaining);
        // Two sets of something is not worth a trip; fold small leftovers into
        // the groups already picked rather than adding a token exercise.
        if (allocation < 2) continue;
        chosen.push({ ...row, sets: allocation });
        remaining -= allocation;
    }

    if (chosen.length === 0 && exercisesPrefix.length === 0) {
        // Budget too small to give any group a real share: put it all on the
        // most urgent one.
        const top = candidates[0];
        chosen.push({ ...top, sets: Math.min(budget, top.debt, MAX_SETS_PER_GROUP_PER_SESSION) });
    }

    const exercises = exercisesPrefix.slice();
    chosen.forEach(entry => {
        const options = usableOptionsFor(entry.group, pool, locationKey).slice().sort((a, b) =>
            (freq[normalizeLabel(b.name)] || 0) - (freq[normalizeLabel(a.name)] || 0));
        // One movement up to 4 sets, two beyond that, so a big allocation is
        // split rather than becoming six sets of the same thing.
        const count = entry.sets > 4 && options.length > 1 ? 2 : 1;
        const picks = options.slice(0, count);
        picks.forEach((exercise, i) => {
            const share = Math.round(entry.sets / picks.length) || 1;
            const sets = i === picks.length - 1
                ? entry.sets - share * (picks.length - 1)
                : share;
            if (sets <= 0) return;
            exercises.push({
                name: exercise.name,
                group: entry.group,
                sets,
                reps: exercise.reps || '',
                trackingType: exercise.trackingType || guessTrackingType(exercise.name),
                notes: exercise.notes || ''
            });
        });
    });

    // Compounds first, isolation after, core last. The volume-day lead stays
    // pinned at the front - it is the day's entire point. The sort is stable,
    // so within a class the urgency ordering above still holds.
    const pinned = exercises.slice(0, exercisesPrefix.length);
    const rest = exercises.slice(exercisesPrefix.length)
        .sort((a, b) => movementOrder(a.name) - movementOrder(b.name));
    exercises.length = 0;
    exercises.push(...pinned, ...rest);

    const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
    return {
        minutes,
        totalSets,
        groups: (volumeDayGroup ? [volumeDayGroup] : []).concat(chosen.map(c => c.group)),
        exercises,
        rest: false,
        reason: '',
        fatigueNote
    };
}

// How many more sessions the week needs, so the week ahead can be planned
// without turning into a grid of named days you can fall behind on.
function getWeekOutlook() {
    const rows = getWeeklyDebt();
    const debt = rows.reduce((sum, r) => sum + r.debt, 0);
    const daysLeft = getDaysLeftInWeek();

    // Against a normal 45 minute session.
    const perSession = setsForMinutes(45);
    const sessions = debt > 0 ? Math.max(1, Math.round(debt / perSession)) : 0;

    return { debt, daysLeft, sessions, behind: sessions > daysLeft };
}

// ---- Today's suggestion, rendered ------------------------------------------

let suggestedMinutes = null;     // null until a length is chosen
let suggestedLocation = null;    // asked fresh every time - gyms change daily
let suggestedSession = null;

// The generated session used to live only in memory, so a page refresh threw
// away the day's plan mid-workout: the pill vanished, the draft under its name
// became unreachable, and the panel went back to "how long have you got?" as
// if the morning had not happened. Today's generation now persists on the
// device for the rest of the day - refreshed, backgrounded, or completed, it
// stays until it is scrapped or the date changes.
const GENERATED_KEY = 'fcc:generated:v1';
let generatedToday = null;

function readGeneratedToday() {
    try {
        const raw = JSON.parse(localStorage.getItem(GENERATED_KEY) || 'null');
        if (!raw || raw.date !== getTodayDateString() || !Array.isArray(raw.exercises)) return null;
        return raw;
    } catch (e) { return null; }
}

function writeGeneratedToday(value) {
    try {
        if (value) localStorage.setItem(GENERATED_KEY, JSON.stringify(value));
        else localStorage.removeItem(GENERATED_KEY);
    } catch (e) { /* storage unavailable - the session still works, it just won't survive a refresh */ }
}

// Rebuilds the in-memory side of a persisted generation at boot: the session
// type back into the program (so its pill exists and its draft can hydrate),
// and the logger reopened on it if it was started.
function restoreGeneratedSession() {
    generatedToday = readGeneratedToday();
    if (!generatedToday || !activeProgram) return;
    if (!activeProgram.workouts) activeProgram.workouts = {};
    if (!activeProgram.workouts[generatedToday.label]) {
        activeProgram.workouts[generatedToday.label] = generatedToday.exercises.map(e => ({
            name: e.name, sets: e.sets, reps: e.reps,
            trackingType: e.trackingType, notes: e.notes
        }));
    }
    lastGeneratedLabel = generatedToday.label;
    if (generatedToday.started) {
        currentDay = substituteDayKeyFor(generatedToday.label);
    }
}

// A workout saved today under the generated session's name means it was
// completed - used for the panel's status line.
function generatedSessionLoggedToday() {
    if (!generatedToday) return false;
    const today = getTodayDateString();
    return allWorkouts.some(w =>
        w.date === today && normalizeLabel(w.day) === normalizeLabel(generatedToday.label));
}

window.suggestSessionFor = function (minutes) {
    suggestedMinutes = minutes;
    suggestedLocation = null;
    suggestedSession = null;
    renderTodayPanel();
};

window.suggestPlaceFor = function (locationKey) {
    if (!LOCATIONS[locationKey] || suggestedMinutes === null) return;
    suggestedLocation = locationKey;
    suggestedSession = generateSession(suggestedMinutes, locationKey);
    // A real session persists for the day; a rest verdict does not need to -
    // it re-derives instantly and correctly on every look.
    if (!suggestedSession.rest) {
        generatedToday = {
            date: getTodayDateString(),
            minutes: suggestedMinutes,
            location: locationKey,
            label: suggestedSessionName(suggestedSession),
            exercises: suggestedSession.exercises,
            totalSets: suggestedSession.totalSets,
            groups: suggestedSession.groups,
            fatigueNote: suggestedSession.fatigueNote || '',
            started: false
        };
        writeGeneratedToday(generatedToday);
    }
    renderTodayPanel();
};

// "Suggest something else": scraps today's generation and returns to the
// chips. The logger is untouched - anything already loaded or typed stays.
window.dismissSuggestion = function () {
    suggestedMinutes = null;
    suggestedLocation = null;
    suggestedSession = null;
    generatedToday = null;
    writeGeneratedToday(null);
    renderTodayPanel();
};

// Load the suggestion into the logger as a one-off session, using the same
// substitute mechanism as an unscheduled session: it consumes no scheduled day
// and is saved under its own descriptive name.
let lastGeneratedLabel = null;

window.startSuggestedSession = function () {
    if (!generatedToday) return;
    if (!activeProgram) return;
    if (!activeProgram.workouts) activeProgram.workouts = {};

    // Only ever one generated session at a time. Without this, asking twice
    // leaves yesterday's suggestion sitting in the pill row forever.
    if (lastGeneratedLabel && lastGeneratedLabel !== generatedToday.label
        && activeProgram.workouts[lastGeneratedLabel]) {
        delete activeProgram.workouts[lastGeneratedLabel];
    }

    const label = generatedToday.label;
    // Kept out of the saved program document. Writing generated sessions into
    // the program would fill the library with one-offs named after a Tuesday;
    // instead the session lives in memory plus the on-device generation store,
    // and the logged session records its own name so history keeps it.
    activeProgram.workouts[label] = generatedToday.exercises.map(e => ({
        name: e.name, sets: e.sets, reps: e.reps,
        trackingType: e.trackingType, notes: e.notes
    }));
    lastGeneratedLabel = label;
    generatedToday.started = true;
    writeGeneratedToday(generatedToday);

    // The pill has to exist before selectDay can mark it active.
    renderWorkoutDaySelector();
    selectDay(substituteDayKeyFor(label));
    // The panel stays on today's session rather than resetting to the chips -
    // the transient choosing state is cleared, the persisted session is not.
    suggestedMinutes = null;
    suggestedLocation = null;
    suggestedSession = null;
    renderTodayPanel();
    showToast(`${label} loaded. Log it like any other session.`, 'success');
};

// Big multi-joint lifts come first in a session, isolation after them, core
// and holds last. The generator once ordered purely by urgency, which put
// Cable Lateral Raise before Seated Dumbbell Shoulder Press - the press then
// ran pre-exhausted, logged weaker numbers than usual, and history read it as
// regression when it was really just sequencing.
const COMPOUND_TOKENS = ['squat', 'deadlift', 'press', 'row', 'pull-up', 'pullup', 'pull up',
    'chin-up', 'chinup', 'pulldown', 'dip', 'thrust', 'lunge', 'step-up', 'step up',
    'good morning', 'rdl', 'push-up', 'pushup', 'push up'];

function movementOrder(name) {
    if (classifyMuscleGroup(name) === 'Core') return 2;
    const n = normalizeLabel(name);
    return COMPOUND_TOKENS.some(token => n.includes(token)) ? 0 : 1;
}

// Named for what it trains, not for a slot in a plan. "Back & Quads - 30 min"
// carries no implication that you were meant to do it on a particular day.
function suggestedSessionName(session) {
    const groups = [...new Set(session.groups)];
    const head = groups.slice(0, 2).join(' & ');
    const more = groups.length > 2 ? ` +${groups.length - 2}` : '';
    return `${head}${more} - ${session.minutes} min`;
}

function renderTodayPanel() {
    const container = document.getElementById('today-panel');
    if (!container) return;

    const outlook = getWeekOutlook();

    let html = '<div class="today-head">';
    if (outlook.debt === 0) {
        html += `<span class="today-title">Week complete</span>
                 <span class="today-sub">Everything is covered. Anything more is a bonus.</span>`;
    } else {
        const sessionWord = outlook.sessions === 1 ? 'session' : 'sessions';
        html += `<span class="today-title">About ${outlook.sessions} more ${sessionWord} this week</span>
                 <span class="today-sub">${outlook.debt} sets still owed across
                    ${outlook.daysLeft} day${outlook.daysLeft === 1 ? '' : 's'}${outlook.behind
            ? ' &middot; more than there are days, so take what you can get'
            : ''}</span>`;
    }
    html += '</div>';

    // A generation from a previous day silently expires.
    if (generatedToday && generatedToday.date !== getTodayDateString()) {
        generatedToday = null;
        writeGeneratedToday(null);
    }

    if (generatedToday) {
        // Today already has a session. It stays here - previewed, started or
        // completed - until the day ends or it is scrapped, so a refresh can
        // never bounce the panel back to "how long have you got?".
        const completed = generatedSessionLoggedToday();
        const status = completed
            ? 'Completed. Tap its pill below to add to it.'
            : (generatedToday.started
                ? 'Started. Its pill below reopens it any time today.'
                : '');
        html += `<div class="today-plan">
                    <div class="today-plan-head">
                        <span class="today-plan-name">${escapeHtml(generatedToday.label)}</span>
                        <span class="today-plan-meta">${generatedToday.totalSets} sets &middot; ${
                            escapeHtml((LOCATIONS[generatedToday.location] || {}).label || '')}</span>
                    </div>
                    ${completed ? '<div class="today-status done">&#10003; ' + escapeHtml(status) + '</div>'
                        : (generatedToday.started ? '<div class="today-status">' + escapeHtml(status) + '</div>' : '')}
                    <ul class="today-plan-list">`;
        generatedToday.exercises.forEach(e => {
            const reps = e.reps ? ` &times; ${escapeHtml(e.reps)}` : '';
            html += `<li><span class="today-ex">${escapeHtml(e.name)}</span>
                         <span class="today-ex-meta">${e.sets}${reps}</span></li>`;
        });
        html += `</ul>
                    ${generatedToday.fatigueNote
                        ? `<div class="today-fatigue">${escapeHtml(generatedToday.fatigueNote)}</div>`
                        : ''}
                    ${!generatedToday.started && !completed
                        ? '<button type="button" class="today-start" data-start="1">Start this</button>'
                        : ''}
                    <button type="button" class="today-back" data-dismiss="1">Scrap it and suggest something else</button>
                 </div>`;
    } else if (suggestedMinutes === null) {
        // Sessions logged today, read from the DATA rather than this device's
        // memory of a generation. Without this, a second phone - or a cleared
        // store - showed the blank starting point as if the morning had not
        // happened, while the week panel above plainly counted its sets.
        const today = getTodayDateString();
        const trainedToday = allWorkouts.filter(w =>
            w.date === today && !isNonTrainingLabel(w.day));
        trainedToday.forEach(w => {
            const sets = Object.values(w.exercises || {}).reduce((sum, ex) =>
                sum + ((ex && ex.sets) || []).filter(isWorkingSet).length, 0);
            html += `<div class="today-status done">&#10003; Logged today:
                        ${escapeHtml(w.day)} &middot; ${sets} set${sets === 1 ? '' : 's'}</div>`;
        });
        html += `<div class="today-ask">${trainedToday.length
            ? 'Adding more? How long have you got?'
            : 'How long have you got today?'}</div>
                 <div class="today-chips">`;
        SESSION_LENGTHS.forEach(m => {
            html += `<button type="button" class="today-chip" data-minutes="${m}">${m} min</button>`;
        });
        html += `</div>`;
    } else if (suggestedLocation === null) {
        // Asked fresh every time, deliberately: which gym today is the one
        // fact that changes day to day, and a remembered answer would build
        // sessions around machines that are not in the room.
        html += `<div class="today-ask">${suggestedMinutes} min &middot; Where are you?</div>
                 <div class="today-chips">`;
        Object.keys(LOCATIONS).forEach(key => {
            html += `<button type="button" class="today-chip" data-place="${key}">${LOCATIONS[key].label}</button>`;
        });
        html += `</div>
                 <button type="button" class="today-back" data-dismiss="1">Different length</button>`;
    } else {
        // Reaching here with both answers given means the verdict was rest -
        // a real session would have been persisted and rendered above.
        html += `<div class="today-rest">${escapeHtml(suggestedSession.reason)}</div>
                 <button type="button" class="today-back" data-dismiss="1">Pick a different length</button>`;
    }

    container.innerHTML = html;

    container.querySelectorAll('[data-minutes]').forEach(btn => {
        btn.addEventListener('click', () => suggestSessionFor(Number(btn.getAttribute('data-minutes'))));
    });
    container.querySelectorAll('[data-place]').forEach(btn => {
        btn.addEventListener('click', () => suggestPlaceFor(btn.getAttribute('data-place')));
    });
    const startBtn = container.querySelector('[data-start]');
    if (startBtn) startBtn.addEventListener('click', () => startSuggestedSession());
    const backBtn = container.querySelector('[data-dismiss]');
    if (backBtn) backBtn.addEventListener('click', () => dismissSuggestion());
}

function renderWeeklyVolume() {
    const container = document.getElementById('weekly-volume-panel');
    if (!container) return;

    const rows = getWeeklyDebt();
    const summary = getWeeklyVolumeScore();
    const daysLeft = getDaysLeftInWeek();
    const dayNote = daysLeft === 1
        ? 'Last day of the week'
        : `${daysLeft} days left this week`;

    let html = `
        <div class="week-head">
            <div>
                <div class="week-score">${summary.score}%</div>
                <div class="week-sub">${summary.done} of ${summary.target} sets &middot; ${dayNote}</div>
            </div>
            <div class="week-groups">${summary.groupsHit}/${summary.groups}<span>groups done</span></div>
        </div>`;

    if (summary.fencing > 0) {
        html += `<div class="week-fencing-note">${summary.fencing} of those sets are credited from
                    ${formatFencingHours(fencingHoursBetween(getWeekStartDate(), getTodayDateString()))}
                    of fencing, capped at half of each target - footwork keeps legs busy, it does not load them.</div>`;
    }

    html += `<div class="week-bars">`;

    rows.forEach(row => {
        const state = row.debt === 0 ? 'done' : (row.urgency >= 2 ? 'behind' : 'open');
        // The fencing segment sits after the lifted one in a different shade,
        // so a leg bar that is quiet because of coaching never reads as a leg
        // bar that is quiet because of squats.
        const fencedBar = row.fencingPct > 0
            ? `<span class="week-row-fenced" style="width:${row.fencingPct}%"
                     title="${row.fencing} from fencing"></span>`
            : '';
        const fencedCount = row.fencing > 0 ? `<span class="week-row-fenced-count">+${row.fencing}</span>` : '';
        html += `
            <div class="week-row ${state}">
                <span class="week-row-name">${escapeHtml(row.group)}</span>
                <span class="week-row-track"><span class="week-row-fill" style="width:${row.pct}%"></span>${fencedBar}</span>
                <span class="week-row-count">${row.done}${fencedCount}<span class="week-row-target">/${row.target}</span></span>
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function updateWeeklySets() {
    const container = document.getElementById('weekly-sets-content');
    if (!container) return;

    const counts = getWeeklySetCounts(7);
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
        container.innerHTML = '<p>No working sets logged in the last 7 days.</p>';
        return;
    }

    const max = Math.max(...entries.map(e => e[1]), 20);
    container.innerHTML = entries.map(([group, sets]) => {
        const pct = Math.round((sets / max) * 100);
        let colour = 'var(--color-accent-primary)';
        let verdict = '';
        if (sets < 6) { colour = 'var(--color-warning)'; verdict = ' (low)'; }
        else if (sets > 22) { colour = 'var(--color-warning)'; verdict = ' (high)'; }
        return `
            <div style="margin-bottom: 0.625rem;">
                <div style="display:flex; justify-content:space-between; font-size:0.875rem; margin-bottom:0.1875rem;">
                    <span style="color: var(--color-text-primary); font-weight: 500;">${group}</span>
                    <span style="color:${colour}; font-weight:600;">${sets} sets${verdict}</span>
                </div>
                <div style="height:6px; background:var(--color-border); border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:${colour};"></div>
                </div>
            </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Estimated one-rep max (Epley: weight x (1 + reps/30)).
//
// The old PR system compared weight ONLY, so 225x5 -> 225x8 registered as zero
// progress. e1RM makes extra reps at the same load count, which is how most
// progress actually happens past the beginner stage.
// ---------------------------------------------------------------------------

function estimateOneRepMax(weight, reps) {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r <= 0) return 0;
    if (r === 1) return w;
    if (r > 12) return 0;   // Epley drifts badly past ~12 reps
    return w * (1 + r / 30);
}

function getEstimatedMaxHistory() {
    const byExercise = {};

    // Oldest first, so "latest" and "previous" mean what they say.
    const chronological = allWorkouts.slice().sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    chronological.forEach(workout => {
        if (normalizeLabel(workout.day) === 'rest') return;
        Object.values(workout.exercises || {}).forEach(exercise => {
            if (!exercise || !exercise.exercise) return;
            const name = exercise.substitution || exercise.exercise;
            if (normalizeLabel(name).includes('stretch')) return;

            // Only weight-and-reps work has a meaningful estimated max.
            const type = exercise.trackingType || guessTrackingType(name);
            if (type !== 'weight_reps') return;

            let best = 0;
            (exercise.sets || []).forEach(set => {
                const e = estimateOneRepMax(set.weight, set.reps);
                if (e > best) best = e;
            });
            if (best <= 0) return;

            if (!byExercise[name]) byExercise[name] = [];
            byExercise[name].push({ date: workout.date, e1rm: Math.round(best) });
        });
    });

    return byExercise;
}

function updateEstimatedMaxes() {
    const container = document.getElementById('e1rm-content');
    if (!container) return;

    const history = getEstimatedMaxHistory();
    const rows = Object.entries(history)
        .filter(([, points]) => points.length >= 2)
        .map(([name, points]) => {
            const latest = points[points.length - 1];
            const best = points.reduce((m, p) => (p.e1rm > m.e1rm ? p : m), points[0]);
            const previous = points[points.length - 2];
            const delta = latest.e1rm - previous.e1rm;
            return { name, latest: latest.e1rm, best: best.e1rm, delta, isPR: latest.e1rm >= best.e1rm };
        })
        .sort((a, b) => b.latest - a.latest)
        .slice(0, 10);

    if (rows.length === 0) {
        container.innerHTML = '<p>Log an exercise at least twice with weight and reps to see an estimate.</p>';
        return;
    }

    container.innerHTML = rows.map(r => {
        const arrow = r.delta > 0 ? '&#9650;' : r.delta < 0 ? '&#9660;' : '&#8212;';
        const colour = r.delta > 0 ? 'var(--color-success)'
                     : r.delta < 0 ? 'var(--color-text-secondary)'
                     : 'var(--color-text-secondary)';
        return `
            <div style="display:flex; justify-content:space-between; align-items:baseline; gap:0.75rem;
                        padding:0.4375rem 0; border-bottom:1px solid var(--color-border);">
                <span style="color: var(--color-text-primary); font-weight: 500;">${r.name}${r.isPR ? ' <span style="color:var(--color-success); font-size:0.75rem;">BEST</span>' : ''}</span>
                <span style="white-space:nowrap;">
                    <strong style="color: var(--color-text-primary);">${r.latest} lbs</strong>
                    <span style="color:${colour}; font-size:0.8125rem; margin-left:0.375rem;">${arrow} ${Math.abs(r.delta)}</span>
                </span>
            </div>`;
    }).join('');
}

// The dropdown used to be a hardcoded list of five workout names in the markup,
// so it listed workouts the user does not have and never listed the ones they do.
function populateComparisonSelector() {
    const selector = document.getElementById('comparison-selector');
    if (!selector) return;

    const types = [];
    const seen = new Set();
    allWorkouts.forEach(w => {
        const key = normalizeLabel(w.day);
        if (!key || key === 'rest' || seen.has(key)) return;
        seen.add(key);
        types.push(w.day);
    });

    if (types.length === 0) {
        selector.innerHTML = '<option value="">No sessions logged yet</option>';
        return;
    }

    const previous = selector.value;
    selector.innerHTML = types.map(t => `<option value="${t}">${t}</option>`).join('');
    if (previous && types.some(t => t === previous)) selector.value = previous;
    updateSessionComparison(selector.value);
}

function updateProgressionSnapshot() {
    // The "Quick Wins" block that used to live here wrote into #quick-wins,
    // which was removed with the weight-only PRs-this-week tile. It was guarded
    // by `if (element)`, so it silently did nothing on every render.

    // Trending Up
    const trendingExercises = getTrendingUpExercises();
    const trendingUpElement = document.getElementById('trending-up');
    if (trendingUpElement) {
        if (trendingExercises.length > 0) {
            trendingUpElement.innerHTML = trendingExercises.map(ex => `• ${ex}`).join('<br>');
            trendingUpElement.style.color = 'var(--color-success)';
        } else {
            trendingUpElement.innerHTML = 'Need 3+ sessions per exercise to detect trends';
            trendingUpElement.style.color = 'var(--color-text-secondary)';
        }
    }

    // Needs Attention
    const plateauedExercises = getPlateauedExercises(3);
    const needsAttentionElement = document.getElementById('needs-attention');
    if (needsAttentionElement) {
        if (plateauedExercises.length > 0) {
            needsAttentionElement.innerHTML = plateauedExercises.map(ex =>
                `• ${ex.exercise} (stuck at ${ex.weight} lbs)`
            ).join('<br>');
            needsAttentionElement.style.color = 'var(--color-warning)';
        } else {
            needsAttentionElement.innerHTML = 'All exercises progressing well!';
            needsAttentionElement.style.color = 'var(--color-success)';
        }
    }
}

// ---------------------------------------------------------------------------
// Focus areas: the imbalance backstop.
//
// Three defects made this the most misleading panel in the app.
//  1. It looked for a hardcoded ['Upper','Lower','Push','Pull','Legs'], so any
//     custom program produced no data at all.
//  2. It computed the minimum frequency from `frequencies.filter(f => f > 0)`,
//     which structurally EXCLUDES anything trained zero times. The detector was
//     blind to the exact case it exists to catch.
//  3. With no data it printed a green "Your training is well balanced!", which
//     is a confident claim made from nothing.
// It now reads the workout types from the active program, counts zeroes, and
// says plainly when it has too little data to judge.
// ---------------------------------------------------------------------------
function updateFocusAreas() {
    const container = document.getElementById('focus-areas-content');
    if (!container) return;

    // Workout types come from the program, falling back to what has been logged.
    let workoutTypes = [];
    if (activeProgram && activeProgram.schedule) {
        const seen = new Set();
        Object.keys(activeProgram.schedule).forEach(key => {
            const type = getWorkoutTypeForDay(activeProgram, key);
            const norm = normalizeLabel(type);
            if (!norm || norm === 'rest' || seen.has(norm)) return;
            seen.add(norm);
            workoutTypes.push(type);
        });
    }
    if (workoutTypes.length === 0) {
        const seen = new Set();
        allWorkouts.forEach(w => {
            const norm = normalizeLabel(w.day);
            if (!norm || norm === 'rest' || seen.has(norm)) return;
            seen.add(norm);
            workoutTypes.push(w.day);
        });
    }

    if (workoutTypes.length === 0) {
        container.innerHTML = '<div>Set up a program to see focus areas.</div>';
        container.style.color = 'var(--color-text-secondary)';
        return;
    }

    // Count over a rolling 28 days using string comparison, which avoids the
    // timezone drift that new Date(dateString) introduces.
    const today = getTodayDateString();
    const from = addDaysToDateString(today, -27);

    const counts = {};
    const lastDone = {};
    workoutTypes.forEach(type => { counts[type] = 0; lastDone[type] = null; });

    allWorkouts.forEach(w => {
        const match = workoutTypes.find(t => normalizeLabel(t) === normalizeLabel(w.day));
        if (!match) return;
        if (w.date >= from && w.date <= today) counts[match]++;
        if (!lastDone[match] || w.date > lastDone[match]) lastDone[match] = w.date;
    });

    const totalSessions = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalSessions < workoutTypes.length) {
        container.innerHTML = `<div>Only ${totalSessions} session${totalSessions === 1 ? '' : 's'} logged in the last 28 days. Not enough yet to judge balance.</div>`;
        container.style.color = 'var(--color-text-secondary)';
        return;
    }

    const warnings = [];

    // Never trained, or not trained in a long time. Zero counts are included.
    workoutTypes.forEach(type => {
        if (counts[type] === 0) {
            warnings.push(lastDone[type]
                ? `${type} has not been trained in the last 28 days.`
                : `${type} has never been logged.`);
        }
    });

    // Imbalance across the types that WERE trained.
    const values = workoutTypes.map(t => counts[t]);
    const maxFreq = Math.max(...values);
    const minFreq = Math.min(...values);
    if (maxFreq - minFreq >= 2) {
        const behind = workoutTypes.filter(t => counts[t] === minFreq);
        const ahead = workoutTypes.filter(t => counts[t] === maxFreq);
        warnings.push(`${behind.join(' and ')} sits at ${minFreq} session${minFreq === 1 ? '' : 's'} while ${ahead.join(' and ')} sits at ${maxFreq}. Prioritise the ones behind.`);
    }

    if (warnings.length > 0) {
        container.innerHTML = warnings.map(w => `<div style="margin-bottom: 0.5rem;">${w}</div>`).join('');
        container.style.color = 'var(--color-warning)';
    } else {
        container.innerHTML = `<div>Balanced across ${workoutTypes.length} session types over the last 28 days.</div>`;
        container.style.color = 'var(--color-success)';
    }
}





function updateProgress() {
    const prs = getPersonalRecords();
    const progression = getExerciseProgression();
    const prContainer = document.getElementById('progress-list');
    const progressionContainer = document.getElementById('exercise-progress-list');

    // Update PRs
    if (Object.keys(prs).length === 0) {
        prContainer.innerHTML = '<p style="color: var(--color-text-secondary);">Complete some workouts to see your personal records!</p>';
    } else {
        const sortedPRs = Object.entries(prs).sort(([, a], [, b]) => b.weight - a.weight);

        prContainer.innerHTML = sortedPRs.slice(0, 10).map(([exercise, pr]) => `
                    <div class="insight-item">
                        <strong>${exercise}</strong><br>
                        ${pr.weight}lbs × ${pr.reps} reps - ${formatDateString(pr.date)}
                    </div>
                `).join('');
    }

    // Update exercise progression
    if (Object.keys(progression).length === 0) {
        progressionContainer.innerHTML = '<p style="color: var(--color-text-secondary);">Complete some workouts to see your detailed progression!</p>';
    } else {
        const sortedProgression = Object.entries(progression).sort(([, a], [, b]) => {
            const typeOrder = { strength: 4, volume: 3, total_volume: 2, maintaining: 1 };
            return typeOrder[b.type] - typeOrder[a.type];
        });

        progressionContainer.innerHTML = sortedProgression.slice(0, 15).map(([exercise, data]) => {
            const typeColors = {
                strength: 'var(--color-success)',
                volume: 'var(--color-accent-primary)',
                total_volume: 'var(--color-warning)',
                maintaining: 'var(--color-text-secondary)'
            };

            return `
                        <div class="insight-item" style="border-left-color: ${typeColors[data.type]};">
                            <strong>${exercise}</strong><br>
                            ${data.progression}<br>
                            <span style="color: var(--color-text-secondary); font-size: 0.75rem;">
                                ${data.daysSince} days ago • ${data.sessions} sessions tracked
                            </span>
                        </div>
                    `;
        }).join('');
    }
}

// Calendar Functions
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Update month/year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

    // Get first and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Build calendar grid
    let html = '';
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        html += `<div class="calendar-day other-month">
                    <div class="calendar-day-number">${day}</div>
                </div>`;
    }

    // Add days of current month
    const today = getTodayDateString();
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        // Build the key from the calendar parts. new Date(y,m,d) is LOCAL
        // midnight and toISOString() renders UTC, so east of Greenwich every
        // cell used to query the previous day's data and the whole grid was
        // shifted by one square.
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const actualWorkout = getWorkoutForDate(dateStr);
        const fenced = fencingEntriesBetween(dateStr, dateStr);

        let classes = ['calendar-day'];
        if (dateStr === today) classes.push('today');

        // The calendar is a record now, not a plan. It shows what happened -
        // sessions, fencing, sick and travel days - and says nothing about
        // days where nothing happened, past or future. The red "missed" paint
        // and the projected future sessions were the queue's last outposts.
        let displayLabel = '';
        let labelClass = '';

        if (actualWorkout && actualWorkout.day) {
            classes.push('has-workout');
            displayLabel = actualWorkout.day;
            labelClass = actualWorkout.day;
            if (fenced.length) displayLabel += ' + fencing';
        } else if (fenced.length) {
            classes.push('fenced');
            const hours = fenced.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
            displayLabel = `Fencing ${formatFencingHours(hours)}`;
            labelClass = 'Fencing';
        } else if (isDateSickDay(dateStr)) {
            classes.push('sick');
            displayLabel = 'Sick Day';
            labelClass = 'Sick';
        } else if (isDateInTravelMode(dateStr)) {
            classes.push('travel');
            displayLabel = 'Travel';
            labelClass = 'Travel';
        }

        html += `<div class="${classes.join(' ')}" onclick="selectCalendarDay('${dateStr}')">
                    <div class="calendar-day-number">${day}</div>
                    <div class="calendar-day-label ${labelClass}">${displayLabel}</div>
                </div>`;
    }

    // Add days from next month
    const remainingDays = 42 - (startingDayOfWeek + daysInMonth); // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day other-month">
                    <div class="calendar-day-number">${day}</div>
                </div>`;
    }

    document.getElementById('calendar-grid').innerHTML = html;

    // Update adherence
    const adherence = calculateAdherence();
    document.getElementById('adherence-score').textContent = `${adherence.score}%`;
    document.getElementById('workouts-completed').textContent = adherence.active;
    document.getElementById('workouts-scheduled').textContent = adherence.available;
    document.getElementById('workouts-missed').textContent = adherence.restDays;
}

// Helper function to format date string correctly without timezone issues
function formatDateString(dateStr) {
    // dateStr is in format "YYYY-MM-DD"
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString();
}

window.selectCalendarDay = function (dateStr) {
    selectedCalendarDay = dateStr;
    const workout = getWorkoutForDate(dateStr);

    const container = document.getElementById('selected-day-workout');
    const content = document.getElementById('selected-day-content');
    const title = document.getElementById('selected-day-title');

    if (workout) {
        title.textContent = `${workout.day} Workout - ${formatDateString(dateStr)}`;

        let html = '<div style="display: grid; gap: 1rem;">';

        // Show intensity if available
        if (workout.intensity) {
            html += '<div style="background: var(--color-surface); border: 1px solid var(--color-border); padding: 1rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">';
            html += '<h4 style="color: var(--color-accent-primary); margin-bottom: 0.5rem;">Session Intensity</h4>';
            html += '<div style="display: flex; gap: 1rem; flex-wrap: wrap;">';
            if (workout.intensity.energy) html += `<span style="color: var(--color-text-secondary);">Energy: ${workout.intensity.energy}/5</span>`;
            if (workout.intensity.motivation) html += `<span style="color: var(--color-text-secondary);">Motivation: ${workout.intensity.motivation}/5</span>`;
            if (workout.intensity.fatigue) html += `<span style="color: var(--color-text-secondary);">Fatigue: ${workout.intensity.fatigue}/5</span>`;
            if (workout.intensity.satisfaction) html += `<span style="color: var(--color-text-secondary);">Satisfaction: ${workout.intensity.satisfaction}/5</span>`;
            html += '</div></div>';
        }

        // Show exercises
        Object.values(workout.exercises || {}).forEach(exercise => {
            html += '<div style="background: var(--color-surface); border: 1px solid var(--color-border); padding: 1rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">';
            html += `<h4 style="color: var(--color-text-primary); margin-bottom: 0.5rem;">${exercise.exercise}`;
            if (exercise.substitution && exercise.originalExercise) {
                html += ` <span style="background: rgba(74, 93, 74, 0.2); color: var(--color-accent-primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: normal;">Alt for ${exercise.originalExercise}</span>`;
            } else if (exercise.approach) {
                html += ` <span style="background: rgba(74, 93, 74, 0.2); color: var(--color-accent-primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: normal;">${exercise.approach}</span>`;
            }
            html += `</h4>`;

            // Handled only two shapes, so a hold or a walk rendered NOTHING and
            // a reps-only set printed "undefinedlbs × 12 reps". formatSetForType
            // already knows every shape; this just did not use it.
            const setType = exercise.trackingType && TRACKING_TYPES[exercise.trackingType]
                ? exercise.trackingType
                : guessTrackingType(exercise.substitution || exercise.exercise);

            exercise.sets.forEach((set, idx) => {
                if (set.completed) {
                    html += `<div style="color: var(--color-success); padding: 0.25rem;">&#10003; Completed</div>`;
                    return;
                }
                const summary = formatSetForType(set, setType);
                if (summary) {
                    html += `<div style="color: var(--color-text-secondary); padding: 0.25rem;">Set ${idx + 1}: ${escapeHtml(summary)}`;
                    if (set.notes) html += ` (${escapeHtml(set.notes)})`;
                    html += '</div>';
                }
            });

            html += '</div>';
        });

        html += '</div>';
        content.innerHTML = html;
    } else {
        const fenced = fencingEntriesBetween(dateStr, dateStr);
        if (fenced.length) {
            const parts = fenced.map(e => `${formatFencingHours(e.hours)} ${
                (FENCING_KINDS[e.kind] || { label: 'fencing' }).label.toLowerCase()}`);
            title.textContent = `Fencing - ${formatDateString(dateStr)}`;
            content.innerHTML = `<p style="color: var(--color-text-secondary);">${parts.join(', ')}. No lifting logged.</p>`;
        } else if (isDateSickDay(dateStr)) {
            title.textContent = `Sick Day - ${formatDateString(dateStr)}`;
            content.innerHTML = `<p style="color: #f472b6;">This day is marked as a sick day. It is left out of the discipline score.</p>`;
        } else if (isDateInTravelMode(dateStr)) {
            title.textContent = `Travel - ${formatDateString(dateStr)}`;
            content.innerHTML = `<p style="color: #a855f7;">Travel day. It is left out of the discipline score.</p>`;
        } else {
            title.textContent = formatDateString(dateStr);
            content.innerHTML = `<p style="color: var(--color-text-secondary);">Nothing logged.</p>`;
        }
    }

    // A mis-logged session used to be permanent: no delete existed anywhere in
    // the client, so a wrong date or a fat-fingered 3150 lbs corrupted PRs, the
    // estimated max, the plateau detector and the discipline score forever. The
    // Firestore rules already allowed the delete; nothing implemented it.
    if (workout && workout.id) {
        html += `
            <div style="margin-top: 1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button type="button" class="btn btn-danger-outline"
                        onclick="deleteLoggedWorkout('${escapeJsArg(workout.id)}', '${escapeJsArg(dateString)}')">
                    Delete this session
                </button>
            </div>`;
        content.innerHTML = html;
    }

    container.style.display = 'block';
};

window.deleteLoggedWorkout = async function (workoutId, dateString) {
    if (!workoutId) return;
    const ok = confirm(`Delete the session logged on ${dateString}? This cannot be undone, and your schedule and discipline score will recalculate.`);
    if (!ok) return;

    try {
        await deleteDoc(doc(db, "workouts", workoutId));
        await loadWorkoutsFromFirebase();
        refreshStartupCache();
        renderCalendar();
        renderWorkoutDaySelector();
        initializeWorkout();
        // Was 'selected-day-detail', which is not an element that exists, so
        // the guard silently did nothing and the panel stayed open showing the
        // session that had just been deleted.
        const panel = document.getElementById('selected-day-workout');
        if (panel) panel.style.display = 'none';
        showToast('Session deleted.', 'success');
    } catch (e) {
        console.error('Failed to delete workout:', e);
        showToast('Could not delete that session. Try again in a moment.', 'error');
    }
};

// ---------------------------------------------------------------------------
// Export.
//
// Years of six-day-a-week training lived in one Firestore project behind
// anonymous auth, with no copy anywhere the owner controlled and no way to make
// one. The only export function in the codebase dumped the in-progress session
// and was never wired to anything.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Program import
//
// The export button had no counterpart, so the only way to get a program in was
// to type every exercise by hand on a phone. A seven-day program is around 45
// exercises, which is both slow and the kind of task where a mistyped rep range
// goes unnoticed for weeks.
// ---------------------------------------------------------------------------

function validateImportedProgram(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object') return { errors: ['That does not look like program text.'] };
    if (!raw.name || typeof raw.name !== 'string') errors.push('Missing a program name.');
    if (!raw.schedule || typeof raw.schedule !== 'object' || Object.keys(raw.schedule).length === 0) {
        errors.push('Missing the day schedule.');
    }
    if (!raw.workouts || typeof raw.workouts !== 'object') errors.push('Missing the exercise lists.');
    if (errors.length) return { errors };

    // Rebuild rather than trusting the input, so a malformed field cannot reach
    // Firestore or the scheduler.
    const schedule = {};
    Object.keys(raw.schedule)
        .sort((a, b) => parseInt(a.replace('day', ''), 10) - parseInt(b.replace('day', ''), 10))
        .forEach((key, idx) => {
            const value = raw.schedule[key];
            const type = typeof value === 'string' ? value : (value && value.workoutType) || '';
            schedule[`day${idx + 1}`] = { workoutType: String(type), customName: String(type) };
        });

    const workouts = {};
    Object.entries(raw.workouts).forEach(([type, list]) => {
        if (!Array.isArray(list)) return;
        workouts[String(type)] = list
            .filter(ex => ex && ex.name)
            .map(ex => {
                const clean = {
                    name: String(ex.name).slice(0, 80),
                    sets: Math.min(Math.max(parseInt(ex.sets, 10) || 1, 1), MAX_EXERCISE_SETS),
                    reps: String(ex.reps == null ? '' : ex.reps).slice(0, 40) || '1',
                    trackingType: TRACKING_TYPES[ex.trackingType] ? ex.trackingType : guessTrackingType(ex.name)
                };
                if (ex.notes) clean.notes = String(ex.notes).slice(0, 400);
                return clean;
            });
    });

    // Every named day needs a list, even an empty one, or the logger shows the
    // "no exercises" state with no way to add any.
    Object.values(schedule).forEach(day => {
        const type = day.workoutType;
        if (type && !workouts[type]) workouts[type] = [];
    });

    const totalExercises = Object.values(workouts).reduce((n, l) => n + l.length, 0);
    if (totalExercises === 0) errors.push('No exercises found in that text.');

    return {
        errors,
        program: { name: String(raw.name).slice(0, 80), schedule, workouts },
        summary: {
            days: Object.keys(schedule).length,
            types: Object.keys(workouts).length,
            exercises: totalExercises
        }
    };
}

window.openImportProgram = function () {
    const panel = document.getElementById('import-program-panel');
    const input = document.getElementById('import-program-input');
    const result = document.getElementById('import-program-result');
    if (!panel) return;
    if (input) input.value = '';
    if (result) result.textContent = '';
    panel.classList.add('active');
};

window.closeImportProgram = function () {
    const panel = document.getElementById('import-program-panel');
    if (panel) panel.classList.remove('active');
};

window.previewImportProgram = function () {
    const input = document.getElementById('import-program-input');
    const result = document.getElementById('import-program-result');
    if (!input || !result) return;

    let parsed;
    try {
        parsed = JSON.parse(input.value);
    } catch (e) {
        result.innerHTML = '<span style="color: var(--color-error-text);">That text is not complete. Copy the whole block, including the first { and the last }.</span>';
        return;
    }

    const check = validateImportedProgram(parsed);
    if (check.errors.length) {
        result.innerHTML = '<span style="color: var(--color-error-text);">' +
            check.errors.map(escapeHtml).join('<br>') + '</span>';
        return;
    }

    const dayList = Object.entries(check.program.schedule)
        .map(([key, d]) => `${key.replace('day', 'Day ')}: ${escapeHtml(d.workoutType)} (${(check.program.workouts[d.workoutType] || []).length})`)
        .join('<br>');

    result.innerHTML = `
        <div style="color: var(--color-text-primary); font-weight:600; margin-bottom:0.5rem;">
            ${escapeHtml(check.program.name)}
        </div>
        <div style="margin-bottom:0.75rem;">${check.summary.days} days &middot; ${check.summary.exercises} exercises</div>
        <div style="font-size:0.8125rem; line-height:1.7;">${dayList}</div>
        <button type="button" class="btn" style="margin-top:1rem; width:100%;"
                onclick="confirmImportProgram()">Add this program and make it active</button>`;
    window._pendingImport = check.program;
};

window.confirmImportProgram = async function () {
    const pending = window._pendingImport;
    if (!pending) return;

    try {
        const payload = {
            ...pending,
            active: true,
            createdAt: new Date().toISOString(),
            activatedAt: new Date().toISOString(),
            exerciseVariations: {}
        };

        const ref = await addDoc(collection(db, "programs"), payload);
        const saved = { id: ref.id, ...payload };

        // Importing makes it the active program, so everything else steps down.
        programs.forEach(other => {
            if (!other.id || other.id === ref.id || other.active === false) return;
            other.active = false;
            updateDoc(doc(db, "programs", other.id), { active: false })
                .catch(err => console.error('Could not deactivate program:', err));
        });

        programs.push(saved);
        activeProgram = saved;
        window._pendingImport = null;

        await loadWorkoutsFromFirebase();
        refreshStartupCache();

        renderWorkoutDaySelector();
        initializeWorkout();
        renderPrograms();

        window.closeImportProgram();
        closeSettings();
        showToast(`"${saved.name}" imported and set as your active program.`, 'success');
    } catch (e) {
        console.error('Import failed:', e);
        const result = document.getElementById('import-program-result');
        if (result) result.innerHTML = '<span style="color: var(--color-error-text);">Could not save. Check your connection and try again.</span>';
    }
};

window.exportAllData = async function () {
    try {
        showToast('Gathering your data...', 'info');

        const collections = ['workouts', 'programs', 'weight', 'nutrition', 'bodyGoals',
                             'savedFoods', 'travelMode', 'sickDays', 'dailyRoutines', 'fencing'];
        const payload = {
            exportedAt: new Date().toISOString(),
            app: 'Unison',
            version: 1
        };

        for (const name of collections) {
            const snapshot = await getDocs(query(collection(db, name)));
            const rows = [];
            snapshot.forEach(d => rows.push({ id: d.id, ...d.data() }));
            payload[name] = rows;
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unison-backup-${getTodayDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        const total = collections.reduce((sum, n) => sum + payload[n].length, 0);
        showToast(`Exported ${total} records.`, 'success');
    } catch (e) {
        console.error('Export failed:', e);
        showToast('Export failed. Check your connection and try again.', 'error');
    }
};

// Travel Mode Functions
function isDateInTravelMode(dateStr) {
    if (!window.travelModeData || window.travelModeData.length === 0) return false;

    const checkDate = new Date(dateStr);
    return window.travelModeData.some(period => {
        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        return checkDate >= start && checkDate <= end;
    });
}

function getCurrentTravelPeriod() {
    const today = new Date().toISOString().split('T')[0];
    if (!window.travelModeData) return null;

    return window.travelModeData.find(period => {
        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        const check = new Date(today);
        return check >= start && check <= end;
    });
}

window.toggleScheduleExceptions = function () {
    const content = document.getElementById('schedule-exceptions-content');
    const toggle = document.getElementById('schedule-exceptions-toggle');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▼';
    }
};

window.enableTravelMode = async function () {
    const startDate = document.getElementById('travel-start-date').value;
    const endDate = document.getElementById('travel-end-date').value;

    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    if (new Date(endDate) < new Date(startDate)) {
        alert('End date must be after start date');
        return;
    }

    try {
        const travelPeriod = {
            startDate,
            endDate,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "travelMode"), travelPeriod);
        console.log('Travel mode enabled:', docRef.id);

        await loadTravelModeData();
        updateTravelModeBanner();
        renderCalendar();

        // Clear inputs
        document.getElementById('travel-start-date').value = '';
        document.getElementById('travel-end-date').value = '';

        alert('Travel mode enabled! Your workout schedule is paused during these dates.');
    } catch (e) {
        console.error('Error enabling travel mode:', e);
        alert('Failed to enable travel mode');
    }
};

window.endTravelMode = async function () {
    const currentPeriod = getCurrentTravelPeriod();
    if (!currentPeriod || !currentPeriod.id) {
        alert('No active travel period found');
        return;
    }

    // Store the period ID for later use
    window.currentTravelPeriodToEnd = currentPeriod.id;

    // Show the post-travel modal
    document.getElementById('post-travel-modal').classList.add('active');
};

window.resumeWorkoutProgram = async function (mode) {
    // Close the modal
    document.getElementById('post-travel-modal').classList.remove('active');

    try {
        // Delete the travel period
        await deleteDoc(doc(db, "travelMode", window.currentTravelPeriodToEnd));
        console.log('Travel mode ended');

        if (mode === 'restart') {
            // Previously this wrote a fabricated Rest workout into permanent
            // history to "restart" the cycle. It never worked, because the
            // function it relied on filtered Rest days out, and the row carried
            // no programId so it leaked into every program's history and
            // quietly inflated the discipline score by erasing a missed day.
            // Restarting now just re-anchors the schedule queue.
            if (activeProgram && activeProgram.id) {
                activeProgram.activatedAt = new Date().toISOString();
                await updateDoc(doc(db, "programs", activeProgram.id), {
                    activatedAt: activeProgram.activatedAt
                });
            }
            await loadWorkoutsFromFirebase();
        }

        await loadTravelModeData();
        // The 'restart' branch invalidated but 'resume' did not, so the same
        // button refreshed the calendar or not depending on which option was
        // picked.
        updateTravelModeBanner();
        renderCalendar();

        const message = mode === 'restart'
            ? 'Welcome back! Your workout program has been restarted from day 1.'
            : 'Welcome back! Your workout schedule has resumed from where you left off.';
        alert(message);
    } catch (e) {
        console.error('Error ending travel mode:', e);
        alert('Failed to end travel mode');
    }
};

async function loadTravelModeData() {
    try {
        const q = query(collection(db, "travelMode"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        window.travelModeData = [];
        querySnapshot.forEach((document) => {
            window.travelModeData.push({ id: document.id, ...document.data() });
        });
        console.log('Travel mode data loaded:', window.travelModeData.length, 'periods');
    } catch (e) {
        console.error('Error loading travel mode data:', e);
    }
}

function updateTravelModeBanner() {
    const banner = document.getElementById('travel-mode-banner');
    const datesSpan = document.getElementById('travel-mode-dates');
    const currentPeriod = getCurrentTravelPeriod();

    if (currentPeriod) {
        banner.classList.add('active');
        datesSpan.textContent = `${formatDateString(currentPeriod.startDate)} - ${formatDateString(currentPeriod.endDate)}`;
    } else {
        banner.classList.remove('active');
    }
}

// Sick Day Functions
function isDateSickDay(dateStr) {
    if (!window.sickDayData || window.sickDayData.length === 0) return false;
    return window.sickDayData.some(sickDay => sickDay.date === dateStr);
}

window.markSickDay = async function () {
    const dateInput = document.getElementById('sick-day-date').value;

    if (!dateInput) {
        alert('Please select a date');
        return;
    }

    // Check if already marked as sick day
    if (isDateSickDay(dateInput)) {
        // Ask if user wants to remove the sick day
        if (confirm('This day is already marked as sick. Do you want to remove it?')) {
            try {
                const sickDayToRemove = window.sickDayData.find(sd => sd.date === dateInput);
                if (sickDayToRemove && sickDayToRemove.id) {
                    await deleteDoc(doc(db, "sickDays", sickDayToRemove.id));
                    console.log('Sick day removed');

                    await loadSickDayData();
        renderCalendar();

                    document.getElementById('sick-day-date').value = '';
                    alert('Sick day removed. It counts as a normal day again.');
                }
            } catch (e) {
                console.error('Error removing sick day:', e);
                alert('Failed to remove sick day');
            }
        }
        return;
    }

    // Check if there's already a workout logged for this date
    const existingWorkout = getWorkoutForDate(dateInput);
    if (existingWorkout) {
        const message = 'There is already a workout logged for this day.\n\n' +
            'The logged workout will remain visible and count toward adherence.\n\n' +
            'Continue marking as sick day?';
        if (!confirm(message)) {
            return;
        }
    }

    try {
        const sickDay = {
            date: dateInput,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "sickDays"), sickDay);
        console.log('Sick day marked:', docRef.id);

        await loadSickDayData();
        renderCalendar();

        // Clear input
        document.getElementById('sick-day-date').value = '';

        alert('Day marked as sick. It is left out of the discipline score.');
    } catch (e) {
        console.error('Error marking sick day:', e);
        alert('Failed to mark sick day');
    }
};

async function loadSickDayData() {
    try {
        const q = query(collection(db, "sickDays"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        window.sickDayData = [];
        querySnapshot.forEach((document) => {
            window.sickDayData.push({ id: document.id, ...document.data() });
        });
        console.log('Sick day data loaded:', window.sickDayData.length, 'sick days');
    } catch (e) {
        console.error('Error loading sick day data:', e);
    }
}

// Nutrition Functions
// Track collapsed state for each meal
let collapsedMeals = {};

window.toggleMealCollapse = function (mealId) {
    collapsedMeals[mealId] = !collapsedMeals[mealId];
    renderMeals();
};


function renderMeals() {
    const foodEntries = nutritionData.filter(n => n.date === currentNutritionDate);
    const container = document.getElementById('meals-container');

    if (foodEntries.length === 0) {
        container.innerHTML = '';
        updateNutritionSummary();
        return;
    }

    // Group food entries by mealType
    const mealGroups = {};
    foodEntries.forEach(entry => {
        const mealType = entry.mealType || 'Snack';
        if (!mealGroups[mealType]) {
            mealGroups[mealType] = [];
        }
        mealGroups[mealType].push(entry);
    });

    // Order meal types for display
    const mealOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    let html = '';

    mealOrder.forEach(mealType => {
        if (!mealGroups[mealType]) return;

        const entries = mealGroups[mealType];
        const groupId = `${mealType}-${currentNutritionDate}`;
        const isCollapsed = collapsedMeals[groupId] === true;

        // Calculate totals for all foods in this meal group
        let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFats = 0, foodCount = 0;
        entries.forEach(entry => {
            (entry.foods || []).forEach(food => {
                const quantity = food.quantity || 1;
                totalCals += (parseFloat(food.calories) || 0) * quantity;
                totalProtein += (parseFloat(food.protein) || 0) * quantity;
                totalCarbs += (parseFloat(food.carbs) || 0) * quantity;
                totalFats += (parseFloat(food.fats) || 0) * quantity;
                if (food.name && food.name.trim()) foodCount++;
            });
        });

        html += `<div class="meal-card ${isCollapsed ? 'collapsed' : ''}" id="meal-card-${groupId}">
                    <div class="meal-header" onclick="toggleMealCollapse('${groupId}')">
                        <div style="flex: 1;">
                            <div class="meal-type">
                                ${mealType}
                            </div>
                            <div class="meal-time">${foodCount} food${foodCount !== 1 ? 's' : ''}</div>
                        </div>
                        <span class="meal-collapse-icon">▼</span>
                    </div>`;

        // Show summary when collapsed
        if (isCollapsed && foodCount > 0) {
            html += `<div class="meal-summary">
                        <div class="meal-summary-stats">
                            <div class="meal-summary-stat">
                                <span class="meal-summary-value">${Math.round(totalCals)}</span>
                                <span class="meal-summary-label">Calories</span>
                            </div>
                            <div class="meal-summary-stat">
                                <span class="meal-summary-value">${Math.round(totalProtein)}g</span>
                                <span class="meal-summary-label">Protein</span>
                            </div>
                            <div class="meal-summary-stat">
                                <span class="meal-summary-value">${Math.round(totalCarbs)}g</span>
                                <span class="meal-summary-label">Carbs</span>
                            </div>
                            <div class="meal-summary-stat">
                                <span class="meal-summary-value">${Math.round(totalFats)}g</span>
                                <span class="meal-summary-label">Fats</span>
                            </div>
                        </div>
                    </div>`;
        }

        html += `<div class="meal-content">`;

        // Render all foods in this meal group
        entries.forEach((entry, entryIndex) => {
            (entry.foods || []).forEach((food, foodIndex) => {
                const quantity = food.quantity || 1;
                const displayProtein = ((food.protein || 0) * quantity).toFixed(1);
                const displayCarbs = ((food.carbs || 0) * quantity).toFixed(1);
                const displayFats = ((food.fats || 0) * quantity).toFixed(1);
                const displayCalories = Math.round((food.calories || 0) * quantity);

                html += `<div class="food-input-row">
                            <input type="text" class="food-input" value="${food.name}" placeholder="Food name" onchange="updateMealFood('${entry.id}', ${foodIndex}, 'name', this.value)">
                            <div class="macro-inputs-grid">
                                <div class="macro-input-wrapper">
                                    <label class="macro-input-label">Qty</label>
                                    <input type="number" class="macro-input" value="${quantity}" placeholder="1" step="0.1" min="0.1" onchange="updateMealFood('${entry.id}', ${foodIndex}, 'quantity', this.value)">
                                </div>
                                <div class="macro-input-wrapper">
                                    <label class="macro-input-label">Calories</label>
                                    <input type="number" class="macro-input" value="${food.calories || 0}" placeholder="0" onchange="updateMealFood('${entry.id}', ${foodIndex}, 'calories', this.value)">
                                    ${quantity !== 1 ? `<div style="font-size: 0.7rem; color: var(--color-text-secondary); text-align: center; margin-top: 0.25rem;">${displayCalories}</div>` : ''}
                                </div>
                                <div class="macro-input-wrapper">
                                    <label class="macro-input-label">Protein</label>
                                    <input type="number" class="macro-input" value="${food.protein || 0}" placeholder="0" step="0.1" onchange="updateMealFood('${entry.id}', ${foodIndex}, 'protein', this.value)">
                                    ${quantity !== 1 ? `<div style="font-size: 0.7rem; color: var(--color-text-secondary); text-align: center; margin-top: 0.25rem;">${displayProtein}g</div>` : ''}
                                </div>
                                <div class="macro-input-wrapper">
                                    <label class="macro-input-label">Carbs</label>
                                    <input type="number" class="macro-input" value="${food.carbs || 0}" placeholder="0" step="0.1" onchange="updateMealFood('${entry.id}', ${foodIndex}, 'carbs', this.value)">
                                    ${quantity !== 1 ? `<div style="font-size: 0.7rem; color: var(--color-text-secondary); text-align: center; margin-top: 0.25rem;">${displayCarbs}g</div>` : ''}
                                </div>
                                <div class="macro-input-wrapper">
                                    <label class="macro-input-label">Fats</label>
                                    <input type="number" class="macro-input" value="${food.fats || 0}" placeholder="0" step="0.1" onchange="updateMealFood('${entry.id}', ${foodIndex}, 'fats', this.value)">
                                    ${quantity !== 1 ? `<div style="font-size: 0.7rem; color: var(--color-text-secondary); text-align: center; margin-top: 0.25rem;">${displayFats}g</div>` : ''}
                                </div>
                            </div>
                            <div class="food-action-buttons">
                                <button class="btn-save-food" onclick="saveFoodToLibrary('${entry.id}', ${foodIndex})" title="Save to library">Save</button>
                                <button class="btn-delete-food" onclick="deleteFoodFromMeal('${entry.id}', ${foodIndex})" title="Delete food">Delete</button>
                            </div>
                        </div>`;
            });
        });

        html += `</div>
                </div>`;
    });

    container.innerHTML = html;
    updateNutritionSummary();
}

function updateNutritionSummary() {
    const meals = nutritionData.filter(n => n.date === currentNutritionDate);
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFats = 0;

    meals.forEach(meal => {
        (meal.foods || []).forEach(food => {
            const quantity = food.quantity || 1;
            totalCalories += (parseFloat(food.calories) || 0) * quantity;
            totalProtein += (parseFloat(food.protein) || 0) * quantity;
            totalCarbs += (parseFloat(food.carbs) || 0) * quantity;
            totalFats += (parseFloat(food.fats) || 0) * quantity;
        });
    });

    // Animate the value changes
    animateValue('total-calories', Math.round(totalCalories));
    animateValue('total-protein', Math.round(totalProtein), 'g');
    animateValue('total-carbs', Math.round(totalCarbs), 'g');
    animateValue('total-fats', Math.round(totalFats), 'g');

    // Update calories remaining if body goal is set
    updateNutritionCalories();
}

function animateValue(elementId, newValue, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;

    const currentText = element.textContent.replace(/[^\d.-]/g, '');
    const currentValue = parseFloat(currentText) || 0;

    if (currentValue === newValue) {
        element.textContent = newValue + suffix;
        return;
    }

    element.style.transition = 'color 0.3s ease';
    element.style.color = 'var(--color-accent-primary)';

    // Simple direct update with highlight
    element.textContent = newValue + suffix;

    setTimeout(() => {
        element.style.color = '';
    }, 300);
}


// New Food Logging Flow with Bottom Sheet Modals
let pendingFoodData = null; // Temporarily store food data before tagging
let currentPortionMode = 'servings'; // 'servings' or 'measured'
let currentServings = 1;
let selectedMealTag = null;
let saveFoodPreference = 'measured';
let saveFoodContext = null; // {mealId, foodIndex}

// ---------------------------------------------------------------------------
// Combos.
//
// Some things are always eaten as one unit but are several ingredients: yogurt
// with frozen fruit, milk with protein powder. Logging those a food at a time
// is six taps for something eaten daily, and the ingredient amounts never vary.
//
// A combo is stored as an ordinary savedFoods document with isCombo:true and a
// `components` list. Its top-level macros are the sum of its parts, so every
// existing code path that reads a saved food - search, sort, the library list,
// delete - keeps working without knowing combos exist.
//
// Deliberately NOT tied to a meal type. These float: the shake is breakfast on
// one day and a late snack on another, so the meal is guessed from the clock at
// log time rather than baked into the combo.
//
// Components store their own macros rather than pointing at library foods.
// Slightly redundant, but it means correcting a food's macros later cannot
// silently rewrite months of already-logged history.
// ---------------------------------------------------------------------------

function isCombo(item) {
    return !!(item && item.isCombo && Array.isArray(item.components));
}

// Macros for one serving of a combo, summed from its parts.
function comboTotals(components) {
    return (components || []).reduce((total, part) => {
        const qty = parseFloat(part.quantity) || 1;
        total.calories += (parseFloat(part.calories) || 0) * qty;
        total.protein += (parseFloat(part.protein) || 0) * qty;
        total.carbs += (parseFloat(part.carbs) || 0) * qty;
        total.fats += (parseFloat(part.fats) || 0) * qty;
        return total;
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
}

// The foods[] array a log entry should carry for this item. A combo expands
// into its parts, so the meal card lists the ingredients and the totals stay
// correct without any special-casing in the renderer.
function foodsForLogEntry(item, servings) {
    const multiplier = parseFloat(servings) || 1;
    if (isCombo(item)) {
        return item.components.map(part => ({
            name: part.name,
            calories: parseFloat(part.calories) || 0,
            protein: parseFloat(part.protein) || 0,
            carbs: parseFloat(part.carbs) || 0,
            fats: parseFloat(part.fats) || 0,
            quantity: (parseFloat(part.quantity) || 1) * multiplier,
            fromCombo: item.name
        }));
    }
    return [{
        name: item.name,
        calories: parseFloat(item.calories) || 0,
        protein: parseFloat(item.protein) || 0,
        carbs: parseFloat(item.carbs) || 0,
        fats: parseFloat(item.fats) || 0,
        quantity: multiplier
    }];
}

// Which meal this most likely is, from the time of day. Nothing you eat is
// permanently attached to a meal, so guessing here removes a tap from every
// single log without ever being load-bearing - it stays overridable.
function defaultMealTypeForNow(date = new Date()) {
    const hour = date.getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    if (hour < 21) return 'Dinner';
    return 'Snack';
}

// Write one log entry. Used by both the quick-add strip and the portion sheet,
// so they cannot drift apart.
async function logItemToDiary(item, servings, mealType) {
    const entry = {
        date: currentNutritionDate,
        mealType: mealType || defaultMealTypeForNow(),
        time: getCurrentTimeString(),
        foods: foodsForLogEntry(item, servings)
    };

    const docRef = await addDoc(collection(db, "nutrition"), entry);
    nutritionData.unshift({ id: docRef.id, ...entry });

    // Open the meal group this landed in, so the result is visible.
    collapsedMeals[`${entry.mealType}-${currentNutritionDate}`] = false;

    // Remember how much was logged, so next time defaults to it rather than 1.
    if (item.id) {
        const saved = savedFoods.find(f => f.id === item.id);
        if (saved) {
            saved.lastUsed = new Date().toISOString();
            saved.useCount = (saved.useCount || 0) + 1;
            saved.lastQuantity = parseFloat(servings) || 1;
            updateDoc(doc(db, "savedFoods", saved.id), {
                lastUsed: saved.lastUsed,
                useCount: saved.useCount,
                lastQuantity: saved.lastQuantity
            }).catch(err => console.error('Could not update food usage:', err));
        }
    }

    renderMeals();
    renderSavedFoods();
    return entry;
}

// ---- Quick add -------------------------------------------------------------
// The things actually eaten most, one tap each, with no modal and no keyboard.
// Combos come first because they are the ones that used to cost the most taps.

const QUICK_ADD_LIMIT = 8;

function quickAddItems() {
    const scored = [...savedFoods].map(food => {
        const lastUsed = new Date(food.lastUsed || 0).getTime() || 0;
        return { food, lastUsed, useCount: food.useCount || 0 };
    });
    scored.sort((a, b) => {
        // Combos first, then most used, then most recent.
        const aCombo = isCombo(a.food) ? 1 : 0;
        const bCombo = isCombo(b.food) ? 1 : 0;
        if (aCombo !== bCombo) return bCombo - aCombo;
        if (b.useCount !== a.useCount) return b.useCount - a.useCount;
        return b.lastUsed - a.lastUsed;
    });
    return scored.slice(0, QUICK_ADD_LIMIT).map(s => s.food);
}

function renderQuickAdd() {
    const container = document.getElementById('quick-add-strip');
    if (!container) return;

    const items = quickAddItems();
    if (items.length === 0) {
        container.innerHTML = '';
        return;
    }

    const meal = defaultMealTypeForNow();
    let html = `<div class="quick-add-label">Quick add &middot; goes to ${escapeHtml(meal)}</div>
                <div class="quick-add-row">`;
    items.forEach(item => {
        const totals = isCombo(item) ? comboTotals(item.components) : item;
        const qty = parseFloat(item.lastQuantity) || 1;
        const kcal = Math.round((parseFloat(totals.calories) || 0) * qty);
        const sub = qty === 1 ? `${kcal} kcal` : `${qty} &times; &middot; ${kcal} kcal`;
        html += `<button type="button" class="quick-add-btn${isCombo(item) ? ' is-combo' : ''}"
                         data-quick-add="${escapeHtml(item.id)}">
                    <span class="quick-add-name">${escapeHtml(item.name)}</span>
                    <span class="quick-add-sub">${sub}</span>
                 </button>`;
    });
    html += `</div>`;
    container.innerHTML = html;

    container.querySelectorAll('[data-quick-add]').forEach(btn => {
        btn.addEventListener('click', () => quickAddFood(btn.getAttribute('data-quick-add')));
    });
}

window.quickAddFood = async function (foodId) {
    const item = savedFoods.find(f => f.id === foodId);
    if (!item) return;

    const servings = parseFloat(item.lastQuantity) || 1;
    try {
        const entry = await logItemToDiary(item, servings, defaultMealTypeForNow());
        showToast(`${item.name} added to ${entry.mealType}.`, 'success');
    } catch (e) {
        console.error('Quick add failed:', e);
        showToast('Could not add that. Try again in a moment.', 'error');
    }
};

// ---- Combo builder ---------------------------------------------------------
// Built from foods already in the library rather than by re-entering macros,
// because the ingredients of a combo are almost always things already logged
// individually at some point.

let comboDraft = null;   // { name, parts: Map(foodId -> quantity), editingId }

window.openComboBuilder = function (comboId = null) {
    const existing = comboId ? savedFoods.find(f => f.id === comboId) : null;

    comboDraft = { name: '', parts: new Map(), editingId: null };

    if (isCombo(existing)) {
        comboDraft.name = existing.name;
        comboDraft.editingId = existing.id;
        // Match components back to library foods by name so the builder can
        // show them selected. A component whose food was since deleted simply
        // does not appear, and is dropped on save.
        existing.components.forEach(part => {
            const match = savedFoods.find(f => !isCombo(f) &&
                normalizeLabel(f.name) === normalizeLabel(part.name));
            if (match) comboDraft.parts.set(match.id, parseFloat(part.quantity) || 1);
        });
    }

    closeAddFoodModal();

    const backdrop = document.getElementById('combo-builder-backdrop');
    const modal = document.getElementById('combo-builder-modal');
    document.getElementById('combo-name-input').value = comboDraft.name;
    document.getElementById('combo-builder-title').textContent =
        comboDraft.editingId ? 'Edit combo' : 'New combo';

    renderComboBuilder();

    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('active');
        modal.classList.add('active');
    }, 10);
    document.body.style.overflow = 'hidden';
};

window.closeComboBuilder = function () {
    const backdrop = document.getElementById('combo-builder-backdrop');
    const modal = document.getElementById('combo-builder-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        backdrop.classList.remove('active');
        backdrop.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
    comboDraft = null;
};

window.filterComboIngredients = function (term) {
    renderComboBuilder(term);
};

function renderComboBuilder(searchTerm = '') {
    if (!comboDraft) return;

    // Only plain foods can be ingredients; nesting a combo inside a combo would
    // make the totals impossible to reason about.
    let options = savedFoods.filter(f => !isCombo(f));
    if (searchTerm) {
        const needle = searchTerm.toLowerCase();
        options = options.filter(f => f.name.toLowerCase().includes(needle));
    }
    // Chosen ingredients stay pinned to the top so they never scroll out of view.
    options.sort((a, b) => {
        const aSel = comboDraft.parts.has(a.id) ? 1 : 0;
        const bSel = comboDraft.parts.has(b.id) ? 1 : 0;
        if (aSel !== bSel) return bSel - aSel;
        return (b.useCount || 0) - (a.useCount || 0);
    });

    const list = document.getElementById('combo-ingredient-list');
    if (options.length === 0) {
        list.innerHTML = `<div class="empty-state">No saved foods yet. Save a few foods first,
            then combine them here.</div>`;
    } else {
        list.innerHTML = options.map(food => {
            const selected = comboDraft.parts.has(food.id);
            const qty = selected ? comboDraft.parts.get(food.id) : 1;
            const unit = food.servingUnit ? `${food.servingSize || 1}${food.servingUnit}` : 'serving';
            return `
                <div class="combo-ingredient${selected ? ' selected' : ''}">
                    <button type="button" class="combo-ingredient-toggle"
                            data-combo-toggle="${escapeHtml(food.id)}"
                            aria-pressed="${selected}">
                        <span class="combo-ingredient-check">${selected ? '&#10003;' : '+'}</span>
                        <span class="combo-ingredient-body">
                            <span class="combo-ingredient-name">${escapeHtml(food.name)}</span>
                            <span class="combo-ingredient-meta">1 &times; ${escapeHtml(unit)} &middot;
                                ${Math.round(parseFloat(food.calories) || 0)} kcal</span>
                        </span>
                    </button>
                    ${selected ? `
                    <div class="combo-qty">
                        <button type="button" class="combo-qty-btn" data-combo-step="${escapeHtml(food.id)}|-1"
                                aria-label="Less ${escapeHtml(food.name)}">&minus;</button>
                        <span class="combo-qty-value">${qty}</span>
                        <button type="button" class="combo-qty-btn" data-combo-step="${escapeHtml(food.id)}|1"
                                aria-label="More ${escapeHtml(food.name)}">+</button>
                    </div>` : ''}
                </div>`;
        }).join('');

        list.querySelectorAll('[data-combo-toggle]').forEach(btn => {
            btn.addEventListener('click', () => toggleComboIngredient(btn.getAttribute('data-combo-toggle')));
        });
        list.querySelectorAll('[data-combo-step]').forEach(btn => {
            const [id, step] = btn.getAttribute('data-combo-step').split('|');
            btn.addEventListener('click', () => stepComboIngredient(id, parseFloat(step)));
        });
    }

    updateComboPreview();
}

function toggleComboIngredient(foodId) {
    if (!comboDraft) return;
    if (comboDraft.parts.has(foodId)) comboDraft.parts.delete(foodId);
    else comboDraft.parts.set(foodId, 1);
    renderComboBuilder(document.getElementById('combo-ingredient-search').value);
}

function stepComboIngredient(foodId, step) {
    if (!comboDraft || !comboDraft.parts.has(foodId)) return;
    // Quarter-serving steps: a scoop and a half of whey is a real amount, three
    // and a bit scoops is not.
    const next = Math.round((comboDraft.parts.get(foodId) + step * 0.25) * 100) / 100;
    if (next < 0.25) return;
    comboDraft.parts.set(foodId, next);
    renderComboBuilder(document.getElementById('combo-ingredient-search').value);
}

function comboDraftComponents() {
    const parts = [];
    comboDraft.parts.forEach((qty, foodId) => {
        const food = savedFoods.find(f => f.id === foodId);
        if (!food) return;
        parts.push({
            name: food.name,
            calories: parseFloat(food.calories) || 0,
            protein: parseFloat(food.protein) || 0,
            carbs: parseFloat(food.carbs) || 0,
            fats: parseFloat(food.fats) || 0,
            quantity: qty
        });
    });
    return parts;
}

function updateComboPreview() {
    const preview = document.getElementById('combo-preview');
    const saveBtn = document.getElementById('combo-save-btn');
    const parts = comboDraftComponents();

    if (parts.length === 0) {
        preview.innerHTML = '<span class="combo-preview-empty">Pick the foods this is made of.</span>';
        saveBtn.disabled = true;
        return;
    }

    const totals = comboTotals(parts);
    preview.innerHTML = `
        <div class="combo-preview-line">${parts.map(p =>
        `${escapeHtml(p.name)}${p.quantity !== 1 ? ` &times;${p.quantity}` : ''}`).join(' + ')}</div>
        <div class="combo-preview-macros">
            <strong>${Math.round(totals.calories)}</strong> kcal &middot;
            ${Math.round(totals.protein)}g protein &middot;
            ${Math.round(totals.carbs)}g carbs &middot;
            ${Math.round(totals.fats)}g fat
        </div>`;
    saveBtn.disabled = false;
}

window.saveCombo = async function () {
    if (!comboDraft) return;

    const name = document.getElementById('combo-name-input').value.trim();
    const components = comboDraftComponents();
    const message = document.getElementById('combo-builder-message');

    if (!name) {
        message.textContent = 'Give it a name so you can find it later.';
        document.getElementById('combo-name-input').focus();
        return;
    }
    if (components.length === 0) {
        message.textContent = 'Pick at least one food.';
        return;
    }
    const clash = savedFoods.some(f =>
        f.id !== comboDraft.editingId && normalizeLabel(f.name) === normalizeLabel(name));
    if (clash) {
        message.textContent = `Something in your library is already called "${name}".`;
        return;
    }

    const totals = comboTotals(components);
    const record = {
        name,
        isCombo: true,
        components,
        // Totals mirrored onto the normal fields so every existing code path
        // that reads a saved food keeps working unchanged.
        calories: Math.round(totals.calories * 10) / 10,
        protein: Math.round(totals.protein * 10) / 10,
        carbs: Math.round(totals.carbs * 10) / 10,
        fats: Math.round(totals.fats * 10) / 10,
        servingSize: 1,
        servingUnit: 'serving',
        portionInputPreference: 'servings'
    };

    const saveBtn = document.getElementById('combo-save-btn');
    saveBtn.disabled = true;

    try {
        if (comboDraft.editingId) {
            await updateDoc(doc(db, "savedFoods", comboDraft.editingId), record);
            const idx = savedFoods.findIndex(f => f.id === comboDraft.editingId);
            if (idx !== -1) savedFoods[idx] = { ...savedFoods[idx], ...record };
        } else {
            const docRef = await addDoc(collection(db, "savedFoods"), {
                ...record,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                useCount: 0
            });
            savedFoods.push({ id: docRef.id, ...record, useCount: 0 });
        }
        window.savedFoods = savedFoods;
        renderSavedFoods();
        closeComboBuilder();
        showToast(`"${name}" saved. It is one tap from now on.`, 'success');
    } catch (e) {
        console.error('Could not save combo:', e);
        message.textContent = 'Could not save that. Your connection may be down.';
        saveBtn.disabled = false;
    }
};

// Add Food Modal Functions
window.showAddFoodModal = function () {
    const modal = document.getElementById('add-food-modal');
    const backdrop = document.getElementById('add-food-backdrop');

    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('active');
        modal.classList.add('active');
    }, 10);

    // Reset to New tab
    switchAddFoodTab('new');
    document.body.style.overflow = 'hidden';
};

window.closeAddFoodModal = function () {
    const modal = document.getElementById('add-food-modal');
    const backdrop = document.getElementById('add-food-backdrop');

    modal.classList.remove('active');
    setTimeout(() => {
        backdrop.classList.remove('active');
        backdrop.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
};

window.switchAddFoodTab = function (tab) {
    const newTab = document.getElementById('new-food-tab');
    const savedTab = document.getElementById('saved-food-tab');
    const newPanel = document.getElementById('new-food-panel');
    const savedPanel = document.getElementById('saved-food-panel');

    if (tab === 'new') {
        newTab.classList.add('active');
        savedTab.classList.remove('active');
        newPanel.style.display = 'block';
        savedPanel.style.display = 'none';
    } else {
        newTab.classList.remove('active');
        savedTab.classList.add('active');
        newPanel.style.display = 'none';
        savedPanel.style.display = 'block';
        renderInlineSavedFoods();
    }
};

// Render saved foods inside the Add Food modal
function renderInlineSavedFoods(searchTerm = '') {
    const container = document.getElementById('saved-food-list-inline');

    let filteredFoods = savedFoods;
    if (searchTerm) {
        filteredFoods = savedFoods.filter(food =>
            food.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    filteredFoods.sort((a, b) => {
        const dateA = new Date(a.lastUsed || 0);
        const dateB = new Date(b.lastUsed || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (b.useCount || 0) - (a.useCount || 0);
    });

    let html = '';
    if (filteredFoods.length === 0) {
        html = '<div class="empty-state">No saved foods found.</div>';
    } else {
        filteredFoods.forEach(food => {
            const servingInfo = food.servingSize && food.servingUnit
                ? `1 serving = ${food.servingSize}${food.servingUnit}`
                : '';
            html += `<div class="saved-food-item" onclick="selectSavedFood('${food.id}')">
                        <div class="saved-food-info">
                            <div class="saved-food-name">${food.name}</div>
                            ${servingInfo ? `<div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">${servingInfo}</div>` : ''}
                        </div>
                        <div style="font-size: 1.5rem; color: var(--color-accent-primary);">➕</div>
                    </div>`;
        });
    }

    container.innerHTML = html;
}

// Select a saved food and show portion input
window.selectSavedFood = async function (foodId) {
    const food = savedFoods.find(f => f.id === foodId);
    if (!food) return;

    closeAddFoodModal();
    showPortionModal(food);

    // Update use count
    try {
        food.lastUsed = new Date().toISOString();
        food.useCount = (food.useCount || 0) + 1;
        const docRef = doc(db, "savedFoods", food.id);
        await updateDoc(docRef, {
            lastUsed: food.lastUsed,
            useCount: food.useCount
        });
        renderSavedFoods();
    } catch (e) {
        console.error("Error updating food use count:", e);
    }
};

// Portion Modal Functions
window.showPortionModal = function (food) {
    const modal = document.getElementById('portion-modal');
    const backdrop = document.getElementById('portion-modal-backdrop');

    // Store food data
    pendingFoodData = {
        isNew: false,
        food: food,
        originalFood: food
    };

    // Set food info. A combo lists what it is made of; grams mean nothing for
    // "yogurt bowl", so it shows its ingredients instead of a serving weight.
    document.getElementById('portion-food-name').textContent = food.name;
    const servingInfo = isCombo(food)
        ? food.components.map(p => p.name).join(' + ')
        : (food.servingSize && food.servingUnit
            ? `1 serving = ${food.servingSize}${food.servingUnit}`
            : '1 serving');
    document.getElementById('portion-food-serving').textContent = servingInfo;

    // Measuring a combo by weight is meaningless, so that mode is hidden and it
    // is always counted in whole units.
    const modeToggle = document.getElementById('portion-mode-toggle');
    if (modeToggle) modeToggle.style.display = isCombo(food) ? 'none' : '';

    // Default to the amount logged last time rather than always 1: the usual
    // case becomes "that's right, save" instead of re-deciding every day.
    currentServings = parseFloat(food.lastQuantity) || 1;
    document.getElementById('servings-display').textContent = currentServings;
    document.getElementById('measured-amount-input').value = '';
    document.getElementById('measured-unit-select').value = food.servingUnit || 'g';
    document.getElementById('calculated-servings').style.display = 'none';

    // Pre-select the meal that matches the clock. Still one tap to change, but
    // it is right nearly always, and nothing here is tied to a fixed meal.
    selectedMealTag = defaultMealTypeForNow();
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(tag => {
        const btn = document.getElementById(`tag-${tag}`);
        if (btn) btn.classList.toggle('selected', tag === selectedMealTag.toLowerCase());
    });

    // Set default mode based on food preference
    const defaultMode = isCombo(food) ? 'servings' : (food.portionInputPreference || 'servings');
    switchPortionMode(defaultMode);

    document.getElementById('add-to-log-btn').disabled = false;

    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('active');
        modal.classList.add('active');
    }, 10);

    document.body.style.overflow = 'hidden';
};

window.closePortionModal = function () {
    const modal = document.getElementById('portion-modal');
    const backdrop = document.getElementById('portion-modal-backdrop');

    modal.classList.remove('active');
    setTimeout(() => {
        backdrop.classList.remove('active');
        backdrop.style.display = 'none';
        document.body.style.overflow = '';
        pendingFoodData = null;
        selectedMealTag = null;
    }, 300);
};

window.switchPortionMode = function (mode) {
    currentPortionMode = mode;
    const servingsTab = document.getElementById('servings-mode-tab');
    const measuredTab = document.getElementById('measured-mode-tab');
    const servingsPanel = document.getElementById('servings-mode-panel');
    const measuredPanel = document.getElementById('measured-mode-panel');

    if (mode === 'servings') {
        servingsTab.classList.add('active');
        measuredTab.classList.remove('active');
        servingsPanel.style.display = 'block';
        measuredPanel.style.display = 'none';
    } else {
        servingsTab.classList.remove('active');
        measuredTab.classList.add('active');
        servingsPanel.style.display = 'none';
        measuredPanel.style.display = 'block';
    }
};

window.adjustServings = function (delta) {
    currentServings = Math.max(0.25, currentServings + (delta * 0.25));
    document.getElementById('servings-display').textContent = currentServings;
};

window.calculateServingsFromMeasured = function () {
    const amount = parseFloat(document.getElementById('measured-amount-input').value);
    const unit = document.getElementById('measured-unit-select').value;

    if (!amount || amount <= 0 || !pendingFoodData || !pendingFoodData.originalFood) {
        document.getElementById('calculated-servings').style.display = 'none';
        return;
    }

    const food = pendingFoodData.originalFood;
    if (!food.servingSize || !food.servingUnit) {
        document.getElementById('calculated-servings').style.display = 'none';
        return;
    }

    // Convert units if needed
    let amountInFoodUnit = amount;
    if (unit !== food.servingUnit) {
        amountInFoodUnit = convertUnits(amount, unit, food.servingUnit);
        if (amountInFoodUnit === null) {
            const calcElement = document.getElementById('calculated-servings');
            calcElement.textContent = `⚠️ Cannot convert ${unit} to ${food.servingUnit}`;
            calcElement.style.color = 'var(--color-error)';
            calcElement.style.display = 'block';
            return;
        }
    }

    // Calculate servings
    const servings = amountInFoodUnit / food.servingSize;
    currentServings = servings;

    const calcElement = document.getElementById('calculated-servings');
    calcElement.style.color = '';
    document.getElementById('calculated-servings-value').textContent = servings.toFixed(2);
    calcElement.style.display = 'block';
};

// Unit conversion function
function convertUnits(amount, fromUnit, toUnit) {
    if (fromUnit === toUnit) return amount;

    // Conversion table (to grams)
    const toGrams = {
        'g': 1,
        'oz': 28.35,
        'ml': 1, // Assume same density as water
    };

    // Can't convert between weight/volume and count
    const incompatible = ['each', 'serving'];
    if (incompatible.includes(fromUnit) || incompatible.includes(toUnit)) {
        return null;
    }

    // Convert to grams, then to target unit
    if (!toGrams[fromUnit] || !toGrams[toUnit]) {
        return null;
    }

    const grams = amount * toGrams[fromUnit];
    return grams / toGrams[toUnit];
}

window.selectMealTag = function (tag) {
    selectedMealTag = tag;

    // Update button states
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(t => {
        const btn = document.getElementById(`tag-${t.toLowerCase()}`);
        if (t.toLowerCase() === tag.toLowerCase()) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    // Enable add button
    document.getElementById('add-to-log-btn').disabled = false;
};

window.addFoodToLog = async function () {
    if (!pendingFoodData) return;

    const food = pendingFoodData.originalFood;
    const btn = document.getElementById('add-to-log-btn');
    btn.disabled = true;

    try {
        // Shared with quick add, so a combo expands into its ingredients the
        // same way whichever route logged it.
        await logItemToDiary(food, currentServings, selectedMealTag || defaultMealTypeForNow());
        closePortionModal();
    } catch (e) {
        console.error("Error logging food:", e);
        showToast('Could not save that. Try again in a moment.', 'error');
        btn.disabled = false;
    }
};

window.closeMealTagModal = function () {
    document.getElementById('meal-tag-modal').classList.remove('active');
    pendingFoodData = null;
};

window.addNewFood = function () {
    closeAddFoodModal();
    showCreateFoodModal();
};

window.showCreateFoodModal = function () {
    const modal = document.getElementById('create-food-modal');
    const backdrop = document.getElementById('create-food-backdrop');

    // Reset all fields
    document.getElementById('create-food-name').value = '';
    document.getElementById('create-food-calories').value = '';
    document.getElementById('create-food-protein').value = '';
    document.getElementById('create-food-carbs').value = '';
    document.getElementById('create-food-fats').value = '';
    document.getElementById('create-food-serving-size').value = '1';
    document.getElementById('create-food-serving-unit').value = 'serving';
    document.getElementById('create-food-save-to-library').checked = true;

    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('active');
        modal.classList.add('active');
    }, 10);

    document.body.style.overflow = 'hidden';
};

window.closeCreateFoodModal = function () {
    const modal = document.getElementById('create-food-modal');
    const backdrop = document.getElementById('create-food-backdrop');

    modal.classList.remove('active');
    setTimeout(() => {
        backdrop.classList.remove('active');
        backdrop.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
};

window.confirmCreateFood = async function () {
    const name = document.getElementById('create-food-name').value.trim();
    const calories = parseFloat(document.getElementById('create-food-calories').value) || 0;
    const protein = parseFloat(document.getElementById('create-food-protein').value) || 0;
    const carbs = parseFloat(document.getElementById('create-food-carbs').value) || 0;
    const fats = parseFloat(document.getElementById('create-food-fats').value) || 0;
    const servingSize = parseFloat(document.getElementById('create-food-serving-size').value) || 1;
    const servingUnit = document.getElementById('create-food-serving-unit').value;
    const saveToLibrary = document.getElementById('create-food-save-to-library').checked;

    if (!name) {
        alert('Please enter a food name');
        return;
    }

    if (calories === 0 && protein === 0 && carbs === 0 && fats === 0) {
        alert('Please enter at least one nutritional value');
        return;
    }

    const newFood = {
        name: name,
        protein: protein,
        carbs: carbs,
        fats: fats,
        calories: calories,
        servingSize: servingSize,
        servingUnit: servingUnit.toLowerCase(),
        portionInputPreference: 'measured',
        // NEW: Baseline serving for proportional calculations
        baselineServingSize: servingSize,
        baselineServingUnit: servingUnit.toLowerCase(),
        // Store nutrition values as baseline (per the serving size entered)
        baselineNutrition: {
            calories: calories,
            protein: protein,
            carbs: carbs,
            fats: fats
        }
    };

    // Save to library if checked
    if (saveToLibrary) {
        try {
            const savedFood = {
                ...newFood,
                created: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                useCount: 0
            };

            const docRef = await addDoc(collection(db, "savedFoods"), savedFood);
            savedFoods.unshift({ id: docRef.id, ...savedFood });
            renderSavedFoods();
            console.log('Food saved to library');
        } catch (e) {
            console.error("Error saving food to library:", e);
            alert('Error saving food to library, but will still add to meal');
        }
    }

    // Close the create modal and show portion modal to add to meal
    closeCreateFoodModal();
    showPortionModal(newFood);
};

window.tagFood = async function (mealTag) {
    closeMealTagModal();

    if (!pendingFoodData) {
        console.error('No pending food data');
        return;
    }

    const currentTime = getCurrentTimeString();

    // Create or find meal group for this tag
    const foodEntry = {
        date: currentNutritionDate,
        mealType: mealTag,
        time: currentTime,
        foods: [pendingFoodData.food]
    };

    console.log('Adding food:', {
        date: currentNutritionDate,
        mealType: mealTag,
        time: currentTime,
        food: pendingFoodData.food,
        timezone: userTimezone
    });

    try {
        const docRef = await addDoc(collection(db, "nutrition"), foodEntry);
        const newEntry = { id: docRef.id, ...foodEntry };
        nutritionData.unshift(newEntry);
        currentEditingMealId = newEntry.id;
        const groupId = `${mealTag}-${currentNutritionDate}`;
        collapsedMeals[groupId] = false;
        console.log('Food successfully added with ID:', docRef.id);
        pendingFoodData = null;
        renderMeals();
    } catch (e) {
        console.error("Error adding food:", e);
        alert('Error adding food. Please check your connection and try again.');
        throw e;
    }
};

const mealSaveTimers = {};

window.updateMealFood = async function (mealId, foodIndex, field, value) {
    const meal = nutritionData.find(m => m.id === mealId);
    if (!meal || !meal.foods || !meal.foods[foodIndex]) return;

    // Numeric fields were being stored as strings, which made `quantity || 1`
    // treat "0" as truthy and broke the `quantity !== 1` display check.
    if (field === 'quantity' || field === 'calories' || field === 'protein' ||
        field === 'carbs' || field === 'fats') {
        const parsed = parseFloat(value);
        meal.foods[foodIndex][field] = Number.isFinite(parsed) ? parsed : 0;
    } else {
        meal.foods[foodIndex][field] = value;
    }

    meal.hasUnsavedChanges = true;
    updateNutritionSummary();
    renderMeals();

    // Persist. Previously this never happened: the edit lived in memory, looked
    // saved, and vanished on reload. Debounced so typing does not spam Firestore.
    if (mealSaveTimers[mealId]) clearTimeout(mealSaveTimers[mealId]);
    mealSaveTimers[mealId] = setTimeout(() => {
        delete mealSaveTimers[mealId];
        window.saveMealChanges(mealId).catch(err =>
            console.error('Failed to save meal edit:', err));
    }, 800);
};

window.saveMealChanges = async function (mealId) {
    const meal = nutritionData.find(m => m.id === mealId);
    if (!meal) {
        console.error('Meal not found:', mealId);
        return;
    }

    console.log('Saving meal changes:', {
        mealId: mealId,
        date: meal.date,
        mealType: meal.mealType,
        foods: meal.foods,
        timezone: userTimezone
    });

    try {
        const docRef = doc(db, "nutrition", mealId);
        await updateDoc(docRef, { foods: meal.foods });
        meal.hasUnsavedChanges = false;
        console.log('Meal changes saved successfully to Firestore');
        showToast('Meal updated.', 'success');
        renderMeals();
    } catch (e) {
        console.error("Error saving meal:", e);
        alert('Error saving meal. Please try again.');
        throw e; // Re-throw for debugging
    }
};

async function saveMealToFirebase(meal) {
    // This function is no longer needed as we use updateDoc directly
    console.warn('saveMealToFirebase is deprecated, use updateDoc directly');
}

window.deleteMeal = async function (mealId) {
    if (confirm('Delete this meal?')) {
        try {
            // Delete from Firestore
            const docRef = doc(db, "nutrition", mealId);
            await deleteDoc(docRef);

            // Remove from local state
            nutritionData = nutritionData.filter(m => m.id !== mealId);
            renderMeals();
        } catch (e) {
            console.error("Error deleting meal:", e);
            alert('Error deleting meal. Please try again.');
        }
    }
};

window.deleteFoodFromMeal = async function (mealId, foodIndex) {
    if (confirm('Delete this food item?')) {
        try {
            const meal = nutritionData.find(m => m.id === mealId);
            if (!meal || !meal.foods) return;

            // Remove the food from the array
            meal.foods.splice(foodIndex, 1);

            // If meal has no foods left, delete the entire meal
            if (meal.foods.length === 0) {
                await window.deleteMeal(mealId);
                return;
            }

            // Update in Firestore
            const docRef = doc(db, "nutrition", mealId);
            await updateDoc(docRef, { foods: meal.foods });

            renderMeals();
        } catch (e) {
            console.error("Error deleting food from meal:", e);
            alert('Error deleting food item. Please try again.');
        }
    }
};

// Saved Foods Functions
window.saveFoodToLibrary = function (mealId, foodIndex) {
    const meal = nutritionData.find(m => m.id === mealId);
    if (!meal || !meal.foods || !meal.foods[foodIndex]) return;

    const food = meal.foods[foodIndex];

    if (!food.name || !food.name.trim()) {
        alert('Please enter a food name before saving');
        return;
    }

    // Store context
    saveFoodContext = { mealId, foodIndex, food };

    // Show save food modal
    showSaveFoodModal(food);
};

window.showSaveFoodModal = function (food) {
    const modal = document.getElementById('save-food-modal');
    const backdrop = document.getElementById('save-food-backdrop');

    // Pre-fill food name
    document.getElementById('save-food-name').value = food.name || '';
    document.getElementById('save-serving-size').value = '1';
    document.getElementById('save-serving-unit').value = 'serving';

    // Default to measured preference
    selectPortionPreference('measured');

    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('active');
        modal.classList.add('active');
    }, 10);

    document.body.style.overflow = 'hidden';
};

window.closeSaveFoodModal = function () {
    const modal = document.getElementById('save-food-modal');
    const backdrop = document.getElementById('save-food-backdrop');

    modal.classList.remove('active');
    setTimeout(() => {
        backdrop.classList.remove('active');
        backdrop.style.display = 'none';
        document.body.style.overflow = '';
        saveFoodContext = null;
    }, 300);
};

window.selectPortionPreference = function (pref) {
    saveFoodPreference = pref;
    const servingsBtn = document.getElementById('save-pref-servings');
    const measuredBtn = document.getElementById('save-pref-measured');

    if (pref === 'servings') {
        servingsBtn.classList.add('active');
        measuredBtn.classList.remove('active');
    } else {
        servingsBtn.classList.remove('active');
        measuredBtn.classList.add('active');
    }
};

window.confirmSaveFood = async function () {
    if (!saveFoodContext) return;

    const foodName = document.getElementById('save-food-name').value.trim();
    const servingSize = parseFloat(document.getElementById('save-serving-size').value);
    const servingUnit = document.getElementById('save-serving-unit').value;

    if (!foodName) {
        alert('Please enter a food name');
        return;
    }

    if (!servingSize || servingSize <= 0) {
        alert('Please enter a valid serving size');
        return;
    }

    const food = saveFoodContext.food;
    const newProtein = parseFloat(food.protein) || 0;
    const newCarbs = parseFloat(food.carbs) || 0;
    const newFats = parseFloat(food.fats) || 0;
    const newCalories = parseFloat(food.calories) || 0;

    // Check if food already exists (by name and nutritional values)
    const existingFood = savedFoods.find(f => {
        const nameMatch = f.name.toLowerCase().trim() === foodName.toLowerCase();
        const proteinMatch = (parseFloat(f.protein) || 0) === newProtein;
        const carbsMatch = (parseFloat(f.carbs) || 0) === newCarbs;
        const fatsMatch = (parseFloat(f.fats) || 0) === newFats;
        const caloriesMatch = (parseFloat(f.calories) || 0) === newCalories;

        return nameMatch && proteinMatch && carbsMatch && fatsMatch && caloriesMatch;
    });

    if (existingFood) {
        // Exact duplicate found - just update lastUsed and serving info
        try {
            existingFood.lastUsed = new Date().toISOString();
            existingFood.useCount = (existingFood.useCount || 0) + 1;
            existingFood.servingSize = servingSize;
            existingFood.servingUnit = servingUnit.toLowerCase();
            existingFood.portionInputPreference = saveFoodPreference;

            const docRef = doc(db, "savedFoods", existingFood.id);
            await updateDoc(docRef, {
                lastUsed: existingFood.lastUsed,
                useCount: existingFood.useCount,
                servingSize: existingFood.servingSize,
                servingUnit: existingFood.servingUnit,
                portionInputPreference: existingFood.portionInputPreference
            });

            closeSaveFoodModal();
            alert('Food updated in your library!');
            renderSavedFoods();
        } catch (e) {
            console.error("Error updating food:", e);
            alert('Error updating food in library');
        }
    } else {
        // Check if food with same name but different nutritional values exists
        const sameName = savedFoods.find(f => f.name.toLowerCase().trim() === foodName.toLowerCase());

        if (sameName) {
            if (!confirm(`"${foodName}" already exists in saved foods with different nutritional values. Save as a new entry?`)) {
                return;
            }
        }

        // Add new food
        const savedFood = {
            name: foodName,
            protein: newProtein,
            carbs: newCarbs,
            fats: newFats,
            calories: newCalories,
            servingSize: servingSize,
            servingUnit: servingUnit.toLowerCase(),
            portionInputPreference: saveFoodPreference,
            created: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            useCount: 0
        };

        try {
            const docRef = await addDoc(collection(db, "savedFoods"), savedFood);
            savedFoods.unshift({ id: docRef.id, ...savedFood });

            closeSaveFoodModal();
            showToast('Saved to your library.', 'success');
            renderSavedFoods();
        } catch (e) {
            console.error("Error saving food:", e);
            alert('Error saving food to library');
        }
    }
};

function renderSavedFoods(searchTerm = '') {
    // The quick-add strip is driven by the same library, so refreshing it here
    // keeps it in step with every path that changes a saved food.
    renderQuickAdd();

    const container = document.getElementById('saved-food-list');
    const mobileContainer = document.getElementById('saved-food-list-mobile');

    let filteredFoods = savedFoods;
    if (searchTerm) {
        filteredFoods = savedFoods.filter(food =>
            food.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Sort by last used, then by use count
    filteredFoods.sort((a, b) => {
        const dateA = new Date(a.lastUsed || 0);
        const dateB = new Date(b.lastUsed || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (b.useCount || 0) - (a.useCount || 0);
    });

    let html = '';
    if (filteredFoods.length === 0) {
        html = '<div class="empty-state">No saved foods found. Save a food from a meal below!</div>';
    } else {
        filteredFoods.forEach(food => {
            const servingInfo = food.servingSize && food.servingUnit
                ? `(1 serving = ${food.servingSize}${food.servingUnit})`
                : '';
            html += `<div class="saved-food-item">
                        <div class="saved-food-info">
                            <div class="saved-food-name">${food.name}</div>
                            ${servingInfo ? `<div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">${servingInfo}</div>` : ''}
                        </div>
                        <div class="saved-food-actions">
                            <button class="btn-quick-add" onclick="selectSavedFood('${food.id}'); closeSavedFoodsModal();">Add</button>
                            <button class="btn-edit-food" onclick="editSavedFood('${food.id}')">Edit</button>
                            <button class="btn-delete-food" onclick="deleteSavedFood('${food.id}')">Delete</button>
                        </div>
                    </div>`;
        });
    }

    // Update both desktop and mobile containers
    if (container) container.innerHTML = html;
    if (mobileContainer) mobileContainer.innerHTML = html;
}

// Both search boxes call these from an inline oninput in index.html, which
// resolves against the GLOBAL scope, so they have to be exported. (These
// exports previously sat next to the alternative-exercise code and were lost
// when it was removed, which silently broke filtering in the Saved Foods
// panel.)
window.renderSavedFoods = renderSavedFoods;
window.renderInlineSavedFoods = renderInlineSavedFoods;


// Modal functions for mobile saved foods
window.openSavedFoodsModal = function () {
    const modal = document.getElementById('saved-foods-modal');
    const backdrop = document.getElementById('saved-foods-backdrop');

    if (modal && backdrop) {
        // Render saved foods in mobile list
        renderSavedFoods();

        // Show backdrop first
        backdrop.style.display = 'block';
        backdrop.classList.add('active');

        // Every other modal sets display explicitly; this one relied on a
        // mobile stylesheet override that has since been removed, so the sheet
        // stayed display:none while the backdrop greyed out the page and locked
        // scrolling. Tapping "Saved Foods" froze the app with nothing on screen.
        modal.style.display = 'block';

        // Then show modal with animation
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }
};

window.closeSavedFoodsModal = function () {
    const modal = document.getElementById('saved-foods-modal');
    const backdrop = document.getElementById('saved-foods-backdrop');

    if (modal && backdrop) {
        // Hide modal with animation
        modal.classList.remove('active');

        // Hide backdrop after animation
        setTimeout(() => {
            backdrop.classList.remove('active');
            backdrop.style.display = 'none';
            modal.style.display = 'none';
        }, 300);

        // Re-enable body scroll
        document.body.style.overflow = '';
    }
};


window.editSavedFood = function (foodId) {
    const food = savedFoods.find(f => f.id === foodId);
    if (!food) {
        console.error('Food not found:', foodId);
        return;
    }

    showEditFoodModal(food);
};

window.showEditFoodModal = function (food) {
    const modal = document.getElementById('edit-food-modal');
    const backdrop = document.getElementById('edit-food-backdrop');

    // Fill in the form with current values
    document.getElementById('edit-food-id').value = food.id;
    document.getElementById('edit-food-name').value = food.name || '';
    document.getElementById('edit-food-calories').value = food.calories || 0;
    document.getElementById('edit-food-protein').value = food.protein || 0;
    document.getElementById('edit-food-carbs').value = food.carbs || 0;
    document.getElementById('edit-food-fats').value = food.fats || 0;
    document.getElementById('edit-food-serving-size').value = food.servingSize || 1;
    document.getElementById('edit-food-serving-unit').value = food.servingUnit || 'serving';

    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('active');
        modal.classList.add('active');
    }, 10);

    document.body.style.overflow = 'hidden';
};

window.closeEditFoodModal = function () {
    const modal = document.getElementById('edit-food-modal');
    const backdrop = document.getElementById('edit-food-backdrop');

    modal.classList.remove('active');
    setTimeout(() => {
        backdrop.classList.remove('active');
        backdrop.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
};

window.confirmEditFood = async function () {
    const foodId = document.getElementById('edit-food-id').value;
    const name = document.getElementById('edit-food-name').value.trim();
    const calories = parseFloat(document.getElementById('edit-food-calories').value) || 0;
    const protein = parseFloat(document.getElementById('edit-food-protein').value) || 0;
    const carbs = parseFloat(document.getElementById('edit-food-carbs').value) || 0;
    const fats = parseFloat(document.getElementById('edit-food-fats').value) || 0;
    const servingSize = parseFloat(document.getElementById('edit-food-serving-size').value) || 1;
    const servingUnit = document.getElementById('edit-food-serving-unit').value;

    if (!name) {
        alert('Please enter a food name');
        return;
    }

    try {
        // Update in Firebase with baseline fields
        const docRef = doc(db, "savedFoods", foodId);
        await updateDoc(docRef, {
            name: name,
            calories: calories,
            protein: protein,
            carbs: carbs,
            fats: fats,
            servingSize: servingSize,
            servingUnit: servingUnit.toLowerCase(),
            // NEW: Add baseline serving fields for proportional calculations
            baselineServingSize: servingSize,
            baselineServingUnit: servingUnit.toLowerCase(),
            baselineNutrition: {
                calories: calories,
                protein: protein,
                carbs: carbs,
                fats: fats
            }
        });

        // Update local state
        const food = savedFoods.find(f => f.id === foodId);
        if (food) {
            food.name = name;
            food.calories = calories;
            food.protein = protein;
            food.carbs = carbs;
            food.fats = fats;
            food.servingSize = servingSize;
            food.servingUnit = servingUnit.toLowerCase();
            food.baselineServingSize = servingSize;
            food.baselineServingUnit = servingUnit.toLowerCase();
            food.baselineNutrition = {
                calories: calories,
                protein: protein,
                carbs: carbs,
                fats: fats
            };
        }

        closeEditFoodModal();
        renderSavedFoods();
        showToast('Food updated.', 'success');

        console.log(`Updated saved food ${foodId}`);
    } catch (e) {
        console.error("Error updating saved food:", e);
        alert('Error updating food. Please try again.');
    }
};

window.deleteSavedFood = async function (foodId) {
    if (!confirm('Delete this saved food?')) return;

    try {
        // Delete from Firebase
        const docRef = doc(db, "savedFoods", foodId);
        await deleteDoc(docRef);

        // Remove from local state
        savedFoods = savedFoods.filter(f => f.id !== foodId);
        renderSavedFoods();

        console.log(`Deleted saved food ${foodId} from Firebase`);
    } catch (e) {
        console.error("Error deleting saved food:", e);
        alert('Error deleting saved food. Please try again.');
    }
};

async function loadSavedFoods() {
    try {
        const q = query(collection(db, "savedFoods"), orderBy("lastUsed", "desc"), limit(100));
        const querySnapshot = await getDocs(q);

        const allFoods = [];
        querySnapshot.forEach((doc) => {
            allFoods.push({ id: doc.id, ...doc.data() });
        });

        console.log(`Loaded ${allFoods.length} saved foods from database`);

        savedFoods = allFoods;
    } catch (e) {
        console.error("Error loading saved foods:", e);
        // Initialize with empty array if error
        savedFoods = [];
    }
}

/**
 * Deduplicates saved foods based on name and nutritional values.
 * If duplicates exist, keeps the most recently used one and deletes others from Firebase.
 * NOTE: This is a utility function for one-time cleanup, not called during normal app initialization.
 */
// Note: editSavedFood, closeEditFoodModal, and confirmEditFood functions already exist below

// Helper function to check if Chart.js is loaded
function isChartJsReady() {
    return typeof Chart !== 'undefined';
}

// Chart.js loading configuration

// Date calculation constants
const NINETY_DAYS_IN_MS = 90 * 24 * 60 * 60 * 1000;

// Chart.js and its date adapter are roughly 260KB and are only needed on the
// Analytics and Progress tabs, so they are fetched the first time a chart is
// actually drawn rather than on every page load.
const CHARTJS_SOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
    'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js'
];
let chartJsPromise = null;

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') resolve();
            else {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', reject, { once: true });
            }
            return;
        }
        const el = document.createElement('script');
        el.src = src;
        el.async = false; // preserve order: the adapter needs Chart to exist
        el.addEventListener('load', () => { el.dataset.loaded = 'true'; resolve(); }, { once: true });
        el.addEventListener('error', () => reject(new Error('Failed to load ' + src)), { once: true });
        document.head.appendChild(el);
    });
}

function ensureChartJs() {
    if (isChartJsReady() && chartJsPromise === null) {
        chartJsPromise = Promise.resolve();
    }
    if (!chartJsPromise) {
        chartJsPromise = CHARTJS_SOURCES.reduce(
            (chain, src) => chain.then(() => loadScriptOnce(src)),
            Promise.resolve()
        ).catch(err => {
            chartJsPromise = null; // allow a retry the next time a tab is opened
            throw err;
        });
    }
    return chartJsPromise;
}

// Helper kept so existing call sites work unchanged; it now triggers the
// download instead of polling and hoping something else loaded it.
//
// Callers follow the shape `if (!isChartJsReady()) { waitForChartJs(self); return; }`,
// so the readiness re-check below is load-bearing: invoking the callback while
// Chart is still undefined sends it straight back here against an
// already-resolved promise, which spins the main thread forever. That happens
// whenever the CDN is unreachable or returns a body that registers no global,
// which is exactly the flaky-network case this needs to survive.
function waitForChartJs(callback) {
    ensureChartJs()
        .then(() => {
            if (!isChartJsReady()) {
                console.error('Chart.js loaded but registered no global; skipping this chart.');
                return;
            }
            try {
                callback();
            } catch (err) {
                console.error('Error executing Chart.js callback:', err);
            }
        })
        .catch(err => console.error('Chart.js failed to load:', err));
}

// Weight Functions
window.logWeight = async function () {
    const date = document.getElementById('weight-date-input').value;
    const weight = parseFloat(document.getElementById('weight-value-input').value);

    if (!date || !weight) {
        alert('Please enter both date and weight');
        return;
    }

    const weightData = { date, weight };

    try {
        const docRef = await addDoc(collection(db, "weight"), weightData);
        weightData.id = docRef.id;

        // Safety check: Initialize window.weightData if undefined
        if (!window.weightData) {
            window.weightData = [];
        }

        window.weightData.unshift(weightData);

        document.getElementById('weight-value-input').value = '';

        createWeightChart();
        updateBodyGoalDisplay();
        updateNutritionCalories();
        showToast('Weight logged.', 'success');
    } catch (e) {
        console.error("Error logging weight:", e);
        alert('Error logging weight');
    }
};

function createWeightChart() {
    const ctx = document.getElementById('weight-chart');
    if (!ctx) return;

    // Wait for Chart.js to load if deferred
    if (!isChartJsReady()) {
        waitForChartJs(createWeightChart);
        return;
    }

    if (charts.weight) charts.weight.destroy();

    const sortedWeights = [...weightData].sort((a, b) => new Date(a.date) - new Date(b.date));

    charts.weight = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedWeights.map(w => formatDateString(w.date)),
            datasets: [{
                label: 'Weight (lbs)',
                data: sortedWeights.map(w => w.weight),
                borderColor: '#4A5D4A',
                backgroundColor: 'rgba(74, 93, 74, 0.15)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Weight (lbs)' }
                }
            }
        }
    });
}

// Utility function to wipe all nutrition data (call from console: window.wipeNutritionData())
window.wipeNutritionData = async function () {
    if (!confirm('WARNING: This will delete ALL nutrition and food data from Firestore. This cannot be undone!\n\nAre you sure you want to continue?')) {
        return;
    }

    if (!confirm('Please confirm one more time: Delete ALL nutrition data?')) {
        return;
    }

    try {
        console.log('Starting data wipe...');
        let deletedCount = 0;

        // Delete all nutrition documents
        const nutritionQuery = query(collection(db, "nutrition"));
        const nutritionSnapshot = await getDocs(nutritionQuery);

        for (const document of nutritionSnapshot.docs) {
            await deleteDoc(doc(db, "nutrition", document.id));
            deletedCount++;
        }

        console.log(`Deleted ${deletedCount} nutrition documents`);

        // Delete all saved foods
        const savedFoodsQuery = query(collection(db, "savedFoods"));
        const savedFoodsSnapshot = await getDocs(savedFoodsQuery);
        let savedFoodsDeleted = 0;

        for (const document of savedFoodsSnapshot.docs) {
            await deleteDoc(doc(db, "savedFoods", document.id));
            savedFoodsDeleted++;
        }

        console.log(`Deleted ${savedFoodsDeleted} saved food documents`);

        // Clear local state
        nutritionData = [];
        window.nutritionData = [];
        savedFoods = [];
        window.savedFoods = [];

        // Refresh UI
        renderMeals();
        renderSavedFoods();

        alert(`Data wipe complete!\n\nDeleted:\n- ${deletedCount} nutrition entries\n- ${savedFoodsDeleted} saved foods`);
    } catch (e) {
        console.error("Error wiping data:", e);
        alert('Error wiping data: ' + e.message);
    }
};

// Tab loading flags for lazy loading
let nutritionLoaded = false;
let weightLoaded = false;
let analyticsLoaded = false;
let progressLoaded = false;

// Main app initialization function
// ---------------------------------------------------------------------------
// Fast boot
//
// Startup used to be a strict chain: download three Firebase modules, wait for
// an anonymous sign-in round trip, wait for the programs query, and only then
// attach a single tap handler. Every one of those steps is network-bound, so on
// a phone the whole interface sat dead for several seconds.
//
// Now the interface paints from a local cache and binds its handlers the moment
// the DOM is ready, and Firebase refreshes everything underneath when it lands.
// ---------------------------------------------------------------------------

const CACHE_KEYS = {
    programs: 'fcc:cache:programs:v1',
    workouts: 'fcc:cache:workouts:v1'
};
const WORKOUT_CACHE_LIMIT = 60;
let uiBooted = false;

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('Cache read failed:', key, e);
        return null;
    }
}

function writeCache(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // A full quota is not fatal, it only costs the next load its head start.
        console.warn('Cache write failed:', key, e);
    }
}

function refreshStartupCache() {
    if (Array.isArray(programs) && programs.length) {
        writeCache(CACHE_KEYS.programs, programs);
    }
    if (Array.isArray(rawWorkouts)) {
        writeCache(CACHE_KEYS.workouts, rawWorkouts.slice(0, WORKOUT_CACHE_LIMIT));
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('app-loading');
    if (overlay) overlay.style.display = 'none';
}

function bootUIFromCache() {
    if (uiBooted) return;
    uiBooted = true;

    currentNutritionDate = getTodayDateString();

    // Bound first, so taps do something even while Firebase is still in flight.
    setupEventListeners();
    initializeProgramNameInput();

    const cachedPrograms = readCache(CACHE_KEYS.programs);
    if (Array.isArray(cachedPrograms) && cachedPrograms.length) {
        programs = cachedPrograms;
        programs.forEach(migrateScheduleFormat);
        activeProgram = programs.find(p => p.active) || null;
    }

    const cachedRoutines = readCache(ROUTINE_CACHE_KEY);
    if (Array.isArray(cachedRoutines)) dailyRoutines = cachedRoutines;

    const cachedWorkouts = readCache(CACHE_KEYS.workouts);
    if (Array.isArray(cachedWorkouts)) {
        rawWorkouts = cachedWorkouts;
        applyProgramFilterToWorkouts();
    }

    try {
        renderWorkoutDaySelector();
        initializeWorkout();
        renderRoutineState();
        restoreWorkoutDraftIfAny();
        // Only drop the spinner once there is a real program to look at,
        // otherwise a first-time visitor would stare at an empty screen.
        if (activeProgram) {
            hideLoadingOverlay();
            console.log('UI painted from cache; refreshing from Firebase in the background');
        }
    } catch (e) {
        console.error('Cached render failed, waiting for network data:', e);
    }
}

async function initializeFitnessApp() {
    console.log('Initializing Fitness Command Center...');

    bootUIFromCache(); // no-op when the DOM-ready path already ran it

    // Programs and workouts are independent queries. Running them together
    // removes a full round trip from the critical path; the program filter is
    // re-applied afterwards so ordering no longer matters.
    const [programsResult, workoutsResult] = await Promise.allSettled([
        loadPrograms(),
        loadWorkoutsFromFirebase()
    ]);

    if (programsResult.status === 'rejected') {
        console.error('Failed to load programs:', programsResult.reason);
    }
    if (workoutsResult.status === 'rejected') {
        console.error('Failed to load workouts:', workoutsResult.reason);
    }

    applyProgramFilterToWorkouts();
    refreshStartupCache();

    // Today's generated session survives the refresh: rebuild its pill and, if
    // it was started, reopen the logger on it before anything renders.
    restoreGeneratedSession();

    // Typing during the Firebase round trip is already covered: the 400ms
    // debounce persists it, and initializeWorkout now always restores the
    // current day's draft. Flushing here instead parked the hydrated,
    // already-saved session as a draft and produced a false "you have unsaved
    // sets" warning on the next day-pill tap.
    renderWorkoutDaySelector();
    initializeWorkout();
    restoreWorkoutDraftIfAny(currentDay);
    hideLoadingOverlay();

    updateSuggestions();
    updateAnalytics();

    // Any session that failed to reach Firestore on a previous visit is
    // re-saved from its on-device backup. Deliberately after first paint.
    reconcileLocalBackups().catch(err => console.error('Backup reconcile failed:', err));

    console.log('Fitness Command Center initialized with fresh data.');

    // Weight used to load only when the Body tab was opened, but the calorie
    // target card lives on Nutrition and hides itself without weight data, so
    // on every fresh load the target was blank until you tabbed through Body.
    loadWeightData()
        .then(() => { updateBodyGoalDisplay(); updateNutritionCalories(); })
        .catch(err => console.error('Failed to load weight data:', err));
    loadBodyGoalData().catch(err => console.error('Failed to load body goal data:', err));
    loadTravelModeData()
        .then(() => {
            // updateTravelModeBanner() was only ever called from the two
            // functions that change travel state, never at boot. Since the
            // "End Travel Mode" button lives inside that banner, closing the
            // tab left travel mode permanently on with no way to turn it off.
            updateTravelModeBanner();
            renderCalendar();
        })
        .catch(err => console.error('Failed to load travel mode data:', err));
    loadSickDayData().catch(err => console.error('Failed to load sick day data:', err));
    // Fencing feeds both the week panel and the generator, so both are redrawn
    // once it lands rather than showing a week with fifteen hours missing.
    loadFencingData()
        .then(() => {
            renderFencingPanel(); renderWeeklyVolume(); renderTodayPanel();
            // Fencing days paint on the calendar, count in the discipline
            // score, and feed the calorie target's activity component - all of
            // which rendered before this load finished.
            renderCalendar();
            updateNutritionCalories();
        })
        .catch(err => console.error('Failed to load fencing data:', err));
    loadDailyRoutines().catch(err => console.error('Failed to load daily routines:', err));

    // Nutrition and weight data stay lazy until their tab is opened.
}

// Authentication state observer - refreshes the app with live data
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('User authenticated:', user.uid);

        // Initialize app after authentication
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeFitnessApp, { once: true });
        } else {
            initializeFitnessApp();
        }
    } else {
        // No user is signed in, sign in anonymously
        console.log('No user authenticated, signing in anonymously...');
        try {
            const result = await signInAnonymously(auth);
            console.log('Anonymous sign-in successful:', result.user.uid);
        } catch (error) {
            console.error('Error signing in anonymously:', error);
            
            // Hide loading overlay and show error
            const loadingOverlay = document.getElementById('app-loading');
            if (loadingOverlay) {
                loadingOverlay.innerHTML = `
                    <div style="color: var(--color-danger); font-weight: 500;">
                        Authentication Failed
                    </div>
                    <div style="font-size: 0.9rem; color: var(--color-text-secondary); margin-top: 0.5rem;">
                        ${error.message}
                    </div>
                    <button id="auth-retry-btn" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--color-accent-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Retry
                    </button>
                `;
                
                // Use addEventListener for consistency (inline onclick acceptable for error recovery)
                const retryBtn = document.getElementById('auth-retry-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => location.reload());
                }
            }
        }
    }
});

// Note: App initialization is handled by onAuthStateChanged above
// which ensures authentication completes before the app starts

window.setWorkoutDate = function () {
    const dateInput = document.getElementById('workout-date-input');
    const logBtn = document.getElementById('log-past-workout-btn');
    const today = getTodayDateString();

    if (dateInput.value && dateInput.value !== today) {
        logBtn.textContent = 'For ' + formatDateString(dateInput.value);
        logBtn.style.background = 'rgba(93, 138, 102, 0.15)';
        logBtn.style.color = '#5D8A66';
        logBtn.style.borderColor = '#A8B5A0';
    } else {
        logBtn.textContent = 'Log Past Workout';
        logBtn.style.background = 'rgba(168, 181, 160, 0.15)';
        logBtn.style.color = '#4A5D4A';
        logBtn.style.borderColor = '#A8B5A0';
    }
};

function setupEventListeners() {
    // Tab switching - showTab handles lazy loading
    document.getElementById('workout-tab-btn').addEventListener('click', () => {
        showTab('workout');
    });
    document.getElementById('calendar-tab-btn').addEventListener('click', () => {
        showTab('calendar');
        renderCalendar();
    });
    document.getElementById('nutrition-tab-btn').addEventListener('click', () => {
        showTab('nutrition');
        updateNutritionCalories();
    });
    document.getElementById('body-metrics-tab-btn').addEventListener('click', () => {
        showTab('body-metrics');
    });
    document.getElementById('analytics-tab-btn').addEventListener('click', () => {
        showTab('analytics');
    });
    document.getElementById('progress-tab-btn').addEventListener('click', () => {
        showTab('progress');
    });

    // Day selection - now handled by renderWorkoutDaySelector()
    // Event listeners are attached dynamically when buttons are rendered

    // Complete workout
    document.getElementById('complete-workout-btn').addEventListener('click', completeWorkout);

    // Initialize date input to today (timezone-aware)
    const today = getTodayDateString();
    document.getElementById('workout-date-input').value = today;

    // Date input handling
    document.getElementById('workout-date-input').addEventListener('change', () => {
        setWorkoutDate();
        // The form may still hold a session already saved for TODAY, with
        // editingWorkoutId set. Without rebuilding, picking a past date saved a
        // byte-for-byte copy of today's session under that date, silently
        // inflating volume, streak and adherence.
        editingWorkoutId = null;
        initializeWorkout();
    });
    document.getElementById('log-past-workout-btn').addEventListener('click', () => {
        const dateInput = document.getElementById('workout-date-input');
        if (dateInput.style.display === 'none' || !dateInput.style.display) {
            dateInput.style.display = 'block';
            dateInput.focus();
        }
    });

    // Intensity inputs
    setupIntensityInputs();

    setWorkoutDate(); // Initialize the button text

    // Calendar navigation
    document.getElementById('prev-month-btn').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month-btn').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // Nutrition date input
    const nutritionDateInput = document.getElementById('nutrition-date-input');
    nutritionDateInput.value = currentNutritionDate;
    nutritionDateInput.addEventListener('change', (e) => {
        currentNutritionDate = e.target.value;
        currentEditingMealId = null; // Clear meal context when changing dates
        renderMeals();
    });

    // Saved food search
    const savedFoodSearch = document.getElementById('saved-food-search');
    if (savedFoodSearch) {
        savedFoodSearch.addEventListener('input', (e) => {
            renderSavedFoods(e.target.value);
        });
    }

    // Mobile saved food search
    const savedFoodSearchMobile = document.getElementById('saved-food-search-mobile');
    if (savedFoodSearchMobile) {
        savedFoodSearchMobile.addEventListener('input', (e) => {
            renderSavedFoods(e.target.value);
        });
    }

    // Weight date input (timezone-aware)
    const weightDateInput = document.getElementById('weight-date-input');
    weightDateInput.value = getTodayDateString();

    // Goal start date input (timezone-aware)
    const goalStartDateInput = document.getElementById('goal-start-date-input');
    if (goalStartDateInput && !goalStartDateInput.value) {
        goalStartDateInput.value = getTodayDateString();
    }

    // Analytics dropdowns
    const exerciseSelector = document.getElementById('exercise-selector');
    if (exerciseSelector) {
        exerciseSelector.addEventListener('change', (e) => {
            createPRTimelineChart(e.target.value);
        });
    }

    const comparisonSelector = document.getElementById('comparison-selector');
    if (comparisonSelector) {
        comparisonSelector.addEventListener('change', (e) => {
            updateSessionComparison(e.target.value);
        });
    }
}

function setupIntensityInputs() {
    ['energy', 'motivation', 'fatigue', 'satisfaction'].forEach(type => {
        const scale = document.getElementById(`${type}-scale`);
        if (scale) {
            scale.addEventListener('click', (e) => {
                if (e.target.classList.contains('intensity-btn')) {
                    // Remove active class from siblings
                    scale.querySelectorAll('.intensity-btn').forEach(btn => btn.classList.remove('active'));

                    // Add active class to clicked button
                    e.target.classList.add('active');

                    // Update workout intensity
                    const value = parseInt(e.target.dataset.value);
                    if (['energy', 'motivation'].includes(type)) {
                        workoutIntensity.preWorkout[type] = value;
                    } else {
                        workoutIntensity.postWorkout[type] = value;
                    }
                }
            });
        }
    });
}

function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

    // Show selected tab
    document.getElementById(tabName + '-content').classList.add('active');
    document.getElementById(tabName + '-tab-btn').classList.add('active');

    // Lazy load data for tabs when first visited
    if (tabName === 'nutrition' && !nutritionLoaded) {
        nutritionLoaded = true;
        loadNutritionData()
            .then(() => renderMeals())
            .catch(err => {
                console.error('Failed to load nutrition data:', err);
                // Show user-friendly message
                const container = document.getElementById('meals-container');
                if (container) {
                    container.innerHTML = '<p style="color: var(--color-error); text-align: center; padding: 2rem;">Failed to load nutrition data. Please refresh the page.</p>';
                }
            });
        // Render empty state immediately, then load data in background
        renderSavedFoods();
        loadSavedFoods()
            .then(() => renderSavedFoods())
            .catch(err => console.error('Failed to load saved foods:', err));
    }

    if (tabName === 'body-metrics') {
        if (!weightLoaded) {
            weightLoaded = true;
            loadWeightData()
                .then(() => {
                    createWeightChart();
                    updateBodyGoalDisplay();
                })
                .catch(err => {
                    console.error('Failed to load weight data:', err);
                    const container = document.getElementById('weight-chart');
                    if (container && container.parentElement) {
                        container.parentElement.innerHTML = '<p style="color: var(--color-error); text-align: center; padding: 2rem;">Failed to load weight data. Please refresh the page.</p>';
                    }
                });
        }
    }

    if (tabName === 'analytics') {
        analyticsLoaded = true;
        updateAnalytics();   // cheap now, and stale numbers were worse than a re-render
    }

    if (tabName === 'progress' && !progressLoaded) {
        progressLoaded = true;
        updateProgress();
    }

}

// Render dynamic workout day selector based on active program schedule
function renderWorkoutDaySelector() {
    // The week panel sits directly above the pills and is driven by the same
    // data, so refreshing it here keeps the two in step on every path that
    // rebuilds the selector: boot, a completed session, a deleted one, a
    // program change.
    renderWeeklyVolume();
    renderTodayPanel();
    renderFencingPanel();

    const container = document.getElementById('workout-day-selector');
    if (!container) return;

    // The scheduled day pills are gone deliberately. A row of named days was a
    // daily assignment wearing a different hat - the queue picked one, marked
    // it active, and every glance at the row was a reminder of the plan not
    // being followed. The suggestion above is now the way in; what remains
    // here are the sessions the program defines but never schedules (the
    // Tournament Circuit, a just-generated session), which are genuinely a
    // menu rather than an obligation.
    const substitutes = getSubstituteWorkoutTypes();
    let html = '';
    substitutes.forEach((type) => {
        const key = substituteDayKeyFor(type);
        const isActive = currentDay === key;
        html += `<button class="day-btn day-btn-substitute ${isActive ? 'active' : ''}"
                         data-substitute="${escapeHtml(type)}"
                         >${escapeHtml(type)}</button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-substitute]').forEach(btn => {
        btn.addEventListener('click', () =>
            selectDay(substituteDayKeyFor(btn.getAttribute('data-substitute'))));
    });
}

function selectDay(dayKey) {
    // Tapping the pill that is already selected DESELECTS it. An accidental
    // tap on Tournament Circuit was otherwise a commitment: no unselect, no
    // way back to the empty logger, so the mis-tap became the day's session.
    // Anything already typed is parked in the draft and comes back if the same
    // pill is tapped again.
    if (dayKey === currentDay) {
        if (currentWorkoutHasData()) persistWorkoutDraft();
        currentDay = '';
        pendingDraftDay = null;
        renderWorkoutDaySelector();
        initializeWorkout();
        updateSuggestions();
        return;
    }

    // Tapping a day pill used to call initializeWorkout(), whose first line is
    // `currentWorkout = {}`. Four exercises into a session, a stray tap on the
    // horizontally scrolling pill row erased everything with no confirm and no
    // undo. Park the draft instead of destroying it.
    if (currentWorkoutHasData()) {
        persistWorkoutDraft();   // park this day's work before leaving it
        const ok = confirm('You have sets logged in this session. Switch days anyway? Your entries are saved and come back when you return to this day.');
        if (!ok) return;
    }

    currentDay = dayKey;
    pendingDraftDay = dayKey;   // initializeWorkout will restore this day's draft

    // Update day buttons
    document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('active'));
    
    // Substitute pills are matched by data attribute; they carry no id because
    // a workout type can contain characters an id cannot.
    if (isSubstituteDayKey(dayKey)) {
        const type = resolveWorkoutTypeForDayKey(dayKey);
        const subBtn = document.querySelector(`.day-btn[data-substitute="${CSS.escape(type)}"]`);
        if (subBtn) subBtn.classList.add('active');
    } else {
        // Construct button ID based on whether we're using default days or program schedule
        // Default days use lowercase IDs (Upper -> upper-btn), program days use as-is (day1 -> day1-btn)
        const buttonId = (activeProgram && activeProgram.schedule)
            ? dayKey + '-btn'                 // Program schedule: day1-btn, day2-btn, etc.
            : dayKey.toLowerCase() + '-btn';  // Default: upper-btn, lower-btn, etc.
        const activeBtn = document.getElementById(buttonId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    const workoutType = resolveWorkoutTypeForDayKey(dayKey);
    
    initializeWorkout(workoutType);
    updateSuggestions();
}

function initializeWorkout(workoutType = null) {
    currentWorkout = {};
    const workouts = getActiveWorkouts();
    
    // If no workoutType provided, try to get it from currentDay
    if (!workoutType) {
        workoutType = resolveWorkoutTypeForDayKey(currentDay);
    }
    
    const exercises = workouts[workoutType];
    
    // Handle case where workout type doesn't exist
    if (!exercises || !Array.isArray(exercises)) {
        console.warn(`No exercises found for workout type: ${workoutType} (day: ${currentDay})`);
        // Reset both here too. Falling out early used to leak pendingDraftDay
        // and a stale editingWorkoutId into the next rebuild.
        editingWorkoutId = null;
        pendingDraftDay = null;
        renderWorkout(workoutType);
        return;
    }

    exercises.forEach((exercise, index) => {
        const isStretch = exercise.name.toLowerCase().includes('stretch');
        const isRest = isRestDayType(workoutType);
        // isRest forced every exercise on the day to a checkbox. That is right
        // for a bare rest day, but a day named "Recovery" or "Off" that
        // actually CONTAINS exercises is real training, and forcing checkboxes
        // made those sessions unloggable and scored them as misses.
        const restDayWithoutExercises = isRest && exercises.length === 0;
        const trackingType = (isStretch || restDayWithoutExercises)
            ? 'checkoff'
            : getTrackingType(exercise, null);
        const setCount = trackingType === 'checkoff'
            ? 1
            : (typeof exercise.sets === 'number' && exercise.sets > 0 ? exercise.sets : 1);

        currentWorkout[index] = {
            exercise: exercise.name,
            trackingType,
            sets: Array(setCount).fill().map(() => blankSetForType(trackingType))
        };
    });

    // If this day already has a session logged TODAY, load it back in so the
    // form continues it rather than starting blank. Completing then UPDATES
    // that record instead of adding a second one. This is what makes a workout
    // split across the day work: log what you did this morning, come back this
    // evening, add the rest, save again.
    editingWorkoutId = null;
    // Key off the DATE IN THE PICKER, not today. Keying off today meant that
    // selecting a past date left today's already-saved sets on screen, and
    // saving wrote a byte-for-byte copy of them under that date.
    const dateInput = document.getElementById('workout-date-input');
    const targetDate = (dateInput && dateInput.value) ? dateInput.value : getTodayDateString();
    const savedToday = allWorkouts.find(w =>
        w.date === targetDate && normalizeLabel(w.day) === normalizeLabel(workoutType));

    if (savedToday && savedToday.exercises) {
        const savedByName = new Map();
        Object.values(savedToday.exercises).forEach(ex => {
            if (ex && ex.exercise) savedByName.set(normalizeLabel(ex.exercise), ex);
        });

        Object.values(currentWorkout).forEach(slot => {
            const match = savedByName.get(normalizeLabel(slot.exercise));
            if (match && Array.isArray(match.sets) && match.sets.length) {
                slot.sets = JSON.parse(JSON.stringify(match.sets));
                if (match.trackingType) slot.trackingType = match.trackingType;
                if (match.approach) slot.approach = match.approach;
                if (match.substitution) slot.substitution = match.substitution;
                if (Number.isInteger(match.skillLevel)) slot.skillLevel = match.skillLevel;
            }
        });

        editingWorkoutId = savedToday.id || null;
        if (savedToday.intensity) {
            workoutIntensity = {
                preWorkout: {
                    energy: savedToday.intensity.energy != null ? savedToday.intensity.energy : null,
                    motivation: savedToday.intensity.motivation != null ? savedToday.intensity.motivation : null
                },
                postWorkout: {
                    fatigue: savedToday.intensity.fatigue != null ? savedToday.intensity.fatigue : null,
                    satisfaction: savedToday.intensity.satisfaction != null ? savedToday.intensity.satisfaction : null
                }
            };
        }
    }

    // An unsaved draft is newer than anything on the server, so it always wins.
    // This runs on EVERY rebuild, not only after a day switch, because
    // initializeWorkout is also reached from deleting a session on the
    // Calendar, saving a program and activating one. Each of those used to
    // silently destroy whatever was being logged at the time.
    const draftDay = pendingDraftDay != null ? pendingDraftDay : currentDay;
    pendingDraftDay = null;
    // Drafts belong to today. Applying one while a past date is selected would
    // file today's in-progress work under the wrong day.
    const parked = (targetDate === getTodayDateString())
        ? readAllDrafts()[String(draftDay)]
        : null;
    if (parked && parked.workout) {
        currentWorkout = parked.workout;
        if (parked.intensity) workoutIntensity = parked.intensity;
    }

    renderWorkout(workoutType);
}
// ---------------------------------------------------------------------------
// In-progress session durability
//
// currentWorkout lived only in memory. Backgrounding Safari (which iOS does
// aggressively), reloading, or tapping a day pill mid-session destroyed the
// entire workout with no warning and no way back. A lifting session is 45+
// minutes of foreground use punctuated by rest periods, so this was the modal
// usage pattern, not an edge case.
// ---------------------------------------------------------------------------

// Time and duration sets carry only `seconds`/`minutes`, so a check limited to
// weight and reps read a session of holds or cardio as empty. That made those
// sessions unsavable and caused the draft system to delete them.
function setHasAnyValue(set) {
    if (!set) return false;
    if (set.completed === true) return true;
    return ['weight', 'reps', 'seconds', 'minutes', 'notes']
        .some(field => set[field] !== '' && set[field] != null);
}

const DRAFT_KEY = 'fcc:draft:v2';
let draftSaveTimer = null;
let pendingDraftDay = null;
// The id of an already-saved session the logger is editing, so a later save
// updates it rather than creating a duplicate for the same day.
let editingWorkoutId = null;

function currentWorkoutHasData() {
    return Object.values(currentWorkout || {}).some(ex =>
        (ex.sets || []).some(setHasAnyValue));
}

function readAllDrafts() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        // programId was stored but never checked, so a draft parked under one
        // program was loaded on top of a different program's day and saved as
        // that program's session, with exercises it does not contain.
        const currentProgramId = activeProgram ? activeProgram.id : null;
        if (parsed && parsed.programId !== undefined && parsed.programId !== currentProgramId) {
            localStorage.removeItem(DRAFT_KEY);
            return {};
        }
        if (!parsed || parsed.date !== getTodayDateString()) {
            // Only today's drafts. Yesterday's abandoned session should not
            // reappear on top of a fresh day.
            localStorage.removeItem(DRAFT_KEY);
            return {};
        }
        return parsed.days || {};
    } catch (e) {
        return {};
    }
}

function writeAllDrafts(days) {
    try {
        if (!days || Object.keys(days).length === 0) {
            localStorage.removeItem(DRAFT_KEY);
            return;
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            date: getTodayDateString(),
            programId: activeProgram ? activeProgram.id : null,
            days,
            savedAt: new Date().toISOString()
        }));
    } catch (e) {
        console.warn('Could not save workout draft:', e);
    }
}

// Drafts are keyed BY DAY. There used to be a single slot, so switching days
// left nothing to come back to even though the confirm promised otherwise, and
// worse, backgrounding the phone on the now-empty day deleted the previous
// day's work outright.
function persistWorkoutDraft() {
    const days = readAllDrafts();
    const key = String(currentDay);

    if (currentWorkoutHasData()) {
        days[key] = {
            day: currentDay,
            workoutDate: (document.getElementById('workout-date-input') || {}).value || getTodayDateString(),
            workout: currentWorkout,
            intensity: workoutIntensity
        };
    } else {
        delete days[key];   // only ever clears THIS day
    }

    writeAllDrafts(days);
}

function scheduleDraftSave() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(persistWorkoutDraft, 400);
}

function clearWorkoutDraft(dayKey) {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    const days = readAllDrafts();
    delete days[String(dayKey == null ? currentDay : dayKey)];
    writeAllDrafts(days);
}

function restoreWorkoutDraftIfAny(preferredDay) {
    const days = readAllDrafts();
    const keys = Object.keys(days);
    if (keys.length === 0) return false;

    const key = (preferredDay != null && days[String(preferredDay)]) ? String(preferredDay) : keys[0];
    const draft = days[key];
    if (!draft || !draft.workout) return false;

    currentDay = draft.day || currentDay;
    currentWorkout = draft.workout;
    if (draft.intensity) workoutIntensity = draft.intensity;

    // The date input is reset to today on every boot, so a restored past-dated
    // session used to be silently re-filed under today.
    const dateInput = document.getElementById('workout-date-input');
    if (dateInput && draft.workoutDate) dateInput.value = draft.workoutDate;

    renderWorkoutDaySelector();
    renderWorkout();
    showDraftRestoredBanner();
    return true;
}

function showDraftRestoredBanner() {
    let el = document.getElementById('draft-restored-banner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'draft-restored-banner';
        el.className = 'draft-banner';
        el.innerHTML = `<span>Picked up your in-progress session.</span>
            <button type="button" class="draft-banner-discard" onclick="discardWorkoutDraft()">Start fresh</button>`;
        const host = document.getElementById('workout-content');
        if (host) host.insertBefore(el, host.firstChild);
    }
    el.classList.add('visible');
}

window.discardWorkoutDraft = function () {
    clearWorkoutDraft(currentDay);
    initializeWorkout();
    const el = document.getElementById('draft-restored-banner');
    if (el) el.classList.remove('visible');
};

// iOS discards backgrounded tabs without firing unload, so pagehide and
// visibilitychange are the reliable moments to flush.
window.addEventListener('pagehide', persistWorkoutDraft);
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistWorkoutDraft();
});

// One definition of "this day was never a training day", used by the streak,
// the calendar and the discipline score. These three each had their own literal
// string comparison, so a program whose rest days were named "Off" scored a
// perfect month at 50% with every rest day painted red.
function isNonTrainingLabel(label) {
    const n = normalizeLabel(label);
    return n === 'travel' || n === 'sick' || isRestSlot(label);
}

function isRestDayType(workoutType) {
    return REST_SLOT_NAMES.includes(normalizeLabel(workoutType));
}

function renderWorkout(workoutType = null) {
    const container = document.getElementById('exercises-container');
    const workouts = getActiveWorkouts();
    
    // If no workoutType provided, try to get it from currentDay
    if (!workoutType) {
        workoutType = resolveWorkoutTypeForDayKey(currentDay);
    }
    
    const exercises = workouts[workoutType];
    
    // Handle case where workout type doesn't exist
    if (!exercises || !Array.isArray(exercises)) {
        container.innerHTML = `<p class="no-session-hint">No session loaded.<br>
            Tell the panel above how long you have and where you are,
            or pick a saved session.</p>`;
        return;
    }
    
    const exerciseProgression = getExerciseProgression();

    let html = '';

    // An empty exercise list used to fall straight through to
    // container.innerHTML = '' — a completely blank panel with no explanation.
    // This is the most literal reading of "the app doesn't work".
    // Make it obvious that what is on screen is an already-saved session, so
    // Complete Session reads as "update" rather than "log a second one".
    const continuationBanner = editingWorkoutId ? `
        <div class="draft-banner visible" style="margin-bottom:1rem;">
            <span>This session is already saved. Add to it and save again to update it.</span>
        </div>` : '';

    if (exercises.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-title">No exercises for this day yet</div>
                <div class="empty-state-body">
                    ${isRestDayType(workoutType)
                        ? 'This is a rest day. Nothing to log, and that counts as following the plan.'
                        : 'Open Settings, choose this program, and add exercises to this day.'}
                </div>
                ${isRestDayType(workoutType) ? '' :
                    '<button type="button" class="btn empty-state-action" onclick="openSettings()">Edit program</button>'}
            </div>`;
        return;
    }

    exercises.forEach((exercise, exerciseIndex) => {
        const workoutExercise = currentWorkout[exerciseIndex];
        if (!workoutExercise) {
            console.warn(`Exercise at index ${exerciseIndex} not initialized`);
            return; // Skip if not initialized
        }
        
        // Get last logged data for THIS exercise, matched by name and approach
        const currentApproach = workoutExercise.approach || 'standard';
        const previousMatch = findPreviousExercise(
            currentDay,
            exerciseIndex,
            getExerciseNameCandidates(workoutExercise, exercise.name),
            currentApproach,
            (workoutExercise.sets || []).length
        );
        const lastWorkout = previousMatch ? previousMatch.workout : null;
        const previousExercise = previousMatch ? previousMatch.exercise : null;

        const isStretch = exercise.name.toLowerCase().includes('stretch');
        const isRest = isRestDayType(workoutType);
        const restDayWithoutExercises = isRest && exercises.length === 0;
        const trackingType = (isStretch || restDayWithoutExercises)
            ? 'checkoff'
            : getTrackingType(exercise, workoutExercise);

        // The logged row carries the type it was recorded with. Reading old
        // history through today's type made every pre-existing "Plank" or
        // "Treadmill Walk" render as an empty Last session block.
        const previousTrackingType = (previousExercise && previousExercise.trackingType &&
            TRACKING_TYPES[previousExercise.trackingType])
            ? previousExercise.trackingType
            : trackingType;

        // Skill ladder state. Defaults to the level logged last session, so the
        // selector opens where you left off rather than back at level one.
        // The logged row carries the type it was recorded with. Reading old
        // history through today's type made every pre-existing "Plank" or
        // "Treadmill Walk" render as an empty Last session block, because the
        // formatter looked for seconds on a set that stored weight and reps.

        const skillProgression = getSkillProgression(exercise.name);
        let activeSkillLevel = 0;
        if (skillProgression) {
            const stored = Number.isInteger(workoutExercise.skillLevel)
                ? workoutExercise.skillLevel
                : (Number.isInteger(previousExercise?.skillLevel) ? previousExercise.skillLevel : 0);
            activeSkillLevel = Math.min(Math.max(stored, 0), skillProgression.levels.length - 1);
            workoutExercise.skillLevel = activeSkillLevel;
            workoutExercise.skillLevelName = skillProgression.levels[activeSkillLevel].name;
        }

        // Check if this is a stretch exercise or rest day

        // Calculate suggested weight and get progression info
        let suggestedWeight = '';
        let progressionInfo = '';

        // Skills and other bodyweight holds log 0 lbs, so the progression maths
        // would cheerfully suggest "Try 5lbs" for a front lever. Skip it.
        const isBodyweightSkill = Boolean(skillProgression) || trackingType !== 'weight_reps';

        if (!isStretch && !isRest && !isBodyweightSkill && previousExercise && previousExercise.sets.length > 0) {
            const prevSets = previousExercise.sets.filter(set => parseFloat(set.weight) > 0 && set.reps);
            if (prevSets.length > 0) {
                const avgWeight = prevSets.reduce((sum, set) => sum + parseFloat(set.weight), 0) / prevSets.length;
                const avgReps = prevSets.reduce((sum, set) => sum + parseInt(set.reps), 0) / prevSets.length;

                if (avgReps >= 10) {
                    suggestedWeight = Math.round(avgWeight + 5);
                } else if (avgReps >= 8) {
                    suggestedWeight = Math.round(avgWeight + 2.5);
                } else {
                    suggestedWeight = Math.round(avgWeight);
                }
            }
        }

        // Get progression information
        if (!isStretch && !isRest && exerciseProgression[exercise.name]) {
            const prog = exerciseProgression[exercise.name];
            if (prog.type === 'strength') {
                progressionInfo = `+${prog.progression.split('(+')[1]?.split(')')[0] || 'improved'}`;
            } else if (prog.type === 'volume') {
                progressionInfo = `+${prog.progression.split('(+')[1]?.split(')')[0] || 'reps'}`;
            }
        }

        // Get PR for this exercise
        const prs = getPersonalRecords();
        const exercisePR = (!isStretch && !isRest) ? prs[exercise.name] : null;

        html += `
                    <div class="exercise-card">
                        <div class="exercise-header">
                            <div>
                                <div class="exercise-name">
                                    ${workoutExercise.substitution ? `${workoutExercise.substitution} <span style="color: var(--color-text-secondary); font-weight: 400;">→ ${workoutExercise.originalExercise}</span>` : exercise.name}
                                    ${workoutExercise.approach && !workoutExercise.substitution ? `<span class="substitution-tag">${workoutExercise.approach}</span>` : ''}
                                </div>
                                <div class="exercise-target">${exercise.sets} × ${exercise.reps}</div>
                                ${progressionInfo ? `<div class="exercise-progress-indicator">${progressionInfo} last session</div>` : ''}
                                ${skillProgression ? `
                                    <div class="skill-selector">
                                        <div class="skill-selector-label">${skillProgression.label} level</div>
                                        <select class="skill-level-select" onchange="setSkillLevel(${exerciseIndex}, this.value)">
                                            ${skillProgression.levels.map((lvl, i) => `
                                                <option value="${i}" ${i === activeSkillLevel ? 'selected' : ''}>${i + 1}. ${lvl.name}</option>
                                            `).join('')}
                                        </select>
                                        <div class="skill-level-detail">
                                            <span class="skill-level-target">${skillProgression.levels[activeSkillLevel].target}</span>
                                            <span class="skill-level-cue">${skillProgression.levels[activeSkillLevel].cue}</span>
                                            <span class="skill-level-gate">Move up when: ${skillProgression.levels[activeSkillLevel].gate}</span>
                                        </div>
                                    </div>
                                ` : ''}
                                ${!isStretch && !isRest ? `
                                    <div class="approach-selector">
                                        <button class="approach-btn ${!workoutExercise.approach ? 'active' : ''}" onclick="setExerciseApproach(${exerciseIndex}, null)">Standard</button>
                                        <button class="approach-btn ${workoutExercise.approach === 'Heavy' ? 'active' : ''}" onclick="setExerciseApproach(${exerciseIndex}, 'Heavy')">Heavy</button>
                                        <button class="approach-btn ${workoutExercise.approach === 'Form Focus' ? 'active' : ''}" onclick="setExerciseApproach(${exerciseIndex}, 'Form Focus')">Form Focus</button>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="exercise-intelligence">
                                ${suggestedWeight ? `<div class="suggested-weight">Try ${suggestedWeight}lbs</div>` : ''}
                                ${exercisePR ? `<div class="pr-indicator">PR: ${exercisePR.weight}lbs × ${exercisePR.reps}</div>` : ''}
                            </div>
                        </div>

                        ${previousExercise && !isStretch && !isRest ? `
                            <div class="previous-session">
                                <div class="previous-header">Last session (${formatDateString(lastWorkout.date)})${previousExercise.approach ? ` - ${previousExercise.approach}` : ''}${previousExercise.skillLevelName ? ` - ${previousExercise.skillLevelName}` : ''}:</div>
                                <div class="previous-sets-compact">
                                    ${previousExercise.sets.map(set => {
            let setStr = formatSetForType(set, previousTrackingType);
            if (!setStr) return '';
            if (set.notes) setStr += ` (${escapeHtml(set.notes)})`;
            return setStr;
        }).filter(Boolean).join(', ')}
                                </div>
                            </div>
                        ` : ''}`;

        if (isStretch || (isRest && exercises.length === 0)) {
            const label = isRest ? 'Rest Day Complete' : exercise.name;
            html += `
                        <div class="stretch-row">
                            <div class="stretch-info">
                                <div class="set-number">✓</div>
                                <div class="stretch-label">${label}</div>
                            </div>
                            <input type="checkbox" class="stretch-checkbox" 
                                   ${workoutExercise.sets[0]?.completed ? 'checked' : ''}
                                   onchange="updateStretch(${exerciseIndex}, this.checked)">
                        </div>
                    `;
        } else {
            html += `<div class="set-input-grid">`;

            workoutExercise.sets.forEach((set, setIndex) => {
                const prevSet = previousExercise?.sets?.[setIndex];
                const prevLabel = formatSetForType(prevSet, previousTrackingType);
                const lastAndCopy = prevLabel ? `
                                    <span class="previous-set-label">last: ${escapeHtml(prevLabel)}</span>
                                    <button type="button" class="btn btn-copy" onclick="copyPrevious(${exerciseIndex}, ${setIndex})">Copy</button>
                                ` : '';

                let fields;
                if (trackingType === 'time') {
                    // Seconds per set, so 30 -> 45 on a hold reads as progress
                    // instead of being crammed into a reps box.
                    fields = `
                                <input type="number" inputmode="numeric" class="reps-input" placeholder="sec"
                                       aria-label="Seconds for set ${setIndex + 1}"
                                       value="${escapeHtml(set.seconds)}"
                                       oninput="updateSet(${exerciseIndex}, ${setIndex}, 'seconds', this.value)">
                                <span class="set-unit">sec</span>
                                <input type="text" class="notes-input" placeholder="notes"
                                       value="${escapeHtml(set.notes)}"
                                       oninput="updateSet(${exerciseIndex}, ${setIndex}, 'notes', this.value)">`;
                } else if (trackingType === 'duration') {
                    fields = `
                                <input type="number" inputmode="decimal" step="any" class="reps-input" placeholder="min"
                                       aria-label="Minutes for set ${setIndex + 1}"
                                       value="${escapeHtml(set.minutes)}"
                                       oninput="updateSet(${exerciseIndex}, ${setIndex}, 'minutes', this.value)">
                                <span class="set-unit">min</span>
                                <input type="text" class="notes-input" placeholder="incline, pace, notes"
                                       value="${escapeHtml(set.notes)}"
                                       oninput="updateSet(${exerciseIndex}, ${setIndex}, 'notes', this.value)">`;
                } else if (trackingType === 'reps') {
                    fields = `
                                <div class="reps-control-wrapper">
                                    <button type="button" class="reps-increment-btn" aria-label="One fewer rep"
                                            onclick="adjustReps(${exerciseIndex}, ${setIndex}, -1); event.stopPropagation();">&minus;</button>
                                    <input type="number" inputmode="numeric" class="reps-input" placeholder="reps"
                                           aria-label="Reps for set ${setIndex + 1}"
                                           value="${escapeHtml(set.reps)}"
                                           oninput="updateSet(${exerciseIndex}, ${setIndex}, 'reps', this.value)">
                                    <button type="button" class="reps-increment-btn" aria-label="One more rep"
                                            onclick="adjustReps(${exerciseIndex}, ${setIndex}, 1); event.stopPropagation();">+</button>
                                </div>
                                <span class="set-unit">reps</span>
                                <input type="text" class="notes-input" placeholder="notes"
                                       value="${escapeHtml(set.notes)}"
                                       oninput="updateSet(${exerciseIndex}, ${setIndex}, 'notes', this.value)">`;
                } else {
                    fields = `
                                <input type="number" inputmode="decimal" step="any" class="weight-input" placeholder="lbs"
                                       aria-label="Weight for set ${setIndex + 1}"
                                       value="${escapeHtml(set.weight)}"
                                       oninput="updateSet(${exerciseIndex}, ${setIndex}, 'weight', this.value)">
                                <span class="set-unit">&times;</span>
                                <div class="reps-control-wrapper">
                                    <button type="button" class="reps-increment-btn" aria-label="One fewer rep"
                                            onclick="adjustReps(${exerciseIndex}, ${setIndex}, -1); event.stopPropagation();">&minus;</button>
                                    <input type="number" inputmode="numeric" class="reps-input" placeholder="reps"
                                           aria-label="Reps for set ${setIndex + 1}"
                                           value="${escapeHtml(set.reps)}"
                                           oninput="updateSet(${exerciseIndex}, ${setIndex}, 'reps', this.value)">
                                    <button type="button" class="reps-increment-btn" aria-label="One more rep"
                                            onclick="adjustReps(${exerciseIndex}, ${setIndex}, 1); event.stopPropagation();">+</button>
                                </div>
                                <input type="text" class="notes-input" placeholder="notes"
                                       value="${escapeHtml(set.notes)}"
                                       oninput="updateSet(${exerciseIndex}, ${setIndex}, 'notes', this.value)">`;
                }

                html += `
                            <div class="set-row">
                                <div class="set-number">${setIndex + 1}</div>
                                ${fields}
                                ${lastAndCopy}
                                <button type="button" class="set-delete-btn" aria-label="Delete set ${setIndex + 1}"
                                        onclick="deleteSet(${exerciseIndex}, ${setIndex})">&times;</button>
                            </div>`;
            });

            html += `
                            </div>
                            <button type="button" class="btn btn-add" onclick="addSet(${exerciseIndex})" style="margin-top: 0.75rem;">+ Add Set</button>
                        `;
        }

        html += `</div>`;
    });

    container.innerHTML = continuationBanner + html;
}

// Make functions globally available
// Bound to `oninput`, not `onchange`, on purpose. `change` only fires when the
// field loses focus, so a number typed into the last box was still only in the
// DOM when the phone locked: pagehide wrote a draft without it and the value
// visibly on screen was gone on return. Writing through on every keystroke
// costs nothing here - this assigns and re-arms a debounce, it does not render.
window.updateSet = function (exerciseIndex, setIndex, field, value) {
    currentWorkout[exerciseIndex].sets[setIndex][field] = value;
    scheduleDraftSave();
};

window.deleteSet = function (exerciseIndex, setIndex) {
    if (confirm('Delete this set?')) {
        currentWorkout[exerciseIndex].sets.splice(setIndex, 1);
        renderWorkout();
    }
    scheduleDraftSave();
};

window.adjustReps = function (exerciseIndex, setIndex, delta) {
    const currentReps = parseInt(currentWorkout[exerciseIndex].sets[setIndex].reps) || 0;
    const newReps = Math.max(0, currentReps + delta);
    currentWorkout[exerciseIndex].sets[setIndex].reps = newReps.toString();
    renderWorkout();
    scheduleDraftSave();
};

window.addSet = function (exerciseIndex) {
    const type = currentWorkout[exerciseIndex].trackingType || 'weight_reps';
    currentWorkout[exerciseIndex].sets.push(blankSetForType(type));
    renderWorkout();
    scheduleDraftSave();
};

window.copyPrevious = function (exerciseIndex, setIndex) {
    const workoutExercise = currentWorkout[exerciseIndex];
    if (!workoutExercise || !workoutExercise.sets || !workoutExercise.sets[setIndex]) return;

    // Uses the identical lookup as renderWorkout, so the button always copies
    // exactly the numbers shown next to it.
    const currentApproach = workoutExercise.approach || 'standard';
    const previousMatch = findPreviousExercise(
        currentDay,
        exerciseIndex,
        getExerciseNameCandidates(workoutExercise, workoutExercise.exercise),
        currentApproach,
        (workoutExercise.sets || []).length
    );
    const previousSet = previousMatch?.exercise?.sets?.[setIndex];

    if (previousSet) {
        // Copy whichever fields this exercise's tracking type actually uses,
        // so a hold copies seconds and a walk copies minutes.
        const type = workoutExercise.trackingType || 'weight_reps';
        const sourceType = (previousMatch.exercise && previousMatch.exercise.trackingType) || type;
        if (sourceType !== type) {
            // The exercise was tracked differently last time, so copying would
            // move numbers between fields that do not mean the same thing.
            showToast('Last session was tracked differently, so there is nothing to copy.', 'warn');
            return;
        }
        const target = workoutExercise.sets[setIndex];
        const carry = (field) => {
            if (previousSet[field] != null && previousSet[field] !== '') target[field] = String(previousSet[field]);
        };

        if (type === 'time') carry('seconds');
        else if (type === 'duration') carry('minutes');
        else if (type === 'reps') carry('reps');
        else { carry('weight'); carry('reps'); }

        scheduleDraftSave();
        renderWorkout();
    }
    scheduleDraftSave();
};

window.updateStretch = function (exerciseIndex, completed) {
    currentWorkout[exerciseIndex].sets[0] = { completed: completed };
    scheduleDraftSave();
};

window.setSkillLevel = function (exerciseIndex, levelIndex) {
    const workoutExercise = currentWorkout[exerciseIndex];
    if (!workoutExercise) return;

    const progression = getSkillProgression(workoutExercise.exercise);
    if (!progression) return;

    const index = Math.min(Math.max(parseInt(levelIndex, 10) || 0, 0), progression.levels.length - 1);
    workoutExercise.skillLevel = index;
    workoutExercise.skillLevelName = progression.levels[index].name;
    renderWorkout();
};

window.setExerciseApproach = function (exerciseIndex, approach) {
    currentWorkout[exerciseIndex].approach = approach;
    renderWorkout();
};

// ---------------------------------------------------------------------------
// Completing a session.
//
// With Firestore offline persistence enabled, a write promise settles on SERVER
// ACK, not locally. In a basement gym `await saveWorkoutToFirebase(...)` never
// resolved and never rejected, so the success alert, the catch, and the state
// reset were all unreachable. The button showed no spinner and was never
// disabled, so every impatient tap queued another document, and when signal
// returned the history filled with duplicate sessions that could not be
// deleted. That turned "bad signal" into permanent log corruption at the exact
// moment the app exists for.
//
// The write is now treated as succeeded once it is in the local cache, with a
// timeout that reports "saved on this device" rather than hanging.
// ---------------------------------------------------------------------------
let completeWorkoutInFlight = false;

async function completeWorkout() {
    if (completeWorkoutInFlight) return;

    const dateInput = document.getElementById('workout-date-input');
    const today = getTodayDateString();
    const selectedDate = dateInput.value && dateInput.value !== today ? dateInput.value : today;

    // An all-blank logger used to save happily, so an accidental tap created a
    // phantom session that counted toward the streak and the discipline score.
    if (!currentWorkoutHasData()) {
        showToast('Nothing logged yet. Enter at least one set first.', 'warn');
        return;
    }

    // Saves under the workout TYPE, so a substitute session is stored as
    // "Tournament Circuit" and the queue sees a session it has no slot for.
    const resolvedDay = resolveWorkoutTypeForDayKey(currentDay);

    // The form may be a continuation of a session already saved today, which is
    // the normal case when the workout is split across the day. Update that
    // record rather than writing a duplicate.
    const existing = allWorkouts.find(w =>
        w.date === selectedDate && normalizeLabel(w.day) === normalizeLabel(resolvedDay));

    let updateExistingId = null;
    if (existing) {
        if (editingWorkoutId && existing.id === editingWorkoutId) {
            updateExistingId = existing.id;
        } else {
            const ok = confirm(`A ${resolvedDay} session is already logged for ${selectedDate}. Update that session with what is on screen?`);
            if (!ok) return;
            updateExistingId = existing.id || null;
        }
    }

    const workoutData = {
        date: selectedDate,
        day: resolvedDay,
        exercises: currentWorkout,
        intensity: {
            energy: workoutIntensity.preWorkout.energy,
            motivation: workoutIntensity.preWorkout.motivation,
            fatigue: workoutIntensity.postWorkout.fatigue,
            satisfaction: workoutIntensity.postWorkout.satisfaction
        },
        programId: activeProgram ? activeProgram.id : null
    };

    completeWorkoutInFlight = true;
    const btn = document.getElementById('complete-workout-btn');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    // Local backup first, so the session survives even if everything else fails.
    try {
        const localHistory = JSON.parse(localStorage.getItem('fitnessData') || '{}');
        localHistory[resolvedDay + '-' + selectedDate + '-' + Date.now()] = workoutData;
        localStorage.setItem('fitnessData', JSON.stringify(localHistory));
    } catch (e) {
        console.warn('Local backup failed:', e);
    }

    const savePromise = updateExistingId
        ? updateDoc(doc(db, "workouts", updateExistingId), workoutData)
        : saveWorkoutToFirebase(workoutData);
    const timedOut = Symbol('timeout');
    const outcome = await Promise.race([
        savePromise.then(() => 'saved').catch(err => { console.error(err); return 'failed'; }),
        new Promise(resolve => setTimeout(() => resolve(timedOut), 4000))
    ]);

    if (outcome === 'failed') {
        showToast('Could not save. Your session is still here, so try again in a moment.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
        completeWorkoutInFlight = false;
        return;
    }

    if (outcome === timedOut) {
        showToast('Saved on this device. It will sync when you have signal.', 'info');
        // Keep syncing in the background and reconcile when it lands.
        savePromise
            .then(() => loadWorkoutsFromFirebase().then(() => { refreshStartupCache(); updateAnalytics(); }))
            .catch(err => console.error('Background sync failed:', err));
    } else {
        showToast(updateExistingId ? 'Session updated.' : 'Session saved.', 'success');
        try {
            await loadWorkoutsFromFirebase();
            refreshStartupCache();
        } catch (e) {
            console.error('Reload after save failed:', e);
        }
    }

    clearWorkoutDraft(currentDay);

    workoutIntensity = {
        preWorkout: { energy: null, motivation: null },
        postWorkout: { fatigue: null, satisfaction: null }
    };
    document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('active'));

    // currentDay stays where it is: the session just completed re-hydrates
    // into the form, so more sets added tonight join it instead of starting
    // over on whatever a queue would have owed.
    renderWorkoutDaySelector();
    initializeWorkout();
    updateSuggestions();

    if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
    completeWorkoutInFlight = false;
}

// ---------------------------------------------------------------------------
// One non-blocking toast, replacing roughly 80 native alert() dialogs on
// routine success paths. Native dialogs on every save trained the user to
// dismiss reflexively, which is exactly what made the genuinely destructive
// confirms ineffective.
// ---------------------------------------------------------------------------
function showToast(message, tone = 'info') {
    let el = document.getElementById('app-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'app-toast';
        el.className = 'app-toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.dataset.tone = tone;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 3000);
}
window.showToast = showToast;

// ---------------------------------------------------------------------------
// Boot trigger. This MUST stay at the bottom of the file: bootUIFromCache()
// calls setupEventListeners(), which references handlers assigned further up as
// `window.foo = function ...` expressions. Module scripts are deferred, so when
// app.js is fetched over the network document.readyState is often already past
// 'loading', and calling boot mid-module would run before those assignments.
// ---------------------------------------------------------------------------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootUIFromCache, { once: true });
} else {
    bootUIFromCache();
}
