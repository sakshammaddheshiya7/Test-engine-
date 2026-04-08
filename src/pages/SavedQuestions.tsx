import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { listenToUserQuestionCollection, type SavedQuestionDoc } from "../services/questionService";

export default function SavedQuestions() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<SavedQuestionDoc[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = listenToUserQuestionCollection(user.uid, "saved_questions", setQuestions);
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
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Saved Questions</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Bookmarked questions are synced live from Firebase for quick revision.</p>
      </motion.div>

      {questions.length === 0 ? (
        <div className="panel-3d p-5 text-sm text-zinc-600 dark:text-zinc-300">
          No bookmarked questions yet. Save questions from
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
            <button
              className="btn-pill-ghost mt-3 px-4 py-2 text-xs"
              type="button"
              onClick={() => setOpenId((prev) => (prev === question.id ? null : question.id))}
            >
              {openId === question.id ? "Hide Answer" : "View Answer"}
            </button>
            {openId === question.id ? (
              <div className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <p>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Correct Answer:</span> {question.correct_answer}
                </p>
                <p className="mt-2">{question.solution}</p>
              </div>
            ) : null}
          </motion.article>
        ))}
      </div>
    </section>
  );
}