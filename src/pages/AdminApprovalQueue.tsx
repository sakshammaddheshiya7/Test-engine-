import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  approveQueuedQuestion,
  listenQuestionApprovalQueue,
  rejectQueuedQuestion,
  type ApprovalQueueItem,
} from "../services/questionService";
import { addAdminAuditLog } from "../services/adminAuditService";

export default function AdminApprovalQueue() {
  const [rows, setRows] = useState<ApprovalQueueItem[]>([]);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  useEffect(() => {
    const unsubscribe = listenQuestionApprovalQueue(setRows, filter);
    return () => unsubscribe();
  }, [filter]);

  async function onApprove(id: string) {
    setBusyId(id);
    setStatus("");
    try {
      await approveQueuedQuestion(id);
      await addAdminAuditLog("question_approve", `Queue item ${id} approved.`);
      setStatus("Question approved and published.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setBusyId("");
    }
  }

  async function onReject(id: string) {
    const reason = window.prompt("Rejection reason", "Formatting or answer mismatch");
    if (reason === null) {
      return;
    }
    setBusyId(id);
    setStatus("");
    try {
      await rejectQueuedQuestion(id, reason);
      await addAdminAuditLog("question_reject", `Queue item ${id} rejected.`);
      setStatus("Question rejected.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rejection failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-orange-200">Part 41 Moderation</p>
        <h2 className="mt-2 text-2xl font-semibold">Question Approval Queue</h2>
        <p className="mt-2 text-sm text-zinc-300">Review queued questions, moderation flags, and approve or reject before publish.</p>
      </motion.div>

      <div className="admin-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select className="input-soft max-w-[180px]" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          {status ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{status}</p> : null}
        </div>

        <div className="mt-3 space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No queue items for this filter.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/70">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p className="font-semibold uppercase tracking-wide text-orange-500">{row.status}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">Score: {row.moderation?.score ?? 0}</p>
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">{row.question?.question || "Untitled"}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {row.question?.subject} / {row.question?.chapter} / {row.question?.topic}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Flags: {row.moderation?.flags?.length ? row.moderation.flags.join(", ") : "clean"}
                </p>

                {row.status === "pending" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-pill-primary px-4 py-2 text-xs"
                      disabled={busyId === row.id}
                      onClick={() => {
                        void onApprove(row.id);
                      }}
                    >
                      {busyId === row.id ? "Processing..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      className="btn-pill-ghost px-4 py-2 text-xs"
                      disabled={busyId === row.id}
                      onClick={() => {
                        void onReject(row.id);
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}