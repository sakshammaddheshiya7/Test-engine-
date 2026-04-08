import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { buildAnalyticsSummary, predictExamScore } from "../services/analyticsService";
import { listenToUserTestHistory, type TestAttemptDoc } from "../services/questionService";
import {
  generateWeakTopicRecommendations,
  getAiToolsSettings,
  type AiProvider,
} from "../services/aiService";
import { AnalyticsCharts } from "../components/AnalyticsCharts";

export default function PerformanceAnalytics() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<TestAttemptDoc[]>([]);
  const [aiPlan, setAiPlan] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsub = listenToUserTestHistory(user.uid, setAttempts);
    return () => unsub();
  }, [user]);

  const summary = useMemo(() => buildAnalyticsSummary(attempts), [attempts]);
  const prediction = useMemo(() => predictExamScore(attempts), [attempts]);

  async function handleGeneratePlan() {
    if (!summary.weakTopics.length && !summary.weakChapters.length) {
      setAiError("Not enough weak-topic data yet. Complete a few tests first.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const settings = await getAiToolsSettings();
      const text = await generateWeakTopicRecommendations(settings.provider as AiProvider, settings.model, {
        weakTopics: summary.weakTopics,
        weakChapters: summary.weakChapters,
        avgAccuracy: summary.avgAccuracy,
        exam: "NEET/JEE",
      });
      setAiPlan(text || "No recommendation returned.");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Failed to generate AI recommendations.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_20px_40px_rgba(251,146,60,0.12)] backdrop-blur-xl"
      >
        <h2 className="text-2xl font-semibold text-zinc-900">Performance Analytics</h2>
        <p className="mt-1 text-sm text-zinc-600">Live snapshot generated from your saved test history.</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-center backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
          <p className="text-xs text-zinc-500">Total Tests</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{summary.totalTests}</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-center backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
          <p className="text-xs text-zinc-500">Avg Accuracy</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{summary.avgAccuracy}%</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-center backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
          <p className="text-xs text-zinc-500">Avg Score</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{summary.avgScore}%</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-center backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
          <p className="text-xs text-zinc-500">Strongest Topic</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{summary.strongestTopic}</p>
        </div>
      </div>

      <AnalyticsCharts trend={summary.recentAccuracy} topics={summary.topicInsights} />

      <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Performance Predictor</h3>
          <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-200">
            Confidence: {prediction.confidence}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-zinc-200/70 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Expected Score</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{prediction.expectedScore}%</p>
          </div>
          <div className="rounded-xl border border-zinc-200/70 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Speed Index</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{prediction.speedIndex}</p>
          </div>
          <div className="rounded-xl border border-zinc-200/70 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Trend</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{prediction.trend}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">{prediction.summary}</p>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Weak Chapters</h3>
        <p className="mt-2 text-sm text-zinc-600">{summary.weakChapters.join(", ") || "No weak chapters detected yet."}</p>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Weak-Topic Test Recommendations</h3>
          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={aiLoading}
            className="rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-200 disabled:opacity-60"
          >
            {aiLoading ? "Generating..." : "Generate Plan"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Uses the current AI model to suggest chapter/topic-focused custom tests.</p>
        {aiError ? <p className="mt-2 text-sm text-rose-600">{aiError}</p> : null}
        {aiPlan ? <pre className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">{aiPlan}</pre> : null}
      </div>
    </section>
  );
}