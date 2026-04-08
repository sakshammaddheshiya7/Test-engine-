import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export type AccessPolicy = {
  enforce: boolean;
  blockedIps: string[];
  allowedIps: string[];
  blockedCountries: string[];
  updatedAt?: { seconds: number };
};

export type ClientNetworkInfo = {
  ip: string;
  country: string;
};

export type UserSessionDoc = {
  id: string;
  userId: string;
  sessionId: string;
  email: string;
  isAdmin: boolean;
  userAgent: string;
  platform: string;
  timezone: string;
  currentPath: string;
  revoked?: boolean;
  revokeReason?: string;
  lastSeenAt?: { seconds: number };
};

export type DailyAdminReport = {
  id: string;
  reportDate: string;
  newUsers: number;
  testsAttempted: number;
  activeUsers: number;
  topActiveRoutes: Array<{ route: string; hits: number }>;
  generatedAt?: { seconds: number };
};

const DEFAULT_POLICY: AccessPolicy = {
  enforce: false,
  blockedIps: [],
  allowedIps: [],
  blockedCountries: [],
};

function sanitizeCsvList(input: string[] | undefined) {
  if (!input) {
    return [];
  }
  return Array.from(new Set(input.map((item) => item.trim()).filter(Boolean)));
}

function getCachedNetworkInfo() {
  try {
    const raw = localStorage.getItem("rankforge_network_info");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { value: ClientNetworkInfo; expiresAt: number };
    if (!parsed?.value || parsed.expiresAt < Date.now()) {
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function setCachedNetworkInfo(value: ClientNetworkInfo) {
  try {
    localStorage.setItem(
      "rankforge_network_info",
      JSON.stringify({
        value,
        expiresAt: Date.now() + 1000 * 60 * 15,
      }),
    );
  } catch {
    // ignore cache write failures
  }
}

export function getClientSessionId() {
  const key = "rankforge_session_id";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const generated = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(key, generated);
  return generated;
}

export async function resolveClientNetworkInfo(): Promise<ClientNetworkInfo> {
  const cached = getCachedNetworkInfo();
  if (cached) {
    return cached;
  }

  try {
    const ipRes = await fetch("https://api.ipify.org?format=json");
    const ipJson = (await ipRes.json()) as { ip?: string };
    const ip = (ipJson.ip ?? "unknown").trim() || "unknown";

    let country = "unknown";
    if (ip !== "unknown") {
      const geoRes = await fetch(`https://ipapi.co/${ip}/country/`);
      const geoText = (await geoRes.text()).trim().toUpperCase();
      if (geoText && geoText.length <= 4) {
        country = geoText;
      }
    }

    const info = { ip, country };
    setCachedNetworkInfo(info);
    return info;
  } catch {
    const fallback = { ip: "unknown", country: "unknown" };
    setCachedNetworkInfo(fallback);
    return fallback;
  }
}

export function listenAccessPolicy(onData: (policy: AccessPolicy) => void) {
  const ref = doc(db, "platform_settings", "access_policy");
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      onData(DEFAULT_POLICY);
      return;
    }
    const data = snapshot.data() as Partial<AccessPolicy>;
    onData({
      enforce: Boolean(data.enforce),
      blockedIps: sanitizeCsvList(data.blockedIps),
      allowedIps: sanitizeCsvList(data.allowedIps),
      blockedCountries: sanitizeCsvList(data.blockedCountries?.map((item) => item.toUpperCase())),
      updatedAt: data.updatedAt,
    });
  });
}

export async function saveAccessPolicy(policy: AccessPolicy) {
  await setDoc(
    doc(db, "platform_settings", "access_policy"),
    {
      enforce: Boolean(policy.enforce),
      blockedIps: sanitizeCsvList(policy.blockedIps),
      allowedIps: sanitizeCsvList(policy.allowedIps),
      blockedCountries: sanitizeCsvList(policy.blockedCountries.map((item) => item.toUpperCase())),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function evaluateAccessPolicy(policy: AccessPolicy, network: ClientNetworkInfo) {
  if (!policy.enforce) {
    return "";
  }

  if (policy.allowedIps.length > 0 && network.ip !== "unknown" && !policy.allowedIps.includes(network.ip)) {
    return "This network is not in the allowed list.";
  }

  if (network.ip !== "unknown" && policy.blockedIps.includes(network.ip)) {
    return "This network is blocked by platform policy.";
  }

  if (network.country !== "unknown" && policy.blockedCountries.includes(network.country)) {
    return `Access from ${network.country} is currently restricted.`;
  }

  return "";
}

export async function upsertUserSessionHeartbeat(params: {
  userId: string;
  email: string;
  isAdmin: boolean;
  currentPath: string;
}) {
  const sessionId = getClientSessionId();
  const sessionKey = `${params.userId}_${sessionId}`;
  await setDoc(
    doc(db, "user_sessions", sessionKey),
    {
      userId: params.userId,
      sessionId,
      email: params.email,
      isAdmin: params.isAdmin,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      currentPath: params.currentPath,
      revoked: false,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenUserSessions(onData: (rows: UserSessionDoc[]) => void) {
  const rowsQuery = query(collection(db, "user_sessions"), orderBy("lastSeenAt", "desc"), limit(140));
  return onSnapshot(rowsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as UserSessionDoc[];
    onData(rows);
  });
}

export function listenCurrentSessionControl(
  userId: string,
  sessionId: string,
  onData: (control: { revoked: boolean; revokeReason: string }) => void,
) {
  const ref = doc(db, "user_sessions", `${userId}_${sessionId}`);
  return onSnapshot(ref, (snapshot) => {
    const data = (snapshot.data() ?? {}) as Partial<UserSessionDoc>;
    onData({
      revoked: Boolean(data.revoked),
      revokeReason: data.revokeReason?.trim() || "",
    });
  });
}

export async function revokeUserSession(docId: string, reason: string) {
  await setDoc(
    doc(db, "user_sessions", docId),
    {
      revoked: true,
      revokeReason: reason.trim() || "Revoked by admin.",
      revokedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function generateDailyAdminReport() {
  const today = new Date();
  const reportDate = today.toISOString().slice(0, 10);
  const dayStart = new Date(`${reportDate}T00:00:00.000Z`);

  const [usersCount, liveCount, testsCount] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "live_activity")),
    getCountFromServer(collection(db, "leaderboard_public")),
  ]);

  const liveRows = await getDocs(query(collection(db, "live_activity"), limit(300)));
  const routeCounter = new Map<string, number>();
  liveRows.docs.forEach((docItem) => {
    const path = String(docItem.data().currentPath ?? "/");
    routeCounter.set(path, (routeCounter.get(path) ?? 0) + 1);
  });

  const topActiveRoutes = Array.from(routeCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([route, hits]) => ({ route, hits }));

  await addDoc(collection(db, "daily_admin_reports"), {
    reportDate,
    newUsers: usersCount.data().count,
    activeUsers: liveCount.data().count,
    testsAttempted: testsCount.data().count,
    topActiveRoutes,
    dayStart,
    generatedAt: serverTimestamp(),
  });
}

export function listenDailyAdminReports(onData: (rows: DailyAdminReport[]) => void) {
  const rowsQuery = query(collection(db, "daily_admin_reports"), orderBy("generatedAt", "desc"), limit(20));
  return onSnapshot(rowsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as DailyAdminReport[];
    onData(rows);
  });
}