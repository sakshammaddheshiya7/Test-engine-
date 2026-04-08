import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "./firebaseConfig";
import { PRIMARY_ADMIN_EMAIL, PRIMARY_ADMIN_PASSWORD } from "../config/admin";

const googleProvider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence failed:", error);
});

export function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "Login failed. Please try again.";
  }

  switch (error.code) {
    case "auth/invalid-login-credentials":
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password. Please check your credentials.";
    case "auth/user-disabled":
      return "This account is disabled. Contact admin support.";
    case "auth/invalid-email":
      return "Invalid email format.";
    case "auth/email-already-in-use":
      return "This email is already registered. Please login instead.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/internal-error":
      return "Authentication service is temporarily unavailable. Please retry in a moment.";
    case "auth/invalid-api-key":
      return "Firebase API key is invalid. Check your Firebase config.";
    case "auth/app-not-authorized":
      return "This app is not authorized in Firebase Auth settings.";
    case "auth/operation-not-allowed":
      return "Email/Password login is disabled in Firebase Auth. Enable it from Firebase Console.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before completing login.";
    case "auth/popup-blocked":
      return "Google login popup was blocked by your browser.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for Google login in Firebase Auth settings.";
    case "auth/operation-not-supported-in-this-environment":
      return "Google popup is blocked in this environment. Use redirect login or email login.";
    case "auth/account-exists-with-different-credential":
      return "Account exists with different sign-in method. Try email login for this account.";
    default:
      return error.message || "Login failed. Please try again.";
  }
}

export async function loginWithEmail(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // Keep admin login strict to the single configured password for email sign-in.
  if (normalizedEmail === PRIMARY_ADMIN_EMAIL && password !== PRIMARY_ADMIN_PASSWORD) {
    throw new Error("Invalid email or password. Please check your credentials.");
  }

  try {
    return await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (error) {
    const firebaseError = error instanceof FirebaseError ? error : null;

    // First-time bootstrap for admin email: create the admin account if it does not exist yet.
    if (
      firebaseError?.code === "auth/user-not-found" &&
      normalizedEmail === PRIMARY_ADMIN_EMAIL &&
      password === PRIMARY_ADMIN_PASSWORD
    ) {
      try {
        return await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      } catch (createError) {
        throw new Error(getAuthErrorMessage(createError));
      }
    }

    throw new Error(getAuthErrorMessage(error));
  }
}

export async function loginWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error instanceof FirebaseError && ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(error.code)) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    throw new Error(getAuthErrorMessage(error));
  }
}

export async function registerWithEmail(email: string, password: string) {
  try {
    return await createUserWithEmailAndPassword(auth, email.trim(), password);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export function logout() {
  return signOut(auth);
}
