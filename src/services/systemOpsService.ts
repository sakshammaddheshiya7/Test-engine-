import {
  addDoc,
  collection,
  collectionGroup,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export type AppErrorLog = {
  id: string;
  message: string;
  source: string;
  route?: string;
  stack?: string;
  createdAt?: { seconds: number };
};

export type SystemHealthSnapshot = {
  id: string;
  usersCount: number;
  questionsCount: number;
  pdfCount: number;
  notificationsCount: number;
  liveActivityCount: number;
  testsCount: number;
  generatedAt?: { seconds: number };
};

export async function logClientError(input: {
  message: string;
  source: string;
  route?: string;
  stack?: string;
}) {
  await addDoc(collection(db, "app_error_logs"), {
    message: input.message.trim().slice(0, 800),
    source: input.source.trim().slice(0, 120),
    route: input.route?.trim().slice(0, 260) ?? "",
    stack: input.stack?.slice(0, 3000) ?? "",
    createdAt: serverTimestamp(),
  });
}

export function listenErrorLogs(onData: (rows: AppErrorLog[]) => void) {
  const logsQuery = query(collection(db, "app_error_logs"), orderBy("createdAt", "desc"), limit(80));
  return onSnapshot(logsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as AppErrorLog[];
    onData(rows);
  });
}

export async function generateSystemHealthSnapshot() {
  const [users, questions, pdfs, notifications, liveActivity, tests] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "questions")),
    getCountFromServer(collection(db, "pdf_library")),
    getCountFromServer(collection(db, "notifications")),
    getCountFromServer(collection(db, "live_activity")),
    getCountFromServer(collectionGroup(db, "test_history")),
  ]);

  await addDoc(collection(db, "system_health_snapshots"), {
    usersCount: users.data().count,
    questionsCount: questions.data().count,
    pdfCount: pdfs.data().count,
    notificationsCount: notifications.data().count,
    liveActivityCount: liveActivity.data().count,
    testsCount: tests.data().count,
    generatedAt: serverTimestamp(),
  });
}

export function listenSystemHealthSnapshots(onData: (rows: SystemHealthSnapshot[]) => void) {
  const rowsQuery = query(collection(db, "system_health_snapshots"), orderBy("generatedAt", "desc"), limit(20));
  return onSnapshot(rowsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as SystemHealthSnapshot[];
    onData(rows);
  });
}