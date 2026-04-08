import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export type GlobalSyncState = {
  source?: string;
  updatedAt?: { seconds: number };
};

export async function touchGlobalSync(source: string) {
  await setDoc(
    doc(db, "platform_settings", "sync_state"),
    {
      source: source.trim() || "unknown",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenGlobalSyncState(onData: (state: GlobalSyncState | null) => void) {
  return onSnapshot(doc(db, "platform_settings", "sync_state"), (snapshot) => {
    if (!snapshot.exists()) {
      onData(null);
      return;
    }
    onData(snapshot.data() as GlobalSyncState);
  });
}
