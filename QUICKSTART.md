# Fitness Command Center - Quick Start Guide

## 🚀 Getting Started

1. **Open the App**: Simply open `index.html` in any modern web browser
2. **First Time Setup**: 
   - Click the ⚙️ Settings button
   - Create your first program
   - Add saved foods to your database
   - Set your body goals

## 📋 Creating Your First Program

1. Click **Settings** → **Programs** → **+ Add Program**
2. Enter program details:
   - **Name**: e.g., "Push Pull Legs"
   - **Cycle Length**: Number of days in your cycle (e.g., 7 for a weekly split)
   - **Program Structure**: Copy the structure from `sample-program.json` or create your own

### Program Structure Format

```json
{
  "Day 1": [
    {
      "name": "Barbell Bench Press",
      "sets": 4,
      "reps": "8-12"
    },
    {
      "name": "Incline Dumbbell Press",
      "sets": 3,
      "reps": "10-12"
    }
  ],
  "Day 2": [...],
  "Day 7": []
}
```

**Note**: Empty array `[]` for Day 7 means it's a rest day.

## 💪 Logging Workouts

1. Select your program from the dropdown
2. Navigate to the **Workout** tab
3. Click on an exercise to expand it
4. Enter your sets:
   - **Weight**: Amount lifted (lbs)
   - **Reps**: Number of repetitions
   - **Notes**: Optional form notes or feelings
5. Use the **↑ button** to copy the previous set's weight/reps
6. Click **Complete Workout** when finished

### Tips:
- Previous session data is shown above each exercise
- Exercises can be collapsed/expanded by clicking the header
- Your workout is auto-saved as you type

## 📅 Using the Calendar

The calendar automatically:
- Shows **completed workouts** (green)
- Highlights **missed workouts** (red)
- Displays **scheduled workouts** (blue)
- Marks **today** with a cyan border

The **Discipline Score** shows:
- Completed: Total workouts done
- Missed: Workouts you should have done but didn't
- Discipline %: Your adherence rate

## 🍎 Tracking Nutrition

### Adding Foods to Database

1. **Settings** → **Saved Foods** → **+ Add Food**
2. Enter:
   - Food name (e.g., "Chicken Breast")
   - Serving size (e.g., "100g")
   - Macros per serving

### Logging Daily Meals

1. **Nutrition** tab → **+ Add Meal**
2. Select meal type (Breakfast, Lunch, Dinner, Snack)
3. Search for foods in your database
4. Enter number of servings
5. Click **Save Meal**

The sticky macro totals update automatically!

## ⚖️ Body Metrics

### Logging Weight

1. **Body Metrics** tab
2. Enter weight in the input field
3. Click **Save Weight**
4. View your progress on the chart

### Setting Goals

1. **Settings** → **Body Goals**
2. Enter:
   - Current weight
   - Goal weight
   - Goal type (Lose/Gain/Maintain)
3. Click **Save Goals**

The app will automatically calculate:
- Daily calorie targets
- Recommended macro breakdown
- Progress toward your goal

## 📊 Analytics & Progress

### Analytics Tab Shows:
- **Personal Records**: Your best lifts with estimated 1RM
- **Trending Exercises**: Exercises where you're making the most progress
- **Needs Attention**: Exercises you haven't done in 14+ days

### Progress Tab:
- Select any exercise from the dropdown
- View your last 5 sessions
- Track set-by-set progression over time

## 🔄 Data Storage

All data is stored in your browser's localStorage by default:
- ✅ Works completely offline
- ✅ No account required
- ✅ Private and secure
- ⚠️ Don't clear browser data or you'll lose your logs

### Optional: Firebase Setup

To sync across devices, add your Firebase config in `index.html`:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-project-id",
    // ... other config
};
```

## 📱 Mobile Usage

The app is fully responsive and mobile-friendly:
- Swipeable tab navigation
- Touch-optimized buttons
- Mobile-first design
- Works great on phones and tablets

## 💡 Pro Tips

1. **Copy Previous Set**: Use the ↑ button to quickly fill in sets based on your last set
2. **Rest Days**: Leave days empty in your program structure (e.g., `"Day 7": []`)
3. **Progressive Overload**: Watch the "Last:" indicator to ensure you're progressing
4. **Discipline Score**: Aim for 80%+ to stay on track
5. **Food Database**: Build your database with foods you eat regularly for faster logging
6. **Weekly Review**: Check Analytics tab weekly to identify trends

## 🔧 Troubleshooting

**Q: My workout isn't showing**  
A: Make sure you've selected a program from the dropdown

**Q: Calendar shows wrong schedule**  
A: The schedule is calculated from your program start date (stored automatically)

**Q: Lost my data**  
A: Data is in localStorage - avoid clearing browser data. Set up Firebase to prevent this.

**Q: Can't find a food**  
A: You need to add foods to your database first in Settings

**Q: Chart not showing**  
A: Make sure you have Chart.js loaded (included via CDN in the HTML)

## 📊 Data Structure

All localStorage keys:
- `programs`: Array of your workout programs
- `workout-YYYY-MM-DD`: Daily workout data
- `nutrition-YYYY-MM-DD`: Daily nutrition data
- `workoutCompletions`: Array of completion dates
- `savedFoods`: Your food database
- `weights`: Array of weight entries
- `bodyGoals`: Your goal settings

## 🎯 Sample Workout Programs

See `sample-program.json` for a complete 6-day Push/Pull/Legs program you can copy and use!

---

**Need help?** All features work without configuration - just open the app and start tracking! 💪
