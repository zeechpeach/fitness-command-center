# Body Goal & Dynamic Calorie Features Documentation

## Overview

This document describes the new body goal selection and dynamic calorie calculation features added to the Fitness Command Center.

## Features Summary

### 🎯 Body Goal Selection
Users can now set fitness goals with three options:
- **Cutting**: Losing weight (1 lb per week)
- **Bulking**: Gaining weight (0.5 lb per week)
- **Maintaining**: Maintaining current weight (±3 lbs tolerance)

### 📊 Dynamic Calorie Calculation
Calorie targets automatically adjust based on:
- Current body weight (from most recent log)
- Selected body goal type
- Standard formula: Maintenance = Weight × 14.5

### 📈 7-Day Moving Average
Weight tracking uses a 7-day moving average to:
- Smooth out daily water weight fluctuations
- Show true weight trends over time
- Provide accurate progress assessment

### ✅ Progress Tracking
Intelligent progress indicators show:
- Current status (On Track / Off Track)
- Trend analysis (trending up/down)
- Deviation from target (for maintaining)

## UI Components

### Body Tab Components

#### 1. Body Goal Card
**Location**: Body tab, below Weight Tracking card

**Elements**:
- **Goal Type Dropdown**: Select cutting/bulking/maintaining
- **Target Weight Input**: Enter goal weight in pounds
- **Goal Start Date Picker**: Track when goal began

**Styling**:
- Semi-transparent dark background (rgba(30, 41, 59, 0.4))
- Cyan/blue gradient borders on focus
- Rounded corners (16px border-radius)
- Responsive layout (stacks vertically on mobile)

#### 2. Goal Display Section
**Visibility**: Only shows after goal is set

**Displays**:
- **Current Weight**: Most recent weight entry
- **7-Day Moving Average**: Average of last 7 weight logs
- **Weight to Goal**: Absolute difference from target
- **Estimated Completion**: Calculated end date OR "Maintain current weight"

**Styling**:
- Cyan-tinted background (rgba(6, 182, 212, 0.1))
- Cyan border (rgba(6, 182, 212, 0.3))
- Key-value pair layout

#### 3. Progress Indicator
**Shows Two States**:

**On Track** (Green):
- Background: rgba(16, 185, 129, 0.1)
- Border: rgba(16, 185, 129, 0.3)
- Text color: #10b981
- Icon: ✅

**Off Track** (Orange):
- Background: rgba(251, 146, 60, 0.1)
- Border: rgba(251, 146, 60, 0.3)
- Text color: #fb923c
- Icon: ⚠️

### Nutrition Tab Components

#### Calorie Target Card
**Location**: Nutrition tab, between Daily Nutrition and Saved Foods

**Visibility**: Only shows when both goal AND weight data exist

**Elements**:
- **Maintenance Calories**: Base calorie needs (Weight × 14.5)
- **Target Calories**: Adjusted for goal (cutting/bulking/maintaining)
- **Calories Remaining**: Target minus consumed

**Calorie Adjustments**:
- Cutting: Maintenance - 500 calories
- Bulking: Maintenance + 250 calories
- Maintaining: Maintenance (no adjustment)

