# Meal Tracking Functionality Test Guide

This guide will help you test all the new meal tracking features implemented in this PR.

## Prerequisites

1. Open `index.html` in a web browser
2. Ensure you have internet connection (for Firebase)
3. Open browser console (F12 or Right-click → Inspect → Console)

## Test Scenarios

### 1. Manual Meal Type Selection

**Test adding a new meal with manual type selection:**

1. Click on the "🍎 Nutrition" tab
2. Click the "+ Add Meal" button at the bottom
3. A modal should appear with 4 meal type options:
   - 🌅 Breakfast
   - ☀️ Lunch
   - 🌙 Dinner
   - 🍪 Snack
4. Select any meal type
5. Verify a new meal card appears with the selected type

**Expected Result:** 
- Modal appears and closes on selection
- Meal is created with the chosen type
- No automatic assignment based on time of day

---

### 2. Edit Existing Meal Type

**Test changing meal type after creation:**

1. Create a meal (any type)
2. In the meal card header, you should see a dropdown showing the current meal type
3. Click the dropdown and select a different meal type
4. The meal type should update immediately

**Expected Result:**
- Dropdown shows current meal type
- Selecting new type updates the meal
- Change persists to Firestore

---

### 3. Individual Food Item Deletion

**Test deleting individual foods from a meal:**

1. Create a meal and add 3+ foods to it
2. Fill in some data for each food
3. Click the 🗑️ button next to one food item
4. Confirm the deletion
5. Verify only that food is removed
6. Meal card should remain with other foods

**Test deleting last food in a meal:**

1. Create a meal with only 1 food
2. Click the 🗑️ button next to the food
3. Confirm the deletion
4. Verify the entire meal is deleted

**Expected Result:**
- Individual foods can be deleted
- Meal remains if other foods exist
- Entire meal is deleted if last food is removed
- Changes persist to Firestore

---

### 4. Fix Duplicate Meals

**Test that meal updates don't create duplicates:**

1. Create a meal
2. Add a food item to the meal
3. Edit the food's macros (protein, carbs, fats, calories)
4. Wait 1-2 seconds for auto-save
5. Refresh the page
6. Verify only ONE instance of the meal appears

**Expected Result:**
- Editing food creates no duplicates
- Only one meal with updated data appears after refresh
- No "ghost" entries

---

### 5. Data Reset

**Test wiping all nutrition data:**

1. Create several meals with foods
2. Save some foods to library
3. Open browser console (F12)
4. Type: `window.wipeNutritionData()`
5. Press Enter
6. Confirm TWICE (it asks for double confirmation)
7. Verify all meals and saved foods are deleted
8. Verify UI shows empty state

**Expected Result:**
- Double confirmation required
- All nutrition data deleted from Firestore
- All saved foods deleted
- UI refreshes to show empty state
- Console shows deletion count

---

### 6. Error Handling

**Test error messages:**

1. **Cancel meal creation:**
   - Click "+ Add Meal"
   - Click "Cancel" in the modal
   - Verify no meal is created

2. **Delete confirmation cancel:**
   - Create a meal
   - Click Delete on meal or food
   - Click "Cancel" in confirmation
   - Verify nothing is deleted

**Expected Result:**
- Canceling operations works correctly
- No unwanted deletions occur
- Error messages are user-friendly

---

## Visual Verification Checklist

### Meal Type Modal
- [ ] Modal appears centered on screen
- [ ] Modal has semi-transparent dark overlay
- [ ] Four meal type buttons are clearly visible
- [ ] Buttons have hover effects
- [ ] Cancel button works

### Meal Cards
- [ ] Meal type dropdown is visible and styled
- [ ] Dropdown shows current meal type selected
- [ ] Delete button (🗑️) appears next to each food
- [ ] Save button (💾) still works for saving to library
- [ ] Layout is responsive on mobile

### Food Items
- [ ] Delete button doesn't break layout
- [ ] All input fields still work
- [ ] Quantity multiplier still displays correctly

---

## Browser Console Commands

### Useful debugging commands:

```javascript
// View current nutrition data
console.log(window.nutritionData);

// View saved foods
console.log(window.savedFoods);

// Wipe all nutrition data (with confirmation)
window.wipeNutritionData();

// Check for duplicates
const dates = window.nutritionData.map(m => m.date);
console.log('Unique dates:', new Set(dates).size, 'Total meals:', dates.length);
```

---

## Known Behaviors

1. **Auto-save debouncing**: Food edits are saved to Firestore after 1 second of no typing
2. **Empty meals**: If you delete all foods from a meal, the entire meal is removed
3. **Meal time**: Displayed time is when the meal was created (not editable)
4. **Data wipe**: Requires TWO confirmations to prevent accidental deletion

---

## Firebase Authentication

If you have Firebase authentication enabled:

1. All operations should work the same
2. Data is scoped to your account
3. Error messages will indicate auth issues if any
4. Check Firestore rules are configured correctly

---

## Troubleshooting

### Issue: Modal doesn't appear
**Solution:** Check browser console for errors. Verify `meal-type-modal` div exists in HTML.

### Issue: Deletes don't persist
**Solution:** Check internet connection and Firestore permissions.

### Issue: Duplicate meals after refresh
**Solution:** This should be fixed. If still occurring, run `window.wipeNutritionData()` and start fresh.

### Issue: Can't edit meal type
**Solution:** Verify dropdown is rendering. Check console for errors.

---

## Success Criteria

All features working correctly if:

1. ✅ Can manually select meal type when adding meals
2. ✅ Can change meal type via dropdown after creation
3. ✅ Can delete individual foods without deleting meal
4. ✅ Deleting last food removes entire meal
5. ✅ No duplicate meals appear after edits
6. ✅ Data wipe utility clears all nutrition data
7. ✅ Error messages are clear and helpful
8. ✅ All changes persist to Firestore
9. ✅ UI is responsive and well-styled
10. ✅ No console errors during normal operation

---

## Reporting Issues

If you find any issues:

1. Note the exact steps to reproduce
2. Check browser console for errors
3. Note which browser/version you're using
4. Include screenshots if visual issues
5. Report in the PR comments

---

## Clean Slate Setup

To start with clean data for testing:

1. Open browser console
2. Run: `window.wipeNutritionData()`
3. Confirm twice
4. Refresh page
5. Start testing from scratch

This ensures no old/corrupted data interferes with testing.
