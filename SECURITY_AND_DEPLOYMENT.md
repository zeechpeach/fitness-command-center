# Security & Deployment Guide

## Current State

### ✅ What's Implemented

1. **Firebase Authentication**: The app now uses Firebase Authentication with anonymous sign-in
   - Users are automatically signed in anonymously when they open the app
   - Authentication state is managed via `onAuthStateChanged()`
   - App initialization waits for authentication to complete

2. **Module Scope Fixed**: All event handler functions are properly exposed to `window`
   - Added `window.renderSavedFoods` and `window.renderInlineSavedFoods`
   - All onclick/onchange/oninput handlers now work correctly with ES modules

3. **Security Rules Documentation**: Firestore rules file includes migration path
   - Current rules allow public access for backward compatibility
   - Production rules are documented and ready to deploy
   - Clear migration steps provided

### ⚠️ Security Warnings

**CURRENT RISK**: Firestore database allows public read/write access
- Anyone with your Firebase project ID can read and write data
- Data is not isolated per user
- Suitable for personal use or development only
- **NOT production-ready for multi-user scenarios**

## Production Deployment Checklist

### Phase 1: Enable Authentication UI (Required for Production)

1. **Choose Authentication Method**
   
   Option A: Email/Password Authentication
   ```bash
   # Enable in Firebase Console
   # Authentication > Sign-in method > Email/Password > Enable
   ```
   
   Option B: Google Sign-In
   ```bash
   # Enable in Firebase Console
   # Authentication > Sign-in method > Google > Enable
   ```

2. **Add Firebase UI to index.html**

   Add before the closing `</body>` tag:
   
   ```html
   <!-- Firebase UI CSS -->
   <link type="text/css" rel="stylesheet" 
         href="https://www.gstatic.com/firebasejs/ui/6.0.2/firebase-ui-auth.css" />
   
   <!-- Firebase UI Script -->
   <script src="https://www.gstatic.com/firebasejs/ui/6.0.2/firebase-ui-auth.js"></script>
   ```

3. **Update Authentication Logic in app.js**

   Replace the anonymous sign-in section in the `onAuthStateChanged` callback with:
   
   ```javascript
   // Import auth providers at the top of app.js
   import { EmailAuthProvider, GoogleAuthProvider } from 
       "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
   
   // In the onAuthStateChanged callback:
   onAuthStateChanged(auth, async (user) => {
       if (user) {
           currentUser = user;
           console.log('User authenticated:', user.email || user.uid);
           
           // Hide auth UI, show app
           document.getElementById('auth-container').style.display = 'none';
           document.getElementById('app').style.display = 'block';
           
           // Initialize app
           if (document.readyState === 'loading') {
               document.addEventListener('DOMContentLoaded', initializeFitnessApp);
           } else {
               initializeFitnessApp();
           }
       } else {
           // Show auth UI
           document.getElementById('auth-container').style.display = 'block';
           document.getElementById('app').style.display = 'none';
           
           // Initialize Firebase UI (requires compat library loaded via script tag)
           const ui = firebaseui.auth.AuthUI.getInstance() || 
                     new firebaseui.auth.AuthUI(auth);
           
           ui.start('#firebaseui-auth-container', {
               signInOptions: [
                   EmailAuthProvider.PROVIDER_ID,
                   GoogleAuthProvider.PROVIDER_ID
               ],
               signInSuccessUrl: '/',
               privacyPolicyUrl: '/privacy'
           });
       }
   });
   ```

4. **Add Auth Container to index.html**

   Add after the `<body>` tag:
   
   ```html
   <div id="auth-container" style="position: fixed;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    bottom: 0;
                                    background: white;
                                    z-index: 10000;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;">
       <div style="max-width: 400px; padding: 2rem;">
           <h1 style="text-align: center; margin-bottom: 2rem;">Unison</h1>
           <div id="firebaseui-auth-container"></div>
       </div>
   </div>
   
   <!-- Add this style to initially hide the main app -->
   <style>
       #app { display: none; }
   </style>
   ```
   
   Note: The JavaScript will toggle visibility between `auth-container` and the main `app` div based on authentication state.

### Phase 2: Add User ID to All Operations