**Dynamic Colors for Remaining**:
- Green (#06b6d4): 200+ calories remaining
- Orange (#fb923c): 0-200 calories remaining
- Red (#ef4444): Negative (over target)

## Technical Implementation

### Data Structure

#### Firebase Collection: `bodyGoals`
```javascript
{
  bodyGoal: 'cutting' | 'bulking' | 'maintaining',
  targetWeight: number,          // in lbs
  goalStartDate: 'YYYY-MM-DD',  // ISO date string
  updatedAt: 'ISO8601 timestamp'
}
```

#### Global State Variables
```javascript
let bodyGoalData = null;        // Stores loaded goal data
window.bodyGoalData = bodyGoalData;
```

### Core Functions

#### 1. calculateMaintenanceCalories(weight)
```javascript
// Formula: Weight (lbs) × 14.5
// Example: 200 lbs × 14.5 = 2900 calories
return Math.round(weight * 14.5);
```

#### 2. calculateTargetCalories(weight, bodyGoal)
```javascript
const maintenance = calculateMaintenanceCalories(weight);

switch (bodyGoal) {
  case 'cutting':
    return maintenance - 500;   // 500 cal deficit
  case 'bulking':
    return maintenance + 250;   // 250 cal surplus
  case 'maintaining':
    return maintenance;         // No change
}
```

#### 3. calculate7DayMovingAverage(weightHistory)
```javascript
// Takes last 7 weight entries (or fewer if less available)
// Sorts by date descending
// Returns average weight
const last7 = sorted.slice(0, Math.min(7, sorted.length));
const sum = last7.reduce((acc, w) => acc + w.weight, 0);
return sum / last7.length;
```

#### 4. calculateGoalEndDate(currentWeight, targetWeight, goalStartDate, bodyGoal)
```javascript
// For cutting: 1 lb per week
// For bulking: 0.5 lb per week
// For maintaining: null (no end date)

const weightDiff = Math.abs(targetWeight - currentWeight);
let weeksToGoal;

if (bodyGoal === 'cutting') {
  weeksToGoal = weightDiff / 1.0;
} else if (bodyGoal === 'bulking') {
  weeksToGoal = weightDiff / 0.5;
}

// Add weeks to start date
const endDate = new Date(startDate);
endDate.setDate(startDate.getDate() + (weeksToGoal * 7));
return endDate.toISOString().split('T')[0];
```

#### 5. checkIfOnTrack(movingAverage, targetWeight, currentWeight, bodyGoal)
```javascript
// Returns: { isOnTrack: boolean, message: string }

if (bodyGoal === 'maintaining') {
  const deviation = Math.abs(movingAverage - targetWeight);
  return deviation <= 3 
    ? { isOnTrack: true, message: 'On Track ✅ (within ±3 lbs)' }
    : { isOnTrack: false, message: `Off Track ⚠️ (${deviation.toFixed(1)} lbs from target)` };
}

if (bodyGoal === 'cutting') {
  return movingAverage <= currentWeight
    ? { isOnTrack: true, message: 'On Track ✅ (trending downward)' }
    : { isOnTrack: false, message: 'Off Track ⚠️ (not trending downward)' };
}

if (bodyGoal === 'bulking') {
  return movingAverage >= currentWeight
    ? { isOnTrack: true, message: 'On Track ✅ (trending upward)' }
    : { isOnTrack: false, message: 'Off Track ⚠️ (not trending upward)' };
}
```

### Event Triggers

#### Automatic Updates Occur When:
1. **Body goal is saved** → Updates display and nutrition calories
2. **Weight is logged** → Recalculates everything
3. **Tab is switched** → Refreshes current tab's display
4. **Meal is added/edited** → Updates calories remaining

### Integration Points

#### Modified Functions:
- `logWeight()`: Added calls to `updateBodyGoalDisplay()` and `updateNutritionCalories()`
- `updateNutritionSummary()`: Added call to `updateNutritionCalories()`
- Tab event listeners: Added update calls for body and nutrition tabs

#### New Functions Added:
- `loadBodyGoalData()`: Loads goal from Firebase on init
- `populateBodyGoalForm()`: Fills form with saved data
- `saveBodyGoal()`: Saves goal to Firebase with validation
- `updateBodyGoalDisplay()`: Refreshes body tab display
- `updateNutritionCalories()`: Refreshes nutrition tab display
- `calculateTotalCalories()`: Sums current day's meal calories

## Mobile Responsiveness

### Breakpoint: 768px
**Changes for mobile**:
- `goal-input-row`: Stacks vertically (flex-direction: column)
- `goal-input-group`: Full width (min-width: 100%)
- `calorie-breakdown`: Stacks vertically
- `calorie-item`: Full width

### Touch Targets
All interactive elements meet minimum 44px height for touch accessibility.

## Edge Case Handling

### No Weight Data
- Goal can still be saved
- Display shows "-- lbs" for weight values
- Calorie Target card hidden in Nutrition tab
- Progress indicator shows "Set your goal to track progress"

### Fewer Than 7 Days of Weight Data
- Moving average calculates from available entries
- Function handles 1-6 entries gracefully
- Shows hint text if desired: "(need 7 days)"

### Invalid Input
- **Negative weight**: Alert shown, save prevented
- **Non-numeric weight**: Alert shown, save prevented
- **Missing required fields**: Save skipped, console logged only

### Data Persistence
- Body goal data loads on app initialization
- Form fields pre-populate with saved values
- All calculations refresh after page reload

## User Experience Flow

### First-Time Setup
1. User navigates to Body tab
2. Sees empty Body Goal card
3. Selects goal type, enters target weight, sets start date
4. Goal auto-saves to Firebase
5. Goal display section appears (if weight data exists)

### Daily Weight Logging
1. User logs morning weight
2. Weight chart updates immediately
3. Moving average recalculates
4. Body goal display updates
5. Nutrition tab calorie targets update automatically
6. Progress indicator refreshes with new status

### Meal Tracking
1. User adds meals throughout day
2. Total calories update in real-time
3. Calories Remaining automatically adjusts
4. Color indicator shows progress (green/orange/red)

## Benefits

### For Cutting (Weight Loss)
- Clear daily calorie target (500 cal deficit)
- Moving average shows true fat loss (ignoring water fluctuations)
- Realistic timeline (1 lb/week = ~52 lbs/year)
- Progress indicator confirms downward trend

### For Bulking (Muscle Gain)
- Controlled surplus (250 cal = minimal fat gain)
- Steady progress tracking (0.5 lb/week)
- Prevents excessive fat accumulation
- Progress indicator confirms upward trend

### For Maintaining
- Flexible range (±3 lbs accounts for normal fluctuations)
- Early warning system for weight drift
- Sustainable long-term approach
- Balance without rigid precision

## Future Enhancement Ideas

### Potential Additions
- Adjustable rate of change (customize lb/week)
- Protein target recommendations (1g per lb body weight)
- Historical goal tracking (multiple goals over time)
- Goal streak tracking (consecutive days on track)
- Integration with workout volume (adjust calories for training days)
- Export goal progress to PDF/CSV
- Goal milestone celebrations
- Before/after photo comparison tied to goals

### Advanced Features
- Machine learning prediction of actual rate of change
- Adaptive calorie adjustments based on real progress
- Seasonal bulk/cut cycle planning
- Body composition estimates (lean mass vs fat)
- Metabolic adaptation detection

## Testing Checklist

See [BODY_GOAL_TESTING_GUIDE.md](./BODY_GOAL_TESTING_GUIDE.md) for comprehensive test scenarios.

## Summary

The body goal and dynamic calorie features provide:
- **Goal-oriented tracking** with three distinct modes
- **Automatic calorie adjustments** based on current weight
- **Intelligent progress indicators** using moving averages
- **Realistic timelines** based on healthy rates of change
- **Seamless integration** with existing workout and nutrition features
- **Mobile-optimized UI** for on-the-go tracking

All features maintain the existing dark mode aesthetic with cyan/blue gradients and integrate naturally into the existing tab structure.
