# Body Goal & Dynamic Calorie Testing Guide

This guide provides step-by-step instructions for testing the new body goal selection and dynamic calorie calculation features.

## Prerequisites

- Firebase backend must be accessible
- Browser with JavaScript enabled
- Access to the Fitness Command Center application

## Test Scenarios

### 1. Body Goal Setup (Body Tab)

#### Test Case 1.1: Set a Cutting Goal
1. Navigate to the **⚖️ Body** tab
2. In the **🎯 Body Goal** card:
   - Select "Cutting (Lose Weight)" from Goal Type dropdown
   - Enter a target weight lower than your current weight (e.g., if current is 200 lbs, enter 180 lbs)
   - Select today's date as Goal Start Date
3. **Expected Results**:
   - All three fields should be saved to Firebase automatically
   - Goal display section should appear showing:
     - Current Weight (if weight data exists)
     - 7-Day Moving Average (if at least 1 weight entry exists)
     - Weight to Goal (difference in lbs)
     - Estimated Completion date (based on 1 lb/week loss)
   - Progress indicator should show status

#### Test Case 1.2: Set a Bulking Goal
1. Navigate to the **⚖️ Body** tab
2. In the **🎯 Body Goal** card:
   - Select "Bulking (Gain Weight)" from Goal Type dropdown
   - Enter a target weight higher than your current weight (e.g., if current is 180 lbs, enter 195 lbs)
   - Select today's date as Goal Start Date
3. **Expected Results**:
   - Estimated Completion date should be calculated based on 0.5 lb/week gain
   - Progress indicator should show if trending upward

#### Test Case 1.3: Set a Maintaining Goal
1. Navigate to the **⚖️ Body** tab
2. In the **🎯 Body Goal** card:
   - Select "Maintaining (Stay Current)" from Goal Type dropdown
   - Enter your current weight as target weight
   - Select today's date as Goal Start Date
3. **Expected Results**:
   - Estimated Completion should show "Goal: Maintain current weight"
   - Progress indicator should show "On Track ✅" if within ±3 lbs of target

#### Test Case 1.4: Input Validation
1. Try to enter negative target weight → Should see alert
2. Try to enter non-numeric value → Should see alert
3. Try to save without selecting goal type → No save action, console log only

### 2. Weight Logging & Auto-Updates

#### Test Case 2.1: Log First Weight Entry
1. Navigate to the **⚖️ Body** tab
2. In the **⚖️ Weight Tracking** card:
   - Select today's date
   - Enter your current weight (e.g., 200 lbs)
   - Click "Log Weight"
3. **Expected Results**:
   - Success alert appears
   - Weight chart updates
   - Body goal display section appears (if goal is set)
   - Current Weight field updates
   - 7-Day Moving Average shows (with just 1 entry, it equals current weight)
   - Navigate to **🍎 Nutrition** tab → Calorie Target card should appear

#### Test Case 2.2: Log Multiple Weight Entries
1. Log weight entries for 7 consecutive days:
   - Day 1: 200 lbs
   - Day 2: 199.5 lbs
   - Day 3: 199.8 lbs
   - Day 4: 199.2 lbs
   - Day 5: 198.9 lbs
   - Day 6: 199.1 lbs
   - Day 7: 198.5 lbs
2. **Expected Results**:
   - 7-Day Moving Average should show ~199.3 lbs (smoothed average)
   - Weight chart should show daily fluctuations
   - For cutting goal: Progress should show "On Track ✅" (trending downward)

#### Test Case 2.3: Weight Change Triggers Calorie Update
1. Log a new weight entry
2. Immediately navigate to **🍎 Nutrition** tab
3. **Expected Results**:
   - Maintenance Calories should update (new weight × 14.5)
   - Target Calories should update based on goal:
     - Cutting: Maintenance - 500
     - Bulking: Maintenance + 250
     - Maintaining: Maintenance

### 3. Nutrition Tab - Calorie Targets

#### Test Case 3.1: View Calorie Targets (Cutting)
1. Ensure you have:
   - A cutting goal set (e.g., 200 lbs → 180 lbs)
   - Current weight logged (e.g., 200 lbs)
2. Navigate to **🍎 Nutrition** tab
3. **Expected Results**:
   - **🎯 Calorie Target** card appears
   - Maintenance shows: 2900 (200 × 14.5)
   - Cutting Goal shows: 2400 (2900 - 500)
   - Remaining shows: 2400 (if no meals logged)

#### Test Case 3.2: View Calorie Targets (Bulking)
1. Set bulking goal and log weight (e.g., 180 lbs → 195 lbs, current 180 lbs)
2. Navigate to **🍎 Nutrition** tab
3. **Expected Results**:
   - Maintenance shows: 2610 (180 × 14.5)
   - Bulking Goal shows: 2860 (2610 + 250)
   - Remaining shows: 2860 (if no meals logged)

#### Test Case 3.3: Calorie Remaining Updates with Meals
1. Navigate to **🍎 Nutrition** tab
2. Click "+ Add Meal" and add breakfast:
   - Food: Oatmeal, 400 calories
