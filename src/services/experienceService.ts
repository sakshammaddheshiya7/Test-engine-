import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export type FeedbackCategory = "bug" | "feature" | "content" | "ui" | "other";
export type FeedbackStatus = "open" | "reviewing" | "resolved";

export type FeedbackDoc = {
  id: string;
  userId: string;
  userEmail: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: "draft" | "published";
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
};

export type UsagePolicy = {
  dailyTestAttempts: number;
  dailyAiMessages: number;
  dailyPdfDownloads: number;
  premiumModeEnabled: boolean;
};

const defaultUsagePolicy: UsagePolicy = {
  dailyTestAttempts: 12,
  dailyAiMessages: 30,
  dailyPdfDownloads: 20,
  premiumModeEnabled: false,
};

export async function submitFeedback(input: {
  userId: string;
  userEmail: string;
  category: FeedbackCategory;
  message: string;
}) {
  await addDoc(collection(db, "feedback_reports"), {
    ...input,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function listenOwnFeedback(userId: string, onData: (rows: FeedbackDoc[]) => void) {
  const rowsQuery = query(
    collection(db, "feedback_reports"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(40),
  );
  return onSnapshot(rowsQuery, (snapshot) =>
    onData(
      snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Omit<FeedbackDoc, "id">),
      })),
    ),
  );
}

export function listenAllFeedback(onData: (rows: FeedbackDoc[]) => void) {
  const rowsQuery = query(collection(db, "feedback_reports"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(rowsQuery, (snapshot) =>
    onData(
      snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Omit<FeedbackDoc, "id">),
      })),
    ),
  );
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus, adminNote = "") {
  await updateDoc(doc(db, "feedback_reports", id), {
    status,
    adminNote,
    updatedAt: serverTimestamp(),
  });
}

export async function saveKnowledgeArticle(input: {
  id?: string;
  title: string;
  body: string;
  tags: string[];
  status: "draft" | "published";
}) {
  const ref = input.id ? doc(db, "knowledge_base", input.id) : doc(collection(db, "knowledge_base"));
  await setDoc(
    ref,
    {
      title: input.title,
      body: input.body,
      tags: input.tags,
      status: input.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenKnowledgeArticles(includeDrafts: boolean, onData: (rows: KnowledgeArticle[]) => void) {
  const rowsQuery = includeDrafts
    ? query(collection(db, "knowledge_base"), orderBy("updatedAt", "desc"), limit(120))
    : query(collection(db, "knowledge_base"), where("status", "==", "published"), orderBy("updatedAt", "desc"), limit(120));
  return onSnapshot(rowsQuery, (snapshot) =>
    onData(
      snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Omit<KnowledgeArticle, "id">),
      })),
    ),
  );
}

export function listenUsagePolicy(onData: (policy: UsagePolicy) => void) {
  const ref = doc(db, "platform_settings", "usage_policy");
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      onData(defaultUsagePolicy);
      return;
    }
    onData({
      ...defaultUsagePolicy,
      ...(snapshot.data() as Partial<UsagePolicy>),
    });
  });
}

export async function saveUsagePolicy(policy: Partial<UsagePolicy>) {
  await setDoc(
    doc(db, "platform_settings", "usage_policy"),
    {
      ...policy,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function claimUsage(userId: string, usageKey: "test" | "ai", limitCount: number) {
  const today = new Date().toISOString().slice(0, 10);
  const userRef = doc(db, "users", userId);
  const snapshot = await getDoc(userRef);
  const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
  const usageState = (data.usageState as Record<string, unknown> | undefined) ?? {};
  const usageDay = String(usageState.day ?? "");
  const usageCounters = (usageState.counters as Record<string, number> | undefined) ?? {};

  const currentCounters = usageDay === today ? usageCounters : {};
  const currentValue = Number(currentCounters[usageKey] ?? 0);
  if (currentValue >= limitCount) {
    return {
      allowed: false,
      used: currentValue,
      limit: limitCount,
    };
  }

  const nextValue = currentValue + 1;
  await setDoc(
    userRef,
    {
      usageState: {
        day: today,
        counters: {
          ...currentCounters,
          [usageKey]: nextValue,
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return {
    allowed: true,
    used: nextValue,
    limit: limitCount,
  };
}
