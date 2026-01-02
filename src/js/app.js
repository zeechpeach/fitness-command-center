// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, limit, deleteDoc, doc, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Global state
let currentDay = 'Upper';
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
let currentNutritionDate = new Date().toISOString().split('T')[0];
let currentEditingMealId = null; // Track which meal is currently being edited
let weightData = [];
window.weightData = weightData;
let photoData = [];
let programs = [];
let activeProgram = null;
window.programs = programs;
window.activeProgram = activeProgram;
window.photoData = photoData;
let savedFoods = [];
let travelModeData = [];
window.travelModeData = travelModeData;
let sickDayData = [];
window.sickDayData = sickDayData;
window.savedFoods = savedFoods;
let bodyGoalData = null;
window.bodyGoalData = bodyGoalData;
let alternativeExerciseHistory = {}; // Store alternative exercise history by original exercise name
let currentAltExerciseIndex = null; // Track which exercise is being edited

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
        allWorkouts = workouts;
        console.log("Loaded workouts:", workouts.length);
        return workouts;
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
            allWorkouts = workouts;
            console.log("Loaded workouts (fallback):", workouts.length);
            return workouts;
        } catch (fallbackError) {
            console.error("Fallback query also failed:", fallbackError);
            return [];
        }
    }
}

async function loadNutritionData() {
    try {
        const q = query(collection(db, "nutrition"), orderBy("date", "desc"), limit(30));
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

async function loadPhotoData() {
    try {
        const q = query(collection(db, "photos"), orderBy("date", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        const photos = [];
        querySnapshot.forEach((doc) => {
            photos.push({ id: doc.id, ...doc.data() });
        });
        photoData = photos;
        window.photoData = photos;
        console.log("Loaded photo data:", photos.length);
        return photos;
    } catch (e) {
        console.error("Error loading photos:", e);
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

function calculateMaintenanceCalories(weight) {
    return Math.round(weight * 14.5);
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

function calculate7DayMovingAverage(weightHistory) {
    if (!weightHistory || weightHistory.length === 0) return null;

    // Sort by date descending
    const sorted = [...weightHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Take last 7 entries (or fewer if less than 7 available)
    const last7 = sorted.slice(0, Math.min(7, sorted.length));

    // Calculate average
    const sum = last7.reduce((acc, w) => acc + w.weight, 0);
    return sum / last7.length;
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

    const startDate = new Date(goalStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (weeksToGoal * 7));

    return endDate.toISOString().split('T')[0];
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
    } else if (bodyGoal === 'cutting') {
        if (movingAverage <= currentWeight) {
            return { isOnTrack: true, message: 'On Track (trending downward)' };
        } else {
            return { isOnTrack: false, message: 'Off Track (not trending downward)' };
        }
    } else if (bodyGoal === 'bulking') {
        if (movingAverage >= currentWeight) {
            return { isOnTrack: true, message: 'On Track (trending upward)' };
        } else {
            return { isOnTrack: false, message: 'Off Track (not trending upward)' };
        }
    }

    return { isOnTrack: false, message: 'Unable to determine progress' };
}

function updateBodyGoalDisplay() {
    if (!bodyGoalData || !bodyGoalData.bodyGoal) {
        document.getElementById('goal-display-container').style.display = 'none';
        return;
    }

    document.getElementById('goal-display-container').style.display = 'block';

    // Get current weight (most recent)
    const currentWeight = weightData && weightData.length > 0 ? weightData[0].weight : null;

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

function updateNutritionCalories() {
    if (!bodyGoalData || !bodyGoalData.bodyGoal) {
        document.getElementById('calorie-target-card').style.display = 'none';
        return;
    }

    // Get current weight (most recent)
    const currentWeight = weightData && weightData.length > 0 ? weightData[0].weight : null;

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

    // Calculate remaining calories
    const totalCalories = calculateTotalCalories();
    const remaining = targetCalories - totalCalories;
    document.getElementById('calories-remaining').textContent = remaining;

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

// Workout Schedule Cycle: upper/lower/rest/push/pull/legs/rest
// Workout cycle: 7-day repeating cycle
const workoutSchedule = ['Upper', 'Lower', 'Rest', 'Push', 'Pull', 'Legs', 'Rest'];

// Reference date for schedule calculation when no completed workouts exist
// 2025-01-01 maps to workoutSchedule[0] = 'Upper'
const SCHEDULE_REFERENCE_DATE = '2025-01-01';

// Configuration for schedule calculation
const MIN_SCHEDULE_DAYS = 14; // Minimum days to schedule ahead for missed workout queue
const FUTURE_SCHEDULE_BUFFER = 7; // Additional days beyond missed workouts to schedule

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

function getCurrentHour() {
    // Get current hour in user's timezone (0-23)
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        timeZone: userTimezone,
        hour: 'numeric',
        hour12: false
    });
    return parseInt(timeString);
}

function getDefaultMealType() {
    // Determine meal type based on current time in user's timezone
    // Before 11am = Breakfast
    // 11am-2pm = Lunch
    // 2pm-5pm = Snack
    // After 5pm = Dinner
    const hour = getCurrentHour();
    if (hour < 11) return 'Breakfast';
    if (hour < 14) return 'Lunch';
    if (hour < 17) return 'Snack';
    return 'Dinner';
}

// ============================================
// PROGRAM BUILDER FUNCTIONS
// ============================================

// Settings Modal Functions
window.openSettings = function () {
    document.getElementById('settings-modal').classList.add('active');
    renderPrograms();
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
            programs.push({ id: doc.id, ...doc.data() });
        });

        console.log(`Loaded ${programs.length} programs`);

        // Find active program
        activeProgram = programs.find(p => p.active) || null;

        // If no programs exist, migrate hardcoded program
        if (programs.length === 0) {
            await migrateHardcodedProgram();
        }

        return programs;
    } catch (e) {
        console.error("Error loading programs:", e);
        return [];
    }
}

// Migrate hardcoded workoutPlans to new program structure
async function migrateHardcodedProgram() {
    console.log('Migrating hardcoded ULPPL program...');

    const ulpplProgram = {
        name: "ULPPL",
        active: true,
        createdAt: new Date().toISOString(),
        schedule: {
            day1: "Upper",
            day2: "Lower",
            day3: "Rest",
            day4: "Push",
            day5: "Pull",
            day6: "Legs",
            day7: "Rest"
        },
        workouts: {
            Upper: workoutPlans.Upper,
            Lower: workoutPlans.Lower,
            Rest: workoutPlans.Rest,
            Push: workoutPlans.Push,
            Pull: workoutPlans.Pull,
            Legs: workoutPlans.Legs
        }
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
                const workout = program.schedule[key];
                const abbrev = workout === 'Rest' ? 'R' : workout[0];
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
            const docRef = doc(db, "programs", programId);
            await updateDoc(docRef, { active: true });
            activeProgram = program;

            alert(`${program.name} is now your active program!`);
            renderPrograms();

            // Refresh workout view if on workout tab
            initializeWorkout();
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
        // Create new program with default structure
        currentEditingProgram = {
            id: null, // Will be set when saved
            name: 'New Program',
            active: false,
            createdAt: new Date().toISOString(),
            schedule: {
                day1: 'Rest',
                day2: 'Rest',
                day3: 'Rest',
                day4: 'Rest',
                day5: 'Rest',
                day6: 'Rest',
                day7: 'Rest'
            },
            workouts: {
                Rest: [{ name: 'Rest Day Recovery', sets: 1, reps: 'Complete' }]
            }
        };
    }

    // Close settings modal, open editor
    closeSettings();
    renderProgramEditor();
    document.getElementById('program-editor-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

// Close program editor
window.closeProgramEditor = function () {
    if (unsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
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
window.toggleProgramNameEdit = function () {
    const nameInput = document.getElementById('program-name-input');
    nameInput.disabled = !nameInput.disabled;
    if (!nameInput.disabled) {
        nameInput.focus();
        nameInput.select();
    }
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
        alert(`Cycle length must be between ${MIN_CYCLE_LENGTH} and ${MAX_CYCLE_LENGTH} days`);
        return;
    }

    if (delta > 0) {
        // Add new day
        schedule[`day${newLength}`] = 'Rest';
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
    for (let i = 1; i <= length; i++) {
        const dayKey = `day${i}`;
        const workoutType = schedule[dayKey] || 'Rest';
        html += `
                    <div class="schedule-pill" onclick="selectWorkoutForDay(${i})">
                        <span class="schedule-pill-day">Day ${i}</span>
                        <span class="schedule-pill-workout">${workoutType}</span>
                    </div>
                `;
    }

    container.innerHTML = html;
}

// Select workout type for a specific day
window.selectWorkoutForDay = function (dayNumber) {
    const workoutTypes = ['Rest', 'Upper', 'Lower', 'Push', 'Pull', 'Legs'];
    const currentType = currentEditingProgram.schedule[`day${dayNumber}`];
    const currentIndex = workoutTypes.indexOf(currentType);

    // Cycle to next workout type
    const nextIndex = (currentIndex + 1) % workoutTypes.length;
    updateDayWorkout(dayNumber, workoutTypes[nextIndex]);
};

// Update workout type for a day
function updateDayWorkout(dayNumber, workoutType) {
    if (!currentEditingProgram) return;

    currentEditingProgram.schedule[`day${dayNumber}`] = workoutType;

    // Initialize workout if it doesn't exist
    if (!currentEditingProgram.workouts[workoutType]) {
        if (workoutType === 'Rest') {
            currentEditingProgram.workouts[workoutType] = [
                { name: 'Rest Day Recovery', sets: 1, reps: 'Complete' }
            ];
        } else {
            currentEditingProgram.workouts[workoutType] = [];
        }
    }

    markUnsavedChanges();
    renderSchedulePills();
    renderWorkoutsAccordion();
}

// Render workouts accordion
function renderWorkoutsAccordion() {
    if (!currentEditingProgram) return;

    const container = document.getElementById('workouts-accordion');
    const workouts = currentEditingProgram.workouts;

    // Get unique workout types from schedule
    const workoutTypesInSchedule = new Set(Object.values(currentEditingProgram.schedule));

    let html = '';
    workoutTypesInSchedule.forEach(workoutType => {
        const exercises = workouts[workoutType] || [];
        const exerciseCount = exercises.length;

        html += `
                    <div class="workout-accordion" id="accordion-${workoutType}">
                        <div class="workout-accordion-header" onclick="toggleWorkoutAccordion('${workoutType}')">
                            <div class="workout-accordion-title">
                                <span class="workout-accordion-name">${workoutType}</span>
                                <span class="workout-accordion-badge">${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}</span>
                            </div>
                            <span class="workout-accordion-toggle">▼</span>
                        </div>
                        <div class="workout-accordion-content">
                            <div class="workout-accordion-body">
                                ${renderExercisesList(workoutType, exercises)}
                                <button class="add-exercise-btn" onclick="openAddExercisePanel('${workoutType}')">
                                    + Add Exercise
                                </button>
                            </div>
                        </div>
                    </div>
                `;
    });

    container.innerHTML = html;
}

// Render exercises list for a workout
function renderExercisesList(workoutType, exercises) {
    if (!exercises || exercises.length === 0) {
        return '<p style="color: var(--color-text-secondary); padding: 1rem 0;">No exercises yet. Add your first exercise!</p>';
    }

    return exercises.map((exercise, index) => `
                <div class="exercise-row">
                    <span class="exercise-drag-handle">⋮⋮</span>
                    <div class="exercise-info">
                        <div class="exercise-name">${exercise.name}</div>
                        <div class="exercise-details">${exercise.sets} × ${exercise.reps}</div>
                    </div>
                    <div class="exercise-actions">
                        ${index > 0 ? `<button class="exercise-move-btn" onclick="moveExercise('${workoutType}', ${index}, -1)" title="Move up">↑</button>` : ''}
                        ${index < exercises.length - 1 ? `<button class="exercise-move-btn" onclick="moveExercise('${workoutType}', ${index}, 1)" title="Move down">↓</button>` : ''}
                        <button class="exercise-edit-btn" onclick="openEditExercisePanel('${workoutType}', ${index})" title="Edit">✏️</button>
                        <button class="exercise-delete-btn" onclick="removeExercise('${workoutType}', ${index})" title="Delete">🗑</button>
                    </div>
                </div>
            `).join('');
}

// Toggle workout accordion
window.toggleWorkoutAccordion = function (workoutType) {
    const accordion = document.getElementById(`accordion-${workoutType}`);
    if (accordion) {
        accordion.classList.toggle('expanded');
    }
};

// Open add exercise panel
window.openAddExercisePanel = function (workoutType) {
    currentExercisePanelContext = { workoutType, exerciseIndex: null };

    // Clear form
    document.getElementById('exercise-name-input').value = '';
    document.getElementById('exercise-sets-input').value = '';
    document.getElementById('exercise-reps-input').value = '';
    document.getElementById('exercise-notes-input').value = '';

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
    document.getElementById('exercise-name-input').value = exercise.name;
    document.getElementById('exercise-sets-input').value = exercise.sets;
    document.getElementById('exercise-reps-input').value = exercise.reps;
    document.getElementById('exercise-notes-input').value = exercise.notes || '';

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
        alert('Exercise name is required');
        return;
    }
    if (!sets || sets < 1) {
        alert('Sets must be at least 1');
        return;
    }
    if (sets > MAX_EXERCISE_SETS) {
        alert(`Sets cannot exceed ${MAX_EXERCISE_SETS}`);
        return;
    }
    if (!reps) {
        alert('Reps is required');
        return;
    }
    // Validate reps: allow text like "8-12", "AMRAP", etc.
    // Only validate if it's a pure number (not a range or text)
    const repsNum = parseFloat(reps);
    if (!isNaN(repsNum) && reps.trim() === repsNum.toString()) {
        // Pure numeric value - validate against max
        if (repsNum > MAX_EXERCISE_REPS) {
            alert(`Numeric reps cannot exceed ${MAX_EXERCISE_REPS}`);
            return;
        }
    }

    // Create exercise object
    const exercise = { name, sets: parseInt(sets), reps };
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
async function saveProgramToFirestore() {
    if (!currentEditingProgram) return;

    try {
        // Validate program
        if (!currentEditingProgram.name || currentEditingProgram.name.trim() === '') {
            alert('Program name is required. Please enter a program name.');
            return;
        }

        // Prepare data
        const programData = {
            name: currentEditingProgram.name,
            active: currentEditingProgram.active,
            schedule: currentEditingProgram.schedule,
            workouts: currentEditingProgram.workouts,
            createdAt: currentEditingProgram.createdAt
        };

        if (currentEditingProgram.id) {
            // Update existing program
            const docRef = doc(db, "programs", currentEditingProgram.id);
            await updateDoc(docRef, programData);

            // Update in local array
            const index = programs.findIndex(p => p.id === currentEditingProgram.id);
            if (index !== -1) {
                programs[index] = { ...currentEditingProgram };
                if (currentEditingProgram.active) {
                    activeProgram = programs[index];
                }
            }
        } else {
            // Create new program
            const docRef = await addDoc(collection(db, "programs"), programData);
            currentEditingProgram.id = docRef.id;
            const newProgram = { ...currentEditingProgram };
            programs.push(newProgram);
        }

        unsavedChanges = false;
        showSaveIndicator();
        console.log('Program saved successfully');

    } catch (e) {
        console.error("Error saving program:", e);
        alert('Error saving program. Please try again.');
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
function getWouldBeScheduledWorkout(date) {
    const queryDate = new Date(date + 'T00:00:00.000Z');
    const actualWorkout = getWorkoutForDate(date);

    // If there's an actual workout on this date, return its type
    if (actualWorkout) {
        return actualWorkout.day;
    }

    // Calculate what workout would be here if we ignored travel/sick days
    const todayStr = getTodayDateString();
    const todayDate = new Date(todayStr + 'T00:00:00.000Z');

    // Find the most recent completed NON-REST workout (excluding rest days only)
    const completedWorkouts = allWorkouts
        .filter(w => w.day !== 'Rest')
        .sort((a, b) => new Date(b.date + 'T00:00:00.000Z') - new Date(a.date + 'T00:00:00.000Z'));

    if (completedWorkouts.length > 0) {
        const mostRecent = completedWorkouts[0];
        const mostRecentDate = new Date(mostRecent.date + 'T00:00:00.000Z');
        const mostRecentType = mostRecent.day;

        // Find the index of the most recent workout type in the schedule
        const lastIndex = workoutSchedule.indexOf(mostRecentType);

        // Count all days (including travel/sick) from most recent to query date
        let daysSince = 0;
        let d = new Date(mostRecentDate);
        while (d < queryDate) {
            daysSince++;
            d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
        }

        // Project forward in the 7-day cycle
        const scheduleIndex = (lastIndex + daysSince) % workoutSchedule.length;
        return workoutSchedule[scheduleIndex];
    } else {
        // No workouts yet, use default schedule from reference date
        const referenceDate = new Date(SCHEDULE_REFERENCE_DATE + 'T00:00:00.000Z');
        let allDays = 0;
        let d = new Date(referenceDate);
        while (d < queryDate) {
            allDays++;
            d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
        }
        const scheduleIndex = ((allDays % workoutSchedule.length) + workoutSchedule.length) % workoutSchedule.length;
        return workoutSchedule[scheduleIndex];
    }
}

// Helper function: Calculate calendar days between two dates (whole days)
// Returns positive number if date2 is after date1, negative if before
function daysBetween(date1Str, date2Str) {
    const d1 = new Date(date1Str + 'T00:00:00.000Z');
    const d2 = new Date(date2Str + 'T00:00:00.000Z');
    const diffMs = d2.getTime() - d1.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return diffDays;
}

// Helper function: Find the most recent completed non-Rest workout before (or on) a target date
// Returns { date: string, day: string } or null if none found
function getMostRecentCompletedNonRestWorkoutBefore(targetDateStr) {
    const targetDate = new Date(targetDateStr + 'T00:00:00.000Z');

    // Filter to non-Rest workouts that are on or before the target date
    const eligibleWorkouts = allWorkouts
        .filter(w => {
            if (w.day === 'Rest') return false;
            const workoutDate = new Date(w.date + 'T00:00:00.000Z');
            return workoutDate <= targetDate;
        })
        .sort((a, b) => {
            const dateA = new Date(a.date + 'T00:00:00.000Z');
            const dateB = new Date(b.date + 'T00:00:00.000Z');
            return dateB.getTime() - dateA.getTime(); // Most recent first
        });

    if (eligibleWorkouts.length > 0) {
        return {
            date: eligibleWorkouts[0].date,
            day: eligibleWorkouts[0].day
        };
    }
    return null;
}

function getScheduledWorkout(date) {
    const actualWorkout = getWorkoutForDate(date);

    // If there's an actual workout on this date, return its type (HIGHEST PRIORITY)
    // A logged workout overrides sick/travel markers because actual workout data
    // is authoritative - users want logged workouts to count toward their progress
    // even if the date was originally marked as sick or travel
    if (actualWorkout) {
        return actualWorkout.day;
    }

    // Check if date is a sick day
    if (isDateSickDay(date)) {
        return 'Sick';
    }

    // Check if date is in travel mode - show scheduled workout but don't penalize if missed
    if (isDateInTravelMode(date)) {
        return 'Travel';
    }

    // Calendar-day-based advancement approach:
    // Find the most recent completed non-Rest workout, then advance through the 7-day cycle
    // by counting calendar days (not skipping Rest/Sick/Travel)

    const lastCompleted = getMostRecentCompletedNonRestWorkoutBefore(date);

    if (lastCompleted) {
        // We have a most recent completed non-Rest workout
        // Calculate calendar days between lastCompleted.date and the target date
        const daysDiff = daysBetween(lastCompleted.date, date);

        // Find the index of the last completed workout in the schedule
        const lastCompletedIndex = workoutSchedule.indexOf(lastCompleted.day);

        // Advance by daysDiff positions in the 7-day cycle
        const scheduleIndex = (lastCompletedIndex + daysDiff) % workoutSchedule.length;
        return workoutSchedule[scheduleIndex];
    } else {
        // No completed non-Rest workouts found
        // Fall back to deterministic reference date (defined at top of file)
        const daysDiff = daysBetween(SCHEDULE_REFERENCE_DATE, date);

        // Handle negative modulo safely
        const scheduleIndex = ((daysDiff % workoutSchedule.length) + workoutSchedule.length) % workoutSchedule.length;
        return workoutSchedule[scheduleIndex];
    }
}

function getWorkoutForDate(dateString) {
    const workout = allWorkouts.find(w => w.date === dateString);
    if (workout) {
        console.log(`Found workout for ${dateString}: type="${workout.day}", hasExercises=${!!workout.exercises}`);
    }
    return workout;
}

function calculateAdherence() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

    let scheduled = 0;
    let completed = 0;
    let missed = 0;

    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const scheduledWorkout = getScheduledWorkout(dateStr);
        const actualWorkout = getWorkoutForDate(dateStr);

        // Exclude rest days from adherence calculations
        // Sick/travel days without logged workouts are excluded (getScheduledWorkout returns 'Sick'/'Travel')
        // Sick/travel days WITH logged workouts are included (getScheduledWorkout returns the workout type)
        if (scheduledWorkout !== 'Rest' && scheduledWorkout !== 'Travel' && scheduledWorkout !== 'Sick') {
            scheduled++;
            if (actualWorkout) {
                completed++;
            } else if (d < today) { // Don't count future dates as missed
                missed++;
            }
        }
    }

    const adherenceScore = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;

    return {
        score: adherenceScore,
        completed,
        scheduled,
        missed
    };
}
// Enhanced Analytics Functions
function calculateTotalVolume() {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();

    return allWorkouts
        .filter(workout => {
            const workoutDate = new Date(workout.date);
            return workoutDate.getMonth() === thisMonth && workoutDate.getFullYear() === thisYear;
        })
        .reduce((total, workout) => {
            return total + Object.values(workout.exercises || {}).reduce((exerciseTotal, exercise) => {
                return exerciseTotal + exercise.sets.reduce((setTotal, set) => {
                    return setTotal + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0);
                }, 0);
            }, 0);
        }, 0);
}

function calculateWorkoutStreak() {
    if (allWorkouts.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sort workouts by date (most recent first)
    const sortedWorkouts = allWorkouts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Check if the most recent workout is within the last scheduled workout day
    const mostRecentWorkout = sortedWorkouts[0];
    const mostRecentDate = new Date(mostRecentWorkout.date);
    mostRecentDate.setHours(0, 0, 0, 0);

    // Calculate days since last workout
    const daysSinceLastWorkout = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));

    // Check if there's a missed workout (excluding rest days and travel days)
    let hasMissedWorkout = false;
    for (let i = 0; i < daysSinceLastWorkout; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i - 1);
        const dateStr = checkDate.toISOString().split('T')[0];
        const scheduled = getScheduledWorkout(dateStr);
        const actual = getWorkoutForDate(dateStr);

        // Only count as missed if it was a scheduled workout (not rest or travel)
        if (scheduled !== 'Rest' && scheduled !== 'Travel' && !actual) {
            hasMissedWorkout = true;
            break;
        }
    }

    // If there's a missed workout day, streak is broken
    if (hasMissedWorkout) {
        return 0;
    }

    // Count consecutive workouts (not days, but completed scheduled workout days)
    let streak = 0;
    let checkDate = new Date(today);
    checkDate.setHours(0, 0, 0, 0);

    // Go backwards day by day and check for completed scheduled workouts
    for (let daysBack = 0; daysBack < 365; daysBack++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const scheduled = getScheduledWorkout(dateStr);
        const actual = getWorkoutForDate(dateStr);

        // Only count scheduled workout days (not rest or travel)
        if (scheduled !== 'Rest' && scheduled !== 'Travel') {
            // This was a scheduled workout day
            if (actual) {
                streak++;
            } else if (checkDate < today) {
                // Missed a past scheduled workout - streak ends
                break;
            }
        }

        checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
}

function calculatePRCount() {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));

    const recentPRs = getRecentPRs(7);
    return recentPRs.length;
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
            const progression = exerciseMap[exerciseName].slice(0, 3);

            if (progression.length < 3) return;

            // Check if weight hasn't increased in 3 sessions
            const weights = progression.map(p => p.maxWeight);
            const hasWeightProgression = weights.some((w, i) => i > 0 && w > weights[i - 1]);

            // Check if volume is declining
            const volumes = progression.map(p => p.totalVolume);
            const hasVolumeDecline = volumes.length >= 2 && volumes[0] < volumes[1];

            if (!hasWeightProgression || hasVolumeDecline) {
                plateaus.push({
                    exercise: exerciseName,
                    sessions: progression.length,
                    lastWeight: weights[0],
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
    const recentWorkouts = allWorkouts.slice(0, 7);
    if (recentWorkouts.length >= 3) {
        const consistency = (recentWorkouts.length / 7) * 100;
        if (consistency >= 60) {
            suggestions.push({
                type: 'motivation',
                text: `Excellent consistency! ${Math.round(consistency)}% workout rate this week.`
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

function calculateMuscleGroupVolumes() {
    const volumes = { Push: 0, Pull: 0, Legs: 0, Upper: 0, Lower: 0 };

    allWorkouts.slice(0, 8).forEach(workout => {
        if (workout.day === 'Rest') return;

        const workoutVolume = Object.values(workout.exercises || {}).reduce((total, exercise) => {
            return total + exercise.sets.reduce((setTotal, set) => {
                return setTotal + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0);
            }, 0);
        }, 0);

        volumes[workout.day] = (volumes[workout.day] || 0) + workoutVolume;
    });

    return volumes;
}

function calculateWorkoutVolume(workout) {
    if (workout.day === 'Rest') return 0;

    return Object.values(workout.exercises || {}).reduce((total, exercise) => {
        return total + exercise.sets.reduce((setTotal, set) => {
            return setTotal + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0);
        }, 0);
    }, 0);
}

// Get all workouts of a specific type (e.g., all "Upper" workouts)
function getWorkoutsByType(workoutType) {
    return allWorkouts.filter(workout => workout.day === workoutType);
}

// Calculate record volume for a workout type
function getRecordVolumeForType(workoutType) {
    const workouts = getWorkoutsByType(workoutType);
    if (workouts.length === 0) return 0;

    return Math.max(...workouts.map(workout => calculateWorkoutVolume(workout)));
}

// Calculate average volume for a workout type in current month
function getCurrentMonthAverageVolume(workoutType) {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();

    const monthWorkouts = allWorkouts.filter(workout => {
        const workoutDate = new Date(workout.date);
        return workout.day === workoutType &&
            workoutDate.getMonth() === thisMonth &&
            workoutDate.getFullYear() === thisYear;
    });

    if (monthWorkouts.length === 0) return 0;

    const totalVolume = monthWorkouts.reduce((sum, workout) => sum + calculateWorkoutVolume(workout), 0);
    return Math.round(totalVolume / monthWorkouts.length);
}

// Calculate average volume for a workout type in last month
function getLastMonthAverageVolume(workoutType) {
    const lastMonth = new Date().getMonth() - 1;
    const year = lastMonth < 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
    const month = lastMonth < 0 ? 11 : lastMonth;

    const monthWorkouts = allWorkouts.filter(workout => {
        const workoutDate = new Date(workout.date);
        return workout.day === workoutType &&
            workoutDate.getMonth() === month &&
            workoutDate.getFullYear() === year;
    });

    if (monthWorkouts.length === 0) return 0;

    const totalVolume = monthWorkouts.reduce((sum, workout) => sum + calculateWorkoutVolume(workout), 0);
    return Math.round(totalVolume / monthWorkouts.length);
}

// Get trend direction for last 3 sessions
function getTrendDirection(workoutType) {
    const workouts = getWorkoutsByType(workoutType).slice(0, 3);
    if (workouts.length < 2) return '';

    const volumes = workouts.map(w => calculateWorkoutVolume(w)).reverse();

    // Check if trending up
    let isIncreasing = true;
    let isDecreasing = true;

    for (let i = 1; i < volumes.length; i++) {
        if (volumes[i] <= volumes[i - 1]) isIncreasing = false;
        if (volumes[i] >= volumes[i - 1]) isDecreasing = false;
    }

    if (isIncreasing) return '(up)';
    if (isDecreasing) return '(down)';
    return '(flat)';
}

// Find exercises with recent PRs
function getRecentPRs(daysBack) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const exercisePRs = {};
    const recentPRs = [];

    // Build PR history chronologically
    allWorkouts.slice().reverse().forEach(workout => {
        if (workout.day === 'Rest') return;

        Object.values(workout.exercises || {}).forEach(exercise => {
            if (!exercise.exercise.toLowerCase().includes('stretch')) {
                const maxWeight = Math.max(...exercise.sets.map(set => parseFloat(set.weight) || 0));

                if (maxWeight > 0) {
                    const exerciseName = exercise.exercise;
                    const currentPR = exercisePRs[exerciseName] || 0;

                    if (maxWeight > currentPR) {
                        const workoutDate = new Date(workout.date);
                        if (workoutDate >= cutoffDate) {
                            recentPRs.push({ exercise: exerciseName, weight: maxWeight, date: workout.date });
                        }
                        exercisePRs[exerciseName] = maxWeight;
                    }
                }
            }
        });
    });

    return recentPRs;
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
        const weights = exerciseHistory[exercise].slice(0, sessionsBack);
        if (weights.length >= sessionsBack) {
            const hasProgress = weights.some((weight, idx) => idx > 0 && weight > weights[idx - 1]);
            if (!hasProgress) {
                plateaued.push({ exercise, weight: weights[0] });
            }
        }
    });

    return plateaued.slice(0, 3);
}

// Get all unique exercises from workout history
function getAllExercises() {
    const exercises = new Set();
    allWorkouts.forEach(workout => {
        if (workout.day !== 'Rest') {
            Object.values(workout.exercises || {}).forEach(exercise => {
                if (!exercise.exercise.toLowerCase().includes('stretch')) {
                    exercises.add(exercise.exercise);
                }
            });
        }
    });
    return Array.from(exercises).sort();
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
        const weights = exerciseHistory[exercise].slice(0, 4);
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

// Get days since last workout of a specific type
function getDaysSinceLastWorkout(workoutType) {
    const workouts = getWorkoutsByType(workoutType);
    if (workouts.length === 0) return null;

    const lastWorkout = new Date(workouts[0].date);
    const today = new Date();
    return Math.floor((today - lastWorkout) / (1000 * 60 * 60 * 24));
}

function generateAIInsights() {
    if (allWorkouts.length < 3) {
        return [
            "Complete more workouts to unlock AI insights!",
            "Aim for consistency - 3-4 workouts per week is ideal.",
            "Focus on progressive overload - gradually increase weight or reps."
        ];
    }

    const insights = [];

    // Workout frequency analysis
    const workoutDays = allWorkouts.slice(0, 10).map(w => new Date(w.date).getDay());
    const dayFrequency = {};
    workoutDays.forEach(day => {
        dayFrequency[day] = (dayFrequency[day] || 0) + 1;
    });

    if (Object.keys(dayFrequency).length > 0) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const preferredDay = Object.keys(dayFrequency).reduce((a, b) => dayFrequency[a] > dayFrequency[b] ? a : b);
        insights.push(`You train most often on ${dayNames[preferredDay]}s - this seems to be your power day!`);
    }

    // Volume analysis
    const totalVolume = allWorkouts.reduce((sum, w) => sum + calculateWorkoutVolume(w), 0);
    const avgVolumePerWorkout = Math.round(totalVolume / allWorkouts.length);
    insights.push(`Your average workout volume is ${avgVolumePerWorkout.toLocaleString()}lbs - solid training stimulus.`);

    // Data requirements: minimum 5 workouts, 5 nutrition days, 5 weight entries
    const hasEnoughData = allWorkouts.length >= 5 &&
        window.nutritionData && window.nutritionData.length >= 5 &&
        window.weightData && window.weightData.length >= 5;

    if (hasEnoughData) {
        console.log('Calculating correlation insights with sufficient data...');

        // 1. Strength vs. Weight Changes
        // Compare last 2 weeks vs prior 2 weeks
        const today = new Date();
        const twoWeeksAgo = new Date(today.getTime() - (14 * 24 * 60 * 60 * 1000));
        const fourWeeksAgo = new Date(today.getTime() - (28 * 24 * 60 * 60 * 1000));

        const recentWorkouts = allWorkouts.filter(w => new Date(w.date) >= twoWeeksAgo);
        const priorWorkouts = allWorkouts.filter(w => {
            const date = new Date(w.date);
            return date >= fourWeeksAgo && date < twoWeeksAgo;
        });

        if (recentWorkouts.length > 0 && priorWorkouts.length > 0) {
            const recentVolume = recentWorkouts.reduce((sum, w) => sum + calculateWorkoutVolume(w), 0) / recentWorkouts.length;
            const priorVolume = priorWorkouts.reduce((sum, w) => sum + calculateWorkoutVolume(w), 0) / priorWorkouts.length;
            const volumeChangePercent = priorVolume > 0 ? Math.round(((recentVolume - priorVolume) / priorVolume) * 100) : 0;

            console.log(`Volume change: ${volumeChangePercent}%`);

            // Weight changes
            const recentWeights = window.weightData.filter(w => new Date(w.date) >= twoWeeksAgo);
            const priorWeights = window.weightData.filter(w => {
                const date = new Date(w.date);
                return date >= fourWeeksAgo && date < twoWeeksAgo;
            });

            if (recentWeights.length > 0 && priorWeights.length > 0) {
                const avgRecentWeight = recentWeights.reduce((sum, w) => sum + parseFloat(w.weight), 0) / recentWeights.length;
                const avgPriorWeight = priorWeights.reduce((sum, w) => sum + parseFloat(w.weight), 0) / priorWeights.length;
                const weightChange = avgRecentWeight - avgPriorWeight;

                console.log(`Weight change: ${weightChange.toFixed(1)}lbs`);

                // Generate strength vs weight correlation insight
                if (volumeChangePercent > 5 && weightChange > 1) {
                    insights.push(`Your strength is up ${volumeChangePercent}% while weight increased ${weightChange.toFixed(1)}lbs - excellent lean mass gains!`);
                } else if (Math.abs(volumeChangePercent) < 5 && weightChange < -2) {
                    insights.push(`Strength maintaining while weight down ${Math.abs(weightChange).toFixed(1)}lbs - good cutting progress`);
                } else if (Math.abs(weightChange) < 1 && volumeChangePercent > 10) {
                    insights.push(`Weight stable but strength up ${volumeChangePercent}% - great recomp!`);
                } else if (volumeChangePercent < -5 && weightChange < -3) {
                    insights.push(`Strength declining ${Math.abs(volumeChangePercent)}% while weight down ${Math.abs(weightChange).toFixed(1)}lbs - may need more calories`);
                }
            }
        }

        // 2. Nutrition Adequacy (Past 7 Days)
        const last7Days = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        const recentNutrition = window.nutritionData.filter(n => new Date(n.date) >= last7Days);

        // Get workout days in last 7 days
        const recentWorkoutDates = allWorkouts
            .filter(w => new Date(w.date) >= last7Days)
            .map(w => w.date);
        const workoutDaysCount = recentWorkoutDates.length;

        // Group nutrition by date and calculate daily totals
        const dailyNutrition = {};
        recentNutrition.forEach(meal => {
            if (!dailyNutrition[meal.date]) {
                dailyNutrition[meal.date] = { protein: 0, carbs: 0, fats: 0, calories: 0 };
            }
            (meal.foods || []).forEach(food => {
                const qty = food.quantity || 1;
                dailyNutrition[meal.date].protein += (parseFloat(food.protein) || 0) * qty;
                dailyNutrition[meal.date].carbs += (parseFloat(food.carbs) || 0) * qty;
                dailyNutrition[meal.date].fats += (parseFloat(food.fats) || 0) * qty;
                dailyNutrition[meal.date].calories += (parseFloat(food.calories) || 0) * qty;
            });
        });

        // Filter out days with zero nutrition (not logged)
        const datesWithNutrition = Object.keys(dailyNutrition).filter(date =>
            dailyNutrition[date].protein > 0 || dailyNutrition[date].calories > 0
        );

        if (datesWithNutrition.length >= 3) {
            // Separate workout days and rest days
            const workoutDayData = datesWithNutrition.filter(date => recentWorkoutDates.includes(date));
            const restDayData = datesWithNutrition.filter(date => !recentWorkoutDates.includes(date));

            if (workoutDayData.length > 0) {
                const workoutAvgProtein = Math.round(
                    workoutDayData.reduce((sum, date) => sum + dailyNutrition[date].protein, 0) / workoutDayData.length
                );
                const workoutAvgCalories = Math.round(
                    workoutDayData.reduce((sum, date) => sum + dailyNutrition[date].calories, 0) / workoutDayData.length
                );

                console.log(`Avg protein on workout days (${workoutDayData.length} days): ${workoutAvgProtein}g`);

                if (workoutAvgProtein >= 150 && workoutDaysCount >= 3) {
                    insights.push(`Averaging ${workoutAvgProtein}g protein on ${workoutDayData.length} workout days (past 7 days) - excellent for muscle growth`);
                } else if (workoutAvgProtein < 120 && workoutDaysCount >= 2) {
                    insights.push(`Only ${workoutAvgProtein}g protein on workout days (${workoutDayData.length} days tracked) - aim for 0.8-1g per lb bodyweight`);
                }
            }

            if (restDayData.length > 0 && workoutDayData.length > 0) {
                const restAvgProtein = Math.round(
                    restDayData.reduce((sum, date) => sum + dailyNutrition[date].protein, 0) / restDayData.length
                );
                const workoutAvgProtein = Math.round(
                    workoutDayData.reduce((sum, date) => sum + dailyNutrition[date].protein, 0) / workoutDayData.length
                );

                if (restAvgProtein < workoutAvgProtein - 30) {
                    insights.push(`Rest day protein (${restAvgProtein}g avg) is much lower than workout days (${workoutAvgProtein}g) - keep protein consistent for recovery`);
                }
            }
        }

        // 3. Recovery Indicators - correlate intensity ratings with volume changes
        const workoutsWithIntensity = allWorkouts.filter(w => w.intensity &&
            (w.intensity.energy || w.intensity.motivation || w.intensity.fatigue || w.intensity.satisfaction));

        if (workoutsWithIntensity.length >= 5) {
            const recentIntensity = workoutsWithIntensity.slice(0, 7);

            const avgEnergy = recentIntensity.reduce((sum, w) => sum + (w.intensity.energy || 0), 0) / recentIntensity.length;
            const avgFatigue = recentIntensity.reduce((sum, w) => sum + (w.intensity.fatigue || 0), 0) / recentIntensity.length;
            const avgSatisfaction = recentIntensity.reduce((sum, w) => sum + (w.intensity.satisfaction || 0), 0) / recentIntensity.length;

            console.log(`Recent intensity - Energy: ${avgEnergy.toFixed(1)}, Fatigue: ${avgFatigue.toFixed(1)}, Satisfaction: ${avgSatisfaction.toFixed(1)}`);

            // Compare recent vs prior volume (only if we have enough data)
            if (recentIntensity.length >= 6) {
                const recentVol = recentIntensity.slice(0, 3).reduce((sum, w) => sum + calculateWorkoutVolume(w), 0) / 3;
                const priorVol = recentIntensity.slice(3, 6).reduce((sum, w) => sum + calculateWorkoutVolume(w), 0) / 3;
                const volChange = priorVol > 0 ? Math.round(((recentVol - priorVol) / priorVol) * 100) : 0;

                if (avgEnergy < 2.5 && volChange > 0) {
                    insights.push(`Low energy scores (avg ${avgEnergy.toFixed(1)}/5) last week but volume still up - good mental toughness`);
                } else if (avgFatigue > 3.5 && volChange < -10) {
                    insights.push(`High fatigue scores correlate with ${Math.abs(volChange)}% volume drop - consider deload week`);
                }
            }

            // Add satisfaction insight regardless of volume data
            if (avgSatisfaction >= 4.5) {
                insights.push(`Satisfaction scores averaging ${avgSatisfaction.toFixed(1)}/5 - training is going well!`);
            }
        }
    }

    return insights;
}

function getLastWorkoutForDay(day, exerciseApproach = null) {
    // Filter workouts by day
    const dayWorkouts = allWorkouts.filter(workout => workout.day === day);

    if (dayWorkouts.length === 0) return null;

    // If no specific approach requested, return the most recent workout
    if (!exerciseApproach) {
        return dayWorkouts[0];
    }

    // Filter by matching approach (standard, heavy, form focus, etc.)
    const matchingWorkouts = dayWorkouts.filter(workout => {
        // Check if this workout has exercises with the matching approach
        const exercises = Object.values(workout.exercises || {});
        return exercises.some(ex => {
            const workoutApproach = ex.approach || 'standard';
            return workoutApproach.toLowerCase() === exerciseApproach.toLowerCase();
        });
    });

    return matchingWorkouts.length > 0 ? matchingWorkouts[0] : dayWorkouts[0];
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

function updateIntensityHeatmap() {
    const container = document.getElementById('heatmap-content');

    if (allWorkouts.length === 0) {
        container.innerHTML = '<p>Complete workouts to see intensity patterns!</p>';
        return;
    }

    // Get last 4 weeks of workouts
    const today = new Date();
    const fourWeeksAgo = new Date(today.getTime() - (28 * 24 * 60 * 60 * 1000));

    const recentWorkouts = allWorkouts.filter(w => {
        const workoutDate = new Date(w.date);
        return workoutDate >= fourWeeksAgo;
    });

    // Group by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const intensityByDay = {};

    dayNames.forEach(day => {
        intensityByDay[day] = [];
    });

    recentWorkouts.forEach(workout => {
        const workoutDate = new Date(workout.date);
        const dayOfWeek = dayNames[workoutDate.getDay()];

        // Calculate average intensity score (1-5 scale)
        const intensity = workout.intensity || {};
        const avgScore = (
            (intensity.energy || 0) +
            (intensity.motivation || 0) +
            (6 - (intensity.fatigue || 1)) +  // Invert fatigue: 1->5, 2->4, 3->3, 4->2, 5->1
            (intensity.satisfaction || 0)
        ) / 4;

        // Scale to 0-10 range
        const scaledScore = (avgScore / 5) * 10;

        intensityByDay[dayOfWeek].push(scaledScore);
    });

    // Calculate average for each day
    const dayAverages = {};
    Object.keys(intensityByDay).forEach(day => {
        const scores = intensityByDay[day];
        dayAverages[day] = scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;
    });

    // Create heatmap HTML
    const getColorForScore = (score) => {
        if (score === 0) return 'rgba(71, 85, 105, 0.3)';
        if (score < 4) return 'var(--color-error)';
        if (score < 6) return 'var(--color-warning)';
        if (score < 8) return 'var(--color-success)';
        return 'var(--color-accent-primary)';
    };

    const heatmapHTML = `
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin-top: 1rem;">
                    ${dayNames.map(day => {
        const score = dayAverages[day];
        const color = getColorForScore(score);
        return `
                            <div style="text-align: center;">
                                <div style="font-size: 0.8rem; margin-bottom: 0.5rem; color: var(--color-text-secondary);">${day}</div>
                                <div style="
                                    background: ${color};
                                    border-radius: 8px;
                                    padding: 1rem 0.5rem;
                                    font-weight: bold;
                                    color: white;
                                    font-size: 0.9rem;
                                ">
                                    ${score > 0 ? score.toFixed(1) : '-'}
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
                <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--color-text-secondary); text-align: center;">
                    Intensity score (0-10) - calculated from your 1-5 ratings. Fatigue is inverted (lower fatigue = higher score).
                </div>
            `;

    container.innerHTML = heatmapHTML;
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
    // Update basic stats
    document.getElementById('pr-count').textContent = calculatePRCount();
    document.getElementById('workout-streak').textContent = calculateWorkoutStreak();

    // Update volume cards for each workout type
    const workoutTypes = ['Upper', 'Lower', 'Push', 'Pull', 'Legs'];
    workoutTypes.forEach(type => {
        const typeKey = type.toLowerCase();

        // Record volume
        const recordVolume = getRecordVolumeForType(type);
        const recordElement = document.getElementById(`${typeKey}-record`);
        const recordLbsElement = document.getElementById(`${typeKey}-record-lbs`);
        if (recordElement && recordLbsElement) {
            recordElement.textContent = recordVolume > 0 ? recordVolume.toLocaleString() : '0';
            recordLbsElement.textContent = recordVolume > 0 ? recordVolume.toLocaleString() : '0';
        }

        // Current month average
        const currentAvg = getCurrentMonthAverageVolume(type);
        const avgElement = document.getElementById(`${typeKey}-avg`);
        if (avgElement) {
            avgElement.textContent = currentAvg > 0 ? currentAvg.toLocaleString() : '0';
        }

        // Trend
        const trend = getTrendDirection(type);
        const trendElement = document.getElementById(`${typeKey}-trend`);
        if (trendElement) {
            trendElement.textContent = trend;
        }

        // Month-over-month
        const lastMonthAvg = getLastMonthAverageVolume(type);
        const momElement = document.getElementById(`${typeKey}-mom`);
        if (momElement) {
            if (currentAvg > 0 && lastMonthAvg > 0) {
                const diff = currentAvg - lastMonthAvg;
                const sign = diff > 0 ? '+' : '';
                momElement.textContent = `${sign}${diff.toLocaleString()} lbs vs last month`;
                momElement.style.color = diff > 0 ? 'var(--color-success)' : (diff < 0 ? 'var(--color-error)' : 'var(--color-text-secondary)');
            } else if (currentAvg > 0) {
                momElement.textContent = 'First month tracked';
                momElement.style.color = 'var(--color-text-secondary)';
            } else {
                momElement.textContent = 'No data this month';
                momElement.style.color = 'var(--color-text-secondary)';
            }
        }
    });

    // Update exercise selector for PR Timeline
    const exerciseSelector = document.getElementById('exercise-selector');
    if (exerciseSelector) {
        const exercises = getAllExercises();
        exerciseSelector.innerHTML = '<option value="">Select an exercise</option>' +
            exercises.map(ex => `<option value="${ex}">${ex}</option>`).join('');

        // Set default to first exercise if available
        if (exercises.length > 0) {
            exerciseSelector.value = exercises[0];
            createPRTimelineChart(exercises[0]);
        }
    }

    // Update session comparison with default (Upper)
    updateSessionComparison('Upper');

    // Update progression snapshot
    updateProgressionSnapshot();

    // Update focus areas
    updateFocusAreas();

    // Update intensity heatmap
    updateIntensityHeatmap();
}

function updateProgressionSnapshot() {
    // Quick Wins
    const recentPRs = getRecentPRs(7);
    const quickWinsElement = document.getElementById('quick-wins');
    if (quickWinsElement) {
        if (recentPRs.length > 0) {
            const uniqueExercises = [...new Set(recentPRs.map(pr => pr.exercise))];
            quickWinsElement.innerHTML = `<strong>${uniqueExercises.length}</strong> exercise${uniqueExercises.length !== 1 ? 's' : ''} hit PRs this week!`;
            quickWinsElement.style.color = 'var(--color-success)';
        } else {
            quickWinsElement.innerHTML = 'No PRs this week yet. Keep pushing!';
            quickWinsElement.style.color = 'var(--color-text-secondary)';
        }
    }

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

function updateFocusAreas() {
    const container = document.getElementById('focus-areas-content');
    if (!container) return;

    const workoutTypes = ['Upper', 'Lower', 'Push', 'Pull', 'Legs'];
    const warnings = [];

    // Check for workout types not done recently
    workoutTypes.forEach(type => {
        const daysSince = getDaysSinceLastWorkout(type);
        if (daysSince !== null && daysSince > 5) {
            warnings.push(`It's been ${daysSince} days since your last ${type} workout`);
        }
    });

    // Check for imbalanced training this month
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const typeFrequency = {};

    workoutTypes.forEach(type => {
        typeFrequency[type] = allWorkouts.filter(w => {
            const workoutDate = new Date(w.date);
            return w.day === type &&
                workoutDate.getMonth() === thisMonth &&
                workoutDate.getFullYear() === thisYear;
        }).length;
    });

    const frequencies = Object.values(typeFrequency).filter(f => f > 0);
    if (frequencies.length > 1) {
        const maxFreq = Math.max(...frequencies);
        const minFreq = Math.min(...frequencies);

        if (maxFreq - minFreq >= 2) {
            const undertrainedTypes = Object.keys(typeFrequency).filter(type => typeFrequency[type] === minFreq);
            warnings.push(`Consider adding more ${undertrainedTypes.join(' or ')} workouts to balance your training`);
        }
    }

    if (warnings.length > 0) {
        container.innerHTML = warnings.map(w => `<div style="margin-bottom: 0.5rem;">${w}</div>`).join('');
        container.style.color = 'var(--color-warning)';
    } else {
        container.innerHTML = '<div>Your training is well balanced! Keep it up!</div>';
        container.style.color = 'var(--color-success)';
    }
}

function updateInsights() {
    const insights = generateAIInsights();
    const plateaus = detectPlateaus();
    const container = document.getElementById('insights-list');

    let html = '';

    // Add plateau alerts first
    plateaus.slice(0, 2).forEach(plateau => {
        html += `<li class="insight-item plateau-alert">${plateau.exercise} plateaued for ${plateau.sessions} sessions. ${plateau.suggestion}</li>`;
    });

    // Add regular insights
    insights.forEach(insight => {
        const isProgression = insight.includes('Outstanding') || insight.includes('excellent');
        const className = isProgression ? 'progression-highlight' : '';
        html += `<li class="insight-item ${className}">${insight}</li>`;
    });

    container.innerHTML = html || '<li class="insight-item">Complete more workouts to get personalized insights!</li>';

    // Update nutrition insights
    updateNutritionInsights();
}

function updateNutritionInsights() {
    const today = new Date();
    const last7Days = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));

    // Get nutrition data for past 7 days
    const recentNutrition = window.nutritionData?.filter(n => new Date(n.date) >= last7Days) || [];

    // Get workout dates for past 7 days
    const recentWorkouts = allWorkouts.filter(w => new Date(w.date) >= last7Days);
    const workoutDates = recentWorkouts.map(w => w.date);

    // Group nutrition by date and calculate daily totals
    const dailyNutrition = {};
    recentNutrition.forEach(meal => {
        if (!dailyNutrition[meal.date]) {
            dailyNutrition[meal.date] = { protein: 0, carbs: 0, fats: 0, calories: 0, meals: [] };
        }
        dailyNutrition[meal.date].meals.push(meal);
        (meal.foods || []).forEach(food => {
            const qty = food.quantity || 1;
            dailyNutrition[meal.date].protein += (parseFloat(food.protein) || 0) * qty;
            dailyNutrition[meal.date].carbs += (parseFloat(food.carbs) || 0) * qty;
            dailyNutrition[meal.date].fats += (parseFloat(food.fats) || 0) * qty;
            dailyNutrition[meal.date].calories += (parseFloat(food.calories) || 0) * qty;
        });
    });

    // Filter out days with zero nutrition
    const datesWithNutrition = Object.keys(dailyNutrition).filter(date =>
        dailyNutrition[date].protein > 0 || dailyNutrition[date].calories > 0
    );

    // Workout Days vs Rest Days Comparison
    const comparisonContainer = document.getElementById('nutrition-comparison');
    if (datesWithNutrition.length >= 3) {
        const workoutDayData = datesWithNutrition.filter(date => workoutDates.includes(date));
        const restDayData = datesWithNutrition.filter(date => !workoutDates.includes(date));

        let comparisonHtml = '<div style="font-size: 0.85rem; line-height: 1.6;">';
        comparisonHtml += `<div style="margin-bottom: 0.5rem; color: var(--color-text-secondary);">Data from ${datesWithNutrition.length} days with logged nutrition</div>`;

        if (workoutDayData.length > 0) {
            const workoutAvg = {
                protein: Math.round(workoutDayData.reduce((sum, date) => sum + dailyNutrition[date].protein, 0) / workoutDayData.length),
                carbs: Math.round(workoutDayData.reduce((sum, date) => sum + dailyNutrition[date].carbs, 0) / workoutDayData.length),
                fats: Math.round(workoutDayData.reduce((sum, date) => sum + dailyNutrition[date].fats, 0) / workoutDayData.length),
                calories: Math.round(workoutDayData.reduce((sum, date) => sum + dailyNutrition[date].calories, 0) / workoutDayData.length)
            };

            comparisonHtml += `<div style="margin-bottom: 0.5rem; color: var(--color-success);">`;
            comparisonHtml += `<strong>Workout Days (${workoutDayData.length}):</strong> `;
            comparisonHtml += `${workoutAvg.protein}g protein, ${workoutAvg.carbs}g carbs, ${workoutAvg.fats}g fat, ${workoutAvg.calories} cal`;
            comparisonHtml += `</div>`;
        }

        if (restDayData.length > 0) {
            const restAvg = {
                protein: Math.round(restDayData.reduce((sum, date) => sum + dailyNutrition[date].protein, 0) / restDayData.length),
                carbs: Math.round(restDayData.reduce((sum, date) => sum + dailyNutrition[date].carbs, 0) / restDayData.length),
                fats: Math.round(restDayData.reduce((sum, date) => sum + dailyNutrition[date].fats, 0) / restDayData.length),
                calories: Math.round(restDayData.reduce((sum, date) => sum + dailyNutrition[date].calories, 0) / restDayData.length)
            };

            comparisonHtml += `<div style="margin-bottom: 0.5rem; color: var(--color-accent-primary);">`;
            comparisonHtml += `<strong>Rest Days (${restDayData.length}):</strong> `;
            comparisonHtml += `${restAvg.protein}g protein, ${restAvg.carbs}g carbs, ${restAvg.fats}g fat, ${restAvg.calories} cal`;
            comparisonHtml += `</div>`;
        }

        comparisonHtml += '</div>';
        comparisonContainer.innerHTML = comparisonHtml;
    } else {
        comparisonContainer.innerHTML = '<div style="color: var(--color-text-secondary);">Log nutrition for at least 3 days to see insights</div>';
    }

    // Pre-Workout Nutrition Analysis
    const preworkoutContainer = document.getElementById('preworkout-insights');
    let preworkoutHtml = '<div style="font-size: 0.85rem; line-height: 1.6;">';

    // Note: Full meal timing analysis would require meal time data
    preworkoutHtml += '<div style="color: var(--color-text-secondary);">Meal timing analysis requires logged meal times. ';
    preworkoutHtml += 'This feature tracks meals 1-4 hours before workouts to correlate with performance.</div>';
    preworkoutContainer.innerHTML = preworkoutHtml + '</div>';

    // Post-Workout Recovery Analysis
    const postworkoutContainer = document.getElementById('postworkout-insights');
    let postworkoutHtml = '<div style="font-size: 0.85rem; line-height: 1.6;">';
    postworkoutHtml += '<div style="color: var(--color-text-secondary);">Post-workout analysis tracks protein intake within 2 hours of completing workouts ';
    postworkoutHtml += 'to correlate with next session performance.</div>';
    postworkoutContainer.innerHTML = postworkoutHtml + '</div>';
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
        const dateStr = date.toISOString().split('T')[0];
        const scheduledWorkout = getScheduledWorkout(dateStr);
        const actualWorkout = getWorkoutForDate(dateStr);

        let classes = ['calendar-day'];
        if (dateStr === today) classes.push('today');

        // Determine display label and workout type
        let displayLabel;
        let labelClass;

        // Priority 1: If there's an actual logged workout, show it (overrides sick/travel)
        if (actualWorkout && actualWorkout.day) {
            classes.push('has-workout');
            displayLabel = actualWorkout.day;
            labelClass = actualWorkout.day;
        } else if (isDateSickDay(dateStr)) {
            // Priority 2: Sick day (only if no workout logged)
            classes.push('sick');
            displayLabel = 'Sick Day';
            labelClass = 'Sick';
        } else if (scheduledWorkout === 'Travel') {
            // Priority 3: Travel day (only if no workout logged)
            classes.push('travel');
            const wouldBeWorkout = getWouldBeScheduledWorkout(dateStr);
            displayLabel = `Travel (${wouldBeWorkout})`;
            labelClass = scheduledWorkout;
        } else if (scheduledWorkout !== 'Rest' && scheduledWorkout !== 'Travel' && date < new Date()) {
            classes.push('missed');
            displayLabel = scheduledWorkout;
            labelClass = scheduledWorkout;
        } else if (scheduledWorkout !== 'Rest' && scheduledWorkout !== 'Travel') {
            classes.push('scheduled');
            displayLabel = scheduledWorkout;
            labelClass = scheduledWorkout;
        } else {
            // Rest day
            displayLabel = scheduledWorkout;
            labelClass = scheduledWorkout;
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
    document.getElementById('workouts-completed').textContent = adherence.completed;
    document.getElementById('workouts-scheduled').textContent = adherence.scheduled;
    document.getElementById('workouts-missed').textContent = adherence.missed;
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
    const scheduledWorkout = getScheduledWorkout(dateStr);

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

            exercise.sets.forEach((set, idx) => {
                if (set.completed) {
                    html += `<div style="color: var(--color-success); padding: 0.25rem;">✓ Completed</div>`;
                } else if (set.weight || set.reps) {
                    html += `<div style="color: var(--color-text-secondary); padding: 0.25rem;">Set ${idx + 1}: ${set.weight}lbs × ${set.reps} reps`;
                    if (set.notes) html += ` (${set.notes})`;
                    html += '</div>';
                }
            });

            html += '</div>';
        });

        html += '</div>';
        content.innerHTML = html;
    } else {
        title.textContent = `${scheduledWorkout} - ${formatDateString(dateStr)}`;
        if (scheduledWorkout === 'Sick') {
            content.innerHTML = `<p style="color: #f472b6;">This day is marked as a sick day. Workout was canceled and schedule adjusted.</p>`;
        } else if (scheduledWorkout === 'Travel') {
            const wouldBeWorkout = getWouldBeScheduledWorkout(dateStr);
            content.innerHTML = `<p style="color: #a855f7;">Travel day - workout schedule paused.</p>
                        <p style="color: var(--color-text-secondary); margin-top: 0.5rem;">Scheduled workout if not traveling: <strong style="color: var(--color-text-secondary);">${wouldBeWorkout}</strong></p>`;
        } else {
            content.innerHTML = `<p style="color: var(--color-text-secondary);">No workout logged for this day. Scheduled: ${scheduledWorkout}</p>`;
        }
    }

    container.style.display = 'block';
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
            // Restart the program by creating a Rest day workout for today
            // This will cause the schedule to restart from Upper tomorrow
            const today = getTodayDateString();
            const restartWorkout = {
                date: today,
                day: 'Rest',
                exercises: {},
                timestamp: new Date().toISOString()
            };

            // Check if there's already a workout today
            const existingWorkout = getWorkoutForDate(today);
            if (!existingWorkout) {
                await addDoc(collection(db, "workouts"), restartWorkout);
                console.log('Program restarted - Rest day logged for today');
            }

            await loadWorkoutsFromFirebase();
        }

        await loadTravelModeData();
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
                    alert('Sick day removed. Schedule will adjust accordingly.');
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

        alert('Day marked as sick. All remaining workouts have been pushed back by one day.');
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

    // Set food info
    document.getElementById('portion-food-name').textContent = food.name;
    const servingInfo = food.servingSize && food.servingUnit
        ? `1 serving = ${food.servingSize}${food.servingUnit}`
        : '1 serving';
    document.getElementById('portion-food-serving').textContent = servingInfo;

    // Reset inputs
    currentServings = 1;
    document.getElementById('servings-display').textContent = currentServings;
    document.getElementById('measured-amount-input').value = '';
    document.getElementById('measured-unit-select').value = food.servingUnit || 'g';
    document.getElementById('calculated-servings').style.display = 'none';
    selectedMealTag = null;

    // Reset meal tag buttons
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(tag => {
        document.getElementById(`tag-${tag}`).classList.remove('selected');
    });

    // Set default mode based on food preference
    const defaultMode = food.portionInputPreference || 'servings';
    switchPortionMode(defaultMode);

    // Disable add button until meal tag is selected
    document.getElementById('add-to-log-btn').disabled = true;

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
    if (!selectedMealTag || !pendingFoodData) {
        alert('Please select a meal tag');
        return;
    }

    const food = pendingFoodData.originalFood;
    const currentTime = getCurrentTimeString();

    const foodEntry = {
        date: currentNutritionDate,
        mealType: selectedMealTag,
        time: currentTime,
        foods: [{
            name: food.name,
            protein: food.protein,
            carbs: food.carbs,
            fats: food.fats,
            calories: food.calories,
            quantity: currentServings
        }]
    };

    try {
        const docRef = await addDoc(collection(db, "nutrition"), foodEntry);
        const newEntry = { id: docRef.id, ...foodEntry };
        nutritionData.unshift(newEntry);

        // Auto-expand this meal group
        const groupId = `${selectedMealTag}-${currentNutritionDate}`;
        collapsedMeals[groupId] = false;

        closePortionModal();
        renderMeals();

        console.log('Food logged successfully');
    } catch (e) {
        console.error("Error logging food:", e);
        alert('Error logging food. Please try again.');
    }
};

