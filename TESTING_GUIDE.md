# Testing Guide for Nutrition Fixes

## Manual Test Cases

### Test 1: Quick Add with Quantity Prompt
**Steps**:
1. Open the app and navigate to Nutrition tab
2. Save a food (e.g., "Hard-Boiled Egg" with 6g protein, 0.6g carbs, 5.3g fats, 78 calories)
3. Click "Quick Add" on the saved food
4. When prompted "How many servings?", enter "4"
5. Verify the food is added to the meal

**Expected Results**:
- ✅ Prompt appears asking "How many servings?" with default value "1"
- ✅ ONE food entry is created (not 4 separate entries)
- ✅ Quantity field shows "4"
- ✅ Calculated values appear below base values:
  - Protein: 6g with "24.0g" below
  - Carbs: 0.6g with "2.4g" below
  - Fats: 5.3g with "21.2g" below
  - Calories: 78 with "312" below
- ✅ Daily total shows 24g protein, 2.4g carbs, 21.2g fats, 312 calories

### Test 2: Prevent Duplicate Meals - Same Time Window
**Steps**:
1. Set system time to 9:00 AM (or any time before 11:00 AM)
2. Quick Add "Food A" → Enter quantity "1"
3. Immediately Quick Add "Food B" → Enter quantity "2"
4. Check the UI

**Expected Results**:
- ✅ Only ONE "Breakfast" meal card exists
- ✅ The meal card contains 2 food entries (Food A and Food B)
- ✅ No duplicate "Breakfast" cards with different timestamps
- ✅ Totals correctly sum both foods with their quantities

### Test 3: Different Meal Times
**Steps**:
1. At 9:00 AM: Quick Add "Eggs" → Quantity: 2
2. At 12:00 PM: Quick Add "Chicken" → Quantity: 1
3. At 6:00 PM: Quick Add "Salmon" → Quantity: 1
4. At 9:00 PM: Quick Add "Protein Shake" → Quantity: 1
5. Check the UI

**Expected Results**:
- ✅ 4 separate meal cards:
  - Breakfast (with Eggs, Qty: 2)
  - Lunch (with Chicken, Qty: 1)
  - Dinner (with Salmon, Qty: 1)
  - Snack (with Protein Shake, Qty: 1)
- ✅ Each meal has correct timestamp
- ✅ No duplicate meal cards

### Test 4: Decimal Quantities
**Steps**:
1. Quick Add a food
2. Enter quantity "1.5"
3. Check the calculated values

**Expected Results**:
- ✅ Quantity field accepts decimal value "1.5"
- ✅ Calculated values are correct (base × 1.5)
- ✅ Daily totals include the decimal quantity correctly

### Test 5: Cancel Quantity Prompt
**Steps**:
1. Click "Quick Add" on a saved food
2. When prompted, click "Cancel" (or press Escape)
3. Check the UI

**Expected Results**:
- ✅ No meal is created
- ✅ No food is added
- ✅ UI remains unchanged

### Test 6: Invalid Quantity Input
**Steps**:
1. Quick Add a food
2. Enter quantity "0"
3. Check for alert

**Expected Results**:
- ✅ Alert appears: "Please enter a positive quantity"
- ✅ No meal is created
- ✅ Prompt can be tried again

### Test 7: Manual Quantity Adjustment
**Steps**:
1. Add a food manually (or via Quick Add)
2. Find the food entry in the meal
3. Change the Qty input from 1 to 3
4. Check calculated values

**Expected Results**:
- ✅ Calculated values appear immediately below each macro
- ✅ Daily totals update automatically
- ✅ No page refresh needed

### Test 8: Backward Compatibility
**Steps**:
1. If you have existing foods in Firebase without quantity field
2. Load the nutrition tab
3. Check how they display

**Expected Results**:
- ✅ Existing foods display normally
- ✅ Quantity defaults to 1 (shown in input)
- ✅ No calculated values shown (since quantity = 1)
- ✅ Totals are correct
- ✅ Can edit quantity to any value

### Test 9: Multiple Quick Adds to Existing Meal
**Steps**:
1. At 9:00 AM: Quick Add "Eggs" → Quantity: 2
2. Wait 5 seconds
3. At 9:00 AM (still): Quick Add "Bacon" → Quantity: 3
4. Wait 5 seconds
5. At 9:05 AM: Quick Add "Toast" → Quantity: 1
6. Check the UI

**Expected Results**:
- ✅ Only ONE "Breakfast" meal card
- ✅ Contains 3 food entries: Eggs (Qty: 2), Bacon (Qty: 3), Toast (Qty: 1)
- ✅ Single timestamp on the meal card
- ✅ Totals correctly sum all foods with quantities

