# Zach's Fitness Command Center

A comprehensive personal fitness management platform with intelligent workout tracking, performance analytics, nutrition monitoring, and body metrics tracking.

## Features

### 🏋️ Workout Tracking
- Track exercises with sets, reps, and weight
- Record workout intensity (energy, motivation, fatigue, satisfaction)
- View previous session data for progressive overload
- AI-powered workout suggestions based on performance
- Exercise approach variations (Standard, Heavy, Form Focus)
- Exercise substitutions for travel or equipment limitations
- Scrollable workout history display

### 📅 Calendar & Schedule
- Visual calendar showing your workout schedule
- 7-day repeating cycle: Upper/Lower/Rest/Push/Pull/Legs/Rest
- Color-coded workout types
- Click any date to view workout details
- Adherence tracking with discipline score
- View completed, scheduled, and missed workouts
- Automatic schedule calculation based on cycle

### 🍎 Nutrition Tracking
- Log meals throughout the day
- Track macros: Protein, Carbs, Fats, Calories
- Daily nutrition summaries
- Date selection to view/edit past nutrition data
- Multiple meals per day with multiple foods per meal
- Real-time macro totals

### ⚖️ Body Metrics
- Daily weight logging
- Weight progress charts over time
- Progress photo uploads with date stamps
- Photo gallery showing transformation over time
- Visual correlation between weight and photos

### 📊 Analytics & Insights
- Total volume tracking
- Personal record monitoring
- Workout streak calculation
- Overload score with detailed breakdown
- Volume trends by workout type
- Strength progression charts
- Muscle group balance analysis
- Rep range analysis
- PR timeline visualization
- AI-generated workout insights
- Plateau detection and suggestions

## Workout Schedule Cycle

The application follows a 7-day repeating workout schedule:

1. **Upper** - Upper body focus (chest, back, shoulders, arms)
2. **Lower** - Lower body focus (legs, glutes)
3. **Rest** - Recovery day
4. **Push** - Push muscles (chest, shoulders, triceps)
5. **Pull** - Pull muscles (back, biceps)
6. **Legs** - Legs focus (quads, hamstrings, calves)
7. **Rest** - Recovery day

The cycle automatically repeats, and the calendar shows which workout is scheduled for each day.

## Exercise Approach Variations

For each exercise, you can select different approaches without affecting progressive overload tracking:

- **Standard**: Normal training approach
- **Heavy**: Lower reps with heavier weight for power development
- **Form Focus**: Lighter weight emphasizing technique and mind-muscle connection
- **Alt Exercise**: Substitute with an alternative exercise when traveling or equipment is unavailable

These variations are tagged and saved with your workout data for future reference.

## Data Storage

All data is stored in Firebase Firestore with the following collections:

- **workouts**: Exercise data, sets, reps, weights, intensity ratings
- **nutrition**: Meals, foods, macros, calories
- **weight**: Daily weight entries
- **photos**: Progress photos with dates

## Usage

### Logging a Workout
1. Select your workout day (Upper, Lower, etc.)
2. Rate your pre-workout energy and motivation
3. Enter weights and reps for each exercise
4. Add approach variations or substitutions as needed
5. Rate your post-workout fatigue and satisfaction
6. Click "Complete Session" to save

### Tracking Nutrition
1. Go to the Nutrition tab
2. Click "Add Meal" to create a new meal
3. Add foods with their macro values
4. View daily totals at the top
5. Use date selector to view past days

### Logging Weight & Photos
1. Go to the Body Metrics tab
2. Enter weight and date, click "Log Weight"
3. Click the photo upload area to add progress photos
4. View charts and gallery showing your progress

### Viewing Calendar
1. Go to the Calendar tab
2. View your adherence score and stats
3. Navigate months with prev/next buttons
4. Click any date to see workout details
5. Color indicators show completed (green), scheduled (blue), and missed (red) workouts

## Browser Compatibility

This application works best in modern browsers with JavaScript enabled:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- Firebase 10.12.0 (Firestore for data storage)
- Chart.js 3.9.1 (for analytics visualizations)
- chartjs-adapter-date-fns (for time-series charts)

## Privacy

All data is stored in your personal Firebase project. No data is shared with third parties.

## Future Enhancements

Potential features for future development:
- Exercise library with video demonstrations
- Workout templates and programs
- Social features (share progress, compete with friends)
- Export data to CSV/PDF
- Mobile app version
- Workout timer and rest period tracking
- Integration with fitness wearables
