import {
  collection,
  collectionGroup,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import type { TestAttemptDoc } from "./questionService";
import { db } from "../firebase/firebaseConfig";

export type UserProfileDoc = {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: "student" | "admin";
  createdAt?: { seconds: number };
  lastLoginAt?: { seconds: number };
};

export type AdminAttemptDoc = TestAttemptDoc & {
  userId: string;
};

export async function upsertUserProfile(user: User, isAdmin: boolean) {
  const profileRef = doc(db, "users", user.uid);
  const segmentRef = doc(db, "user_segments", user.uid);

  await setDoc(
    profileRef,
    {
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      photoURL: user.photoURL ?? "",
      role: isAdmin ? "admin" : "student",
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );

  if (!isAdmin) {
    await setDoc(
      segmentRef,
      {
        userId: user.uid,
        email: user.email ?? "",
        segments: ["all_students"],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export function listenToUserProfiles(onData: (rows: UserProfileDoc[]) => void) {
  const usersRef = collection(db, "users");
  const usersQuery = query(usersRef, orderBy("lastLoginAt", "desc"), limit(100));

  return onSnapshot(usersQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as UserProfileDoc[];

    onData(rows);
  });
}

export function listenToGlobalTestAttempts(onData: (rows: AdminAttemptDoc[]) => void) {
  const historyRef = collectionGroup(db, "test_history");
  const historyQuery = query(historyRef, orderBy("createdAt", "desc"), limit(120));

  return onSnapshot(historyQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => {
      const userId = docItem.ref.parent.parent?.id ?? "unknown";
      return {
        id: docItem.id,
        userId,
        ...(docItem.data() as DocumentData),
      } as AdminAttemptDoc;
    });

    onData(rows);
  });
}
