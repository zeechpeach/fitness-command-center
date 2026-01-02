# Calendar and Scheduling Improvements - Visual Guide

## Overview
This guide documents the visual changes made to the Calendar tab to support Sick Days, enhanced Travel Mode, and improved scheduling accuracy.

## Screenshots

### Initial Application View
![Application Main View](https://github.com/user-attachments/assets/4580c85c-172a-45d4-a663-df9e4af3699d)
*The main application interface showing the Workout tab. This screenshot was provided by the repository owner to show the current UI state.*

## New Features - UI Components

### 1. Sick Day Controls (Calendar Tab)

**Location:** Calendar tab, below Travel Mode controls

**Visual Elements:**
- Header: "🤒 Sick Day" in pink (#f472b6)
- Date picker input for selecting the sick day
- Button: "Mark as Sick Day" with pink styling
- Description text explaining the feature

**Functionality:**
- Select any date to mark as sick day
- Click button to mark the date
- If already marked, clicking again prompts to remove
- Visual feedback via alert messages

### 2. Sick Day Calendar Indicator

**Visual Styling:**
```
Background: Pink diagonal stripes (repeating 45° pattern)
Border: 1px solid pink (rgba(244, 114, 182, 0.5))
Label: "🤒 Sick Day" in pink text
```

**Appearance:**
- Distinct pink diagonal stripe pattern
- Easily distinguishable from Travel days (purple stripes)
- Clear emoji indicator (🤒)

### 3. Enhanced Travel Day Display

**Before:**
- Calendar showed: "✈️ Travel"

**After:**
- Calendar shows: "✈️ Travel (Push)" - includes the workout that would have been scheduled
- Clicking a travel day shows: "Scheduled workout if not traveling: Push"

**Purpose:**
- Users can see what workout they're missing
- Helps users decide if they can attempt the workout while traveling

### 4. Post-Travel Resume Modal

**Triggered by:** Clicking "End Travel Mode" button

**Modal Contents:**
- Title: "✈️ Welcome Back!"
- Subtitle: "How would you like to resume your workout program?"
- Two large button options:
  
  **Option 1: Resume**
  - Icon: ▶️
  - Color: Green (#10b981)
  - Description: "Continue from where you left off"
  - Action: Resumes the workout cycle as if picking up the next missed workout
  
  **Option 2: Restart**
  - Icon: 🔄
  - Color: Blue (#3b82f6)
  - Description: "Start the program from day 1"
  - Action: Restarts the entire program cycle from Upper workout

## Calendar Visual Indicators Summary

### Day Type Legend

| Day Type | Visual Indicator | Text Color | Background Pattern |
|----------|-----------------|------------|-------------------|
| **Completed Workout** | ✓ Workout Name | Green (#10b981) | Solid green tint |
| **Scheduled Workout** | Workout Name | Workout color | Solid blue tint |
| **Missed Workout** | Workout Name | Workout color | Red tint |
| **Rest Day** | Rest | Gray (#94a3b8) | Neutral |
| **Sick Day** | 🤒 Sick Day | Pink (#f472b6) | Pink diagonal stripes |
| **Travel Day** | ✈️ Travel (Type) | Purple (#a855f7) | Purple diagonal stripes |

### Workout Type Colors
- **Upper:** Green (#10b981)
- **Lower:** Orange (#f59e0b)
- **Push:** Red (#ef4444)
- **Pull:** Blue (#3b82f6)
- **Legs:** Purple (#8b5cf6)
- **Rest:** Gray (#94a3b8)

## User Flow Examples

### Example 1: Marking a Sick Day

1. User navigates to Calendar tab
2. Scrolls to "🤒 Sick Day" section
3. Selects date from date picker (e.g., tomorrow)
4. Clicks "Mark as Sick Day"
5. Alert confirms: "Day marked as sick. All remaining workouts have been pushed back by one day."
6. Calendar updates to show pink diagonal stripe pattern on that day
7. Future scheduled workouts shift by one day

### Example 2: Returning from Travel

1. User has active travel mode (banner showing at top)
2. User clicks "End Travel Mode" button
3. Modal appears with "Welcome Back!" message
4. User has two choices:
   
   **If selecting "Resume":**
   - Schedule continues from last completed workout
   - Example: If last workout was Lower, next scheduled is Rest, then Push, etc.
   
   **If selecting "Restart":**
   - Today becomes a Rest day
   - Tomorrow starts with Upper (day 1 of cycle)
   - Entire program cycle resets

### Example 3: Viewing Schedule on Travel Day

1. User clicks on a travel day in calendar
2. Detail panel shows:
   - Title: "Travel - [Date]"
   - Text: "Travel day - workout schedule paused."
   - Additional info: "Scheduled workout if not traveling: Push"
3. User can see what they're missing and attempt it if able

## Code Structure

### New Global Variables
```javascript
let sickDayData = [];
window.sickDayData = sickDayData;
window.currentTravelPeriodToEnd = null;
```

### New Functions
- `isDateSickDay(dateStr)` - Check if date is marked as sick
- `markSickDay()` - Mark or unmark a sick day
- `loadSickDayData()` - Load sick days from Firestore
- `getWouldBeScheduledWorkout(date)` - Calculate theoretical workout schedule
- `resumeWorkoutProgram(mode)` - Handle post-travel resume/restart

### Modified Functions
- `getScheduledWorkout(date)` - Now handles sick days
- `renderCalendar()` - Shows sick days and workout names on travel days
- `selectCalendarDay(dateStr)` - Enhanced info for special days
- `calculateAdherence()` - Excludes sick days from calculations
- `endTravelMode()` - Shows resume options modal

## Database Schema

### Firestore Collection: `sickDays`
```javascript
{
  date: "2024-12-05",        // ISO date string
  createdAt: "2024-12-02..."  // ISO timestamp
}
```

## Testing Checklist

- [ ] Mark a day as sick - verify pink diagonal pattern appears
- [ ] Remove a sick day - verify pattern disappears
- [ ] Set travel dates - verify workout name shows in parentheses
- [ ] Click travel day - verify "would be scheduled" text appears
- [ ] End travel mode - verify modal appears with two options
- [ ] Test "Resume" option - verify schedule continues correctly
- [ ] Test "Restart" option - verify cycle starts from day 1
- [ ] Check adherence score - verify sick/travel days excluded
- [ ] Complete workouts out of order - verify schedule adjusts
- [ ] Mark multiple sick days - verify schedule pushes back correctly

## Acceptance Criteria ✅

✅ **Sick, Travel, and Rest days are visually indicated**
- Sick days: Pink diagonal stripes with 🤒
- Travel days: Purple diagonal stripes with ✈️ and workout name
- Rest days: Gray text with "Rest"

✅ **Workouts after interruptions resume in intended sequence**
- Schedule skips sick and travel days in calculations
- Missed workouts queue for future dates
- Order maintained regardless of interruptions

✅ **User can select how to resume program after travel**
- Modal shown when ending travel mode
- "Resume" continues from last workout
- "Restart" begins from day 1

✅ **Travel days show what workout would have been scheduled**
- Calendar displays format: "✈️ Travel (Push)"
- Detail view shows full information
- Helps users decide if they can attempt the workout

## Notes

- All changes are in `index.html` - single file application
- Uses existing Firebase infrastructure
- Maintains backward compatibility
- No breaking changes to existing features
- Minimal visual disruption to existing UI
- Follows established design patterns and color scheme
