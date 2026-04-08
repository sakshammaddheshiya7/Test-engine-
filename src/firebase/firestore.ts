import { collection, onSnapshot, orderBy, query, type QueryConstraint } from "firebase/firestore";
import { db } from "./firebaseConfig";

export type Announcement = {
  id: string;
  title: string;
  message: string;
  createdAt?: { seconds: number };
};

export type AdminLinks = {
  instagram?: string;
  telegram?: string;
  youtube?: string;
  qrCodeUrl?: string;
};

export function listenToCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  onData: (rows: T[]) => void,
  onError?: (error: Error) => void,
) {
  const collectionRef = collection(db, collectionName);
  const q = query(collectionRef, ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as T[];
      onData(rows);
    },
    (error) => {
      onError?.(error);
    },
  );
}

export function listenToCollectionWithRetry<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  onData: (rows: T[]) => void,
  onError?: (error: Error) => void,
  maxRetries = 4,
) {
  let disposed = false;
  let retryCount = 0;
  let unsubscribe = () => {};

  const attach = () => {
    if (disposed) {
      return;
    }

    unsubscribe = listenToCollection<T>(
      collectionName,
      constraints,
      onData,
      (error) => {
        onError?.(error);
        unsubscribe();

        if (retryCount >= maxRetries || disposed) {
          return;
        }

        const retryDelayMs = Math.min(1000 * 2 ** retryCount, 8000);
        retryCount += 1;
        globalThis.setTimeout(() => {
          attach();
        }, retryDelayMs);
      },
    );
  };

  attach();

  return () => {
    disposed = true;
    unsubscribe();
  };
}

export function announcementConstraints() {
  return [orderBy("createdAt", "desc")];
}
