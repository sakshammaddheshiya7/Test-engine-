import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { generateCustomTest, listenToUserTestHistory, type QuestionDoc, type TestAttemptDoc } from "../services/questionService";

type BoosterTarget = {
  chapter: string;
  score: number;
  daysSince: number;
};

function daysSince(seconds?: number) {
  if (!seconds) {
    return 999;
  }

  const now = Date.now();
  const timestamp = seconds * 1000;
  return Math.max(0, Math.floor((now - timestamp) / 86400000));
}

export default function RevisionBooster() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<TestAttemptDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<BoosterTarget | null>(null);
  const [questions, setQuestions] = useState<QuestionDoc[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsub = listenToUserTestHistory(user.uid, setAttempts, 120);
    return () => unsub();
  }, [user]);

  const recommendations = useMemo(() => {
    const chapterMap: Record<string, { attempts: number; weakMentions: number; latestSeconds?: number }> = {};

    attempts.forEach((attempt) => {
      const chapter = attempt.filters?.chapter?.trim();
      if (chapter) {
        const row = chapterMap[chapter] ?? { attempts: 0, weakMentions: 0 };
        row.attempts += 1;
        row.latestSeconds = Math.max(row.latestSeconds ?? 0, attempt.createdAt?.seconds ?? 0);
        chapterMap[chapter] = row;
      }

      (attempt.weakChapters ?? []).forEach((weakChapter) => {
        const chapterKey = weakChapter.trim();
        if (!chapterKey) {
          return;
        }

        const row = chapterMap[chapterKey] ?? { attempts: 0, weakMentions: 0 };
        row.weakMentions += 1;
        row.latestSeconds = Math.max(row.latestSeconds ?? 0, attempt.createdAt?.seconds ?? 0);
        chapterMap[chapterKey] = row;
      });
    });

    return Object.entries(chapterMap)
      .map(([chapter, row]) => {
        const since = daysSince(row.latestSeconds);
        const score = row.weakMentions * 3 + Math.min(8, since) + Math.max(0, 3 - row.attempts);
        return { chapter, score, daysSince: since };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [attempts]);

  async function buildRevisionSet(nextTarget: BoosterTarget) {
    setTarget(nextTarget);
    setQuestions([]);
    setError("");
    setLoading(true);

    try {
      const rows = await generateCustomTest({
        chapter: nextTarget.chapter,
        numberOfQuestions: 20,
      });
      setQuestions(rows);
      if (!rows.length) {
        setError("No question pool found for this chapter yet.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate revision set.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[26px] p-5">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Revision Booster</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Auto-prioritized chapter revision based on weak trends and inactivity.</p>
      </motion.div>

      <div className="glass-panel rounded-[24px] p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recommended Chapters</h3>
        <div className="mt-3 space-y-2">
          {recommendations.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-300">Attempt a few tests to unlock adaptive revision recommendations.</p>
          ) : (
            recommendations.map((row) => (
              <div key={row.chapter} className="flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-white/85 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.chapter}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-300">Inactive for {row.daysSince} day(s)</p>
                </div>
                <button type="button" className="btn-pill-primary" onClick={() => buildRevisionSet(row)}>
                  Build Test
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="glass-panel rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Generated Revision Set</h3>
          {loading ? <span className="text-xs text-zinc-500">Generating...</span> : null}
        </div>
        {target ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-300">Target Chapter: {target.chapter}</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}
        <div className="mt-3 space-y-2">
          {questions.slice(0, 5).map((question, index) => (
            <div key={question.id ?? `${index}-${question.question.slice(0, 22)}`} className="rounded-2xl border border-zinc-200/80 bg-white/85 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="text-xs text-zinc-500 dark:text-zinc-300">Q{index + 1}</p>
              <p className="text-sm text-zinc-800 dark:text-zinc-100">{question.question}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}