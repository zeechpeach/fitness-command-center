# Meal Tracking Visual Guide

This document provides a visual overview of the meal tracking improvements.

## Feature Overview

### 1. Manual Meal Type Selection Modal

**Before:**
- Used browser `prompt()` with numbered choices
- Required typing 1-4
- Not user-friendly or visually appealing

**After:**
- Beautiful modal overlay with visual buttons
- Each meal type has an emoji icon
- Click to select (no typing required)
- Cancel button to dismiss

**Modal Structure:**
```
┌─────────────────────────────────────┐
│  🍽️ Select Meal Type                │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │   🌅 Breakfast                │  │ ← Hover effect
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │   ☀️ Lunch                     │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │   🌙 Dinner                    │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │   🍪 Snack                     │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │   Cancel                       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

### 2. Editable Meal Type Dropdown

**Before:**
- Meal type was static text
- Could not change after creation
- Had to delete and recreate meal

**After:**
- Meal type is an interactive dropdown
- Four options with emoji icons
- Updates immediately on selection
- Persists to Firestore

**Meal Card Header:**
```
┌──────────────────────────────────────────────────┐
│  Meal Card                                        │
├──────────────────────────────────────────────────┤
│  ┌─────────────────────┐                         │
│  │ 🌅 Breakfast    ▼   │  [Delete]              │
│  └─────────────────────┘                         │
│  10:30 AM                                         │
│                                                   │
│  [Food items appear below...]                    │
└──────────────────────────────────────────────────┘
```

When clicked:
```
┌─────────────────────┐
│ 🌅 Breakfast    ▼   │ ← Currently selected
├─────────────────────┤
│ 🌅 Breakfast        │
│ ☀️ Lunch           │
│ 🌙 Dinner          │
│ 🍪 Snack           │
└─────────────────────┘
```

---

### 3. Individual Food Item Deletion

**Before:**
- Could only delete entire meal
- No way to remove single food items
- Had to edit out all fields manually

**After:**
- Delete button (🗑️) next to each food item
- Confirmation dialog before deletion
- Meal remains if other foods exist
- Meal auto-deletes if last food removed

**Food Row Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ Food Item                                                       │
├────────────────────────────────────────────────────────────────┤
│ [Food Name]  [Qty] [Protein] [Carbs] [Fats] [Cal] [💾] [🗑️]  │
│ Chicken      1.0   30g       0g      5g     200    Save Delete │
└────────────────────────────────────────────────────────────────┘
```

**Deletion Flow:**
```
User clicks 🗑️
     ↓
Browser confirmation dialog
     ↓
┌─────────────────────────────────┐
│  Delete this food item?          │
│  [Cancel]  [OK]                  │
└─────────────────────────────────┘
     ↓
Food removed from meal
     ↓
If last food: Entire meal deleted
If not last: Meal remains with other foods
```

---

### 4. Complete Meal Card Example

**Full meal card with all features:**

```
┌────────────────────────────────────────────────────────────────┐
│  MEAL CARD                                                      │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐                            [Delete Meal] │
│  │ 🌙 Dinner    ▼   │ ← Editable dropdown                     │
│  └──────────────────┘                                          │
│  6:45 PM                                                        │
├────────────────────────────────────────────────────────────────┤
│  Food Items:                                                    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ [Chicken Breast] [2.0] [30g] [0g] [5g] [200] [💾] [🗑️] │  │
│  │      ↑ Name        ↑Qty  ↑Protein ↑Carbs ↑Fats ↑Cal    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ [Brown Rice]     [1.5] [5g]  [45g] [2g]  [220] [💾] [🗑️]│  │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ [Broccoli]       [1.0] [3g]  [8g]  [0g]  [35]  [💾] [🗑️]│  │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [+ Add Food]                                                   │
├────────────────────────────────────────────────────────────────┤
│  Meal Totals (auto-calculated):                                │
│  Protein: 76g  |  Carbs: 53g  |  Fats: 12g  |  Calories: 655   │
└────────────────────────────────────────────────────────────────┘
```

