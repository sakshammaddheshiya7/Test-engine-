import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  deleteDiscussionMessage,
  listenRecentDiscussionMessages,
  type DiscussionModerationRow,
} from "../services/discussionService";

export default function AdminDiscussionModeration() {
  const [rows, setRows] = useState<DiscussionModerationRow[]>([]);
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const unsubscribe = listenRecentDiscussionMessages(setRows);
    return () => unsubscribe();
  }, []);

  const filteredRows = useMemo(() => {
    const needle = queryText.trim().toLowerCase();
    if (!needle) {
      return rows;
    }
    return rows.filter(
      (item) =>
        item.text.toLowerCase().includes(needle) ||
        item.userEmail.toLowerCase().includes(needle) ||
        item.threadId.toLowerCase().includes(needle),
    );
  }, [queryText, rows]);

  async function onDelete(item: DiscussionModerationRow) {
    try {
      await deleteDiscussionMessage(item.threadId, item.id);
      setStatus("Message removed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to remove message.");
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 36 Moderation</p>
        <h2 className="mt-1 text-2xl font-semibold">Discussion Moderation</h2>
        <p className="mt-1 text-sm text-zinc-300">Review live question discussions and remove spam or off-topic messages.</p>
      </motion.div>

      <div className="admin-surface space-y-3 p-4">
        <input
          className="input-soft"
          placeholder="Filter by text, email, or thread id"
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
        />
        {status ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{status}</p> : null}
        <div className="space-y-2">
          {filteredRows.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No discussion messages found.</p> : null}
          {filteredRows.slice(0, 140).map((item) => (
            <article key={`${item.threadId}_${item.id}`} className="rounded-2xl border border-zinc-200/80 bg-white/85 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.threadId}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.userEmail || item.userName || "Student"}</p>
              <p className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">{item.text}</p>
              <button type="button" className="btn-pill-ghost mt-2 px-3 py-1.5 text-[11px]" onClick={() => onDelete(item)}>
                Remove Message
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
