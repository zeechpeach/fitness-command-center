# Feature Testing Guide

This guide provides step-by-step instructions for testing the new features implemented in this PR.

## 1. Navigation Bar UI Update

### Desktop Testing
1. Open the application in a desktop browser (1920x1080 or similar)
2. Observe the main navigation bar at the top
3. Verify:
   - ✅ Navigation bar has reduced height compared to before
   - ✅ Tab buttons are more compact with appropriate spacing
   - ✅ Font size is readable and slightly larger than before (1rem vs 0.95rem)
   - ✅ Icons have proper spacing from text
   - ✅ Active tab has gradient background and shadow effect
   - ✅ Hover states work smoothly on inactive tabs

### Mobile Testing
1. Open the application on a mobile device or resize browser to 414x896 (iPhone size)
2. Verify:
   - ✅ Navigation bar is horizontally scrollable
   - ✅ All tabs are visible and accessible
   - ✅ Touch targets are at least 44px in height
   - ✅ Tab spacing is appropriate for touch interaction
   - ✅ Scrollbar appears when needed

### Comparison
- **Before**: Padding 0.875rem 1.5rem, font-size 0.95rem, gap 0.75rem
- **After**: Padding 0.625rem 1.125rem, font-size 1rem, gap 0.5rem
- **Result**: More compact, better visual balance, improved readability

## 2. Alternative Workout History Feature

### Initial Setup
1. Navigate to the Workout tab
2. Select any workout day (e.g., "Upper")
3. Find any exercise card (e.g., "Incline Dumbbell Press")
4. Locate the approach selector buttons below the exercise name

### Test Case 1: First-Time Alternative Exercise
1. Click the "Alt Exercise" button
2. Verify modal opens with:
   - Title: "🔄 Alternative Exercise"
   - Exercise name input field
   - "Previously Used Alternatives" section (hidden if no history)
   - "Confirm Alternative Exercise" button
3. Enter an alternative exercise name (e.g., "Flat Dumbbell Press")
4. Click "Confirm Alternative Exercise"
5. Verify:
   - ✅ Modal closes
   - ✅ Exercise name changes to the alternative
   - ✅ "Alt for [Original Exercise]" tag appears
   - ✅ "Alt Exercise" button remains active/highlighted
   - ✅ Set inputs are ready for logging

### Test Case 2: Using Alternative from History
1. Click "Alt Exercise" on the same exercise again (or another session)
2. Verify modal shows "Previously Used Alternatives" section with:
   - Alternative exercise name
   - Last used date
   - Usage count (e.g., "Used 1x")
3. Click on a history item
4. Verify:
   - ✅ Input field is populated with the selected exercise name
   - ✅ Can modify the name if needed
5. Click "Confirm Alternative Exercise"
6. Verify exercise is updated and saved

### Test Case 3: Multiple Alternatives for Same Exercise
1. Over multiple sessions, use different alternatives for the same exercise:
   - Session 1: "Flat Dumbbell Press"
   - Session 2: "Machine Chest Press"
   - Session 3: "Push-Ups (Weighted)"
2. Open the Alt Exercise modal
3. Verify:
   - ✅ All previously used alternatives are listed
   - ✅ Most recently used appears first
   - ✅ Usage counts are accurate
   - ✅ Dates are displayed correctly

### Test Case 4: Removing Alternative Exercise
1. With an alternative exercise active
2. Click the "Alt Exercise" button again
3. Verify:
   - ✅ Exercise reverts to original name
   - ✅ "Alt for [Original Exercise]" tag disappears
   - ✅ "Alt Exercise" button becomes inactive

### Test Case 5: Mobile Responsiveness
1. Resize browser to 414x896 (mobile view)
2. Click "Alt Exercise" button
3. Verify:
   - ✅ Modal is properly sized and scrollable
   - ✅ All content is accessible
   - ✅ Touch targets are appropriate size
   - ✅ Input field is easily tappable
   - ✅ History items are easy to tap
   - ✅ Close button is accessible

### Test Case 6: Data Persistence
1. Log a workout with an alternative exercise
2. Complete the session
3. Return to the same workout day later
4. Verify:
   - ✅ Alternative exercise history is retained
   - ✅ Can access previously used alternatives
   - ✅ Usage counts increment correctly
   - ✅ Last used dates update appropriately

### Test Case 7: Firebase Integration
1. Open browser console (F12)
2. Perform alternative exercise operations
3. Verify console logs show:
   - ✅ "Saved new alternative exercise to history" on first use
   - ✅ "Updated alternative exercise history" on subsequent uses
   - ✅ No error messages
4. Check Firebase console (if access available):
   - ✅ Collection "alternativeExercises" exists
   - ✅ Documents contain: originalExercise, alternativeExercise, firstUsed, lastUsed, useCount

## Visual Regression Testing

### Navigation Bar
Compare screenshots:
- Before: https://github.com/user-attachments/assets/3348ba5d-6488-418f-8bb4-6ce426b8f2db
- After: https://github.com/user-attachments/assets/c6c1ffae-1bf2-4362-a2de-f5a7466295fc

### Alternative Exercise Modal
- Desktop: https://github.com/user-attachments/assets/4b906c87-144d-4e6f-aed0-e3ec746c981b
- With Selection: https://github.com/user-attachments/assets/2b2d7bc0-f3b4-4b57-9f8a-5bbf876f417c
- Mobile: https://github.com/user-attachments/assets/c947f59d-d7c2-49ff-a7cf-ec8c729637a7

## Accessibility Testing

### Keyboard Navigation
1. Use Tab key to navigate through navigation bar
2. Verify all tabs are focusable and accessible
3. Use Tab key in alternative exercise modal
4. Verify all interactive elements are keyboard accessible

### Screen Reader Testing (Optional)
1. Enable screen reader (NVDA, JAWS, or VoiceOver)
2. Navigate through the interface
3. Verify elements are announced appropriately

## Performance Testing

### Modal Open/Close
1. Click "Alt Exercise" button multiple times
2. Verify:
   - ✅ Modal opens smoothly with animation
   - ✅ No lag or flickering
   - ✅ Backdrop blur effect performs well

### History Loading
1. Create 10+ alternative exercise history entries
2. Open modal
3. Verify:
   - ✅ History loads quickly
   - ✅ List is scrollable
   - ✅ No performance degradation

## Browser Compatibility

Test on:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

## Known Limitations

1. Firebase CDN dependencies are required for functionality
2. Alternative exercise history is tied to the original exercise name
3. Maximum of 10 history items shown (can be increased if needed)

## Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ Smooth animations and transitions
- ✅ Proper data persistence in Firebase
- ✅ Responsive design on all viewports
- ✅ Accessible keyboard and touch interactions
- ✅ Visual consistency with existing design language