**Key Features Highlighted:**
- 🔄 Editable meal type dropdown at top
- 🗑️ Individual delete buttons for each food
- 💾 Save buttons to add foods to library
- ➕ Add Food button to expand the meal
- 🧮 Auto-calculated totals at bottom
- ❌ Delete Meal button (top right)

---

### 5. Daily Nutrition Summary

**Top of Nutrition Tab:**

```
┌────────────────────────────────────────────────────────────────┐
│  🍎 Daily Nutrition                                             │
├────────────────────────────────────────────────────────────────┤
│  Date: [2024-01-15] ◀️ ▶️                                      │
├────────────────────────────────────────────────────────────────┤
│  ┌────────┬────────┬────────┬────────┐                        │
│  │  2,450 │  180g  │  250g  │   65g  │                        │
│  │Calories│Protein │ Carbs  │  Fats  │                        │
│  └────────┴────────┴────────┴────────┘                        │
└────────────────────────────────────────────────────────────────┘
```

---

### 6. Data Wipe Console Command

**Browser Console Flow:**

```javascript
// User types in console:
> window.wipeNutritionData()

// First confirmation:
┌─────────────────────────────────────────────────┐
│  ⚠️ WARNING: This will delete ALL nutrition     │
│  and food data from Firestore. This cannot      │
│  be undone!                                     │
│                                                 │
│  Are you sure you want to continue?            │
│  [Cancel]  [OK]                                │
└─────────────────────────────────────────────────┘

// Second confirmation:
┌─────────────────────────────────────────────────┐
│  Please confirm one more time:                  │
│  Delete ALL nutrition data?                     │
│  [Cancel]  [OK]                                │
└─────────────────────────────────────────────────┘

// Console output:
Starting data wipe...
Deleted 15 nutrition documents
Deleted 8 saved food documents

// Success alert:
┌─────────────────────────────────────────────────┐
│  ✅ Data wipe complete!                         │
│                                                 │
│  Deleted:                                       │
│  - 15 nutrition entries                        │
│  - 8 saved foods                               │
│  [OK]                                          │
└─────────────────────────────────────────────────┘
```

---

## Color Scheme

All new components follow the existing dark theme:

- **Background**: Dark blue-grey (`rgba(30, 41, 59, 0.4)`)
- **Borders**: Subtle grey (`rgba(71, 85, 105, 0.3)`)
- **Text**: White and light grey
- **Hover effects**: Blue tint (`rgba(59, 130, 246, 0.2)`)
- **Delete buttons**: Red tint (`rgba(239, 68, 68, 0.2)`)
- **Save buttons**: Blue tint (`rgba(59, 130, 246, 0.2)`)

---

## Responsive Design

All new features are mobile-friendly:

**Desktop:**
- Modal centered with overlay
- Dropdowns work smoothly
- Delete buttons clearly visible

**Mobile:**
- Modal scales to 90% width
- Touch-friendly button sizes
- Dropdowns adapt to screen size
- Food rows stack on small screens

---

## Interaction States

### Buttons

**Hover:**
```
Normal:     [ Button ]
Hover:      [ Button ]  ← Slightly raised, brighter
Active:     [ Button ]  ← Pressed effect
```

### Dropdown

**States:**
```
Normal:     [ Breakfast ▼ ]
Hover:      [ Breakfast ▼ ]  ← Border highlights
Open:       [ Breakfast ▼ ]  ← Options visible
            [ Lunch       ]
            [ Dinner      ]
            [ Snack       ]
```

### Delete Confirmation

**Flow:**
```
Click 🗑️
    ↓
[Cancel] [OK]  ← Confirmation dialog
    ↓           ↓
Nothing      Deleted
happens      Item gone
             UI updates
```

---

## Summary

All changes maintain the existing design language while adding:
- ✅ Better UX with visual modals
- ✅ More control with editable meal types
- ✅ Granular deletion of food items
- ✅ Clear error handling
- ✅ Powerful data reset utility
- ✅ Consistent styling throughout
- ✅ Mobile-responsive design
- ✅ Smooth animations and transitions
