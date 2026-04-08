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
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export type NotificationKind = "reminder" | "test_alert" | "pdf_upload" | "announcement";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: NotificationKind;
  audience: "all" | "user" | "segment";
  targetUserId?: string;
  targetSegments?: string[];
  ctaRoute?: string;
  createdAt?: { seconds: number };
  readBy?: Record<string, boolean>;
};

export type NotificationSettings = {
  pushEnabled: boolean;
  reminderEnabled: boolean;
  testAlertEnabled: boolean;
  pdfAlertEnabled: boolean;
};

export type ForegroundPushMessage = {
  title: string;
  body: string;
};

const defaultSettings: NotificationSettings = {
  pushEnabled: false,
  reminderEnabled: true,
  testAlertEnabled: true,
  pdfAlertEnabled: true,
};

export async function publishNotification(input: {
  title: string;
  body: string;
  kind: NotificationKind;
  audience: "all" | "user" | "segment";
  targetUserId?: string;
  targetSegments?: string[];
  ctaRoute?: string;
}) {
  const cleanedSegments = (input.targetSegments ?? []).map((item) => item.trim()).filter(Boolean);
  await addDoc(collection(db, "notifications"), {
    ...input,
    title: input.title.trim(),
    body: input.body.trim(),
    targetUserId: input.audience === "user" ? input.targetUserId?.trim() ?? "" : "",
    targetSegments: input.audience === "segment" ? cleanedSegments : [],
    ctaRoute: input.ctaRoute?.trim() ?? "",
    createdAt: serverTimestamp(),
  });
}

export function listenUserNotifications(userId: string, onData: (rows: AppNotification[]) => void) {
  const allQuery = query(collection(db, "notifications"), where("audience", "==", "all"), orderBy("createdAt", "desc"));
  const userQuery = query(
    collection(db, "notifications"),
    where("audience", "==", "user"),
    where("targetUserId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const segmentQuery = query(collection(db, "notifications"), where("audience", "==", "segment"), orderBy("createdAt", "desc"));

  let allRows: AppNotification[] = [];
  let userRows: AppNotification[] = [];
  let segmentRows: AppNotification[] = [];
  let userSegments = ["all_students"];

  const emit = () => {
    const allowedSegmentRows = segmentRows.filter((item) =>
      (item.targetSegments ?? []).some((segment) => userSegments.includes(segment)),
    );
    const merged = [...allRows, ...userRows, ...allowedSegmentRows]
      .sort((a, b) => Number(b.createdAt?.seconds ?? 0) - Number(a.createdAt?.seconds ?? 0))
      .slice(0, 80);
    onData(merged);
  };

  const offSegments = onSnapshot(doc(db, "user_segments", userId), (snapshot) => {
    if (!snapshot.exists()) {
      userSegments = ["all_students"];
      emit();
      return;
    }

    const next = snapshot.data() as { segments?: string[] };
    userSegments = Array.isArray(next.segments) && next.segments.length ? next.segments : ["all_students"];
    emit();
  });

  const offAll = onSnapshot(allQuery, (snapshot) => {
    allRows = snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as DocumentData) })) as AppNotification[];
    emit();
  });

  const offUser = onSnapshot(userQuery, (snapshot) => {
    userRows = snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as DocumentData) })) as AppNotification[];
    emit();
  });

  const offSegmentRows = onSnapshot(segmentQuery, (snapshot) => {
    segmentRows = snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as DocumentData) })) as AppNotification[];
    emit();
  });

  return () => {
    offAll();
    offUser();
    offSegments();
    offSegmentRows();
  };
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  await updateDoc(doc(db, "notifications", notificationId), {
    [`readBy.${userId}`]: true,
    updatedAt: serverTimestamp(),
  });
}

export async function saveNotificationSettings(userId: string, settings: NotificationSettings) {
  await setDoc(
    doc(db, "users", userId, "preferences", "notifications"),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenNotificationSettings(userId: string, onData: (settings: NotificationSettings) => void) {
  return onSnapshot(doc(db, "users", userId, "preferences", "notifications"), (snapshot) => {
    if (!snapshot.exists()) {
      onData(defaultSettings);
      return;
    }
    onData({ ...defaultSettings, ...(snapshot.data() as Partial<NotificationSettings>) });
  });
}

export async function registerBrowserPush(userId: string) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "Notifications are not supported in this browser." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Notification permission denied." };
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return { ok: false, reason: "Missing VITE_FIREBASE_VAPID_KEY for push token setup." };
  }

  try {
    const [{ getMessaging, getToken }, { app }] = await Promise.all([
      import("firebase/messaging"),
      import("../firebase/firebaseConfig"),
    ]);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      return { ok: false, reason: "No push token returned." };
    }

    await setDoc(
      doc(db, "users", userId, "device_tokens", "web"),
      {
        token,
        platform: "web",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true, token };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Push token registration failed." };
  }
}

export async function listenForegroundPush(onData: (payload: ForegroundPushMessage) => void) {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return () => undefined;
  }

  try {
    const [{ getMessaging, onMessage }, { app }] = await Promise.all([
      import("firebase/messaging"),
      import("../firebase/firebaseConfig"),
    ]);
    const messaging = getMessaging(app);

    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title?.trim() || "New update";
      const body = payload.notification?.body?.trim() || "You have a new notification.";
      onData({ title, body });
    });

    return unsubscribe;
  } catch {
    return () => undefined;
  }
}

export async function ensureAutoStudyReminder(input: {
  userId: string;
  reminderEnabled: boolean;
}) {
  if (!input.reminderEnabled) {
    return;
  }

  const lastAttemptQuery = query(
    collection(db, "users", input.userId, "test_history"),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  const lastReminderQuery = query(
    collection(db, "notifications"),
    where("audience", "==", "user"),
    where("targetUserId", "==", input.userId),
    where("kind", "==", "reminder"),
    orderBy("createdAt", "desc"),
    limit(1),
  );

  const [attemptSnapshot, reminderSnapshot] = await Promise.all([
    getDocs(lastAttemptQuery),
    getDocs(lastReminderQuery),
  ]);

  const nowSec = Date.now() / 1000;
  const lastAttemptSec = Number(attemptSnapshot.docs[0]?.data()?.createdAt?.seconds ?? 0);
  const lastReminderSec = Number(reminderSnapshot.docs[0]?.data()?.createdAt?.seconds ?? 0);

  const inactiveForDay = !lastAttemptSec || nowSec - lastAttemptSec > 24 * 60 * 60;
  const remindedRecently = lastReminderSec && nowSec - lastReminderSec < 18 * 60 * 60;

  if (!inactiveForDay || remindedRecently) {
    return;
  }

  await publishNotification({
    title: "Study Reminder",
    body: "You have been inactive. Solve a 20-question mixed test today to protect your streak.",
    kind: "reminder",
    audience: "user",
    targetUserId: input.userId,
    ctaRoute: "/custom-test",
  });
}
