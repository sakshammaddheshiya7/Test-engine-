import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { publishNotification } from "./notificationService";

export type FeatureToggleKey =
  | "tests"
  | "pdfLibrary"
  | "aiTools"
  | "discussion"
  | "notifications"
  | "leaderboard"
  | "search"
  | "liveTests";

export type GlobalAppConfig = {
  featureToggles: Record<FeatureToggleKey, boolean>;
  systemFlags: {
    maintenanceMode: boolean;
    contentFreezeMode: boolean;
  };
  banner: {
    enabled: boolean;
    text: string;
    tone: "info" | "warning" | "critical";
  };
  uiConfig: {
    dashboardOrder: string[];
    compactMode: boolean;
  };
  abTesting: {
    enabled: boolean;
    experimentId: string;
  };
  sessionControl: {
    forceLogoutVersion: number;
    updatedAt?: { seconds: number };
  };
};

export type StudentAccountControl = {
  suspended?: boolean;
  restricted?: boolean;
  verified?: boolean;
  forceLogoutVersion?: number;
  updatedAt?: { seconds: number };
};

export type LiveActivity = {
  id: string;
  userId: string;
  email: string;
  currentPath: string;
  isAdmin: boolean;
  lastSeenAt?: { seconds: number };
};

export type UserSegmentDoc = {
  id: string;
  userId: string;
  email?: string;
  segments: string[];
  updatedAt?: { seconds: number };
};

export type SegmentationResult = {
  processed: number;
  highPerformers: number;
  atRisk: number;
  inactive: number;
  streakers: number;
};

export const defaultGlobalAppConfig: GlobalAppConfig = {
  featureToggles: {
    tests: true,
    pdfLibrary: true,
    aiTools: true,
    discussion: true,
    notifications: true,
    leaderboard: true,
    search: true,
    liveTests: true,
  },
  systemFlags: {
    maintenanceMode: false,
    contentFreezeMode: false,
  },
  banner: {
    enabled: false,
    text: "",
    tone: "info",
  },
  uiConfig: {
    dashboardOrder: [],
    compactMode: false,
  },
  abTesting: {
    enabled: false,
    experimentId: "",
  },
  sessionControl: {
    forceLogoutVersion: 0,
  },
};

function mergeGlobalAppConfig(partial?: Partial<GlobalAppConfig>) {
  return {
    ...defaultGlobalAppConfig,
    ...partial,
    featureToggles: {
      ...defaultGlobalAppConfig.featureToggles,
      ...(partial?.featureToggles ?? {}),
    },
    systemFlags: {
      ...defaultGlobalAppConfig.systemFlags,
      ...(partial?.systemFlags ?? {}),
    },
    banner: {
      ...defaultGlobalAppConfig.banner,
      ...(partial?.banner ?? {}),
    },
    uiConfig: {
      ...defaultGlobalAppConfig.uiConfig,
      ...(partial?.uiConfig ?? {}),
    },
    abTesting: {
      ...defaultGlobalAppConfig.abTesting,
      ...(partial?.abTesting ?? {}),
    },
    sessionControl: {
      ...defaultGlobalAppConfig.sessionControl,
      ...(partial?.sessionControl ?? {}),
    },
  };
}

export function listenGlobalAppConfig(
  onData: (config: GlobalAppConfig) => void,
  onError?: (error: Error) => void,
) {
  const configRef = doc(db, "platform_settings", "global_app_config");
  return onSnapshot(
    configRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(defaultGlobalAppConfig);
        return;
      }

      onData(mergeGlobalAppConfig(snapshot.data() as Partial<GlobalAppConfig>));
    },
    (error) => onError?.(error),
  );
}

