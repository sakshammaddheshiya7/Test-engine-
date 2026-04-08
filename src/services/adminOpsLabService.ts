import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { publishNotification } from "./notificationService";

export type SchedulerJobType = "announcement" | "notification" | "banner";

export type ScheduledJob = {
  id: string;
  type: SchedulerJobType;
  title: string;
  message: string;
  scheduleAt?: { seconds: number };
  status: "pending" | "executed" | "failed";
  tone?: "info" | "warning" | "critical";
  ctaRoute?: string;
  error?: string;
  createdAt?: { seconds: number };
  executedAt?: { seconds: number };
};

export type QuestionVersionDoc = {
  id: string;
  questionId: string;
  note: string;
  snapshot: Record<string, unknown>;
  createdAt?: { seconds: number };
};

export type PlatformStatus = {
  usersCount: number;
  questionsCount: number;
  pdfCount: number;
  aiRuntimeConfigured: boolean;
  generatedAt?: { seconds: number };
};

export async function createScheduledJob(input: {
  type: SchedulerJobType;
  title: string;
  message: string;
  scheduleAtMs: number;
  tone?: "info" | "warning" | "critical";
  ctaRoute?: string;
}) {
  await addDoc(collection(db, "scheduled_jobs"), {
    type: input.type,
    title: input.title.trim().slice(0, 120),
    message: input.message.trim().slice(0, 1200),
    scheduleAt: Timestamp.fromMillis(input.scheduleAtMs),
    tone: input.tone ?? "info",
    ctaRoute: input.ctaRoute?.trim() ?? "",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function listenScheduledJobs(onData: (rows: ScheduledJob[]) => void) {
  const rowsQuery = query(collection(db, "scheduled_jobs"), orderBy("scheduleAt", "asc"), limit(120));
  return onSnapshot(rowsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as ScheduledJob[];
    onData(rows);
  });
}

async function executeJob(row: ScheduledJob) {
  if (row.type === "announcement") {
    await addDoc(collection(db, "announcements"), {
      title: row.title,
      message: row.message,
      createdAt: serverTimestamp(),
      source: "scheduler",
    });
  }

  if (row.type === "notification") {
    await publishNotification({
      title: row.title,
      body: row.message,
      kind: "announcement",
      audience: "all",
      ctaRoute: row.ctaRoute || undefined,
    });
  }

  if (row.type === "banner") {
    await setDoc(
      doc(db, "platform_settings", "global_app_config"),
      {
        banner: {
          enabled: true,
          text: row.message,
          tone: row.tone ?? "info",
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export async function runScheduledJobNow(jobId: string) {
  const rowRef = doc(db, "scheduled_jobs", jobId);
  const rowSnap = await getDoc(rowRef);
  if (!rowSnap.exists()) {
    throw new Error("Scheduled job not found.");
  }

  const row = { id: rowSnap.id, ...(rowSnap.data() as Omit<ScheduledJob, "id">) } as ScheduledJob;
  if (row.status === "executed") {
    return;
  }

  try {
    await executeJob(row);
    await setDoc(
      rowRef,
      {
        status: "executed",
        executedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        error: "",
      },
      { merge: true },
    );
  } catch (error) {
    await setDoc(
      rowRef,
      {
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 240) : "Unknown scheduler error",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
}

export async function processDueScheduledJobs() {
  const now = Timestamp.now();
  const dueQuery = query(collection(db, "scheduled_jobs"), where("status", "==", "pending"), where("scheduleAt", "<=", now), limit(50));
  const rows = await getDocs(dueQuery);
  for (const row of rows.docs) {
    await runScheduledJobNow(row.id);
  }
  return rows.size;
}

export async function createQuestionVersionSnapshot(questionId: string, note: string) {
  const questionRef = doc(db, "questions", questionId);
  const questionSnapshot = await getDoc(questionRef);
  if (!questionSnapshot.exists()) {
    throw new Error("Question not found for snapshot.");
  }

  await addDoc(collection(db, "question_versions"), {
    questionId,
    note: note.trim().slice(0, 200) || "manual_snapshot",
    snapshot: questionSnapshot.data(),
    createdAt: serverTimestamp(),
  });
}

export function listenQuestionVersions(questionId: string, onData: (rows: QuestionVersionDoc[]) => void) {
  const rowsQuery = query(collection(db, "question_versions"), where("questionId", "==", questionId), orderBy("createdAt", "desc"), limit(40));
  return onSnapshot(rowsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as QuestionVersionDoc[];
    onData(rows);
  });
}

export async function rollbackQuestionVersion(versionId: string) {
  const versionRef = doc(db, "question_versions", versionId);
  const versionSnapshot = await getDoc(versionRef);
  if (!versionSnapshot.exists()) {
    throw new Error("Version not found.");
  }

  const payload = versionSnapshot.data() as Omit<QuestionVersionDoc, "id">;
  if (!payload.questionId || !payload.snapshot) {
    throw new Error("Invalid version snapshot.");
  }

  await setDoc(
    doc(db, "questions", payload.questionId),
    {
      ...payload.snapshot,
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );
}

export async function refreshPlatformStatus() {
  const [users, questions, pdfs, aiRuntime] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "questions")),
    getCountFromServer(collection(db, "pdf_library")),
    getDoc(doc(db, "platform_settings", "ai_runtime")),
  ]);

  const aiRuntimeData = aiRuntime.data() as Record<string, unknown> | undefined;
  const aiRuntimeConfigured = Boolean(
    (typeof aiRuntimeData?.openRouterApiKey === "string" && aiRuntimeData.openRouterApiKey.length > 10) ||
      (typeof aiRuntimeData?.sarvamApiKey === "string" && aiRuntimeData.sarvamApiKey.length > 10) ||
      (typeof aiRuntimeData?.emergentApiKey === "string" && aiRuntimeData.emergentApiKey.length > 10),
  );

  await setDoc(
    doc(db, "platform_settings", "platform_status"),
    {
      usersCount: users.data().count,
      questionsCount: questions.data().count,
      pdfCount: pdfs.data().count,
      aiRuntimeConfigured,
      generatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenPlatformStatus(onData: (status: PlatformStatus | null) => void) {
  const rowRef = doc(db, "platform_settings", "platform_status");
  return onSnapshot(rowRef, (snapshot) => {
    if (!snapshot.exists()) {
      onData(null);
      return;
    }

    onData(snapshot.data() as PlatformStatus);
  });
}
