import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export type BackupDoc = {
  id: string;
  label: string;
  createdBy: string;
  settingsSnapshot: Record<string, unknown>;
  stats: {
    users: number;
    questions: number;
    pdfs: number;
    tests: number;
  };
  createdAt?: { seconds: number };
};

export type FirestoreIndexRecommendation = {
  id: string;
  collectionName: string;
  fields: string[];
  purpose: string;
  status: "suggested" | "approved" | "ignored";
  createdAt?: { seconds: number };
};

export type ContentLicensingPolicy = {
  enablePremiumAccess: boolean;
  premiumSubjects: string[];
  lockedPdfCategories: string[];
  premiumMessage: string;
};

export type SystemLoadSnapshot = {
  id: string;
  activeUsers: number;
  pendingJobs: number;
  activeLiveTests: number;
  errorLogs24h: number;
  level: "low" | "moderate" | "high";
  generatedAt?: { seconds: number };
};

const DEFAULT_LICENSING: ContentLicensingPolicy = {
  enablePremiumAccess: false,
  premiumSubjects: [],
  lockedPdfCategories: [],
  premiumMessage: "This content is available in premium access mode.",
};

async function readPlatformSettingsSnapshot() {
  const ids = ["global_app_config", "usage_policy", "ai_tools", "ai_runtime", "access_policy", "content_licensing"];
  const docs = await Promise.all(ids.map((id) => getDoc(doc(db, "platform_settings", id))));
  const snapshot: Record<string, unknown> = {};
  docs.forEach((row, index) => {
    snapshot[ids[index]] = row.exists() ? row.data() : {};
  });
  return snapshot;
}

export async function createSystemBackup(label: string, createdBy: string) {
  const [users, questions, pdfs, tests, settingsSnapshot] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "questions")),
    getCountFromServer(collection(db, "pdf_library")),
    getCountFromServer(collection(db, "leaderboard_public")),
    readPlatformSettingsSnapshot(),
  ]);

  await addDoc(collection(db, "system_backups"), {
    label: label.trim().slice(0, 120) || `backup_${new Date().toISOString()}`,
    createdBy,
    settingsSnapshot,
    stats: {
      users: users.data().count,
      questions: questions.data().count,
      pdfs: pdfs.data().count,
      tests: tests.data().count,
    },
    createdAt: serverTimestamp(),
  });
}

export function listenSystemBackups(onData: (rows: BackupDoc[]) => void) {
  const rowsQuery = query(collection(db, "system_backups"), orderBy("createdAt", "desc"), limit(40));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(
      snapshot.docs.map((row) => ({
        id: row.id,
        ...(row.data() as Omit<BackupDoc, "id">),
      })),
    );
  });
}

export async function restoreSystemBackup(backupId: string) {
  const row = await getDoc(doc(db, "system_backups", backupId));
  if (!row.exists()) {
    throw new Error("Backup not found.");
  }
  const payload = row.data() as Omit<BackupDoc, "id">;
  const snapshot = (payload.settingsSnapshot || {}) as Record<string, Record<string, unknown>>;
  const ids = ["global_app_config", "usage_policy", "ai_tools", "ai_runtime", "access_policy", "content_licensing"];

  await Promise.all(
    ids.map((id) =>
      setDoc(
        doc(db, "platform_settings", id),
        {
          ...(snapshot[id] || {}),
          restoredAt: serverTimestamp(),
          restoredFromBackupId: backupId,
        },
        { merge: true },
      ),
    ),
  );
}

export function listenIndexRecommendations(onData: (rows: FirestoreIndexRecommendation[]) => void) {
  const rowsQuery = query(collection(db, "firestore_index_advisor"), orderBy("createdAt", "desc"), limit(80));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(
      snapshot.docs.map((row) => ({
        id: row.id,
        ...(row.data() as Omit<FirestoreIndexRecommendation, "id">),
      })),
    );
  });
}

export async function seedIndexRecommendations() {
  const seeds = [
    { collectionName: "questions", fields: ["subject", "chapter", "topic", "difficulty", "type"], purpose: "custom test filtering" },
    { collectionName: "pdf_library", fields: ["subject", "chapter", "category"], purpose: "library hierarchy load" },
    { collectionName: "feedback_reports", fields: ["userId", "createdAt"], purpose: "student feedback history" },
    { collectionName: "live_activity", fields: ["lastSeenAt", "currentPath"], purpose: "live activity monitor" },
    { collectionName: "leaderboard_public", fields: ["allTimeXp", "weeklyXp", "dailyXp"], purpose: "leaderboards" },
  ];

  await Promise.all(
    seeds.map((seed) =>
      addDoc(collection(db, "firestore_index_advisor"), {
        ...seed,
        status: "suggested",
        createdAt: serverTimestamp(),
      }),
    ),
  );
}

