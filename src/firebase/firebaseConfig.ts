import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const fallbackFirebaseConfig = {
  // Fallback allows app boot even when .env is not filled yet.
  apiKey: "AIzaSyCJWDVkVuKI1Dcs1i0rqn5twtRbbuDPfo4",
  authDomain: "test-engine-eaefc.firebaseapp.com",
  projectId: "test-engine-eaefc",
  storageBucket: "test-engine-eaefc.firebasestorage.app",
  messagingSenderId: "206014037955",
  appId: "1:206014037955:web:7f04aa12b6c1be8d6fc776",
  measurementId: "G-85WQTM3B94",
};

function readEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const firebaseConfig = {
  apiKey: readEnv(import.meta.env.VITE_FIREBASE_API_KEY) ?? fallbackFirebaseConfig.apiKey,
  authDomain: readEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) ?? fallbackFirebaseConfig.authDomain,
  projectId: readEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID) ?? fallbackFirebaseConfig.projectId,
  storageBucket: readEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) ?? fallbackFirebaseConfig.storageBucket,
  messagingSenderId:
    readEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ?? fallbackFirebaseConfig.messagingSenderId,
  appId: readEnv(import.meta.env.VITE_FIREBASE_APP_ID) ?? fallbackFirebaseConfig.appId,
  measurementId: readEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) ?? fallbackFirebaseConfig.measurementId,
};

if (!readEnv(import.meta.env.VITE_FIREBASE_API_KEY)) {
  console.warn("Using fallback Firebase config. Add VITE_FIREBASE_* values in .env for your own project.");
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
