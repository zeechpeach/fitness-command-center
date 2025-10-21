# Visual Guide to New Features

This guide provides visual descriptions of how each feature appears and works in the application.

## Navigation Bar

The main navigation now includes 7 tabs:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏋️ Workout  │  📅 Calendar  │  🍎 Nutrition  │  ⚖️ Body  │  📊 Analytics  │  📈 Progress  │  🧠 Insights  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 1. Scrollable Workout Data (Workout Tab)

**Location**: Within each exercise card in the Workout tab

**Before**: Previous sets were cut off with ellipsis (...)
**After**: Scrollable area showing all sets

```
┌─────────────────────────────────────────────┐
│ Barbell Bench Press              Try 185lbs │
│ Last session (10/15/2024):                  │
│ ┌─────────────────────────────────────────┐ │
│ │ 175×8, 175×8, 175×7, 180×6, 180×6     ▲│ │
│ │ 180×5, 175×8                           ││ │  <- Scrollable!
│ │                                        ▼│ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## 2. Calendar Tab

### Adherence Card

```
┌────────────────────────────────────────────────────────┐
│            📊 Workout Adherence                        │
│                                                        │
│                      85%                               │
│                Discipline Score                        │
│                                                        │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│    │    17    │  │    20    │  │    3     │         │
│    │Completed │  │Scheduled │  │ Missed   │         │
│    └──────────┘  └──────────┘  └──────────┘         │
└────────────────────────────────────────────────────────┘
```

### Calendar Grid

```
┌────────────────────────────────────────────────────────────────┐
│     ← Previous         October 2024           Next →           │
├────────────────────────────────────────────────────────────────┤
│  Sun    Mon    Tue    Wed    Thu    Fri    Sat                │
├────────────────────────────────────────────────────────────────┤
│         1      2      3      4      5      6                   │
│       Upper  Lower   Rest   Push   Pull   Legs                │
│        [✓]    [✓]    [✓]    [✓]    [✗]    [✓]                │
│                                                                │
│   7      8      9     10     11     12     13                 │
│  Rest  Upper  Lower  Rest   Push   Pull   Legs                │
│  [✓]    [✓]    [✓]   [✓]    [✓]    [✓]    [✗]                │
│                                                                │
│  14     15     16     17     18     19     20                 │
│ Rest  Upper  Lower  Rest   Push   Pull   Legs                 │
│  [✓]    [✓]    [✓]   [✓]    [○]    [○]    [○]                │
│                                                                │
│  21     22     23     24     25     26     27                 │
│ Rest  Upper  Lower  Rest   Push   Pull   Legs                 │
│ [⊙]    [ ]    [ ]    [ ]    [ ]    [ ]    [ ]                │
└────────────────────────────────────────────────────────────────┘

