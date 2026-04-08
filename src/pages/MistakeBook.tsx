import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { listenToUserQuestionCollection, type SavedQuestionDoc } from "../services/questionService";

export default function MistakeBook() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<SavedQuestionDoc[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = listenToUserQuestionCollection(user.uid, "mistake_book", setQuestions);
    return () => unsubscribe();
  }, [user]);

  return (
    <section className="space-y-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel-3d p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Part 5</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Mistake Book</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Wrong answers from tests are auto-synced here for revision.</p>
      </motion.div>

      {questions.length === 0 ? (
        <div className="panel-3d p-5 text-sm text-zinc-600 dark:text-zinc-300">
          No mistake questions yet. Start a test in
          <Link className="ml-1 font-semibold text-orange-600" to="/custom-test">
            Custom Test
          </Link>
          .
        </div>
      ) : null}

      <div className="space-y-3">
        {questions.map((question, index) => (
          <motion.article
            key={question.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="panel-3d p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">{question.subject}</span>
               <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{question.chapter}</span>
               <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{question.topic}</span>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{question.question}</p>
            <div className="mt-3 space-y-2">
              {question.options.map((option) => (
                <div
                  key={`${question.id}-${option}`}
                  className={`rounded-2xl border px-3 py-2 text-sm ${
                    option === question.correct_answer
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                       : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  {option}
                </div>
              ))}
            </div>
            <button
              className="btn-pill-primary mt-3 px-4 py-2 text-xs"
              type="button"
              onClick={() => setOpenId((prev) => (prev === question.id ? null : question.id))}
            >
              {openId === question.id ? "Hide Solution" : "View Solution"}
            </button>
            {openId === question.id ? (
              <p className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{question.solution}</p>
            ) : null}
          </motion.article>
        ))}
      </div>
    </section>
  );
}