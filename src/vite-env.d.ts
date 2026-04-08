/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  readonly VITE_ADMIN_EMAILS?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_SARVAM_API_KEY?: string;
  readonly VITE_SARVAM_BASE_URL?: string;
  readonly VITE_EMERGENT_API_KEY?: string;
  readonly VITE_EMERGENT_BASE_URL?: string;
  readonly VITE_PRIMARY_ADMIN_EMAIL?: string;
  readonly VITE_PRIMARY_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