// Legacy meal tag modal (for new food flow)
window.showMealTagModal = function () {
    document.getElementById('meal-tag-modal').classList.add('active');
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
        portionInputPreference: 'measured'
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

window.showSavedFoodsForAdding = function () {
    // This is now handled by the tab toggle
    switchAddFoodTab('saved');
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

// Keep old functions for compatibility with existing meal editing
window.addMeal = function () {
    showAddFoodModal();
};

window.addFoodToMeal = function (mealId) {
    const meal = nutritionData.find(m => m.id === mealId);
    if (!meal.foods) meal.foods = [];
    meal.foods.push({ name: '', protein: 0, carbs: 0, fats: 0, calories: 0, quantity: 1 });
    currentEditingMealId = mealId; // Set the context to this meal
    renderMeals();
};

window.changeMealType = async function (mealId, newMealType) {
    try {
        const meal = nutritionData.find(m => m.id === mealId);
        if (!meal) return;

        meal.mealType = newMealType;

        // Update in Firestore
        const docRef = doc(db, "nutrition", mealId);
        await updateDoc(docRef, { mealType: newMealType });

        console.log(`Updated meal ${mealId} to ${newMealType}`);
    } catch (e) {
        console.error("Error changing meal type:", e);
        alert('Error changing meal type. Please try again.');
    }
};

window.updateMealFood = async function (mealId, foodIndex, field, value) {
    const meal = nutritionData.find(m => m.id === mealId);
    if (meal && meal.foods && meal.foods[foodIndex]) {
        meal.foods[foodIndex][field] = value;
        meal.hasUnsavedChanges = true; // Mark meal as having unsaved changes
        updateNutritionSummary();
        renderMeals(); // Re-render to show save button
    }
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
        alert('Meal saved! Changes have been updated to the database and counted in daily calories.');
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
            alert('Food saved to library!');
            renderSavedFoods();
        } catch (e) {
            console.error("Error saving food:", e);
            alert('Error saving food to library');
        }
    }
};

