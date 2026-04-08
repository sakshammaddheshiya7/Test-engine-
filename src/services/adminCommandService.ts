import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { generateStudentAssistantReply, getAiToolsSettings } from "./aiService";

export type AdminRole = "super_admin" | "content_manager" | "analytics_viewer" | "moderator";

export type AdminRoleDoc = {
  id: string;
  userId: string;
  email: string;
  role: AdminRole;
  permissions: string[];
  updatedAt?: { seconds: number };
};

export type BroadcastDoc = {
  id: string;
  title: string;
  message: string;
  status: "active" | "archived";
  tone: "info" | "warning" | "critical";
  ctaRoute?: string;
  createdAt?: { seconds: number };
};

export type SupportThreadDoc = {
  id: string;
  userId: string;
  userEmail: string;
  status: "open" | "closed";
  unreadForAdmin?: boolean;
  lastMessage?: string;
  lastMessageAt?: { seconds: number };
};

export type SupportMessageDoc = {
  id: string;
  senderRole: "student" | "admin" | "bot";
  senderId: string;
  senderEmail: string;
  text: string;
  createdAt?: { seconds: number };
};

export type RoadmapItemDoc = {
  id: string;
  title: string;
  description: string;
  status: "planned" | "in_progress" | "released";
  betaEnabled: boolean;
  createdAt?: { seconds: number };
};

export type RegistryStudentDoc = {
  id: string;
  email: string;
  fullName: string;
  uid?: string;
  tags: string[];
  source: "csv" | "json" | "manual";
  status: "active" | "invited";
  createdAt?: { seconds: number };
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function registryDocId(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9]/g, "_");
}

export async function upsertAdminRole(input: {
  userId: string;
  email: string;
  role: AdminRole;
  permissions: string[];
}) {
  await setDoc(
    doc(db, "admin_roles", input.userId),
    {
      userId: input.userId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      permissions: Array.from(new Set(input.permissions.map((item) => item.trim()).filter(Boolean))),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenAdminRoles(onData: (rows: AdminRoleDoc[]) => void) {
  const rowsQuery = query(collection(db, "admin_roles"), orderBy("updatedAt", "desc"), limit(80));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<AdminRoleDoc, "id">) })));
  });
}

export async function createBroadcast(input: {
  title: string;
  message: string;
  tone: "info" | "warning" | "critical";
  ctaRoute?: string;
}) {
  await addDoc(collection(db, "live_broadcasts"), {
    title: input.title.trim(),
    message: input.message.trim(),
    tone: input.tone,
    ctaRoute: input.ctaRoute?.trim() || "/",
    status: "active",
    createdAt: serverTimestamp(),
  });
}

export async function archiveBroadcast(broadcastId: string) {
  await updateDoc(doc(db, "live_broadcasts", broadcastId), {
    status: "archived",
    archivedAt: serverTimestamp(),
  });
}

export function listenBroadcastRows(onData: (rows: BroadcastDoc[]) => void) {
  const rowsQuery = query(collection(db, "live_broadcasts"), orderBy("createdAt", "desc"), limit(20));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<BroadcastDoc, "id">) })));
  });
}

export function listenActiveBroadcast(onData: (row: BroadcastDoc | null) => void) {
  const rowsQuery = query(collection(db, "live_broadcasts"), orderBy("createdAt", "desc"), limit(12));
  return onSnapshot(rowsQuery, (snapshot) => {
    const firstActive = snapshot.docs
      .map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<BroadcastDoc, "id">) }))
      .find((row) => row.status === "active");
    onData(firstActive ?? null);
  });
}

export async function createRoadmapItem(input: {
  title: string;
  description: string;
  status: "planned" | "in_progress" | "released";
  betaEnabled: boolean;
}) {
  await addDoc(collection(db, "platform_roadmap"), {
    title: input.title.trim(),
    description: input.description.trim(),
    status: input.status,
    betaEnabled: input.betaEnabled,
    createdAt: serverTimestamp(),
  });
}

export async function updateRoadmapBeta(itemId: string, betaEnabled: boolean) {
  await updateDoc(doc(db, "platform_roadmap", itemId), {
    betaEnabled,
    updatedAt: serverTimestamp(),
  });
}

export function listenRoadmapItems(onData: (rows: RoadmapItemDoc[]) => void) {
  const rowsQuery = query(collection(db, "platform_roadmap"), orderBy("createdAt", "desc"), limit(80));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<RoadmapItemDoc, "id">) })));
  });
}

export function listenSupportThreads(onData: (rows: SupportThreadDoc[]) => void) {
  const rowsQuery = query(collection(db, "support_threads"), orderBy("lastMessageAt", "desc"), limit(100));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<SupportThreadDoc, "id">) })));
  });
}

export function listenSupportMessages(threadId: string, onData: (rows: SupportMessageDoc[]) => void) {
  const rowsQuery = query(collection(db, "support_threads", threadId, "messages"), orderBy("createdAt", "asc"), limit(300));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<SupportMessageDoc, "id">) })));
  });
}

