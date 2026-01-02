# Visual Testing Guide for Critical Fixes

This guide provides step-by-step instructions to manually test and verify all three fixes.

## Prerequisites
- Access to Firebase Console for the fitness-command-center project
- Browser with developer console access

## Test 1: Timezone Correction

### Before Starting
Open browser console and check for timezone log:
```
Console should show: "Using timezone: America/Los_Angeles" or detected timezone
```

### Test 1.1: Verify Today's Date is LA Timezone
1. Open the app
2. Go to Workout tab
3. Check the "Log Past Workout" date input - it should show today's date in LA timezone
4. Complete any workout without changing the date
5. Go to Calendar tab
6. Verify the workout appears on today's date (LA timezone), not tomorrow

**Expected Result:** Workout logs on correct date according to LA timezone, even if you're testing late at night (e.g., 11pm PST should still be same day, not next day in UTC)

### Test 1.2: Manual Database Fix Required
**Action Required:** Move the workout from Nov 6 to Nov 5
1. Go to Firebase Console → Firestore Database
2. Navigate to `workouts` collection
3. Find the workout document with `date: "2024-11-06"`
4. Edit the document and change `date` field to `"2024-11-05"`
5. Save the change
6. Refresh the app
7. Go to Calendar tab
8. Navigate to November 2024
9. Verify Nov 5 now shows a completed Pull workout (green)
10. Verify Nov 6 shows "Legs" as scheduled workout (blue)

## Test 2: Food Logging Workflow

### Test 2.1: Meal Context - Manual Food Entry
1. Go to Nutrition tab
2. Click "Add Meal" button
3. Select "Breakfast"
4. New meal card appears with "🌅 Breakfast" header
5. Click "+ Add Food" button on the Breakfast meal
6. Fill in food details:
   - Name: "Eggs"
   - Protein: 12
   - Carbs: 1
   - Fats: 10
   - Calories: 150
7. Click another field to trigger change tracking
8. **Look for "💾 Save Changes" button** - it should appear below the "+ Add Food" button
9. Click "💾 Save Changes"
10. **Expected Alert:** "✅ Meal saved! Changes have been updated to the database and counted in daily calories."
11. Save Changes button should disappear after successful save

**Expected Result:** Manual edits require clicking Save Changes button, and confirmation is displayed.

### Test 2.2: Meal Context - Quick Add to Correct Meal
1. Still on Nutrition tab with Breakfast meal visible
2. Click "+ Add Food" on the Breakfast meal
3. Scroll down to "Saved Foods" section
4. If no saved foods exist, first save the Eggs food:
   - Click the "💾 Save" button next to the Eggs food entry (this saves it to library)
   - Alert: "Food saved to library!"
5. Now click "Quick Add" next to the saved food
6. Enter quantity: 2
7. Click OK
8. **Verify:** Food should be added to the Breakfast meal (not a different meal)
9. Food should auto-save (no manual save needed for Quick Add)

**Expected Result:** Quick Add adds food to the meal where "Add Food" was clicked, not based on time of day.

### Test 2.3: Multiple Meals - Context Switching
1. On Nutrition tab, click "Add Meal" again
2. Select "Lunch"
3. Click "+ Add Food" on the Lunch meal
4. Go to Saved Foods section
5. Click "Quick Add" on saved food
6. Enter quantity: 1
7. Click OK
8. **Verify:** Food should be added to Lunch meal, NOT to Breakfast
9. Create another meal (Dinner)
10. Without clicking "+ Add Food" on any meal, try clicking "Quick Add"
11. **Expected Alert:** "Please click 'Add Food' on the specific meal you want to add to, then use Quick Add."

**Expected Result:** Foods always add to the meal context that was last opened with "+ Add Food" button.

### Test 2.4: Retroactive Meal Logging
1. Change the date picker at top of Nutrition tab to yesterday's date
2. Click "Add Meal"
3. Select "Breakfast"
4. Click "+ Add Food"
5. Add food manually and save
6. Go to Saved Foods, click "Quick Add"
7. **Verify:** Food should add to yesterday's Breakfast (not today's)
8. Change date back to today
9. Click "Quick Add" on a saved food
10. **Expected Alert:** Should prompt to click Add Food first (context cleared when date changed)

**Expected Result:** Retroactive logging works correctly with meal context preserved within the same date.

## Test 3: Workout Calendar Logic

### Test 3.1: Verify Workout Sequencing (After Nov 6→Nov 5 Fix)
1. Go to Calendar tab
2. Navigate to November 2024
3. Verify the calendar shows:
   - **Nov 1**: (check based on actual data)
   - **Nov 2**: (check based on actual data)  
   - **Nov 3**: Should show "Push" (scheduled, possibly missed - shown in red if past)
   - **Nov 4**: Should show "Rest"
   - **Nov 5**: Should show "Pull" (completed - shown in green)
   - **Nov 6**: Should show "Legs" (next in sequence after Pull)
   - **Nov 7**: Should show "Rest"
   - **Nov 8**: Should show "Upper" (cycle restarts)

**Expected Result:** Workout sequence follows the 7-day cycle: Upper/Lower/Rest/Push/Pull/Legs/Rest, with progression based on the last completed non-rest workout (Pull on Nov 5).

### Test 3.2: Verify Rest Days Don't Break Sequence
1. Look at calendar history
2. Find any completed workout before a rest day
3. Verify the workout AFTER the rest day continues the sequence (doesn't reset)
4. Example: If Lower was completed, then Rest day, next day should show Push (not restarting at Upper)

**Expected Result:** Rest days don't interrupt the sequence - the cycle continues based on last completed non-rest workout.

### Test 3.3: Travel Days Handling
1. Go to Calendar tab
2. Scroll down to Travel Mode section
3. Add a travel period (e.g., Nov 10-12)
4. Click "Enable Travel Mode"
5. Calendar should refresh
6. Check Nov 10, 11, 12 - should show "✈️ Travel" with purple styling
7. Verify days around travel period still show correct workout sequence
8. Check adherence score - travel days should NOT count as missed workouts

**Expected Result:** Travel days show scheduled workout but don't affect adherence metrics or break the workout sequence.

### Test 3.4: Adherence Score Calculation
1. Go to Calendar tab
2. Check the adherence metrics at top:
   - "Adherence Score"
   - "Completed"
   - "Scheduled"
   - "Missed"
3. Verify:
   - Rest days NOT counted in scheduled or completed
   - Travel days NOT counted in scheduled or missed
   - Only actual training days (Upper/Lower/Push/Pull/Legs) are counted
   - Missed workouts only shown for past non-rest, non-travel days

**Expected Result:** Adherence calculation excludes rest and travel days, only tracks actual training day compliance.

## Verification Checklist

After completing all tests above, verify:

- [ ] Workouts log with correct LA timezone date
- [ ] Nov 5 shows Pull workout (moved from Nov 6)
- [ ] Nov 6 shows Legs as next workout
- [ ] Manual food edits show Save Changes button
- [ ] Save Changes button shows confirmation alert
- [ ] Quick Add adds to currently editing meal (not time-based)
- [ ] Quick Add prompts for meal selection if no meal context
- [ ] Retroactive meal logging maintains context
- [ ] Workout calendar sequences based on last completed non-rest workout
- [ ] Rest days don't break workout sequence
- [ ] Travel days show with ✈️ icon and don't penalize adherence
- [ ] Adherence score excludes rest and travel days

## Notes

- If Firebase connection fails, some tests cannot be completed (save operations will fail)
- Browser console may show helpful debug information
- All changes are minimal and surgical - existing data should work without migration