async function saveSavedFoodsToFirebase() {
    // Update existing saved food documents in Firebase
    for (const food of savedFoods) {
        if (food.id) {
            try {
                const docRef = doc(db, "savedFoods", food.id);
                await updateDoc(docRef, {
                    name: food.name,
                    protein: food.protein,
                    carbs: food.carbs,
                    fats: food.fats,
                    calories: food.calories,
                    lastUsed: food.lastUsed,
                    useCount: food.useCount
                });
            } catch (e) {
                console.error("Error updating saved food:", e);
            }
        }
    }
}

function renderSavedFoods(searchTerm = '') {
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
        }, 300);

        // Re-enable body scroll
        document.body.style.overflow = '';
    }
};


// Legacy quickAddFood - now redirects to new flow
window.quickAddFood = function (foodId) {
    selectSavedFood(foodId);
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
        // Update in Firebase
        const docRef = doc(db, "savedFoods", foodId);
        await updateDoc(docRef, {
            name: name,
            calories: calories,
            protein: protein,
            carbs: carbs,
            fats: fats,
            servingSize: servingSize,
            servingUnit: servingUnit.toLowerCase()
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
        }

        closeEditFoodModal();
        renderSavedFoods();
        alert('Food updated successfully!');

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
        const q = query(collection(db, "savedFoods"), orderBy("lastUsed", "desc"));
        const querySnapshot = await getDocs(q);

        const allFoods = [];
        querySnapshot.forEach((doc) => {
            allFoods.push({ id: doc.id, ...doc.data() });
        });

        console.log(`Loaded ${allFoods.length} saved foods from database`);

        // Deduplicate foods based on name and nutritional values
        const deduplicatedFoods = await deduplicateSavedFoods(allFoods);
        savedFoods = deduplicatedFoods;

        console.log(`After deduplication: ${savedFoods.length} unique saved foods`);
    } catch (e) {
        console.error("Error loading saved foods:", e);
        // Initialize with empty array if error
        savedFoods = [];
    }
}

