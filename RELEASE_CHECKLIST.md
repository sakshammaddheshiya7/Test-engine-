# RankForge Release Checklist

## 1. Environment Variables

- Add Firebase keys in `.env`.
- Add admin email list in `VITE_ADMIN_EMAILS`.
- Add AI keys:
  - `VITE_OPENROUTER_API_KEY`
  - `VITE_SARVAM_API_KEY`
  - `VITE_EMERGENT_API_KEY`

## 2. Firebase Console Setup

- Authentication:
  - Enable Email/Password provider.
  - Enable Google provider.
  - Add production domain in Authorized Domains.
- Firestore:
  - Deploy `firestore.rules`.
- Storage:
  - Deploy `storage.rules`.

## 3. Build and PWA Validation

- Run `npm run build`.
- Verify `dist/manifest.webmanifest` is generated.
- Open production preview and confirm:
  - Install prompt appears.
  - Offline fallback page appears without network.
  - App loads from home screen after install.

## 4. Capacitor Android Flow

- Run `npx cap add android` (first time only).
- Run `npm run build`.
- Run `npx cap sync android`.
- Run `npx cap open android` and build signed APK/AAB in Android Studio.

## 5. Live Data Sanity Checks

- Admin uploads question from panel -> appears in student test generation.
- Admin uploads PDF -> appears in student library.
- Admin posts announcement/social links -> appears on dashboard instantly.
- Student test attempts are saved in `users/{uid}/test_history`.
- Wrong answers and bookmarks save into user subcollections.

## 6. Update Safety Check

- Install old app build and upload sample content from admin.
- Install new app build/version.
- Confirm previously uploaded Firebase content is still visible.
