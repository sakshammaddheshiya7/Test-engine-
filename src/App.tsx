import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Navbar } from "./components/Navbar";
import { BottomNavigation } from "./components/BottomNavigation";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { InstallPrompt } from "./components/InstallPrompt";
import { NetworkStatus } from "./components/NetworkStatus";
import { SessionRecoveryNotice } from "./components/SessionRecoveryNotice";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { logout } from "./firebase/auth";
import {
  defaultGlobalAppConfig,
  listenGlobalAppConfig,
  listenStudentAccountControl,
  trackLiveActivity,
  type FeatureToggleKey,
  type GlobalAppConfig,
  type StudentAccountControl,
} from "./services/godModeService";
import { listenActiveBroadcast, type BroadcastDoc } from "./services/adminCommandService";
import {
  evaluateAccessPolicy,
  getClientSessionId,
  listenAccessPolicy,
  listenCurrentSessionControl,
  resolveClientNetworkInfo,
  upsertUserSessionHeartbeat,
  type AccessPolicy,
} from "./services/adminSecurityService";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CustomTest = lazy(() => import("./pages/CustomTest"));
const ChapterPractice = lazy(() => import("./pages/ChapterPractice"));
const PYQPractice = lazy(() => import("./pages/PYQPractice"));
const PDFLibrary = lazy(() => import("./pages/PDFLibrary"));
const MistakeBook = lazy(() => import("./pages/MistakeBook"));
const SavedQuestions = lazy(() => import("./pages/SavedQuestions"));
const TestHistory = lazy(() => import("./pages/TestHistory"));
const PerformanceAnalytics = lazy(() => import("./pages/PerformanceAnalytics"));
const StudentAssistant = lazy(() => import("./pages/StudentAssistant"));
const StudyPlanner = lazy(() => import("./pages/StudyPlanner"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const AdvancedSearch = lazy(() => import("./pages/AdvancedSearch"));
const FormulaBank = lazy(() => import("./pages/FormulaBank"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const RevisionBooster = lazy(() => import("./pages/RevisionBooster"));
const LiveTestMode = lazy(() => import("./pages/LiveTestMode"));
const Notifications = lazy(() => import("./pages/Notifications"));
const OfflineCenter = lazy(() => import("./pages/OfflineCenter"));
const FeedbackCenter = lazy(() => import("./pages/FeedbackCenter"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const SupportCenter = lazy(() => import("./pages/SupportCenter"));
const PracticeHub = lazy(() => import("./pages/PracticeHub"));
const TestCenter = lazy(() => import("./pages/TestCenter"));
const AIAssistCenter = lazy(() => import("./pages/AIAssistCenter"));
const LibraryCenter = lazy(() => import("./pages/LibraryCenter"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const RevisionZone = lazy(() => import("./pages/RevisionZone"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUploadQuestions = lazy(() => import("./pages/AdminUploadQuestions"));
const AdminUploadPDF = lazy(() => import("./pages/AdminUploadPDF"));
const AdminLiveContent = lazy(() => import("./pages/AdminLiveContent"));
const AdminUsersAndTests = lazy(() => import("./pages/AdminUsersAndTests"));
const AdminQuestionBank = lazy(() => import("./pages/AdminQuestionBank"));
const AdminAIGenerator = lazy(() => import("./pages/AdminAIGenerator"));
const AdminFormulaBank = lazy(() => import("./pages/AdminFormulaBank"));
const AdminLiveTests = lazy(() => import("./pages/AdminLiveTests"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminDiscussionModeration = lazy(() => import("./pages/AdminDiscussionModeration"));
const AdminGodMode = lazy(() => import("./pages/AdminGodMode"));
const AdminControlCenter = lazy(() => import("./pages/AdminControlCenter"));
const AdminApprovalQueue = lazy(() => import("./pages/AdminApprovalQueue"));
const AdminExperienceCenter = lazy(() => import("./pages/AdminExperienceCenter"));
const AdminCommandCenter = lazy(() => import("./pages/AdminCommandCenter"));
const AdminSecurityOps = lazy(() => import("./pages/AdminSecurityOps"));
const AdminOpsLab = lazy(() => import("./pages/AdminOpsLab"));
const AdminInfrastructureCenter = lazy(() => import("./pages/AdminInfrastructureCenter"));

function Shell() {
  const { user, loading, isAdmin, authIssue } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const studentUser = Boolean(user && !isAdmin);
  const adminUser = Boolean(user && isAdmin);
  const [globalConfig, setGlobalConfig] = useState<GlobalAppConfig>(defaultGlobalAppConfig);
  const [accountControl, setAccountControl] = useState<StudentAccountControl | null>(null);
  const [systemNotice, setSystemNotice] = useState("");
  const [broadcast, setBroadcast] = useState<BroadcastDoc | null>(null);
  const [hideBroadcast, setHideBroadcast] = useState(false);
  const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>({
    enforce: false,
    blockedIps: [],
    allowedIps: [],
    blockedCountries: [],
  });
  const lastActivityPingRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const unsubscribe = listenGlobalAppConfig(setGlobalConfig);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = listenActiveBroadcast(setBroadcast);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = listenAccessPolicy(setAccessPolicy);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!broadcast?.id || !studentUser) {
      setHideBroadcast(false);
      return;
    }
    const marker = localStorage.getItem(`rankforge_broadcast_hide_${broadcast.id}`);
    setHideBroadcast(marker === "1");
  }, [broadcast?.id, studentUser]);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      void import("./services/systemOpsService")
        .then(({ logClientError }) =>
          logClientError({
            source: "window_error",
            message: event.message || "Unhandled window error",
            stack: event.error?.stack,
            route: window.location.pathname,
          }),
        )
        .catch(() => undefined);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Unhandled rejection");
      void import("./services/systemOpsService")
        .then(({ logClientError }) =>
          logClientError({
            source: "promise_rejection",
            message: reason,
            stack: event.reason instanceof Error ? event.reason.stack : "",
            route: window.location.pathname,
          }),
        )
        .catch(() => undefined);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    if (!user || isAdmin) {
      setAccountControl(null);
      return;
    }

    const unsubscribe = listenStudentAccountControl(user.uid, setAccountControl);
    return () => unsubscribe();
  }, [isAdmin, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const now = Date.now();
    if (now - lastActivityPingRef.current < 12000) {
      return;
    }

    lastActivityPingRef.current = now;
    trackLiveActivity({
      userId: user.uid,
      email: user.email ?? "",
      currentPath: `${location.pathname}${location.search}`,
      isAdmin,
    }).catch((error) => {
      console.error("Activity ping failed:", error);
    });

    upsertUserSessionHeartbeat({
      userId: user.uid,
      email: user.email ?? "",
      isAdmin,
      currentPath: `${location.pathname}${location.search}`,
    }).catch((error) => {
      console.error("Session heartbeat failed:", error);
    });
  }, [isAdmin, location.pathname, location.search, user]);

  useEffect(() => {
    if (!user || isAdmin) {
      return;
    }

    let active = true;
    resolveClientNetworkInfo()
      .then((network) => {
        if (!active) {
          return;
        }
        const message = evaluateAccessPolicy(accessPolicy, network);
        if (message) {
          setSystemNotice(message);
          return logout();
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [accessPolicy, isAdmin, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const unsubscribe = listenCurrentSessionControl(user.uid, getClientSessionId(), (control) => {
      if (control.revoked) {
        setSystemNotice(control.revokeReason || "Session revoked by security policy.");
        logout().catch((error) => {
          console.error("Session revoke logout failed:", error);
        });
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!studentUser || !user) {
      return;
    }

    const globalVersion = globalConfig.sessionControl.forceLogoutVersion ?? 0;
    const userVersion = accountControl?.forceLogoutVersion ?? 0;
    const effectiveVersion = Math.max(globalVersion, userVersion);
    const markerKey = `rankforge_force_logout_v_${user.uid}`;
    const knownVersion = Number(localStorage.getItem(markerKey) ?? "0");

    if (effectiveVersion <= knownVersion) {
      return;
    }

    localStorage.setItem(markerKey, String(effectiveVersion));
    setSystemNotice("Session refreshed by system policy. Please login again.");
    logout().catch((error) => {
      console.error("Forced logout failed:", error);
    });
  }, [accountControl?.forceLogoutVersion, globalConfig.sessionControl.forceLogoutVersion, studentUser, user]);

  function allowFeature(key: FeatureToggleKey) {
    if (!studentUser) {
      return false;
    }

    if (globalConfig.featureToggles[key] === false) {
      return false;
    }

    if (accountControl?.restricted && ["tests", "aiTools", "discussion", "liveTests"].includes(key)) {
      return false;
    }

    return true;
  }

  if (loading) {
    return <div className="app-shell flex min-h-dvh items-center justify-center">Loading platform...</div>;
  }

  if (studentUser && accountControl?.suspended) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center px-4 text-center">
        <div className="panel-3d max-w-md p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Account Control</p>
          <h2 className="mt-2 text-xl font-semibold">Account Temporarily Suspended</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Please contact support. Access will be restored by admin.</p>
        </div>
      </div>
    );
  }

  if (studentUser && globalConfig.systemFlags.maintenanceMode) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center px-4 text-center">
        <div className="panel-3d max-w-md p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Maintenance Mode</p>
          <h2 className="mt-2 text-xl font-semibold">Platform Is Under Maintenance</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Please come back shortly. Your data is safe and synced.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-dvh bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="premium-orb premium-orb-left" />
        <div className="premium-orb premium-orb-right" />
        <div className="premium-orb premium-orb-cyber" />
      </div>
      {!user ? (
        <button
          className="fixed right-4 top-4 z-40 rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-zinc-700 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
          type="button"
          onClick={toggleTheme}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      ) : null}
      <NetworkStatus />
      {systemNotice ? (
        <div className="mx-auto mt-2 w-full max-w-lg rounded-xl border border-orange-300/50 bg-orange-500/10 px-3 py-2 text-center text-xs font-semibold text-orange-600 dark:text-orange-300">
          {systemNotice}
        </div>
      ) : null}
      {studentUser && globalConfig.banner.enabled && globalConfig.banner.text ? (
        <div
          className={`mx-auto mt-2 w-full max-w-[430px] rounded-xl px-3 py-2 text-center text-xs font-semibold ${
            globalConfig.banner.tone === "critical"
              ? "border border-red-300/60 bg-red-500/10 text-red-600 dark:text-red-300"
              : globalConfig.banner.tone === "warning"
                ? "border border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border border-sky-300/60 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          }`}
        >
          {globalConfig.banner.text}
        </div>
      ) : null}
      {studentUser && broadcast && !hideBroadcast ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center">
          <div
            className={`w-full max-w-md rounded-3xl border p-4 shadow-2xl backdrop-blur-xl ${
              broadcast.tone === "critical"
                ? "border-red-300/70 bg-red-500/10"
                : broadcast.tone === "warning"
                  ? "border-amber-300/70 bg-amber-500/10"
                  : "border-sky-300/70 bg-sky-500/10"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-800 dark:text-zinc-100">Live Broadcast</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{broadcast.title}</h3>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{broadcast.message}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-pill-primary px-4 py-2 text-xs"
                onClick={() => {
                  setHideBroadcast(true);
                  if (broadcast.id) {
                    localStorage.setItem(`rankforge_broadcast_hide_${broadcast.id}`, "1");
                  }
                  if (broadcast.ctaRoute) {
                    window.location.assign(broadcast.ctaRoute);
                  }
                }}
              >
                Open
              </button>
              <button
                type="button"
                className="btn-pill-ghost px-4 py-2 text-xs"
                onClick={() => {
                  setHideBroadcast(true);
                  if (broadcast.id) {
                    localStorage.setItem(`rankforge_broadcast_hide_${broadcast.id}`, "1");
                  }
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {user ? <Navbar /> : null}
      <main className={`mx-auto w-full px-4 pb-24 pt-3 sm:px-6 ${isAdmin ? "max-w-5xl" : "max-w-[430px]"}`}>
        <SessionRecoveryNotice message={authIssue} />
        <AnimatePresence mode="wait">
          <motion.div
            key={`${location.pathname}${location.search}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985, filter: "blur(4px)" }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.994, filter: "blur(3px)" }}
            transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <AppErrorBoundary>
              <Suspense fallback={<div className="py-12 text-center text-sm text-zinc-500">Loading page...</div>}>
                <Routes location={location}>
              <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
              <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
              <Route path="/" element={studentUser ? <Dashboard /> : adminUser ? <Navigate to="/admin" replace /> : <Navigate to="/login" replace />} />
              <Route path="/practice" element={studentUser ? <PracticeHub /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/tests" element={studentUser ? <TestCenter /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/ai-assist" element={studentUser ? <AIAssistCenter /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/library" element={studentUser ? <LibraryCenter /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/profile" element={studentUser ? <ProfilePage /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/revision" element={studentUser ? <RevisionZone /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/custom-test" element={studentUser && allowFeature("tests") ? <CustomTest /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/chapter-practice" element={studentUser && allowFeature("tests") ? <ChapterPractice /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/pyq-practice" element={studentUser && allowFeature("tests") ? <PYQPractice /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/pdf-library" element={studentUser && allowFeature("pdfLibrary") ? <PDFLibrary /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/mistake-book" element={studentUser ? <MistakeBook /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/saved-questions" element={studentUser ? <SavedQuestions /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/test-history" element={studentUser ? <TestHistory /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/analytics" element={studentUser ? <PerformanceAnalytics /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/assistant" element={studentUser && allowFeature("aiTools") ? <StudentAssistant /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/study-planner" element={studentUser && allowFeature("aiTools") ? <StudyPlanner /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/leaderboard" element={studentUser && allowFeature("leaderboard") ? <Leaderboard /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/search" element={studentUser && allowFeature("search") ? <AdvancedSearch /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/formula-bank" element={studentUser ? <FormulaBank /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/flashcards" element={studentUser ? <Flashcards /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/revision-booster" element={studentUser ? <RevisionBooster /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/live-test" element={studentUser && allowFeature("liveTests") ? <LiveTestMode /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/notifications" element={studentUser && allowFeature("notifications") ? <Notifications /> : <Navigate to={adminUser ? "/admin" : user ? "/" : "/login"} replace />} />
              <Route path="/offline-center" element={studentUser ? <OfflineCenter /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/feedback" element={studentUser ? <FeedbackCenter /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/knowledge-base" element={studentUser ? <KnowledgeBase /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route path="/support-center" element={studentUser ? <SupportCenter /> : <Navigate to={adminUser ? "/admin" : "/login"} replace />} />
              <Route
                path="/admin"
                element={user && isAdmin ? <AdminDashboard /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/questions"
                element={user && isAdmin ? <AdminUploadQuestions /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/pdfs"
                element={user && isAdmin ? <AdminUploadPDF /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/live"
                element={user && isAdmin ? <AdminLiveContent /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/users-tests"
                element={user && isAdmin ? <AdminUsersAndTests /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/question-bank"
                element={user && isAdmin ? <AdminQuestionBank /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/ai"
                element={user && isAdmin ? <AdminAIGenerator /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/formulas"
                element={user && isAdmin ? <AdminFormulaBank /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/live-tests"
                element={user && isAdmin ? <AdminLiveTests /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/notifications"
                element={user && isAdmin ? <AdminNotifications /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/discussions"
                element={user && isAdmin ? <AdminDiscussionModeration /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/god-mode"
                element={user && isAdmin ? <AdminGodMode /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/control-center"
                element={user && isAdmin ? <AdminControlCenter /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/approval-queue"
                element={user && isAdmin ? <AdminApprovalQueue /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/experience"
                element={user && isAdmin ? <AdminExperienceCenter /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/command"
                element={user && isAdmin ? <AdminCommandCenter /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/security"
                element={user && isAdmin ? <AdminSecurityOps /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/ops-lab"
                element={user && isAdmin ? <AdminOpsLab /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route
                path="/admin/infrastructure"
                element={user && isAdmin ? <AdminInfrastructureCenter /> : <Navigate to={user ? "/" : "/login"} replace />}
              />
              <Route path="*" element={<Navigate to={studentUser ? "/" : adminUser ? "/admin" : "/login"} replace />} />
                </Routes>
              </Suspense>
            </AppErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
      {user ? <InstallPrompt /> : null}
      {studentUser ? (
        <button
          type="button"
          onClick={() => (window.location.href = "/tests")}
          className="fixed bottom-24 right-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 text-xs font-semibold text-white shadow-[0_16px_30px_rgba(251,146,60,0.38)] active:scale-95"
        >
          <Sparkles size={14} />
          Start Test
        </button>
      ) : null}
      {studentUser ? <BottomNavigation /> : null}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