/**
 * Deduplicates saved foods based on name and nutritional values.
 * If duplicates exist, keeps the most recently used one and deletes others from Firebase.
 */
async function deduplicateSavedFoods(foods) {
    if (!foods || foods.length === 0) return [];

    const foodMap = new Map();
    const duplicatesToDelete = [];

    // Create a unique key for each food based on name and nutritional values
    const createFoodKey = (food) => {
        const name = (food.name || '').toLowerCase().trim();
        const protein = parseFloat(food.protein) || 0;
        const carbs = parseFloat(food.carbs) || 0;
        const fats = parseFloat(food.fats) || 0;
        const calories = parseFloat(food.calories) || 0;
        return `${name}_${protein}_${carbs}_${fats}_${calories}`;
    };

    // Group foods by their unique key
    for (const food of foods) {
        const key = createFoodKey(food);

        if (!foodMap.has(key)) {
            foodMap.set(key, food);
        } else {
            // Duplicate found - keep the one with more recent lastUsed date
            const existing = foodMap.get(key);
            const existingDate = new Date(existing.lastUsed || 0);
            const currentDate = new Date(food.lastUsed || 0);

            if (currentDate > existingDate) {
                // Current food is more recent, replace existing and mark old for deletion
                duplicatesToDelete.push(existing.id);
                foodMap.set(key, food);
            } else {
                // Existing is more recent, mark current for deletion
                duplicatesToDelete.push(food.id);
            }
        }
    }

    // Delete duplicates from Firebase
    if (duplicatesToDelete.length > 0) {
        console.log(`Found ${duplicatesToDelete.length} duplicate saved foods to clean up`);

        for (const foodId of duplicatesToDelete) {
            try {
                const docRef = doc(db, "savedFoods", foodId);
                await deleteDoc(docRef);
                console.log(`Deleted duplicate saved food ${foodId}`);
            } catch (e) {
                console.error(`Error deleting duplicate food ${foodId}:`, e);
            }
        }

        console.log(`Cleaned up ${duplicatesToDelete.length} duplicate saved foods from database`);
    }

    // Return deduplicated list
    return Array.from(foodMap.values());
}

