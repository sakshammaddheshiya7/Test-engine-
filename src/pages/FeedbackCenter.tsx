import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import {
  listenOwnFeedback,
  submitFeedback,
  type FeedbackCategory,
  type FeedbackDoc,
} from "../services/experienceService";

const categories: FeedbackCategory[] = ["bug", "feature", "content", "ui", "other"];

export default function FeedbackCenter() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<FeedbackDoc[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    return listenOwnFeedback(user.uid, setRows);
  }, [user]);

  async function onSubmit() {
    if (!user || !message.trim()) {
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await submitFeedback({
        userId: user.uid,
        userEmail: user.email ?? "",
        category,
        message: message.trim(),
      });
      setMessage("");
      setStatus("Feedback submitted successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not submit feedback.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-3d p-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Feedback Center</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Share bugs, suggestions, and content issues directly to the admin desk.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[170px_1fr]">
          <select className="input-soft" value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <textarea
            className="input-soft min-h-24"
            placeholder="Write your feedback"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        <button type="button" className="btn-pill-primary mt-3 px-4 py-2 text-xs" onClick={onSubmit} disabled={saving || !message.trim()}>
          {saving ? "Submitting..." : "Submit Feedback"}
        </button>
        {status ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{status}</p> : null}
      </motion.div>

      <div className="panel-3d p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Your Recent Feedback</h3>
        <div className="mt-3 space-y-2">
          {rows.length === 0 ? <p className="text-xs text-zinc-500 dark:text-zinc-400">No feedback submitted yet.</p> : null}
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-orange-500">{row.category}</span>
                <span className="text-zinc-500 dark:text-zinc-400">{row.status}</span>
              </div>
              <p className="mt-1 text-zinc-700 dark:text-zinc-200">{row.message}</p>
              {row.adminNote ? <p className="mt-1 text-zinc-500 dark:text-zinc-400">Admin note: {row.adminNote}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