export async function upsertGlobalAppConfig(payload: Partial<GlobalAppConfig>) {
  const configRef = doc(db, "platform_settings", "global_app_config");
  await setDoc(
    configRef,
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function setFeatureToggle(feature: FeatureToggleKey, enabled: boolean) {
  await upsertGlobalAppConfig({
    featureToggles: {
      [feature]: enabled,
    } as Record<FeatureToggleKey, boolean>,
  });
}

export async function setEmergencyBanner(enabled: boolean, text: string, tone: GlobalAppConfig["banner"]["tone"]) {
  await upsertGlobalAppConfig({
    banner: {
      enabled,
      text,
      tone,
    },
  });
}

export async function setSystemFlags(flags: Partial<GlobalAppConfig["systemFlags"]>) {
  await upsertGlobalAppConfig({
    systemFlags: flags as GlobalAppConfig["systemFlags"],
  });
}

export async function bumpForceLogoutVersion(reason: string) {
  const configRef = doc(db, "platform_settings", "global_app_config");
  await setDoc(
    configRef,
    {
      sessionControl: {
        forceLogoutVersion: increment(1),
        reason,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function setStudentAccountControl(userId: string, payload: Partial<StudentAccountControl>) {
  const controlRef = doc(db, "users", userId, "preferences", "account_control");
  await setDoc(
    controlRef,
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenStudentAccountControl(userId: string, onData: (control: StudentAccountControl | null) => void) {
  const controlRef = doc(db, "users", userId, "preferences", "account_control");
  return onSnapshot(controlRef, (snapshot) => {
    if (!snapshot.exists()) {
      onData(null);
      return;
    }
    onData(snapshot.data() as StudentAccountControl);
  });
}

async function wipeSubCollection(path: string) {
  const rows = await getDocs(query(collection(db, path), limit(450)));
  if (rows.empty) {
    return;
  }

  const batch = writeBatch(db);
  rows.docs.forEach((row) => {
    batch.delete(row.ref);
  });
  await batch.commit();

  if (rows.size >= 450) {
    await wipeSubCollection(path);
  }
}

export async function resetStudentHistory(userId: string) {
  await wipeSubCollection(`users/${userId}/test_history`);
}

export async function resetStudentStreak(userId: string) {
  await setDoc(
    doc(db, "leaderboard_public", userId),
    {
      currentStreak: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteStudentData(userId: string) {
  await wipeSubCollection(`users/${userId}/test_history`);
  await wipeSubCollection(`users/${userId}/saved_questions`);
  await wipeSubCollection(`users/${userId}/mistake_book`);

  await deleteDoc(doc(db, "users", userId));
  await deleteDoc(doc(db, "leaderboard_public", userId));
  await deleteDoc(doc(db, "live_activity", userId));
}

export async function trackLiveActivity(params: {
  userId: string;
  email: string;
  currentPath: string;
  isAdmin: boolean;
}) {
  await setDoc(
    doc(db, "live_activity", params.userId),
    {
      userId: params.userId,
      email: params.email,
      currentPath: params.currentPath,
      isAdmin: params.isAdmin,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenLiveActivity(onData: (rows: LiveActivity[]) => void) {
  const rowsQuery = query(collection(db, "live_activity"), orderBy("lastSeenAt", "desc"), limit(80));
  return onSnapshot(rowsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as Omit<LiveActivity, "id">),
    }));
    onData(rows);
  });
}

export function listenUserSegments(onData: (rows: UserSegmentDoc[]) => void) {
  const rowsQuery = query(collection(db, "user_segments"), orderBy("updatedAt", "desc"), limit(150));
  return onSnapshot(rowsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as Omit<UserSegmentDoc, "id">),
    }));
    onData(rows);
  });
}

export async function runSmartUserSegmentation(): Promise<SegmentationResult> {
  const rows = await getDocs(query(collection(db, "leaderboard_public"), limit(500)));
  const batch = writeBatch(db);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  let highPerformers = 0;
  let atRisk = 0;
  let inactive = 0;
  let streakers = 0;

  rows.docs.forEach((docItem) => {
    const data = docItem.data() as Record<string, unknown>;
    const allTimeXP = Number(data.allTimeXP ?? 0);
    const dayXP = Number(data.dayXP ?? 0);
    const streak = Number(data.streak ?? 0);
    const lastActiveDay = String(data.lastActiveDay ?? "");
    const segments = ["all_students"];

    if (allTimeXP >= 2500 || dayXP >= 180) {
      segments.push("high_performer");
      highPerformers += 1;
    }
    if (allTimeXP <= 350 || dayXP < 30) {
      segments.push("at_risk");
      atRisk += 1;
    }
    if (lastActiveDay && lastActiveDay !== today) {
      segments.push("inactive");
      inactive += 1;
    }
    if (streak >= 7) {
      segments.push("streaker");
      streakers += 1;
    }

    batch.set(
      doc(db, "user_segments", docItem.id),
      {
        userId: docItem.id,
        segments,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();
  return {
    processed: rows.docs.length,
    highPerformers,
    atRisk,
    inactive,
    streakers,
  };
}

export async function sendSegmentAnnouncement(input: {
  segment: string;
  title: string;
  body: string;
  ctaRoute?: string;
}) {
  await publishNotification({
    title: input.title,
    body: input.body,
    kind: "announcement",
    audience: "segment",
    targetSegments: [input.segment.trim()],
    ctaRoute: input.ctaRoute?.trim() || "/",
  });
}

export async function runAutomationWorkflow(workflowKey: "inactive_reminder" | "at_risk_booster") {
  if (workflowKey === "inactive_reminder") {
    await publishNotification({
      title: "Revision Reminder",
      body: "You have been inactive recently. Solve one short adaptive test to keep your momentum.",
      kind: "reminder",
      audience: "segment",
      targetSegments: ["inactive"],
      ctaRoute: "/revision-booster",
    });
    return;
  }

  await publishNotification({
    title: "Booster Plan Ready",
    body: "A focused chapter booster is available for your weak areas. Start now.",
    kind: "test_alert",
    audience: "segment",
    targetSegments: ["at_risk"],
    ctaRoute: "/study-planner",
  });
}

export async function setAbTestingConfig(enabled: boolean, experimentId: string) {
  await upsertGlobalAppConfig({
    abTesting: {
      enabled,
      experimentId,
    },
  });
}

export async function assignUserExperiment(userId: string, experimentId: string, group: "A" | "B") {
  const expRef = doc(db, "users", userId, "preferences", "experiments");
  await setDoc(
    expRef,
    {
      experimentId,
      group,
      assignedAt: serverTimestamp(),
    },
    { merge: true },
  );
}