// Helper function to check if Chart.js is loaded
function isChartJsReady() {
    return typeof Chart !== 'undefined';
}

// Chart.js loading configuration
const CHARTJS_WAIT_INTERVAL_MS = 100;
const CHARTJS_MAX_WAIT_ATTEMPTS = 50; // 5 seconds total

// Date calculation constants
const NINETY_DAYS_IN_MS = 90 * 24 * 60 * 60 * 1000;

// Helper function to wait for Chart.js to be loaded
function waitForChartJs(callback, maxAttempts = CHARTJS_MAX_WAIT_ATTEMPTS) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        if (isChartJsReady()) {
            clearInterval(checkInterval);
            try {
                callback();
            } catch (err) {
                console.error('Error executing Chart.js callback:', err);
            }
        } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.error('Chart.js failed to load within timeout period');
        }
    }, CHARTJS_WAIT_INTERVAL_MS);
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
        alert('Weight logged successfully!');
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

// Photo Functions
window.uploadProgressPhoto = async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        const photoData = {
            date: new Date().toISOString().split('T')[0],
            dataUrl: e.target.result,
            timestamp: new Date()
        };

        try {
            const docRef = await addDoc(collection(db, "photos"), photoData);

            // Safety check: Initialize window.photoData if undefined
            if (!window.photoData) {
                window.photoData = [];
            }

            window.photoData.unshift({ id: docRef.id, ...photoData });
            renderPhotos();
            alert('Photo uploaded successfully!');
        } catch (error) {
            console.error("Error uploading photo:", error);
            alert('Error uploading photo');
        }
    };
    reader.readAsDataURL(file);
};

