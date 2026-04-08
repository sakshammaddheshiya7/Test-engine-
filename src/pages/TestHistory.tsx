import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { listenToUserTestHistory, type TestAttemptDoc } from "../services/questionService";

function formatTimestamp(value?: { seconds: number }) {
  if (!value?.seconds) {
    return "Just now";
  }

  return new Date(value.seconds * 1000).toLocaleString();
}

export default function TestHistory() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<TestAttemptDoc[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsub = listenToUserTestHistory(user.uid, setAttempts);
    return () => unsub();
  }, [user]);

  return (
    <section className="space-y-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_20px_40px_rgba(251,146,60,0.12)] backdrop-blur-xl"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Part 6</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900">Test History</h2>
        <p className="mt-1 text-sm text-zinc-600">Every completed custom test is stored live in Firebase and listed here.</p>
      </motion.div>

      {attempts.length === 0 ? (
        <p className="text-sm text-zinc-500">No test attempts yet. Complete a custom test to start building your history.</p>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => (
            <article
              key={attempt.id}
              className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {attempt.correctAnswers}/{attempt.totalQuestions} correct
                  </p>
                  <p className="text-xs text-zinc-500">{formatTimestamp(attempt.createdAt)}</p>
                </div>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  {attempt.accuracy}% accuracy
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                <p>Time: {attempt.timeTakenSec}s</p>
                <p>Questions: {attempt.filters.numberOfQuestions}</p>
                <p>Subject: {attempt.filters.subject || "All"}</p>
                <p>Type: {attempt.filters.type || "Mixed"}</p>
              </div>

              <p className="mt-3 text-xs text-zinc-600">
                Weak chapters: {attempt.weakChapters.join(", ") || "No weak chapter detected"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}