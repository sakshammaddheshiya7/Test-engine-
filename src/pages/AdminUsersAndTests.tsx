import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AnalyticsCharts } from "../components/AnalyticsCharts";
import {
  buildAdminAdvancedInsights,
  buildAnalyticsSummary,
  buildContentRecommendations,
  buildPerformanceAlerts,
} from "../services/analyticsService";
import {
  listenToGlobalTestAttempts,
  listenToUserProfiles,
  type AdminAttemptDoc,
  type UserProfileDoc,
} from "../services/adminService";
import {
  generateWeakTopicRecommendations,
  getAiToolsSettings,
  type AiProvider,
} from "../services/aiService";

function formatTime(value?: { seconds: number }) {
  if (!value?.seconds) {
    return "Just now";
  }

  return new Date(value.seconds * 1000).toLocaleString();
}

export default function AdminUsersAndTests() {
  const [users, setUsers] = useState<UserProfileDoc[]>([]);
  const [attempts, setAttempts] = useState<AdminAttemptDoc[]>([]);
  const [search, setSearch] = useState("");
  const [cohortPlan, setCohortPlan] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    const unsubUsers = listenToUserProfiles(setUsers);
    const unsubAttempts = listenToGlobalTestAttempts(setAttempts);

    return () => {
      unsubUsers();
      unsubAttempts();
    };
  }, []);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalAttempts = attempts.length;
    const avgAccuracy =
      totalAttempts > 0 ? Math.round(attempts.reduce((sum, row) => sum + row.accuracy, 0) / totalAttempts) : 0;
    const activeUsers = new Set(attempts.map((row) => row.userId)).size;

    return { totalUsers, totalAttempts, avgAccuracy, activeUsers };
  }, [attempts, users]);

  const userEmailMap = useMemo(() => {
    return users.reduce<Record<string, string>>((acc, row) => {
      acc[row.id] = row.email;
      return acc;
    }, {});
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return users;
    }

    return users.filter((row) => row.email.toLowerCase().includes(term));
  }, [search, users]);

  const analytics = useMemo(() => buildAnalyticsSummary(attempts), [attempts]);
  const advanced = useMemo(() => buildAdminAdvancedInsights(attempts), [attempts]);
  const performanceAlerts = useMemo(() => buildPerformanceAlerts(attempts), [attempts]);
  const contentRecommendations = useMemo(() => buildContentRecommendations(attempts), [attempts]);

  async function handleGenerateCohortPlan() {
    if (!analytics.weakTopics.length && !analytics.weakChapters.length) {
      setPlanError("Not enough cohort performance data yet.");
      return;
    }

    setPlanLoading(true);
    setPlanError("");

    try {
      const settings = await getAiToolsSettings();
      const result = await generateWeakTopicRecommendations(settings.provider as AiProvider, settings.model, {
        weakTopics: analytics.weakTopics,
        weakChapters: analytics.weakChapters,
        avgAccuracy: analytics.avgAccuracy,
        exam: "NEET/JEE",
      });
      setCohortPlan(result || "No AI output returned.");
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Unable to generate cohort recommendations.");
    } finally {
      setPlanLoading(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-hero p-6"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 9 Admin Analytics</p>
        <h2 className="mt-1 text-2xl font-semibold">Users and Test Management</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Live tracking of student accounts and recent test attempts from Firebase.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article className="admin-surface p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Users</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{stats.totalUsers}</p>
        </article>
        <article className="admin-surface p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Active Test Users</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{stats.activeUsers}</p>
        </article>
        <article className="admin-surface p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Recent Attempts</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{stats.totalAttempts}</p>
        </article>
        <article className="admin-surface p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Average Accuracy</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{stats.avgAccuracy}%</p>
        </article>
      </div>

      <AnalyticsCharts trend={analytics.recentAccuracy} topics={analytics.topicInsights} titlePrefix="Cohort " />

      <article className="admin-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">AI Cohort Recommendation</h3>
          <button
            type="button"
            onClick={handleGenerateCohortPlan}
            disabled={planLoading}
            className="btn-pill-primary px-4 py-2 text-xs disabled:opacity-60"
          >
            {planLoading ? "Generating..." : "Generate Cohort Plan"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Creates test recommendation using weak chapters/topics from all recent students.</p>
        {planError ? <p className="mt-2 text-sm text-rose-600">{planError}</p> : null}
        {cohortPlan ? <pre className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">{cohortPlan}</pre> : null}
      </article>

      <article className="admin-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Student Accounts</h3>
          <input
            className="input-soft w-44 text-xs"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search email"
            value={search}
          />
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {filteredUsers.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No users found.</p>
          ) : (
            filteredUsers.map((row) => (
              <div key={row.id} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.email || "No email"}</p>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">UID: {row.id}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>Role: {row.role || "student"}</span>
                  <span>Last Login: {formatTime(row.lastLoginAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Test Attempts</h3>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {attempts.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No attempts available yet.</p>
          ) : (
            attempts.map((row) => (
              <div key={`${row.userId}-${row.id}`} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{userEmailMap[row.userId] ?? row.userId}</p>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                    {row.accuracy}%
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>
                    Score: {row.correctAnswers}/{row.totalQuestions}
                  </span>
                  <span>Time: {row.timeTakenSec}s</span>
                  <span>{formatTime(row.createdAt)}</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Weak Chapters: {row.weakChapters.join(", ") || "None"}
                </p>
                {row.testSecurity ? (
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Security: score {row.testSecurity.suspiciousScore} | tab {row.testSecurity.tabSwitches} | copy {row.testSecurity.copyAttempts} | {row.testSecurity.suspicious ? "flagged" : "normal"}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </article>

      <article className="admin-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Hardest Questions Snapshot</h3>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Live from difficulty engine</span>
        </div>
        <div className="mt-3 space-y-2">
          {advanced.hardestQuestions.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Not enough difficulty samples yet.</p>
          ) : (
            advanced.hardestQuestions.map((row) => (
              <div key={row.questionId} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.chapter} / {row.topic}</p>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">QID: {row.questionId}</p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Attempts: {row.attempts} | Avg Time: {row.avgTimeSec}s | Very Hard Rate: {row.veryHardRate}%
                </p>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Chapter Difficulty and Engagement</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
            <p className="text-zinc-500 dark:text-zinc-400">Active Days</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{advanced.engagement.activeDays}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
            <p className="text-zinc-500 dark:text-zinc-400">Attempts / Active Day</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{advanced.engagement.attemptsPerActiveDay}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
            <p className="text-zinc-500 dark:text-zinc-400">Attempts / Student</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{advanced.engagement.avgAttemptsPerStudent}</p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {advanced.chapterDifficulty.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No chapter-level data available yet.</p>
          ) : (
            advanced.chapterDifficulty.map((row) => (
              <div key={row.chapter} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.chapter}</p>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Attempts {row.attempts}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${row.avgAccuracy}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Avg accuracy: {row.avgAccuracy}%</p>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Auto Student Performance Alerts</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Automatically highlights weak chapters impacting a large student cohort.</p>
        <div className="mt-3 space-y-2">
          {performanceAlerts.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No high-risk chapter alerts detected right now.</p>
          ) : (
            performanceAlerts.map((row) => (
              <div key={row.chapter} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.chapter}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.severity === "high"
                        ? "bg-red-100 text-red-700"
                        : row.severity === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {row.severity}
                  </span>
                </div>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                  Accuracy: {row.avgAccuracy}% | Attempts: {row.attempts} | Students impacted: {row.impactedUsers}
                </p>
                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">{row.recommendation}</p>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Smart Content Recommendation Engine</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Shows where the platform needs more questions or stronger chapter depth.</p>
        <div className="mt-3 space-y-2">
          {contentRecommendations.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Not enough data for content demand scoring.</p>
          ) : (
            contentRecommendations.map((row) => (
              <div key={row.chapter} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.chapter}</p>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Demand {row.demandScore}</span>
                </div>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">Accuracy: {row.avgAccuracy}% | Attempts: {row.totalAttempts}</p>
                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">{row.suggestion}</p>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