window.deleteProgressPhoto = async function (photoId) {
    if (confirm('Delete this progress photo?')) {
        try {
            // Delete from Firestore
            await deleteDoc(doc(db, "photos", photoId));

            // Remove from local photoData array
            window.photoData = window.photoData.filter(p => p.id !== photoId);

            // Re-render the gallery
            renderPhotos();
        } catch (e) {
            console.error("Error deleting progress photo:", e);
            alert('Error deleting photo. Please try again.');
        }
    }
};

function renderPhotos() {
    const container = document.getElementById('photo-gallery');
    if (!container) return;

    if (window.photoData.length === 0) {
        container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 2rem;">No progress photos yet. Upload your first one!</p>';
        return;
    }

    let html = '';
    window.photoData.forEach(photo => {
        html += `<div class="photo-item">
                    <img src="${photo.dataUrl}" alt="Progress photo">
                    <button class="btn-delete-photo" onclick="deleteProgressPhoto('${photo.id}')" title="Delete photo">Delete</button>
                    <div class="photo-date">${formatDateString(photo.date)}</div>
                </div>`;
    });

    container.innerHTML = html;
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
let photosLoaded = false;
let analyticsLoaded = false;
let progressLoaded = false;

// Main app initialization
document.addEventListener('DOMContentLoaded', function () {
    // Hide loading overlay
    const loadingOverlay = document.getElementById('app-loading');
    if (loadingOverlay) loadingOverlay.style.display = 'none';

    console.log('Initializing Fitness Command Center...');

    // Initialize timezone-aware current nutrition date
    currentNutritionDate = getTodayDateString();

    // Set up UI immediately - no blocking
    setupEventListeners();

    // Initialize program editor
    initializeProgramNameInput();

    // Initialize workout with default program (will update when programs load)
    initializeWorkout();

    console.log('Fitness Command Center ready! UI is interactive.');

    // Load programs in background, then update workout display
    loadPrograms()
        .then(() => {
            // Re-initialize workout with loaded programs
            initializeWorkout();
        })
        .catch(err => {
            console.error('Failed to load programs:', err);
            // UI remains functional with default workout structure
        });

    // UI is now interactive! Load remaining data in background without blocking
    // Fire and forget - these will update UI when they complete
    loadWorkoutsFromFirebase()
        .then(() => {
            updateSuggestions();
            updateAnalytics();
        })
        .catch(err => {
            console.error('Failed to load workouts in background:', err);
            // UI remains functional, just without workout history
        });

    loadBodyGoalData().catch(err => console.error('Failed to load body goal data:', err));
    loadTravelModeData().catch(err => console.error('Failed to load travel mode data:', err));
    loadSickDayData().catch(err => console.error('Failed to load sick day data:', err));

    // Don't load nutrition/weight/photo data yet - lazy load when tabs are opened
});

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
    document.getElementById('intelligence-tab-btn').addEventListener('click', () => {
        showTab('intelligence');
    });

    // Day selection
    document.getElementById('upper-btn').addEventListener('click', () => selectDay('Upper'));
    document.getElementById('lower-btn').addEventListener('click', () => selectDay('Lower'));
    document.getElementById('rest-btn').addEventListener('click', () => selectDay('Rest'));
    document.getElementById('push-btn').addEventListener('click', () => selectDay('Push'));
    document.getElementById('pull-btn').addEventListener('click', () => selectDay('Pull'));
    document.getElementById('legs-btn').addEventListener('click', () => selectDay('Legs'));

    // Complete workout
    document.getElementById('complete-workout-btn').addEventListener('click', completeWorkout);

    // Initialize date input to today (timezone-aware)
    const today = getTodayDateString();
    document.getElementById('workout-date-input').value = today;

    // Date input handling
    document.getElementById('workout-date-input').addEventListener('change', setWorkoutDate);
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
        if (!photosLoaded) {
            photosLoaded = true;
            loadPhotoData()
                .then(() => renderPhotos())
                .catch(err => {
                    console.error('Failed to load photo data:', err);
                    const container = document.getElementById('photo-gallery');
                    if (container) {
                        container.innerHTML = '<p style="color: var(--color-error); text-align: center; padding: 2rem;">Failed to load photos. Please refresh the page.</p>';
                    }
                });
        }
    }

    if (tabName === 'analytics' && !analyticsLoaded) {
        analyticsLoaded = true;
        updateAnalytics();
    }

    if (tabName === 'progress' && !progressLoaded) {
        progressLoaded = true;
        updateProgress();
    }

    if (tabName === 'intelligence') {
        updateInsights();
    }
}

