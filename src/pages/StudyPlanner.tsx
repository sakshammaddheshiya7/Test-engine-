import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import {
  buildActivityHeatmap,
  buildAnalyticsSummary,
  buildSpeedInsight,
  calculateDailyStreak,
} from "../services/analyticsService";
import { generateDailyStudyPlan, getAiToolsSettings, type AiProvider } from "../services/aiService";
import { listenToUserTestHistory, type TestAttemptDoc } from "../services/questionService";

const heatColorByLevel = [
  "bg-zinc-200/90 dark:bg-zinc-800",
  "bg-orange-200 dark:bg-orange-900/50",
  "bg-orange-300 dark:bg-orange-800/70",
  "bg-orange-400 dark:bg-orange-700/80",
  "bg-orange-500 dark:bg-orange-600",
];

export default function StudyPlanner() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<TestAttemptDoc[]>([]);
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsub = listenToUserTestHistory(user.uid, setAttempts, 180);
    return () => unsub();
  }, [user]);

  const summary = useMemo(() => buildAnalyticsSummary(attempts), [attempts]);
  const heatmap = useMemo(() => buildActivityHeatmap(attempts, 35), [attempts]);
  const streakDays = useMemo(() => calculateDailyStreak(attempts), [attempts]);
  const speed = useMemo(() => buildSpeedInsight(attempts), [attempts]);

  async function onGeneratePlan() {
    setError("");
    setLoading(true);

    try {
      const settings = await getAiToolsSettings();
      const text = await generateDailyStudyPlan(settings.provider as AiProvider, settings.model, {
        exam: "NEET/JEE",
        avgAccuracy: summary.avgAccuracy,
        weakTopics: summary.weakTopics,
        weakChapters: summary.weakChapters,
        streakDays,
        avgSecPerQuestion: speed.avgSecPerQuestion,
      });
      setPlan(text || "No plan generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate study plan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-[26px] p-5"
      >
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Smart AI Study Planner</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Adaptive daily plan based on your weak chapters, speed, and consistency.
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel rounded-2xl p-3 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Current Streak</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{streakDays} days</p>
        </div>
        <div className="glass-panel rounded-2xl p-3 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Accuracy</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{summary.avgAccuracy}%</p>
        </div>
        <div className="glass-panel rounded-2xl p-3 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Speed</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {speed.avgSecPerQuestion ? `${speed.avgSecPerQuestion}s` : "-"}
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-[24px] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Progress Heatmap (35 days)</h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{speed.speedBand}</span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {heatmap.map((day) => (
            <div
              key={day.dateKey}
              className={`h-6 rounded-md border border-white/30 ${heatColorByLevel[day.level]}`}
              title={`${day.dateKey}: ${day.count} test(s)`}
            />
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Generate Adaptive Plan</h3>
          <button
            type="button"
            className="btn-pill-primary"
            disabled={loading}
            onClick={onGeneratePlan}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Planner uses your live test history and weak-topic analytics.
        </p>
        {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}
        {plan ? <pre className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">{plan}</pre> : null}
      </div>
    </section>
  );
}