export async function sendSupportMessage(input: {
  threadId: string;
  senderRole: "student" | "admin" | "bot";
  senderId: string;
  senderEmail: string;
  text: string;
}) {
  const clean = input.text.trim();
  if (!clean) {
    return;
  }

  await addDoc(collection(db, "support_threads", input.threadId, "messages"), {
    senderRole: input.senderRole,
    senderId: input.senderId,
    senderEmail: input.senderEmail,
    text: clean,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "support_threads", input.threadId),
    {
      userId: input.threadId,
      userEmail: input.senderRole === "student" ? input.senderEmail : "",
      status: "open",
      unreadForAdmin: input.senderRole === "student",
      lastMessage: clean.slice(0, 220),
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function closeSupportThread(threadId: string) {
  await setDoc(
    doc(db, "support_threads", threadId),
    {
      status: "closed",
      unreadForAdmin: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function sendStudentSupportMessageWithBot(input: {
  threadId: string;
  userId: string;
  userEmail: string;
  text: string;
}) {
  await sendSupportMessage({
    threadId: input.threadId,
    senderRole: "student",
    senderId: input.userId,
    senderEmail: input.userEmail,
    text: input.text,
  });

  try {
    const settings = await getAiToolsSettings();
    const ai = await generateStudentAssistantReply(
      {
        query: `Support query: ${input.text}. Reply as support bot in concise bullet points with clear next steps.`,
      },
      settings,
    );

    await sendSupportMessage({
      threadId: input.threadId,
      senderRole: "bot",
      senderId: "support-bot",
      senderEmail: "bot@rankforge.local",
      text: ai.answer,
    });
  } catch {
    await sendSupportMessage({
      threadId: input.threadId,
      senderRole: "bot",
      senderId: "support-bot",
      senderEmail: "bot@rankforge.local",
      text: "Support bot could not process this right now. Admin will respond soon. Keep practicing and share exact error details.",
    });
  }
}

export async function upsertBulkStudentRegistry(
  rows: Array<{
    email: string;
    fullName?: string;
    uid?: string;
    tags?: string[];
    source?: "csv" | "json" | "manual";
  }>,
) {
  const cleaned = rows
    .map((row) => ({
      email: normalizeEmail(row.email),
      fullName: (row.fullName ?? "").trim(),
      uid: row.uid?.trim() || "",
      tags: Array.from(new Set((row.tags ?? []).map((tag) => tag.trim()).filter(Boolean))),
      source: row.source ?? "json",
    }))
    .filter((row) => row.email.includes("@"));

  const chunkSize = 250;
  for (let index = 0; index < cleaned.length; index += chunkSize) {
    const batch = writeBatch(db);
    const chunk = cleaned.slice(index, index + chunkSize);

    chunk.forEach((row) => {
      batch.set(
        doc(db, "student_registry", registryDocId(row.email)),
        {
          email: row.email,
          fullName: row.fullName,
          uid: row.uid,
          tags: row.tags,
          status: "active",
          source: row.source,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

    await batch.commit();
  }

  return cleaned.length;
}

export function listenStudentRegistry(onData: (rows: RegistryStudentDoc[]) => void) {
  const rowsQuery = query(collection(db, "student_registry"), orderBy("updatedAt", "desc"), limit(400));
  return onSnapshot(rowsQuery, (snapshot) => {
    onData(snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<RegistryStudentDoc, "id">) })));
  });
}

async function resolveUserIdsFromEmails(emails: string[]) {
  if (!emails.length) {
    return [];
  }

  const allUsers = await getDocs(query(collection(db, "users"), limit(2500)));
  const lookup = new Map<string, string>();
  allUsers.docs.forEach((row) => {
    const email = String(row.data()?.email ?? "").trim().toLowerCase();
    if (email) {
      lookup.set(email, row.id);
    }
  });

  return Array.from(new Set(emails.map((email) => lookup.get(normalizeEmail(email)) || "").filter(Boolean)));
}

export async function sendBulkInAppMessage(input: {
  title: string;
  body: string;
  ctaRoute?: string;
  mode: "all" | "segment" | "uids" | "emails";
  segment?: string;
  userIds?: string[];
  emails?: string[];
}) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    throw new Error("Title and message are required.");
  }

  if (input.mode === "all") {
    await addDoc(collection(db, "notifications"), {
      title,
      body,
      kind: "announcement",
      audience: "all",
      targetUserId: "",
      targetSegments: [],
      ctaRoute: input.ctaRoute?.trim() || "",
      createdAt: serverTimestamp(),
    });
    return { sent: 1, mode: "all" as const };
  }

  if (input.mode === "segment") {
    const segment = input.segment?.trim();
    if (!segment) {
      throw new Error("Segment is required.");
    }
    await addDoc(collection(db, "notifications"), {
      title,
      body,
      kind: "announcement",
      audience: "segment",
      targetUserId: "",
      targetSegments: [segment],
      ctaRoute: input.ctaRoute?.trim() || "",
      createdAt: serverTimestamp(),
    });
    return { sent: 1, mode: "segment" as const };
  }

  const targetUids =
    input.mode === "uids"
      ? Array.from(new Set((input.userIds ?? []).map((item) => item.trim()).filter(Boolean)))
      : await resolveUserIdsFromEmails((input.emails ?? []).map((item) => item.trim()).filter(Boolean));

  if (!targetUids.length) {
    throw new Error("No valid target users resolved for message broadcast.");
  }

  const chunkSize = 100;
  for (let index = 0; index < targetUids.length; index += chunkSize) {
    const chunk = targetUids.slice(index, index + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((uid) => {
      const row = doc(collection(db, "notifications"));
      batch.set(row, {
        title,
        body,
        kind: "announcement",
        audience: "user",
        targetUserId: uid,
        targetSegments: [],
        ctaRoute: input.ctaRoute?.trim() || "",
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return { sent: targetUids.length, mode: input.mode };
}