### Test 10: Edge Case - Midnight Crossing
**Steps**:
1. At 11:00 PM: Quick Add "Snack A" → Quantity: 1
2. At 11:30 PM: Quick Add "Snack B" → Quantity: 1
3. Check the UI

**Expected Results**:
- ✅ Both foods added to "Snack" meal (after 8pm = Snack)
- ✅ Only ONE "Snack" meal card
- ✅ Contains both foods

## Automated Logic Tests

### Test: Time-Based Meal Type
```javascript
// Test function
function testMealTypeByTime(hour) {
    let mealType;
    if (hour < 11) mealType = 'Breakfast';
    else if (hour < 15) mealType = 'Lunch';
    else if (hour < 20) mealType = 'Dinner';
    else mealType = 'Snack';
    return mealType;
}

// Expected results
testMealTypeByTime(0)   // → "Breakfast"
testMealTypeByTime(5)   // → "Breakfast"
testMealTypeByTime(10)  // → "Breakfast"
testMealTypeByTime(11)  // → "Lunch"
testMealTypeByTime(12)  // → "Lunch"
testMealTypeByTime(14)  // → "Lunch"
testMealTypeByTime(15)  // → "Dinner"
testMealTypeByTime(18)  // → "Dinner"
testMealTypeByTime(19)  // → "Dinner"
testMealTypeByTime(20)  // → "Snack"
testMealTypeByTime(23)  // → "Snack"
```

### Test: Quantity Calculation
```javascript
// Test function
function calculateMacro(base, quantity) {
    return ((base || 0) * (quantity || 1)).toFixed(1);
}

// Expected results
calculateMacro(6, 1)    // → "6.0"
calculateMacro(6, 4)    // → "24.0"
calculateMacro(6, 1.5)  // → "9.0"
calculateMacro(0.6, 4)  // → "2.4"
calculateMacro(null, 1) // → "0.0"
```

### Test: Total Calculation
```javascript
// Test function
function calculateTotals(foods) {
    let total = 0;
    foods.forEach(food => {
        const quantity = food.quantity || 1;
        total += (parseFloat(food.calories) || 0) * quantity;
    });
    return Math.round(total);
}

// Expected results
const foods = [
    { calories: 78, quantity: 4 },   // 312
    { calories: 150, quantity: 1 },  // 150
    { calories: 100, quantity: 2.5 } // 250
];
calculateTotals(foods) // → 712
```

## Visual Inspection Checklist

### UI Layout
- [ ] "Qty" column appears between food name and macros
- [ ] Qty input is smaller (60px width) than other inputs
- [ ] Calculated values appear below base values in smaller, gray text
- [ ] Calculated values only show when quantity ≠ 1
- [ ] All inputs are properly aligned
- [ ] Mobile layout still works (inputs stack vertically)

### User Experience
- [ ] Prompt dialog is clear and intuitive
- [ ] Default value "1" is pre-filled in prompt
- [ ] Quantity can be changed without refreshing page
- [ ] Daily totals update instantly when quantity changes
- [ ] Save button (💾) still works
- [ ] Delete meal button still works

### Data Integrity
- [ ] Foods saved to library have correct base values (not multiplied)
- [ ] Quick Add uses base values from library
- [ ] Quantity is stored separately from base values
- [ ] Existing foods without quantity still work
- [ ] Firebase saves show quantity field in documents

## Regression Tests

### Things That Should Still Work
- [ ] Manual food entry (typing in all fields)
- [ ] Saving foods to library
- [ ] Deleting foods from library
- [ ] Searching saved foods
- [ ] Adding multiple meals manually
- [ ] Deleting meals
- [ ] Changing nutrition date
- [ ] Daily total calculations (with and without quantity)
- [ ] Mobile responsiveness
- [ ] All other tabs (Workout, Calendar, etc.)

## Browser Compatibility
Test in the following browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Performance Tests
- [ ] Page loads in < 2 seconds
- [ ] Quantity change updates instantly (< 100ms)
- [ ] No lag when typing in quantity input
- [ ] Firebase saves complete in < 1 second
- [ ] Switching between dates is smooth

## Known Limitations (By Design)
1. **Time-based meal detection**: Uses current time, not user-specified time
2. **One meal per type per day**: Can't have two separate "Breakfast" meals
3. **Quantity prompt**: Modal dialog (can't be customized per food)
4. **Decimal precision**: Fixed to 1 decimal place for display

## Future Enhancement Ideas (Not Implemented)
- Remember last quantity used per food
- Quick quantity buttons (0.5x, 1x, 2x, 4x)
- Custom meal types beyond the 4 defaults
- Manual time selection for meal
- Bulk quantity adjustment for multiple foods