function selectDay(day) {
    currentDay = day;

    // Update day buttons
    document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(day.toLowerCase() + '-btn').classList.add('active');

    initializeWorkout();
    updateSuggestions();
}

function initializeWorkout() {
    currentWorkout = {};
    const workouts = getActiveWorkouts();
    const exercises = workouts[currentDay];

    exercises.forEach((exercise, index) => {
        const isStretch = exercise.name.toLowerCase().includes('stretch');
        const isRest = currentDay === 'Rest';

        currentWorkout[index] = {
            exercise: exercise.name,
            sets: (isStretch || isRest) ?
                [{ completed: false }] :
                Array(typeof exercise.sets === 'number' ? exercise.sets : 1).fill().map(() => ({
                    weight: '',
                    reps: '',
                    notes: ''
                }))
        };
    });

    renderWorkout();
}
function renderWorkout() {
    const container = document.getElementById('exercises-container');
    const workouts = getActiveWorkouts();
    const exercises = workouts[currentDay];
    const exerciseProgression = getExerciseProgression();

    let html = '';

    exercises.forEach((exercise, exerciseIndex) => {
        const workoutExercise = currentWorkout[exerciseIndex];
        // Get last workout matching current exercise's approach
        const currentApproach = workoutExercise.approach || 'standard';
        const lastWorkout = getLastWorkoutForDay(currentDay, currentApproach);
        const previousExercise = lastWorkout?.exercises?.[exerciseIndex];

        // Check if this is a stretch exercise or rest day
        const isStretch = exercise.name.toLowerCase().includes('stretch');
        const isRest = currentDay === 'Rest';

        // Calculate suggested weight and get progression info
        let suggestedWeight = '';
        let progressionInfo = '';

        if (!isStretch && !isRest && previousExercise && previousExercise.sets.length > 0) {
            const prevSets = previousExercise.sets.filter(set => set.weight && set.reps);
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
                                ${!isStretch && !isRest ? `
                                    <div class="approach-selector">
                                        <button class="approach-btn ${!workoutExercise.approach ? 'active' : ''}" onclick="setExerciseApproach(${exerciseIndex}, null)">Standard</button>
                                        <button class="approach-btn ${workoutExercise.approach === 'Heavy' ? 'active' : ''}" onclick="setExerciseApproach(${exerciseIndex}, 'Heavy')">Heavy</button>
                                        <button class="approach-btn ${workoutExercise.approach === 'Form Focus' ? 'active' : ''}" onclick="setExerciseApproach(${exerciseIndex}, 'Form Focus')">Form Focus</button>
                                        <button class="approach-btn ${workoutExercise.substitution ? 'active' : ''}" onclick="toggleSubstitution(${exerciseIndex})">Alt Exercise</button>
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
                                <div class="previous-header">Last session (${formatDateString(lastWorkout.date)})${lastWorkout.exercises?.[exerciseIndex]?.approach ? ` - ${lastWorkout.exercises[exerciseIndex].approach}` : ''}:</div>
                                <div class="previous-sets-compact">
                                    ${previousExercise.sets.filter(set => set.weight || set.reps).map(set => {
            let setStr = `${set.weight}×${set.reps}`;
            if (set.notes) setStr += ` (${set.notes})`;
            return setStr;
        }).join(', ')}
                                </div>
                            </div>
                        ` : ''}`;

        if (isStretch || isRest) {
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
                html += `
                            <div class="set-row">
                                <div class="set-number">${setIndex + 1}</div>
                                <input type="number" class="weight-input" placeholder="lbs" 
                                       value="${set.weight}" 
                                       onchange="updateSet(${exerciseIndex}, ${setIndex}, 'weight', this.value)">
                                <span style="color: var(--color-text-secondary);">×</span>
                                <div class="reps-control-wrapper">
                                    <button class="reps-increment-btn" onclick="adjustReps(${exerciseIndex}, ${setIndex}, -1); event.stopPropagation();" title="Decrease reps">−</button>
                                    <input type="number" class="reps-input" placeholder="reps" 
                                           value="${set.reps}" 
                                           onchange="updateSet(${exerciseIndex}, ${setIndex}, 'reps', this.value)">
                                    <button class="reps-increment-btn" onclick="adjustReps(${exerciseIndex}, ${setIndex}, 1); event.stopPropagation();" title="Increase reps">+</button>
                                </div>
                                <input type="text" class="notes-input" placeholder="notes" 
                                       value="${set.notes}" 
                                       onchange="updateSet(${exerciseIndex}, ${setIndex}, 'notes', this.value)">
                                ${previousExercise?.sets[setIndex]?.weight ? `
                                    <button class="btn btn-copy" onclick="copyPrevious(${exerciseIndex}, ${setIndex})">Copy</button>
                                ` : ''}
                                <button class="set-delete-btn" onclick="deleteSet(${exerciseIndex}, ${setIndex})" title="Delete set">×</button>
                            </div>`;
            });

            html += `
                            </div>
                            <button class="btn btn-add" onclick="addSet(${exerciseIndex})" style="margin-top: 0.75rem;">+ Add Set</button>
                        `;
        }

        html += `</div>`;
    });

    container.innerHTML = html;
}

// Make functions globally available
window.updateSet = function (exerciseIndex, setIndex, field, value) {
    currentWorkout[exerciseIndex].sets[setIndex][field] = value;
};

window.deleteSet = function (exerciseIndex, setIndex) {
    if (confirm('Delete this set?')) {
        currentWorkout[exerciseIndex].sets.splice(setIndex, 1);
        renderWorkout();
    }
};

window.adjustReps = function (exerciseIndex, setIndex, delta) {
    const currentReps = parseInt(currentWorkout[exerciseIndex].sets[setIndex].reps) || 0;
    const newReps = Math.max(0, currentReps + delta);
    currentWorkout[exerciseIndex].sets[setIndex].reps = newReps.toString();
    renderWorkout();
};

window.addSet = function (exerciseIndex) {
    currentWorkout[exerciseIndex].sets.push({ weight: '', reps: '', notes: '' });
    renderWorkout();
};

window.copyPrevious = function (exerciseIndex, setIndex) {
    // Get last workout matching current exercise's approach
    const currentApproach = currentWorkout[exerciseIndex].approach || 'standard';
    const lastWorkout = getLastWorkoutForDay(currentDay, currentApproach);
    const previousSet = lastWorkout?.exercises?.[exerciseIndex]?.sets[setIndex];

    if (previousSet) {
        currentWorkout[exerciseIndex].sets[setIndex].weight = previousSet.weight;
        currentWorkout[exerciseIndex].sets[setIndex].reps = previousSet.reps;
        renderWorkout();
    }
};

window.updateStretch = function (exerciseIndex, completed) {
    currentWorkout[exerciseIndex].sets[0] = { completed: completed };
};

window.setExerciseApproach = function (exerciseIndex, approach) {
    currentWorkout[exerciseIndex].approach = approach;
    renderWorkout();
};

window.toggleSubstitution = function (exerciseIndex) {
    if (currentWorkout[exerciseIndex].substitution) {
        // Remove substitution
        delete currentWorkout[exerciseIndex].substitution;
        delete currentWorkout[exerciseIndex].originalExercise;
        renderWorkout();
    } else {
        // Open modal to select/enter alternative exercise
        currentAltExerciseIndex = exerciseIndex;
        showAltExerciseModal(exerciseIndex);
    }
};

window.showAltExerciseModal = function (exerciseIndex) {
    const modal = document.getElementById('alt-exercise-modal');
    const nameInput = document.getElementById('alt-exercise-name-input');
    const originalExerciseName = currentWorkout[exerciseIndex].exercise;

    // Clear input
    nameInput.value = '';

    // Show modal
    modal.classList.add('active');

    // Focus input
    setTimeout(() => nameInput.focus(), 100);

    // Load and display history for this exercise
    loadAltExerciseHistory(originalExerciseName);
};

window.closeAltExerciseModal = function () {
    const modal = document.getElementById('alt-exercise-modal');
    modal.classList.remove('active');
    currentAltExerciseIndex = null;
};

window.confirmAltExercise = function () {
    const nameInput = document.getElementById('alt-exercise-name-input');
    const altExerciseName = nameInput.value.trim();

    if (!altExerciseName) {
        alert('Please enter an alternative exercise name');
        return;
    }

    if (currentAltExerciseIndex !== null) {
        const originalExercise = currentWorkout[currentAltExerciseIndex].exercise;

        currentWorkout[currentAltExerciseIndex].substitution = altExerciseName;
        currentWorkout[currentAltExerciseIndex].originalExercise = originalExercise;
        currentWorkout[currentAltExerciseIndex].exercise = altExerciseName;

        // Save to history
        saveAltExerciseToHistory(originalExercise, altExerciseName);

        closeAltExerciseModal();
        renderWorkout();
    }
};

window.selectAltExerciseFromHistory = function (altExerciseName) {
    const nameInput = document.getElementById('alt-exercise-name-input');
    nameInput.value = altExerciseName;
};

async function loadAltExerciseHistory(originalExerciseName) {
    try {
        const q = query(
            collection(db, "alternativeExercises"),
            where("originalExercise", "==", originalExerciseName),
            orderBy("lastUsed", "desc"),
            limit(10)
        );

        const querySnapshot = await getDocs(q);
        const history = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            history.push({
                id: doc.id,
                ...data
            });
        });

        // Also check local state
        if (!alternativeExerciseHistory[originalExerciseName]) {
            alternativeExerciseHistory[originalExerciseName] = [];
        }

        // Merge and deduplicate
        const seenNames = new Set();
        const merged = [];

        for (const item of history) {
            if (!seenNames.has(item.alternativeExercise)) {
                seenNames.add(item.alternativeExercise);
                merged.push(item);
            }
        }

        alternativeExerciseHistory[originalExerciseName] = merged;
        renderAltExerciseHistory(merged);

    } catch (e) {
        console.error("Error loading alternative exercise history:", e);
        renderAltExerciseHistory([]);
    }
}

function renderAltExerciseHistory(history) {
    const historySection = document.getElementById('alt-exercise-history-section');
    const historyList = document.getElementById('alt-exercise-history-list');

    if (history.length === 0) {
        historySection.style.display = 'none';
        return;
    }

    historySection.style.display = 'block';

    let html = '';
    history.forEach(item => {
        const lastUsedDate = item.lastUsed ? new Date(item.lastUsed).toLocaleDateString() : 'Unknown';
        const useCount = item.useCount || 1;

        html += `
                    <div class="alt-exercise-history-item" onclick="selectAltExerciseFromHistory('${item.alternativeExercise.replace(/'/g, "\\'")}')">
                        <div class="alt-exercise-history-item-name">${item.alternativeExercise}</div>
                        <div class="alt-exercise-history-item-meta">
                            <div class="alt-exercise-history-item-date">${lastUsedDate}</div>
                            <div class="alt-exercise-history-item-count">Used ${useCount}x</div>
                        </div>
                    </div>
                `;
    });

    historyList.innerHTML = html;
}

async function saveAltExerciseToHistory(originalExercise, alternativeExercise) {
    try {
        // Check if this combination already exists
        const q = query(
            collection(db, "alternativeExercises"),
            where("originalExercise", "==", originalExercise),
            where("alternativeExercise", "==", alternativeExercise)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // Create new entry
            const data = {
                originalExercise: originalExercise,
                alternativeExercise: alternativeExercise,
                firstUsed: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                useCount: 1
            };

            await addDoc(collection(db, "alternativeExercises"), data);
            console.log('Saved new alternative exercise to history');
        } else {
            // Update existing entry
            querySnapshot.forEach(async (document) => {
                const docRef = doc(db, "alternativeExercises", document.id);
                const currentData = document.data();
                await updateDoc(docRef, {
                    lastUsed: new Date().toISOString(),
                    useCount: (currentData.useCount || 0) + 1
                });
            });
            console.log('Updated alternative exercise history');
        }
    } catch (e) {
        console.error("Error saving alternative exercise to history:", e);
    }
}

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

async function completeWorkout() {
    const dateInput = document.getElementById('workout-date-input');
    const today = getTodayDateString();
    const selectedDate = dateInput.value && dateInput.value !== today ? dateInput.value : today;

    const workoutData = {
        date: selectedDate,
        day: currentDay,
        exercises: currentWorkout,
        intensity: {
            energy: workoutIntensity.preWorkout.energy,
            motivation: workoutIntensity.preWorkout.motivation,
            fatigue: workoutIntensity.postWorkout.fatigue,
            satisfaction: workoutIntensity.postWorkout.satisfaction
        }
    };

    try {
        // Save to Firebase
        await saveWorkoutToFirebase(workoutData);

        // Also save locally as backup
        const localHistory = JSON.parse(localStorage.getItem('fitnessData') || '{}');
        const workoutKey = currentDay + '-' + selectedDate + '-' + Date.now();
        localHistory[workoutKey] = workoutData;
        localStorage.setItem('fitnessData', JSON.stringify(localHistory));

        // Reload data from Firebase
        await loadWorkoutsFromFirebase();

        // Export to clipboard
        exportToClipboard();

        alert('Workout saved to Firebase and copied to clipboard!');

        // Reset intensity inputs
        workoutIntensity = {
            preWorkout: { energy: null, motivation: null },
            postWorkout: { fatigue: null, satisfaction: null }
        };

        // Clear active intensity buttons
        document.querySelectorAll('.intensity-btn').forEach(btn => btn.classList.remove('active'));

        // Reset and refresh
        initializeWorkout();
        updateSuggestions();
        updateAnalytics();

    } catch (error) {
        console.error('Error saving workout:', error);
        alert('Error saving workout. Check your internet connection.');
    }
}

function exportToClipboard() {
    const dateInput = document.getElementById('workout-date-input');
    const workoutDate = dateInput.value ? new Date(dateInput.value) : new Date();
    const dateString = workoutDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    let exportText = currentDay + ' | ' + dateString + '\n';
    exportText += '=========================\n';

    // Add intensity ratings if available
    if (workoutIntensity.preWorkout.energy || workoutIntensity.postWorkout.satisfaction) {
        exportText += '\nSession Intensity:\n';
        if (workoutIntensity.preWorkout.energy) exportText += `Energy: ${workoutIntensity.preWorkout.energy}/5 `;
        if (workoutIntensity.preWorkout.motivation) exportText += `| Motivation: ${workoutIntensity.preWorkout.motivation}/5\n`;
        if (workoutIntensity.postWorkout.fatigue) exportText += `Fatigue: ${workoutIntensity.postWorkout.fatigue}/5 `;
        if (workoutIntensity.postWorkout.satisfaction) exportText += `| Satisfaction: ${workoutIntensity.postWorkout.satisfaction}/5\n`;
        exportText += '\n';
    }

    Object.values(currentWorkout).forEach(exercise => {
        exportText += exercise.exercise;
        if (exercise.substitution && exercise.originalExercise) {
            exportText += ' (Alt for ' + exercise.originalExercise + ')';
        } else if (exercise.approach) {
            exportText += ' (' + exercise.approach + ')';
        }
        exportText += '\n';

        exercise.sets.forEach((set, index) => {
            if (set.completed) {
                exportText += '  ✓ Completed\n';
            } else if (set.weight || set.reps) {
                exportText += '  ' + set.weight + 'lbs × ' + set.reps;
                if (set.notes) exportText += ' (' + set.notes + ')';
                exportText += '\n';
            }
        });
        exportText += '\n';
    });

    // Copy to clipboard
    if (navigator.clipboard) {
        navigator.clipboard.writeText(exportText);
    } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = exportText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}