1. **Update Save Functions**

   For each `addDoc()` call, add `userId`:
   
   ```javascript
   // BEFORE
   const docRef = await addDoc(collection(db, "workouts"), {
       ...workoutData,
       timestamp: new Date()
   });
   
   // AFTER
   const docRef = await addDoc(collection(db, "workouts"), {
       ...workoutData,
       userId: currentUser.uid,  // Add this line
       timestamp: new Date()
   });
   ```

   Files/functions to update:
   - `saveWorkoutToFirebase()` - workouts
   - `window.saveBodyGoal()` - bodyGoals
   - `createULPPLProgram()` - programs
   - `window.enableTravelMode()` - travelMode
   - `window.markSickDay()` - sickDays
   - `window.addFoodToLog()` - nutrition
   - `window.confirmCreateFood()` - savedFoods
   - `window.logWeight()` - weight
   - `window.uploadProgressPhoto()` - photos
   - All program-related saves

2. **Update Query Functions**

   For each `getDocs()` call, add userId filter:
   
   ```javascript
   // BEFORE
   const q = query(collection(db, "workouts"), orderBy("timestamp", "desc"));
   
   // AFTER
   const q = query(
       collection(db, "workouts"),
       where("userId", "==", currentUser.uid),  // Add this line
       orderBy("timestamp", "desc")
   );
   ```

   Functions to update:
   - `loadWorkoutsFromFirebase()`
   - `loadNutritionData()`
   - `loadWeightData()`
   - `loadPhotoData()`
   - `loadPrograms()`
   - `loadSavedFoods()`
   - `loadTravelModeData()`
   - `loadSickDayData()`
   - `loadBodyGoalData()`
   - `loadAltExerciseHistory()`

### Phase 3: Migrate Existing Data

**Option A: Fresh Start (Recommended for Personal Use)**
```javascript
// Delete all existing data and start fresh with userId
// Call from browser console:
window.wipeAllData()
```

**Option B: Add userId to Existing Data**

Create a migration script:

```javascript
async function migrateDataToIncludeUserId(userId) {
    const collections = [
        'workouts', 'nutrition', 'weight', 'photos', 
        'programs', 'savedFoods', 'travelMode', 
        'sickDays', 'bodyGoal', 'altExerciseHistory'
    ];
    
    for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        const batch = writeBatch(db);
        
        snapshot.docs.forEach(doc => {
            if (!doc.data().userId) {
                batch.update(doc.ref, { userId: userId });
            }
        });
        
        await batch.commit();
        console.log(`Migrated ${collectionName}`);
    }
}

// Run once from browser console with your user ID:
// migrateDataToIncludeUserId('your-user-id-here');
```

### Phase 4: Deploy Security Rules

1. **Update firestore.rules**

   Uncomment the production rules in `firestore.rules` and comment out the public access rule.

2. **Deploy Rules**

   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Test Security**

   - Sign out and try to access data (should fail)
   - Sign in and verify data access works
   - Try accessing another user's data (should fail)

### Phase 5: Verification

1. **Functional Testing**
   - [ ] Sign in/out flow works
   - [ ] Data persists per user
   - [ ] All CRUD operations work
   - [ ] Offline mode still functions
   - [ ] No console errors

2. **Security Testing**
   - [ ] Unauthenticated users cannot read data
   - [ ] Unauthenticated users cannot write data
   - [ ] Users cannot read other users' data
   - [ ] Users cannot modify other users' data

3. **Performance Testing**
   - [ ] App loads in < 3 seconds
   - [ ] No Firebase quota exceeded errors
   - [ ] Queries are optimized with indexes

## Error Handling Improvements

### Current State
- Basic try-catch blocks exist
- Generic alert messages shown
- Console logging for debugging

### Recommended Improvements

1. **User-Friendly Error Messages**

   ```javascript
   catch (error) {
       let userMessage = 'An error occurred';
       
       if (error.code === 'permission-denied') {
           userMessage = 'You do not have permission to access this data';
       } else if (error.code === 'unavailable') {
           userMessage = 'Network connection lost. Please check your internet';
       } else if (error.code === 'unauthenticated') {
           userMessage = 'Please sign in to continue';
       }
       
       showUserFriendlyError(userMessage, error);
   }
   ```

2. **Retry Logic with Exponential Backoff**

   ```javascript
   async function retryOperation(operation, maxRetries = 3) {
       for (let i = 0; i < maxRetries; i++) {
           try {
               return await operation();
           } catch (error) {
               if (i === maxRetries - 1) throw error;
               
               const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
               await new Promise(resolve => setTimeout(resolve, delay));
           }
       }
   }
   ```

