# Android Build Checklist

1. Build web app:
`npm run build`

2. Sync Capacitor Android project:
`npx cap sync android`

3. Open Android Studio:
`npx cap open android`

4. In Android Studio:
- Set release keystore
- Update versionCode/versionName
- Build signed APK/AAB

5. Firebase setup for Android app:
- Add Android app in Firebase project with package `com.rankforge.prep`
- Download `google-services.json`
- Place it in `android/app/`

All app content remains in Firebase (Firestore/Storage), so uploads persist across app updates.