Legend:
[✓] = Completed (Green)
[✗] = Missed (Red)  
[○] = Scheduled (Blue)
[⊙] = Today (Cyan border)
[ ] = Future
```

**Click any date** to see workout details in the panel below.

### Selected Day Details

```
┌────────────────────────────────────────────────────────┐
│ Upper Workout - 10/15/2024                             │
├────────────────────────────────────────────────────────┤
│ Session Intensity                                      │
│ Energy: 4/5  Motivation: 5/5                          │
│ Fatigue: 3/5  Satisfaction: 4/5                       │
├────────────────────────────────────────────────────────┤
│ Incline Dumbbell Press                                 │
│ Set 1: 75lbs × 8 reps                                 │
│ Set 2: 75lbs × 8 reps                                 │
│ Set 3: 75lbs × 7 reps                                 │
├────────────────────────────────────────────────────────┤
│ Seated Cable Fly                                       │
│ Set 1: 40lbs × 10 reps                                │
│ Set 2: 40lbs × 10 reps                                │
└────────────────────────────────────────────────────────┘
```

## 3. Nutrition Tab

### Daily Summary

```
┌────────────────────────────────────────────────────────────────┐
│               🍎 Daily Nutrition                               │
│                                                                │
│  Date: [10/21/2024]                                           │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   2,145  │ │   175g   │ │   220g   │ │    75g   │       │
│  │ Calories │ │ Protein  │ │  Carbs   │ │   Fats   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└────────────────────────────────────────────────────────────────┘
```

### Meal Cards

```
┌────────────────────────────────────────────────────────────────┐
│ Breakfast                              08:30          [Delete] │
├────────────────────────────────────────────────────────────────┤
│ Food Name          P    C    F    Cal                         │
│ [Eggs           ] [12] [ 1] [10] [140]                        │
│ [Oatmeal        ] [ 6] [54] [ 3] [300]                        │
│ [Banana         ] [ 1] [27] [ 0] [105]                        │
│                                                                │
│              [+ Add Food]                                      │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Lunch                                  12:45          [Delete] │
├────────────────────────────────────────────────────────────────┤
│ Food Name          P    C    F    Cal                         │
│ [Chicken Breast ] [45] [ 0] [ 5] [230]                        │
│ [Rice           ] [ 4] [45] [ 1] [205]                        │
│ [Broccoli       ] [ 3] [ 6] [ 0] [ 35]                        │
│                                                                │
│              [+ Add Food]                                      │
└────────────────────────────────────────────────────────────────┘

                    [+ Add Meal]
```

## 4. Body Metrics Tab

### Weight Input

```
┌────────────────────────────────────────────────────────────────┐
│                   ⚖️ Weight Tracking                           │
├────────────────────────────────────────────────────────────────┤
│  [10/21/2024]     [185.5]              [Log Weight]           │
└────────────────────────────────────────────────────────────────┘
```

### Weight Chart

```
┌────────────────────────────────────────────────────────────────┐
│                  📈 Weight Progress                            │
├────────────────────────────────────────────────────────────────┤
│ 190 ─                                                          │
│ 188 ─                                 ╱──╲                     │
│ 186 ─              ╱────╲            ╱    ╲                    │
│ 184 ─         ╱───╯      ╲──────────╯      ╲                  │
│ 182 ─    ╱───╯                              ╲─────             │
│ 180 ─────                                         ╲────        │
│     │───│───│───│───│───│───│───│───│───│───│───│───│───│    │
│     Aug  Sep  Oct  Nov  Dec  Jan  Feb  Mar  Apr  May  Jun     │
└────────────────────────────────────────────────────────────────┘
```

### Progress Photos

```
┌────────────────────────────────────────────────────────────────┐
│                  📸 Progress Photos                            │
├────────────────────────────────────────────────────────────────┤
│     ┌──────────────────────────────────┐                      │
│     │                                  │                      │
│     │      📷 Click to upload a        │                      │
│     │      progress photo              │                      │
│     │                                  │                      │
│     └──────────────────────────────────┘                      │
├────────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │
│  │  📷    │ │  📷    │ │  📷    │ │  📷    │                │
│  │        │ │        │ │        │ │        │                │
│  │10/01/24│ │10/08/24│ │10/15/24│ │10/21/24│                │
│  └────────┘ └────────┘ └────────┘ └────────┘                │
│                                                                │
│  ┌────────┐ ┌────────┐                                       │
│  │  📷    │ │  📷    │                                       │
│  │        │ │        │                                       │
│  │09/15/24│ │09/01/24│                                       │
│  └────────┘ └────────┘                                       │
└────────────────────────────────────────────────────────────────┘
```

## 5. Exercise Approach Variations (Workout Tab)

### Exercise Card with Approach Buttons

```
┌────────────────────────────────────────────────────────────────┐
│ Barbell Squat  [Heavy]                         Try 225lbs     │
│ 3 × 8                                          PR: 245×5      │
│ +5lbs last session                                            │
│                                                                │
│ [Standard] [Heavy] [Form Focus] [Alt Exercise]                │
│            └───────┘                                          │
│           (selected)                                          │
├────────────────────────────────────────────────────────────────┤
│ Last session (10/18/2024):                                    │
│ 220×5, 220×5, 220×4                                           │
├────────────────────────────────────────────────────────────────┤
│ Set 1:  [225] × [5] [notes]                          [Copy]   │
│ Set 2:  [225] × [5] [notes]                          [Copy]   │
│ Set 3:  [225] × [4] [notes]                          [Copy]   │
│                                                                │
│ [+ Add Set]                                                    │
└────────────────────────────────────────────────────────────────┘
```

### Exercise with Substitution

```
┌────────────────────────────────────────────────────────────────┐
│ Dumbbell Squat  [Substitution]                 Try 90lbs      │
│ 3 × 8                                                          │
│ (Original: Barbell Squat)                                     │
│                                                                │
│ [Standard] [Heavy] [Form Focus] [Alt Exercise]                │
│                                  └─────────────┘              │
│                                    (selected)                 │
├────────────────────────────────────────────────────────────────┤
│ Set 1:  [90] × [8] [using dumbbells]                         │
│ Set 2:  [90] × [8] [notes]                                    │
│ Set 3:  [90] × [7] [notes]                                    │
│                                                                │
│ [+ Add Set]                                                    │
└────────────────────────────────────────────────────────────────┘
```

## Color Scheme

The app uses a consistent color palette:

- **Primary Cyan**: `#06b6d4` - Headings, accents, borders
- **Blue**: `#3b82f6` - Links, scheduled items
- **Green**: `#10b981` - Success, completed items
- **Red**: `#ef4444` - Missed items, delete buttons
- **Orange**: `#f59e0b` - Warnings, plateaus
- **Purple**: `#a855f7` - Variations, substitutions
- **Gray**: `#64748b` - Secondary text, rest days