3. **Offline Queue**

   ```javascript
   const offlineQueue = [];
   
   window.addEventListener('online', async () => {
       console.log('Connection restored, processing queue...');
       
       while (offlineQueue.length > 0) {
           const operation = offlineQueue.shift();
           try {
               await operation();
           } catch (error) {
               console.error('Failed to process queued operation:', error);
               offlineQueue.unshift(operation); // Re-add to queue
               break;
           }
       }
   });
   ```

## Testing Checklist

### Manual Testing

**Workout Tab**
- [ ] Can select day
- [ ] Can add/edit exercises
- [ ] Can log workout
- [ ] Settings button opens modal
- [ ] All buttons clickable

**Calendar Tab**
- [ ] Calendar renders
- [ ] Can navigate months
- [ ] Can mark sick days
- [ ] Travel mode works

**Nutrition Tab**
- [ ] Can add foods
- [ ] Search works (renderSavedFoods)
- [ ] Inline search works (renderInlineSavedFoods)
- [ ] Can create meals

**Body Metrics Tab**
- [ ] Can log weight
- [ ] Can upload photos
- [ ] Charts display

**All Tabs**
- [ ] Tab switching works
- [ ] Data persists after refresh
- [ ] No console errors

## Monitoring & Logging

### Recommended Tools

1. **Firebase Crashlytics**
   - Track JavaScript errors
   - Monitor crash-free users
   - Identify problematic code paths

2. **Firebase Performance Monitoring**
   - Track page load times
   - Monitor network requests
   - Identify slow queries

3. **Firebase Analytics**
   - Track user engagement
   - Monitor feature usage
   - A/B testing

### Implementation

```javascript
// Add to app.js after Firebase initialization
import { getAnalytics, logEvent } from 
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const analytics = getAnalytics(app);

// Track key events
function trackWorkoutCompleted(workoutType) {
    logEvent(analytics, 'workout_completed', {
        workout_type: workoutType,
        timestamp: Date.now()
    });
}
```

## Deployment Process

### Development → Production

1. **Pre-Deployment**
   ```bash
   # Run local tests
   npm run test  # If tests exist
   
   # Check for console errors
   # Verify all features work
   # Review Firebase console for quota usage
   ```

2. **Deploy**
   ```bash
   # Deploy hosting
   firebase deploy --only hosting
   
   # Deploy rules (if updated)
   firebase deploy --only firestore:rules
   ```

3. **Post-Deployment**
   - Monitor Firebase console for errors
   - Test production URL
   - Check analytics for user activity
   - Monitor Firebase quotas

## Rollback Plan

If deployment causes issues:

```bash
# Rollback hosting
firebase hosting:rollback

# Or revert to specific commit
git revert <commit-hash>
git push
firebase deploy --only hosting
```

## Security Best Practices

1. **Never Commit Secrets**
   - Firebase config is OK (client-side keys are public)
   - Never commit service account keys
   - Never commit environment variables with sensitive data

2. **Keep Dependencies Updated**
   ```bash
   # Check for Firebase updates
   npm outdated
   
   # Update carefully
   npm update firebase
   ```

3. **Regular Security Audits**
   - Review Firestore rules quarterly
   - Check Firebase Authentication logs
   - Monitor for suspicious activity
   - Review security advisories

4. **Data Privacy**
   - Comply with GDPR if needed
   - Implement data export functionality
   - Allow users to delete their data
   - Document data retention policies

## Support & Maintenance

### Common Issues

**Issue: App stuck on "Initializing..."**
- Check browser console for errors
- Verify Firebase configuration
- Check network connectivity
- Clear browser cache

**Issue: Functions not defined errors**
- Verify window exports are present
- Check browser supports ES modules
- Review console for import errors

**Issue: Permission denied errors**
- Check Firestore rules
- Verify user is authenticated
- Confirm userId is included in documents

### Getting Help

- Firebase Documentation: https://firebase.google.com/docs
- Firestore Rules Reference: https://firebase.google.com/docs/firestore/security/get-started
- Firebase Status: https://status.firebase.google.com/

---

## Summary

**Current State**: Basic authentication enabled, rules documented, module scope fixed

**To Production**: 
1. Add authentication UI
2. Add userId to all operations
3. Migrate existing data
4. Deploy security rules
5. Test thoroughly

**Timeline**: 2-4 hours for experienced developer, 1-2 days for comprehensive testing

**Risk Level**: Medium (requires data migration and can't easily rollback data changes)
