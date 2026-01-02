# Visual Guide to Changes

## 1. Progress Photos - Delete Button

### Before:
```
┌─────────────────┐
│                 │
│     Photo       │
│                 │
└─────────────────┘
   Date: Jan 1
```

### After:
```
┌─────────────────┐
│              🗑️ │  <- DELETE BUTTON (top-right)
│     Photo       │
│                 │
└─────────────────┘
   Date: Jan 1
```

**Features**:
- Red button with trash icon
- Hover effect: scales and brightens
- Click: shows confirmation dialog
- Deletes from Firebase and refreshes display

---

## 2. Session Comparison - Analytics Tab

### Before:
```
Last Session          | Previous Session
--------------------  | --------------------
Volume: 15,000 lbs    | Volume: 14,500 lbs
Exercises: 6          | Exercises: 5
Avg Weight: 150 lbs   | Avg Weight: 145 lbs
Date: Jan 15          | Date: Jan 10

✓ Improving
Volume Change: +500 lbs (+3%)
```

### After:
```
Last Session          | Previous Session
--------------------  | --------------------
Volume: 15,000 lbs    | Volume: 14,500 lbs
Date: Jan 15          | Date: Jan 10

✓ Improving
Volume Change: +500 lbs (+3%)

↑ Increased (GREEN)
• Bench Press: 135×8 → 140×8
• Squat: 185×10 → 185×12

↓ Decreased (RED)
• Overhead Press: 95×8 → 90×8

⚠️ Plateaued (ORANGE) - 3+ sessions
• Deadlift: 225×5
```

**Changes**:
- ❌ Removed: Exercise count, Avg Weight
- ✅ Kept: Volume totals, dates, improvement indicator
- ✅ Added: Exercise-by-exercise breakdown with colors

---

## 3. Intensity Heatmap

### Before (Incorrect):
```
Calculation: (energy + motivation + (10 - fatigue) + satisfaction) / 4
Problem: Used 10 for fatigue on 1-5 scale
```

### After (Fixed):
```
Calculation: (energy + motivation + (6 - fatigue) + satisfaction) / 4
Then scale: (avgScore / 5) * 10

Display text updated:
"Intensity score (0-10) - calculated from your 1-5 ratings. 
Fatigue is inverted (lower fatigue = higher score)."
```

**Fix**:
- Fatigue 1 → 5 (low fatigue = high contribution)
- Fatigue 5 → 1 (high fatigue = low contribution)
- Properly scales 1-5 ratings to 0-10 display

---

## 4. Progression Snapshot

### Before:
```
Quick Wins:
Complete workouts to see PRs!

Trending Up:
N/A

Needs Attention:
N/A
```

### After:
```
Quick Wins:
Complete at least 2 workouts to see recent PRs

Trending Up:
Improving over last 4 sessions  <- Helper text
N/A

Needs Attention:
No progress for 3+ sessions  <- Helper text
N/A
```

**Changes**:
- More specific placeholder text
- Helper text explains what each section means
- "Trending Up" placeholder updated to explain data requirement

---

## 5. Insights Tab - New Correlations

### Before:
```
Insights:
• You train most often on Mondays - this seems to be your power day!
• Your average workout volume is 12,500lbs - solid training stimulus.
```

### After (with sufficient data):
```
Insights:
• You train most often on Mondays - this seems to be your power day!
• Your average workout volume is 12,500lbs - solid training stimulus.

Strength vs Weight:
• Your strength is up 8% while weight increased 2lbs - excellent lean mass gains!

Nutrition:
• Averaging 180g protein/day with 4 workouts/week - optimal for growth

Recovery:
• Satisfaction scores averaging 4.5/5 - training is going well!
```

### New Insight Types:

**Strength vs Weight** (requires 5+ workouts, 5+ weight entries):
- "Your strength is up X% while weight increased Ylbs - excellent lean mass gains!"
- "Strength maintaining while weight down Ylbs - good cutting progress"
- "Weight stable but strength up X% - great recomp!"
- "Strength declining X% while weight down Ylbs - may need more calories"

**Nutrition Adequacy** (requires 5+ nutrition days):
- "Averaging Xg protein/day with Y workouts/week - optimal for growth"
- "Only Xg protein on workout days - consider increasing to 0.8-1g per lb bodyweight"
- "Great job hitting Xg+ protein on training days"

**Recovery Indicators** (requires 5+ workouts with intensity data):
- "Low energy scores (avg X/5) last week but volume still up - good mental toughness"
- "High fatigue scores correlate with X% volume drop - consider deload week"
- "Satisfaction scores averaging X/5 - training is going well!"

---

## Data Requirements Summary

| Feature | Minimum Data Required |
|---------|----------------------|
| Photo Delete | 1+ photos |
| Session Comparison (basic) | 2+ workouts of same type |
| Session Comparison (breakdown) | 2+ workouts of same type |
| Session Comparison (plateaus) | 3+ workouts of same type |
| Intensity Heatmap | 1+ workout with intensity data |
| Progression Snapshot (PRs) | 2+ workouts |
| Progression Snapshot (Trending) | 3+ sessions per exercise |
| Progression Snapshot (Plateaus) | 3+ sessions per exercise |
| Insights (basic) | 3+ workouts |
| Insights (correlations) | 5+ workouts, 5+ nutrition days, 5+ weight entries |

---

## Color Coding

| Element | Color | Hex Code | Usage |
|---------|-------|----------|-------|
| Increased/Improving | Green | `#10b981` | Better performance |
| Decreased/Declining | Red | `#ef4444` | Worse performance |
| Plateaued/Warning | Orange | `#f59e0b` | No progress |
| Delete Button | Red | `rgba(239, 68, 68, 0.9)` | Destructive action |

---

## Mobile Responsiveness

All changes maintain existing responsive design:
- Photo grid: `repeat(auto-fill, minmax(150px, 1fr))`
- Session comparison: Grid with `1fr 1fr` columns
- Delete buttons: Minimum touch target 36×36px
- Text scales appropriately on smaller screens