3. **Expected Results**:
   - Total Calories updates to 400
   - Calories Remaining updates (Target - 400)
   - Remaining value turns orange/red if close to target

### 4. Goal Progress Tracking

#### Test Case 4.1: On-Track Status (Cutting)
1. Set cutting goal: 200 lbs → 180 lbs
2. Log decreasing weights over 7 days showing downward trend
3. Navigate to **⚖️ Body** tab
4. **Expected Results**:
   - Progress indicator shows "On Track ✅ (trending downward)"
   - Green background color on indicator

#### Test Case 4.2: Off-Track Status (Cutting)
1. Set cutting goal: 200 lbs → 180 lbs
2. Log increasing weights over several days
3. Navigate to **⚖️ Body** tab
4. **Expected Results**:
   - Progress indicator shows "Off Track ⚠️ (not trending downward)"
   - Orange background color on indicator

#### Test Case 4.3: Maintaining Within Range
1. Set maintaining goal: 180 lbs target
2. Log weights fluctuating within ±3 lbs (e.g., 178, 181, 179, 182)
3. **Expected Results**:
   - Progress indicator shows "On Track ✅ (within ±3 lbs of target)"

#### Test Case 4.4: Maintaining Out of Range
1. Set maintaining goal: 180 lbs target
2. Log weights outside ±3 lbs range (e.g., 185, 186, 187)
3. **Expected Results**:
   - Progress indicator shows "Off Track ⚠️ (X lbs from target)"

### 5. Goal End Date Calculations

#### Test Case 5.1: Cutting End Date
1. Set cutting goal:
   - Current: 200 lbs
   - Target: 180 lbs
   - Start date: Today
2. **Expected Results**:
   - Weight to Goal: 20 lbs
   - Weeks to goal: 20 weeks (20 lbs ÷ 1 lb/week)
   - Estimated Completion: Today's date + 140 days (20 weeks)

#### Test Case 5.2: Bulking End Date
1. Set bulking goal:
   - Current: 180 lbs
   - Target: 190 lbs
   - Start date: Today
2. **Expected Results**:
   - Weight to Goal: 10 lbs
   - Weeks to goal: 20 weeks (10 lbs ÷ 0.5 lb/week)
   - Estimated Completion: Today's date + 140 days (20 weeks)

#### Test Case 5.3: Maintaining - No End Date
1. Set maintaining goal
2. **Expected Results**:
   - Estimated Completion shows: "Goal: Maintain current weight"

### 6. Edge Cases

#### Test Case 6.1: No Weight Data
1. Clear all weight entries from Firebase
2. Set a body goal
3. **Expected Results**:
   - Body goal card saves successfully
   - Goal display section shows "-- lbs" for all values
   - Calorie Target card does NOT appear in Nutrition tab
   - Progress indicator shows "Set your goal to track progress"

#### Test Case 6.2: Less Than 7 Days of Weight Data
1. Log only 3 weight entries
2. Navigate to **⚖️ Body** tab
3. **Expected Results**:
   - 7-Day Moving Average calculates from available 3 entries
   - Display shows "(need 7 days)" hint if desired

#### Test Case 6.3: Data Persistence
1. Set body goal and log weights
2. Close browser
3. Reopen application
4. **Expected Results**:
   - Body goal fields pre-populate with saved values
   - Goal display shows current data
   - Calorie targets show in Nutrition tab

### 7. Mobile Responsiveness

#### Test Case 7.1: Mobile View (< 768px)
1. Resize browser to mobile width or use DevTools mobile emulation
2. Navigate through tabs
3. **Expected Results**:
   - Goal input fields stack vertically
   - Calorie breakdown items stack vertically
   - All buttons remain accessible (min 44px height)
   - Text remains readable
   - No horizontal scrolling needed

## Success Criteria

✅ All body goal selections save to Firebase and persist  
✅ Weight logging triggers automatic calorie recalculation  
✅ 7-day moving average smooths daily fluctuations  
✅ Progress tracking accurately reflects goal status  
✅ Goal end dates calculate correctly for cutting/bulking  
✅ Maintaining goal alerts for ±3 lbs deviation  
✅ Calorie targets update in real-time  
✅ Mobile layout is fully responsive  
✅ Input validation prevents invalid data  
✅ All existing features remain functional  

## Known Limitations

- Calorie targets only appear when both goal AND weight data exist
- Moving average requires at least 1 weight entry (will show single value until 7 entries exist)
- Firebase must be accessible for all features to work

## Troubleshooting

**Issue**: Calorie Target card doesn't appear  
**Solution**: Ensure you have both a body goal set AND at least one weight entry logged

**Issue**: Progress indicator always shows "Set your goal to track progress"  
**Solution**: Make sure all three goal fields are filled (Goal Type, Target Weight, Goal Start Date)

**Issue**: Changes don't persist after refresh  
**Solution**: Check browser console for Firebase connection errors

**Issue**: 7-Day Moving Average shows "-- lbs"  
**Solution**: Log at least one weight entry to see the moving average