## Interaction Patterns

### Click Actions:
- **Calendar dates**: View workout details for that day
- **Approach buttons**: Select training approach for exercise
- **Alt Exercise**: Prompt for alternative exercise name
- **Photo upload area**: Open file picker
- **Add Meal/Food**: Create new entries
- **Delete**: Remove meal after confirmation

### Hover Effects:
- Buttons: Slight color change and scale
- Calendar days: Background lightens, slight scale increase
- Cards: Shadow intensity increases

### Form Inputs:
- **Focus**: Cyan border with shadow
- **Number inputs**: Center-aligned for weights/reps
- **Text inputs**: Left-aligned for names/notes
- **Date pickers**: Native browser date picker

## Responsive Design

### Desktop (1200px+):
- Full width layout with max-width container
- Multi-column grids for stats and charts
- Side-by-side layout for forms

### Tablet (768px - 1199px):
- 2-column grids where appropriate
- Slightly reduced padding
- Tabs scroll horizontally if needed

### Mobile (<768px):
- Single column layout
- Stacked form inputs
- Full-width buttons
- Touch-friendly spacing
- Collapsible sections

## Example Workflow

### Logging a Complete Day:

1. **Morning - Log Weight**
   ```
   Body Tab → Enter 185.5 lbs → Log Weight → ✓ Saved
   ```

2. **Throughout Day - Log Meals**
   ```
   Nutrition Tab → Add Meal (Breakfast) → Add Foods → ✓ Saved
   Nutrition Tab → Add Meal (Lunch) → Add Foods → ✓ Saved
   Nutrition Tab → Add Meal (Dinner) → Add Foods → ✓ Saved
   ```

3. **Evening - Log Workout**
   ```
   Workout Tab → Select "Push" → Rate Energy/Motivation
   → Enter sets/reps for each exercise
   → Select "Heavy" approach for main lift
   → Rate Fatigue/Satisfaction → Complete Session → ✓ Saved
   ```

4. **Review Progress**
   ```
   Calendar Tab → View green checkmark on today
   → See adherence score updated
   Analytics Tab → View volume trends
   Progress Tab → See PR updates
   ```

This visual guide provides a comprehensive overview of how each feature appears and functions in the application!