export async function updateIndexRecommendationStatus(id: string, status: FirestoreIndexRecommendation["status"]) {
  await setDoc(
    doc(db, "firestore_index_advisor", id),
    {
      status,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function runLoadMonitorSnapshot() {
  const [liveRows, pendingJobsRows, liveTestsRows, recentErrors] = await Promise.all([
    getDocs(query(collection(db, "live_activity"), limit(400))),
    getDocs(query(collection(db, "scheduled_jobs"), where("status", "==", "pending"), limit(200))),
    getDocs(query(collection(db, "live_tests"), where("status", "==", "live"), limit(60))),
    getDocs(query(collection(db, "app_error_logs"), orderBy("createdAt", "desc"), limit(400))),
  ]);

  const nowMs = Date.now();
  const activeUsers = liveRows.docs.filter((row) => nowMs - ((row.data().lastActiveAt?.seconds || 0) * 1000) <= 5 * 60 * 1000).length;
  const pendingJobs = pendingJobsRows.size;
  const activeLiveTests = liveTestsRows.size;
  const errorLogs24h = recentErrors.docs.filter((row) => nowMs - ((row.data().createdAt?.seconds || 0) * 1000) <= 24 * 60 * 60 * 1000).length;

  const loadScore = activeUsers + activeLiveTests * 5 + pendingJobs * 0.4 + errorLogs24h * 0.2;
  const level: SystemLoadSnapshot["level"] = loadScore > 180 ? "high" : loadScore > 70 ? "moderate" : "low";

  await addDoc(collection(db, "system_load_snapshots"), {
    activeUsers,
    pendingJobs,
    activeLiveTests,
    errorLogs24h,
    level,
    generatedAt: serverTimestamp(),
  });
}

export function listenLoadMonitorSnapshots(onData: (rows: SystemLoadSnapshot[]) => void) {
  const rowsQuery = query(collection(db, "system_load_snapshots"), orderBy("generatedAt", "desc"), limit(24));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(
      snapshot.docs.map((row) => ({
        id: row.id,
        ...(row.data() as DocumentData),
      })) as SystemLoadSnapshot[],
    );
  });
}

export function listenContentLicensingPolicy(onData: (policy: ContentLicensingPolicy) => void) {
  return onSnapshot(doc(db, "platform_settings", "content_licensing"), (snapshot) => {
    if (!snapshot.exists()) {
      onData(DEFAULT_LICENSING);
      return;
    }

    const data = snapshot.data() as Partial<ContentLicensingPolicy>;
    onData({
      enablePremiumAccess: Boolean(data.enablePremiumAccess),
      premiumSubjects: Array.isArray(data.premiumSubjects) ? data.premiumSubjects.filter(Boolean) : [],
      lockedPdfCategories: Array.isArray(data.lockedPdfCategories) ? data.lockedPdfCategories.filter(Boolean) : [],
      premiumMessage: (data.premiumMessage || DEFAULT_LICENSING.premiumMessage).slice(0, 220),
    });
  });
}

export async function saveContentLicensingPolicy(policy: ContentLicensingPolicy) {
  await setDoc(
    doc(db, "platform_settings", "content_licensing"),
    {
      enablePremiumAccess: policy.enablePremiumAccess,
      premiumSubjects: policy.premiumSubjects,
      lockedPdfCategories: policy.lockedPdfCategories,
      premiumMessage: policy.premiumMessage.slice(0, 220),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function runSmartCleanup() {
  const [failedJobs, oldLogs] = await Promise.all([
    getDocs(query(collection(db, "scheduled_jobs"), where("status", "==", "failed"), limit(120))),
    getDocs(query(collection(db, "app_error_logs"), orderBy("createdAt", "asc"), limit(120))),
  ]);

  const nowMs = Date.now();
  const staleLogs = oldLogs.docs.filter((row) => nowMs - ((row.data().createdAt?.seconds || 0) * 1000) > 10 * 24 * 60 * 60 * 1000);

  await Promise.all([
    ...failedJobs.docs.map((row) => deleteDoc(row.ref)),
    ...staleLogs.map((row) => deleteDoc(row.ref)),
  ]);

  return {
    removedFailedJobs: failedJobs.size,
    removedStaleLogs: staleLogs.length,
  };
}
